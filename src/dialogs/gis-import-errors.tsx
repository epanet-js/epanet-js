import { useMemo, useState } from "react";
import { BaseDialog, SimpleDialogActions } from "../components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { Button } from "src/components/elements";
import { ChevronDownIcon, ChevronRightIcon } from "src/icons";

const INITIAL_FILES_SHOWN = 3;

export const GisImportErrorsDialog = ({
  totalCount,
  errors,
  onClose,
}: {
  totalCount: number;
  errors: { fileName: string; error: string }[];
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const [isExpanded, setExpanded] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const { error, fileName } of errors) {
      const files = map.get(error);
      if (files) files.push(fileName);
      else map.set(error, [fileName]);
    }
    return map;
  }, [errors]);

  return (
    <BaseDialog
      title={translate("customLayers.gisImportError")}
      size="md"
      isOpen={true}
      onClose={onClose}
      footer={
        <SimpleDialogActions
          action={translate("understood")}
          onAction={onClose}
          autoFocusSubmit={true}
        />
      }
    >
      <div className="p-4 text-sm">
        <p className="flex items-center gap-x-2 pb-3">
          {translate(
            "customLayers.gisImportSummary",
            String(errors.length),
            String(totalCount),
          )}
        </p>

        <div className="pb-2">
          <Button
            variant="quiet"
            onClick={(e) => {
              e.preventDefault();
              setExpanded(!isExpanded);
            }}
            className="cursor-pointer text-md inline-flex items-center"
          >
            {isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
            {translate("elevations.errorDetails")}
          </Button>
          {isExpanded && (
            <div className="p-2 flex flex-col gap-y-4 ml-3 mt-2 border font-mono rounded-sm text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 max-h-[300px] overflow-y-auto">
              {[...grouped.entries()].map(([error, files]) => (
                <ErrorGroup
                  key={error}
                  error={error}
                  files={files}
                  translate={translate}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </BaseDialog>
  );
};

const ErrorGroup = ({
  error,
  files,
  translate,
}: {
  error: string;
  files: string[];
  translate: ReturnType<typeof useTranslate>;
}) => {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? files : files.slice(0, INITIAL_FILES_SHOWN);
  const remaining = files.length - INITIAL_FILES_SHOWN;

  return (
    <div>
      <p>{translate(`customLayers.error.${error}`)}</p>
      <div className="flex flex-col gap-y-0.5 items-start">
        {visible.map((fileName) => (
          <span key={fileName}>- {fileName}</span>
        ))}
        {!showAll && remaining > 0 && (
          <Button
            variant="quiet"
            className="text-xs text-gray-500 cursor-pointer self-start"
            onClick={(e) => {
              e.preventDefault();
              setShowAll(true);
            }}
          >
            {translate("andXMore", String(remaining))}
          </Button>
        )}
      </div>
    </div>
  );
};
