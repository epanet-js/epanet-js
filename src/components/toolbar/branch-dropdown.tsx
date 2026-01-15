import {
  Button,
  DDContent,
  StyledItem,
  StyledSelectSeparator,
} from "../elements";
import * as DD from "@radix-ui/react-dropdown-menu";
import { AddIcon, ChevronDownIcon } from "src/icons";
import { useLegitFs } from "../legit-fs-provider";
import { useEffect, useState, useCallback } from "react";
import { captureError } from "src/infra/error-tracking";
import { useImportInp } from "src/commands/import-inp";
import { useAtomValue } from "jotai";
import { fileInfoAtom } from "src/state/jotai";
import { useUnsavedChangesCheck } from "src/commands/check-unsaved-changes";

export const BranchDropdown = () => {
  const legitFs = useLegitFs();
  const [branch, setBranch] = useState<string | null>();
  const [branches, setBranches] = useState<string[]>([]);
  const fileInfo = useAtomValue(fileInfoAtom);
  const { reloadFromVersionedFs } = useImportInp();
  const checkUnsavedChanges = useUnsavedChangesCheck();

  const getCurrentBranch = useCallback(async () => {
    if (!legitFs) return;
    try {
      // wait for the branch to be set
      await new Promise((resolve) => setTimeout(resolve, 10));
      const currentBranch = await legitFs.getCurrentBranch();
      setBranch(currentBranch);
    } catch (error) {
      return null;
    }
  }, [legitFs]);

  useEffect(() => {
    if (legitFs) {
      void getCurrentBranch();
    }
  }, [legitFs, getCurrentBranch]);

  const createBranch = async () => {
    if (!legitFs) return;

    const branchName = prompt("Enter branch name:");
    if (!branchName || !branchName.trim()) {
      return;
    }

    const trimmedName = branchName.trim();
    try {
      await legitFs.promises.mkdir(`/.legit/branches/${trimmedName}`);
      await legitFs.setCurrentBranch(trimmedName);
      setBranches([trimmedName]);
      setBranch(trimmedName);
    } catch (error) {
      captureError(error as Error);
    }
  };

  const getBranches = async () => {
    if (!legitFs) return;
    try {
      let branches = await legitFs.promises.readdir(`/.legit/branches`);
      // filter out anonymous branch
      branches = branches.filter((branch) => branch !== "anonymous");
      setBranches(branches);
    } catch (error) {
      captureError(error as Error);
    }
  };

  const switchToBranch = async (branch: string) => {
    if (!legitFs) return;
    try {
      await legitFs.setCurrentBranch(branch);
      await getCurrentBranch();
      // Reload the INP file from the versioned filesystem for the new branch
      if (fileInfo?.name) {
        await reloadFromVersionedFs(fileInfo.name);
      }
    } catch (error) {
      captureError(error as Error);
    }
  };

  const handleCreateBranch = () => {
    checkUnsavedChanges(() => createBranch());
  };

  const handleSwitchToBranch = (branch: string) => {
    checkUnsavedChanges(() => switchToBranch(branch));
  };

  return branches.length > 0 ? (
    <DD.Root onOpenChange={getBranches}>
      <DD.Trigger asChild>
        <Button variant="quiet">
          <span>{branch || "main"}</span> <ChevronDownIcon size="sm" />
        </Button>
      </DD.Trigger>
      <DD.Portal>
        <DDContent align="start" side="bottom">
          <StyledItem onSelect={handleCreateBranch}>
            <AddIcon />
            Create branch
          </StyledItem>
          <StyledSelectSeparator />
          {branches.map((branch) => (
            <StyledItem
              key={branch}
              onSelect={() => handleSwitchToBranch(branch)}
            >
              {branch}
            </StyledItem>
          ))}
        </DDContent>
      </DD.Portal>
    </DD.Root>
  ) : (
    <Button variant="quiet" onClick={handleCreateBranch}>
      <AddIcon />
      <span>Branch</span>
    </Button>
  );
};
