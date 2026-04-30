import { type Field, type FieldInfo } from "./schema";

export class AssetWriter {
  readonly shapeType: 1 | 3;
  recordCount = 0;
  shpBodyBytes = 0;
  fields: Map<string, FieldInfo> = new Map();
  frozenSchema: Field[] = [];
  recordLength = 0;

  shp!: Uint8Array;
  shpView!: DataView;
  shpCursor = 0;

  shx!: Uint8Array;
  shxView!: DataView;
  shxCursor = 0;

  dbf!: Uint8Array;
  dbfView!: DataView;
  dbfCursor = 0;

  bbox = {
    xmin: Infinity,
    ymin: Infinity,
    xmax: -Infinity,
    ymax: -Infinity,
  };

  private _recordIndex = 0;

  constructor(shapeType: 1 | 3) {
    this.shapeType = shapeType;
  }

  allocate(): void {
    this.recordLength = 1; // deletion flag byte
    for (let i = 0; i < this.frozenSchema.length; i++) {
      this.recordLength += this.frozenSchema[i].length;
    }

    const shpSize = 100 + this.shpBodyBytes;
    this.shp = new Uint8Array(shpSize);
    this.shpView = new DataView(this.shp.buffer);
    this.shpCursor = 100;

    const shxSize = 100 + 8 * this.recordCount;
    this.shx = new Uint8Array(shxSize);
    this.shxView = new DataView(this.shx.buffer);
    this.shxCursor = 100;

    const numFields = this.frozenSchema.length;
    const dbfSize =
      32 + 32 * numFields + 1 + this.recordLength * this.recordCount + 1;
    this.dbf = new Uint8Array(dbfSize);
    this.dbfView = new DataView(this.dbf.buffer);
    this.dbfCursor = 32 + 32 * numFields + 1;
  }

  nextRecordIndex(): number {
    return ++this._recordIndex;
  }
}
