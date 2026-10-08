import { ModuleStyling, SubscribedDrawdyElement } from "@drawdy/driver-protocol";
import { Rect, rectsOverlap } from "../score/geometry";
import { Ink, elementBounds, laserInk, sceneInk } from "../score/ink";
import { getScale, normalizeRange } from "../score/pitch";
import { Score, buildScore, playheadX } from "../score/score";
import { Ctx } from "./context";
import { frameSummaries } from "./frame-list";
import { addSereneFrame, selectAndFlyTo } from "./frames";
import {
    PanelToDriver,
    backingOptions,
    openPanel,
    postToPanel,
    scaleOptions,
    serializeScore,
    stylingCssVars,
} from "./panel";
import { Playhead } from "./playhead";
import { resolveTarget } from "./target";
import {
    DEFAULT_SETTINGS,
    SereneSettings,
    clampSpeed,
    loadSettings,
    sanitizeBacking,
    sanitizeKnobs,
    saveSettings,
    speedToPxPerSecond,
} from "./settings";
import { TransportBar } from "./transport-bar";

const EMPTY_REGION: Rect = { x: 0, y: 0, width: 1, height: 1 };
const REFRESH_DEBOUNCE_MS = 120;
const FRAME_LIST_DEBOUNCE_MS = 250;

