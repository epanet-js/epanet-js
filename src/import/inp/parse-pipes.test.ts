import { Pipe } from "src/hydraulic-model";
import { parseInp } from "./parse-inp";
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

    const pipe = hydraulicModel.assets.get(pipeId) as Pipe;
    expect(pipe.id).toEqual(pipeId);
    expect(pipe.length).toEqual(length);
    expect(pipe.diameter).toEqual(diameter);
    expect(pipe.roughness).toEqual(roughness);
    expect(pipe.minorLoss).toEqual(minorLoss);
    expect(pipe.status).toEqual("open");
    expect(pipe.connections).toEqual([reservoirId, junctionId]);
    expect(pipe.coordinates).toEqual([
      [10, 20],
      [50, 60],
      [60, 70],
      [30, 40],
    ]);
    expect(hydraulicModel.topology.hasLink(pipe.id)).toBeTruthy();
  });

  it("supports case insensitive references", () => {
    stubFeatureOn("FLAG_UNIQUE_IDS");
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

    const pipe = hydraulicModel.assets.get("P1") as Pipe;
    expect(pipe.id).toEqual("P1");
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
    expect(pipe.connections).toEqual(["r1", "j1"]);
    expect(hydraulicModel.topology.hasLink(pipe.id)).toBeTruthy();
  });
});
