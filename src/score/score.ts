import { Polyline, Rect, evenPick, monotonicRuns } from "./geometry";
import { Ink } from "./ink";
import {
    DEFAULT_RANGE,
    DEFAULT_SCALE_ID,
    PitchRange,
    Scale,
    ScaleId,
    getScale,
    normalizeRange,
    scaleRows,
    yToRow,
} from "./pitch";

export type PitchPoint = { t: number; row: number };

export type Voice = {
    startSec: number;
    durationSec: number;
    column: number;
    velocity: number;
    glide: boolean;
    pitches: PitchPoint[];
};

export type Score = {
    rect: Rect;
    scale: Scale;
    range: PitchRange;
    pxPerSecond: number;
    durationSec: number;
    columns: number;
    rows: number;
    stepSec: number;
    cells: number[];
    voices: Voice[];
};

export type ScoreOptions = {
    pxPerSecond: number;
    stepsPerSecond: number;
    maxVoices: number;
    scale: ScaleId;
    lowOctave: number;
    highOctave: number;
};

export const DEFAULT_SCORE_OPTIONS: ScoreOptions = {
    pxPerSecond: 220,
    stepsPerSecond: 8,
    maxVoices: 5,
    scale: DEFAULT_SCALE_ID,
    lowOctave: DEFAULT_RANGE.lowOctave,
    highOctave: DEFAULT_RANGE.highOctave,
};

export const MIN_PX_PER_SECOND = 40;
export const MAX_PX_PER_SECOND = 900;

const MIN_DURATION_SEC = 0.4;
const MAX_DURATION_SEC = 180;
const MAX_COLUMNS = 1024;
const MAX_SEGMENT_SAMPLES = 4096;
const MAX_PITCH_POINTS = 256;
const FULL_VELOCITY_HITS = 8;
const MIN_VELOCITY = 0.42;

type Cell = { column: number; row: number };

type ColumnGroup = { column: number; rows: number[] };

export function clampSpeed(pxPerSecond: number): number {
    if (!isFinite(pxPerSecond)) return DEFAULT_SCORE_OPTIONS.pxPerSecond;
    return Math.max(
        MIN_PX_PER_SECOND,
        Math.min(MAX_PX_PER_SECOND, pxPerSecond)
    );
}

class Grid {
    public readonly cells: number[];

    public readonly rows: number;

    public constructor(
        private readonly _rect: Rect,
        public readonly columns: number,
        private readonly _scale: Scale,
        private readonly _range: PitchRange
    ) {
        this.rows = scaleRows(_scale, _range);
        this.cells = new Array<number>(columns * this.rows).fill(0);
    }

    public get colWidth(): number {
        return this._rect.width / this.columns;
    }

    public get rowHeight(): number {
        return this._rect.height / this.rows;
    }

    public locate(x: number, y: number): Cell | null {
        const { _rect: rect } = this;
        if (
            x < rect.x ||
            x > rect.x + rect.width ||
            y < rect.y ||
            y > rect.y + rect.height
        ) {
            return null;
        }
        const column = Math.max(
            0,
            Math.min(
                this.columns - 1,
                Math.floor((x - rect.x) / this.colWidth)
            )
        );
        return {
            column,
            row: yToRow(this._scale, this._range, y, rect.y, rect.height),
        };
    }

    public hit(cell: Cell): void {
        this.cells[cell.column * this.rows + cell.row]++;
    }

    public hitsAt(cell: Cell): number {
        return this.cells[cell.column * this.rows + cell.row];
    }
}

function walkRun(
    run: Polyline,
    grid: Grid,
    sampleStep: number,
    onCell: (cell: Cell | null) => void
): void {
    for (let i = 1; i < run.length; i++) {
        const [ax, ay] = run[i - 1];
        const [bx, by] = run[i];
        const length = Math.hypot(bx - ax, by - ay);
        const samples = Math.max(
            1,
            Math.min(MAX_SEGMENT_SAMPLES, Math.ceil(length / sampleStep))
        );
        for (let s = i === 1 ? 0 : 1; s <= samples; s++) {
            const t = s / samples;
            onCell(grid.locate(ax + (bx - ax) * t, ay + (by - ay) * t));
        }
    }
}

function groupByColumn(cells: Cell[]): ColumnGroup[] {
    const groups: ColumnGroup[] = [];
    for (const cell of cells) {
        const last = groups[groups.length - 1];
        if (last && last.column === cell.column) {
            if (last.rows[last.rows.length - 1] !== cell.row) {
                last.rows.push(cell.row);
            }
            continue;
        }
        groups.push({ column: cell.column, rows: [cell.row] });
    }
    return groups;
}

function decimate(pitches: PitchPoint[]): PitchPoint[] {
    if (pitches.length <= MAX_PITCH_POINTS) return pitches;
    return evenPick(pitches, MAX_PITCH_POINTS);
}

const GLISSANDO_MIN_ROWS = 3;

function dominantRow(group: ColumnGroup, grid: Grid): number {
    let best = group.rows[0];
    let bestHits = -1;
    for (const row of group.rows) {
        const hits = grid.hitsAt({ column: group.column, row });
        if (hits > bestHits) {
            bestHits = hits;
            best = row;
        }
    }
    return best;
}

function snapShallowColumns(groups: ColumnGroup[], grid: Grid): ColumnGroup[] {
    return groups.map((group) =>
        group.rows.length >= GLISSANDO_MIN_ROWS
            ? group
            : { column: group.column, rows: [dominantRow(group, grid)] }
    );
}

