import { SubscribedDrawdyElement } from "@drawdy/driver-protocol";
import { elementBounds, elementInk, sceneInk } from "./ink";

const base = { id: "a" };

describe("elementInk", () => {
    it("ignores frames", () => {
        expect(
            elementInk({
                ...base,
                type: "frame",
                x: 0,
                y: 0,
                width: 10,
                height: 10,
            })
        ).toEqual([]);
    });

    it("uses freedraw points as world space", () => {
        const points: [number, number][] = [
            [0, 0],
            [5, 5],
        ];
        expect(
            elementInk({ ...base, type: "freedraw", points, rotation: 1 })
        ).toEqual([points]);
    });

    it("closes a rect outline", () => {
        const [outline] = elementInk({
            ...base,
            type: "path",
            componentType: "rect",
            x: 0,
            y: 0,
            width: 10,
            height: 4,
        });
        expect(outline).toHaveLength(5);
        expect(outline[0]).toEqual(outline[4]);
        expect(outline).toContainEqual([10, 4]);
    });

    it("samples an ellipse inside the bounding box", () => {
        const [outline] = elementInk({
            ...base,
            type: "path",
            componentType: "circle",
            x: 0,
            y: 0,
            width: 10,
            height: 10,
        });
        for (const [x, y] of outline) {
            expect(Math.hypot(x - 5, y - 5)).toBeCloseTo(5, 6);
        }
    });

    it("rotates shape outlines about the bounding box center", () => {
        const [outline] = elementInk({
            ...base,
            type: "path",
            componentType: "rect",
            x: -1,
            y: -1,
            width: 2,
            height: 2,
            rotation: Math.PI / 2,
        });
        expect(outline[0][0]).toBeCloseTo(1, 6);
        expect(outline[0][1]).toBeCloseTo(-1, 6);
    });

    it("falls back to the bounding box for text and images", () => {
        for (const type of ["text", "image", "component"]) {
            const ink = elementInk({
                ...base,
                type,
                x: 0,
                y: 0,
                width: 4,
                height: 4,
            });
            expect(ink).toHaveLength(1);
            expect(ink[0]).toHaveLength(5);
        }
    });

    it("drops degenerate lines from a scene", () => {
        const elements: SubscribedDrawdyElement[] = [
            { id: "1", type: "freedraw", points: [[0, 0]] },
            { id: "2", type: "frame", x: 0, y: 0, width: 1, height: 1 },
            {
                id: "3",
                type: "path",
                componentType: "rect",
                x: 0,
                y: 0,
                width: 2,
                height: 2,
            },
        ];
        expect(sceneInk(elements)).toHaveLength(1);
    });
});

describe("elementBounds", () => {
    it("returns null when geometry is missing", () => {
        expect(elementBounds({ id: "a", type: "text" })).toBeNull();
    });
});
