import React, {
  useCallback,
  useState,
  useEffect,
  useRef,
  useMemo,
} from "react";
import { useAtomValue } from "jotai";
import {
  AllocationRule,
  getDefaultAllocationRules,
  initializeCustomerPoints,
  Pipe,
} from "@epanet-js/hydraulic-model";

import { AllocationRulesTable } from "./allocation-rules-table";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";

import { allocateCustomerPoints } from "src/hydraulic-model/model-operations/allocate-customer-points";
import { applyCustomerPointAllocation } from "src/hydraulic-model/model-operations";
import type { AllocationResult } from "src/hydraulic-model/model-operations/allocate-customer-points";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { useTranslate } from "src/hooks/use-translate";
import { useModelTransaction } from "src/hooks/persistence/use-model-transaction";
import { SuccessIcon, WarningIcon } from "src/icons";
import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { projectSettingsAtom } from "src/state/project-settings";
import { selectionAtom } from "src/state/selection";
import { USelection } from "src/selection";

type AllocateCustomerPointsDialogProps = {
  isOpen: boolean;
  onClose: () => void;
};

export const AllocateCustomerPointsDialog: React.FC<
  AllocateCustomerPointsDialogProps
> = ({ isOpen, onClose }) => {
  const translate = useTranslate();
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const { units } = useAtomValue(projectSettingsAtom);
  const selection = useAtomValue(selectionAtom);
  const { transact } = useModelTransaction();

  const selectedPipeIds = useMemo(() => {
    const assetIds = USelection.getAssetIds(selection);
    const pipeIds = new Set<number>();
    for (const id of assetIds) {
      const asset = hydraulicModel.assets.get(id);
      if (asset?.type === "pipe") {
        pipeIds.add(id);
      }
    }
    return pipeIds;
  }, [selection, hydraulicModel.assets]);

  const defaultMaxDistance = useMemo(
    () => getDefaultAllocationRules(units)[0].maxDistance,
    [units],
  );

  const sortedDiameters = useMemo(() => {
    const diameters = new Set<number>();
    for (const id of selectedPipeIds) {
      const asset = hydraulicModel.assets.get(id);
      if (asset instanceof Pipe) {
        diameters.add(asset.diameter);
      }
    }
    return Array.from(diameters).sort((a, b) => a - b);
  }, [selectedPipeIds, hydraulicModel.assets]);

  const [allocationRules, setAllocationRules] = useState<AllocationRule[]>([]);
  const [ignoredDiameters, setIgnoredDiameters] = useState<Set<number>>(
    new Set(),
  );
  const [allocationResult, setAllocationResult] =
    useState<AllocationResult | null>(null);
  const [isAllocating, setIsAllocating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAllocationRules(
      sortedDiameters.map((diameter) => ({
        maxDiameter: diameter,
        maxDistance: defaultMaxDistance,
      })),
    );
  }, [sortedDiameters, defaultMaxDistance]);

  const disconnectedCustomerPoints = Array.from(
    hydraulicModel.customerPoints.values(),
  ).filter((cp) => !cp.connection);

  const forceLoadingState = () =>
    new Promise((resolve) => setTimeout(resolve, 10));

  const handleFinish = useCallback(() => {
    if (!allocationResult) return;

    setIsProcessing(true);

    try {
      const moment = applyCustomerPointAllocation(hydraulicModel, {
        allocationResult,
      });
      transact(moment);
      onClose();
    } catch {
      setError("Allocation failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  }, [allocationResult, hydraulicModel, onClose, transact]);

  const performAllocation = useCallback(
    async (rules: AllocationRule[], ignored: Set<number>) => {
      const activeRules = rules.filter(
        (rule) => !ignored.has(rule.maxDiameter),
      );
      if (!disconnectedCustomerPoints.length || activeRules.length === 0) {
        setAllocationResult(null);
        return;
      }

      setIsAllocating(true);
      setError(null);

      await forceLoadingState();

      try {
        const customerPoints = initializeCustomerPoints();
        disconnectedCustomerPoints.forEach((point) => {
          customerPoints.set(point.id, point);
        });

        const result = await allocateCustomerPoints(hydraulicModel, {
          allocationRules: activeRules,
          customerPoints,
          targetPipes: selectedPipeIds,
        });

        setAllocationResult(result);
      } catch (err) {
        setError(
          translate(
            "importCustomerPoints.wizard.allocationStep.allocationFailed",
            (err as Error).message,
          ),
        );
      } finally {
        setIsAllocating(false);
      }
    },
    [disconnectedCustomerPoints, hydraulicModel, translate, selectedPipeIds],
  );

  const handleDistanceChange = useCallback(
    (index: number, value: number) => {
      const updatedRules = allocationRules.map((rule, i) =>
        i === index ? { ...rule, maxDistance: value } : rule,
      );
      setAllocationRules(updatedRules);
      void performAllocation(updatedRules, ignoredDiameters);
    },
    [allocationRules, ignoredDiameters, performAllocation],
  );

  const handleIgnoreChange = useCallback(
    (diameter: number, ignored: boolean) => {
      const next = new Set(ignoredDiameters);
      if (ignored) {
        next.add(diameter);
      } else {
        next.delete(diameter);
      }
      setIgnoredDiameters(next);
      void performAllocation(allocationRules, next);
    },
    [ignoredDiameters, allocationRules, performAllocation],
  );

  const initialized = useRef<boolean>(false);
  useEffect(() => {
    if (initialized.current) return;
    if (allocationRules.length === 0) return;

    initialized.current = true;
    void performAllocation(allocationRules, ignoredDiameters);
  }, [performAllocation, allocationRules, ignoredDiameters]);

  const noPipesSelected = selectedPipeIds.size === 0;
  const allocationCounts = allocationResult?.ruleMatches || [];
  const totalCustomerPoints = disconnectedCustomerPoints.length;
  const totalAllocated = allocationCounts.reduce(
    (total, count) => total + count,
    0,
  );
  const unallocatedCount = Math.max(0, totalCustomerPoints - totalAllocated);

  const footer = (
    <SimpleDialogActions
      action={
        isProcessing
          ? translate("wizard.processing")
          : translate("importCustomerPoints.wizard.allocationStep.applyChanges")
      }
      onAction={handleFinish}
      onClose={onClose}
      isDisabled={
        isProcessing || !allocationResult || isAllocating || noPipesSelected
      }
      isSubmitting={isProcessing}
    />
  );

  return (
    <BaseDialog
      title={translate("importCustomerPoints.wizard.allocationStep.title")}
      size="lg"
      isOpen={isOpen}
      onClose={onClose}
      footer={footer}
      preventClose={isProcessing}
    >
      <div className="p-4 overflow-y-auto grow space-y-4">
        <div>
          <p className="text-size-base text-subtle">
            {translate(
              "importCustomerPoints.wizard.allocationStep.description",
            )}
          </p>
        </div>

        {noPipesSelected && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <div className="flex items-center">
              <p className="text-size-base text-yellow-800">
                {translate("allocateCustomerPoints.noPipesSelected")}
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-error-subtle border border-red-200 rounded-md p-3">
            <p className="text-red-700 text-size-base">{error}</p>
          </div>
        )}

        {!noPipesSelected && (
          <div className="space-y-4">
            <h3 className="text-md font-medium">
              {translate(
                "importCustomerPoints.wizard.allocationStep.rulesTitle",
              )}
            </h3>

            <AllocationRulesTable
              rules={allocationRules}
              allocationCounts={allocationCounts}
              ignoredDiameters={ignoredDiameters}
              isAllocating={isAllocating}
              onDistanceChange={handleDistanceChange}
              onIgnoreChange={handleIgnoreChange}
            />

            <AllocationSummary
              totalAllocated={totalAllocated}
              unallocatedCount={unallocatedCount}
              isVisible={allocationRules.length > 0 && !isAllocating}
              totalCustomerPoints={totalCustomerPoints}
            />
          </div>
        )}

        {isAllocating && !noPipesSelected && (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent"></div>
            <span className="ml-2 text-size-base text-subtle">
              {translate(
                "importCustomerPoints.wizard.allocationStep.computingMessage",
              )}
            </span>
          </div>
        )}
      </div>
    </BaseDialog>
  );
};

type AllocationSummaryProps = {
  totalAllocated: number;
  unallocatedCount: number;
  isVisible: boolean;
  totalCustomerPoints: number;
};

const AllocationSummary: React.FC<AllocationSummaryProps> = ({
  totalAllocated,
  unallocatedCount,
  isVisible,
  totalCustomerPoints,
}) => {
  const translate = useTranslate();

  if (!isVisible) {
    return null;
  }

  const allocatedPercentage =
    totalCustomerPoints > 0
      ? Math.round((totalAllocated / totalCustomerPoints) * 10000) / 100
      : 0;
  const unallocatedPercentage =
    totalCustomerPoints > 0
      ? Math.round((unallocatedCount / totalCustomerPoints) * 10000) / 100
      : 0;

  return (
    <div className="bg-panel border rounded-lg p-4">
      <h4 className="text-size-base font-medium text-default mb-2">
        {translate(
          "importCustomerPoints.wizard.allocationStep.summaryTitle",
          localizeDecimal(totalCustomerPoints),
        )}
      </h4>
      <div className="space-y-2">
        <div className="flex items-center">
          <SuccessIcon className="text-success mr-2" />
          <span className="text-size-base text-default">
            {translate(
              "importCustomerPoints.wizard.allocationStep.allocatedPoints",
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
                "importCustomerPoints.wizard.allocationStep.unallocatedPoints",
                localizeDecimal(unallocatedCount),
                unallocatedPercentage.toString(),
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
