import {
    DrawdyPreviewElementSchema,
    ModuleStyling,
} from "@drawdy/driver-protocol";
import { Rect } from "../score/geometry";
import { elementBounds } from "../score/ink";
import { Ctx, stamp, unwrap } from "./context";
import { sereneFramesAmong } from "./frames";

export const BUTTON_SIZE = 28;
export const BAR_GAP = 12;
export const TRACK_GAP = 10;
export const TRACK_WIDTH = 3;
export const KNOB_SIZE = 14;
export const KNOB_ACTIVE_SIZE = 20;
export const TRACK_HIT_HEIGHT = 24;
export const HOVER_SCALE = 1.15;
const MIN_TRACK = 40;
const FRAME_LABEL_REACH = 12 * (1.75 + 0.35);
const GLYPH_RATIO = 0.5;
const SHIELD_REACH = 1;
const BUTTON_SEED = 13;
const TRACK_SEED = 17;
const PLAYED_SEED = 19;
const KNOB_SEED = 23;
const SHIELD_SEED = 29;
const HIT_SEED = 31;

export type TransportMode = "play" | "stop";

export type BarLayout = {
    y: number;
    buttonCenterX: number;
    trackStart: number;
    trackEnd: number;
};

export function frameLabelReach(zoom: number): number {
    return FRAME_LABEL_REACH / Math.min(zoom || 1, 1);
}

export function barLayout(anchor: Rect, zoom: number): BarLayout {
    const y =
        anchor.y - frameLabelReach(zoom) - (BAR_GAP + BUTTON_SIZE / 2) / zoom;
    const buttonCenterX = anchor.x + BUTTON_SIZE / 2 / zoom;
    const trackStart = anchor.x + (BUTTON_SIZE + TRACK_GAP) / zoom;
    const trackEnd = Math.max(
        anchor.x + anchor.width,
        trackStart + MIN_TRACK / zoom
    );
    return { y, buttonCenterX, trackStart, trackEnd };
}

export function progressAt(layout: BarLayout, x: number): number {
    const span = layout.trackEnd - layout.trackStart;
    if (span <= 0) return 0;
    return Math.min(1, Math.max(0, (x - layout.trackStart) / span));
}

export function knobX(layout: BarLayout, progress: number): number {
    return layout.trackStart + progress * (layout.trackEnd - layout.trackStart);
}

type Selection = { rect: Rect; ids: string[] };
type ShapeSchema = Extract<DrawdyPreviewElementSchema, { type: "shape" }>;

export class TransportBar {
    private _selection: Selection | null = null;
    private _playingRect: Rect | null = null;
    private _previewId: string | null = null;
    private _previewShape = "";
    private _zoom = 1;
    private _buttonHovered = false;
    private _knobHovered = false;
    private _hiddenForDrag = false;
    private _progress = 0;
    private _dragX: number | null = null;
    private _progressBeforeDrag = 0;
    private _shield: Rect | null = null;
    private _queue: Promise<void> = Promise.resolve();
    private _dirty = false;
    private _syncing = false;

    public constructor(
        private readonly _ctx: Ctx,
        private _styling: ModuleStyling
    ) {}

    public get buttonId(): string {
        return `${this._ctx.driverId}:transport-button`;
    }

    public get knobId(): string {
        return `${this._ctx.driverId}:transport-knob`;
    }

    public get shieldId(): string {
        return `${this._ctx.driverId}:transport-shield`;
    }

    private get _trackId(): string {
        return `${this._ctx.driverId}:transport-track`;
    }

    private get _playedId(): string {
        return `${this._ctx.driverId}:transport-played`;
    }

    private get _hitId(): string {
        return `${this._ctx.driverId}:transport-hit`;
    }

    public get hitIds(): string[] {
        return [this.buttonId, this.knobId, this.shieldId];
    }

    public get trackIds(): string[] {
        return [this._trackId, this._playedId, this._hitId];
    }

    public get clickIds(): string[] {
        return [this.buttonId, ...this.trackIds];
    }

    public get ownIds(): string[] {
        return [...this.hitIds, this._trackId, this._playedId];
    }

    public get mode(): TransportMode {
        return this._playingRect ? "stop" : "play";
    }

    public get seedIds(): string[] {
        return this._selection?.ids ?? [];
    }

    public get isDragging(): boolean {
        return this._dragX !== null;
    }

