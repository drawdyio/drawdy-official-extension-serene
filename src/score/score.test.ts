import { Polyline, Rect, monotonicRuns } from "./geometry";
import {
    BOTTOM_MIDI,
    DEFAULT_SCALE_ID,
    SCALES,
    getScale,
    rowToMidi,
    scaleRows,
} from "./pitch";
import {
    MAX_PX_PER_SECOND,
    MIN_PX_PER_SECOND,
    Voice,
    buildScore,
    clampSpeed,
    playheadX,
} from "./score";

const rect: Rect = { x: 0, y: 0, width: 880, height: 320 };

const ROWS = scaleRows(getScale(DEFAULT_SCALE_ID));

const horizontal = (y: number): Polyline => [
    [10, y],
    [870, y],
];

const rowsOf = (pitches: { row: number }[]): number[] =>
    pitches.map((p) => p.row);

describe("monotonicRuns", () => {
    it("keeps a left-to-right stroke whole", () => {
        const line: Polyline = [
            [0, 0],
            [5, 3],
            [9, 1],
        ];
        expect(monotonicRuns(line)).toEqual([line]);
    });

    it("splits where the stroke doubles back", () => {
        const runs = monotonicRuns([
            [0, 0],
            [10, 0],
            [4, 8],
        ]);
        expect(runs).toHaveLength(2);
        expect(runs[1]).toEqual([
            [4, 8],
            [10, 0],
        ]);
    });

    it("orients every run left to right", () => {
        for (const run of monotonicRuns([
            [20, 0],
            [0, 5],
            [30, 9],
        ])) {
            expect(run[run.length - 1][0]).toBeGreaterThanOrEqual(run[0][0]);
        }
    });

    it("treats a vertical stroke as one run", () => {
        expect(
            monotonicRuns([
                [4, 0],
                [4, 10],
                [4, 20],
            ])
        ).toHaveLength(1);
    });
});

describe("buildScore", () => {
    it("runs the playhead at a constant rate, so wider regions last longer", () => {
        const narrow = buildScore({ ...rect, width: 400 }, [horizontal(160)], {
            pxPerSecond: 200,
        });
        const wide = buildScore({ ...rect, width: 800 }, [horizontal(160)], {
            pxPerSecond: 200,
        });
        expect(narrow.durationSec).toBeCloseTo(2, 6);
        expect(wide.durationSec).toBeCloseTo(4, 6);
    });

    it("turns a horizontal stroke into one voice holding one pitch", () => {
        const score = buildScore(rect, [horizontal(160)], { pxPerSecond: 220 });
        expect(score.voices).toHaveLength(1);
        expect(score.voices[0].pitches).toHaveLength(1);
        expect(score.voices[0].durationSec).toBeGreaterThan(
            score.durationSec * 0.8
        );
    });

    it("slides a connected diagonal instead of retriggering it", () => {
        const score = buildScore(
            rect,
            [
                [
                    [5, 315],
                    [875, 5],
                ],
            ],
            { pxPerSecond: 220 }
        );
        expect(score.voices).toHaveLength(1);
        const [voice] = score.voices;
        const rows = rowsOf(voice.pitches);
        expect(rows.length).toBeGreaterThan(4);
        expect(rows[0]).toBe(0);
        expect(rows[rows.length - 1]).toBe(ROWS - 1);
        for (let i = 1; i < rows.length; i++) {
            expect(rows[i]).toBeGreaterThan(rows[i - 1]);
        }
    });

    it("keeps pitch changes inside the voice, ordered and within its span", () => {
        const [voice] = buildScore(rect, [
            [
                [5, 315],
                [875, 5],
            ],
        ]).voices;
        expect(voice.pitches[0].t).toBe(0);
        for (let i = 1; i < voice.pitches.length; i++) {
            expect(voice.pitches[i].t).toBeGreaterThan(
                voice.pitches[i - 1].t
            );
        }
        const last = voice.pitches[voice.pitches.length - 1];
        expect(last.t).toBeLessThan(voice.durationSec);
    });

    it("starts a separate voice for each disconnected stroke", () => {
        const score = buildScore(rect, [horizontal(60), horizontal(260)], {});
        expect(score.voices).toHaveLength(2);
        expect(score.voices[0].pitches[0].row).not.toBe(
            score.voices[1].pitches[0].row
        );
    });

    it("splits a stroke that doubles back into one voice per direction", () => {
        const score = buildScore(
            rect,
            [
                [
                    [10, 300],
                    [870, 300],
                    [10, 40],
                ],
            ],
            {}
        );
        expect(score.voices).toHaveLength(2);
        for (const voice of score.voices) {
            expect(voice.column).toBe(0);
        }
    });

    it("sweeps a vertical stroke through the rows within one column", () => {
        const score = buildScore(
            rect,
            [
                [
                    [400, 0],
                    [400, 320],
                ],
            ],
            {}
        );
        expect(score.voices).toHaveLength(1);
        const [voice] = score.voices;
        expect(voice.pitches.length).toBe(ROWS);
        expect(voice.durationSec).toBeCloseTo(score.stepSec, 6);
        for (const pitch of voice.pitches) {
            expect(pitch.t).toBeLessThan(voice.durationSec);
        }
    });

    it("puts the bottom of the region on the lowest row", () => {
        expect(buildScore(rect, [horizontal(319)], {}).voices[0].pitches[0].row).toBe(0);
        expect(
            buildScore(rect, [horizontal(1)], {}).voices[0].pitches[0].row
        ).toBe(ROWS - 1);
    });

    it("caps voices starting together while keeping the outer ones", () => {
        const lines: Polyline[] = [];
        for (let i = 0; i < 10; i++) {
            lines.push(horizontal(10 + i * 34));
        }
        const score = buildScore(rect, lines, { maxVoices: 4 });
        expect(score.voices).toHaveLength(4);
        expect(score.voices[0].pitches[0].row).toBe(0);
        expect(score.voices[3].pitches[0].row).toBe(ROWS - 1);
    });

    it("breaks a voice where the stroke leaves the region", () => {
        const score = buildScore(
            rect,
            [
                [
                    [10, 160],
                    [300, 160],
                    [300, -400],
                    [600, -400],
                    [600, 160],
                    [870, 160],
                ],
            ],
            {}
        );
        expect(score.voices.length).toBeGreaterThanOrEqual(2);
    });

    it("ignores ink outside the region", () => {
        const outside: Polyline = [
            [-500, -500],
            [-100, -500],
        ];
        expect(buildScore(rect, [outside], {}).voices).toHaveLength(0);
    });

    it("keeps voices sorted by onset", () => {
        const score = buildScore(
            rect,
            [horizontal(60), [[440, 20], [870, 300]]],
            {}
        );
        for (let i = 1; i < score.voices.length; i++) {
            expect(score.voices[i].startSec).toBeGreaterThanOrEqual(
                score.voices[i - 1].startSec
            );
        }
    });

    it("sizes the cell grid to the column count", () => {
        const score = buildScore(rect, [horizontal(160)], {});
        expect(score.cells).toHaveLength(score.columns * ROWS);
        expect(score.rows).toBe(ROWS);
    });
});

