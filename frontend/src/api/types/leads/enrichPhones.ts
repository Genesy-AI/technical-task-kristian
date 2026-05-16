export type LeadsEnrichPhonesInput = {
  leadIds: number[]
}

export type LeadsEnrichPhonesOutput = {
  success: boolean
  enrichedCount: number
  notFoundCount: number
  results: Array<{
    leadId: number
    phone: string | null
    provider: 'astra' | 'nimbus' | 'orion' | null
  }>
  errors: Array<{
    leadId: number
    leadName: string
    error: string
  }>
}
