import {
    DrawdyPreviewElementSchema,
    ModuleStyling,
} from "@drawdy/driver-protocol";
import { Rect } from "../score/geometry";
import { Ctx, stamp, unwrap } from "./context";

const PLAYHEAD_WIDTH = 2;
const REGION_SEED = 7;
const LINE_SEED = 11;

export class Playhead {
    private _previewId: string | null = null;
    private _rect: Rect | null = null;
    private _inFlight = false;
    private _pendingX: number | null = null;

    public constructor(
        private readonly _ctx: Ctx,
        private _styling: ModuleStyling
    ) {}

    public setStyling(styling: ModuleStyling): void {
        this._styling = styling;
    }

    private get _lineId(): string {
        return `${this._ctx.driverId}:playhead-line`;
    }

    private get _regionId(): string {
        return `${this._ctx.driverId}:playhead-region`;
    }

    private _lineSchema(rect: Rect, x: number): DrawdyPreviewElementSchema {
        return {
            type: "line",
            drawdyElementId: this._lineId,
            color: this._styling.primary,
            strokeWidth: PLAYHEAD_WIDTH,
            roughness: 0,
            seed: LINE_SEED,
            from: [x, rect.y],
            to: [x, rect.y + rect.height],
        };
    }

    private _regionSchema(rect: Rect): DrawdyPreviewElementSchema {
        return {
            type: "shape",
            drawdyElementId: this._regionId,
            componentType: "rect",
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            strokeColor: this._styling.border,
            fillColor: "transparent",
            strokeWidth: 1,
            strokeDash: "dashed",
            cornerRadius: 0,
            roughness: 0,
            seed: REGION_SEED,
            opacity: 0.7,
        };
    }

    public async show(rect: Rect): Promise<void> {
        await this.hide();
        const { previewId } = unwrap(
            await this._ctx.issueCommand({
                type: "command:scene:create-drawdy-preview-elements",
                ...stamp(this._ctx),
                req: {
                    elements: [
                        this._regionSchema(rect),
                        this._lineSchema(rect, rect.x),
                    ],
                },
            })
        );
        this._previewId = previewId;
        this._rect = rect;
    }

    public move(x: number): void {
        if (!this._previewId || !this._rect) return;
        this._pendingX = x;
        if (this._inFlight) return;
        void this._flush();
    }

    private async _flush(): Promise<void> {
        const rect = this._rect;
        if (!rect || this._pendingX === null) return;
        const x = this._pendingX;
        this._pendingX = null;
        this._inFlight = true;
        try {
            await this._ctx.issueCommand({
                type: "command:scene:update-drawdy-preview-elements",
                ...stamp(this._ctx),
                req: { elements: [this._lineSchema(rect, x)] },
            });
        } finally {
            this._inFlight = false;
        }
        if (this._pendingX !== null) await this._flush();
    }

    public async hide(): Promise<void> {
        this._pendingX = null;
        this._rect = null;
        const previewId = this._previewId;
        this._previewId = null;
        if (!previewId) return;
        await this._ctx.issueCommand({
            type: "command:scene:delete-drawdy-preview-elements",
            ...stamp(this._ctx),
            req: { previewIds: [previewId] },
        });
    }
}
