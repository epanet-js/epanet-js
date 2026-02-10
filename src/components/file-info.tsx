import {
  fileInfoAtom,
  fileInfoMachineAtom,
  hasUnsavedChangesAtom,
} from "src/state/jotai";
import { useAtom, useAtomValue } from "jotai";
import { truncate } from "src/lib/utils";
import * as Popover from "@radix-ui/react-popover";
import { StyledPopoverArrow, StyledPopoverContent } from "./elements";
import { UnsavedChangesIcon, FileIcon } from "src/icons";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export function FileInfo() {
  const fileInfo = useAtomValue(fileInfoAtom);
  const hasUnsavedChanges = useAtomValue(hasUnsavedChangesAtom);
  const [state] = useAtom(fileInfoMachineAtom);
  const isDemoTrialOn = useFeatureFlag("FLAG_DEMO_TRIAL");

  if (!fileInfo) return <div></div>;

  return (
    <Popover.Root open={state.matches("visible")}>
      <div className="pl-3 flex-initial hidden sm:flex items-center gap-x-1">
        <Popover.Anchor>
          <FileIcon />
        </Popover.Anchor>
        <div
          className="text-xs font-mono whitespace-nowrap truncate"
          title={fileInfo.name}
        >
          {truncate(fileInfo.name, 50)}{" "}
        </div>
        {isDemoTrialOn && fileInfo.isDemoNetwork && (
          <span className="px-2 py-0.5 text-[10px] font-semibold uppercase bg-orange-100 text-orange-700 rounded-full">
            Demo
          </span>
        )}
        {hasUnsavedChanges ? <UnsavedChangesIcon /> : ""}
      </div>
      <StyledPopoverContent size="xs">
        <StyledPopoverArrow />
        <div className="text-xs">Saved</div>
      </StyledPopoverContent>
    </Popover.Root>
  );
}
