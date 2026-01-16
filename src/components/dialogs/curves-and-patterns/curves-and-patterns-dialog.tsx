import { useState } from "react";
import { useAtomValue } from "jotai";
import { DialogContainer, DialogHeader, useDialogState } from "../../dialog";
import { useTranslate } from "src/hooks/use-translate";
import { Button } from "src/components/elements";
import { PatternSidebar } from "./pattern-sidebar";
import { PatternId } from "src/hydraulic-model/demands";
import { PatternsIcon } from "src/icons";
import { dataAtom } from "src/state/jotai";

export const CurvesAndPatternsDialog = () => {
  const translate = useTranslate();
  const { closeDialog } = useDialogState();
  const { hydraulicModel } = useAtomValue(dataAtom);
  const hasPatterns = hydraulicModel.demands.patterns.size > 0;
  const [selectedPatternId, setSelectedPatternId] = useState<PatternId | null>(
    null,
  );

  return (
    <DialogContainer size="lg">
      <DialogHeader title={translate("curvesAndPatterns")} />
      <div className="flex-1 flex min-h-0">
        <PatternSidebar
          selectedPatternId={selectedPatternId}
          onSelectPattern={setSelectedPatternId}
        />
        <div className="flex-1 flex items-center justify-center">
          {selectedPatternId ? (
            <div className="text-gray-500">
              {translate("patternSelected", selectedPatternId)}
            </div>
          ) : hasPatterns ? (
            <NoSelectionState />
          ) : (
            <EmptyState />
          )}
        </div>
      </div>
      <div className="pt-6 flex flex-row-reverse gap-x-3">
        <Button type="button" variant="primary" disabled>
          {translate("save")}
        </Button>
        <Button type="button" onClick={closeDialog}>
          {translate("cancel")}
        </Button>
      </div>
    </DialogContainer>
  );
};

const NoSelectionState = () => {
  const translate = useTranslate();

  return (
    <div className="flex flex-col items-center justify-center px-4">
      <div className="text-gray-400">
        <PatternsIcon size={96} />
      </div>
      <p className="text-sm text-gray-600 text-center max-w-64 py-4">
        {translate("curvesAndPatternsNoSelection")}
      </p>
    </div>
  );
};

const EmptyState = () => {
  const translate = useTranslate();

  return (
    <div className="flex flex-col items-center justify-center px-4">
      <div className="text-gray-400">
        <PatternsIcon size={96} />
      </div>
      <p className="text-sm font-semibold py-4 text-gray-600">
        {translate("curvesAndPatternsEmptyTitle")}
      </p>
      <p className="text-sm text-gray-600 text-center max-w-64">
        {translate("curvesAndPatternsEmptyDescription")}
      </p>
    </div>
  );
};
