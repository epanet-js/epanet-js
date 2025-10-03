import type { IWrappedFeature } from "src/types";
import * as Switch from "@radix-ui/react-switch";
import React, { useMemo, useRef } from "react";
import { RawEditor } from "./feature-editor/raw-editor";
import {
  Asset,
  AssetStatus,
  Junction,
  NodeAsset,
  Pipe,
  Pump,
  HydraulicModel,
} from "src/hydraulic-model";
import { PanelDetails } from "src/components/panel-details";
import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import {
  PropertyRow,
  PropertyRowReadonly,
} from "./feature-editor/property-row";
import { CustomerDemandField } from "./feature-editor/customer-demand-field";
import { isDebugOn } from "src/infra/debug-mode";
import { Unit } from "src/quantity";

import { Quantities } from "src/model-metadata/quantities-spec";
import { Reservoir } from "src/hydraulic-model/asset-types/reservoir";
import {
  HeadlossFormula,
  PipeStatus,
  pipeStatuses,
} from "src/hydraulic-model/asset-types/pipe";
import { changeProperty } from "src/hydraulic-model/model-operations";
import { useAtomValue } from "jotai";
import { dataAtom } from "src/state/jotai";
import { usePersistence } from "src/lib/persistence/context";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { Selector } from "../form/selector";
import { useUserTracking } from "src/infra/user-tracking";
import { getLinkNodes } from "src/hydraulic-model/assets-map";
import {
  PumpDefintionType,
  PumpStatus,
  pumpStatuses,
} from "src/hydraulic-model/asset-types/pump";
import { Valve } from "src/hydraulic-model/asset-types";
import {
  ValveStatus,
  ValveKind,
  valveKinds,
} from "src/hydraulic-model/asset-types/valve";
import { NumericField } from "../form/numeric-field";
import { Tank } from "src/hydraulic-model/asset-types/tank";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import ContextActions from "../context-actions";

export function AssetEditor({
  selectedFeature,
  quantitiesMetadata,
}: {
  selectedFeature: IWrappedFeature;
  quantitiesMetadata: Quantities;
}) {
  return (
    <>
      <div className="flex-auto overflow-y-auto placemark-scrollbar">
        <AssetEditorInner
          asset={selectedFeature as Asset}
          quantitiesMetadata={quantitiesMetadata}
        />
      </div>
      <div className="divide-y divide-gray-200 dark:divide-gray-900 border-t border-gray-200 dark:border-gray-900 overflow-auto placemark-scrollbar">
        {isDebugOn && <RawEditor feature={selectedFeature} />}
      </div>
    </>
  );
}

const AssetEditorInner = ({
  asset,
  quantitiesMetadata,
}: {
  asset: Asset;
  quantitiesMetadata: Quantities;
}) => {
  const { hydraulicModel } = useAtomValue(dataAtom);
  const isNewPanelOn = useFeatureFlag("FLAG_ASSET_PANEL");
  const rep = usePersistence();
  const transact = rep.useTransact();
  const userTracking = useUserTracking();

  const handlePropertyChange = (
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
  };

  const handleDefinitionTypeChange = (
    newType: PumpDefintionType,
    oldType: PumpDefintionType,
  ) => {
    const moment = changeProperty(hydraulicModel, {
      assetIds: [asset.id],
      property: "definitionType",
      value: newType,
    });
    transact(moment);
    userTracking.capture({
      name: "assetDefinitionType.edited",
      type: asset.type,
      property: "definitionType",
      newType: newType,
      oldType: oldType,
    });
  };

  const handleValveKindChange = (newType: ValveKind, oldType: ValveKind) => {
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
  };

  const handleStatusChange = <T extends PumpStatus | ValveStatus | PipeStatus>(
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
  };

  switch (asset.type) {
    case "junction":
      return isNewPanelOn ? (
        <JunctionEditor
          junction={asset as Junction}
          quantitiesMetadata={quantitiesMetadata}
          onPropertyChange={handlePropertyChange}
          hydraulicModel={hydraulicModel}
        />
      ) : (
        <JunctionEditorDeprecated
          junction={asset as Junction}
          quantitiesMetadata={quantitiesMetadata}
          onPropertyChange={handlePropertyChange}
          hydraulicModel={hydraulicModel}
        />
      );
    case "pipe":
      const pipe = asset as Pipe;
      return isNewPanelOn ? (
        <PipeEditor
          pipe={pipe}
          {...getLinkNodes(hydraulicModel.assets, pipe)}
          headlossFormula={hydraulicModel.headlossFormula}
          quantitiesMetadata={quantitiesMetadata}
          onPropertyChange={handlePropertyChange}
          onStatusChange={handleStatusChange}
        />
      ) : (
        <PipeEditorDeprecated
          pipe={pipe}
          {...getLinkNodes(hydraulicModel.assets, pipe)}
          headlossFormula={hydraulicModel.headlossFormula}
          quantitiesMetadata={quantitiesMetadata}
          onPropertyChange={handlePropertyChange}
          onStatusChange={handleStatusChange}
        />
      );
    case "pump":
      const pump = asset as Pump;
      return isNewPanelOn ? (
        <PumpEditor
          pump={pump}
          onPropertyChange={handlePropertyChange}
          onStatusChange={handleStatusChange}
          onDefinitionTypeChange={handleDefinitionTypeChange}
          quantitiesMetadata={quantitiesMetadata}
          {...getLinkNodes(hydraulicModel.assets, pump)}
        />
      ) : (
        <PumpEditorDeprecated
          pump={pump}
          onPropertyChange={handlePropertyChange}
          onStatusChange={handleStatusChange}
          onDefinitionTypeChange={handleDefinitionTypeChange}
          quantitiesMetadata={quantitiesMetadata}
          {...getLinkNodes(hydraulicModel.assets, pump)}
        />
      );
    case "valve":
      const valve = asset as Valve;
      return isNewPanelOn ? (
        <ValveEditor
          valve={valve}
          onPropertyChange={handlePropertyChange}
          quantitiesMetadata={quantitiesMetadata}
          onStatusChange={handleStatusChange}
          onTypeChange={handleValveKindChange}
          {...getLinkNodes(hydraulicModel.assets, valve)}
        />
      ) : (
        <ValveEditorDeprecated
          valve={valve}
          onPropertyChange={handlePropertyChange}
          quantitiesMetadata={quantitiesMetadata}
          onStatusChange={handleStatusChange}
          onTypeChange={handleValveKindChange}
          {...getLinkNodes(hydraulicModel.assets, valve)}
        />
      );
    case "reservoir":
      return isNewPanelOn ? (
        <ReservoirEditor
          reservoir={asset as Reservoir}
          quantitiesMetadata={quantitiesMetadata}
          onPropertyChange={handlePropertyChange}
        />
      ) : (
        <ReservoirEditorDeprecated
          reservoir={asset as Reservoir}
          quantitiesMetadata={quantitiesMetadata}
          onPropertyChange={handlePropertyChange}
        />
      );
    case "tank":
      return isNewPanelOn ? (
        <TankEditor
          tank={asset as Tank}
          quantitiesMetadata={quantitiesMetadata}
          onPropertyChange={handlePropertyChange}
        />
      ) : (
        <TankEditorDeprecated
          tank={asset as Tank}
          quantitiesMetadata={quantitiesMetadata}
          onPropertyChange={handlePropertyChange}
        />
      );
  }
};

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

