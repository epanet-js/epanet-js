import clsx from "clsx";
import { useTranslate } from "src/hooks/use-translate";
import { WarningIcon } from "src/icons";
import { simulationSettingsCategories } from "./simulation-settings-data";
import { useInvalidSectionIds } from "./simulation-settings-content";

type Props = {
  activeSection: string;
  onSelectSection: (sectionId: string) => void;
};

const isActiveCategory = (
  activeSection: string,
  categoryId: string,
  subcategoryIds: string[],
): boolean => {
  return activeSection === categoryId || subcategoryIds.includes(activeSection);
};

export const SimulationSettingsSidebar = ({
  activeSection,
  onSelectSection,
}: Props) => {
  const translate = useTranslate();
  const invalidSections = useInvalidSectionIds();
  return (
    <nav className="w-64 shrink-0 p-3 overflow-y-auto">
      <ul className="flex flex-col gap-0.5">
        {simulationSettingsCategories.map((category) => {
          const subcategoryIds =
            category.subcategories?.map((sub) => sub.id) ?? [];
          const isCategoryActive = isActiveCategory(
            activeSection,
            category.id,
            subcategoryIds,
          );

          return (
            <li key={category.id}>
              <button
                type="button"
                onClick={() => onSelectSection(category.id)}
                className={clsx(
                  "w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-sm text-size-base transition-colors font-medium",
                  isCategoryActive && !subcategoryIds.includes(activeSection)
                    ? "bg-accent-tint text-default"
                    : "text-default hover:bg-base-hover",
                )}
              >
                <span className="truncate">
                  {translate(category.translationKey)}
                </span>
                {invalidSections.has(category.id) && (
                  <WarningIcon
                    className="shrink-0 text-warning"
                    aria-label={translate("simulationSettings.sectionHasError")}
                  />
                )}
              </button>
              {category.subcategories && (
                <ul className="flex flex-col gap-0.5 mt-0.5">
                  {category.subcategories.map((sub) => (
                    <li key={sub.id}>
                      <button
                        type="button"
                        onClick={() => onSelectSection(sub.id)}
                        className={clsx(
                          "w-full flex items-center justify-between gap-2 pl-6 pr-3 py-1.5 rounded-sm text-size-base transition-colors font-medium",
                          activeSection === sub.id
                            ? "bg-accent-tint text-default"
                            : "text-default hover:bg-base-hover",
                        )}
                      >
                        <span className="truncate">
                          {translate(sub.translationKey)}
                        </span>
                        {invalidSections.has(sub.id) && (
                          <WarningIcon
                            className="shrink-0 text-warning"
                            aria-label={translate(
                              "simulationSettings.sectionHasError",
                            )}
                          />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