    public setStyling(styling: ModuleStyling): void {
        this._styling = styling;
        this._requestSync();
    }

    public setZoom(zoom: number): void {
        if (zoom === this._zoom) return;
        this._zoom = zoom;
        this._requestSync();
    }

    public setButtonHovered(hovered: boolean): void {
        if (hovered === this._buttonHovered) return;
        this._buttonHovered = hovered;
        this._requestSync();
    }

    public setKnobHovered(hovered: boolean): void {
        if (hovered === this._knobHovered) return;
        this._knobHovered = hovered;
        this._requestSync();
    }

    public jumpTo(x: number): number | null {
        const anchor = this._anchor();
        if (!anchor || this.isDragging) return null;
        this._progress = progressAt(barLayout(anchor, this._zoom), x);
        this._requestSync();
        return this._progress;
    }

    public setProgress(progress: number): void {
        if (this.isDragging) return;
        const clamped = Math.min(1, Math.max(0, progress));
        if (clamped === this._progress) return;
        this._progress = clamped;
        this._requestSync();
    }

    public async beginDrag(x: number): Promise<void> {
        const anchor = this._anchor();
        if (!anchor) return;
        const { rect: viewport } = unwrap(
            await this._ctx.issueCommand({
                type: "command:camera:get-viewport-rect",
                ...stamp(this._ctx),
            })
        );
        this._shield = {
            x: viewport.x - viewport.width * SHIELD_REACH,
            y: viewport.y - viewport.height * SHIELD_REACH,
            width: viewport.width * (1 + SHIELD_REACH * 2),
            height: viewport.height * (1 + SHIELD_REACH * 2),
        };
        this._progressBeforeDrag = this._progress;
        this._dragX = x;
        this._progress = progressAt(barLayout(anchor, this._zoom), x);
        this._requestSync();
    }

    public dragTo(x: number): void {
        const anchor = this._anchor();
        if (!this.isDragging || !anchor) return;
        this._dragX = x;
        this._progress = progressAt(barLayout(anchor, this._zoom), x);
        this._requestSync();
    }

    public endDrag(): number | null {
        if (!this.isDragging) return null;
        this._dragX = null;
        this._shield = null;
        this._requestSync();
        return this._progress;
    }

    public cancelDrag(): void {
        if (!this.isDragging) return;
        this._dragX = null;
        this._shield = null;
        this._progress = this._progressBeforeDrag;
        this._requestSync();
    }

    public setSelection(ids: string[]): void {
        this._enqueue(async () => {
            this._hiddenForDrag = false;
            this._selection = await this._selectionFor(ids);
            this._requestSync();
        });
    }

    public refreshIfAffected(changedIds: string[]): void {
        const current = this._selection;
        if (!current) return;
        const watched = new Set(current.ids);
        if (!changedIds.some((id) => watched.has(id))) return;
        this.setSelection(current.ids);
    }

    public hideWhileDragging(): void {
        this._enqueue(async () => {
            this._hiddenForDrag = true;
            this._requestSync();
        });
    }

    public setPlaying(rect: Rect | null): void {
        this._enqueue(async () => {
            this._playingRect = rect;
            this._requestSync();
        });
    }

    private _enqueue(task: () => Promise<void>): void {
        this._queue = this._queue.then(task).catch(() => undefined);
    }

    private _requestSync(): void {
        this._dirty = true;
        if (this._syncing) return;
        void this._drain();
    }

    private async _drain(): Promise<void> {
        this._syncing = true;
        try {
            while (this._dirty) {
                this._dirty = false;
                try {
                    await this._sync();
                } catch {
                    this._previewId = null;
                    this._previewShape = "";
                }
            }
        } finally {
            this._syncing = false;
        }
    }

    private async _selectionFor(ids: string[]): Promise<Selection | null> {
        const frames = await sereneFramesAmong(this._ctx, ids);
        if (frames.length !== 1) return null;
        const rect = elementBounds(frames[0]);
        if (!rect || rect.width <= 0 || rect.height <= 0) return null;
        return { rect, ids: [frames[0].id] };
    }

    private _anchor(): Rect | null {
        if (this._playingRect) return this._playingRect;
        if (this._hiddenForDrag) return null;
        return this._selection?.rect ?? null;
    }

