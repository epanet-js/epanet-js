import { useMemo, useCallback } from "react";
import { useAtomValue } from "jotai";
import {
  Asset,
  Junction,
  Pipe,
  Pump,
  Reservoir,
  Tank,
  NodeAsset,
  HydraulicModel,
} from "src/hydraulic-model";
import {
  CustomerPoint,
  getActiveCustomerPoints,
} from "src/hydraulic-model/customer-points";
import { Valve } from "src/hydraulic-model/asset-types";
import {
  DemandPatterns,
  JunctionDemand,
  calculateAverageDemand,
} from "src/hydraulic-model/demands";
import { Quantities } from "src/model-metadata/quantities-spec";
import { useTranslate } from "src/hooks/use-translate";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { usePersistence } from "src/lib/persistence";
import { useUserTracking } from "src/infra/user-tracking";
import { stagingModelAtom } from "src/state/jotai";
import {
  changePumpCurve,
  changeProperty,
  changeJunctionDemands,
  changeLabel,
} from "src/hydraulic-model/model-operations";
import { activateAssets } from "src/hydraulic-model/model-operations/activate-assets";
import { deactivateAssets } from "src/hydraulic-model/model-operations/deactivate-assets";
import { getLinkNodes } from "src/hydraulic-model/assets-map";
import {
  HeadlossFormula,
  PipeStatus,
  pipeStatuses,
} from "src/hydraulic-model/asset-types/pipe";
import { PumpStatus, pumpStatuses } from "src/hydraulic-model/asset-types/pump";
import {
  ValveKind,
  ValveStatus,
  valveKinds,
} from "src/hydraulic-model/asset-types/valve";
import {
  AssetEditorContent,
  QuantityRow,
  SelectRow,
  TextRow,
  SwitchRow,
  ConnectedCustomersRow,
  DemandCategoriesRow,
} from "./ui-components";
import { Section } from "src/components/form/fields";
import {
  PumpDefinitionDetails,
  PumpDefinitionData,
} from "./pump-definition-details";
import { Curves } from "src/hydraulic-model/curves";
import { useQuickGraph } from "./quick-graph";
import { useAssetComparison } from "src/hooks/use-asset-comparison";
import { DemandCategoriesEditor } from "./demand-categories-editor";
import { useSimulation } from "src/hooks/use-simulation";
import type {
  PipeSimulation,
  PumpSimulation,
  ValveSimulation,
} from "src/simulation/results-reader";

type OnPropertyChange = (
  name: string,
  value: number | boolean,
  oldValue: number | boolean | null,
) => void;
type OnStatusChange<T> = (newStatus: T, oldStatus: T) => void;
type OnTypeChange<T> = (newType: T, oldType: T) => void;

const pipeStatusLabel = (sim: Pick<PipeSimulation, "status"> | null) => {
  if (!sim) return "notAvailable";
  return "pipe." + sim.status;
};

const pumpStatusLabel = (
  sim: {
    status: PumpSimulation["status"] | null;
    statusWarning: PumpSimulation["statusWarning"];
  } | null,
) => {
  if (!sim || sim.status === null) return "notAvailable";
  if (sim.statusWarning) {
    return `pump.${sim.status}.${sim.statusWarning}`;
  }
  return "pump." + sim.status;
};

export const valveStatusLabel = (
  sim: {
    status: ValveSimulation["status"] | null;
    statusWarning: ValveSimulation["statusWarning"];
  } | null,
) => {
  if (!sim || sim.status === null) return "notAvailable";
  if (sim.statusWarning) {
    return `valve.${sim.status}.${sim.statusWarning}`;
  }
  return "valve." + sim.status;
};

