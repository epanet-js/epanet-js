import { DotFilledIcon, FileIcon } from "@radix-ui/react-icons";
import {
  fileInfoAtom,
  fileInfoMachineAtom,
  hasUnsavedChangesAtom,
} from "src/state/jotai";
import { useAtom, useAtomValue } from "jotai";
import { truncate } from "src/lib/utils";
import * as Popover from "@radix-ui/react-popover";
import { StyledPopoverArrow, StyledPopoverContent } from "./elements";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { Dot, File } from "lucide-react";

export function FileInfo() {
  const fileInfo = useAtomValue(fileInfoAtom);
  const hasUnsavedChanges = useAtomValue(hasUnsavedChangesAtom);
  const [state] = useAtom(fileInfoMachineAtom);
  const isLucideIconsOn = useFeatureFlag("FLAG_LUCIDE_ICONS");

  if (!fileInfo) return <div></div>;

  return (
    <Popover.Root open={state.matches("visible")}>
      <div className="pl-3 flex-initial hidden sm:flex items-center gap-x-1">
        <Popover.Anchor>
          {isLucideIconsOn ? (
            <File size={16} />
          ) : (
            <FileIcon className="w-3 h-3" />
          )}
        </Popover.Anchor>
        <div
          className="text-xs font-mono whitespace-nowrap truncate"
          title={fileInfo.name}
        >
          {truncate(fileInfo.name, 50)}{" "}
        </div>
        {hasUnsavedChanges ? (
          isLucideIconsOn ? (
            <Dot size={16} />
          ) : (
            <DotFilledIcon />
          )
        ) : (
          ""
        )}
      </div>
      <StyledPopoverContent size="xs">
        <StyledPopoverArrow />
        <div className="text-xs">Saved</div>
      </StyledPopoverContent>
    </Popover.Root>
  );
}
