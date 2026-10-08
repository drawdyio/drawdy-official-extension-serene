import {
    DomElementSchema,
    DrawdyPreviewElementSchema,
    ModuleStyling,
    SubscribedDrawdyElement,
} from "@drawdy/driver-protocol";
import { Rect } from "../score/geometry";
import { elementBounds } from "../score/ink";
import {
    BOARD,
    barScale,
    fitBar,
    formatClock,
    noteLabels,
    rulerTicks,
} from "./board-layout";
import { Ctx, stamp, unwrap } from "./context";
import { ICON_DATA_URI } from "./panel";

const RANGE_PREVIEW_HOLD_MS = 600;
const MAX_NAME_CHARS = 28;
const EMPTY_MIN_WIDTH = 300;
const EMPTY_MIN_HEIGHT = 140;
const IDLE_PLAYHEAD_OPACITY = 0.4;
const TERTIARY_OPACITY = 0.5;
const EMPTY_TEXT_HEIGHT = 24;
// Text boxes at least this tall sit at their top whatever the host's line height.
const LABEL_BOX = 24;

export type OverlayFrame = {
    id: string;
    name: string;
    rect: Rect;
    empty: boolean;
};

export type OverlaySettings = {
    pxPerSecond: number;
    lowOctave: number;
    highOctave: number;
    stepsPerOctave: number;
};

type Active = { id: string; progress: number; playing: boolean };
type Shape = Extract<DrawdyPreviewElementSchema, { type: "shape" }>;

function truncate(name: string): string {
    return name.length > MAX_NAME_CHARS ? `${name.slice(0, MAX_NAME_CHARS - 1)}…` : name;
}

/** One preview batch: updated in place while its element ids stay the same. */
class PreviewBatch {
    private _previewId: string | null = null;
    private _shape = "";
    private _sent = "";

    public constructor(
        private readonly _ctx: Ctx,
        private readonly _hitTestable = false
    ) {}

    public async sync(elements: DrawdyPreviewElementSchema[]): Promise<void> {
        if (elements.length === 0) {
            await this.clear();
            return;
        }
        const sent = JSON.stringify(elements);
        if (sent === this._sent) return;
        const shape = elements.map((el) => el.drawdyElementId).join(",");
        if (this._previewId && shape === this._shape) {
            this._sent = sent;
            await this._ctx.issueCommand({
                type: "command:scene:update-drawdy-preview-elements",
                ...stamp(this._ctx),
                req: { elements },
            });
            return;
        }
        await this.clear();
        const { previewId } = unwrap(
            await this._ctx.issueCommand({
                type: "command:scene:create-drawdy-preview-elements",
                ...stamp(this._ctx),
                req: { elements, hitTestable: this._hitTestable },
            })
        );
        this._previewId = previewId;
        this._shape = shape;
        this._sent = sent;
    }

    public async clear(): Promise<void> {
        const previewId = this._previewId;
        this._previewId = null;
        this._shape = "";
        this._sent = "";
        if (!previewId) return;
        await this._ctx.issueCommand({
            type: "command:scene:delete-drawdy-preview-elements",
            ...stamp(this._ctx),
            req: { previewIds: [previewId] },
        });
    }
}

/**
 * Everything Serene draws on the board around its frames: the frame bar, the
 * time ruler, note labels, the playhead and the empty state. Lines are canvas
 * previews and text is component previews (DOM on the canvas's widget layer),
 * so all of it pans and zooms with the board and stays under Drawdy's panels.
 * Both scale with zoom, so sizes are screen pixels divided by zoom.
 */
export class FrameOverlay {
    private _frames: OverlayFrame[] = [];
    private _zoom = 1;
    private _settings: OverlaySettings = {
        pxPerSecond: 200,
        lowOctave: 3,
        highOctave: 6,
        stepsPerOctave: 5,
    };
    private _selection = new Set<string>();
    private _hovered: string | null = null;
    private _active: Active | null = null;
    private _rangePreview: string | null = null;
    private _rangeTimer: ReturnType<typeof setTimeout> | null = null;
    private _dragging = false;
    private _guides: PreviewBatch;
    private _labels: PreviewBatch;
    private _playheads: PreviewBatch;
    private _dirty = false;
    private _syncing = false;
    private _clickIds = new Set<string>();

    public constructor(
        private readonly _ctx: Ctx,
        private _styling: ModuleStyling,
        /** Asks for click events on a DOM id the overlay draws. */
        private readonly _onClickTarget: (domId: string) => void
    ) {
        this._guides = new PreviewBatch(_ctx);
        this._labels = new PreviewBatch(_ctx);
        this._playheads = new PreviewBatch(_ctx);
    }

    private _id(part: string, frameId: string): string {
        return `${this._ctx.driverId}:${part}:${frameId}`;
    }

