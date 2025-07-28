import { CustomerPoint } from "src/hydraulic-model/customer-points";
import { CustomerPointsParserIssues } from "src/import/parse-customer-points-issues";

export type WizardStep = 1 | 2 | 3 | 4;

export type AllocationRule = {
  maxDistance: number;
  maxDiameter: number;
};

export type ParsedDataSummary = {
  validCustomerPoints: CustomerPoint[];
  issues: CustomerPointsParserIssues | null;
  totalCount: number;
};

export type WizardState = {
  currentStep: WizardStep;
  selectedFile: File | null;
  parsedCustomerPoints: CustomerPoint[] | null;
  parsedDataSummary: ParsedDataSummary | null;
  isLoading: boolean;
  error: string | null;
  isProcessing: boolean;
  keepDemands: boolean;
  allocationRules: AllocationRule[];
  connectionCounts: { [ruleIndex: number]: number } | null;
};

export type WizardActions = {
  goToStep: (step: WizardStep) => void;
  goNext: () => void;
  goBack: () => void;
  setSelectedFile: (file: File | null) => void;
  setParsedCustomerPoints: (points: CustomerPoint[] | null) => void;
  setParsedDataSummary: (summary: ParsedDataSummary | null) => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  setProcessing: (processing: boolean) => void;
  setKeepDemands: (keepDemands: boolean) => void;
  setAllocationRules: (rules: AllocationRule[]) => void;
  setConnectionCounts: (counts: { [ruleIndex: number]: number } | null) => void;
  reset: () => void;
};
