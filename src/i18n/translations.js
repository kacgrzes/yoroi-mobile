// @flow

// TODO: Add when chinese traditional is available
// import zhHant from './locales/zh-Hant'
import {LANGUAGES} from './languages'
import csCZ from './locales/cs-CZ'
import deDE from './locales/de-DE'
import enUS from './locales/en-US'
import esES from './locales/es-ES'
import frFR from './locales/fr-FR'
import huHU from './locales/hu-HU'
import idID from './locales/id-ID'
import itIT from './locales/it-IT'
import jaJP from './locales/ja-JP'
import koKR from './locales/ko-KR'
import nlNL from './locales/nl-NL'
import ptBR from './locales/pt-BR'
import ruRU from './locales/ru-RU'
import skSK from './locales/sk-SK'
import zhHans from './locales/zh-Hans'

const translations = {}
const defaultLocale = enUS

translations[LANGUAGES.ENGLISH] = enUS

// Merged english messages with selected by user locale messages
// In this case all english data would be overridden to user selected locale, but untranslated
// (missed in object keys) just stay in english
translations[LANGUAGES.JAPANESE] = Object.assign({}, defaultLocale, jaJP)
translations[LANGUAGES.KOREAN] = Object.assign({}, defaultLocale, koKR)
translations[LANGUAGES.RUSSIAN] = Object.assign({}, defaultLocale, ruRU)
translations[LANGUAGES.SPANISH] = Object.assign({}, defaultLocale, esES)
translations[LANGUAGES.CHINESE_SIMPLIFIED] = Object.assign(
  {},
  defaultLocale,
  zhHans,
)
// TODO: Add when chinese traditional is available
// translations[LANGUAGES.CHINESE_TRADITIONAL] = Object.assign({}, defaultLocale, zhHans)
translations[LANGUAGES.INDONESIAN] = Object.assign({}, defaultLocale, idID)
translations[LANGUAGES.BRAZILIAN] = Object.assign({}, defaultLocale, ptBR)
translations[LANGUAGES.GERMAN] = Object.assign({}, defaultLocale, deDE)
translations[LANGUAGES.FRENCH] = Object.assign({}, defaultLocale, frFR)
translations[LANGUAGES.ITALIAN] = Object.assign({}, defaultLocale, itIT)
translations[LANGUAGES.DUTCH] = Object.assign({}, defaultLocale, nlNL)
translations[LANGUAGES.CZECH] = Object.assign({}, defaultLocale, csCZ)
translations[LANGUAGES.HUNGARIAN] = Object.assign({}, defaultLocale, huHU)
translations[LANGUAGES.SLOVAK] = Object.assign({}, defaultLocale, skSK)

export default translations