export function AssetPanel({
  asset,
  quantitiesMetadata,
  readonly = false,
}: {
  asset: Asset;
  quantitiesMetadata: Quantities;
  readonly?: boolean;
}) {
  const hydraulicModel = useAtomValue(stagingModelAtom);
  const rep = usePersistence();
  const transact = rep.useTransact();
  const userTracking = useUserTracking();
  const translate = useTranslate();

  const handlePropertyChange = useCallback(
    (
      property: string,
      value: number | boolean,
      oldValue: number | boolean | null,
    ) => {
      const moment = changeProperty(hydraulicModel, {
        assetIds: [asset.id],
        property,
        value,
      });
      transact(moment);
      userTracking.capture({
        name: "assetProperty.edited",
        type: asset.type,
        property,
        newValue: typeof value === "boolean" ? Number(value) : value,
        oldValue: typeof oldValue === "boolean" ? Number(oldValue) : oldValue,
      });
    },
    [hydraulicModel, asset.id, asset.type, transact, userTracking],
  );

  const handleActiveTopologyStatusChange = useCallback(
    (property: string, newValue: boolean, oldValue: boolean) => {
      const moment = newValue
        ? activateAssets(hydraulicModel, { assetIds: [asset.id] })
        : deactivateAssets(hydraulicModel, { assetIds: [asset.id] });
      transact(moment);
      userTracking.capture({
        name: "assetProperty.edited",
        type: asset.type,
        property: "isActive",
        newValue: Number(newValue),
        oldValue: Number(oldValue),
      });
    },
    [hydraulicModel, asset.id, asset.type, transact, userTracking],
  );

  const handleValveKindChange = useCallback(
    (newType: ValveKind, oldType: ValveKind) => {
      const moment = changeProperty(hydraulicModel, {
        assetIds: [asset.id],
        property: "kind",
        value: newType,
      });
      transact(moment);
      userTracking.capture({
        name: "assetDefinitionType.edited",
        type: asset.type,
        property: "kind",
        newType: newType,
        oldType: oldType,
      });
    },
    [hydraulicModel, asset.id, asset.type, transact, userTracking],
  );

  const handleStatusChange = useCallback(
    <T extends PumpStatus | ValveStatus | PipeStatus>(
      newStatus: T,
      oldStatus: T,
    ) => {
      const moment = changeProperty(hydraulicModel, {
        assetIds: [asset.id],
        property: "initialStatus",
        value: newStatus,
      });
      transact(moment);
      userTracking.capture({
        name: "assetStatus.edited",
        type: asset.type,
        property: "initialStatus",
        newStatus,
        oldStatus,
      });
    },
    [hydraulicModel, asset.id, asset.type, transact, userTracking],
  );

  const handleChangePumpDefinition = useCallback(
    (data: PumpDefinitionData) => {
      const moment = changePumpCurve(hydraulicModel, {
        pumpId: asset.id,
        data,
      });
      transact(moment);
      userTracking.capture({
        name: "assetDefinitionType.edited",
        type: asset.type,
        property: "definitionType",
        newType: data.type,
      });
    },
    [asset.id, asset.type, hydraulicModel, transact, userTracking],
  );

  const handleChangeJunctionDemand = useCallback(
    (newValue: number, oldValue: number) => {
      const junction = asset as Junction;
      const patternDemands = junction.demands.filter((d) => d.patternId);
      const newDemands = [{ baseDemand: newValue }, ...patternDemands];
      const moment = changeJunctionDemands(hydraulicModel, {
        junctionId: asset.id,
        demands: newDemands,
      });
      transact(moment);
      userTracking.capture({
        name: "assetProperty.edited",
        type: asset.type,
        property: "constantDemand",
        newValue,
        oldValue,
      });
    },
    [asset, hydraulicModel, transact, userTracking],
  );

  const handleDemandsChange = useCallback(
    (newDemands: JunctionDemand[]) => {
      const oldDemands = (asset as Junction).demands;
      const moment = changeJunctionDemands(hydraulicModel, {
        junctionId: asset.id,
        demands: newDemands,
      });
      transact(moment);
      userTracking.capture({
        name: "assetProperty.edited",
        type: asset.type,
        property: "demands",
        newValue: newDemands.length,
        oldValue: oldDemands.length,
      });
    },
    [asset, hydraulicModel, transact, userTracking],
  );

  const handleLabelChange = useCallback(
    (newLabel: string): string | undefined => {
      const oldLabel = asset.label;
      if (newLabel === oldLabel) return undefined;

      const isAvailable = hydraulicModel.labelManager.isLabelAvailable(
        newLabel,
        asset.type,
        asset.id,
      );
      if (!isAvailable) {
        return translate("labelDuplicate");
      }

      const moment = changeLabel(hydraulicModel, {
        assetId: asset.id,
        newLabel,
      });
      transact(moment);
      userTracking.capture({
        name: "assetProperty.edited",
        type: asset.type,
        property: "label",
        newValue: newLabel,
        oldValue: oldLabel,
      });
      return undefined;
    },
    [
      asset.id,
      asset.label,
      asset.type,
      hydraulicModel,
      transact,
      translate,
      userTracking,
    ],
  );

  switch (asset.type) {
    case "junction":
      return (
        <JunctionEditor
          junction={asset as Junction}
          quantitiesMetadata={quantitiesMetadata}
          onPropertyChange={handlePropertyChange}
          onConstantDemandChange={handleChangeJunctionDemand}
          onDemandsChange={handleDemandsChange}
          onLabelChange={handleLabelChange}
          hydraulicModel={hydraulicModel}
          readonly={readonly}
        />
      );
    case "pipe": {
      const pipe = asset as Pipe;
      return (
        <PipeEditor
          pipe={pipe}
          {...getLinkNodes(hydraulicModel.assets, pipe)}
          headlossFormula={hydraulicModel.headlossFormula}
          quantitiesMetadata={quantitiesMetadata}
          onPropertyChange={handlePropertyChange}
          onStatusChange={handleStatusChange}
          onActiveTopologyStatusChange={handleActiveTopologyStatusChange}
          onLabelChange={handleLabelChange}
          hydraulicModel={hydraulicModel}
          readonly={readonly}
        />
      );
    }
    case "pump": {
      const pump = asset as Pump;
      return (
        <PumpEditor
          pump={pump}
          curves={hydraulicModel.curves}
          onPropertyChange={handlePropertyChange}
          onStatusChange={handleStatusChange}
          onActiveTopologyStatusChange={handleActiveTopologyStatusChange}
          onDefinitionChange={handleChangePumpDefinition}
          onLabelChange={handleLabelChange}
          quantitiesMetadata={quantitiesMetadata}
          {...getLinkNodes(hydraulicModel.assets, pump)}
          readonly={readonly}
        />
      );
    }
    case "valve": {
      const valve = asset as Valve;
      return (
        <ValveEditor
          valve={valve}
          onPropertyChange={handlePropertyChange}
          quantitiesMetadata={quantitiesMetadata}
          onStatusChange={handleStatusChange}
          onTypeChange={handleValveKindChange}
          onActiveTopologyStatusChange={handleActiveTopologyStatusChange}
          onLabelChange={handleLabelChange}
          {...getLinkNodes(hydraulicModel.assets, valve)}
          readonly={readonly}
        />
      );
    }
    case "reservoir":
      return (
        <ReservoirEditor
          reservoir={asset as Reservoir}
          quantitiesMetadata={quantitiesMetadata}
          onPropertyChange={handlePropertyChange}
          onLabelChange={handleLabelChange}
          readonly={readonly}
        />
      );
    case "tank":
      return (
        <TankEditor
          tank={asset as Tank}
          quantitiesMetadata={quantitiesMetadata}
          onPropertyChange={handlePropertyChange}
          onLabelChange={handleLabelChange}
          readonly={readonly}
        />
      );
  }
}

