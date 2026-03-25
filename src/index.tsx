import { Hono } from 'hono'
import { cors } from 'hono/cors'

// Routes
import customersRoute from './routes/customers'
import suppliersRoute from './routes/suppliers'
import productsRoute from './routes/products'
import purchasesRoute from './routes/purchases'
import salesRoute from './routes/sales'
import expensesRoute from './routes/expenses'
import cashflowRoute from './routes/cashflow'
import reportsRoute from './routes/reports'
import dashboardRoute from './routes/dashboard'
import pricesRoute from './routes/prices'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/api/*', cors())

// Favicon - return empty
app.get('/favicon.ico', (c) => c.body('', 204))

// API routes
app.route('/api/customers', customersRoute)
app.route('/api/suppliers', suppliersRoute)
app.route('/api/products', productsRoute)
app.route('/api/purchases', purchasesRoute)
app.route('/api/sales', salesRoute)
app.route('/api/expenses', expensesRoute)
app.route('/api/cashflow', cashflowRoute)
app.route('/api/reports', reportsRoute)
app.route('/api/dashboard', dashboardRoute)
app.route('/api/prices', pricesRoute)

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok', time: new Date().toISOString() }))

// Init DB
app.post('/api/init-db', async (c) => {
  const db = c.env.DB
  try {
    // Run migrations inline since we can't read files
    const sqls = [
      // customers
      `CREATE TABLE IF NOT EXISTS customers (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, contact TEXT, phone TEXT, company TEXT, address TEXT, payment_cycle TEXT DEFAULT '月結', note TEXT, active INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      // suppliers
      `CREATE TABLE IF NOT EXISTS suppliers (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, contact TEXT, phone TEXT, bank TEXT, account TEXT, note TEXT, active INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      // products
      `CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, category TEXT NOT NULL, unit TEXT DEFAULT '斤', note TEXT, active INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      // customer_prices
      `CREATE TABLE IF NOT EXISTS customer_prices (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL, product_id INTEGER NOT NULL, price REAL NOT NULL, effective_date DATE DEFAULT CURRENT_DATE, note TEXT, FOREIGN KEY (customer_id) REFERENCES customers(id), FOREIGN KEY (product_id) REFERENCES products(id))`,
      // supplier_prices
      `CREATE TABLE IF NOT EXISTS supplier_prices (id INTEGER PRIMARY KEY AUTOINCREMENT, supplier_id INTEGER NOT NULL, product_id INTEGER NOT NULL, price REAL NOT NULL, effective_date DATE DEFAULT CURRENT_DATE, note TEXT, FOREIGN KEY (supplier_id) REFERENCES suppliers(id), FOREIGN KEY (product_id) REFERENCES products(id))`,
      // purchases
      `CREATE TABLE IF NOT EXISTS purchases (id INTEGER PRIMARY KEY AUTOINCREMENT, date DATE NOT NULL, batch_no TEXT, supplier_id INTEGER, supplier_name TEXT, product_id INTEGER, product_name TEXT, category TEXT, spec REAL, total_weight REAL, unit TEXT, quantity REAL NOT NULL, qty_unit TEXT DEFAULT '隻', cost_price REAL, sell_price REAL, total_amount REAL, payment_status TEXT DEFAULT '未付', note TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      // sales
      `CREATE TABLE IF NOT EXISTS sales (id INTEGER PRIMARY KEY AUTOINCREMENT, date DATE NOT NULL, customer_id INTEGER, customer_name TEXT NOT NULL, product_id INTEGER, product_name TEXT NOT NULL, category TEXT, spec REAL, unit TEXT, quantity REAL NOT NULL, qty_unit TEXT, unit_price REAL NOT NULL, total_amount REAL NOT NULL, payment_status TEXT DEFAULT '待付款', payment_date DATE, payment_cycle TEXT, note TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      // expenses
      `CREATE TABLE IF NOT EXISTS expenses (id INTEGER PRIMARY KEY AUTOINCREMENT, date DATE NOT NULL, category TEXT NOT NULL, amount REAL NOT NULL, description TEXT, destination TEXT, note TEXT, payment_status TEXT DEFAULT '已付', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      // cashflow
      `CREATE TABLE IF NOT EXISTS cashflow (id INTEGER PRIMARY KEY AUTOINCREMENT, date DATE NOT NULL, flow_no TEXT, description TEXT NOT NULL, income REAL DEFAULT 0, expense REAL DEFAULT 0, balance REAL DEFAULT 0, party TEXT, category TEXT, ref_type TEXT, ref_id INTEGER, note TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      // receivables
      `CREATE TABLE IF NOT EXISTS receivables (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL, customer_name TEXT NOT NULL, period_start DATE NOT NULL, period_end DATE NOT NULL, payment_due DATE, total_amount REAL DEFAULT 0, paid_amount REAL DEFAULT 0, balance REAL DEFAULT 0, status TEXT DEFAULT '待付款', note TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      // payables
      `CREATE TABLE IF NOT EXISTS payables (id INTEGER PRIMARY KEY AUTOINCREMENT, supplier_id INTEGER NOT NULL, supplier_name TEXT NOT NULL, period_start DATE NOT NULL, period_end DATE NOT NULL, payment_due DATE, total_amount REAL DEFAULT 0, paid_amount REAL DEFAULT 0, balance REAL DEFAULT 0, status TEXT DEFAULT '未付', note TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      // settings
      `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      // indexes
      `CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date)`,
      `CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id)`,
      `CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(date)`,
      `CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date)`,
    ]

    for (const sql of sqls) {
      await db.prepare(sql).run()
    }

    // Seed data
    const seeds = [
      `INSERT OR IGNORE INTO customers (code, name, contact, phone, company, address, payment_cycle) VALUES ('L001','王英吉','王英吉','0916908830','王英吉','新北市板橋區四維路46-1號','雙週結')`,
      `INSERT OR IGNORE INTO customers (code, name, contact, phone, company, address, payment_cycle) VALUES ('L002','李光宇','李光宇',NULL,'李光宇','新北市板橋區中興路7號','月結')`,
      `INSERT OR IGNORE INTO customers (code, name, contact, phone, company, address, payment_cycle) VALUES ('L003','黃金好食雞','羅小姐','0981871070','黃金好食雞','桃園市平鎮區平東路659巷175號','雙週結')`,
      `INSERT OR IGNORE INTO customers (code, name, contact, phone, company, address, payment_cycle) VALUES ('L005','雞世家','劉家蓁','0933079961','雞世家','桃園區廣興路37號對面倉庫','雙週結')`,
      `INSERT OR IGNORE INTO customers (code, name, contact, phone, company, address, payment_cycle) VALUES ('L006','鄭書麒','鄭書麒','0912756123','鄭書麒','桃園市蘆竹區南竹路1-5號','月結')`,
      `INSERT OR IGNORE INTO customers (code, name, contact, phone, company, address, payment_cycle) VALUES ('L009','食鼎香',NULL,NULL,'食鼎香','桃園市桃園區龍壽街一段216巷8號','月結')`,
      `INSERT OR IGNORE INTO customers (code, name, contact, phone, company, address, payment_cycle) VALUES ('L011','好食在好吃雞肉','呂建興','0920610661','好食在好吃雞肉','桃園市中壢區元化路59號','月結')`,
      `INSERT OR IGNORE INTO customers (code, name, contact, phone, company, address, payment_cycle) VALUES ('L016','日日快餐',NULL,NULL,'日日快餐','桃園市中山路368號','雙週結')`,
      `INSERT OR IGNORE INTO customers (code, name, contact, phone, company, address, payment_cycle) VALUES ('L017','林明泉','林明泉','0934059363','林明泉','桃園區春日路1148號3樓','月結')`,
      `INSERT OR IGNORE INTO customers (code, name, contact, phone, company, address, payment_cycle) VALUES ('L018','零售收現',NULL,NULL,NULL,NULL,'現金')`,
      `INSERT OR IGNORE INTO customers (code, name, contact, phone, company, address, payment_cycle) VALUES ('L019','池進財','池進財','0989139875','池進財','楊梅區萬大路116巷34號','月結')`,
      `INSERT OR IGNORE INTO suppliers (code, name, contact, bank, account) VALUES ('K001','雞王','齊','006','5942717007101')`,
      `INSERT OR IGNORE INTO suppliers (code, name, contact, bank, account) VALUES ('K002','興隆','風','803','16507011645')`,
      `INSERT OR IGNORE INTO suppliers (code, name, contact, bank, account) VALUES ('K003','小齊','齊','013','25200103728')`,
      `INSERT OR IGNORE INTO suppliers (code, name, contact) VALUES ('K004','樂基','奕榮')`,
      `INSERT OR IGNORE INTO suppliers (code, name, contact) VALUES ('K005','牧穀','施')`,
      `INSERT OR IGNORE INTO suppliers (code, name, contact) VALUES ('K006','小毛','小毛')`,
      `INSERT OR IGNORE INTO suppliers (code, name, contact) VALUES ('K007','太順','太順')`,
      `INSERT OR IGNORE INTO suppliers (code, name, contact) VALUES ('K008','阿聽','阿聽')`,
      `INSERT OR IGNORE INTO products (code, name, category, unit) VALUES ('C001','放山土公','生鮮','斤')`,
      `INSERT OR IGNORE INTO products (code, name, category, unit) VALUES ('C002','放山土母','生鮮','斤')`,
      `INSERT OR IGNORE INTO products (code, name, category, unit) VALUES ('C003','舍土母','生鮮','斤')`,
      `INSERT OR IGNORE INTO products (code, name, category, unit) VALUES ('C004','文昌公','生鮮','斤')`,
      `INSERT OR IGNORE INTO products (code, name, category, unit) VALUES ('C005','文昌母','生鮮','斤')`,
      `INSERT OR IGNORE INTO products (code, name, category, unit) VALUES ('C006','烏骨公','生鮮','斤')`,
      `INSERT OR IGNORE INTO products (code, name, category, unit) VALUES ('C007','烏骨母','生鮮','斤')`,
      `INSERT OR IGNORE INTO products (code, name, category, unit) VALUES ('C008','古早公','生鮮','斤')`,
      `INSERT OR IGNORE INTO products (code, name, category, unit) VALUES ('C009','古早母','生鮮','斤')`,
      `INSERT OR IGNORE INTO products (code, name, category, unit) VALUES ('C010','黃金母','生鮮','斤')`,
      `INSERT OR IGNORE INTO products (code, name, category, unit) VALUES ('C011','珍珠母','生鮮','斤')`,
      `INSERT OR IGNORE INTO products (code, name, category, unit) VALUES ('C012','仿土公','生鮮','斤')`,
      `INSERT OR IGNORE INTO products (code, name, category, unit) VALUES ('C013','仿土母','生鮮','斤')`,
      `INSERT OR IGNORE INTO products (code, name, category, unit) VALUES ('C014','土雞','生鮮','斤')`,
      `INSERT OR IGNORE INTO products (code, name, category, unit) VALUES ('C015','雞佛','生鮮','斤')`,
      `INSERT OR IGNORE INTO products (code, name, category, unit) VALUES ('C016','全鴨','生鮮','斤')`,
      `INSERT OR IGNORE INTO products (code, name, category, unit) VALUES ('C017','太空鴨','冷凍','KG')`,
      `INSERT OR IGNORE INTO products (code, name, category, unit) VALUES ('C018','紅面鴨公','冷凍','斤')`,
      `INSERT OR IGNORE INTO products (code, name, category, unit) VALUES ('C019','紅面鴨母','冷凍','斤')`,
      `INSERT OR IGNORE INTO products (code, name, category, unit) VALUES ('C024','鹿野','冷凍','KG')`,
      `INSERT OR IGNORE INTO products (code, name, category, unit) VALUES ('C071','雞胸肉','冷凍','KG')`,
      `INSERT OR IGNORE INTO products (code, name, category, unit) VALUES ('C075','台灣-骨8','冷凍','KG')`,
      `INSERT OR IGNORE INTO products (code, name, category, unit) VALUES ('C076','閹雞','生鮮','斤')`,
      `INSERT OR IGNORE INTO products (code, name, category, unit) VALUES ('C080','甘蔗雞','熟雞','隻')`,
      `INSERT OR IGNORE INTO products (code, name, category, unit) VALUES ('C081','珍珠雞','熟雞','隻')`,
      `INSERT OR IGNORE INTO products (code, name, category, unit) VALUES ('C082','熟閹雞','熟雞','隻')`,
      `INSERT OR IGNORE INTO settings (key, value) VALUES ('company_name','雞王')`,
      `INSERT OR IGNORE INTO settings (key, value) VALUES ('annual_target','2500000')`,
      `INSERT OR IGNORE INTO settings (key, value) VALUES ('payment_cycle_default','雙週結')`,
    ]

    for (const sql of seeds) {
      await db.prepare(sql).run()
    }

    return c.json({ success: true, message: '資料庫初始化完成' })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// SPA fallback - serve index.html
app.get('*', async (c) => {
  return c.html(getIndexHTML())
})

function getIndexHTML(): string {
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>雞王進銷存系統</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/dayjs@1.11.10/dayjs.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
  <style>
    /* ─── 設計系統 ─── */
    :root {
      --brand:      #e63946;
      --brand-dk:   #c1121f;
      --brand-lt:   #ff6b6b;
      --sidebar-bg: #0f172a;
      --sidebar-w:  252px;
      --accent:     #f59e0b;
      --success:    #10b981;
      --info:       #3b82f6;
      --surface:    #ffffff;
      --bg:         #f1f5f9;
      --border:     #e2e8f0;
      --text:       #1e293b;
      --muted:      #64748b;
      --radius:     14px;
      --shadow-sm:  0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04);
      --shadow:     0 4px 16px rgba(0,0,0,.08), 0 2px 6px rgba(0,0,0,.04);
      --shadow-lg:  0 20px 48px rgba(0,0,0,.12), 0 8px 16px rgba(0,0,0,.06);
    }

    /* ─── Reset & Base ─── */
    *, *::before, *::after { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang TC', 'Noto Sans TC', sans-serif;
      background: var(--bg);
      color: var(--text);
      margin: 0;
    }

    /* ─── Sidebar ─── */
    .sidebar {
      width: var(--sidebar-w);
      background: var(--sidebar-bg);
      flex-shrink: 0;
    }
    .sidebar-logo {
      padding: 20px 16px 16px;
      border-bottom: 1px solid rgba(255,255,255,.07);
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .logo-icon {
      width: 42px; height: 42px;
      background: linear-gradient(135deg, var(--brand), var(--brand-dk));
      border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      font-size: 20px; font-weight: 900; color: white;
      box-shadow: 0 4px 12px rgba(230,57,70,.4);
      flex-shrink: 0;
    }
    .logo-text { line-height: 1.2; }
    .logo-text .name  { font-size: 17px; font-weight: 800; color: #fff; letter-spacing: .5px; }
    .logo-text .sub   { font-size: 11px; color: #64748b; margin-top: 1px; }

    .nav-section-label {
      font-size: 10px; font-weight: 700; letter-spacing: 1.2px;
      color: #475569; text-transform: uppercase;
      padding: 18px 16px 6px;
    }
    .nav-item {
      display: flex; align-items: center; gap: 10px;
      width: 100%; text-align: left;
      padding: 9px 12px; margin: 1px 6px;
      width: calc(100% - 12px);
      border-radius: 10px;
      font-size: 13.5px; font-weight: 500;
      color: #94a3b8;
      cursor: pointer;
      transition: all .18s ease;
      border: none; background: none;
    }
    .nav-item:hover { background: rgba(255,255,255,.06); color: #cbd5e1; }
    .nav-item.active {
      background: linear-gradient(90deg, rgba(230,57,70,.18), rgba(230,57,70,.08));
      color: #fff;
      box-shadow: inset 3px 0 0 var(--brand);
    }
    .nav-item .icon-wrap {
      width: 28px; height: 28px;
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      font-size: 13px;
      background: rgba(255,255,255,.05);
      transition: all .18s;
      flex-shrink: 0;
    }
    .nav-item.active .icon-wrap { background: var(--brand); box-shadow: 0 3px 8px rgba(230,57,70,.5); color: white; }
    .nav-item:hover .icon-wrap { background: rgba(255,255,255,.1); }

    /* ─── Top Header ─── */
    .top-header {
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      padding: 0 20px;
      height: 60px;
      display: flex; align-items: center; justify-content: space-between;
      position: sticky; top: 0; z-index: 20;
      box-shadow: var(--shadow-sm);
    }
    .page-title-area { display: flex; align-items: center; gap: 10px; }
    .mobile-logo {
      width: 34px; height: 34px;
      background: linear-gradient(135deg, var(--brand), var(--brand-dk));
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      font-size: 16px; font-weight: 900; color: white;
    }
    #page-title { font-size: 17px; font-weight: 700; color: var(--text); }
    .header-right { display: flex; align-items: center; gap: 10px; }
    .date-chip {
      font-size: 12px; color: var(--muted);
      background: var(--bg); border-radius: 20px;
      padding: 4px 10px;
    }

    /* ─── Buttons ─── */
    .btn-primary {
      background: linear-gradient(135deg, var(--brand), var(--brand-dk));
      color: white; border-radius: 10px; padding: 8px 18px;
      font-weight: 600; font-size: 13.5px; cursor: pointer;
      border: none; transition: all .2s;
      box-shadow: 0 4px 12px rgba(230,57,70,.3);
      display: inline-flex; align-items: center; gap: 6px;
    }
    .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(230,57,70,.4); }
    .btn-primary:active { transform: translateY(0); }
    .btn-secondary {
      background: var(--surface); color: var(--text);
      border: 1px solid var(--border);
      border-radius: 10px; padding: 8px 16px;
      font-weight: 600; font-size: 13.5px; cursor: pointer;
      transition: all .2s;
      display: inline-flex; align-items: center; gap: 6px;
    }
    .btn-secondary:hover { background: var(--bg); border-color: #cbd5e1; }
    .btn-success {
      background: linear-gradient(135deg, #10b981, #059669);
      color: white; border-radius: 10px; padding: 8px 16px;
      font-weight: 600; font-size: 13.5px; cursor: pointer;
      border: none; transition: all .2s;
      box-shadow: 0 4px 12px rgba(16,185,129,.3);
      display: inline-flex; align-items: center; gap: 6px;
    }
    .btn-success:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(16,185,129,.4); }

    /* ─── Cards ─── */
    .card {
      background: var(--surface);
      border-radius: var(--radius);
      box-shadow: var(--shadow-sm);
      border: 1px solid var(--border);
    }
    .card-hover:hover { box-shadow: var(--shadow); transform: translateY(-2px); transition: all .2s; }

    /* ─── KPI Cards ─── */
    .kpi-card {
      border-radius: 16px; padding: 18px 20px;
      color: white; position: relative; overflow: hidden;
    }
    .kpi-card::before {
      content: ''; position: absolute;
      top: -30%; right: -10%;
      width: 100px; height: 100px;
      border-radius: 50%;
      background: rgba(255,255,255,.1);
    }
    .kpi-card::after {
      content: ''; position: absolute;
      bottom: -40%; right: 10%;
      width: 70px; height: 70px;
      border-radius: 50%;
      background: rgba(255,255,255,.06);
    }
    .kpi-label { font-size: 11px; opacity: .8; font-weight: 500; letter-spacing: .5px; margin-bottom: 6px; }
    .kpi-value { font-size: 22px; font-weight: 800; letter-spacing: -.5px; position: relative; z-index: 1; }
    .kpi-sub   { font-size: 11px; opacity: .75; margin-top: 4px; position: relative; z-index: 1; }

    /* ─── Input ─── */
    .input-field {
      border: 1.5px solid var(--border);
      border-radius: 10px;
      padding: 9px 13px;
      width: 100%; font-size: 15px;
      outline: none;
      background: var(--surface);
      color: var(--text);
      transition: border-color .2s, box-shadow .2s;
    }
    .input-field:focus {
      border-color: var(--brand);
      box-shadow: 0 0 0 3px rgba(230,57,70,.1);
    }
    select.input-field {
      background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
      background-position: right 10px center;
      background-repeat: no-repeat;
      background-size: 16px;
      appearance: none; padding-right: 34px;
    }

    /* ─── Table ─── */
    .table-header { background: #f8fafc; }
    .table-header th {
      font-size: 11px; font-weight: 700;
      letter-spacing: .6px; text-transform: uppercase;
      color: var(--muted); padding: 10px 12px;
    }
    tbody tr { border-bottom: 1px solid #f1f5f9; }
    tbody tr:hover { background: #fafbfc; }
    tbody tr:last-child { border-bottom: none; }

    /* ─── Status Badges ─── */
    .status-paid    { background: #ecfdf5; color: #065f46; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; display: inline-block; }
    .status-unpaid  { background: #fef2f2; color: #991b1b; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; display: inline-block; }
    .status-partial { background: #fffbeb; color: #92400e; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; display: inline-block; }
    .badge-fresh  { background: #ecfdf5; color: #065f46; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 700; display: inline-block; }
    .badge-frozen { background: #eff6ff; color: #1e40af; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 700; display: inline-block; }
    .badge-cooked { background: #fffbeb; color: #92400e; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 700; display: inline-block; }

    /* ─── Amount Colors ─── */
    .amount-positive { color: var(--success); font-weight: 700; }
    .amount-negative { color: var(--brand); font-weight: 700; }

    /* ─── Tabs ─── */
    .tab-btn {
      padding: 7px 16px; border-radius: 8px;
      cursor: pointer; font-size: 13.5px; font-weight: 500;
      color: var(--muted); transition: all .2s; border: none; background: none;
    }
    .tab-btn.active { background: var(--brand); color: white; box-shadow: 0 3px 10px rgba(230,57,70,.3); }

    /* ─── Modal ─── */
    .modal-overlay {
      position: fixed; inset: 0;
      background: rgba(15,23,42,.6);
      backdrop-filter: blur(4px);
      z-index: 50; display: flex;
      align-items: flex-end; justify-content: center;
    }
    @media (min-width: 640px) { .modal-overlay { align-items: center; } }
    .modal-box {
      background: var(--surface);
      width: 100%; max-width: 600px;
      border-radius: 20px 20px 0 0;
      padding: 24px 20px;
      max-height: 92vh; overflow-y: auto;
      box-shadow: var(--shadow-lg);
    }
    @media (min-width: 640px) { .modal-box { border-radius: 20px; } }
    .modal-handle {
      width: 36px; height: 4px;
      background: #cbd5e1; border-radius: 2px;
      margin: 0 auto 16px;
    }

    /* ─── Mobile Bottom Nav ─── */
    .mobile-nav {
      position: fixed; bottom: 0; left: 0; right: 0;
      background: var(--surface);
      border-top: 1px solid var(--border);
      z-index: 40; padding: 6px 4px 8px;
      display: grid; grid-template-columns: repeat(5, 1fr);
      gap: 2px;
      box-shadow: 0 -4px 20px rgba(0,0,0,.06);
    }
    .nav-mobile-btn {
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 2px; padding: 6px 2px;
      border-radius: 10px; border: none;
      background: none; color: #94a3b8;
      cursor: pointer; transition: all .18s;
      font-size: 10px; font-weight: 500;
    }
    .nav-mobile-btn i { font-size: 20px; transition: all .18s; }
    .nav-mobile-btn.active { color: var(--brand); }
    .nav-mobile-btn.active i { transform: translateY(-2px); }
    .nav-mobile-active-dot {
      width: 4px; height: 4px; border-radius: 50%;
      background: var(--brand); margin-top: 1px;
      display: none;
    }
    .nav-mobile-btn.active .nav-mobile-active-dot { display: block; }

    /* ─── Layout ─── */
    @media (max-width: 767px) {
      .sidebar { display: none !important; }
      .mobile-nav { display: grid; }
    }
    @media (min-width: 768px) {
      .mobile-nav { display: none !important; }
    }

    /* ─── Misc ─── */
    .page { display: none; }
    .page.active { display: block; }
    .loading {
      display: inline-block; width: 18px; height: 18px;
      border: 2.5px solid rgba(255,255,255,.3);
      border-radius: 50%; border-top-color: #fff;
      animation: spin 1s ease-in-out infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    ::-webkit-scrollbar { width: 4px; height: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }

    /* ─── Statement Card ─── */
    .statement-card { background: white; border-radius: 18px; overflow: hidden; box-shadow: var(--shadow-lg); }
    .statement-header {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
      color: white; padding: 22px 24px;
      position: relative; overflow: hidden;
    }
    .statement-header::before {
      content: ''; position: absolute;
      top: -50%; right: -15%;
      width: 200px; height: 200px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(230,57,70,.25), transparent 70%);
    }
    .statement-row-odd  { background: #f8fafc; }
    .statement-row-even { background: white; }
    .statement-total-row {
      background: linear-gradient(135deg, #0f172a, #1e293b);
      color: white;
    }
    .statement-badge { display: inline-block; padding: 2px 9px; border-radius: 20px; font-size: 11px; font-weight: 700; }
    .capture-area { position: relative; }
    @media print { .no-print { display: none !important; } body { background: white; } }

    /* ─── More Page Grid ─── */
    .more-grid-item {
      background: var(--surface);
      border-radius: 14px;
      border: 1px solid var(--border);
      padding: 18px 12px;
      display: flex; flex-direction: column;
      align-items: center; gap: 10px;
      cursor: pointer; transition: all .2s;
      box-shadow: var(--shadow-sm);
    }
    .more-grid-item:hover { box-shadow: var(--shadow); transform: translateY(-2px); }
    .more-grid-item.featured {
      border-color: var(--brand);
      background: linear-gradient(135deg, #fff5f5, #fff);
    }
    .more-icon-wrap {
      width: 48px; height: 48px;
      border-radius: 14px;
      display: flex; align-items: center; justify-content: center;
      font-size: 20px;
    }
  </style>
</head>
<body>

<!-- Mobile Bottom Nav -->
<div class="mobile-nav" id="mobile-nav">
  <button onclick="showPage('dashboard')" id="nav-dashboard" class="nav-mobile-btn">
    <i class="fas fa-chart-pie"></i><span>儀表板</span>
    <div class="nav-mobile-active-dot"></div>
  </button>
  <button onclick="showPage('sales')" id="nav-sales" class="nav-mobile-btn">
    <i class="fas fa-truck"></i><span>出貨</span>
    <div class="nav-mobile-active-dot"></div>
  </button>
  <button onclick="showPage('purchases')" id="nav-purchases" class="nav-mobile-btn">
    <i class="fas fa-shopping-cart"></i><span>進貨</span>
    <div class="nav-mobile-active-dot"></div>
  </button>
  <button onclick="showPage('weekly')" id="nav-weekly" class="nav-mobile-btn">
    <i class="fas fa-receipt"></i><span>結算單</span>
    <div class="nav-mobile-active-dot"></div>
  </button>
  <button onclick="showPage('more')" id="nav-more" class="nav-mobile-btn">
    <i class="fas fa-grid-2"></i><span>更多</span>
    <div class="nav-mobile-active-dot"></div>
  </button>
</div>

<div style="display:flex; min-height:100vh;">

  <!-- Desktop Sidebar -->
  <div class="sidebar hidden md:flex flex-col fixed top-0 bottom-0 left-0 z-30 overflow-y-auto" style="width:var(--sidebar-w)">
    <!-- Logo -->
    <div class="sidebar-logo">
      <div class="logo-icon">雞</div>
      <div class="logo-text">
        <div class="name">雞王</div>
        <div class="sub">進銷存管理系統</div>
      </div>
    </div>

    <!-- Nav -->
    <nav style="flex:1; padding: 8px 6px; overflow-y:auto;">

      <button onclick="showPage('dashboard')" id="side-dashboard" class="nav-item">
        <span class="icon-wrap"><i class="fas fa-chart-pie"></i></span><span>儀表板</span>
      </button>

      <div class="nav-section-label">銷售管理</div>
      <button onclick="showPage('sales')" id="side-sales" class="nav-item">
        <span class="icon-wrap"><i class="fas fa-truck"></i></span><span>出貨記錄</span>
      </button>
      <button onclick="showPage('weekly')" id="side-weekly" class="nav-item">
        <span class="icon-wrap"><i class="fas fa-receipt"></i></span><span>每週結算單</span>
      </button>
      <button onclick="showPage('receivables')" id="side-receivables" class="nav-item">
        <span class="icon-wrap"><i class="fas fa-hand-holding-usd"></i></span><span>應收帳款</span>
      </button>

      <div class="nav-section-label">採購管理</div>
      <button onclick="showPage('purchases')" id="side-purchases" class="nav-item">
        <span class="icon-wrap"><i class="fas fa-shopping-cart"></i></span><span>進貨記錄</span>
      </button>
      <button onclick="showPage('payables')" id="side-payables" class="nav-item">
        <span class="icon-wrap"><i class="fas fa-file-invoice-dollar"></i></span><span>應付帳款</span>
      </button>

      <div class="nav-section-label">財務</div>
      <button onclick="showPage('expenses')" id="side-expenses" class="nav-item">
        <span class="icon-wrap"><i class="fas fa-gas-pump"></i></span><span>費用記錄</span>
      </button>
      <button onclick="showPage('cashflow')" id="side-cashflow" class="nav-item">
        <span class="icon-wrap"><i class="fas fa-exchange-alt"></i></span><span>現金流水帳</span>
      </button>
      <button onclick="showPage('reports')" id="side-reports" class="nav-item">
        <span class="icon-wrap"><i class="fas fa-chart-bar"></i></span><span>財務報表</span>
      </button>

      <div class="nav-section-label">基本資料</div>
      <button onclick="showPage('inventory')" id="side-inventory" class="nav-item">
        <span class="icon-wrap"><i class="fas fa-boxes"></i></span><span>庫存管理</span>
      </button>
      <button onclick="showPage('customers')" id="side-customers" class="nav-item">
        <span class="icon-wrap"><i class="fas fa-users"></i></span><span>客戶管理</span>
      </button>
      <button onclick="showPage('suppliers')" id="side-suppliers" class="nav-item">
        <span class="icon-wrap"><i class="fas fa-store"></i></span><span>廠商管理</span>
      </button>
      <button onclick="showPage('products')" id="side-products" class="nav-item">
        <span class="icon-wrap"><i class="fas fa-tag"></i></span><span>商品管理</span>
      </button>
      <button onclick="showPage('prices')" id="side-prices" class="nav-item">
        <span class="icon-wrap"><i class="fas fa-dollar-sign"></i></span><span>報價管理</span>
      </button>
    </nav>

    <!-- Sidebar footer -->
    <div style="padding:12px 10px; border-top:1px solid rgba(255,255,255,.06);">
      <div style="font-size:11px; color:#475569; text-align:center;">雞王進銷存 v2.0</div>
    </div>
  </div>

  <!-- Main area -->
  <div style="flex:1; margin-left:0;" class="md:ml-[252px] pb-20 md:pb-0">

    <!-- Top Header -->
    <div class="top-header">
      <div class="page-title-area">
        <div class="mobile-logo md:hidden">雞</div>
        <h1 id="page-title">儀表板</h1>
      </div>
      <div class="header-right">
        <span id="today-date" class="date-chip hidden sm:block"></span>
        <button onclick="showPage('sales'); openSaleModal()" class="btn-primary" style="font-size:13px; padding:7px 14px;">
          <i class="fas fa-plus"></i><span class="hidden sm:inline">快速出貨</span>
        </button>
      </div>
    </div>

    <!-- Page Content -->
    <div style="padding:16px;">

      <div id="page-dashboard" class="page active"><div id="dashboard-content"></div></div>
      <div id="page-sales"     class="page"><div id="sales-content"></div></div>
      <div id="page-purchases" class="page"><div id="purchases-content"></div></div>
      <div id="page-receivables" class="page"><div id="receivables-content"></div></div>
      <div id="page-payables"  class="page"><div id="payables-content"></div></div>
      <div id="page-expenses"  class="page"><div id="expenses-content"></div></div>
      <div id="page-cashflow"  class="page"><div id="cashflow-content"></div></div>
      <div id="page-reports"   class="page"><div id="reports-content"></div></div>
      <div id="page-inventory" class="page"><div id="inventory-content"></div></div>
      <div id="page-customers" class="page"><div id="customers-content"></div></div>
      <div id="page-suppliers" class="page"><div id="suppliers-content"></div></div>
      <div id="page-products"  class="page"><div id="products-content"></div></div>
      <div id="page-prices"    class="page"><div id="prices-content"></div></div>
      <div id="page-weekly"    class="page"><div id="weekly-content"></div></div>

      <!-- More Page -->
      <div id="page-more" class="page">
        <div style="font-size:13px; color:var(--muted); font-weight:600; letter-spacing:.5px; text-transform:uppercase; margin-bottom:12px; padding:0 2px;">所有功能</div>
        <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:10px;">
          <button onclick="showPage('weekly')" class="more-grid-item featured">
            <div class="more-icon-wrap" style="background:linear-gradient(135deg,#fee2e2,#fecaca)"><i class="fas fa-receipt" style="color:var(--brand)"></i></div>
            <span style="font-size:12px; font-weight:700; color:var(--brand)">每週結算單</span>
          </button>
          <button onclick="showPage('receivables')" class="more-grid-item">
            <div class="more-icon-wrap" style="background:#ecfdf5"><i class="fas fa-hand-holding-usd" style="color:#059669"></i></div>
            <span style="font-size:12px; font-weight:600; color:var(--text)">應收帳款</span>
          </button>
          <button onclick="showPage('payables')" class="more-grid-item">
            <div class="more-icon-wrap" style="background:#fef2f2"><i class="fas fa-file-invoice-dollar" style="color:var(--brand)"></i></div>
            <span style="font-size:12px; font-weight:600; color:var(--text)">應付帳款</span>
          </button>
          <button onclick="showPage('expenses')" class="more-grid-item">
            <div class="more-icon-wrap" style="background:#fff7ed"><i class="fas fa-gas-pump" style="color:#ea580c"></i></div>
            <span style="font-size:12px; font-weight:600; color:var(--text)">費用記錄</span>
          </button>
          <button onclick="showPage('cashflow')" class="more-grid-item">
            <div class="more-icon-wrap" style="background:#eff6ff"><i class="fas fa-exchange-alt" style="color:#2563eb"></i></div>
            <span style="font-size:12px; font-weight:600; color:var(--text)">現金流水帳</span>
          </button>
          <button onclick="showPage('reports')" class="more-grid-item">
            <div class="more-icon-wrap" style="background:#f5f3ff"><i class="fas fa-chart-bar" style="color:#7c3aed"></i></div>
            <span style="font-size:12px; font-weight:600; color:var(--text)">財務報表</span>
          </button>
          <button onclick="showPage('inventory')" class="more-grid-item">
            <div class="more-icon-wrap" style="background:#fefce8"><i class="fas fa-boxes" style="color:#ca8a04"></i></div>
            <span style="font-size:12px; font-weight:600; color:var(--text)">庫存管理</span>
          </button>
          <button onclick="showPage('customers')" class="more-grid-item">
            <div class="more-icon-wrap" style="background:#eef2ff"><i class="fas fa-users" style="color:#4f46e5"></i></div>
            <span style="font-size:12px; font-weight:600; color:var(--text)">客戶管理</span>
          </button>
          <button onclick="showPage('suppliers')" class="more-grid-item">
            <div class="more-icon-wrap" style="background:#f0fdfa"><i class="fas fa-store" style="color:#0d9488"></i></div>
            <span style="font-size:12px; font-weight:600; color:var(--text)">廠商管理</span>
          </button>
          <button onclick="showPage('products')" class="more-grid-item">
            <div class="more-icon-wrap" style="background:#fdf4ff"><i class="fas fa-tag" style="color:#a21caf"></i></div>
            <span style="font-size:12px; font-weight:600; color:var(--text)">商品管理</span>
          </button>
          <button onclick="showPage('prices')" class="more-grid-item">
            <div class="more-icon-wrap" style="background:#fffbeb"><i class="fas fa-dollar-sign" style="color:#d97706"></i></div>
            <span style="font-size:12px; font-weight:600; color:var(--text)">報價管理</span>
          </button>
        </div>
      </div>

    </div>
  </div>
</div>

<!-- Toast -->
<div id="toast" style="position:fixed; top:16px; right:16px; z-index:60; display:none;">
  <div style="background:#1e293b; color:white; padding:12px 18px; border-radius:12px; box-shadow:0 8px 24px rgba(0,0,0,.2); font-size:13.5px; max-width:280px; display:flex; align-items:center; gap:8px;"></div>
</div>

<!-- Modal Container -->
<div id="modal-container"></div>

<script src="/static/app.js"></script>
</body>
</html>`
}

export default app
