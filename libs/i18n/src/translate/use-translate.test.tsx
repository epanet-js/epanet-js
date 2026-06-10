import { createElement } from "react";
import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TranslationOverridesProvider } from "./translate-context";
import type { TranslationOverridesMap } from "./translate-context";

const h = vi.hoisted(() => ({
  tSpy: vi.fn(
    (key: string, opts?: Record<string, unknown>) =>
      `t:${key}:${JSON.stringify(opts ?? {})}`,
  ),
  state: { ready: true },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: h.tSpy }),
}));

vi.mock("../locale-provider", () => ({
  useLocale: () => ({
    isI18nReady: h.state.ready,
    locale: "en",
    setLocale: () => Promise.resolve(),
  }),
}));

import { useTranslate } from "./use-translate";

const wrapperWith =
  (overrides: TranslationOverridesMap) =>
  ({ children }: { children: React.ReactNode }) =>
    createElement(TranslationOverridesProvider, { value: overrides }, children);

const renderTranslate = (overrides: TranslationOverridesMap = {}) =>
  renderHook(() => useTranslate(), { wrapper: wrapperWith(overrides) }).result;

describe("useTranslate", () => {
  beforeEach(() => {
    h.tSpy.mockClear();
    h.state.ready = true;
  });

  it("returns the key unchanged while i18n is not ready", () => {
    h.state.ready = false;
    const result = renderTranslate();
    expect(result.current("greeting", "World")).toBe("greeting");
    expect(h.tSpy).not.toHaveBeenCalled();
  });

  it("maps positional variables to {{1}}, {{2}}, ...", () => {
    const result = renderTranslate();
    result.current("greeting", "World", "Again");
    expect(h.tSpy).toHaveBeenCalledWith("greeting", {
      "1": "World",
      "2": "Again",
    });
  });

  it("treats a numeric first arg as the plural count", () => {
    const result = renderTranslate();
    result.current("files", 3);
    expect(h.tSpy).toHaveBeenCalledWith("files", { count: 3 });
  });

  it("supports a count followed by positional variables", () => {
    const result = renderTranslate();
    result.current("summary", 2, "ok");
    expect(h.tSpy).toHaveBeenCalledWith("summary", { count: 2, "1": "ok" });
  });

  it("applies an override: remaps the key and prepends the override variables", () => {
    const result = renderTranslate({
      chemicalConcentration: {
        key: "customChemicalConcentration",
        variables: ["Chlorine"],
      },
    });
    result.current("chemicalConcentration", "mg/L");
    expect(h.tSpy).toHaveBeenCalledWith("customChemicalConcentration", {
      "1": "Chlorine",
      "2": "mg/L",
    });
  });
});
