import { ModuleStyling } from "@drawdy/driver-protocol";
import { Polyline, Rect } from "../score/geometry";
import { sceneInk } from "../score/ink";
import { DEFAULT_SCALE_ID, ScaleId, getScale } from "../score/pitch";
import {
    DEFAULT_SCORE_OPTIONS,
    Score,
    buildScore,
    clampSpeed,
    playheadX,
} from "../score/score";
import { Ctx } from "./context";
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

const EMPTY_REGION: Rect = { x: 0, y: 0, width: 1, height: 1 };

export class SereneSession {
    private _score: Score | null = null;
    private _rect: Rect | null = null;
    private _lines: Polyline[] = [];
    private _elementCount = 0;
    private _speed = DEFAULT_SCORE_OPTIONS.pxPerSecond;
    private _scale: ScaleId = DEFAULT_SCALE_ID;
    private _pointer: { x: number; y: number } | null = null;
    private _pendingAutoplay = false;

    public constructor(
        private readonly _ctx: Ctx,
        private readonly _playhead: Playhead,
        private _styling: ModuleStyling
    ) {}

    public setPointer(pointer: { x: number; y: number }): void {
        this._pointer = pointer;
    }

    public setStyling(styling: ModuleStyling): void {
        this._styling = styling;
        this._playhead.setStyling(styling);
    }

    public async openPanel(): Promise<void> {
        await openPanel(this._ctx, this._styling);
    }

    public postScales(): void {
        postToPanel(this._ctx, {
            type: "scales",
            scales: scaleOptions(),
            current: this._scale,
        });
    }

    public postTheme(): void {
        postToPanel(this._ctx, {
            type: "theme",
            css: stylingCssVars(this._styling),
        });
    }

    private async _resolve(): Promise<boolean> {
        const target = await resolveTarget(this._ctx, this._pointer);
        if (!target) {
            this._rect = null;
            this._lines = [];
            this._elementCount = 0;
            this._score = buildScore(EMPTY_REGION, [], {
                scale: this._scale,
            });
            return false;
        }
        this._rect = target.rect;
        this._elementCount = target.elements.length;
        this._lines = sceneInk(target.elements);
        this._rebuild();
        return true;
    }

    public async play(): Promise<void> {
        const resolved = await this._resolve();
        await this.openPanel();
        if (!resolved) {
            this._postScore(false);
            return;
        }
        this._postScore(true);
    }

    public async stop(): Promise<void> {
        postToPanel(this._ctx, { type: "stop" });
        await this._playhead.hide();
    }

    public async onPanelMessage(message: PanelToDriver): Promise<void> {
        switch (message.type) {
            case "ready":
                this.postTheme();
                this.postScales();
                if (this._score) {
                    const autoplay = this._pendingAutoplay;
                    this._pendingAutoplay = false;
                    this._postScore(autoplay);
                }
                return;
            case "started":
                this._pendingAutoplay = false;
                if (this._rect) await this._playhead.show(this._rect);
                return;
            case "progress":
                if (this._score) {
                    this._playhead.move(playheadX(this._score, message.t));
                }
                return;
            case "ended":
            case "stopped":
                await this._playhead.hide();
                return;
            case "speed":
                this._speed = clampSpeed(message.value);
                if (!this._rect) return;
                this._rebuild();
                this._postScore(false);
                return;
            case "scale":
                this._scale = getScale(message.value).id;
                if (!this._rect) return;
                this._rebuild();
                this._postScore(false);
                return;
        }
    }

    private _rebuild(): void {
        if (!this._rect) return;
        this._score = buildScore(this._rect, this._lines, {
            pxPerSecond: this._speed,
            scale: this._scale,
        });
    }

    private _postScore(autoplay: boolean): void {
        if (!this._score) return;
        if (autoplay) this._pendingAutoplay = true;
        postToPanel(this._ctx, {
            type: "score",
            score: serializeScore(this._score, this._elementCount),
            autoplay,
        });
    }
}
