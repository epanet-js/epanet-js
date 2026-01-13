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
import { getActiveCustomerPoints } from "src/hydraulic-model/customer-points";
import { Valve } from "src/hydraulic-model/asset-types";
import { JunctionDemand } from "src/hydraulic-model/demands";
import { Quantities } from "src/model-metadata/quantities-spec";
import { useTranslate } from "src/hooks/use-translate";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { usePersistence } from "src/lib/persistence/context";
import { useUserTracking } from "src/infra/user-tracking";
import { dataAtom } from "src/state/jotai";
import { useAssetComparison } from "src/hooks/use-base-asset-comparison";
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
import { DemandCategoriesEditor } from "./demand-categories-editor";
import { Curves } from "src/hydraulic-model/curves";
import { useQuickGraph } from "./quick-graph";

type OnPropertyChange = (
  name: string,
  value: number | boolean,
  oldValue: number | boolean | null,
) => void;
type OnStatusChange<T> = (newStatus: T, oldStatus: T) => void;
type OnTypeChange<T> = (newType: T, oldType: T) => void;

const pipeStatusLabel = (pipe: Pipe) => {
  if (pipe.status === null) return "notAvailable";
  return "pipe." + pipe.status;
};

const pumpStatusLabel = (pump: Pump) => {
  if (pump.status === null) return "notAvailable";
  if (pump.statusWarning) {
    return `pump.${pump.status}.${pump.statusWarning}`;
  }
  return "pump." + pump.status;
};

export const valveStatusLabel = (valve: Valve) => {
  if (valve.status === null) return "notAvailable";
  if (valve.statusWarning) {
    return `valve.${valve.status}.${valve.statusWarning}`;
  }
  return "valve." + valve.status;
};

