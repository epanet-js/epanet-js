import { describe, it, expect } from "vitest";
import {
  decodeBounds,
  decodeId,
  decodeIdsList,
  decodeLinkConnections,
  decodePosition,
  EncodedSize,
  HydraulicModelEncoder,
} from "./hydraulic-model-buffers";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import {
  decodeType,
  FixedSizeBufferView,
  VariableSizeBufferView,
} from "./buffers";

const createTestModel = () => {
  return HydraulicModelBuilder.with()
    .aJunction("J1")
    .aJunction("J2")
    .aTank("T1")
    .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
    .aPipe("P2", { startNodeId: "J2", endNodeId: "T1" })
    .build();
};

describe("HydraulicModelEncoder - nodes encoding options", () => {
  it("encodes node connections when enabled", () => {
    const model = createTestModel();
    const encoder = new HydraulicModelEncoder(model, {
      nodes: new Set(["connections"]),
      bufferType: "array",
    });

    const buffers = encoder.buildBuffers();
    const view = new VariableSizeBufferView(
      buffers.nodes.connections,
      decodeIdsList,
    );

    expect(view.count).toBe(3);
  });

  it("skips node connections when disabled", () => {
    const model = createTestModel();
    const encoder = new HydraulicModelEncoder(model, {
      bufferType: "array",
    });

    const buffers = encoder.buildBuffers();
    const view = new VariableSizeBufferView(
      buffers.nodes.connections,
      decodeIdsList,
    );

    expect(view.count).toBe(0);
  });

  it("encodes node types when enabled", () => {
    const model = createTestModel();
    const encoder = new HydraulicModelEncoder(model, {
      nodes: new Set(["types"]),
      bufferType: "array",
    });

    const buffers = encoder.buildBuffers();
    const view = new FixedSizeBufferView(
      buffers.nodes.types,
      EncodedSize.type,
      decodeType,
    );

    expect(view.count).toBe(3);
  });

  it("skips node types when disabled", () => {
    const model = createTestModel();
    const encoder = new HydraulicModelEncoder(model, {
      bufferType: "array",
    });

    const buffers = encoder.buildBuffers();
    const view = new FixedSizeBufferView(
      buffers.nodes.types,
      EncodedSize.type,
      decodeType,
    );

    expect(view.count).toBe(0);
  });

  it("encodes node positions when bounds enabled", () => {
    const model = createTestModel();
    const encoder = new HydraulicModelEncoder(model, {
      nodes: new Set(["bounds"]),
      bufferType: "array",
    });

    const buffers = encoder.buildBuffers();
    const view = new FixedSizeBufferView(
      buffers.nodes.positions,
      EncodedSize.position,
      decodePosition,
    );

    expect(view.count).toBe(3);
  });

  it("skips node positions when bounds disabled", () => {
    const model = createTestModel();
    const encoder = new HydraulicModelEncoder(model, {
      bufferType: "array",
    });

    const buffers = encoder.buildBuffers();
    const view = new FixedSizeBufferView(
      buffers.nodes.positions,
      EncodedSize.position,
      decodePosition,
    );

    expect(view.count).toBe(0);
  });

  it("encodes node geoIndex when enabled", () => {
    const model = createTestModel();
    const encoder = new HydraulicModelEncoder(model, {
      nodes: new Set(["geoIndex"]),
      links: new Set(["geoIndex"]),
      bufferType: "array",
    });

    const buffers = encoder.buildBuffers();

    expect(buffers.nodes.geoIndex.byteLength).toBeGreaterThan(0);
  });

  it("creates empty geoIndex when disabled", () => {
    const model = createTestModel();
    const encoder = new HydraulicModelEncoder(model, {
      bufferType: "array",
    });

    const buffers = encoder.buildBuffers();
    const bufferWithGeoIndex = new HydraulicModelEncoder(model, {
      nodes: new Set(["geoIndex"]),
      links: new Set(["geoIndex"]),
      bufferType: "array",
    }).buildBuffers();

    expect(buffers.nodes.geoIndex.byteLength).toBeLessThan(
      bufferWithGeoIndex.nodes.geoIndex.byteLength,
    );
  });
});

