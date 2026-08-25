import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { endpointNodeAt } from "./use-fix-proximity-anomaly";

describe("endpointNodeAt", () => {
  const IDS = { A: 1, B: 2, PIPE: 3 } as const;

  // A degree of longitude at the equator is ~111km, so the 10cm tolerance is
  // about 0.0000009 deg.
  const aPipe = () =>
    HydraulicModelBuilder.with()
      .aNode(IDS.A, [0, 0])
      .aNode(IDS.B, [0.001, 0])
      .aPipe(IDS.PIPE, { startNodeId: IDS.A, endNodeId: IDS.B })
      .build();

  it("matches a point sitting exactly on an endpoint", () => {
    expect(endpointNodeAt(aPipe(), IDS.PIPE, [0.001, 0])).toEqual(IDS.B);
    expect(endpointNodeAt(aPipe(), IDS.PIPE, [0, 0])).toEqual(IDS.A);
  });

  it("matches a point within the check's tolerance of an endpoint", () => {
    // ~5cm short of B, where adding a node would sit almost on top of it.
    expect(endpointNodeAt(aPipe(), IDS.PIPE, [0.00099955, 0])).toEqual(IDS.B);
  });

  it("does not match a point comfortably along the pipe", () => {
    // ~22cm from B, far enough that a node there is a real connection.
    expect(endpointNodeAt(aPipe(), IDS.PIPE, [0.000998, 0])).toBeNull();
    expect(endpointNodeAt(aPipe(), IDS.PIPE, [0.0005, 0])).toBeNull();
  });
});
