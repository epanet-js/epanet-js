'use client'
import { Translations } from './locales/locale'
import * as enEN from './locales/en-EN'

export const translate = (key: string): string => {
  const translations = getTransaltions()

  const text = translations[key as keyof Translations]
  if (!text) {
    console.warn(`Missing translation for ${key}`)
  }

  return text || key
}

const getTransaltions = (): Translations  => {
  return enEN.translations
}
