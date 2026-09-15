import {
    DEFAULT_RANGE,
    DEFAULT_SCALE_ID,
    ScaleId,
    getScale,
    normalizeRange,
} from "../score/pitch";
import {
    ARP_PATTERNS,
    BackingOptions,
    Rhythm,
    Voicing,
    progressionsFor,
} from "../score/chords";
import { DEFAULT_SCORE_OPTIONS, clampSpeed } from "../score/score";
import { Ctx, stamp } from "./context";

const SETTINGS_KEY = "settings";

export type KnobSettings = {
    attack: number;
    notes: number;
    backingLevel: number;
    reverb: number;
};

export type BackingSettings = BackingOptions & {
    enabled: boolean;
};

export type SereneSettings = KnobSettings & {
    speed: number;
    scale: ScaleId;
    loop: boolean;
    lowOctave: number;
    highOctave: number;
    backing: BackingSettings;
};

export const DEFAULT_BACKING: BackingSettings = {
    enabled: false,
    progression: 0,
    voicing: "full",
    rhythm: 1,
};

export const DEFAULT_SETTINGS: SereneSettings = {
    speed: DEFAULT_SCORE_OPTIONS.pxPerSecond,
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

const VOICINGS: Voicing[] = ["bass", "omit3", "full"];
const RHYTHMS: Rhythm[] = [1, 2, 4, ...ARP_PATTERNS];

export function sanitizeBacking(
    raw: unknown,
    scale: ScaleId,
    current: BackingSettings = DEFAULT_BACKING
): BackingSettings {
    if (typeof raw !== "object" || raw === null) return current;
    const record = raw as Record<string, unknown>;
    const count = progressionsFor(scale).length;
    const progression =
        typeof record.progression === "number" && Number.isFinite(record.progression)
            ? Math.min(count - 1, Math.max(0, Math.floor(record.progression)))
            : Math.min(count - 1, current.progression);
    const voicing = VOICINGS.includes(record.voicing as Voicing)
        ? (record.voicing as Voicing)
        : current.voicing;
    const rhythm = RHYTHMS.includes(record.rhythm as Rhythm)
        ? (record.rhythm as Rhythm)
        : current.rhythm;
    return {
        enabled: typeof record.enabled === "boolean" ? record.enabled : current.enabled,
        progression,
        voicing,
        rhythm,
    };
}

const KNOB_RANGES: Record<keyof KnobSettings, [number, number]> = {
    attack: [0, 0.3],
    notes: [0, 1],
    backingLevel: [0, 1],
    reverb: [0, 1],
};

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
    if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, value));
}

export function sanitizeKnobs(
    raw: Record<string, unknown>,
    current: KnobSettings
): KnobSettings {
    const next = { ...current };
    for (const key of Object.keys(KNOB_RANGES) as (keyof KnobSettings)[]) {
        const [min, max] = KNOB_RANGES[key];
        next[key] = clampNumber(raw[key], min, max, current[key]);
    }
    return next;
}

export function sanitizeSettings(raw: Record<string, unknown>): SereneSettings {
    const scale = typeof raw.scale === "string" ? getScale(raw.scale).id : DEFAULT_SETTINGS.scale;
    const speed =
        typeof raw.speed === "number" && Number.isFinite(raw.speed)
            ? clampSpeed(raw.speed)
            : DEFAULT_SETTINGS.speed;
    return {
        ...sanitizeKnobs(raw, DEFAULT_SETTINGS),
        speed,
        scale,
        loop: raw.loop === true,
        ...normalizeRange(raw.lowOctave, raw.highOctave),
        backing: sanitizeBacking(raw.backing, scale),
    };
}

export async function loadSettings(ctx: Ctx): Promise<SereneSettings> {
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
    } catch {
        return DEFAULT_SETTINGS;
    }
}

export function saveSettings(ctx: Ctx, settings: SereneSettings): void {
    void ctx
        .issueCommand({
            type: "command:kv-storage:set",
            ...stamp(ctx),
            req: { key: SETTINGS_KEY, payload: settings },
        })
        .catch(() => undefined);
}
