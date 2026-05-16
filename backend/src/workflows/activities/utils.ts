import {
  orionConnectEnrich,
  astraDialerEnrich,
  nimbusLookupEnrich,
  type EnrichResult,
} from '../../services/phoneEnrichmentService'

export async function verifyEmail(email: string): Promise<boolean> {
    if (email.includes('john.doe')) {
        return false;
    }

    if (email.includes('jane.smith')) {
        await new Promise((resolve) => setTimeout(resolve, 20000));
    }

    if (/\+/.test(email)) {
        return false;
    }

    return true;
}

export async function enrichPhoneViaOrion(
  fullName: string,
  companyWebsite: string
): Promise<EnrichResult> {
  return orionConnectEnrich(fullName, companyWebsite)
}

export async function enrichPhoneViaAstra(email: string): Promise<EnrichResult> {
  return astraDialerEnrich(email)
}

export async function enrichPhoneViaNimbus(
  email: string,
  jobTitle: string | null
): Promise<EnrichResult> {
  return nimbusLookupEnrich(email, jobTitle)
}
