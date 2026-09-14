import { Ctx, stamp, unwrap } from "./context";

export const playMenuId = (driverId: string): string => `${driverId}:play`;
export const stopMenuId = (driverId: string): string => `${driverId}:stop`;

export async function registerMenus(ctx: Ctx): Promise<void> {
    const menus = [
        { menuId: playMenuId(ctx.driverId), menuTitle: "Serene play" },
        { menuId: stopMenuId(ctx.driverId), menuTitle: "Serene stop" },
    ];
    for (const menu of menus) {
        unwrap(
            await ctx.issueCommand({
                type: "command:context-menu:add",
                ...stamp(ctx),
                req: menu,
            })
        );
        unwrap(
            await ctx.issueCommand({
                type: "subscription:context-menu:clicked",
                ...stamp(ctx),
                req: { menuId: menu.menuId },
            })
        );
    }
}