const JunctionEditor = ({
  junction,
  quantitiesMetadata,
  onPropertyChange,
  onConstantDemandChange,
  onDemandsChange,
  onLabelChange,
  hydraulicModel,
  readonly = false,
}: {
  junction: Junction;
  quantitiesMetadata: Quantities;
  onPropertyChange: OnPropertyChange;
  onConstantDemandChange: (newValue: number, oldValue: number) => void;
  onDemandsChange: (newDemands: JunctionDemand[]) => void;
  onLabelChange: (newLabel: string) => string | undefined;
  hydraulicModel: HydraulicModel;
  readonly?: boolean;
}) => {
  const translate = useTranslate();
  const { footer } = useQuickGraph(junction.id, "junction");
  const isEditJunctionDemandsOn = useFeatureFlag("FLAG_EDIT_JUNCTION_DEMANDS");
  const isSimulationLoose = useFeatureFlag("FLAG_SIMULATION_LOOSE");
  const {
    getComparison,
    getConstantDemandComparison,
    getDirectDemandComparison,
    isNew,
  } = useAssetComparison(junction);
  const simulation = useSimulation();
  const junctionSimulation = simulation?.getJunction(junction.id);

  // Simulation values: use atom when FLAG_SIMULATION_LOOSE is enabled, otherwise use asset
  const simPressure = isSimulationLoose
    ? (junctionSimulation?.pressure ?? null)
    : junction.pressure;
  const simHead = isSimulationLoose
    ? (junctionSimulation?.head ?? null)
    : junction.head;
  const simDemand = isSimulationLoose
    ? (junctionSimulation?.demand ?? null)
    : junction.actualDemand;

  const customerPoints = useMemo(() => {
    return getActiveCustomerPoints(
      hydraulicModel.customerPointsLookup,
      hydraulicModel.assets,
      junction.id,
    );
  }, [junction.id, hydraulicModel]);

  const customerCount = customerPoints.length;
  const totalDemand = useMemo(() => {
    return customerPoints.reduce(
      (sum, cp) =>
        sum +
        calculateAverageDemand(cp.demands, hydraulicModel.demands.patterns),
      0,
    );
  }, [customerPoints, hydraulicModel.demands.patterns]);

  const customerDemandPattern = useMemo(
    () =>
      getCustomerPointsPattern(customerPoints, hydraulicModel.demands.patterns),
    [customerPoints, hydraulicModel.demands.patterns],
  );

  const averageDemand = useMemo(
    () =>
      calculateAverageDemand(junction.demands, hydraulicModel.demands.patterns),
    [junction.demands, hydraulicModel.demands.patterns],
  );

  const demandComparison = getDirectDemandComparison(
    averageDemand,
    hydraulicModel.demands.patterns,
  );

  return (
    <AssetEditorContent
      label={junction.label}
      type={translate("junction")}
      isNew={isNew}
      onLabelChange={onLabelChange}
      footer={footer}
      readOnly={readonly}
      key={junction.id}
    >
      <Section title={translate("activeTopology")}>
        <SwitchRow
          name="isActive"
          label={translate("isEnabled")}
          enabled={junction.isActive}
          comparison={getComparison("isActive", junction.isActive)}
          readOnly={readonly}
        />
      </Section>
      <Section title={translate("modelAttributes")}>
        <QuantityRow
          name="elevation"
          value={junction.elevation}
          unit={quantitiesMetadata.getUnit("elevation")}
          decimals={quantitiesMetadata.getDecimals("elevation")}
          comparison={getComparison("elevation", junction.elevation)}
          onChange={onPropertyChange}
          readOnly={readonly}
        />
      </Section>
      <Section title={translate("demands")}>
        {isEditJunctionDemandsOn ? (
          <div className="flex flex-col gap-2">
            <DemandCategoriesEditor
              demands={junction.demands}
              patterns={hydraulicModel.demands.patterns}
              onDemandsChange={onDemandsChange}
              readOnly={readonly}
            />
            <QuantityRow
              name="directDemand"
              value={averageDemand}
              unit={quantitiesMetadata.getUnit("directDemand")}
              decimals={quantitiesMetadata.getDecimals("directDemand")}
              comparison={demandComparison}
              readOnly={true}
            />
          </div>
        ) : (
          <>
            <QuantityRow
              name="constantDemand"
              value={junction.constantDemand}
              unit={quantitiesMetadata.getUnit("baseDemand")}
              decimals={quantitiesMetadata.getDecimals("baseDemand")}
              comparison={getConstantDemandComparison(junction.constantDemand)}
              onChange={(_name, newValue, oldValue) =>
                onConstantDemandChange(newValue, oldValue ?? 0)
              }
              readOnly={readonly}
            />
            <DemandCategoriesRow
              demands={junction.demands}
              patterns={hydraulicModel.demands.patterns}
              unit={quantitiesMetadata.getUnit("baseDemand")}
            />
          </>
        )}
        {customerCount > 0 && (
          <>
            <QuantityRow
              name="customerDemand"
              value={totalDemand}
              unit={quantitiesMetadata.getUnit("baseDemand")}
              decimals={quantitiesMetadata.getDecimals("baseDemand")}
              readOnly={true}
            />
            {!!customerDemandPattern && (
              <SelectRow
                name="customerPattern"
                selected={customerDemandPattern.value}
                options={[customerDemandPattern]}
                readOnly={true}
              />
            )}
            <ConnectedCustomersRow
              customerCount={customerCount}
              customerPoints={customerPoints}
              aggregateUnit={quantitiesMetadata.getUnit("customerDemand")}
              customerUnit={quantitiesMetadata.getUnit("customerDemandPerDay")}
              patterns={hydraulicModel.demands.patterns}
            />
          </>
        )}
      </Section>
      <Section title={translate("simulationResults")}>
        <QuantityRow
          name="pressure"
          value={simPressure}
          unit={quantitiesMetadata.getUnit("pressure")}
          decimals={quantitiesMetadata.getDecimals("pressure")}
          readOnly={true}
        />
        <QuantityRow
          name="head"
          value={simHead}
          unit={quantitiesMetadata.getUnit("head")}
          decimals={quantitiesMetadata.getDecimals("head")}
          readOnly={true}
        />
        <QuantityRow
          name="actualDemand"
          value={simDemand}
          unit={quantitiesMetadata.getUnit("actualDemand")}
          decimals={quantitiesMetadata.getDecimals("actualDemand")}
          readOnly={true}
        />
      </Section>
    </AssetEditorContent>
  );
};

