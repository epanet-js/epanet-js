import { atom, useAtom } from "jotai";
import { useAtomValue } from "jotai";
import {
  AllocationRule,
  CustomerPoint,
  getDefaultAllocationRules,
} from "src/hydraulic-model/customer-points";
import { dataAtom } from "src/state/jotai";
import { UnitsSpec } from "src/model-metadata/quantities-spec";
import {
  WizardState,
  WizardActions,
  WizardStep,
  ParsedDataSummary,
  InputData,
} from "./types";
import { AllocationResult } from "src/hydraulic-model/model-operations/allocate-customer-points";

const initialState: WizardState = {
  currentStep: 1,
  selectedFile: null,
  parsedCustomerPoints: null,
  parsedDataSummary: null,
  inputData: null,
  selectedDemandProperty: null,
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

export const wizardStateAtom = atom<WizardState>(initialState);

export const useWizardState = (): Omit<WizardState, "allocationRules"> & {
  allocationRules: AllocationRule[];
  units: UnitsSpec;
} & WizardActions => {
  const [state, setWizardState] = useAtom(wizardStateAtom);
  const data = useAtomValue(dataAtom);

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

  const setAllocationRules = (allocationRules: AllocationRule[]) => {
    setWizardState((prev) => ({ ...prev, allocationRules }));
  };

  const setConnectionCounts = (
    connectionCounts: { [ruleIndex: number]: number } | null,
  ) => {
    setWizardState((prev) => ({ ...prev, connectionCounts }));
  };

  const setAllocationResult = (allocationResult: AllocationResult | null) => {
    setWizardState((prev) => ({ ...prev, allocationResult }));
  };

  const setIsAllocating = (isAllocating: boolean) => {
    setWizardState((prev) => ({ ...prev, isAllocating, error: null }));
  };

  const setLastAllocatedRules = (
    lastAllocatedRules: AllocationRule[] | null,
  ) => {
    setWizardState((prev) => ({ ...prev, lastAllocatedRules }));
  };

  const setIsEditingRules = (isEditingRules: boolean) => {
    setWizardState((prev) => ({ ...prev, isEditingRules }));
  };

  const reset = () => {
    setWizardState(initialState);
  };

  return {
    ...state,
    allocationRules:
      state.allocationRules ??
      getDefaultAllocationRules(data.hydraulicModel.units),
    units: data.hydraulicModel.units,
    goToStep,
    goNext,
    goBack,
    setSelectedFile,
    setParsedCustomerPoints,
    setParsedDataSummary,
    setInputData,
    setSelectedDemandProperty,
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
    reset,
  };
};
