import {
    DEFAULT_RANGE,
    DEFAULT_SCALE_ID,
    ScaleId,
    getScale,
    normalizeRange,
} from "../score/pitch";
import {
    ARP_PATTERNS,
    BACKING_STYLES,
    BackingOptions,
    BackingStyle,
    Rhythm,
    Voicing,
    stylesFor,
} from "../score/chords";
import { BASE_PX_PER_SECOND } from "../score/score";
import { Ctx, stamp } from "./context";

const SETTINGS_KEY = "settings";

export const MIN_SPEED = 0.5;
export const MAX_SPEED = 2;
const SPEED_STEP = 0.05;

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
    /** Multiplier on BASE_PX_PER_SECOND. */
    speed: number;
    scale: ScaleId;
    loop: boolean;
    lowOctave: number;
    highOctave: number;
    backing: BackingSettings;
};

export const DEFAULT_BACKING: BackingSettings = {
    enabled: false,
    style: "pop",
    voicing: "full",
    rhythm: 1,
};

export const DEFAULT_SETTINGS: SereneSettings = {
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

export function speedToPxPerSecond(speed: number): number {
    return BASE_PX_PER_SECOND * speed;
}

export function clampSpeed(value: unknown): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return DEFAULT_SETTINGS.speed;
    }
    // Before 1.4.1 speed was stored in px per second (40 to 900).
    const multiplier = value > MAX_SPEED * 4 ? value / BASE_PX_PER_SECOND : value;
    const clamped = Math.min(MAX_SPEED, Math.max(MIN_SPEED, multiplier));
    return Number((Math.round(clamped / SPEED_STEP) * SPEED_STEP).toFixed(2));
}

const VOICINGS: Voicing[] = ["bass", "omit3", "full"];
const RHYTHMS: Rhythm[] = [1, 2, 4, ...ARP_PATTERNS];

// Before the named styles, backing was an index into each scale's own list.
const LEGACY_STYLES: Record<ScaleId, (BackingStyle | null)[]> = {
    major: ["pop", "classic", "simple", null, "drone"],
    "major-pentatonic": ["pop", "classic", "simple", null, "drone"],
    dorian: ["pop", "simple", "classic"],
    mixolydian: ["simple", "classic"],
    lydian: ["pop", null, "simple", null, "drone"],
    japanese: ["drone"],
};

function isStyle(value: unknown): value is BackingStyle {
    return BACKING_STYLES.some((style) => style.id === value);
}

export function sanitizeBacking(
    raw: unknown,
    scale: ScaleId,
    current: BackingSettings = DEFAULT_BACKING
): BackingSettings {
    if (typeof raw !== "object" || raw === null) return current;
    const record = raw as Record<string, unknown>;
    const legacy =
        typeof record.progression === "number" ? LEGACY_STYLES[scale][record.progression] : null;
    const wanted = isStyle(record.style) ? record.style : (legacy ?? current.style);
    // A style the scale has no progression for falls back to the first it has.
    const available = stylesFor(scale);
    const style = available.includes(wanted) ? wanted : available[0];
    const voicing = VOICINGS.includes(record.voicing as Voicing)
        ? (record.voicing as Voicing)
        : current.voicing;
    const rhythm = RHYTHMS.includes(record.rhythm as Rhythm)
        ? (record.rhythm as Rhythm)
        : current.rhythm;
    return {
        enabled: typeof record.enabled === "boolean" ? record.enabled : current.enabled,
        style,
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
    return {
        ...sanitizeKnobs(raw, DEFAULT_SETTINGS),
        speed: clampSpeed(raw.speed),
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
