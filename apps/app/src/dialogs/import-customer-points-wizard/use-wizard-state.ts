import { atom, useAtom } from "jotai";
import { useAtomValue } from "jotai";
import {
  CustomerPointAllocationRule,
  CustomerPointAllocationResult,
  CustomerPoint,
  getDefaultAllocationRules,
} from "@epanet-js/hydraulic-model";
import { UnitsSpec } from "src/lib/project-settings/quantities-spec";
import { projectSettingsAtom } from "src/state/project-settings";
import {
  WizardState,
  WizardActions,
  WizardStep,
  ParsedDataSummary,
  InputData,
} from "./types";

const initialState: WizardState = {
  currentStep: 1,
  selectedFile: null,
  parsedCustomerPoints: null,
  parsedDataSummary: null,
  inputData: null,
  selectedDemandProperty: null,
  selectedLabelProperty: null,
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
  selectedPatternId: null,
  defaultDemand: 0,
};

export const wizardStateAtom = atom<WizardState>(initialState);

export const useWizardState = (): Omit<WizardState, "allocationRules"> & {
  allocationRules: CustomerPointAllocationRule[];
  units: UnitsSpec;
} & WizardActions => {
  const [state, setWizardState] = useAtom(wizardStateAtom);
  const { units } = useAtomValue(projectSettingsAtom);

  const goToStep = (step: WizardStep) => {
    setWizardState((prev) => ({ ...prev, currentStep: step, error: null }));
  };

  const goNext = () => {
    setWizardState((prev) => ({
      ...prev,
      currentStep: Math.min(4, prev.currentStep + 1) as WizardStep,
      error: null,
    }));
  };

  const goBack = () => {
    setWizardState((prev) => ({
      ...prev,
      currentStep: Math.max(1, prev.currentStep - 1) as WizardStep,
      error: null,
    }));
  };

  const setSelectedFile = (file: File | null) => {
    setWizardState((prev) => ({
      ...prev,
      selectedFile: file,
      error: null,
    }));
  };

  const setParsedCustomerPoints = (points: CustomerPoint[] | null) => {
    setWizardState((prev) => ({ ...prev, parsedCustomerPoints: points }));
  };

  const setParsedDataSummary = (summary: ParsedDataSummary | null) => {
    setWizardState((prev) => ({ ...prev, parsedDataSummary: summary }));
  };

  const setInputData = (data: InputData | null) => {
    setWizardState((prev) => ({ ...prev, inputData: data }));
  };

  const setSelectedDemandProperty = (property: string | null) => {
    setWizardState((prev) => ({ ...prev, selectedDemandProperty: property }));
  };

  const setSelectedLabelProperty = (property: string | null) => {
    setWizardState((prev) => ({ ...prev, selectedLabelProperty: property }));
  };

  const resetWizardData = () => {
    setWizardState(initialState);
  };

  const setError = (error: string | null) => {
    setWizardState((prev) => ({
      ...prev,
      error,
      isProcessing: false,
    }));
  };

  const setLoading = (loading: boolean) => {
    setWizardState((prev) => ({ ...prev, isLoading: loading }));
  };

  const setProcessing = (processing: boolean) => {
    setWizardState((prev) => ({
      ...prev,
      isProcessing: processing,
      error: null,
    }));
  };

  const setKeepDemands = (keepDemands: boolean) => {
    setWizardState((prev) => ({ ...prev, keepDemands }));
  };

  const setAllocationRules = (
    allocationRules: CustomerPointAllocationRule[],
  ) => {
    setWizardState((prev) => ({ ...prev, allocationRules }));
  };

  const setConnectionCounts = (
    connectionCounts: { [ruleIndex: number]: number } | null,
  ) => {
    setWizardState((prev) => ({ ...prev, connectionCounts }));
  };

  const setAllocationResult = (
    allocationResult: CustomerPointAllocationResult | null,
  ) => {
    setWizardState((prev) => ({ ...prev, allocationResult }));
  };

  const setIsAllocating = (isAllocating: boolean) => {
    setWizardState((prev) => ({ ...prev, isAllocating, error: null }));
  };

  const setLastAllocatedRules = (
    lastAllocatedRules: CustomerPointAllocationRule[] | null,
  ) => {
    setWizardState((prev) => ({ ...prev, lastAllocatedRules }));
  };

  const setIsEditingRules = (isEditingRules: boolean) => {
    setWizardState((prev) => ({ ...prev, isEditingRules }));
  };

  const setSelectedPatternId = (patternId: number | null) => {
    setWizardState((prev) => ({ ...prev, selectedPatternId: patternId }));
  };

  const setDefaultDemand = (value: number) => {
    setWizardState((prev) => ({ ...prev, defaultDemand: value }));
  };

  const reset = () => {
    setWizardState(initialState);
  };

  return {
    ...state,
    allocationRules: state.allocationRules ?? getDefaultAllocationRules(units),
    units,
    goToStep,
    goNext,
    goBack,
    setSelectedFile,
    setParsedCustomerPoints,
    setParsedDataSummary,
    setInputData,
    setSelectedDemandProperty,
    setSelectedLabelProperty,
    resetWizardData,
    setError,
    setLoading,
    setProcessing,
    setKeepDemands,
    setAllocationRules,
    setConnectionCounts,
    setAllocationResult,
    setIsAllocating,
    setLastAllocatedRules,
    setIsEditingRules,
    setSelectedPatternId,
    setDefaultDemand,
    reset,
  };
};
