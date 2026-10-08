import { ModuleStyling } from "@drawdy/driver-protocol";
import { PROGRESSIONS } from "../score/chords";
import { SCALES, midiToHz, rowToHz } from "../score/pitch";
import { Score, Voice } from "../score/score";
import { Ctx, stamp } from "./context";
import { FrameSummary } from "./frame-list";
import { PANEL_HTML } from "./panel-html";
import { BackingSettings, SereneSettings } from "./settings";

// assets/serene-icon-256.webp at 128px, embedded so the icon ships inside main.js.
export const ICON_DATA_URI = "data:image/webp;base64,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";

export const ACTION_BUTTON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18"><clipPath id="drawdy-serene-rail-clip"><rect width="24" height="24" rx="5"/></clipPath><image href="${ICON_DATA_URI}" x="0" y="0" width="24" height="24" clip-path="url(#drawdy-serene-rail-clip)"/></svg>`;

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
    lowOctave: number;
    highOctave: number;
    frameIds: string[];
};

export type ScaleOption = {
    id: string;
    name: string;
    description: string;
    /** Semitones above C, for the hover preview. */
    steps: number[];
};
export type BackingOption = { name: string; progression: string };

export type PanelToDriver =
    | { type: "ready" }
    | { type: "scale"; value: string }
    | { type: "started" }
    | { type: "ended" }
    | { type: "stopped" }
    | { type: "progress"; t: number }
    | { type: "speed"; value: number }
    | { type: "paused" }
    | { type: "knobs"; values: Record<string, unknown> }
    | { type: "loop"; value: boolean }
    | { type: "range"; low: number; high: number }
    | { type: "backing"; value: Record<string, unknown> }
    | { type: "add-frame" }
    | { type: "focus-frame"; id: string }
    | { type: "play-frame"; id: string }
    | { type: "rename-frame"; id: string; name: string };

export type DriverToPanel =
    | { type: "theme"; css: string }
    | { type: "scales"; scales: ScaleOption[]; current: string }
    | { type: "score"; score: SerializedScore; autoplay: boolean; live?: boolean }
    | { type: "frames"; frames: FrameSummary[] }
    | { type: "selection"; ids: string[] }
    | { type: "edit-frame-name"; id: string }
    | { type: "settings"; values: SereneSettings }
    | { type: "seek"; t: number }
    | { type: "backing"; options: BackingOption[]; value: BackingSettings }
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
    elementCount: number,
    frameIds: string[]
): SerializedScore {
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
            ).replace("__SERENE_ICON__", ICON_DATA_URI),
            keepStateWhenClosed: true,
        },
    });
}

export const backingOptions = (): BackingOption[] =>
    PROGRESSIONS.map((progression) => ({
        name: progression.label,
        progression: progression.name,
    }));

export const scaleOptions = (): ScaleOption[] =>
    SCALES.map((scale) => ({
        id: scale.id,
        name: scale.name,
        description: scale.description,
        steps: scale.steps,
    }));

export function postToPanel(ctx: Ctx, message: DriverToPanel): void {
    void ctx.issueCommand({
        type: "command:webview:post-message",
        ...stamp(ctx),
        req: { webviewDomId: panelWebviewId(ctx.driverId), message },
    });
}
