export type OptionCategory = {
  id: string;
  label: string;
};

export const simulationSettingsCategories: OptionCategory[] = [
  {
    id: "times",
    label: "Times",
  },
];

export const buildSectionIds = (): string[] => {
  return simulationSettingsCategories.map((category) => category.id);
};
