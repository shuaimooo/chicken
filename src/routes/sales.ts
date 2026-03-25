import { Hono } from 'hono'

type Bindings = { DB: D1Database }
const app = new Hono<{ Bindings: Bindings }>()

app.get('/', async (c) => {
  const db = c.env.DB
  const { month, year, customer_id, status, limit } = c.req.query()
  let sql = 'SELECT * FROM sales WHERE 1=1'
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
  if (customer_id) { sql += ' AND customer_id=?'; params.push(customer_id) }
  if (status) { sql += ' AND payment_status=?'; params.push(status) }
  sql += ` ORDER BY date DESC, id DESC LIMIT ${parseInt(limit||'500')}`
  const { results } = await db.prepare(sql).bind(...params).all()
  return c.json(results)
})

app.post('/', async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  const { date, customer_id, customer_name, product_id, product_name, category,
    spec, unit, quantity, qty_unit, unit_price, total_amount, payment_status, payment_date, payment_cycle, note } = body
  if (!date || !customer_name || !product_name || !quantity || !unit_price)
    return c.json({ error: '日期、客戶、商品、數量、單價必填' }, 400)
  const calc_total = total_amount || (unit_price * quantity)
  const result = await db.prepare(
    `INSERT INTO sales (date, customer_id, customer_name, product_id, product_name, category,
    spec, unit, quantity, qty_unit, unit_price, total_amount, payment_status, payment_date, payment_cycle, note)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(date, customer_id||null, customer_name, product_id||null, product_name, category||null,
    spec||null, unit||null, quantity, qty_unit||'隻', unit_price, calc_total,
    payment_status||'待付款', payment_date||null, payment_cycle||null, note||null).run()
  return c.json({ success: true, id: result.meta.last_row_id })
})

app.put('/:id', async (c) => {
  const db = c.env.DB
  const { id } = c.req.param()
  const body = await c.req.json()
  const { date, customer_id, customer_name, product_id, product_name, category,
    spec, unit, quantity, qty_unit, unit_price, total_amount, payment_status, payment_date, payment_cycle, note } = body
  await db.prepare(
    `UPDATE sales SET date=?, customer_id=?, customer_name=?, product_id=?, product_name=?,
    category=?, spec=?, unit=?, quantity=?, qty_unit=?, unit_price=?, total_amount=?,
    payment_status=?, payment_date=?, payment_cycle=?, note=? WHERE id=?`
  ).bind(date, customer_id||null, customer_name, product_id||null, product_name, category||null,
    spec||null, unit||null, quantity, qty_unit||'隻', unit_price, total_amount||null,
    payment_status||'待付款', payment_date||null, payment_cycle||null, note||null, id).run()
  return c.json({ success: true })
})

app.delete('/:id', async (c) => {
  const db = c.env.DB
  const { id } = c.req.param()
  await db.prepare('DELETE FROM sales WHERE id=?').bind(id).run()
  return c.json({ success: true })
})

app.patch('/:id/pay', async (c) => {
  const db = c.env.DB
  const { id } = c.req.param()
  const body = await c.req.json()
  await db.prepare('UPDATE sales SET payment_status=? WHERE id=?').bind(body.status || '已付款', id).run()
  return c.json({ success: true })
})

// Weekly statement - 每週結算單
app.get('/weekly-statement', async (c) => {
  const db = c.env.DB
  const { customer_name, date_start, date_end } = c.req.query()
  if (!customer_name || !date_start || !date_end)
    return c.json({ error: '缺少參數' }, 400)

  const { results } = await db.prepare(
    `SELECT date, product_name, category, spec, unit, quantity, qty_unit,
            unit_price, total_amount, note, payment_status
     FROM sales
     WHERE customer_name=? AND date >= ? AND date <= ?
     ORDER BY date ASC, id ASC`
  ).bind(customer_name, date_start, date_end).all()

  const total = (results as any[]).reduce((s, r) => s + (r.total_amount || 0), 0)
  const paid   = (results as any[]).filter(r => ['已付款','已付'].includes(r.payment_status)).reduce((s, r) => s + (r.total_amount || 0), 0)
  const unpaid = total - paid

  // 按日期分組
  const byDate: Record<string, any[]> = {}
  for (const r of results as any[]) {
    const d = r.date.split('T')[0]
    if (!byDate[d]) byDate[d] = []
    byDate[d].push(r)
  }

  return c.json({
    customer_name,
    date_start,
    date_end,
    items: results,
    by_date: byDate,
    summary: { total, paid, unpaid, count: results.length }
  })
})

// Customer summary
app.get('/stats/customer-summary', async (c) => {
  const db = c.env.DB
  const { year } = c.req.query()
  const y = year || new Date().getFullYear().toString()
  const { results } = await db.prepare(
    `SELECT customer_name, COUNT(*) as cnt, SUM(total_amount) as total,
    SUM(CASE WHEN payment_status IN ('待付款','未付款') THEN total_amount ELSE 0 END) as receivable
    FROM sales WHERE date >= ? AND date <= ?
    GROUP BY customer_name ORDER BY total DESC`
  ).bind(`${y}-01-01`, `${y}-12-31`).all()
  return c.json(results)
})

// Monthly summary
app.get('/stats/monthly', async (c) => {
  const db = c.env.DB
  const { year } = c.req.query()
  const y = year || new Date().getFullYear().toString()
  const { results } = await db.prepare(
    `SELECT strftime('%m', date) as month, COUNT(*) as cnt, SUM(total_amount) as total
    FROM sales WHERE date >= ? AND date <= ?
    GROUP BY strftime('%m', date) ORDER BY month`
  ).bind(`${y}-01-01`, `${y}-12-31`).all()
  return c.json(results)
})

export default app
