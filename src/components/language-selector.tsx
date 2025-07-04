import React from "react";
import { useAtom } from "jotai";
import { localeAtom } from "src/state/locale";
import { Locale } from "src/infra/i18n/locale";
import * as DD from "@radix-ui/react-dropdown-menu";
import { Button, DDContent, StyledItem } from "./elements";
import { CheckIcon } from "@radix-ui/react-icons";
import { translate } from "src/infra/i18n";

const languageOptions = [
  { label: "English", value: "en" as Locale },
  { label: "Español", value: "es" as Locale },
];

export const LanguageSelector = ({
  align = "end",
  padding = true,
}: {
  align?: "start" | "center" | "end";
  padding?: boolean;
}) => {
  const [locale, setLocale] = useAtom(localeAtom);

  const handleLanguageChange = (newLocale: Locale) => {
    setLocale(newLocale);
    window.location.reload();
  };

  return (
    <DD.Root>
      <DD.Trigger asChild>
        <Button variant="quiet" className={padding ? "" : "!p-0"}>
          {translate("language")}
        </Button>
      </DD.Trigger>
      <DDContent side="bottom" align={align}>
        {languageOptions.map((option) => (
          <StyledItem
            key={option.value}
            onSelect={() => handleLanguageChange(option.value)}
          >
            <div className="flex items-center justify-between w-full gap-2">
              <span>{option.label}</span>
              {locale === option.value && (
                <CheckIcon className="w-4 h-4 text-purple-700" />
              )}
            </div>
          </StyledItem>
        ))}
      </DDContent>
    </DD.Root>
  );
};
