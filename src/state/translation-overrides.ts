import { atom } from "jotai";
import { formatCapitalize } from "src/lib/utils";
import { simulationSettingsDerivedAtom } from "src/state/derived-branch-state";

export type TranslationOverride = {
  key: string;
  variables?: string[];
};

export type TranslationOverridesMap = Record<string, TranslationOverride>;

const manualTranslationOverridesAtom = atom<TranslationOverridesMap>({});

const simulationTranslationOverridesAtom = atom(
  (get): TranslationOverridesMap => {
    const qualityChemicalName = get(
      simulationSettingsDerivedAtom,
    ).qualityChemicalName;

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

export const translationOverridesAtom = atom(
  (get): TranslationOverridesMap => ({
    ...get(simulationTranslationOverridesAtom),
    ...get(manualTranslationOverridesAtom),
  }),
  (_get, set, value: TranslationOverridesMap) => {
    set(manualTranslationOverridesAtom, value);
  },
);
