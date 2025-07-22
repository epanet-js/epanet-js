import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { buildInp } from "./build-inp";
import { presets } from "src/model-metadata/quantities-spec";

describe("build inp", () => {
  it("adds reservoirs", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aReservoir("r1", {
        head: 10,
      })
      .aReservoir("r2", {
        head: 20,
      })
      .build();

    const inp = buildInp(hydraulicModel);

    expect(inp).toContain("[RESERVOIRS]");
    expect(inp).toContain("r1\t10");
    expect(inp).toContain("r2\t20");
  });

  it("adds junctions", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("j1", {
        elevation: 10,
        baseDemand: 1,
      })
      .aJunction("j2", {
        elevation: 20,
        baseDemand: 2,
      })
      .build();

    const inp = buildInp(hydraulicModel);

    expect(inp).toContain("[JUNCTIONS]");
    expect(inp).toContain("j1\t10");
    expect(inp).toContain("j2\t20");
    expect(inp).toContain("[DEMANDS]");
    expect(inp).toContain("j1\t1");
    expect(inp).toContain("j2\t2");
  });

  it("adds pipes", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode("node1")
      .aNode("node2")
      .aNode("node3")
      .aPipe("pipe1", {
        startNodeId: "node1",
        endNodeId: "node2",
        length: 10,
        diameter: 100,
        roughness: 1,
        status: "open",
      })
      .aPipe("pipe2", {
        startNodeId: "node2",
        endNodeId: "node3",
        length: 20,
        diameter: 200,
        roughness: 2,
        status: "closed",
      })
      .build();

    const inp = buildInp(hydraulicModel);

    expect(inp).toContain("[PIPES]");
    expect(inp).toContain("pipe1\tnode1\tnode2\t10\t100\t1\t0\tOpen");
    expect(inp).toContain("pipe2\tnode2\tnode3\t20\t200\t2\t0\tClosed");
  });

  it("adds pipes with check valve status", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode("node1")
      .aNode("node2")
      .aPipe("cvPipe", {
        startNodeId: "node1",
        endNodeId: "node2",
        length: 15,
        diameter: 150,
        roughness: 1.5,
        status: "cv",
      })
      .build();

    const inp = buildInp(hydraulicModel);

    expect(inp).toContain("[PIPES]");
    expect(inp).toContain("cvPipe\tnode1\tnode2\t15\t150\t1.5\t0\tCV");
  });

  it("adds valves", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode("node1")
      .aNode("node2")
      .aNode("node3")
      .aValve("valve1", {
        startNodeId: "node1",
        endNodeId: "node2",
        initialStatus: "active",
        setting: 10,
        diameter: 20,
        kind: "tcv",
        minorLoss: 0.1,
      })
      .aValve("valve2", {
        startNodeId: "node2",
        endNodeId: "node3",
        initialStatus: "closed",
        setting: 12,
        diameter: 22,
        kind: "tcv",
        minorLoss: 0.2,
      })
      .build();

    const inp = buildInp(hydraulicModel);

    expect(inp).toContain("[VALVES]");
    expect(inp).toContain("valve1\tnode1\tnode2\t20\tTCV\t10\t0.1");
    expect(inp).toContain("valve2\tnode2\tnode3\t22\tTCV\t12\t0.2");
    expect(inp).toContain("[STATUS]");
    expect(inp).toContain("valve2\tClosed");
  });

  it("adds pumps with a curve", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode("node1")
      .aNode("node2")
      .aNode("node3")
      .aPump("pump1", {
        startNodeId: "node1",
        endNodeId: "node2",
        initialStatus: "on",
        definitionType: "flow-vs-head",
        designFlow: 20,
        designHead: 40,
        speed: 0.8,
      })
      .build();

    const inp = buildInp(hydraulicModel);

    expect(inp).toContain("[PUMPS]");
    expect(inp).toContain("pump1\tnode1\tnode2\tHEAD pump1\tSPEED 0.8");
    expect(inp).toContain("[CURVES]");
    expect(inp).toContain("pump1\t20\t40");
  });

  it("adds pumps with power definition", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode("node1")
      .aNode("node2")
      .aNode("node3")
      .aPump("pump1", {
        startNodeId: "node1",
        endNodeId: "node2",
        initialStatus: "on",
        definitionType: "power",
        designFlow: 20,
        designHead: 40,
        speed: 0.7,
        power: 100,
      })
      .build();

    const inp = buildInp(hydraulicModel);

    expect(inp).toContain("[PUMPS]");
    expect(inp).toContain("pump1\tnode1\tnode2\tPOWER 100\tSPEED 0.7");
    expect(inp).toContain("[CURVES]");
    expect(inp).not.toContain("pump1\t20\t40");
  });

  it("does not include status for pumps when speed not 1", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode("node1")
      .aNode("node2")
      .aNode("node3")
      .aNode("node4")
      .aPump("pump1", {
        startNodeId: "node1",
        endNodeId: "node2",
        initialStatus: "on",
        definitionType: "power",
        speed: 0.7,
        power: 10,
      })
      .aPump("pump2", {
        startNodeId: "node2",
        endNodeId: "node3",
        initialStatus: "off",
        definitionType: "power",
        speed: 0.8,
        power: 20,
      })
      .aPump("pump3", {
        startNodeId: "node3",
        endNodeId: "node4",
        initialStatus: "on",
        definitionType: "power",
        speed: 1,
        power: 30,
      })
      .build();

    const inp = buildInp(hydraulicModel);

    expect(inp).toContain("[PUMPS]");
    expect(inp).toContain("pump1\tnode1\tnode2\tPOWER 10\tSPEED 0.7");
    expect(inp).toContain("pump2\tnode2\tnode3\tPOWER 20\tSPEED 0.8");
    expect(inp).toContain("pump3\tnode3\tnode4\tPOWER 30\tSPEED 1");
    expect(inp).toContain("[STATUS]");
    expect(inp).toContain("pump1\t0.7");
    expect(inp).toContain("pump2\tClosed");
    expect(inp).toContain("pump3\tOpen");
  });

  it("includes simulation settings", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .demandMultiplier(10)
      .build();

    const inp = buildInp(hydraulicModel);

    expect(inp).toContain("[TIMES]");
    expect(inp).toContain("Duration\t0");

    expect(inp).toContain("[REPORT]");
    expect(inp).toContain("Status\tFULL");
    expect(inp).toContain("Summary\tNo");
    expect(inp).toContain("Page\t0");

    expect(inp).toContain("[OPTIONS]");
    expect(inp).toContain("Accuracy\t0.001");
    expect(inp).toContain("Units\tLPS");
    expect(inp).toContain("Quality\tNONE");
    expect(inp).toContain("Headloss\tH-W");
    expect(inp).toContain("Demand Multiplier\t10");

    expect(inp.split("\n").at(-1)).toEqual("[END]");
  });

  it("includes visualization settings for epanet", () => {
    const hydraulicModel = HydraulicModelBuilder.with().build();

    const inp = buildInp(hydraulicModel, {
      geolocation: true,
    });

    expect(inp).toContain("[BACKDROP]");
    expect(inp).toContain("Units\tDEGREES");
  });

  it("includes haadloss formula", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .headlossFormula("D-W")
      .build();

    const inp = buildInp(hydraulicModel);

    expect(inp).toContain("Headloss\tD-W");
  });

  it("detects units based on the flow units of the model", () => {
    const hydraulicModel = HydraulicModelBuilder.with(presets.GPM).build();

    const inp = buildInp(hydraulicModel);

    expect(inp).toContain("Units\tGPM");
  });

  it("includes geographical info when requested", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("j1", { coordinates: [10, 1] })
      .aJunction("j2", { coordinates: [20, 2] })
      .aJunction("j3", { coordinates: [30, 3] })
      .aPipe("p1", {
        startNodeId: "j1",
        endNodeId: "j2",
        coordinates: [
          [10, 1],
          [14, 1],
          [15, 1],
          [20, 2],
        ],
      })
      .aValve("v1", {
        startNodeId: "j2",
        endNodeId: "j3",
        coordinates: [
          [20, 2],
          [20, 2.1],
          [20, 2.4],
          [30, 3],
        ],
      })
      .build();

    const without = buildInp(hydraulicModel);
    expect(without).not.toContain("[COORDINATES]");
    expect(without).not.toContain("[VERTICES]");

    const inp = buildInp(hydraulicModel, {
      geolocation: true,
    });

    expect(inp).toContain("[COORDINATES]");
    expect(inp).toContain("j1\t10\t1");
    expect(inp).toContain("j2\t20\t2");
    expect(inp).toContain("j3\t30\t3");

    expect(inp).toContain("[VERTICES]");
    expect(inp).toContain("p1\t14\t1");
    expect(inp).toContain("p1\t15\t1");
    expect(inp).toContain("v1\t20\t2.1");
    expect(inp).toContain("v1\t20\t2.4");
  });

  it("signals that inp has been built by this app", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("junction1", { coordinates: [10, 1] })
      .build();

    const inp = buildInp(hydraulicModel, {
      madeBy: true,
    });

    expect(inp).toContain(";MADE BY EPANET-JS");
    expect(inp).toContain("junction1");
  });

  it("adds tanks", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aTank("t1", {
        elevation: 100,
        initialLevel: 15,
        minLevel: 5,
        maxLevel: 25,
        diameter: 120,
        minVolume: 14,
        coordinates: [10, 20],
      })
      .aTank("t2", {
        elevation: 200,
        initialLevel: 10,
        minLevel: 0,
        maxLevel: 30,
        diameter: 50,
        minVolume: 10,
        overflow: true,
        coordinates: [30, 40],
      })
      .build();

    const inp = buildInp(hydraulicModel, {
      geolocation: true,
    });

    expect(inp).toContain("[TANKS]");
    expect(inp).toContain("t1\t100\t15\t5\t25\t120\t14");
    expect(inp).toContain("t2\t200\t10\t0\t30\t50\t10\t*\tYES");
    expect(inp).toContain("[COORDINATES]");
    expect(inp).toContain("t1\t10\t20");
    expect(inp).toContain("t2\t30\t40");
  });

  describe("customer demands", () => {
    it("includes customer demands when enabled", () => {
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction("j1", { elevation: 10, baseDemand: 50 })
        .withCustomerPoint("cp1", "j1", { demand: 25 })
        .build();

      const inp = buildInp(hydraulicModel, { customerDemands: true });

      expect(inp).toContain("[DEMANDS]");
      expect(inp).toContain("j1\t50");
      expect(inp).toContain("j1\t25");
    });

    it("does not include customer demands when disabled", () => {
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction("j1", { elevation: 10, baseDemand: 50 })
        .withCustomerPoint("cp1", "j1", { demand: 25 })
        .build();

      const inp = buildInp(hydraulicModel, { customerDemands: false });

      expect(inp).toContain("[DEMANDS]");
      expect(inp).toContain("j1\t50");
      expect(inp).not.toContain("j1\t25");
    });

    it("skips customer demands when they are zero", () => {
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction("j1", { elevation: 10, baseDemand: 50 })
        .withCustomerPoint("cp1", "j1", { demand: 0 })
        .build();

      const inp = buildInp(hydraulicModel, { customerDemands: true });

      expect(inp).toContain("[DEMANDS]");
      expect(inp).toContain("j1\t50");
      expect(inp).not.toContain("j1\t0");
    });

    it("handles multiple customer points on same junction", () => {
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction("j1", { elevation: 10, baseDemand: 50 })
        .withCustomerPoint("cp1", "j1", { demand: 25 })
        .withCustomerPoint("cp2", "j1", { demand: 30 })
        .build();

      const inp = buildInp(hydraulicModel, { customerDemands: true });

      expect(inp).toContain("[DEMANDS]");
      expect(inp).toContain("j1\t50");
      expect(inp).toContain("j1\t55");
    });
  });
});
