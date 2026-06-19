import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import {
  CustomerPointAllocationRule,
  initializeCustomerPoints,
} from "@epanet-js/hydraulic-model";
import { Selector, SelectorListOption } from "@epanet-js/ui-kit";

import { AllocationRulesTable } from "./allocation-rules-table";
import { AllocateCustomerPointsState } from "./wizard-state";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";

import { allocateCustomerPoints } from "src/lib/customer-points";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { TranslateFn, useTranslate } from "src/hooks/use-translate";
import { SuccessIcon, WarningIcon } from "src/icons";
import { Button } from "src/components/elements";
import { Checkbox } from "src/components/form/Checkbox";
import { useUserTracking } from "src/infra/user-tracking";
import { zonesAtom } from "src/state/zones";
import { selectionAtom } from "src/state/selection";
import { USelection } from "src/selection";
import { allocationRulesAtom } from "src/state/allocation-rules";

type AllocateCustomerPointsDialogProps = {
  state: AllocateCustomerPointsState;
};

export const AllocationDialog: React.FC<AllocateCustomerPointsDialogProps> = ({
  state,
}) => {
  const translate = useTranslate();
  const userTracking = useUserTracking();
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const zones = useAtomValue(zonesAtom);
  const selection = useAtomValue(selectionAtom);
  const saveAllocationRules = useSetAtom(allocationRulesAtom);

  const {
    allocationRules,
    setAllocationRules,
    tempRules,
    setTempRules,
    isEditingRules,
    setIsEditingRules,
    lastAllocatedRules,
    setLastAllocatedRules,
    allocationResult,
    setAllocationResult,
    isAllocating,
    setIsAllocating,
    error,
    setError,
    allocationZone,
    setAllocationZone,
    customerAllocationMode,
    setCustomerAllocationMode,
    pipeAllocationMode,
    setPipeAllocationMode,
  } = state;

  const selectedPipes = useMemo(() => {
    if (pipeAllocationMode !== "selectedPipes") return undefined;
    const pipeIds = USelection.getAssetIds(selection).filter(
      (id) => hydraulicModel.assets.get(id)?.type === "pipe",
    );
    return new Set(pipeIds);
  }, [pipeAllocationMode, selection, hydraulicModel.assets]);

  const hasSelectedPipes = useMemo(
    () =>
      USelection.getAssetIds(selection).some(
        (id) => hydraulicModel.assets.get(id)?.type === "pipe",
      ),
    [selection, hydraulicModel.assets],
  );

  const zoneOptions = useMemo<SelectorListOption<string>[]>(
    () =>
      Array.from(zones.values())
        .sort((a, b) => a.label.localeCompare(b.label))
        .map((zone) => ({
          label: zone.label,
          value: String(zone.id),
        })),
    [zones],
  );

  const handleZoneChange = useCallback(
    (value: string | null) => {
      const zoneId = value != null ? Number(value) : null;
      if (zoneId === null) {
        setCustomerAllocationMode("allCustomers");
        setAllocationZone(null);
      } else {
        setCustomerAllocationMode("zoneCustomers");
        setAllocationZone(zoneId);
      }
      const mode = zoneId === null ? "allCustomers" : "zoneCustomers";
      userTracking.capture({
        name: "allocateCustomerPoints.customerMode",
        mode,
      });
      if (zoneId !== null) {
        userTracking.capture({
          name: "allocateCustomerPoints.zoneSelected",
        });
      }
    },
    [setCustomerAllocationMode, setAllocationZone, userTracking],
  );

  const handlePipeModeChange = useCallback(
    (checked: boolean) => {
      const mode = checked ? "selectedPipes" : "allPipes";
      setPipeAllocationMode(mode);
      userTracking.capture({
        name: "allocateCustomerPoints.pipeMode",
        mode,
      });
    },
    [setPipeAllocationMode, userTracking],
  );

  const disconnectedCustomerPoints = Array.from(
    hydraulicModel.customerPoints.values(),
  ).filter((cp) => !cp.connection);

  const forceLoadingState = () =>
    new Promise((resolve) => setTimeout(resolve, 10));

  const performAllocation = useCallback(
    async (rules: CustomerPointAllocationRule[]) => {
      if (!disconnectedCustomerPoints.length || rules.length === 0) {
        setAllocationResult(null);
        return;
      }

      setIsAllocating(true);
      setError(null);

      await forceLoadingState();

      try {
        const runOnWorker = true;
        const customerPoints = initializeCustomerPoints();
        const selectedZone = allocationZone
          ? zones.get(allocationZone)
          : undefined;
        disconnectedCustomerPoints.forEach((point) => {
          customerPoints.set(point.id, point);
        });

        const result = await allocateCustomerPoints(hydraulicModel, {
          allocationRules: rules,
          customerPoints,
          options: { runOnWorker, selectedZone, selectedPipes },
        });

        setAllocationResult(result);
        setLastAllocatedRules([...rules]);
      } catch (err) {
        setError(
          translate(
            "allocateCustomerPoints.dialog.allocationFailed",
            (err as Error).message,
          ),
        );
      } finally {
        setIsAllocating(false);
      }
    },
    [
      allocationZone,
      disconnectedCustomerPoints,
      hydraulicModel,
      selectedPipes,
      setAllocationResult,
      setError,
      setIsAllocating,
      setLastAllocatedRules,
      translate,
      zones,
    ],
  );

  const shouldTriggerAllocation = useCallback(
    (rules: CustomerPointAllocationRule[]) => {
      if (!disconnectedCustomerPoints.length) return false;
      if (isAllocating) return false;
      if (!lastAllocatedRules) return true;
      if (rules.length !== lastAllocatedRules.length) return true;

      return rules.some((rule, index) => {
        const lastRule = lastAllocatedRules[index];
        return (
          rule.maxDistance !== lastRule.maxDistance ||
          rule.maxDiameter !== lastRule.maxDiameter
        );
      });
    },
    [disconnectedCustomerPoints, isAllocating, lastAllocatedRules],
  );

  const handleEdit = useCallback(() => {
    userTracking.capture({
      name: "importCustomerPoints.allocationRules.editStarted",
      rulesCount: allocationRules.length,
    });

    setTempRules([...allocationRules]);
    setIsEditingRules(true);
  }, [allocationRules, setIsEditingRules, setTempRules, userTracking]);

  const handleSave = useCallback(() => {
    userTracking.capture({
      name: "importCustomerPoints.allocationRules.saved",
      rulesCount: tempRules.length,
      allocatedCount: allocationResult?.allocatedCustomerPoints.size || 0,
      disconnectedCount: allocationResult?.disconnectedCustomerPoints.size || 0,
    });

    setAllocationRules(tempRules);
    saveAllocationRules(tempRules);
    setIsEditingRules(false);
    setTempRules([]);

    if (shouldTriggerAllocation(tempRules)) {
      void performAllocation(tempRules);
    }
  }, [
    userTracking,
    tempRules,
    allocationResult?.allocatedCustomerPoints.size,
    allocationResult?.disconnectedCustomerPoints.size,
    setAllocationRules,
    saveAllocationRules,
    setIsEditingRules,
    setTempRules,
    shouldTriggerAllocation,
    performAllocation,
  ]);

  const handleCancel = useCallback(() => {
    userTracking.capture({
      name: "importCustomerPoints.allocationRules.editCanceled",
    });

    setTempRules([]);
    setIsEditingRules(false);
  }, [setIsEditingRules, setTempRules, userTracking]);

  const handleRulesChange = useCallback(
    (newRules: CustomerPointAllocationRule[]) => {
      setTempRules(newRules);
    },
    [setTempRules],
  );

  const initialized = useRef<boolean>(false);
  useEffect(() => {
    if (initialized.current) return;
    if (allocationRules.length === 0) return;

    initialized.current = true;
    void performAllocation(allocationRules);
  }, [performAllocation, allocationRules]);

  const prevScopeRef = useRef({ allocationZone, pipeAllocationMode });
  useEffect(() => {
    const prev = prevScopeRef.current;
    prevScopeRef.current = { allocationZone, pipeAllocationMode };

    if (!initialized.current) return;
    if (
      prev.allocationZone === allocationZone &&
      prev.pipeAllocationMode === pipeAllocationMode
    )
      return;
    if (allocationRules.length === 0) return;

    void performAllocation(allocationRules);
  }, [allocationZone, pipeAllocationMode, allocationRules, performAllocation]);

  const displayRules = isEditingRules ? tempRules : allocationRules;
  const allocationCounts = allocationResult?.ruleMatches || [];
  const totalCustomerPoints = disconnectedCustomerPoints.length;
  const totalAllocated = allocationCounts.reduce(
    (total, count) => total + count,
    0,
  );
  const unallocatedCount = Math.max(0, totalCustomerPoints - totalAllocated);

  return (
    <div className="p-4 overflow-y-auto grow space-y-4">
      <AllocationScope
        zoneOptions={zoneOptions}
        selectedZoneValue={
          allocationZone != null ? String(allocationZone) : null
        }
        pipeAllocationMode={pipeAllocationMode}
        hasSelectedPipes={hasSelectedPipes}
        onZoneChange={handleZoneChange}
        onPipeModeChange={handlePipeModeChange}
        translate={translate}
      />

      {error && <ErrorMessage error={error} />}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-md font-medium">
            {translate("allocateCustomerPoints.dialog.rulesHeading")}
          </h3>
          {!isEditingRules ? (
            <EditRulesButton
              onClick={handleEdit}
              disabled={isAllocating}
              translate={translate}
            />
          ) : (
            <RulesEditorButtons
              onSave={handleSave}
              onCancel={handleCancel}
              translate={translate}
            />
          )}
        </div>

        <AllocationRulesTable
          rules={displayRules}
          allocationCounts={allocationCounts}
          isEditing={isEditingRules}
          isAllocating={isAllocating}
          onChange={handleRulesChange}
        />

        <AllocationSummary
          totalAllocated={totalAllocated}
          unallocatedCount={unallocatedCount}
          isVisible={
            !isEditingRules && allocationRules.length > 0 && !isAllocating
          }
          totalCustomerPoints={totalCustomerPoints}
          zoneName={
            customerAllocationMode === "zoneCustomers" && allocationZone
              ? zones.get(allocationZone)?.label
              : undefined
          }
          customerPointsInZone={allocationResult?.customerPointsMatchedToZone}
        />
      </div>

      {isAllocating && <IsComputingMessage translate={translate} />}
    </div>
  );
};

