import { proxyActivities } from '@temporalio/workflow'
import type * as activities from './activities'

const { verifyEmail } = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 seconds',
  scheduleToCloseTimeout: '5 seconds',
  retry: { maximumAttempts: 1 },
})

// TODO: when providers add RPS/RPM limits, configure per-provider taskQueues and
// set maxConcurrentActivityTaskExecutions on each worker (or use a Resource semaphore).
const { enrichPhoneViaOrion, enrichPhoneViaAstra, enrichPhoneViaNimbus } = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 seconds',
  retry: {
    maximumAttempts: 3,
    initialInterval: '500ms',
    backoffCoefficient: 2,
    maximumInterval: '5 seconds',
  },
})

export async function verifyEmailWorkflow(email: string): Promise<boolean> {
  return await verifyEmail(email)
}

export type EnrichPhoneInput = {
  firstName: string
  lastName: string | null
  email: string
  companyWebsite: string | null
  jobTitle: string | null
}

export type EnrichPhoneOutput = {
  phone: string | null
  provider: 'astra' | 'nimbus' | 'orion' | null
}

export async function enrichPhoneNumberWorkflow(input: EnrichPhoneInput): Promise<EnrichPhoneOutput> {
  const fullName = [input.firstName, input.lastName].filter(Boolean).join(' ').trim()

  // 1. Astra — fastest, cheapest
  try {
    const { phone } = await enrichPhoneViaAstra(input.email)
    if (phone) return { phone, provider: 'astra' }
  } catch {
    // fall through to next provider
  }

  // 2. Nimbus — new, unknown reliability
  try {
    const { phone } = await enrichPhoneViaNimbus(input.email, input.jobTitle)
    if (phone) return { phone, provider: 'nimbus' }
  } catch {
    // fall through
  }

  // 3. Orion — slow but best data, last resort
  if (input.companyWebsite) {
    try {
      const { phone } = await enrichPhoneViaOrion(fullName, input.companyWebsite)
      if (phone) return { phone, provider: 'orion' }
    } catch {
      // give up
    }
  }

  return { phone: null, provider: null }
}
