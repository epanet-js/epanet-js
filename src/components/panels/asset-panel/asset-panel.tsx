import { useMemo, useCallback, useState } from "react";
import { useAtomValue } from "jotai";
import {
  Asset,
  Junction,
  Pipe,
  Pump,
  Reservoir,
  Tank,
  Valve,
  NodeAsset,
  HydraulicModel,
  Demands,
  Demand,
  Patterns,
  calculateAverageDemand,
  calculateAverageHead,
  getCustomerPointDemands,
  getJunctionDemands,
} from "src/hydraulic-model";
import {
  CustomerPoint,
  getActiveCustomerPoints,
} from "src/hydraulic-model/customer-points";
import { Quantities } from "src/model-metadata/quantities-spec";
import { useTranslate } from "src/hooks/use-translate";
import { usePersistence } from "src/lib/persistence";
import { useUserTracking } from "src/infra/user-tracking";
import { stagingModelAtom } from "src/state/jotai";
import {
  changePumpDefinition,
  changeProperty,
  changeDemandAssignment,
  changeLabel,
} from "src/hydraulic-model/model-operations";
import type {
  ChangeableProperty,
  ChangeablePropertyValue,
} from "src/hydraulic-model/model-operations/change-property";
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
} from "./ui-components";
import { BlockComparisonField, Section } from "src/components/form/fields";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { useQuickGraph } from "./quick-graph";
import { useAssetComparison } from "src/hooks/use-asset-comparison";
import { useSimulation } from "src/hooks/use-simulation";
import type {
  PipeSimulation,
  PumpSimulation,
  ValveSimulation,
} from "src/simulation/results-reader";
import { DemandsEditor } from "./demands-editor";
import {
  PumpDefinitionData,
  PumpDefinitionDetails,
} from "./pump-definition-details";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useShowPatterns } from "src/commands/show-patterns";
import { SelectorOption } from "src/components/form/selector";
import { PatternId } from "src/hydraulic-model/patterns";

