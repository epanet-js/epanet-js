import { Quantities, presets } from "src/model-metadata/quantities-spec";
import { AssetBuilder } from "./asset-builder";
import { ConsecutiveIdsGenerator } from "src/lib/id-generator";
import { LabelManager } from "./label-manager";

describe("asset builder", () => {
  it("assigns an id when not provided", () => {
    const quantities = new Quantities(presets.LPS);
    const assetBuilder = new AssetBuilder(
      quantities.defaults,
      new ConsecutiveIdsGenerator(),
      new LabelManager(),
    );

    const pipe = assetBuilder.buildPipe();

    expect(pipe.id).not.toBeUndefined();
    expect(typeof pipe.id).toBe("number");
    expect(pipe.label).toEqual("P1");

    const other = assetBuilder.buildPipe();
    expect(other.id).not.toEqual(pipe.id);
  });
});
