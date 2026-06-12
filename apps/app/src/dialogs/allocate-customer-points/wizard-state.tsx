import { useState, useMemo, useEffect } from "react";
import { useAtomValue } from "jotai";
import {
  CustomerPointAllocationRule,
  CustomerPointAllocationResult,
  getDefaultAllocationRules,
} from "@epanet-js/hydraulic-model";

import { projectSettingsAtom } from "src/state/project-settings";
import { ZoneId } from "src/lib/zones";

export function useAllocateCustomerPointsState() {
  const { units } = useAtomValue(projectSettingsAtom);
  const defaultRules = useMemo(() => getDefaultAllocationRules(units), [units]);

  const [allocationRules, setAllocationRules] = useState<
    CustomerPointAllocationRule[]
  >([]);
  const [tempRules, setTempRules] = useState<CustomerPointAllocationRule[]>([]);
  const [isEditingRules, setIsEditingRules] = useState(false);
  const [lastAllocatedRules, setLastAllocatedRules] = useState<
    CustomerPointAllocationRule[] | null
  >(null);
  const [allocationResult, setAllocationResult] =
    useState<CustomerPointAllocationResult | null>(null);
  const [isAllocating, setIsAllocating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<number>(1);
  const [pipeAllocationMode, setPipeAllocationMode] = useState<
    "allPipes" | "selectedPipes"
  >("allPipes");
  const [customerAllocationMode, setCustomerAllocationMode] = useState<
    "allCustomers" | "zoneCustomers"
  >("allCustomers");
  const [allocationZone, setAllocationZone] = useState<ZoneId | null>(null);

  useEffect(() => {
    setAllocationRules(defaultRules);
  }, [defaultRules]);

  return {
    allocationRules,
    setAllocationRules,
    tempRules,
    setTempRules,
    isEditingRules,
    setIsEditingRules,
    lastAllocatedRules,
    setLastAllocatedRules,
    allocationResult,
    setAllocationResult,
    isAllocating,
    setIsAllocating,
    isProcessing,
    setIsProcessing,
    error,
    setError,
    step,
    setStep,
    pipeAllocationMode,
    setPipeAllocationMode,
    customerAllocationMode,
    setCustomerAllocationMode,
    allocationZone,
    setAllocationZone,
  };
}

export type AllocateCustomerPointsState = ReturnType<
  typeof useAllocateCustomerPointsState
>;
