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
