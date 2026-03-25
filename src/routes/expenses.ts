import { Hono } from 'hono'

type Bindings = { DB: D1Database }
const app = new Hono<{ Bindings: Bindings }>()

app.get('/', async (c) => {
  const db = c.env.DB
  const { month, year, category } = c.req.query()
  let sql = 'SELECT * FROM expenses WHERE 1=1'
  const params: any[] = []
  if (year && month) {
    sql += ` AND date >= ? AND date <= ?`
    params.push(`${year}-${month.padStart(2,'0')}-01`)
    params.push(`${year}-${month.padStart(2,'0')}-31`)
  } else if (year) {
    sql += ` AND date >= ? AND date <= ?`
    params.push(`${year}-01-01`)
    params.push(`${year}-12-31`)
  }
  if (category) { sql += ' AND category=?'; params.push(category) }
  sql += ' ORDER BY date DESC LIMIT 500'
  const { results } = await db.prepare(sql).bind(...params).all()
  return c.json(results)
})

app.get('/stats/monthly', async (c) => {
  const db = c.env.DB
  const { year } = c.req.query()
  const y = year || new Date().getFullYear().toString()
  const { results } = await db.prepare(
    `SELECT strftime('%m', date) as month, category, SUM(amount) as total
    FROM expenses WHERE date >= ? AND date <= ?
    GROUP BY strftime('%m', date), category ORDER BY month`
  ).bind(`${y}-01-01`, `${y}-12-31`).all()
  return c.json(results)
})

app.post('/', async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  const { date, category, amount, description, destination, note, payment_status } = body
  if (!date || !category || !amount) return c.json({ error: '日期、類別、金額必填' }, 400)
  const result = await db.prepare(
    'INSERT INTO expenses (date, category, amount, description, destination, note, payment_status) VALUES (?,?,?,?,?,?,?)'
  ).bind(date, category, amount, description||null, destination||null, note||null, payment_status||'已付').run()
  return c.json({ success: true, id: result.meta.last_row_id })
})

app.put('/:id', async (c) => {
  const db = c.env.DB
  const { id } = c.req.param()
  const body = await c.req.json()
  const { date, category, amount, description, destination, note, payment_status } = body
  await db.prepare(
    'UPDATE expenses SET date=?, category=?, amount=?, description=?, destination=?, note=?, payment_status=? WHERE id=?'
  ).bind(date, category, amount, description||null, destination||null, note||null, payment_status||'已付', id).run()
  return c.json({ success: true })
})

app.delete('/:id', async (c) => {
  const db = c.env.DB
  const { id } = c.req.param()
  await db.prepare('DELETE FROM expenses WHERE id=?').bind(id).run()
  return c.json({ success: true })
})

export default app
