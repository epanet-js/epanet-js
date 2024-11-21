import { translations, units } from "./en";

export type Translations = { [key in keyof typeof translations]: string };
export type UnitsLocale = { [key in keyof typeof units]: string };
