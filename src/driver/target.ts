import {
    SubscribeableKey,
    SubscribedDrawdyElement,
} from "@drawdy/driver-protocol";
import { Rect, combineRects, rectArea, rectContainsPoint } from "../score/geometry";
import { elementBounds } from "../score/ink";
import { Ctx, stamp, unwrap } from "./context";
import { FRAME_PROPERTIES, isSereneFrame } from "./frames";

export const INK_PROPERTIES: SubscribeableKey[] = [
    "type",
    "componentType",
    "x",
    "y",
    "width",
    "height",
    "points",
    "rotation",
];

const HIT_PAD = 8;

const STAGE_TOLERANCE = 1;

export type Target = {
    rect: Rect;
    frameIds: string[];
    elements: SubscribedDrawdyElement[];
};

function encloses(outer: Rect, inner: Rect): boolean {
    return (
        inner.x >= outer.x - STAGE_TOLERANCE &&
        inner.y >= outer.y - STAGE_TOLERANCE &&
        inner.x + inner.width <= outer.x + outer.width + STAGE_TOLERANCE &&
        inner.y + inner.height <= outer.y + outer.height + STAGE_TOLERANCE
    );
}

export function dropStageElements(
    elements: SubscribedDrawdyElement[],
    stageIds: string[]
): SubscribedDrawdyElement[] {
    const stage = new Set(stageIds);
    const content = elements.filter((el) => !stage.has(el.id));
    if (content.length === 0) return elements;

    const contentRects = content
        .map(elementBounds)
        .filter((r): r is Rect => r !== null);

    return elements.filter((el) => {
        if (!stage.has(el.id)) return true;
        const bounds = elementBounds(el);
        if (!bounds) return true;
        return !contentRects.every((inner) => encloses(bounds, inner));
    });
}

async function elementsInRect(
    ctx: Ctx,
    rect: Rect,
    properties: SubscribeableKey[]
): Promise<SubscribedDrawdyElement[]> {
    const { drawdyElements } = unwrap(
        await ctx.issueCommand({
            type: "command:scene:query-rect",
            ...stamp(ctx),
            req: { rect, properties },
        })
    );
    return drawdyElements;
}

async function elementsByIds(
    ctx: Ctx,
    drawdyElementIds: string[],
    properties: SubscribeableKey[]
): Promise<SubscribedDrawdyElement[]> {
    const { drawdyElements } = unwrap(
        await ctx.issueCommand({
            type: "command:scene:get-drawdy-elements",
            ...stamp(ctx),
            req: { properties, drawdyElementIds },
        })
    );
    return drawdyElements;
}

function boundsUnion(elements: SubscribedDrawdyElement[]): Rect | null {
    const rects = elements
        .map(elementBounds)
        .filter((r): r is Rect => r !== null);
    return combineRects(rects);
}

function smallestFrameUnder(
    frames: SubscribedDrawdyElement[],
    pointer: { x: number; y: number }
): SubscribedDrawdyElement | null {
    let smallest: SubscribedDrawdyElement | null = null;
    let smallestArea = Infinity;
    for (const frame of frames) {
        const bounds = elementBounds(frame);
        if (!bounds || !rectContainsPoint(bounds, pointer.x, pointer.y)) continue;
        const area = rectArea(bounds);
        if (area < smallestArea) {
            smallestArea = area;
            smallest = frame;
        }
    }
    return smallest;
}

async function seedFrameIds(
    ctx: Ctx,
    pointer: { x: number; y: number } | null,
    explicit: string[]
): Promise<string[]> {
    if (explicit.length > 0) return explicit;

    const { drawdyElementIds } = unwrap(
        await ctx.issueCommand({
            type: "command:scene:get-current-selected-drawdy-elements",
            ...stamp(ctx),
        })
    );
    if (drawdyElementIds.length > 0) {
        const selected = await elementsByIds(ctx, drawdyElementIds, FRAME_PROPERTIES);
        const frames = selected.filter(isSereneFrame).map((el) => el.id);
        if (frames.length > 0) return frames;
    }
    if (!pointer) return [];

    const hits = await elementsInRect(
        ctx,
        {
            x: pointer.x - HIT_PAD,
            y: pointer.y - HIT_PAD,
            width: HIT_PAD * 2,
            height: HIT_PAD * 2,
        },
        FRAME_PROPERTIES
    );
    const frame = smallestFrameUnder(hits.filter(isSereneFrame), pointer);
    return frame ? [frame.id] : [];
}

type Region = { rect: Rect; stageIds: string[] };

async function resolveRegion(
    ctx: Ctx,
    pointer: { x: number; y: number } | null,
    explicit: string[]
): Promise<Region | null> {
    const stageIds = await seedFrameIds(ctx, pointer, explicit);
    if (stageIds.length === 0) return null;

    const frames = await elementsByIds(ctx, stageIds, FRAME_PROPERTIES);
    const rect = boundsUnion(frames);
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;

    return { rect, stageIds };
}

export async function resolveTarget(
    ctx: Ctx,
    pointer: { x: number; y: number } | null,
    explicit: string[] = []
): Promise<Target | null> {
    const region = await resolveRegion(ctx, pointer, explicit);
    if (!region) return null;

    const inRegion = (
        await elementsInRect(ctx, region.rect, INK_PROPERTIES)
    ).filter((el) => el.type !== "frame");
    const elements = dropStageElements(inRegion, region.stageIds);

    return { rect: region.rect, frameIds: region.stageIds, elements };
}
