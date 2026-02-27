export type OptionType = "number" | "select" | "text" | "time";

export type OptionDefinition = {
  id: string;
  label: string;
  description: string;
  type: OptionType;
  defaultValue: string | number;
  options?: { label: string; value: string }[];
};

export type OptionSubcategory = {
  id: string;
  label: string;
  options: OptionDefinition[];
};

export type OptionCategory = {
  id: string;
  label: string;
  options: OptionDefinition[];
  subcategories?: OptionSubcategory[];
};

export const simulationSettingsCategories: OptionCategory[] = [
  {
    id: "hydraulics-general",
    label: "Hydraulics",
    options: [],
  },
  {
    id: "hydraulics-solver",
    label: "Solver",
    options: [],
    subcategories: [
      {
        id: "solver-convergence",
        label: "Convergence",
        options: [],
      },
      {
        id: "solver-status-checks",
        label: "Status Checks",
        options: [],
      },
    ],
  },
  {
    id: "hydraulics-demands",
    label: "Demands",
    options: [],
    subcategories: [
      {
        id: "demands-pressure-driven",
        label: "Pressure Driven",
        options: [],
      },
      {
        id: "demands-emitters",
        label: "Emitters",
        options: [],
      },
    ],
  },
  {
    id: "times",
    label: "Times",
    options: [],
  },
  {
    id: "water-quality",
    label: "Water Quality",
    options: [],
  },
  {
    id: "energy",
    label: "Energy",
    options: [],
  },
];

export const buildSectionIds = (): string[] => {
  const ids: string[] = [];
  for (const category of simulationSettingsCategories) {
    ids.push(category.id);
    for (const sub of category.subcategories ?? []) {
      ids.push(sub.id);
    }
  }
  return ids;
};
