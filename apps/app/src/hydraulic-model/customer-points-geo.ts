import Flatbush from "flatbush";
import type { CustomerPoints } from "@epanet-js/hydraulic-model";
import type { SearchOptions } from "./spatial-queries";
import { toSearchPolygon, containsNode } from "./spatial-queries";
import { BinaryData, BufferType, createBuffer } from "src/lib/buffers";

/**
 * Transferable encoding of the customer-points spatial state. The Flatbush
 * tree, the parallel id array, and the parallel coordinates array all sit in
 * raw ArrayBuffers so the whole thing can cross the worker boundary in a
 * single zero-copy `Comlink.transfer`. The `ids` array maps Flatbush internal
 * indexes back to CP ids; the `coordinates` array is needed to run
 * point-in-polygon checks on the worker side without re-encoding the
 * CustomerPoints map.
 */
export type CustomerPointsGeoBuffers = {
  customerPointsGeo: BinaryData;
  customerPointsIndex: BinaryData; // Uint32Array, one entry per CP
  customerPointsSpatialIndex: BinaryData; // Float64Array, two entries per CP (lng, lat)
};

export function customerPointsGeoTransferables(
  b: CustomerPointsGeoBuffers,
): ArrayBuffer[] {
  return [
    b.customerPointsGeo,
    b.customerPointsIndex,
    b.customerPointsSpatialIndex,
  ].filter((buf): buf is ArrayBuffer => buf instanceof ArrayBuffer);
}

export function encodeCustomerPointsGeo(
  customerPoints: CustomerPoints,
  bufferType: BufferType = "array",
): CustomerPointsGeoBuffers {
  const size = customerPoints.size;
  if (size === 0) {
    return {
      customerPointsGeo: createBuffer(0, bufferType),
      customerPointsIndex: createBuffer(0, bufferType),
      customerPointsSpatialIndex: createBuffer(0, bufferType),
    };
  }
  const ArrayBufferType =
    bufferType === "shared" ? SharedArrayBuffer : ArrayBuffer;
  const flatbush = new Flatbush(size, undefined, Float64Array, ArrayBufferType);
  const idsBuffer = createBuffer(
    size * Uint32Array.BYTES_PER_ELEMENT,
    bufferType,
  );
  const coordinatesBuffer = createBuffer(
    size * 2 * Float64Array.BYTES_PER_ELEMENT,
    bufferType,
  );
  const ids = new Uint32Array(idsBuffer);
  const coordinates = new Float64Array(coordinatesBuffer);
  let i = 0;
  for (const customerPoint of customerPoints.values()) {
    const [lng, lat] = customerPoint.coordinates;
    flatbush.add(lng, lat, lng, lat);
    ids[i] = customerPoint.id;
    coordinates[i * 2] = lng;
    coordinates[i * 2 + 1] = lat;
    i++;
  }
  flatbush.finish();
  return {
    customerPointsGeo: flatbush.data,
    customerPointsIndex: idsBuffer,
    customerPointsSpatialIndex: coordinatesBuffer,
  };
}

export function cloneCustomerPointsGeoBuffers(
  b: CustomerPointsGeoBuffers,
): CustomerPointsGeoBuffers {
  return {
    customerPointsGeo: b.customerPointsGeo.slice(0),
    customerPointsIndex: b.customerPointsIndex.slice(0),
    customerPointsSpatialIndex: b.customerPointsSpatialIndex.slice(0),
  };
}

export function queryContainedCustomerPointsFromBuffers(
  buffers: CustomerPointsGeoBuffers,
  searchOptions: SearchOptions,
): number[] {
  if (buffers.customerPointsIndex.byteLength === 0) return [];
  const flatbush = Flatbush.from(buffers.customerPointsGeo);
  const ids = new Uint32Array(buffers.customerPointsIndex);
  const coordinates = new Float64Array(buffers.customerPointsSpatialIndex);

  const search = toSearchPolygon(searchOptions);
  const candidates = flatbush.search(...search.bounds);
  if (search.isBounds) {
    return Array.from(candidates, (idx) => ids[idx]);
  }
  const result: number[] = [];
  for (const idx of candidates) {
    const lng = coordinates[idx * 2];
    const lat = coordinates[idx * 2 + 1];
    if (containsNode(search, [lng, lat])) {
      result.push(ids[idx]);
    }
  }
  return result;
}
