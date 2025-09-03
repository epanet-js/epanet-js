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

export function FileInfo() {
  const fileInfo = useAtomValue(fileInfoAtom);
  const hasUnsavedChanges = useAtomValue(hasUnsavedChangesAtom);
  const [state] = useAtom(fileInfoMachineAtom);

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
        {hasUnsavedChanges ? <UnsavedChangesIcon /> : ""}
      </div>
      <StyledPopoverContent size="xs">
        <StyledPopoverArrow />
        <div className="text-xs">Saved</div>
      </StyledPopoverContent>
    </Popover.Root>
  );
}
