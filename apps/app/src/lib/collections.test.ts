import { HydraulicModelBuilder } from "@epanet-js/hydraulic-model-testing";
import { USelection } from "src/selection";
import {
  ancestorGroupIds,
  canMoveGroup,
  childGroups,
  deleteGroupSubtree,
  descendantGroupIds,
  groupPath,
  largestContainedSet,
  moveGroup,
  newSelectionSet,
  setsInGroupSubtree,
} from "./collections";

const aModel = () =>
  HydraulicModelBuilder.with()
    .aJunction(1)
    .aJunction(2)
    .aJunction(3)
    .aJunction(4)
    .aCustomerPoint(7, { coordinates: [0, 0] })
    .aZone({
      id: 9,
      label: "NORTH",
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 0],
            ],
          ],
        ],
      },
      bbox: [0, 0, 1, 1],
    })
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

  it("requires the zones of a set as well as its assets", () => {
    const mixed = newSelectionSet("Mixed", USelection.fromIds([1], [], [9]));

    expect(
      largestContainedSet([mixed], USelection.fromAssetIds([1, 2]), aModel()),
    ).toBeNull();
    expect(
      largestContainedSet(
        [mixed],
        USelection.fromIds([1, 2], [], [9]),
        aModel(),
      ),
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

describe("selection set groups", () => {
  const aGroup = (id: string, parentId: string | null) => ({
    id,
    label: id.toUpperCase(),
    parentId,
  });
  const aSet = (id: string, groupId: string | null) => ({
    id,
    label: id.toUpperCase(),
    selection: USelection.fromAssetIds([1]),
    groupId,
  });

  //  dmas ─┬─ north
  //        └─ south ─── deep
  //  pipes
  const tree = [
    aGroup("dmas", null),
    aGroup("north", "dmas"),
    aGroup("south", "dmas"),
    aGroup("deep", "south"),
    aGroup("pipes", null),
  ];

  it("lists the direct children of a group and the root groups, in order", () => {
    expect(childGroups(tree, "dmas").map((g) => g.id)).toEqual([
      "north",
      "south",
    ]);
    expect(childGroups(tree, null).map((g) => g.id)).toEqual(["dmas", "pipes"]);
  });

  it("collects every nested group below the given one", () => {
    expect(descendantGroupIds(tree, "dmas").sort()).toEqual([
      "deep",
      "north",
      "south",
    ]);
    expect(descendantGroupIds(tree, "deep")).toEqual([]);
  });

  it("terminates on a cycle it is handed", () => {
    const cyclic = [aGroup("a", "b"), aGroup("b", "a")];

    expect(descendantGroupIds(cyclic, "a")).toEqual(["b"]);
    expect(groupPath(cyclic, "a")).toEqual(["B", "A"]);
  });

  it("lists the parents of a group from the nearest up to the root", () => {
    expect(ancestorGroupIds(tree, "deep")).toEqual(["south", "dmas"]);
    expect(ancestorGroupIds(tree, "dmas")).toEqual([]);
    expect(ancestorGroupIds([aGroup("a", "b"), aGroup("b", "a")], "a")).toEqual(
      ["b"],
    );
  });

  it("lists the labels from the root down to the group", () => {
    expect(groupPath(tree, "deep")).toEqual(["DMAS", "SOUTH", "DEEP"]);
    expect(groupPath([aGroup("orphan", "gone")], "orphan")).toEqual(["ORPHAN"]);
  });

  it("lets a group move anywhere but into itself or its own subtree", () => {
    expect(canMoveGroup(tree, "south", null)).toBe(true);
    expect(canMoveGroup(tree, "south", "pipes")).toBe(true);
    expect(canMoveGroup(tree, "south", "north")).toBe(true);
    expect(canMoveGroup(tree, "south", "south")).toBe(false);
    expect(canMoveGroup(tree, "south", "deep")).toBe(false);
    expect(canMoveGroup(tree, "dmas", "deep")).toBe(false);
    expect(canMoveGroup(tree, "south", "gone")).toBe(false);
  });

  it("re-parents a group and leaves the rest untouched", () => {
    const moved = moveGroup(tree, "south", "pipes");

    expect(moved.find((g) => g.id === "south")?.parentId).toBe("pipes");
    expect(moved.filter((g) => g.id !== "south")).toEqual(
      tree.filter((g) => g.id !== "south"),
    );
  });

  it("counts the sets held anywhere below a group, not only its own", () => {
    const sets = [
      aSet("north-a", "north"),
      aSet("deep-a", "deep"),
      aSet("mains", "pipes"),
      aSet("root-set", null),
    ];

    expect(setsInGroupSubtree(tree, sets, "dmas").map((s) => s.id)).toEqual([
      "north-a",
      "deep-a",
    ]);
    expect(setsInGroupSubtree(tree, sets, "south").map((s) => s.id)).toEqual([
      "deep-a",
    ]);
    expect(setsInGroupSubtree(tree, sets, "north")).toHaveLength(1);
  });

  it("removes a group with its nested groups and the sets inside any of them", () => {
    const sets = [
      aSet("north-a", "north"),
      aSet("deep-a", "deep"),
      aSet("dmas-a", "dmas"),
      aSet("mains", "pipes"),
      aSet("root-set", null),
    ];

    const result = deleteGroupSubtree(tree, sets, "dmas");

    expect(result.groups.map((g) => g.id)).toEqual(["pipes"]);
    expect(result.sets.map((s) => s.id)).toEqual(["mains", "root-set"]);
    expect(result.removedGroupIds.sort()).toEqual([
      "deep",
      "dmas",
      "north",
      "south",
    ]);
    expect(result.removedSetIds.sort()).toEqual([
      "deep-a",
      "dmas-a",
      "north-a",
    ]);
  });
});
