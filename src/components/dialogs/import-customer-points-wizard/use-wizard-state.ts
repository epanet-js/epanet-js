import { useState, useCallback } from "react";
import { CustomerPoint } from "src/hydraulic-model/customer-points";
import {
  WizardState,
  WizardActions,
  WizardStep,
  ParsedDataSummary,
  AllocationRule,
} from "./types";

const initialState: WizardState = {
  currentStep: 1,
  selectedFile: null,
  parsedCustomerPoints: null,
  parsedDataSummary: null,
  isLoading: false,
  error: null,
  isProcessing: false,
  keepDemands: false,
  allocationRules: [{ maxDistance: 100, maxDiameter: 200 }],
  connectionCounts: null,
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
    reset,
  };
};