describe("scale selection", () => {
    it("resizes the pitch grid to the chosen scale", () => {
        for (const scale of SCALES) {
            const score = buildScore(rect, [horizontal(160)], {
                scale: scale.id,
            });
            expect(score.scale.id).toBe(scale.id);
            expect(score.rows).toBe(scaleRows(scale));
            expect(score.cells).toHaveLength(score.columns * score.rows);
        }
    });

    it("keeps every sounding pitch inside the chosen scale", () => {
        const diagonal: Polyline = [
            [5, 315],
            [875, 5],
        ];
        for (const scale of SCALES) {
            const score = buildScore(rect, [diagonal], { scale: scale.id });
            for (const voice of score.voices) {
                for (const pitch of voice.pitches) {
                    const degree =
                        (rowToMidi(score.scale, pitch.row) - BOTTOM_MIDI) % 12;
                    expect(scale.steps).toContain(degree);
                }
            }
        }
    });

    it("gives a seven-note scale more steps up the same diagonal than a pentatonic one", () => {
        const diagonal: Polyline = [
            [5, 315],
            [875, 5],
        ];
        const penta = buildScore(rect, [diagonal], {
            scale: "major-pentatonic",
        });
        const lydian = buildScore(rect, [diagonal], { scale: "lydian" });
        expect(lydian.voices[0].pitches.length).toBeGreaterThan(
            penta.voices[0].pitches.length
        );
    });

    it("falls back to the default scale for an unknown id", () => {
        const score = buildScore(rect, [horizontal(160)], {
            scale: "nonsense" as never,
        });
        expect(score.scale.id).toBe(DEFAULT_SCALE_ID);
    });
});

describe("playheadX", () => {
    it("sweeps from the left edge to the right edge", () => {
        const score = buildScore(rect, [horizontal(160)], {});
        expect(playheadX(score, 0)).toBeCloseTo(rect.x, 6);
        expect(playheadX(score, score.durationSec)).toBeCloseTo(
            rect.x + rect.width,
            6
        );
        expect(playheadX(score, -5)).toBeCloseTo(rect.x, 6);
        expect(playheadX(score, 1e6)).toBeCloseTo(rect.x + rect.width, 6);
    });
});

describe("clampSpeed", () => {
    it("keeps the speed inside the usable range", () => {
        expect(clampSpeed(1)).toBe(MIN_PX_PER_SECOND);
        expect(clampSpeed(1e9)).toBe(MAX_PX_PER_SECOND);
        expect(clampSpeed(NaN)).toBeGreaterThan(0);
    });
});
