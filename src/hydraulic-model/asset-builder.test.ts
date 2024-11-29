import { stubFeatureOn } from "src/__helpers__/feature-flags";
import { AssetBuilder } from "./asset-builder";

describe("asset builder", () => {
  it("assigns an id when not provided", () => {
    stubFeatureOn("FLAG_INP");
    const assetBuilder = new AssetBuilder();

    const pipe = assetBuilder.buildPipe();

    expect(pipe.id).not.toBeUndefined();
    expect(pipe.id.length).toBeLessThanOrEqual(31);

    const other = assetBuilder.buildPipe();
    expect(other.id).not.toEqual(pipe.id);
  });
});
