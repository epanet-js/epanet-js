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
  chemicalSourceTypes,
  type ChemicalSourceType,
  tankDiameterFor,
  tankDiameterFromArea,
  tankVolumeCurveRange,
  tankVolumeFor,
  CustomerPoint,
  getActiveCustomerPoints,
  HeadlossFormula,
  PipeStatus,
  pipeStatuses,
  PumpStatus,
  pumpStatuses,
  tankMixingModels,
  ValveKind,
  ValveStatus,
  valveKinds,
  PatternId,
  CurveId,
  Curves,
  ICurve,
  DEFAULT_MINOR_LOSS,
  DEFAULT_EMITTER_COEFFICIENT,
  DEFAULT_MIN_VOLUME,
  DEFAULT_MIXING_FRACTION,
  DEFAULT_SPEED,
  DEFAULT_INITIAL_QUALITY,
} from "@epanet-js/hydraulic-model";
import { UnitsSpec } from "src/lib/project-settings/quantities-spec";
import { getMinorLossUnit } from "src/lib/project-settings";
import { useTranslate } from "src/hooks/use-translate";
import { useMomentTransaction } from "src/hooks/persistence/use-moment-transaction";
import { useUserTracking } from "src/infra/user-tracking";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { modelFactoriesAtom } from "src/state/model-factories";
import { projectSettingsAtom } from "src/state/project-settings";
import { simulationSettingsDerivedAtom } from "src/state/derived-branch-state";
import {
  changeProperty,
  changeProperties,
  changeDemandAssignment,
  changeLabel,
} from "src/hydraulic-model/model-operations";
import type {
  ChangeableProperty,
  ChangeablePropertyValue,
  PropertyChange,
} from "src/hydraulic-model/model-operations/change-property";
import { activateAssets } from "src/hydraulic-model/model-operations/activate-assets";
import { deactivateAssets } from "src/hydraulic-model/model-operations/deactivate-assets";
import { isValidInstallationYear } from "src/hydraulic-model/property-validators";
import {
  isGreaterThanZero,
  isZeroOrGreater,
  isWithinUnitRange,
} from "src/components/form/numeric-input-utils";
import { getLinkNodes } from "@epanet-js/hydraulic-model";
import { type AssetId, type Control } from "@epanet-js/hydraulic-model";
import { changeAssetControl } from "src/hydraulic-model/model-operations";
import {
  AssetEditorContent,
  QuantityRow,
  SelectRow,
  LibrarySelectRow,
  TextRow,
  SwitchRow,
  ConnectedCustomersRow,
  SectionWrapper,
  IntegerRow,
  type TankDefinitionMode,
} from "./ui-components";
import { PipeMaterialRow } from "./pipe-material-row";
import {
  NestedSection,
  BlockComparisonField,
} from "src/components/form/fields";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { useQuickGraph } from "./quick-graph";
import {
  useAssetComparison,
  type PropertyComparison,
} from "src/hooks/use-asset-comparison";
import { useSimulation } from "src/hooks/use-simulation";
import type {
  PipeSimulation,
  PumpSimulation,
  ValveSimulation,
} from "src/simulation/results-reader";
import { DemandsEditor } from "./demands-editor";
import { PumpControlsEditor } from "./pump-controls-editor";
import { PumpDefinitionDetails } from "./pump-definition-details";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { CustomAttributesSection } from "./custom-attributes-section";
import { NumericTable } from "src/components/form/numeric-table";
import { useShowPatternsLibrary } from "src/commands/show-patterns-library";
import { useShowPumpLibrary } from "src/commands/show-pump-library";
import {
  tankVolumeCurveChanges,
  chemicalSourceTypeChanges,
  valveKindChanges,
} from "src/hydraulic-model/model-operations";
import { useShowCurveLibrary } from "src/commands/show-curve-library";
import { Unit } from "@epanet-js/quantity";

type OnPropertyChange = <P extends ChangeableProperty>(
  name: P,
  value: ChangeablePropertyValue<P>,
  oldValue: ChangeablePropertyValue<P>,
) => void;
type OnStatusChange<T> = (newStatus: T, oldStatus: T) => void;

const controlTrackingData = (
  control: Control | null,
): { stepsCount?: number } => {
  if (control?.type === "timed-setting") {
    return { stepsCount: control.steps.length };
  }
  return {};
};

