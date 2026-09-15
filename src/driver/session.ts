import { ModuleStyling, SubscribedDrawdyElement } from "@drawdy/driver-protocol";
import { Polyline, Rect, rectsOverlap } from "../score/geometry";
import { elementBounds } from "../score/ink";
import { sceneInk } from "../score/ink";
import { getScale } from "../score/pitch";
import { Score, buildScore, clampSpeed, playheadX } from "../score/score";
import { Ctx } from "./context";
import { addSereneFrame, listSereneFrames } from "./frames";
import {
    PanelToDriver,
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
    loadSettings,
    sanitizeKnobs,
    saveSettings,
} from "./settings";
import { TransportBar } from "./transport-bar";

const EMPTY_REGION: Rect = { x: 0, y: 0, width: 1, height: 1 };
const REFRESH_DEBOUNCE_MS = 120;

function sameRect(a: Rect, b: Rect): boolean {
    return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

export class SereneSession {
    private _score: Score | null = null;
    private _rect: Rect | null = null;
    private _lines: Polyline[] = [];
    private _elementCount = 0;
    private _settings: SereneSettings = DEFAULT_SETTINGS;
    private _pointer: { x: number; y: number } | null = null;
    private _pendingAutoplay = false;
    private _frameIds: string[] = [];
    private _playing = false;
    private _refreshTimer: ReturnType<typeof setTimeout> | null = null;

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

    public setPointer(pointer: { x: number; y: number }): void {
        this._pointer = pointer;
    }

    public setStyling(styling: ModuleStyling): void {
        this._styling = styling;
        this._playhead.setStyling(styling);
        this._transport.setStyling(styling);
    }

    public async openPanel(): Promise<void> {
        await openPanel(this._ctx, this._styling);
    }

    public async openFromRail(): Promise<void> {
        await this.openPanel();
        this.postTheme();
        const frames = await listSereneFrames(this._ctx);
        if (frames.length === 0) {
            await this.addFrame();
            return;
        }
        this.postFrames(frames.length);
    }

    public async addFrame(): Promise<void> {
        try {
            await addSereneFrame(this._ctx);
        } finally {
            await this.postFrames();
        }
    }

    public async postFrames(count?: number): Promise<void> {
        const total = count ?? (await listSereneFrames(this._ctx)).length;
        postToPanel(this._ctx, { type: "frames", count: total });
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
        const target = await resolveTarget(this._ctx, this._pointer, seedIds);
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
                void this.postFrames();
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
            case "knobs":
                this._updateSettings(sanitizeKnobs(message.values, this._settings));
                return;
            case "speed":
                this._updateSettings({ speed: clampSpeed(message.value) });
                if (!this._rect) return;
                this._rebuild();
                this._postScore(false, true);
                return;
            case "scale":
                this._updateSettings({ scale: getScale(message.value).id });
                if (!this._rect) return;
                this._rebuild();
                this._postScore(false, true);
                return;
        }
    }

    private _rebuild(): void {
        if (!this._rect) return;
        this._score = buildScore(this._rect, this._lines, {
            pxPerSecond: this._settings.speed,
            scale: this._settings.scale,
        });
    }

    private _postScore(autoplay: boolean, live = false): void {
        if (!this._score) return;
        if (autoplay) this._pendingAutoplay = true;
        postToPanel(this._ctx, {
            type: "score",
            score: serializeScore(this._score, this._elementCount),
            autoplay,
            live,
        });
    }
}
