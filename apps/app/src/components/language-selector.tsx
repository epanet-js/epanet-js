import React from "react";
import { Locale, languageConfig } from "@epanet-js/i18n/locale";
import * as DD from "@radix-ui/react-dropdown-menu";
import { Tooltip } from "@epanet-js/ui-kit";
import { Button, DDContent, StyledItem } from "./elements";
import { useTranslate } from "src/hooks/use-translate";
import { useLocale } from "src/hooks/use-locale";
import { useUserTracking } from "src/infra/user-tracking";
import { CheckIcon, WarningIcon } from "src/icons";

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
          <span className={padding ? "" : "p-0!"}>{translate("language")}</span>
        ) : (
          <Button variant="quiet" className={padding ? "" : "p-0!"}>
            {translate("language")}
          </Button>
        )}
      </DD.Trigger>
      <DDContent side="bottom" align={align} className="min-w-32">
        {availableLanguages.map((language) => {
          const item = (
            <StyledItem
              key={language.code}
              onSelect={() => handleLanguageChange(language.code)}
            >
              <div className="flex items-center w-full gap-2">
                <div className="flex items-center gap-2 flex-1">
                  <span>{language.name}</span>
                  {language.experimental && (
                    <WarningIcon className="text-warning" />
                  )}
                </div>
                <div className="w-4 h-4 flex items-center justify-center">
                  {locale === language.code && (
                    <CheckIcon className="text-accent" />
                  )}
                </div>
              </div>
            </StyledItem>
          );
          return language.experimental ? (
            <Tooltip
              key={language.code}
              content={translate("experimentalLanguage")}
              variant="contrast"
              side="top"
              sideOffset={5}
              delayDuration={500}
              zIndex={50}
            >
              {item}
            </Tooltip>
          ) : (
            item
          );
        })}
      </DDContent>
    </DD.Root>
  );
};
