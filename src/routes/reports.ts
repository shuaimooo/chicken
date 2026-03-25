import { Hono } from 'hono'

type Bindings = { DB: D1Database }
const app = new Hono<{ Bindings: Bindings }>()

// 月度損益表
app.get('/monthly-pl', async (c) => {
  const db = c.env.DB
  const { year } = c.req.query()
  const y = year || new Date().getFullYear().toString()

  const [salesRes, purchasesRes, expensesRes] = await Promise.all([
    db.prepare(`SELECT strftime('%m', date) as month, SUM(total_amount) as revenue FROM sales WHERE date >= ? AND date <= ? GROUP BY month`)
      .bind(`${y}-01-01`, `${y}-12-31`).all(),
    db.prepare(`SELECT strftime('%m', date) as month, SUM(total_amount) as cost FROM purchases WHERE date >= ? AND date <= ? GROUP BY month`)
      .bind(`${y}-01-01`, `${y}-12-31`).all(),
    db.prepare(`SELECT strftime('%m', date) as month, SUM(amount) as expense FROM expenses WHERE date >= ? AND date <= ? GROUP BY month`)
      .bind(`${y}-01-01`, `${y}-12-31`).all(),
  ])

  const months: Record<string, any> = {}
  for (let i = 1; i <= 12; i++) {
    const m = String(i).padStart(2, '0')
    months[m] = { month: m, revenue: 0, cost: 0, expense: 0, gross_profit: 0, net_profit: 0 }
  }
  for (const r of (salesRes.results as any[])) months[r.month].revenue = r.revenue || 0
  for (const r of (purchasesRes.results as any[])) months[r.month].cost = r.cost || 0
  for (const r of (expensesRes.results as any[])) months[r.month].expense = r.expense || 0

  const data = Object.values(months).map((m: any) => {
    m.gross_profit = m.revenue - m.cost
    m.net_profit = m.gross_profit - m.expense
    m.gross_margin = m.revenue > 0 ? (m.gross_profit / m.revenue * 100).toFixed(2) : '0.00'
    return m
  })

  return c.json(data)
})

// 年度KPI
app.get('/annual-kpi', async (c) => {
  const db = c.env.DB
  const { year } = c.req.query()
  const y = year || new Date().getFullYear().toString()
  const target = 2500000

  const [sales, purchases, expenses, receivables, payables] = await Promise.all([
    db.prepare(`SELECT SUM(total_amount) as total FROM sales WHERE date >= ? AND date <= ?`)
      .bind(`${y}-01-01`, `${y}-12-31`).first() as any,
    db.prepare(`SELECT SUM(total_amount) as total FROM purchases WHERE date >= ? AND date <= ?`)
      .bind(`${y}-01-01`, `${y}-12-31`).first() as any,
    db.prepare(`SELECT SUM(amount) as total FROM expenses WHERE date >= ? AND date <= ?`)
      .bind(`${y}-01-01`, `${y}-12-31`).first() as any,
    db.prepare(`SELECT SUM(total_amount) as total FROM sales WHERE payment_status IN ('待付款','未付款') AND date >= ? AND date <= ?`)
      .bind(`${y}-01-01`, `${y}-12-31`).first() as any,
    db.prepare(`SELECT SUM(total_amount) as total FROM purchases WHERE payment_status='未付' AND date >= ? AND date <= ?`)
      .bind(`${y}-01-01`, `${y}-12-31`).first() as any,
  ])

  const revenue = (sales as any)?.total || 0
  const cost = (purchases as any)?.total || 0
  const expense = (expenses as any)?.total || 0
  const gross_profit = revenue - cost
  const net_profit = gross_profit - expense

  return c.json({
    year: y, target,
    revenue, cost, expense,
    gross_profit, net_profit,
    gross_margin: revenue > 0 ? (gross_profit / revenue * 100).toFixed(2) : '0',
    net_margin: revenue > 0 ? (net_profit / revenue * 100).toFixed(2) : '0',
    achievement_rate: target > 0 ? (revenue / target * 100).toFixed(1) : '0',
    receivable: (receivables as any)?.total || 0,
    payable: (payables as any)?.total || 0,
  })
})

// 客戶分析
app.get('/customer-analysis', async (c) => {
  const db = c.env.DB
  const { year } = c.req.query()
  const y = year || new Date().getFullYear().toString()
  const { results } = await db.prepare(
    `SELECT customer_name,
     COUNT(*) as order_count,
     SUM(total_amount) as revenue,
     SUM(CASE WHEN payment_status IN ('待付款','未付款') THEN total_amount ELSE 0 END) as receivable,
     SUM(CASE WHEN payment_status IN ('已付款','已付') THEN total_amount ELSE 0 END) as paid
     FROM sales WHERE date >= ? AND date <= ?
     GROUP BY customer_name ORDER BY revenue DESC`
  ).bind(`${y}-01-01`, `${y}-12-31`).all()
  return c.json(results)
})

// 商品分析
app.get('/product-analysis', async (c) => {
  const db = c.env.DB
  const { year, month } = c.req.query()
  const y = year || new Date().getFullYear().toString()
  let dateStart = `${y}-01-01`, dateEnd = `${y}-12-31`
  if (month) {
    dateStart = `${y}-${month.padStart(2,'0')}-01`
    dateEnd = `${y}-${month.padStart(2,'0')}-31`
  }
  const { results } = await db.prepare(
    `SELECT product_name, category, SUM(quantity) as total_qty, SUM(total_amount) as revenue
    FROM sales WHERE date >= ? AND date <= ?
    GROUP BY product_name ORDER BY revenue DESC LIMIT 20`
  ).bind(dateStart, dateEnd).all()
  return c.json(results)
})

export default app
