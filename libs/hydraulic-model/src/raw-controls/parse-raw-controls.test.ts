import { describe, expect, it } from "vitest";
import {
  findUnmatchedControlLabels,
  findUnmatchedRuleLabels,
  type LabelResolver,
} from "./parse-raw-controls";

const resolveLabel: LabelResolver = (assetType, label) => {
  const known: Record<string, number> = { "link:P1": 1, "node:T1": 2 };
  return known[`${assetType}:${label.toUpperCase()}`];
};

describe("findUnmatchedControlLabels", () => {
  it("reports nothing when every label matches an asset, ignoring case", () => {
    expect(
      findUnmatchedControlLabels(
        "LINK p1 OPEN IF NODE t1 ABOVE 5\nLINK P1 CLOSED AT TIME 6",
        resolveLabel,
      ),
    ).toEqual([]);
  });

  it("reports each control that names a missing asset, as written", () => {
    expect(
      findUnmatchedControlLabels(
        "LINK P1 OPEN AT TIME 6\nLINK P1 OPEN IF NODE T9 ABOVE 5\n\nLINK PX CLOSED AT TIME 8",
        resolveLabel,
      ),
    ).toEqual([
      {
        text: "LINK P1 OPEN IF NODE T9 ABOVE 5",
        labels: [{ assetType: "node", label: "T9" }],
      },
      {
        text: "LINK PX CLOSED AT TIME 8",
        labels: [{ assetType: "link", label: "PX" }],
      },
    ]);
  });

  it("does not look at the node once the link is missing", () => {
    expect(
      findUnmatchedControlLabels(
        "LINK PX OPEN IF NODE T9 ABOVE 5",
        resolveLabel,
      ),
    ).toEqual([
      {
        text: "LINK PX OPEN IF NODE T9 ABOVE 5",
        labels: [{ assetType: "link", label: "PX" }],
      },
    ]);
  });

  it("reports nothing for empty text", () => {
    expect(findUnmatchedControlLabels("  \n", resolveLabel)).toEqual([]);
  });
});

describe("findUnmatchedRuleLabels", () => {
  it("reports each rule with the labels it names that match no asset", () => {
    const matched = "RULE 1\nIF NODE T1 LEVEL > 5\nTHEN LINK P1 STATUS IS OPEN";
    const unmatched =
      "RULE 2\nIF TANK T9 LEVEL > 5\nTHEN PUMP P1 STATUS IS OPEN\nELSE VALVE V9 STATUS IS CLOSED";

    expect(
      findUnmatchedRuleLabels(`${matched}\n\n${unmatched}`, resolveLabel),
    ).toEqual([
      {
        text: unmatched,
        labels: [
          { assetType: "node", label: "T9" },
          { assetType: "link", label: "V9" },
        ],
      },
    ]);
  });

  it("does not take a SYSTEM clause for an asset", () => {
    expect(
      findUnmatchedRuleLabels(
        "RULE 1\nIF SYSTEM CLOCKTIME >= 8 AM\nTHEN LINK P1 STATUS IS OPEN",
        resolveLabel,
      ),
    ).toEqual([]);
  });

  it("reports nothing for empty text", () => {
    expect(findUnmatchedRuleLabels("", resolveLabel)).toEqual([]);
  });
});
