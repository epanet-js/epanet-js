import { useCallback } from "react";
import {
  stringToGeoJSON,
  importToExportOptions,
  RawProgressCb,
} from "src/lib/convert";
import type { ConvertResult, InpResult } from "src/lib/convert/utils";
import type { ImportOptions } from "src/lib/convert";
import { Data, dataAtom, fileInfoAtom } from "src/state/jotai";
import { useAtomValue, useSetAtom } from "jotai";
import { lib } from "src/lib/worker";
import type { FileWithHandle } from "browser-fs-access";
import { usePersistence } from "src/lib/persistence/context";
import { newFeatureId } from "src/lib/id";
import type { ShapefileGroup } from "src/lib/convert/shapefile";
import { Shapefile } from "src/lib/convert/shapefile";
import { transfer } from "comlink";
import { fMoment, Moment, MomentInput } from "src/lib/persistence/moment";
import { generateNKeysBetween } from "fractional-indexing";
import { Folder, Root } from "@tmcw/togeojson";
import {
  Feature,
  FeatureCollection,
  IFolder,
  IWrappedFeature,
} from "src/types";
import * as Comlink from "comlink";
import { useAtomCallback } from "jotai/utils";
import { pluralize, truncate } from "src/lib/utils";
import { ModelMoment } from "src/hydraulic-model";
import { AssetBuilder } from "src/hydraulic-model";
import { Asset } from "src/hydraulic-model";
import { parseInp } from "src/import/parse-inp";

/**
 * Creates the _input_ to a transact() operation,
 * given some imported result.
 */
function resultToTransact({
  assetBuilder,
  result,
  file,
}: {
  assetBuilder: AssetBuilder;
  result: ConvertResult;
  file: Pick<File, "name">;
}): ModelMoment {
  switch (result.type) {
    case "inp": {
      return {
        note: `Imported ${file?.name ? file.name : "a file"}`,
        putAssets: [...result.hydraulicModel.assets.values()],
      };
    }
    case "geojson": {
      return {
        note: `Imported ${file?.name ? file.name : "a file"}`,
        putAssets: result.geojson.features
          .map((feature) => assetFromFeature(feature, assetBuilder))
          .filter((a) => !!a) as Asset[],
      };
    }
    case "root": {
      throw new Error("Invalid import!");
    }
  }
}

const assetFromFeature = (
  feature: Feature,
  assetBuilder: AssetBuilder,
): Asset | null => {
  if (
    feature.geometry &&
    feature.geometry.type === "Point" &&
    feature.properties!.type === "reservoir"
  ) {
    const reservoir = assetBuilder.buildReservoir({
      ...feature.properties,
      coordinates: feature.geometry.coordinates,
    });
    return reservoir;
  }
  if (feature.geometry && feature.geometry.type === "Point") {
    const junction = assetBuilder.buildJunction({
      ...feature.properties,
      coordinates: feature.geometry.coordinates,
    });
    return junction;
  }
  if (feature.geometry && feature.geometry.type === "LineString") {
    const pipe = assetBuilder.buildPipe({
      ...feature.properties,
      coordinates: feature.geometry.coordinates,
    });
    return pipe;
  }
  if (feature.geometry && feature.geometry.type === "MultiLineString") {
    const combinedCoordinates = feature.geometry.coordinates.flat();
    const pipe = assetBuilder.buildPipe({
      ...feature.properties,
      coordinates: combinedCoordinates,
    });
    return pipe;
  }
  return null;
};

export function flattenRoot(
  root: Root | Folder,
  features: IWrappedFeature[],
  folders: IFolder[],
  parentFolder: string | null,
): Pick<Moment, "note" | "putFolders" | "putFeatures"> {
  // TODO: find a start key here and use that as the start, not null.
  const ats = generateNKeysBetween(null, null, root.children.length);
  for (let i = 0; i < root.children.length; i++) {
    const child = root.children[i];
    switch (child.type) {
      case "Feature": {
        features.push({
          at: ats[i],
          folderId: parentFolder,
          id: newFeatureId(),
          feature: child,
        });
        break;
      }
      case "folder": {
        const id = newFeatureId();
        folders.push({
          at: ats[i],
          folderId: parentFolder,
          id,
          expanded: child.meta.visibility !== "0",
          locked: false,
          visibility: true,
          name: (child.meta.name as string) || "Folder",
        });
        flattenRoot(child, features, folders, id);
        break;
      }
    }
  }

  return {
    note: "Imported a file",
    putFolders: folders,
    putFeatures: features,
  };
}

export function useImportString() {
  const rep = usePersistence();
  const transact = rep.useTransact();
  const {
    hydraulicModel: { assetBuilder },
  } = useAtomValue(dataAtom);

  return useCallback(
    /**
     * Convert a given file or string and add it to the
     * current map content.
     */
    async (
      text: string,
      options: ImportOptions,
      progress: RawProgressCb,
      name: string = "Imported text",
      _?: string,
    ) => {
      return (await stringToGeoJSON(text, options, Comlink.proxy(progress)))
        .map((result) => {
          transact(
            resultToTransact({
              assetBuilder,
              result,
              file: { name },
            }),
          );
          return result;
        })
        .mapLeft((e) => {
          // eslint-disable-next-line no-console
          console.error(e);
        });
    },
    [transact, assetBuilder],
  );
}

