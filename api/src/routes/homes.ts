import { Hono } from 'hono'

export const homesRoute = new Hono<{ Bindings: Env }>()

homesRoute.post('/api/homes', async (c) => {
  const body = await c.req.json<{ name?: unknown }>()
  const name = body.name

  if (typeof name !== 'string' || name.trim() === '') {
    return c.json({ error: 'name is required' }, 422)
  }

  const id = crypto.randomUUID()

  await c.env.DB.prepare('INSERT INTO homes (id, name) VALUES (?, ?)').bind(id, name).run()

  return c.json({ id, name }, 201)
})
