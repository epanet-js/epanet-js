import { inpFileInfoAtom } from "src/state/file-system";
import { hasUnsavedChangesDerivedAtom } from "src/state/derived-branch-state";
import { useAtomValue } from "jotai";
import { truncate } from "src/lib/utils";
import { UnsavedChangesIcon, FileIcon } from "src/icons";
import { useTranslate } from "src/hooks/use-translate";

export function FileInfo() {
  const translate = useTranslate();
  const fileInfo = useAtomValue(inpFileInfoAtom);
  const hasUnsavedChanges = useAtomValue(hasUnsavedChangesDerivedAtom);

  if (!fileInfo) return <div></div>;

  return (
    <div className="pl-3 flex-initial hidden sm:flex items-center gap-x-1">
      <FileIcon />
      <div
        className="text-xs font-mono whitespace-nowrap truncate"
        title={fileInfo.name}
      >
        {truncate(fileInfo.name, 50)}{" "}
      </div>
      {hasUnsavedChanges ? <UnsavedChangesIcon /> : ""}
      {fileInfo.isDemoNetwork && (
        <span className="px-2 py-0.5 text-[10px] font-semibold uppercase bg-orange-100 text-orange-700 rounded-full">
          {translate("demoShort")}
        </span>
      )}
    </div>
  );
}
