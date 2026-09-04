import { useTranslate } from "src/hooks/use-translate";
import { TableIcon } from "src/icons";

export const DockEmptyState = () => {
  const translate = useTranslate();

  return (
    <div
      className="h-full flex flex-col items-center justify-center gap-1
        text-subtle text-size-small px-4 text-center"
    >
      <TableIcon className="opacity-50" />
      <p>{translate("panels.empty.title")}</p>
      <p>{translate("panels.empty.description")}</p>
    </div>
  );
};