describe("HydraulicModelEncoder - links encoding options", () => {
  it("encodes link connections when enabled", () => {
    const model = createTestModel();
    const encoder = new HydraulicModelEncoder(model, {
      links: new Set(["connections"]),
      bufferType: "array",
    });

    const buffers = encoder.buildBuffers();
    const view = new FixedSizeBufferView(
      buffers.links.connections,
      EncodedSize.id * 2,
      decodeLinkConnections,
    );

    expect(view.count).toBe(2);
  });

  it("skips link connections when disabled", () => {
    const model = createTestModel();
    const encoder = new HydraulicModelEncoder(model, {
      bufferType: "array",
    });

    const buffers = encoder.buildBuffers();
    const view = new FixedSizeBufferView(
      buffers.links.connections,
      EncodedSize.id * 2,
      decodeLinkConnections,
    );

    expect(view.count).toBe(0);
  });

  it("encodes link types when enabled", () => {
    const model = createTestModel();
    const encoder = new HydraulicModelEncoder(model, {
      links: new Set(["types"]),
      bufferType: "array",
    });

    const buffers = encoder.buildBuffers();
    const view = new FixedSizeBufferView(
      buffers.links.types,
      EncodedSize.type,
      decodeType,
    );

    expect(view.count).toBe(2);
  });

  it("skips link types when disabled", () => {
    const model = createTestModel();
    const encoder = new HydraulicModelEncoder(model, {
      bufferType: "array",
    });

    const buffers = encoder.buildBuffers();
    const view = new FixedSizeBufferView(
      buffers.links.types,
      EncodedSize.type,
      decodeType,
    );

    expect(view.count).toBe(0);
  });

  it("encodes link bounds when enabled", () => {
    const model = createTestModel();
    const encoder = new HydraulicModelEncoder(model, {
      links: new Set(["bounds"]),
      bufferType: "array",
    });

    const buffers = encoder.buildBuffers();
    const view = new FixedSizeBufferView(
      buffers.links.bounds,
      EncodedSize.bounds,
      decodeBounds,
    );

    expect(view.count).toBe(2);
  });

  it("skips link bounds when disabled", () => {
    const model = createTestModel();
    const encoder = new HydraulicModelEncoder(model, {
      bufferType: "array",
    });

    const buffers = encoder.buildBuffers();
    const view = new FixedSizeBufferView(
      buffers.links.bounds,
      EncodedSize.bounds,
      decodeBounds,
    );

    expect(view.count).toBe(0);
  });

  it("encodes pipe segments when geoIndex enabled", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .aJunction("J2", { coordinates: [10, 10] })
      .aPipe("P1", {
        startNodeId: "J1",
        endNodeId: "J2",
        coordinates: [
          [0, 0],
          [5, 5],
          [10, 10],
        ],
      })
      .build();

    const encoder = new HydraulicModelEncoder(model, {
      links: new Set(["geoIndex"]),
      bufferType: "array",
    });

    const buffers = encoder.buildBuffers();
    const view = new FixedSizeBufferView(
      buffers.pipeSegments.ids,
      EncodedSize.id,
      decodeId,
    );

    expect(view.count).toBe(2);
  });

  it("skips pipe segments when geoIndex disabled", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .aJunction("J2", { coordinates: [10, 10] })
      .aPipe("P1", {
        startNodeId: "J1",
        endNodeId: "J2",
        coordinates: [
          [0, 0],
          [5, 5],
          [10, 10],
        ],
      })
      .build();

    const encoder = new HydraulicModelEncoder(model, {
      bufferType: "array",
    });

    const buffers = encoder.buildBuffers();
    const view = new FixedSizeBufferView(
      buffers.pipeSegments.ids,
      EncodedSize.id,
      decodeId,
    );

    expect(view.count).toBe(0);
  });
});

