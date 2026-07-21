import { AssetFactory, LabelManager } from "@epanet-js/hydraulic-model";
import { ConsecutiveIdsGenerator } from "@epanet-js/id-generator";

describe("asset factory", () => {
  it("assigns an id when not provided", () => {
    const assetFactory = new AssetFactory(
      new ConsecutiveIdsGenerator(),
      new LabelManager(),
    );

    const pipe = assetFactory.createPipe();

    expect(pipe.id).not.toBeUndefined();
    expect(typeof pipe.id).toBe("number");
    expect(pipe.label).toEqual("P1");

    const other = assetFactory.createPipe();
    expect(other.id).not.toEqual(pipe.id);
  });
});