export function AssetPanel({
  asset,
  quantitiesMetadata,
}: {
  asset: Asset;
  quantitiesMetadata: Quantities;
}) {
  const { hydraulicModel } = useAtomValue(dataAtom);
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
        oldValue: null,
      });
    },
    [asset.id, asset.type, hydraulicModel, transact, userTracking],
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
        />
      );
    case "tank":
      return (
        <TankEditor
          tank={asset as Tank}
          quantitiesMetadata={quantitiesMetadata}
          onPropertyChange={handlePropertyChange}
          onLabelChange={handleLabelChange}
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
}: {
  junction: Junction;
  quantitiesMetadata: Quantities;
  onPropertyChange: OnPropertyChange;
  onConstantDemandChange: (newValue: number, oldValue: number) => void;
  onDemandsChange: (newDemands: JunctionDemand[]) => void;
  onLabelChange: (newLabel: string) => string | undefined;
  hydraulicModel: HydraulicModel;
}) => {
  const translate = useTranslate();
  const { footer } = useQuickGraph(junction.id, "junction");
  const isEditJunctionDemandsOn = useFeatureFlag("FLAG_EDIT_JUNCTION_DEMANDS");
  const { getComparison } = useAssetComparison(junction);

  const customerPoints = useMemo(() => {
    return getActiveCustomerPoints(
      hydraulicModel.customerPointsLookup,
      hydraulicModel.assets,
      junction.id,
    );
  }, [junction.id, hydraulicModel]);

  const customerCount = customerPoints.length;
  const totalDemand = customerPoints.reduce(
    (sum, cp) => sum + cp.baseDemand,
    0,
  );

  return (
    <AssetEditorContent
      label={junction.label}
      type={translate("junction")}
      onLabelChange={onLabelChange}
      footer={footer}
      key={junction.id}
    >
      <Section title={translate("activeTopology")}>
        <SwitchRow
          name="isActive"
          label={translate("isEnabled")}
          enabled={junction.isActive}
          comparison={getComparison("isActive", junction.isActive)}
        />
      </Section>
      <Section title={translate("modelAttributes")}>
        <QuantityRow
          name="elevation"
          value={junction.elevation}
          unit={quantitiesMetadata.getUnit("elevation")}
          decimals={quantitiesMetadata.getDecimals("elevation")}
          onChange={onPropertyChange}
          comparison={getComparison("elevation", junction.elevation)}
        />
      </Section>
      <Section title={translate("demands")}>
        {isEditJunctionDemandsOn ? (
          <DemandCategoriesEditor
            demands={junction.demands}
            patterns={hydraulicModel.demands.patterns}
            unit={quantitiesMetadata.getUnit("baseDemand")}
            onDemandsChange={onDemandsChange}
          />
        ) : (
          <>
            <QuantityRow
              name="constantDemand"
              value={junction.constantDemand}
              unit={quantitiesMetadata.getUnit("baseDemand")}
              decimals={quantitiesMetadata.getDecimals("baseDemand")}
              onChange={(_name, newValue, oldValue) =>
                onConstantDemandChange(newValue, oldValue ?? 0)
              }
            />
            <DemandCategoriesRow
              demands={junction.demands}
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
            <ConnectedCustomersRow
              customerCount={customerCount}
              customerPoints={customerPoints}
              aggregateUnit={quantitiesMetadata.getUnit("customerDemand")}
              customerUnit={quantitiesMetadata.getUnit("customerDemandPerDay")}
            />
          </>
        )}
      </Section>
      <Section title={translate("simulationResults")}>
        <QuantityRow
          name="pressure"
          value={junction.pressure}
          unit={quantitiesMetadata.getUnit("pressure")}
          decimals={quantitiesMetadata.getDecimals("pressure")}
          readOnly={true}
        />
        <QuantityRow
          name="head"
          value={junction.head}
          unit={quantitiesMetadata.getUnit("head")}
          decimals={quantitiesMetadata.getDecimals("head")}
          readOnly={true}
        />
        <QuantityRow
          name="actualDemand"
          value={junction.actualDemand}
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
}) => {
  const translate = useTranslate();
  const { footer } = useQuickGraph(pipe.id, "pipe");
  const { getComparison } = useAssetComparison(pipe);

  const simulationStatusText = translate(pipeStatusLabel(pipe));

  const customerPoints = useMemo(() => {
    const connectedCustomerPoints =
      hydraulicModel.customerPointsLookup.getCustomerPoints(pipe.id);
    return Array.from(connectedCustomerPoints);
  }, [pipe.id, hydraulicModel]);

  const customerCount = customerPoints.length;
  const totalDemand = customerPoints.reduce(
    (sum, cp) => sum + cp.baseDemand,
    0,
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
      onLabelChange={onLabelChange}
      footer={footer}
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
          onChange={onActiveTopologyStatusChange}
          comparison={getComparison("isActive", pipe.isActive)}
        />
      </Section>
      <Section title={translate("modelAttributes")}>
        <SelectRow
          name="initialStatus"
          selected={pipe.initialStatus}
          options={pipeStatusOptions}
          onChange={handleStatusChange}
          comparison={getComparison("initialStatus", pipe.initialStatus)}
        />
        <QuantityRow
          name="diameter"
          value={pipe.diameter}
          positiveOnly={true}
          isNullable={false}
          unit={quantitiesMetadata.getUnit("diameter")}
          decimals={quantitiesMetadata.getDecimals("diameter")}
          onChange={onPropertyChange}
          comparison={getComparison("diameter", pipe.diameter)}
        />
        <QuantityRow
          name="length"
          value={pipe.length}
          positiveOnly={true}
          isNullable={false}
          unit={quantitiesMetadata.getUnit("length")}
          decimals={quantitiesMetadata.getDecimals("length")}
          onChange={onPropertyChange}
          comparison={getComparison("length", pipe.length)}
        />
        <QuantityRow
          name="roughness"
          value={pipe.roughness}
          positiveOnly={true}
          unit={quantitiesMetadata.getUnit("roughness")}
          decimals={quantitiesMetadata.getDecimals("roughness")}
          onChange={onPropertyChange}
          comparison={getComparison("roughness", pipe.roughness)}
        />
        <QuantityRow
          name="minorLoss"
          value={pipe.minorLoss}
          positiveOnly={true}
          unit={quantitiesMetadata.getMinorLossUnit(headlossFormula)}
          decimals={quantitiesMetadata.getDecimals("minorLoss")}
          onChange={onPropertyChange}
          comparison={getComparison("minorLoss", pipe.minorLoss)}
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
          <ConnectedCustomersRow
            customerCount={customerCount}
            customerPoints={customerPoints}
            aggregateUnit={quantitiesMetadata.getUnit("customerDemand")}
            customerUnit={quantitiesMetadata.getUnit("customerDemandPerDay")}
          />
        </Section>
      )}
      <Section title={translate("simulationResults")}>
        <QuantityRow
          name="flow"
          value={pipe.flow}
          unit={quantitiesMetadata.getUnit("flow")}
          decimals={quantitiesMetadata.getDecimals("flow")}
          readOnly={true}
        />
        <QuantityRow
          name="velocity"
          value={pipe.velocity}
          unit={quantitiesMetadata.getUnit("velocity")}
          decimals={quantitiesMetadata.getDecimals("velocity")}
          readOnly={true}
        />
        <QuantityRow
          name="unitHeadloss"
          value={pipe.unitHeadloss}
          unit={quantitiesMetadata.getUnit("unitHeadloss")}
          decimals={quantitiesMetadata.getDecimals("unitHeadloss")}
          readOnly={true}
        />
        <QuantityRow
          name="headlossShort"
          value={pipe.headloss}
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
}: {
  reservoir: Reservoir;
  quantitiesMetadata: Quantities;
  onPropertyChange: OnPropertyChange;
  onLabelChange: (newLabel: string) => string | undefined;
}) => {
  const translate = useTranslate();
  const { footer } = useQuickGraph(reservoir.id, "reservoir");
  const { getComparison } = useAssetComparison(reservoir);

  return (
    <AssetEditorContent
      label={reservoir.label}
      type={translate("reservoir")}
      onLabelChange={onLabelChange}
      footer={footer}
      key={reservoir.id}
    >
      <Section title={translate("activeTopology")}>
        <SwitchRow
          name="isActive"
          label={translate("isEnabled")}
          enabled={reservoir.isActive}
          comparison={getComparison("isActive", reservoir.isActive)}
        />
      </Section>
      <Section title={translate("modelAttributes")}>
        <QuantityRow
          name="elevation"
          value={reservoir.elevation}
          unit={quantitiesMetadata.getUnit("elevation")}
          decimals={quantitiesMetadata.getDecimals("elevation")}
          onChange={onPropertyChange}
          comparison={getComparison("elevation", reservoir.elevation)}
        />
        <QuantityRow
          name="head"
          value={reservoir.head}
          unit={quantitiesMetadata.getUnit("head")}
          decimals={quantitiesMetadata.getDecimals("head")}
          onChange={onPropertyChange}
          comparison={getComparison("totalHead", reservoir.head)}
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
}: {
  tank: Tank;
  quantitiesMetadata: Quantities;
  onPropertyChange: OnPropertyChange;
  onLabelChange: (newLabel: string) => string | undefined;
}) => {
  const translate = useTranslate();
  const { footer } = useQuickGraph(tank.id, "tank");
  const { getComparison } = useAssetComparison(tank);

  return (
    <AssetEditorContent
      label={tank.label}
      type={translate("tank")}
      onLabelChange={onLabelChange}
      footer={footer}
      key={tank.id}
    >
      <Section title={translate("activeTopology")}>
        <SwitchRow
          name="isActive"
          label={translate("isEnabled")}
          enabled={tank.isActive}
          comparison={getComparison("isActive", tank.isActive)}
        />
      </Section>
      <Section title={translate("modelAttributes")}>
        <QuantityRow
          name="elevation"
          value={tank.elevation}
          unit={quantitiesMetadata.getUnit("elevation")}
          decimals={quantitiesMetadata.getDecimals("elevation")}
          onChange={onPropertyChange}
          comparison={getComparison("elevation", tank.elevation)}
        />
        <QuantityRow
          name="initialLevel"
          value={tank.initialLevel}
          unit={quantitiesMetadata.getUnit("initialLevel")}
          decimals={quantitiesMetadata.getDecimals("initialLevel")}
          onChange={onPropertyChange}
          positiveOnly={true}
          comparison={getComparison("initialLevel", tank.initialLevel)}
        />
        <QuantityRow
          name="minLevel"
          value={tank.minLevel}
          unit={quantitiesMetadata.getUnit("minLevel")}
          decimals={quantitiesMetadata.getDecimals("minLevel")}
          onChange={onPropertyChange}
          positiveOnly={true}
          comparison={getComparison("minLevel", tank.minLevel)}
        />
        <QuantityRow
          name="maxLevel"
          value={tank.maxLevel}
          unit={quantitiesMetadata.getUnit("maxLevel")}
          decimals={quantitiesMetadata.getDecimals("maxLevel")}
          onChange={onPropertyChange}
          positiveOnly={true}
          comparison={getComparison("maxLevel", tank.maxLevel)}
        />
        <QuantityRow
          name="diameter"
          value={tank.diameter}
          unit={quantitiesMetadata.getUnit("tankDiameter")}
          decimals={quantitiesMetadata.getDecimals("diameter")}
          onChange={onPropertyChange}
          positiveOnly={true}
          isNullable={false}
          comparison={getComparison("diameter", tank.diameter)}
        />
        <QuantityRow
          name="minVolume"
          value={tank.minVolume}
          unit={quantitiesMetadata.getUnit("minVolume")}
          decimals={quantitiesMetadata.getDecimals("minVolume")}
          onChange={onPropertyChange}
          positiveOnly={true}
          comparison={getComparison("minVolume", tank.minVolume)}
        />
        <SwitchRow
          name="overflow"
          label={translate("canOverflow")}
          enabled={tank.overflow}
          onChange={onPropertyChange}
          comparison={getComparison("overflow", tank.overflow)}
        />
      </Section>
      <Section title={translate("simulationResults")}>
        <QuantityRow
          name="pressure"
          value={tank.pressure}
          unit={quantitiesMetadata.getUnit("pressure")}
          decimals={quantitiesMetadata.getDecimals("pressure")}
          readOnly={true}
        />
        <QuantityRow
          name="head"
          value={tank.head}
          unit={quantitiesMetadata.getUnit("head")}
          decimals={quantitiesMetadata.getDecimals("head")}
          readOnly={true}
        />
        <QuantityRow
          name="level"
          value={tank.level}
          unit={quantitiesMetadata.getUnit("level")}
          decimals={quantitiesMetadata.getDecimals("level")}
          readOnly={true}
        />
        <QuantityRow
          name="volume"
          value={tank.volume}
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
}) => {
  const translate = useTranslate();
  const { footer } = useQuickGraph(valve.id, "valve");
  const { getComparison } = useAssetComparison(valve);
  const statusText = translate(valveStatusLabel(valve));

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
      onLabelChange={onLabelChange}
      footer={footer}
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
          onChange={onActiveTopologyStatusChange}
          comparison={getComparison("isActive", valve.isActive)}
        />
      </Section>
      <Section title={translate("modelAttributes")}>
        <SelectRow
          name="valveType"
          selected={valve.kind}
          options={kindOptions}
          onChange={handleKindChange}
          comparison={getComparison("kind", valve.kind)}
        />
        <QuantityRow
          name="setting"
          value={valve.setting}
          unit={getSettingUnit()}
          onChange={onPropertyChange}
          comparison={getComparison("setting", valve.setting)}
        />
        <SelectRow
          name="initialStatus"
          selected={valve.initialStatus}
          options={statusOptions}
          onChange={handleStatusChange}
          comparison={getComparison("initialStatus", valve.initialStatus)}
        />
        <QuantityRow
          name="diameter"
          value={valve.diameter}
          positiveOnly={true}
          unit={quantitiesMetadata.getUnit("diameter")}
          decimals={quantitiesMetadata.getDecimals("diameter")}
          onChange={onPropertyChange}
          comparison={getComparison("diameter", valve.diameter)}
        />
        <QuantityRow
          name="minorLoss"
          value={valve.minorLoss}
          positiveOnly={true}
          unit={quantitiesMetadata.getUnit("minorLoss")}
          decimals={quantitiesMetadata.getDecimals("minorLoss")}
          onChange={onPropertyChange}
          comparison={getComparison("minorLoss", valve.minorLoss)}
        />
      </Section>
      <Section title={translate("simulationResults")}>
        <QuantityRow
          name="flow"
          value={valve.flow}
          unit={quantitiesMetadata.getUnit("flow")}
          decimals={quantitiesMetadata.getDecimals("flow")}
          readOnly={true}
        />
        <QuantityRow
          name="velocity"
          value={valve.velocity}
          unit={quantitiesMetadata.getUnit("velocity")}
          decimals={quantitiesMetadata.getDecimals("velocity")}
          readOnly={true}
        />
        <QuantityRow
          name="headlossShort"
          value={valve.headloss}
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
}) => {
  const translate = useTranslate();
  const { footer } = useQuickGraph(pump.id, "pump");
  const { getComparison } = useAssetComparison(pump);
  const statusText = translate(pumpStatusLabel(pump));

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
      onLabelChange={onLabelChange}
      footer={footer}
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
          onChange={onActiveTopologyStatusChange}
          comparison={getComparison("isActive", pump.isActive)}
        />
      </Section>
      <Section title={translate("modelAttributes")}>
        <PumpDefinitionDetails
          pump={pump}
          curves={curves}
          quantities={quantitiesMetadata}
          onChange={onDefinitionChange}
        />
        <QuantityRow
          name="speed"
          value={pump.speed}
          unit={quantitiesMetadata.getUnit("speed")}
          decimals={quantitiesMetadata.getDecimals("speed")}
          onChange={onPropertyChange}
          comparison={getComparison("speed", pump.speed)}
        />
        <SelectRow
          name="initialStatus"
          selected={pump.initialStatus}
          options={statusOptions}
          onChange={handleStatusChange}
          comparison={getComparison("initialStatus", pump.initialStatus)}
        />
      </Section>
      <Section title={translate("simulationResults")}>
        <QuantityRow
          name="flow"
          value={pump.flow}
          unit={quantitiesMetadata.getUnit("flow")}
          decimals={quantitiesMetadata.getDecimals("flow")}
          readOnly={true}
        />
        <QuantityRow
          name="pumpHead"
          value={pump.head}
          unit={quantitiesMetadata.getUnit("headloss")}
          decimals={quantitiesMetadata.getDecimals("headloss")}
          readOnly={true}
        />
        <TextRow name="status" value={statusText} />
      </Section>
    </AssetEditorContent>
  );
};