export function AssetPanel({
  asset,
  units,
  readonly = false,
}: {
  asset: Asset;
  units: UnitsSpec;
  readonly?: boolean;
}) {
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const { labelManager } = useAtomValue(modelFactoriesAtom);
  const projectSettings = useAtomValue(projectSettingsAtom);
  const { transact } = useMomentTransaction();
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

  const handleControlChange = useCallback(
    (
      assetId: AssetId,
      control: Control | null,
      previousControl: Control | null,
    ) => {
      const moment = changeAssetControl(hydraulicModel, {
        assetId,
        control,
      });
      transact(moment);
      if (control === null) {
        userTracking.capture({
          name: "assetControl.removed",
          type: asset.type,
          previousType: previousControl?.type ?? null,
          ...controlTrackingData(previousControl),
        });
      } else {
        userTracking.capture({
          name: "assetControl.changed",
          type: asset.type,
          controlType: control.type,
          previousType: previousControl?.type ?? null,
          ...controlTrackingData(control),
        });
      }
    },
    [hydraulicModel, asset.type, transact, userTracking],
  );

  const handleBatchPropertyChange = useCallback(
    (changes: PropertyChange[]) => {
      const moment = changeProperties(hydraulicModel, {
        assetIds: [asset.id],
        changes,
      });
      transact(moment);
      userTracking.capture({
        name: "assetProperties.edited",
        type: asset.type,
        properties: changes.map((c) => c.property),
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

      const isAvailable = labelManager.isLabelAvailable(
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
      labelManager,
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
          units={units}
          onPropertyChange={handlePropertyChange}
          onBatchPropertyChange={handleBatchPropertyChange}
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
          headlossFormula={projectSettings.headlossFormula}
          units={units}
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
          onBatchPropertyChange={handleBatchPropertyChange}
          onLabelChange={handleLabelChange}
          onControlChange={handleControlChange}
          units={units}
          {...getLinkNodes(hydraulicModel.assets, pump)}
          readonly={readonly}
        />
      );
    }
    case "valve": {
      const valve = asset as Valve;
      return (
        <ValveEditor
          hydraulicModel={hydraulicModel}
          valve={valve}
          onPropertyChange={handlePropertyChange}
          onBatchPropertyChange={handleBatchPropertyChange}
          units={units}
          onStatusChange={handleStatusChange}
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
          units={units}
          onPropertyChange={handlePropertyChange}
          onBatchPropertyChange={handleBatchPropertyChange}
          onLabelChange={handleLabelChange}
          readonly={readonly}
        />
      );
    case "tank":
      return (
        <TankEditor
          tank={asset as Tank}
          hydraulicModel={hydraulicModel}
          units={units}
          onPropertyChange={handlePropertyChange}
          onBatchPropertyChange={handleBatchPropertyChange}
          onLabelChange={handleLabelChange}
          readonly={readonly}
        />
      );
  }
}

const JunctionEditor = ({
  junction,
  units,
  onPropertyChange,
  onBatchPropertyChange,
  onDemandsChange,
  onLabelChange,
  hydraulicModel,
  readonly = false,
}: {
  junction: Junction;
  units: UnitsSpec;
  onPropertyChange: OnPropertyChange;
  onBatchPropertyChange: (changes: PropertyChange[]) => void;
  onDemandsChange: (newDemands: Demand[]) => void;
  onLabelChange: (newLabel: string) => string | undefined;
  hydraulicModel: HydraulicModel;
  readonly?: boolean;
}) => {
  const translate = useTranslate();
  const allowsNullValues = useFeatureFlag("FLAG_NULL_VALUES");
  const simulationSettings = useAtomValue(simulationSettingsDerivedAtom);
  const { footer } = useQuickGraph(junction.id, "junction");
  const {
    getComparison,
    getDirectDemandComparison,
    getCustomerDemandComparison,
    getCustomerCountComparison,
    isNew,
  } = useAssetComparison(junction);
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

  const activeTopologyComparison = getComparison("isActive", junction.isActive);
  const hasModelAttributesChanges = ["elevation", "emitterCoefficient"].some(
    (property) =>
      getComparison(property, junction.getProperty(property)).hasChanged,
  );
  const hasDemandChanges =
    getDirectDemandComparison(
      calculateAverageDemand(
        getJunctionDemands(hydraulicModel.demands, junction.id),
        hydraulicModel.patterns,
      ),
    ).hasChanged ||
    getCustomerCountComparison(customerCount).hasChanged ||
    getCustomerDemandComparison(totalDemand).hasChanged;

  return (
    <AssetEditorContent
      label={junction.label}
      type={translate("junction")}
      labelType="junction"
      isNew={isNew}
      onLabelChange={onLabelChange}
      footer={footer}
      readOnly={readonly}
      key={junction.id}
    >
      <SectionWrapper
        title={translate("activeTopology")}
        section="activeTopology"
        hasChanged={activeTopologyComparison.hasChanged}
      >
        <SwitchRow
          name="isActive"
          label={translate("isEnabled")}
          enabled={junction.isActive}
          comparison={activeTopologyComparison}
          readOnly={readonly}
        />
      </SectionWrapper>
      <SectionWrapper
        title={translate("modelAttributes")}
        section="modelAttributes"
        hasChanged={hasModelAttributesChanges}
      >
        <QuantityRow
          name="elevation"
          value={junction.elevation}
          unit={units.elevation}
          comparison={getComparison("elevation", junction.elevation)}
          onChange={onPropertyChange}
          readOnly={readonly}
        />
        <QuantityRow
          name="emitterCoefficient"
          value={junction.emitterCoefficient}
          isOptional={allowsNullValues}
          placeholder={String(DEFAULT_EMITTER_COEFFICIENT)}
          unit={units.emitterCoefficient}
          comparison={getComparison(
            "emitterCoefficient",
            junction.emitterCoefficient,
          )}
          onChange={onPropertyChange}
          validate={isZeroOrGreater}
          readOnly={readonly}
        />
      </SectionWrapper>
      <CustomAttributesSection id={junction.id} type="junction" />
      <SectionWrapper
        title={translate("demands")}
        section="demands"
        hasChanged={hasDemandChanges}
      >
        <DemandsEditor
          demands={getJunctionDemands(hydraulicModel.demands, junction.id)}
          patterns={hydraulicModel.patterns}
          units={units}
          name="directDemand"
          onChange={onDemandsChange}
          demandComparator={getDirectDemandComparison}
          readOnly={readonly}
        />
        {(customerCount > 0 ||
          getCustomerCountComparison(customerCount).hasChanged) && (
          <>
            <QuantityRow
              name="customerDemand"
              value={totalDemand}
              unit={units.baseDemand}
              comparison={getCustomerDemandComparison(totalDemand)}
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
              aggregateUnit={units.customerDemand}
              customerUnit={units.customerDemandPerDay}
              demands={hydraulicModel.demands}
              patterns={hydraulicModel.patterns}
              comparison={getCustomerCountComparison(customerCount)}
            />
          </>
        )}
      </SectionWrapper>
      <SectionWrapper title={translate("quality")} section="quality">
        <QuantityRow
          name="initialQuality"
          value={junction.initialQuality}
          isOptional={allowsNullValues}
          placeholder={String(DEFAULT_INITIAL_QUALITY)}
          unit={
            simulationSettings.qualitySimulationType === "age"
              ? units.waterAge
              : simulationSettings.qualitySimulationType === "chemical"
                ? units.chemicalConcentration
                : null
          }
          comparison={getComparison("initialQuality", junction.initialQuality)}
          onChange={onPropertyChange}
          validate={isZeroOrGreater}
          readOnly={readonly}
        />
        <ChemicalSourceEditor
          node={junction}
          patterns={hydraulicModel.patterns}
          onPropertyChange={onPropertyChange}
          onBatchPropertyChange={onBatchPropertyChange}
          unit={units.chemicalConcentration}
          readOnly={readonly}
        />
      </SectionWrapper>

      <SectionWrapper
        title={translate("simulationResults")}
        section="simulationResults"
      >
        <QuantityRow
          name="pressure"
          value={simPressure}
          unit={units.pressure}
          readOnly={true}
          placeholder={translate("notAvailable")}
        />
        <QuantityRow
          name="minPressure"
          value={junctionSimulation?.minPressure ?? null}
          unit={units.pressure}
          readOnly={true}
          placeholder={translate("notAvailable")}
        />
        <QuantityRow
          name="maxPressure"
          value={junctionSimulation?.maxPressure ?? null}
          unit={units.pressure}
          readOnly={true}
          placeholder={translate("notAvailable")}
        />
        <QuantityRow
          name="head"
          value={simHead}
          unit={units.head}
          readOnly={true}
          placeholder={translate("notAvailable")}
        />
        <QuantityRow
          name="actualDemand"
          value={simDemand}
          unit={units.actualDemand}
          readOnly={true}
          placeholder={translate("notAvailable")}
        />
        {junctionSimulation?.waterAge != null && (
          <QuantityRow
            name="waterAge"
            value={junctionSimulation.waterAge}
            unit={units.waterAge}
            readOnly={true}
            placeholder={translate("notAvailable")}
          />
        )}
        {junctionSimulation?.waterTrace != null && (
          <QuantityRow
            name="waterTrace"
            value={junctionSimulation.waterTrace}
            unit={units.waterTrace}
            readOnly={true}
            placeholder={translate("notAvailable")}
          />
        )}
        {junctionSimulation?.chemicalConcentration != null && (
          <QuantityRow
            name="chemicalConcentration"
            value={junctionSimulation.chemicalConcentration}
            unit={units.chemicalConcentration}
            readOnly={true}
            placeholder={translate("notAvailable")}
          />
        )}
      </SectionWrapper>
    </AssetEditorContent>
  );
};

const PipeEditor = ({
  pipe,
  startNode,
  endNode,
  headlossFormula,
  units,
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
  units: UnitsSpec;
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
  const allowsNullValues = useFeatureFlag("FLAG_NULL_VALUES");
  const simulationSettings = useAtomValue(simulationSettingsDerivedAtom);
  const { footer } = useQuickGraph(pipe.id, "pipe");
  const {
    getComparison,
    isNew,
    getCustomerDemandComparison,
    getCustomerCountComparison,
  } = useAssetComparison(pipe);
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

  const activeTopologyComparison = getComparison("isActive", pipe.isActive);
  const modelAttributeProperties = [
    "initialStatus",
    "diameter",
    "length",
    "roughness",
    "minorLoss",
    "material",
    "year",
  ];
  const hasModelAttributesChanges = modelAttributeProperties.some(
    (p) => getComparison(p, pipe.getProperty(p)).hasChanged,
  );
  const hasDemandChanges =
    getCustomerCountComparison(customerCount).hasChanged ||
    getCustomerDemandComparison(totalDemand).hasChanged;

  return (
    <AssetEditorContent
      label={pipe.label}
      type={translate("pipe")}
      labelType="pipe"
      isNew={isNew}
      onLabelChange={onLabelChange}
      footer={footer}
      readOnly={readonly}
      key={pipe.id}
    >
      <SectionWrapper title={translate("connections")} section="connections">
        <TextRow name="startNode" value={startNode ? startNode.label : ""} />
        <TextRow name="endNode" value={endNode ? endNode.label : ""} />
      </SectionWrapper>
      <SectionWrapper
        title={translate("activeTopology")}
        section="activeTopology"
        hasChanged={activeTopologyComparison.hasChanged}
      >
        <SwitchRow
          name="isActive"
          label={translate("isEnabled")}
          enabled={pipe.isActive}
          comparison={activeTopologyComparison}
          onChange={onActiveTopologyStatusChange}
          readOnly={readonly}
        />
      </SectionWrapper>
      <SectionWrapper
        title={translate("modelAttributes")}
        section="modelAttributes"
        hasChanged={hasModelAttributesChanges}
      >
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
          validate={isGreaterThanZero}
          unit={units.diameter}
          comparison={getComparison("diameter", pipe.diameter)}
          onChange={onPropertyChange}
          readOnly={readonly}
        />
        <QuantityRow
          name="length"
          value={pipe.length}
          validate={isGreaterThanZero}
          unit={units.length}
          comparison={getComparison("length", pipe.length)}
          onChange={onPropertyChange}
          readOnly={readonly}
        />
        <PipeMaterialRow
          pipe={pipe}
          hydraulicModel={hydraulicModel}
          comparison={getComparison("material", pipe.material ?? null)}
          onChange={onPropertyChange}
          readOnly={readonly}
        />
        <IntegerRow
          name="year"
          displayName={translate("yearOfInstallation")}
          value={pipe.year}
          isOptional
          comparison={getComparison("year", pipe.year ?? null)}
          onChange={onPropertyChange}
          readOnly={readonly}
          paywall="pipeAttributes"
          validate={isValidInstallationYear}
        />
        <QuantityRow
          name="roughness"
          value={pipe.roughness}
          unit={units.roughness}
          comparison={getComparison("roughness", pipe.roughness)}
          onChange={onPropertyChange}
          readOnly={readonly}
          isNullable={allowsNullValues}
          validate={isGreaterThanZero}
        />
        <QuantityRow
          name="minorLoss"
          value={pipe.minorLoss}
          validate={isZeroOrGreater}
          unit={getMinorLossUnit(headlossFormula, units)}
          comparison={getComparison("minorLoss", pipe.minorLoss)}
          isOptional={allowsNullValues}
          placeholder={String(DEFAULT_MINOR_LOSS)}
          onChange={onPropertyChange}
          readOnly={readonly}
        />
      </SectionWrapper>
      <CustomAttributesSection id={pipe.id} type="pipe" />
      {(customerCount > 0 ||
        getCustomerCountComparison(customerCount).hasChanged) && (
        <SectionWrapper
          title={translate("demands")}
          section="demands"
          hasChanged={hasDemandChanges}
        >
          <QuantityRow
            name="customerDemand"
            value={totalDemand}
            unit={units.baseDemand}
            comparison={getCustomerDemandComparison(totalDemand)}
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
            aggregateUnit={units.customerDemand}
            customerUnit={units.customerDemandPerDay}
            demands={hydraulicModel.demands}
            patterns={hydraulicModel.patterns}
            comparison={getCustomerCountComparison(customerCount)}
          />
        </SectionWrapper>
      )}
      <SectionWrapper title={translate("quality")} section="quality">
        <QuantityRow
          name="bulkReactionCoeff"
          value={pipe.bulkReactionCoeff}
          unit={null}
          isOptional
          placeholder={localizeDecimal(simulationSettings.reactionGlobalBulk)}
          comparison={getComparison(
            "bulkReactionCoeff",
            pipe.bulkReactionCoeff,
          )}
          onChange={onPropertyChange}
          readOnly={readonly}
        />
        <QuantityRow
          name="wallReactionCoeff"
          value={pipe.wallReactionCoeff}
          unit={null}
          isOptional
          placeholder={localizeDecimal(simulationSettings.reactionGlobalWall)}
          comparison={getComparison(
            "wallReactionCoeff",
            pipe.wallReactionCoeff,
          )}
          onChange={onPropertyChange}
          readOnly={readonly}
        />
      </SectionWrapper>
      <SectionWrapper
        title={translate("simulationResults")}
        section="simulationResults"
      >
        <QuantityRow
          name="flow"
          value={simFlow}
          unit={units.flow}
          readOnly={true}
          placeholder={translate("notAvailable")}
        />
        <QuantityRow
          name="velocity"
          value={simVelocity}
          unit={units.velocity}
          readOnly={true}
          placeholder={translate("notAvailable")}
        />
        <QuantityRow
          name="unitHeadloss"
          value={simUnitHeadloss}
          unit={units.unitHeadloss}
          readOnly={true}
          placeholder={translate("notAvailable")}
        />
        <QuantityRow
          name="headlossShort"
          value={simHeadloss}
          unit={units.headloss}
          readOnly={true}
          placeholder={translate("notAvailable")}
        />
        <TextRow name="actualStatus" value={simulationStatusText} />
        {pipeSimulation?.waterAge != null && (
          <QuantityRow
            name="waterAge"
            value={pipeSimulation.waterAge}
            unit={units.waterAge}
            readOnly={true}
            placeholder={translate("notAvailable")}
          />
        )}
        {pipeSimulation?.waterTrace != null && (
          <QuantityRow
            name="waterTrace"
            value={pipeSimulation.waterTrace}
            unit={units.waterTrace}
            readOnly={true}
            placeholder={translate("notAvailable")}
          />
        )}
        {pipeSimulation?.chemicalConcentration != null && (
          <QuantityRow
            name="chemicalConcentration"
            value={pipeSimulation.chemicalConcentration}
            unit={units.chemicalConcentration}
            readOnly={true}
            placeholder={translate("notAvailable")}
          />
        )}
      </SectionWrapper>
    </AssetEditorContent>
  );
};

const ReservoirEditor = ({
  hydraulicModel,
  reservoir,
  units,
  onPropertyChange,
  onBatchPropertyChange,
  onLabelChange,
  readonly = false,
}: {
  hydraulicModel: HydraulicModel;
  reservoir: Reservoir;
  units: UnitsSpec;
  onPropertyChange: OnPropertyChange;
  onBatchPropertyChange: (changes: PropertyChange[]) => void;
  onLabelChange: (newLabel: string) => string | undefined;
  readonly?: boolean;
}) => {
  const translate = useTranslate();
  const allowsNullValues = useFeatureFlag("FLAG_NULL_VALUES");
  const simulationSettings = useAtomValue(simulationSettingsDerivedAtom);
  const { footer } = useQuickGraph(reservoir.id, "reservoir");
  const { getComparison, getPatternComparison, isNew } =
    useAssetComparison(reservoir);
  const simulation = useSimulation();
  const reservoirSimulation = simulation?.getReservoir(reservoir.id);

  const simPressure = reservoirSimulation?.pressure ?? null;
  const simHead = reservoirSimulation?.head ?? null;
  const simNetFlow = reservoirSimulation?.netFlow ?? null;

  const activeTopologyComparison = getComparison(
    "isActive",
    reservoir.isActive,
  );
  const hasModelAttributesChanges =
    getComparison("elevation", reservoir.elevation).hasChanged ||
    getComparison("head", reservoir.head).hasChanged ||
    getPatternComparison(
      "headPatternId",
      reservoir.headPatternId,
      hydraulicModel.patterns,
    ).hasChanged;

  return (
    <AssetEditorContent
      label={reservoir.label}
      type={translate("reservoir")}
      labelType="reservoir"
      isNew={isNew}
      onLabelChange={onLabelChange}
      footer={footer}
      readOnly={readonly}
      key={reservoir.id}
    >
      <SectionWrapper
        title={translate("activeTopology")}
        section="activeTopology"
        hasChanged={activeTopologyComparison.hasChanged}
      >
        <SwitchRow
          name="isActive"
          label={translate("isEnabled")}
          enabled={reservoir.isActive}
          comparison={activeTopologyComparison}
          readOnly={readonly}
        />
      </SectionWrapper>
      <SectionWrapper
        title={translate("modelAttributes")}
        section="modelAttributes"
        hasChanged={hasModelAttributesChanges}
      >
        <QuantityRow
          name="elevation"
          value={reservoir.elevation}
          unit={units.elevation}
          comparison={getComparison("elevation", reservoir.elevation)}
          onChange={onPropertyChange}
          readOnly={readonly}
        />
        <ReservoirHeadField
          reservoir={reservoir}
          patterns={hydraulicModel.patterns}
          onPropertyChange={onPropertyChange}
          units={units}
          readOnly={readonly}
        />
      </SectionWrapper>
      <CustomAttributesSection id={reservoir.id} type="reservoir" />
      <SectionWrapper title={translate("quality")} section="quality">
        <QuantityRow
          name="initialQuality"
          value={reservoir.initialQuality}
          isOptional={allowsNullValues}
          placeholder={String(DEFAULT_INITIAL_QUALITY)}
          unit={
            simulationSettings.qualitySimulationType === "age"
              ? units.waterAge
              : simulationSettings.qualitySimulationType === "chemical"
                ? units.chemicalConcentration
                : null
          }
          comparison={getComparison("initialQuality", reservoir.initialQuality)}
          onChange={onPropertyChange}
          validate={isZeroOrGreater}
          readOnly={readonly}
        />
        <ChemicalSourceEditor
          node={reservoir}
          patterns={hydraulicModel.patterns}
          onPropertyChange={onPropertyChange}
          onBatchPropertyChange={onBatchPropertyChange}
          unit={units.chemicalConcentration}
          readOnly={readonly}
        />
      </SectionWrapper>
      <SectionWrapper
        title={translate("simulationResults")}
        section="simulationResults"
      >
        <QuantityRow
          name="pressure"
          value={simPressure}
          unit={units.pressure}
          readOnly={true}
          placeholder={translate("notAvailable")}
        />
        <QuantityRow
          name="minPressure"
          value={reservoirSimulation?.minPressure ?? null}
          unit={units.pressure}
          readOnly={true}
          placeholder={translate("notAvailable")}
        />
        <QuantityRow
          name="maxPressure"
          value={reservoirSimulation?.maxPressure ?? null}
          unit={units.pressure}
          readOnly={true}
          placeholder={translate("notAvailable")}
        />
        <QuantityRow
          name="head"
          value={simHead}
          unit={units.head}
          readOnly={true}
          placeholder={translate("notAvailable")}
        />
        <QuantityRow
          name="netFlow"
          value={simNetFlow}
          unit={units.netFlow}
          readOnly={true}
          placeholder={translate("notAvailable")}
        />
        {reservoirSimulation?.waterAge != null && (
          <QuantityRow
            name="waterAge"
            value={reservoirSimulation.waterAge}
            unit={units.waterAge}
            readOnly={true}
            placeholder={translate("notAvailable")}
          />
        )}
        {reservoirSimulation?.waterTrace != null && (
          <QuantityRow
            name="waterTrace"
            value={reservoirSimulation.waterTrace}
            unit={units.waterTrace}
            readOnly={true}
            placeholder={translate("notAvailable")}
          />
        )}
        {reservoirSimulation?.chemicalConcentration != null && (
          <QuantityRow
            name="chemicalConcentration"
            value={reservoirSimulation.chemicalConcentration}
            unit={units.chemicalConcentration}
            readOnly={true}
            placeholder={translate("notAvailable")}
          />
        )}
      </SectionWrapper>
    </AssetEditorContent>
  );
};

const TankEditor = ({
  tank,
  hydraulicModel,
  units,
  onPropertyChange,
  onBatchPropertyChange,
  onLabelChange,
  readonly = false,
}: {
  tank: Tank;
  hydraulicModel: HydraulicModel;
  units: UnitsSpec;
  onPropertyChange: OnPropertyChange;
  onBatchPropertyChange: (changes: PropertyChange[]) => void;
  onLabelChange: (newLabel: string) => string | undefined;
  readonly?: boolean;
}) => {
  const translate = useTranslate();
  const allowsNullValues = useFeatureFlag("FLAG_NULL_VALUES");
  const simulationSettings = useAtomValue(simulationSettingsDerivedAtom);
  const { footer } = useQuickGraph(tank.id, "tank");
  const { getComparison, getCurveComparison, isNew } = useAssetComparison(tank);
  const simulation = useSimulation();
  const tankSimulation = simulation?.getTank(tank.id);

  const mixingModelOptions = useMemo(
    () =>
      tankMixingModels.map((m) => ({
        label: translate(`tank.${m}`),
        value: m,
      })),
    [translate],
  );

  const simPressure = tankSimulation?.pressure ?? null;
  const simHead = tankSimulation?.head ?? null;
  const simNetFlow = tankSimulation?.netFlow ?? null;
  const simLevel = tankSimulation?.level ?? null;
  const simVolume = tankSimulation?.volume ?? null;

  const activeTopologyComparison = getComparison("isActive", tank.isActive);
  const hasModelAttributesChanges =
    [
      "elevation",
      "initialLevel",
      "minLevel",
      "maxLevel",
      "diameter",
      "minVolume",
      "overflow",
    ].some((p) => getComparison(p, tank.getProperty(p)).hasChanged) ||
    getCurveComparison(
      "volumeCurveId",
      tank.volumeCurveId,
      hydraulicModel.curves,
    ).hasChanged;

  return (
    <AssetEditorContent
      label={tank.label}
      type={translate("tank")}
      labelType="tank"
      isNew={isNew}
      onLabelChange={onLabelChange}
      footer={footer}
      readOnly={readonly}
      key={tank.id}
    >
      <SectionWrapper
        title={translate("activeTopology")}
        section="activeTopology"
        hasChanged={activeTopologyComparison.hasChanged}
      >
        <SwitchRow
          name="isActive"
          label={translate("isEnabled")}
          enabled={tank.isActive}
          comparison={activeTopologyComparison}
          readOnly={readonly}
        />
      </SectionWrapper>
      <SectionWrapper
        title={translate("modelAttributes")}
        section="modelAttributes"
        hasChanged={hasModelAttributesChanges}
      >
        <QuantityRow
          name="elevation"
          value={tank.elevation}
          unit={units.elevation}
          comparison={getComparison("elevation", tank.elevation)}
          onChange={onPropertyChange}
          readOnly={readonly}
        />
        <QuantityRow
          name="initialLevel"
          value={tank.initialLevel}
          unit={units.initialLevel}
          comparison={getComparison("initialLevel", tank.initialLevel)}
          onChange={onPropertyChange}
          validate={isZeroOrGreater}
          readOnly={readonly}
          isNullable={allowsNullValues}
        />
        <TankDefinitionField
          tank={tank}
          curves={hydraulicModel.curves}
          units={units}
          onPropertyChange={onPropertyChange}
          onBatchPropertyChange={onBatchPropertyChange}
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
      </SectionWrapper>
      <CustomAttributesSection id={tank.id} type="tank" />
      <SectionWrapper title={translate("quality")} section="quality">
        <QuantityRow
          name="initialQuality"
          value={tank.initialQuality}
          isOptional={allowsNullValues}
          placeholder={String(DEFAULT_INITIAL_QUALITY)}
          unit={
            simulationSettings.qualitySimulationType === "age"
              ? units.waterAge
              : simulationSettings.qualitySimulationType === "chemical"
                ? units.chemicalConcentration
                : null
          }
          comparison={getComparison("initialQuality", tank.initialQuality)}
          onChange={onPropertyChange}
          validate={isZeroOrGreater}
          readOnly={readonly}
        />
        <QuantityRow
          name="bulkReactionCoeff"
          value={tank.bulkReactionCoeff}
          unit={null}
          isOptional
          placeholder={localizeDecimal(simulationSettings.reactionGlobalBulk)}
          comparison={getComparison(
            "bulkReactionCoeff",
            tank.bulkReactionCoeff,
          )}
          onChange={onPropertyChange}
          readOnly={readonly}
        />
        <ChemicalSourceEditor
          node={tank}
          patterns={hydraulicModel.patterns}
          onPropertyChange={onPropertyChange}
          onBatchPropertyChange={onBatchPropertyChange}
          unit={units.chemicalConcentration}
          readOnly={readonly}
        />
        <SelectRow
          name="mixingModel"
          selected={tank.mixingModel}
          options={mixingModelOptions}
          onChange={onPropertyChange}
          readOnly={readonly}
        />
        {tank.mixingModel === "2comp" && (
          <NestedSection>
            <QuantityRow
              name="mixingFraction"
              value={tank.mixingFraction}
              isOptional={allowsNullValues}
              placeholder={String(DEFAULT_MIXING_FRACTION)}
              unit={null}
              onChange={onPropertyChange}
              validate={isWithinUnitRange}
              readOnly={readonly}
            />
          </NestedSection>
        )}
      </SectionWrapper>
      <SectionWrapper
        title={translate("simulationResults")}
        section="simulationResults"
      >
        <QuantityRow
          name="pressure"
          value={simPressure}
          unit={units.pressure}
          readOnly={true}
          placeholder={translate("notAvailable")}
        />
        <QuantityRow
          name="minPressure"
          value={tankSimulation?.minPressure ?? null}
          unit={units.pressure}
          readOnly={true}
          placeholder={translate("notAvailable")}
        />
        <QuantityRow
          name="maxPressure"
          value={tankSimulation?.maxPressure ?? null}
          unit={units.pressure}
          readOnly={true}
          placeholder={translate("notAvailable")}
        />
        <QuantityRow
          name="head"
          value={simHead}
          unit={units.head}
          readOnly={true}
          placeholder={translate("notAvailable")}
        />
        <QuantityRow
          name="level"
          value={simLevel}
          unit={units.level}
          readOnly={true}
          placeholder={translate("notAvailable")}
        />
        <QuantityRow
          name="volume"
          value={simVolume}
          unit={units.volume}
          readOnly={true}
          placeholder={translate("notAvailable")}
        />
        <QuantityRow
          name="netFlow"
          value={simNetFlow}
          unit={units.netFlow}
          readOnly={true}
          placeholder={translate("notAvailable")}
        />
        {tankSimulation?.waterAge != null && (
          <QuantityRow
            name="waterAge"
            value={tankSimulation.waterAge}
            unit={units.waterAge}
            readOnly={true}
            placeholder={translate("notAvailable")}
          />
        )}
        {tankSimulation?.waterTrace != null && (
          <QuantityRow
            name="waterTrace"
            value={tankSimulation.waterTrace}
            unit={units.waterTrace}
            readOnly={true}
            placeholder={translate("notAvailable")}
          />
        )}
        {tankSimulation?.chemicalConcentration != null && (
          <QuantityRow
            name="chemicalConcentration"
            value={tankSimulation.chemicalConcentration}
            unit={units.chemicalConcentration}
            readOnly={true}
            placeholder={translate("notAvailable")}
          />
        )}
      </SectionWrapper>
    </AssetEditorContent>
  );
};

const TankDefinitionField = ({
  tank,
  curves,
  units,
  onPropertyChange,
  onBatchPropertyChange,
  readOnly = false,
}: {
  tank: Tank;
  curves: Curves;
  units: UnitsSpec;
  onPropertyChange: OnPropertyChange;
  onBatchPropertyChange: (changes: PropertyChange[]) => void;
  readOnly?: boolean;
}) => {
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();
  const showCurveLibrary = useShowCurveLibrary();
  const { getComparison, getCurveComparison } = useAssetComparison(tank);
  const allowsNullValues = useFeatureFlag("FLAG_NULL_VALUES");

  const [definitionMode, setDefinitionMode] = useState<TankDefinitionMode>(
    tank.volumeCurveId != null ? "curveBased" : "diameterBased",
  );

  const definitionOptions = useMemo(
    () =>
      [
        { label: translate("diameterBased"), value: "diameterBased" },
        { label: translate("areaBased"), value: "areaBased" },
        { label: translate("volumeBased"), value: "volumeBased" },
        { label: translate("curveBased"), value: "curveBased" },
      ] as { label: string; value: TankDefinitionMode }[],
    [translate],
  );

  const levelUnit = translateUnit(units.minLevel);
  const volumeUnit = translateUnit(units.minVolume);
  const tableLabels = {
    horizontal: [
      `${translate("level")} (${levelUnit})`,
      `${translate("volume")} (${volumeUnit})`,
    ] as [string, string],
    vertical: [translate("max"), translate("min")],
  };

  const definitionDiff = useMemo(() => {
    const diameterComp = getComparison("diameter", tank.diameter);
    const minVolumeComp = getComparison("minVolume", tank.minVolume);
    const minLevelComp = getComparison("minLevel", tank.minLevel);
    const maxLevelComp = getComparison("maxLevel", tank.maxLevel);
    const curveComp = getCurveComparison(
      "volumeCurveId",
      tank.volumeCurveId,
      curves,
    );

    const hasChanged =
      diameterComp.hasChanged ||
      minVolumeComp.hasChanged ||
      minLevelComp.hasChanged ||
      maxLevelComp.hasChanged ||
      curveComp.hasChanged;

    if (!hasChanged) return { hasChanged: false } as const;

    const baseCurveId = curveComp.hasChanged
      ? curveComp.baseValue?.id
      : tank.volumeCurveId;
    const baseIsCircular = baseCurveId == null;

    const diameterUnit = translateUnit(units.tankDiameter);
    const volumeUnit = translateUnit(units.minVolume);
    const levelUnit = translateUnit(units.minLevel);

    const lines: string[] = [];
    if (baseIsCircular) {
      const baseDiameter = diameterComp.baseValue ?? tank.diameter;
      const baseMinVolume = minVolumeComp.baseValue ?? tank.minVolume ?? 0;
      const baseMinLevel = minLevelComp.baseValue ?? tank.minLevel;
      const baseMaxLevel = maxLevelComp.baseValue ?? tank.maxLevel;
      const baseMaxVolume = tankVolumeFor(
        baseDiameter ?? 0,
        baseMaxLevel,
        baseMinVolume,
        baseMinLevel,
      );
      // A null base diameter is shown as "None" rather than coerced to 0.
      const baseDiameterLabel =
        baseDiameter != null
          ? `${localizeDecimal(baseDiameter)} ${diameterUnit}`
          : translate("none");
      lines.push(`${translate("diameter")}: ${baseDiameterLabel}`);
      lines.push(
        `${translate("minLevel")}: ${localizeDecimal(baseMinLevel)} ${levelUnit}`,
      );
      lines.push(
        `${translate("maxLevel")}: ${localizeDecimal(baseMaxLevel)} ${levelUnit}`,
      );
      lines.push(
        `${translate("minVolume")}: ${localizeDecimal(baseMinVolume)} ${volumeUnit}`,
      );
      lines.push(
        `${translate("maxVolume")}: ${localizeDecimal(baseMaxVolume)} ${volumeUnit}`,
      );
    } else {
      const baseCurve = curveComp.baseValue;
      if (baseCurve) {
        const {
          minLevel: baseMinLevel,
          maxLevel: baseMaxLevel,
          minVolume: baseMinVolume,
          maxVolume: baseMaxVolume,
        } = tankVolumeCurveRange(baseCurve);
        lines.push(`${translate("volumeCurve")}: ${baseCurve.label}`);
        lines.push(
          `${translate("minLevel")}: ${localizeDecimal(baseMinLevel)} ${levelUnit}`,
        );
        lines.push(
          `${translate("maxLevel")}: ${localizeDecimal(baseMaxLevel)} ${levelUnit}`,
        );
        lines.push(
          `${translate("minVolume")}: ${localizeDecimal(baseMinVolume)} ${volumeUnit}`,
        );
        lines.push(
          `${translate("maxVolume")}: ${localizeDecimal(baseMaxVolume)} ${volumeUnit}`,
        );
      }
    }

    return { hasChanged: true, tooltipText: lines.join("\n") } as const;
  }, [
    getComparison,
    tank.diameter,
    tank.minVolume,
    tank.minLevel,
    tank.maxLevel,
    tank.volumeCurveId,
    getCurveComparison,
    curves,
    translateUnit,
    units,
    translate,
  ]);

  const handleDefinitionModeChange = useCallback(
    (_name: string, newValue: TankDefinitionMode) => {
      setDefinitionMode(newValue);
      if (newValue !== "curveBased" && tank.volumeCurveId) {
        onPropertyChange("volumeCurveId", undefined, tank.volumeCurveId);
      }
    },
    [onPropertyChange, tank.volumeCurveId],
  );

  const handleCurveChange = useCallback(
    (_name: string, newValue: CurveId | null) => {
      const changes = tankVolumeCurveChanges(curves, newValue);
      if (changes) onBatchPropertyChange(changes);
    },
    [curves, onBatchPropertyChange],
  );

  const handleAreaChange = (_name: string, area: number | null) => {
    const diameter = tankDiameterFromArea(area ?? 0);
    if (diameter !== tank.diameter) {
      onPropertyChange("diameter", diameter, tank.diameter);
    }
  };

  const handleMaxVolumeChange = (_name: string, maxVolume: number) => {
    const diameter = tankDiameterFor(
      maxVolume,
      tank.maxLevel,
      tank.minVolume ?? 0,
      tank.minLevel,
    );
    if (diameter !== tank.diameter) {
      onPropertyChange("diameter", diameter, tank.diameter);
    }
  };

  const handleMaxLevelChange = (_name: string, maxLevel: number) => {
    const diameter = tankDiameterFor(
      tank.maxVolume,
      maxLevel,
      tank.minVolume ?? 0,
      tank.minLevel,
    );
    onBatchPropertyChange([
      { property: "maxLevel", value: maxLevel },
      { property: "diameter", value: diameter },
    ]);
  };

  const handleMinLevelChange = (_name: string, minLevel: number) => {
    const diameter = tankDiameterFor(
      tank.maxVolume,
      tank.maxLevel,
      tank.minVolume ?? 0,
      minLevel,
    );
    onBatchPropertyChange([
      { property: "minLevel", value: minLevel },
      { property: "diameter", value: diameter },
    ]);
  };

  const handleMinVolumeChange = (_name: string, minVolume: number) => {
    const diameter = tankDiameterFor(
      tank.maxVolume,
      tank.maxLevel,
      minVolume,
      tank.minLevel,
    );
    onBatchPropertyChange([
      { property: "minVolume", value: minVolume },
      { property: "diameter", value: diameter },
    ]);
  };

  return (
    <BlockComparisonField
      hasChanged={definitionDiff.hasChanged}
      baseDisplayValue={
        definitionDiff.tooltipText ? (
          <div className="whitespace-pre-line">
            {definitionDiff.tooltipText}
          </div>
        ) : undefined
      }
    >
      <SelectRow
        name="tankDefinition"
        selected={definitionMode}
        options={definitionOptions}
        readOnly={readOnly}
        onChange={handleDefinitionModeChange}
      />
      <NestedSection className="pb-2">
        {definitionMode === "diameterBased" && (
          <>
            <QuantityRow
              name="diameter"
              value={tank.diameter}
              unit={units.tankDiameter}
              onChange={onPropertyChange}
              validate={isGreaterThanZero}
              readOnly={readOnly}
              isNullable={allowsNullValues}
            />
            <hr className=" my-1" />
            <NumericTable
              labels={tableLabels}
              cells={[
                [
                  {
                    label: translate("maxLevel"),
                    value: tank.maxLevel,
                    isNullable: false,
                    validate: isGreaterThanZero,
                    readOnly,
                    handler: (v) =>
                      onPropertyChange("maxLevel", v, tank.maxLevel),
                  },
                  {
                    label: translate("maxVolume"),
                    value: tank.maxVolume,
                    readOnly: true,
                  },
                ],
                [
                  {
                    label: translate("minLevel"),
                    value: tank.minLevel,
                    validate: isZeroOrGreater,
                    isNullable: false,
                    readOnly,
                    handler: (v) =>
                      onPropertyChange("minLevel", v, tank.minLevel),
                  },
                  {
                    label: translate("minVolume"),
                    value: tank.minVolume ?? null,
                    validate: isZeroOrGreater,
                    isNullable: allowsNullValues,
                    commitInvalidValues: allowsNullValues,
                    placeholder: allowsNullValues
                      ? String(DEFAULT_MIN_VOLUME)
                      : undefined,
                    readOnly,
                    handler: (v, isEmpty) =>
                      onPropertyChange(
                        "minVolume",
                        allowsNullValues && isEmpty ? undefined : v,
                        tank.minVolume,
                      ),
                  },
                ],
              ]}
            />
          </>
        )}
        {definitionMode === "areaBased" && (
          <>
            <QuantityRow
              name="area"
              value={tank.area}
              unit={units.tankArea}
              onChange={handleAreaChange}
              readOnly={readOnly}
              validate={isGreaterThanZero}
            />
            <hr className=" my-1" />
            <NumericTable
              labels={tableLabels}
              cells={[
                [
                  {
                    label: translate("maxLevel"),
                    value: tank.maxLevel,
                    isNullable: false,
                    validate: isGreaterThanZero,
                    readOnly,
                    handler: (v) =>
                      onPropertyChange("maxLevel", v, tank.maxLevel),
                  },
                  {
                    label: translate("maxVolume"),
                    value: tank.maxVolume,
                    readOnly: true,
                  },
                ],
                [
                  {
                    label: translate("minLevel"),
                    value: tank.minLevel,
                    validate: isZeroOrGreater,
                    isNullable: false,
                    readOnly,
                    handler: (v) =>
                      onPropertyChange("minLevel", v, tank.minLevel),
                  },
                  {
                    label: translate("minVolume"),
                    value: tank.minVolume ?? null,
                    validate: isZeroOrGreater,
                    isNullable: allowsNullValues,
                    commitInvalidValues: allowsNullValues,
                    placeholder: allowsNullValues
                      ? String(DEFAULT_MIN_VOLUME)
                      : undefined,
                    readOnly,
                    handler: (v, isEmpty) =>
                      onPropertyChange(
                        "minVolume",
                        allowsNullValues && isEmpty ? undefined : v,
                        tank.minVolume,
                      ),
                  },
                ],
              ]}
            />
          </>
        )}
        {definitionMode === "volumeBased" && (
          <NumericTable
            labels={tableLabels}
            cells={[
              [
                {
                  label: translate("maxLevel"),
                  value: tank.maxLevel,
                  isNullable: false,
                  validate: isGreaterThanZero,
                  readOnly,
                  handler: (v) => handleMaxLevelChange("maxLevel", v),
                },
                {
                  label: translate("maxVolume"),
                  value: tank.maxVolume,
                  isNullable: false,
                  validate: isGreaterThanZero,
                  readOnly,
                  handler: (v) => handleMaxVolumeChange("maxVolume", v),
                },
              ],
              [
                {
                  label: translate("minLevel"),
                  value: tank.minLevel,
                  validate: isZeroOrGreater,
                  isNullable: false,
                  readOnly,
                  handler: (v) => handleMinLevelChange("minLevel", v),
                },
                {
                  label: translate("minVolume"),
                  value: tank.minVolume ?? null,
                  validate: isZeroOrGreater,
                  isNullable: false,
                  readOnly,
                  handler: (v) => handleMinVolumeChange("minVolume", v),
                },
              ],
            ]}
          />
        )}
        {definitionMode === "curveBased" && (
          <>
            <LibrarySelectRow
              name="volumeCurve"
              collection={curves}
              filterByType="volume"
              libraryLabel={translate("openCurvesLibrary")}
              onOpenLibrary={() =>
                showCurveLibrary({
                  source: "tank",
                  curveId: tank.volumeCurveId,
                  initialSection: "volume",
                })
              }
              selected={tank.volumeCurveId ?? null}
              onChange={handleCurveChange}
              readOnly={readOnly}
            />
            {(() => {
              if (!tank.volumeCurveId) return null;
              const curve = curves.get(tank.volumeCurveId);
              if (!curve) return null;
              const { minLevel, maxLevel, minVolume, maxVolume } =
                tankVolumeCurveRange(curve);
              return (
                <>
                  <hr className=" my-1" />
                  <NumericTable
                    labels={tableLabels}
                    cells={[
                      [
                        {
                          label: translate("maxLevel"),
                          value: maxLevel,
                          readOnly: true,
                        },
                        {
                          label: translate("maxVolume"),
                          value: maxVolume,
                          readOnly: true,
                        },
                      ],
                      [
                        {
                          label: translate("minLevel"),
                          value: minLevel,
                          readOnly: true,
                        },
                        {
                          label: translate("minVolume"),
                          value: minVolume,
                          readOnly: true,
                        },
                      ],
                    ]}
                  />
                </>
              );
            })()}
          </>
        )}
      </NestedSection>
    </BlockComparisonField>
  );
};

const ValveEditor = ({
  hydraulicModel,
  valve,
  startNode,
  endNode,
  units,
  onPropertyChange,
  onBatchPropertyChange,
  onStatusChange,
  onActiveTopologyStatusChange,
  onLabelChange,
  readonly = false,
}: {
  hydraulicModel: HydraulicModel;
  valve: Valve;
  startNode: NodeAsset | null;
  endNode: NodeAsset | null;
  units: UnitsSpec;
  onStatusChange: OnStatusChange<ValveStatus>;
  onPropertyChange: OnPropertyChange;
  onBatchPropertyChange: (changes: PropertyChange[]) => void;
  onActiveTopologyStatusChange: (
    property: string,
    newValue: boolean,
    oldValue: boolean,
  ) => void;
  onLabelChange: (newLabel: string) => string | undefined;
  readonly?: boolean;
}) => {
  const translate = useTranslate();
  const allowsNullValues = useFeatureFlag("FLAG_NULL_VALUES");
  const { footer } = useQuickGraph(valve.id, "valve");
  const { getComparison, getCurveComparison, isNew } =
    useAssetComparison(valve);
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
    const options: { label: string; description: string; value: ValveKind }[] =
      valveKinds.map((kind) => {
        return {
          label: kind.toUpperCase(),
          description: translate(`valve.${kind}.detailed`),
          value: kind,
        };
      });
    if (!valveKinds.includes(valve.kind as any)) {
      options.push({
        label: valve.kind.toUpperCase(),
        description: translate(`valve.${valve.kind}.detailed`),
        value: valve.kind,
      });
    }
    return options;
  }, [translate, valve.kind]);

  const handleKindChange = (
    _name: string,
    newValue: ValveKind,
    oldValue: ValveKind,
  ) => {
    onBatchPropertyChange(valveKindChanges(newValue, oldValue));
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
    if (["psv", "prv", "pbv"].includes(valve.kind)) return units.pressure;
    if (valve.kind === "fcv") return units.flow;
    return null;
  };

  const activeTopologyComparison = getComparison("isActive", valve.isActive);
  const hasModelAttributesChanges =
    ["kind", "setting", "initialStatus", "diameter", "minorLoss"].some(
      (p) => getComparison(p, valve.getProperty(p)).hasChanged,
    ) ||
    getCurveComparison("curveId", valve.curveId, hydraulicModel.curves)
      .hasChanged;

  return (
    <AssetEditorContent
      label={valve.label}
      type={translate("valve")}
      labelType="valve"
      isNew={isNew}
      onLabelChange={onLabelChange}
      footer={footer}
      readOnly={readonly}
      key={valve.id}
    >
      <SectionWrapper title={translate("connections")} section="connections">
        <TextRow name="startNode" value={startNode ? startNode.label : ""} />
        <TextRow name="endNode" value={endNode ? endNode.label : ""} />
      </SectionWrapper>
      <SectionWrapper
        title={translate("activeTopology")}
        section="activeTopology"
        hasChanged={activeTopologyComparison.hasChanged}
      >
        <SwitchRow
          name="isActive"
          label={translate("isEnabled")}
          enabled={valve.isActive}
          comparison={activeTopologyComparison}
          onChange={onActiveTopologyStatusChange}
          readOnly={readonly}
        />
      </SectionWrapper>
      <SectionWrapper
        title={translate("modelAttributes")}
        section="modelAttributes"
        hasChanged={hasModelAttributesChanges}
      >
        <SelectRow
          name="valveType"
          selected={valve.kind}
          options={kindOptions}
          comparison={getComparison("kind", valve.kind)}
          onChange={handleKindChange}
          readOnly={readonly}
        />
        {valve.kind !== "gpv" && (
          <QuantityRow
            name="setting"
            value={valve.setting}
            unit={getSettingUnit()}
            comparison={getComparison("setting", valve.setting)}
            onChange={onPropertyChange}
            readOnly={readonly}
            isNullable={allowsNullValues}
          />
        )}
        {valve.kind === "gpv" && (
          <HeadlossCurveField
            valve={valve}
            curves={hydraulicModel.curves}
            getCurveComparison={getCurveComparison}
            onChange={onPropertyChange}
            readOnly={readonly}
          />
        )}
        {valve.kind === "pcv" && (
          <ValveCurveField
            valve={valve}
            curves={hydraulicModel.curves}
            getCurveComparison={getCurveComparison}
            onChange={onPropertyChange}
            readOnly={readonly}
          />
        )}
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
          unit={units.diameter}
          comparison={getComparison("diameter", valve.diameter)}
          onChange={onPropertyChange}
          readOnly={readonly}
          validate={isGreaterThanZero}
          isNullable={allowsNullValues}
        />
        <QuantityRow
          name="minorLoss"
          value={valve.minorLoss}
          validate={isZeroOrGreater}
          isOptional={allowsNullValues}
          placeholder={String(DEFAULT_MINOR_LOSS)}
          unit={units.minorLoss}
          comparison={getComparison("minorLoss", valve.minorLoss)}
          onChange={onPropertyChange}
          readOnly={readonly}
        />
      </SectionWrapper>
      <CustomAttributesSection id={valve.id} type="valve" />
      <SectionWrapper
        title={translate("simulationResults")}
        section="simulationResults"
      >
        <QuantityRow
          name="flow"
          value={simFlow}
          unit={units.flow}
          readOnly={true}
          placeholder={translate("notAvailable")}
        />
        <QuantityRow
          name="velocity"
          value={simVelocity}
          unit={units.velocity}
          readOnly={true}
          placeholder={translate("notAvailable")}
        />
        <QuantityRow
          name="headlossShort"
          value={simHeadloss}
          unit={units.headloss}
          readOnly={true}
          placeholder={translate("notAvailable")}
        />
        <TextRow name="status" value={statusText} />
        {valveSimulation?.waterAge != null && (
          <QuantityRow
            name="waterAge"
            value={valveSimulation.waterAge}
            unit={units.waterAge}
            readOnly={true}
            placeholder={translate("notAvailable")}
          />
        )}
        {valveSimulation?.waterTrace != null && (
          <QuantityRow
            name="waterTrace"
            value={valveSimulation.waterTrace}
            unit={units.waterTrace}
            readOnly={true}
            placeholder={translate("notAvailable")}
          />
        )}
        {valveSimulation?.chemicalConcentration != null && (
          <QuantityRow
            name="chemicalConcentration"
            value={valveSimulation.chemicalConcentration}
            unit={units.chemicalConcentration}
            readOnly={true}
            placeholder={translate("notAvailable")}
          />
        )}
      </SectionWrapper>
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
  onBatchPropertyChange,
  onLabelChange,
  onControlChange,
  units,
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
  onBatchPropertyChange: (changes: PropertyChange[]) => void;
  onLabelChange: (newLabel: string) => string | undefined;
  onControlChange: (
    assetId: AssetId,
    control: Control | null,
    previousControl: Control | null,
  ) => void;
  units: UnitsSpec;
  readonly?: boolean;
}) => {
  const simulationSettings = useAtomValue(simulationSettingsDerivedAtom);
  const translate = useTranslate();
  const allowsNullValues = useFeatureFlag("FLAG_NULL_VALUES");
  const isPumpControlsOn = useFeatureFlag("FLAG_PUMP_CONTROLS");
  const { footer } = useQuickGraph(pump.id, "pump");
  const {
    getComparison,
    getCurveComparison,
    getPatternComparison,
    getPumpCurveComparison,
    isNew,
  } = useAssetComparison(pump);
  const simulation = useSimulation();
  const pumpSimulation = simulation?.getPump(pump.id);
  const pumpEnergy = simulation?.getPumpEnergy(pump.id) ?? null;

  const simFlow = pumpSimulation?.flow ?? null;
  const simHead = pumpSimulation?.head ?? null;
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

  const tanks = useMemo(
    () =>
      [...hydraulicModel.assets.values()].filter(
        (asset): asset is Tank => asset.type === "tank",
      ),
    [hydraulicModel.assets],
  );

  const pumpControl =
    [...hydraulicModel.controlsLookup.getControls(pump.id)].find(
      (c) => c.linkId === pump.id,
    ) ?? null;

  const { rawControls } = hydraulicModel;
  const hasRawControls =
    rawControls.simple.some((c) =>
      c.assetReferences.some((ref) => ref.assetId === pump.id),
    ) ||
    rawControls.rules.some((r) =>
      r.assetReferences.some((ref) => ref.assetId === pump.id),
    );

  const handleControlChangeForPump = (control: Control | null) => {
    onControlChange(pump.id, control, pumpControl);
  };

  const activeTopologyComparison = getComparison("isActive", pump.isActive);
  const hasModelAttributesChanges =
    ["definitionType", "power", "speed", "initialStatus"].some(
      (p) => getComparison(p, pump.getProperty(p)).hasChanged,
    ) ||
    getCurveComparison("curveId", pump.curveId, hydraulicModel.curves)
      .hasChanged ||
    getPatternComparison(
      "speedPatternId",
      pump.speedPatternId,
      hydraulicModel.patterns,
    ).hasChanged;
  const hasEnergyChanges =
    getComparison("energyPrice", pump.energyPrice).hasChanged ||
    getCurveComparison(
      "efficiencyCurveId",
      pump.efficiencyCurveId,
      hydraulicModel.curves,
    ).hasChanged ||
    getPatternComparison(
      "energyPricePatternId",
      pump.energyPricePatternId,
      hydraulicModel.patterns,
    ).hasChanged;

  return (
    <AssetEditorContent
      label={pump.label}
      type={translate("pump")}
      labelType="pump"
      isNew={isNew}
      onLabelChange={onLabelChange}
      footer={footer}
      readOnly={readonly}
      key={pump.id}
    >
      <SectionWrapper title={translate("connections")} section="connections">
        <TextRow name="startNode" value={startNode ? startNode.label : ""} />
        <TextRow name="endNode" value={endNode ? endNode.label : ""} />
      </SectionWrapper>
      <SectionWrapper
        title={translate("activeTopology")}
        section="activeTopology"
        hasChanged={activeTopologyComparison.hasChanged}
      >
        <SwitchRow
          name="isActive"
          label={translate("isEnabled")}
          enabled={pump.isActive}
          comparison={activeTopologyComparison}
          onChange={onActiveTopologyStatusChange}
          readOnly={readonly}
        />
      </SectionWrapper>
      <SectionWrapper
        title={translate("modelAttributes")}
        section="modelAttributes"
        hasChanged={hasModelAttributesChanges}
      >
        <PumpDefinitionDetails
          pump={pump}
          curves={hydraulicModel.curves}
          units={units}
          onChange={onBatchPropertyChange}
          readonly={readonly}
          getComparison={getComparison}
          getPumpCurveComparison={getPumpCurveComparison}
        />

        <QuantityRow
          name="initialSpeed"
          value={pump.speed}
          validate={isZeroOrGreater}
          isOptional={allowsNullValues}
          placeholder={String(DEFAULT_SPEED)}
          unit={units.speed}
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
      </SectionWrapper>
      <CustomAttributesSection id={pump.id} type="pump" />
      {isPumpControlsOn && (
        <SectionWrapper title={translate("controls.title")} section="controls">
          <PumpControlsEditor
            key={pump.id}
            linkId={pump.id}
            initialStatus={pump.initialStatus}
            initialSpeed={pump.speed ?? 1}
            control={pumpControl}
            tanks={tanks}
            onControlChange={handleControlChangeForPump}
            hasRawControls={hasRawControls}
            readOnly={readonly}
          />
        </SectionWrapper>
      )}
      <SectionWrapper
        title={translate("energy")}
        section="energy"
        hasChanged={hasEnergyChanges}
      >
        <PumpEfficiencyCurveField
          pump={pump}
          curves={hydraulicModel.curves}
          globalEfficiency={simulationSettings.energyGlobalEfficiency}
          onChange={onPropertyChange}
          readOnly={readonly}
        />
        <QuantityRow
          name="energyPrice"
          value={pump.energyPrice}
          unit={null}
          comparison={getComparison("energyPrice", pump.energyPrice)}
          onChange={onPropertyChange}
          validate={isZeroOrGreater}
          commitInvalidValues={allowsNullValues}
          isOptional
          readOnly={readonly}
          placeholder={localizeDecimal(simulationSettings.energyGlobalPrice)}
        />
        <PumpEnergyPricePatternField
          pump={pump}
          patterns={hydraulicModel.patterns}
          globalPatternId={simulationSettings.energyGlobalPatternId}
          onPropertyChange={onPropertyChange}
          readOnly={readonly}
        />
      </SectionWrapper>

      <SectionWrapper
        title={translate("simulationResults")}
        section="simulationResults"
      >
        <QuantityRow
          name="flow"
          value={simFlow}
          unit={units.flow}
          readOnly={true}
          placeholder={translate("notAvailable")}
        />
        <QuantityRow
          name="pumpHead"
          value={simHead}
          unit={units.headloss}
          readOnly={true}
          placeholder={translate("notAvailable")}
        />
        <TextRow name="status" value={statusText} />
        {pumpSimulation?.waterAge != null && (
          <QuantityRow
            name="waterAge"
            value={pumpSimulation.waterAge}
            unit={units.waterAge}
            readOnly={true}
            placeholder={translate("notAvailable")}
          />
        )}
        {pumpSimulation?.waterTrace != null && (
          <QuantityRow
            name="waterTrace"
            value={pumpSimulation.waterTrace}
            unit={units.waterTrace}
            readOnly={true}
            placeholder={translate("notAvailable")}
          />
        )}
        {pumpSimulation?.chemicalConcentration != null && (
          <QuantityRow
            name="chemicalConcentration"
            value={pumpSimulation.chemicalConcentration}
            unit={units.chemicalConcentration}
            readOnly={true}
            placeholder={translate("notAvailable")}
          />
        )}
      </SectionWrapper>
      <SectionWrapper
        title={translate("energyResults")}
        section="energyResults"
      >
        <QuantityRow
          name="utilization"
          value={pumpEnergy?.utilization ?? null}
          unit={units.efficiency}
          readOnly={true}
          placeholder={translate("notAvailable")}
        />
        <QuantityRow
          name="averageEfficiency"
          value={pumpEnergy?.averageEfficiency ?? null}
          unit={units.efficiency}
          readOnly={true}
          placeholder={translate("notAvailable")}
        />
        <QuantityRow
          name="averageKwPerFlowUnit"
          value={pumpEnergy?.averageKwPerFlowUnit ?? null}
          unit={units.averageKwPerFlowUnit}
          readOnly={true}
          placeholder={translate("notAvailable")}
        />
        <QuantityRow
          name="averageKw"
          value={pumpEnergy?.averageKw ?? null}
          unit={units.power}
          readOnly={true}
          placeholder={translate("notAvailable")}
        />
        <QuantityRow
          name="peakKw"
          value={pumpEnergy?.peakKw ?? null}
          unit={units.power}
          readOnly={true}
          placeholder={translate("notAvailable")}
        />
        <QuantityRow
          name="averageCostPerDay"
          value={pumpEnergy?.averageCostPerDay ?? null}
          unit={null}
          readOnly={true}
          placeholder={translate("notAvailable")}
        />
        <QuantityRow
          name="demandCharge"
          value={pumpEnergy?.demandCharge ?? null}
          unit={null}
          readOnly={true}
          placeholder={translate("notAvailable")}
        />
      </SectionWrapper>
    </AssetEditorContent>
  );
};

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
  const showPatternsLibrary = useShowPatternsLibrary();
  const { getPatternComparison } = useAssetComparison(pump);

  const comparison = getPatternComparison(
    "speedPatternId",
    pump.speedPatternId,
    patterns,
  );

  const enhancedVariableSpeedOptions = useMemo(
    () => [
      {
        label: translate("patternBased"),
        value: VARIABLE_SPEED_PATTERN_BASED,
      },
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
      setSelectedVariableSpeed(newValue);
      if (newValue === null && pump.speedPatternId) {
        onPropertyChange("speedPatternId", undefined, pump.speedPatternId);
      }
    },
    [onPropertyChange, pump.speedPatternId],
  );

  const handleSpeedPatternChange = useCallback(
    (_: string, newValue: number | null, oldValue: number | null) => {
      if (newValue === oldValue) return;
      if (newValue === null) {
        if (pump.speedPatternId) {
          onPropertyChange("speedPatternId", undefined, pump.speedPatternId);
        }
        return;
      }
      onPropertyChange("speedPatternId", newValue, pump.speedPatternId);
    },
    [onPropertyChange, pump.speedPatternId],
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
        options={enhancedVariableSpeedOptions}
        nullable={true}
        placeholder={translate("none")}
        clearLabel={translate("none")}
        onChange={handleVariableSpeedChange}
        readOnly={readOnly}
      />
      {selectedVariableSpeed === VARIABLE_SPEED_PATTERN_BASED && (
        <NestedSection>
          <LibrarySelectRow
            name="speedPattern"
            collection={patterns}
            filterByType="pumpSpeed"
            libraryLabel={translate("openPatternsLibrary")}
            onOpenLibrary={() =>
              showPatternsLibrary({
                source: "pump",
                initialPatternId: pump.speedPatternId,
                initialSection: "pumpSpeed",
              })
            }
            selected={pump.speedPatternId ?? null}
            emptyOptionLabel={translate("constant")}
            onChange={handleSpeedPatternChange}
            readOnly={readOnly}
          />
        </NestedSection>
      )}
    </BlockComparisonField>
  );
};

const PumpEfficiencyCurveField = ({
  pump,
  curves,
  globalEfficiency,
  onChange,
  readOnly = false,
}: {
  pump: Pump;
  curves: Curves;
  globalEfficiency: number;
  onChange: OnPropertyChange;
  readOnly?: boolean;
}) => {
  const translate = useTranslate();
  const showPumpLibrary = useShowPumpLibrary();
  const { getCurveComparison } = useAssetComparison(pump);

  const curveComparison = getCurveComparison(
    "efficiencyCurveId",
    pump.efficiencyCurveId,
    curves,
  );

  const baseDisplayValue = useMemo(() => {
    if (!curveComparison.hasChanged) return undefined;
    const baseCurve = curveComparison.baseValue;
    const curveName = translate("efficiencyCurve");
    const lines: string[] = [];

    if (baseCurve) {
      lines.push(`${curveName}: ${baseCurve.label}`);
      if (baseCurve.id === pump.efficiencyCurveId) {
        lines.push(translate("curvePointsDiffer"));
      }
    } else {
      lines.push(`${curveName}: (${translate("none").toLocaleLowerCase()})`);
    }

    return <div className="whitespace-pre-line">{lines.join("\n")}</div>;
  }, [curveComparison, pump.efficiencyCurveId, translate]);

  const handleOnChange = useCallback(
    (_name: string, newValue: CurveId | null, _oldValue: CurveId | null) => {
      const efficiencyCurveId = newValue === null ? undefined : newValue;
      if (pump.efficiencyCurveId !== efficiencyCurveId)
        onChange(
          "efficiencyCurveId",
          efficiencyCurveId,
          pump.efficiencyCurveId,
        );
    },
    [onChange, pump.efficiencyCurveId],
  );

  return (
    <BlockComparisonField
      hasChanged={curveComparison.hasChanged}
      baseDisplayValue={baseDisplayValue}
    >
      <LibrarySelectRow
        name="efficiencyCurve"
        collection={curves}
        filterByType="efficiency"
        libraryLabel={translate("openPumpLibrary")}
        onOpenLibrary={() =>
          showPumpLibrary({
            source: "pump",
            curveId: pump.efficiencyCurveId,
            initialSection: "efficiency",
          })
        }
        selected={pump.efficiencyCurveId ?? null}
        emptyOptionLabel={translate(
          "constantPercent",
          localizeDecimal(globalEfficiency),
        )}
        onChange={handleOnChange}
        readOnly={readOnly}
      />
    </BlockComparisonField>
  );
};

const ChemicalSourceEditor = ({
  node,
  patterns,
  onPropertyChange,
  onBatchPropertyChange,
  unit,
  readOnly = false,
}: {
  node: NodeAsset;
  patterns: Patterns;
  onPropertyChange: OnPropertyChange;
  onBatchPropertyChange: (changes: PropertyChange[]) => void;
  unit: Unit;
  readOnly?: boolean;
}) => {
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();
  const showPatternsLibrary = useShowPatternsLibrary();
  const { getComparison, getPatternComparison } = useAssetComparison(node);
  const allowsNullValues = useFeatureFlag("FLAG_NULL_VALUES");
  const typedNode = node as Junction | Tank | Reservoir;

  const strengthUnit =
    typedNode.chemicalSourceType === "mass"
      ? `${translateUnit(unit)}/min`
      : translateUnit(unit);

  const sourceTypeOptions = useMemo(
    () =>
      chemicalSourceTypes.map((t) => ({
        label: translate(`source.${t}`),
        value: t,
      })),
    [translate],
  );

  const typeComparison = getComparison(
    "chemicalSourceType",
    node.chemicalSourceType,
  );
  const strengthComparison = getComparison(
    "chemicalSourceStrength",
    node.chemicalSourceStrength,
  );
  const patternComparison = getPatternComparison(
    "chemicalSourcePatternId",
    node.chemicalSourcePatternId,
    patterns,
  );

  const hasChanged =
    typeComparison.hasChanged ||
    strengthComparison.hasChanged ||
    patternComparison.hasChanged;

  const baseDisplayValue = useMemo(() => {
    if (!hasChanged) return [] as string[];
    const lines: string[] = [];

    if (typeComparison.hasChanged) {
      const baseType = typeComparison.baseValue as
        | ChemicalSourceType
        | undefined;
      const baseLabel = baseType
        ? translate(`source.${baseType}`)
        : `(${translate("none").toLocaleLowerCase()})`;
      lines.push(`${translate("chemicalSourceType")}: ${baseLabel}`);
      if (!baseType) return lines;
    }

    const baseStrength = strengthComparison.baseValue;
    lines.push(
      `${translate("chemicalSourceStrength")}: ${baseStrength ?? `(${translate("none").toLocaleLowerCase()})`}`,
    );

    const basePattern = patternComparison.baseValue;
    const patternName = translate("chemicalSourcePattern");
    if (basePattern) {
      lines.push(`${patternName}: ${basePattern.label}`);
      if (basePattern.id === node.chemicalSourcePatternId) {
        lines.push(translate("multipliersDiffer"));
      }
    } else {
      lines.push(`${patternName}: (${translate("none").toLocaleLowerCase()})`);
    }

    return lines;
  }, [
    hasChanged,
    typeComparison,
    strengthComparison,
    patternComparison,
    node.chemicalSourcePatternId,
    translate,
  ]);

  const handlePatternChange = useCallback(
    (_: string, newValue: PatternId | null, oldValue: PatternId | null) => {
      onPropertyChange(
        "chemicalSourcePatternId",
        newValue === null ? undefined : newValue,
        oldValue || undefined,
      );
    },
    [onPropertyChange],
  );

  return (
    <BlockComparisonField
      hasChanged={hasChanged}
      baseDisplayValue={
        <div className="whitespace-pre-line">{baseDisplayValue.join("\n")}</div>
      }
    >
      <SelectRow
        name="chemicalSourceType"
        selected={typedNode.chemicalSourceType ?? null}
        options={sourceTypeOptions}
        nullable={true}
        placeholder={translate("none")}
        clearLabel={translate("none")}
        onChange={(_name, value) => {
          onBatchPropertyChange(
            chemicalSourceTypeChanges(
              value === null ? null : (value as ChemicalSourceType),
            ),
          );
        }}
        readOnly={readOnly}
      />
      {typedNode.chemicalSourceType && (
        <NestedSection>
          <QuantityRow
            name="chemicalSourceStrength"
            displayName={`${translate("chemicalSourceStrength")} (${strengthUnit})`}
            value={typedNode.chemicalSourceStrength}
            unit={null}
            onChange={onPropertyChange}
            validate={isZeroOrGreater}
            commitInvalidValues={allowsNullValues}
            isOptional
            placeholder={localizeDecimal(0)}
            readOnly={readOnly}
          />
          <LibrarySelectRow
            name="chemicalSourcePattern"
            collection={patterns}
            filterByType="qualitySourceStrength"
            libraryLabel={translate("openPatternsLibrary")}
            onOpenLibrary={() =>
              showPatternsLibrary({
                source: "quality",
                initialPatternId: node.chemicalSourcePatternId,
                initialSection: "qualitySourceStrength",
              })
            }
            selected={node.chemicalSourcePatternId ?? null}
            emptyOptionLabel={translate("none")}
            placeholder={translate("none")}
            onChange={handlePatternChange}
            readOnly={readOnly}
          />
        </NestedSection>
      )}
    </BlockComparisonField>
  );
};

const PumpEnergyPricePatternField = ({
  pump,
  patterns,
  globalPatternId,
  onPropertyChange,
  readOnly = false,
}: {
  pump: Pump;
  patterns: Patterns;
  globalPatternId: PatternId | null;
  onPropertyChange: OnPropertyChange;
  readOnly?: boolean;
}) => {
  const translate = useTranslate();
  const showPatternsLibrary = useShowPatternsLibrary();
  const { getPatternComparison } = useAssetComparison(pump);

  const patternComparison = getPatternComparison(
    "energyPricePatternId",
    pump.energyPricePatternId,
    patterns,
  );

  const baseDisplayValue = useMemo(() => {
    if (!patternComparison.hasChanged) return undefined;
    const basePattern = patternComparison.baseValue;
    const patternName = translate("energyPricePattern");
    const lines: string[] = [];

    if (basePattern) {
      lines.push(`${patternName}: ${basePattern.label}`);
      if (basePattern.id === pump.energyPricePatternId) {
        lines.push(translate("multipliersDiffer"));
      }
    } else {
      lines.push(`${patternName}: (${translate("none").toLocaleLowerCase()})`);
    }

    return <div className="whitespace-pre-line">{lines.join("\n")}</div>;
  }, [patternComparison, pump.energyPricePatternId, translate]);

  const placeholder = useMemo(() => {
    if (globalPatternId !== null) {
      const globalPattern = patterns.get(globalPatternId);
      if (globalPattern) return globalPattern.label;
    }
    return translate("constant");
  }, [globalPatternId, patterns, translate]);

  const handleChange = useCallback(
    (_: string, newValue: PatternId | null, oldValue: PatternId | null) => {
      onPropertyChange(
        "energyPricePatternId",
        newValue === null ? undefined : newValue,
        oldValue || undefined,
      );
    },
    [onPropertyChange],
  );

  return (
    <BlockComparisonField
      hasChanged={patternComparison.hasChanged}
      baseDisplayValue={baseDisplayValue}
    >
      <LibrarySelectRow
        name="energyPricePattern"
        collection={patterns}
        filterByType="energyPrice"
        libraryLabel={translate("openPatternsLibrary")}
        onOpenLibrary={() =>
          showPatternsLibrary({
            source: "pump",
            initialPatternId: pump.energyPricePatternId,
            initialSection: "energyPrice",
          })
        }
        selected={pump.energyPricePatternId ?? null}
        emptyOptionLabel={placeholder}
        placeholder={placeholder}
        excludeId={globalPatternId ?? undefined}
        onChange={handleChange}
        readOnly={readOnly}
      />
    </BlockComparisonField>
  );
};

const ReservoirHeadField = ({
  reservoir,
  patterns,
  onPropertyChange,
  units,
  readOnly = false,
}: {
  reservoir: Reservoir;
  patterns: Patterns;
  onPropertyChange: OnPropertyChange;
  units: UnitsSpec;
  readOnly?: boolean;
}) => {
  const showPatternsLibrary = useShowPatternsLibrary();
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();
  const allowsNullValues = useFeatureFlag("FLAG_NULL_VALUES");
  const { getComparison, getPatternComparison } = useAssetComparison(reservoir);

  const averageHead = useMemo(
    () => calculateAverageHead(reservoir, patterns),
    [reservoir, patterns],
  );

  const handleHeadPatternChange = useCallback(
    (_: string, newValue: number | null, oldValue: number | null) => {
      if (newValue === oldValue) return;
      const patternId = newValue === null ? undefined : newValue;
      if (!patternId && !oldValue) return;
      onPropertyChange("headPatternId", patternId, reservoir.headPatternId);
    },
    [onPropertyChange, reservoir.headPatternId],
  );

  const headComparison = getComparison("head", reservoir.head);
  const patternComparison = getPatternComparison(
    "headPatternId",
    reservoir.headPatternId,
    patterns,
  );
  const hasChanged = headComparison.hasChanged || patternComparison.hasChanged;

  const headUnit = units.head;

  const baseDisplayValue = useMemo(() => {
    if (!hasChanged) return undefined;

    const baseHead = headComparison.hasChanged
      ? (headComparison.baseValue as number | null)
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

    const unitLabel = translateUnit(headUnit);
    const noneLabel = translate("none");
    // A null base head is shown as "None" rather than coerced to a number.
    const formattedAvgHead =
      baseHead != null ? localizeDecimal(baseHead * avgMultiplier) : noneLabel;
    const formattedHead =
      baseHead != null ? localizeDecimal(baseHead) : noneLabel;

    const basePattern = patternComparison.baseValue;
    const multipliersDiffer =
      patternComparison.hasChanged &&
      basePattern != null &&
      basePattern.id === reservoir.headPatternId;

    return (
      <div className="whitespace-pre-line">
        {`${translate("headAverage")} (${unitLabel}): ${formattedAvgHead}`}
        {headComparison.hasChanged &&
          `\n${translate("head")} (${unitLabel}): ${formattedHead}`}
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
          onChange={onPropertyChange}
          readOnly={readOnly}
          isNullable={allowsNullValues}
        />

        <LibrarySelectRow
          name="headPattern"
          collection={patterns}
          filterByType="reservoirHead"
          libraryLabel={translate("openPatternsLibrary")}
          onOpenLibrary={() =>
            showPatternsLibrary({
              source: "reservoir",
              initialPatternId: reservoir.headPatternId,
              initialSection: "reservoirHead",
            })
          }
          selected={selectedPatternId}
          emptyOptionLabel={translate("constant")}
          onChange={handleHeadPatternChange}
          readOnly={readOnly}
        />
        {!!selectedPatternId && (
          <QuantityRow
            name="headAverage"
            value={averageHead}
            unit={headUnit}
            readOnly={true}
          />
        )}
      </div>
    </BlockComparisonField>
  );
};

const HeadlossCurveField = ({
  valve,
  curves,
  getCurveComparison,
  onChange,
  readOnly = false,
}: {
  valve: Valve;
  curves: Curves;
  getCurveComparison: (
    propertyName: string,
    currentCurveId: CurveId | undefined,
    currentCurves: Curves,
  ) => PropertyComparison<ICurve>;
  onChange: OnPropertyChange;
  readOnly?: boolean;
}) => {
  const translate = useTranslate();
  const showCurveLibrary = useShowCurveLibrary();

  const curveComparison = getCurveComparison("curveId", valve.curveId, curves);

  const baseDisplayValue = useMemo(() => {
    if (!curveComparison.hasChanged) return undefined;
    const baseCurve = curveComparison.baseValue;
    const curveName = translate("headlossCurve");
    const lines: string[] = [];

    if (baseCurve) {
      lines.push(`${curveName}: ${baseCurve.label}`);
      if (baseCurve.id === valve.curveId) {
        lines.push(translate("curvePointsDiffer"));
      }
    } else {
      lines.push(`${curveName}: (${translate("none").toLocaleLowerCase()})`);
    }

    return <div className="whitespace-pre-line">{lines.join("\n")}</div>;
  }, [curveComparison, valve.curveId, translate]);

  const selectedCurveId = useMemo(() => {
    if (!valve.curveId) return null;
    const curve = curves.get(valve.curveId);
    if (!curve || curve.type !== "headloss") return null;
    return valve.curveId;
  }, [valve.curveId, curves]);

  const handleOnChange = useCallback(
    (_name: string, newValue: CurveId | null, oldValue: CurveId | null) => {
      if (newValue === null) return;
      onChange("curveId", newValue, oldValue || undefined);
    },
    [onChange],
  );

  return (
    <BlockComparisonField
      hasChanged={curveComparison.hasChanged}
      baseDisplayValue={baseDisplayValue}
    >
      <LibrarySelectRow
        name="headlossCurve"
        collection={curves}
        filterByType="headloss"
        libraryLabel={translate("openCurvesLibrary")}
        onOpenLibrary={() =>
          showCurveLibrary({
            source: "valve",
            curveId: valve.curveId,
            initialSection: "headloss",
          })
        }
        selected={selectedCurveId}
        onChange={handleOnChange}
        readOnly={readOnly}
      />
    </BlockComparisonField>
  );
};

const ValveCurveField = ({
  valve,
  curves,
  getCurveComparison,
  onChange,
  readOnly = false,
}: {
  valve: Valve;
  curves: Curves;
  getCurveComparison: (
    propertyName: string,
    currentCurveId: CurveId | undefined,
    currentCurves: Curves,
  ) => PropertyComparison<ICurve>;
  onChange: OnPropertyChange;
  readOnly?: boolean;
}) => {
  const translate = useTranslate();
  const showCurveLibrary = useShowCurveLibrary();

  const curveComparison = getCurveComparison("curveId", valve.curveId, curves);

  const baseDisplayValue = useMemo(() => {
    if (!curveComparison.hasChanged) return undefined;
    const baseCurve = curveComparison.baseValue;
    const curveName = translate("valveCurve");
    const lines: string[] = [];

    if (baseCurve) {
      lines.push(`${curveName}: ${baseCurve.label}`);
      if (baseCurve.id === valve.curveId) {
        lines.push(translate("curvePointsDiffer"));
      }
    } else {
      lines.push(`${curveName}: (${translate("none").toLocaleLowerCase()})`);
    }

    return <div className="whitespace-pre-line">{lines.join("\n")}</div>;
  }, [curveComparison, valve.curveId, translate]);

  const selectedCurveId = useMemo(() => {
    if (!valve.curveId) return null;
    const curve = curves.get(valve.curveId);
    if (!curve || curve.type !== "valve") return null;
    return valve.curveId;
  }, [valve.curveId, curves]);

  const handleOnChange = useCallback(
    (_name: string, newValue: CurveId | null, oldValue: CurveId | null) => {
      onChange(
        "curveId",
        newValue === null ? undefined : newValue,
        oldValue || undefined,
      );
    },
    [onChange],
  );

  return (
    <BlockComparisonField
      hasChanged={curveComparison.hasChanged}
      baseDisplayValue={baseDisplayValue}
    >
      <LibrarySelectRow
        name="valveCurve"
        collection={curves}
        filterByType="valve"
        libraryLabel={translate("openCurvesLibrary")}
        onOpenLibrary={() =>
          showCurveLibrary({
            source: "valve",
            curveId: valve.curveId,
            initialSection: "valve",
          })
        }
        selected={selectedCurveId}
        emptyOptionLabel={translate("none")}
        onChange={handleOnChange}
        readOnly={readOnly}
      />
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