    public frameForBar(domId: string): string | null {
        const prefix = "serene-bar-";
        return domId.startsWith(prefix) ? domId.slice(prefix.length) : null;
    }

    private _clickable(domId: string): string {
        if (!this._clickIds.has(domId)) {
            this._clickIds.add(domId);
            this._onClickTarget(domId);
        }
        return domId;
    }

    // ---- Inputs

    public setZoom(zoom: number): void {
        if (zoom === this._zoom) return;
        this._zoom = zoom;
        this._request();
    }

    public setStyling(styling: ModuleStyling): void {
        this._styling = styling;
        this._request();
    }

    public setFrames(frames: OverlayFrame[]): void {
        this._frames = frames;
        this._request();
    }

    /** Frame moves and resizes arrive before the debounced frame list. */
    public onSceneChanged(changed: SubscribedDrawdyElement[]): void {
        let touched = false;
        for (const el of changed) {
            const frame = this._frames.find((f) => f.id === el.id);
            const rect = frame ? elementBounds(el) : null;
            if (!frame || !rect) continue;
            frame.rect = rect;
            touched = true;
        }
        if (touched) this._request();
    }

    public setSettings(settings: OverlaySettings): void {
        this._settings = settings;
        this._request();
    }

    public setSelection(ids: string[]): void {
        this._selection = new Set(ids);
        this._request();
    }

