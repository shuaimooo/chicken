import { Hono } from 'hono'

type Bindings = { DB: D1Database }
const app = new Hono<{ Bindings: Bindings }>()

app.get('/', async (c) => {
  const db = c.env.DB
  const { month, year } = c.req.query()
  let sql = 'SELECT * FROM cashflow WHERE 1=1'
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
  sql += ' ORDER BY date DESC, id DESC LIMIT 500'
  const { results } = await db.prepare(sql).bind(...params).all()
  return c.json(results)
})

app.post('/', async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  const { date, flow_no, description, income, expense, party, category, ref_type, ref_id, note } = body
  if (!date || !description) return c.json({ error: '日期和摘要必填' }, 400)
  // Calculate running balance
  const last = await db.prepare('SELECT balance FROM cashflow ORDER BY date DESC, id DESC LIMIT 1').first() as any
  const prev_balance = last ? (last.balance || 0) : 0
  const balance = prev_balance + (parseFloat(income)||0) - (parseFloat(expense)||0)
  const result = await db.prepare(
    `INSERT INTO cashflow (date, flow_no, description, income, expense, balance, party, category, ref_type, ref_id, note)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(date, flow_no||null, description, parseFloat(income)||0, parseFloat(expense)||0, balance,
    party||null, category||null, ref_type||null, ref_id||null, note||null).run()
  return c.json({ success: true, id: result.meta.last_row_id, balance })
})

app.put('/:id', async (c) => {
  const db = c.env.DB
  const { id } = c.req.param()
  const body = await c.req.json()
  const { date, flow_no, description, income, expense, party, category, note } = body
  await db.prepare(
    `UPDATE cashflow SET date=?, flow_no=?, description=?, income=?, expense=?, party=?, category=?, note=? WHERE id=?`
  ).bind(date, flow_no||null, description, parseFloat(income)||0, parseFloat(expense)||0,
    party||null, category||null, note||null, id).run()
  return c.json({ success: true })
})

app.delete('/:id', async (c) => {
  const db = c.env.DB
  const { id } = c.req.param()
  await db.prepare('DELETE FROM cashflow WHERE id=?').bind(id).run()
  return c.json({ success: true })
})

export default app
