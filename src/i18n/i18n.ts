/**
 * Localization. Source language comes ONLY from bridge.platform.language (or the
 * player's explicit choice in settings). English is bundled as fallback; every other
 * language file is loaded on demand, so the initial download carries just one extra.
 */
import { signal, computed } from '@preact/signals-core'
import en from './en.json'
import { DEFAULT_LANG, LANGUAGES, type LangCode } from '../config/i18n-langs'

type Dict = Record<string, string>
const loaders = import.meta.glob<Dict>(['./*.json', '!./en.json'], { import: 'default' })

export const lang = signal<LangCode>(DEFAULT_LANG)
const dict = signal<Dict>(en as Dict)
export const missingKeys = new Set<string>()

export function resolveLang(code: string | null | undefined): LangCode {
  const c = String(code ?? '').toLowerCase().slice(0, 2)
  return (LANGUAGES.find((l) => l.code === c)?.code ?? DEFAULT_LANG) as LangCode
}

export async function setLanguage(code: LangCode): Promise<void> {
  if (code === 'en') {
    dict.value = en as Dict
  } else {
    const load = loaders[`./${code}.json`]
    if (!load) return setLanguage('en')
    dict.value = await load()
  }
  lang.value = code
  document.documentElement.lang = code
}

/** Translate with {name} placeholders. Falls back to English, then to the key. */
export function t(key: string, vars?: Record<string, string | number>): string {
  let s = dict.value[key] ?? (en as Dict)[key]
  if (s == null) {
    missingKeys.add(key)
    s = key
  }
  if (vars) for (const k in vars) s = s.split(`{${k}}`).join(String(vars[k]))
  return s
}

/** Reactive locale tag for number formatting. */
export const locale = computed(() => lang.value)
