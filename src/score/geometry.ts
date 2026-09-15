export type Point = [number, number];

export type Polyline = Point[];

export type Rect = { x: number; y: number; width: number; height: number };

export function rotatePoint(
    p: Point,
    cx: number,
    cy: number,
    angle: number
): Point {
    if (angle === 0) return [p[0], p[1]];
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dx = p[0] - cx;
    const dy = p[1] - cy;
    return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
}

export function rotatePolyline(
    points: Polyline,
    cx: number,
    cy: number,
    angle: number
): Polyline {
    if (angle === 0) return points;
    return points.map((p) => rotatePoint(p, cx, cy, angle));
}

export function combineRects(rects: Rect[]): Rect | null {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const r of rects) {
        if (r.width < 0 || r.height < 0) continue;
        minX = Math.min(minX, r.x);
        minY = Math.min(minY, r.y);
        maxX = Math.max(maxX, r.x + r.width);
        maxY = Math.max(maxY, r.y + r.height);
    }
    if (!isFinite(minX)) return null;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function rectContainsPoint(rect: Rect, x: number, y: number): boolean {
    return (
        x >= rect.x &&
        x <= rect.x + rect.width &&
        y >= rect.y &&
        y <= rect.y + rect.height
    );
}

export function rectArea(rect: Rect): number {
    return Math.max(0, rect.width) * Math.max(0, rect.height);
}

export function monotonicRuns(line: Polyline): Polyline[] {
    if (line.length < 2) return [];
    const runs: Polyline[] = [];
    let current: Polyline = [line[0]];
    let direction = 0;

    for (let i = 1; i < line.length; i++) {
        const dx = line[i][0] - line[i - 1][0];
        const sign = dx > 0 ? 1 : dx < 0 ? -1 : 0;
        if (sign !== 0 && direction !== 0 && sign !== direction) {
            runs.push(current);
            current = [line[i - 1]];
            direction = sign;
        } else if (direction === 0) {
            direction = sign;
        }
        current.push(line[i]);
    }
    runs.push(current);

    return runs
        .filter((run) => run.length >= 2)
        .map((run) =>
            run[run.length - 1][0] < run[0][0] ? [...run].reverse() : run
        );
}

export function evenPick<T>(items: T[], keep: number): T[] {
    if (items.length <= keep) return items;
    if (keep <= 1) return [items[0]];
    const out: T[] = [];
    for (let i = 0; i < keep; i++) {
        out.push(items[Math.round((i * (items.length - 1)) / (keep - 1))]);
    }
    return out;
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
    return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
    );
}
