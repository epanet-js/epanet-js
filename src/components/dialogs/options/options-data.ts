export type OptionType = "number" | "select" | "text";

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

export const optionCategories: OptionCategory[] = [
  {
    id: "hydraulics-general",
    label: "Hydraulics",
    options: [
      {
        id: "UNITS",
        label: "Flow Units",
        description:
          "Units in which flow rates are expressed. Choosing a US unit (CFS, GPM, MGD, IMGD, AFD) sets US Customary units for all other quantities. Choosing a metric unit (LPS, LPM, MLD, CMS, CMH, CMD) sets SI Metric units.",
        type: "select",
        defaultValue: "GPM",
        options: [
          { label: "CFS (cubic feet per second)", value: "CFS" },
          { label: "GPM (gallons per minute)", value: "GPM" },
          { label: "MGD (million gallons per day)", value: "MGD" },
          { label: "IMGD (Imperial MGD)", value: "IMGD" },
          { label: "AFD (acre-feet per day)", value: "AFD" },
          { label: "LPS (liters per second)", value: "LPS" },
          { label: "LPM (liters per minute)", value: "LPM" },
          { label: "MLD (million liters per day)", value: "MLD" },
          { label: "CMS (cubic meters per second)", value: "CMS" },
          { label: "CMH (cubic meters per hour)", value: "CMH" },
          { label: "CMD (cubic meters per day)", value: "CMD" },
        ],
      },
      {
        id: "PRESSURE",
        label: "Pressure Units",
        description:
          "Units in which pressure is expressed, regardless of which unit system is in use.",
        type: "select",
        defaultValue: "PSI",
        options: [
          { label: "PSI", value: "PSI" },
          { label: "KPA", value: "KPA" },
          { label: "Meters", value: "METERS" },
          { label: "Feet", value: "FEET" },
          { label: "Bar", value: "BAR" },
        ],
      },
      {
        id: "HEADLOSS",
        label: "Head Loss Formula",
        description: "Formula used for computing head loss through a pipe.",
        type: "select",
        defaultValue: "H-W",
        options: [
          { label: "Hazen-Williams (H-W)", value: "H-W" },
          { label: "Darcy-Weisbach (D-W)", value: "D-W" },
          { label: "Chezy-Manning (C-M)", value: "C-M" },
        ],
      },
      {
        id: "VISCOSITY",
        label: "Viscosity",
        description:
          "Kinematic viscosity of the fluid being modeled relative to that of water at 20 deg. C (1.0 centistoke).",
        type: "number",
        defaultValue: 1.0,
      },
      {
        id: "SPECIFIC_GRAVITY",
        label: "Specific Gravity",
        description:
          "Ratio of the density of the fluid being modeled to that of water at 4 deg. C (unitless).",
        type: "number",
        defaultValue: 1.0,
      },
    ],
  },
  {
    id: "hydraulics-solver",
    label: "Solver",
    options: [],
    subcategories: [
      {
        id: "solver-convergence",
        label: "Convergence",
        options: [
          {
            id: "TRIALS",
            label: "Trials",
            description:
              "Maximum number of trials used to solve network hydraulics at each hydraulic time step.",
            type: "number",
            defaultValue: 40,
          },
          {
            id: "ACCURACY",
            label: "Accuracy",
            description:
              "Convergence criterion: trials end when the sum of all flow changes divided by total flow in all links is less than this value.",
            type: "number",
            defaultValue: 0.001,
          },
          {
            id: "FLOWCHANGE",
            label: "Flow Change",
            description:
              "Convergence criterion requiring the largest absolute flow change between solutions be less than this value (in flow units). 0 means not used.",
            type: "number",
            defaultValue: 0,
          },
          {
            id: "HEADERROR",
            label: "Head Error",
            description:
              "Convergence criterion requiring head loss compared to the difference in nodal heads across each link be less than this value. 0 means not used.",
            type: "number",
            defaultValue: 0,
          },
        ],
      },
      {
        id: "solver-status-checks",
        label: "Status Checks",
        options: [
          {
            id: "CHECKFREQ",
            label: "Check Frequency",
            description:
              "Number of solution trials between status checks on pumps, check valves, flow control valves and pipes connected to tanks.",
            type: "number",
            defaultValue: 2,
          },
          {
            id: "MAXCHECK",
            label: "Max Check",
            description:
              "Number of solution trials after which periodic status checks are discontinued. Status is then checked only at convergence.",
            type: "number",
            defaultValue: 10,
          },
          {
            id: "DAMPLIMIT",
            label: "Damp Limit",
            description:
              "Accuracy value at which solution damping and status checks on PRVs and PSVs begin. Damping limits flow changes to 60%. 0 means no damping.",
            type: "number",
            defaultValue: 0,
          },
          {
            id: "UNBALANCED",
            label: "Unbalanced",
            description:
              "What happens if a hydraulic solution cannot be reached within the prescribed number of trials.",
            type: "select",
            defaultValue: "STOP",
            options: [
              { label: "Stop", value: "STOP" },
              { label: "Continue", value: "CONTINUE" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "hydraulics-demands",
    label: "Demands",
    options: [
      {
        id: "DEMAND_MODEL",
        label: "Demand Model",
        description:
          "DDA (demand driven) always meets full nodal demands. PDA (pressure driven) varies demand as a power function of nodal pressure.",
        type: "select",
        defaultValue: "DDA",
        options: [
          { label: "Demand Driven (DDA)", value: "DDA" },
          { label: "Pressure Driven (PDA)", value: "PDA" },
        ],
      },
      {
        id: "PATTERN",
        label: "Default Pattern",
        description:
          "ID label of a default demand pattern applied to all junctions where no pattern was specified.",
        type: "text",
        defaultValue: "1",
      },
      {
        id: "DEMAND_MULTIPLIER",
        label: "Demand Multiplier",
        description:
          "Adjusts baseline demands for all junctions and demand categories. A value of 2 doubles all demands.",
        type: "number",
        defaultValue: 1.0,
      },
    ],
    subcategories: [
      {
        id: "demands-pressure-driven",
        label: "Pressure Driven",
        options: [
          {
            id: "MINIMUM_PRESSURE",
            label: "Minimum Pressure",
            description:
              "Pressure below which no demand can be delivered under a pressure driven analysis. No effect on DDA.",
            type: "number",
            defaultValue: 0,
          },
          {
            id: "REQUIRED_PRESSURE",
            label: "Required Pressure",
            description:
              "Pressure required to supply a node's full demand under a pressure driven analysis. Must be at least 0.1 above minimum pressure. No effect on DDA.",
            type: "number",
            defaultValue: 0.1,
          },
          {
            id: "PRESSURE_EXPONENT",
            label: "Pressure Exponent",
            description:
              "Power to which pressure is raised when computing demand under pressure driven analysis. No effect on DDA.",
            type: "number",
            defaultValue: 0.5,
          },
        ],
      },
      {
        id: "demands-emitters",
        label: "Emitters",
        options: [
          {
            id: "EMITTER_EXPONENT",
            label: "Emitter Exponent",
            description:
              "Power to which pressure at a junction is raised when computing flow from an emitter.",
            type: "number",
            defaultValue: 0.5,
          },
          {
            id: "EMITTER_BACKFLOW",
            label: "Emitter Backflow",
            description:
              "Whether backflow through an emitter (flow into the network) is allowed.",
            type: "select",
            defaultValue: "YES",
            options: [
              { label: "Yes", value: "YES" },
              { label: "No", value: "NO" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "water-quality",
    label: "Water Quality",
    options: [
      {
        id: "QUALITY",
        label: "Quality Analysis",
        description:
          "Type of water quality analysis to perform. Chemical analyzes a chemical constituent, Age tracks water age, Trace traces flow from a specific node.",
        type: "select",
        defaultValue: "NONE",
        options: [
          { label: "None", value: "NONE" },
          { label: "Chemical", value: "CHEMICAL" },
          { label: "Age", value: "AGE" },
          { label: "Trace", value: "TRACE" },
        ],
      },
      {
        id: "DIFFUSIVITY",
        label: "Diffusivity",
        description:
          "Molecular diffusivity of the chemical being analyzed relative to chlorine in water. Only used when mass transfer limitations are considered. 0 ignores mass transfer.",
        type: "number",
        defaultValue: 1.0,
      },
      {
        id: "TOLERANCE",
        label: "Tolerance",
        description:
          "Difference in water quality level below which one parcel of water is considered the same as another.",
        type: "number",
        defaultValue: 0.01,
      },
    ],
  },
  {
    id: "other",
    label: "Other",
    options: [
      {
        id: "HYDRAULICS",
        label: "Hydraulics File",
        description:
          "Save the current hydraulics solution to a file or use a previously saved one. Useful when studying factors that only affect water quality.",
        type: "select",
        defaultValue: "NONE",
        options: [
          { label: "None", value: "NONE" },
          { label: "Use", value: "USE" },
          { label: "Save", value: "SAVE" },
        ],
      },
      {
        id: "MAP",
        label: "Map File",
        description:
          "Name of a file containing coordinates of the network's nodes for drawing a map. Not used for hydraulic or water quality computations.",
        type: "text",
        defaultValue: "",
      },
    ],
  },
];

export const buildSectionIds = (): string[] => {
  const ids: string[] = [];
  for (const category of optionCategories) {
    ids.push(category.id);
    for (const sub of category.subcategories ?? []) {
      ids.push(sub.id);
    }
  }
  return ids;
};

export const buildDefaultValues = (): Record<string, string | number> => {
  const defaults: Record<string, string | number> = {};
  for (const category of optionCategories) {
    for (const option of category.options) {
      defaults[option.id] = option.defaultValue;
    }
    for (const sub of category.subcategories ?? []) {
      for (const option of sub.options) {
        defaults[option.id] = option.defaultValue;
      }
    }
  }
  return defaults;
};
