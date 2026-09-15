import {
    DrawdyElementSchema,
    SubscribeableKey,
    SubscribedDrawdyElement,
} from "@drawdy/driver-protocol";
import { Rect, combineRects } from "../score/geometry";
import { elementBounds } from "../score/ink";
import { Ctx, stamp, unwrap } from "./context";

export const SERENE_META_KEY = "serene";
export const FRAME_WIDTH = 960;
export const FRAME_HEIGHT = 600;
export const FRAME_GAP = 80;
const SEARCH_RINGS = 6;
const FLY_MS = 600;
const FLY_MAX_ZOOM = 1;

export const FRAME_PROPERTIES: SubscribeableKey[] = [
    "type",
    "meta",
    "x",
    "y",
    "width",
    "height",
];

const BOUNDS_PROPERTIES: SubscribeableKey[] = [
    "type",
    "x",
    "y",
    "width",
    "height",
];

type Point = { x: number; y: number };
type Size = { width: number; height: number };

export function isSereneFrame(el: SubscribedDrawdyElement): boolean {
    if (el.type !== "frame") return false;
    const marker = el.meta?.[SERENE_META_KEY];
    return marker === true || (typeof marker === "object" && marker !== null);
}

export function sereneFrameSchema(
    id: string,
    origin: Point
): DrawdyElementSchema {
    return {
        type: "frame",
        drawdyElementId: id,
        position: [origin.x, origin.y],
        width: FRAME_WIDTH,
        height: FRAME_HEIGHT,
        rotation: 0,
        meta: { [SERENE_META_KEY]: true },
    };
}

function overlaps(a: Rect, b: Rect): boolean {
    return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
    );
}

function pad(rect: Rect, amount: number): Rect {
    return {
        x: rect.x - amount,
        y: rect.y - amount,
        width: rect.width + amount * 2,
        height: rect.height + amount * 2,
    };
}

export function findFreeSpot(
    center: Point,
    size: Size,
    occupied: Rect[],
    gap: number
): Rect {
    const stepX = (size.width + gap) / 2;
    const stepY = (size.height + gap) / 2;
    const candidates: { rect: Rect; distance: number }[] = [];
    for (let i = -SEARCH_RINGS; i <= SEARCH_RINGS; i++) {
        for (let j = -SEARCH_RINGS; j <= SEARCH_RINGS; j++) {
            const dx = i * stepX;
            const dy = j * stepY;
            candidates.push({
                rect: {
                    x: center.x + dx - size.width / 2,
                    y: center.y + dy - size.height / 2,
                    width: size.width,
                    height: size.height,
                },
                distance: Math.hypot(dx, dy),
            });
        }
    }
    candidates.sort((a, b) => a.distance - b.distance);
    const free = candidates.find(
        ({ rect }) => !occupied.some((taken) => overlaps(pad(rect, gap), taken))
    );
    if (free) return free.rect;

    const union = combineRects(occupied);
    const rightEdge = union ? union.x + union.width : center.x;
    return {
        x: rightEdge + gap,
        y: center.y - size.height / 2,
        width: size.width,
        height: size.height,
    };
}

async function framesWith(
    ctx: Ctx,
    drawdyElementIds?: string[]
): Promise<SubscribedDrawdyElement[]> {
    const { drawdyElements } = unwrap(
        await ctx.issueCommand({
            type: "command:scene:get-drawdy-elements",
            ...stamp(ctx),
            req: { properties: FRAME_PROPERTIES, drawdyElementIds },
        })
    );
    return drawdyElements.filter(isSereneFrame);
}

export async function listSereneFrames(
    ctx: Ctx
): Promise<SubscribedDrawdyElement[]> {
    return framesWith(ctx);
}

export async function sereneFramesAmong(
    ctx: Ctx,
    ids: string[]
): Promise<SubscribedDrawdyElement[]> {
    if (ids.length === 0) return [];
    return framesWith(ctx, ids);
}

async function occupiedAround(ctx: Ctx, center: Point): Promise<Rect[]> {
    const reachX = FRAME_WIDTH * (SEARCH_RINGS + 1);
    const reachY = FRAME_HEIGHT * (SEARCH_RINGS + 1);
    const { drawdyElements } = unwrap(
        await ctx.issueCommand({
            type: "command:scene:query-rect",
            ...stamp(ctx),
            req: {
                rect: {
                    x: center.x - reachX,
                    y: center.y - reachY,
                    width: reachX * 2,
                    height: reachY * 2,
                },
                properties: BOUNDS_PROPERTIES,
            },
        })
    );
    return drawdyElements
        .map(elementBounds)
        .filter((r): r is Rect => r !== null);
}

export async function addSereneFrame(ctx: Ctx): Promise<string> {
    const { rect: viewport } = unwrap(
        await ctx.issueCommand({
            type: "command:camera:get-viewport-rect",
            ...stamp(ctx),
        })
    );
    const center = {
        x: viewport.x + viewport.width / 2,
        y: viewport.y + viewport.height / 2,
    };
    const occupied = await occupiedAround(ctx, center);
    const spot = findFreeSpot(
        center,
        { width: FRAME_WIDTH, height: FRAME_HEIGHT },
        occupied,
        FRAME_GAP
    );
    const id = ctx.generateId();
    unwrap(
        await ctx.issueCommand({
            type: "command:scene:add-drawdy-elements",
            ...stamp(ctx),
            req: { elements: [sereneFrameSchema(id, spot)] },
        })
    );
    unwrap(
        await ctx.issueCommand({
            type: "command:scene:set-selection",
            ...stamp(ctx),
            req: { drawdyElementIds: [id] },
        })
    );
    unwrap(
        await ctx.issueCommand({
            type: "command:camera:fly-to-rect",
            ...stamp(ctx),
            req: {
                rect: pad(spot, FRAME_GAP),
                flyDurationMs: FLY_MS,
                zoom: FLY_MAX_ZOOM,
            },
        })
    );
    return id;
}
