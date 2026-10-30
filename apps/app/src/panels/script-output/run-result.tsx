import { useState } from "react";
import type { ReactNode } from "react";
import { Button } from "src/components/elements";
import {
  CollapsibleListSection,
  ListItem,
  type ItemAction,
} from "src/components/list";
import { useTranslate } from "src/hooks/use-translate";
import { BookmarkIcon, DownloadIcon } from "src/icons";
import type { ScriptAttachment, ScriptRunOutcome } from "src/lib/scripting";
import {
  useApplyScriptSelectionSet,
  useGoToScriptBookmark,
  useSaveScriptSelectionSet,
} from "src/commands/script-output-collections";
import { useIsCollectionsAvailable } from "src/commands/collection-draft";
import { formatSize, useDownloadAttachment } from "./run-output";

export const RunResult = ({ outcome }: { outcome: ScriptRunOutcome }) => {
  const translate = useTranslate();
  const applySelectionSet = useApplyScriptSelectionSet();
  const goToBookmark = useGoToScriptBookmark();
  const saveSelectionSet = useSaveScriptSelectionSet();
  const isCollectionsAvailable = useIsCollectionsAvailable();

  if (outcome.status !== "success") return null;

  const selectionSetActions: ItemAction[] = isCollectionsAvailable
    ? [
        {
          action: "save",
          label: translate("collections.selectionSets.save"),
          icon: <BookmarkIcon size="sm" />,
        },
      ]
    : [];

  return (
    <>
      {outcome.attachments.length > 0 && (
        <Section
          sectionType="files"
          title={translate("scripting.files")}
          count={outcome.attachments.length}
        >
          {outcome.attachments.map((attachment) => (
            <AttachmentItem key={attachment.name} attachment={attachment} />
          ))}
        </Section>
      )}
      {outcome.selectionSets.length > 0 && (
        <Section
          sectionType="selectionSets"
          title={translate("collections.selectionSets.title")}
          count={outcome.selectionSets.length}
        >
          {outcome.selectionSets.map((selectionSet, i) => (
            <OutputItem
              key={i}
              id={i}
              label={selectionSet.label}
              onSelect={() => applySelectionSet(selectionSet)}
              actions={selectionSetActions}
              onAction={() => saveSelectionSet(selectionSet)}
            />
          ))}
        </Section>
      )}
      {outcome.bookmarks.length > 0 && (
        <Section
          sectionType="bookmarks"
          title={translate("collections.bookmarks.title")}
          count={outcome.bookmarks.length}
        >
          {outcome.bookmarks.map((bookmark, i) => (
            <OutputItem
              key={i}
              id={i}
              label={bookmark.label}
              onSelect={() => goToBookmark(bookmark)}
            />
          ))}
        </Section>
      )}
    </>
  );
};

const Section = ({
  sectionType,
  title,
  count,
  children,
}: {
  sectionType: string;
  title: string;
  count: number;
  children: ReactNode;
}) => {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <CollapsibleListSection
      sectionType={sectionType}
      title={title}
      count={count}
      isOpen={isOpen}
      onToggle={() => setIsOpen((open) => !open)}
      isFocused={false}
      readOnly
    >
      {children}
    </CollapsibleListSection>
  );
};

const OutputItem = ({
  id,
  label,
  onSelect,
  actions = [],
  onAction,
}: {
  id: number;
  label: string;
  onSelect: () => void;
  actions?: ItemAction[];
  onAction?: (action: string) => void;
}) => {
  const translate = useTranslate();
  return (
    <ListItem
      item={{ id, label }}
      isSelected={false}
      onSelect={onSelect}
      actions={actions}
      actionsLabel={translate("moreActions")}
      onAction={onAction}
      readOnly={actions.length === 0}
      showFullLabelOnHover
    />
  );
};

const AttachmentItem = ({ attachment }: { attachment: ScriptAttachment }) => {
  const translate = useTranslate();
  const downloadAttachment = useDownloadAttachment();
  return (
    <li className="flex items-center text-sm h-8 min-w-0 rounded-sm hover:bg-base-hover">
      <Button
        variant="quiet/list"
        size="sm"
        onClick={() => downloadAttachment(attachment)}
        aria-label={`${translate("scripting.download")}: ${attachment.name}`}
        className="flex-1 min-w-0 self-stretch justify-start hover:bg-transparent dark:hover:bg-transparent"
      >
        <DownloadIcon size="sm" />
        <span className="truncate" title={attachment.name}>
          {attachment.name}
        </span>
        <span className="ml-auto shrink-0 font-normal text-subtle tabular-nums">
          {formatSize(attachment.content.length)}
        </span>
      </Button>
    </li>
  );
};
