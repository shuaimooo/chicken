import { Hono } from 'hono'

type Bindings = { DB: D1Database }
const app = new Hono<{ Bindings: Bindings }>()

app.get('/', async (c) => {
  const db = c.env.DB
  const { results } = await db.prepare('SELECT * FROM suppliers WHERE active=1 ORDER BY code').all()
  return c.json(results)
})

app.post('/', async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  const { code, name, contact, phone, bank, account, note } = body
  if (!code || !name) return c.json({ error: '代碼與名稱必填' }, 400)
  const result = await db.prepare(
    'INSERT INTO suppliers (code, name, contact, phone, bank, account, note) VALUES (?,?,?,?,?,?,?)'
  ).bind(code, name, contact||null, phone||null, bank||null, account||null, note||null).run()
  return c.json({ success: true, id: result.meta.last_row_id })
})

app.put('/:id', async (c) => {
  const db = c.env.DB
  const { id } = c.req.param()
  const body = await c.req.json()
  const { name, contact, phone, bank, account, note } = body
  await db.prepare(
    'UPDATE suppliers SET name=?, contact=?, phone=?, bank=?, account=?, note=? WHERE id=?'
  ).bind(name, contact||null, phone||null, bank||null, account||null, note||null, id).run()
  return c.json({ success: true })
})

app.delete('/:id', async (c) => {
  const db = c.env.DB
  const { id } = c.req.param()
  await db.prepare('UPDATE suppliers SET active=0 WHERE id=?').bind(id).run()
  return c.json({ success: true })
})

export default app
