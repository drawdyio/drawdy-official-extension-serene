import {
    BOTTOM_MIDI,
    DEFAULT_SCALE_ID,
    OCTAVES,
    SCALES,
    getScale,
    midiToHz,
    rowNoteName,
    rowToHz,
    rowToMidi,
    scaleRows,
    yToRow,
} from "./pitch";

const pentatonic = getScale("major-pentatonic");

describe("scales", () => {
    it("offers every scale with a unique id and an ascending step set", () => {
        const ids = SCALES.map((scale) => scale.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const scale of SCALES) {
            expect(scale.steps[0]).toBe(0);
            expect(scale.steps[scale.steps.length - 1]).toBeLessThan(12);
            for (let i = 1; i < scale.steps.length; i++) {
                expect(scale.steps[i]).toBeGreaterThan(scale.steps[i - 1]);
            }
        }
    });

    it("covers the scales the panel offers", () => {
        expect(SCALES.map((scale) => scale.id)).toEqual([
            "major-pentatonic",
            "major",
            "dorian",
            "lydian",
            "mixolydian",
            "japanese",
        ]);
    });

    it("falls back to the default for an unknown id", () => {
        expect(getScale("nonsense").id).toBe(DEFAULT_SCALE_ID);
    });

    it("names the modes by their defining degrees", () => {
        expect(getScale("major").steps).toEqual([0, 2, 4, 5, 7, 9, 11]);
        expect(getScale("dorian").steps).toEqual([0, 2, 3, 5, 7, 9, 10]);
        expect(getScale("lydian").steps).toEqual([0, 2, 4, 6, 7, 9, 11]);
        expect(getScale("mixolydian").steps).toEqual([0, 2, 4, 5, 7, 9, 10]);
        expect(getScale("japanese").steps).toEqual([0, 2, 3, 7, 8]);
    });
});

describe("pitch", () => {
    it("spans C4 to C7 in every scale", () => {
        for (const scale of SCALES) {
            const rows = scaleRows(scale);
            expect(rows).toBe(scale.steps.length * OCTAVES + 1);
            expect(rowToMidi(scale, 0)).toBe(BOTTOM_MIDI);
            expect(rowToMidi(scale, rows - 1)).toBe(BOTTOM_MIDI + 12 * OCTAVES);
            expect(rowNoteName(scale, 0)).toBe("C4");
            expect(rowNoteName(scale, rows - 1)).toBe("C7");
        }
    });

    it("only produces degrees of its own scale", () => {
        for (const scale of SCALES) {
            const degrees = new Set<number>();
            for (let row = 0; row < scaleRows(scale); row++) {
                degrees.add((rowToMidi(scale, row) - BOTTOM_MIDI) % 12);
            }
            expect([...degrees].sort((a, b) => a - b)).toEqual(scale.steps);
        }
    });

    it("rises monotonically", () => {
        for (const scale of SCALES) {
            for (let row = 1; row < scaleRows(scale); row++) {
                expect(rowToHz(scale, row)).toBeGreaterThan(
                    rowToHz(scale, row - 1)
                );
            }
        }
    });

    it("tunes A4 to 440 and C4 to concert pitch", () => {
        expect(midiToHz(69)).toBeCloseTo(440, 6);
        expect(rowToHz(pentatonic, 0)).toBeCloseTo(261.6256, 3);
    });

    it("maps the bottom of a region to the lowest row", () => {
        for (const scale of SCALES) {
            const rows = scaleRows(scale);
            expect(yToRow(scale, 100, 0, 100)).toBe(0);
            expect(yToRow(scale, 0, 0, 100)).toBe(rows - 1);
            expect(yToRow(scale, 50, 0, 100)).toBe(Math.floor(rows / 2));
        }
    });

    it("clamps out-of-region values", () => {
        expect(yToRow(pentatonic, -500, 0, 100)).toBe(
            scaleRows(pentatonic) - 1
        );
        expect(yToRow(pentatonic, 500, 0, 100)).toBe(0);
    });
});