export function getTargetMap(
  { featureMapDeprecated }: Pick<Data, "featureMapDeprecated">,
  joinTargetHeader: string,
) {
  const targetMap = new Map<string, IWrappedFeature[]>();
  let sourceMissingFieldCount = 0;

  for (const wrappedFeature of featureMapDeprecated.values()) {
    const value = wrappedFeature.feature.properties?.[joinTargetHeader];
    if (value !== undefined) {
      const valueStr = String(value);
      const oldTarget = targetMap.get(valueStr);
      if (oldTarget) {
        targetMap.set(valueStr, [wrappedFeature].concat(oldTarget));
      } else {
        targetMap.set(valueStr, [wrappedFeature]);
      }
    } else {
      sourceMissingFieldCount++;
    }
  }

  return { targetMap, sourceMissingFieldCount };
}

function momentForJoin(
  features: Feature[],
  targetMap: ReturnType<typeof getTargetMap>["targetMap"],
  joinSourceHeader: string,
  result: ConvertResult,
) {
  const moment: MomentInput = {
    ...fMoment("Joined data"),
    track: "import-data-join",
  };

  for (const feature of features) {
    const value = feature.properties?.[joinSourceHeader];
    if (value === undefined) continue;
    const target = targetMap.get(String(value));

    if (!target) {
      result.notes.push(
        `No feature on the map found for ${truncate(
          joinSourceHeader,
        )} = "${truncate(String(value))}"`,
      );
      continue;
    }

    for (const wrappedFeature of target) {
      /**
       * Merge the new properties into the existing map
       * feature and update it.
       */
      moment.putFeatures.push({
        ...wrappedFeature,
        feature: {
          ...wrappedFeature.feature,
          properties: {
            ...(wrappedFeature.feature.properties || {}),
            ...(feature.properties || {}),
          },
        },
      });
    }
  }
  return moment;
}

function useJoinFeatures() {
  return useAtomCallback(
    useCallback(
      (
        get,
        _set,
        {
          options,
          geojson,
          result,
        }: {
          options: ImportOptions;
          geojson: FeatureCollection;
          result: ConvertResult;
        },
      ) => {
        const { features } = geojson;
        const { joinTargetHeader, joinSourceHeader } = options.csvOptions;
        const data = get(dataAtom);

        const { targetMap, sourceMissingFieldCount } = getTargetMap(
          data,
          joinTargetHeader,
        );

        if (sourceMissingFieldCount > 0) {
          result.notes.push(
            `${pluralize(
              "feature",
              sourceMissingFieldCount,
            )} in existing map data missing the join column.`,
          );
        }

        return momentForJoin(features, targetMap, joinSourceHeader, result);
      },
      [],
    ),
  );
}

export function useImportFile() {
  const rep = usePersistence();
  const setFileInfo = useSetAtom(fileInfoAtom);
  const transact = rep.useTransact();
  const transactDeprecated = rep.useTransactDeprecated();
  const joinFeatures = useJoinFeatures();
  const {
    hydraulicModel: { assetBuilder },
  } = useAtomValue(dataAtom);

  return useCallback(
    /**
     * Convert a given file or string and add it to the
     * current map content.
     */
    async (
      file: FileWithHandle,
      options: ImportOptions,
      progress: RawProgressCb,
    ) => {
      const arrayBuffer = await file.arrayBuffer();

      if (options.type === "inp") {
        const content = new TextDecoder().decode(arrayBuffer);
        const hydraulicModel = parseInp(content);
        transact({
          note: `Import ${file.name}`,
          putAssets: [...hydraulicModel.assets.values()],
        });
        return { type: "inp", notes: [], hydraulicModel } as InpResult;
      }

      const either = (
        await lib.fileToGeoJSON(
          transfer(arrayBuffer, [arrayBuffer]),
          options,
          Comlink.proxy(progress),
        )
      ).bimap(
        (err) => {
          return err;
        },
        async (result) => {
          if (
            options.csvOptions.kind === "join" &&
            (options.type === "csv" || options.type === "xls") &&
            result.type === "geojson"
          ) {
            const { geojson } = result;
            const moment = joinFeatures({
              options,
              geojson,
              result,
            });
            await transactDeprecated(moment);
            return result;
          } else {
            const exportOptions = importToExportOptions(options);
            if (file.handle && exportOptions) {
              setFileInfo({ handle: file.handle, options: exportOptions });
            }
            const moment = resultToTransact({
              assetBuilder,
              result,
              file,
            });
            transact(moment);
            return result;
          }
        },
      );

      return either;
    },
    [setFileInfo, transact, transactDeprecated, assetBuilder, joinFeatures],
  );
}

export function useImportShapefile() {
  const rep = usePersistence();
  const transact = rep.useTransact();
  const {
    hydraulicModel: { assetBuilder },
  } = useAtomValue(dataAtom);

  return useCallback(
    /**
     * Convert a given file or string and add it to the
     * current map content.
     */
    async (file: ShapefileGroup, options: ImportOptions) => {
      const either = (await Shapefile.forwardLoose(file, options)).map(
        (result) => {
          transact(
            resultToTransact({
              assetBuilder,
              result,
              file: file.files.shp,
            }),
          );
          return result;
        },
      );

      return either;
    },
    [transact, assetBuilder],
  );
}
