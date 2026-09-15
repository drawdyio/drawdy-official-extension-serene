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
// Voice-led upper voices are nudged back when they wander past this window.
const UPPER_LOW_MIDI = CHORD_OCTAVE_MIDI - 8; // E3
const UPPER_HIGH_MIDI = CHORD_OCTAVE_MIDI + 19; // G5
const OUT_OF_RANGE_PENALTY = 6;
// Gentle gravity toward each voice's opening register. Without it, a loop
// like I vi IV V climbs an inversion every pass until it hits the window.
const HOME_PULL = 0.6;
// Open voicing: the upper voices should span more than an octave. Collapsing
// into close position costs this much extra movement.
const CLOSED_PENALTY = 4;
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

/**
 * `upper` is in voice order (not sorted) so a voice keeps its index from
 * chord to chord; `home` is where each voice started; `thirdClass` identifies
 * the third for the omit3 voicing.
 */
export type ChordTones = {
    bass: number;
    upper: number[];
    home: number[];
    thirdClass: number;
};

function nearestOctave(pitchClass: number, reference: number): number {
    const below = reference - ((((reference - pitchClass) % 12) + 12) % 12);
    const above = below + 12;
    return reference - below <= above - reference ? below : above;
}

function permutations<T>(items: T[]): T[][] {
    if (items.length <= 1) return [items];
    const out: T[][] = [];
    items.forEach((item, index) => {
        const rest = [...items.slice(0, index), ...items.slice(index + 1)];
        for (const tail of permutations(rest)) out.push([item, ...tail]);
    });
    return out;
}

/**
 * Four-part-harmony style voice leading: each previous voice moves to the
 * nearest octave of one chord tone so that every tone is covered and the
 * total movement is as small as possible (C E G -> B E G rather than E G B).
 */
export function leadVoices(
    previous: number[],
    pitchClasses: number[],
    home: number[] = previous
): number[] {
    let best: number[] = [];
    let bestCost = Infinity;
    for (const assignment of permutations(pitchClasses)) {
        const next = assignment.map((pitchClass, index) =>
            nearestOctave(pitchClass, previous[index])
        );
        let total = 0;
        let widest = 0;
        next.forEach((midi, index) => {
            const move = Math.abs(midi - previous[index]);
            total += move + HOME_PULL * Math.abs(midi - home[index]);
            widest = Math.max(widest, move);
            if (midi < UPPER_LOW_MIDI || midi > UPPER_HIGH_MIDI) {
                total += OUT_OF_RANGE_PENALTY;
            }
        });
        const span = Math.max(...next) - Math.min(...next);
        if (span < 12) total += CLOSED_PENALTY;
        const cost = total + widest / 100;
        if (cost < bestCost) {
            bestCost = cost;
            best = next;
        }
    }
    return best;
}

/**
 * With `lead` on, the upper voices move smoothly from `previous`; off, they
 * are always spelled in plain root-position (or first-inversion) order, which
 * arpeggios rely on for their 1 3 5 1' 3' shape.
 */
export function chordTones(
    scale: Scale,
    spec: ChordSpec,
    previous?: ChordTones,
    lead = true
): ChordTones {
    const root = scale.steps.length === 7 ? scale.steps[spec.degree % 7] : 0;
    const [, third, fifth] = triadSemitones(scale, spec.degree);
    const bassInterval = spec.inversion === 1 ? third : 0;
    const octaveShift = root >= DESCEND_FROM_SEMITONES ? -12 : 0;
    const bassClass = (root + bassInterval) % 12;
    const thirdClass = (root + third) % 12;
    const bass =
        previous && spec.inversion === 1
            ? nearestOctave(bassClass, previous.bass)
            : BASS_OCTAVE_MIDI + bassClass + octaveShift;
    // Arpeggios want close spelling in 1 3 5 order; led chords open with
    // the third on top an octave up (C3 G3 E4) and stay open from there.
    const order = !lead
        ? spec.inversion === 1
            ? [third, fifth, 12]
            : [0, third, fifth]
        : [0, fifth, third + 12];
    const upper =
        previous && lead
            ? leadVoices(
              previous.upper,
              [root % 12, thirdClass, (root + fifth) % 12],
              previous.home
          )
            : order.map(
                  (interval) => CHORD_OCTAVE_MIDI + root + interval + octaveShift
              );
    return { bass, upper, home: previous ? previous.home : upper, thirdClass };
}

export function voiceTones(tones: ChordTones, voicing: Voicing): number[] {
    if (voicing === "bass") return [tones.bass];
    if (voicing === "omit3") {
        return [
            tones.bass,
            ...tones.upper.filter((midi) => midi % 12 !== tones.thirdClass),
        ];
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
    const arp = isArp(options.rhythm);
    // Sustained chords are voice-led continuously across repeated passes so
    // the return to the first chord is as smooth as every other change.
    // Arpeggios keep plain root-position spelling.
    let previous: ChordTones | undefined;
    for (let pass = 0; pass < count; pass++) {
        prog.chords.forEach((spec, chordIndex) => {
            const chord = chordTones(harmony, spec, previous, !arp);
            previous = chord;
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
            const tones = voiceTones(chord, options.voicing);
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
