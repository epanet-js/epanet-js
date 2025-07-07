import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Store } from "src/state/jotai";
import { setInitialState } from "src/__helpers__/state";
import { CommandContainer } from "src/commands/__helpers__/command-container";
import { LanguageSelector } from "./language-selector";
import { stubFeatureOn } from "src/__helpers__/feature-flags";
import { Mock } from "vitest";
import * as useFeatureFlags from "src/hooks/use-feature-flags";
import { localeAtom } from "src/state/locale";

import esTranslations from "../../public/locales/es/translation.json";
import ptBRTranslations from "../../public/locales/pt-BR/translation.json";
import i18n from "src/infra/i18n/i18next-config";

const setLocaleFromAnotherTab = (locale: string, store: Store) => {
  localStorage.setItem("locale", JSON.stringify(locale));
  store.set(localeAtom, locale as any);
};

const renderComponent = ({ store }: { store: Store }) => {
  return render(
    <CommandContainer store={store}>
      <LanguageSelector />
    </CommandContainer>,
  );
};

describe("Language Selector", () => {
  beforeEach(() => {
    localStorage.clear();
    i18n.addResourceBundle("es", "translation", esTranslations);
    i18n.addResourceBundle("pt-BR", "translation", ptBRTranslations);
  });

  describe("with deprecated translation system", () => {
    beforeEach(() => {
      stubFeatureOn("FLAG_BR");
    });

    it("displays language button in English by default", async () => {
      const store = setInitialState({});
      renderComponent({ store });

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Language" }),
        ).toBeInTheDocument();
      });
    });

    it("translates to Spanish when changed via UI", async () => {
      const store = setInitialState({});
      renderComponent({ store });

      await userEvent.click(screen.getByRole("button", { name: "Language" }));

      await userEvent.click(
        screen.getByRole("menuitem", { name: "Español (ES)" }),
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Idioma" }),
        ).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole("button", { name: "Idioma" }));
      const spanishOption = screen.getByRole("menuitem", {
        name: "Español (ES)",
      });
      expect(spanishOption.querySelector("svg")).toBeInTheDocument();
    });

    it("translates to Portuguese when changed via UI", async () => {
      const store = setInitialState({});
      renderComponent({ store });

      await userEvent.click(screen.getByRole("button", { name: "Language" }));

      await userEvent.click(
        screen.getByRole("menuitem", { name: "Português (BR)" }),
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Idioma" }),
        ).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole("button", { name: "Idioma" }));
      const portugueseOption = screen.getByRole("menuitem", {
        name: "Português (BR)",
      });
      expect(portugueseOption.querySelector("svg")).toBeInTheDocument();
    });

    it("updates when locale changes from another tab", async () => {
      const store = setInitialState({});
      renderComponent({ store });

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Language" }),
        ).toBeInTheDocument();
      });

      act(() => {
        setLocaleFromAnotherTab("es", store);
      });

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Idioma" }),
        ).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole("button", { name: "Idioma" }));
      const spanishOption = screen.getByRole("menuitem", {
        name: "Español (ES)",
      });
      expect(spanishOption.querySelector("svg")).toBeInTheDocument();
    });
  });

  describe("with i18next translation system (FLAG_I18NEXT=true)", () => {
    beforeEach(() => {
      const mockImpl = (flag: string) => {
        if (flag === "FLAG_BR") return true;
        if (flag === "FLAG_I18NEXT") return true;
        return false;
      };
      (useFeatureFlags.useFeatureFlag as Mock).mockImplementation(mockImpl);
    });

    it("displays language button in English by default", async () => {
      const store = setInitialState({});
      renderComponent({ store });

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Language" }),
        ).toBeInTheDocument();
      });
    });

    it("translates to Spanish when changed via UI", async () => {
      const store = setInitialState({});
      renderComponent({ store });

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Language" }),
        ).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole("button", { name: "Language" }));

      await userEvent.click(
        screen.getByRole("menuitem", { name: "Español (ES)" }),
      );

      await waitFor(
        () => {
          expect(
            screen.getByRole("button", { name: "Idioma" }),
          ).toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      await userEvent.click(screen.getByRole("button", { name: "Idioma" }));
      const spanishOption = screen.getByRole("menuitem", {
        name: "Español (ES)",
      });
      expect(spanishOption.querySelector("svg")).toBeInTheDocument();
    });

    it("translates to Portuguese when changed via UI", async () => {
      const store = setInitialState({});
      renderComponent({ store });

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Language" }),
        ).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole("button", { name: "Language" }));

      await userEvent.click(
        screen.getByRole("menuitem", { name: "Português (BR)" }),
      );

      await waitFor(
        () => {
          expect(
            screen.getByRole("button", { name: "Idioma" }),
          ).toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      await userEvent.click(screen.getByRole("button", { name: "Idioma" }));
      const portugueseOption = screen.getByRole("menuitem", {
        name: "Português (BR)",
      });
      expect(portugueseOption.querySelector("svg")).toBeInTheDocument();
    });

    it("updates when locale changes from another tab", async () => {
      const store = setInitialState({});
      renderComponent({ store });

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Language" }),
        ).toBeInTheDocument();
      });

      act(() => {
        setLocaleFromAnotherTab("es", store);
      });

      await waitFor(
        () => {
          expect(
            screen.getByRole("button", { name: "Idioma" }),
          ).toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      await userEvent.click(screen.getByRole("button", { name: "Idioma" }));
      const spanishOption = screen.getByRole("menuitem", {
        name: "Español (ES)",
      });
      expect(spanishOption.querySelector("svg")).toBeInTheDocument();
    });

    it("maintains consistency during rapid language changes", async () => {
      const store = setInitialState({});
      renderComponent({ store });

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Language" }),
        ).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole("button", { name: "Language" }));
      await userEvent.click(
        screen.getByRole("menuitem", { name: "Español (ES)" }),
      );

      await waitFor(
        () => {
          expect(
            screen.getByRole("button", { name: "Idioma" }),
          ).toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      await userEvent.click(screen.getByRole("button", { name: "Idioma" }));
      await userEvent.click(
        screen.getByRole("menuitem", { name: "Português (BR)" }),
      );

      await waitFor(
        () => {
          expect(
            screen.getByRole("button", { name: "Idioma" }),
          ).toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      await userEvent.click(screen.getByRole("button", { name: "Idioma" }));
      await userEvent.click(
        screen.getByRole("menuitem", { name: "English (US)" }),
      );

      await waitFor(
        () => {
          expect(
            screen.getByRole("button", { name: "Language" }),
          ).toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      await userEvent.click(screen.getByRole("button", { name: "Language" }));
      const englishOption = screen.getByRole("menuitem", {
        name: "English (US)",
      });
      expect(englishOption.querySelector("svg")).toBeInTheDocument();
    });
  });
});
