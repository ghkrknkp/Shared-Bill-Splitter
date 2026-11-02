import { Hono } from 'hono'

export const membersRoute = new Hono<{ Bindings: Env }>()

membersRoute.post('/api/homes/:homeId/members', async (c) => {
  const homeId = c.req.param('homeId')
  const body = await c.req.json<{ name?: unknown }>()
  const name = body.name

  if (typeof name !== 'string' || name.trim() === '') {
    return c.json({ error: 'name is required' }, 422)
  }

  // Check if home exists
  const home = await c.env.DB.prepare('SELECT id FROM homes WHERE id = ?').bind(homeId).first()
  if (!home) {
    return c.json({ error: 'home not found' }, 404)
  }

  const id = crypto.randomUUID()

  // Get the next position for this home
  const countResult = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM members WHERE home_id = ?',
  )
    .bind(homeId)
    .first<{ count: number }>()
  const position = countResult?.count ?? 0

  await c.env.DB.prepare('INSERT INTO members (id, home_id, name, position) VALUES (?, ?, ?, ?)')
    .bind(id, homeId, name, position)
    .run()

  return c.json({ id, homeId, name }, 201)
})