    public setPointer(x: number, y: number): void {
        let hovered: string | null = null;
        // Later frames draw on top, so the last hit wins.
        for (const frame of this._frames) {
            const r = frame.rect;
            if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height) {
                hovered = frame.id;
            }
        }
        if (hovered === this._hovered) return;
        this._hovered = hovered;
        this._request();
    }

    public setDragging(dragging: boolean): void {
        this._dragging = dragging;
        this._request();
    }

    public setActive(id: string | null, playing: boolean): void {
        if (!id) {
            this._active = null;
        } else if (this._active?.id === id) {
            this._active.playing = playing;
        } else {
            this._active = { id, progress: 0, playing };
        }
        this._request();
    }

    public setProgress(progress: number): void {
        if (!this._active) return;
        this._active.progress = Math.min(1, Math.max(0, progress));
        this._request();
    }

    /** Show the guides on one frame while Range is adjusted in the panel. */
    public previewRange(): void {
        const target =
            this._frames.find((f) => this._selection.has(f.id)) ?? this._frames[0];
        if (!target) return;
        this._rangePreview = target.id;
        if (this._rangeTimer) clearTimeout(this._rangeTimer);
        this._rangeTimer = setTimeout(() => {
            this._rangeTimer = null;
            this._rangePreview = null;
            this._request();
        }, RANGE_PREVIEW_HOLD_MS);
        this._request();
    }

    // ---- Sync

    private _request(): void {
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
                    // A failed command leaves stale previews; the next change redraws.
                }
            }
        } finally {
            this._syncing = false;
        }
    }

    private _guidesOn(frame: OverlayFrame): boolean {
        return (
            this._hovered === frame.id ||
            this._selection.has(frame.id) ||
            (this._active?.id === frame.id && this._active.playing) ||
            this._rangePreview === frame.id
        );
    }

    private _playheadOn(frame: OverlayFrame): boolean {
        return (
            this._hovered === frame.id ||
            this._selection.has(frame.id) ||
            this._active?.id === frame.id
        );
    }

    private async _sync(): Promise<void> {
        const frames = this._dragging ? [] : this._frames;
        const guides: DrawdyPreviewElementSchema[] = [];
        const labels: DrawdyPreviewElementSchema[] = [];
        const playheads: DrawdyPreviewElementSchema[] = [];
        for (const frame of frames) {
            labels.push(...this._bar(frame));
            if (this._guidesOn(frame)) {
                guides.push(...this._ticks(frame));
                labels.push(...this._rulerLabels(frame), ...this._noteLabels(frame));
            }
            if (this._playheadOn(frame)) playheads.push(...this._playhead(frame));
            if (frame.empty) labels.push(...this._emptyState(frame));
        }
        await Promise.all([
            this._guides.sync(guides),
            this._labels.sync(labels),
            this._playheads.sync(playheads),
        ]);
    }

    // ---- Builders

    /**
     * Text is DOM on the canvas's widget layer, which scales it by zoom. Each
     * piece is laid out at its screen size inside a fixed box, then scaled by
     * `scale / zoom` about its top-left, so it lands at `scale` of its design
     * size, so text is never laid out at a tiny pre-zoom size.
     */
    private _component(
        id: string,
        at: { x: number; y: number },
        size: { width: number; height: number },
        scale: number,
        schema: DomElementSchema
    ): DrawdyPreviewElementSchema {
        const s = scale / this._zoom;
        const round = (v: number): number => Math.round(v * 1000) / 1000;
        const dx = round((-size.width * (1 - s)) / 2);
        const dy = round((-size.height * (1 - s)) / 2);
        return {
            type: "component",
            drawdyElementId: id,
            x: at.x,
            y: at.y,
            width: size.width * s,
            height: size.height * s,
            schema: {
                type: "row",
                styles: {
                    width: [round(size.width), "px"],
                    height: [round(size.height), "px"],
                    overflow: "hidden",
                    // Transforms scale about the center; the translate keeps the top-left put.
                    transform: `translate(${dx}px, ${dy}px) scale(${round(s * 1e6) / 1e6})`,
                },
                children: [
                    // The host lines widgets up on their first baseline; a full-height
                    // box with no text puts it at the bottom, so nothing is pushed down.
                    { type: "box", styles: { width: [0, "px"], height: [round(size.height), "px"] } },
                    {
                        ...schema,
                        styles: {
                            ...schema.styles,
                            width: [round(size.width), "px"],
                            height: [round(size.height), "px"],
                        },
                    } as DomElementSchema,
                ],
            },
        };
    }

    private get _tertiary(): string {
        return `color-mix(in srgb, ${this._styling.foreground} ${TERTIARY_OPACITY * 100}%, transparent)`;
    }

    private _rect(id: string, rect: Rect, fill: string, stroke: string, radius: number, seed: number): Shape {
        return {
            type: "shape",
            drawdyElementId: id,
            componentType: "rect",
            ...rect,
            fillColor: fill,
            strokeColor: stroke,
            strokeWidth: 1 / this._zoom,
            cornerRadius: radius,
            roughness: 0,
            seed,
        };
    }

    private _ticks(frame: OverlayFrame): DrawdyPreviewElementSchema[] {
        const zoom = this._zoom;
        const { x, y, width } = frame.rect;
        return rulerTicks(width, this._settings.pxPerSecond, zoom).map((tick, index) => ({
            type: "line",
            drawdyElementId: `${this._id("tick", frame.id)}:${index}`,
            color: this._styling.mutedForeground,
            strokeWidth: 1 / zoom,
            roughness: 0,
            seed: 41 + index,
            opacity: tick.major ? 0.6 : 0.35,
            from: [x + tick.x, y],
            to: [x + tick.x, y + (tick.major ? BOARD.majorTick : BOARD.minorTick) / zoom],
        }));
    }

    private _rulerLabels(frame: OverlayFrame): DrawdyPreviewElementSchema[] {
        const zoom = this._zoom;
        const { x, y, width } = frame.rect;
        const labeled = rulerTicks(width, this._settings.pxPerSecond, zoom).filter(
            (tick) => tick.label !== null
        );
        if (labeled.length === 0) return [];
        const screenWidth = width * zoom;
        const children: DomElementSchema[] = [];
        let cursor = 0;
        labeled.forEach((tick, index) => {
            const start = Math.round(tick.x * zoom + BOARD.tickLabelInset);
            const next = labeled[index + 1];
            const end = next ? Math.round(next.x * zoom + BOARD.tickLabelInset) : screenWidth;
            children.push({ type: "box", styles: { width: [start - cursor, "px"], height: [1, "px"] } });
            children.push({
                type: "text",
                child: tick.label ?? "",
                styles: { width: [end - start, "px"], fontSize: [11, "px"], color: this._tertiary },
            });
            cursor = end;
        });
        return [
            this._component(
                this._id("ruler-labels", frame.id),
                { x, y: y + BOARD.tickLabelTop / zoom },
                { width: screenWidth, height: LABEL_BOX },
                1,
                { type: "row", children }
            ),
        ];
    }

    private _noteLabels(frame: OverlayFrame): DrawdyPreviewElementSchema[] {
        const zoom = this._zoom;
        const { lowOctave, highOctave, stepsPerOctave } = this._settings;
        const labels = noteLabels(frame.rect, lowOctave, highOctave, stepsPerOctave, zoom);
        if (labels.length === 0) return [];
        const children: DomElementSchema[] = [];
        let cursor = 0;
        for (const label of labels) {
            const top = Math.round((label.top - frame.rect.y) * zoom);
            if (top > cursor) children.push({ type: "box", styles: { width: [1, "px"], height: [top - cursor, "px"] } });
            children.push({
                type: "text",
                child: label.label,
                styles: { height: [BOARD.noteLineHeight, "px"], fontSize: [11, "px"], color: this._tertiary },
            });
            cursor = top + BOARD.noteLineHeight;
        }
        return [
            this._component(
                this._id("note-labels", frame.id),
                { x: frame.rect.x + BOARD.noteInset / zoom, y: frame.rect.y },
                { width: 40, height: Math.max(LABEL_BOX, cursor) },
                1,
                { type: "column", children }
            ),
        ];
    }

    private _playhead(frame: OverlayFrame): DrawdyPreviewElementSchema[] {
        const zoom = this._zoom;
        const { x, y, width, height } = frame.rect;
        const active = this._active?.id === frame.id ? this._active : null;
        const px = x + (active?.progress ?? 0) * width;
        const w = BOARD.handleWidth / zoom;
        const h = BOARD.handleHeight / zoom;
        const top = y - BOARD.handleAbove / zoom;
        const mid = top + h / 2;
        const grip = 3 / zoom;
        const idle = !active || (!active.playing && active.progress === 0);
        const gripLine = (part: string, dx: number, seed: number): DrawdyPreviewElementSchema => ({
            type: "line",
            drawdyElementId: this._id(part, frame.id),
            color: this._styling.primary,
            strokeWidth: 1.5 / zoom,
            roughness: 0,
            seed,
            from: [px + dx, mid - grip],
            to: [px + dx, mid + grip],
        });
        return [
            this._rect(
                this._id("playhead-handle", frame.id),
                { x: px - w / 2, y: top, width: w, height: h },
                this._styling.background,
                this._styling.border,
                w / 2,
                61
            ),
            gripLine("playhead-grip-a", -1.5 / zoom, 62),
            gripLine("playhead-grip-b", 1.5 / zoom, 63),
            {
                type: "line",
                drawdyElementId: this._id("playhead-line", frame.id),
                color: this._styling.primary,
                strokeWidth: 2 / zoom,
                roughness: 0,
                seed: 64,
                opacity: idle ? IDLE_PLAYHEAD_OPACITY : 1,
                from: [px, top + h],
                to: [px, y + height],
            },
        ];
    }

    private _timeText(frame: OverlayFrame): string {
        const duration = frame.rect.width / this._settings.pxPerSecond;
        const active = this._active?.id === frame.id ? this._active : null;
        if (!active || (!active.playing && active.progress === 0)) {
            return formatClock(duration);
        }
        return `${formatClock(active.progress * duration)} / ${formatClock(duration)}`;
    }

    private _bar(frame: OverlayFrame): DrawdyPreviewElementSchema[] {
        const zoom = this._zoom;
        const fit = fitBar(truncate(frame.name), this._timeText(frame), frame.rect.width * zoom, zoom);
        if (!fit) return [];
        const k = fit.scale;
        const s = this._styling;
        const children: DomElementSchema[] = [
            {
                type: "image",
                child: ICON_DATA_URI,
                styles: { width: [20, "px"], height: [20, "px"], borderRadius: [5, "px"] },
            },
        ];
        if (fit.name !== null) {
            children.push({
                type: "text",
                child: fit.name,
                styles: { fontSize: [13, "px"], fontWeight: "medium", color: s.foreground },
            });
        }
        if (fit.time !== null) {
            children.push({
                type: "text",
                child: fit.time,
                styles: { fontSize: [13, "px"], color: this._tertiary },
            });
        }
        return [
            this._component(
                this._id("bar", frame.id),
                {
                    x: frame.rect.x,
                    y: frame.rect.y - ((BOARD.barGap + BOARD.barHeight) * k) / zoom,
                },
                { width: Math.ceil(fit.width / k), height: BOARD.barHeight },
                k,
                {
                    type: "row",
                    // Click selects the frame; double-click renames it in the panel.
                    domId: this._clickable(`serene-bar-${frame.id}`),
                    styles: {
                        pointerEvents: "auto",
                        cursor: "default",
                        padding: [8, "px"],
                        gap: 8,
                        crossAxisAlignment: "center",
                        backgroundColor: s.background,
                        borderColor: s.border,
                        borderWidth: [1, "px"],
                        borderRadius: [10, "px"],
                    },
                    children,
                }
            ),
        ];
    }

    private _emptyState(frame: OverlayFrame): DrawdyPreviewElementSchema[] {
        const zoom = this._zoom;
        const k = barScale(zoom);
        const { x, y, width, height } = frame.rect;
        if (width * zoom < EMPTY_MIN_WIDTH * k || height * zoom < EMPTY_MIN_HEIGHT * k) return [];
        return [
            this._component(
                this._id("empty", frame.id),
                { x, y: y + height / 2 - (EMPTY_TEXT_HEIGHT * k) / 2 / zoom },
                { width: Math.round((width * zoom) / k), height: EMPTY_TEXT_HEIGHT },
                k,
                {
                    type: "text",
                    child: "Draw anywhere, then press play.",
                    styles: { fontSize: [14, "px"], color: this._styling.mutedForeground, textAlign: "center" },
                }
            ),
        ];
    }
}
