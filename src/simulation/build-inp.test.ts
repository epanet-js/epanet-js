import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { buildInp } from "./build-inp";
import { presets } from "src/model-metadata/quantities-spec";

describe("build inp", () => {
  it("adds reservoirs", () => {
    const IDS = { R1: 1, R2: 2 };
    const hydraulicModel = HydraulicModelBuilder.with()
      .aReservoir(IDS.R1, {
        head: 10,
      })
      .aReservoir(IDS.R2, {
        head: 20,
      })
      .build();

    const inp = buildInp(hydraulicModel);

    expect(inp).toContain("[RESERVOIRS]");
    expect(inp).toContain("1\t10");
    expect(inp).toContain("2\t20");
  });

  it("adds junctions", () => {
    const IDS = { J1: 1, J2: 2 };
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, {
        elevation: 10,
        baseDemand: 1,
      })
      .aJunction(IDS.J2, {
        elevation: 20,
        baseDemand: 2,
      })
      .build();

    const inp = buildInp(hydraulicModel);

    expect(inp).toContain("[JUNCTIONS]");
    expect(inp).toContain("1\t10");
    expect(inp).toContain("2\t20");
    expect(inp).toContain("[DEMANDS]");
    expect(inp).toContain("1\t1");
    expect(inp).toContain("2\t2");
  });

  it("adds pipes", () => {
    const IDS = { NODE1: 1, NODE2: 2, NODE3: 3, PIPE1: 4, PIPE2: 5 };
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode(IDS.NODE1)
      .aNode(IDS.NODE2)
      .aNode(IDS.NODE3)
      .aPipe(IDS.PIPE1, {
        startNodeId: IDS.NODE1,
        endNodeId: IDS.NODE2,
        length: 10,
        diameter: 100,
        roughness: 1,
        initialStatus: "open",
      })
      .aPipe(IDS.PIPE2, {
        startNodeId: IDS.NODE2,
        endNodeId: IDS.NODE3,
        length: 20,
        diameter: 200,
        roughness: 2,
        initialStatus: "closed",
      })
      .build();

    const inp = buildInp(hydraulicModel);

    expect(inp).toContain("[PIPES]");
    expect(inp).toContain("4\t1\t2\t10\t100\t1\t0\tOpen");
    expect(inp).toContain("5\t2\t3\t20\t200\t2\t0\tClosed");
  });

  it("adds pipes with check valve status", () => {
    const IDS = { NODE1: 1, NODE2: 2, CVPIPE: 3 };
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode(IDS.NODE1)
      .aNode(IDS.NODE2)
      .aPipe(IDS.CVPIPE, {
        startNodeId: IDS.NODE1,
        endNodeId: IDS.NODE2,
        length: 15,
        diameter: 150,
        roughness: 1.5,
        initialStatus: "cv",
      })
      .build();

    const inp = buildInp(hydraulicModel);

    expect(inp).toContain("[PIPES]");
    expect(inp).toContain("3\t1\t2\t15\t150\t1.5\t0\tCV");
  });

  it("adds valves", () => {
    const IDS = { NODE1: 1, NODE2: 2, NODE3: 3, VALVE1: 4, VALVE2: 5 };
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode(IDS.NODE1)
      .aNode(IDS.NODE2)
      .aNode(IDS.NODE3)
      .aValve(IDS.VALVE1, {
        startNodeId: IDS.NODE1,
        endNodeId: IDS.NODE2,
        initialStatus: "active",
        setting: 10,
        diameter: 20,
        kind: "tcv",
        minorLoss: 0.1,
      })
      .aValve(IDS.VALVE2, {
        startNodeId: IDS.NODE2,
        endNodeId: IDS.NODE3,
        initialStatus: "closed",
        setting: 12,
        diameter: 22,
        kind: "tcv",
        minorLoss: 0.2,
      })
      .build();

    const inp = buildInp(hydraulicModel);

    expect(inp).toContain("[VALVES]");
    expect(inp).toContain("4\t1\t2\t20\tTCV\t10\t0.1");
    expect(inp).toContain("5\t2\t3\t22\tTCV\t12\t0.2");
    expect(inp).toContain("[STATUS]");
    expect(inp).toContain("5\tClosed");
  });

  it("adds pumps with a curve", () => {
    const IDS = { NODE1: 1, NODE2: 2, NODE3: 3, PUMP1: 4 };
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode(IDS.NODE1)
      .aNode(IDS.NODE2)
      .aNode(IDS.NODE3)
      .aPump(IDS.PUMP1, {
        startNodeId: IDS.NODE1,
        endNodeId: IDS.NODE2,
        initialStatus: "on",
        definitionType: "design-point",
        speed: 0.8,
      })
      .aPumpCurve({ id: String(IDS.PUMP1), points: [{ x: 20, y: 40 }] })
      .build();

    const inp = buildInp(hydraulicModel);

    expect(inp).toContain("[PUMPS]");
    expect(inp).toContain("4\t1\t2\tHEAD 4\tSPEED 0.8");
    expect(inp).toContain("[CURVES]");
    expect(inp).toContain("4\t20\t40");
  });

  it("adds pumps with power definition", () => {
    const IDS = { NODE1: 1, NODE2: 2, NODE3: 3, PUMP1: 4 };
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode(IDS.NODE1)
      .aNode(IDS.NODE2)
      .aNode(IDS.NODE3)
      .aPump(IDS.PUMP1, {
        startNodeId: IDS.NODE1,
        endNodeId: IDS.NODE2,
        initialStatus: "on",
        definitionType: "power",
        speed: 0.7,
        power: 100,
      })
      .aPumpCurve({ id: String(IDS.PUMP1), points: [{ x: 20, y: 40 }] })
      .build();

    const inp = buildInp(hydraulicModel);

    expect(inp).toContain("[PUMPS]");
    expect(inp).toContain("4\t1\t2\tPOWER 100\tSPEED 0.7");
    expect(inp).toContain("[CURVES]");
    expect(inp).not.toContain("4\t20\t40");
  });

  it("does not include status for pumps when speed not 1", () => {
    const IDS = {
      NODE1: 1,
      NODE2: 2,
      NODE3: 3,
      NODE4: 4,
      PUMP1: 5,
      PUMP2: 6,
      PUMP3: 7,
    };
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode(IDS.NODE1)
      .aNode(IDS.NODE2)
      .aNode(IDS.NODE3)
      .aNode(IDS.NODE4)
      .aPump(IDS.PUMP1, {
        startNodeId: IDS.NODE1,
        endNodeId: IDS.NODE2,
        initialStatus: "on",
        definitionType: "power",
        speed: 0.7,
        power: 10,
      })
      .aPump(IDS.PUMP2, {
        startNodeId: IDS.NODE2,
        endNodeId: IDS.NODE3,
        initialStatus: "off",
        definitionType: "power",
        speed: 0.8,
        power: 20,
      })
      .aPump(IDS.PUMP3, {
        startNodeId: IDS.NODE3,
        endNodeId: IDS.NODE4,
        initialStatus: "on",
        definitionType: "power",
        speed: 1,
        power: 30,
      })
      .build();

    const inp = buildInp(hydraulicModel);

    expect(inp).toContain("[PUMPS]");
    expect(inp).toContain("5\t1\t2\tPOWER 10\tSPEED 0.7");
    expect(inp).toContain("6\t2\t3\tPOWER 20\tSPEED 0.8");
    expect(inp).toContain("7\t3\t4\tPOWER 30\tSPEED 1");
    expect(inp).toContain("[STATUS]");
    expect(inp).toContain("5\t0.7");
    expect(inp).toContain("6\tClosed");
    expect(inp).toContain("7\tOpen");
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
    const IDS = { J1: 1, J2: 2, J3: 3, P1: 4, V1: 5 };
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [10, 1] })
      .aJunction(IDS.J2, { coordinates: [20, 2] })
      .aJunction(IDS.J3, { coordinates: [30, 3] })
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        coordinates: [
          [10, 1],
          [14, 1],
          [15, 1],
          [20, 2],
        ],
      })
      .aValve(IDS.V1, {
        startNodeId: IDS.J2,
        endNodeId: IDS.J3,
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
    expect(inp).toContain("1\t10\t1");
    expect(inp).toContain("2\t20\t2");
    expect(inp).toContain("3\t30\t3");

    expect(inp).toContain("[VERTICES]");
    expect(inp).toContain("4\t14\t1");
    expect(inp).toContain("4\t15\t1");
    expect(inp).toContain("5\t20\t2.1");
    expect(inp).toContain("5\t20\t2.4");
  });

  it("signals that inp has been built by this app", () => {
    const IDS = { JUNCTION1: 1 };
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.JUNCTION1, { coordinates: [10, 1] })
      .build();

    const inp = buildInp(hydraulicModel, {
      madeBy: true,
    });

    expect(inp).toContain(";MADE BY EPANET-JS");
    expect(inp).toContain("1");
  });

  it("adds tanks", () => {
    const IDS = { T1: 1, T2: 2 };
    const hydraulicModel = HydraulicModelBuilder.with()
      .aTank(IDS.T1, {
        elevation: 100,
        initialLevel: 15,
        minLevel: 5,
        maxLevel: 25,
        diameter: 120,
        minVolume: 14,
        coordinates: [10, 20],
      })
      .aTank(IDS.T2, {
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
    expect(inp).toContain("1\t100\t15\t5\t25\t120\t14");
    expect(inp).toContain("2\t200\t10\t0\t30\t50\t10\t*\tYES");
    expect(inp).toContain("[COORDINATES]");
    expect(inp).toContain("1\t10\t20");
    expect(inp).toContain("2\t30\t40");
  });

  describe("customer demands", () => {
    it("includes customer demands when enabled", () => {
      const IDS = { J1: 1, P1: 2, CP1: 3 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { elevation: 10, baseDemand: 50 })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J1,
          coordinates: [
            [0, 0],
            [10, 0],
          ],
        })
        .aCustomerPoint(IDS.CP1, {
          demand: 25,
          connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
        })
        .build();

      const inp = buildInp(hydraulicModel, { customerDemands: true });

      expect(inp).toContain("[DEMANDS]");
      expect(inp).toContain("1\t50");
      expect(inp).toContain("1\t25\tepanetjs_customers");
      expect(inp).toContain("[PATTERNS]");
      expect(inp).toContain("epanetjs_customers\t1");
    });

    it("does not include customer demands when disabled", () => {
      const IDS = { J1: 1, P1: 2, CP1: 3 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { elevation: 10, baseDemand: 50 })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J1,
          coordinates: [
            [0, 0],
            [10, 0],
          ],
        })
        .aCustomerPoint(IDS.CP1, {
          demand: 25,
          connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
        })
        .build();

      const inp = buildInp(hydraulicModel, { customerDemands: false });

      expect(inp).toContain("[DEMANDS]");
      expect(inp).toContain("1\t50");
      expect(inp).not.toContain("1\t25");
      expect(inp).not.toContain("[PATTERNS]");
      expect(inp).not.toContain("epanetjs_customers");
    });

    it("skips customer demands when they are zero", () => {
      const IDS = { J1: 1, P1: 2, CP1: 3 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { elevation: 10, baseDemand: 50 })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J1,
          coordinates: [
            [0, 0],
            [10, 0],
          ],
        })
        .aCustomerPoint(IDS.CP1, {
          demand: 0,
          connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
        })
        .build();

      const inp = buildInp(hydraulicModel, { customerDemands: true });

      expect(inp).toContain("[DEMANDS]");
      expect(inp).toContain("1\t50");

      const demandsSection = inp.match(/\[DEMANDS\]([\s\S]*?)\n\n/)?.[1] || "";
      expect(demandsSection).not.toContain("1\t0");
      expect(inp).not.toContain("[PATTERNS]");
      expect(inp).not.toContain("epanetjs_customers");
    });

    it("handles multiple customer points on same junction", () => {
      const IDS = { J1: 1, P1: 2, CP1: 3, CP2: 4 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { elevation: 10, baseDemand: 50 })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J1,
          coordinates: [
            [0, 0],
            [10, 0],
          ],
        })
        .aCustomerPoint(IDS.CP1, {
          demand: 25,
          connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
        })
        .aCustomerPoint(IDS.CP2, {
          demand: 30,
          connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
        })
        .build();

      const inp = buildInp(hydraulicModel, { customerDemands: true });

      expect(inp).toContain("[DEMANDS]");
      expect(inp).toContain("1\t50");
      expect(inp).toContain("1\t55\tepanetjs_customers");
      expect(inp).toContain("[PATTERNS]");
      expect(inp).toContain("epanetjs_customers\t1");
    });
  });

  describe("customer points", () => {
    it("includes customer points section when customer points exist", () => {
      const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4, CP2: 5 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { elevation: 10, coordinates: [1, 2] })
        .aJunction(IDS.J2, { elevation: 20, coordinates: [3, 4] })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
        })
        .aCustomerPoint(IDS.CP1, {
          demand: 2.5,
          coordinates: [1.5, 2.5],
          connection: {
            pipeId: IDS.P1,
            junctionId: IDS.J1,
            snapPoint: [1.2, 2.2],
          },
        })
        .aCustomerPoint(IDS.CP2, {
          demand: 1.8,
          coordinates: [5, 6],
        })
        .build();

      const inp = buildInp(hydraulicModel, { customerPoints: true });

      expect(inp).toContain(";[CUSTOMERS]");
      expect(inp).toContain(
        ";Id\tX-coord\tY-coord\tBaseDemand\tPipeId\tJunctionId\tSnapX\tSnapY",
      );
      expect(inp).toContain(";4\t1.5\t2.5\t2.5\t3\t1\t1.2\t2.2");
      expect(inp).toContain(";5\t5\t6\t1.8\t\t\t\t");
    });

    it("uses junction labels instead of IDs when labelIds is true", () => {
      const IDS = {
        JUNCTION_UUID_123: 1,
        JUNCTION_UUID_456: 2,
        PIPE_UUID_789: 3,
        CP1: 4,
      };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.JUNCTION_UUID_123, {
          elevation: 10,
          coordinates: [1, 2],
          label: "Junction-A",
        })
        .aJunction(IDS.JUNCTION_UUID_456, {
          elevation: 20,
          coordinates: [3, 4],
          label: "Junction-B",
        })
        .aPipe(IDS.PIPE_UUID_789, {
          startNodeId: IDS.JUNCTION_UUID_123,
          endNodeId: IDS.JUNCTION_UUID_456,
          label: "Pipe-1",
        })
        .aCustomerPoint(IDS.CP1, {
          demand: 2.5,
          coordinates: [1.5, 2.5],
          connection: {
            pipeId: IDS.PIPE_UUID_789,
            junctionId: IDS.JUNCTION_UUID_123,
            snapPoint: [1.2, 2.2],
          },
        })
        .build();

      const inp = buildInp(hydraulicModel, {
        customerPoints: true,
        labelIds: true,
      });

      expect(inp).toContain(";4\t1.5\t2.5\t2.5\tPipe-1\tJunction-A\t1.2\t2.2");
    });

    it("does not include customer points section when no customer points exist", () => {
      const IDS = { J1: 1 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { elevation: 10 })
        .build();

      const inp = buildInp(hydraulicModel, { customerPoints: true });

      expect(inp).not.toContain(";[CUSTOMERS]");
    });

    it("does not include customer points section when customerPoints option is disabled", () => {
      const IDS = { J1: 1, CP1: 2 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { elevation: 10 })
        .aCustomerPoint(IDS.CP1, {
          demand: 2.5,
          coordinates: [1.5, 2.5],
        })
        .build();

      const inp = buildInp(hydraulicModel, { customerPoints: false });

      expect(inp).not.toContain(";[CUSTOMERS]");
    });

    it("does not include customer points section by default", () => {
      const IDS = { J1: 1, CP1: 2 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { elevation: 10 })
        .aCustomerPoint(IDS.CP1, {
          demand: 2.5,
          coordinates: [1.5, 2.5],
        })
        .build();

      const inp = buildInp(hydraulicModel);

      expect(inp).not.toContain(";[CUSTOMERS]");
    });
  });

  describe("inactive assets", () => {
    it("excludes inactive assets when inactiveAssets is 'exclude' (default)", () => {
      const IDS = { J1: 1, J2: 2, J3: 3, P1: 4 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { elevation: 10, isActive: true })
        .aJunction(IDS.J2, { elevation: 20, isActive: false })
        .aJunction(IDS.J3, { elevation: 30, isActive: true })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J3,
          isActive: false,
        })
        .build();

      const inp = buildInp(hydraulicModel);

      expect(inp).toContain("[JUNCTIONS]");
      expect(inp).toContain("1\t10");
      expect(inp).not.toContain("2\t20");
      expect(inp).toContain("3\t30");
      expect(inp).toContain("[PIPES]");
      expect(inp).not.toContain("4\t1\t3");
    });

    it("includes inactive assets as comments when inactiveAssets is 'comment'", () => {
      const IDS = { J1: 1, J2: 2, J3: 3, P1: 4 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { elevation: 10, isActive: true })
        .aJunction(IDS.J2, { elevation: 20, isActive: false })
        .aJunction(IDS.J3, { elevation: 30, isActive: true })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J3,
          isActive: false,
        })
        .build();

      const inp = buildInp(hydraulicModel, { inactiveAssets: true });

      expect(inp).toContain("[JUNCTIONS]");
      expect(inp).toContain("1\t10");
      expect(inp).toContain(";2\t20");
      expect(inp).toContain("3\t30");
      expect(inp).toContain("[PIPES]");
      expect(inp).toContain(";4\t1\t3");
    });

    it("comments out coordinates and vertices for inactive assets", () => {
      const IDS = { J1: 1, J2: 2, P1: 3 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, {
          elevation: 10,
          coordinates: [10, 20],
          isActive: false,
        })
        .aJunction(IDS.J2, {
          elevation: 20,
          coordinates: [30, 40],
          isActive: true,
        })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          coordinates: [
            [10, 20],
            [15, 25],
            [20, 30],
            [30, 40],
          ],
          isActive: false,
        })
        .build();

      const inp = buildInp(hydraulicModel, {
        geolocation: true,
        inactiveAssets: true,
      });

      expect(inp).toContain("[COORDINATES]");
      expect(inp).toContain(";1\t10\t20");
      expect(inp).toContain("2\t30\t40");
      expect(inp).toContain("[VERTICES]");
      expect(inp).toContain(";3\t15\t25");
      expect(inp).toContain(";3\t20\t30");
    });

    it("handles inactive reservoirs, tanks, pumps, and valves", () => {
      const IDS = {
        R1: 1,
        T1: 2,
        J1: 3,
        J2: 4,
        J3: 5,
        J4: 6,
        PUMP1: 7,
        VALVE1: 8,
      };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1, { head: 100, isActive: false })
        .aTank(IDS.T1, { elevation: 200, isActive: false })
        .aJunction(IDS.J1, { elevation: 10, isActive: true })
        .aJunction(IDS.J2, { elevation: 20, isActive: true })
        .aJunction(IDS.J3, { elevation: 30, isActive: true })
        .aJunction(IDS.J4, { elevation: 40, isActive: true })
        .aPump(IDS.PUMP1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          isActive: false,
          definitionType: "power",
        })
        .aValve(IDS.VALVE1, {
          startNodeId: IDS.J3,
          endNodeId: IDS.J4,
          isActive: false,
        })
        .build();

      const inp = buildInp(hydraulicModel, { inactiveAssets: true });

      expect(inp).toContain(";1\t100");
      expect(inp).toContain(";2\t200");
      expect(inp).toContain(";7\t3\t4");
      expect(inp).toContain(";8\t5\t6");
    });

    it("comments out demands for inactive junctions", () => {
      const IDS = { J1: 1, J2: 2 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { elevation: 10, baseDemand: 50, isActive: true })
        .aJunction(IDS.J2, { elevation: 20, baseDemand: 75, isActive: false })
        .build();

      const inp = buildInp(hydraulicModel, { inactiveAssets: true });

      expect(inp).toContain("[DEMANDS]");
      expect(inp).toContain("1\t50");
      expect(inp).toContain(";2\t75");
    });

    it("comments out pump status and curves for inactive pumps", () => {
      const IDS = { J1: 1, J2: 2, PUMP1: 3 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { elevation: 10 })
        .aJunction(IDS.J2, { elevation: 20 })
        .aPump(IDS.PUMP1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          definitionType: "design-point",
          isActive: false,
        })
        .aPumpCurve({ id: String(IDS.PUMP1), points: [{ x: 100, y: 50 }] })
        .build();

      const inp = buildInp(hydraulicModel, { inactiveAssets: true });

      expect(inp).toContain(";3\t1\t2\tHEAD 3\tSPEED 1");
      expect(inp).toContain(";3\t100\t50");
      expect(inp).toContain(";3\tOpen");
    });
  });
});
