import { currentFileNameAtom, isDemoNetworkAtom } from "src/state/file-system";
import { hasUnsavedChangesDerivedAtom } from "src/state/derived-branch-state";
import { projectSettingsAtom } from "src/state/project-settings";
import { useAtomValue } from "jotai";
import { truncate } from "src/lib/utils";
import { UnsavedChangesIcon, FileIcon } from "src/icons";
import { useTranslate } from "src/hooks/use-translate";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export function FileInfo() {
  const translate = useTranslate();
  const isOurFileOn = useFeatureFlag("FLAG_OUR_FILE");
  const fileName = useAtomValue(currentFileNameAtom);
  const projectName = useAtomValue(projectSettingsAtom).name;
  const isDemo = useAtomValue(isDemoNetworkAtom);
  const hasUnsavedChanges = useAtomValue(hasUnsavedChangesDerivedAtom);

  const name = isOurFileOn ? projectName : fileName;

  if (!name) return <div></div>;

  return (
    <div className="pl-3 flex-initial hidden sm:flex items-center gap-x-1">
      <FileIcon />
      <div
        className="text-xs font-mono whitespace-nowrap truncate"
        title={name}
      >
        {truncate(name, 50)}{" "}
      </div>
      {hasUnsavedChanges ? <UnsavedChangesIcon /> : ""}
      {isDemo && (
        <span className="px-2 py-0.5 text-[10px] font-semibold uppercase bg-orange-100 text-orange-700 rounded-full">
          {translate("demoShort")}
        </span>
      )}
    </div>
  );
}
