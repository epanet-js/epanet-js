import { Position } from "geojson";
import Flatbush from "flatbush";
import {
  BufferType,
  DataSize,
  BinaryData,
  BufferWithIndex,
  createBuffer,
  encodeCount,
  encodeNumber,
} from ".";
import bbox from "@turf/bbox";
import { lineString } from "@turf/helpers";

export class FixedSizeBufferBuilder<T> {
  private view: DataView;
  private currentIndex: number = 0;

  constructor(
    private readonly recordSize: number,
    count: number,
    bufferType: BufferType,
    private readonly encoder: (data: T, offset: number, view: DataView) => void,
  ) {
    const totalSize = DataSize.count + count * recordSize;
    this.view = new DataView(createBuffer(totalSize, bufferType));
    encodeCount(this.view, count);
  }

  add(data: T): void {
    const offset = DataSize.count + this.currentIndex * this.recordSize;
    this.encoder(data, offset, this.view);
    this.currentIndex++;
  }

  finalize(): BinaryData {
    return this.view.buffer;
  }
}

export class VariableSizeBufferBuilder<T> {
  private dataView: DataView;
  private indexView: DataView;
  private readonly encoder: (data: T, offset: number, view: DataView) => void;
  private readonly sizeCalculator: (data: T) => number;
  private currentIndex: number = 0;
  private currentOffset: number = 0;

  constructor(
    count: number,
    totalDataSize: number,
    bufferType: BufferType,
    encoder: (data: T, offset: number, view: DataView) => void,
    sizeCalculator: (data: T) => number,
  ) {
    this.dataView = new DataView(
      createBuffer(totalDataSize + DataSize.count, bufferType),
    );
    encodeCount(this.dataView, count);
    this.currentOffset = DataSize.count;

    const indexSize = count * DataSize.count;
    this.indexView = new DataView(createBuffer(indexSize, bufferType));

    this.encoder = encoder;
    this.sizeCalculator = sizeCalculator;
  }

  add(data: T): void {
    this.encoder(data, this.currentOffset, this.dataView);

    const size = this.sizeCalculator(data);
    encodeNumber(this.currentOffset, this.currentIndex, this.indexView);
    this.currentOffset += size;
    this.currentIndex++;
  }

  finalize(): BufferWithIndex {
    return {
      data: this.dataView.buffer,
      index: this.indexView.buffer,
    };
  }
}

export class GeoIndexBuilder {
  private geoIndex: Flatbush;

  constructor(private readonly size: number) {
    this.geoIndex = new Flatbush(Math.max(size, 1));
  }

  add(coordinates: Position[]): void {
    if (coordinates.length === 1) {
      const [lon, lat] = coordinates[0];
      this.geoIndex.add(lon, lat, lon, lat);
      return;
    }
    const bounds = bbox(lineString(coordinates));
    this.geoIndex.add(bounds[0], bounds[1], bounds[2], bounds[3]);
  }

  finalize(): BinaryData {
    if (this.size === 0) {
      this.geoIndex.add(0, 0, 0, 0);
    }
    this.geoIndex.finish();
    return this.geoIndex.data;
  }
}
