import { useTranslate } from "src/hooks/use-translate";
import { EmptyStateIcon, HglProfileIcon, TableIcon } from "src/icons";

export const DockEmptyState = () => {
  const translate = useTranslate();

  return (
    <div className="h-full flex items-center justify-center gap-8 px-4">
      <EmptyStateIcon size="2xl" className="shrink-0 text-subtle" />
      <div className="flex flex-col gap-3">
        <p className="text-size-heading-3 font-semibold text-subtle">
          {translate("panels.empty.title")}
        </p>
        <ul className="flex flex-col gap-2 text-size-small text-subtle">
          <li className="flex items-start gap-2">
            <TableIcon size="md" className="shrink-0" />
            <span className="max-w-56">
              {translate("panels.empty.dataTables")}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <HglProfileIcon size="md" className="shrink-0" />
            <span className="max-w-56">
              {translate("panels.empty.hglProfile")}
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
};