const PipeEditor = ({
  pipe,
  startNode,
  endNode,
  headlossFormula,
  quantitiesMetadata,
  onPropertyChange,
  onStatusChange,
  onActiveTopologyStatusChange,
  onLabelChange,
  hydraulicModel,
  readonly = false,
}: {
  pipe: Pipe;
  startNode: NodeAsset | null;
  endNode: NodeAsset | null;
  headlossFormula: HeadlossFormula;
  quantitiesMetadata: Quantities;
  onPropertyChange: OnPropertyChange;
  onStatusChange: OnStatusChange<PipeStatus>;
  onActiveTopologyStatusChange: (
    property: string,
    newValue: boolean,
    oldValue: boolean,
  ) => void;
  onLabelChange: (newLabel: string) => string | undefined;
  hydraulicModel: HydraulicModel;
  readonly?: boolean;
}) => {
  const translate = useTranslate();
  const { footer } = useQuickGraph(pipe.id, "pipe");
  const { getComparison, isNew } = useAssetComparison(pipe);
  const isSimulationLoose = useFeatureFlag("FLAG_SIMULATION_LOOSE");
  const simulation = useSimulation();
  const pipeSimulation = simulation?.getPipe(pipe.id);

  // Simulation values: use atom when FLAG_SIMULATION_LOOSE is enabled, otherwise use asset
  const simFlow = isSimulationLoose
    ? (pipeSimulation?.flow ?? null)
    : pipe.flow;
  const simVelocity = isSimulationLoose
    ? (pipeSimulation?.velocity ?? null)
    : pipe.velocity;
  const simUnitHeadloss = isSimulationLoose
    ? (pipeSimulation?.unitHeadloss ?? null)
    : pipe.unitHeadloss;
  const simHeadloss = isSimulationLoose
    ? (pipeSimulation?.headloss ?? null)
    : pipe.headloss;
  const simulationStatusText = isSimulationLoose
    ? translate(pipeStatusLabel(pipeSimulation ?? null))
    : translate(pipeStatusLabel(pipe.status ? { status: pipe.status } : null));

  const customerPoints = useMemo(() => {
    const connectedCustomerPoints =
      hydraulicModel.customerPointsLookup.getCustomerPoints(pipe.id);
    return Array.from(connectedCustomerPoints);
  }, [pipe.id, hydraulicModel]);

  const customerCount = customerPoints.length;
  const totalDemand = useMemo(() => {
    return customerPoints.reduce(
      (sum, cp) =>
        sum +
        calculateAverageDemand(cp.demands, hydraulicModel.demands.patterns),
      0,
    );
  }, [customerPoints, hydraulicModel.demands.patterns]);

  const customerDemandPattern = useMemo(
    () =>
      getCustomerPointsPattern(customerPoints, hydraulicModel.demands.patterns),
    [customerPoints, hydraulicModel.demands.patterns],
  );

  const pipeStatusOptions = useMemo(() => {
    return pipeStatuses.map((status) => ({
      label: translate(`pipe.${status}`),
      value: status,
    }));
  }, [translate]);

  const handleStatusChange = (
    name: string,
    newValue: PipeStatus,
    oldValue: PipeStatus,
  ) => {
    onStatusChange(newValue, oldValue);
  };

  return (
    <AssetEditorContent
      label={pipe.label}
      type={translate("pipe")}
      isNew={isNew}
      onLabelChange={onLabelChange}
      footer={footer}
      readOnly={readonly}
      key={pipe.id}
    >
      <Section title={translate("connections")}>
        <TextRow name="startNode" value={startNode ? startNode.label : ""} />
        <TextRow name="endNode" value={endNode ? endNode.label : ""} />
      </Section>
      <Section title={translate("activeTopology")}>
        <SwitchRow
          name="isActive"
          label={translate("isEnabled")}
          enabled={pipe.isActive}
          comparison={getComparison("isActive", pipe.isActive)}
          onChange={onActiveTopologyStatusChange}
          readOnly={readonly}
        />
      </Section>
      <Section title={translate("modelAttributes")}>
        <SelectRow
          name="initialStatus"
          selected={pipe.initialStatus}
          options={pipeStatusOptions}
          comparison={getComparison("initialStatus", pipe.initialStatus)}
          onChange={handleStatusChange}
          readOnly={readonly}
        />
        <QuantityRow
          name="diameter"
          value={pipe.diameter}
          positiveOnly={true}
          isNullable={false}
          unit={quantitiesMetadata.getUnit("diameter")}
          decimals={quantitiesMetadata.getDecimals("diameter")}
          comparison={getComparison("diameter", pipe.diameter)}
          onChange={onPropertyChange}
          readOnly={readonly}
        />
        <QuantityRow
          name="length"
          value={pipe.length}
          positiveOnly={true}
          isNullable={false}
          unit={quantitiesMetadata.getUnit("length")}
          decimals={quantitiesMetadata.getDecimals("length")}
          comparison={getComparison("length", pipe.length)}
          onChange={onPropertyChange}
          readOnly={readonly}
        />
        <QuantityRow
          name="roughness"
          value={pipe.roughness}
          positiveOnly={true}
          unit={quantitiesMetadata.getUnit("roughness")}
          decimals={quantitiesMetadata.getDecimals("roughness")}
          comparison={getComparison("roughness", pipe.roughness)}
          onChange={onPropertyChange}
          readOnly={readonly}
        />
        <QuantityRow
          name="minorLoss"
          value={pipe.minorLoss}
          positiveOnly={true}
          unit={quantitiesMetadata.getMinorLossUnit(headlossFormula)}
          decimals={quantitiesMetadata.getDecimals("minorLoss")}
          comparison={getComparison("minorLoss", pipe.minorLoss)}
          onChange={onPropertyChange}
          readOnly={readonly}
        />
      </Section>
      {customerCount > 0 && (
        <Section title={translate("demands")}>
          <QuantityRow
            name="customerDemand"
            value={totalDemand}
            unit={quantitiesMetadata.getUnit("baseDemand")}
            decimals={quantitiesMetadata.getDecimals("baseDemand")}
            readOnly={true}
          />
          {!!customerDemandPattern && (
            <SelectRow
              name="customerPattern"
              selected={customerDemandPattern.value}
              options={[customerDemandPattern]}
              readOnly={true}
            />
          )}
          <ConnectedCustomersRow
            customerCount={customerCount}
            customerPoints={customerPoints}
            aggregateUnit={quantitiesMetadata.getUnit("customerDemand")}
            customerUnit={quantitiesMetadata.getUnit("customerDemandPerDay")}
            patterns={hydraulicModel.demands.patterns}
          />
        </Section>
      )}
      <Section title={translate("simulationResults")}>
        <QuantityRow
          name="flow"
          value={simFlow}
          unit={quantitiesMetadata.getUnit("flow")}
          decimals={quantitiesMetadata.getDecimals("flow")}
          readOnly={true}
        />
        <QuantityRow
          name="velocity"
          value={simVelocity}
          unit={quantitiesMetadata.getUnit("velocity")}
          decimals={quantitiesMetadata.getDecimals("velocity")}
          readOnly={true}
        />
        <QuantityRow
          name="unitHeadloss"
          value={simUnitHeadloss}
          unit={quantitiesMetadata.getUnit("unitHeadloss")}
          decimals={quantitiesMetadata.getDecimals("unitHeadloss")}
          readOnly={true}
        />
        <QuantityRow
          name="headlossShort"
          value={simHeadloss}
          unit={quantitiesMetadata.getUnit("headloss")}
          decimals={quantitiesMetadata.getDecimals("headloss")}
          readOnly={true}
        />
        <TextRow name="actualStatus" value={simulationStatusText} />
      </Section>
    </AssetEditorContent>
  );
};

