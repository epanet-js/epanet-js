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
import { Quantities } from "src/model-metadata/quantities-spec";
import { useTranslate } from "src/hooks/use-translate";
import { usePersistence } from "src/lib/persistence/context";
import { useUserTracking } from "src/infra/user-tracking";
import { dataAtom } from "src/state/jotai";
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
import { QuickGraph } from "./quick-graph";

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
  onLabelChange,
  hydraulicModel,
}: {
  junction: Junction;
  quantitiesMetadata: Quantities;
  onPropertyChange: OnPropertyChange;
  onConstantDemandChange: (newValue: number, oldValue: number) => void;
  onLabelChange: (newLabel: string) => string | undefined;
  hydraulicModel: HydraulicModel;
}) => {
  const translate = useTranslate();
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
      key={junction.id}
    >
      <Section title={translate("activeTopology")}>
        <SwitchRow
          name="isActive"
          label={translate("isEnabled")}
          enabled={junction.isActive}
        />
      </Section>
      <Section title={translate("modelAttributes")}>
        <QuantityRow
          name="elevation"
          value={junction.elevation}
          unit={quantitiesMetadata.getUnit("elevation")}
          decimals={quantitiesMetadata.getDecimals("elevation")}
          onChange={onPropertyChange}
        />
      </Section>
      <Section title={translate("demands")}>
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
      <QuickGraph assetId={junction.id} assetType="junction" />
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
        />
      </Section>
      <Section title={translate("modelAttributes")}>
        <SelectRow
          name="initialStatus"
          selected={pipe.initialStatus}
          options={pipeStatusOptions}
          onChange={handleStatusChange}
        />
        <QuantityRow
          name="diameter"
          value={pipe.diameter}
          positiveOnly={true}
          isNullable={false}
          unit={quantitiesMetadata.getUnit("diameter")}
          decimals={quantitiesMetadata.getDecimals("diameter")}
          onChange={onPropertyChange}
        />
        <QuantityRow
          name="length"
          value={pipe.length}
          positiveOnly={true}
          isNullable={false}
          unit={quantitiesMetadata.getUnit("length")}
          decimals={quantitiesMetadata.getDecimals("length")}
          onChange={onPropertyChange}
        />
        <QuantityRow
          name="roughness"
          value={pipe.roughness}
          positiveOnly={true}
          unit={quantitiesMetadata.getUnit("roughness")}
          decimals={quantitiesMetadata.getDecimals("roughness")}
          onChange={onPropertyChange}
        />
        <QuantityRow
          name="minorLoss"
          value={pipe.minorLoss}
          positiveOnly={true}
          unit={quantitiesMetadata.getMinorLossUnit(headlossFormula)}
          decimals={quantitiesMetadata.getDecimals("minorLoss")}
          onChange={onPropertyChange}
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
      <QuickGraph assetId={pipe.id} assetType="pipe" />
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
  return (
    <AssetEditorContent
      label={reservoir.label}
      type={translate("reservoir")}
      onLabelChange={onLabelChange}
      key={reservoir.id}
    >
      <Section title={translate("activeTopology")}>
        <SwitchRow
          name="isActive"
          label={translate("isEnabled")}
          enabled={reservoir.isActive}
        />
      </Section>
      <Section title={translate("modelAttributes")}>
        <QuantityRow
          name="elevation"
          value={reservoir.elevation}
          unit={quantitiesMetadata.getUnit("elevation")}
          decimals={quantitiesMetadata.getDecimals("elevation")}
          onChange={onPropertyChange}
        />
        <QuantityRow
          name="head"
          value={reservoir.head}
          unit={quantitiesMetadata.getUnit("head")}
          decimals={quantitiesMetadata.getDecimals("head")}
          onChange={onPropertyChange}
        />
      </Section>
      <QuickGraph assetId={reservoir.id} assetType="reservoir" />
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
  return (
    <AssetEditorContent
      label={tank.label}
      type={translate("tank")}
      onLabelChange={onLabelChange}
      key={tank.id}
    >
      <Section title={translate("activeTopology")}>
        <SwitchRow
          name="isActive"
          label={translate("isEnabled")}
          enabled={tank.isActive}
        />
      </Section>
      <Section title={translate("modelAttributes")}>
        <QuantityRow
          name="elevation"
          value={tank.elevation}
          unit={quantitiesMetadata.getUnit("elevation")}
          decimals={quantitiesMetadata.getDecimals("elevation")}
          onChange={onPropertyChange}
        />
        <QuantityRow
          name="initialLevel"
          value={tank.initialLevel}
          unit={quantitiesMetadata.getUnit("initialLevel")}
          decimals={quantitiesMetadata.getDecimals("initialLevel")}
          onChange={onPropertyChange}
          positiveOnly={true}
        />
        <QuantityRow
          name="minLevel"
          value={tank.minLevel}
          unit={quantitiesMetadata.getUnit("minLevel")}
          decimals={quantitiesMetadata.getDecimals("minLevel")}
          onChange={onPropertyChange}
          positiveOnly={true}
        />
        <QuantityRow
          name="maxLevel"
          value={tank.maxLevel}
          unit={quantitiesMetadata.getUnit("maxLevel")}
          decimals={quantitiesMetadata.getDecimals("maxLevel")}
          onChange={onPropertyChange}
          positiveOnly={true}
        />
        <QuantityRow
          name="diameter"
          value={tank.diameter}
          unit={quantitiesMetadata.getUnit("tankDiameter")}
          decimals={quantitiesMetadata.getDecimals("diameter")}
          onChange={onPropertyChange}
          positiveOnly={true}
          isNullable={false}
        />
        <QuantityRow
          name="minVolume"
          value={tank.minVolume}
          unit={quantitiesMetadata.getUnit("minVolume")}
          decimals={quantitiesMetadata.getDecimals("minVolume")}
          onChange={onPropertyChange}
          positiveOnly={true}
        />
        <SwitchRow
          name="overflow"
          label={translate("canOverflow")}
          enabled={tank.overflow}
          onChange={onPropertyChange}
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
      <QuickGraph assetId={tank.id} assetType="tank" />
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
        />
      </Section>
      <Section title={translate("modelAttributes")}>
        <SelectRow
          name="valveType"
          selected={valve.kind}
          options={kindOptions}
          onChange={handleKindChange}
        />
        <QuantityRow
          name="setting"
          value={valve.setting}
          unit={getSettingUnit()}
          onChange={onPropertyChange}
        />
        <SelectRow
          name="initialStatus"
          selected={valve.initialStatus}
          options={statusOptions}
          onChange={handleStatusChange}
        />
        <QuantityRow
          name="diameter"
          value={valve.diameter}
          positiveOnly={true}
          unit={quantitiesMetadata.getUnit("diameter")}
          decimals={quantitiesMetadata.getDecimals("diameter")}
          onChange={onPropertyChange}
        />
        <QuantityRow
          name="minorLoss"
          value={valve.minorLoss}
          positiveOnly={true}
          unit={quantitiesMetadata.getUnit("minorLoss")}
          decimals={quantitiesMetadata.getDecimals("minorLoss")}
          onChange={onPropertyChange}
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
      <QuickGraph assetId={valve.id} assetType="valve" />
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
        />
        <SelectRow
          name="initialStatus"
          selected={pump.initialStatus}
          options={statusOptions}
          onChange={handleStatusChange}
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
      <QuickGraph assetId={pump.id} assetType="pump" />
    </AssetEditorContent>
  );
};
