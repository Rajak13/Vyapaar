/**
 * AD → BS date converter
 *
 * Uses the `nepali-date-converter` npm package for reliable,
 * government-accurate Bikram Sambat conversion.
 * The old manual lookup table had data errors (e.g. BS 2008 Ashadh = 11 days)
 * that caused off-by-one date bugs.
 */
import nepaliDatePkg from 'nepali-date-converter'

const NepaliDate = nepaliDatePkg.default || nepaliDatePkg

/**
 * Convert AD date string (YYYY-MM-DD) to BS date string (YYYY-MM-DD).
 * Returns empty string if conversion fails or input is invalid.
 */
export function adToBs(adDateStr) {
  if (!adDateStr) return ''
  try {
    const cleanStr = String(adDateStr).slice(0, 10)
    const adDate = new Date(cleanStr + 'T00:00:00')
    if (isNaN(adDate.getTime())) return ''
    const nd = new NepaliDate(adDate)
    const y = nd.getYear()
    const m = String(nd.getMonth() + 1).padStart(2, '0')
    const d = String(nd.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  } catch {
    return ''
  }
}

/**
 * Convert BS date string (YYYY-MM-DD) to AD ISO date string (YYYY-MM-DD).
 * Returns empty string if conversion fails.
 * Uses local getFullYear/getMonth/getDate instead of toISOString() to avoid
 * UTC timezone conversion shifting the day back (e.g. Bhadra 7 midnight becoming 18:15 UTC yesterday).
 */
export function bsToAd(bsDateStr) {
  if (!bsDateStr) return ''
  try {
    const parts = bsDateStr.split('-')
    if (parts.length < 3) return ''
    const [y, m, d] = parts.map(Number)
    const nd = new NepaliDate(y, m - 1, d)
    const adDate = nd.toJsDate()
    if (!adDate || isNaN(adDate.getTime())) return ''
    const year = adDate.getFullYear()
    const month = String(adDate.getMonth() + 1).padStart(2, '0')
    const day = String(adDate.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  } catch {
    return ''
  }
}

export const BS_MONTH_NAMES_EN = [
  'Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra',
]

export const BS_MONTH_NAMES_NP = [
  'बैशाख', 'जेठ', 'असार', 'साउन', 'भदौ', 'असोज',
  'कार्तिक', 'मंसिर', 'पुस', 'माघ', 'फागुन', 'चैत',
]