describe("HydraulicModelEncoder - combined options", () => {
  it("encodes all buffers when all options enabled", () => {
    const model = createTestModel();
    const encoder = new HydraulicModelEncoder(model, {
      nodes: new Set(["connections", "types", "bounds", "geoIndex"]),
      links: new Set(["connections", "types", "bounds", "geoIndex"]),
      bufferType: "array",
    });

    const buffers = encoder.buildBuffers();

    const nodeConnectionsView = new VariableSizeBufferView(
      buffers.nodes.connections,
      decodeIdsList,
    );
    const nodeTypesView = new FixedSizeBufferView(
      buffers.nodes.types,
      EncodedSize.type,
      decodeType,
    );
    const nodePositionsView = new FixedSizeBufferView(
      buffers.nodes.positions,
      EncodedSize.position,
      decodePosition,
    );
    const linkConnectionsView = new FixedSizeBufferView(
      buffers.links.connections,
      EncodedSize.id * 2,
      (offset, dataView) => [
        decodeId(offset, dataView),
        decodeId(offset + EncodedSize.id, dataView),
      ],
    );
    const linkTypesView = new FixedSizeBufferView(
      buffers.links.types,
      EncodedSize.type,
      decodeType,
    );
    const linkBoundsView = new FixedSizeBufferView(
      buffers.links.bounds,
      EncodedSize.bounds,
      decodeBounds,
    );
    const pipeSegmentsView = new FixedSizeBufferView(
      buffers.pipeSegments.ids,
      EncodedSize.id,
      decodeId,
    );

    expect(nodeConnectionsView.count).toBe(3);
    expect(nodeTypesView.count).toBe(3);
    expect(nodePositionsView.count).toBe(3);
    expect(linkConnectionsView.count).toBe(2);
    expect(linkTypesView.count).toBe(2);
    expect(linkBoundsView.count).toBe(2);
    expect(pipeSegmentsView.count).toBe(2);
    expect(buffers.nodes.geoIndex.byteLength).toBeGreaterThan(0);
    expect(buffers.pipeSegments.geoIndex.byteLength).toBeGreaterThan(0);
  });

  it("skips all buffers when all options disabled", () => {
    const model = createTestModel();
    const encoder = new HydraulicModelEncoder(model, {
      bufferType: "array",
    });

    const buffers = encoder.buildBuffers();

    const nodeConnectionsView = new VariableSizeBufferView(
      buffers.nodes.connections,
      decodeIdsList,
    );
    const nodeTypesView = new FixedSizeBufferView(
      buffers.nodes.types,
      EncodedSize.type,
      decodeType,
    );
    const nodePositionsView = new FixedSizeBufferView(
      buffers.nodes.positions,
      EncodedSize.position,
      decodePosition,
    );
    const linkConnectionsView = new FixedSizeBufferView(
      buffers.links.connections,
      EncodedSize.id * 2,
      (offset, dataView) => [
        decodeId(offset, dataView),
        decodeId(offset + EncodedSize.id, dataView),
      ],
    );
    const linkTypesView = new FixedSizeBufferView(
      buffers.links.types,
      EncodedSize.type,
      decodeType,
    );
    const linkBoundsView = new FixedSizeBufferView(
      buffers.links.bounds,
      EncodedSize.bounds,
      decodeBounds,
    );
    const pipeSegmentsView = new FixedSizeBufferView(
      buffers.pipeSegments.ids,
      EncodedSize.id,
      decodeId,
    );

    expect(nodeConnectionsView.count).toBe(0);
    expect(nodeTypesView.count).toBe(0);
    expect(nodePositionsView.count).toBe(0);
    expect(linkConnectionsView.count).toBe(0);
    expect(linkTypesView.count).toBe(0);
    expect(linkBoundsView.count).toBe(0);
    expect(pipeSegmentsView.count).toBe(0);
  });
});

describe("HydraulicModelEncoder - buffer type", () => {
  it("creates SharedArrayBuffer when bufferType is shared", () => {
    const model = createTestModel();
    const encoder = new HydraulicModelEncoder(model, {
      nodes: new Set(["types"]),
      links: new Set(["types"]),
      bufferType: "shared",
    });

    const buffers = encoder.buildBuffers();

    expect(buffers.nodes.types instanceof SharedArrayBuffer).toBe(true);
    expect(buffers.links.types instanceof SharedArrayBuffer).toBe(true);
  });

  it("creates ArrayBuffer when bufferType is array", () => {
    const model = createTestModel();
    const encoder = new HydraulicModelEncoder(model, {
      nodes: new Set(["types"]),
      links: new Set(["types"]),
      bufferType: "array",
    });

    const buffers = encoder.buildBuffers();

    expect(buffers.nodes.types instanceof ArrayBuffer).toBe(true);
    expect(buffers.links.types instanceof ArrayBuffer).toBe(true);
  });
});
