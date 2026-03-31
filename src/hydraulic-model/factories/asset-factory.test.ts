import { presets } from "src/lib/project-settings/quantities-spec";
import { AssetFactory } from "./asset-factory";
import { ConsecutiveIdsGenerator } from "src/lib/id-generator";
import { LabelManager } from "../label-manager";

describe("asset factory", () => {
  it("assigns an id when not provided", () => {
    const assetFactory = new AssetFactory(
      presets.LPS.defaults,
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
