import { allSupportedLanguages } from "./locale";

const getAllKeys = (obj: Record<string, any>, prefix = ""): string[] => {
  const keys: string[] = [];

  Object.keys(obj).forEach((key) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof obj[key] === "object" && obj[key] !== null) {
      keys.push(...getAllKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  });

  return keys;
};

describe("Translation Keys Consistency", () => {
  const loadTranslations = async (
    locale: string,
  ): Promise<Record<string, any>> => {
    const translations = await import(
      `../../../public/locales/${locale}/translation.json`
    );
    return translations.default as Record<string, any>;
  };

  let englishKeys: string[];
  const translationsByLocale: Record<string, any> = {};

  beforeAll(async () => {
    for (const locale of allSupportedLanguages) {
      translationsByLocale[locale] = await loadTranslations(locale);
    }

    englishKeys = getAllKeys(translationsByLocale.en);
  });
  allSupportedLanguages
    .filter((locale) => locale !== "en")
    .forEach((locale) => {
      it(`${locale} translations should have all English keys`, () => {
        const localeKeys = getAllKeys(translationsByLocale[locale]);
        const missingKeys = englishKeys.filter(
          (key) => !localeKeys.includes(key),
        );
        expect(missingKeys).toEqual([]);
      });

      it(`should not have extra keys in ${locale} that don't exist in English`, () => {
        const localeKeys = getAllKeys(translationsByLocale[locale]);
        const extraKeys = localeKeys.filter(
          (key) => !englishKeys.includes(key),
        );
        expect(extraKeys).toEqual([]);
      });

      it(`${locale} should have the same number of keys as English`, () => {
        const localeKeys = getAllKeys(translationsByLocale[locale]);
        expect(localeKeys.length).toBe(englishKeys.length);
      });
    });
});
