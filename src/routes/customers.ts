import { Hono } from 'hono'

type Bindings = { DB: D1Database }
const app = new Hono<{ Bindings: Bindings }>()

app.get('/', async (c) => {
  const db = c.env.DB
  const { results } = await db.prepare('SELECT * FROM customers WHERE active=1 ORDER BY code').all()
  return c.json(results)
})

app.get('/:id', async (c) => {
  const db = c.env.DB
  const { id } = c.req.param()
  const result = await db.prepare('SELECT * FROM customers WHERE id=?').bind(id).first()
  if (!result) return c.json({ error: '找不到客戶' }, 404)
  return c.json(result)
})

app.post('/', async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  const { code, name, contact, phone, company, address, payment_cycle, note } = body
  if (!code || !name) return c.json({ error: '代碼與名稱必填' }, 400)
  const result = await db.prepare(
    'INSERT INTO customers (code, name, contact, phone, company, address, payment_cycle, note) VALUES (?,?,?,?,?,?,?,?)'
  ).bind(code, name, contact||null, phone||null, company||null, address||null, payment_cycle||'月結', note||null).run()
  return c.json({ success: true, id: result.meta.last_row_id })
})

app.put('/:id', async (c) => {
  const db = c.env.DB
  const { id } = c.req.param()
  const body = await c.req.json()
  const { name, contact, phone, company, address, payment_cycle, note } = body
  await db.prepare(
    'UPDATE customers SET name=?, contact=?, phone=?, company=?, address=?, payment_cycle=?, note=? WHERE id=?'
  ).bind(name, contact||null, phone||null, company||null, address||null, payment_cycle||'月結', note||null, id).run()
  return c.json({ success: true })
})

app.delete('/:id', async (c) => {
  const db = c.env.DB
  const { id } = c.req.param()
  await db.prepare('UPDATE customers SET active=0 WHERE id=?').bind(id).run()
  return c.json({ success: true })
})

export default app
