import { Feature } from "geojson";
import {
  AllocationRule,
  CustomerPoint,
} from "src/hydraulic-model/customer-points";
import { CustomerPointsParserIssues } from "src/import/customer-points/parse-customer-points-issues";
import { AllocationResult } from "src/hydraulic-model/model-operations/allocate-customer-points";
import { Unit } from "src/quantity";

export type WizardStep = 1 | 2 | 3 | 4;

export type ParsedDataSummary = {
  validCustomerPoints: CustomerPoint[];
  issues: CustomerPointsParserIssues | null;
  totalCount: number;
  demandImportUnit: Unit;
};

export type InputData = {
  properties: Set<string>;
  features: Feature[];
};

export type WizardState = {
  currentStep: WizardStep;
  selectedFile: File | null;
  parsedCustomerPoints: CustomerPoint[] | null;
  parsedDataSummary: ParsedDataSummary | null;
  inputData: InputData | null;
  selectedDemandProperty: string | null;
  selectedLabelProperty: string | null;
  isLoading: boolean;
  error: string | null;
  isProcessing: boolean;
  keepDemands: boolean;
  allocationRules: AllocationRule[] | null;
  connectionCounts: { [ruleIndex: number]: number } | null;
  allocationResult: AllocationResult | null;
  isAllocating: boolean;
  lastAllocatedRules: AllocationRule[] | null;
  isEditingRules: boolean;
  selectedPatternId: string | null;
};

export type WizardActions = {
  goToStep: (step: WizardStep) => void;
  goNext: () => void;
  goBack: () => void;
  setSelectedFile: (file: File | null) => void;
  setParsedCustomerPoints: (points: CustomerPoint[] | null) => void;
  setParsedDataSummary: (summary: ParsedDataSummary | null) => void;
  setInputData: (data: InputData | null) => void;
  setSelectedDemandProperty: (property: string | null) => void;
  setSelectedLabelProperty: (property: string | null) => void;
  resetWizardData: () => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  setProcessing: (processing: boolean) => void;
  setKeepDemands: (keepDemands: boolean) => void;
  setAllocationRules: (rules: AllocationRule[]) => void;
  setConnectionCounts: (counts: { [ruleIndex: number]: number } | null) => void;
  setAllocationResult: (result: AllocationResult | null) => void;
  setIsAllocating: (isAllocating: boolean) => void;
  setLastAllocatedRules: (rules: AllocationRule[] | null) => void;
  setIsEditingRules: (isEditingRules: boolean) => void;
  setSelectedPatternId: (patternId: string | null) => void;
  reset: () => void;
};