const ReservoirEditor = ({
  reservoir,
  quantitiesMetadata,
  onPropertyChange,
  onLabelChange,
  readonly = false,
}: {
  reservoir: Reservoir;
  quantitiesMetadata: Quantities;
  onPropertyChange: OnPropertyChange;
  onLabelChange: (newLabel: string) => string | undefined;
  readonly?: boolean;
}) => {
  const translate = useTranslate();
  const { footer } = useQuickGraph(reservoir.id, "reservoir");
  const { getComparison, isNew } = useAssetComparison(reservoir);

  return (
    <AssetEditorContent
      label={reservoir.label}
      type={translate("reservoir")}
      isNew={isNew}
      onLabelChange={onLabelChange}
      footer={footer}
      readOnly={readonly}
      key={reservoir.id}
    >
      <Section title={translate("activeTopology")}>
        <SwitchRow
          name="isActive"
          label={translate("isEnabled")}
          enabled={reservoir.isActive}
          comparison={getComparison("isActive", reservoir.isActive)}
          readOnly={readonly}
        />
      </Section>
      <Section title={translate("modelAttributes")}>
        <QuantityRow
          name="elevation"
          value={reservoir.elevation}
          unit={quantitiesMetadata.getUnit("elevation")}
          decimals={quantitiesMetadata.getDecimals("elevation")}
          comparison={getComparison("elevation", reservoir.elevation)}
          onChange={onPropertyChange}
          readOnly={readonly}
        />
        <QuantityRow
          name="head"
          value={reservoir.head}
          unit={quantitiesMetadata.getUnit("head")}
          decimals={quantitiesMetadata.getDecimals("head")}
          comparison={getComparison("head", reservoir.head)}
          onChange={onPropertyChange}
          readOnly={readonly}
        />
      </Section>
    </AssetEditorContent>
  );
};

