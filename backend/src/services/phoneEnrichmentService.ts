import axios, { AxiosInstance } from 'axios'

const BASE_URL = 'https://api.enginy.ai'

export type EnrichResult = { phone: string | null }

const client: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 8000,
})

export async function orionConnectEnrich(
  fullName: string,
  companyWebsite: string
): Promise<EnrichResult> {
  const { data } = await client.post<{ phone: string | null }>(
    '/api/tmp/orionConnect',
    { fullName, companyWebsite },
    { headers: { 'x-auth-me': 'mySecretKey123' } }
  )
  return { phone: data?.phone ?? null }
}

export async function astraDialerEnrich(email: string): Promise<EnrichResult> {
  const { data } = await client.post<{ phoneNmbr: string | null | undefined }>(
    '/api/tmp/astraDialer',
    { email },
    { headers: { apiKey: '1234jhgf' } }
  )
  return { phone: data?.phoneNmbr ?? null }
}

export async function nimbusLookupEnrich(
  email: string,
  jobTitle: string | null
): Promise<EnrichResult> {
  const { data } = await client.post<{ number: number; countryCode: string } | null>(
    '/api/tmp/numbusLookup',
    { email, jobTitle },
    { params: { api: '000099998888' } }
  )
  if (!data?.number) return { phone: null }
  return { phone: `+${data.countryCode}${data.number}` }
}
