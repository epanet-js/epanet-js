import { useState } from "react";
import type { ReactNode } from "react";
import { Button } from "src/components/elements";
import {
  CollapsibleListSection,
  ListItem,
  type ItemAction,
} from "src/components/list";
import { usePermissions } from "src/hooks/use-permissions";
import { useTranslate } from "src/hooks/use-translate";
import { BookmarkIcon, DownloadIcon } from "src/icons";
import type { ScriptAttachment, ScriptRunOutcome } from "src/lib/scripting";
import {
  useApplyScriptSelectionSet,
  useGoToScriptBookmark,
  useSaveAllScriptBookmarks,
  useSaveAllScriptSelectionSets,
  useSaveScriptBookmark,
  useSaveScriptSelectionSet,
} from "src/commands/script-output-collections";
import {
  formatSize,
  useDownloadAttachment,
  useDownloadAttachmentsZip,
} from "./run-output";

export const RunResult = ({
  scriptName,
  outcome,
}: {
  scriptName: string;
  outcome: ScriptRunOutcome;
}) => {
  const translate = useTranslate();
  const downloadAttachmentsZip = useDownloadAttachmentsZip();
  const applySelectionSet = useApplyScriptSelectionSet();
  const goToBookmark = useGoToScriptBookmark();
  const saveSelectionSet = useSaveScriptSelectionSet();
  const saveBookmark = useSaveScriptBookmark();
  const saveAllSelectionSets = useSaveAllScriptSelectionSets();
  const saveAllBookmarks = useSaveAllScriptBookmarks();
  const { canManageCollections } = usePermissions();

  if (outcome.status !== "success") return null;

  const selectionSetActions: ItemAction[] = [
    {
      action: "save",
      label: translate("collections.selectionSets.save"),
      icon: <BookmarkIcon size="sm" />,
    },
  ];

  const bookmarkActions: ItemAction[] = [
    {
      action: "save",
      label: translate("collections.bookmarks.add"),
      icon: <BookmarkIcon size="sm" />,
    },
  ];

  const isUnsaved = ({ commit }: { commit: boolean }) =>
    !(commit && canManageCollections);

  const saveAllActions = (hasUnsaved: boolean): ItemAction[] =>
    hasUnsaved
      ? [
          {
            action: "saveAll",
            label: translate("scripting.saveAll"),
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
          menuActions={[
            {
              action: "downloadAllAsZip",
              label: translate("scripting.downloadAllAsZip"),
              icon: <DownloadIcon size="sm" />,
            },
          ]}
          onMenuAction={() =>
            downloadAttachmentsZip(scriptName, outcome.attachments)
          }
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
          menuActions={saveAllActions(outcome.selectionSets.some(isUnsaved))}
          onMenuAction={() => saveAllSelectionSets(outcome.selectionSets)}
        >
          {outcome.selectionSets.map((selectionSet, i) => (
            <OutputItem
              key={i}
              id={i}
              label={selectionSet.label}
              onSelect={() => applySelectionSet(selectionSet)}
              actions={
                selectionSet.commit && canManageCollections
                  ? []
                  : selectionSetActions
              }
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
          menuActions={saveAllActions(outcome.bookmarks.some(isUnsaved))}
          onMenuAction={() => saveAllBookmarks(outcome.bookmarks)}
        >
          {outcome.bookmarks.map((bookmark, i) => (
            <OutputItem
              key={i}
              id={i}
              label={bookmark.label}
              onSelect={() => goToBookmark(bookmark)}
              actions={
                bookmark.commit && canManageCollections ? [] : bookmarkActions
              }
              onAction={() => saveBookmark(bookmark)}
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
  menuActions = [],
  onMenuAction,
  children,
}: {
  sectionType: string;
  title: string;
  count: number;
  menuActions?: ItemAction[];
  onMenuAction?: (action: string) => void;
  children: ReactNode;
}) => {
  const translate = useTranslate();
  const [isOpen, setIsOpen] = useState(true);
  return (
    <CollapsibleListSection
      sectionType={sectionType}
      title={title}
      count={count}
      isOpen={isOpen}
      onToggle={() => setIsOpen((open) => !open)}
      isFocused={false}
      menuActions={menuActions}
      menuLabel={translate("moreActions")}
      onMenuAction={onMenuAction}
      readOnly={menuActions.length === 0}
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
