import { useState, useCallback } from "react";
import {
  AllocationRule,
  CustomerPoint,
  defaultAllocationRule,
} from "src/hydraulic-model/customer-points";
import {
  WizardState,
  WizardActions,
  WizardStep,
  ParsedDataSummary,
} from "./types";
import { AllocationResult } from "src/hydraulic-model/model-operations/allocate-customer-points";

const initialState: WizardState = {
  currentStep: 1,
  selectedFile: null,
  parsedCustomerPoints: null,
  parsedDataSummary: null,
  isLoading: false,
  error: null,
  isProcessing: false,
  keepDemands: false,
  allocationRules: [defaultAllocationRule],
  connectionCounts: null,
  allocationResult: null,
  isAllocating: false,
  lastAllocatedRules: null,
};

export const useWizardState = (): WizardState & WizardActions => {
  const [state, setState] = useState<WizardState>(initialState);

  const goToStep = useCallback((step: WizardStep) => {
    setState((prev) => ({ ...prev, currentStep: step, error: null }));
  }, []);

  const goNext = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentStep: Math.min(4, prev.currentStep + 1) as WizardStep,
      error: null,
    }));
  }, []);

  const goBack = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentStep: Math.max(1, prev.currentStep - 1) as WizardStep,
      error: null,
    }));
  }, []);

  const setSelectedFile = useCallback((file: File | null) => {
    setState((prev) => ({ ...prev, selectedFile: file, error: null }));
  }, []);

  const setParsedCustomerPoints = useCallback(
    (points: CustomerPoint[] | null) => {
      setState((prev) => ({ ...prev, parsedCustomerPoints: points }));
    },
    [],
  );

  const setParsedDataSummary = useCallback(
    (summary: ParsedDataSummary | null) => {
      setState((prev) => ({ ...prev, parsedDataSummary: summary }));
    },
    [],
  );

  const setError = useCallback((error: string | null) => {
    setState((prev) => ({
      ...prev,
      error,
      isLoading: false,
      isProcessing: false,
    }));
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setState((prev) => ({ ...prev, isLoading: loading, error: null }));
  }, []);

  const setProcessing = useCallback((processing: boolean) => {
    setState((prev) => ({ ...prev, isProcessing: processing, error: null }));
  }, []);

  const setKeepDemands = useCallback((keepDemands: boolean) => {
    setState((prev) => ({ ...prev, keepDemands }));
  }, []);

  const setAllocationRules = useCallback(
    (allocationRules: AllocationRule[]) => {
      setState((prev) => ({ ...prev, allocationRules }));
    },
    [],
  );

  const setConnectionCounts = useCallback(
    (connectionCounts: { [ruleIndex: number]: number } | null) => {
      setState((prev) => ({ ...prev, connectionCounts }));
    },
    [],
  );

  const setAllocationResult = useCallback(
    (allocationResult: AllocationResult | null) => {
      setState((prev) => ({ ...prev, allocationResult }));
    },
    [],
  );

  const setIsAllocating = useCallback((isAllocating: boolean) => {
    setState((prev) => ({ ...prev, isAllocating, error: null }));
  }, []);

  const setLastAllocatedRules = useCallback(
    (lastAllocatedRules: AllocationRule[] | null) => {
      setState((prev) => ({ ...prev, lastAllocatedRules }));
    },
    [],
  );

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return {
    ...state,
    goToStep,
    goNext,
    goBack,
    setSelectedFile,
    setParsedCustomerPoints,
    setParsedDataSummary,
    setError,
    setLoading,
    setProcessing,
    setKeepDemands,
    setAllocationRules,
    setConnectionCounts,
    setAllocationResult,
    setIsAllocating,
    setLastAllocatedRules,
    reset,
  };
};
