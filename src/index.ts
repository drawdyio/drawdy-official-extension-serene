import { DriverModule, ModuleStyling } from "@drawdy/driver-protocol";
import { Ctx, stamp, unwrap } from "./driver/context";
import { FrameOverlay } from "./driver/frame-overlay";
import { FRAME_PROPERTIES } from "./driver/frames";
import {
    ACTION_BUTTON_SVG,
    PanelToDriver,
    actionButtonId,
    panelWebviewId,
} from "./driver/panel";
import { SereneSession } from "./driver/session";

const SCENE_CHANGE_SUBSCRIPTIONS = [
    "subscription:scene:elements-added",
    "subscription:scene:elements-removed",
    "subscription:scene:elements-updated",
    "subscription:scene:elements-replaced",
] as const;

let driver: {
    ctx: Ctx;
    session: SereneSession;
    overlay: FrameOverlay;
    styling: ModuleStyling;
} | null = null;

function subscribeClick(ctx: Ctx, domElementId: string): void {
    void ctx
        .issueCommand({
            type: "subscription:dom:element-clicked",
            ...stamp(ctx),
            req: { domElementId },
        })
        .catch(() => undefined);
}

const DOUBLE_CLICK_MS = 400;
let lastBarClick: { frameId: string; at: number } | null = null;

export const activate: DriverModule["activate"] = async ({
    manifest,
    issueCommand,
    generateId,
    styling,
}) => {
    let requestId = 0;
    const ctx: Ctx = {
        driverId: manifest.driverId,
        issueCommand,
        generateId,
        nextRequestId: () => String(requestId++),
    };
    const overlay = new FrameOverlay(ctx, styling, (domId) => subscribeClick(ctx, domId));
    const session = new SereneSession(ctx, overlay, styling);
    driver = { ctx, session, overlay, styling };
    await session.restoreSettings();

    unwrap(
        await issueCommand({
            type: "command:dom:create-action-button",
            ...stamp(ctx),
            req: {
                domElementId: actionButtonId(ctx.driverId),
                svg: ACTION_BUTTON_SVG,
            },
        })
    );
    unwrap(
        await issueCommand({
            type: "subscription:dom:element-clicked",
            ...stamp(ctx),
            req: { domElementId: actionButtonId(ctx.driverId) },
        })
    );
    unwrap(
        await issueCommand({
            type: "subscription:webview:message",
            ...stamp(ctx),
            req: { webviewDomId: panelWebviewId(ctx.driverId) },
        })
    );
    for (const type of [
        "subscription:dom:theme-changed",
        "subscription:scene:pointer-position",
        "subscription:scene:drawdy-element-selection",
        "subscription:scene:drawdy-elements-dragged",
        "subscription:camera:moved-rapid",
        "subscription:tool:laser",
    ] as const) {
        unwrap(await issueCommand({ type, ...stamp(ctx) }));
    }
    for (const type of SCENE_CHANGE_SUBSCRIPTIONS) {
        unwrap(
            await issueCommand({
                type,
                ...stamp(ctx),
                req: { properties: FRAME_PROPERTIES },
            })
        );
    }

    const camera = unwrap(
        await issueCommand({ type: "command:camera:get-info", ...stamp(ctx) })
    );
    overlay.setZoom(camera.zoom);
    await syncSelection(ctx, session);
    await session.postFrames();
};

async function syncSelection(ctx: Ctx, session: SereneSession): Promise<void> {
    const { drawdyElementIds } = unwrap(
        await ctx.issueCommand({
            type: "command:scene:get-current-selected-drawdy-elements",
            ...stamp(ctx),
        })
    );
    session.setSelection(drawdyElementIds);
}

export const onEvent: DriverModule["onEvent"] = async (event) => {
    if (!driver) return;
    const { ctx, session, overlay } = driver;

    switch (event.type) {
        case "subscription:scene:pointer-position": {
            const { x, y } = event.body.position.canvasSpace;
            overlay.setPointer(x, y);
            return;
        }
        case "subscription:scene:drawdy-element-selection": {
            session.setSelection([...event.body.drawdyElementIds]);
            return;
        }
        case "subscription:scene:drawdy-elements-dragged": {
            if (event.body.type === "dragStart") overlay.setDragging(true);
            if (event.body.type === "dragEnd") {
                overlay.setDragging(false);
                session.scheduleFrames();
            }
            return;
        }
        case "subscription:scene:elements-added":
        case "subscription:scene:elements-removed":
        case "subscription:scene:elements-updated":
        case "subscription:scene:elements-replaced": {
            const changed = [
                ...event.body.drawdyElements,
                ...(event.type === "subscription:scene:elements-replaced"
                    ? event.body.replaced
                    : []),
            ];
            overlay.onSceneChanged(changed);
            session.scheduleFrames();
            session.onSceneChanged(changed);
            return;
        }
        case "subscription:tool:laser": {
            session.setLaser(event.body.lasers);
            return;
        }
        case "subscription:camera:moved-rapid": {
            overlay.setZoom(event.body.zoom);
            return;
        }
        case "subscription:dom:element-clicked": {
            const domId = event.body.domElementId;
            if (domId === actionButtonId(ctx.driverId)) {
                await session.openFromRail();
                return;
            }
            const sampleFrame = overlay.frameForSample(domId);
            if (sampleFrame) {
                await session.addSample(sampleFrame);
                return;
            }
            const barFrame = overlay.frameForBar(domId);
            if (!barFrame) return;
            // The host reports single clicks only; two on one bar in quick succession rename.
            const now = Date.now();
            const double =
                lastBarClick?.frameId === barFrame && now - lastBarClick.at < DOUBLE_CLICK_MS;
            lastBarClick = double ? null : { frameId: barFrame, at: now };
            if (double) await session.editFrameName(barFrame);
            else await session.selectFrame(barFrame);
            return;
        }
        case "subscription:webview:message": {
            if (event.body.webviewDomId !== panelWebviewId(ctx.driverId)) return;
            const message = event.body.message;
            if (typeof message !== "object" || message === null) return;
            await session.onPanelMessage(message as PanelToDriver);
            return;
        }
        case "subscription:dom:theme-changed": {
            driver.styling = event.body.styling;
            session.setStyling(event.body.styling);
            session.postTheme();
            return;
        }
        default:
            return;
    }
};
