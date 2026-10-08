import { SubscribeableKey } from "@drawdy/driver-protocol";
import { Polyline, Rect, evenPick } from "../score/geometry";
import { elementBounds, elementInk } from "../score/ink";
import { Ctx, stamp, unwrap } from "./context";
import { frameNames, listSereneFrames, migrateFrames } from "./frames";
import { INK_PROPERTIES, dropStageElements } from "./target";

// Thumbnails are drawn in a viewBox this wide, height following the frame.
const THUMB_WIDTH = 160;
const MAX_THUMB_STROKES = 60;
const MAX_THUMB_POINTS = 48;

const THUMB_PROPERTIES: SubscribeableKey[] = [...INK_PROPERTIES, "strokeColor"];

// Only plain color syntax reaches the panel's markup.
const SAFE_COLOR = /^(#[0-9a-f]{3,8}|(rgba?|hsla?|oklch|oklab|lab|lch)\([\d\s.,%/-]+\)|[a-z]+)$/i;

export type ThumbStroke = { d: string; color: string | null };

export type FrameSummary = {
    id: string;
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    strokes: ThumbStroke[];
};

function thumbPath(points: Polyline, rect: Rect, scale: number): string {
    const picked = points.length > MAX_THUMB_POINTS ? evenPick(points, MAX_THUMB_POINTS) : points;
    return picked
        .map(([x, y], index) => {
            const tx = ((x - rect.x) * scale).toFixed(1);
            const ty = ((y - rect.y) * scale).toFixed(1);
            return `${index === 0 ? "M" : "L"}${tx} ${ty}`;
        })
        .join("");
}

async function thumbStrokes(ctx: Ctx, frameId: string, rect: Rect): Promise<ThumbStroke[]> {
    const { drawdyElements } = unwrap(
        await ctx.issueCommand({
            type: "command:scene:query-rect",
            ...stamp(ctx),
            req: { rect, properties: THUMB_PROPERTIES },
        })
    );
    const elements = dropStageElements(
        drawdyElements.filter((el) => el.type !== "frame"),
        [frameId]
    );
    const scale = THUMB_WIDTH / Math.max(1, rect.width);
    const strokes: ThumbStroke[] = [];
    for (const el of elements) {
        const color =
            typeof el.strokeColor === "string" && SAFE_COLOR.test(el.strokeColor)
                ? el.strokeColor
                : null;
        for (const { points } of elementInk(el)) {
            strokes.push({ d: thumbPath(points, rect, scale), color });
        }
    }
    return strokes.length > MAX_THUMB_STROKES
        ? evenPick(strokes, MAX_THUMB_STROKES)
        : strokes;
}

export async function frameSummaries(ctx: Ctx): Promise<FrameSummary[]> {
    const frames = await listSereneFrames(ctx);
    const names = frameNames(frames);
    void migrateFrames(ctx, frames, names).catch(() => undefined);
    const summaries = await Promise.all(
        frames.map(async (frame, index): Promise<FrameSummary | null> => {
            const rect = elementBounds(frame);
            if (!rect || rect.width <= 0 || rect.height <= 0) return null;
            return {
                id: frame.id,
                name: names[index],
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
                strokes: await thumbStrokes(ctx, frame.id, rect),
            };
        })
    );
    return summaries.filter((s): s is FrameSummary => s !== null);
}
