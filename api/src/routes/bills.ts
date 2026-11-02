import { Hono } from 'hono'

export const billsRoute = new Hono<{ Bindings: Env }>()

billsRoute.post('/api/homes/:homeId/bills', async (c) => {
  const homeId = c.req.param('homeId')
  const body = await c.req.json<{ title?: unknown; totalCents?: unknown }>()
  const { title, totalCents } = body

  // Check if home exists
  const home = await c.env.DB.prepare('SELECT id FROM homes WHERE id = ?').bind(homeId).first()
  if (!home) {
    return c.json({ error: 'home not found' }, 404)
  }

  // Validate totalCents: must be a positive integer
  if (typeof totalCents !== 'number' || !Number.isInteger(totalCents) || totalCents <= 0) {
    return c.json({ error: 'totalCents must be a positive whole number' }, 422)
  }

  if (typeof title !== 'string' || title.trim() === '') {
    return c.json({ error: 'title is required' }, 422)
  }

  // Get members in order
  const membersResult = await c.env.DB.prepare(
    'SELECT id, home_id, name FROM members WHERE home_id = ? ORDER BY position ASC',
  )
    .bind(homeId)
    .all<{ id: string; home_id: string; name: string }>()

  const members = membersResult.results

  if (members.length === 0) {
    return c.json({ error: 'home has no members' }, 422)
  }

  // Split the bill
  const baseAmount = Math.floor(totalCents / members.length)
  const remainder = totalCents - baseAmount * members.length

  const billId = crypto.randomUUID()

  // Build shares
  const shares: Array<{
    id: string
    memberId: string
    amountCents: number
    paidAt: null
  }> = []

  const statements = [
    c.env.DB.prepare(
      'INSERT INTO bills (id, home_id, title, total_cents) VALUES (?, ?, ?, ?)',
    ).bind(billId, homeId, title, totalCents),
  ]

  for (let i = 0; i < members.length; i++) {
    const member = members[i]
    if (!member) continue
    const extra = i < remainder ? 1 : 0
    const amountCents = baseAmount + extra
    const shareId = crypto.randomUUID()

    shares.push({
      id: shareId,
      memberId: member.id,
      amountCents,
      paidAt: null,
    })

    statements.push(
      c.env.DB.prepare(
        'INSERT INTO shares (id, bill_id, member_id, amount_cents, paid_at, idempotency_key) VALUES (?, ?, ?, ?, NULL, NULL)',
      ).bind(shareId, billId, member.id, amountCents),
    )
  }

  // Execute all in a batch (transactional in D1)
  await c.env.DB.batch(statements)

  return c.json(
    {
      id: billId,
      homeId,
      title,
      totalCents,
      shares,
    },
    201,
  )
})