type AllocationScopeProps = {
  zoneOptions: SelectorListOption<string>[];
  selectedZoneValue: string | null;
  pipeAllocationMode: "allPipes" | "selectedPipes";
  hasSelectedPipes: boolean;
  onZoneChange: (value: string | null) => void;
  onPipeModeChange: (checked: boolean) => void;
  translate: TranslateFn;
};

const AllocationScope: React.FC<AllocationScopeProps> = ({
  zoneOptions,
  selectedZoneValue,
  pipeAllocationMode,
  hasSelectedPipes,
  onZoneChange,
  onPipeModeChange,
  translate,
}) => (
  <div className="mt-3">
    <h3 className="text-md font-medium pb-3">
      {translate("allocateCustomerPoints.dialog.scopeHeading")}
    </h3>
    <div className="flex gap-4 items-center">
      <label className="text-size-base text-subtle">
        {translate("allocateCustomerPoints.dialog.allocationZone")}
      </label>
      <div className="min-w-0" style={{ width: 200 }}>
        <Selector
          options={zoneOptions}
          selected={selectedZoneValue}
          nullable
          placeholder={translate("allocateCustomerPoints.dialog.allZones")}
          clearLabel={translate("allocateCustomerPoints.dialog.allZones")}
          onChange={onZoneChange}
          styleOptions={{ border: true }}
        />
      </div>
      <label className="flex items-center gap-2 text-size-base text-default">
        <Checkbox
          checked={pipeAllocationMode === "selectedPipes"}
          disabled={!hasSelectedPipes}
          onChange={(e) => onPipeModeChange(e.target.checked)}
        />
        {translate("allocateCustomerPoints.dialog.selectedPipesOnly")}
      </label>
    </div>
  </div>
);

