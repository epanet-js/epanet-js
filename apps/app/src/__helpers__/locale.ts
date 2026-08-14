import { Locale } from "@epanet-js/i18n/locale";
import { Mock, vi } from "vitest";

import * as useLocale from "src/hooks/use-locale";

vi.mock("src/hooks/use-locale", () => ({
  useLocale: vi.fn(() => ({
    locale: "en",
    setLocale: vi.fn(),
    isI18nReady: true,
  })),
  LocaleProvider: ({ children }: { children: React.ReactNode }) => children,
}));

export const stubLocale = (locale: Locale) => {
  (useLocale.useLocale as Mock).mockImplementation(() => ({
    locale,
    setLocale: vi.fn(),
    isI18nReady: true,
  }));
};

export { useLocale };