function runBounds(run: Polyline): Rect {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [x, y] of run) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function splitIntoNotes(voice: Voice, stepSec: number): Voice[] {
    if (voice.pitches.length <= 1) return [voice];
    return voice.pitches.map((pitch, index) => {
        const next = voice.pitches[index + 1];
        const startSec = voice.startSec + pitch.t;
        const endSec = next
            ? voice.startSec + next.t
            : voice.startSec + voice.durationSec;
        return {
            startSec,
            durationSec: Math.max(stepSec / 4, endSec - startSec),
            column: Math.floor(startSec / stepSec + 1e-6),
            velocity: voice.velocity,
            glide: false,
            pitches: [{ t: 0, row: pitch.row }],
        };
    });
}

function toVoice(
    groups: ColumnGroup[],
    grid: Grid,
    stepSec: number,
    gain: number,
    glide: boolean
): Voice | null {
    if (groups.length === 0) return null;
    const firstColumn = groups[0].column;
    const lastColumn = groups[groups.length - 1].column;
    const startSec = firstColumn * stepSec;

    const pitches: PitchPoint[] = [];
    let peak = 0;
    for (const group of groups) {
        const slots = group.rows.length;
        group.rows.forEach((row, index) => {
            peak = Math.max(peak, grid.hitsAt({ column: group.column, row }));
            const at = (group.column + index / slots) * stepSec - startSec;
            const previous = pitches[pitches.length - 1];
            if (previous && previous.row === row) return;
            pitches.push({ t: Math.max(0, at), row });
        });
    }
    if (pitches.length === 0) return null;

    return {
        startSec,
        durationSec: (lastColumn + 1) * stepSec - startSec,
        column: firstColumn,
        glide,
        velocity:
            gain *
            (MIN_VELOCITY +
                (1 - MIN_VELOCITY) * Math.min(1, peak / FULL_VELOCITY_HITS)),
        pitches: decimate(pitches),
    };
}

type Strand = { cells: Cell[]; gain: number; glide: boolean };

function buildVoices(
    ink: Ink[],
    grid: Grid,
    stepSec: number,
    maxVoices: number
): Voice[] {
    const sampleStep = Math.max(0.5, Math.min(grid.colWidth, grid.rowHeight) / 2);
    const strands: Strand[] = [];

    for (const { points, gain, glide } of ink) {
        if (gain <= 0) continue;
        for (const run of monotonicRuns(points)) {
            const bounds = runBounds(run);
            if (bounds.width < grid.colWidth && bounds.height < grid.rowHeight) {
                const dot = grid.locate(
                    bounds.x + bounds.width / 2,
                    bounds.y + bounds.height / 2
                );
                if (dot) {
                    grid.hit(dot);
                    strands.push({ cells: [dot], gain, glide });
                }
                continue;
            }
            let pending: Cell[] = [];
            const flush = (): void => {
                if (pending.length > 0) {
                    strands.push({ cells: pending, gain, glide });
                }
                pending = [];
            };
            walkRun(run, grid, sampleStep, (cell) => {
                if (!cell) {
                    flush();
                    return;
                }
                grid.hit(cell);
                pending.push(cell);
            });
            flush();
        }
    }

    const voices = strands
        .map((strand) =>
            toVoice(
                snapShallowColumns(groupByColumn(strand.cells), grid),
                grid,
                stepSec,
                strand.gain,
                strand.glide
            )
        )
        .filter((voice): voice is Voice => voice !== null)
        .flatMap((voice) =>
            voice.glide ? [voice] : splitIntoNotes(voice, stepSec)
        );

    const byColumn = new Map<number, Voice[]>();
    for (const voice of voices) {
        const bucket = byColumn.get(voice.column);
        if (bucket) bucket.push(voice);
        else byColumn.set(voice.column, [voice]);
    }

    const kept: Voice[] = [];
    for (const bucket of byColumn.values()) {
        bucket.sort((a, b) => a.pitches[0].row - b.pitches[0].row);
        kept.push(...evenPick(bucket, maxVoices));
    }
    kept.sort(
        (a, b) => a.startSec - b.startSec || a.pitches[0].row - b.pitches[0].row
    );
    return kept;
}

export function buildScore(
    rect: Rect,
    ink: Ink[],
    options: Partial<ScoreOptions> = {}
): Score {
    const { pxPerSecond, stepsPerSecond, maxVoices, scale, lowOctave, highOctave } =
        { ...DEFAULT_SCORE_OPTIONS, ...options };
    const resolved = getScale(scale);
    const range = normalizeRange(lowOctave, highOctave);
    const speed = clampSpeed(pxPerSecond);
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    const durationSec = Math.max(
        MIN_DURATION_SEC,
        Math.min(MAX_DURATION_SEC, width / speed)
    );
    const columns = Math.max(
        1,
        Math.min(MAX_COLUMNS, Math.round(durationSec * stepsPerSecond))
    );
    const stepSec = durationSec / columns;
    const normalized: Rect = { x: rect.x, y: rect.y, width, height };
    const grid = new Grid(normalized, columns, resolved, range);
    const voices = buildVoices(ink, grid, stepSec, maxVoices);

    return {
        rect: normalized,
        scale: resolved,
        range,
        pxPerSecond: speed,
        durationSec,
        columns,
        rows: grid.rows,
        stepSec,
        cells: grid.cells,
        voices,
    };
}

export function playheadX(score: Score, elapsedSec: number): number {
    const t = Math.max(0, Math.min(score.durationSec, elapsedSec));
    return score.rect.x + (t / score.durationSec) * score.rect.width;
}
