import { CustomerPoint } from "src/hydraulic-model/customer-points";
import { CustomerPointsParserIssues } from "src/import/parse-customer-points-issues";

export type WizardStep = 1 | 2 | 3;

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
  reset: () => void;
};
