declare module "shpjs" {
  import { FeatureCollection } from "geojson";

  interface ShpJSInput {
    shp: ArrayBuffer;
    dbf?: ArrayBuffer;
    prj?: string;
    cpg?: string;
  }

  function shp(
    input: string | ArrayBuffer | ShpJSInput,
  ): Promise<FeatureCollection>;

  export = shp;
}