function sameRect(a: Rect, b: Rect): boolean {
    return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

export class SereneSession {
    private _score: Score | null = null;
    private _rect: Rect | null = null;
    private _lines: Ink[] = [];
    private _laser: Ink[] = [];
    private _elementCount = 0;
    private _settings: SereneSettings = DEFAULT_SETTINGS;
    private _pendingAutoplay = false;
    private _frameIds: string[] = [];
    private _playing = false;
    private _refreshTimer: ReturnType<typeof setTimeout> | null = null;
    private _frameListTimer: ReturnType<typeof setTimeout> | null = null;
    private _panelOpened = false;
    private _selection: string[] = [];

    public constructor(
        private readonly _ctx: Ctx,
        private readonly _playhead: Playhead,
        private readonly _transport: TransportBar,
        private _styling: ModuleStyling
    ) {}

    public async restoreSettings(): Promise<void> {
        this._settings = await loadSettings(this._ctx);
    }

    private _updateSettings(patch: Partial<SereneSettings>): void {
        this._settings = { ...this._settings, ...patch };
        saveSettings(this._ctx, this._settings);
    }

    public postSettings(): void {
        postToPanel(this._ctx, { type: "settings", values: this._settings });
    }

    public setStyling(styling: ModuleStyling): void {
        this._styling = styling;
        this._playhead.setStyling(styling);
        this._transport.setStyling(styling);
    }

    public async openPanel(): Promise<void> {
        this._panelOpened = true;
        await openPanel(this._ctx, this._styling);
    }

    public async openFromRail(): Promise<void> {
        await this.openPanel();
        this.postTheme();
        await this.postFrames();
    }

    public async addFrame(): Promise<void> {
        try {
            await addSereneFrame(this._ctx);
        } finally {
            await this.postFrames();
        }
    }

    public async postFrames(): Promise<void> {
        if (!this._panelOpened) return;
        const frames = await frameSummaries(this._ctx);
        postToPanel(this._ctx, { type: "frames", frames });
    }

    /** Thumbnails follow the board; coalesce bursts of scene changes. */
    public scheduleFrames(): void {
        if (!this._panelOpened) return;
        if (this._frameListTimer) clearTimeout(this._frameListTimer);
        this._frameListTimer = setTimeout(() => {
            this._frameListTimer = null;
            void this.postFrames().catch(() => undefined);
        }, FRAME_LIST_DEBOUNCE_MS);
    }

    public setSelection(ids: string[]): void {
        this._selection = ids;
        if (!this._panelOpened) return;
        postToPanel(this._ctx, { type: "selection", ids });
    }

    public postBacking(): void {
        postToPanel(this._ctx, {
            type: "backing",
            options: backingOptions(),
            value: this._settings.backing,
        });
    }

    public postScales(): void {
        postToPanel(this._ctx, {
            type: "scales",
            scales: scaleOptions(),
            current: this._settings.scale,
        });
    }

    public postTheme(): void {
        postToPanel(this._ctx, {
            type: "theme",
            css: stylingCssVars(this._styling),
        });
    }

    private async _resolve(seedIds: string[]): Promise<boolean> {
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

    public async play(seedIds: string[] = []): Promise<void> {
        const resolved = await this._resolve(seedIds);
        await this.openPanel();
        if (!resolved) {
            this._postScore(false);
            return;
        }
        this._postScore(true);
    }

    public setLaser(strokes: readonly (readonly [number, number][])[]): void {
        this._laser = laserInk(strokes);
        if (!this._rect) return;
        this._rebuild();
        this._postScore(false, true);
    }

    public onSceneChanged(changed: SubscribedDrawdyElement[]): void {
        const rect = this._rect;
        if (!rect) return;
        const touches = changed.some((el) => {
            if (this._frameIds.includes(el.id)) return true;
            const bounds = elementBounds(el);
            return bounds ? rectsOverlap(bounds, rect) : false;
        });
        if (!touches) return;
        if (this._refreshTimer) clearTimeout(this._refreshTimer);
        this._refreshTimer = setTimeout(() => {
            this._refreshTimer = null;
            void this._refresh();
        }, REFRESH_DEBOUNCE_MS);
    }

    private async _refresh(): Promise<void> {
        const previous = this._rect;
        const resolved = await this._resolve(this._frameIds);
        if (!resolved) {
            if (this._playing) await this.stop();
            this._postScore(false);
            return;
        }
        const rect = this._rect;
        if (this._playing && rect && previous && !sameRect(rect, previous)) {
            await this._playhead.show(rect);
            this._transport.setPlaying(rect);
        }
        this._postScore(false, true);
    }

    public seek(progress: number): void {
        if (!this._score) return;
        postToPanel(this._ctx, {
            type: "seek",
            t: progress * this._score.durationSec,
        });
    }

    public async stop(): Promise<void> {
        postToPanel(this._ctx, { type: "stop" });
        await this._playhead.hide();
    }

    public async onPanelMessage(message: PanelToDriver): Promise<void> {
        switch (message.type) {
            case "ready":
                this.postTheme();
                this.postSettings();
                this.postScales();
                this.postBacking();
                void this.postFrames();
                postToPanel(this._ctx, { type: "selection", ids: this._selection });
                if (this._score) {
                    const autoplay = this._pendingAutoplay;
                    this._pendingAutoplay = false;
                    this._postScore(autoplay);
                }
                return;
            case "started":
                this._pendingAutoplay = false;
                this._playing = true;
                if (this._rect) await this._playhead.show(this._rect);
                this._transport.setPlaying(this._rect);
                return;
            case "progress":
                if (this._score) {
                    this._playhead.move(playheadX(this._score, message.t));
                    this._transport.setProgress(
                        this._score.durationSec > 0
                            ? message.t / this._score.durationSec
                            : 0
                    );
                }
                return;
            case "paused":
                // The playhead holds where it stopped; the bar offers Play again.
                this._playing = false;
                this._transport.setPlaying(null);
                return;
            case "ended":
            case "stopped":
                this._playing = false;
                this._transport.setPlaying(null);
                this._transport.setProgress(0);
                await this._playhead.hide();
                return;
            case "add-frame":
                await this.addFrame();
                return;
            case "focus-frame":
                await selectAndFlyTo(this._ctx, message.id);
                return;
            case "play-frame":
                await this.play([message.id]);
                return;
            case "range":
                this._updateSettings(
                    normalizeRange(message.low, message.high, this._settings)
                );
                if (!this._rect) return;
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
                if (!this._rect) return;
                this._rebuild();
                this._postScore(false, true);
                return;
            case "scale": {
                const scale = getScale(message.value).id;
                this._updateSettings({ scale });
                if (!this._rect) return;
                this._rebuild();
                this._postScore(false, true);
                return;
            }
            case "backing":
                this._updateSettings({
                    backing: sanitizeBacking(message.value, this._settings.backing),
                });
                if (!this._rect) return;
                this._rebuild();
                this._postScore(false, true);
                return;
        }
    }

    private _rebuild(): void {
        if (!this._rect) return;
        this._score = buildScore(this._rect, [...this._lines, ...this._laser], {
            pxPerSecond: speedToPxPerSecond(this._settings.speed),
            scale: this._settings.scale,
            lowOctave: this._settings.lowOctave,
            highOctave: this._settings.highOctave,
            backing: this._settings.backing.enabled
                ? { progression: this._settings.backing.progression, voicing: "full", rhythm: 1 }
                : null,
        });
    }

    private _postScore(autoplay: boolean, live = false): void {
        if (!this._score) return;
        if (autoplay) this._pendingAutoplay = true;
        postToPanel(this._ctx, {
            type: "score",
            score: serializeScore(this._score, this._elementCount, this._frameIds),
            autoplay,
            live,
        });
    }
}
