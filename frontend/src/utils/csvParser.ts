import Papa from 'papaparse'
import { normalizeCountryCode } from './country'

export interface CsvLead {
  firstName: string
  lastName: string
  email: string
  phoneNumber?: string
  jobTitle?: string
  yearsInRole?: number
  countryCode?: string
  companyName?: string
  linkedInProfile?: string
  isValid: boolean
  errors: string[]
  rowIndex: number
}

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export const parseCsv = (content: string): CsvLead[] => {
  if (!content?.trim()) {
    throw new Error('CSV content cannot be empty')
  }

  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1)
  }

  const parseResult = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    transform: (value) => value.trim(),
    transformHeader: (header) => header.trim().toLowerCase(),
    quoteChar: '"',
  })

  if (parseResult.errors.length > 0) {
    const criticalErrors = parseResult.errors.filter(
      (error) => error.type === 'Delimiter' || error.type === 'Quotes' || error.type === 'FieldMismatch'
    )
    if (criticalErrors.length > 0) {
      throw new Error(`CSV parsing failed: ${criticalErrors[0].message}`)
    }
  }

  if (!parseResult.data || parseResult.data.length === 0) {
    throw new Error('CSV file appears to be empty or contains no valid data')
  }

  const data: CsvLead[] = []

  parseResult.data.forEach((row, index) => {
    if (Object.values(row).every((value) => !value)) return

    const lead: Partial<CsvLead> = { rowIndex: index + 2 }
    let countryWarning: string | null = null
    let yearsWarning: string | null = null

    Object.entries(row).forEach(([header, value]) => {
      const normalizedHeader = header.toLowerCase().replace(/[^a-z]/g, '')
      const trimmedValue = value?.trim() || ''

      switch (normalizedHeader) {
        case 'firstname':
          lead.firstName = trimmedValue
          break
        case 'lastname':
          lead.lastName = trimmedValue
          break
        case 'email':
          lead.email = trimmedValue
          break
        case 'jobtitle':
          lead.jobTitle = trimmedValue || undefined
          break
        case 'countrycode': {
          if (!trimmedValue) {
            lead.countryCode = undefined
          } else {
            const normalized = normalizeCountryCode(trimmedValue)
            if (normalized) {
              lead.countryCode = normalized
            } else {
              lead.countryCode = undefined
              countryWarning = `Invalid country code "${trimmedValue}" was ignored`
            }
          }
          break
        }
        case 'companyname':
          lead.companyName = trimmedValue || undefined
          break
        case 'phonenumber':
          lead.phoneNumber = trimmedValue || undefined
          break
        case 'yearsinrole': {
          if (!trimmedValue) {
            lead.yearsInRole = undefined
          } else {
            const n = Number(trimmedValue)
            if (Number.isInteger(n) && n >= 0) {
              lead.yearsInRole = n
            } else {
              lead.yearsInRole = undefined
              yearsWarning = `Invalid yearsInRole "${trimmedValue}" was ignored`
            }
          }
          break
        }
        case 'linkedinprofile':
          lead.linkedInProfile = trimmedValue || undefined
          break
      }
    })

    const errors: string[] = []
    const warnings: string[] = []
    if (!lead.firstName?.trim()) {
      errors.push('First name is required')
    }
    if (!lead.lastName?.trim()) {
      errors.push('Last name is required')
    }
    if (!lead.email?.trim()) {
      errors.push('Email is required')
    } else if (!isValidEmail(lead.email)) {
      errors.push('Invalid email format')
    }
    if (countryWarning) {
      warnings.push(countryWarning)
    }
    if (yearsWarning) {
      warnings.push(yearsWarning)
    }

    data.push({
      ...lead,
      firstName: lead.firstName || '',
      lastName: lead.lastName || '',
      email: lead.email || '',
      isValid: errors.length === 0,
      errors: [...errors, ...warnings],
    } as CsvLead)
  })

  return data
}
