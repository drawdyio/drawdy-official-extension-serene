import {
    SubscribeableKey,
    SubscribedDrawdyElement,
} from "@drawdy/driver-protocol";
import { Rect, combineRects, rectArea, rectContainsPoint } from "../score/geometry";
import { elementBounds } from "../score/ink";
import { Ctx, stamp, unwrap } from "./context";

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

const BOUNDS_PROPERTIES: SubscribeableKey[] = [
    "type",
    "x",
    "y",
    "width",
    "height",
];

const HIT_PAD = 8;

const STAGE_TOLERANCE = 1;

export type Target = {
    rect: Rect;
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

async function boardRect(ctx: Ctx): Promise<Rect | null> {
    const { drawdyElements } = unwrap(
        await ctx.issueCommand({
            type: "command:scene:get-drawdy-elements",
            ...stamp(ctx),
            req: { properties: BOUNDS_PROPERTIES },
        })
    );
    return boundsUnion(drawdyElements);
}

function pickHit(
    hits: SubscribedDrawdyElement[],
    pointer: { x: number; y: number }
): SubscribedDrawdyElement | null {
    const enclosingFrame = hits.find((el) => {
        if (el.type !== "frame") return false;
        const bounds = elementBounds(el);
        return bounds ? rectContainsPoint(bounds, pointer.x, pointer.y) : false;
    });
    if (enclosingFrame) return enclosingFrame;

    let smallest: SubscribedDrawdyElement | null = null;
    let smallestArea = Infinity;
    for (const el of hits) {
        const bounds = elementBounds(el);
        if (!bounds) continue;
        const area = rectArea(bounds);
        if (area < smallestArea) {
            smallestArea = area;
            smallest = el;
        }
    }
    return smallest;
}

async function seedIds(
    ctx: Ctx,
    pointer: { x: number; y: number } | null
): Promise<string[]> {
    const { drawdyElementIds } = unwrap(
        await ctx.issueCommand({
            type: "command:scene:get-current-selected-drawdy-elements",
            ...stamp(ctx),
        })
    );
    if (drawdyElementIds.length > 0) return drawdyElementIds;
    if (!pointer) return [];

    const hits = await elementsInRect(
        ctx,
        {
            x: pointer.x - HIT_PAD,
            y: pointer.y - HIT_PAD,
            width: HIT_PAD * 2,
            height: HIT_PAD * 2,
        },
        BOUNDS_PROPERTIES
    );
    const hit = pickHit(hits, pointer);
    return hit ? [hit.id] : [];
}

type Region = { rect: Rect; stageIds: string[] };

async function resolveRegion(
    ctx: Ctx,
    pointer: { x: number; y: number } | null
): Promise<Region | null> {
    const stageIds = await seedIds(ctx, pointer);

    let rect: Rect | null;
    if (stageIds.length > 0) {
        const seeds = await elementsByIds(ctx, stageIds, BOUNDS_PROPERTIES);
        const frames = seeds.filter((el) => el.type === "frame");
        rect = boundsUnion(frames.length > 0 ? frames : seeds);
    } else {
        rect = await boardRect(ctx);
    }
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;

    return { rect, stageIds };
}

export async function resolveTarget(
    ctx: Ctx,
    pointer: { x: number; y: number } | null
): Promise<Target | null> {
    const region = await resolveRegion(ctx, pointer);
    if (!region) return null;

    const inRegion = (
        await elementsInRect(ctx, region.rect, INK_PROPERTIES)
    ).filter((el) => el.type !== "frame");
    const elements = dropStageElements(inRegion, region.stageIds);
    if (elements.length === 0) return null;

    return { rect: region.rect, elements };
}
