import { stepAlignmentOf } from "./step-alignment";

const HOUR = 3600;
const MINUTE = 60;

const every = (step: number, count: number, offset = 0) =>
  Array.from({ length: count }, (_, index) => offset + index * step);

describe("stepAlignmentOf", () => {
  it("matches readings taken at every report step", () => {
    expect(stepAlignmentOf({ times: every(HOUR, 5) }, HOUR)).toEqual(
      "matching",
    );
  });

  it("matches readings with gaps when the rest fall on every report step", () => {
    const times = [0, HOUR, 2 * HOUR, 5 * HOUR, 6 * HOUR];

    expect(stepAlignmentOf({ times }, HOUR)).toEqual("matching");
  });

  it("finds readings taken every few report steps", () => {
    expect(stepAlignmentOf({ times: every(2 * HOUR, 5) }, HOUR)).toEqual(
      "multiple",
    );
  });

  it("finds readings taken several times per report step", () => {
    expect(stepAlignmentOf({ times: every(15 * MINUTE, 9) }, HOUR)).toEqual(
      "fraction",
    );
  });

  it("calls a single reading sparse, as it has no interval to compare", () => {
    expect(stepAlignmentOf({ times: [HOUR] }, HOUR)).toEqual("sparse");
  });

  it("finds readings that never meet the report steps", () => {
    expect(
      stepAlignmentOf({ times: every(HOUR, 5, 5 * MINUTE) }, HOUR),
    ).toEqual("misaligned");
    expect(stepAlignmentOf({ times: every(25 * MINUTE, 9) }, HOUR)).toEqual(
      "misaligned",
    );
  });
});
