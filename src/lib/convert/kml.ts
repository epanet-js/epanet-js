import { ConvertResult, toDom, stringToBlob } from "./utils";
import readAsText from "src/lib/read_as_text";
import type { FeatureCollection, FeatureMap, FolderMap } from "src/types";
import type { ExportOptions, ExportResult, FileType, ImportOptions } from ".";
import { EitherAsync } from "purify-ts/EitherAsync";
import { ConvertError } from "src/lib/errors";
import { solveRootItems } from "src/components/panels/feature_editor/feature_editor_folder/math";

export class CKML implements FileType {
  id = "kml" as const;
  label = "KML";
  extensions = [".kml"];
  filenames = [] as string[];
  mimes = ["application/vnd.google-earth.kml+xml"];
  forwardBinary(file: ArrayBuffer, _options: ImportOptions) {
    return readAsText(file).chain((text) => {
      return KML.forwardString(text);
    });
  }
  forwardString(text: string) {
    return EitherAsync<ConvertError, ConvertResult>(
      async function forwardKML() {
        const toGeoJSON = await import("@tmcw/togeojson");
        const dom = await toDom(text);
        const root = toGeoJSON.kmlWithFolders(dom);
        return {
          type: "root",
          notes: [],
          root,
        };
      },
    );
  }
  back(
    {
      geojson: _ignore,
      featureMapDeprecated,
      folderMap,
    }: {
      geojson: FeatureCollection;
      featureMapDeprecated: FeatureMap;
      folderMap: FolderMap;
    },
    _options: ExportOptions,
  ) {
    return EitherAsync<ConvertError, ExportResult>(async ({ throwE }) => {
      const { foldersToKML } = await import("@placemarkio/tokml");
      try {
        const root = solveRootItems(featureMapDeprecated, folderMap);
        return {
          blob: stringToBlob(foldersToKML(root)),
          name: "features.kml",
        };
      } catch (e) {
        return throwE(new ConvertError("Could not convert to KML"));
      }
    });
  }
}

export const KML = new CKML();
