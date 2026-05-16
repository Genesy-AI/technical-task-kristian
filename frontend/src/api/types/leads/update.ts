export type LeadsUpdateInput = {
  id: number
  firstName: string
  lastName: string
  email: string
  yearsInRole?: number
  phoneNumber?: string
  linkedInProfile?: string
}

export type LeadsUpdateOutput = void
