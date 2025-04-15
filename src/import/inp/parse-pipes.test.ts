import { Junction, Pipe, Reservoir } from "src/hydraulic-model";
import { parseInp } from "./parse-inp";
import { getByLabel } from "src/__helpers__/asset-queries";
import { stubFeatureOn } from "src/__helpers__/feature-flags";

describe("parse pipes", () => {
  it("includes pipes in the model", () => {
    const reservoirId = "r1";
    const junctionId = "j1";
    const pipeId = "p1";
    const length = 10;
    const diameter = 100;
    const roughness = 0.1;
    const minorLoss = 0.2;
    const status = "Open";
    const anyNumber = 10;
    const inp = `
    [RESERVOIRS]
    ${reservoirId}\t${anyNumber}
    [JUNCTIONS]
    ${junctionId}\t${anyNumber}
    [PIPES]
    ${pipeId}\t${reservoirId}\t${junctionId}\t${length}\t${diameter}\t${roughness}\t${minorLoss}\t${status}

    [COORDINATES]
    ${reservoirId}\t${10}\t${20}
    ${junctionId}\t${30}\t${40}


    [VERTICES]
    ${pipeId}\t${50}\t${60}
    ${pipeId}\t${60}\t${70}
    `;

    const { hydraulicModel } = parseInp(inp);

    const pipe = getByLabel(hydraulicModel.assets, pipeId) as Pipe;
    const junction = getByLabel(hydraulicModel.assets, junctionId) as Junction;
    const reservoir = getByLabel(
      hydraulicModel.assets,
      reservoirId,
    ) as Reservoir;
    expect(pipe.length).toEqual(length);
    expect(pipe.diameter).toEqual(diameter);
    expect(pipe.roughness).toEqual(roughness);
    expect(pipe.minorLoss).toEqual(minorLoss);
    expect(pipe.status).toEqual("open");
    expect(pipe.connections).toEqual([reservoir.id, junction.id]);
    expect(pipe.coordinates).toEqual([
      [10, 20],
      [50, 60],
      [60, 70],
      [30, 40],
    ]);
    expect(hydraulicModel.topology.hasLink(pipe.id)).toBeTruthy();
  });

  it("supports case insensitive references", () => {
    const length = 10;
    const diameter = 100;
    const roughness = 0.1;
    const minorLoss = 0.2;
    const status = "Open";
    const anyNumber = 10;
    const inp = `
    [RESERVOIRS]
    r1\t${anyNumber}
    [JUNCTIONS]
    j1\t${anyNumber}
    [PIPES]
    P1\tR1\tJ1\t${length}\t${diameter}\t${roughness}\t${minorLoss}\t${status}

    [COORDINATES]
    r1\t${10}\t${20}
    J1\t${30}\t${40}


    [VERTICES]
    p1\t${50}\t${60}
    P1\t${60}\t${70}
    `;

    const { hydraulicModel } = parseInp(inp);

    const pipe = getByLabel(hydraulicModel.assets, "P1") as Pipe;
    const junction = getByLabel(hydraulicModel.assets, "j1") as Junction;
    const reservoir = getByLabel(hydraulicModel.assets, "r1") as Reservoir;
    expect(pipe.length).toEqual(length);
    expect(pipe.diameter).toEqual(diameter);
    expect(pipe.roughness).toEqual(roughness);
    expect(pipe.minorLoss).toEqual(minorLoss);
    expect(pipe.status).toEqual("open");
    expect(pipe.coordinates).toEqual([
      [10, 20],
      [50, 60],
      [60, 70],
      [30, 40],
    ]);
    expect(pipe.connections).toEqual([reservoir.id, junction.id]);
    expect(hydraulicModel.topology.hasLink(pipe.id)).toBeTruthy();
  });

  it("overrides pipe status if in section", () => {
    stubFeatureOn("FLAG_PUMP");

    const pipeId = "p1";
    const anyNumber = 10;
    const inp = `
    [JUNCTIONS]
    j1\t${anyNumber}
    j2\t${anyNumber}
    [PIPES]
    ${pipeId}\tj1\tj2\t${anyNumber}\t${anyNumber}\t${anyNumber}\t${anyNumber}\tOPEN

    [STATUS]
    ${pipeId}\tCLOSED

    [COORDINATES]
    j1\t10\t10
    j2\t10\t10
    `;

    const { hydraulicModel } = parseInp(inp);

    const pipe = getByLabel(hydraulicModel.assets, pipeId) as Pipe;
    expect(pipe.status).toEqual("closed");
  });

  it("can handle a pipe without status", () => {
    const reservoirId = "r1";
    const junctionId = "j1";
    const pipeId = "p1";
    const length = 10;
    const diameter = 100;
    const roughness = 0.1;
    const minorLoss = 0.2;
    const anyNumber = 10;
    const inp = `
    [RESERVOIRS]
    ${reservoirId}\t${anyNumber}
    [JUNCTIONS]
    ${junctionId}\t${anyNumber}
    [PIPES]
    ${pipeId}\t${reservoirId}\t${junctionId}\t${length}\t${diameter}\t${roughness}\t${minorLoss}

    [COORDINATES]
    ${reservoirId}\t${10}\t${20}
    ${junctionId}\t${30}\t${40}


    [VERTICES]
    ${pipeId}\t${50}\t${60}
    ${pipeId}\t${60}\t${70}
    `;

    const { hydraulicModel } = parseInp(inp);

    const pipe = getByLabel(hydraulicModel.assets, pipeId) as Pipe;
    const junction = getByLabel(hydraulicModel.assets, junctionId) as Junction;
    const reservoir = getByLabel(
      hydraulicModel.assets,
      reservoirId,
    ) as Reservoir;
    expect(pipe.id).not.toBeUndefined();
    expect(pipe.length).toEqual(length);
    expect(pipe.diameter).toEqual(diameter);
    expect(pipe.roughness).toEqual(roughness);
    expect(pipe.minorLoss).toEqual(minorLoss);
    expect(pipe.status).toEqual("open");
    expect(pipe.connections).toEqual([reservoir.id, junction.id]);
    expect(pipe.coordinates).toEqual([
      [10, 20],
      [50, 60],
      [60, 70],
      [30, 40],
    ]);
    expect(hydraulicModel.topology.hasLink(pipe.id)).toBeTruthy();
  });
});
