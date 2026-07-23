import Flatbush from "flatbush";
import type { Position } from "geojson";
import type { CustomerPoints } from "@epanet-js/hydraulic-model";
import type { SearchOptions } from "./spatial-queries";
import { toSearchPolygon, containsNode } from "./spatial-queries";
import { BinaryData, BufferType, createBuffer } from "@epanet-js/buffers";

type BoundingBox = [number, number, number, number];
type CustomerPointFilterFn = (id: number, position: Position) => boolean;

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

export interface CustomerPointsGeoQueries {
  searchCustomerPoints(
    bounds: BoundingBox,
    filterFn?: CustomerPointFilterFn,
  ): number[];
}

export class CustomerPointsGeoIndex implements CustomerPointsGeoQueries {
  private spatialIndex?: Flatbush;
  private ids: number[] = [];
  private coordinates: Position[] = [];

  constructor(private customerPoints: CustomerPoints) {}

  searchCustomerPoints(
    bounds: BoundingBox,
    filterFn?: CustomerPointFilterFn,
  ): number[] {
    if (this.customerPoints.size === 0) return [];
    if (!this.spatialIndex) this.build();
    return this.spatialIndex!.search(...bounds, (index: number) =>
      filterFn ? filterFn(this.ids[index], this.coordinates[index]) : true,
    ).map((index) => this.ids[index]);
  }

  private build() {
    this.spatialIndex = new Flatbush(this.customerPoints.size);
    for (const customerPoint of this.customerPoints.values()) {
      const [lng, lat] = customerPoint.coordinates;
      this.spatialIndex.add(lng, lat, lng, lat);
      this.ids.push(customerPoint.id);
      this.coordinates.push([lng, lat]);
    }
    this.spatialIndex.finish();
  }
}

export class CustomerPointsGeoView implements CustomerPointsGeoQueries {
  private readonly spatialIndex: Flatbush | null;
  private readonly ids: Uint32Array;
  private readonly coordinates: Float64Array;

  constructor(buffers: CustomerPointsGeoBuffers) {
    if (buffers.customerPointsIndex.byteLength === 0) {
      this.spatialIndex = null;
      this.ids = new Uint32Array(0);
      this.coordinates = new Float64Array(0);
      return;
    }
    this.spatialIndex = Flatbush.from(buffers.customerPointsGeo);
    this.ids = new Uint32Array(buffers.customerPointsIndex);
    this.coordinates = new Float64Array(buffers.customerPointsSpatialIndex);
  }

  searchCustomerPoints(
    bounds: BoundingBox,
    filterFn?: CustomerPointFilterFn,
  ): number[] {
    if (!this.spatialIndex) return [];
    return this.spatialIndex
      .search(...bounds, (index: number) =>
        filterFn
          ? filterFn(this.ids[index], [
              this.coordinates[index * 2],
              this.coordinates[index * 2 + 1],
            ])
          : true,
      )
      .map((index) => this.ids[index]);
  }
}

export function queryContainedCustomerPoints(
  geo: CustomerPointsGeoQueries,
  searchOptions: SearchOptions,
): number[] {
  const search = toSearchPolygon(searchOptions);
  return geo.searchCustomerPoints(search.bounds, (_id, position) =>
    search.isBounds ? true : containsNode(search, position),
  );
}
