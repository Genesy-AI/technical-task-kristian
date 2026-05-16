export interface LeadsBulkImportInput {
  leads: {
    firstName: string
    lastName: string
    email: string
    phoneNumber?: string
    jobTitle?: string
    countryCode?: string
    companyName?: string
    yearsInRole?: number
    linkedInProfile?: string
  }[]
}

export interface LeadsBulkImportOutput {
  success: boolean
  importedCount: number
  duplicatesSkipped: number
  invalidLeads: number
  errors: Array<{
    lead: any
    error: string
  }>
}
