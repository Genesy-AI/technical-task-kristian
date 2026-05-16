import { PrismaClient } from '@prisma/client'
import express, { Request, Response } from 'express'
import { Connection, Client } from '@temporalio/client'
import { verifyEmailWorkflow, enrichPhoneNumberWorkflow } from './workflows'
import { generateMessageFromTemplate } from './utils/messageGenerator'
import { runTemporalWorker } from './worker'
import { normalizeCountryCode } from './utils/country'
const prisma = new PrismaClient()
const app = express()
app.use(express.json())

app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')

  if (req.method === 'OPTIONS') {
    res.sendStatus(200)
    return
  }

  next()
})

app.post('/leads', async (req: Request, res: Response) => {
  const { name, lastName, email, yearsInRole, phoneNumber, linkedInProfile } = req.body

  if (!name || !lastName || !email) {
    return res.status(400).json({ error: 'firstName, lastName, and email are required' })
  }

  const lead = await prisma.lead.create({
    data: {
      firstName: String(name),
      lastName: String(lastName),
      email: String(email),
      yearsInRole: yearsInRole ? Number(yearsInRole) : null,
      phoneNumber: phoneNumber ? String(phoneNumber).trim() : null,
      linkedInProfile: linkedInProfile ? String(linkedInProfile).trim() : null,
    },
  })
  res.json(lead)
})

app.get('/leads/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  const lead = await prisma.lead.findUnique({
    where: {
      id: Number(id),
    },
  })
  res.json(lead)
})

app.get('/leads', async (req: Request, res: Response) => {
  const leads = await prisma.lead.findMany()

  res.json(leads)
})

app.patch('/leads/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  const { name, email, yearsInRole, phoneNumber, linkedInProfile } = req.body
  const lead = await prisma.lead.update({
    where: {
      id: Number(id),
    },
    data: {
      firstName: String(name),
      email: String(email),
      yearsInRole: yearsInRole ? Number(yearsInRole) : null,
      phoneNumber: phoneNumber ? String(phoneNumber).trim() : null,
      linkedInProfile: linkedInProfile ? String(linkedInProfile).trim() : null,
    },
  })
  res.json(lead)
})

app.delete('/leads/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  await prisma.lead.delete({
    where: {
      id: Number(id),
    },
  })
  res.json()
})

app.delete('/leads', async (req: Request, res: Response) => {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Request body is required and must be valid JSON' })
  }

  const { ids } = req.body

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids must be a non-empty array' })
  }

  try {
    const result = await prisma.lead.deleteMany({
      where: {
        id: {
          in: ids.map((id) => Number(id)),
        },
      },
    })

    res.json({ deletedCount: result.count })
  } catch (error) {
    console.error('Error deleting leads:', error)
    res.status(500).json({ error: 'Failed to delete leads' })
  }
})

