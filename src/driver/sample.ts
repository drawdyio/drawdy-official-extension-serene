import { DrawdyElementSchema } from "@drawdy/driver-protocol";
import { Point, Rect } from "../score/geometry";
import { Ctx, stamp, unwrap } from "./context";

// A palette blue that reads the same in light and dark themes.
const SAMPLE_COLOR = "#698CF9";
const SAMPLE_STROKE_WIDTH = 4;
const CURVE_POINTS = 48;

type Unit = [number, number];

function curve(from: number, to: number, y: (u: number) => number): Unit[] {
    const points: Unit[] = [];
    for (let i = 0; i <= CURVE_POINTS; i++) {
        const u = i / CURVE_POINTS;
        points.push([from + (to - from) * u, y(u)]);
    }
    return points;
}

/** Frame-relative strokes (0..1): a rising phrase, its falling answer and low plucks. */
function sampleShapes(): Unit[][] {
    const phrase = curve(0.06, 0.46, (u) => 0.6 - 0.16 * Math.sin(u * Math.PI * 3) - 0.22 * u);
    const answer = curve(0.52, 0.94, (u) => 0.32 + 0.1 * Math.sin(u * Math.PI * 2) + 0.3 * u);
    const plucks = [0.1, 0.3, 0.5, 0.7, 0.9].map((x): Unit[] => [
        [x, 0.86],
        [x + 0.004, 0.862],
    ]);
    return [phrase, answer, ...plucks];
}

function freedraw(ctx: Ctx, points: Point[]): DrawdyElementSchema {
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    return {
        type: "freedraw",
        drawdyElementId: ctx.generateId(),
        points: points.flat(),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
        spline: true,
        strokeColor: SAMPLE_COLOR,
        strokeWidth: SAMPLE_STROKE_WIDTH,
        meta: {},
    };
}

export async function addSample(ctx: Ctx, frame: Rect): Promise<void> {
    const elements = sampleShapes().map((shape) =>
        freedraw(
            ctx,
            shape.map(([u, v]): Point => [frame.x + u * frame.width, frame.y + v * frame.height])
        )
    );
    unwrap(
        await ctx.issueCommand({
            type: "command:scene:add-drawdy-elements",
            ...stamp(ctx),
            req: { elements },
        })
    );
}
