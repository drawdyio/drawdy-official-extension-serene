import {
    DrawdyElementSchema,
    SubscribeableKey,
    SubscribedDrawdyElement,
} from "@drawdy/driver-protocol";
import { Rect } from "../score/geometry";
import { elementBounds } from "../score/ink";
import { Ctx, stamp, unwrap } from "./context";

export const SERENE_META_KEY = "serene";
// Asks Drawdy to skip its own name chip; Serene draws the frame bar instead.
export const HIDE_LABEL_META_KEY = "hideFrameLabel";
export const FRAME_WIDTH = 960;
export const FRAME_HEIGHT = 600;
export const FRAME_GAP = 120;
const FLY_MS = 380;
const FLY_MAX_ZOOM = 0.8;
// Room around the frame so the frame bar above it stays in view.
const FLY_PADDING = 80;

export const FRAME_PROPERTIES: SubscribeableKey[] = [
    "type",
    "meta",
    "x",
    "y",
    "width",
    "height",
];

type Point = { x: number; y: number };

export function isSereneFrame(el: SubscribedDrawdyElement): boolean {
    if (el.type !== "frame") return false;
    const marker = el.meta?.[SERENE_META_KEY];
    return marker === true || (typeof marker === "object" && marker !== null);
}

/**
 * Drivers cannot read or set a Drawdy frame's own name, so a Serene frame
 * keeps its name in its meta. Frames made before names existed have none.
 */
export function storedFrameName(el: SubscribedDrawdyElement): string | null {
    const marker = el.meta?.[SERENE_META_KEY];
    if (typeof marker !== "object" || marker === null) return null;
    const name = (marker as Record<string, unknown>).name;
    return typeof name === "string" && name.trim() !== "" ? name : null;
}

/** Unnamed frames take the first "Serene {n}" that no other frame uses. */
export function frameNames(frames: SubscribedDrawdyElement[]): string[] {
    const stored = frames.map(storedFrameName);
    const taken = new Set(stored.filter((name): name is string => name !== null));
    let n = 1;
    return stored.map((name) => {
        if (name !== null) return name;
        while (taken.has(`Serene ${n}`)) n++;
        const picked = `Serene ${n}`;
        taken.add(picked);
        return picked;
    });
}

/** "Serene {n}": the first unused number, starting at frame count + 1. */
export function nextFrameName(frames: SubscribedDrawdyElement[]): string {
    const taken = new Set(frameNames(frames));
    let n = frames.length + 1;
    while (taken.has(`Serene ${n}`)) n++;
    return `Serene ${n}`;
}

export function sereneFrameSchema(
    id: string,
    origin: Point,
    name: string
): DrawdyElementSchema {
    return {
        type: "frame",
        drawdyElementId: id,
        position: [origin.x, origin.y],
        width: FRAME_WIDTH,
        height: FRAME_HEIGHT,
        rotation: 0,
        meta: { [SERENE_META_KEY]: { name }, [HIDE_LABEL_META_KEY]: true },
    };
}

function pad(rect: Rect, amount: number): Rect {
    return {
        x: rect.x - amount,
        y: rect.y - amount,
        width: rect.width + amount * 2,
        height: rect.height + amount * 2,
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

/**
 * Frames made before names and the Serene bar existed: store the name they are
 * listed under, so it cannot shift as frames come and go, and hide Drawdy's chip.
 */
export async function migrateFrames(
    ctx: Ctx,
    frames: SubscribedDrawdyElement[],
    names: string[]
): Promise<void> {
    const updates = frames
        .map((frame, index) => ({ frame, name: names[index] }))
        .filter(
            ({ frame }) =>
                frame.meta?.[HIDE_LABEL_META_KEY] !== true || storedFrameName(frame) === null
        )
        .map(({ frame, name }) => ({
            drawdyElementId: frame.id,
            properties: {
                meta: { [SERENE_META_KEY]: { name }, [HIDE_LABEL_META_KEY]: true },
            },
        }));
    if (updates.length === 0) return;
    await ctx.issueCommand({
        type: "command:scene:update-drawdy-elements",
        ...stamp(ctx),
        req: { updates },
    });
}

async function viewportCenter(ctx: Ctx): Promise<Point> {
    const { rect } = unwrap(
        await ctx.issueCommand({
            type: "command:camera:get-viewport-rect",
            ...stamp(ctx),
        })
    );
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

/** Right of the rightmost Serene frame, level with it; centered in view when there is none. */
async function nextFrameOrigin(
    ctx: Ctx,
    frames: SubscribedDrawdyElement[]
): Promise<Point> {
    let rightmost: Rect | null = null;
    for (const frame of frames) {
        const bounds = elementBounds(frame);
        if (!bounds) continue;
        if (!rightmost || bounds.x + bounds.width > rightmost.x + rightmost.width) {
            rightmost = bounds;
        }
    }
    if (rightmost) {
        return { x: rightmost.x + rightmost.width + FRAME_GAP, y: rightmost.y };
    }
    const center = await viewportCenter(ctx);
    return { x: center.x - FRAME_WIDTH / 2, y: center.y - FRAME_HEIGHT / 2 };
}

export async function flyToFrame(ctx: Ctx, rect: Rect): Promise<void> {
    unwrap(
        await ctx.issueCommand({
            type: "command:camera:fly-to-rect",
            ...stamp(ctx),
            req: {
                rect: pad(rect, FLY_PADDING),
                flyDurationMs: FLY_MS,
                zoom: FLY_MAX_ZOOM,
            },
        })
    );
}

export const MAX_FRAME_NAME = 60;

export async function renameFrame(ctx: Ctx, id: string, name: string): Promise<void> {
    unwrap(
        await ctx.issueCommand({
            type: "command:scene:update-drawdy-elements",
            ...stamp(ctx),
            req: {
                updates: [
                    { drawdyElementId: id, properties: { meta: { [SERENE_META_KEY]: { name } } } },
                ],
            },
        })
    );
}

export async function selectFrame(ctx: Ctx, id: string): Promise<void> {
    unwrap(
        await ctx.issueCommand({
            type: "command:scene:set-selection",
            ...stamp(ctx),
            req: { drawdyElementIds: [id] },
        })
    );
}

export async function selectAndFlyTo(ctx: Ctx, id: string): Promise<void> {
    const [frame] = await sereneFramesAmong(ctx, [id]);
    const bounds = frame ? elementBounds(frame) : null;
    if (!bounds) return;
    unwrap(
        await ctx.issueCommand({
            type: "command:scene:set-selection",
            ...stamp(ctx),
            req: { drawdyElementIds: [id] },
        })
    );
    await flyToFrame(ctx, bounds);
}

export async function addSereneFrame(ctx: Ctx): Promise<string> {
    const frames = await listSereneFrames(ctx);
    const origin = await nextFrameOrigin(ctx, frames);
    const id = ctx.generateId();
    unwrap(
        await ctx.issueCommand({
            type: "command:scene:add-drawdy-elements",
            ...stamp(ctx),
            req: {
                elements: [sereneFrameSchema(id, origin, nextFrameName(frames))],
            },
        })
    );
    unwrap(
        await ctx.issueCommand({
            type: "command:scene:set-selection",
            ...stamp(ctx),
            req: { drawdyElementIds: [id] },
        })
    );
    await flyToFrame(ctx, {
        ...origin,
        width: FRAME_WIDTH,
        height: FRAME_HEIGHT,
    });
    return id;
}
