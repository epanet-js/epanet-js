import { Quantities, presets } from "src/model-metadata/quantities-spec";
import { AssetBuilder } from "./asset-builder";
import { IdGenerator } from "./id-generator";
import { LabelManager } from "./label-manager";
import { stubFeatureOn } from "src/__helpers__/feature-flags";

describe("asset builder", () => {
  it("assigns an id when not provided", () => {
    stubFeatureOn("FLAG_UNIQUE_IDS");
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
    expect(pipe.label).toEqual("P1");

    const other = assetBuilder.buildPipe();
    expect(other.id).not.toEqual(pipe.id);
  });
});
