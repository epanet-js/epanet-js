import * as DD from "@radix-ui/react-dropdown-menu";
import { useAtomValue } from "jotai";
import { dataAtom } from "src/state/jotai";
import { useTranslate } from "src/hooks/use-translate";
import { PatternId } from "src/hydraulic-model/demands";
import {
  AddIcon,
  CloseIcon,
  DuplicateIcon,
  MoreActionsIcon,
  RenameIcon,
} from "src/icons";
import { Button, DDContent, StyledItem } from "src/components/elements";

type PatternSidebarProps = {
  selectedPatternId: PatternId | null;
  onSelectPattern: (patternId: PatternId) => void;
};

export const PatternSidebar = ({
  selectedPatternId,
  onSelectPattern,
}: PatternSidebarProps) => {
  const translate = useTranslate();
  const { hydraulicModel } = useAtomValue(dataAtom);
  const patterns = hydraulicModel.demands.patterns;

  const patternIds = Array.from(patterns.keys()).sort();

  return (
    <div className="w-56 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col p-2 gap-2">
      {patternIds.length > 0 && (
        <ul className="flex-1 overflow-y-auto gap-2">
          {patternIds.map((patternId) => (
            <PatternSidebarItem
              key={patternId}
              patternId={patternId}
              isSelected={patternId === selectedPatternId}
              onSelect={() => onSelectPattern(patternId)}
            />
          ))}
        </ul>
      )}
      <Button variant="default" size="sm" className="w-full justify-center">
        <AddIcon size="sm" />
        {translate("addPattern")}
      </Button>
    </div>
  );
};

type PatternSidebarItemProps = {
  patternId: PatternId;
  isSelected: boolean;
  onSelect: () => void;
};

const PatternSidebarItem = ({
  patternId,
  isSelected,
  onSelect,
}: PatternSidebarItemProps) => {
  const translate = useTranslate();

  return (
    <li
      className={`group flex items-center justify-between text-sm cursor-pointer ${
        isSelected
          ? "bg-gray-200 dark:hover:bg-gray-700"
          : "hover:bg-gray-100 dark:hover:bg-gray-800"
      }`}
    >
      <Button
        variant="quiet"
        size="sm"
        onClick={onSelect}
        className="flex-1 justify-start truncate hover:bg-transparent dark:hover:bg-transparent"
      >
        {patternId}
      </Button>
      <div onClick={(e) => e.stopPropagation()} className="self-stretch flex">
        <DD.Root modal={false}>
          <DD.Trigger asChild>
            <Button
              variant="quiet"
              size="xs"
              className={`h-full ${
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
              <StyledItem onSelect={() => {}}>
                <RenameIcon size="sm" />
                {translate("rename")}
              </StyledItem>
              <StyledItem onSelect={() => {}}>
                <DuplicateIcon size="sm" />
                {translate("duplicate")}
              </StyledItem>
              <StyledItem variant="destructive" onSelect={() => {}}>
                <CloseIcon size="sm" />
                {translate("delete")}
              </StyledItem>
            </DDContent>
          </DD.Portal>
        </DD.Root>
      </div>
    </li>
  );
};
