import { translations } from "./en";

export type Translations = { [key in keyof typeof translations]: string };
