import React from "react";
import { useAtom } from "jotai";
import { localeAtom } from "src/state/locale";
import { Locale, languageConfig } from "src/infra/i18n/locale";
import * as DD from "@radix-ui/react-dropdown-menu";
import { Button, DDContent, StyledItem } from "./elements";
import { CheckIcon, ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { translate } from "src/infra/i18n";
import { useUserTracking } from "src/infra/user-tracking";

export const LanguageSelector = ({
  align = "end",
  padding = true,
  asChild = false,
}: {
  align?: "start" | "center" | "end";
  padding?: boolean;
  asChild?: boolean;
}) => {
  const [locale, setLocale] = useAtom(localeAtom);
  const userTracking = useUserTracking();

  const handleLanguageChange = (newLocale: Locale) => {
    userTracking.capture({
      name: "language.changed",
      language: newLocale,
    });
    setLocale(newLocale);
    window.location.reload();
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
          <span className={padding ? "" : "!p-0"}>{translate("language")}</span>
        ) : (
          <Button variant="quiet" className={padding ? "" : "!p-0"}>
            {translate("language")}
          </Button>
        )}
      </DD.Trigger>
      <DDContent side="bottom" align={align} className="min-w-32">
        {languageConfig.map((language) => (
          <StyledItem
            key={language.code}
            onSelect={() => handleLanguageChange(language.code)}
          >
            <div className="flex items-center justify-between w-full gap-2">
              <div className="flex items-center gap-2">
                <span>{language.name}</span>
                {language.experimental && (
                  <ExclamationTriangleIcon className="w-3 h-3 text-orange-500" />
                )}
              </div>
              {locale === language.code && (
                <CheckIcon className="w-4 h-4 text-purple-700" />
              )}
            </div>
          </StyledItem>
        ))}
      </DDContent>
    </DD.Root>
  );
};