const ErrorMessage = ({ error }: { error: string }) => (
  <div className="bg-error-subtle border border-red-200 rounded-md p-3">
    <p className="text-red-700 text-size-base">{error}</p>
  </div>
);

const EditRulesButton = ({
  disabled,
  onClick,
  translate,
}: {
  disabled: boolean;
  onClick: () => void;
  translate: TranslateFn;
}) => (
  <Button
    type="button"
    onClick={onClick}
    disabled={disabled}
    variant="default"
    size="sm"
  >
    {translate("allocateCustomerPoints.dialog.editButton")}
  </Button>
);

const RulesEditorButtons = ({
  onSave,
  onCancel,
  translate,
}: {
  onSave: () => void;
  onCancel: () => void;
  translate: TranslateFn;
}) => (
  <div className="flex items-center space-x-2">
    <Button type="button" onClick={onSave} variant="primary" size="sm">
      {translate("allocateCustomerPoints.dialog.saveButton")}
    </Button>
    <Button type="button" onClick={onCancel} variant="default" size="sm">
      {translate("allocateCustomerPoints.dialog.cancelButton")}
    </Button>
  </div>
);

const IsComputingMessage = ({ translate }: { translate: TranslateFn }) => (
  <div className="flex items-center justify-center py-4">
    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent"></div>
    <span className="ml-2 text-size-base text-subtle">
      {translate("allocateCustomerPoints.dialog.computingMessage")}
    </span>
  </div>
);

