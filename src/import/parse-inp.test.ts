import { Junction, Pipe, Reservoir } from "src/hydraulic-model";
import { parseInp } from "./parse-inp";

describe("Parse inp", () => {
  it("includes junctions in the model", () => {
    const junctionId = "j1";
    const elevation = 100;
    const lat = 10;
    const lng = 20;
    const demand = 0.1;
    const inp = `
    [JUNCTIONS]
    ${junctionId}\t${elevation}

    [COORDINATES]
    ${junctionId}\t${lng}\t${lat}

    [DEMANDS]
    ${junctionId}\t${demand}
    `;

    const hydraulicModel = parseInp(inp);

    const junction = hydraulicModel.assets.get(junctionId) as Junction;
    expect(junction.id).toEqual(junctionId);
    expect(junction.elevation).toEqual(elevation);
    expect(junction.demand).toEqual(demand);
    expect(junction.coordinates).toEqual([20, 10]);
  });

  it("includes reservoirs in the model", () => {
    const reservoirId = "r1";
    const head = 100;
    const lat = 10;
    const lng = 20;
    const inp = `
    [RESERVOIRS]
    ${reservoirId}\t${head}

    [COORDINATES]
    ${reservoirId}\t${lng}\t${lat}

    `;

    const hydraulicModel = parseInp(inp);

    const reservoir = hydraulicModel.assets.get(reservoirId) as Reservoir;
    expect(reservoir.id).toEqual(reservoirId);
    expect(reservoir.head).toEqual(head);
    expect(reservoir.coordinates).toEqual([20, 10]);
  });

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

    const hydraulicModel = parseInp(inp);

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

  it("ignores comments", () => {
    const reservoirId = "r1";
    const junctionId = "j1";
    const pipeId = "p1";
    const head = 100;
    const lat = 10;
    const lng = 20;
    const inp = `
    [RESERVOIRS]
    ;ID\tHEAD
    ${reservoirId}\t${head};__valuecomment

    [COORDINATES]
    ${reservoirId}\t${lng}\t${lat};__anothercomment

    [JUNCTIONS]
    ${junctionId}\t10
    [PIPES]
    ${pipeId}\t${reservoirId}\t${junctionId}\t10\t10\t10\t10\tOpen;__anothercommnet
    `;

    const hydraulicModel = parseInp(inp);

    const reservoir = hydraulicModel.assets.get(reservoirId) as Reservoir;
    expect(reservoir.id).toEqual(reservoirId);
    expect(reservoir.head).toEqual(100);
    expect(reservoir.coordinates).toEqual([lng, lat]);
    const pipe = hydraulicModel.assets.get(pipeId) as Pipe;
    expect(pipe.status).toEqual("open");
    expect(hydraulicModel.assets.size).toEqual(3);
  });

  it("ignores unsupported sections", () => {
    const reservoirId = "r1";
    const head = 100;
    const lat = 10;
    const lng = 20;
    const inp = `
    [RESERVOIRS]
    ${reservoirId}\t${head}

    [COORDINATES]
    ${reservoirId}\t${lng}\t${lat}

    [EMITTERS]
    ANYTHING
    `;

    const hydraulicModel = parseInp(inp);

    const reservoir = hydraulicModel.assets.get(reservoirId) as Reservoir;
    expect(reservoir.id).toEqual(reservoirId);
    expect(hydraulicModel.assets.size).toEqual(1);
  });

  it("[temporary] converts tanks to reservoirs", () => {
    const tankId = "t1";
    const elevation = 100;
    const initLevel = 20;
    const lng = 10;
    const lat = 20;
    const inp = `
    [TANKS]
    ${tankId}\t${elevation}\t${initLevel}\tANY

    [COORDINATES]
    ${tankId}\t${lng}\t${lat}
    `;

    const hydraulicModel = parseInp(inp);

    const tankAsReservoir = hydraulicModel.assets.get(tankId) as Reservoir;
    expect(tankAsReservoir.head).toEqual(elevation + initLevel);
  });
});
