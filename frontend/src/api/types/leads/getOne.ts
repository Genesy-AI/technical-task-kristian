export type LeadsGetOneInput = {
  id: number
}

export type LeadsGetOneOutput = {
  id: number
  firstName: string
  lastName: string
  email: string
  phoneNumber?: string
  yearsInRole?: number
  linkedInProfile?: string
}
