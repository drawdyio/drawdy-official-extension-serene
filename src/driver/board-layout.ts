import { Rect } from "../score/geometry";

/** Screen-pixel metrics of the board overlay; divide by zoom for canvas units. */
export const BOARD = {
    barHeight: 32,
    barGap: 8,
    majorTick: 10,
    minorTick: 5,
    tickLabelTop: 10,
    tickLabelInset: 5,
    tickLabelEdge: 20,
    minTickSpacing: 6,
    minLabelSpacing: 32,
    noteInset: 8,
    noteTopClear: 32,
    noteBottomClear: 10,
    noteLineHeight: 16,
    noteMinSpacing: 16,
    handleWidth: 12,
    handleHeight: 20,
    handleAbove: 4,
};

const LABEL_STEPS = [1, 2, 5, 10, 15, 30, 60];

export function formatClock(sec: number): string {
    const tenths = Math.round(Math.max(0, sec) * 10);
    const minutes = Math.floor(tenths / 600);
    const rest = (tenths - minutes * 600) / 10;
    return `${minutes}:${rest < 10 ? "0" : ""}${rest.toFixed(1)}`;
}

export type Tick = {
    /** Canvas units from the frame's left edge. */
    x: number;
    major: boolean;
    label: string | null;
};

/**
 * Ticks every 0.5 s of real time, none at 0; whole seconds are emphasized and
 * labeled. When zoomed out, sparser ticks and labels keep them legible.
 */
export function rulerTicks(width: number, pxPerSecond: number, zoom: number): Tick[] {
    const secondPx = pxPerSecond * zoom;
    if (secondPx <= 0 || width <= 0) return [];
    const labelStep =
        LABEL_STEPS.find((step) => step * secondPx >= BOARD.minLabelSpacing) ??
        LABEL_STEPS[LABEL_STEPS.length - 1];
    const halves = 0.5 * secondPx >= BOARD.minTickSpacing;
    const minorStep = halves ? 0.5 : secondPx >= BOARD.minTickSpacing ? 1 : labelStep;
    const ticks: Tick[] = [];
    for (let n = 1; ; n++) {
        const t = n * minorStep;
        const x = t * pxPerSecond;
        if (x >= width - 0.5 / zoom) break;
        const whole = Math.abs(t - Math.round(t)) < 1e-6;
        const labeled =
            whole &&
            Math.round(t) % labelStep === 0 &&
            (width - x) * zoom > BOARD.tickLabelEdge;
        ticks.push({
            x,
            major: whole && halves,
            label: labeled ? `${Math.round(t)}s` : null,
        });
    }
    return ticks;
}

export type NoteLabel = { label: string; /** Canvas y of the label's top. */ top: number };

/**
 * One label per C within the range, at the height its pitch row plays,
 * nudged clear of the ruler and the bottom edge, dropping any that crowd.
 */
export function noteLabels(
    rect: Rect,
    lowOctave: number,
    highOctave: number,
    stepsPerOctave: number,
    zoom: number
): NoteLabel[] {
    const span = highOctave - lowOctave;
    const rows = stepsPerOctave * span + 1;
    const line = BOARD.noteLineHeight / zoom;
    const minTop = rect.y + BOARD.noteTopClear / zoom;
    const maxTop = rect.y + rect.height - BOARD.noteBottomClear / zoom - line;
    if (maxTop < minTop || rows <= 0) return [];
    const labels: NoteLabel[] = [];
    for (let k = span; k >= 0; k--) {
        const row = k * stepsPerOctave;
        const center = rect.y + rect.height * (1 - (row + 0.5) / rows);
        const top = Math.min(maxTop, Math.max(minTop, center - line / 2));
        const previous = labels[labels.length - 1];
        if (previous && (top - previous.top) * zoom < BOARD.noteMinSpacing) continue;
        labels.push({ label: `C${lowOctave + k}`, top });
    }
    return labels;
}

const BAR_MIN_SCALE = 0.85;
// Average advance of Google Sans, in em; a little generous so
// an estimate never runs short of the text it backs.
const CHAR_EM = 0.56;

export function estimateTextWidth(text: string, fontPx: number): number {
    return text.length * fontPx * CHAR_EM;
}

export type BarFit = {
    scale: number;
    name: string | null;
    time: string | null;
    /** Estimated screen width, so the bar never has to wrap to fit. */
    width: number;
};

/** Frame-anchored text keeps its size when zoomed in and shrinks with zoom out, to 85%. */
export function barScale(zoom: number): number {
    return Math.min(1, Math.max(BAR_MIN_SCALE, zoom));
}

/**
 * The frame bar shrinks with zoom and never runs wider than its frame: it
 * drops the time, then shortens the name, then shows only the icon, and hides
 * when even that does not fit. Widths are screen px.
 */
export function fitBar(name: string, time: string, frameWidth: number, zoom: number): BarFit | null {
    const scale = barScale(zoom);
    const pad = 8 * scale;
    const icon = 20 * scale;
    const gap = 8 * scale;
    const font = 13 * scale;
    const base = pad * 2 + icon;
    const nameWidth = estimateTextWidth(name, font);
    const full = base + gap + nameWidth + gap + estimateTextWidth(time, font);
    if (full <= frameWidth) return { scale, name, time, width: full };
    if (base + gap + nameWidth <= frameWidth) {
        return { scale, name, time: null, width: base + gap + nameWidth };
    }
    const chars = Math.floor((frameWidth - base - gap) / (font * CHAR_EM)) - 1;
    if (chars >= 3) {
        const short = `${name.slice(0, chars).trimEnd()}\u2026`;
        return { scale, name: short, time: null, width: base + gap + estimateTextWidth(short, font) };
    }
    if (base <= frameWidth) return { scale, name: null, time: null, width: base };
    return null;
}