app.post('/leads/generate-messages', async (req: Request, res: Response) => {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Request body is required and must be valid JSON' })
  }

  const { leadIds, template } = req.body

  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    return res.status(400).json({ error: 'leadIds must be a non-empty array' })
  }

  if (!template || typeof template !== 'string') {
    return res.status(400).json({ error: 'template must be a non-empty string' })
  }

  try {
    const leads = await prisma.lead.findMany({
      where: {
        id: {
          in: leadIds.map((id) => Number(id)),
        },
      },
    })

    if (leads.length === 0) {
      return res.status(404).json({ error: 'No leads found with the provided IDs' })
    }

    let generatedCount = 0
    const errors: Array<{ leadId: number; leadName: string; error: string }> = []

    for (const lead of leads) {
      try {
        const message = generateMessageFromTemplate(template, lead)

        await prisma.lead.update({
          where: { id: lead.id },
          data: { message },
        })

        generatedCount++
      } catch (error) {
        errors.push({
          leadId: lead.id,
          leadName: `${lead.firstName} ${lead.lastName}`.trim(),
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    res.json({
      success: true,
      generatedCount,
      errors,
    })
  } catch (error) {
    console.error('Error generating messages:', error)
    res.status(500).json({ error: 'Failed to generate messages' })
  }
})

app.post('/leads/bulk', async (req: Request, res: Response) => {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Request body is required and must be valid JSON' })
  }

  const { leads } = req.body

  if (!Array.isArray(leads) || leads.length === 0) {
    return res.status(400).json({ error: 'leads must be a non-empty array' })
  }

  try {
    const validLeads = leads.filter((lead) => {
      return (
        lead.firstName &&
        lead.lastName &&
        lead.email &&
        typeof lead.firstName === 'string' &&
        lead.firstName.trim() &&
        typeof lead.lastName === 'string' &&
        lead.lastName.trim() &&
        typeof lead.email === 'string' &&
        lead.email.trim()
      )
    })

    if (validLeads.length === 0) {
      return res
        .status(400)
        .json({ error: 'No valid leads found. firstName, lastName, and email are required.' })
    }

    const existingLeads = await prisma.lead.findMany({
      where: {
        OR: validLeads.map((lead) => ({
          AND: [{ firstName: lead.firstName.trim() }, { lastName: lead.lastName.trim() }],
        })),
      },
    })

    const leadKeys = new Set(
      existingLeads.map((lead) => `${lead.firstName.toLowerCase()}_${(lead.lastName || '').toLowerCase()}`)
    )

    const uniqueLeads = validLeads.filter((lead) => {
      const key = `${lead.firstName.toLowerCase()}_${lead.lastName.toLowerCase()}`
      return !leadKeys.has(key)
    })

    let importedCount = 0
    const errors: Array<{ lead: any; error: string }> = []

    for (const lead of uniqueLeads) {
      try {
        await prisma.lead.create({
          data: {
            firstName: lead.firstName.trim(),
            lastName: lead.lastName.trim(),
            email: lead.email.trim(),
            jobTitle: lead.jobTitle ? lead.jobTitle.trim() : null,
            countryCode: normalizeCountryCode(lead.countryCode),
            companyName: lead.companyName ? lead.companyName.trim() : null,
            yearsInRole:
              typeof lead.yearsInRole === 'number' && Number.isInteger(lead.yearsInRole) && lead.yearsInRole >= 0
                ? lead.yearsInRole
                : null,
            phoneNumber: lead.phoneNumber ? lead.phoneNumber.trim() : null,
            linkedInProfile: lead.linkedInProfile ? lead.linkedInProfile.trim() : null,
          },
        })
        importedCount++
      } catch (error) {
        errors.push({
          lead: lead,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    res.json({
      success: true,
      importedCount,
      duplicatesSkipped: validLeads.length - uniqueLeads.length,
      invalidLeads: leads.length - validLeads.length,
      errors,
    })
  } catch (error) {
    console.error('Error importing leads:', error)
    res.status(500).json({ error: 'Failed to import leads' })
  }
})

app.post('/leads/verify-emails', async (req: Request, res: Response) => {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Request body is required and must be valid JSON' })
  }

  const { leadIds } = req.body as { leadIds?: number[] }

  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    return res.status(400).json({ error: 'leadIds must be a non-empty array' })
  }

  try {
    const leads = await prisma.lead.findMany({
      where: { id: { in: leadIds.map((id) => Number(id)) } },
    })

    if (leads.length === 0) {
      return res.status(404).json({ error: 'No leads found with the provided IDs' })
    }

    const connection = await Connection.connect({ address: 'localhost:7233' })
    const client = new Client({ connection, namespace: 'default' })

    const settled = await Promise.allSettled(
      leads.map(async (lead) => {
        try {
          const isVerified = await client.workflow.execute(verifyEmailWorkflow, {
            taskQueue: 'myQueue',
            workflowId: `verify-email-${lead.id}-${Date.now()}`,
            args: [lead.email],
          })

          await prisma.lead.update({
            where: { id: lead.id },
            data: { emailVerified: Boolean(isVerified) },
          })

          return { ok: true as const, leadId: lead.id, emailVerified: isVerified }
        } catch (error) {
          await prisma.lead.update({
            where: { id: lead.id },
            data: { emailVerified: false },
          })
          return {
            ok: false as const,
            leadId: lead.id,
            leadName: `${lead.firstName} ${lead.lastName ?? ''}`.trim(),
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      })
    )

    await connection.close()

    const results = settled.flatMap((outcome) =>
      outcome.status === 'fulfilled' && outcome.value.ok
        ? [{ leadId: outcome.value.leadId, emailVerified: outcome.value.emailVerified }]
        : []
    )
    const errors = settled.flatMap((outcome) =>
      outcome.status === 'fulfilled' && !outcome.value.ok
        ? [{ leadId: outcome.value.leadId, leadName: outcome.value.leadName, error: outcome.value.error }]
        : []
    )

    res.json({ success: true, verifiedCount: results.length, results, errors })
  } catch (error) {
    console.error('Error verifying emails:', error)
    res.status(500).json({ error: 'Failed to verify emails' })
  }
})

app.post('/leads/enrich-phones', async (req: Request, res: Response) => {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Request body is required and must be valid JSON' })
  }

  const { leadIds } = req.body as { leadIds?: number[] }

  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    return res.status(400).json({ error: 'leadIds must be a non-empty array' })
  }

  try {
    const leads = await prisma.lead.findMany({
      where: { id: { in: leadIds.map((id) => Number(id)) } },
    })

    if (leads.length === 0) {
      return res.status(404).json({ error: 'No leads found with the provided IDs' })
    }

    const connection = await Connection.connect({ address: 'localhost:7233' })
    const client = new Client({ connection, namespace: 'default' })

    const settled = await Promise.allSettled(
      leads.map(async (lead) => {
        const out = await client.workflow.execute(enrichPhoneNumberWorkflow, {
          taskQueue: 'myQueue',
          workflowId: `enrich-phone-${lead.id}`,
          workflowIdReusePolicy: 'ALLOW_DUPLICATE',
          args: [{
            firstName: lead.firstName,
            lastName: lead.lastName,
            email: lead.email,
            companyWebsite: lead.companyName,
            jobTitle: lead.jobTitle,
          }],
        })

        if (out.phone) {
          await prisma.lead.update({
            where: { id: lead.id },
            data: { phoneNumber: out.phone },
          })
        }
        return { leadId: lead.id, phone: out.phone, provider: out.provider }
      })
    )

    await connection.close()

    const results = settled.flatMap((s) => (s.status === 'fulfilled' ? [s.value] : []))
    const errors = settled.flatMap((s, i) =>
      s.status === 'rejected'
        ? [{
            leadId: leads[i].id,
            leadName: `${leads[i].firstName} ${leads[i].lastName ?? ''}`.trim(),
            error: s.reason instanceof Error ? s.reason.message : 'Unknown error',
          }]
        : []
    )
    const enrichedCount = results.filter((r) => r.phone).length
    const notFoundCount = results.filter((r) => !r.phone).length

    res.json({ success: true, enrichedCount, notFoundCount, results, errors })
  } catch (error) {
    console.error('Error enriching phones:', error)
    res.status(500).json({ error: 'Failed to enrich phones' })
  }
})

app.listen(4000, () => {
  console.log('Express server is running on port 4000')
})

runTemporalWorker().catch((err) => {
  console.error(err)
  process.exit(1)
})
