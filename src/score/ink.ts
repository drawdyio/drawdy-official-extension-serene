import { SubscribedDrawdyElement } from "@drawdy/driver-protocol";
import { Point, Polyline, Rect, rotatePolyline } from "./geometry";

const ELLIPSE_SEGMENTS = 48;

const STROKE_COMPONENT_TYPES = new Set(["line", "arrow"]);

export type Ink = { points: Polyline; gain: number; glide: boolean };

export function elementGlides(el: SubscribedDrawdyElement): boolean {
    return (
        el.type === "freedraw" ||
        STROKE_COMPONENT_TYPES.has(el.componentType ?? "")
    );
}

export function elementGain(el: SubscribedDrawdyElement): number {
    const opacity = el.opacity;
    if (typeof opacity !== "number" || !Number.isFinite(opacity)) return 1;
    return Math.min(1, Math.max(0, opacity));
}

export function elementBounds(el: SubscribedDrawdyElement): Rect | null {
    const { x, y, width, height } = el;
    if (x == null || y == null || width == null || height == null) return null;
    return { x, y, width, height };
}

function closed(points: Polyline): Polyline {
    if (points.length < 2) return points;
    const first = points[0];
    const last = points[points.length - 1];
    if (first[0] === last[0] && first[1] === last[1]) return points;
    return [...points, [first[0], first[1]]];
}

function rectOutline(r: Rect): Polyline {
    return closed([
        [r.x, r.y],
        [r.x + r.width, r.y],
        [r.x + r.width, r.y + r.height],
        [r.x, r.y + r.height],
    ]);
}

function diamondOutline(r: Rect): Polyline {
    return closed([
        [r.x + r.width / 2, r.y],
        [r.x + r.width, r.y + r.height / 2],
        [r.x + r.width / 2, r.y + r.height],
        [r.x, r.y + r.height / 2],
    ]);
}

function ellipseOutline(r: Rect): Polyline {
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;
    const out: Polyline = [];
    for (let i = 0; i <= ELLIPSE_SEGMENTS; i++) {
        const t = (i / ELLIPSE_SEGMENTS) * Math.PI * 2;
        out.push([
            cx + (r.width / 2) * Math.cos(t),
            cy + (r.height / 2) * Math.sin(t),
        ]);
    }
    return out;
}

function shapeOutline(
    componentType: string | undefined,
    r: Rect
): Polyline | null {
    switch (componentType) {
        case "rect":
            return rectOutline(r);
        case "diamond":
            return diamondOutline(r);
        case "circle":
            return ellipseOutline(r);
        default:
            return null;
    }
}

function elementLines(el: SubscribedDrawdyElement): Polyline[] {
    if (el.type === "frame") return [];

    const bounds = elementBounds(el);
    const rotation = el.rotation ?? 0;
    const center: Point | null = bounds
        ? [bounds.x + bounds.width / 2, bounds.y + bounds.height / 2]
        : null;
    const spin = (points: Polyline): Polyline =>
        center ? rotatePolyline(points, center[0], center[1], rotation) : points;

    if (el.type === "freedraw") {
        const points = el.points;
        if (!points || points.length < 2) return [];
        return [points.map(([x, y]) => [x, y] as Point)];
    }

    if (STROKE_COMPONENT_TYPES.has(el.componentType ?? "")) {
        const points = el.points;
        if (!points || points.length < 2) return [];
        return [spin(points.map(([x, y]) => [x, y] as Point))];
    }

    if (!bounds || bounds.width < 0 || bounds.height < 0) return [];

    const outline = shapeOutline(el.componentType, bounds);
    if (outline) return [spin(outline)];

    return [spin(rectOutline(bounds))];
}

export function elementInk(el: SubscribedDrawdyElement): Ink[] {
    const gain = elementGain(el);
    const glide = elementGlides(el);
    return elementLines(el)
        .filter((line) => line.length >= 2)
        .map((points) => ({ points, gain, glide }));
}

export function sceneInk(elements: SubscribedDrawdyElement[]): Ink[] {
    return elements.flatMap(elementInk);
}

export function laserInk(strokes: readonly (readonly [number, number][])[]): Ink[] {
    return strokes
        .filter((stroke) => stroke.length >= 2)
        .map((stroke) => ({
            points: stroke.map(([x, y]) => [x, y] as Point),
            gain: 1,
            glide: true,
        }));
}
