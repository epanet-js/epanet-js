# @epanet-js/i18n

Shared internationalization machinery for epanet-js, built on
[i18next](https://www.i18next.com/) + [react-i18next](https://react.i18next.com/).
It is the single i18n implementation consumed by the apps so that "translate this
key" behaves the same everywhere, while each app keeps ownership of its own
translations.

It is a **no-build source package** — the `.ts`/`.tsx` is consumed directly by the
importing app's bundler (the same convention as the other `@epanet-js/*` workspace
libraries). Because it ships JSX, consuming Next.js apps must add `@epanet-js/i18n`
to `transpilePackages`.

`react`, `react-dom` and `react-i18next` are **peer dependencies** — the consuming
app provides them, so there is exactly one React instance and one react-i18next
context. The lib intentionally does **not** depend on any state library (e.g. jotai);
app-specific concerns are injected.

## What each app provides vs. what the lib provides

The lib is generic. Each app supplies the app-specific pieces:

- its own bundled English `translation.json`,
- the backend load path (where non-English locales are fetched from),
- the locale source + setter (auth-backed, local storage, an iframe URL param, …),
- an optional error handler for failed/timed-out language changes,
- optional translation overrides.

## Entry points

- `@epanet-js/i18n` — the full API (hooks, provider, init factory, locale primitives).
- `@epanet-js/i18n/locale` — **react-free** subpath exposing only the locale
  primitives (`Locale`, `symbols`, `getLocale`, `languageConfig`,
  `allSupportedLanguages`). Import from here in non-React / `node`-environment code
  (e.g. number formatting) so it does not pull react-i18next or the HTTP backend into
  its module graph.
- `@epanet-js/i18n/server` — **react-free** subpath for server-rendered copy
  (`createServerI18n`, `cdnLoadPath`, `ServerTranslateFn`). See below.

## Server-side translation

`createI18n` is for React apps: it calls `initReactI18next` and configures the
module-level i18next singleton, which a server cannot safely share across concurrent
requests. `createServerI18n` is the server counterpart — same resources and
`loadPath` contract, no React.

```ts
const translator = createServerI18n({
  enTranslations,
  loadPath: cdnLoadPath("billing"), // …/locales/<lng>/billing.json
});

// once per request
const t = await translator(locale);
t("checkoutCompleted.title");
```

`cdnLoadPath(namespace)` holds the locales CDN origin so consumers name only their
namespace file. The React entry point still takes a `loadPath` of its own, since its
consumers predate this helper and bundle English under a different local path.

Three properties are load-bearing; changing any of them reintroduces a bug the
design exists to avoid:

- **`i18next.createInstance()`, not the shared default export.** Two consumers in one
  process get independent stores rather than clobbering each other's resources.
- **`getFixedT(locale)`, never `changeLanguage(locale)`.** `changeLanguage` mutates
  instance-wide state, so under concurrency one request's language leaks into
  another's response. `getFixedT` binds the language to the returned function
  instead.
- **A failed load degrades to English rather than throwing.** `loadLanguages` is
  wrapped in a `try/catch`, and `fallbackLng: "en"` with the bundled English
  resources means a CDN outage — or a namespace that does not exist yet — renders
  English instead of failing the page. Missing individual keys fall back the same
  way, so a partially translated file is safe to publish.

## The English file must be served, not just bundled

Every consumer keeps its English at `public/locales/en/translation.json`, and that
path does two jobs. The app **imports** it as its bundled English resource, and the
external `epanet-js-locales` repo **reads** it over HTTP —
`<host>/locales/en/translation.json` — to generate every other language from it.

Serving it is not optional: a consumer whose English source is unreachable at that
URL gets no translations generated at all, and the failure is silent, because the
bundled copy still renders correctly in English. Keep it as one file; a second copy
under `src/` drifts from the served one.

## Public API

```ts
import {
  createI18n,        // init the i18next singleton with app-specific resources + loadPath
  LocaleProvider,    // parameterized provider: <LocaleProvider i18n locale setUserLocale onError>
  useLocale,         // { locale, setLocale, isI18nReady }
  useTranslate,      // (key, ...vars) | (key, count, ...vars) => string
  getLocale,         // SSR-safe locale detection (localStorage + navigator.language)
  symbols,           // per-locale decimal/group separators
  languageConfig,    // supported languages with display names + experimental flag
  allSupportedLanguages,
  TranslationOverridesProvider, // optional: remap keys / inject leading variables
  useTranslationOverrides,
} from "@epanet-js/i18n";
import type {
  Locale,
  CreateI18nOptions,
  LocaleProviderProps,
  LocaleContextType,
  TranslateFn,
  TranslationOverride,
  TranslationOverridesMap,
} from "@epanet-js/i18n";
```

### Wiring sketch

```tsx
// app-owned i18next instance
const i18n = createI18n({
  enTranslations,
  loadPath: (lngs) =>
    lngs[0] !== "en"
      ? `https://.../locales/${lngs[0]}/translation.json`
      : `/locales/${lngs[0]}/translation.json`,
});

// app-owned provider wiring
<LocaleProvider i18n={i18n} locale={locale} setUserLocale={setLocale} onError={captureError}>
  {children}
</LocaleProvider>;

// anywhere below the provider
const translate = useTranslate();
translate("dropZone.supportedFormats", "GeoJSON"); // positional {{1}} interpolation
translate("files", 3); // numeric first arg → pluralization via count
```

> Note: `i18next` and `i18next-http-backend` are regular dependencies. The lib and
> every consumer pin the same `i18next` major so pnpm dedupes one copy. If versions
> ever diverge, promote `i18next` to a peer dependency.