const PipeEditor = ({
  pipe,
  startNode,
  endNode,
  headlossFormula,
  quantitiesMetadata,
  onPropertyChange,
  onStatusChange,
}: {
  pipe: Pipe;
  startNode: NodeAsset | null;
  endNode: NodeAsset | null;
  headlossFormula: HeadlossFormula;
  quantitiesMetadata: Quantities;
  onPropertyChange: OnPropertyChange;
  onStatusChange: OnStatusChange<PipeStatus>;
}) => {
  const translate = useTranslate();
  const simulationStatusText = translate(pipeStatusLabel(pipe));

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
    <AssetEditorContent label={pipe.label} type={translate("pipe")}>
      <AttributesSection name="Connections">
        <TextRow name="startNode" value={startNode ? startNode.label : ""} />
        <TextRow name="endNode" value={endNode ? endNode.label : ""} />
      </AttributesSection>
      <AttributesSection name="Model attributes">
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
      </AttributesSection>
      <AttributesSection name="Simulation results">
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
      </AttributesSection>
    </AssetEditorContent>
  );
};

const PipeEditorDeprecated = ({
  pipe,
  startNode,
  endNode,
  headlossFormula,
  quantitiesMetadata,
  onPropertyChange,
  onStatusChange,
}: {
  pipe: Pipe;
  startNode: NodeAsset | null;
  endNode: NodeAsset | null;
  headlossFormula: HeadlossFormula;
  quantitiesMetadata: Quantities;
  onPropertyChange: OnPropertyChange;
  onStatusChange: OnStatusChange<PipeStatus>;
}) => {
  const translate = useTranslate();
  const simulationStatusText = translate(pipeStatusLabel(pipe));

  return (
    <PanelDetails title={translate("pipe")} variant="fullwidth">
      <div className="pb-3 contain-layout">
        <div className="overflow-y-auto placemark-scrollbar" data-focus-scope>
          <table className="pb-2 w-full">
            <PropertyTableHead />
            <tbody>
              <TextRowReadOnly name="label" value={pipe.label} />
              <TextRowReadOnly
                name="startNode"
                value={startNode ? startNode.label : ""}
              />
              <TextRowReadOnly
                name="endNode"
                value={endNode ? endNode.label : ""}
              />
              <StatusRow
                name={"initialStatus"}
                type={pipe.type}
                status={pipe.initialStatus}
                availableStatuses={pipeStatuses}
                onChange={onStatusChange}
              />
              <QuantityRowDeprecated
                name="diameter"
                value={pipe.diameter}
                positiveOnly={true}
                isNullable={false}
                unit={quantitiesMetadata.getUnit("diameter")}
                decimals={quantitiesMetadata.getDecimals("diameter")}
                onChange={onPropertyChange}
              />
              <QuantityRowDeprecated
                name="length"
                value={pipe.length}
                positiveOnly={true}
                isNullable={false}
                unit={quantitiesMetadata.getUnit("length")}
                decimals={quantitiesMetadata.getDecimals("length")}
                onChange={onPropertyChange}
              />
              <QuantityRowDeprecated
                name="roughness"
                value={pipe.roughness}
                positiveOnly={true}
                unit={quantitiesMetadata.getUnit("roughness")}
                decimals={quantitiesMetadata.getDecimals("roughness")}
                onChange={onPropertyChange}
              />
              <QuantityRowDeprecated
                name="minorLoss"
                value={pipe.minorLoss}
                positiveOnly={true}
                unit={quantitiesMetadata.getMinorLossUnit(headlossFormula)}
                decimals={quantitiesMetadata.getDecimals("minorLoss")}
                onChange={onPropertyChange}
              />
              <QuantityRowDeprecated
                name="flow"
                value={pipe.flow}
                unit={quantitiesMetadata.getUnit("flow")}
                decimals={quantitiesMetadata.getDecimals("flow")}
                readOnly={true}
              />
              <QuantityRowDeprecated
                name="velocity"
                value={pipe.velocity}
                unit={quantitiesMetadata.getUnit("velocity")}
                decimals={quantitiesMetadata.getDecimals("velocity")}
                readOnly={true}
              />
              <QuantityRowDeprecated
                name="unitHeadloss"
                value={pipe.unitHeadloss}
                unit={quantitiesMetadata.getUnit("unitHeadloss")}
                decimals={quantitiesMetadata.getDecimals("unitHeadloss")}
                readOnly={true}
              />
              <QuantityRowDeprecated
                name="headlossShort"
                value={pipe.headloss}
                unit={quantitiesMetadata.getUnit("headloss")}
                decimals={quantitiesMetadata.getDecimals("headloss")}
                readOnly={true}
              />
              <TextRowReadOnly
                name="actualStatus"
                value={simulationStatusText}
              />
            </tbody>
          </table>
        </div>
      </div>
    </PanelDetails>
  );
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

const ValveEditor = ({
  valve,
  startNode,
  endNode,
  quantitiesMetadata,
  onPropertyChange,
  onStatusChange,
  onTypeChange,
}: {
  valve: Valve;
  startNode: NodeAsset | null;
  endNode: NodeAsset | null;
  quantitiesMetadata: Quantities;
  onStatusChange: OnStatusChange<ValveStatus>;
  onPropertyChange: OnPropertyChange;
  onTypeChange: OnTypeChange<ValveKind>;
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
    <AssetEditorContent label={valve.label} type={translate("valve")}>
      <AttributesSection name="Connections">
        <TextRow name="startNode" value={startNode ? startNode.label : ""} />
        <TextRow name="endNode" value={endNode ? endNode.label : ""} />
      </AttributesSection>
      <AttributesSection name="Model attributes">
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
      </AttributesSection>
      <AttributesSection name="Simulation results">
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
      </AttributesSection>
    </AssetEditorContent>
  );
};

const ValveEditorDeprecated = ({
  valve,
  startNode,
  endNode,
  quantitiesMetadata,
  onPropertyChange,
  onStatusChange,
  onTypeChange,
}: {
  valve: Valve;
  startNode: NodeAsset | null;
  endNode: NodeAsset | null;
  quantitiesMetadata: Quantities;
  onStatusChange: OnStatusChange<ValveStatus>;
  onPropertyChange: OnPropertyChange;
  onTypeChange: OnTypeChange<ValveKind>;
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

  return (
    <PanelDetails title={translate("valve")} variant="fullwidth">
      <div className="pb-3 contain-layout">
        <div className="overflow-y-auto placemark-scrollbar" data-focus-scope>
          <table className="pb-2 w-full">
            <PropertyTableHead />
            <tbody>
              <TextRowReadOnly name="label" value={valve.label} />
              <TextRowReadOnly
                name="startNode"
                value={startNode ? startNode.label : ""}
              />
              <TextRowReadOnly
                name="endNode"
                value={endNode ? endNode.label : ""}
              />
              <SelectRowDeprecated
                name="valveType"
                selected={valve.kind}
                options={kindOptions}
                onChange={(name, newType, oldType) =>
                  onTypeChange(newType, oldType)
                }
              />
              {valve.kind === "tcv" && (
                <QuantityRowDeprecated
                  name="setting"
                  value={valve.setting}
                  unit={null}
                  onChange={onPropertyChange}
                />
              )}
              {["psv", "prv", "pbv"].includes(valve.kind) && (
                <QuantityRowDeprecated
                  name="setting"
                  value={valve.setting}
                  unit={quantitiesMetadata.getUnit("pressure")}
                  onChange={onPropertyChange}
                />
              )}
              {valve.kind === "fcv" && (
                <QuantityRowDeprecated
                  name="setting"
                  value={valve.setting}
                  unit={quantitiesMetadata.getUnit("flow")}
                  onChange={onPropertyChange}
                />
              )}
              <SelectRowDeprecated
                name="initialStatus"
                selected={valve.initialStatus}
                options={statusOptions}
                onChange={(name, newValue, oldValue) => {
                  onStatusChange(newValue, oldValue);
                }}
              />
              <QuantityRowDeprecated
                name="diameter"
                positiveOnly={true}
                value={valve.diameter}
                unit={quantitiesMetadata.getUnit("diameter")}
                decimals={quantitiesMetadata.getDecimals("diameter")}
                onChange={onPropertyChange}
              />
              <QuantityRowDeprecated
                name="minorLoss"
                positiveOnly={true}
                value={valve.minorLoss}
                unit={quantitiesMetadata.getUnit("minorLoss")}
                decimals={quantitiesMetadata.getDecimals("minorLoss")}
                onChange={onPropertyChange}
              />
              <QuantityRowDeprecated
                name="flow"
                readOnly={true}
                value={valve.flow}
                unit={quantitiesMetadata.getUnit("flow")}
                decimals={quantitiesMetadata.getDecimals("flow")}
              />
              <QuantityRowDeprecated
                name="velocity"
                readOnly={true}
                value={valve.velocity}
                unit={quantitiesMetadata.getUnit("velocity")}
                decimals={quantitiesMetadata.getDecimals("velocity")}
              />
              <QuantityRowDeprecated
                name="headlossShort"
                readOnly={true}
                value={valve.headloss}
                unit={quantitiesMetadata.getUnit("headloss")}
                decimals={quantitiesMetadata.getDecimals("headloss")}
              />
              <TextRowReadOnly name="status" value={statusText} />
            </tbody>
          </table>
        </div>
      </div>
    </PanelDetails>
  );
};

const PumpEditor = ({
  pump,
  startNode,
  endNode,
  onStatusChange,
  onPropertyChange,
  onDefinitionTypeChange,
  quantitiesMetadata,
}: {
  pump: Pump;
  startNode: NodeAsset | null;
  endNode: NodeAsset | null;
  onPropertyChange: OnPropertyChange;
  onStatusChange: OnStatusChange<PumpStatus>;
  onDefinitionTypeChange: (
    newType: PumpDefintionType,
    oldType: PumpDefintionType,
  ) => void;
  quantitiesMetadata: Quantities;
}) => {
  const translate = useTranslate();
  const statusText = translate(pumpStatusLabel(pump));

  const definitionOptions = useMemo(() => {
    return [
      { label: translate("constantPower"), value: "power" },
      { label: translate("flowVsHead"), value: "flow-vs-head" },
    ] as { label: string; value: PumpDefintionType }[];
  }, [translate]);

  const statusOptions = useMemo(() => {
    return pumpStatuses.map((status) => ({
      label: translate(`pump.${status}`),
      value: status,
    }));
  }, [translate]);

  const handleDefinitionTypeChange = (
    name: string,
    newValue: PumpDefintionType,
    oldValue: PumpDefintionType,
  ) => {
    onDefinitionTypeChange(newValue, oldValue);
  };

  const handleStatusChange = (
    name: string,
    newValue: PumpStatus,
    oldValue: PumpStatus,
  ) => {
    onStatusChange(newValue, oldValue);
  };

  return (
    <AssetEditorContent label={pump.label} type={translate("pump")}>
      <AttributesSection name="Connections">
        <TextRow name="startNode" value={startNode ? startNode.label : ""} />
        <TextRow name="endNode" value={endNode ? endNode.label : ""} />
      </AttributesSection>
      <AttributesSection name="Model attributes">
        <SelectRow
          name="pumpType"
          selected={pump.definitionType}
          options={definitionOptions}
          onChange={handleDefinitionTypeChange}
        />
        {pump.definitionType === "power" && (
          <QuantityRow
            name="power"
            value={pump.power}
            unit={quantitiesMetadata.getUnit("power")}
            decimals={quantitiesMetadata.getDecimals("power")}
            onChange={onPropertyChange}
          />
        )}
        {pump.definitionType === "flow-vs-head" && (
          <>
            <QuantityRow
              name="designFlow"
              value={pump.designFlow}
              unit={quantitiesMetadata.getUnit("flow")}
              decimals={quantitiesMetadata.getDecimals("flow")}
              onChange={onPropertyChange}
            />
            <QuantityRow
              name="designHead"
              value={pump.designHead}
              unit={quantitiesMetadata.getUnit("head")}
              decimals={quantitiesMetadata.getDecimals("head")}
              onChange={onPropertyChange}
            />
          </>
        )}
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
      </AttributesSection>
      <AttributesSection name="Simulation results">
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
      </AttributesSection>
    </AssetEditorContent>
  );
};

const PumpEditorDeprecated = ({
  pump,
  startNode,
  endNode,
  onStatusChange,
  onPropertyChange,
  onDefinitionTypeChange,
  quantitiesMetadata,
}: {
  pump: Pump;
  startNode: NodeAsset | null;
  endNode: NodeAsset | null;
  onPropertyChange: OnPropertyChange;
  onStatusChange: OnStatusChange<PumpStatus>;
  onDefinitionTypeChange: (
    newType: PumpDefintionType,
    oldType: PumpDefintionType,
  ) => void;
  quantitiesMetadata: Quantities;
}) => {
  const translate = useTranslate();
  const statusText = translate(pumpStatusLabel(pump));

  const definitionOptions = useMemo(() => {
    return [
      { label: translate("constantPower"), value: "power" },
      { label: translate("flowVsHead"), value: "flow-vs-head" },
    ] as { label: string; value: PumpDefintionType }[];
  }, [translate]);

  return (
    <PanelDetails title={translate("pump")} variant="fullwidth">
      <div className="pb-3 contain-layout">
        <div className="overflow-y-auto placemark-scrollbar" data-focus-scope>
          <table className="pb-2 w-full">
            <PropertyTableHead />
            <tbody>
              <TextRowReadOnly name="label" value={pump.label} />
              <TextRowReadOnly
                name="startNode"
                value={startNode ? startNode.label : ""}
              />
              <TextRowReadOnly
                name="endNode"
                value={endNode ? endNode.label : ""}
              />
              <SelectRowDeprecated
                name="pumpType"
                selected={pump.definitionType}
                options={definitionOptions}
                onChange={(name, newValue, oldValue) => {
                  onDefinitionTypeChange(newValue, oldValue);
                }}
              />
              {pump.definitionType === "power" && (
                <QuantityRowDeprecated
                  name="power"
                  value={pump.power}
                  unit={quantitiesMetadata.getUnit("power")}
                  decimals={quantitiesMetadata.getDecimals("power")}
                  onChange={onPropertyChange}
                />
              )}
              {pump.definitionType === "flow-vs-head" && (
                <>
                  <QuantityRowDeprecated
                    name="designFlow"
                    value={pump.designFlow}
                    unit={quantitiesMetadata.getUnit("flow")}
                    decimals={quantitiesMetadata.getDecimals("flow")}
                    onChange={onPropertyChange}
                  />
                  <QuantityRowDeprecated
                    name="designHead"
                    value={pump.designHead}
                    unit={quantitiesMetadata.getUnit("head")}
                    decimals={quantitiesMetadata.getDecimals("head")}
                    onChange={onPropertyChange}
                  />
                </>
              )}
              <QuantityRowDeprecated
                name="speed"
                value={pump.speed}
                unit={quantitiesMetadata.getUnit("speed")}
                decimals={quantitiesMetadata.getDecimals("speed")}
                onChange={onPropertyChange}
              />
              <StatusRow
                name="initialStatus"
                type={pump.type}
                status={pump.initialStatus}
                availableStatuses={pumpStatuses}
                onChange={onStatusChange}
              />
              <QuantityRowDeprecated
                name="flow"
                value={pump.flow}
                unit={quantitiesMetadata.getUnit("flow")}
                decimals={quantitiesMetadata.getDecimals("flow")}
                readOnly={true}
              />
              <QuantityRowDeprecated
                name="pumpHead"
                value={pump.head}
                unit={quantitiesMetadata.getUnit("headloss")}
                decimals={quantitiesMetadata.getDecimals("headloss")}
                readOnly={true}
              />
              <TextRowReadOnly name="status" value={statusText} />
            </tbody>
          </table>
        </div>
      </div>
    </PanelDetails>
  );
};

const JunctionEditor = ({
  junction,
  quantitiesMetadata,
  onPropertyChange,
  hydraulicModel,
}: {
  junction: Junction;
  quantitiesMetadata: Quantities;
  onPropertyChange: OnPropertyChange;
  hydraulicModel: HydraulicModel;
}) => {
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();
  const customerPoints = useMemo(() => {
    const connectedCustomerPoints =
      hydraulicModel.customerPointsLookup.getCustomerPoints(junction.id);
    return Array.from(connectedCustomerPoints);
  }, [junction.id, hydraulicModel]);

  const customerCount = customerPoints.length;
  const totalDemand = customerPoints.reduce(
    (sum, cp) => sum + cp.baseDemand,
    0,
  );

  return (
    <AssetEditorContent label={junction.label} type={translate("junction")}>
      <AttributesSection name="Model attributes">
        <QuantityRow
          name="elevation"
          value={junction.elevation}
          unit={quantitiesMetadata.getUnit("elevation")}
          decimals={quantitiesMetadata.getDecimals("elevation")}
          onChange={onPropertyChange}
        />
        <QuantityRow
          name="directDemand"
          value={junction.baseDemand}
          unit={quantitiesMetadata.getUnit("baseDemand")}
          decimals={quantitiesMetadata.getDecimals("baseDemand")}
          onChange={(name, newValue, oldValue) =>
            onPropertyChange("baseDemand", newValue, oldValue)
          }
        />
        {customerCount > 0 && (
          <AttributeRow
            label={
              quantitiesMetadata.getUnit("baseDemand")
                ? `${translate("customerDemand")} (${translateUnit(quantitiesMetadata.getUnit("baseDemand"))})`
                : translate("customerDemand")
            }
          >
            <CustomerDemandField
              totalDemand={totalDemand}
              customerCount={customerCount}
              customerPoints={customerPoints}
              aggregateUnit={quantitiesMetadata.getUnit("customerDemand")}
              customerUnit={quantitiesMetadata.getUnit("customerDemandPerDay")}
            />
          </AttributeRow>
        )}
      </AttributesSection>
      <AttributesSection name="Simulation results">
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
      </AttributesSection>
    </AssetEditorContent>
  );
};

const JunctionEditorDeprecated = ({
  junction,
  quantitiesMetadata,
  onPropertyChange,
  hydraulicModel,
}: {
  junction: Junction;
  quantitiesMetadata: Quantities;
  onPropertyChange: OnPropertyChange;
  hydraulicModel: HydraulicModel;
}) => {
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();
  const customerPoints = useMemo(() => {
    const connectedCustomerPoints =
      hydraulicModel.customerPointsLookup.getCustomerPoints(junction.id);
    return Array.from(connectedCustomerPoints);
  }, [junction.id, hydraulicModel]);

  const customerCount = customerPoints.length;
  const totalDemand = customerPoints.reduce(
    (sum, cp) => sum + cp.baseDemand,
    0,
  );

  const baseDemandUnit = quantitiesMetadata.getUnit("baseDemand");
  const baseDemandLabel = baseDemandUnit
    ? `${translate("directDemand")} (${translateUnit(baseDemandUnit)})`
    : translate("directDemand");

  return (
    <PanelDetails title={translate("junction")} variant="fullwidth">
      <div className="pb-3 contain-layout">
        <div className="overflow-y-auto placemark-scrollbar" data-focus-scope>
          <table className="pb-2 w-full">
            <PropertyTableHead />
            <tbody>
              <TextRowReadOnly name="label" value={junction.label} />
              <QuantityRowDeprecated
                name="elevation"
                value={junction.elevation}
                unit={quantitiesMetadata.getUnit("elevation")}
                decimals={quantitiesMetadata.getDecimals("elevation")}
                onChange={onPropertyChange}
              />
              <PropertyRow label={baseDemandLabel}>
                <div className="relative group-1">
                  <NumericField
                    label={baseDemandLabel}
                    positiveOnly={false}
                    isNullable={true}
                    readOnly={false}
                    displayValue={
                      junction.baseDemand === null
                        ? translate("notAvailable")
                        : localizeDecimal(junction.baseDemand, {
                            decimals:
                              quantitiesMetadata.getDecimals("baseDemand"),
                          })
                    }
                    onChangeValue={(newValue: number) =>
                      onPropertyChange(
                        "baseDemand",
                        newValue,
                        junction.baseDemand,
                      )
                    }
                    styleOptions={{ border: "none" }}
                  />
                </div>
              </PropertyRow>
              {customerCount > 0 && (
                <PropertyRow
                  label={
                    quantitiesMetadata.getUnit("baseDemand")
                      ? `${translate("customerDemand")} (${translateUnit(quantitiesMetadata.getUnit("baseDemand"))})`
                      : translate("customerDemand")
                  }
                >
                  <CustomerDemandField
                    totalDemand={totalDemand}
                    customerCount={customerCount}
                    customerPoints={customerPoints}
                    aggregateUnit={quantitiesMetadata.getUnit("customerDemand")}
                    customerUnit={quantitiesMetadata.getUnit(
                      "customerDemandPerDay",
                    )}
                  />
                </PropertyRow>
              )}
              <QuantityRowDeprecated
                name="pressure"
                value={junction.pressure}
                unit={quantitiesMetadata.getUnit("pressure")}
                decimals={quantitiesMetadata.getDecimals("pressure")}
                readOnly={true}
              />
              <QuantityRowDeprecated
                name="head"
                value={junction.head}
                unit={quantitiesMetadata.getUnit("head")}
                decimals={quantitiesMetadata.getDecimals("head")}
                readOnly={true}
              />
              <QuantityRowDeprecated
                name="actualDemand"
                value={junction.actualDemand}
                unit={quantitiesMetadata.getUnit("actualDemand")}
                decimals={quantitiesMetadata.getDecimals("actualDemand")}
                readOnly={true}
              />
            </tbody>
          </table>
        </div>
      </div>
    </PanelDetails>
  );
};

const ReservoirEditor = ({
  reservoir,
  quantitiesMetadata,
  onPropertyChange,
}: {
  reservoir: Reservoir;
  quantitiesMetadata: Quantities;
  onPropertyChange: OnPropertyChange;
}) => {
  const translate = useTranslate();
  return (
    <AssetEditorContent label={reservoir.label} type={translate("reservoir")}>
      <AttributesSection name={"Model attributes"}>
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
      </AttributesSection>
    </AssetEditorContent>
  );
};

const AssetEditorContent = ({
  label,
  type,
  children,
}: {
  label: string;
  type: string;
  children: React.ReactNode;
}) => {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-col">
        <div className="flex items-center justify-between">
          <span className="font-semibold">{label}</span>
          <ContextActions />
        </div>
        <span className="text-sm text-gray-500">{type}</span>
      </div>
      {children}
    </div>
  );
};

const AttributesSection = ({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) => {
  return (
    <div className="flex flex-col">
      <span className="text-sm font-semibold pb-3">{name}</span>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
};

const ReservoirEditorDeprecated = ({
  reservoir,
  quantitiesMetadata,
  onPropertyChange,
}: {
  reservoir: Reservoir;
  quantitiesMetadata: Quantities;
  onPropertyChange: OnPropertyChange;
}) => {
  const translate = useTranslate();
  return (
    <PanelDetails title={translate("reservoir")} variant="fullwidth">
      <div className="pb-3 contain-layout">
        <div className="overflow-y-auto placemark-scrollbar" data-focus-scope>
          <table className="pb-2 w-full">
            <PropertyTableHead />
            <tbody>
              <TextRowReadOnly name="label" value={reservoir.label} />
              <QuantityRowDeprecated
                name="elevation"
                value={reservoir.elevation}
                unit={quantitiesMetadata.getUnit("elevation")}
                decimals={quantitiesMetadata.getDecimals("elevation")}
                onChange={onPropertyChange}
              />
              <QuantityRowDeprecated
                name="head"
                value={reservoir.head}
                unit={quantitiesMetadata.getUnit("head")}
                decimals={quantitiesMetadata.getDecimals("head")}
                onChange={onPropertyChange}
              />
            </tbody>
          </table>
        </div>
      </div>
    </PanelDetails>
  );
};
const TankEditor = ({
  tank,
  quantitiesMetadata,
  onPropertyChange,
}: {
  tank: Tank;
  quantitiesMetadata: Quantities;
  onPropertyChange: OnPropertyChange;
}) => {
  const translate = useTranslate();
  return (
    <AssetEditorContent label={tank.label} type={translate("tank")}>
      <AttributesSection name={"Model attributes"}>
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
      </AttributesSection>
      <AttributesSection name="Simulation results">
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
      </AttributesSection>
    </AssetEditorContent>
  );
};

const TankEditorDeprecated = ({
  tank,
  quantitiesMetadata,
  onPropertyChange,
}: {
  tank: Tank;
  quantitiesMetadata: Quantities;
  onPropertyChange: OnPropertyChange;
}) => {
  const translate = useTranslate();
  return (
    <PanelDetails title={translate("tank")} variant="fullwidth">
      <div className="pb-3 contain-layout">
        <div className="overflow-y-auto placemark-scrollbar" data-focus-scope>
          <table className="pb-2 w-full">
            <PropertyTableHead />
            <tbody>
              <TextRowReadOnly name="label" value={tank.label} />
              <QuantityRowDeprecated
                name="elevation"
                value={tank.elevation}
                unit={quantitiesMetadata.getUnit("elevation")}
                decimals={quantitiesMetadata.getDecimals("elevation")}
                onChange={onPropertyChange}
              />
              <QuantityRowDeprecated
                name="initialLevel"
                value={tank.initialLevel}
                unit={quantitiesMetadata.getUnit("initialLevel")}
                decimals={quantitiesMetadata.getDecimals("initialLevel")}
                onChange={onPropertyChange}
                positiveOnly={true}
              />
              <QuantityRowDeprecated
                name="minLevel"
                value={tank.minLevel}
                unit={quantitiesMetadata.getUnit("minLevel")}
                decimals={quantitiesMetadata.getDecimals("minLevel")}
                onChange={onPropertyChange}
                positiveOnly={true}
              />
              <QuantityRowDeprecated
                name="maxLevel"
                value={tank.maxLevel}
                unit={quantitiesMetadata.getUnit("maxLevel")}
                decimals={quantitiesMetadata.getDecimals("maxLevel")}
                onChange={onPropertyChange}
                positiveOnly={true}
              />
              <QuantityRowDeprecated
                name="diameter"
                value={tank.diameter}
                unit={quantitiesMetadata.getUnit("tankDiameter")}
                decimals={quantitiesMetadata.getDecimals("diameter")}
                onChange={onPropertyChange}
                positiveOnly={true}
                isNullable={false}
              />
              <QuantityRowDeprecated
                name="minVolume"
                value={tank.minVolume}
                unit={quantitiesMetadata.getUnit("minVolume")}
                decimals={quantitiesMetadata.getDecimals("minVolume")}
                onChange={onPropertyChange}
                positiveOnly={true}
              />
              <SwitchRowDeprecated
                name="overflow"
                label={translate("canOverflow")}
                enabled={tank.overflow}
                onChange={onPropertyChange}
              />
              <QuantityRowDeprecated
                name="pressure"
                value={tank.pressure}
                unit={quantitiesMetadata.getUnit("pressure")}
                decimals={quantitiesMetadata.getDecimals("pressure")}
                readOnly={true}
              />
              <QuantityRowDeprecated
                name="head"
                value={tank.head}
                unit={quantitiesMetadata.getUnit("head")}
                decimals={quantitiesMetadata.getDecimals("head")}
                readOnly={true}
              />
              <QuantityRowDeprecated
                name="level"
                value={tank.level}
                unit={quantitiesMetadata.getUnit("level")}
                decimals={quantitiesMetadata.getDecimals("level")}
                readOnly={true}
              />
              <QuantityRowDeprecated
                name="volume"
                value={tank.volume}
                unit={quantitiesMetadata.getUnit("volume")}
                decimals={quantitiesMetadata.getDecimals("volume")}
                readOnly={true}
              />
            </tbody>
          </table>
        </div>
      </div>
    </PanelDetails>
  );
};

const TextRowReadOnly = ({ name, value }: { name: string; value: string }) => {
  const translate = useTranslate();
  const label = translate(name);
  return <PropertyRowReadonly pair={[label, value]} />;
};

const SelectRowDeprecated = <
  T extends PumpDefintionType | ValveStatus | ValveKind,
>({
  name,
  label,
  selected,
  options,
  onChange,
}: {
  name: string;
  label?: string;
  selected: T;
  options: { label: string; description?: string; value: T }[];
  onChange: (name: string, newValue: T, oldValue: T) => void;
}) => {
  const translate = useTranslate();
  const actualLabel = label || translate(name);
  return (
    <PropertyRow label={actualLabel}>
      <div className="relative group-1">
        <Selector
          ariaLabel={actualLabel}
          options={options}
          selected={selected}
          onChange={(newValue, oldValue) => onChange(name, newValue, oldValue)}
          disableFocusOnClose={true}
          styleOptions={{
            border: false,
            textSize: "text-xs",
          }}
        />
      </div>
    </PropertyRow>
  );
};
const SwitchRow = ({
  name,
  label,
  enabled,
  onChange,
}: {
  name: string;
  label?: string;
  enabled: boolean;
  onChange: (property: string, newValue: boolean, oldValue: boolean) => void;
}) => {
  const translate = useTranslate();
  const actualLabel = label || translate(name);

  const handleToggle = (checked: boolean) => {
    onChange(name, checked, enabled);
  };

  return (
    <AttributeRow label={actualLabel}>
      <div className="flex items-center px-1 py-2">
        <Switch.Root
          checked={enabled}
          onCheckedChange={handleToggle}
          aria-label={label}
          className="w-[28px] h-[16px] bg-gray-300 rounded-full relative data-[state=checked]:bg-purple-300 transition-colors"
        >
          <Switch.Thumb className="block w-[12px] h-[12px] bg-white rounded-full shadow transition-transform translate-x-[2px] data-[state=checked]:translate-x-[14px]" />
        </Switch.Root>
      </div>
    </AttributeRow>
  );
};

const TextRow = ({ name, value }: { name: string; value: string }) => {
  const translate = useTranslate();
  const label = translate(name);
  return (
    <AttributeRow label={label}>
      <TextField>{value}</TextField>
    </AttributeRow>
  );
};

const TextField = ({ children }: { children: React.ReactNode }) => (
  <span className="w-full p-2 text-sm text-gray-700">{children}</span>
);

const SelectRow = <
  T extends
    | PipeStatus
    | ValveKind
    | ValveStatus
    | PumpDefintionType
    | PumpStatus,
>({
  name,
  label,
  selected,
  options,
  onChange,
}: {
  name: string;
  label?: string;
  selected: T;
  options: { label: string; description?: string; value: T }[];
  onChange: (name: string, newValue: T, oldValue: T) => void;
}) => {
  const translate = useTranslate();
  const actualLabel = label || translate(name);
  return (
    <AttributeRow label={actualLabel}>
      <div className="w-full">
        <Selector
          ariaLabel={actualLabel}
          options={options}
          selected={selected}
          onChange={(newValue, oldValue) => onChange(name, newValue, oldValue)}
          disableFocusOnClose={true}
          styleOptions={{
            border: true,
            textSize: "text-sm",
            paddingY: 2,
          }}
        />
      </div>
    </AttributeRow>
  );
};

const SwitchRowDeprecated = ({
  name,
  label,
  enabled,
  onChange,
}: {
  name: string;
  label?: string;
  enabled: boolean;
  onChange: (property: string, newValue: boolean, oldValue: boolean) => void;
}) => {
  const translate = useTranslate();
  const actualLabel = label || translate(name);

  const handleToggle = (checked: boolean) => {
    onChange(name, checked, enabled);
  };

  return (
    <PropertyRow label={actualLabel}>
      <div className="flex items-center space-x-2 p-2">
        <Switch.Root
          checked={enabled}
          onCheckedChange={handleToggle}
          aria-label={label}
          className="w-[28px] h-[16px] bg-gray-300 rounded-full relative data-[state=checked]:bg-purple-300 transition-colors"
        >
          <Switch.Thumb className="block w-[12px] h-[12px] bg-white rounded-full shadow transition-transform translate-x-[2px] data-[state=checked]:translate-x-[14px]" />
        </Switch.Root>
      </div>
    </PropertyRow>
  );
};

const StatusRow = <T extends AssetStatus>({
  name,
  label,
  type,
  status,
  availableStatuses,
  onChange,
}: {
  name: string;
  label?: string;
  type: Asset["type"];
  status: T;
  availableStatuses: readonly T[];
  onChange: (oldValue: T, oldStatus: T) => void;
}) => {
  const translate = useTranslate();
  const actualLabel = label || translate(name);
  const options = useMemo(() => {
    const options = availableStatuses.map((status) => ({
      label: translate(`${type}.${status}`),
      value: status,
    })) as { label: string; value: T }[];
    return options;
  }, [availableStatuses, type, translate]);

  return (
    <PropertyRow label={actualLabel}>
      <div className="relative group-1">
        <Selector
          ariaLabel={"Value for: Initial Status"}
          options={options}
          selected={status}
          onChange={onChange}
          disableFocusOnClose={true}
          styleOptions={{ border: false, textSize: "text-xs" }}
        />
      </div>
    </PropertyRow>
  );
};

const QuantityRow = ({
  name,
  value,
  unit,
  decimals,
  positiveOnly = false,
  readOnly = false,
  isNullable = true,
  onChange,
}: {
  name: string;
  value: number | null;
  unit: Unit;
  positiveOnly?: boolean;
  isNullable?: boolean;
  readOnly?: boolean;
  decimals?: number;
  onChange?: (name: string, newValue: number, oldValue: number | null) => void;
}) => {
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();
  const lastChange = useRef<number>(0);

  const displayValue =
    value === null
      ? translate("notAvailable")
      : localizeDecimal(value, { decimals });

  const label = unit
    ? `${translate(name)} (${translateUnit(unit)})`
    : `${translate(name)}`;

  const handleChange = (newValue: number) => {
    lastChange.current = Date.now();
    onChange && onChange(name, newValue, value);
  };

  return (
    <AttributeRow label={label}>
      {readOnly ? (
        <TextField>{displayValue}</TextField>
      ) : (
        <NumericField
          key={lastChange.current + displayValue}
          label={label}
          positiveOnly={positiveOnly}
          isNullable={isNullable}
          readOnly={readOnly}
          displayValue={displayValue}
          onChangeValue={handleChange}
          styleOptions={{
            padding: "md",
            ghostBorder: readOnly,
            textSize: "sm",
          }}
        />
      )}
    </AttributeRow>
  );
};

const AttributeRow = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => {
  return (
    <div className="flex items-center">
      <span className="text-sm text-gray-500 w-[120px] flex-shrink-0">
        {label}
      </span>
      {children}
    </div>
  );
};

const QuantityRowDeprecated = ({
  name,
  value,
  unit,
  decimals,
  positiveOnly = false,
  readOnly = false,
  isNullable = true,
  onChange,
}: {
  name: string;
  value: number | null;
  unit: Unit;
  positiveOnly?: boolean;
  isNullable?: boolean;
  readOnly?: boolean;
  decimals?: number;
  onChange?: (name: string, newValue: number, oldValue: number | null) => void;
}) => {
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();
  const lastChange = useRef<number>(0);

  const displayValue =
    value === null
      ? translate("notAvailable")
      : localizeDecimal(value, { decimals });

  const label = unit
    ? `${translate(name)} (${translateUnit(unit)})`
    : `${translate(name)}`;

  const handleChange = (newValue: number) => {
    lastChange.current = Date.now();
    onChange && onChange(name, newValue, value);
  };

  return (
    <PropertyRow label={label}>
      <div className="relative group-1">
        <NumericField
          key={lastChange.current + displayValue}
          label={label}
          positiveOnly={positiveOnly}
          isNullable={isNullable}
          readOnly={readOnly}
          displayValue={displayValue}
          onChangeValue={handleChange}
          styleOptions={{ border: "none" }}
        />
      </div>
    </PropertyRow>
  );
};

export function PropertyTableHead() {
  const translate = useTranslate();
  return (
    <thead>
      <tr className="bg-gray-100 dark:bg-gray-800 font-sans text-gray-500 dark:text-gray-100 text-xs text-left">
        <th className="pl-3 py-2 border-r border-t border-b border-gray-200 dark:border-gray-700">
          {translate("property")}
        </th>
        <th className="pl-2 py-2 border-l border-t border-b border-gray-200 dark:border-gray-700">
          {translate("value")}
        </th>
      </tr>
    </thead>
  );
}
