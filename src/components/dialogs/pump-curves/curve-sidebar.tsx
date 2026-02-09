import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import * as DD from "@radix-ui/react-dropdown-menu";
import { useTranslate } from "src/hooks/use-translate";
import {
  Curves,
  ICurve,
  CurveId,
  CurvePoint,
  defaultCurvePoints,
} from "src/hydraulic-model/curves";
import {
  AddIcon,
  CloseIcon,
  DuplicateIcon,
  MoreActionsIcon,
  RenameIcon,
} from "src/icons";
import { Button, DDContent, StyledItem } from "src/components/elements";
import { EditableTextFieldWithConfirmation } from "src/components/form/editable-text-field-with-confirmation";
import { LabelManager } from "src/hydraulic-model/label-manager";

type ActionState =
  | { action: "creating" }
  | { action: "renaming"; curveId: CurveId }
  | { action: "cloning"; sourceCurve: ICurve };

type CurveSidebarProps = {
  curves: Curves;
  selectedCurveId: CurveId | null;
  labelManager: LabelManager;
  onSelectCurve: (curveId: CurveId) => void;
  onAddCurve: (
    label: string,
    points: CurvePoint[],
    source: "new" | "clone",
  ) => CurveId;
  onChangeCurve: (curveId: CurveId, updates: { label: string }) => void;
  onDeleteCurve: (curveId: CurveId) => void;
  readOnly?: boolean;
};

export const CurveSidebar = ({
  curves,
  selectedCurveId,
  labelManager,
  onSelectCurve,
  onAddCurve,
  onChangeCurve,
  onDeleteCurve,
  readOnly = false,
}: CurveSidebarProps) => {
  const translate = useTranslate();
  // const userTracking = useUserTracking();
  const listRef = useRef<HTMLUListElement>(null);
  const [actionState, setActionState] = useState<ActionState | undefined>(
    undefined,
  );

  const clearActionState = () => setActionState(undefined);

  const isCreating = actionState?.action === "creating";
  const curveIds = useMemo(() => Array.from(curves.keys()), [curves]);

  useEffect(
    function autoScrollToSelectedItem() {
      if (!selectedCurveId) return;
      const item = listRef.current?.querySelector(
        `[data-curve-id="${selectedCurveId}"]`,
      );
      item?.scrollIntoView({ block: "nearest" });
    },
    [selectedCurveId, curves],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLUListElement>) => {
      const validKeys = [
        "ArrowUp",
        "ArrowDown",
        "PageUp",
        "PageDown",
        "Home",
        "End",
      ];
      if (!validKeys.includes(e.key)) return;
      if (curveIds.length === 0) return;

      e.preventDefault();
      e.stopPropagation();

      if (actionState) return;

      const selectedIndex = selectedCurveId
        ? curveIds.indexOf(selectedCurveId)
        : -1;

      const itemHeight = 32;
      const containerHeight = listRef.current?.clientHeight ?? itemHeight;
      const pageSize = Math.max(1, Math.floor(containerHeight / itemHeight));

      let nextIndex: number;
      switch (e.key) {
        case "ArrowDown":
          nextIndex =
            selectedIndex < curveIds.length - 1 ? selectedIndex + 1 : 0;
          break;
        case "ArrowUp":
          nextIndex =
            selectedIndex > 0 ? selectedIndex - 1 : curveIds.length - 1;
          break;
        case "PageDown":
          nextIndex = Math.min(selectedIndex + pageSize, curveIds.length - 1);
          break;
        case "PageUp":
          nextIndex = Math.max(selectedIndex - pageSize, 0);
          break;
        case "Home":
          nextIndex = 0;
          break;
        case "End":
          nextIndex = curveIds.length - 1;
          break;
        default:
          return;
      }

      const nextCurveId = curveIds[nextIndex];
      onSelectCurve(nextCurveId);

      const item = listRef.current?.querySelector(
        `[data-curve-id="${nextCurveId}"]`,
      );
      item?.scrollIntoView({ block: "nearest" });
    },
    [actionState, curveIds, selectedCurveId, onSelectCurve],
  );

  const handleCurveLabelChange = (name: string): boolean => {
    if (!actionState) return true;

    const trimmedName = name.trim();
    if (!trimmedName) return true;

    const excludeId =
      actionState.action === "renaming" ? actionState.curveId : undefined;
    if (!labelManager.isLabelAvailable(trimmedName, "curve", excludeId)) {
      // userTracking.capture({ name: "pumpCurve.labelDuplicate" });
      return true;
    }

    if (actionState.action === "renaming") {
      onChangeCurve(actionState.curveId, { label: trimmedName });
    } else {
      const isCloning = actionState.action === "cloning";
      const points = isCloning
        ? actionState.sourceCurve.points.map((p) => ({ ...p }))
        : defaultCurvePoints();
      const source = isCloning ? "clone" : "new";
      const newId = onAddCurve(trimmedName, points, source);
      onSelectCurve(newId);
    }

    clearActionState();
    return false;
  };

  return (
    <div className="w-56 flex-shrink-0 flex flex-col gap-2">
      <ul
        ref={listRef}
        className="flex-1 overflow-y-auto gap-2 outline-none placemark-scrollbar scroll-shadows border border-gray-200 dark:border-gray-700 rounded"
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        {[...curves.values()].map((curve) => (
          <CurveSidebarItem
            key={curve.id}
            curve={curve}
            isSelected={curve.id === selectedCurveId}
            onSelect={() => onSelectCurve(curve.id)}
            actionState={actionState}
            onCancel={clearActionState}
            onStartRename={() =>
              setActionState({ action: "renaming", curveId: curve.id })
            }
            onStartClone={() =>
              setActionState({
                action: "cloning",
                sourceCurve: curve,
              })
            }
            onDelete={() => onDeleteCurve(curve.id)}
            onCurveLabelChange={handleCurveLabelChange}
            readOnly={readOnly}
          />
        ))}
        {isCreating && (
          <CurveLabelInput
            label="New curve name"
            value=""
            placeholder={translate("curveName")}
            onCommit={handleCurveLabelChange}
            onCancel={clearActionState}
          />
        )}
      </ul>
      {!readOnly && (
        <Button
          variant="default"
          size="sm"
          className="w-full justify-center"
          onClick={() => setActionState({ action: "creating" })}
        >
          <AddIcon size="sm" />
          {translate("addCurve")}
        </Button>
      )}
    </div>
  );
};

