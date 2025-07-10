import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { Pipe } from "../asset-types";
import { changePipeStatus } from "./change-pipe-status";

describe("change status", () => {
  it("can close an open pipe", () => {
    const pipeId = "pipeID";
    const hydraulicModel = HydraulicModelBuilder.with()
      .aPipe(pipeId, { status: "open" })
      .build();
    const { putAssets } = changePipeStatus(hydraulicModel, {
      pipeId,
      newStatus: "closed",
    });

    expect(putAssets!.length).toEqual(1);
    const updatedPipe = putAssets![0] as Pipe;
    expect(updatedPipe.id).toEqual(pipeId);
    expect(updatedPipe.status).toEqual("closed");
  });

  it("can open a closed pipe", () => {
    const pipeId = "pipeID";
    const hydraulicModel = HydraulicModelBuilder.with()
      .aPipe(pipeId, { status: "closed" })
      .build();
    const { putAssets } = changePipeStatus(hydraulicModel, {
      pipeId,
      newStatus: "open",
    });

    expect(putAssets!.length).toEqual(1);
    const updatedPipe = putAssets![0] as Pipe;
    expect(updatedPipe.id).toEqual(pipeId);
    expect(updatedPipe.status).toEqual("open");
  });

  it("can set pipe status to CV", () => {
    const pipeId = "pipeID";
    const hydraulicModel = HydraulicModelBuilder.with()
      .aPipe(pipeId, { status: "open" })
      .build();
    const { putAssets } = changePipeStatus(hydraulicModel, {
      pipeId,
      newStatus: "CV",
    });

    expect(putAssets!.length).toEqual(1);
    const updatedPipe = putAssets![0] as Pipe;
    expect(updatedPipe.id).toEqual(pipeId);
    expect(updatedPipe.status).toEqual("CV");
  });

  it("can change from CV to open", () => {
    const pipeId = "pipeID";
    const hydraulicModel = HydraulicModelBuilder.with()
      .aPipe(pipeId, { status: "CV" })
      .build();
    const { putAssets } = changePipeStatus(hydraulicModel, {
      pipeId,
      newStatus: "open",
    });

    expect(putAssets!.length).toEqual(1);
    const updatedPipe = putAssets![0] as Pipe;
    expect(updatedPipe.id).toEqual(pipeId);
    expect(updatedPipe.status).toEqual("open");
  });
});
