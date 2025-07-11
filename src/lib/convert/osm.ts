import type { FileType, ImportOptions } from ".";
import { EitherAsync } from "purify-ts/EitherAsync";
import type { ConvertError } from "src/lib/errors";
import readAsText from "src/lib/read-as-text";
import { ConvertResult, okResult, toDom } from "./utils";

export class COSM implements FileType {
  id = "osm" as const;
  label = "OpenStreetMap XML";
  extensions = [".osm", ".xml"];
  filenames = [] as string[];
  mimes = [] as string[];
  forwardString(text: string) {
    return EitherAsync<ConvertError, ConvertResult>(
      async function forwardKML() {
        const osmtogeojson = await import("@placemarkio/osmtogeojson").then(
          (m) => m.default,
        );
        const dom = await toDom(text);
        const geojson = osmtogeojson(dom);
        return okResult(geojson);
      },
    );
  }
  forwardBinary(file: ArrayBuffer, _options: ImportOptions) {
    return readAsText(file).chain((text) => {
      return OSM.forwardString(text);
    });
  }
}

export const OSM = new COSM();
