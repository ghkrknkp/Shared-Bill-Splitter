import { Hono } from 'hono'

export const paymentsRoute = new Hono<{ Bindings: Env }>()

paymentsRoute.post('/api/bills/:billId/shares/:shareId/pay', async (c) => {
  const billId = c.req.param('billId')
  const shareId = c.req.param('shareId')
  const idempotencyKey = c.req.header('Idempotency-Key')

  // Check for required Idempotency-Key header
  if (!idempotencyKey) {
    return c.json({ error: 'Idempotency-Key header is required' }, 400)
  }

  // Check if bill exists
  const bill = await c.env.DB.prepare('SELECT id FROM bills WHERE id = ?').bind(billId).first()
  if (!bill) {
    return c.json({ error: 'bill not found' }, 404)
  }

  // Check if share exists and belongs to this bill
  const share = await c.env.DB.prepare(
    'SELECT id, bill_id, member_id, amount_cents, paid_at, idempotency_key FROM shares WHERE id = ? AND bill_id = ?',
  )
    .bind(shareId, billId)
    .first<{
      id: string
      bill_id: string
      member_id: string
      amount_cents: number
      paid_at: string | null
      idempotency_key: string | null
    }>()

  if (!share) {
    return c.json({ error: 'share not found' }, 404)
  }

  // If already paid
  if (share.paid_at !== null) {
    // Same key = idempotent success
    if (share.idempotency_key === idempotencyKey) {
      return c.json(
        {
          id: share.id,
          memberId: share.member_id,
          amountCents: share.amount_cents,
          paidAt: share.paid_at,
        },
        200,
      )
    }
    // Different key = conflict
    return c.json({ error: 'share already paid with a different key' }, 409)
  }

  // Pay the share - use UPDATE with WHERE paid_at IS NULL for concurrency safety
  const now = new Date().toISOString()
  const result = await c.env.DB.prepare(
    'UPDATE shares SET paid_at = ?, idempotency_key = ? WHERE id = ? AND bill_id = ? AND paid_at IS NULL',
  )
    .bind(now, idempotencyKey, shareId, billId)
    .run()

  // If no rows updated, another request got there first - re-read and check key
  if (result.meta.changes === 0) {
    const updated = await c.env.DB.prepare(
      'SELECT id, member_id, amount_cents, paid_at, idempotency_key FROM shares WHERE id = ? AND bill_id = ?',
    )
      .bind(shareId, billId)
      .first<{
        id: string
        member_id: string
        amount_cents: number
        paid_at: string | null
        idempotency_key: string | null
      }>()

    if (updated && updated.idempotency_key === idempotencyKey) {
      return c.json(
        {
          id: updated.id,
          memberId: updated.member_id,
          amountCents: updated.amount_cents,
          paidAt: updated.paid_at,
        },
        200,
      )
    }
    return c.json({ error: 'share already paid with a different key' }, 409)
  }

  return c.json(
    {
      id: share.id,
      memberId: share.member_id,
      amountCents: share.amount_cents,
      paidAt: now,
    },
    200,
  )
})
