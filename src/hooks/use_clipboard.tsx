import { IWrappedFeature, UWrappedFeature } from "src/types";
import { Maybe } from "purify-ts/Maybe";

export function stringifyFeatures(selectedFeatures: IWrappedFeature[]): Maybe<{
  data: string;
  message: string;
}> {
  switch (selectedFeatures.length) {
    case 0: {
      return Maybe.empty();
    }
    case 1: {
      return Maybe.of({
        data: JSON.stringify(selectedFeatures[0].feature),
        message: "Copied feature as GeoJSON",
      });
    }
    default: {
      return Maybe.of({
        data: JSON.stringify(
          UWrappedFeature.toFeatureCollection(selectedFeatures),
        ),
        message: "Copied features as GeoJSON",
      });
    }
  }
}
