/** @vitest-environment jsdom */
import { MAX_SPLIT, MIN_SPLITS, defaultSplits } from "src/state/layout";
import { accumulateResize, solveSplits } from "./resizer";

const bounds = { min: 80, max: 500 };

const drag = (from: number, growths: number[]) =>
  growths.reduce(
    (state, growth) => accumulateResize(state.accumulated, growth, bounds),
    { accumulated: from, value: from },
  );

describe("accumulateResize", () => {
  it("follows the pointer within the bounds", () => {
    expect(accumulateResize(300, 50, bounds).value).toEqual(350);
    expect(accumulateResize(300, -50, bounds).value).toEqual(250);
  });

  it("keeps sub-pixel movement instead of dropping it", () => {
    expect(drag(300, [0.4, 0.4, 0.4, 0.4, 0.4]).value).toEqual(302);
  });

  it("stops at the bound while the pointer runs past it", () => {
    expect(drag(300, [400]).value).toEqual(bounds.max);
    expect(drag(300, [-400]).value).toEqual(bounds.min);
  });

  it("stays at the bound until the pointer comes back to it", () => {
    const pushedPast = drag(300, [400]);

    expect(
      accumulateResize(pushedPast.accumulated, -100, bounds).value,
    ).toEqual(bounds.max);
  });

  it("follows the pointer again once it returns within the bounds", () => {
    const pushedPast = drag(300, [400]);

    expect(
      accumulateResize(pushedPast.accumulated, -250, bounds).value,
    ).toEqual(450);
  });
});

describe("solveSplits", () => {
  const onAWideScreen = (width: number) => {
    window.innerWidth = width;
  };

  it("caps a side panel at the maximum split, however wide the screen", () => {
    onAWideScreen(2560);

    const solved = solveSplits(defaultSplits, "right", 2000, false);

    expect(solved.right).toEqual(MAX_SPLIT);
  });

  it("leaves room for the map on a narrow screen", () => {
    onAWideScreen(500);

    const solved = solveSplits(defaultSplits, "right", 2000, false);

    expect(solved.right).toBeLessThan(MAX_SPLIT);
    expect(solved.right).toBeLessThan(500);
  });

  it("still resizes freely below the maximum", () => {
    onAWideScreen(2560);

    const solved = solveSplits(defaultSplits, "right", 400, false);

    expect(solved.right).toEqual(400);
  });

  it("collapses instead of shrinking past the minimum", () => {
    onAWideScreen(2560);

    const solved = solveSplits(
      defaultSplits,
      "right",
      MIN_SPLITS.right - 1,
      true,
    );

    expect(solved.rightOpen).toBe(false);
  });
});
