import { Hono } from 'hono'

type Bindings = { DB: D1Database }
const app = new Hono<{ Bindings: Bindings }>()

app.get('/', async (c) => {
  const db = c.env.DB
  const today = new Date().toISOString().split('T')[0]
  const year = today.slice(0, 4)
  const month = today.slice(0, 7)
  const monthStart = `${month}-01`
  const monthEnd = `${month}-31`

  const [
    todaySales, monthSales, yearSales,
    todayPurchases, monthPurchases,
    receivable, payable,
    recentSales,
    monthlyStats,
    expenseMonth,
  ] = await Promise.all([
    db.prepare(`SELECT COUNT(*) as cnt, SUM(total_amount) as total FROM sales WHERE date=?`).bind(today).first(),
    db.prepare(`SELECT COUNT(*) as cnt, SUM(total_amount) as total FROM sales WHERE date >= ? AND date <= ?`).bind(monthStart, monthEnd).first(),
    db.prepare(`SELECT COUNT(*) as cnt, SUM(total_amount) as total FROM sales WHERE date >= ? AND date <= ?`).bind(`${year}-01-01`, `${year}-12-31`).first(),
    db.prepare(`SELECT COUNT(*) as cnt, SUM(total_amount) as total FROM purchases WHERE date=?`).bind(today).first(),
    db.prepare(`SELECT COUNT(*) as cnt, SUM(total_amount) as total FROM purchases WHERE date >= ? AND date <= ?`).bind(monthStart, monthEnd).first(),
    db.prepare(`SELECT SUM(total_amount) as total FROM sales WHERE payment_status IN ('待付款','未付款')`).first(),
    db.prepare(`SELECT SUM(total_amount) as total FROM purchases WHERE payment_status='未付'`).first(),
    db.prepare(`SELECT date, customer_name, product_name, quantity, qty_unit, unit_price, total_amount, payment_status FROM sales ORDER BY date DESC, id DESC LIMIT 10`).all(),
    db.prepare(`SELECT strftime('%m', date) as month, SUM(total_amount) as revenue FROM sales WHERE date >= ? AND date <= ? GROUP BY month ORDER BY month`).bind(`${year}-01-01`, `${year}-12-31`).all(),
    db.prepare(`SELECT SUM(amount) as total FROM expenses WHERE date >= ? AND date <= ?`).bind(monthStart, monthEnd).first(),
  ])

  const yearRevenue = (yearSales as any)?.total || 0
  const monthRevenue = (monthSales as any)?.total || 0
  const monthCost = (monthPurchases as any)?.total || 0
  const monthExpense = (expenseMonth as any)?.total || 0
  const monthNet = monthRevenue - monthCost - monthExpense

  return c.json({
    today: {
      date: today,
      sales_count: (todaySales as any)?.cnt || 0,
      sales_amount: (todaySales as any)?.total || 0,
      purchase_count: (todayPurchases as any)?.cnt || 0,
      purchase_amount: (todayPurchases as any)?.total || 0,
    },
    month: {
      revenue: monthRevenue,
      cost: monthCost,
      expense: monthExpense,
      net: monthNet,
      gross_margin: monthRevenue > 0 ? ((monthRevenue - monthCost) / monthRevenue * 100).toFixed(1) : '0',
    },
    year: {
      revenue: yearRevenue,
      target: 2500000,
      achievement: yearRevenue > 0 ? (yearRevenue / 2500000 * 100).toFixed(1) : '0',
    },
    receivable: (receivable as any)?.total || 0,
    payable: (payable as any)?.total || 0,
    cash_gap: ((receivable as any)?.total || 0) - ((payable as any)?.total || 0),
    recent_sales: recentSales.results,
    monthly_stats: monthlyStats.results,
  })
})

export default app
