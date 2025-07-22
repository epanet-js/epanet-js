import { Junction, Pipe, Reservoir } from "src/hydraulic-model";
import { parseInp } from "./parse-inp";
import { getByLabel } from "src/__helpers__/asset-queries";

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
    expect(pipe.initialStatus).toEqual("open");
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
    expect(pipe.initialStatus).toEqual("open");
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
    expect(pipe.initialStatus).toEqual("closed");
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
    expect(pipe.initialStatus).toEqual("open");
    expect(pipe.connections).toEqual([reservoir.id, junction.id]);
    expect(pipe.coordinates).toEqual([
      [10, 20],
      [50, 60],
      [60, 70],
      [30, 40],
    ]);
    expect(hydraulicModel.topology.hasLink(pipe.id)).toBeTruthy();
  });

  it("parses CV status when FLAG_CV is enabled", () => {
    const reservoirId = "r1";
    const junctionId = "j1";
    const pipeId = "p1";
    const anyNumber = 10;
    const inp = `
    [RESERVOIRS]
    ${reservoirId}\t${anyNumber}
    [JUNCTIONS]
    ${junctionId}\t${anyNumber}
    [PIPES]
    ${pipeId}\t${reservoirId}\t${junctionId}\t${anyNumber}\t${anyNumber}\t${anyNumber}\t${anyNumber}\tCV

    [COORDINATES]
    ${reservoirId}\t${10}\t${20}
    ${junctionId}\t${30}\t${40}
    `;

    const { hydraulicModel } = parseInp(inp, { enableCV: true });

    const pipe = getByLabel(hydraulicModel.assets, pipeId) as Pipe;
    expect(pipe.initialStatus).toEqual("cv");
  });

  it("converts CV status to open when FLAG_CV is disabled", () => {
    const reservoirId = "r1";
    const junctionId = "j1";
    const pipeId = "p1";
    const anyNumber = 10;
    const inp = `
    [RESERVOIRS]
    ${reservoirId}\t${anyNumber}
    [JUNCTIONS]
    ${junctionId}\t${anyNumber}
    [PIPES]
    ${pipeId}\t${reservoirId}\t${junctionId}\t${anyNumber}\t${anyNumber}\t${anyNumber}\t${anyNumber}\tCV

    [COORDINATES]
    ${reservoirId}\t${10}\t${20}
    ${junctionId}\t${30}\t${40}
    `;

    const { hydraulicModel } = parseInp(inp, { enableCV: false });

    const pipe = getByLabel(hydraulicModel.assets, pipeId) as Pipe;
    expect(pipe.initialStatus).toEqual("open");
  });

  it("handles case insensitive CV status", () => {
    const reservoirId = "r1";
    const junctionId = "j1";
    const pipeId1 = "p1";
    const pipeId2 = "p2";
    const pipeId3 = "p3";
    const anyNumber = 10;
    const inp = `
    [RESERVOIRS]
    ${reservoirId}\t${anyNumber}
    [JUNCTIONS]
    ${junctionId}\t${anyNumber}
    j2\t${anyNumber}
    j3\t${anyNumber}
    [PIPES]
    ${pipeId1}\t${reservoirId}\t${junctionId}\t${anyNumber}\t${anyNumber}\t${anyNumber}\t${anyNumber}\tcv
    ${pipeId2}\tj2\tj3\t${anyNumber}\t${anyNumber}\t${anyNumber}\t${anyNumber}\tCv
    ${pipeId3}\tj3\t${reservoirId}\t${anyNumber}\t${anyNumber}\t${anyNumber}\t${anyNumber}\tCV

    [COORDINATES]
    ${reservoirId}\t${10}\t${20}
    ${junctionId}\t${30}\t${40}
    j2\t${50}\t${60}
    j3\t${70}\t${80}
    `;

    const { hydraulicModel } = parseInp(inp, { enableCV: true });

    const pipe1 = getByLabel(hydraulicModel.assets, pipeId1) as Pipe;
    const pipe2 = getByLabel(hydraulicModel.assets, pipeId2) as Pipe;
    const pipe3 = getByLabel(hydraulicModel.assets, pipeId3) as Pipe;
    expect(pipe1.initialStatus).toEqual("cv");
    expect(pipe2.initialStatus).toEqual("cv");
    expect(pipe3.initialStatus).toEqual("cv");
  });

  it("defaults to backwards compatible behavior without options", () => {
    const reservoirId = "r1";
    const junctionId = "j1";
    const pipeId = "p1";
    const anyNumber = 10;
    const inp = `
    [RESERVOIRS]
    ${reservoirId}\t${anyNumber}
    [JUNCTIONS]
    ${junctionId}\t${anyNumber}
    [PIPES]
    ${pipeId}\t${reservoirId}\t${junctionId}\t${anyNumber}\t${anyNumber}\t${anyNumber}\t${anyNumber}\tCV

    [COORDINATES]
    ${reservoirId}\t${10}\t${20}
    ${junctionId}\t${30}\t${40}
    `;

    const { hydraulicModel } = parseInp(inp);

    const pipe = getByLabel(hydraulicModel.assets, pipeId) as Pipe;
    expect(pipe.initialStatus).toEqual("open");
  });

  it("allows STATUS to override CV pipe", () => {
    const reservoirId = "r1";
    const junctionId = "j1";
    const pipeId = "p1";
    const anyNumber = 10;
    const inp = `
    [RESERVOIRS]
    ${reservoirId}\t${anyNumber}
    [JUNCTIONS]
    ${junctionId}\t${anyNumber}
    [PIPES]
    ${pipeId}\t${reservoirId}\t${junctionId}\t${anyNumber}\t${anyNumber}\t${anyNumber}\t${anyNumber}\tCV

    [STATUS]
    ${pipeId}\tCLOSED

    [COORDINATES]
    ${reservoirId}\t${10}\t${20}
    ${junctionId}\t${30}\t${40}
    `;

    const { hydraulicModel } = parseInp(inp, { enableCV: true });

    const pipe = getByLabel(hydraulicModel.assets, pipeId) as Pipe;
    expect(pipe.initialStatus).toEqual("closed");
  });

  it("overrides non-CV pipe status", () => {
    const reservoirId = "r1";
    const junctionId = "j1";
    const cvPipeId = "p1";
    const regularPipeId = "p2";
    const anyNumber = 10;
    const inp = `
    [RESERVOIRS]
    ${reservoirId}\t${anyNumber}
    [JUNCTIONS]
    ${junctionId}\t${anyNumber}
    j2\t${anyNumber}
    [PIPES]
    ${cvPipeId}\t${reservoirId}\t${junctionId}\t${anyNumber}\t${anyNumber}\t${anyNumber}\t${anyNumber}\tCV
    ${regularPipeId}\tj2\t${junctionId}\t${anyNumber}\t${anyNumber}\t${anyNumber}\t${anyNumber}\tOPEN

    [STATUS]
    ${cvPipeId}\tCLOSED
    ${regularPipeId}\tCLOSED

    [COORDINATES]
    ${reservoirId}\t${10}\t${20}
    ${junctionId}\t${30}\t${40}
    j2\t${50}\t${60}
    `;

    const { hydraulicModel } = parseInp(inp, { enableCV: true });

    const cvPipe = getByLabel(hydraulicModel.assets, cvPipeId) as Pipe;
    const regularPipe = getByLabel(
      hydraulicModel.assets,
      regularPipeId,
    ) as Pipe;
    expect(cvPipe.initialStatus).toEqual("closed");
    expect(regularPipe.initialStatus).toEqual("closed");
  });

  it("ignores CV in STATUS section", () => {
    const reservoirId = "r1";
    const junctionId = "j1";
    const pipeId = "p1";
    const anyNumber = 10;
    const inp = `
    [RESERVOIRS]
    ${reservoirId}\t${anyNumber}
    [JUNCTIONS]
    ${junctionId}\t${anyNumber}
    [PIPES]
    ${pipeId}\t${reservoirId}\t${junctionId}\t${anyNumber}\t${anyNumber}\t${anyNumber}\t${anyNumber}\tOPEN

    [STATUS]
    ${pipeId}\tCV

    [COORDINATES]
    ${reservoirId}\t${10}\t${20}
    ${junctionId}\t${30}\t${40}
    `;

    const { hydraulicModel } = parseInp(inp, { enableCV: true });

    const pipe = getByLabel(hydraulicModel.assets, pipeId) as Pipe;
    expect(pipe.initialStatus).toEqual("open");
  });
});
