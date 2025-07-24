import { CustomerPoint } from "src/hydraulic-model/customer-points";

export type WizardStep = 1 | 2;

export type WizardState = {
  currentStep: WizardStep;
  selectedFile: File | null;
  parsedCustomerPoints: CustomerPoint[] | null;
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
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  setProcessing: (processing: boolean) => void;
  setKeepDemands: (keepDemands: boolean) => void;
  reset: () => void;
};
