import React from "react";
import { Locale, languageConfig } from "src/infra/i18n/locale";
import * as DD from "@radix-ui/react-dropdown-menu";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Button, DDContent, StyledItem } from "./elements";
import { CheckIcon, ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { useTranslate } from "src/hooks/use-translate";
import { useLocale } from "src/hooks/use-locale";
import { useUserTracking } from "src/infra/user-tracking";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { Check, TriangleAlert } from "lucide-react";

export const LanguageSelector = ({
  align = "end",
  padding = true,
  asChild = false,
}: {
  align?: "start" | "center" | "end";
  padding?: boolean;
  asChild?: boolean;
}) => {
  const translate = useTranslate();
  const { locale, setLocale } = useLocale();
  const userTracking = useUserTracking();

  const availableLanguages = languageConfig;

  const handleLanguageChange = (newLocale: Locale) => {
    userTracking.capture({
      name: "language.changed",
      language: newLocale,
    });
    void setLocale(newLocale);
  };

  const isLucideIconsOn = useFeatureFlag("FLAG_LUCIDE_ICONS");

  return (
    <DD.Root
      onOpenChange={(open) => {
        if (open) {
          userTracking.capture({ name: "languageList.opened" });
        }
      }}
    >
      <DD.Trigger asChild>
        {asChild ? (
          <span className={padding ? "" : "!p-0"}>{translate("language")}</span>
        ) : (
          <Button variant="quiet" className={padding ? "" : "!p-0"}>
            {translate("language")}
          </Button>
        )}
      </DD.Trigger>
      <DDContent side="bottom" align={align} className="min-w-32">
        {availableLanguages.map((language) => (
          <Tooltip.Provider key={language.code}>
            <Tooltip.Root delayDuration={500}>
              <Tooltip.Trigger asChild>
                <StyledItem
                  onSelect={() => handleLanguageChange(language.code)}
                >
                  <div className="flex items-center w-full gap-2">
                    <div className="flex items-center gap-2 flex-1">
                      <span>{language.name}</span>
                      {language.experimental &&
                        (isLucideIconsOn ? (
                          <TriangleAlert
                            size={16}
                            className="text-orange-500"
                          />
                        ) : (
                          <ExclamationTriangleIcon className="w-3 h-3 text-orange-500" />
                        ))}
                    </div>
                    <div className="w-4 h-4 flex items-center justify-center">
                      {locale === language.code &&
                        (isLucideIconsOn ? (
                          <Check size={16} className="text-purple-700" />
                        ) : (
                          <CheckIcon className="w-4 h-4 text-purple-700" />
                        ))}
                    </div>
                  </div>
                </StyledItem>
              </Tooltip.Trigger>
              {language.experimental && (
                <Tooltip.Portal>
                  <Tooltip.Content
                    className="bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg max-w-48 z-50"
                    sideOffset={5}
                  >
                    {translate("experimentalLanguage")}
                    <Tooltip.Arrow className="fill-gray-900" />
                  </Tooltip.Content>
                </Tooltip.Portal>
              )}
            </Tooltip.Root>
          </Tooltip.Provider>
        ))}
      </DDContent>
    </DD.Root>
  );
};
