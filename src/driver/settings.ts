import { DEFAULT_SCALE_ID, ScaleId, getScale } from "../score/pitch";
import { DEFAULT_SCORE_OPTIONS, clampSpeed } from "../score/score";
import { Ctx, stamp } from "./context";

const SETTINGS_KEY = "settings";

export type KnobSettings = {
    attack: number;
    volume: number;
    glide: number;
    reverb: number;
};

export type SereneSettings = KnobSettings & {
    speed: number;
    scale: ScaleId;
    loop: boolean;
};

export const DEFAULT_SETTINGS: SereneSettings = {
    speed: DEFAULT_SCORE_OPTIONS.pxPerSecond,
    scale: DEFAULT_SCALE_ID,
    loop: false,
    attack: 0.02,
    volume: 0.7,
    glide: 0.3,
    reverb: 0.38,
};

const KNOB_RANGES: Record<keyof KnobSettings, [number, number]> = {
    attack: [0, 0.3],
    volume: [0, 1],
    glide: [0, 1],
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
