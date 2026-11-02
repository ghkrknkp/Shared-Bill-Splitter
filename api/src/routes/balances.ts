import { Hono } from 'hono'

export const balancesRoute = new Hono<{ Bindings: Env }>()

balancesRoute.get('/api/homes/:homeId/balances', async (c) => {
  const homeId = c.req.param('homeId')

  // Check if home exists
  const home = await c.env.DB.prepare('SELECT id FROM homes WHERE id = ?').bind(homeId).first()
  if (!home) {
    return c.json({ error: 'home not found' }, 404)
  }

  // Get members with their outstanding balances, ordered by position
  const result = await c.env.DB.prepare(
    `SELECT
       m.id AS memberId,
       m.name,
       COALESCE(SUM(CASE WHEN s.paid_at IS NULL THEN s.amount_cents ELSE 0 END), 0) AS outstandingCents
     FROM members m
     LEFT JOIN shares s ON s.member_id = m.id
     WHERE m.home_id = ?
     GROUP BY m.id, m.name, m.position
     ORDER BY m.position ASC`,
  )
    .bind(homeId)
    .all<{ memberId: string; name: string; outstandingCents: number }>()

  return c.json({ balances: result.results }, 200)
})
