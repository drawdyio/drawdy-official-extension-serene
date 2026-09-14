import { SubscribedDrawdyElement } from "@drawdy/driver-protocol";
import { dropStageElements } from "./target";

const box = (
    id: string,
    x: number,
    y: number,
    width: number,
    height: number
): SubscribedDrawdyElement => ({
    id,
    type: "path",
    componentType: "rect",
    x,
    y,
    width,
    height,
});

const ids = (elements: SubscribedDrawdyElement[]): string[] =>
    elements.map((el) => el.id);

describe("dropStageElements", () => {
    it("silences a box that encloses everything else in the region", () => {
        const elements = [
            box("stage", 0, 0, 400, 300),
            box("sketch", 40, 40, 100, 80),
            box("note", 200, 120, 60, 60),
        ];
        expect(ids(dropStageElements(elements, ["stage"]))).toEqual([
            "sketch",
            "note",
        ]);
    });

    it("keeps the stage when it is the only thing there", () => {
        const elements = [box("stage", 0, 0, 400, 300)];
        expect(ids(dropStageElements(elements, ["stage"]))).toEqual(["stage"]);
    });

    it("keeps an element that merely overlaps its neighbours", () => {
        const elements = [
            box("a", 0, 0, 200, 200),
            box("b", 150, 150, 200, 200),
        ];
        expect(ids(dropStageElements(elements, ["a"]))).toEqual(["a", "b"]);
    });

    it("keeps a stroke that only partly covers its neighbour", () => {
        const elements = [
            box("a", 0, 0, 200, 200),
            box("b", 10, 10, 100, 400),
        ];
        expect(ids(dropStageElements(elements, ["a"]))).toEqual(["a", "b"]);
    });

    it("tolerates content sitting exactly on the stage border", () => {
        const elements = [
            box("stage", 0, 0, 400, 300),
            box("edge", 0, 0, 400, 300),
        ];
        expect(ids(dropStageElements(elements, ["stage"]))).toEqual(["edge"]);
    });

    it("drops every stage element when several were selected", () => {
        const elements = [
            box("left", 0, 0, 400, 300),
            box("right", 0, 0, 420, 320),
            box("sketch", 40, 40, 100, 80),
        ];
        expect(ids(dropStageElements(elements, ["left", "right"]))).toEqual([
            "sketch",
        ]);
    });

    it("leaves the region untouched when nothing was selected", () => {
        const elements = [
            box("a", 0, 0, 400, 300),
            box("b", 40, 40, 10, 10),
        ];
        expect(ids(dropStageElements(elements, []))).toEqual(["a", "b"]);
    });
});
