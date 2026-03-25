import { Hono } from 'hono'

type Bindings = { DB: D1Database }
const app = new Hono<{ Bindings: Bindings }>()

// Get all customer prices
app.get('/customer', async (c) => {
  const db = c.env.DB
  const { results } = await db.prepare(
    `SELECT cp.*, c.name as customer_name, c.code as customer_code, p.name as product_name, p.code as product_code, p.category, p.unit
    FROM customer_prices cp
    JOIN customers c ON cp.customer_id = c.id
    JOIN products p ON cp.product_id = p.id
    ORDER BY c.code, p.code`
  ).all()
  return c.json(results)
})

// Get all supplier prices
app.get('/supplier', async (c) => {
  const db = c.env.DB
  const { results } = await db.prepare(
    `SELECT sp.*, s.name as supplier_name, s.code as supplier_code, p.name as product_name, p.code as product_code, p.category, p.unit
    FROM supplier_prices sp
    JOIN suppliers s ON sp.supplier_id = s.id
    JOIN products p ON sp.product_id = p.id
    ORDER BY s.code, p.code`
  ).all()
  return c.json(results)
})

// Upsert customer price
app.post('/customer', async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  const { customer_id, product_id, price, note } = body
  if (!customer_id || !product_id || !price) return c.json({ error: '客戶、商品、價格必填' }, 400)
  // Check existing
  const existing = await db.prepare('SELECT id FROM customer_prices WHERE customer_id=? AND product_id=?').bind(customer_id, product_id).first()
  if (existing) {
    await db.prepare('UPDATE customer_prices SET price=?, note=?, effective_date=CURRENT_DATE WHERE customer_id=? AND product_id=?')
      .bind(price, note||null, customer_id, product_id).run()
  } else {
    await db.prepare('INSERT INTO customer_prices (customer_id, product_id, price, note) VALUES (?,?,?,?)')
      .bind(customer_id, product_id, price, note||null).run()
  }
  return c.json({ success: true })
})

// Upsert supplier price
app.post('/supplier', async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  const { supplier_id, product_id, price, note } = body
  if (!supplier_id || !product_id || !price) return c.json({ error: '廠商、商品、價格必填' }, 400)
  const existing = await db.prepare('SELECT id FROM supplier_prices WHERE supplier_id=? AND product_id=?').bind(supplier_id, product_id).first()
  if (existing) {
    await db.prepare('UPDATE supplier_prices SET price=?, note=?, effective_date=CURRENT_DATE WHERE supplier_id=? AND product_id=?')
      .bind(price, note||null, supplier_id, product_id).run()
  } else {
    await db.prepare('INSERT INTO supplier_prices (supplier_id, product_id, price, note) VALUES (?,?,?,?)')
      .bind(supplier_id, product_id, price, note||null).run()
  }
  return c.json({ success: true })
})

app.delete('/customer/:id', async (c) => {
  const db = c.env.DB
  await db.prepare('DELETE FROM customer_prices WHERE id=?').bind(c.req.param('id')).run()
  return c.json({ success: true })
})

app.delete('/supplier/:id', async (c) => {
  const db = c.env.DB
  await db.prepare('DELETE FROM supplier_prices WHERE id=?').bind(c.req.param('id')).run()
  return c.json({ success: true })
})

// Get price by customer + product
app.get('/lookup', async (c) => {
  const db = c.env.DB
  const { customer_id, product_id } = c.req.query()
  if (!customer_id || !product_id) return c.json({ price: null })
  const result = await db.prepare('SELECT price FROM customer_prices WHERE customer_id=? AND product_id=? ORDER BY effective_date DESC LIMIT 1')
    .bind(customer_id, product_id).first() as any
  return c.json({ price: result?.price || null })
})

export default app
