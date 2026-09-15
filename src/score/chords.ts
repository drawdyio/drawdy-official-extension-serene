import { Scale, ScaleId, getScale } from "./pitch";

export type Voicing = "bass" | "omit3" | "full";
export type ArpPattern = "arp-up" | "arp-down";
export type Rhythm = 1 | 2 | 4 | ArpPattern;

export const ARP_PATTERNS: ArpPattern[] = ["arp-up", "arp-down"];

export function isArp(rhythm: Rhythm): rhythm is ArpPattern {
    return typeof rhythm === "string";
}

export type BackingOptions = {
    progression: number;
    voicing: Voicing;
    rhythm: Rhythm;
};

export type ChordSpec = { degree: number; inversion: number };
export type Progression = { name: string; chords: ChordSpec[] };

const BASS_OCTAVE_MIDI = 36;
const CHORD_OCTAVE_MIDI = 48;
const DESCEND_FROM_SEMITONES = 10;
const PROGRESSION_SPAN_PX = 1000;
const BACKING_VELOCITY = 0.85;
const BASS_VELOCITY = 1;
const ARP_VELOCITY = 0.8;
const SUSTAIN_PORTION = 0.85;
const ARP_STEPS_PER_CHORD = 16;
const ARP_NOTE_PORTION = 0.9;

const ARP_SHAPES: Record<ArpPattern, number[]> = {
    "arp-up": [0, 1, 2, 3, 4, 2, 1, 0],
    "arp-down": [4, 3, 2, 1, 0, 2, 3, 4],
};

function arpIndex(pattern: ArpPattern, step: number, toneCount: number): number {
    const shape = ARP_SHAPES[pattern];
    return shape[step % shape.length] % toneCount;
}

const ROMAN: Record<string, number> = {
    i: 0,
    ii: 1,
    iii: 2,
    iv: 3,
    v: 4,
    vi: 5,
    vii: 6,
};

function chord(symbol: string): ChordSpec {
    const [numeral, suffix] = symbol.split("/");
    const degree = ROMAN[numeral.toLowerCase()];
    return { degree, inversion: suffix === "6" ? 1 : 0 };
}

function progression(symbols: string): Progression {
    return {
        name: symbols,
        chords: symbols.split(" ").map(chord),
    };
}

const MAJOR_PROGRESSIONS: Progression[] = [
    progression("I vi IV V"),
    progression("I iii IV V"),
    progression("I V"),
    progression("I IV"),
    progression("I"),
];

const PROGRESSIONS: Record<ScaleId, Progression[]> = {
    major: MAJOR_PROGRESSIONS,
    dorian: [
        progression("i III IV"),
        progression("i IV"),
        progression("i III/6 IV/6"),
    ],
    mixolydian: [progression("I v"), progression("I vii")],
    lydian: [
        progression("I II V"),
        progression("I II I II"),
        progression("I II"),
        progression("I V"),
        progression("I"),
    ],
    "major-pentatonic": MAJOR_PROGRESSIONS,
    japanese: [progression("I")],
};

export function harmonyScale(scale: Scale): Scale {
    return scale.id === "major-pentatonic" ? getScale("major") : scale;
}

export function progressionsFor(scaleId: ScaleId): Progression[] {
    return PROGRESSIONS[scaleId];
}

export function pickProgression(scaleId: ScaleId, index: number): Progression {
    const list = progressionsFor(scaleId);
    const clamped = Math.min(list.length - 1, Math.max(0, Math.floor(index)));
    return list[clamped];
}

function triadSemitones(scale: Scale, degree: number): number[] {
    const steps = scale.steps;
    if (steps.length !== 7) {
        const third = steps.includes(4) ? 4 : 3;
        return [0, third, 7];
    }
    const root = steps[degree % 7];
    const at = (offset: number): number => {
        const index = (degree + offset) % 7;
        const wrapped = Math.floor((degree + offset) / 7) * 12;
        return steps[index] + wrapped - root;
    };
    return [0, at(2), at(4)];
}

export type ChordTones = { bass: number; upper: number[] };

