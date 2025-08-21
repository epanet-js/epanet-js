import { vi } from "vitest";

import * as useLocale from "src/hooks/use-locale";

vi.mock("src/hooks/use-locale", () => ({
  useLocale: vi.fn(() => ({
    locale: "en",
    setLocale: vi.fn(),
    isI18nReady: true,
  })),
}));

export { useLocale };
