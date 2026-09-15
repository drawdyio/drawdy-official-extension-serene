import { DriverModule, ModuleStyling } from "@drawdy/driver-protocol";
import { Ctx, stamp, unwrap } from "./driver/context";
import { playMenuId, registerMenus, stopMenuId } from "./driver/menu";
import {
    ACTION_BUTTON_SVG,
    PanelToDriver,
    actionButtonId,
    panelWebviewId,
} from "./driver/panel";
import { Playhead } from "./driver/playhead";
import { SereneSession } from "./driver/session";
import { FRAME_PROPERTIES, isSereneFrame } from "./driver/frames";
import { TransportBar } from "./driver/transport-bar";

const SCENE_CHANGE_SUBSCRIPTIONS = [
    "subscription:scene:elements-added",
    "subscription:scene:elements-removed",
    "subscription:scene:elements-updated",
    "subscription:scene:elements-replaced",
] as const;

let driver: {
    ctx: Ctx;
    session: SereneSession;
    transport: TransportBar;
    styling: ModuleStyling;
} | null = null;

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
    const playhead = new Playhead(ctx, styling);
    const transport = new TransportBar(ctx, styling);
    const session = new SereneSession(ctx, playhead, transport, styling);
    driver = { ctx, session, transport, styling };
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
    unwrap(
        await issueCommand({
            type: "subscription:dom:theme-changed",
            ...stamp(ctx),
        })
    );
    unwrap(
        await issueCommand({
            type: "subscription:scene:pointer-position",
            ...stamp(ctx),
        })
    );

    await registerMenus(ctx);
    await subscribeTransport(ctx, transport);
};

async function subscribeTransport(
    ctx: Ctx,
    transport: TransportBar
): Promise<void> {
    unwrap(
        await ctx.issueCommand({
            type: "subscription:scene:drawdy-element-selection",
            ...stamp(ctx),
        })
    );
    unwrap(
        await ctx.issueCommand({
            type: "subscription:scene:drawdy-elements-dragged",
            ...stamp(ctx),
        })
    );
    for (const type of SCENE_CHANGE_SUBSCRIPTIONS) {
        unwrap(
            await ctx.issueCommand({
                type,
                ...stamp(ctx),
                req: { properties: FRAME_PROPERTIES },
            })
        );
    }
    unwrap(
        await ctx.issueCommand({
            type: "subscription:camera:moved-rapid",
            ...stamp(ctx),
        })
    );
    unwrap(
        await ctx.issueCommand({
            type: "subscription:tool:laser",
            ...stamp(ctx),
        })
    );
    unwrap(
        await ctx.issueCommand({
            type: "subscription:scene:click",
            ...stamp(ctx),
            req: { elementIds: transport.clickIds },
        })
    );
    unwrap(
        await ctx.issueCommand({
            type: "subscription:scene:pointer",
            ...stamp(ctx),
            req: { elementIds: transport.hitIds },
        })
    );
    const camera = unwrap(
        await ctx.issueCommand({
            type: "command:camera:get-info",
            ...stamp(ctx),
        })
    );
    transport.setZoom(camera.zoom);
    await syncTransportWithSelection(ctx, transport);
}

async function syncTransportWithSelection(
    ctx: Ctx,
    transport: TransportBar
): Promise<void> {
    const { drawdyElementIds } = unwrap(
        await ctx.issueCommand({
            type: "command:scene:get-current-selected-drawdy-elements",
            ...stamp(ctx),
        })
    );
    transport.setSelection(
        drawdyElementIds.filter((id) => !transport.ownIds.includes(id))
    );
}

export const onEvent: DriverModule["onEvent"] = async (event) => {
    if (!driver) return;
    const { ctx, session, transport } = driver;

    switch (event.type) {
        case "subscription:context-menu:clicked": {
            if (event.body.menuId === playMenuId(ctx.driverId)) {
                await session.play();
                return;
            }
            if (event.body.menuId === stopMenuId(ctx.driverId)) {
                await session.stop();
            }
            return;
        }
        case "subscription:scene:pointer-position": {
            session.setPointer(event.body.position.canvasSpace);
            if (transport.isDragging) {
                transport.dragTo(event.body.position.canvasSpace.x);
            }
            return;
        }
        case "subscription:scene:drawdy-element-selection": {
            const ids = event.body.drawdyElementIds;
            const foreign = ids.filter((id) => !transport.ownIds.includes(id));
            if (foreign.length === 0 && ids.length > 0) return;
            transport.setSelection(foreign);
            return;
        }
        case "subscription:scene:drawdy-elements-dragged": {
            if (event.body.type === "dragStart") transport.hideWhileDragging();
            if (event.body.type === "dragEnd") {
                await syncTransportWithSelection(ctx, transport);
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
            if (event.type !== "subscription:scene:elements-updated" && changed.some(isSereneFrame)) {
                await session.postFrames();
            }
            transport.refreshIfAffected(changed.map((el) => el.id));
            session.onSceneChanged(changed);
            return;
        }
        case "subscription:tool:laser": {
            session.setLaser(event.body.lasers);
            return;
        }
        case "subscription:camera:moved-rapid": {
            transport.setZoom(event.body.zoom);
            return;
        }
        case "subscription:scene:pointer": {
            const body = event.body;
            if (body.type === "cancel") {
                transport.cancelDrag();
                transport.setButtonHovered(false);
                transport.setKnobHovered(false);
                return;
            }
            const ids = body.drawdyElementIds;
            if (body.type === "down") {
                if (ids.includes(transport.knobId)) {
                    await transport.beginDrag(body.cursor.canvasSpace.x);
                }
                return;
            }
            if (body.type === "up") {
                const progress = transport.endDrag();
                if (progress !== null) session.seek(progress);
                return;
            }
            const entering = body.type === "enter";
            if (ids.includes(transport.buttonId)) {
                transport.setButtonHovered(entering);
            }
            if (ids.includes(transport.knobId)) {
                transport.setKnobHovered(entering);
            }
            return;
        }
        case "subscription:scene:click": {
            if (transport.isDragging) return;
            const clicked = event.body.drawdyElementIds;
            if (clicked.includes(transport.knobId)) return;
            if (clicked.some((id) => transport.trackIds.includes(id))) {
                const progress = transport.jumpTo(event.body.cursor.canvasSpace.x);
                if (progress !== null) session.seek(progress);
                return;
            }
            if (!clicked.includes(transport.buttonId)) return;
            if (transport.mode === "stop") {
                await session.stop();
                return;
            }
            await session.play(transport.seedIds);
            return;
        }
        case "subscription:dom:element-clicked": {
            if (event.body.domElementId !== actionButtonId(ctx.driverId)) return;
            await session.openFromRail();
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