const TankEditor = ({
  tank,
  quantitiesMetadata,
  onPropertyChange,
  onLabelChange,
  readonly = false,
}: {
  tank: Tank;
  quantitiesMetadata: Quantities;
  onPropertyChange: OnPropertyChange;
  onLabelChange: (newLabel: string) => string | undefined;
  readonly?: boolean;
}) => {
  const translate = useTranslate();
  const { footer } = useQuickGraph(tank.id, "tank");
  const { getComparison, isNew } = useAssetComparison(tank);
  const isSimulationLoose = useFeatureFlag("FLAG_SIMULATION_LOOSE");
  const simulation = useSimulation();
  const tankSimulation = simulation?.getTank(tank.id);

  // Simulation values: use atom when FLAG_SIMULATION_LOOSE is enabled, otherwise use asset
  const simPressure = isSimulationLoose
    ? (tankSimulation?.pressure ?? null)
    : tank.pressure;
  const simHead = isSimulationLoose
    ? (tankSimulation?.head ?? null)
    : tank.head;
  const simLevel = isSimulationLoose
    ? (tankSimulation?.level ?? null)
    : tank.level;
  const simVolume = isSimulationLoose
    ? (tankSimulation?.volume ?? null)
    : tank.volume;

  return (
    <AssetEditorContent
      label={tank.label}
      type={translate("tank")}
      isNew={isNew}
      onLabelChange={onLabelChange}
      footer={footer}
      readOnly={readonly}
      key={tank.id}
    >
      <Section title={translate("activeTopology")}>
        <SwitchRow
          name="isActive"
          label={translate("isEnabled")}
          enabled={tank.isActive}
          comparison={getComparison("isActive", tank.isActive)}
          readOnly={readonly}
        />
      </Section>
      <Section title={translate("modelAttributes")}>
        <QuantityRow
          name="elevation"
          value={tank.elevation}
          unit={quantitiesMetadata.getUnit("elevation")}
          decimals={quantitiesMetadata.getDecimals("elevation")}
          comparison={getComparison("elevation", tank.elevation)}
          onChange={onPropertyChange}
          readOnly={readonly}
        />
        <QuantityRow
          name="initialLevel"
          value={tank.initialLevel}
          unit={quantitiesMetadata.getUnit("initialLevel")}
          decimals={quantitiesMetadata.getDecimals("initialLevel")}
          comparison={getComparison("initialLevel", tank.initialLevel)}
          onChange={onPropertyChange}
          positiveOnly={true}
          readOnly={readonly}
        />
        <QuantityRow
          name="minLevel"
          value={tank.minLevel}
          unit={quantitiesMetadata.getUnit("minLevel")}
          decimals={quantitiesMetadata.getDecimals("minLevel")}
          comparison={getComparison("minLevel", tank.minLevel)}
          onChange={onPropertyChange}
          positiveOnly={true}
          readOnly={readonly}
        />
        <QuantityRow
          name="maxLevel"
          value={tank.maxLevel}
          unit={quantitiesMetadata.getUnit("maxLevel")}
          decimals={quantitiesMetadata.getDecimals("maxLevel")}
          comparison={getComparison("maxLevel", tank.maxLevel)}
          onChange={onPropertyChange}
          positiveOnly={true}
          readOnly={readonly}
        />
        <QuantityRow
          name="diameter"
          value={tank.diameter}
          unit={quantitiesMetadata.getUnit("tankDiameter")}
          decimals={quantitiesMetadata.getDecimals("diameter")}
          comparison={getComparison("diameter", tank.diameter)}
          onChange={onPropertyChange}
          positiveOnly={true}
          isNullable={false}
          readOnly={readonly}
        />
        <QuantityRow
          name="minVolume"
          value={tank.minVolume}
          unit={quantitiesMetadata.getUnit("minVolume")}
          decimals={quantitiesMetadata.getDecimals("minVolume")}
          comparison={getComparison("minVolume", tank.minVolume)}
          onChange={onPropertyChange}
          positiveOnly={true}
          readOnly={readonly}
        />
        <SwitchRow
          name="overflow"
          label={translate("canOverflow")}
          enabled={tank.overflow}
          comparison={getComparison("overflow", tank.overflow)}
          onChange={onPropertyChange}
          readOnly={readonly}
        />
      </Section>
      <Section title={translate("simulationResults")}>
        <QuantityRow
          name="pressure"
          value={simPressure}
          unit={quantitiesMetadata.getUnit("pressure")}
          decimals={quantitiesMetadata.getDecimals("pressure")}
          readOnly={true}
        />
        <QuantityRow
          name="head"
          value={simHead}
          unit={quantitiesMetadata.getUnit("head")}
          decimals={quantitiesMetadata.getDecimals("head")}
          readOnly={true}
        />
        <QuantityRow
          name="level"
          value={simLevel}
          unit={quantitiesMetadata.getUnit("level")}
          decimals={quantitiesMetadata.getDecimals("level")}
          readOnly={true}
        />
        <QuantityRow
          name="volume"
          value={simVolume}
          unit={quantitiesMetadata.getUnit("volume")}
          decimals={quantitiesMetadata.getDecimals("volume")}
          readOnly={true}
        />
      </Section>
    </AssetEditorContent>
  );
};

