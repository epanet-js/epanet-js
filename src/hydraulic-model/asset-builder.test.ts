import { Quantities, presets } from "src/settings/quantities-spec";
import { AssetBuilder } from "./asset-builder";

describe("asset builder", () => {
  it("assigns an id when not provided", () => {
    const quantities = new Quantities(presets.si);
    const assetBuilder = new AssetBuilder(
      quantities.units,
      quantities.defaults,
    );

    const pipe = assetBuilder.buildPipe();

    expect(pipe.id).not.toBeUndefined();
    expect(pipe.id.length).toBeLessThanOrEqual(31);

    const other = assetBuilder.buildPipe();
    expect(other.id).not.toEqual(pipe.id);
  });
});
