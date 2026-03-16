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
    <nav className="w-64 flex-shrink-0 p-3 overflow-y-auto">
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
                  "w-full text-left px-3 py-1.5 rounded text-sm transition-colors",
                  isCategoryActive && !subcategoryIds.includes(activeSection)
                    ? "bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200 font-medium"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800",
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
                          "w-full text-left pl-6 pr-3 py-1.5 rounded text-sm transition-colors",
                          activeSection === sub.id
                            ? "bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200 font-medium"
                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800",
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
