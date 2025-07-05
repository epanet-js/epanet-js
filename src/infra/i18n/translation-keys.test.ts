import enTranslations from "./i18next-locales/en.json";
import esTranslations from "../../../public/locales/es/translation.json";
import ptBRTranslations from "../../../public/locales/pt-BR/translation.json";

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
  const englishKeys = getAllKeys(enTranslations);
  const spanishKeys = getAllKeys(esTranslations);
  const portugueseKeys = getAllKeys(ptBRTranslations);

  it("Spanish translations should have all English keys", () => {
    const missingKeys = englishKeys.filter((key) => !spanishKeys.includes(key));
    expect(missingKeys).toEqual([]);
  });

  it("Portuguese translations should have all English keys", () => {
    const missingKeys = englishKeys.filter(
      (key) => !portugueseKeys.includes(key),
    );
    expect(missingKeys).toEqual([]);
  });

  it("should not have extra keys in Spanish that don't exist in English", () => {
    const extraKeys = spanishKeys.filter((key) => !englishKeys.includes(key));
    expect(extraKeys).toEqual([]);
  });

  it("should not have extra keys in Portuguese that don't exist in English", () => {
    const extraKeys = portugueseKeys.filter(
      (key) => !englishKeys.includes(key),
    );
    expect(extraKeys).toEqual([]);
  });

  it("should have the same number of keys across all locales", () => {
    expect(spanishKeys.length).toBe(englishKeys.length);
    expect(portugueseKeys.length).toBe(englishKeys.length);
  });
});
