import { atom } from "jotai";
import { formatCapitalize } from "src/lib/utils";
import { simulationSettingsDerivedAtom } from "src/state/derived-branch-state";
import { simulationSettingsAtom } from "src/state/simulation-settings";

export type TranslationOverride = {
  key: string;
  variables?: string[];
};

export type TranslationOverridesMap = Record<string, TranslationOverride>;

// Base atom for manually registered overrides.
const manualTranslationOverridesAtom = atom<TranslationOverridesMap>({});

// Derived atom that computes overrides from simulation settings.
// Reads from both atoms so it works regardless of the FLAG_STATE_REFACTOR state.
const simulationTranslationOverridesAtom = atom(
  (get): TranslationOverridesMap => {
    const qualityChemicalName =
      get(simulationSettingsDerivedAtom).qualityChemicalName ||
      get(simulationSettingsAtom).qualityChemicalName;

    if (!qualityChemicalName) return {};

    const chemicalName = formatCapitalize(qualityChemicalName);
    return {
      chemicalConcentration: {
        key: "customChemicalConcentration",
        variables: [chemicalName],
      },
      initialChemicalConcentration: {
        key: "initialCustomChemicalConcentration",
        variables: [chemicalName],
      },
    };
  },
);

// Combined atom: simulation overrides merged with manual overrides.
// Manual overrides take precedence (placed last).
export const translationOverridesAtom = atom(
  (get): TranslationOverridesMap => ({
    ...get(simulationTranslationOverridesAtom),
    ...get(manualTranslationOverridesAtom),
  }),
  (_get, set, value: TranslationOverridesMap) => {
    set(manualTranslationOverridesAtom, value);
  },
);
