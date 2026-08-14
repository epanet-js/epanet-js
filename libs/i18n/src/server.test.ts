import { afterEach, describe, expect, it, vi } from "vitest";
import { cdnLoadPath, createServerI18n } from "./server";

const enTranslations = {
  greeting: { title: "Hello", detail: "Welcome back" },
  shared: "Back to the app",
};

const serving = (byLocale: Record<string, unknown>) => {
  const fetchMock = vi.fn((url: string) => {
    const locale = url.split("/").slice(-2)[0];
    const copy = byLocale[locale];

    return Promise.resolve(
      copy
        ? {
            ok: true,
            status: 200,
            statusText: "OK",
            text: () => Promise.resolve(JSON.stringify(copy)),
          }
        : {
            ok: false,
            status: 404,
            statusText: "Not Found",
            text: () => Promise.resolve(""),
          },
    );
  });
  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
};

const build = () =>
  createServerI18n({
    enTranslations,
    loadPath: (lngs: string[]) => `https://locales.test/${lngs[0]}/app.json`,
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("cdnLoadPath", () => {
  it("points at the namespace file for the requested language", () => {
    expect(cdnLoadPath("billing")(["es"])).toBe(
      "https://epanet-js.github.io/epanet-js-locales/locales/es/billing.json",
    );
  });
});

describe("createServerI18n", () => {
  it("translates in english without fetching", async () => {
    const fetchMock = serving({});
    const translator = build();

    const t = await translator("en");

    expect(t("greeting.title")).toBe("Hello");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("translates in a fetched language", async () => {
    serving({ es: { greeting: { title: "Hola", detail: "Bienvenido" } } });
    const translator = build();

    const t = await translator("es");

    expect(t("greeting.title")).toBe("Hola");
    expect(t("greeting.detail")).toBe("Bienvenido");
  });

  it("falls back to english per missing key", async () => {
    serving({ es: { greeting: { title: "Hola" } } });
    const translator = build();

    const t = await translator("es");

    expect(t("greeting.title")).toBe("Hola");
    expect(t("greeting.detail")).toBe("Welcome back");
    expect(t("shared")).toBe("Back to the app");
  });

  it("falls back to english when the backend is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const translator = build();

    const t = await translator("es");

    expect(t("greeting.title")).toBe("Hello");
  });

  it("does not leak a language between concurrent callers", async () => {
    serving({
      es: { greeting: { title: "Hola" } },
      ja: { greeting: { title: "こんにちは" } },
    });
    const translator = build();

    const [es, ja, en] = await Promise.all([
      translator("es"),
      translator("ja"),
      translator("en"),
    ]);

    expect(es("greeting.title")).toBe("Hola");
    expect(ja("greeting.title")).toBe("こんにちは");
    expect(en("greeting.title")).toBe("Hello");
  });

  it("keeps two instances independent", async () => {
    serving({ es: { greeting: { title: "Hola" } } });
    const other = createServerI18n({
      enTranslations: { greeting: { title: "Different" } },
      loadPath: () => "https://locales.test/none/app.json",
    });

    const t = await build()("en");
    const otherT = await other("en");

    expect(t("greeting.title")).toBe("Hello");
    expect(otherT("greeting.title")).toBe("Different");
  });
});
