import { emptySelection, EMPTY_ARRAY } from "src/lib/constants";
import { generateExclude } from "src/lib/folder";
import { encodeId } from "src/lib/id";
import { IDMap, UIDMap } from "src/lib/id_mapper";
import { Data, PreviewProperty, Sel } from "src/state/jotai";
import { Feature, ISymbolization } from "src/types";
import { generateSyntheticPoints } from "./generate_synthetic_points";
import { fixDegenerates } from "./merge_ephemeral_state";
import { getKeepProperties, stripFeature } from "./strip_features";

interface SplitGroups {
  features: Feature[];
  selectedFeatures: Feature[];
}

export const splitFeatureGroups = (
  data: Data,
  idMap: IDMap,
  symbolization: ISymbolization | null,
  previewProperty: PreviewProperty,
): SplitGroups => {
  const strippedFeatures = [];
  const selectedFeatures = [];
  const keepProperties = getKeepProperties({
    symbolization,
    previewProperty,
  });
  const { featureMapDeprecated, selection } = data;

  const selectionIds = toIdSet(selection);
  for (const feature of featureMapDeprecated.values()) {
    if (feature.feature.properties?.visibility === false) {
      continue;
    }
    const strippedFeature = stripFeature({
      wrappedFeature: feature,
      keepProperties,
      idMap,
    });
    strippedFeatures.push(strippedFeature);
    if (selectionIds.has(feature.id)) selectedFeatures.push(strippedFeature);
  }
  return { features: strippedFeatures, selectedFeatures: selectedFeatures };
};

const toIdSet = (selection: Sel): Set<string> => {
  if (selection.type === "single") return new Set([selection.id]);
  if (selection.type === "multi") return new Set(selection.ids);

  return new Set([]);
};

/**
 * This is basically the "intermediate representation" before
 * features go to the map. The features here are as barebones
 * as they can be.
 */

interface SplitGroupsDeprecated {
  selectionIds: Set<RawId>;
  synthetic: Feature[];
  ephemeral: Feature[];
  features: Feature[];
}

/**
 * When the user has a SelectionSingle state,
 * as a performance optimization we push it into
 * the ephemeral layer.
 *
 * In the case that a single feature is selected,
 * synthetic features for its vertices are generated.
 *
 * This also generates selectionIds, which is a list
 * of RawId (integer) IDs which are the ones that go
 * directly to Mapbox GL.
 *
 * This is somewhat slow. It could probably be
 * faster using memoization, or a micro-optimization of
 * how to create the stripped values.
 */
export function splitFeatureGroupsDeprecated({
  data,
  lastSymbolization,
  idMap,
  previewProperty,
}: {
  data: Data;
  lastSymbolization: ISymbolization | null;
  idMap: IDMap;
  previewProperty: PreviewProperty;
}): SplitGroupsDeprecated {
  const { selection, folderMap, featureMapDeprecated } = data;

  const features: Feature[] = [];
  let selectedFeature: Feature | null = null;

  // Do this first because we have to assign IDs
  // based on the order in the array.
  const exclude = generateExclude(folderMap);

  const keepProperties = getKeepProperties({
    symbolization: lastSymbolization,
    previewProperty,
  });

  for (const feature of featureMapDeprecated.values()) {
    // exclude.size here is an attempt at micro-optimization,
    // saving the .has if there is no exclusion
    if (feature.folderId && exclude.size && exclude.has(feature.folderId)) {
      continue;
    }
    if (feature.feature.properties?.visibility === false) {
      continue;
    }
    if (selection.type === "single" && feature.id === selection.id) {
      selectedFeature = stripFeature({
        wrappedFeature: feature,
        keepProperties,
        idMap,
      });
    } else {
      features.push(
        stripFeature({
          wrappedFeature: feature,
          keepProperties,
          idMap,
        }),
      );
    }
  }

  // If nothing is selected, don't split the selected
  // feature at all.
  const noneResult = {
    synthetic: EMPTY_ARRAY,
    ephemeral: EMPTY_ARRAY,
    features,
    selectionIds: emptySelection,
  } as const;

  switch (selection.type) {
    case "single": {
      const { id } = selection;
      if (!selectedFeature) {
        // TODO: dirty code
        // Workaround: if the selected feature no longer exists
        return noneResult;
      }

      const selectionIds = new Set<RawId>(selection.parts.map(encodeId));
      return {
        synthetic: generateSyntheticPoints(
          selectedFeature,
          UIDMap.getIntID(idMap, id),
        ),
        ephemeral: [fixDegenerates(selectedFeature)],
        features,
        selectionIds,
      };
    }
    case "folder":
    case "none": {
      return noneResult;
    }
    case "multi": {
      // Performance optimization: using .includes()
      // here with an array may be slow.
      const selectionIds = new Set<RawId>(
        selection.ids.map((uuid) => UIDMap.getIntID(idMap, uuid)),
      );
      return {
        synthetic: EMPTY_ARRAY,
        ephemeral: EMPTY_ARRAY,
        features,
        selectionIds,
      };
    }
  }
}
