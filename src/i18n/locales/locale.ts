import { translations } from './en-EN'

export type Translations = { [key in keyof typeof translations]: string }
