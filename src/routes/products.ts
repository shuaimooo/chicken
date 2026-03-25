import { Hono } from 'hono'

type Bindings = { DB: D1Database }
const app = new Hono<{ Bindings: Bindings }>()

app.get('/', async (c) => {
  const db = c.env.DB
  const { results } = await db.prepare('SELECT * FROM products WHERE active=1 ORDER BY category, code').all()
  return c.json(results)
})

app.post('/', async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  const { code, name, category, unit, note } = body
  if (!code || !name || !category) return c.json({ error: '代碼、名稱、類別必填' }, 400)
  const result = await db.prepare(
    'INSERT INTO products (code, name, category, unit, note) VALUES (?,?,?,?,?)'
  ).bind(code, name, category, unit||'斤', note||null).run()
  return c.json({ success: true, id: result.meta.last_row_id })
})

app.put('/:id', async (c) => {
  const db = c.env.DB
  const { id } = c.req.param()
  const body = await c.req.json()
  const { name, category, unit, note } = body
  await db.prepare(
    'UPDATE products SET name=?, category=?, unit=?, note=? WHERE id=?'
  ).bind(name, category, unit||'斤', note||null, id).run()
  return c.json({ success: true })
})

app.delete('/:id', async (c) => {
  const db = c.env.DB
  const { id } = c.req.param()
  await db.prepare('UPDATE products SET active=0 WHERE id=?').bind(id).run()
  return c.json({ success: true })
})

export default app