function nearestOctave(pitchClass: number, reference: number): number {
    const below = reference - ((((reference - pitchClass) % 12) + 12) % 12);
    const above = below + 12;
    return reference - below <= above - reference ? below : above;
}

export function chordTones(
    scale: Scale,
    spec: ChordSpec,
    previousBass?: number
): ChordTones {
    const root = scale.steps.length === 7 ? scale.steps[spec.degree % 7] : 0;
    const [, third, fifth] = triadSemitones(scale, spec.degree);
    const order =
        spec.inversion === 1 ? [third, fifth, 12] : [0, third, fifth];
    const bassInterval = spec.inversion === 1 ? third : 0;
    const octaveShift = root >= DESCEND_FROM_SEMITONES ? -12 : 0;
    const bassClass = (root + bassInterval) % 12;
    const bass =
        spec.inversion === 1 && previousBass !== undefined
            ? nearestOctave(bassClass, previousBass)
            : BASS_OCTAVE_MIDI + bassClass + octaveShift;
    const upper = order.map(
        (interval) => CHORD_OCTAVE_MIDI + root + interval + octaveShift
    );
    return { bass, upper };
}

export function voiceTones(tones: ChordTones, voicing: Voicing, inversion: number): number[] {
    if (voicing === "bass") return [tones.bass];
    if (voicing === "omit3") {
        const withoutThird =
            inversion === 1
                ? [tones.upper[1], tones.upper[2]]
                : [tones.upper[0], tones.upper[2]];
        return [tones.bass, ...withoutThird];
    }
    return [tones.bass, ...tones.upper];
}

export function progressionCount(frameWidth: number): number {
    return Math.max(1, Math.round(frameWidth / PROGRESSION_SPAN_PX));
}

export type BackingHit = {
    startSec: number;
    durationSec: number;
    midi: number;
    velocity: number;
    arp: boolean;
};

export function backingHits(
    scale: Scale,
    frameWidth: number,
    durationSec: number,
    options: BackingOptions
): BackingHit[] {
    const prog = pickProgression(scale.id, options.progression);
    const harmony = harmonyScale(scale);
    const count = progressionCount(frameWidth);
    const progressionSec = durationSec / count;
    const chordSec = progressionSec / prog.chords.length;
    const hits: BackingHit[] = [];
    for (let pass = 0; pass < count; pass++) {
        let previousBass: number | undefined;
        prog.chords.forEach((spec, chordIndex) => {
            const chord = chordTones(harmony, spec, previousBass);
            previousBass = chord.bass;
            const chordStart = pass * progressionSec + chordIndex * chordSec;
            if (isArp(options.rhythm)) {
                hits.push({
                    startSec: chordStart,
                    durationSec: chordSec * SUSTAIN_PORTION,
                    midi: chord.bass,
                    velocity: BASS_VELOCITY,
                    arp: false,
                });
                const arpTones = [
                    ...chord.upper,
                    chord.upper[0] + 12,
                    chord.upper[1] + 12,
                ];
                const stepSec = chordSec / ARP_STEPS_PER_CHORD;
                for (let step = 0; step < ARP_STEPS_PER_CHORD; step++) {
                    const index = arpIndex(options.rhythm, step, arpTones.length);
                    hits.push({
                        startSec: chordStart + step * stepSec,
                        durationSec: stepSec * ARP_NOTE_PORTION,
                        midi: arpTones[index],
                        velocity: ARP_VELOCITY,
                        arp: true,
                    });
                }
                return;
            }
            const strikes = options.rhythm;
            const hitSec = chordSec / strikes;
            const holdSec = strikes === 1 ? hitSec * SUSTAIN_PORTION : hitSec;
            const tones = voiceTones(chord, options.voicing, spec.inversion);
            for (let hit = 0; hit < strikes; hit++) {
                const startSec = chordStart + hit * hitSec;
                tones.forEach((midi, toneIndex) => {
                    hits.push({
                        startSec,
                        durationSec: holdSec,
                        midi,
                        velocity: toneIndex === 0 ? BASS_VELOCITY : BACKING_VELOCITY,
                        arp: false,
                    });
                });
            }
        });
    }
    return hits;
}