const ValveEditor = ({
  valve,
  startNode,
  endNode,
  quantitiesMetadata,
  onPropertyChange,
  onStatusChange,
  onTypeChange,
  onActiveTopologyStatusChange,
  onLabelChange,
  readonly = false,
}: {
  valve: Valve;
  startNode: NodeAsset | null;
  endNode: NodeAsset | null;
  quantitiesMetadata: Quantities;
  onStatusChange: OnStatusChange<ValveStatus>;
  onPropertyChange: OnPropertyChange;
  onTypeChange: OnTypeChange<ValveKind>;
  onActiveTopologyStatusChange: (
    property: string,
    newValue: boolean,
    oldValue: boolean,
  ) => void;
  onLabelChange: (newLabel: string) => string | undefined;
  readonly?: boolean;
}) => {
  const translate = useTranslate();
  const { footer } = useQuickGraph(valve.id, "valve");
  const { getComparison, isNew } = useAssetComparison(valve);
  const isSimulationLoose = useFeatureFlag("FLAG_SIMULATION_LOOSE");
  const simulation = useSimulation();
  const valveSimulation = simulation?.getValve(valve.id);

  // Simulation values: use atom when FLAG_SIMULATION_LOOSE is enabled, otherwise use asset
  const simFlow = isSimulationLoose
    ? (valveSimulation?.flow ?? null)
    : valve.flow;
  const simVelocity = isSimulationLoose
    ? (valveSimulation?.velocity ?? null)
    : valve.velocity;
  const simHeadloss = isSimulationLoose
    ? (valveSimulation?.headloss ?? null)
    : valve.headloss;
  const statusText = isSimulationLoose
    ? translate(valveStatusLabel(valveSimulation ?? null))
    : translate(valveStatusLabel(valve));

  const statusOptions = useMemo(() => {
    return [
      { label: translate("valve.active"), value: "active" },
      { label: translate("valve.open"), value: "open" },
      { label: translate("valve.closed"), value: "closed" },
    ] as { label: string; value: ValveStatus }[];
  }, [translate]);

  const kindOptions = useMemo(() => {
    return valveKinds.map((kind) => {
      return {
        label: kind.toUpperCase(),
        description: translate(`valve.${kind}.detailed`),
        value: kind,
      };
    });
  }, [translate]);

  const handleKindChange = (
    name: string,
    newValue: ValveKind,
    oldValue: ValveKind,
  ) => {
    onTypeChange(newValue, oldValue);
  };

  const handleStatusChange = (
    name: string,
    newValue: ValveStatus,
    oldValue: ValveStatus,
  ) => {
    onStatusChange(newValue, oldValue);
  };

  const getSettingUnit = () => {
    if (valve.kind === "tcv") return null;
    if (["psv", "prv", "pbv"].includes(valve.kind))
      return quantitiesMetadata.getUnit("pressure");
    if (valve.kind === "fcv") return quantitiesMetadata.getUnit("flow");
    return null;
  };

  return (
    <AssetEditorContent
      label={valve.label}
      type={translate("valve")}
      isNew={isNew}
      onLabelChange={onLabelChange}
      footer={footer}
      readOnly={readonly}
      key={valve.id}
    >
      <Section title={translate("connections")}>
        <TextRow name="startNode" value={startNode ? startNode.label : ""} />
        <TextRow name="endNode" value={endNode ? endNode.label : ""} />
      </Section>
      <Section title={translate("activeTopology")}>
        <SwitchRow
          name="isActive"
          label={translate("isEnabled")}
          enabled={valve.isActive}
          comparison={getComparison("isActive", valve.isActive)}
          onChange={onActiveTopologyStatusChange}
          readOnly={readonly}
        />
      </Section>
      <Section title={translate("modelAttributes")}>
        <SelectRow
          name="valveType"
          selected={valve.kind}
          options={kindOptions}
          comparison={getComparison("kind", valve.kind)}
          onChange={handleKindChange}
          readOnly={readonly}
        />
        <QuantityRow
          name="setting"
          value={valve.setting}
          unit={getSettingUnit()}
          comparison={getComparison("setting", valve.setting)}
          onChange={onPropertyChange}
          readOnly={readonly}
        />
        <SelectRow
          name="initialStatus"
          selected={valve.initialStatus}
          options={statusOptions}
          comparison={getComparison("initialStatus", valve.initialStatus)}
          onChange={handleStatusChange}
          readOnly={readonly}
        />
        <QuantityRow
          name="diameter"
          value={valve.diameter}
          positiveOnly={true}
          unit={quantitiesMetadata.getUnit("diameter")}
          decimals={quantitiesMetadata.getDecimals("diameter")}
          comparison={getComparison("diameter", valve.diameter)}
          onChange={onPropertyChange}
          readOnly={readonly}
        />
        <QuantityRow
          name="minorLoss"
          value={valve.minorLoss}
          positiveOnly={true}
          unit={quantitiesMetadata.getUnit("minorLoss")}
          decimals={quantitiesMetadata.getDecimals("minorLoss")}
          comparison={getComparison("minorLoss", valve.minorLoss)}
          onChange={onPropertyChange}
          readOnly={readonly}
        />
      </Section>
      <Section title={translate("simulationResults")}>
        <QuantityRow
          name="flow"
          value={simFlow}
          unit={quantitiesMetadata.getUnit("flow")}
          decimals={quantitiesMetadata.getDecimals("flow")}
          readOnly={true}
        />
        <QuantityRow
          name="velocity"
          value={simVelocity}
          unit={quantitiesMetadata.getUnit("velocity")}
          decimals={quantitiesMetadata.getDecimals("velocity")}
          readOnly={true}
        />
        <QuantityRow
          name="headlossShort"
          value={simHeadloss}
          unit={quantitiesMetadata.getUnit("headloss")}
          decimals={quantitiesMetadata.getDecimals("headloss")}
          readOnly={true}
        />
        <TextRow name="status" value={statusText} />
      </Section>
    </AssetEditorContent>
  );
};

