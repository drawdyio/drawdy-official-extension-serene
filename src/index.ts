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

let driver: {
    ctx: Ctx;
    session: SereneSession;
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
    const session = new SereneSession(ctx, playhead, styling);
    driver = { ctx, session, styling };

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
};

export const onEvent: DriverModule["onEvent"] = async (event) => {
    if (!driver) return;
    const { ctx, session } = driver;

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
            return;
        }
        case "subscription:dom:element-clicked": {
            if (event.body.domElementId !== actionButtonId(ctx.driverId)) return;
            await session.openPanel();
            session.postTheme();
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
