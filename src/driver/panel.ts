import { ModuleStyling } from "@drawdy/driver-protocol";
import { progressionsFor } from "../score/chords";
import { SCALES, ScaleId, midiToHz, rowToHz } from "../score/pitch";
import { Score, Voice } from "../score/score";
import { Ctx, stamp } from "./context";
import { PANEL_HTML } from "./panel-html";
import { BackingSettings, SereneSettings } from "./settings";

// Mozart portrait (assets/serene-icon-256.webp, 128px) embedded so the rail icon ships inside main.js.
export const ACTION_BUTTON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18"><clipPath id="drawdy-serene-rail-clip"><rect width="24" height="24" rx="5"/></clipPath><image href="data:image/webp;base64,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" x="0" y="0" width="24" height="24" clip-path="url(#drawdy-serene-rail-clip)"/></svg>`;

export const actionButtonId = (driverId: string): string =>
    `${driverId}:action-button`;

export const panelWebviewId = (driverId: string): string =>
    `${driverId}:webview`;

export type SerializedPitch = { t: number; hz: number; row: number };

export type SerializedVoice = {
    t: number;
    d: number;
    v: number;
    g: boolean;
    b: boolean;
    a: boolean;
    pitches: SerializedPitch[];
};

export type SerializedScore = {
    durationSec: number;
    voices: SerializedVoice[];
    pxPerSecond: number;
    rectWidth: number;
    rectHeight: number;
    elementCount: number;
    scaleId: string;
    scaleName: string;
    lowOctave: number;
    highOctave: number;
};

export type ScaleOption = { id: string; name: string };

export type PanelToDriver =
    | { type: "ready" }
    | { type: "scale"; value: string }
    | { type: "started" }
    | { type: "ended" }
    | { type: "stopped" }
    | { type: "progress"; t: number }
    | { type: "speed"; value: number }
    | { type: "knobs"; values: Record<string, unknown> }
    | { type: "loop"; value: boolean }
    | { type: "range"; low: number; high: number }
    | { type: "backing"; value: Record<string, unknown> }
    | { type: "add-frame" };

export type DriverToPanel =
    | { type: "theme"; css: string }
    | { type: "scales"; scales: ScaleOption[]; current: string }
    | { type: "score"; score: SerializedScore; autoplay: boolean; live?: boolean }
    | { type: "frames"; count: number }
    | { type: "settings"; values: SereneSettings }
    | { type: "seek"; t: number }
    | { type: "backing"; progressions: string[]; value: BackingSettings }
    | { type: "stop" };

export function stylingCssVars(styling: ModuleStyling): string {
    return Object.entries(styling)
        .map(([key, value]) =>
            key === "theme"
                ? `color-scheme: ${value};`
                : `--drawdy-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}: ${value};`
        )
        .join("");
}

const serializeVoice =
    (score: Score) =>
    (voice: Voice): SerializedVoice => ({
        t: voice.startSec,
        d: voice.durationSec,
        v: voice.velocity,
        g: voice.glide,
        b: voice.backing,
        a: voice.arp,
        pitches: voice.pitches.map((pitch) => ({
            t: pitch.t,
            hz:
                pitch.midi !== undefined
                    ? midiToHz(pitch.midi)
                    : rowToHz(score.scale, score.range, pitch.row),
            row: pitch.row,
        })),
    });

export function serializeScore(
    score: Score,
    elementCount: number
): SerializedScore {
    return {
        durationSec: score.durationSec,
        pxPerSecond: score.pxPerSecond,
        rectWidth: score.rect.width,
        rectHeight: score.rect.height,
        elementCount,
        scaleId: score.scale.id,
        scaleName: score.scale.name,
        lowOctave: score.range.lowOctave,
        highOctave: score.range.highOctave,
        voices: score.voices.map(serializeVoice(score)),
    };
}

export async function openPanel(
    ctx: Ctx,
    styling: ModuleStyling
): Promise<void> {
    await ctx.issueCommand({
        type: "command:webview:create",
        ...stamp(ctx),
        req: {
            webviewDomId: panelWebviewId(ctx.driverId),
            htmlContent: PANEL_HTML.replace(
                "/*__DRAWDY_STYLING__*/",
                stylingCssVars(styling)
            ),
            keepStateWhenClosed: true,
        },
    });
}

export const progressionNames = (scaleId: ScaleId): string[] =>
    progressionsFor(scaleId).map((progression) => progression.name);

export const scaleOptions = (): ScaleOption[] =>
    SCALES.map((scale) => ({ id: scale.id, name: scale.name }));

export function postToPanel(ctx: Ctx, message: DriverToPanel): void {
    void ctx.issueCommand({
        type: "command:webview:post-message",
        ...stamp(ctx),
        req: { webviewDomId: panelWebviewId(ctx.driverId), message },
    });
}
