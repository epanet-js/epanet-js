import clsx from "clsx";
import { optionCategories } from "./options-data";

type Props = {
  activeSection: string;
  onSelectSection: (sectionId: string) => void;
};

export const OptionsSidebar = ({ activeSection, onSelectSection }: Props) => {
  return (
    <nav className="w-44 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 pr-3 overflow-y-auto">
      <ul className="flex flex-col gap-0.5">
        {optionCategories.map((category) => (
          <li key={category.id} className="flex flex-col gap-0.5">
            <button
              type="button"
              onClick={() => onSelectSection(category.id)}
              className={clsx(
                "w-full text-left px-3 py-1.5 rounded text-sm transition-colors",
                activeSection === category.id
                  ? "bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200 font-medium"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800",
              )}
            >
              {category.label}
            </button>
            {category.subcategories?.map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => onSelectSection(sub.id)}
                className={clsx(
                  "w-full text-left pl-6 pr-3 py-1 rounded text-xs transition-colors",
                  activeSection === sub.id
                    ? "bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200 font-medium"
                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800",
                )}
              >
                {sub.label}
              </button>
            ))}
          </li>
        ))}
      </ul>
    </nav>
  );
};