const PumpEditor = ({
  pump,
  startNode,
  endNode,
  onStatusChange,
  onPropertyChange,
  onActiveTopologyStatusChange,
  onDefinitionChange,
  onLabelChange,
  quantitiesMetadata,
  curves,
  readonly = false,
}: {
  pump: Pump;
  startNode: NodeAsset | null;
  endNode: NodeAsset | null;
  onPropertyChange: OnPropertyChange;
  onStatusChange: OnStatusChange<PumpStatus>;
  onActiveTopologyStatusChange: (
    property: string,
    newValue: boolean,
    oldValue: boolean,
  ) => void;
  onDefinitionChange: (data: PumpDefinitionData) => void;
  onLabelChange: (newLabel: string) => string | undefined;
  quantitiesMetadata: Quantities;
  curves: Curves;
  readonly?: boolean;
}) => {
  const translate = useTranslate();
  const { footer } = useQuickGraph(pump.id, "pump");
  const { getComparison, getBaseCurve, isNew } = useAssetComparison(pump);
  const isSimulationLoose = useFeatureFlag("FLAG_SIMULATION_LOOSE");
  const simulation = useSimulation();
  const pumpSimulation = simulation?.getPump(pump.id);

  // Simulation values: use atom when FLAG_SIMULATION_LOOSE is enabled, otherwise use asset
  const simFlow = isSimulationLoose
    ? (pumpSimulation?.flow ?? null)
    : pump.flow;
  const simHead = isSimulationLoose
    ? pumpSimulation
      ? -pumpSimulation.headloss
      : null
    : pump.head;
  const statusText = isSimulationLoose
    ? translate(pumpStatusLabel(pumpSimulation ?? null))
    : translate(pumpStatusLabel(pump));

  const statusOptions = useMemo(() => {
    return pumpStatuses.map((status) => ({
      label: translate(`pump.${status}`),
      value: status,
    }));
  }, [translate]);

  const handleStatusChange = (
    name: string,
    newValue: PumpStatus,
    oldValue: PumpStatus,
  ) => {
    onStatusChange(newValue, oldValue);
  };

  return (
    <AssetEditorContent
      label={pump.label}
      type={translate("pump")}
      isNew={isNew}
      onLabelChange={onLabelChange}
      footer={footer}
      readOnly={readonly}
      key={pump.id}
    >
      <Section title={translate("connections")}>
        <TextRow name="startNode" value={startNode ? startNode.label : ""} />
        <TextRow name="endNode" value={endNode ? endNode.label : ""} />
      </Section>
      <Section title={translate("activeTopology")}>
        <SwitchRow
          name="isActive"
          label={translate("isEnabled")}
          enabled={pump.isActive}
          comparison={getComparison("isActive", pump.isActive)}
          onChange={onActiveTopologyStatusChange}
          readOnly={readonly}
        />
      </Section>
      <Section title={translate("modelAttributes")}>
        <PumpDefinitionDetails
          pump={pump}
          curves={curves}
          quantities={quantitiesMetadata}
          onChange={onDefinitionChange}
          readonly={readonly}
          getComparison={getComparison}
          baseCurve={getBaseCurve(pump.curveId)}
        />
        <QuantityRow
          name="speed"
          value={pump.speed}
          unit={quantitiesMetadata.getUnit("speed")}
          decimals={quantitiesMetadata.getDecimals("speed")}
          comparison={getComparison("speed", pump.speed)}
          onChange={onPropertyChange}
          readOnly={readonly}
        />
        <SelectRow
          name="initialStatus"
          selected={pump.initialStatus}
          options={statusOptions}
          comparison={getComparison("initialStatus", pump.initialStatus)}
          onChange={handleStatusChange}
          readOnly={readonly}
        />
      </Section>
      <Section title={translate("simulationResults")}>
        <QuantityRow
          name="flow"
          value={simFlow}
          unit={quantitiesMetadata.getUnit("flow")}
          decimals={quantitiesMetadata.getDecimals("flow")}
          readOnly={true}
        />
        <QuantityRow
          name="pumpHead"
          value={simHead}
          unit={quantitiesMetadata.getUnit("headloss")}
          decimals={quantitiesMetadata.getDecimals("headloss")}
          readOnly={true}
        />
        <TextRow name="status" value={statusText} />
      </Section>
    </AssetEditorContent>
  );
};

function getCustomerPointsPattern(
  customerPoints: CustomerPoint[],
  patterns: DemandPatterns,
) {
  if (!customerPoints.length) return;
  const firstCustomerPointWithDemand = customerPoints.find(
    (customerPoint) => customerPoint.demands?.[0],
  );
  if (!firstCustomerPointWithDemand) return;
  const patternId = firstCustomerPointWithDemand.demands[0].patternId;
  if (!patternId) return;
  const pattern = patterns.get(patternId);
  if (!pattern) return;
  return {
    value: patternId,
    label: pattern.label,
  };
}
