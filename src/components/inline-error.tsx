import { InfoCircledIcon } from "@radix-ui/react-icons";
import { Info } from "lucide-react";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

/**
 * Used generally in forms, this formats
 * an error message with a (i) icon.
 */
export function InlineError({ children }: React.PropsWithChildren<unknown>) {
  const isLucideIconsOn = useFeatureFlag("FLAG_LUCIDE_ICONS");
  return (
    <div
      role="alert"
      className="pt-1 text-sm flex items-start gap-x-1 text-red-700 dark:text-red-300"
    >
      {isLucideIconsOn ? (
        <Info size={16} style={{ marginTop: 2 }} />
      ) : (
        <InfoCircledIcon className="flex-shrink-0" style={{ marginTop: 2 }} />
      )}
      {Array.isArray(children) ? children.join(", ") : children}
    </div>
  );
}
