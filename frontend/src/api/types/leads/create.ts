export type LeadsCreateInput = {
  firstName: string
  lastName: string
  email: string
  phoneNumber?: string
  yearsInRole?: number
  linkedInProfile?: string
}

export type LeadsCreateOutput = {
  id: number
  firstName: string
  lastName: string
  email: string
  phoneNumber?: string
  yearsInRole?: number
  linkedInProfile?: string
}
