import { memo } from "react";

export const ThemesPanel = memo(function ThemesPanelInner() {
  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-white">
        Themes
      </div>
      <div className="flex-auto flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
        Coming soon
      </div>
    </div>
  );
});
