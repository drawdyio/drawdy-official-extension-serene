'use strict';

function stamp(ctx) {
    return { driverId: ctx.driverId, requestId: ctx.nextRequestId() };
}
function unwrap(response) {
    const { error, value } = response.res;
    if (error !== undefined) {
        throw new Error(`${error.type}${error.message ? `: ${error.message}` : ""}`);
    }
    return value;
}

function rotatePoint(p, cx, cy, angle) {
    if (angle === 0)
        return [p[0], p[1]];
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dx = p[0] - cx;
    const dy = p[1] - cy;
    return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
}
function rotatePolyline(points, cx, cy, angle) {
    if (angle === 0)
        return points;
    return points.map((p) => rotatePoint(p, cx, cy, angle));
}
function combineRects(rects) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const r of rects) {
        if (r.width < 0 || r.height < 0)
            continue;
        minX = Math.min(minX, r.x);
        minY = Math.min(minY, r.y);
        maxX = Math.max(maxX, r.x + r.width);
        maxY = Math.max(maxY, r.y + r.height);
    }
    if (!isFinite(minX))
        return null;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
function monotonicRuns(line) {
    if (line.length < 2)
        return [];
    const runs = [];
    let current = [line[0]];
    let direction = 0;
    for (let i = 1; i < line.length; i++) {
        const dx = line[i][0] - line[i - 1][0];
        const sign = dx > 0 ? 1 : dx < 0 ? -1 : 0;
        if (sign !== 0 && direction !== 0 && sign !== direction) {
            runs.push(current);
            current = [line[i - 1]];
            direction = sign;
        }
        else if (direction === 0) {
            direction = sign;
        }
        current.push(line[i]);
    }
    runs.push(current);
    return runs
        .filter((run) => run.length >= 2)
        .map((run) => run[run.length - 1][0] < run[0][0] ? [...run].reverse() : run);
}
function evenPick(items, keep) {
    if (items.length <= keep)
        return items;
    if (keep <= 1)
        return [items[0]];
    const out = [];
    for (let i = 0; i < keep; i++) {
        out.push(items[Math.round((i * (items.length - 1)) / (keep - 1))]);
    }
    return out;
}
function rectsOverlap(a, b) {
    return (a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y);
}

