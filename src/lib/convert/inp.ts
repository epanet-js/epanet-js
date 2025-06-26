import type { FileType, ExportOptions, ImportOptions } from ".";
import { stringToBlob, ConvertResult } from "./utils";
import readAsText from "src/lib/read-as-text";
import { parseOrError } from "src/lib/errors";
import type { ConvertError } from "src/lib/errors";
import { FeatureMap } from "src/types";
import { rough } from "src/lib/roughly-geojson";
import { Right } from "purify-ts/Either";
import { EitherAsync } from "purify-ts/EitherAsync";
import { geojsonToString } from "./local/geojson";

export class InpFileType implements FileType {
  id = "inp" as const;
  label = "INP";
  extensions = [".inp"];
  filenames = [] as string[];
  mimes = [] as string[];
  forwardBinary(file: ArrayBuffer, options?: ImportOptions) {
    throw new Error("Not implemented!");

    return readAsText(file).chain((text) => {
      return this.forwardString(text, options);
    });
  }
  forwardString(text: string, options?: ImportOptions) {
    throw new Error("Not implemented!");

    return EitherAsync<ConvertError, ConvertResult>(
      async function forwardGeoJSON({ liftEither }) {
        const object = await liftEither(parseOrError(text));
        const geojson = await liftEither(
          rough(object, {
            // Default to true unless options are provided
            removeCoincidents: options?.removeCoincidents !== false,
          }),
        );
        return geojson;
      },
    );
  }
  back(
    { featureMapDeprecated }: { featureMapDeprecated: FeatureMap },
    options: ExportOptions,
  ) {
    throw new Error("Not implemented!");

    return EitherAsync.liftEither(
      Right({
        blob: stringToBlob(
          geojsonToString(featureMapDeprecated, options.geojsonOptions),
        ),
        name: "features.geojson",
      }),
    );
  }
}

export const Inp = new InpFileType();
