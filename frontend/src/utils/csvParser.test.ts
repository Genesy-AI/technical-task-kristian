import { describe, it, expect } from 'vitest'
import { parseCsv, isValidEmail } from './csvParser'

describe('isValidEmail', () => {
  it('should return true for valid email addresses', () => {
    expect(isValidEmail('test@example.com')).toBe(true)
    expect(isValidEmail('user.name@domain.co.uk')).toBe(true)
    expect(isValidEmail('first.last+tag@example.org')).toBe(true)
    expect(isValidEmail('123@456.com')).toBe(true)
  })

  it('should return false for invalid email addresses', () => {
    expect(isValidEmail('')).toBe(false)
    expect(isValidEmail('invalid')).toBe(false)
    expect(isValidEmail('test@')).toBe(false)
    expect(isValidEmail('@example.com')).toBe(false)
    expect(isValidEmail('test.example.com')).toBe(false)
    expect(isValidEmail('test@.com')).toBe(false)
    expect(isValidEmail('test@example')).toBe(false)
  })
})

describe('parseCsv', () => {
  it('should throw error for empty content', () => {
    expect(() => parseCsv('')).toThrow('CSV content cannot be empty')
    expect(() => parseCsv('   ')).toThrow('CSV content cannot be empty')
  })

  it('should throw error for CSV with only headers', () => {
    const csv = 'firstName,lastName,email,phoneNumber'
    expect(() => parseCsv(csv)).toThrow('CSV file appears to be empty or contains no valid data')
  })

  it('should throw error for malformed CSV content', () => {
    const malformedCsv = `firstName,lastName,email
"John,Doe,john@example.com,extra"field`
    expect(() => parseCsv(malformedCsv)).toThrow('CSV parsing failed')
  })

  it('should throw error for CSV with mismatched field count', () => {
    const mismatchedCsv = `firstName,lastName,email
John,Doe,john@example.com,ExtraField,AnotherExtra
Jane,Smith`
    expect(() => parseCsv(mismatchedCsv)).toThrow('CSV parsing failed')
  })

  it('should throw error for CSV with critical delimiter issues', () => {
    const noDelimiterCsv = `firstName lastName email
John Doe john@example.com`
    expect(() => parseCsv(noDelimiterCsv)).toThrow()
  })

  it('should parse valid CSV with all fields including the new ones', () => {
    const csv = `firstName,lastName,email,phoneNumber,jobTitle,countryCode,companyName,yearsInRole,linkedInProfile
John,Doe,john.doe@example.com,+1-555-0100,Developer,US,Tech Corp,3,https://www.linkedin.com/in/john-doe`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phoneNumber: '+1-555-0100',
      jobTitle: 'Developer',
      countryCode: 'US',
      companyName: 'Tech Corp',
      yearsInRole: 3,
      linkedInProfile: 'https://www.linkedin.com/in/john-doe',
      isValid: true,
      errors: [],
      rowIndex: 2,
    })
  })

  it('should handle missing required fields and mark as invalid', () => {
    const csv = `firstName,lastName,email,phoneNumber
,Smith,john@example.com,+1-555-0001
John,,john@example.com,+1-555-0002
John,Smith,,+1-555-0003`

    const result = parseCsv(csv)

    expect(result).toHaveLength(3)

    expect(result[0].isValid).toBe(false)
    expect(result[0].errors).toContain('First name is required')

    expect(result[1].isValid).toBe(false)
    expect(result[1].errors).toContain('Last name is required')

    expect(result[2].isValid).toBe(false)
    expect(result[2].errors).toContain('Email is required')
  })

  it('should treat phoneNumber as optional (enriched later)', () => {
    const csv = `firstName,lastName,email,phoneNumber
John,Doe,john@example.com,
Jane,Smith,jane@example.com,+1-555-0002`

    const result = parseCsv(csv)

    expect(result).toHaveLength(2)
    expect(result[0].phoneNumber).toBeUndefined()
    expect(result[0].isValid).toBe(true)
    expect(result[1].phoneNumber).toBe('+1-555-0002')
    expect(result[1].isValid).toBe(true)
  })

  it('should validate email format', () => {
    const csv = `firstName,lastName,email,phoneNumber
John,Doe,invalid-email,+1-555-0001
Jane,Smith,jane@example.com,+1-555-0002`

    const result = parseCsv(csv)

    expect(result).toHaveLength(2)
    expect(result[0].isValid).toBe(false)
    expect(result[0].errors).toContain('Invalid email format')
    expect(result[1].isValid).toBe(true)
  })

  it('should handle CSV with quoted values', () => {
    const csv = `firstName,lastName,email,phoneNumber,jobTitle
"John","Doe","john.doe@example.com","+1-555-0100","Software Engineer"`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].firstName).toBe('John')
    expect(result[0].lastName).toBe('Doe')
    expect(result[0].email).toBe('john.doe@example.com')
    expect(result[0].phoneNumber).toBe('+1-555-0100')
    expect(result[0].jobTitle).toBe('Software Engineer')
  })

  it('should skip empty rows', () => {
    const csv = `firstName,lastName,email,phoneNumber
John,Doe,john@example.com,+1-555-0001
,,,
Jane,Smith,jane@example.com,+1-555-0002`

    const result = parseCsv(csv)

    expect(result).toHaveLength(2)
    expect(result[0].firstName).toBe('John')
    expect(result[1].firstName).toBe('Jane')
  })

  it('should handle case-insensitive headers', () => {
    const csv = `FIRSTNAME,LASTNAME,EMAIL,PHONENUMBER,JOBTITLE,COUNTRYCODE,COMPANYNAME
John,Doe,john@example.com,+1-555-0100,Developer,US,Tech Corp`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].firstName).toBe('John')
    expect(result[0].lastName).toBe('Doe')
    expect(result[0].email).toBe('john@example.com')
    expect(result[0].phoneNumber).toBe('+1-555-0100')
    expect(result[0].jobTitle).toBe('Developer')
  })

  it('should handle missing optional fields', () => {
    const csv = `firstName,lastName,email,phoneNumber,jobTitle,countryCode,yearsInRole,linkedInProfile
John,Doe,john@example.com,+1-555-0100,,,,`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].jobTitle).toBeUndefined()
    expect(result[0].countryCode).toBeUndefined()
    expect(result[0].yearsInRole).toBeUndefined()
    expect(result[0].linkedInProfile).toBeUndefined()
    expect(result[0].isValid).toBe(true)
  })

  it('should preserve row index correctly', () => {
    const csv = `firstName,lastName,email,phoneNumber
John,Doe,john@example.com,+1-555-0001
Jane,Smith,jane@example.com,+1-555-0002
Bob,Johnson,bob@example.com,+1-555-0003`

    const result = parseCsv(csv)

    expect(result).toHaveLength(3)
    expect(result[0].rowIndex).toBe(2)
    expect(result[1].rowIndex).toBe(3)
    expect(result[2].rowIndex).toBe(4)
  })

  it('should handle multiple validation errors per lead', () => {
    const csv = `firstName,lastName,email,phoneNumber
 , ,invalid-email, `

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].isValid).toBe(false)
    expect(result[0].errors).toContain('First name is required')
    expect(result[0].errors).toContain('Last name is required')
    expect(result[0].errors).toContain('Invalid email format')
  })

  it('should handle extra columns not in header mapping', () => {
    const csv = `firstName,lastName,email,phoneNumber,unknownColumn
John,Doe,john@example.com,+1-555-0100,someValue`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].firstName).toBe('John')
    expect(result[0].lastName).toBe('Doe')
    expect(result[0].email).toBe('john@example.com')
    expect(result[0].phoneNumber).toBe('+1-555-0100')
    expect(result[0].isValid).toBe(true)
  })

  it('should handle mixed valid and invalid leads', () => {
    const csv = `firstName,lastName,email,phoneNumber
John,Doe,john@example.com,+1-555-0001
,Smith,invalid-email,+1-555-0002
Jane,Johnson,jane@example.com,+1-555-0003`

    const result = parseCsv(csv)

    expect(result).toHaveLength(3)
    expect(result[0].isValid).toBe(true)
    expect(result[1].isValid).toBe(false)
    expect(result[1].errors).toContain('First name is required')
    expect(result[1].errors).toContain('Invalid email format')
    expect(result[2].isValid).toBe(true)
  })

  it('should handle whitespace in fields', () => {
    const csv = `firstName,lastName,email,phoneNumber
 John , Doe , john@example.com , +1-555-0100 `

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].firstName).toBe('John')
    expect(result[0].lastName).toBe('Doe')
    expect(result[0].email).toBe('john@example.com')
    expect(result[0].phoneNumber).toBe('+1-555-0100')
    expect(result[0].isValid).toBe(true)
  })

  it('should strip a leading UTF-8 BOM before parsing headers', () => {
    const csv = `﻿firstName,lastName,email,phoneNumber,countryCode
John,Doe,john@example.com,+1-555-0100,US`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].firstName).toBe('John')
    expect(result[0].countryCode).toBe('US')
    expect(result[0].isValid).toBe(true)
  })

  it('should normalize lowercase and padded country codes to uppercase alpha-2', () => {
    const csv = `firstName,lastName,email,phoneNumber,countryCode
Jane,Smith,jane@example.com,+1-555-0001, us
John,Doe,john@example.com,+1-555-0002,gb`

    const result = parseCsv(csv)

    expect(result).toHaveLength(2)
    expect(result[0].countryCode).toBe('US')
    expect(result[1].countryCode).toBe('GB')
    expect(result[0].isValid).toBe(true)
    expect(result[1].isValid).toBe(true)
  })

  it('should drop invalid country codes and record a non-blocking warning', () => {
    const csv = `firstName,lastName,email,phoneNumber,countryCode
Jane,Smith,jane@example.com,+1-555-0001,USA
John,Doe,john@example.com,+1-555-0002,1!
Bob,Brown,bob@example.com,+1-555-0003,ZZ`

    const result = parseCsv(csv)

    expect(result).toHaveLength(3)
    for (const row of result) {
      expect(row.countryCode).toBeUndefined()
      expect(row.isValid).toBe(true)
      expect(row.errors.some((e) => e.startsWith('Invalid country code'))).toBe(true)
    }
  })

  it('should leave empty country code as undefined with no warning', () => {
    const csv = `firstName,lastName,email,phoneNumber,countryCode
Jane,Smith,jane@example.com,+1-555-0001,`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].countryCode).toBeUndefined()
    expect(result[0].errors).toEqual([])
    expect(result[0].isValid).toBe(true)
  })

  it('should parse yearsInRole as an integer', () => {
    const csv = `firstName,lastName,email,phoneNumber,yearsInRole
Jane,Smith,jane@example.com,+1-555-0001,7`

    const result = parseCsv(csv)

    expect(result[0].yearsInRole).toBe(7)
    expect(result[0].isValid).toBe(true)
  })

  it('should preserve yearsInRole = 0 (not coerce to undefined)', () => {
    const csv = `firstName,lastName,email,phoneNumber,yearsInRole
Jane,Smith,jane@example.com,+1-555-0001,0`

    const result = parseCsv(csv)

    expect(result[0].yearsInRole).toBe(0)
    expect(result[0].isValid).toBe(true)
  })

  it('should drop non-numeric yearsInRole with a non-blocking warning', () => {
    const csv = `firstName,lastName,email,phoneNumber,yearsInRole
Jane,Smith,jane@example.com,+1-555-0001,abc
Bob,Brown,bob@example.com,+1-555-0002,-3`

    const result = parseCsv(csv)

    expect(result).toHaveLength(2)
    for (const row of result) {
      expect(row.yearsInRole).toBeUndefined()
      expect(row.isValid).toBe(true)
      expect(row.errors.some((e) => e.startsWith('Invalid yearsInRole'))).toBe(true)
    }
  })

  it('should capture linkedInProfile as a free-form string', () => {
    const csv = `firstName,lastName,email,phoneNumber,linkedInProfile
Jane,Smith,jane@example.com,+1-555-0001,https://www.linkedin.com/in/jane-smith`

    const result = parseCsv(csv)

    expect(result[0].linkedInProfile).toBe('https://www.linkedin.com/in/jane-smith')
    expect(result[0].isValid).toBe(true)
  })
})
