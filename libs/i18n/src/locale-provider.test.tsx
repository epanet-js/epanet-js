import { createElement } from "react";
import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import type { i18n as I18nInstance } from "i18next";
import { LocaleProvider, useLocale } from "./locale-provider";
import type { Locale } from "./locale";

const makeI18n = (over: Record<string, unknown>): I18nInstance =>
  ({
    language: "en",
    changeLanguage: vi.fn(() => Promise.resolve()),
    ...over,
  }) as unknown as I18nInstance;

const renderLocale = (props: {
  i18n: I18nInstance;
  locale: Locale;
  setUserLocale?: (l: Locale) => Promise<void>;
  onError?: (e: unknown) => void;
}) =>
  renderHook(() => useLocale(), {
    wrapper: ({ children }: { children: React.ReactNode }) =>
      createElement(LocaleProvider, {
        i18n: props.i18n,
        locale: props.locale,
        setUserLocale: props.setUserLocale ?? (() => Promise.resolve()),
        onError: props.onError,
        children,
      }),
  });

describe("LocaleProvider / useLocale", () => {
  it("changes language and flips isI18nReady when the current language differs", async () => {
    const changeLanguage = vi.fn(() => Promise.resolve());
    const i18n = makeI18n({ language: "es", changeLanguage });
    const { result } = renderLocale({ i18n, locale: "en" });

    await waitFor(() => expect(result.current.isI18nReady).toBe(true));
    expect(changeLanguage).toHaveBeenCalledWith("en");
  });

  it("skips changeLanguage when the language already matches", async () => {
    const changeLanguage = vi.fn(() => Promise.resolve());
    const i18n = makeI18n({ language: "en", changeLanguage });
    const { result } = renderLocale({ i18n, locale: "en" });

    await waitFor(() => expect(result.current.isI18nReady).toBe(true));
    expect(changeLanguage).not.toHaveBeenCalled();
  });

  it("calls onError when changeLanguage rejects", async () => {
    const error = new Error("boom");
    const onError = vi.fn();
    const i18n = makeI18n({
      language: "es",
      changeLanguage: vi.fn(() => Promise.reject(error)),
    });

    renderLocale({ i18n, locale: "en", onError });

    await waitFor(() => expect(onError).toHaveBeenCalledWith(error));
  });

  it("delegates setLocale to the injected setUserLocale", async () => {
    const setUserLocale = vi.fn(() => Promise.resolve());
    const i18n = makeI18n({ language: "en" });
    const { result } = renderLocale({ i18n, locale: "en", setUserLocale });

    await act(async () => {
      await result.current.setLocale("es");
    });
    expect(setUserLocale).toHaveBeenCalledWith("es");
  });
});
