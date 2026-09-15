export type ScaleId =
    | "major-pentatonic"
    | "major"
    | "dorian"
    | "lydian"
    | "mixolydian"
    | "japanese";

export type Scale = {
    id: ScaleId;
    name: string;
    steps: number[];
};

export const SCALES: Scale[] = [
    {
        id: "major-pentatonic",
        name: "C major pentatonic",
        steps: [0, 2, 4, 7, 9],
    },
    { id: "major", name: "C major", steps: [0, 2, 4, 5, 7, 9, 11] },
    { id: "dorian", name: "C dorian", steps: [0, 2, 3, 5, 7, 9, 10] },
    { id: "lydian", name: "C lydian", steps: [0, 2, 4, 6, 7, 9, 11] },
    { id: "mixolydian", name: "C mixolydian", steps: [0, 2, 4, 5, 7, 9, 10] },
    { id: "japanese", name: "Japanese hirajoshi", steps: [0, 2, 3, 7, 8] },
];

export const DEFAULT_SCALE_ID: ScaleId = "major-pentatonic";

export type PitchRange = { lowOctave: number; highOctave: number };

export const MIN_OCTAVE = 1;
export const MAX_OCTAVE = 8;
export const DEFAULT_RANGE: PitchRange = { lowOctave: 4, highOctave: 7 };

export function normalizeRange(
    lowOctave: unknown,
    highOctave: unknown,
    fallback: PitchRange = DEFAULT_RANGE
): PitchRange {
    const clampOctave = (value: unknown, alt: number): number =>
        typeof value === "number" && Number.isFinite(value)
            ? Math.min(MAX_OCTAVE, Math.max(MIN_OCTAVE, Math.round(value)))
            : alt;
    let low = clampOctave(lowOctave, fallback.lowOctave);
    let high = clampOctave(highOctave, fallback.highOctave);
    if (low >= high) {
        if (low >= MAX_OCTAVE) low = MAX_OCTAVE - 1;
        high = low + 1;
    }
    return { lowOctave: low, highOctave: high };
}

function bottomMidi(range: PitchRange): number {
    return 12 * (range.lowOctave + 1);
}

function octaveSpan(range: PitchRange): number {
    return range.highOctave - range.lowOctave;
}

export function getScale(id: string): Scale {
    return (
        SCALES.find((scale) => scale.id === id) ??
        SCALES.find((scale) => scale.id === DEFAULT_SCALE_ID)!
    );
}

export function scaleRows(scale: Scale, range: PitchRange): number {
    return scale.steps.length * octaveSpan(range) + 1;
}

export function rowToMidi(scale: Scale, range: PitchRange, row: number): number {
    const rows = scaleRows(scale, range);
    const clamped = Math.max(0, Math.min(rows - 1, Math.round(row)));
    const octave = Math.floor(clamped / scale.steps.length);
    const step = scale.steps[clamped % scale.steps.length];
    return bottomMidi(range) + octave * 12 + step;
}

export function midiToHz(midi: number): number {
    return 440 * Math.pow(2, (midi - 69) / 12);
}

export function rowToHz(scale: Scale, range: PitchRange, row: number): number {
    return midiToHz(rowToMidi(scale, range, row));
}

export function yToRow(
    scale: Scale,
    range: PitchRange,
    y: number,
    top: number,
    height: number
): number {
    if (height <= 0) return 0;
    const rows = scaleRows(scale, range);
    const fromBottom = 1 - (y - top) / height;
    return Math.max(0, Math.min(rows - 1, Math.floor(fromBottom * rows)));
}

const NOTE_NAMES = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B",
];

export function rowNoteName(scale: Scale, range: PitchRange, row: number): string {
    const midi = rowToMidi(scale, range, row);
    return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}
