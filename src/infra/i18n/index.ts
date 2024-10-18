import { Translations } from './locales/locale'
import * as en from './locales/en'
import * as es  from './locales/es'
import { captureError } from '../error-tracking'

const locales = {
  'en': en,
  'es': es
}
type Locale = keyof typeof locales
const codes = Object.keys(locales) as Locale[]

export const translate = (key: string): string => {
  const locale = getLocale()
  const translations = locales[locale].translations

  const text = translations[key as keyof Translations]
  if (!text) {
    captureError(new Error(`Missing translation for ${key}`))
  }

  return text || key
}

const getLocale = (): Locale => {
  if (typeof window === "undefined") return 'en'

  const language = navigator.language
  const code = codes.find((code) => language === code || language.startsWith(`${code}-`))
  return code || 'en'
}