    private _circle(
        id: string,
        centerX: number,
        centerY: number,
        size: number,
        seed: number
    ): ShapeSchema {
        return {
            type: "shape",
            drawdyElementId: id,
            componentType: "circle",
            x: centerX - size / 2,
            y: centerY - size / 2,
            width: size,
            height: size,
            strokeColor: this._styling.background,
            fillColor: this._styling.primary,
            strokeWidth: 2 / this._zoom,
            roughness: 0,
            seed,
        };
    }

    private _line(
        id: string,
        fromX: number,
        toX: number,
        y: number,
        color: string,
        seed: number
    ): DrawdyPreviewElementSchema {
        return {
            type: "line",
            drawdyElementId: id,
            color,
            strokeWidth: TRACK_WIDTH / this._zoom,
            roughness: 0,
            seed,
            from: [fromX, y],
            to: [Math.max(toX, fromX + 0.5 / this._zoom), y],
        };
    }

    private _hitBox(
        id: string,
        rect: Rect,
        seed: number
    ): DrawdyPreviewElementSchema {
        return {
            type: "shape",
            drawdyElementId: id,
            componentType: "rect",
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            strokeColor: "transparent",
            fillColor: this._styling.primary,
            strokeWidth: 0,
            roughness: 0,
            seed,
            opacity: 0,
        };
    }

    private _elements(anchor: Rect): DrawdyPreviewElementSchema[] {
        const layout = barLayout(anchor, this._zoom);
        const buttonSize =
            (BUTTON_SIZE * (this._buttonHovered ? HOVER_SCALE : 1)) / this._zoom;
        const knobSize =
            (this._knobHovered || this.isDragging ? KNOB_ACTIVE_SIZE : KNOB_SIZE) /
            this._zoom;
        const knobCenter = knobX(layout, this._progress);

        const button: ShapeSchema = {
            ...this._circle(
                this.buttonId,
                layout.buttonCenterX,
                layout.y,
                buttonSize,
                BUTTON_SEED
            ),
            text: this.mode === "play" ? "▶" : "■",
            textColor: this._styling.primaryForeground,
            fontSize: (BUTTON_SIZE * GLYPH_RATIO) / this._zoom,
            textAlign: "center",
            textVerticalAlign: "middle",
        };

        const hitHeight = TRACK_HIT_HEIGHT / this._zoom;
        const elements: DrawdyPreviewElementSchema[] = [
            this._hitBox(
                this._hitId,
                {
                    x: layout.trackStart,
                    y: layout.y - hitHeight / 2,
                    width: layout.trackEnd - layout.trackStart,
                    height: hitHeight,
                },
                HIT_SEED
            ),
            button,
            this._line(
                this._trackId,
                layout.trackStart,
                layout.trackEnd,
                layout.y,
                this._styling.border,
                TRACK_SEED
            ),
            this._line(
                this._playedId,
                layout.trackStart,
                knobCenter,
                layout.y,
                this._styling.primary,
                PLAYED_SEED
            ),
            this._circle(this.knobId, knobCenter, layout.y, knobSize, KNOB_SEED),
        ];

        if (this._shield) {
            elements.push(this._hitBox(this.shieldId, this._shield, SHIELD_SEED));
        }
        return elements;
    }

    private async _sync(): Promise<void> {
        const anchor = this._anchor();
        if (!anchor) {
            await this._remove();
            return;
        }
        const elements = this._elements(anchor);
        const shape = elements.map((el) => el.drawdyElementId).join(",");
        if (this._previewId && shape === this._previewShape) {
            await this._ctx.issueCommand({
                type: "command:scene:update-drawdy-preview-elements",
                ...stamp(this._ctx),
                req: { elements },
            });
            return;
        }
        await this._remove();
        const { previewId } = unwrap(
            await this._ctx.issueCommand({
                type: "command:scene:create-drawdy-preview-elements",
                ...stamp(this._ctx),
                req: { elements, hitTestable: true },
            })
        );
        this._previewId = previewId;
        this._previewShape = shape;
    }

    private async _remove(): Promise<void> {
        const previewId = this._previewId;
        this._previewId = null;
        this._previewShape = "";
        if (!previewId) return;
        await this._ctx.issueCommand({
            type: "command:scene:delete-drawdy-preview-elements",
            ...stamp(this._ctx),
            req: { previewIds: [previewId] },
        });
    }
}
