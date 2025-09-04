import { act } from "@testing-library/react";
import { Store } from "src/state/jotai";
import { wizardStateAtom } from "../use-wizard-state";
import { WizardState, ParsedDataSummary } from "../types";
import { buildCustomerPoint } from "src/__helpers__/hydraulic-model-builder";

export const setWizardState = (
  store: Store,
  overrides: Partial<WizardState> = {},
) => {
  const defaultWizardState: WizardState = {
    currentStep: 2,
    selectedFile: null,
    parsedCustomerPoints: null,
    parsedDataSummary: null,
    inputData: null,
    selectedDemandProperty: "demand",
    isLoading: false,
    error: null,
    isProcessing: false,
    keepDemands: false,
    allocationRules: null,
    connectionCounts: null,
    allocationResult: null,
    isAllocating: false,
    lastAllocatedRules: null,
    isEditingRules: false,
  };

  act(() => {
    store.set(wizardStateAtom, { ...defaultWizardState, ...overrides });
  });
  return store;
};

export const createValidParsedDataSummary = (): ParsedDataSummary => {
  return {
    validCustomerPoints: [
      buildCustomerPoint("1", {
        coordinates: [0.001, 0.001],
        demand: 25.5,
      }),
      buildCustomerPoint("2", {
        coordinates: [0.002, 0.002],
        demand: 50.0,
      }),
    ],
    issues: null,
    totalCount: 2,
    demandImportUnit: "l/d",
  };
};

export const createParsedDataSummaryWithIssues = (): ParsedDataSummary => {
  return {
    validCustomerPoints: [
      buildCustomerPoint("1", {
        coordinates: [0.001, 0.001],
        demand: 25.5,
      }),
      buildCustomerPoint("2", {
        coordinates: [0.002, 0.002],
        demand: 50.0,
      }),
    ],
    issues: {
      skippedNonPointFeatures: [
        {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [
              [0.003, 0.003],
              [0.004, 0.004],
            ],
          },
          properties: {
            name: "Line Feature",
            demand: 100,
          },
        },
      ],
      skippedInvalidCoordinates: [
        {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [0.005],
          },
          properties: {
            name: "Invalid Coordinates",
            demand: 75,
          },
        },
      ],
    },
    totalCount: 4,
    demandImportUnit: "l/d",
  };
};

export const createParsedDataSummaryWithInvalidDemands =
  (): ParsedDataSummary => {
    return {
      validCustomerPoints: [
        buildCustomerPoint("1", {
          coordinates: [0.001, 0.001],
          demand: 25.5,
        }),
      ],
      issues: {
        skippedInvalidDemands: [
          {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [0.002, 0.002],
            },
            properties: {
              name: "String demand",
              demand: "invalid",
            },
          },
          {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [0.003, 0.003],
            },
            properties: {
              name: "Null demand",
              demand: null,
            },
          },
        ],
      },
      totalCount: 3,
      demandImportUnit: "l/d",
    };
  };