type CurveSidebarItemProps = {
  curve: ICurve;
  isSelected: boolean;
  onSelect: () => void;
  actionState: ActionState | undefined;
  onCancel: () => void;
  onStartRename: (curveId: CurveId) => void;
  onStartClone: (curve: ICurve) => void;
  onDelete: () => void;
  onCurveLabelChange: (name: string) => boolean;
  readOnly?: boolean;
};

const CurveSidebarItem = ({
  curve,
  isSelected,
  onSelect,
  actionState,
  onCancel,
  onStartRename,
  onStartClone,
  onDelete,
  onCurveLabelChange,
  readOnly = false,
}: CurveSidebarItemProps) => {
  const translate = useTranslate();

  const isRenaming =
    actionState?.action === "renaming" && actionState.curveId === curve.id;
  const isCloning =
    actionState?.action === "cloning" &&
    actionState.sourceCurve.id === curve.id;

  if (isRenaming) {
    return (
      <CurveLabelInput
        label="Rename curve"
        value={curve.label}
        onCommit={onCurveLabelChange}
        onCancel={onCancel}
      />
    );
  }

  return (
    <>
      <li
        data-curve-id={curve.id}
        className={`group flex items-center justify-between text-sm cursor-pointer h-8 ${
          isSelected
            ? "bg-gray-200 dark:hover:bg-gray-700"
            : "hover:bg-gray-100 dark:hover:bg-gray-800"
        }`}
      >
        <Button
          variant="quiet/list"
          size="sm"
          onClick={onSelect}
          className="flex-1 justify-start truncate hover:bg-transparent dark:hover:bg-transparent focus-visible:!ring-0 focus-visible:!ring-offset-0"
        >
          {curve.label}
        </Button>
        {!readOnly && (
          <CurveActionsMenu
            isSelected={isSelected}
            onOpen={onSelect}
            onRename={() => onStartRename(curve.id)}
            onDuplicate={() => onStartClone(curve)}
            onDelete={onDelete}
          />
        )}
      </li>
      {isCloning && (
        <CurveLabelInput
          label="Clone curve name"
          value={curve.label}
          placeholder={translate("curveName")}
          onCommit={onCurveLabelChange}
          onCancel={onCancel}
          forceValidation
        />
      )}
    </>
  );
};

type CurveLabelInputProps = {
  label: string;
  value: string;
  placeholder?: string;
  onCommit: (name: string) => boolean;
  onCancel: () => void;
  forceValidation?: boolean;
};

const CurveLabelInput = ({
  label,
  value,
  placeholder,
  onCommit,
  onCancel,
  forceValidation,
}: CurveLabelInputProps) => {
  const [hasError, setHasError] = useState(false);

  const handleChangeValue = (newValue: string): boolean => {
    const hasValidationError = onCommit(newValue);
    setHasError(hasValidationError);
    return hasValidationError;
  };

  return (
    <li
      className="flex items-center text-sm bg-white dark:bg-gray-700 px-1 h-8"
      data-capture-escape-key
    >
      <EditableTextFieldWithConfirmation
        label={label}
        value={value}
        onChangeValue={handleChangeValue}
        onReset={onCancel}
        hasError={hasError}
        allowedChars={/(?![\s;])[\x00-\xFF]/}
        maxByteLength={31}
        styleOptions={{
          padding: "sm",
          textSize: "sm",
        }}
        placeholder={placeholder}
        autoFocus
        forceValidation={forceValidation}
      />
    </li>
  );
};

type CurveActionsMenuProps = {
  isSelected: boolean;
  onOpen: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

const CurveActionsMenu = ({
  isSelected,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
}: CurveActionsMenuProps) => {
  const translate = useTranslate();

  const handleOpenChange = (open: boolean) => {
    if (open) onOpen();
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="self-stretch flex pr-1"
    >
      <DD.Root modal={false} onOpenChange={handleOpenChange}>
        <DD.Trigger asChild>
          <Button
            variant="quiet"
            size="xs"
            aria-label="Actions"
            className={`h-6 w-6 self-center ${
              isSelected
                ? "hover:bg-white/30 dark:hover:bg-white/10"
                : "invisible group-hover:visible hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            <MoreActionsIcon size="sm" />
          </Button>
        </DD.Trigger>
        <DD.Portal>
          <DDContent align="start" side="bottom" className="z-50">
            <StyledItem onSelect={onRename}>
              <RenameIcon size="sm" />
              {translate("rename")}
            </StyledItem>
            <StyledItem onSelect={onDuplicate}>
              <DuplicateIcon size="sm" />
              {translate("duplicate")}
            </StyledItem>
            <StyledItem variant="destructive" onSelect={onDelete}>
              <CloseIcon size="sm" />
              {translate("delete")}
            </StyledItem>
          </DDContent>
        </DD.Portal>
      </DD.Root>
    </div>
  );
};
