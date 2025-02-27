import { Quantities, presets } from "src/model-metadata/quantities-spec";
import { AssetBuilder } from "./asset-builder";
import { IdGenerator } from "./id-generator";
import { LabelManager } from "./label-manager";

describe("asset builder", () => {
  it("assigns an id when not provided", () => {
    const quantities = new Quantities(presets.LPS);
    const assetBuilder = new AssetBuilder(
      quantities.units,
      quantities.defaults,
      new IdGenerator(),
      new LabelManager(),
    );

    const pipe = assetBuilder.buildPipe();

    expect(pipe.id).not.toBeUndefined();
    expect(pipe.id.length).toBeLessThanOrEqual(31);
    expect(pipe.label).toEqual(String(pipe.id));

    const other = assetBuilder.buildPipe();
    expect(other.id).not.toEqual(pipe.id);
  });
});
