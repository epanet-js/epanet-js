import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { USelection } from "src/selection";
import { largestContainedSet, newSelectionSet } from "./selection-sets";

const aModel = () =>
  HydraulicModelBuilder.with()
    .aJunction(1)
    .aJunction(2)
    .aJunction(3)
    .aJunction(4)
    .aCustomerPoint(7, { coordinates: [0, 0] })
    .build();

describe("largestContainedSet", () => {
  it("finds a set the selection fully contains", () => {
    const north = newSelectionSet("North", USelection.fromAssetIds([1, 2]));

    const matched = largestContainedSet(
      [north],
      USelection.fromAssetIds([1, 2, 3]),
      aModel(),
    );

    expect(matched).toEqual(north.id);
  });

  it("ignores a set the selection only partly covers", () => {
    const north = newSelectionSet("North", USelection.fromAssetIds([1, 2]));

    const matched = largestContainedSet(
      [north],
      USelection.fromAssetIds([1, 3]),
      aModel(),
    );

    expect(matched).toBeNull();
  });

  it("matches nothing while nothing is selected", () => {
    const north = newSelectionSet("North", USelection.fromAssetIds([1, 2]));

    expect(
      largestContainedSet([north], USelection.none(), aModel()),
    ).toBeNull();
  });

  it("prefers the largest of several contained sets", () => {
    const small = newSelectionSet("Small", USelection.fromAssetIds([1, 2]));
    const large = newSelectionSet("Large", USelection.fromAssetIds([1, 2, 3]));

    const matched = largestContainedSet(
      [small, large],
      USelection.fromAssetIds([1, 2, 3, 4]),
      aModel(),
    );

    expect(matched).toEqual(large.id);
  });

  it("keeps the earlier set when two contained sets are the same size", () => {
    const first = newSelectionSet("First", USelection.fromAssetIds([1, 2]));
    const second = newSelectionSet("Second", USelection.fromAssetIds([3, 4]));

    const matched = largestContainedSet(
      [first, second],
      USelection.fromAssetIds([1, 2, 3, 4]),
      aModel(),
    );

    expect(matched).toEqual(first.id);
  });

  it("requires the customer points of a set as well as its assets", () => {
    const mixed = newSelectionSet("Mixed", USelection.fromIds([1], [7]));

    expect(
      largestContainedSet([mixed], USelection.fromAssetIds([1, 2]), aModel()),
    ).toBeNull();
    expect(
      largestContainedSet([mixed], USelection.fromIds([1, 2], [7]), aModel()),
    ).toEqual(mixed.id);
  });

  it("disregards members that no longer exist in the model", () => {
    const north = newSelectionSet(
      "North",
      USelection.fromAssetIds([1, 2, 999]),
    );

    const matched = largestContainedSet(
      [north],
      USelection.fromAssetIds([1, 2]),
      aModel(),
    );

    expect(matched).toEqual(north.id);
  });

  it("never matches a set whose members are all gone", () => {
    const gone = newSelectionSet("Gone", USelection.fromAssetIds([998, 999]));

    const matched = largestContainedSet(
      [gone],
      USelection.fromAssetIds([1]),
      aModel(),
    );

    expect(matched).toBeNull();
  });
});
