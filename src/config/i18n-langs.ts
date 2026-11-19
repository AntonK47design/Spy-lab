/** Declared languages. English is source, default and fallback. Names in their own script. */
export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'de', name: 'Deutsch' },
  { code: 'es', name: 'Español' },
  { code: 'pt', name: 'Português' },
  { code: 'fr', name: 'Français' },
  { code: 'ru', name: 'Русский' },
  { code: 'tr', name: 'Türkçe' },
] as const

export type LangCode = (typeof LANGUAGES)[number]['code']
export const DEFAULT_LANG: LangCode = 'en'
