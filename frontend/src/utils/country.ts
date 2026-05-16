import * as countries from 'i18n-iso-countries'
import en from 'i18n-iso-countries/langs/en.json'

countries.registerLocale(en)

export const normalizeCountryCode = (raw: string | null | undefined): string | null => {
  if (!raw) return null
  const code = raw.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) return null
  return countries.isValid(code) ? code : null
}