const ELLIPSE_SEGMENTS = 48;
const STROKE_COMPONENT_TYPES = new Set(["line", "arrow"]);
function elementGlides(el) {
    return (el.type === "freedraw" ||
        STROKE_COMPONENT_TYPES.has(el.componentType ?? ""));
}
const OPACITY_CURVE = 2;
function elementGain(el) {
    const opacity = el.opacity;
    if (typeof opacity !== "number" || !Number.isFinite(opacity))
        return 1;
    return Math.pow(Math.min(1, Math.max(0, opacity)), OPACITY_CURVE);
}
function elementBounds(el) {
    const { x, y, width, height } = el;
    if (x == null || y == null || width == null || height == null)
        return null;
    return { x, y, width, height };
}
function closed(points) {
    if (points.length < 2)
        return points;
    const first = points[0];
    const last = points[points.length - 1];
    if (first[0] === last[0] && first[1] === last[1])
        return points;
    return [...points, [first[0], first[1]]];
}
function rectOutline(r) {
    return closed([
        [r.x, r.y],
        [r.x + r.width, r.y],
        [r.x + r.width, r.y + r.height],
        [r.x, r.y + r.height],
    ]);
}
function diamondOutline(r) {
    return closed([
        [r.x + r.width / 2, r.y],
        [r.x + r.width, r.y + r.height / 2],
        [r.x + r.width / 2, r.y + r.height],
        [r.x, r.y + r.height / 2],
    ]);
}
function ellipseOutline(r) {
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;
    const out = [];
    for (let i = 0; i <= ELLIPSE_SEGMENTS; i++) {
        const t = (i / ELLIPSE_SEGMENTS) * Math.PI * 2;
        out.push([
            cx + (r.width / 2) * Math.cos(t),
            cy + (r.height / 2) * Math.sin(t),
        ]);
    }
    return out;
}
function shapeOutline(componentType, r) {
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
function elementLines(el) {
    if (el.type === "frame")
        return [];
    const bounds = elementBounds(el);
    const rotation = el.rotation ?? 0;
    const center = bounds
        ? [bounds.x + bounds.width / 2, bounds.y + bounds.height / 2]
        : null;
    const spin = (points) => center ? rotatePolyline(points, center[0], center[1], rotation) : points;
    if (el.type === "freedraw") {
        const points = el.points;
        if (!points || points.length < 2)
            return [];
        return [points.map(([x, y]) => [x, y])];
    }
    if (STROKE_COMPONENT_TYPES.has(el.componentType ?? "")) {
        const points = el.points;
        if (!points || points.length < 2)
            return [];
        return [spin(points.map(([x, y]) => [x, y]))];
    }
    if (!bounds || bounds.width < 0 || bounds.height < 0)
        return [];
    const outline = shapeOutline(el.componentType, bounds);
    if (outline)
        return [spin(outline)];
    return [spin(rectOutline(bounds))];
}
function elementInk(el) {
    const gain = elementGain(el);
    const glide = elementGlides(el);
    return elementLines(el)
        .filter((line) => line.length >= 2)
        .map((points) => ({ points, gain, glide }));
}
function sceneInk(elements) {
    return elements.flatMap(elementInk);
}
function laserInk(strokes) {
    return strokes
        .filter((stroke) => stroke.length >= 2)
        .map((stroke) => ({
        points: stroke.map(([x, y]) => [x, y]),
        gain: 1,
        glide: true,
    }));
}

/** Screen-pixel metrics of the board overlay; divide by zoom for canvas units. */
const BOARD = {
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
function formatClock(sec) {
    const tenths = Math.round(Math.max(0, sec) * 10);
    const minutes = Math.floor(tenths / 600);
    const rest = (tenths - minutes * 600) / 10;
    return `${minutes}:${rest < 10 ? "0" : ""}${rest.toFixed(1)}`;
}
/**
 * Ticks every 0.5 s of real time, none at 0; whole seconds are emphasized and
 * labeled. When zoomed out, sparser ticks and labels keep them legible.
 */
function rulerTicks(width, pxPerSecond, zoom) {
    const secondPx = pxPerSecond * zoom;
    if (secondPx <= 0 || width <= 0)
        return [];
    const labelStep = LABEL_STEPS.find((step) => step * secondPx >= BOARD.minLabelSpacing) ??
        LABEL_STEPS[LABEL_STEPS.length - 1];
    const halves = 0.5 * secondPx >= BOARD.minTickSpacing;
    const minorStep = halves ? 0.5 : secondPx >= BOARD.minTickSpacing ? 1 : labelStep;
    const ticks = [];
    for (let n = 1;; n++) {
        const t = n * minorStep;
        const x = t * pxPerSecond;
        if (x >= width - 0.5 / zoom)
            break;
        const whole = Math.abs(t - Math.round(t)) < 1e-6;
        const labeled = whole &&
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
/**
 * One label per C within the range, at the height its pitch row plays,
 * nudged clear of the ruler and the bottom edge, dropping any that crowd.
 */
function noteLabels(rect, lowOctave, highOctave, stepsPerOctave, zoom) {
    const span = highOctave - lowOctave;
    const rows = stepsPerOctave * span + 1;
    const line = BOARD.noteLineHeight / zoom;
    const minTop = rect.y + BOARD.noteTopClear / zoom;
    const maxTop = rect.y + rect.height - BOARD.noteBottomClear / zoom - line;
    if (maxTop < minTop || rows <= 0)
        return [];
    const labels = [];
    for (let k = span; k >= 0; k--) {
        const row = k * stepsPerOctave;
        const center = rect.y + rect.height * (1 - (row + 0.5) / rows);
        const top = Math.min(maxTop, Math.max(minTop, center - line / 2));
        const previous = labels[labels.length - 1];
        if (previous && (top - previous.top) * zoom < BOARD.noteMinSpacing)
            continue;
        labels.push({ label: `C${lowOctave + k}`, top });
    }
    return labels;
}
const BAR_MIN_SCALE = 0.85;
// Average advance of Google Sans, in em; a little generous so
// an estimate never runs short of the text it backs.
const CHAR_EM = 0.56;
function estimateTextWidth(text, fontPx) {
    return text.length * fontPx * CHAR_EM;
}
/** Frame-anchored text keeps its size when zoomed in and shrinks with zoom out, to 85%. */
function barScale(zoom) {
    return Math.min(1, Math.max(BAR_MIN_SCALE, zoom));
}
/**
 * The frame bar shrinks with zoom and never runs wider than its frame: it
 * drops the time, then shortens the name, then shows only the icon, and hides
 * when even that does not fit. Widths are screen px.
 */
function fitBar(name, time, frameWidth, zoom) {
    const scale = barScale(zoom);
    const pad = 8 * scale;
    const icon = 20 * scale;
    const gap = 8 * scale;
    const font = 13 * scale;
    const base = pad * 2 + icon;
    const nameWidth = estimateTextWidth(name, font);
    const full = base + gap + nameWidth + gap + estimateTextWidth(time, font);
    if (full <= frameWidth)
        return { scale, name, time, width: full };
    if (base + gap + nameWidth <= frameWidth) {
        return { scale, name, time: null, width: base + gap + nameWidth };
    }
    const chars = Math.floor((frameWidth - base - gap) / (font * CHAR_EM)) - 1;
    if (chars >= 3) {
        const short = `${name.slice(0, chars).trimEnd()}\u2026`;
        return { scale, name: short, time: null, width: base + gap + estimateTextWidth(short, font) };
    }
    if (base <= frameWidth)
        return { scale, name: null, time: null, width: base };
    return null;
}

const SCALES = [
    {
        id: "major-pentatonic",
        name: "Major pentatonic",
        description: "Bright, no wrong notes",
        steps: [0, 2, 4, 7, 9],
    },
    {
        id: "major",
        name: "Major",
        description: "Happy and familiar",
        steps: [0, 2, 4, 5, 7, 9, 11],
    },
    {
        id: "dorian",
        name: "Dorian",
        description: "Cool and a little jazzy",
        steps: [0, 2, 3, 5, 7, 9, 10],
    },
    {
        id: "lydian",
        name: "Lydian",
        description: "Dreamy and floating",
        steps: [0, 2, 4, 6, 7, 9, 11],
    },
    {
        id: "mixolydian",
        name: "Mixolydian",
        description: "Bluesy and relaxed",
        steps: [0, 2, 4, 5, 7, 9, 10],
    },
    {
        id: "japanese",
        name: "Hirajoshi",
        description: "Calm and Japanese-inspired",
        steps: [0, 2, 3, 7, 8],
    },
];
const DEFAULT_SCALE_ID = "major-pentatonic";
const MIN_OCTAVE = 1;
const MAX_OCTAVE = 8;
const DEFAULT_RANGE = { lowOctave: 4, highOctave: 7 };
function normalizeRange(lowOctave, highOctave, fallback = DEFAULT_RANGE) {
    const clampOctave = (value, alt) => typeof value === "number" && Number.isFinite(value)
        ? Math.min(MAX_OCTAVE, Math.max(MIN_OCTAVE, Math.round(value)))
        : alt;
    let low = clampOctave(lowOctave, fallback.lowOctave);
    let high = clampOctave(highOctave, fallback.highOctave);
    if (low >= high) {
        if (low >= MAX_OCTAVE)
            low = MAX_OCTAVE - 1;
        high = low + 1;
    }
    return { lowOctave: low, highOctave: high };
}
function bottomMidi(range) {
    return 12 * (range.lowOctave + 1);
}
function octaveSpan(range) {
    return range.highOctave - range.lowOctave;
}
function getScale(id) {
    return (SCALES.find((scale) => scale.id === id) ??
        SCALES.find((scale) => scale.id === DEFAULT_SCALE_ID));
}
function scaleRows(scale, range) {
    return scale.steps.length * octaveSpan(range) + 1;
}
function rowToMidi(scale, range, row) {
    const rows = scaleRows(scale, range);
    const clamped = Math.max(0, Math.min(rows - 1, Math.round(row)));
    const octave = Math.floor(clamped / scale.steps.length);
    const step = scale.steps[clamped % scale.steps.length];
    return bottomMidi(range) + octave * 12 + step;
}
function midiToHz(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
}
function rowToHz(scale, range, row) {
    return midiToHz(rowToMidi(scale, range, row));
}
function yToRow(scale, range, y, top, height) {
    if (height <= 0)
        return 0;
    const rows = scaleRows(scale, range);
    const fromBottom = 1 - (y - top) / height;
    return Math.max(0, Math.min(rows - 1, Math.floor(fromBottom * rows)));
}

const ARP_PATTERNS = ["arp-up", "arp-down"];
function isArp(rhythm) {
    return typeof rhythm === "string";
}
const BACKING_STYLES = [
    { id: "pop", label: "Pop" },
    { id: "classic", label: "Classic" },
    { id: "simple", label: "Simple" },
    { id: "drone", label: "Drone" },
];
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
const ARP_SHAPES = {
    "arp-up": [0, 1, 2, 3, 4, 2, 1, 0],
    "arp-down": [4, 3, 2, 1, 0, 2, 3, 4],
};
function arpIndex(pattern, step, toneCount) {
    const shape = ARP_SHAPES[pattern];
    return shape[step % shape.length] % toneCount;
}
const ROMAN = {
    i: 0,
    ii: 1,
    iii: 2,
    iv: 3,
    v: 4,
    vi: 5,
    vii: 6,
};
function chord(symbol) {
    const [numeral, suffix] = symbol.split("/");
    const degree = ROMAN[numeral.toLowerCase()];
    return { degree, inversion: suffix === "6" ? 1 : 0 };
}
function progression(symbols) {
    return {
        name: symbols,
        chords: symbols.split(" ").map(chord),
    };
}
const MAJOR_STYLES = {
    pop: progression("I vi IV V"),
    classic: progression("I iii IV V"),
    simple: progression("I V"),
    drone: progression("I"),
};
/**
 * Each backing style is the scale's own progression of that kind, so chord
 * qualities follow the mode. A style a scale has no progression for is left
 * out; every scale has a drone on its tonic.
 */
const STYLE_PROGRESSIONS = {
    major: MAJOR_STYLES,
    "major-pentatonic": MAJOR_STYLES,
    dorian: {
        pop: progression("i III IV"),
        classic: progression("i III/6 IV/6"),
        simple: progression("i IV"),
        drone: progression("i"),
    },
    mixolydian: {
        classic: progression("I vii"),
        simple: progression("I v"),
        drone: progression("I"),
    },
    lydian: {
        pop: progression("I II V"),
        simple: progression("I II"),
        drone: progression("I"),
    },
    japanese: { drone: progression("I") },
};
function harmonyScale(scale) {
    return scale.id === "major-pentatonic" ? getScale("major") : scale;
}
function progressionFor(scaleId, style) {
    return STYLE_PROGRESSIONS[scaleId][style] ?? null;
}
/** The styles a scale offers, in tab order. */
function stylesFor(scaleId) {
    return BACKING_STYLES.map((s) => s.id).filter((id) => progressionFor(scaleId, id) !== null);
}
function triadSemitones(scale, degree) {
    const steps = scale.steps;
    if (steps.length !== 7) {
        const third = steps.includes(4) ? 4 : 3;
        return [0, third, 7];
    }
    const root = steps[degree % 7];
    const at = (offset) => {
        const index = (degree + offset) % 7;
        const wrapped = Math.floor((degree + offset) / 7) * 12;
        return steps[index] + wrapped - root;
    };
    return [0, at(2), at(4)];
}
function nearestOctave(pitchClass, reference) {
    const below = reference - ((((reference - pitchClass) % 12) + 12) % 12);
    const above = below + 12;
    return reference - below <= above - reference ? below : above;
}
function permutations(items) {
    if (items.length <= 1)
        return [items];
    const out = [];
    items.forEach((item, index) => {
        const rest = [...items.slice(0, index), ...items.slice(index + 1)];
        for (const tail of permutations(rest))
            out.push([item, ...tail]);
    });
    return out;
}
/**
 * Four-part-harmony style voice leading: each previous voice moves to the
 * nearest octave of one chord tone so that every tone is covered and the
 * total movement is as small as possible (C E G -> B E G rather than E G B).
 */
function leadVoices(previous, pitchClasses, home = previous) {
    let best = [];
    let bestCost = Infinity;
    for (const assignment of permutations(pitchClasses)) {
        const next = assignment.map((pitchClass, index) => nearestOctave(pitchClass, previous[index]));
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
        if (span < 12)
            total += CLOSED_PENALTY;
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
function chordTones(scale, spec, previous, lead = true) {
    const root = scale.steps.length === 7 ? scale.steps[spec.degree % 7] : 0;
    const [, third, fifth] = triadSemitones(scale, spec.degree);
    const bassInterval = spec.inversion === 1 ? third : 0;
    const octaveShift = root >= DESCEND_FROM_SEMITONES ? -12 : 0;
    const bassClass = (root + bassInterval) % 12;
    const thirdClass = (root + third) % 12;
    const bass = previous && spec.inversion === 1
        ? nearestOctave(bassClass, previous.bass)
        : BASS_OCTAVE_MIDI + bassClass + octaveShift;
    // Arpeggios want close spelling in 1 3 5 order; led chords open with
    // the third on top an octave up (C3 G3 E4) and stay open from there.
    const order = !lead
        ? spec.inversion === 1
            ? [third, fifth, 12]
            : [0, third, fifth]
        : [0, fifth, third + 12];
    const upper = previous && lead
        ? leadVoices(previous.upper, [root % 12, thirdClass, (root + fifth) % 12], previous.home)
        : order.map((interval) => CHORD_OCTAVE_MIDI + root + interval + octaveShift);
    return { bass, upper, home: previous ? previous.home : upper, thirdClass };
}
function voiceTones(tones, voicing) {
    if (voicing === "bass")
        return [tones.bass];
    if (voicing === "omit3") {
        return [
            tones.bass,
            ...tones.upper.filter((midi) => midi % 12 !== tones.thirdClass),
        ];
    }
    return [tones.bass, ...tones.upper];
}
function progressionCount(frameWidth) {
    return Math.max(1, Math.round(frameWidth / PROGRESSION_SPAN_PX));
}
const PREVIEW_CHORD_SEC = 0.8;
/** One pass of a backing on its own, for previewing a style. */
function backingPreview(scale, options) {
    const prog = progressionFor(scale.id, options.style);
    if (!prog)
        return [];
    return backingHits(scale, PROGRESSION_SPAN_PX, prog.chords.length * PREVIEW_CHORD_SEC, options);
}
function backingHits(scale, frameWidth, durationSec, options) {
    const prog = progressionFor(scale.id, options.style);
    if (!prog)
        return [];
    const harmony = harmonyScale(scale);
    const count = progressionCount(frameWidth);
    const progressionSec = durationSec / count;
    const chordSec = progressionSec / prog.chords.length;
    const hits = [];
    const arp = isArp(options.rhythm);
    // Sustained chords are voice-led continuously across repeated passes so
    // the return to the first chord is as smooth as every other change.
    // Arpeggios keep plain root-position spelling.
    let previous;
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

const PANEL_HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Google+Sans+Flex:wght@400;500&display=swap" />
<style id="theme">:root{/*__DRAWDY_STYLING__*/}</style>
<style>
/* Figma tokens mapped onto the host's styling variables. Tokens the host
   does not pass through are restated here per theme. */
:root {
    --fg: var(--drawdy-foreground, rgb(0 0 0 / 0.95));
    --fg-2: var(--drawdy-muted-foreground, rgb(0 0 0 / 0.7));
    --fg-3: rgb(0 0 0 / 0.5);
    --fg-disabled: rgb(0 0 0 / 0.3);
    --surface: var(--drawdy-background, #fff);
    --border: var(--drawdy-border, rgb(0 0 0 / 0.1));
    --divider: rgb(0 0 0 / 0.06);
    --hover: rgb(0 0 0 / 0.04);
    --pressed: rgb(0 0 0 / 0.06);
    --track: rgb(0 0 0 / 0.04);
    --layer: rgb(0 0 0 / 0.11);
    --row-selected: rgb(0 0 0 / 0.04);
    --mark: rgb(0 0 0 / 0.1);
    --accent: var(--drawdy-primary, #c5f601);
    --accent-fg: var(--drawdy-accent, #7fae00);
    --accent-subtle: rgb(179 224 0 / 0.3);
    --on-accent: var(--drawdy-primary-foreground, #0a0a0a);
    --ring: var(--drawdy-ring, #b3e000);
    --key-white: var(--surface);
    --key-black: #71717a;
    --grip: #ffffff;
    --tooltip-bg: #52525b;
    --tooltip-fg: #fff;
    --pop-shadow: 0 4px 20px rgb(0 0 0 / 0.1);
    --grip-shadow: 0 1px 3px rgb(0 0 0 / 0.2);
    --ease: cubic-bezier(0.2, 0.8, 0.2, 1);
}
:root[data-theme="dark"] {
    --fg-3: rgb(255 255 255 / 0.5);
    --fg-disabled: rgb(255 255 255 / 0.3);
    --divider: rgb(255 255 255 / 0.06);
    --hover: rgb(255 255 255 / 0.08);
    --pressed: rgb(255 255 255 / 0.02);
    --track: rgb(255 255 255 / 0.04);
    --layer: rgb(255 255 255 / 0.1);
    --row-selected: rgb(255 255 255 / 0.04);
    --mark: rgb(255 255 255 / 0.1);
    --accent-subtle: rgb(179 224 0 / 0.1);
    --tooltip-bg: #3f3f46;
    --pop-shadow: 0 4px 20px rgb(0 0 0 / 0.4);
}
* { box-sizing: border-box; }
[hidden] { display: none !important; }
html, body { margin: 0; height: 100%; }
body {
    font-family: "Google Sans Flex", "Google Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    font-size: 12px;
    line-height: 16px;
    color: var(--fg);
    background: var(--surface);
    overflow: hidden;
    -webkit-font-smoothing: antialiased;
}
button { font: inherit; color: inherit; }
:focus { outline: none; }
:focus-visible { outline: 2px solid var(--ring); outline-offset: 1px; }
main {
    height: 100%;
    overflow-y: auto;
    /* Never scroll sideways; edge-aligned controls may bleed a pixel or two. */
    overflow-x: hidden;
    padding: 16px;
    /* The scrollbar's room is always reserved and taken out of the right
       padding, so content keeps its width whether or not the panel scrolls. */
    padding-right: var(--scroll-pad, 16px);
    /* Less below the last section, so the default view (one frame, Feel
       closed) fits without a scrollbar for a few pixels of overflow. */
    padding-bottom: 8px;
    scrollbar-gutter: stable;
    scrollbar-width: thin;
    scrollbar-color: var(--mark) transparent;
}
/* Tight enough that the Feel header shows at the bottom of the panel with one frame listed. */
.view { display: flex; flex-direction: column; gap: 10px; }
.label { color: var(--fg-2); }
.field { display: flex; flex-direction: column; gap: 6px; position: relative; }
.field-head { display: flex; align-items: center; justify-content: space-between; }
.field-value { color: var(--fg-3); font-variant-numeric: tabular-nums; }
.divider { border: 0; height: 1px; margin: 0; background: var(--divider); }
.chevron {
    width: 16px;
    height: 16px;
    flex: none;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
    transition: transform 120ms var(--ease);
}

/* Scale select */
.select-trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    height: 36px;
    padding: 0 10px 0 12px;
    color: var(--fg-2);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    cursor: pointer;
    transition: background 120ms var(--ease);
}
.select-trigger:hover { background: linear-gradient(var(--hover), var(--hover)), var(--surface); }
.select-trigger:active { background: linear-gradient(var(--pressed), var(--pressed)), var(--surface); }
.select-trigger[aria-expanded="true"] .chevron { transform: rotate(180deg); }
.select-list {
    position: absolute;
    z-index: 5;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    padding: 4px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: var(--pop-shadow);
    animation: drop 120ms var(--ease);
}
@keyframes drop {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: none; }
}
.option {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 6px;
    cursor: pointer;
    transition: background 120ms var(--ease);
}
.option.active { background: var(--hover); }
.option:active { background: var(--pressed); }
.option-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.option-desc { color: var(--fg-3); font-size: 11px; line-height: 14px; }
.check {
    width: 16px;
    height: 16px;
    fill: none;
    stroke: var(--fg);
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
    visibility: hidden;
}
.option[aria-selected="true"] .check { visibility: visible; }

/* Range piano */
.piano {
    position: relative;
    height: 40px;
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    background: var(--key-white);
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    cursor: pointer;
}
.keys { position: absolute; inset: 0; }
.key { position: absolute; top: 0; }
.key.white {
    bottom: 0;
    background: var(--key-white);
    box-shadow: inset -1px 0 0 var(--divider);
}
.key.white:last-child { box-shadow: none; }
.key.black {
    z-index: 1;
    height: 60%;
    width: calc(100% / 50 * 0.64);
    transform: translateX(-50%);
    background: var(--key-black);
}
/* In range: a flat accent bar across the key's square bottom edge. */
.key.black::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 2px;
    background: var(--accent);
    opacity: 0;
    transition: opacity 120ms var(--ease);
}
.key.black.in-range::after { opacity: 1; }
.band {
    position: absolute;
    z-index: 2;
    top: 0;
    bottom: 0;
    background: var(--accent-subtle);
    pointer-events: none;
}
.handle {
    position: absolute;
    z-index: 3;
    top: 0;
    bottom: 0;
    width: 16px;
    margin-left: -8px;
    cursor: ew-resize;
    border-radius: 6px;
}
.handle::before {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: 7px;
    width: 2px;
    background: var(--accent);
}
.grip {
    position: absolute;
    top: 50%;
    left: 2px;
    width: 12px;
    height: 20px;
    margin-top: -8px;
    border-radius: 6px;
    background: var(--grip);
    box-shadow: 0 0 0 1px var(--border), var(--grip-shadow);
    transition: transform 120ms var(--ease);
}
.grip::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    transition: background 120ms var(--ease);
}
.handle:hover .grip, .handle.dragging .grip { transform: scale(1.15); }
.handle:hover .grip::after { background: var(--hover); }
.handle.dragging .grip::after { background: var(--pressed); }
.handle:focus-visible { outline: none; }
.handle:focus-visible .grip { outline: 2px solid var(--ring); outline-offset: 1px; }
.piano-labels { position: relative; height: 16px; margin-top: 4px; color: var(--fg-3); }
.key-label {
    position: absolute;
    top: 0;
    transform: translateX(-50%);
    transition: color 120ms var(--ease);
}
.key-label.first { transform: none; }
.key-label.last { left: auto !important; right: 0; transform: none; }
.key-label.end { color: var(--accent-fg); }

/* Backing segmented control */
.segmented {
    display: flex;
    height: 28px;
    padding: 2px;
    gap: 2px;
    background: var(--track);
    border-radius: 8px;
}
.segment {
    flex: 1;
    min-width: 0;
    padding: 0 4px;
    color: var(--fg-3);
    background: transparent;
    border: 0;
    border-radius: 6px;
    cursor: pointer;
    transition: background 120ms var(--ease), color 120ms var(--ease);
}
.segment:hover { color: var(--fg); background: var(--hover); }
.segment:active { background: var(--pressed); }
.segment[aria-checked="true"] { color: var(--fg); background: var(--layer); font-weight: 500; }
.segment[aria-checked="true"]:hover { background: linear-gradient(var(--hover), var(--hover)), var(--layer); }
.segment:disabled { color: var(--fg-disabled); cursor: default; background: transparent; }
.segment[aria-checked="true"]:disabled { background: var(--layer); }

/* Collapsible sections */
.section-head {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-height: 24px;
    padding: 0;
    color: var(--fg-2);
    background: transparent;
    border: 0;
    border-radius: 6px;
    text-align: left;
}
button.section-head { cursor: pointer; }
.section-title { flex: 1; }
.feel-summary { color: var(--fg-3); font-variant-numeric: tabular-nums; }
.feel.open .feel-summary { display: none; }
.feel:not(.open) .section-head .chevron { transform: rotate(-90deg); }
.feel .section-head .chevron { transition-duration: 180ms; }
.feel-body {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows 180ms var(--ease);
}
.feel.open .feel-body { grid-template-rows: 1fr; }
.feel-inner { min-height: 0; overflow: hidden; }
.sliders { display: flex; flex-direction: column; gap: 8px; padding-top: 8px; }

/* Feel sliders: label inside on the left, value on the right */
.slider {
    position: relative;
    height: 28px;
    border-radius: 8px;
    background: var(--track);
    cursor: ew-resize;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
}
.slider::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    transition: background 120ms var(--ease);
}
.slider:hover::after { background: var(--hover); }
.slider:focus-visible { outline-offset: 1px; }
.s-fill {
    position: absolute;
    top: 2px;
    bottom: 2px;
    left: 2px;
    border-radius: 6px;
    background: var(--layer);
}
.slider.active .s-fill { background: linear-gradient(var(--pressed), var(--pressed)), var(--layer); }
.s-marks { position: absolute; inset: 0; pointer-events: none; }
.s-tick, .s-dot { position: absolute; top: 50%; background: var(--mark); }
.s-tick { width: 1px; height: 8px; margin: -4px 0 0 -0.5px; }
.s-dot { width: 2px; height: 2px; margin: -1px 0 0 -1px; border-radius: 1px; }
.s-label {
    position: absolute;
    top: 6px;
    left: 10px;
    font-weight: 500;
    pointer-events: none;
}
.s-value {
    position: absolute;
    top: 6px;
    right: 10px;
    text-align: right;
    color: var(--fg-3);
    font-variant-numeric: tabular-nums;
    pointer-events: none;
    white-space: nowrap;
    transition: color 120ms ease;
}
.slider.active .s-value { color: var(--fg); }
.s-indicator {
    position: absolute;
    top: 8px;
    left: 0;
    width: 2px;
    height: 12px;
    border-radius: 1px;
    background: var(--fg-3);
    pointer-events: none;
    transition: background-color 120ms ease, width 120ms ease, margin 120ms ease;
}
.slider.active .s-indicator { background-color: var(--fg); width: 3px; margin-left: -0.5px; }
.slider.disabled { cursor: default; }
.slider.disabled .s-label, .slider.disabled .s-value { color: var(--fg-disabled); }
.slider.disabled .s-indicator { background: var(--fg-disabled); }
.measure { position: absolute; visibility: hidden; white-space: nowrap; font-variant-numeric: tabular-nums; }

/* Frames */
.frames { display: flex; flex-direction: column; gap: 8px; }
.text-action {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 24px;
    margin-right: -6px;
    padding: 0 6px;
    color: var(--fg-2);
    background: transparent;
    border: 0;
    border-radius: 6px;
    cursor: pointer;
    transition: background 120ms var(--ease), color 120ms var(--ease);
}
.text-action svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; }
.text-action:hover { color: var(--fg); background: var(--hover); }
.text-action:active { background: var(--pressed); }
.text-action:disabled { color: var(--fg-disabled); background: transparent; cursor: default; }
.frame-list { list-style: none; margin: 0 -4px; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.frame-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px;
    border-radius: 10px;
    cursor: pointer;
    transition: background 120ms var(--ease);
}
.frame-row.selected { background: var(--row-selected); }
.frame-row:hover { background: var(--hover); }
.frame-row.selected:hover { background: linear-gradient(var(--hover), var(--hover)), var(--row-selected); }
.frame-row:active { background: var(--pressed); }
.thumb {
    flex: none;
    display: grid;
    place-items: center;
    width: 54px;
    height: 36px;
    padding: 3px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
}
.thumb svg { width: 100%; height: 100%; display: block; }
.thumb path {
    fill: none;
    stroke: var(--fg);
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
}
.frame-text { flex: 1; min-width: 0; }
.frame-name { display: flex; align-items: center; gap: 6px; }
.name-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.name-input {
    flex: 1;
    min-width: 0;
    height: 20px;
    margin: -2px 0 -2px -4px;
    padding: 0 4px;
    font: inherit;
    color: var(--fg);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 4px;
    outline: none;
}
.name-input:focus-visible, .name-input:focus { box-shadow: 0 0 0 2px var(--ring); }
.frame-dur { color: var(--fg-3); font-variant-numeric: tabular-nums; }
.eq { display: none; align-items: flex-end; gap: 1.5px; height: 10px; }
.frame-row.playing .eq { display: inline-flex; }
.eq i { width: 2px; height: 100%; border-radius: 1px; background: var(--fg-2); transform-origin: bottom; animation: eq 700ms ease-in-out infinite; }
.eq i:nth-child(2) { animation-delay: -240ms; }
.eq i:nth-child(3) { animation-delay: -470ms; }
@keyframes eq {
    0%, 100% { transform: scaleY(0.3); }
    50% { transform: scaleY(1); }
}
.icon-btn {
    flex: none;
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    padding: 0;
    color: var(--fg-2);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    cursor: pointer;
    transition: background 120ms var(--ease), color 120ms var(--ease);
}
.icon-btn svg { width: 12px; height: 12px; fill: currentColor; }
.icon-btn:hover { color: var(--fg); background: linear-gradient(var(--hover), var(--hover)), var(--surface); }
.icon-btn:active { background: linear-gradient(var(--pressed), var(--pressed)), var(--surface); }
.icon-btn[aria-pressed="true"] { color: var(--fg); background: var(--layer); }
.icon-btn[aria-pressed="true"]:hover { background: linear-gradient(var(--hover), var(--hover)), var(--layer); }
.icon-btn:disabled { color: var(--fg-disabled); cursor: default; background: var(--surface); }
.icon-btn.attention { animation: attention 1.4s ease-in-out infinite; }
.icon-btn .stroke-icon { fill: none; stroke: currentColor; stroke-width: 1.2; stroke-linecap: round; stroke-linejoin: round; }
/* Loop off keeps a muted icon, hover included; on uses the selected layer. */
.icon-btn.loop { margin-right: -4px; }
.icon-btn.loop:not([aria-pressed="true"]),
.icon-btn.loop:not([aria-pressed="true"]):hover { color: var(--fg-3); }
/* The frame whose title was clicked on the board. */
.icon-btn.spotlight { outline: 2px solid #c5f601; outline-offset: 1px; }
@keyframes attention {
    0%, 100% { box-shadow: 0 0 0 0 var(--accent-subtle); }
    50% { box-shadow: 0 0 0 5px var(--accent-subtle); }
}

/* First use */
.first-use {
    min-height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 24px 16px 40px;
    text-align: center;
    animation: fade 180ms var(--ease);
}
.logo-tile { width: 48px; height: 48px; border-radius: 12px; margin-bottom: 8px; }
.first-use h1 { margin: 0; font-size: 14px; line-height: 20px; font-weight: 500; }
.first-use p { margin: 0 0 8px; color: var(--fg-2); }
.primary {
    height: 32px;
    padding: 0 14px;
    font-weight: 500;
    color: var(--on-accent);
    background: var(--accent);
    border: 0;
    border-radius: 8px;
    cursor: pointer;
    transition: background 120ms var(--ease);
}
.primary:hover { background: linear-gradient(rgb(0 0 0 / 0.06), rgb(0 0 0 / 0.06)), var(--accent); }
.primary:active { background: linear-gradient(rgb(0 0 0 / 0.1), rgb(0 0 0 / 0.1)), var(--accent); }
.primary:disabled { opacity: 0.5; cursor: default; }
@keyframes fade { from { opacity: 0; } to { opacity: 1; } }

.tooltip {
    position: fixed;
    z-index: 10;
    max-width: 220px;
    padding: 4px 8px;
    font-size: 11px;
    line-height: 14px;
    color: var(--tooltip-fg);
    background: var(--tooltip-bg);
    border-radius: 6px;
    pointer-events: none;
    animation: fade 120ms var(--ease);
}
@media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation: none !important; transition: none !important; }
}
</style>
</head>
<body>
<main>
<div class="view" id="full" hidden>
    <section class="frames">
        <div class="section-head">
            <span class="section-title">Frames</span>
            <button type="button" class="text-action" id="new-frame">
                <svg viewBox="0 0 14 14" aria-hidden="true"><path d="M7 2.5v9M2.5 7h9"/></svg>New frame
            </button>
        </div>
        <ul class="frame-list" id="frame-list"></ul>
    </section>

    <hr class="divider" />

    <div class="field" id="scale-field">
        <span class="label" id="scale-label">Scale</span>
        <button type="button" class="select-trigger" id="scale-trigger" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="scale-label scale-value">
            <span id="scale-value"></span>
            <svg class="chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4"/></svg>
        </button>
        <div class="select-list" id="scale-list" role="listbox" aria-labelledby="scale-label" tabindex="-1" hidden></div>
    </div>

    <div class="field">
        <div class="field-head">
            <span class="label" id="range-label">Range</span>
            <span class="field-value" id="range-value"></span>
        </div>
        <div>
            <div class="piano" id="piano">
                <div class="keys" id="keys"></div>
                <div class="band" id="band"></div>
                <div class="handle" id="handle-low" role="slider" tabindex="0" aria-label="Lowest note"><span class="grip"></span></div>
                <div class="handle" id="handle-high" role="slider" tabindex="0" aria-label="Highest note"><span class="grip"></span></div>
            </div>
            <div class="piano-labels" id="piano-labels" aria-hidden="true"></div>
        </div>
    </div>

    <div class="field">
        <span class="label" id="backing-label">Backing</span>
        <div class="segmented" id="backing" role="radiogroup" aria-labelledby="backing-label"></div>
    </div>

    <div class="field" id="voicing-field">
        <span class="label" id="voicing-label">Voicing</span>
        <div class="segmented" id="voicing" role="radiogroup" aria-labelledby="voicing-label"></div>
    </div>

    <div class="field" id="rhythm-field">
        <span class="label" id="rhythm-label">Rhythm</span>
        <div class="segmented" id="rhythm" role="radiogroup" aria-labelledby="rhythm-label"></div>
    </div>

    <hr class="divider" />

    <section class="feel" id="feel">
        <button type="button" class="section-head" id="feel-toggle" aria-expanded="false" aria-controls="feel-body">
            <span class="section-title">Feel</span>
            <span class="feel-summary" id="feel-summary"></span>
            <svg class="chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4"/></svg>
        </button>
        <div class="feel-body" id="feel-body">
            <div class="feel-inner"><div class="sliders" id="sliders"></div></div>
        </div>
    </section>


</div>

<div class="first-use" id="first-use" hidden>
    <img class="logo-tile" src="__SERENE_ICON__" alt="" />
    <h1>Turn drawings into music</h1>
    <p>Draw inside a Serene frame and press play.</p>
    <button type="button" class="primary" id="create-frame">Create Serene frame</button>
</div>
</main>
<div class="tooltip" id="tooltip" role="tooltip" hidden></div>
<script>
(function () {
    var api = acquireDrawdyApi();
    var root = document.documentElement;
    var themeStyle = document.getElementById("theme");

    var BASE_PX_PER_SECOND = 220;
    var MIN_OCTAVE = 1;
    var MAX_OCTAVE = 8;
    var WHITE_KEYS = 50;
    var THUMB_WIDTH = 160;
    var PLAY_ICON = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3.5 2.2v7.6L9.8 6z"/></svg>';
    var LOOP_ICON = '<svg viewBox="0 0 12 12" aria-hidden="true"><path class="stroke-icon" d="M2.5 5.5V5a2 2 0 0 1 2-2h5M8 1.5 9.5 3 8 4.5M9.5 6.5V7a2 2 0 0 1-2 2h-5M4 10.5 2.5 9 4 7.5"/></svg>';
    var PAUSE_ICON = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 2.5h2v7H3zM7 2.5h2v7H7z"/></svg>';

    var settings = {
        speed: 1,
        attack: 0.02,
        notes: 0.8,
        backingLevel: 0.7,
        reverb: 0.38,
        scale: "major-pentatonic",
        lowOctave: 4,
        highOctave: 7,
        loop: false,
        backing: { enabled: false, style: "pop", voicing: "full", rhythm: 1 },
    };
    var attentionId = null;

    function applyTheme(css) {
        root.setAttribute("data-theme", css.indexOf("color-scheme: dark") >= 0 ? "dark" : "light");
    }
    applyTheme(themeStyle.textContent);

    var LOOKAHEAD = 0.25;
    var PROGRESS_MS = 33;
    var DECAY = 0.22;
    var MIN_ATTACK = 0.002;
    var LATE_FADE_IN = 0.02;
    var SUSTAIN_RATIO = 0.45;
    var RELEASE = 0.55;
    var PERCUSSIVE_TAU = 0.32;
    var BACKING_GAIN = 0.55;
    var BACKING_SUSTAIN = 0.7;
    var BACKING_PAD_ATTACK = 0.09;
    var BACKING_PLUCK_ATTACK = 0.006;
    var BACKING_PAD_MIN_SEC = 1.2;
    var BACKING_CUTOFF = 1100;
    var ARP_GAIN = 0.7;
    var ARP_SUSTAIN = 0.4;
    var ARP_ATTACK = 0.003;
    var GLIDE_PORTION = 0.35;
    var MAX_GLIDE = 0.3;
    var PEAK_GAIN = 0.2;
    var LIMIT_THRESHOLD = -3;
    var LIMIT_RATIO = 20;
    var LIMIT_ATTACK = 0.002;
    var LIMIT_RELEASE = 0.18;
    var LIMIT_TRIM = 0.821;

    var score = null;
    var audio = null;
    var playing = false;
    var startTime = 0;
    var cursor = 0;
    var scheduledUntil = 0;
    var scheduleOrigin = 0;
    var loop = false;
    var voices = [];
    var pumpTimer = null;
    var progressTimer = null;
    var elapsed = 0;

    function audioUnlocked() {
        return Boolean(audio) && audio.ctx.state === "running";
    }

    function makeImpulse(ctx, seconds, decay) {
        var rate = ctx.sampleRate;
        var length = Math.max(1, Math.floor(rate * seconds));
        var buffer = ctx.createBuffer(2, length, rate);
        for (var channel = 0; channel < 2; channel++) {
            var data = buffer.getChannelData(channel);
            for (var i = 0; i < length; i++) {
                var fade = Math.pow(1 - i / length, decay);
                data[i] = (Math.random() * 2 - 1) * fade;
            }
        }
        return buffer;
    }

    function ensureAudio() {
        if (audio) return audio;
        var Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return null;
        var ctx = new Ctor();
        var master = ctx.createGain();
        master.gain.value = 1;
        master.connect(ctx.destination);
        var trim = ctx.createGain();
        trim.gain.value = LIMIT_TRIM;
        trim.connect(master);
        var limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = LIMIT_THRESHOLD;
        limiter.knee.value = 0;
        limiter.ratio.value = LIMIT_RATIO;
        limiter.attack.value = LIMIT_ATTACK;
        limiter.release.value = LIMIT_RELEASE;
        limiter.connect(trim);
        var mix = ctx.createGain();
        mix.connect(limiter);
        var dry = ctx.createGain();
        dry.gain.value = 0.85;
        dry.connect(mix);
        var send = ctx.createDelay(0.5);
        send.delayTime.value = 0.024;
        var tone = ctx.createBiquadFilter();
        tone.type = "lowpass";
        tone.frequency.value = 3200;
        var convolver = ctx.createConvolver();
        convolver.buffer = makeImpulse(ctx, 2.8, 2.6);
        var wet = ctx.createGain();
        wet.gain.value = settings.reverb;
        send.connect(tone);
        tone.connect(convolver);
        convolver.connect(wet);
        wet.connect(mix);
        audio = {
            ctx: ctx,
            master: master,
            trim: trim,
            limiter: limiter,
            mix: mix,
            dry: dry,
            send: send,
            wet: wet
        };
        return audio;
    }

    function resumeAudio() {
        var a = ensureAudio();
        if (!a) return Promise.resolve(false);
        if (a.ctx.state === "running") return Promise.resolve(true);
        return a.ctx.resume().then(
            function () { return a.ctx.state === "running"; },
            function () { return false; }
        );
    }

    function tilt(hz) {
        var v = Math.pow(440 / Math.max(110, hz), 0.35);
        return Math.max(0.5, Math.min(1.25, v));
    }

    function meanHz(pitches) {
        var total = 0;
        for (var i = 0; i < pitches.length; i++) total += pitches[i].hz;
        return total / pitches.length;
    }

    function schedulePitches(osc, at, pitches, resumeAt, allowGlide) {
        var prevTime = at;
        var prevHz = pitches[0].hz;
        if (resumeAt !== undefined) {
            prevTime = resumeAt;
            prevHz = osc.frequency.value;
        }
        osc.frequency.setValueAtTime(prevHz, prevTime);
        for (var i = 1; i < pitches.length; i++) {
            var when = at + pitches[i].t;
            if (when <= prevTime) continue;
            var span = when - prevTime;
            var slide = allowGlide ? Math.min(span * GLIDE_PORTION, MAX_GLIDE) : 0;
            if (slide > 0.004) {
                if (slide < span) {
                    osc.frequency.setValueAtTime(prevHz, when - slide);
                }
                osc.frequency.exponentialRampToValueAtTime(
                    pitches[i].hz,
                    when
                );
            } else {
                osc.frequency.setValueAtTime(pitches[i].hz, when);
            }
            prevTime = when;
            prevHz = pitches[i].hz;
        }
    }

    function voiceKey(note, px) {
        var parts = [note.b ? "b" : "i", Math.round(note.t * px), Math.round((note.t + note.d) * px)];
        for (var i = 0; i < note.pitches.length; i++) {
            parts.push(Math.round(note.pitches[i].hz) + "@" + Math.round(note.pitches[i].t * px));
        }
        return parts.join("|");
    }

    function holdFor(note) {
        return Math.max(0.09, note.d);
    }

    function releaseAt(gain, end) {
        gain.gain.setTargetAtTime(0.0001, end, RELEASE / 3);
    }

    // Freeze a param at its current value and drop everything scheduled after
    // now. Plain cancelScheduledValues() would also delete a ramp that is in
    // progress, snapping the param back to the value before the ramp (0 during
    // an attack, the peak during a decay), which is a loud click.
    function holdParam(param, now) {
        if (typeof param.cancelAndHoldAtTime === "function") {
            param.cancelAndHoldAtTime(now);
            return param.value;
        }
        var level = param.value;
        param.cancelScheduledValues(now);
        param.setValueAtTime(level, now);
        return level;
    }

    function scheduleEnvelope(gain, at, peak, sustain, attack, end) {
        var param = gain.gain;
        var attackEnd = at + attack;
        var decayEnd = attackEnd + DECAY;
        var releaseStart = Math.max(end, attackEnd);
        param.setValueAtTime(0, at);
        param.linearRampToValueAtTime(peak, attackEnd);
        if (releaseStart >= decayEnd) {
            param.exponentialRampToValueAtTime(sustain, decayEnd);
            if (releaseStart > decayEnd) param.setValueAtTime(sustain, releaseStart);
        } else {
            var frac = (releaseStart - attackEnd) / DECAY;
            var level = peak * Math.pow(sustain / peak, frac);
            param.exponentialRampToValueAtTime(Math.max(0.0001, level), releaseStart);
        }
        var percussive = end - at < attack + DECAY;
        var tau = percussive ? PERCUSSIVE_TAU : RELEASE / 3;
        param.setTargetAtTime(0.0001, releaseStart, tau);
        return releaseStart + tau * 6;
    }

    function playVoice(note, origin) {
        var ctx = audio.ctx;
        var now = ctx.currentTime;
        var at = (origin === undefined ? startTime : origin) + note.t;
        var peak = Math.max(
            0.0005,
            note.v * PEAK_GAIN * tilt(meanHz(note.pitches))
        );
        if (note.b) peak *= (note.a ? ARP_GAIN : BACKING_GAIN) * settings.backingLevel;
        else peak *= settings.notes;
        var sustainRatio = note.a ? ARP_SUSTAIN : note.b ? BACKING_SUSTAIN : SUSTAIN_RATIO;
        var sustain = Math.max(0.0004, peak * sustainRatio);
        var end = Math.max(now, at + holdFor(note));
        var attack = note.a
            ? ARP_ATTACK
            : note.b
              ? (note.d >= BACKING_PAD_MIN_SEC ? BACKING_PAD_ATTACK : BACKING_PLUCK_ATTACK)
              : Math.max(MIN_ATTACK, settings.attack);
        var osc = ctx.createOscillator();
        osc.type = note.b && !note.a ? "triangle" : "sine";
        schedulePitches(osc, at, note.pitches, undefined, note.g);
        var gain = ctx.createGain();
        var source = osc;
        if (note.b && !note.a) {
            var cutoff = ctx.createBiquadFilter();
            cutoff.type = "lowpass";
            cutoff.frequency.value = BACKING_CUTOFF;
            cutoff.Q.value = 0.6;
            osc.connect(cutoff);
            source = cutoff;
        }
        var stopAt;
        if (at >= now) {
            stopAt = scheduleEnvelope(gain, at, peak, sustain, attack, end);
        } else {
            // Joining a note that is already under way: ease in instead of
            // stepping straight to the sustain level.
            var joined = now + LATE_FADE_IN;
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(sustain, joined);
            end = Math.max(end, joined);
            releaseAt(gain, end);
            stopAt = end + RELEASE * 3;
        }
        source.connect(gain);
        gain.connect(audio.dry);
        gain.connect(audio.send);
        osc.start(Math.max(at, now));
        osc.stop(stopAt);
        var voice = {
            osc: osc,
            gain: gain,
            sustain: sustain,
            start: at,
            end: end,
            key: voiceKey(note, score.pxPerSecond),
            dead: false,
        };
        voices.push(voice);
        osc.onended = function () {
            var index = voices.indexOf(voice);
            if (index >= 0) voices.splice(index, 1);
        };
    }

    function retimeVoice(voice, note) {
        var ctx = audio.ctx;
        var now = ctx.currentTime;
        var at = startTime + note.t;
        var end = Math.max(now, at + holdFor(note));
        holdParam(voice.osc.frequency, now);
        schedulePitches(voice.osc, at, note.pitches, now, note.g);
        var level = holdParam(voice.gain.gain, now);
        if (level > voice.sustain * 1.02) {
            voice.gain.gain.linearRampToValueAtTime(
                voice.sustain,
                Math.min(end, now + DECAY)
            );
        }
        releaseAt(voice.gain, end);
        voice.osc.stop(end + RELEASE * 3);
        voice.start = at;
        voice.end = end;
        voice.key = voiceKey(note, score.pxPerSecond);
    }

    function fadeVoice(voice, now) {
        voice.dead = true;
        var index = voices.indexOf(voice);
        if (index >= 0) voices.splice(index, 1);
        try {
            var param = voice.gain.gain;
            if (voice.start > now) {
                // Not sounding yet. Cancelling its envelope would leave the
                // gain at the node default of 1, so pin it to silence.
                param.cancelScheduledValues(0);
                param.setValueAtTime(0, now);
                voice.osc.stop(Math.max(now, voice.start) + 0.005);
                return;
            }
            holdParam(param, now);
            param.setTargetAtTime(0.0001, now, 0.03);
            voice.osc.stop(now + 0.25);
        } catch (err) {
            void err;
        }
    }

    function killVoices() {
        if (!audio) return;
        var now = audio.ctx.currentTime;
        var live = voices.slice();
        for (var i = 0; i < live.length; i++) fadeVoice(live[i], now);
    }

    function reconcileVoices() {
        var now = audio.ctx.currentTime;
        var nowT = now - startTime;
        var px = score.pxPerSecond;
        var wanted = {};
        for (var i = 0; i < score.voices.length; i++) {
            var note = score.voices[i];
            if (note.t <= nowT && nowT < note.t + holdFor(note)) {
                wanted[voiceKey(note, px)] = note;
            }
        }
        var live = voices.slice();
        for (var j = 0; j < live.length; j++) {
            var voice = live[j];
            if (voice.dead) continue;
            if (voice.start > now) {
                fadeVoice(voice, now);
                continue;
            }
            if (voice.end <= now) continue;
            var match = wanted[voice.key];
            if (match) {
                retimeVoice(voice, match);
                delete wanted[voice.key];
            } else {
                fadeVoice(voice, now);
            }
        }
        Object.keys(wanted).forEach(function (key) {
            playVoice(wanted[key]);
        });
    }

    function advanceLoop(now) {
        var duration = score.durationSec;
        if (duration <= 0) return;
        while (now - startTime >= duration) startTime += duration;
        if (scheduleOrigin < startTime) {
            scheduleOrigin = startTime;
            cursor = 0;
        }
    }

    function pump() {
        if (!playing || !score) return;
        var now = audio.ctx.currentTime;
        var duration = score.durationSec;
        if (loop) {
            advanceLoop(now);
        } else if (now - startTime >= duration) {
            finish();
            return;
        }
        var horizon = now + LOOKAHEAD;
        scheduledUntil = horizon;
        while (true) {
            while (
                cursor < score.voices.length &&
                scheduleOrigin + score.voices[cursor].t < horizon
            ) {
                playVoice(score.voices[cursor], scheduleOrigin);
                cursor++;
            }
            if (!loop || duration <= 0 || scheduleOrigin + duration > horizon) break;
            scheduleOrigin += duration;
            cursor = 0;
        }
    }

    function tickProgress() {
        if (!playing || !score) return;
        elapsed = currentElapsed();
        api.postMessage({ type: "progress", t: elapsed });
    }

    function rewindScheduling(now) {
        scheduleOrigin = startTime;
        scheduledUntil = now;
        cursor = firstVoiceAtOrAfter(now - startTime);
    }

    function currentElapsed() {
        return Math.max(
            0,
            Math.min(score.durationSec, audio.ctx.currentTime - startTime)
        );
    }

    // An empty frame still plays: the playhead sweeps it in silence.
    function start() {
        if (!score) return;
        resumeAudio().then(function (ok) {
            if (!ok) {
                markAttention(score.frameIds[0]);
                return;
            }
            stopTimers();
            killVoices();
            var from = elapsed > 0 && elapsed < score.durationSec ? elapsed : 0;
            var now = audio.ctx.currentTime;
            startTime = now + 0.12 - from;
            elapsed = from;
            rewindScheduling(now);
            attentionId = null;
            setPlaying(true);
            api.postMessage({ type: "started" });
            pumpTimer = setInterval(pump, 25);
            progressTimer = setInterval(tickProgress, PROGRESS_MS);
            reconcileVoices();
            pump();
        });
    }

    function stopTimers() {
        if (pumpTimer) clearInterval(pumpTimer);
        if (progressTimer) clearInterval(progressTimer);
        pumpTimer = null;
        progressTimer = null;
    }

    function stop(reason) {
        if (!playing) return;
        stopTimers();
        killVoices();
        setPlaying(false);
        elapsed = 0;
        api.postMessage({ type: reason });
    }

    // Holds the position; the next start() resumes from it.
    function pause() {
        if (!playing) return;
        elapsed = currentElapsed();
        stopTimers();
        killVoices();
        setPlaying(false);
        api.postMessage({ type: "progress", t: elapsed });
        api.postMessage({ type: "paused" });
    }

    function finish() {
        if (!playing) return;
        stopTimers();
        fadePendingVoices(audio.ctx.currentTime);
        setPlaying(false);
        elapsed = 0;
        api.postMessage({ type: "ended" });
    }

    function fadePendingVoices(now) {
        var live = voices.slice();
        for (var i = 0; i < live.length; i++) {
            if (live[i].start > now) fadeVoice(live[i], now);
        }
    }

    function setLoop(next) {
        loop = Boolean(next);
        if (!loop && playing && audio) {
            var now = audio.ctx.currentTime;
            fadePendingVoices(now);
            rewindScheduling(now);
        }
    }

    function setPlaying(next) {
        playing = next;
        renderRowStates();
    }

    function warpToSpeed(nextSpeed, now) {
        var oldSpeed = score.pxPerSecond;
        if (nextSpeed === oldSpeed) return;
        var playheadPx = (now - startTime) * oldSpeed;
        startTime = now - playheadPx / nextSpeed;
    }

    function firstVoiceAtOrAfter(t) {
        var index = 0;
        while (index < score.voices.length && score.voices[index].t < t) index++;
        return index;
    }

    function swapScore(next) {
        var now = audio.ctx.currentTime;
        warpToSpeed(next.pxPerSecond, now);
        score = next;
        rewindScheduling(now);
        reconcileVoices();
    }

    function seekTo(t) {
        if (!score) return;
        var target = Math.max(0, Math.min(score.durationSec, t));
        if (!playing) {
            elapsed = target >= score.durationSec ? 0 : target;
            api.postMessage({ type: "progress", t: elapsed });
            return;
        }
        if (target >= score.durationSec) {
            finish();
            return;
        }
        var now = audio.ctx.currentTime;
        killVoices();
        startTime = now - target;
        rewindScheduling(now);
        reconcileVoices();
        elapsed = target;
        api.postMessage({ type: "progress", t: target });
    }


    // ---------------------------------------------------------------- UI

    var fullView = document.getElementById("full");
    var firstUse = document.getElementById("first-use");
    var createFrameBtn = document.getElementById("create-frame");
    var newFrameBtn = document.getElementById("new-frame");

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function formatTime(sec) {
        var tenths = Math.round(Math.max(0, sec) * 10);
        var minutes = Math.floor(tenths / 600);
        var rest = (tenths - minutes * 600) / 10;
        return minutes + ":" + (rest < 10 ? "0" : "") + rest.toFixed(1);
    }

    function unlockAudio() {
        resumeAudio();
    }

    // Browsers only let the panel start sound from a click or key press inside
    // it, so any of them starts the audio, whatever was pressed.
    document.addEventListener("pointerdown", unlockAudio, true);
    document.addEventListener("keydown", unlockAudio, true);

    /**
     * Runs "play" once sound is allowed. Hover is not a gesture, so this asks
     * the browser to start audio and plays only if it agrees: after a click in
     * the panel, or when the host lets the panel autoplay.
     */
    function whenAudible(play) {
        if (audioUnlocked()) {
            play();
            return;
        }
        resumeAudio().then(function (ok) { if (ok) play(); });
    }

    // A short sine pluck at "at" (default now). The gain sits at 0 from
    // creation, so a pluck cancelled before it starts stays silent.
    function pluck(midi, at, level) {
        var ctx = audio.ctx;
        var now = ctx.currentTime;
        var when = Math.max(now, at === undefined ? now : at);
        var osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
        var gain = ctx.createGain();
        gain.gain.setValueAtTime(0, now);
        gain.gain.setValueAtTime(0, when);
        gain.gain.linearRampToValueAtTime(level * tilt(osc.frequency.value), when + 0.006);
        gain.gain.setTargetAtTime(0.0001, when + 0.06, 0.22);
        osc.connect(gain);
        gain.connect(audio.dry);
        gain.connect(audio.send);
        osc.start(now);
        osc.stop(when + 1.6);
        return { osc: osc, gain: gain };
    }

    // Range snaps; silent until the panel has been clicked.
    function previewNote(midi) {
        if (!audioUnlocked()) return;
        pluck(midi, undefined, 0.16);
    }

    var SCALE_PREVIEW_DELAY_MS = 140;
    var SCALE_PREVIEW_STEP_SEC = 0.11;
    var SCALE_PREVIEW_TONIC = 60;
    var scalePreviewTimer = null;
    var scalePreviewVoices = [];

    function stopScalePreview() {
        clearTimeout(scalePreviewTimer);
        scalePreviewTimer = null;
        if (audio) {
            var now = audio.ctx.currentTime;
            scalePreviewVoices.forEach(function (voice) {
                holdParam(voice.gain.gain, now);
                voice.gain.gain.setTargetAtTime(0.0001, now, 0.02);
                voice.osc.stop(now + 0.15);
            });
        }
        scalePreviewVoices = [];
    }

    // One rising octave of the scale from C4, ending on the C above.
    function playScalePreview(scale) {
        if (!scale || !audioUnlocked()) return;
        var start = audio.ctx.currentTime + 0.02;
        var notes = scale.steps.concat([12]);
        scalePreviewVoices = notes.map(function (step, index) {
            return pluck(SCALE_PREVIEW_TONIC + step, start + index * SCALE_PREVIEW_STEP_SEC, 0.13);
        });
    }

    function scheduleScalePreview(index) {
        stopScalePreview();
        var timer = setTimeout(function () {
            whenAudible(function () {
                // Not if the list closed or moved on while audio was resuming.
                if (scalePreviewTimer !== timer) return;
                scalePreviewTimer = null;
                playScalePreview(scales[index]);
            });
        }, SCALE_PREVIEW_DELAY_MS);
        scalePreviewTimer = timer;
    }

    // ---- Backing preview: resting on a style plays one pass of it

    var BACKING_PREVIEW_DELAY_MS = 220;
    var backingPreviewTimer = null;
    var backingPreviewStyle = null;
    var backingPreviewVoices = [];

    function stopBackingPreview() {
        clearTimeout(backingPreviewTimer);
        backingPreviewTimer = null;
        backingPreviewStyle = null;
        if (audio) {
            var now = audio.ctx.currentTime;
            backingPreviewVoices.forEach(function (voice) {
                holdParam(voice.gain.gain, now);
                voice.gain.gain.setTargetAtTime(0.0001, now, 0.03);
                voice.osc.stop(now + 0.2);
            });
        }
        backingPreviewVoices = [];
    }

    // The driver voices the style in the current scale, voicing and rhythm.
    function scheduleBackingPreview(style) {
        stopBackingPreview();
        backingPreviewStyle = style;
        backingPreviewTimer = setTimeout(function () {
            backingPreviewTimer = null;
            api.postMessage({ type: "preview-backing", style: style });
        }, BACKING_PREVIEW_DELAY_MS);
    }

    // Pad chords and arpeggio notes, shaped like the ones playback makes.
    function playBackingPreview(notes) {
        if (!audioUnlocked()) return;
        var ctx = audio.ctx;
        var now = ctx.currentTime;
        var start = now + 0.03;
        backingPreviewVoices = notes.map(function (note) {
            var at = start + note.t;
            var hz = 440 * Math.pow(2, (note.midi - 69) / 12);
            var peak = Math.max(0.0005, note.v * PEAK_GAIN * tilt(hz)) * (note.a ? ARP_GAIN : BACKING_GAIN) * settings.backingLevel;
            var sustain = Math.max(0.0004, peak * (note.a ? ARP_SUSTAIN : BACKING_SUSTAIN));
            var attack = note.a ? ARP_ATTACK : note.d >= BACKING_PAD_MIN_SEC ? BACKING_PAD_ATTACK : BACKING_PLUCK_ATTACK;
            var end = at + Math.max(0.09, note.d);
            var osc = ctx.createOscillator();
            osc.type = note.a ? "sine" : "triangle";
            osc.frequency.value = hz;
            var gain = ctx.createGain();
            gain.gain.setValueAtTime(0, now);
            gain.gain.setValueAtTime(0, at);
            gain.gain.linearRampToValueAtTime(peak, at + attack);
            gain.gain.setTargetAtTime(sustain, at + attack, DECAY / 3);
            gain.gain.setTargetAtTime(0.0001, end, RELEASE / 3);
            var source = osc;
            if (!note.a) {
                var cutoff = ctx.createBiquadFilter();
                cutoff.type = "lowpass";
                cutoff.frequency.value = BACKING_CUTOFF;
                cutoff.Q.value = 0.6;
                osc.connect(cutoff);
                source = cutoff;
            }
            source.connect(gain);
            gain.connect(audio.dry);
            gain.connect(audio.send);
            osc.start(now);
            osc.stop(end + RELEASE * 3);
            return { osc: osc, gain: gain };
        });
    }

    // ---- Tooltip

    var tip = document.getElementById("tooltip");
    var tipOwner = null;

    function showTip(el, text) {
        if (!text) return;
        tipOwner = el;
        tip.textContent = text;
        tip.hidden = false;
        var r = el.getBoundingClientRect();
        var t = tip.getBoundingClientRect();
        var left = clamp(r.left + r.width / 2 - t.width / 2, 8, window.innerWidth - t.width - 8);
        var top = r.top - t.height - 6;
        if (top < 8) top = r.bottom + 6;
        tip.style.left = left + "px";
        tip.style.top = top + "px";
    }

    function hideTip(el) {
        if (el && el !== tipOwner) return;
        tipOwner = null;
        tip.hidden = true;
    }

    function bindTip(el, text) {
        el.addEventListener("pointerenter", function () { showTip(el, text()); });
        el.addEventListener("pointerleave", function () { hideTip(el); });
        el.addEventListener("focus", function () {
            if (el.matches(":focus-visible")) showTip(el, text());
        });
        el.addEventListener("blur", function () { hideTip(el); });
    }

    // ---- Dropdowns (Scale, Backing)

    var CHECK_ICON = '<svg class="check" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7"/></svg>';

    /**
     * A listbox dropdown. "items()" returns { name, description? }, "selected()"
     * the chosen index, "choose(index)" applies a new choice. "preview(index)" runs
     * when the user moves onto an option, "stopPreview()" when the list closes.
     */
    function createSelect(opts) {
        var field = document.getElementById(opts.id + "-field");
        var trigger = document.getElementById(opts.id + "-trigger");
        var valueEl = document.getElementById(opts.id + "-value");
        var list = document.getElementById(opts.id + "-list");
        var active = -1;

        function render() {
            list.textContent = "";
            var items = opts.items();
            var selected = opts.selected();
            items.forEach(function (item, index) {
                var option = document.createElement("div");
                option.className = "option";
                option.id = opts.id + "-option-" + index;
                option.setAttribute("role", "option");
                option.setAttribute("aria-selected", index === selected ? "true" : "false");
                option.innerHTML =
                    '<span class="option-text"><span class="option-name"></span><span class="option-desc"></span></span>' +
                    CHECK_ICON;
                option.querySelector(".option-name").textContent = item.name;
                var desc = option.querySelector(".option-desc");
                if (item.description) desc.textContent = item.description;
                else desc.remove();
                option.addEventListener("pointermove", function () { setActive(index, true); });
                option.addEventListener("click", function () { choose(index); });
                list.appendChild(option);
            });
            var current = items[selected];
            valueEl.textContent = current ? current.name : "";
        }

        function setActive(index, fromUser) {
            if (index === active) return;
            active = index;
            if (fromUser && opts.preview) opts.preview(index);
            var options = list.children;
            for (var i = 0; i < options.length; i++) options[i].classList.toggle("active", i === index);
            if (options[index]) list.setAttribute("aria-activedescendant", options[index].id);
        }

        function open() {
            if (!opts.items().length) return;
            // Opening is a click or key press in the panel, so sound may start here.
            unlockAudio();
            list.hidden = false;
            trigger.setAttribute("aria-expanded", "true");
            active = -1;
            setActive(opts.selected(), false);
            list.focus({ preventScroll: true });
        }

        function close(refocus) {
            if (list.hidden) return;
            if (opts.stopPreview) opts.stopPreview();
            list.hidden = true;
            trigger.setAttribute("aria-expanded", "false");
            if (refocus) trigger.focus({ preventScroll: true });
        }

        function choose(index) {
            close(true);
            if (index === opts.selected() || !opts.items()[index]) return;
            opts.choose(index);
            render();
        }

        trigger.addEventListener("click", function () {
            if (list.hidden) open();
            else close(false);
        });
        trigger.addEventListener("keydown", function (event) {
            if (["ArrowDown", "ArrowUp", "Enter", " "].indexOf(event.key) < 0) return;
            event.preventDefault();
            open();
        });
        list.addEventListener("keydown", function (event) {
            var last = opts.items().length - 1;
            switch (event.key) {
                case "ArrowDown": setActive(Math.min(last, active + 1), true); break;
                case "ArrowUp": setActive(Math.max(0, active - 1), true); break;
                case "Home": setActive(0, true); break;
                case "End": setActive(last, true); break;
                case "Enter":
                case " ": choose(active); break;
                case "Escape": close(true); break;
                case "Tab": close(false); return;
                default: return;
            }
            event.preventDefault();
        });
        document.addEventListener("pointerdown", function (event) {
            if (!field.contains(event.target)) close(false);
        });
        return { render: render };
    }

    var scales = [];

    var scaleSelect = createSelect({
        id: "scale",
        items: function () { return scales; },
        selected: function () {
            for (var i = 0; i < scales.length; i++) if (scales[i].id === settings.scale) return i;
            return 0;
        },
        choose: function (index) {
            settings.scale = scales[index].id;
            api.postMessage({ type: "scale", value: settings.scale });
        },
        preview: function (index) { scheduleScalePreview(index); },
        stopPreview: function () { stopScalePreview(); },
    });

    // ---- Range piano

    var piano = document.getElementById("piano");
    var keysEl = document.getElementById("keys");
    var band = document.getElementById("band");
    var handleLow = document.getElementById("handle-low");
    var handleHigh = document.getElementById("handle-high");
    var labelsEl = document.getElementById("piano-labels");
    var rangeValue = document.getElementById("range-value");
    var blackKeys = [];
    var keyLabels = [];
    var rangeDrag = null;

    (function buildPiano() {
        var width = 100 / WHITE_KEYS;
        for (var i = 0; i < WHITE_KEYS; i++) {
            var white = document.createElement("div");
            white.className = "key white";
            white.style.left = i * width + "%";
            white.style.width = width + "%";
            keysEl.appendChild(white);
        }
        // Black keys sit after C, D, F, G and A of each octave.
        [0, 1, 3, 4, 5].forEach(function (offset) {
            for (var octave = 0; octave < MAX_OCTAVE - MIN_OCTAVE; octave++) {
                var index = octave * 7 + offset;
                var black = document.createElement("div");
                black.className = "key black";
                black.style.left = (index + 1) * width + "%";
                keysEl.appendChild(black);
                blackKeys.push({ el: black, index: index });
            }
        });
        for (var o = MIN_OCTAVE; o <= MAX_OCTAVE; o++) {
            var label = document.createElement("span");
            label.className = "key-label";
            if (o === MIN_OCTAVE) label.classList.add("first");
            if (o === MAX_OCTAVE) label.classList.add("last");
            label.style.left = o === MIN_OCTAVE ? "0" : ((o - 1) * 7 + 0.5) * width + "%";
            label.textContent = "C" + o;
            labelsEl.appendChild(label);
            keyLabels.push(label);
        }
    })();

    function lowEdge(octave) {
        return ((octave - 1) * 7) / WHITE_KEYS;
    }

    function highEdge(octave) {
        return ((octave - 1) * 7 + 1) / WHITE_KEYS;
    }

    function renderRange() {
        var low = settings.lowOctave;
        var high = settings.highOctave;
        var from = lowEdge(low);
        var to = highEdge(high);
        band.style.left = from * 100 + "%";
        band.style.width = (to - from) * 100 + "%";
        handleLow.style.left = from * 100 + "%";
        handleHigh.style.left = to * 100 + "%";
        var lowIndex = (low - 1) * 7;
        var highIndex = (high - 1) * 7;
        blackKeys.forEach(function (key) {
            key.el.classList.toggle("in-range", key.index >= lowIndex && key.index < highIndex);
        });
        keyLabels.forEach(function (label, i) {
            var octave = i + MIN_OCTAVE;
            label.classList.toggle("end", octave === low || octave === high);
        });
        rangeValue.textContent = "C" + low + " to C" + high;
        [[handleLow, low, MIN_OCTAVE, high - 1], [handleHigh, high, low + 1, MAX_OCTAVE]].forEach(function (h) {
            h[0].setAttribute("aria-valuenow", String(h[1]));
            h[0].setAttribute("aria-valuetext", "C" + h[1]);
            h[0].setAttribute("aria-valuemin", String(h[2]));
            h[0].setAttribute("aria-valuemax", String(h[3]));
        });
    }

    function clampOctave(which, octave) {
        return which === "low"
            ? clamp(octave, MIN_OCTAVE, settings.highOctave - 1)
            : clamp(octave, settings.lowOctave + 1, MAX_OCTAVE);
    }

    function setOctave(which, octave) {
        var key = which === "low" ? "lowOctave" : "highOctave";
        var next = clampOctave(which, octave);
        if (settings[key] === next) return;
        settings[key] = next;
        renderRange();
        previewNote(12 * (next + 1));
        api.postMessage({ type: "range", low: settings.lowOctave, high: settings.highOctave });
    }

    function keyPosition(clientX) {
        var r = keysEl.getBoundingClientRect();
        return ((clientX - r.left) / r.width) * WHITE_KEYS;
    }

    function octaveAt(which, clientX) {
        var x = keyPosition(clientX);
        return which === "low" ? Math.round(x / 7) + 1 : Math.round((x - 1) / 7) + 1;
    }

    function handleFor(which) {
        return which === "low" ? handleLow : handleHigh;
    }

    piano.addEventListener("pointerdown", function (event) {
        if (event.button !== 0) return;
        event.preventDefault();
        unlockAudio();
        var handle = event.target.closest(".handle");
        var which;
        if (handle) {
            which = handle === handleLow ? "low" : "high";
        } else {
            // Clicking a key moves the handle nearest in pitch to that octave's C.
            var index = clamp(Math.floor(keyPosition(event.clientX)), 0, WHITE_KEYS - 1);
            var octave = Math.min(MAX_OCTAVE, Math.floor(index / 7) + 1);
            var toLow = Math.abs(octave - settings.lowOctave);
            var toHigh = Math.abs(octave - settings.highOctave);
            which = toLow < toHigh ? "low" : toHigh < toLow ? "high" : octave <= settings.lowOctave ? "low" : "high";
            setOctave(which, octave);
        }
        rangeDrag = { which: which, pointerId: event.pointerId };
        piano.setPointerCapture(event.pointerId);
        handleFor(which).classList.add("dragging");
        handleFor(which).focus({ preventScroll: true });
    });
    piano.addEventListener("pointermove", function (event) {
        if (!rangeDrag || event.pointerId !== rangeDrag.pointerId) return;
        setOctave(rangeDrag.which, octaveAt(rangeDrag.which, event.clientX));
    });
    function endRangeDrag() {
        if (!rangeDrag) return;
        handleFor(rangeDrag.which).classList.remove("dragging");
        rangeDrag = null;
    }
    piano.addEventListener("pointerup", endRangeDrag);
    piano.addEventListener("pointercancel", endRangeDrag);

    [[handleLow, "low"], [handleHigh, "high"]].forEach(function (pair) {
        pair[0].addEventListener("keydown", function (event) {
            var which = pair[1];
            var current = which === "low" ? settings.lowOctave : settings.highOctave;
            var next;
            switch (event.key) {
                case "ArrowLeft":
                case "ArrowDown": next = current - 1; break;
                case "ArrowRight":
                case "ArrowUp": next = current + 1; break;
                case "Home": next = MIN_OCTAVE; break;
                case "End": next = MAX_OCTAVE; break;
                default: return;
            }
            event.preventDefault();
            unlockAudio();
            setOctave(which, next);
        });
    });

    // ---- Backing: named styles, each the current scale's own progression

    var backingStyles = [];
    var backingEl = document.getElementById("backing");

    function isArp(rhythm) {
        return typeof rhythm === "string";
    }

    function setBacking(patch) {
        var next = {};
        for (var key in settings.backing) next[key] = settings.backing[key];
        for (var key2 in patch) next[key2] = patch[key2];
        settings.backing = next;
        renderBackingRows();
        api.postMessage({ type: "backing", value: settings.backing });
    }

    function backingItems() {
        return [{ value: "off", label: "Off", tip: "No backing chords", disabled: false }].concat(
            backingStyles.map(function (style) {
                return {
                    value: style.id,
                    label: style.label,
                    tip: style.progression ? "Chords " + style.progression : "Not in this scale",
                    disabled: !style.progression,
                };
            })
        );
    }

    function currentBacking() {
        return settings.backing.enabled ? settings.backing.style : "off";
    }

    function chooseBacking(value) {
        if (value === currentBacking()) return;
        if (value === "off") setBacking({ enabled: false });
        else setBacking({ enabled: true, style: value });
    }

    // Rebuilt when the scale changes, since the scale decides which styles exist.
    function renderBackingTabs() {
        backingEl.textContent = "";
        backingItems().forEach(function (item) {
            var button = document.createElement("button");
            button.type = "button";
            button.className = "segment";
            button.setAttribute("role", "radio");
            button.dataset.value = item.value;
            button.textContent = item.label;
            button.disabled = item.disabled;
            button.addEventListener("click", function () { chooseBacking(item.value); });
            if (item.value !== "off" && !item.disabled) {
                button.addEventListener("pointerenter", function () { scheduleBackingPreview(item.value); });
                button.addEventListener("pointerleave", stopBackingPreview);
            }
            bindTip(button, function () { return item.tip; });
            backingEl.appendChild(button);
        });
        updateBackingTabs();
    }

    function updateBackingTabs() {
        var value = currentBacking();
        Array.prototype.forEach.call(backingEl.children, function (button) {
            var on = button.dataset.value === value;
            button.setAttribute("aria-checked", on ? "true" : "false");
            button.tabIndex = on ? 0 : -1;
        });
    }

    backingEl.addEventListener("keydown", function (event) {
        var buttons = Array.prototype.slice.call(backingEl.children).filter(function (b) { return !b.disabled; });
        var at = buttons.indexOf(document.activeElement);
        if (at < 0) return;
        var next;
        switch (event.key) {
            case "ArrowLeft":
            case "ArrowUp": next = (at - 1 + buttons.length) % buttons.length; break;
            case "ArrowRight":
            case "ArrowDown": next = (at + 1) % buttons.length; break;
            case "Home": next = 0; break;
            case "End": next = buttons.length - 1; break;
            default: return;
        }
        event.preventDefault();
        chooseBacking(buttons[next].dataset.value);
        buttons[next].focus({ preventScroll: true });
        var item = backingItems().filter(function (i) { return i.value === buttons[next].dataset.value; })[0];
        if (item) showTip(buttons[next], item.tip);
    });

    /** A row of segments; "items" are { value, label, tip }. */
    function createSegmented(id, items, current, choose) {
        var el = document.getElementById(id);
        items.forEach(function (item, index) {
            var button = document.createElement("button");
            button.type = "button";
            button.className = "segment";
            button.setAttribute("role", "radio");
            button.dataset.index = String(index);
            button.textContent = item.label;
            button.addEventListener("click", function () { choose(item.value); });
            bindTip(button, function () { return item.tip; });
            el.appendChild(button);
        });
        el.addEventListener("keydown", function (event) {
            var buttons = Array.prototype.slice.call(el.children);
            var at = buttons.indexOf(document.activeElement);
            if (at < 0) return;
            var next;
            switch (event.key) {
                case "ArrowLeft":
                case "ArrowUp": next = (at - 1 + buttons.length) % buttons.length; break;
                case "ArrowRight":
                case "ArrowDown": next = (at + 1) % buttons.length; break;
                case "Home": next = 0; break;
                case "End": next = buttons.length - 1; break;
                default: return;
            }
            event.preventDefault();
            choose(items[next].value);
            buttons[next].focus({ preventScroll: true });
            showTip(buttons[next], items[next].tip);
        });
        return {
            render: function () {
                var value = current();
                Array.prototype.forEach.call(el.children, function (button, index) {
                    var on = items[index].value === value;
                    button.setAttribute("aria-checked", on ? "true" : "false");
                    button.tabIndex = on ? 0 : -1;
                });
            },
        };
    }

    var voicingControl = createSegmented(
        "voicing",
        [
            { value: "bass", label: "Bass", tip: "Bass note only" },
            { value: "omit3", label: "No 3rd", tip: "Bass, root and fifth" },
            { value: "full", label: "Full", tip: "Bass and the full triad" },
        ],
        function () { return settings.backing.voicing; },
        function (value) { if (value !== settings.backing.voicing) setBacking({ voicing: value }); }
    );

    var rhythmControl = createSegmented(
        "rhythm",
        [
            { value: 1, label: "1\u00d7", tip: "One strike per chord" },
            { value: 2, label: "2\u00d7", tip: "Two strikes per chord" },
            { value: 4, label: "4\u00d7", tip: "Four strikes per chord" },
            { value: "arp-up", label: "Arp \\u2191", tip: "Arpeggio up over a held bass" },
            { value: "arp-down", label: "Arp \\u2193", tip: "Arpeggio down over a held bass" },
        ],
        function () { return settings.backing.rhythm; },
        function (value) { if (value !== settings.backing.rhythm) setBacking({ rhythm: value }); }
    );


    // Voicing and Rhythm always show; arpeggios set their own voicing, so
    // Voicing is greyed out while one is chosen.
    function renderBackingRows() {
        updateBackingTabs();
        voicingControl.render();
        rhythmControl.render();
        var arp = isArp(settings.backing.rhythm);
        Array.prototype.forEach.call(document.getElementById("voicing").children, function (button) {
            button.disabled = arp;
        });
        showBackingLevel(settings.backing.enabled);
    }

    // ---- Feel

    var feel = document.getElementById("feel");
    var feelToggle = document.getElementById("feel-toggle");
    var feelBody = document.getElementById("feel-body");
    var feelSummary = document.getElementById("feel-summary");
    var slidersEl = document.getElementById("sliders");
    var VALUE_INSET = 10;
    var MAP_START = 6;
    var MAP_GAP = 8;
    var MARK_GAP = 8;
    var KEY_ACTIVE_MS = 700;
    var SPEED_POST_MS = 120;

    function formatSpeed(v) {
        var hundredths = Math.round(v * 100);
        return (hundredths % 10 === 0 ? v.toFixed(1) : v.toFixed(2)) + "\u00d7";
    }

    function formatMs(v) {
        return Math.round(v * 1000) + "ms";
    }

    function formatPercent(v) {
        return Math.round(v * 100) + "%";
    }

    var SLIDERS = [
        { key: "speed", label: "Speed", min: 0.5, max: 2, step: 0.05, def: 1, marks: "ticks", widest: "0.55\u00d7", format: formatSpeed },
        { key: "attack", label: "Attack", min: 0, max: 0.3, step: 0.005, def: 0.02, marks: "dots", widest: "300ms", format: formatMs, hint: "Lower is sharper, higher is softer" },
        { key: "notes", label: "Notes", min: 0, max: 1, step: 0.01, def: 0.8, marks: "dots", widest: "100%", format: formatPercent },
        { key: "backingLevel", label: "Backing", min: 0, max: 1, step: 0.01, def: 0.7, marks: "dots", widest: "100%", format: formatPercent },
        { key: "reverb", label: "Reverb", min: 0, max: 1, step: 0.01, def: 0.38, marks: "dots", widest: "100%", format: formatPercent },
    ];

    function quantize(spec, raw) {
        var steps = Math.round((clamp(raw, spec.min, spec.max) - spec.min) / spec.step);
        return Number((spec.min + steps * spec.step).toFixed(4));
    }

    var speedPostTimer = null;

    function postSpeed() {
        clearTimeout(speedPostTimer);
        speedPostTimer = null;
        api.postMessage({ type: "speed", value: settings.speed });
    }

    function liveApply(key) {
        if (key === "speed") {
            renderRowStates();
            // Heard immediately, without rebuilding the score on every pixel.
            if (!speedPostTimer) speedPostTimer = setTimeout(postSpeed, SPEED_POST_MS);
            return;
        }
        if (!audio) return;
        var now = audio.ctx.currentTime;
        if (key === "reverb") audio.wet.gain.setTargetAtTime(settings.reverb, now, 0.02);
    }

    function commitSlider(slider) {
        if (slider.spec.key === "speed") {
            postSpeed();
            return;
        }
        api.postMessage({
            type: "knobs",
            values: {
                attack: settings.attack,
                notes: settings.notes,
                backingLevel: settings.backingLevel,
                reverb: settings.reverb,
            },
        });
    }

    function renderSummary() {
        feelSummary.textContent =
            settings.speed.toFixed(2) + "\u00d7 \u00b7 " + formatMs(settings.attack) + " \u00b7 " + formatPercent(settings.notes);
    }

    function measureText(text) {
        var probe = document.createElement("span");
        probe.className = "measure";
        probe.textContent = text;
        document.body.appendChild(probe);
        var width = probe.getBoundingClientRect().width;
        probe.remove();
        return Math.ceil(width);
    }

    function layoutSlider(slider) {
        var width = slider.el.clientWidth;
        if (!width) return;
        // Room for the widest value, so the value never shifts.
        var valueWidth = measureText(slider.spec.widest);
        slider.valueEl.style.width = valueWidth + "px";
        var valueStart = width - VALUE_INSET - valueWidth;
        slider.geom = {
            from: MAP_START,
            to: valueStart - MAP_GAP,
            marksFrom: slider.labelEl.offsetLeft + slider.labelEl.offsetWidth + MARK_GAP,
            marksTo: valueStart - MARK_GAP,
            labelEnd: slider.labelEl.offsetLeft + slider.labelEl.offsetWidth,
        };
        renderSlider(slider);
    }

    function sliderX(slider, value) {
        var g = slider.geom;
        var ratio = (value - slider.spec.min) / (slider.spec.max - slider.spec.min);
        return g.from + ratio * (g.to - g.from);
    }

    function renderSlider(slider) {
        var spec = slider.spec;
        var value = settings[spec.key];
        slider.valueEl.textContent = spec.format(value);
        slider.el.setAttribute("aria-valuenow", String(value));
        slider.el.setAttribute("aria-valuetext", spec.format(value));
        if (!slider.geom) return;
        var x = sliderX(slider, value);
        slider.indicator.style.transform = "translateX(" + (x - 1).toFixed(1) + "px)";
        // Low values put the indicator under the label text; the fill still shows them.
        slider.indicator.hidden = x < slider.geom.labelEnd + 3;
        slider.fill.style.width = Math.max(0, x + 4 - 2).toFixed(1) + "px";
        var g = slider.geom;
        slider.marks.forEach(function (mark) {
            var mx = sliderX(slider, mark.value);
            var visible =
                mx >= g.marksFrom &&
                mx <= g.marksTo &&
                Math.abs(mx - x) > 3 &&
                (spec.marks === "ticks" || mx > x);
            mark.el.hidden = !visible;
            mark.el.style.left = mx.toFixed(1) + "px";
        });
    }

    function setSliderValue(slider, value, commit) {
        var key = slider.spec.key;
        if (settings[key] !== value) {
            settings[key] = value;
            renderSlider(slider);
            renderSummary();
            liveApply(key);
        }
        if (commit) commitSlider(slider);
    }

    function buildSlider(spec) {
        var el = document.createElement("div");
        el.className = "slider";
        el.tabIndex = 0;
        el.setAttribute("role", "slider");
        el.setAttribute("aria-label", spec.label);
        el.setAttribute("aria-valuemin", String(spec.min));
        el.setAttribute("aria-valuemax", String(spec.max));
        el.innerHTML =
            '<div class="s-fill"></div><div class="s-marks"></div>' +
            '<span class="s-label"></span><span class="s-value"></span><span class="s-indicator"></span>';
        var slider = {
            spec: spec,
            el: el,
            fill: el.querySelector(".s-fill"),
            labelEl: el.querySelector(".s-label"),
            valueEl: el.querySelector(".s-value"),
            indicator: el.querySelector(".s-indicator"),
            marks: [],
            geom: null,
            dragging: false,
            keyTimer: null,
        };
        slider.labelEl.textContent = spec.label;

        var markValues = [];
        if (spec.marks === "ticks") {
            for (var tenths = Math.round(spec.min * 10) + 1; tenths < Math.round(spec.max * 10); tenths++) {
                markValues.push(tenths / 10);
            }
        } else {
            for (var p = 1; p < 10; p++) markValues.push(spec.min + ((spec.max - spec.min) * p) / 10);
        }
        var marksEl = el.querySelector(".s-marks");
        markValues.forEach(function (value) {
            var mark = document.createElement("span");
            mark.className = spec.marks === "ticks" ? "s-tick" : "s-dot";
            marksEl.appendChild(mark);
            slider.marks.push({ el: mark, value: value });
        });

        function valueAt(clientX) {
            var g = slider.geom;
            var r = el.getBoundingClientRect();
            var ratio = clamp((clientX - r.left - g.from) / (g.to - g.from), 0, 1);
            var value = quantize(spec, spec.min + ratio * (spec.max - spec.min));
            if (spec.key === "speed" && Math.abs(value - 1) <= 0.06) value = 1;
            return value;
        }

        function setActive(on) {
            el.classList.toggle("active", on);
        }

        el.addEventListener("pointerdown", function (event) {
            if (event.button !== 0 || !slider.geom) return;
            event.preventDefault();
            el.focus({ preventScroll: true });
            el.setPointerCapture(event.pointerId);
            slider.dragging = true;
            hideTip(el);
            setActive(true);
            setSliderValue(slider, valueAt(event.clientX), false);
        });
        el.addEventListener("pointermove", function (event) {
            if (!slider.dragging) return;
            setSliderValue(slider, valueAt(event.clientX), false);
        });
        function release() {
            if (!slider.dragging) return;
            slider.dragging = false;
            if (!slider.keyTimer) setActive(false);
            commitSlider(slider);
        }
        el.addEventListener("pointerup", release);
        el.addEventListener("pointercancel", release);
        el.addEventListener("dblclick", function () {
            setSliderValue(slider, spec.def, true);
        });
        el.addEventListener("keydown", function (event) {
            var value = settings[spec.key];
            var big = (spec.max - spec.min) / 10;
            var next;
            switch (event.key) {
                case "ArrowRight":
                case "ArrowUp": next = value + (event.shiftKey ? big : spec.step); break;
                case "ArrowLeft":
                case "ArrowDown": next = value - (event.shiftKey ? big : spec.step); break;
                case "PageUp": next = value + big; break;
                case "PageDown": next = value - big; break;
                case "Home": next = spec.min; break;
                case "End": next = spec.max; break;
                default: return;
            }
            event.preventDefault();
            hideTip(el);
            setActive(true);
            clearTimeout(slider.keyTimer);
            slider.keyTimer = setTimeout(function () {
                slider.keyTimer = null;
                if (!slider.dragging) setActive(false);
            }, KEY_ACTIVE_MS);
            setSliderValue(slider, quantize(spec, next), true);
        });
        el.addEventListener("blur", function () {
            clearTimeout(slider.keyTimer);
            slider.keyTimer = null;
            if (!slider.dragging) setActive(false);
        });
        if (spec.hint) {
            bindTip(el, function () { return slider.dragging ? "" : spec.hint; });
        }
        slidersEl.appendChild(el);
        renderSlider(slider);
        return slider;
    }

    var sliders = SLIDERS.map(buildSlider);
    showBackingLevel(settings.backing.enabled);

    // The Backing level slider only shows while a backing is on.
    function showBackingLevel(on) {
        sliders.forEach(function (slider) {
            if (slider.spec.key !== "backingLevel") return;
            slider.el.hidden = !on;
            if (on) layoutSlider(slider);
        });
    }

    function layoutSliders() {
        sliders.forEach(layoutSlider);
    }

    function renderSliders() {
        sliders.forEach(renderSlider);
        renderSummary();
    }

    function setFeelOpen(open) {
        feel.classList.toggle("open", open);
        feelToggle.setAttribute("aria-expanded", open ? "true" : "false");
        feelBody.inert = !open;
    }
    setFeelOpen(false);
    feelToggle.addEventListener("click", function () {
        setFeelOpen(!feel.classList.contains("open"));
    });

    if (window.ResizeObserver) new ResizeObserver(layoutSliders).observe(slidersEl);

    // Keep 16px of space on the right whether the scrollbar takes room or overlays.
    var mainEl = document.querySelector("main");
    function fitScrollGutter() {
        var gutter = mainEl.offsetWidth - mainEl.clientWidth;
        root.style.setProperty("--scroll-pad", Math.max(0, 16 - gutter) + "px");
    }
    fitScrollGutter();
    window.addEventListener("resize", fitScrollGutter);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutSliders);

    // ---- Frames

    var frameList = document.getElementById("frame-list");
    var frames = [];
    var selectedIds = [];

    function isPlayingFrame(id) {
        return playing && Boolean(score) && score.frameIds.indexOf(id) >= 0;
    }

    function markAttention(id) {
        attentionId = id || null;
        renderRowStates();
    }

    function frameDuration(frame) {
        return frame.width / (BASE_PX_PER_SECOND * settings.speed);
    }

    var SVG_NS = "http://www.w3.org/2000/svg";

    function buildThumb(frame) {
        var svg = document.createElementNS(SVG_NS, "svg");
        var height = (THUMB_WIDTH * frame.height) / frame.width;
        svg.setAttribute("viewBox", "0 0 " + THUMB_WIDTH + " " + height.toFixed(1));
        svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
        svg.setAttribute("aria-hidden", "true");
        frame.strokes.forEach(function (stroke) {
            var path = document.createElementNS(SVG_NS, "path");
            path.setAttribute("d", stroke.d);
            if (stroke.color) path.style.stroke = stroke.color;
            svg.appendChild(path);
        });
        var thumb = document.createElement("div");
        thumb.className = "thumb";
        thumb.appendChild(svg);
        return thumb;
    }

    function buildRow(frame) {
        var row = document.createElement("li");
        row.className = "frame-row";
        row.dataset.id = frame.id;
        row.tabIndex = 0;
        row.setAttribute("role", "button");
        row.appendChild(buildThumb(frame));

        var text = document.createElement("div");
        text.className = "frame-text";
        text.innerHTML =
            '<div class="frame-name"><span class="name-text"></span><span class="eq" aria-hidden="true"><i></i><i></i><i></i></span></div>' +
            '<div class="frame-dur"></div>';
        bindName(text.querySelector(".name-text"), frame);
        row.appendChild(text);

        // Loop is one setting for every frame; each row shows and flips it.
        var loopBtn = document.createElement("button");
        loopBtn.type = "button";
        loopBtn.className = "icon-btn loop";
        loopBtn.innerHTML = LOOP_ICON;
        loopBtn.addEventListener("click", function () {
            setLoop(!loop);
            api.postMessage({ type: "loop", value: loop });
            renderRowStates();
            showTip(loopBtn, loopTip());
        });
        bindTip(loopBtn, loopTip);
        row.appendChild(loopBtn);

        var play = document.createElement("button");
        play.type = "button";
        play.className = "icon-btn play";
        row.appendChild(play);

        row.addEventListener("click", function (event) {
            // The second click of a double-click on the name starts a rename instead.
            if (event.target.closest(".play, .loop, .name-input") || event.detail > 1) return;
            api.postMessage({ type: "focus-frame", id: frame.id });
        });
        row.addEventListener("keydown", function (event) {
            if (event.target !== row) return;
            if (event.key === "F2") {
                event.preventDefault();
                startRename(frame.id);
                return;
            }
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            api.postMessage({ type: "focus-frame", id: frame.id });
        });
        play.addEventListener("click", function () {
            playFrame(frame.id);
        });
        return row;
    }

    function bindName(el, frame) {
        el.textContent = frame.name;
        el.addEventListener("dblclick", function (event) {
            event.stopPropagation();
            startRename(frame.id);
        });
        bindTip(el, function () { return editing ? "" : "Double-click to rename"; });
    }

    function frameById(id) {
        for (var i = 0; i < frames.length; i++) if (frames[i].id === id) return frames[i];
        return null;
    }

    function rowById(id) {
        var rows = frameList.children;
        for (var i = 0; i < rows.length; i++) if (rows[i].dataset.id === id) return rows[i];
        return null;
    }

    // Rename in place: Enter or blur saves, Esc cancels, an empty name is ignored.
    var editing = null;
    var pendingRenameId = null;

    function startRename(id, draft) {
        var frame = frameById(id);
        var row = rowById(id);
        if (!frame || !row) {
            pendingRenameId = id;
            return;
        }
        pendingRenameId = null;
        if (editing && editing.id === id) {
            editing.input.focus({ preventScroll: true });
            return;
        }
        if (editing) editing.finish(true);
        hideTip();
        var nameEl = row.querySelector(".name-text");
        var input = document.createElement("input");
        input.type = "text";
        input.className = "name-input";
        input.maxLength = 60;
        input.spellcheck = false;
        input.setAttribute("aria-label", "Frame name");
        input.value = draft === undefined ? frame.name : draft;
        nameEl.replaceWith(input);
        var done = false;
        function finish(commit, refocus) {
            if (done) return;
            done = true;
            editing = null;
            var next = input.value.trim();
            if (commit && next && next !== frame.name) {
                frame.name = next;
                api.postMessage({ type: "rename-frame", id: id, name: next });
            }
            if (!input.isConnected) return;
            var span = document.createElement("span");
            span.className = "name-text";
            bindName(span, frame);
            input.replaceWith(span);
            renderRowStates();
            if (refocus) row.focus({ preventScroll: true });
        }
        editing = { id: id, input: input, finish: finish, drop: function () { done = true; editing = null; } };
        input.addEventListener("keydown", function (event) {
            event.stopPropagation();
            if (event.key === "Enter") {
                event.preventDefault();
                finish(true, true);
            } else if (event.key === "Escape") {
                event.preventDefault();
                finish(false, true);
            }
        });
        input.addEventListener("blur", function () { finish(true); });
        input.addEventListener("click", function (event) { event.stopPropagation(); });
        input.addEventListener("dblclick", function (event) { event.stopPropagation(); });
        input.focus({ preventScroll: true });
        if (draft === undefined) input.select();
        revealInPanel(row);
    }

    /**
     * Scrolls the panel just enough to show "el". Never scrollIntoView: it also
     * scrolls every container around the panel, Drawdy's whole page included.
     */
    function revealInPanel(el) {
        var main = document.querySelector("main");
        var view = main.getBoundingClientRect();
        var box = el.getBoundingClientRect();
        var margin = 8;
        if (box.top < view.top + margin) {
            main.scrollTop -= view.top + margin - box.top;
        } else if (box.bottom > view.bottom - margin) {
            main.scrollTop += box.bottom - (view.bottom - margin);
        }
    }

    // Opened from a frame's title on the board: outline that frame's play button
    // until the user does something else in the panel.
    var spotlightId = null;

    function spotlightFrame(id) {
        spotlightId = id;
        renderRowStates();
        var row = rowById(id);
        if (row) revealInPanel(row);
    }

    function clearSpotlight() {
        if (spotlightId === null) return;
        spotlightId = null;
        renderRowStates();
    }

    document.addEventListener("pointerdown", clearSpotlight, true);

    function loopTip() {
        return loop ? "Loop is on" : "Loop is off";
    }

    function playFrame(id) {
        if (isPlayingFrame(id)) {
            pause();
            return;
        }
        // Resume inside the click so the browser lets this panel make sound.
        unlockAudio();
        attentionId = null;
        renderRowStates();
        api.postMessage({ type: "play-frame", id: id });
    }

    function renderRowStates() {
        Array.prototype.forEach.call(frameList.children, function (row) {
            var id = row.dataset.id;
            var frame = null;
            for (var i = 0; i < frames.length; i++) if (frames[i].id === id) frame = frames[i];
            if (!frame) return;
            var on = isPlayingFrame(id);
            var duration = formatTime(frameDuration(frame));
            row.classList.toggle("selected", selectedIds.indexOf(id) >= 0);
            row.classList.toggle("playing", on);
            row.setAttribute("aria-label", frame.name + ", " + duration);
            row.querySelector(".frame-dur").textContent = duration;
            var play = row.querySelector(".play");
            if (play.dataset.state !== (on ? "pause" : "play")) {
                play.dataset.state = on ? "pause" : "play";
                play.innerHTML = on ? PAUSE_ICON : PLAY_ICON;
            }
            play.setAttribute("aria-label", (on ? "Pause " : "Play ") + frame.name);
            play.setAttribute("aria-pressed", on ? "true" : "false");
            play.classList.toggle("attention", attentionId === id && !on);
            play.classList.toggle("spotlight", spotlightId === id);
            var loopBtn = row.querySelector(".loop");
            loopBtn.setAttribute("aria-pressed", loop ? "true" : "false");
            loopBtn.setAttribute("aria-label", loop ? "Loop is on" : "Loop is off");
        });
    }

    function renderFrames() {
        var any = frames.length > 0;
        fullView.hidden = !any;
        firstUse.hidden = any;
        createFrameBtn.disabled = false;
        newFrameBtn.disabled = false;
        var active = document.activeElement;
        var focusRow = active && active.closest ? active.closest(".frame-row") : null;
        var focusId = focusRow ? focusRow.dataset.id : null;
        var focusPlay = Boolean(focusRow) && active.classList.contains("play");
        // A list refresh rebuilds the rows; carry an unfinished rename across it.
        var draft = editing ? { id: editing.id, value: editing.input.value } : null;
        if (editing) editing.drop();
        frameList.textContent = "";
        frames.forEach(function (frame) {
            frameList.appendChild(buildRow(frame));
        });
        renderRowStates();
        if (focusId) {
            Array.prototype.forEach.call(frameList.children, function (row) {
                if (row.dataset.id !== focusId) return;
                (focusPlay ? row.querySelector(".play") : row).focus({ preventScroll: true });
            });
        }
        if (spotlightId !== null && !focusId) {
            var spotRow = rowById(spotlightId);
            if (spotRow) revealInPanel(spotRow);
        }
        if (draft) startRename(draft.id, draft.value);
        else if (pendingRenameId) startRename(pendingRenameId);
        if (any) layoutSliders();
    }

    function addFrame(button) {
        button.disabled = true;
        api.postMessage({ type: "add-frame" });
    }
    createFrameBtn.addEventListener("click", function () { addFrame(createFrameBtn); });
    newFrameBtn.addEventListener("click", function () { addFrame(newFrameBtn); });

    // ---- Settings from the driver

    function applySettings(values) {
        ["speed", "attack", "notes", "backingLevel", "reverb"].forEach(function (key) {
            if (typeof values[key] === "number") settings[key] = values[key];
        });
        if (typeof values.scale === "string") settings.scale = values.scale;
        if (typeof values.lowOctave === "number" && typeof values.highOctave === "number") {
            settings.lowOctave = values.lowOctave;
            settings.highOctave = values.highOctave;
        }
        if (values.backing && typeof values.backing === "object") settings.backing = values.backing;
        if (typeof values.loop === "boolean") setLoop(values.loop);
        scaleSelect.render();
        renderRange();
        renderBackingRows();
        renderSliders();
        renderRowStates();
        if (audio) {
            var now = audio.ctx.currentTime;
            audio.wet.gain.setTargetAtTime(settings.reverb, now, 0.02);
        }
    }

    renderRange();
    renderSliders();

    function sameFrames(a, b) {
        return Boolean(a) && Boolean(b) && a.frameIds.join(",") === b.frameIds.join(",");
    }

    function receiveScore(msg) {
        var next = msg.score;
        var same = sameFrames(score, next);
        if (playing && same) {
            swapScore(next);
            return;
        }
        if (playing) stop("stopped");
        // A paused frame keeps its place; the playhead stays put in px, so a
        // speed change rescales the elapsed time.
        var keep = same && score ? (elapsed * score.pxPerSecond) / next.pxPerSecond : 0;
        score = next;
        elapsed = keep > 0 && keep < next.durationSec ? keep : 0;
        renderRowStates();
        api.postMessage({ type: "progress", t: elapsed });
        if (!msg.autoplay) return;
        var activated = navigator.userActivation ? navigator.userActivation.hasBeenActive : false;
        if (audioUnlocked() || activated) start();
        else markAttention(next.frameIds[0]);
    }

    api.onMessage(function (msg) {
        if (!msg || typeof msg !== "object") return;
        switch (msg.type) {
            case "theme":
                themeStyle.textContent = ":root{" + msg.css + "}";
                applyTheme(msg.css);
                return;
            case "stop":
                stop("stopped");
                return;
            case "frames":
                frames = msg.frames;
                renderFrames();
                return;
            case "edit-frame-name":
                startRename(msg.id);
                return;
            case "spotlight-frame":
                spotlightFrame(msg.id);
                return;
            case "selection":
                selectedIds = msg.ids;
                if (spotlightId !== null && selectedIds.indexOf(spotlightId) < 0) spotlightId = null;
                renderRowStates();
                return;
            case "settings":
                applySettings(msg.values);
                return;
            case "seek":
                seekTo(msg.t);
                return;
            case "backing-preview":
                // Only if the pointer is still resting on that style.
                whenAudible(function () {
                    if (msg.style === backingPreviewStyle) playBackingPreview(msg.notes);
                });
                return;
            case "backing":
                stopBackingPreview();
                backingStyles = msg.styles;
                settings.backing = msg.value;
                renderBackingTabs();
                renderBackingRows();
                return;
            case "scales":
                scales = msg.scales;
                settings.scale = msg.current;
                scaleSelect.render();
                return;
            case "score":
                receiveScore(msg);
                return;
        }
    });

    api.postMessage({ type: "ready" });
})();
</script>
</body>
</html>`;

// assets/serene-icon-256.webp at 128px, embedded so the icon ships inside main.js.
const ICON_DATA_URI = "data:image/webp;base64,UklGRg4GAABXRUJQVlA4IAIGAABQHgCdASqAAIAAPlEij0SjoiGVSe3EOAUEsoBq2wygVeTnPdttzxumYU+e0ErU/l+HZ0B2qf23mV33/DHEzvSmWf9h4aeqt3h16P6v6GP+M9F3Se9T+wh+uv/B7Eg4Rn1xejPri9Gd33NjaQm3/sUjgsBopaqgjXI1/Hru8yeHVPPXHkaaCc4sxA6yryqlHVs1UscylTtBWn5eRPDwY8WUYpFrpra0opUIwoWLSYkcfTVgv12yt1ECb9uhno1Nq+izAwenIwRD9+mHgicuv/aWnULwZZLxwMQEwTrF5ukLaN6G8dX3Y33Nzb/DL2qWCk7HFHqPVZGJ4rVQQAD+9aD//ln/5Rfyi7XPxFYudkYAAAm/0c7mQszj/tHC5dLd7f/HXYk7Bm/W215w/oq/JvVPLqzq6Th0Jc+928HSmDNj7mBcyMkKSf8vedDf+bAP4pZZ2ooobTafpv/0tBC92Uy53LMBM79cUdGkei4PyNc9zdAKG4TYLlswH3kdDaTWrgYzriyjNmLXK+9EDvTvq5BckA/CFmiOMRalbN4bd/me/Yz8dc4HbiUYNXm0NIqBuen4FJEZ1UQuvRDsskHSScCFF/+1UFcxMRKNBUz6jes5ZjKeZa+0jbQWE0i0FunhoJW3MvFx3gu3oajBEUfRr/4jaZrUVP0QLUvBUevfBFmCw9NJsWj4Wv8L+GOLF+s5TjspgiDdNc3g1bQgiPiCQbLSCLKbeCz6Z98Hu+C4MiAeyPnptDurObp3vCP5/T3ArXKiA0jq2mW0j41i9WlVqNJko2wtKiEN8SjVNALnU/yzqzG3r40wiJfCDqVfLu/6pPElRZmgXAAxkvq07LRa1nb9+L+T+JyPwdsimvq6cwAUiiRo5krUpKhsB4Xcwmf5WorDOzHSu7EoIcLQmCxb1AiJaVSy5U56PWoWuGGVnbwZYqhTwu8qUd6mvG3n0xuZ+QCtQUxmdndSf8s6nw6GuXmVjy4Khr7gIGodqrQmsjM9qdSY1xLYtplT8chH/zbcjpePeZelqF7fFRpKAp8YkUEJBRKt/Pmo1LpLvdaBhf44S5PMHg/IzJhbwmBwGOirJA9zLDTFw/z/Clb++YZwsPwTtMHPsf8yYIkC7529vPbGXSrJyNyB6q6FtXKa9RLuLDazHDguOp+AV/RbbBzLLnxgydSVyZ0ZYPuSn9Zu79nVh4KiArG6g/gu00w78ri19tIVi5U1KTe3llk3m/VKv84nZwT/F3x5Z8P7Zsk+0O2uWrJItW8OenqoH9mrlkW9oO0ey+XPvxM3T7gy+P4G0UPt1e/ls7Y3tWa18omMMBW3BFaNGW+BNTYpTT4cfD2BiuATuudDdx83eIngFmRMlp/TsX8zj/YrFB7MynuvO+G9rk6jHGmWT+ZhsNX17FzBPHrs2j26/LdNQfgDca87mEtWqt+smIDKlyB9ZFJMlLmabM3IwhibjROKax1oDq34AiNivlGTvQmlK4U71zAxlemrGmD+8sGg7g8ZNvkN4oZ3jyMTTS8V/rbDy0JbR2KPrk5SKKrZuQ5CPrKNAfmRcUOYS+9FFoS7d0mUGu8U3jKK87+YfvzpODtt0Ju74w6eQ8rdpH+y1FGZqvBKFIms1hw3Vag5+U67oWoaCuOM45MivOmtsuQYyS5hAF3wLX812tPwMMFTERMJyoNdaYfYgLyDGyCQM9TidXSsvSFx1ejEUyOVAcoFtnSrQWojh9Yl7npFyDejBdlk5bOdxj7d38MOxP5zsyuRt740J2ux3lkLllOHnaSPgM2w0UvwPw4jgKufNeH7HKeojs9wWTHN2VrtJ+6S4h4oh+4Jdgugn7/MTjm7Af1QV4tQAD9eDPGDXJKLyhvrJ+Xa/NazxzYcNcNjpR7zHxE/rnc6ySXU+zFMoXHpud1TSqqTKvJT5qBQ48aGFRDNkOJsIt4f9BpoE/+RUgu6sY9Z/FFSGXNShynudMj9stD6m0aQdfwtEW2ls7Gs13fFW9+2yoXnHTYxKmCA2MOZDomtrbv2fSvjBy4+Xx7ZeIRir6AGIg7H3OwAAAAAAA==";
const ACTION_BUTTON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18"><clipPath id="drawdy-serene-rail-clip"><rect width="24" height="24" rx="5"/></clipPath><image href="${ICON_DATA_URI}" x="0" y="0" width="24" height="24" clip-path="url(#drawdy-serene-rail-clip)"/></svg>`;
const actionButtonId = (driverId) => `${driverId}:action-button`;
const panelWebviewId = (driverId) => `${driverId}:webview`;
function stylingCssVars(styling) {
    return Object.entries(styling)
        .map(([key, value]) => key === "theme"
        ? `color-scheme: ${value};`
        : `--drawdy-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}: ${value};`)
        .join("");
}
const serializeVoice = (score) => (voice) => ({
    t: voice.startSec,
    d: voice.durationSec,
    v: voice.velocity,
    g: voice.glide,
    b: voice.backing,
    a: voice.arp,
    pitches: voice.pitches.map((pitch) => ({
        t: pitch.t,
        hz: pitch.midi !== undefined
            ? midiToHz(pitch.midi)
            : rowToHz(score.scale, score.range, pitch.row),
        row: pitch.row,
    })),
});
function serializeScore(score, elementCount, frameIds) {
    return {
        durationSec: score.durationSec,
        pxPerSecond: score.pxPerSecond,
        rectWidth: score.rect.width,
        rectHeight: score.rect.height,
        elementCount,
        scaleId: score.scale.id,
        lowOctave: score.range.lowOctave,
        highOctave: score.range.highOctave,
        voices: score.voices.map(serializeVoice(score)),
        frameIds,
    };
}
async function openPanel(ctx, styling) {
    await ctx.issueCommand({
        type: "command:webview:create",
        ...stamp(ctx),
        req: {
            webviewDomId: panelWebviewId(ctx.driverId),
            htmlContent: PANEL_HTML.replace("/*__DRAWDY_STYLING__*/", stylingCssVars(styling)).replace("__SERENE_ICON__", ICON_DATA_URI),
            keepStateWhenClosed: true,
        },
    });
}
const backingStyles = (scaleId) => BACKING_STYLES.map((style) => ({
    ...style,
    progression: progressionFor(scaleId, style.id)?.name ?? null,
}));
const scaleOptions = () => SCALES.map((scale) => ({
    id: scale.id,
    name: scale.name,
    description: scale.description,
    steps: scale.steps,
}));
function postToPanel(ctx, message) {
    void ctx.issueCommand({
        type: "command:webview:post-message",
        ...stamp(ctx),
        req: { webviewDomId: panelWebviewId(ctx.driverId), message },
    });
}

const RANGE_PREVIEW_HOLD_MS = 600;
const MAX_NAME_CHARS = 28;
const EMPTY_MIN_WIDTH = 300;
const EMPTY_MIN_HEIGHT = 140;
const IDLE_PLAYHEAD_OPACITY = 0.4;
const TERTIARY_OPACITY = 0.5;
const EMPTY_TEXT_HEIGHT = 24;
// The playhead handle grows this much while hovered or dragged.
const HANDLE_ACTIVE_SCALE = 1.25;
// Pointer target around the handle, a little larger than the handle itself.
const HANDLE_HIT = { width: 24, height: 30 };
// How far past the visible area the drag shield reaches, in viewport sizes.
const SHIELD_REACH = 1;
// Text boxes at least this tall sit at their top whatever the host's line height.
const LABEL_BOX = 24;
function truncate(name) {
    return name.length > MAX_NAME_CHARS ? `${name.slice(0, MAX_NAME_CHARS - 1)}…` : name;
}
/** One preview batch: updated in place while its element ids stay the same. */
class PreviewBatch {
    _ctx;
    _hitTestable;
    _previewId = null;
    _shape = "";
    _sent = "";
    constructor(_ctx, _hitTestable = false) {
        this._ctx = _ctx;
        this._hitTestable = _hitTestable;
    }
    async sync(elements) {
        if (elements.length === 0) {
            await this.clear();
            return;
        }
        const sent = JSON.stringify(elements);
        if (sent === this._sent)
            return;
        const shape = elements.map((el) => el.drawdyElementId).join(",");
        if (this._previewId && shape === this._shape) {
            this._sent = sent;
            await this._ctx.issueCommand({
                type: "command:scene:update-drawdy-preview-elements",
                ...stamp(this._ctx),
                req: { elements },
            });
            return;
        }
        await this.clear();
        const { previewId } = unwrap(await this._ctx.issueCommand({
            type: "command:scene:create-drawdy-preview-elements",
            ...stamp(this._ctx),
            req: { elements, hitTestable: this._hitTestable },
        }));
        this._previewId = previewId;
        this._shape = shape;
        this._sent = sent;
    }
    async clear() {
        const previewId = this._previewId;
        this._previewId = null;
        this._shape = "";
        this._sent = "";
        if (!previewId)
            return;
        await this._ctx.issueCommand({
            type: "command:scene:delete-drawdy-preview-elements",
            ...stamp(this._ctx),
            req: { previewIds: [previewId] },
        });
    }
}
/**
 * Everything Serene draws on the board around its frames: the frame bar, the
 * time ruler, note labels, the playhead and the empty state. Lines are canvas
 * previews and text is component previews (DOM on the canvas's widget layer),
 * so all of it pans and zooms with the board and stays under Drawdy's panels.
 * Both scale with zoom, so sizes are screen pixels divided by zoom.
 */
class FrameOverlay {
    _ctx;
    _styling;
    _onClickTarget;
    _onPointerTarget;
    _frames = [];
    _zoom = 1;
    _settings = {
        pxPerSecond: 200,
        lowOctave: 3,
        highOctave: 6,
        stepsPerOctave: 5,
    };
    _selection = new Set();
    _hovered = null;
    _active = null;
    _rangePreview = null;
    _rangeTimer = null;
    /** Frames being moved on the board; their overlay is stale until the drop. */
    _dragging = new Set();
    /** Dragging a playhead: shown where the pointer is, applied on release. */
    _scrub = null;
    _shield = null;
    _handleHover = null;
    _guides;
    _labels;
    _playheads;
    _hits;
    _dirty = false;
    _syncing = false;
    _clickIds = new Set();
    _pointerIds = new Set();
    constructor(_ctx, _styling, 
    /** Asks for click events on a DOM id the overlay draws. */
    _onClickTarget, 
    /** Asks for scene pointer events on a preview element the overlay draws. */
    _onPointerTarget) {
        this._ctx = _ctx;
        this._styling = _styling;
        this._onClickTarget = _onClickTarget;
        this._onPointerTarget = _onPointerTarget;
        this._guides = new PreviewBatch(_ctx);
        this._labels = new PreviewBatch(_ctx);
        this._playheads = new PreviewBatch(_ctx);
        this._hits = new PreviewBatch(_ctx, true);
    }
    _id(part, frameId) {
        return `${this._ctx.driverId}:${part}:${frameId}`;
    }
    frameForBar(domId) {
        const prefix = "serene-bar-";
        return domId.startsWith(prefix) ? domId.slice(prefix.length) : null;
    }
    _pointable(elementId) {
        if (!this._pointerIds.has(elementId)) {
            this._pointerIds.add(elementId);
            this._onPointerTarget(elementId);
        }
        return elementId;
    }
    _clickable(domId) {
        if (!this._clickIds.has(domId)) {
            this._clickIds.add(domId);
            this._onClickTarget(domId);
        }
        return domId;
    }
    // ---- Inputs
    setZoom(zoom) {
        if (zoom === this._zoom)
            return;
        this._zoom = zoom;
        this._request();
    }
    setStyling(styling) {
        this._styling = styling;
        this._request();
    }
    setFrames(frames) {
        this._frames = frames;
        this._request();
    }
    /** Frame moves and resizes arrive before the debounced frame list. */
    onSceneChanged(changed) {
        let touched = false;
        for (const el of changed) {
            const frame = this._frames.find((f) => f.id === el.id);
            const rect = frame ? elementBounds(el) : null;
            if (!frame || !rect)
                continue;
            frame.rect = rect;
            touched = true;
        }
        if (touched)
            this._request();
    }
    setSettings(settings) {
        this._settings = settings;
        this._request();
    }
    setSelection(ids) {
        this._selection = new Set(ids);
        this._request();
    }
    setPointer(x, y) {
        let hovered = null;
        // Later frames draw on top, so the last hit wins.
        for (const frame of this._frames) {
            const r = frame.rect;
            if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height) {
                hovered = frame.id;
            }
        }
        if (hovered === this._hovered)
            return;
        this._hovered = hovered;
        this._request();
    }
    /**
     * Hides the overlay of frames that are actually moving. A press alone (a
     * drag start without movement) changes nothing, so a click on a selected
     * frame's bar, which Drawdy also treats as the start of a move, still lands.
     */
    setDragging(ids) {
        const next = new Set(ids.filter((id) => this._frames.some((f) => f.id === id)));
        if (next.size === this._dragging.size && [...next].every((id) => this._dragging.has(id)))
            return;
        this._dragging = next;
        this._request();
    }
    setActive(id, playing) {
        if (!id) {
            this._active = null;
        }
        else if (this._active?.id === id) {
            this._active.playing = playing;
        }
        else {
            this._active = { id, progress: 0, playing };
        }
        this._request();
    }
    setProgress(progress) {
        if (!this._active)
            return;
        this._active.progress = Math.min(1, Math.max(0, progress));
        this._request();
    }
    // ---- Dragging the playhead
    get isScrubbing() {
        return this._scrub !== null;
    }
    /** The frame whose playhead handle is among `ids`, if any. */
    frameForHandle(ids) {
        const prefix = `${this._ctx.driverId}:playhead-hit:`;
        const hit = ids.find((id) => id.startsWith(prefix));
        return hit ? hit.slice(prefix.length) : null;
    }
    setHandleHover(frameId) {
        if (frameId === this._handleHover)
            return;
        this._handleHover = frameId;
        this._request();
    }
    _progressAt(frameId, x) {
        const frame = this._frames.find((f) => f.id === frameId);
        if (!frame || frame.rect.width <= 0)
            return null;
        return Math.min(1, Math.max(0, (x - frame.rect.x) / frame.rect.width));
    }
    async beginScrub(frameId, x) {
        const progress = this._progressAt(frameId, x);
        if (progress === null)
            return;
        this._scrub = { frameId, progress };
        this._request();
        // A large invisible target keeps the drag's moves and release on Serene
        // instead of starting a selection or a stroke on the board.
        const { rect } = unwrap(await this._ctx.issueCommand({ type: "command:camera:get-viewport-rect", ...stamp(this._ctx) }));
        if (!this._scrub)
            return;
        this._shield = {
            x: rect.x - rect.width * SHIELD_REACH,
            y: rect.y - rect.height * SHIELD_REACH,
            width: rect.width * (1 + SHIELD_REACH * 2),
            height: rect.height * (1 + SHIELD_REACH * 2),
        };
        this._request();
    }
    scrubTo(x) {
        if (!this._scrub)
            return;
        const progress = this._progressAt(this._scrub.frameId, x);
        if (progress === null || progress === this._scrub.progress)
            return;
        this._scrub.progress = progress;
        this._request();
    }
    /** Ends the drag and returns where it landed; the caller seeks playback there. */
    endScrub() {
        const scrub = this._scrub;
        if (!scrub)
            return null;
        this._scrub = null;
        this._shield = null;
        // Hold the playhead where it was dropped until playback reports back.
        const playing = this._active?.id === scrub.frameId && this._active.playing;
        this._active = { id: scrub.frameId, progress: scrub.progress, playing };
        this._request();
        return scrub;
    }
    cancelScrub() {
        if (!this._scrub)
            return;
        this._scrub = null;
        this._shield = null;
        this._request();
    }
    /** Show the guides on one frame while Range is adjusted in the panel. */
    previewRange() {
        const target = this._frames.find((f) => this._selection.has(f.id)) ?? this._frames[0];
        if (!target)
            return;
        this._rangePreview = target.id;
        if (this._rangeTimer)
            clearTimeout(this._rangeTimer);
        this._rangeTimer = setTimeout(() => {
            this._rangeTimer = null;
            this._rangePreview = null;
            this._request();
        }, RANGE_PREVIEW_HOLD_MS);
        this._request();
    }
    // ---- Sync
    _request() {
        this._dirty = true;
        if (this._syncing)
            return;
        void this._drain();
    }
    async _drain() {
        this._syncing = true;
        try {
            while (this._dirty) {
                this._dirty = false;
                try {
                    await this._sync();
                }
                catch {
                    // A failed command leaves stale previews; the next change redraws.
                }
            }
        }
        finally {
            this._syncing = false;
        }
    }
    _guidesOn(frame) {
        return (this._hovered === frame.id ||
            this._selection.has(frame.id) ||
            (this._active?.id === frame.id && this._active.playing) ||
            this._rangePreview === frame.id);
    }
    _playheadOn(frame) {
        return (this._hovered === frame.id ||
            this._selection.has(frame.id) ||
            this._active?.id === frame.id ||
            this._scrub?.frameId === frame.id);
    }
    /** Where a frame's playhead sits: the drag position while dragging, else playback. */
    _progressOf(frame) {
        if (this._scrub?.frameId === frame.id)
            return this._scrub.progress;
        return this._active?.id === frame.id ? this._active.progress : 0;
    }
    async _sync() {
        const frames = this._frames.filter((frame) => !this._dragging.has(frame.id));
        const guides = [];
        const labels = [];
        const playheads = [];
        const hits = [];
        for (const frame of frames) {
            labels.push(...this._bar(frame));
            if (this._guidesOn(frame)) {
                guides.push(...this._ticks(frame));
                labels.push(...this._rulerLabels(frame), ...this._noteLabels(frame));
            }
            if (this._playheadOn(frame)) {
                playheads.push(...this._playhead(frame));
                hits.push(this._handleHit(frame));
            }
            if (frame.empty)
                labels.push(...this._emptyState(frame));
        }
        await Promise.all([
            this._guides.sync(guides),
            this._labels.sync(labels),
            this._playheads.sync(playheads),
            this._hits.sync(this._shield ? [...hits, this._shieldElement(this._shield)] : hits),
        ]);
    }
    // ---- Builders
    /**
     * Text is DOM on the canvas's widget layer, which scales it by zoom. Each
     * piece is laid out at its screen size inside a fixed box, then scaled by
     * `scale / zoom` about its top-left, so it lands at `scale` of its design
     * size, so text is never laid out at a tiny pre-zoom size.
     */
    _component(id, at, size, scale, schema) {
        const s = scale / this._zoom;
        const round = (v) => Math.round(v * 1000) / 1000;
        const dx = round((-size.width * (1 - s)) / 2);
        const dy = round((-size.height * (1 - s)) / 2);
        return {
            type: "component",
            drawdyElementId: id,
            x: at.x,
            y: at.y,
            width: size.width * s,
            height: size.height * s,
            schema: {
                type: "row",
                styles: {
                    width: [round(size.width), "px"],
                    height: [round(size.height), "px"],
                    overflow: "hidden",
                    // Transforms scale about the center; the translate keeps the top-left put.
                    transform: `translate(${dx}px, ${dy}px) scale(${round(s * 1e6) / 1e6})`,
                },
                children: [
                    // The host lines widgets up on their first baseline; a full-height
                    // box with no text puts it at the bottom, so nothing is pushed down.
                    { type: "box", styles: { width: [0, "px"], height: [round(size.height), "px"] } },
                    {
                        ...schema,
                        styles: {
                            ...schema.styles,
                            width: [round(size.width), "px"],
                            height: [round(size.height), "px"],
                        },
                    },
                ],
            },
        };
    }
    get _tertiary() {
        return `color-mix(in srgb, ${this._styling.foreground} ${TERTIARY_OPACITY * 100}%, transparent)`;
    }
    _rect(id, rect, fill, stroke, radius, seed) {
        return {
            type: "shape",
            drawdyElementId: id,
            componentType: "rect",
            ...rect,
            fillColor: fill,
            strokeColor: stroke,
            strokeWidth: 1 / this._zoom,
            cornerRadius: radius,
            roughness: 0,
            seed,
        };
    }
    _ticks(frame) {
        const zoom = this._zoom;
        const { x, y, width } = frame.rect;
        return rulerTicks(width, this._settings.pxPerSecond, zoom).map((tick, index) => ({
            type: "line",
            drawdyElementId: `${this._id("tick", frame.id)}:${index}`,
            color: this._styling.mutedForeground,
            strokeWidth: 1 / zoom,
            roughness: 0,
            seed: 41 + index,
            opacity: tick.major ? 0.6 : 0.35,
            from: [x + tick.x, y],
            to: [x + tick.x, y + (tick.major ? BOARD.majorTick : BOARD.minorTick) / zoom],
        }));
    }
    _rulerLabels(frame) {
        const zoom = this._zoom;
        const { x, y, width } = frame.rect;
        const labeled = rulerTicks(width, this._settings.pxPerSecond, zoom).filter((tick) => tick.label !== null);
        if (labeled.length === 0)
            return [];
        const screenWidth = width * zoom;
        const children = [];
        let cursor = 0;
        labeled.forEach((tick, index) => {
            const start = Math.round(tick.x * zoom + BOARD.tickLabelInset);
            const next = labeled[index + 1];
            const end = next ? Math.round(next.x * zoom + BOARD.tickLabelInset) : screenWidth;
            children.push({ type: "box", styles: { width: [start - cursor, "px"], height: [1, "px"] } });
            children.push({
                type: "text",
                child: tick.label ?? "",
                styles: { width: [end - start, "px"], fontSize: [11, "px"], color: this._tertiary },
            });
            cursor = end;
        });
        return [
            this._component(this._id("ruler-labels", frame.id), { x, y: y + BOARD.tickLabelTop / zoom }, { width: screenWidth, height: LABEL_BOX }, 1, { type: "row", children }),
        ];
    }
    _noteLabels(frame) {
        const zoom = this._zoom;
        const { lowOctave, highOctave, stepsPerOctave } = this._settings;
        const labels = noteLabels(frame.rect, lowOctave, highOctave, stepsPerOctave, zoom);
        if (labels.length === 0)
            return [];
        const children = [];
        let cursor = 0;
        for (const label of labels) {
            const top = Math.round((label.top - frame.rect.y) * zoom);
            if (top > cursor)
                children.push({ type: "box", styles: { width: [1, "px"], height: [top - cursor, "px"] } });
            children.push({
                type: "text",
                child: label.label,
                styles: { height: [BOARD.noteLineHeight, "px"], fontSize: [11, "px"], color: this._tertiary },
            });
            cursor = top + BOARD.noteLineHeight;
        }
        return [
            this._component(this._id("note-labels", frame.id), { x: frame.rect.x + BOARD.noteInset / zoom, y: frame.rect.y }, { width: 40, height: Math.max(LABEL_BOX, cursor) }, 1, { type: "column", children }),
        ];
    }
    _playhead(frame) {
        const zoom = this._zoom;
        const { x, y, width, height } = frame.rect;
        const active = this._active?.id === frame.id ? this._active : null;
        const scrubbing = this._scrub?.frameId === frame.id;
        const progress = this._progressOf(frame);
        const px = x + progress * width;
        const grow = scrubbing || this._handleHover === frame.id ? HANDLE_ACTIVE_SCALE : 1;
        const w = (BOARD.handleWidth * grow) / zoom;
        const h = (BOARD.handleHeight * grow) / zoom;
        // Grow about the handle's resting center.
        const top = y + (BOARD.handleHeight / 2 - BOARD.handleAbove) / zoom - h / 2;
        const mid = top + h / 2;
        const grip = (3 * grow) / zoom;
        const idle = !scrubbing && (!active || (!active.playing && progress === 0));
        const gripLine = (part, dx, seed) => ({
            type: "line",
            drawdyElementId: this._id(part, frame.id),
            color: this._styling.primary,
            strokeWidth: 1.5 / zoom,
            roughness: 0,
            seed,
            from: [px + dx, mid - grip],
            to: [px + dx, mid + grip],
        });
        return [
            this._rect(this._id("playhead-handle", frame.id), { x: px - w / 2, y: top, width: w, height: h }, this._styling.background, this._styling.border, w / 2, 61),
            gripLine("playhead-grip-a", -1.5 / zoom, 62),
            gripLine("playhead-grip-b", 1.5 / zoom, 63),
            {
                type: "line",
                drawdyElementId: this._id("playhead-line", frame.id),
                color: this._styling.primary,
                strokeWidth: 2 / zoom,
                roughness: 0,
                seed: 64,
                opacity: idle ? IDLE_PLAYHEAD_OPACITY : 1,
                from: [px, top + h],
                to: [px, y + height],
            },
        ];
    }
    _handleHit(frame) {
        const zoom = this._zoom;
        const centerX = frame.rect.x + this._progressOf(frame) * frame.rect.width;
        const centerY = frame.rect.y + (BOARD.handleHeight / 2 - BOARD.handleAbove) / zoom;
        const width = HANDLE_HIT.width / zoom;
        const height = HANDLE_HIT.height / zoom;
        return {
            ...this._rect(this._pointable(this._id("playhead-hit", frame.id)), { x: centerX - width / 2, y: centerY - height / 2, width, height }, this._styling.primary, "transparent", 0, 65),
            opacity: 0,
        };
    }
    _shieldElement(rect) {
        return {
            ...this._rect(this._pointable(`${this._ctx.driverId}:playhead-shield`), rect, this._styling.primary, "transparent", 0, 66),
            opacity: 0,
        };
    }
    _timeText(frame) {
        const duration = frame.rect.width / this._settings.pxPerSecond;
        const active = this._active?.id === frame.id ? this._active : null;
        const scrubbing = this._scrub?.frameId === frame.id;
        const progress = this._progressOf(frame);
        if (!scrubbing && (!active || (!active.playing && progress === 0))) {
            return formatClock(duration);
        }
        return `${formatClock(progress * duration)} / ${formatClock(duration)}`;
    }
    _bar(frame) {
        const zoom = this._zoom;
        const fit = fitBar(truncate(frame.name), this._timeText(frame), frame.rect.width * zoom, zoom);
        if (!fit)
            return [];
        const k = fit.scale;
        const s = this._styling;
        const children = [
            {
                type: "image",
                child: ICON_DATA_URI,
                styles: { width: [20, "px"], height: [20, "px"], borderRadius: [5, "px"] },
            },
        ];
        if (fit.name !== null) {
            children.push({
                type: "text",
                child: fit.name,
                styles: { fontSize: [13, "px"], fontWeight: "medium", color: s.foreground },
            });
        }
        if (fit.time !== null) {
            children.push({
                type: "text",
                child: fit.time,
                styles: { fontSize: [13, "px"], color: this._tertiary },
            });
        }
        return [
            this._component(this._id("bar", frame.id), {
                x: frame.rect.x,
                y: frame.rect.y - ((BOARD.barGap + BOARD.barHeight) * k) / zoom,
            }, { width: Math.ceil(fit.width / k), height: BOARD.barHeight }, k, {
                type: "row",
                // Click opens the panel on the frame; double-click renames it there.
                domId: this._clickable(`serene-bar-${frame.id}`),
                styles: {
                    pointerEvents: "auto",
                    cursor: "pointer",
                    padding: [8, "px"],
                    gap: 8,
                    crossAxisAlignment: "center",
                    backgroundColor: s.background,
                    borderColor: s.border,
                    borderWidth: [1, "px"],
                    borderRadius: [10, "px"],
                    // Interaction/Hover over the bar, kept opaque so the board
                    // never shows through.
                    hover: {
                        backgroundColor: `color-mix(in srgb, ${s.foreground} 6%, ${s.background})`,
                        borderColor: `color-mix(in srgb, ${s.foreground} 16%, ${s.background})`,
                    },
                },
                children,
            }),
        ];
    }
    _emptyState(frame) {
        const zoom = this._zoom;
        const k = barScale(zoom);
        const { x, y, width, height } = frame.rect;
        if (width * zoom < EMPTY_MIN_WIDTH * k || height * zoom < EMPTY_MIN_HEIGHT * k)
            return [];
        return [
            this._component(this._id("empty", frame.id), { x, y: y + height / 2 - (EMPTY_TEXT_HEIGHT * k) / 2 / zoom }, { width: Math.round((width * zoom) / k), height: EMPTY_TEXT_HEIGHT }, k, {
                type: "text",
                child: "Draw anywhere, then press play.",
                styles: { fontSize: [14, "px"], color: this._styling.mutedForeground, textAlign: "center" },
            }),
        ];
    }
}

const SERENE_META_KEY = "serene";
// Asks Drawdy to skip its own name chip; Serene draws the frame bar instead.
const HIDE_LABEL_META_KEY = "hideFrameLabel";
const FRAME_WIDTH = 960;
const FRAME_HEIGHT = 600;
const FRAME_GAP = 120;
const FLY_MS = 380;
const FLY_MAX_ZOOM = 0.8;
// Room around the frame so the frame bar above it stays in view.
const FLY_PADDING = 80;
const FRAME_PROPERTIES = [
    "type",
    "meta",
    "x",
    "y",
    "width",
    "height",
];
function isSereneFrame(el) {
    if (el.type !== "frame")
        return false;
    const marker = el.meta?.[SERENE_META_KEY];
    return marker === true || (typeof marker === "object" && marker !== null);
}
/**
 * Drivers cannot read or set a Drawdy frame's own name, so a Serene frame
 * keeps its name in its meta. Frames made before names existed have none.
 */
function storedFrameName(el) {
    const marker = el.meta?.[SERENE_META_KEY];
    if (typeof marker !== "object" || marker === null)
        return null;
    const name = marker.name;
    return typeof name === "string" && name.trim() !== "" ? name : null;
}
/** Unnamed frames take the first "Serene {n}" that no other frame uses. */
function frameNames(frames) {
    const stored = frames.map(storedFrameName);
    const taken = new Set(stored.filter((name) => name !== null));
    let n = 1;
    return stored.map((name) => {
        if (name !== null)
            return name;
        while (taken.has(`Serene ${n}`))
            n++;
        const picked = `Serene ${n}`;
        taken.add(picked);
        return picked;
    });
}
/** "Serene {n}": the first unused number, starting at frame count + 1. */
function nextFrameName(frames) {
    const taken = new Set(frameNames(frames));
    let n = frames.length + 1;
    while (taken.has(`Serene ${n}`))
        n++;
    return `Serene ${n}`;
}
function sereneFrameSchema(id, origin, name) {
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
function pad(rect, amount) {
    return {
        x: rect.x - amount,
        y: rect.y - amount,
        width: rect.width + amount * 2,
        height: rect.height + amount * 2,
    };
}
async function framesWith(ctx, drawdyElementIds) {
    const { drawdyElements } = unwrap(await ctx.issueCommand({
        type: "command:scene:get-drawdy-elements",
        ...stamp(ctx),
        req: { properties: FRAME_PROPERTIES, drawdyElementIds },
    }));
    return drawdyElements.filter(isSereneFrame);
}
async function listSereneFrames(ctx) {
    return framesWith(ctx);
}
async function sereneFramesAmong(ctx, ids) {
    if (ids.length === 0)
        return [];
    return framesWith(ctx, ids);
}
/**
 * Frames made before names and the Serene bar existed: store the name they are
 * listed under, so it cannot shift as frames come and go, and hide Drawdy's chip.
 */
async function migrateFrames(ctx, frames, names) {
    const updates = frames
        .map((frame, index) => ({ frame, name: names[index] }))
        .filter(({ frame }) => frame.meta?.[HIDE_LABEL_META_KEY] !== true || storedFrameName(frame) === null)
        .map(({ frame, name }) => ({
        drawdyElementId: frame.id,
        properties: {
            meta: { [SERENE_META_KEY]: { name }, [HIDE_LABEL_META_KEY]: true },
        },
    }));
    if (updates.length === 0)
        return;
    await ctx.issueCommand({
        type: "command:scene:update-drawdy-elements",
        ...stamp(ctx),
        req: { updates },
    });
}
async function viewportCenter(ctx) {
    const { rect } = unwrap(await ctx.issueCommand({
        type: "command:camera:get-viewport-rect",
        ...stamp(ctx),
    }));
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}
/** Right of the rightmost Serene frame, level with it; centered in view when there is none. */
async function nextFrameOrigin(ctx, frames) {
    let rightmost = null;
    for (const frame of frames) {
        const bounds = elementBounds(frame);
        if (!bounds)
            continue;
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
async function flyToFrame(ctx, rect) {
    unwrap(await ctx.issueCommand({
        type: "command:camera:fly-to-rect",
        ...stamp(ctx),
        req: {
            rect: pad(rect, FLY_PADDING),
            flyDurationMs: FLY_MS,
            zoom: FLY_MAX_ZOOM,
        },
    }));
}
const MAX_FRAME_NAME = 60;
async function renameFrame(ctx, id, name) {
    unwrap(await ctx.issueCommand({
        type: "command:scene:update-drawdy-elements",
        ...stamp(ctx),
        req: {
            updates: [
                { drawdyElementId: id, properties: { meta: { [SERENE_META_KEY]: { name } } } },
            ],
        },
    }));
}
async function selectFrame(ctx, id) {
    unwrap(await ctx.issueCommand({
        type: "command:scene:set-selection",
        ...stamp(ctx),
        req: { drawdyElementIds: [id] },
    }));
}
async function selectAndFlyTo(ctx, id) {
    const [frame] = await sereneFramesAmong(ctx, [id]);
    const bounds = frame ? elementBounds(frame) : null;
    if (!bounds)
        return;
    unwrap(await ctx.issueCommand({
        type: "command:scene:set-selection",
        ...stamp(ctx),
        req: { drawdyElementIds: [id] },
    }));
    await flyToFrame(ctx, bounds);
}
async function addSereneFrame(ctx) {
    const frames = await listSereneFrames(ctx);
    const origin = await nextFrameOrigin(ctx, frames);
    const id = ctx.generateId();
    unwrap(await ctx.issueCommand({
        type: "command:scene:add-drawdy-elements",
        ...stamp(ctx),
        req: {
            elements: [sereneFrameSchema(id, origin, nextFrameName(frames))],
        },
    }));
    unwrap(await ctx.issueCommand({
        type: "command:scene:set-selection",
        ...stamp(ctx),
        req: { drawdyElementIds: [id] },
    }));
    await flyToFrame(ctx, {
        ...origin,
        width: FRAME_WIDTH,
        height: FRAME_HEIGHT,
    });
    return id;
}

/** Sweep rate at Speed 1.0x, the original default rate. */
const BASE_PX_PER_SECOND = 220;
const DEFAULT_SCORE_OPTIONS = {
    pxPerSecond: BASE_PX_PER_SECOND,
    stepsPerSecond: 8,
    maxVoices: 5,
    scale: DEFAULT_SCALE_ID,
    lowOctave: DEFAULT_RANGE.lowOctave,
    highOctave: DEFAULT_RANGE.highOctave,
    backing: null,
};
const MIN_PX_PER_SECOND = 40;
const MAX_PX_PER_SECOND = 900;
const MIN_DURATION_SEC = 0.4;
const MAX_DURATION_SEC = 180;
const MAX_COLUMNS = 1024;
const MAX_SEGMENT_SAMPLES = 4096;
const MAX_PITCH_POINTS = 256;
const FULL_VELOCITY_HITS = 8;
const MIN_VELOCITY = 0.42;
function clampSpeed$1(pxPerSecond) {
    if (!isFinite(pxPerSecond))
        return DEFAULT_SCORE_OPTIONS.pxPerSecond;
    return Math.max(MIN_PX_PER_SECOND, Math.min(MAX_PX_PER_SECOND, pxPerSecond));
}
class Grid {
    _rect;
    columns;
    _scale;
    _range;
    cells;
    rows;
    constructor(_rect, columns, _scale, _range) {
        this._rect = _rect;
        this.columns = columns;
        this._scale = _scale;
        this._range = _range;
        this.rows = scaleRows(_scale, _range);
        this.cells = new Array(columns * this.rows).fill(0);
    }
    get colWidth() {
        return this._rect.width / this.columns;
    }
    get rowHeight() {
        return this._rect.height / this.rows;
    }
    locate(x, y) {
        const { _rect: rect } = this;
        if (x < rect.x ||
            x > rect.x + rect.width ||
            y < rect.y ||
            y > rect.y + rect.height) {
            return null;
        }
        const column = Math.max(0, Math.min(this.columns - 1, Math.floor((x - rect.x) / this.colWidth)));
        return {
            column,
            row: yToRow(this._scale, this._range, y, rect.y, rect.height),
        };
    }
    hit(cell) {
        this.cells[cell.column * this.rows + cell.row]++;
    }
    hitsAt(cell) {
        return this.cells[cell.column * this.rows + cell.row];
    }
}
function walkRun(run, grid, sampleStep, onCell) {
    for (let i = 1; i < run.length; i++) {
        const [ax, ay] = run[i - 1];
        const [bx, by] = run[i];
        const length = Math.hypot(bx - ax, by - ay);
        const samples = Math.max(1, Math.min(MAX_SEGMENT_SAMPLES, Math.ceil(length / sampleStep)));
        for (let s = i === 1 ? 0 : 1; s <= samples; s++) {
            const t = s / samples;
            onCell(grid.locate(ax + (bx - ax) * t, ay + (by - ay) * t));
        }
    }
}
function groupByColumn(cells) {
    const groups = [];
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
function decimate(pitches) {
    if (pitches.length <= MAX_PITCH_POINTS)
        return pitches;
    return evenPick(pitches, MAX_PITCH_POINTS);
}
const GLISSANDO_MIN_ROWS = 3;
function dominantRow(group, grid) {
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
function snapShallowColumns(groups, grid) {
    return groups.map((group) => group.rows.length >= GLISSANDO_MIN_ROWS
        ? group
        : { column: group.column, rows: [dominantRow(group, grid)] });
}
function runBounds(run) {
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
function splitIntoNotes(voice, stepSec) {
    if (voice.pitches.length <= 1)
        return [voice];
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
            backing: false,
            arp: false,
            pitches: [{ t: 0, row: pitch.row }],
        };
    });
}
function toVoice(groups, grid, stepSec, gain, glide) {
    if (groups.length === 0)
        return null;
    const firstColumn = groups[0].column;
    const lastColumn = groups[groups.length - 1].column;
    const startSec = firstColumn * stepSec;
    const pitches = [];
    let peak = 0;
    for (const group of groups) {
        const slots = group.rows.length;
        group.rows.forEach((row, index) => {
            peak = Math.max(peak, grid.hitsAt({ column: group.column, row }));
            const at = (group.column + index / slots) * stepSec - startSec;
            const previous = pitches[pitches.length - 1];
            if (previous && previous.row === row)
                return;
            pitches.push({ t: Math.max(0, at), row });
        });
    }
    if (pitches.length === 0)
        return null;
    return {
        startSec,
        durationSec: (lastColumn + 1) * stepSec - startSec,
        column: firstColumn,
        glide,
        backing: false,
        arp: false,
        velocity: gain *
            (MIN_VELOCITY +
                (1 - MIN_VELOCITY) * Math.min(1, peak / FULL_VELOCITY_HITS)),
        pitches: decimate(pitches),
    };
}
function buildVoices(ink, grid, stepSec, maxVoices) {
    const sampleStep = Math.max(0.5, Math.min(grid.colWidth, grid.rowHeight) / 2);
    const strands = [];
    for (const { points, gain, glide } of ink) {
        if (gain <= 0)
            continue;
        for (const run of monotonicRuns(points)) {
            const bounds = runBounds(run);
            if (bounds.width < grid.colWidth && bounds.height < grid.rowHeight) {
                const dot = grid.locate(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
                if (dot) {
                    grid.hit(dot);
                    strands.push({ cells: [dot], gain, glide });
                }
                continue;
            }
            let pending = [];
            const flush = () => {
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
        .map((strand) => toVoice(snapShallowColumns(groupByColumn(strand.cells), grid), grid, stepSec, strand.gain, strand.glide))
        .filter((voice) => voice !== null)
        .flatMap((voice) => voice.glide ? [voice] : splitIntoNotes(voice, stepSec));
    const byColumn = new Map();
    for (const voice of voices) {
        const bucket = byColumn.get(voice.column);
        if (bucket)
            bucket.push(voice);
        else
            byColumn.set(voice.column, [voice]);
    }
    const kept = [];
    for (const bucket of byColumn.values()) {
        bucket.sort((a, b) => a.pitches[0].row - b.pitches[0].row);
        kept.push(...evenPick(bucket, maxVoices));
    }
    kept.sort((a, b) => a.startSec - b.startSec || a.pitches[0].row - b.pitches[0].row);
    return kept;
}
function buildScore(rect, ink, options = {}) {
    const { pxPerSecond, stepsPerSecond, maxVoices, scale, lowOctave, highOctave, backing, } = { ...DEFAULT_SCORE_OPTIONS, ...options };
    const resolved = getScale(scale);
    const range = normalizeRange(lowOctave, highOctave);
    const speed = clampSpeed$1(pxPerSecond);
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    const durationSec = Math.max(MIN_DURATION_SEC, Math.min(MAX_DURATION_SEC, width / speed));
    const columns = Math.max(1, Math.min(MAX_COLUMNS, Math.round(durationSec * stepsPerSecond)));
    const stepSec = durationSec / columns;
    const normalized = { x: rect.x, y: rect.y, width, height };
    const grid = new Grid(normalized, columns, resolved, range);
    const voices = buildVoices(ink, grid, stepSec, maxVoices);
    if (backing) {
        for (const hit of backingHits(resolved, width, durationSec, backing)) {
            voices.push({
                startSec: hit.startSec,
                durationSec: hit.durationSec,
                column: Math.floor(hit.startSec / stepSec + 1e-6),
                velocity: hit.velocity,
                glide: false,
                backing: true,
                arp: hit.arp,
                pitches: [{ t: 0, row: 0, midi: hit.midi }],
            });
        }
        voices.sort((a, b) => a.startSec - b.startSec);
    }
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

const INK_PROPERTIES = [
    "type",
    "componentType",
    "x",
    "y",
    "width",
    "height",
    "points",
    "rotation",
    "opacity",
];
const STAGE_TOLERANCE = 1;
function encloses(outer, inner) {
    return (inner.x >= outer.x - STAGE_TOLERANCE &&
        inner.y >= outer.y - STAGE_TOLERANCE &&
        inner.x + inner.width <= outer.x + outer.width + STAGE_TOLERANCE &&
        inner.y + inner.height <= outer.y + outer.height + STAGE_TOLERANCE);
}
function dropStageElements(elements, stageIds) {
    const stage = new Set(stageIds);
    const content = elements.filter((el) => !stage.has(el.id));
    if (content.length === 0)
        return elements;
    const contentRects = content
        .map(elementBounds)
        .filter((r) => r !== null);
    return elements.filter((el) => {
        if (!stage.has(el.id))
            return true;
        const bounds = elementBounds(el);
        if (!bounds)
            return true;
        return !contentRects.every((inner) => encloses(bounds, inner));
    });
}
async function elementsInRect(ctx, rect, properties) {
    const { drawdyElements } = unwrap(await ctx.issueCommand({
        type: "command:scene:query-rect",
        ...stamp(ctx),
        req: { rect, properties },
    }));
    return drawdyElements;
}
async function elementsByIds(ctx, drawdyElementIds, properties) {
    const { drawdyElements } = unwrap(await ctx.issueCommand({
        type: "command:scene:get-drawdy-elements",
        ...stamp(ctx),
        req: { properties, drawdyElementIds },
    }));
    return drawdyElements;
}
function boundsUnion(elements) {
    const rects = elements
        .map(elementBounds)
        .filter((r) => r !== null);
    return combineRects(rects);
}
async function seedFrameIds(ctx, explicit) {
    if (explicit.length > 0)
        return explicit;
    const { drawdyElementIds } = unwrap(await ctx.issueCommand({
        type: "command:scene:get-current-selected-drawdy-elements",
        ...stamp(ctx),
    }));
    if (drawdyElementIds.length === 0)
        return [];
    const selected = await elementsByIds(ctx, drawdyElementIds, FRAME_PROPERTIES);
    return selected.filter(isSereneFrame).map((el) => el.id);
}
async function resolveRegion(ctx, explicit) {
    const stageIds = await seedFrameIds(ctx, explicit);
    if (stageIds.length === 0)
        return null;
    const frames = await elementsByIds(ctx, stageIds, FRAME_PROPERTIES);
    const rect = boundsUnion(frames);
    if (!rect || rect.width <= 0 || rect.height <= 0)
        return null;
    return { rect, stageIds };
}
async function resolveTarget(ctx, explicit = []) {
    const region = await resolveRegion(ctx, explicit);
    if (!region)
        return null;
    const inRegion = (await elementsInRect(ctx, region.rect, INK_PROPERTIES)).filter((el) => el.type !== "frame");
    const elements = dropStageElements(inRegion, region.stageIds);
    return { rect: region.rect, frameIds: region.stageIds, elements };
}

// Thumbnails are drawn in a viewBox this wide, height following the frame.
const THUMB_WIDTH = 160;
const MAX_THUMB_STROKES = 60;
const MAX_THUMB_POINTS = 48;
const THUMB_PROPERTIES = [...INK_PROPERTIES, "strokeColor"];
// Only plain color syntax reaches the panel's markup.
const SAFE_COLOR = /^(#[0-9a-f]{3,8}|(rgba?|hsla?|oklch|oklab|lab|lch)\([\d\s.,%/-]+\)|[a-z]+)$/i;
function thumbPath(points, rect, scale) {
    const picked = points.length > MAX_THUMB_POINTS ? evenPick(points, MAX_THUMB_POINTS) : points;
    return picked
        .map(([x, y], index) => {
        const tx = ((x - rect.x) * scale).toFixed(1);
        const ty = ((y - rect.y) * scale).toFixed(1);
        return `${index === 0 ? "M" : "L"}${tx} ${ty}`;
    })
        .join("");
}
async function thumbStrokes(ctx, frameId, rect) {
    const { drawdyElements } = unwrap(await ctx.issueCommand({
        type: "command:scene:query-rect",
        ...stamp(ctx),
        req: { rect, properties: THUMB_PROPERTIES },
    }));
    const elements = dropStageElements(drawdyElements.filter((el) => el.type !== "frame"), [frameId]);
    const scale = THUMB_WIDTH / Math.max(1, rect.width);
    const strokes = [];
    for (const el of elements) {
        const color = typeof el.strokeColor === "string" && SAFE_COLOR.test(el.strokeColor)
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
async function frameSummaries(ctx) {
    const frames = await listSereneFrames(ctx);
    const names = frameNames(frames);
    void migrateFrames(ctx, frames, names).catch(() => undefined);
    const summaries = await Promise.all(frames.map(async (frame, index) => {
        const rect = elementBounds(frame);
        if (!rect || rect.width <= 0 || rect.height <= 0)
            return null;
        return {
            id: frame.id,
            name: names[index],
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            strokes: await thumbStrokes(ctx, frame.id, rect),
        };
    }));
    return summaries.filter((s) => s !== null);
}

const SETTINGS_KEY = "settings";
const MIN_SPEED = 0.5;
const MAX_SPEED = 2;
const SPEED_STEP = 0.05;
const DEFAULT_BACKING = {
    enabled: false,
    style: "pop",
    voicing: "full",
    rhythm: 1,
};
const DEFAULT_SETTINGS = {
    speed: 1,
    scale: DEFAULT_SCALE_ID,
    loop: false,
    lowOctave: DEFAULT_RANGE.lowOctave,
    highOctave: DEFAULT_RANGE.highOctave,
    attack: 0.02,
    notes: 0.8,
    backingLevel: 0.7,
    reverb: 0.38,
    backing: DEFAULT_BACKING,
};
function speedToPxPerSecond(speed) {
    return BASE_PX_PER_SECOND * speed;
}
function clampSpeed(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return DEFAULT_SETTINGS.speed;
    }
    // Before 1.4.1 speed was stored in px per second (40 to 900).
    const multiplier = value > MAX_SPEED * 4 ? value / BASE_PX_PER_SECOND : value;
    const clamped = Math.min(MAX_SPEED, Math.max(MIN_SPEED, multiplier));
    return Number((Math.round(clamped / SPEED_STEP) * SPEED_STEP).toFixed(2));
}
const VOICINGS = ["bass", "omit3", "full"];
const RHYTHMS = [1, 2, 4, ...ARP_PATTERNS];
// Before the named styles, backing was an index into each scale's own list.
const LEGACY_STYLES = {
    major: ["pop", "classic", "simple", null, "drone"],
    "major-pentatonic": ["pop", "classic", "simple", null, "drone"],
    dorian: ["pop", "simple", "classic"],
    mixolydian: ["simple", "classic"],
    lydian: ["pop", null, "simple", null, "drone"],
    japanese: ["drone"],
};
function isStyle(value) {
    return BACKING_STYLES.some((style) => style.id === value);
}
function sanitizeBacking(raw, scale, current = DEFAULT_BACKING) {
    if (typeof raw !== "object" || raw === null)
        return current;
    const record = raw;
    const legacy = typeof record.progression === "number" ? LEGACY_STYLES[scale][record.progression] : null;
    const wanted = isStyle(record.style) ? record.style : (legacy ?? current.style);
    // A style the scale has no progression for falls back to the first it has.
    const available = stylesFor(scale);
    const style = available.includes(wanted) ? wanted : available[0];
    const voicing = VOICINGS.includes(record.voicing)
        ? record.voicing
        : current.voicing;
    const rhythm = RHYTHMS.includes(record.rhythm)
        ? record.rhythm
        : current.rhythm;
    return {
        enabled: typeof record.enabled === "boolean" ? record.enabled : current.enabled,
        style,
        voicing,
        rhythm,
    };
}
const KNOB_RANGES = {
    attack: [0, 0.3],
    notes: [0, 1],
    backingLevel: [0, 1],
    reverb: [0, 1],
};
function clampNumber(value, min, max, fallback) {
    if (typeof value !== "number" || !Number.isFinite(value))
        return fallback;
    return Math.min(max, Math.max(min, value));
}
function sanitizeKnobs(raw, current) {
    const next = { ...current };
    for (const key of Object.keys(KNOB_RANGES)) {
        const [min, max] = KNOB_RANGES[key];
        next[key] = clampNumber(raw[key], min, max, current[key]);
    }
    return next;
}
function sanitizeSettings(raw) {
    const scale = typeof raw.scale === "string" ? getScale(raw.scale).id : DEFAULT_SETTINGS.scale;
    return {
        ...sanitizeKnobs(raw, DEFAULT_SETTINGS),
        speed: clampSpeed(raw.speed),
        scale,
        loop: raw.loop === true,
        ...normalizeRange(raw.lowOctave, raw.highOctave),
        backing: sanitizeBacking(raw.backing, scale),
    };
}
async function loadSettings(ctx) {
    try {
        const response = await ctx.issueCommand({
            type: "command:kv-storage:get",
            ...stamp(ctx),
            req: { key: SETTINGS_KEY },
        });
        if (response.res.error !== undefined || !response.res.value.got) {
            return DEFAULT_SETTINGS;
        }
        return sanitizeSettings(response.res.value.got);
    }
    catch {
        return DEFAULT_SETTINGS;
    }
}
function saveSettings(ctx, settings) {
    void ctx
        .issueCommand({
        type: "command:kv-storage:set",
        ...stamp(ctx),
        req: { key: SETTINGS_KEY, payload: settings },
    })
        .catch(() => undefined);
}

const EMPTY_REGION = { x: 0, y: 0, width: 1, height: 1 };
const REFRESH_DEBOUNCE_MS = 120;
const FRAME_LIST_DEBOUNCE_MS = 250;
class SereneSession {
    _ctx;
    _overlay;
    _styling;
    _score = null;
    _rect = null;
    _lines = [];
    _laser = [];
    _elementCount = 0;
    _settings = DEFAULT_SETTINGS;
    _pendingAutoplay = false;
    _frameIds = [];
    _playing = false;
    _refreshTimer = null;
    _frameListTimer = null;
    _panelOpened = false;
    _selection = [];
    _pendingRename = null;
    _pendingSpotlight = null;
    // A seek made before the panel has loaded; sent again once it is ready.
    _pendingSeek = null;
    constructor(_ctx, _overlay, _styling) {
        this._ctx = _ctx;
        this._overlay = _overlay;
        this._styling = _styling;
    }
    async restoreSettings() {
        this._settings = await loadSettings(this._ctx);
        this._syncOverlaySettings();
    }
    _updateSettings(patch) {
        this._settings = { ...this._settings, ...patch };
        saveSettings(this._ctx, this._settings);
        this._syncOverlaySettings();
    }
    _syncOverlaySettings() {
        this._overlay.setSettings({
            pxPerSecond: speedToPxPerSecond(this._settings.speed),
            lowOctave: this._settings.lowOctave,
            highOctave: this._settings.highOctave,
            stepsPerOctave: getScale(this._settings.scale).steps.length,
        });
    }
    postSettings() {
        postToPanel(this._ctx, { type: "settings", values: this._settings });
    }
    setStyling(styling) {
        this._styling = styling;
        this._overlay.setStyling(styling);
    }
    async openPanel() {
        this._panelOpened = true;
        await openPanel(this._ctx, this._styling);
    }
    async openFromRail() {
        await this.openPanel();
        this.postTheme();
        await this.postFrames();
    }
    async addFrame() {
        try {
            await addSereneFrame(this._ctx);
        }
        finally {
            await this.postFrames();
        }
    }
    async postFrames() {
        const frames = await frameSummaries(this._ctx);
        this._overlay.setFrames(frames.map((frame) => ({
            id: frame.id,
            name: frame.name,
            rect: { x: frame.x, y: frame.y, width: frame.width, height: frame.height },
            empty: frame.strokes.length === 0,
        })));
        if (!this._panelOpened)
            return;
        postToPanel(this._ctx, { type: "frames", frames });
    }
    /** Names, thumbnails and empty states follow the board; coalesce bursts of changes. */
    scheduleFrames() {
        if (this._frameListTimer)
            clearTimeout(this._frameListTimer);
        this._frameListTimer = setTimeout(() => {
            this._frameListTimer = null;
            void this.postFrames().catch(() => undefined);
        }, FRAME_LIST_DEBOUNCE_MS);
    }
    setSelection(ids) {
        this._selection = ids;
        this._overlay.setSelection(ids);
        if (!this._panelOpened)
            return;
        postToPanel(this._ctx, { type: "selection", ids });
    }
    postBacking() {
        postToPanel(this._ctx, {
            type: "backing",
            styles: backingStyles(this._settings.scale),
            value: this._settings.backing,
        });
    }
    postScales() {
        postToPanel(this._ctx, {
            type: "scales",
            scales: scaleOptions(),
            current: this._settings.scale,
        });
    }
    postTheme() {
        postToPanel(this._ctx, {
            type: "theme",
            css: stylingCssVars(this._styling),
        });
    }
    async _resolve(seedIds) {
        const target = await resolveTarget(this._ctx, seedIds);
        if (!target) {
            this._rect = null;
            this._frameIds = [];
            this._lines = [];
            this._elementCount = 0;
            this._score = buildScore(EMPTY_REGION, [], {
                scale: this._settings.scale,
            });
            return false;
        }
        this._rect = target.rect;
        this._frameIds = target.frameIds;
        this._elementCount = target.elements.length;
        this._lines = sceneInk(target.elements);
        this._rebuild();
        return true;
    }
    async play(seedIds = []) {
        const resolved = await this._resolve(seedIds);
        await this.openPanel();
        if (!resolved) {
            this._postScore(false);
            return;
        }
        this._postScore(true);
    }
    setLaser(strokes) {
        this._laser = laserInk(strokes);
        if (!this._rect)
            return;
        this._rebuild();
        this._postScore(false, true);
    }
    onSceneChanged(changed) {
        const rect = this._rect;
        if (!rect)
            return;
        const touches = changed.some((el) => {
            if (this._frameIds.includes(el.id))
                return true;
            const bounds = elementBounds(el);
            return bounds ? rectsOverlap(bounds, rect) : false;
        });
        if (!touches)
            return;
        if (this._refreshTimer)
            clearTimeout(this._refreshTimer);
        this._refreshTimer = setTimeout(() => {
            this._refreshTimer = null;
            void this._refresh();
        }, REFRESH_DEBOUNCE_MS);
    }
    async _refresh() {
        const resolved = await this._resolve(this._frameIds);
        if (!resolved) {
            if (this._playing)
                this.stop();
            this._postScore(false);
            return;
        }
        this._postScore(false, true);
    }
    stop() {
        postToPanel(this._ctx, { type: "stop" });
        this._overlay.setActive(null, false);
    }
    /**
     * Moves a frame's playback position. Another frame's score is loaded first,
     * without playing, so the next play starts from there.
     */
    async seekFrame(frameId, progress) {
        if (!this._score || this._frameIds[0] !== frameId) {
            if (!(await this._resolve([frameId])))
                return;
            this._postScore(false);
        }
        if (!this._score)
            return;
        this._pendingSeek = progress * this._score.durationSec;
        postToPanel(this._ctx, { type: "seek", t: this._pendingSeek });
    }
    async openForFrame(frameId) {
        await selectFrame(this._ctx, frameId);
        this._pendingSpotlight = frameId;
        await this.openPanel();
        this.postTheme();
        await this.postFrames();
        postToPanel(this._ctx, { type: "spotlight-frame", id: frameId });
    }
    /** Double-click on a frame bar: rename it in the panel's Frames list. */
    async editFrameName(frameId) {
        await selectFrame(this._ctx, frameId);
        // A panel opened just now has not loaded yet; "ready" sends this again.
        this._pendingRename = frameId;
        await this.openPanel();
        this.postTheme();
        await this.postFrames();
        postToPanel(this._ctx, { type: "edit-frame-name", id: frameId });
    }
    async onPanelMessage(message) {
        switch (message.type) {
            case "ready":
                this.postTheme();
                this.postSettings();
                this.postScales();
                this.postBacking();
                void this.postFrames();
                postToPanel(this._ctx, { type: "selection", ids: this._selection });
                if (this._pendingSpotlight) {
                    postToPanel(this._ctx, { type: "spotlight-frame", id: this._pendingSpotlight });
                    this._pendingSpotlight = null;
                }
                if (this._pendingRename) {
                    postToPanel(this._ctx, { type: "edit-frame-name", id: this._pendingRename });
                    this._pendingRename = null;
                }
                if (this._score) {
                    const autoplay = this._pendingAutoplay;
                    this._pendingAutoplay = false;
                    this._postScore(autoplay);
                    if (this._pendingSeek !== null && !autoplay) {
                        postToPanel(this._ctx, { type: "seek", t: this._pendingSeek });
                    }
                }
                this._pendingSeek = null;
                return;
            case "started":
                this._pendingAutoplay = false;
                this._pendingSeek = null;
                this._playing = true;
                this._overlay.setActive(this._frameIds[0] ?? null, true);
                return;
            case "progress":
                if (this._score && this._score.durationSec > 0) {
                    const progress = message.t / this._score.durationSec;
                    if (!this._playing) {
                        // Stop and end clear the playhead themselves; a fresh score's
                        // 0 would only flash it back before a seek lands.
                        if (progress === 0 || !this._frameIds[0])
                            return;
                        // A paused position (after a seek, say) holds the playhead there.
                        this._overlay.setActive(this._frameIds[0], false);
                    }
                    this._overlay.setProgress(progress);
                }
                return;
            case "paused":
                // The playhead holds where it stopped.
                this._playing = false;
                this._overlay.setActive(this._frameIds[0] ?? null, false);
                return;
            case "ended":
            case "stopped":
                this._playing = false;
                this._overlay.setActive(null, false);
                return;
            case "add-frame":
                await this.addFrame();
                return;
            case "rename-frame": {
                const name = typeof message.name === "string" ? message.name.trim().slice(0, MAX_FRAME_NAME) : "";
                if (!name)
                    return;
                await renameFrame(this._ctx, message.id, name);
                await this.postFrames();
                return;
            }
            case "focus-frame":
                await selectAndFlyTo(this._ctx, message.id);
                return;
            case "play-frame":
                await this.play([message.id]);
                return;
            case "range":
                this._updateSettings(normalizeRange(message.low, message.high, this._settings));
                this._overlay.previewRange();
                if (!this._rect)
                    return;
                this._rebuild();
                this._postScore(false, true);
                return;
            case "loop":
                this._updateSettings({ loop: message.value === true });
                return;
            case "knobs":
                this._updateSettings(sanitizeKnobs(message.values, this._settings));
                return;
            case "speed":
                this._updateSettings({ speed: clampSpeed(message.value) });
                if (!this._rect)
                    return;
                this._rebuild();
                this._postScore(false, true);
                return;
            case "scale": {
                const scale = getScale(message.value).id;
                // Each scale has its own progressions; keep the choice in range.
                this._updateSettings({
                    scale,
                    backing: sanitizeBacking(this._settings.backing, scale, this._settings.backing),
                });
                this.postBacking();
                if (!this._rect)
                    return;
                this._rebuild();
                this._postScore(false, true);
                return;
            }
            case "preview-backing": {
                const style = BACKING_STYLES.find((s) => s.id === message.style)?.id;
                if (!style)
                    return;
                const notes = backingPreview(getScale(this._settings.scale), {
                    ...this._settings.backing,
                    style,
                }).map((hit) => ({
                    t: hit.startSec,
                    d: hit.durationSec,
                    midi: hit.midi,
                    v: hit.velocity,
                    a: hit.arp,
                }));
                postToPanel(this._ctx, { type: "backing-preview", style, notes });
                return;
            }
            case "backing":
                this._updateSettings({
                    backing: sanitizeBacking(message.value, this._settings.scale, this._settings.backing),
                });
                if (!this._rect)
                    return;
                this._rebuild();
                this._postScore(false, true);
                return;
        }
    }
    _rebuild() {
        if (!this._rect)
            return;
        this._score = buildScore(this._rect, [...this._lines, ...this._laser], {
            pxPerSecond: speedToPxPerSecond(this._settings.speed),
            scale: this._settings.scale,
            lowOctave: this._settings.lowOctave,
            highOctave: this._settings.highOctave,
            backing: this._settings.backing.enabled ? this._settings.backing : null,
        });
    }
    _postScore(autoplay, live = false) {
        if (!this._score)
            return;
        if (autoplay)
            this._pendingAutoplay = true;
        postToPanel(this._ctx, {
            type: "score",
            score: serializeScore(this._score, this._elementCount, this._frameIds),
            autoplay,
            live,
        });
    }
}

const SCENE_CHANGE_SUBSCRIPTIONS = [
    "subscription:scene:elements-added",
    "subscription:scene:elements-removed",
    "subscription:scene:elements-updated",
    "subscription:scene:elements-replaced",
];
let driver = null;
function subscribeClick(ctx, domElementId) {
    void ctx
        .issueCommand({
        type: "subscription:dom:element-clicked",
        ...stamp(ctx),
        req: { domElementId },
    })
        .catch(() => undefined);
}
function subscribePointer(ctx, elementId) {
    void ctx
        .issueCommand({
        type: "subscription:scene:pointer",
        ...stamp(ctx),
        req: { elementIds: [elementId] },
    })
        .catch(() => undefined);
}
const DOUBLE_CLICK_MS = 400;
let lastBarClick = null;
const activate = async ({ manifest, issueCommand, generateId, styling, }) => {
    let requestId = 0;
    const ctx = {
        driverId: manifest.driverId,
        issueCommand,
        generateId,
        nextRequestId: () => String(requestId++),
    };
    const overlay = new FrameOverlay(ctx, styling, (domId) => subscribeClick(ctx, domId), (elementId) => subscribePointer(ctx, elementId));
    const session = new SereneSession(ctx, overlay, styling);
    driver = { ctx, session, overlay, styling };
    await session.restoreSettings();
    unwrap(await issueCommand({
        type: "command:dom:create-action-button",
        ...stamp(ctx),
        req: {
            domElementId: actionButtonId(ctx.driverId),
            svg: ACTION_BUTTON_SVG,
        },
    }));
    unwrap(await issueCommand({
        type: "subscription:dom:element-clicked",
        ...stamp(ctx),
        req: { domElementId: actionButtonId(ctx.driverId) },
    }));
    unwrap(await issueCommand({
        type: "subscription:webview:message",
        ...stamp(ctx),
        req: { webviewDomId: panelWebviewId(ctx.driverId) },
    }));
    for (const type of [
        "subscription:dom:theme-changed",
        "subscription:scene:pointer-position",
        "subscription:scene:drawdy-element-selection",
        "subscription:scene:drawdy-elements-dragged",
        "subscription:camera:moved-rapid",
        "subscription:tool:laser",
    ]) {
        unwrap(await issueCommand({ type, ...stamp(ctx) }));
    }
    for (const type of SCENE_CHANGE_SUBSCRIPTIONS) {
        unwrap(await issueCommand({
            type,
            ...stamp(ctx),
            req: { properties: FRAME_PROPERTIES },
        }));
    }
    const camera = unwrap(await issueCommand({ type: "command:camera:get-info", ...stamp(ctx) }));
    overlay.setZoom(camera.zoom);
    await syncSelection(ctx, session);
    await session.postFrames();
};
async function syncSelection(ctx, session) {
    const { drawdyElementIds } = unwrap(await ctx.issueCommand({
        type: "command:scene:get-current-selected-drawdy-elements",
        ...stamp(ctx),
    }));
    session.setSelection(drawdyElementIds);
}
const onEvent = async (event) => {
    if (!driver)
        return;
    const { ctx, session, overlay } = driver;
    switch (event.type) {
        case "subscription:scene:pointer-position": {
            const { x, y } = event.body.position.canvasSpace;
            overlay.setPointer(x, y);
            overlay.scrubTo(x);
            return;
        }
        case "subscription:scene:pointer": {
            // Dragging a playhead handle: it follows the pointer and playback
            // jumps to where it is released.
            const body = event.body;
            if (body.type === "cancel") {
                overlay.cancelScrub();
                overlay.setHandleHover(null);
                return;
            }
            const frameId = overlay.frameForHandle(body.drawdyElementIds);
            if (body.type === "down") {
                if (frameId)
                    await overlay.beginScrub(frameId, body.cursor.canvasSpace.x);
                return;
            }
            if (body.type === "up") {
                const landed = overlay.endScrub();
                if (landed)
                    await session.seekFrame(landed.frameId, landed.progress);
                return;
            }
            if (frameId)
                overlay.setHandleHover(body.type === "enter" ? frameId : null);
            return;
        }
        case "subscription:scene:drawdy-element-selection": {
            session.setSelection([...event.body.drawdyElementIds]);
            return;
        }
        case "subscription:scene:drawdy-elements-dragged": {
            // Only real movement hides a frame's overlay; see setDragging.
            if (event.body.type === "dragging")
                overlay.setDragging(event.body.drawdyElementIds);
            if (event.body.type === "dragEnd") {
                overlay.setDragging([]);
                session.scheduleFrames();
            }
            return;
        }
        case "subscription:scene:elements-added":
        case "subscription:scene:elements-removed":
        case "subscription:scene:elements-updated":
        case "subscription:scene:elements-replaced": {
            const changed = [
                ...event.body.drawdyElements,
                ...(event.type === "subscription:scene:elements-replaced"
                    ? event.body.replaced
                    : []),
            ];
            overlay.onSceneChanged(changed);
            session.scheduleFrames();
            session.onSceneChanged(changed);
            return;
        }
        case "subscription:tool:laser": {
            session.setLaser(event.body.lasers);
            return;
        }
        case "subscription:camera:moved-rapid": {
            overlay.setZoom(event.body.zoom);
            return;
        }
        case "subscription:dom:element-clicked": {
            const domId = event.body.domElementId;
            if (domId === actionButtonId(ctx.driverId)) {
                await session.openFromRail();
                return;
            }
            const barFrame = overlay.frameForBar(domId);
            if (!barFrame)
                return;
            const now = Date.now();
            const double = lastBarClick?.frameId === barFrame && now - lastBarClick.at < DOUBLE_CLICK_MS;
            lastBarClick = double ? null : { frameId: barFrame, at: now };
            if (double)
                await session.editFrameName(barFrame);
            else
                await session.openForFrame(barFrame);
            return;
        }
        case "subscription:webview:message": {
            if (event.body.webviewDomId !== panelWebviewId(ctx.driverId))
                return;
            const message = event.body.message;
            if (typeof message !== "object" || message === null)
                return;
            await session.onPanelMessage(message);
            return;
        }
        case "subscription:dom:theme-changed": {
            driver.styling = event.body.styling;
            session.setStyling(event.body.styling);
            session.postTheme();
            return;
        }
        default:
            return;
    }
};

exports.activate = activate;
exports.onEvent = onEvent;
