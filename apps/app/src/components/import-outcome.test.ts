import { describeIssue, groupErrors } from "./import-outcome";

const translate = (key: string, ...args: string[]) =>
  [key.split(".").pop(), ...args].join("|");

const describeAll = (errors: Parameters<typeof groupErrors>[0]) =>
  groupErrors(errors).map((issue) => describeIssue(issue, translate, "keys"));

describe("describeIssue", () => {
  it("lists the rows of an issue", () => {
    expect(
      describeAll([
        { code: "badTime", row: 5 },
        { code: "badTime", row: 6 },
      ]),
    ).toEqual(["atRows|badTime|5, 6"]);
  });

  it("lists the columns of an issue", () => {
    expect(
      describeAll([
        { code: "noReadings", column: 2 },
        { code: "noReadings", column: 4 },
      ]),
    ).toEqual(["atColumns|noReadings|2, 4"]);
  });

  it("keeps the rows of each column apart", () => {
    expect(
      describeAll([
        { code: "notANumber", column: 2, row: 5 },
        { code: "notANumber", column: 2, row: 6 },
        { code: "notANumber", column: 3, row: 5 },
      ]),
    ).toEqual([
      "atRows|atColumn|notANumber|2|5, 6",
      "atRow|atColumn|notANumber|3|5",
    ]);
  });

  it("lists together the columns with the same rows", () => {
    expect(
      describeAll([
        { code: "notANumber", column: 2, row: 5 },
        { code: "notANumber", column: 2, row: 6 },
        { code: "notANumber", column: 3, row: 5 },
        { code: "notANumber", column: 7, row: 5 },
        { code: "notANumber", column: 7, row: 6 },
      ]),
    ).toEqual([
      "atRows|atColumns|notANumber|2, 7|5, 6",
      "atRow|atColumn|notANumber|3|5",
    ]);
  });

  it("counts the rows beyond the first five", () => {
    expect(
      describeAll(
        [5, 6, 7, 8, 9, 10, 11].map((row) => ({ code: "badTime", row })),
      ),
    ).toEqual(["atRows|badTime|andMoreRows|5, 6, 7, 8, 9|2"]);
  });
});