type OnPropertyChange = <P extends ChangeableProperty>(
  name: P,
  value: ChangeablePropertyValue<P>,
  oldValue: ChangeablePropertyValue<P> | null,
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

  const handlePropertyChange: OnPropertyChange = useCallback(
    (property, value, oldValue) => {
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
        newValue:
          typeof value === "boolean" ? Number(value) : (value as number),
        oldValue:
          typeof oldValue === "boolean"
            ? Number(oldValue)
            : (oldValue as number | null),
      });
    },
    [hydraulicModel, asset.id, asset.type, transact, userTracking],
  );

  const handleActiveTopologyStatusChange = useCallback(
    (_property: string, newValue: boolean, oldValue: boolean) => {
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
      const moment = changePumpDefinition(hydraulicModel, {
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

  const handleDemandsChange = useCallback(
    (newDemands: Demand[]) => {
      const oldDemands = getJunctionDemands(hydraulicModel.demands, asset.id);
      const moment = changeDemandAssignment(hydraulicModel, [
        { junctionId: asset.id, demands: newDemands },
      ]);
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
          hydraulicModel={hydraulicModel}
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
          hydraulicModel={hydraulicModel}
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
  onDemandsChange,
  onLabelChange,
  hydraulicModel,
  readonly = false,
}: {
  junction: Junction;
  quantitiesMetadata: Quantities;
  onPropertyChange: OnPropertyChange;
  onDemandsChange: (newDemands: Demand[]) => void;
  onLabelChange: (newLabel: string) => string | undefined;
  hydraulicModel: HydraulicModel;
  readonly?: boolean;
}) => {
  const translate = useTranslate();
  const { footer } = useQuickGraph(junction.id, "junction");
  const { getComparison, getDirectDemandComparison, isNew } =
    useAssetComparison(junction);
  const simulation = useSimulation();
  const junctionSimulation = simulation?.getJunction(junction.id);

  const simPressure = junctionSimulation?.pressure ?? null;
  const simHead = junctionSimulation?.head ?? null;
  const simDemand = junctionSimulation?.demand ?? null;

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
        calculateAverageDemand(
          getCustomerPointDemands(hydraulicModel.demands, cp.id),
          hydraulicModel.patterns,
        ),
      0,
    );
  }, [customerPoints, hydraulicModel.demands, hydraulicModel.patterns]);

  const customerDemandPattern = useMemo(
    () =>
      getCustomerPointsPattern(
        customerPoints,
        hydraulicModel.demands,
        hydraulicModel.patterns,
      ),
    [customerPoints, hydraulicModel.demands, hydraulicModel.patterns],
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
        <QuantityRow
          name="emitterCoefficient"
          value={junction.emitterCoefficient}
          unit={quantitiesMetadata.getUnit("emitterCoefficient")}
          decimals={quantitiesMetadata.getDecimals("emitterCoefficient")}
          comparison={getComparison(
            "emitterCoefficient",
            junction.emitterCoefficient,
          )}
          onChange={onPropertyChange}
          positiveOnly={true}
          readOnly={readonly}
        />
      </Section>
      <Section title={translate("demands")}>
        <DemandsEditor
          demands={getJunctionDemands(hydraulicModel.demands, junction.id)}
          patterns={hydraulicModel.patterns}
          quantitiesMetadata={quantitiesMetadata}
          name="directDemand"
          onChange={onDemandsChange}
          demandComparator={getDirectDemandComparison}
          readOnly={readonly}
        />
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
              demands={hydraulicModel.demands}
              patterns={hydraulicModel.patterns}
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
  const simulation = useSimulation();
  const pipeSimulation = simulation?.getPipe(pipe.id);

  const simFlow = pipeSimulation?.flow ?? null;
  const simVelocity = pipeSimulation?.velocity ?? null;
  const simUnitHeadloss = pipeSimulation?.unitHeadloss ?? null;
  const simHeadloss = pipeSimulation?.headloss ?? null;
  const simulationStatusText = translate(
    pipeStatusLabel(pipeSimulation ?? null),
  );

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
        calculateAverageDemand(
          getCustomerPointDemands(hydraulicModel.demands, cp.id),
          hydraulicModel.patterns,
        ),
      0,
    );
  }, [customerPoints, hydraulicModel.demands, hydraulicModel.patterns]);

  const customerDemandPattern = useMemo(
    () =>
      getCustomerPointsPattern(
        customerPoints,
        hydraulicModel.demands,
        hydraulicModel.patterns,
      ),
    [customerPoints, hydraulicModel.demands, hydraulicModel.patterns],
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
            demands={hydraulicModel.demands}
            patterns={hydraulicModel.patterns}
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
  hydraulicModel,
  reservoir,
  quantitiesMetadata,
  onPropertyChange,
  onLabelChange,
  readonly = false,
}: {
  hydraulicModel: HydraulicModel;
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
        <ReservoirHeadField
          reservoir={reservoir}
          patterns={hydraulicModel.patterns}
          onPropertyChange={onPropertyChange}
          quantitiesMetadata={quantitiesMetadata}
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
  const simulation = useSimulation();
  const tankSimulation = simulation?.getTank(tank.id);

  const simPressure = tankSimulation?.pressure ?? null;
  const simHead = tankSimulation?.head ?? null;
  const simLevel = tankSimulation?.level ?? null;
  const simVolume = tankSimulation?.volume ?? null;

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
  const simulation = useSimulation();
  const valveSimulation = simulation?.getValve(valve.id);

  const simFlow = valveSimulation?.flow ?? null;
  const simVelocity = valveSimulation?.velocity ?? null;
  const simHeadloss = valveSimulation?.headloss ?? null;
  const statusText = translate(valveStatusLabel(valveSimulation ?? null));

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
  hydraulicModel,
  startNode,
  endNode,
  onStatusChange,
  onPropertyChange,
  onActiveTopologyStatusChange,
  onDefinitionChange,
  onLabelChange,
  quantitiesMetadata,
  readonly = false,
}: {
  pump: Pump;
  hydraulicModel: HydraulicModel;
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
  readonly?: boolean;
}) => {
  const translate = useTranslate();
  const { footer } = useQuickGraph(pump.id, "pump");
  const { getComparison, getPumpCurveComparison, isNew } =
    useAssetComparison(pump);
  const simulation = useSimulation();
  const pumpSimulation = simulation?.getPump(pump.id);

  const simFlow = pumpSimulation?.flow ?? null;
  const simHead = pumpSimulation ? -pumpSimulation.headloss : null;
  const statusText = translate(pumpStatusLabel(pumpSimulation ?? null));

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
          curves={hydraulicModel.curves}
          quantities={quantitiesMetadata}
          onChange={onDefinitionChange}
          readonly={readonly}
          getComparison={getComparison}
          getPumpCurveComparison={getPumpCurveComparison}
        />

        <QuantityRow
          name="initialSpeed"
          value={pump.speed}
          unit={quantitiesMetadata.getUnit("speed")}
          decimals={quantitiesMetadata.getDecimals("speed")}
          comparison={getComparison("speed", pump.speed)}
          onChange={(_, newValue, oldValue) =>
            onPropertyChange("speed", newValue, oldValue)
          }
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
        <VariableSpeedField
          pump={pump}
          patterns={hydraulicModel.patterns}
          onPropertyChange={onPropertyChange}
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

const NO_PATTERN_ID = 0;
const VARIABLE_SPEED_NONE = 0;
const VARIABLE_SPEED_PATTERN_BASED = 1;

const VariableSpeedField = ({
  pump,
  patterns,
  onPropertyChange,
  readOnly = false,
}: {
  pump: Pump;
  patterns: Patterns;
  onPropertyChange: OnPropertyChange;
  readOnly?: boolean;
}) => {
  const translate = useTranslate();
  const showPatterns = useShowPatterns();
  const { getPatternComparison } = useAssetComparison(pump);

  const comparison = getPatternComparison(
    "speedPatternId",
    pump.speedPatternId,
    patterns,
  );

  const variableSpeedOptions = useMemo(
    () => [
      [{ label: translate("none"), value: VARIABLE_SPEED_NONE }],
      [
        {
          label: translate("patternBased"),
          value: VARIABLE_SPEED_PATTERN_BASED,
        },
      ],
    ],
    [translate],
  );

  const [selectedVariableSpeed, setSelectedVariableSpeed] = useState<
    number | null
  >(pump.speedPatternId ? VARIABLE_SPEED_PATTERN_BASED : null);
  const [prevSpeedPatternId, setPrevSpeedPatternId] = useState(
    pump.speedPatternId,
  );
  if (pump.speedPatternId !== prevSpeedPatternId) {
    setPrevSpeedPatternId(pump.speedPatternId);
    setSelectedVariableSpeed(
      pump.speedPatternId ? VARIABLE_SPEED_PATTERN_BASED : null,
    );
  }

  const handleVariableSpeedChange = useCallback(
    (_: string, newValue: number | null, oldValue: number | null) => {
      if (newValue === oldValue) return;
      const resolved = newValue === VARIABLE_SPEED_NONE ? null : newValue;
      setSelectedVariableSpeed(resolved);
      if (resolved === null && pump.speedPatternId) {
        onPropertyChange("speedPatternId", undefined, pump.speedPatternId);
      }
    },
    [onPropertyChange, pump.speedPatternId],
  );

  const speedPatternOptions = useMemo(() => {
    const libraryGroup: SelectorOption<PatternId>[] = [
      { label: translate("openPatternsLibrary"), value: -1 },
    ];

    const patternGroup: SelectorOption<PatternId>[] = [];
    for (const [, pattern] of patterns) {
      if (pattern.type === "pumpSpeed") {
        patternGroup.push({ label: pattern.label, value: pattern.id });
      }
    }
    if (!patternGroup.length) {
      return [libraryGroup, []];
    }

    const constantGroup: SelectorOption<PatternId>[] = [
      { label: translate("constant"), value: NO_PATTERN_ID },
    ];

    return [libraryGroup, [...constantGroup, ...patternGroup]];
  }, [patterns, translate]);

  const handleSpeedPatternChange = useCallback(
    (_: string, newValue: number | null, oldValue: number | null) => {
      if (newValue === oldValue) return;
      if (newValue === -1) {
        showPatterns({
          source: "pump",
          initialPatternId: pump.speedPatternId,
        });
        return;
      }
      if (newValue === null || newValue === NO_PATTERN_ID) {
        if (pump.speedPatternId) {
          onPropertyChange("speedPatternId", undefined, pump.speedPatternId);
        }
        return;
      }
      onPropertyChange("speedPatternId", newValue, pump.speedPatternId);
    },
    [onPropertyChange, pump.speedPatternId, showPatterns],
  );

  const baseDisplayValue = useMemo(() => {
    if (!comparison.hasChanged) return undefined;
    const basePattern = comparison.baseValue;
    const baseHadPattern = basePattern != null;
    const baseSpeed = baseHadPattern
      ? translate("patternBased")
      : translate("none");
    const multipliersDiffer =
      baseHadPattern && basePattern.id === pump.speedPatternId;

    return (
      <div className="whitespace-pre-line">
        {baseSpeed}
        {baseHadPattern &&
          `\n${translate("speedPattern")}: ${basePattern.label}`}
        {multipliersDiffer && `\n${translate("multipliersDiffer")}`}
      </div>
    );
  }, [comparison, pump.speedPatternId, translate]);

  return (
    <BlockComparisonField
      hasChanged={comparison.hasChanged}
      baseDisplayValue={baseDisplayValue}
    >
      <SelectRow
        name="variableSpeed"
        selected={selectedVariableSpeed}
        options={variableSpeedOptions}
        listClassName="first:italic"
        nullable={true}
        placeholder={translate("none")}
        onChange={handleVariableSpeedChange}
        readOnly={readOnly}
      />
      {selectedVariableSpeed === VARIABLE_SPEED_PATTERN_BASED && (
        <div className="bg-gray-50 p-2 py-1 mt-1 -mr-2 border-l-2 border-gray-400 rounded-sm">
          <SelectRow
            name="speedPattern"
            selected={pump.speedPatternId ?? null}
            options={speedPatternOptions}
            listClassName="first:italic"
            stickyFirstGroup
            nullable={true}
            placeholder={translate("constant")}
            onChange={handleSpeedPatternChange}
            readOnly={readOnly}
          />
        </div>
      )}
    </BlockComparisonField>
  );
};

const ReservoirHeadField = ({
  reservoir,
  patterns,
  onPropertyChange,
  quantitiesMetadata,
  readOnly = false,
}: {
  reservoir: Reservoir;
  patterns: Patterns;
  onPropertyChange: OnPropertyChange;
  quantitiesMetadata: Quantities;
  readOnly?: boolean;
}) => {
  const showPatterns = useShowPatterns();
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();
  const { getComparison, getPatternComparison } = useAssetComparison(reservoir);

  const headPatternOptions = useMemo(() => {
    const libraryGroup: SelectorOption<PatternId>[] = [
      { label: translate("openPatternsLibrary"), value: -1 },
    ];

    const patternGroup: SelectorOption<PatternId>[] = [];
    for (const [, pattern] of patterns) {
      if (pattern.type === "reservoirHead") {
        patternGroup.push({ label: pattern.label, value: pattern.id });
      }
    }
    const constantGroup: SelectorOption<PatternId>[] = patternGroup.length
      ? [
          {
            label: translate("constant"),
            value: NO_PATTERN_ID,
          },
        ]
      : [];

    return [libraryGroup, [...constantGroup, ...patternGroup]];
  }, [patterns, translate]);

  const averageHead = useMemo(
    () => calculateAverageHead(reservoir, patterns),
    [reservoir, patterns],
  );

  const handleHeadPatternChange = useCallback(
    (_: string, newValue: number | null, oldValue: number | null) => {
      if (newValue === oldValue) return;
      if (newValue === null) return;
      if (newValue === -1) {
        showPatterns({
          source: "reservoir",
          initialPatternId: reservoir.headPatternId,
        });
        return;
      }
      const patternId = newValue === NO_PATTERN_ID ? undefined : newValue;
      if (!patternId && !oldValue) return;
      onPropertyChange("headPatternId", patternId, reservoir.headPatternId);
    },
    [onPropertyChange, reservoir.headPatternId, showPatterns],
  );

  const headComparison = getComparison("head", reservoir.head);
  const patternComparison = getPatternComparison(
    "headPatternId",
    reservoir.headPatternId,
    patterns,
  );
  const hasChanged = headComparison.hasChanged || patternComparison.hasChanged;

  const headUnit = quantitiesMetadata.getUnit("head");
  const headDecimals = quantitiesMetadata.getDecimals("head");

  const baseDisplayValue = useMemo(() => {
    if (!hasChanged) return undefined;

    const baseHead = headComparison.hasChanged
      ? (headComparison.baseValue as number)
      : reservoir.head;

    const baseMultipliers = patternComparison.hasChanged
      ? patternComparison.baseValue?.multipliers
      : reservoir.headPatternId
        ? patterns.get(reservoir.headPatternId)?.multipliers
        : undefined;

    const avgMultiplier =
      baseMultipliers && baseMultipliers.length > 0
        ? baseMultipliers.reduce((sum, m) => sum + m, 0) /
          baseMultipliers.length
        : 1;

    const baseAverageHead = baseHead * avgMultiplier;
    const unitLabel = translateUnit(headUnit);
    const formattedAvgHead = localizeDecimal(baseAverageHead, {
      decimals: headDecimals,
    });

    const basePattern = patternComparison.baseValue;
    const multipliersDiffer =
      patternComparison.hasChanged &&
      basePattern != null &&
      basePattern.id === reservoir.headPatternId;

    return (
      <div className="whitespace-pre-line">
        {`${translate("headAverage")} (${unitLabel}): ${formattedAvgHead}`}
        {headComparison.hasChanged &&
          `\n${translate("head")} (${unitLabel}): ${localizeDecimal(baseHead, { decimals: headDecimals })}`}
        {patternComparison.hasChanged && basePattern
          ? `\n${translate("headPattern")}: ${basePattern.label}`
          : `\n${translate("headPattern")}: ${translate("constant")}`}
        {multipliersDiffer && `\n${translate("multipliersDiffer")}`}
      </div>
    );
  }, [
    hasChanged,
    headComparison,
    patternComparison,
    patterns,
    reservoir.head,
    reservoir.headPatternId,
    headDecimals,
    headUnit,
    translate,
    translateUnit,
  ]);

  const selectedPatternId = reservoir.headPatternId ?? null;

  return (
    <BlockComparisonField
      hasChanged={hasChanged}
      baseDisplayValue={baseDisplayValue}
    >
      <div className="flex flex-col gap-1">
        <QuantityRow
          name="head"
          value={reservoir.head}
          unit={headUnit}
          decimals={headDecimals}
          onChange={onPropertyChange}
          readOnly={readOnly}
        />

        <SelectRow
          name="headPattern"
          selected={selectedPatternId}
          options={headPatternOptions}
          listClassName="first:italic"
          stickyFirstGroup
          nullable={true}
          placeholder={translate("constant")}
          onChange={handleHeadPatternChange}
          readOnly={readOnly}
        />
        {!!selectedPatternId && (
          <QuantityRow
            name="headAverage"
            value={averageHead}
            unit={headUnit}
            decimals={headDecimals}
            readOnly={true}
          />
        )}
      </div>
    </BlockComparisonField>
  );
};

function getCustomerPointsPattern(
  customerPoints: CustomerPoint[],
  demands: Demands,
  patterns: Patterns,
) {
  if (!customerPoints.length) return;
  const firstCustomerPointWithDemand = customerPoints.find(
    (customerPoint) =>
      getCustomerPointDemands(demands, customerPoint.id).length > 0,
  );
  if (!firstCustomerPointWithDemand) return;
  const customerDemands = getCustomerPointDemands(
    demands,
    firstCustomerPointWithDemand.id,
  );
  const patternId = customerDemands[0]?.patternId;
  if (!patternId) return;
  const pattern = patterns.get(patternId);
  if (!pattern) return;
  return {
    value: patternId,
    label: pattern.label,
  };
}
