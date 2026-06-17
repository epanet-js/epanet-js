import clsx from "clsx";
import { useTranslate } from "src/hooks/use-translate";
import { simulationSettingsCategories } from "./simulation-settings-data";

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
                  "w-full text-left px-3 py-1.5 rounded-sm text-size-base transition-colors font-medium",
                  isCategoryActive && !subcategoryIds.includes(activeSection)
                    ? "bg-accent-tint text-default"
                    : "text-default hover:bg-base-hover",
                )}
              >
                {translate(category.translationKey)}
              </button>
              {category.subcategories && (
                <ul className="flex flex-col gap-0.5 mt-0.5">
                  {category.subcategories.map((sub) => (
                    <li key={sub.id}>
                      <button
                        type="button"
                        onClick={() => onSelectSection(sub.id)}
                        className={clsx(
                          "w-full text-left pl-6 pr-3 py-1.5 rounded-sm text-size-base transition-colors font-medium",
                          activeSection === sub.id
                            ? "bg-accent-tint text-default"
                            : "text-default hover:bg-base-hover",
                        )}
                      >
                        {translate(sub.translationKey)}
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
