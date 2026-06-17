import { Feature } from "geojson";
import { CustomerPoint, CustomerPointId } from "@epanet-js/hydraulic-model";
import { Demand } from "@epanet-js/hydraulic-model";
import { CustomerPointsParserIssues } from "src/import/customer-points/parse-customer-points-issues";
import { Unit } from "@epanet-js/quantity";

export type WizardStep = 1 | 2 | 3;

export type ParsedDataSummary = {
  validCustomerPoints: CustomerPoint[];
  customerPointDemands: Map<CustomerPointId, Demand[]>;
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
  parsedDataSummary: ParsedDataSummary | null;
  inputData: InputData | null;
  selectedDemandProperty: string | null;
  selectedLabelProperty: string | null;
  isLoading: boolean;
  error: string | null;
  isProcessing: boolean;
  keepDemands: boolean;
  selectedPatternId: number | null;
  defaultDemand: number;
};

export type WizardActions = {
  goToStep: (step: WizardStep) => void;
  goNext: () => void;
  goBack: () => void;
  setSelectedFile: (file: File | null) => void;
  setParsedDataSummary: (summary: ParsedDataSummary | null) => void;
  setInputData: (data: InputData | null) => void;
  setSelectedDemandProperty: (property: string | null) => void;
  setSelectedLabelProperty: (property: string | null) => void;
  resetWizardData: () => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  setProcessing: (processing: boolean) => void;
  setKeepDemands: (keepDemands: boolean) => void;
  setSelectedPatternId: (patternId: number | null) => void;
  setDefaultDemand: (value: number) => void;
  reset: () => void;
};