type AllocationSummaryProps = {
  totalAllocated: number;
  unallocatedCount: number;
  isVisible: boolean;
  totalCustomerPoints: number;
  zoneName?: string;
  customerPointsInZone?: number;
};

const percentage = (numerator: number, denominator: number) =>
  denominator > 0 ? Math.round((numerator / denominator) * 10000) / 100 : 0;

const AllocationSummary: React.FC<AllocationSummaryProps> = ({
  totalAllocated,
  unallocatedCount,
  isVisible,
  totalCustomerPoints,
  zoneName,
  customerPointsInZone,
}) => {
  const translate = useTranslate();

  if (!isVisible) {
    return null;
  }

  const isInZoneAllocationMode =
    zoneName != null && customerPointsInZone != null;

  if (isInZoneAllocationMode) {
    const zoneUnallocated = Math.max(0, customerPointsInZone - totalAllocated);
    const networkUnallocated = Math.max(
      0,
      totalCustomerPoints - totalAllocated,
    );

    return (
      <>
        <h3 className="text-md font-medium">
          {translate("allocateCustomerPoints.dialog.summaryHeading")}
        </h3>
        <div className="bg-panel border rounded-lg p-4 space-y-4">
          <div>
            <h4 className="text-size-base font-medium text-default mb-2">
              {translate(
                "allocateCustomerPoints.dialog.zoneCoverage",
                zoneName,
              )}
            </h4>
            <div className="space-y-2">
              <div className="flex items-center">
                <SuccessIcon className="text-success mr-2" />
                <span className="text-size-base text-default">
                  {translate(
                    "allocateCustomerPoints.dialog.allocatedPoints",
                    localizeDecimal(totalAllocated),
                    percentage(totalAllocated, customerPointsInZone).toString(),
                  )}
                </span>
              </div>
              {zoneUnallocated > 0 && (
                <div className="flex items-center">
                  <WarningIcon className="text-warning mr-2" />
                  <span className="text-size-base text-orange-700">
                    {translate(
                      "allocateCustomerPoints.dialog.unallocatedPoints",
                      localizeDecimal(zoneUnallocated),
                      percentage(
                        zoneUnallocated,
                        customerPointsInZone,
                      ).toString(),
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div>
            <h4 className="text-size-base font-medium text-default mb-2">
              {translate("allocateCustomerPoints.dialog.networkCoverage")}
            </h4>
            <div className="flex items-center">
              <span className="text-size-base text-default">
                {translate(
                  "allocateCustomerPoints.dialog.unallocatedPoints",
                  localizeDecimal(networkUnallocated),
                  percentage(
                    networkUnallocated,
                    totalCustomerPoints,
                  ).toString(),
                )}
              </span>
            </div>
          </div>
        </div>
      </>
    );
  }

  const allocatedPercentage = percentage(totalAllocated, totalCustomerPoints);
  const unallocatedPercentage = percentage(
    unallocatedCount,
    totalCustomerPoints,
  );

  return (
    <>
      <h3 className="text-md font-medium">
        {translate("allocateCustomerPoints.dialog.summaryHeading")}
      </h3>
      <div className="bg-panel border rounded-lg p-4">
        <div className="space-y-2">
          <div className="flex items-center">
            <SuccessIcon className="text-success mr-2" />
            <span className="text-size-base text-default">
              {translate(
                "allocateCustomerPoints.dialog.allocatedPoints",
                localizeDecimal(totalAllocated),
                allocatedPercentage.toString(),
              )}
            </span>
          </div>
          {unallocatedCount > 0 && (
            <div className="flex items-center">
              <WarningIcon className="text-warning mr-2" />
              <span className="text-size-base text-orange-700">
                {translate(
                  "allocateCustomerPoints.dialog.unallocatedPoints",
                  localizeDecimal(unallocatedCount),
                  unallocatedPercentage.toString(),
                )}
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
