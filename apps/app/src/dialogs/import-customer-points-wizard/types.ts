import { CustomerPoint, CustomerPointId } from "@epanet-js/hydraulic-model";
import { Demand } from "@epanet-js/hydraulic-model";
import { CustomerPointsParserIssues } from "./issues";
import { Unit } from "@epanet-js/quantity";
import { IdGenerator } from "@epanet-js/id-generator";
import type { CoordinateAttributes } from "@epanet-js/gis-importers";

export type WizardStep = 1 | 2 | 3;

export type ParsedDataSummary = {
  validCustomerPoints: CustomerPoint[];
  idGenerator?: IdGenerator;
  customerPointDemands: Map<CustomerPointId, Demand[]>;
  issues: CustomerPointsParserIssues | null;
  totalCount: number;
  demandImportUnit: Unit;
};

export type InputData = {
  properties: Set<string>;
  /** The source states its coordinates in attributes it does not name, so
   *  nothing can be read until the mapping step is told which they are. */
  needsCoordinates?: boolean;
};

export type WizardState = {
  currentStep: WizardStep;
  sourceFiles: File[];
  parsedDataSummary: ParsedDataSummary | null;
  inputData: InputData | null;
  selectedDemandProperty: string | null;
  selectedLabelProperty: string | null;
  coordinateAttributes: CoordinateAttributes | null;
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
  setSourceFiles: (files: File[]) => void;
  setParsedDataSummary: (summary: ParsedDataSummary | null) => void;
  setInputData: (data: InputData | null) => void;
  setSelectedDemandProperty: (property: string | null) => void;
  setSelectedLabelProperty: (property: string | null) => void;
  setCoordinateAttributes: (attributes: CoordinateAttributes | null) => void;
  resetWizardData: () => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  setProcessing: (processing: boolean) => void;
  setKeepDemands: (keepDemands: boolean) => void;
  setSelectedPatternId: (patternId: number | null) => void;
  setDefaultDemand: (value: number) => void;
  reset: () => void;
};
