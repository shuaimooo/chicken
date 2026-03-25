import { Hono } from 'hono'

type Bindings = { DB: D1Database }
const app = new Hono<{ Bindings: Bindings }>()

app.get('/', async (c) => {
  const db = c.env.DB
  const { month, year, supplier_id, status } = c.req.query()
  let sql = 'SELECT * FROM purchases WHERE 1=1'
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
  if (supplier_id) { sql += ' AND supplier_id=?'; params.push(supplier_id) }
  if (status) { sql += ' AND payment_status=?'; params.push(status) }
  sql += ' ORDER BY date DESC, id DESC LIMIT 500'
  const { results } = await db.prepare(sql).bind(...params).all()
  return c.json(results)
})

app.post('/', async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  const { date, batch_no, supplier_id, supplier_name, product_id, product_name, category,
    spec, total_weight, unit, quantity, qty_unit, cost_price, sell_price, total_amount, payment_status, note } = body
  if (!date || !quantity) return c.json({ error: '日期和數量必填' }, 400)
  const calc_total = total_amount || ((cost_price || 0) * (quantity || 0))
  const result = await db.prepare(
    `INSERT INTO purchases (date, batch_no, supplier_id, supplier_name, product_id, product_name, category,
    spec, total_weight, unit, quantity, qty_unit, cost_price, sell_price, total_amount, payment_status, note)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(date, batch_no||null, supplier_id||null, supplier_name||null, product_id||null, product_name||null,
    category||null, spec||null, total_weight||null, unit||null, quantity, qty_unit||'隻',
    cost_price||null, sell_price||null, calc_total, payment_status||'未付', note||null).run()
  return c.json({ success: true, id: result.meta.last_row_id })
})

app.put('/:id', async (c) => {
  const db = c.env.DB
  const { id } = c.req.param()
  const body = await c.req.json()
  const { date, batch_no, supplier_id, supplier_name, product_id, product_name, category,
    spec, total_weight, unit, quantity, qty_unit, cost_price, sell_price, total_amount, payment_status, note } = body
  await db.prepare(
    `UPDATE purchases SET date=?, batch_no=?, supplier_id=?, supplier_name=?, product_id=?, product_name=?,
    category=?, spec=?, total_weight=?, unit=?, quantity=?, qty_unit=?, cost_price=?, sell_price=?,
    total_amount=?, payment_status=?, note=? WHERE id=?`
  ).bind(date, batch_no||null, supplier_id||null, supplier_name||null, product_id||null, product_name||null,
    category||null, spec||null, total_weight||null, unit||null, quantity, qty_unit||'隻',
    cost_price||null, sell_price||null, total_amount||null, payment_status||'未付', note||null, id).run()
  return c.json({ success: true })
})

app.delete('/:id', async (c) => {
  const db = c.env.DB
  const { id } = c.req.param()
  await db.prepare('DELETE FROM purchases WHERE id=?').bind(id).run()
  return c.json({ success: true })
})

// Update payment status
app.patch('/:id/pay', async (c) => {
  const db = c.env.DB
  const { id } = c.req.param()
  const body = await c.req.json()
  await db.prepare('UPDATE purchases SET payment_status=? WHERE id=?').bind(body.status || '已付', id).run()
  return c.json({ success: true })
})

// Stats summary
app.get('/stats/summary', async (c) => {
  const db = c.env.DB
  const { year } = c.req.query()
  const y = year || new Date().getFullYear().toString()
  const { results } = await db.prepare(
    `SELECT supplier_name, COUNT(*) as cnt, SUM(total_amount) as total, SUM(CASE WHEN payment_status='未付' THEN total_amount ELSE 0 END) as unpaid
    FROM purchases WHERE date >= ? AND date <= ? GROUP BY supplier_name ORDER BY total DESC`
  ).bind(`${y}-01-01`, `${y}-12-31`).all()
  return c.json(results)
})

export default app
