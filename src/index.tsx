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
  APP_PASSWORD: string   // Cloudflare Secret
  SESSION_SECRET: string // Cloudflare Secret
}

// ─── Session 工具 ───────────────────────────────────────────
const SESSION_COOKIE = 'ck_sess'
const SESSION_MAX_AGE = 60 * 60 * 24 * 7  // 7 天

async function signSession(userId: string, secret: string): Promise<string> {
  const payload = `${userId}:${Date.now()}`
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  const b64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
  return btoa(`${payload}:${b64}`)
}

async function verifySession(token: string, secret: string): Promise<boolean> {
  try {
    const decoded = atob(token)
    const lastColon = decoded.lastIndexOf(':')
    const payload = decoded.slice(0, lastColon)
    const sig = decoded.slice(lastColon + 1)
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    )
    const expected = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
    const expectedB64 = btoa(String.fromCharCode(...new Uint8Array(expected)))
    if (sig !== expectedB64) return false
    // 檢查時間（7天）
    const ts = parseInt(payload.split(':')[1] || '0')
    return Date.now() - ts < SESSION_MAX_AGE * 1000
  } catch {
    return false
  }
}

function getCookie(req: Request, name: string): string | null {
  const cookie = req.headers.get('Cookie') || ''
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/api/*', cors())

// ─── Auth 中介層：保護所有 API 與頁面 ────────────────────────
app.use('*', async (c, next) => {
  const path = new URL(c.req.url).pathname
  // 放行：登入 API 本身
  if (path === '/api/auth/login' || path === '/api/auth/logout' || path === '/favicon.ico') {
    return next()
  }
  const secret = c.env?.SESSION_SECRET || 'dev-secret-chicken-king-2026'
  const token = getCookie(c.req.raw, SESSION_COOKIE)
  if (token && await verifySession(token, secret)) {
    return next()
  }
  // API 請求 → 回 401
  if (path.startsWith('/api/')) {
    return c.json({ error: '未登入', code: 401 }, 401)
  }
  // 頁面請求 → 回登入頁
  return c.html(getLoginHTML())
})

// ─── 登入 API ────────────────────────────────────────────────
app.post('/api/auth/login', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const password = (body as any).password || ''
  const correctPw = c.env?.APP_PASSWORD || 'chicken2026'
  if (password !== correctPw) {
    return c.json({ error: '密碼錯誤' }, 401)
  }
  const secret = c.env?.SESSION_SECRET || 'dev-secret-chicken-king-2026'
  const token = await signSession('owner', secret)
  const cookieVal = `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}`
  c.header('Set-Cookie', cookieVal)
  return c.json({ success: true })
})

// ─── 登出 API ────────────────────────────────────────────────
app.post('/api/auth/logout', (c) => {
  c.header('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; Max-Age=0`)
  return c.json({ success: true })
})

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

// ─── 登入頁面 HTML ────────────────────────────────────────────
function getLoginHTML(): string {
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <title>雞王進銷存系統 · 登入</title>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <style>
    /* ══════════════════════════════════════════
       雞王 ERP v3 · 暗黑精工主題
    ══════════════════════════════════════════ */
    :root {
      --gold:       #f5c842;
      --gold-lt:    #ffd95a;
      --gold-dim:   #c9a120;
      --gold-bg:    rgba(245,200,66,.10);
      --sidebar-bg: #0c0c0e;
      --sidebar-w:  210px;
      --bg:         #0f0f12;
      --bg-2:       #14141a;
      --bg-3:       #1a1a22;
      --surface:    #16161e;
      --surface-2:  #1c1c26;
      --border:     #2a2a38;
      --border-lt:  #38384a;
      --text:       #eeeaf0;
      --text-2:     #9090a8;
      --text-dim:   #505060;
      --green:      #34d399;
      --green-bg:   rgba(52,211,153,.12);
      --green-dim:  rgba(52,211,153,.06);
      --red:        #f87171;
      --red-bg:     rgba(248,113,113,.12);
      --red-dim:    rgba(248,113,113,.06);
      --blue:       #60a5fa;
      --blue-bg:    rgba(96,165,250,.12);
      --blue-dim:   rgba(96,165,250,.06);
      --purple:     #c084fc;
      --purple-bg:  rgba(192,132,252,.12);
      /* aliases */
      --orange:     #f5c842;
      --orange-lt:  #ffd95a;
      --orange-dim: #c9a120;
      --orange-bg:  rgba(245,200,66,.10);
      --radius:     7px;
      --radius-lg:  11px;
      --shadow-sm:  0 1px 4px rgba(0,0,0,.6);
      --shadow:     0 3px 14px rgba(0,0,0,.7);
      --shadow-lg:  0 6px 30px rgba(0,0,0,.8);
    }

    *, *::before, *::after { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }

    body {
      font-family: 'SF Pro Text', -apple-system, BlinkMacSystemFont,
                   'PingFang TC', 'Noto Sans TC', sans-serif;
      background: var(--bg);
      color: var(--text);
      margin: 0;
      font-size: 18px;
      line-height: 1.5;
    }

    /* 精密格線 */
    body::before {
      content:''; position:fixed; inset:0; pointer-events:none; z-index:0;
      background-image:
        linear-gradient(rgba(245,200,66,.018) 1px, transparent 1px),
        linear-gradient(90deg, rgba(245,200,66,.018) 1px, transparent 1px);
      background-size: 28px 28px;
    }

    /* Scrollbar */
    ::-webkit-scrollbar { width: 3px; height: 3px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #2a2a3a; border-radius: 2px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--gold); }

    /* ══ SIDEBAR ══ */
    .sidebar {
      width: var(--sidebar-w);
      background: var(--sidebar-bg);
      border-right: 1px solid var(--border);
      flex-shrink: 0;
      box-shadow: 3px 0 24px rgba(0,0,0,.7);
    }
    .sidebar-logo {
      padding: 14px 12px 12px;
      border-bottom: 1px solid var(--border);
      display: flex; align-items: center; gap: 9px;
    }
    .logo-icon {
      width: 34px; height: 34px;
      background: linear-gradient(135deg, var(--gold), var(--gold-dim));
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      font-size: 23px; font-weight: 900; color: #0a0a0a;
      flex-shrink: 0;
      box-shadow: 0 0 0 1px rgba(245,200,66,.5), 0 4px 14px rgba(245,200,66,.25);
    }
    .logo-text .name { font-size: 21px; font-weight: 800; color: var(--text); letter-spacing: .3px; }
    .logo-text .sub  { font-size: 15px; color: var(--text-dim); letter-spacing: 1.2px; text-transform: uppercase; margin-top: 1px; }

    .nav-section-label {
      font-size: 14px; font-weight: 700; letter-spacing: 2.5px;
      color: var(--text-dim); text-transform: uppercase;
      padding: 12px 13px 3px;
    }
    .nav-item {
      display: flex; align-items: center; gap: 7px;
      width: calc(100% - 8px); margin: 1px 4px;
      padding: 6px 8px;
      border-radius: 6px;
      font-size: 18px; font-weight: 500;
      color: var(--text-2);
      cursor: pointer; transition: all .12s;
      border: none; background: none; text-align: left;
    }
    .nav-item:hover { background: var(--bg-3); color: var(--text); }
    .nav-item.active {
      background: var(--gold-bg);
      color: var(--gold);
      font-weight: 600;
      border: 1px solid rgba(245,200,66,.22);
    }
    .nav-item .icon-wrap {
      width: 20px; height: 20px; border-radius: 5px;
      display: flex; align-items: center; justify-content: center;
      font-size: 16px; color: var(--text-dim);
      transition: all .12s; flex-shrink: 0;
    }
    .nav-item.active .icon-wrap { color: var(--gold); }
    .nav-item:hover  .icon-wrap { color: var(--text); }

    /* ══ TOP HEADER ══ */
    .top-header {
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      padding: 0 14px;
      height: 46px;
      display: flex; align-items: center; justify-content: space-between;
      position: sticky; top: 0; z-index: 20;
      box-shadow: 0 1px 0 var(--border), 0 2px 14px rgba(0,0,0,.5);
    }
    .page-title-area { display: flex; align-items: center; gap: 9px; }
    .mobile-logo {
      width: 28px; height: 28px;
      background: linear-gradient(135deg, var(--gold), var(--gold-dim));
      border-radius: 7px;
      display: flex; align-items: center; justify-content: center;
      font-size: 20px; font-weight: 900; color: #0a0a0a;
      box-shadow: 0 0 0 1px rgba(245,200,66,.4);
    }
    #page-title {
      font-size: 20px; font-weight: 700; color: var(--text); letter-spacing: .2px;
    }
    .header-right { display: flex; align-items: center; gap: 7px; }
    .date-chip {
      font-size: 16px; color: var(--text-dim);
      background: var(--bg-3); border-radius: 5px;
      padding: 3px 7px; border: 1px solid var(--border);
      letter-spacing: .2px;
    }

    /* ══ BUTTONS ══ */
    .btn-primary {
      background: linear-gradient(135deg, var(--gold), var(--gold-dim));
      color: #0a0a0a;
      border-radius: var(--radius); padding: 6px 14px;
      font-weight: 800; font-size: 17px; cursor: pointer;
      border: none; transition: all .12s;
      display: inline-flex; align-items: center; gap: 4px;
      box-shadow: 0 0 0 1px rgba(245,200,66,.35), 0 2px 8px rgba(245,200,66,.2);
      letter-spacing: .3px;
    }
    .btn-primary:hover { filter: brightness(1.12); transform: translateY(-1px); box-shadow: 0 0 0 1px rgba(245,200,66,.5), 0 4px 16px rgba(245,200,66,.3); }
    .btn-primary:active { transform: translateY(0); filter: brightness(.95); }

    .btn-secondary {
      background: var(--bg-3); color: var(--text-2);
      border: 1px solid var(--border);
      border-radius: var(--radius); padding: 6px 11px;
      font-weight: 600; font-size: 17px; cursor: pointer;
      transition: all .12s;
      display: inline-flex; align-items: center; gap: 4px;
    }
    .btn-secondary:hover { border-color: var(--border-lt); color: var(--text); background: var(--bg-2); }

    .btn-success {
      background: var(--green-bg); color: var(--green);
      border: 1px solid rgba(52,211,153,.22);
      border-radius: var(--radius); padding: 6px 11px;
      font-weight: 700; font-size: 17px; cursor: pointer;
      transition: all .12s;
      display: inline-flex; align-items: center; gap: 4px;
    }
    .btn-success:hover { background: rgba(52,211,153,.2); }

    .btn-danger {
      background: var(--red-bg); color: var(--red);
      border: 1px solid rgba(248,113,113,.22);
      border-radius: var(--radius); padding: 5px 9px;
      font-weight: 600; font-size: 17px; cursor: pointer;
      transition: all .12s;
      display: inline-flex; align-items: center; gap: 3px;
    }
    .btn-danger:hover { background: rgba(248,113,113,.2); }

    .btn-logout {
      width: 28px; height: 28px; border-radius: var(--radius);
      border: 1px solid var(--border);
      background: var(--bg-3); color: var(--text-dim);
      cursor: pointer; font-size: 18px;
      display: flex; align-items: center; justify-content: center;
      transition: all .12s;
    }
    .btn-logout:hover { color: var(--red); border-color: rgba(248,113,113,.4); background: var(--red-bg); }

    /* ══ CARDS ══ */
    .card {
      background: var(--surface);
      border-radius: var(--radius-lg);
      border: 1px solid var(--border);
      box-shadow: var(--shadow-sm);
    }
    .card-hover { transition: all .12s; }
    .card-hover:hover { border-color: var(--border-lt); box-shadow: var(--shadow); transform: translateY(-1px); }

    /* ── KPI Cards ── */
    .kpi-card {
      border-radius: var(--radius-lg); padding: 14px 16px;
      border: 1px solid var(--border);
      background: var(--surface);
      box-shadow: var(--shadow-sm);
      position: relative; overflow: hidden;
    }
    .kpi-card::before {
      content:''; position:absolute; top:0; left:0; right:0; height:2px;
    }
    .kpi-card.gold   { background: linear-gradient(160deg,#1c1810,var(--surface)); border-color: rgba(245,200,66,.25); }
    .kpi-card.gold::before { background: linear-gradient(90deg, var(--gold), transparent); }
    .kpi-card.green  { background: linear-gradient(160deg,#0d1c14,var(--surface)); border-color: rgba(52,211,153,.25); }
    .kpi-card.green::before { background: linear-gradient(90deg, var(--green), transparent); }
    .kpi-card.red    { background: linear-gradient(160deg,#1c0d0d,var(--surface)); border-color: rgba(248,113,113,.25); }
    .kpi-card.red::before { background: linear-gradient(90deg, var(--red), transparent); }
    .kpi-card.blue   { background: linear-gradient(160deg,#0d1220,var(--surface)); border-color: rgba(96,165,250,.25); }
    .kpi-card.blue::before { background: linear-gradient(90deg, var(--blue), transparent); }

    .kpi-label { font-size: 16px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 6px; }
    .kpi-card.gold  .kpi-label { color: var(--gold-dim); }
    .kpi-card.green .kpi-label { color: rgba(52,211,153,.7); }
    .kpi-card.red   .kpi-label { color: rgba(248,113,113,.7); }
    .kpi-card.blue  .kpi-label { color: rgba(96,165,250,.7); }

    .kpi-value { font-size: 31px; font-weight: 800; letter-spacing: -.5px; line-height: 1; }
    .kpi-card.gold  .kpi-value { color: var(--gold); }
    .kpi-card.green .kpi-value { color: var(--green); }
    .kpi-card.red   .kpi-value { color: var(--red); }
    .kpi-card.blue  .kpi-value { color: var(--blue); }

    .kpi-sub { font-size: 16px; color: var(--text-dim); margin-top: 4px; }

    /* ══ INPUTS ══ */
    .input-field {
      border: 1px solid var(--border);
      border-radius: var(--radius); padding: 8px 11px;
      width: 100%; font-size: 19px;
      outline: none;
      background: var(--bg-2);
      color: var(--text);
      transition: border-color .12s, box-shadow .12s;
    }
    .input-field::placeholder { color: var(--text-dim); }
    .input-field:focus {
      border-color: var(--gold);
      box-shadow: 0 0 0 3px rgba(245,200,66,.1);
      background: var(--surface-2);
    }
    select.input-field {
      background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239090a8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
      background-position: right 9px center;
      background-repeat: no-repeat;
      background-size: 15px;
      appearance: none; padding-right: 30px;
    }
    label { font-size: 17px; font-weight: 600; color: var(--text-2); display: block; margin-bottom: 4px; letter-spacing: .3px; text-transform: uppercase; }

    /* ══ TABLES ══ */
    .tbl-wrap {
      overflow-x: auto;
      border-radius: var(--radius-lg);
      border: 1px solid var(--border);
      background: var(--surface);
      box-shadow: var(--shadow-sm);
    }
    table { width: 100%; border-collapse: collapse; }
    .table-header { background: var(--bg-2); }
    .table-header th {
      font-size: 18px; font-weight: 700;
      color: var(--text-2); padding: 7px 8px;
      border-bottom: 1px solid var(--border);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: clip;
    }
    tbody tr { border-bottom: 1px solid rgba(42,42,56,.8); transition: background .1s; }
    tbody tr:hover { background: var(--bg-3); }
    tbody tr:last-child { border-bottom: none; }
    td {
      padding: 6px 8px;
      font-size: 18px;
      color: var(--text);
      vertical-align: middle;
      white-space: nowrap;
      overflow: hidden;
    }

    /* 數字欄右對齊 */
    .td-num { text-align: right; font-variant-numeric: tabular-nums; font-size: 18px; font-weight: 600; }
    .td-ctr { text-align: center; }

    /* 表格儲存格顏色 helper（取代 inline style，確保字體大小不被覆蓋） */
    .tc-dim  { color: var(--text-dim); }
    .tc-bold { font-weight: 600; }
    .tc-sub  { color: var(--text-2); }
    .tc-blue { color: var(--blue); }
    .tc-gold { color: var(--gold); }

    /* ══ BADGES ══ */
    .status-paid    { background: var(--green-bg); color: var(--green); padding: 2px 7px; border-radius: 4px; font-size: 16px; font-weight: 700; display: inline-block; border: 1px solid rgba(52,211,153,.25); letter-spacing: .3px; }
    .status-unpaid  { background: var(--red-bg); color: var(--red); padding: 2px 7px; border-radius: 4px; font-size: 16px; font-weight: 700; display: inline-block; border: 1px solid rgba(248,113,113,.25); letter-spacing: .3px; }
    .status-partial { background: var(--gold-bg); color: var(--gold); padding: 2px 7px; border-radius: 4px; font-size: 16px; font-weight: 700; display: inline-block; border: 1px solid rgba(245,200,66,.3); letter-spacing: .3px; }
    .badge-fresh  { background: var(--green-bg); color: var(--green); padding: 1px 6px; border-radius: 3px; font-size: 15px; font-weight: 700; display: inline-block; border: 1px solid rgba(52,211,153,.2); }
    .badge-frozen { background: var(--blue-bg); color: var(--blue); padding: 1px 6px; border-radius: 3px; font-size: 15px; font-weight: 700; display: inline-block; border: 1px solid rgba(96,165,250,.2); }
    .badge-cooked { background: var(--gold-bg); color: var(--gold); padding: 1px 6px; border-radius: 3px; font-size: 15px; font-weight: 700; display: inline-block; border: 1px solid rgba(245,200,66,.25); }

    /* ══ AMOUNT ══ */
    .amount-positive { color: var(--green); font-weight: 700; }
    .amount-negative { color: var(--red); font-weight: 700; }
    .amount-gold     { color: var(--gold); font-weight: 700; }

    /* ══ TABS ══ */
    .tab-btn {
      padding: 5px 14px; border-radius: var(--radius);
      cursor: pointer; font-size: 17px; font-weight: 600;
      color: var(--text-dim); transition: all .12s; border: 1px solid transparent;
      background: none;
    }
    .tab-btn.active { background: var(--gold-bg); color: var(--gold); border-color: rgba(245,200,66,.3); }
    .tab-btn:hover:not(.active) { background: var(--bg-3); color: var(--text-2); }

    /* ══ MODAL ══ */
    .modal-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,.55);
      backdrop-filter: blur(3px);
      z-index: 50; display: flex;
      align-items: flex-end; justify-content: center;
    }
    @media (min-width: 640px) { .modal-overlay { align-items: center; } }
    .modal-box {
      background: var(--surface-2);
      border: 1px solid var(--border-lt);
      width: 100%; max-width: 560px;
      border-radius: 14px 14px 0 0;
      padding: 20px 18px;
      max-height: 92vh; overflow-y: auto;
      box-shadow: 0 -10px 40px rgba(0,0,0,.5);
    }
    @media (min-width: 640px) { .modal-box { border-radius: 14px; box-shadow: var(--shadow-lg); } }
    .modal-handle {
      width: 32px; height: 3px;
      background: var(--border-lt); border-radius: 2px;
      margin: 0 auto 14px;
    }
    .modal-title { font-size: 21px; font-weight: 700; color: var(--text); margin-bottom: 16px; display: flex; align-items: center; gap: 7px; }
    .modal-title i { color: var(--gold); }

    /* ══ MOBILE NAV ══ */
    .mobile-nav {
      position: fixed; bottom: 0; left: 0; right: 0;
      background: var(--surface);
      border-top: 1px solid var(--border);
      z-index: 40; padding: 4px 2px 6px;
      display: grid; grid-template-columns: repeat(5, 1fr);
      box-shadow: 0 -2px 14px rgba(0,0,0,.5);
    }
    .nav-mobile-btn {
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 2px; padding: 4px 2px;
      border-radius: 7px; border: none;
      background: none; color: var(--text-dim);
      cursor: pointer; transition: all .12s;
      font-size: 16px; font-weight: 500;
    }
    .nav-mobile-btn i { font-size: 25px; transition: all .12s; }
    .nav-mobile-btn.active { color: var(--gold); }
    .nav-mobile-active-dot {
      width: 3px; height: 3px; border-radius: 50%;
      background: var(--gold); margin-top: 1px; display: none;
    }
    .nav-mobile-btn.active .nav-mobile-active-dot { display: block; }

    /* ══ LAYOUT ══ */
    @media (max-width: 767px) {
      .sidebar { display: none !important; }
      .mobile-nav { display: grid; }
    }
    @media (min-width: 768px) {
      .mobile-nav { display: none !important; }
    }

    /* ══ MISC ══ */
    .page { display: none; }
    .page.active { display: block; }
    .loading {
      display: inline-block; width: 14px; height: 14px;
      border: 2px solid rgba(245,200,66,.2);
      border-radius: 50%; border-top-color: var(--gold);
      animation: spin .7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .section-title {
      font-size: 18px; font-weight: 700; letter-spacing: .8px;
      text-transform: uppercase;
      color: var(--text-dim);
      margin-bottom: 10px; padding: 0 2px;
    }

    /* ══ STATEMENT ══ */
    .statement-card { background: var(--surface); border-radius: var(--radius-lg); overflow: hidden; border: 1px solid var(--border); box-shadow: var(--shadow); }
    .statement-header {
      background: linear-gradient(135deg, #141420, #1e1e2e);
      border-bottom: 2px solid var(--gold);
      padding: 16px 20px;
    }
    .statement-row-odd  { background: var(--bg-2); }
    .statement-row-even { background: var(--surface); }
    .statement-total-row { background: rgba(245,200,66,.07); }
    .statement-badge { display: inline-block; padding: 1px 7px; border-radius: 3px; font-size: 16px; font-weight: 700; }
    .capture-area { position: relative; }
    @media print {
      .no-print { display: none !important; }
      body { background: white; color: black; }
    }

    /* ══ MORE PAGE ══ */
    .more-grid-item {
      background: var(--surface);
      border-radius: var(--radius-lg); border: 1px solid var(--border);
      padding: 15px 8px;
      display: flex; flex-direction: column; align-items: center; gap: 7px;
      cursor: pointer; transition: all .12s;
      box-shadow: var(--shadow-sm);
    }
    .more-grid-item:hover { border-color: var(--gold); box-shadow: var(--shadow); transform: translateY(-1px); }
    .more-grid-item.featured { border-color: rgba(245,200,66,.4); background: rgba(245,200,66,.05); }
    .more-icon-wrap {
      width: 40px; height: 40px; border-radius: 11px;
      display: flex; align-items: center; justify-content: center;
      font-size: 25px;
    }
    .more-label { font-size: 17px; font-weight: 600; color: var(--text-2); }

    /* ══ FORM ══ */
    .form-row { display: grid; gap: 10px; margin-bottom: 12px; }
    .form-row-2 { grid-template-columns: 1fr 1fr; }
    .form-row-3 { grid-template-columns: 1fr 1fr 1fr; }
    @media (max-width: 480px) { .form-row-2, .form-row-3 { grid-template-columns: 1fr; } }

    .divider { border: none; border-top: 1px solid var(--border); margin: 12px 0; }

    .empty-state { text-align: center; padding: 40px 20px; color: var(--text-dim); }
    .empty-state i { font-size: 41px; margin-bottom: 10px; opacity: .25; display: block; }
    .empty-state p { font-size: 18px; }

    /* ══ SUMMARY CARDS ══ */
    .sum-cards {
      display: grid; gap: 10px;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      margin-bottom: 12px;
    }
    .sum-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 12px 14px;
      box-shadow: var(--shadow-sm);
    }
    .sum-card-label { font-size: 15px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: var(--text-dim); margin-bottom: 4px; }
    .sum-card-value { font-size: 25px; font-weight: 800; letter-spacing: -.3px; color: var(--gold); }
    .sum-card-value.green { color: var(--green); }
    .sum-card-value.red   { color: var(--red); }
    .sum-card-value.blue  { color: var(--blue); }

    /* ══ FILTER BAR ══ */
    .filter-bar {
      display: flex; align-items: center; gap: 8px;
      flex-wrap: wrap; margin-bottom: 12px;
    }
    .filter-bar select {
      background: var(--bg-2); color: var(--text-2);
      border: 1px solid var(--border); border-radius: var(--radius);
      padding: 5px 28px 5px 9px; font-size: 17px; cursor: pointer;
      appearance: none;
      background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239090a8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
      background-position: right 8px center;
      background-repeat: no-repeat; background-size: 14px;
    }
    .filter-bar select:focus { outline: none; border-color: var(--gold); }

    /* ══ FIXED TABLE ══
       .ftbl = table-layout:fixed，讓 <colgroup> 完全控制欄寬
       .fc   = 文字強制單行、超出截斷（名稱欄用）
       .ic-btn = icon 操作按鈕
    */
    .ftbl {
      table-layout: fixed;
      width: 100%;
    }
    .ftbl th, .ftbl td {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: clip;    /* 欄位夠大就不截；不夠才靠 .fc 的 ellipsis */
    }
    /* 文字欄：超出欄寬顯示「...」 */
    .fc {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    /* icon 操作按鈕 */
    .ic-btn {
      background: none; border: none; cursor: pointer;
      padding: 2px 4px; border-radius: 4px;
      font-size: 17px; line-height: 1;
      transition: opacity .12s;
    }
    .ic-btn:hover { opacity: .7; }
    .ic-edit { color: var(--blue); }
    .ic-del  { color: var(--red); }
    .ic-grp  { color: var(--gold); }

    #toast-container .toast { box-shadow: var(--shadow-lg) !important; }
  </style>
</head>
<body>
<div class="glow glow-1"></div>
<div class="glow glow-2"></div>

<div class="login-wrap">
  <div class="brand-bar">
    <div class="brand-emblem">雞</div>
    <div class="brand-info">
      <div class="n1">雞王管理系統</div>
      <div class="n2">Chicken King ERP</div>
    </div>
  </div>

  <div class="login-card">
    <div class="card-title">— 身份驗證 —</div>

    <div class="error-msg" id="err-msg">
      <i class="fas fa-times-circle" style="margin-right:6px"></i>密碼錯誤，請再試一次
    </div>

    <form onsubmit="doLogin(event)">
      <div class="input-wrap">
        <i class="fas fa-key"></i>
        <input type="password" id="pw-input" placeholder="請輸入存取密碼"
               autocomplete="current-password" autofocus>
      </div>
      <button type="submit" class="btn-login" id="login-btn">
        <i class="fas fa-arrow-right-to-bracket"></i>進入系統
      </button>
    </form>

    <div class="divider">
      <div class="divider-line"></div>
      <div class="divider-text">SECURE ACCESS</div>
      <div class="divider-line"></div>
    </div>

    <div class="hint">
      <i class="fas fa-lock"></i>&nbsp;資料加密保護，不對外公開
    </div>
  </div>
</div>

<script>
async function doLogin(e) {
  e.preventDefault()
  const pw = document.getElementById('pw-input').value
  const btn = document.getElementById('login-btn')
  const err = document.getElementById('err-msg')
  if (!pw) return
  btn.innerHTML = '<span class="loading-spinner"></span>&nbsp;驗證中...'
  btn.disabled = true
  err.style.display = 'none'
  try {
    const res = await fetch('/api/auth/login', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({password: pw})
    })
    if (res.ok) {
      btn.innerHTML = '<i class="fas fa-check"></i>&nbsp;驗證成功'
      btn.style.background = '#22c55e'
      setTimeout(() => location.reload(), 400)
    } else {
      err.style.display = 'block'
      btn.innerHTML = '<i class="fas fa-arrow-right-to-bracket"></i>進入系統'
      btn.disabled = false
      document.getElementById('pw-input').select()
    }
  } catch {
    err.textContent = '網路錯誤，請稍後再試'
    err.style.display = 'block'
    btn.innerHTML = '<i class="fas fa-arrow-right-to-bracket"></i>進入系統'
    btn.disabled = false
  }
}
</script>
</body>
</html>`
}

function getIndexHTML(): string {
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>雞王進銷存系統</title>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/dayjs@1.11.10/dayjs.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
  <style>
    /* ══════════════════════════════════════════
       雞王進銷存系統 · 台灣傳統進銷存風格
       Windows XP 工業派 · 深綠表頭 · 白底表格
    ══════════════════════════════════════════ */
    :root {
      /* 傳統進銷存配色 */
      --win-bg:        #d4d0c8;   /* Windows XP 視窗灰 */
      --win-bg-dk:     #c0bdb5;
      --win-border:    #808080;
      --win-border-lt: #ffffff;
      --win-border-dk: #404040;
      --win-surface:   #ffffff;
      --win-header:    #005500;   /* 深綠表頭 */
      --win-header-t:  #007700;
      --win-row-odd:   #ffffff;
      --win-row-even:  #f0f4f0;   /* 淡綠斑馬紋 */
      --win-row-hover: #ddeedd;
      --text:          #000000;
      --text-2:        #333333;
      --text-dim:      #666666;
      --text-header:   #ffffff;
      --text-pink:     #cc0066;   /* 品名用玫瑰紅 */
      --text-blue:     #0000cc;
      --green:         #006600;
      --green-bg:      #e0f0e0;
      --red:           #cc0000;
      --red-bg:        #ffe0e0;
      --blue:          #0044cc;
      --blue-bg:       #e0e8ff;
      --gold:          #cc8800;
      --gold-bg:       #fff4cc;
      --sidebar-w:     180px;
      --radius:        2px;
      --radius-lg:     3px;
      /* aliases for backward compat */
      --orange:        #cc8800;
      --orange-bg:     #fff4cc;
      --orange-dim:    #996600;
      --bg:            #d4d0c8;
      --bg-2:          #c8c4bc;
      --bg-3:          #bcb8b0;
      --surface:       #ffffff;
      --surface-2:     #f8f8f8;
      --border:        #808080;
      --border-lt:     #b0b0b0;
      --shadow-sm:     inset -1px -1px 0 #404040, inset 1px 1px 0 #ffffff;
      --shadow:        2px 2px 4px rgba(0,0,0,.3);
      --shadow-lg:     3px 3px 8px rgba(0,0,0,.4);
    }

    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-tap-highlight-color: transparent;
    }

    body {
      /* 細明體 = 台灣傳統軟體標準字型 */
      font-family: '細明體', 'MingLiU', 'PMingLiU', 'Noto Serif TC',
                   'Microsoft JhengHei', 'PingFang TC', monospace;
      background: var(--win-bg);
      color: var(--text);
      margin: 0;
      font-size: 19px;
      line-height: 1.4;
    }

    /* Scrollbar — Windows 風 */
    ::-webkit-scrollbar { width: 12px; height: 12px; }
    ::-webkit-scrollbar-track { background: var(--win-bg); border: 1px solid var(--win-border); }
    ::-webkit-scrollbar-thumb {
      background: var(--win-bg);
      border: 1px solid var(--win-border);
      box-shadow: inset -1px -1px 0 #404040, inset 1px 1px 0 #fff;
    }

    /* ══ SIDEBAR ══ */
    .sidebar {
      width: var(--sidebar-w);
      background: var(--win-bg);
      border-right: 2px solid var(--win-border-dk);
      flex-shrink: 0;
    }
    .sidebar-logo {
      padding: 6px 8px 5px;
      background: var(--win-header);
      border-bottom: 2px solid #003300;
      display: flex; align-items: center; gap: 6px;
    }
    .logo-icon {
      width: 28px; height: 28px;
      background: #ffcc00;
      border: 1px solid #884400;
      border-radius: 2px;
      display: flex; align-items: center; justify-content: center;
      font-size: 20px; font-weight: 900; color: #004400;
      flex-shrink: 0;
    }
    .logo-text .name { font-size: 19px; font-weight: 700; color: #ffffff; }
    .logo-text .sub  { font-size: 15px; color: #aaffaa; letter-spacing: .5px; }

    .nav-section-label {
      font-size: 16px; font-weight: 700;
      color: var(--text-dim);
      background: var(--win-bg-dk);
      border-bottom: 1px solid var(--win-border);
      border-top: 1px solid #ffffff;
      padding: 3px 8px;
      margin-top: 6px;
      letter-spacing: .5px;
    }
    .nav-item {
      display: flex; align-items: center; gap: 5px;
      width: 100%;
      padding: 4px 10px;
      font-size: 18px; font-weight: 400;
      color: var(--text);
      cursor: pointer;
      border: none; background: none; text-align: left;
      border-bottom: 1px solid transparent;
    }
    .nav-item:hover { background: var(--win-row-hover); }
    .nav-item.active {
      background: var(--win-header);
      color: #ffffff;
      font-weight: 700;
    }
    .nav-item .icon-wrap {
      width: 16px; height: 16px;
      display: flex; align-items: center; justify-content: center;
      font-size: 16px;
      flex-shrink: 0;
    }
    .nav-item.active .icon-wrap { color: #ffffff; }

    /* ══ TOP HEADER ══ */
    .top-header {
      background: var(--win-header);
      padding: 0 10px;
      height: 36px;
      display: flex; align-items: center; justify-content: space-between;
      position: sticky; top: 0; z-index: 20;
      border-bottom: 2px solid #003300;
    }
    .page-title-area { display: flex; align-items: center; gap: 8px; }
    .mobile-logo {
      width: 24px; height: 24px;
      background: #ffcc00;
      border: 1px solid #884400;
      border-radius: 2px;
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; font-weight: 900; color: #004400;
    }
    #page-title {
      font-size: 19px; font-weight: 700; color: #ffffff; letter-spacing: .3px;
    }
    .header-right { display: flex; align-items: center; gap: 5px; }
    .date-chip {
      font-size: 17px; color: #ccffcc;
      background: rgba(0,0,0,.2);
      border: 1px solid rgba(255,255,255,.2);
      border-radius: 2px;
      padding: 2px 6px;
    }

    /* ══ BUTTONS — Windows 3D 立體風 ══ */
    .btn-primary, .btn-secondary, .btn-success, .btn-danger {
      font-family: inherit;
      font-size: 18px; font-weight: 400;
      cursor: pointer;
      padding: 3px 10px;
      border-radius: 2px;
      display: inline-flex; align-items: center; gap: 4px;
      border: 1px solid;
      /* Windows 3D raised border */
      border-color: #ffffff #808080 #808080 #ffffff;
      box-shadow: inset -1px -1px 0 #404040, inset 1px 1px 0 #dfdfdf;
      transition: none;
    }
    .btn-primary {
      background: var(--win-bg);
      color: #000000;
    }
    .btn-primary:hover { background: #e0ddd8; }
    .btn-primary:active {
      border-color: #808080 #ffffff #ffffff #808080;
      box-shadow: inset 1px 1px 0 #404040, inset -1px -1px 0 #dfdfdf;
    }
    .btn-secondary {
      background: var(--win-bg);
      color: #000000;
    }
    .btn-secondary:hover { background: #e0ddd8; }
    .btn-success {
      background: var(--win-bg);
      color: var(--green);
    }
    .btn-danger {
      background: var(--win-bg);
      color: var(--red);
    }
    .btn-logout {
      font-family: inherit;
      width: 26px; height: 22px;
      border-radius: 2px;
      border: 1px solid;
      border-color: #ffffff #808080 #808080 #ffffff;
      box-shadow: inset -1px -1px 0 #404040, inset 1px 1px 0 #dfdfdf;
      background: var(--win-bg); color: var(--red);
      cursor: pointer; font-size: 17px;
      display: flex; align-items: center; justify-content: center;
    }
    .btn-logout:hover { background: var(--red-bg); }

    /* ══ CARDS ══ */
    .card {
      background: var(--win-surface);
      border: 2px solid;
      border-color: #ffffff #808080 #808080 #ffffff;
      box-shadow: var(--shadow-sm);
    }
    .card-hover:hover { background: #f8fff8; }

    /* ── KPI Cards ── */
    .kpi-card {
      padding: 10px 14px;
      border: 2px solid;
      border-color: #ffffff #808080 #808080 #ffffff;
      background: var(--win-surface);
      box-shadow: var(--shadow-sm);
    }
    .kpi-card.gold  { background: var(--gold-bg); border-left: 4px solid var(--gold); }
    .kpi-card.green { background: var(--green-bg); border-left: 4px solid var(--green); }
    .kpi-card.red   { background: var(--red-bg); border-left: 4px solid var(--red); }
    .kpi-card.blue  { background: var(--blue-bg); border-left: 4px solid var(--blue); }

    .kpi-label { font-size: 17px; font-weight: 700; margin-bottom: 5px; color: var(--text-2); }
    .kpi-value { font-size: 27px; font-weight: 700; font-variant-numeric: tabular-nums; }
    .kpi-card.gold  .kpi-value { color: var(--gold); }
    .kpi-card.green .kpi-value { color: var(--green); }
    .kpi-card.red   .kpi-value { color: var(--red); }
    .kpi-card.blue  .kpi-value { color: var(--blue); }
    .kpi-sub { font-size: 16px; color: var(--text-dim); margin-top: 3px; }

    /* ══ INPUTS ══ */
    .input-field {
      border: 2px solid;
      border-color: #808080 #ffffff #ffffff #808080;
      box-shadow: inset 1px 1px 0 #404040;
      border-radius: 0;
      padding: 3px 6px;
      width: 100%; font-size: 19px;
      font-family: inherit;
      outline: none;
      background: #ffffff;
      color: var(--text);
    }
    .input-field:focus { outline: 1px dotted var(--blue); }
    select.input-field { cursor: pointer; }
    label { font-size: 18px; font-weight: 400; color: var(--text); display: block; margin-bottom: 3px; }

    /* ══ TABLES ══ */
    .tbl-wrap {
      overflow-x: auto;
      border: 2px solid;
      border-color: #808080 #ffffff #ffffff #808080;
      box-shadow: inset 1px 1px 0 #404040;
      background: var(--win-surface);
    }
    table { width: 100%; border-collapse: collapse; }

    /* 表頭：深綠底白字 */
    .table-header { background: var(--win-header); }
    .table-header th {
      font-size: 18px; font-weight: 700;
      color: var(--text-header);
      padding: 5px 6px;
      border-right: 1px solid #006600;
      border-bottom: 2px solid #003300;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: clip;
      text-align: center;
    }
    .table-header th:last-child { border-right: none; }

    /* 資料列 */
    tbody tr:nth-child(odd)  { background: var(--win-row-odd); }
    tbody tr:nth-child(even) { background: var(--win-row-even); }
    tbody tr:hover { background: var(--win-row-hover); }
    tbody tr { border-bottom: 1px solid #ccddcc; }
    tbody tr:last-child { border-bottom: none; }

    td {
      padding: 4px 6px;
      font-size: 18px;
      color: var(--text);
      vertical-align: middle;
      white-space: nowrap;
      overflow: hidden;
      border-right: 1px solid #ddeedd;
      font-family: '細明體', 'MingLiU', 'PMingLiU', 'Microsoft JhengHei', monospace;
    }
    td:last-child { border-right: none; }

    /* 數字欄 */
    .td-num {
      text-align: right;
      font-variant-numeric: tabular-nums;
      font-size: 18px;
      font-weight: 400;
      font-family: 'Courier New', 'Consolas', monospace;
    }
    .td-ctr { text-align: center; }

    /* 儲存格顏色 helper */
    .tc-dim  { color: var(--text-dim); }
    .tc-bold { font-weight: 700; }
    .tc-sub  { color: var(--text-2); }
    .tc-blue { color: var(--text-blue); }
    .tc-gold { color: var(--gold); font-weight: 700; }
    /* 品名用玫瑰紅（仿照圖片風格） */
    .fc { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: var(--text-pink); font-weight: 400; }

    /* ══ BADGES / STATUS ══ */
    .status-paid {
      background: var(--green-bg); color: var(--green);
      padding: 1px 5px; border: 1px solid #99cc99;
      font-size: 17px; font-weight: 700; display: inline-block;
    }
    .status-unpaid {
      background: var(--red-bg); color: var(--red);
      padding: 1px 5px; border: 1px solid #cc9999;
      font-size: 17px; font-weight: 700; display: inline-block;
    }
    .status-partial {
      background: var(--gold-bg); color: var(--gold);
      padding: 1px 5px; border: 1px solid #ccaa66;
      font-size: 17px; font-weight: 700; display: inline-block;
    }
    .badge-fresh {
      background: var(--green-bg); color: var(--green);
      padding: 1px 4px; border: 1px solid #99cc99;
      font-size: 17px; font-weight: 700; display: inline-block;
    }
    .badge-frozen {
      background: var(--blue-bg); color: var(--blue);
      padding: 1px 4px; border: 1px solid #9999cc;
      font-size: 17px; font-weight: 700; display: inline-block;
    }
    .badge-cooked {
      background: var(--gold-bg); color: var(--gold);
      padding: 1px 4px; border: 1px solid #ccaa66;
      font-size: 17px; font-weight: 700; display: inline-block;
    }

    /* ══ AMOUNT ══ */
    .amount-positive { color: var(--green); font-weight: 700; }
    .amount-negative { color: var(--red); font-weight: 700; }
    .amount-gold     { color: var(--gold); font-weight: 700; }

    /* ══ TABS ══ */
    .tab-btn {
      padding: 3px 12px;
      cursor: pointer; font-size: 18px; font-weight: 400;
      font-family: inherit;
      color: var(--text); border: 1px solid;
      border-color: #ffffff #808080 #808080 #ffffff;
      box-shadow: inset -1px -1px 0 #404040, inset 1px 1px 0 #dfdfdf;
      background: var(--win-bg);
    }
    .tab-btn.active {
      background: var(--win-header); color: #ffffff;
      border-color: #808080 #ffffff #ffffff #808080;
      font-weight: 700;
    }
    .tab-btn:hover:not(.active) { background: #e8e8e0; }

    /* ══ MODAL ══ */
    .modal-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,.4);
      z-index: 50; display: flex;
      align-items: flex-end; justify-content: center;
    }
    @media (min-width: 640px) { .modal-overlay { align-items: center; } }
    .modal-box {
      background: var(--win-bg);
      border: 2px solid;
      border-color: #ffffff #404040 #404040 #ffffff;
      box-shadow: 2px 2px 8px rgba(0,0,0,.4);
      width: 100%; max-width: 520px;
      border-radius: 0;
      padding: 0;
      max-height: 92vh; overflow-y: auto;
    }
    @media (min-width: 640px) { .modal-box { border-radius: 0; } }
    .modal-handle { display: none; }
    .modal-title {
      font-size: 18px; font-weight: 700; color: #ffffff;
      background: linear-gradient(90deg, #000080, #1084d0);
      padding: 4px 8px;
      margin-bottom: 0;
      display: flex; align-items: center; gap: 6px;
    }
    .modal-title i { color: #ffff88; }
    /* modal 內容區 - 所有在 modal-title 後的直接子元素加 padding */
    .modal-box > *:not(.modal-title):not(.modal-handle) { padding-left: 14px; padding-right: 14px; }
    .modal-box > .modal-title + * { padding-top: 12px; }
    .modal-box .modal-body { padding: 12px 14px; }

    /* ══ MOBILE BOTTOM NAV ══ */
    .mobile-nav {
      position: fixed; bottom: 0; left: 0; right: 0;
      background: var(--win-bg);
      border-top: 2px solid var(--win-border-dk);
      z-index: 40; padding: 2px 2px 3px;
      display: grid; grid-template-columns: repeat(5, 1fr);
    }
    .nav-mobile-btn {
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 1px; padding: 3px 1px;
      border-radius: 0; border: 1px solid transparent;
      background: none; color: var(--text-dim);
      cursor: pointer;
      font-size: 16px; font-weight: 400;
    }
    .nav-mobile-btn i { font-size: 21px; }
    .nav-mobile-btn.active {
      color: var(--win-header);
      background: var(--win-row-hover);
      border-color: var(--win-border);
      font-weight: 700;
    }
    .nav-mobile-active-dot { display: none; }

    /* ══ LAYOUT ══ */
    @media (max-width: 767px) {
      .sidebar { display: none !important; }
      .mobile-nav { display: grid; }
    }
    @media (min-width: 768px) {
      .mobile-nav { display: none !important; }
    }

    /* ══ MISC ══ */
    .page { display: none; }
    .page.active { display: block; }
    .loading {
      display: inline-block; width: 14px; height: 14px;
      border: 2px solid #cccccc;
      border-radius: 50%; border-top-color: var(--win-header);
      animation: spin .7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .section-title {
      font-size: 18px; font-weight: 700;
      color: var(--text);
      margin-bottom: 8px; padding: 3px 6px;
      background: var(--win-bg-dk);
      border-bottom: 1px solid var(--win-border);
      border-top: 1px solid #ffffff;
    }

    /* ══ STATEMENT ══ */
    .statement-card {
      background: var(--win-surface);
      border: 2px solid; border-color: #ffffff #808080 #808080 #ffffff;
    }
    .statement-header {
      background: var(--win-header);
      border-bottom: 2px solid #003300;
      padding: 8px 14px;
    }
    .statement-row-odd  { background: var(--win-row-odd); }
    .statement-row-even { background: var(--win-row-even); }
    .statement-total-row { background: #fffacc; font-weight: 700; }
    .statement-badge {
      display: inline-block; padding: 1px 5px;
      border: 1px solid; font-size: 17px; font-weight: 700;
    }
    .capture-area { position: relative; }
    @media print {
      .no-print { display: none !important; }
      body { background: white; color: black; }
    }

    /* ══ MORE PAGE ══ */
    .more-grid-item {
      background: var(--win-bg);
      border: 2px solid;
      border-color: #ffffff #808080 #808080 #ffffff;
      box-shadow: inset -1px -1px 0 #404040, inset 1px 1px 0 #dfdfdf;
      padding: 12px 6px;
      display: flex; flex-direction: column; align-items: center; gap: 5px;
      cursor: pointer;
    }
    .more-grid-item:hover { background: #e8efe8; }
    .more-grid-item.featured {
      border-color: #006600 #003300 #003300 #006600;
      background: #f0fff0;
    }
    .more-icon-wrap {
      width: 36px; height: 36px;
      display: flex; align-items: center; justify-content: center;
      font-size: 23px;
      border: 1px solid #aaaaaa;
      background: var(--win-surface);
    }
    .more-label { font-size: 17px; font-weight: 400; color: var(--text); }

    /* ══ FORM ══ */
    .form-row { display: grid; gap: 8px; margin-bottom: 10px; }
    .form-row-2 { grid-template-columns: 1fr 1fr; }
    .form-row-3 { grid-template-columns: 1fr 1fr 1fr; }
    @media (max-width: 480px) { .form-row-2, .form-row-3 { grid-template-columns: 1fr; } }

    .divider { border: none; border-top: 1px solid var(--win-border); margin: 10px 0; }

    .empty-state { text-align: center; padding: 40px 20px; color: var(--text-dim); }
    .empty-state i { font-size: 37px; margin-bottom: 8px; display: block; }
    .empty-state p { font-size: 18px; }

    /* ══ SUMMARY CARDS ══ */
    .sum-cards {
      display: grid; gap: 8px;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      margin-bottom: 10px;
    }
    .sum-card {
      background: var(--win-surface);
      border: 2px solid; border-color: #ffffff #808080 #808080 #ffffff;
      box-shadow: inset -1px -1px 0 #404040, inset 1px 1px 0 #dfdfdf;
      padding: 7px 10px;
    }
    .sum-card-label {
      font-size: 16px; font-weight: 700; color: var(--text-dim);
      margin-bottom: 3px;
    }
    .sum-card-value { font-size: 23px; font-weight: 700; color: var(--text); font-variant-numeric: tabular-nums; }
    .sum-card-value.green { color: var(--green); }
    .sum-card-value.red   { color: var(--red); }
    .sum-card-value.blue  { color: var(--blue); }

    /* ══ FILTER BAR ══ */
    .filter-bar {
      display: flex; align-items: center; gap: 6px;
      flex-wrap: wrap; margin-bottom: 8px;
      background: var(--win-bg-dk);
      border: 1px solid var(--win-border);
      padding: 4px 7px;
    }
    .filter-bar select {
      background: #ffffff;
      color: var(--text);
      border: 2px solid;
      border-color: #808080 #ffffff #ffffff #808080;
      box-shadow: inset 1px 1px 0 #404040;
      padding: 2px 6px;
      font-size: 18px; cursor: pointer;
      font-family: inherit;
    }
    .filter-bar select:focus { outline: 1px dotted var(--blue); }

    /* ══ FIXED TABLE ══ */
    .ftbl {
      table-layout: fixed;
      width: 100%;
    }
    .ftbl th, .ftbl td {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: clip;
    }

    /* icon 操作按鈕 */
    .ic-btn {
      font-family: inherit;
      background: var(--win-bg);
      border: 1px solid;
      border-color: #ffffff #808080 #808080 #ffffff;
      box-shadow: inset -1px -1px 0 #404040, inset 1px 1px 0 #dfdfdf;
      cursor: pointer;
      padding: 1px 5px; border-radius: 0;
      font-size: 17px; line-height: 1.4;
    }
    .ic-btn:hover { background: #e0ddd8; }
    .ic-btn:active {
      border-color: #808080 #ffffff #ffffff #808080;
      box-shadow: inset 1px 1px 0 #404040, inset -1px -1px 0 #dfdfdf;
    }
    .ic-edit { color: var(--blue); }
    .ic-del  { color: var(--red); }
    .ic-grp  { color: var(--green); }

    /* ══ TOAST ══ */
    #toast-container .toast { box-shadow: var(--shadow-lg) !important; }
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
    <i class="fas fa-grip"></i><span>更多</span>
    <div class="nav-mobile-active-dot"></div>
  </button>
</div>

<div style="display:flex; min-height:100vh;">

  <!-- Desktop Sidebar -->
  <div class="sidebar" id="desktop-sidebar"
       style="width:var(--sidebar-w); display:none; flex-direction:column;
              position:fixed; top:0; bottom:0; left:0; z-index:30; overflow-y:auto;">
    <div class="sidebar-logo">
      <div class="logo-icon">雞</div>
      <div class="logo-text">
        <div class="name">雞王</div>
        <div class="sub">ERP · Inventory</div>
      </div>
    </div>

    <nav style="flex:1; padding:6px 4px; overflow-y:auto;">
      <button onclick="showPage('dashboard')" id="side-dashboard" class="nav-item">
        <span class="icon-wrap"><i class="fas fa-chart-pie"></i></span><span>儀表板</span>
      </button>

      <div class="nav-section-label">銷售</div>
      <button onclick="showPage('sales')" id="side-sales" class="nav-item">
        <span class="icon-wrap"><i class="fas fa-truck"></i></span><span>出貨記錄</span>
      </button>
      <button onclick="showPage('weekly')" id="side-weekly" class="nav-item">
        <span class="icon-wrap"><i class="fas fa-receipt"></i></span><span>每週結算單</span>
      </button>
      <button onclick="showPage('receivables')" id="side-receivables" class="nav-item">
        <span class="icon-wrap"><i class="fas fa-hand-holding-usd"></i></span><span>應收帳款</span>
      </button>

      <div class="nav-section-label">採購</div>
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

    <div style="padding:10px 8px; border-top:1px solid rgba(255,255,255,.1);">
      <div style="font-size: 15px; color:rgba(255,255,255,.25); text-align:center; letter-spacing:.5px;">CHICKEN KING ERP v2.0</div>
    </div>
  </div>

  <!-- Main area -->
  <div id="main-area" style="flex:1; padding-bottom:72px;">

    <!-- Top Header -->
    <div class="top-header">
      <div class="page-title-area">
        <div class="mobile-logo" id="mobile-logo-btn">雞</div>
        <h1 id="page-title">儀表板</h1>
      </div>
      <div class="header-right">
        <span id="today-date" class="date-chip" style="display:none;"></span>
        <button onclick="showPage('sales'); setTimeout(()=>openSaleModal?.(),100)" class="btn-primary" style="font-size: 17px; padding:7px 12px;">
          <i class="fas fa-plus"></i><span id="quick-btn-text">快速出貨</span>
        </button>
        <button onclick="doLogout()" class="btn-logout" title="登出">
          <i class="fas fa-sign-out-alt"></i>
        </button>
      </div>
    </div>

    <!-- Page Content -->
    <div style="padding:14px;">

      <div id="page-dashboard"   class="page active"><div id="dashboard-content"></div></div>
      <div id="page-sales"       class="page"><div id="sales-content"></div></div>
      <div id="page-purchases"   class="page"><div id="purchases-content"></div></div>
      <div id="page-receivables" class="page"><div id="receivables-content"></div></div>
      <div id="page-payables"    class="page"><div id="payables-content"></div></div>
      <div id="page-expenses"    class="page"><div id="expenses-content"></div></div>
      <div id="page-cashflow"    class="page"><div id="cashflow-content"></div></div>
      <div id="page-reports"     class="page"><div id="reports-content"></div></div>
      <div id="page-inventory"   class="page"><div id="inventory-content"></div></div>
      <div id="page-customers"   class="page"><div id="customers-content"></div></div>
      <div id="page-suppliers"   class="page"><div id="suppliers-content"></div></div>
      <div id="page-products"    class="page"><div id="products-content"></div></div>
      <div id="page-prices"      class="page"><div id="prices-content"></div></div>
      <div id="page-weekly"      class="page"><div id="weekly-content"></div></div>

      <!-- More Page -->
      <div id="page-more" class="page">
        <div class="section-title">所有功能</div>
        <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:9px;">
          <button onclick="showPage('weekly')" class="more-grid-item featured">
            <div class="more-icon-wrap" style="background:rgba(224,123,42,.15);">
              <i class="fas fa-receipt" style="color:var(--orange)"></i>
            </div>
            <span class="more-label" style="color:var(--orange)">每週結算單</span>
          </button>
          <button onclick="showPage('receivables')" class="more-grid-item">
            <div class="more-icon-wrap" style="background:var(--green-dim)">
              <i class="fas fa-hand-holding-usd" style="color:var(--green)"></i>
            </div>
            <span class="more-label" style="color:var(--text-2)">應收帳款</span>
          </button>
          <button onclick="showPage('payables')" class="more-grid-item">
            <div class="more-icon-wrap" style="background:var(--red-dim)">
              <i class="fas fa-file-invoice-dollar" style="color:var(--red)"></i>
            </div>
            <span class="more-label" style="color:var(--text-2)">應付帳款</span>
          </button>
          <button onclick="showPage('expenses')" class="more-grid-item">
            <div class="more-icon-wrap" style="background:rgba(251,146,60,.1)">
              <i class="fas fa-gas-pump" style="color:#fb923c"></i>
            </div>
            <span class="more-label" style="color:var(--text-2)">費用記錄</span>
          </button>
          <button onclick="showPage('cashflow')" class="more-grid-item">
            <div class="more-icon-wrap" style="background:var(--blue-dim)">
              <i class="fas fa-exchange-alt" style="color:var(--blue)"></i>
            </div>
            <span class="more-label" style="color:var(--text-2)">現金流水帳</span>
          </button>
          <button onclick="showPage('reports')" class="more-grid-item">
            <div class="more-icon-wrap" style="background:rgba(167,139,250,.1)">
              <i class="fas fa-chart-bar" style="color:#a78bfa"></i>
            </div>
            <span class="more-label" style="color:var(--text-2)">財務報表</span>
          </button>
          <button onclick="showPage('inventory')" class="more-grid-item">
            <div class="more-icon-wrap" style="background:rgba(250,204,21,.08)">
              <i class="fas fa-boxes" style="color:#facc15"></i>
            </div>
            <span class="more-label" style="color:var(--text-2)">庫存管理</span>
          </button>
          <button onclick="showPage('customers')" class="more-grid-item">
            <div class="more-icon-wrap" style="background:rgba(129,140,248,.1)">
              <i class="fas fa-users" style="color:#818cf8"></i>
            </div>
            <span class="more-label" style="color:var(--text-2)">客戶管理</span>
          </button>
          <button onclick="showPage('suppliers')" class="more-grid-item">
            <div class="more-icon-wrap" style="background:rgba(52,211,153,.08)">
              <i class="fas fa-store" style="color:#34d399"></i>
            </div>
            <span class="more-label" style="color:var(--text-2)">廠商管理</span>
          </button>
          <button onclick="showPage('products')" class="more-grid-item">
            <div class="more-icon-wrap" style="background:rgba(232,121,249,.08)">
              <i class="fas fa-tag" style="color:#e879f9"></i>
            </div>
            <span class="more-label" style="color:var(--text-2)">商品管理</span>
          </button>
          <button onclick="showPage('prices')" class="more-grid-item">
            <div class="more-icon-wrap" style="background:rgba(224,123,42,.1)">
              <i class="fas fa-dollar-sign" style="color:var(--orange)"></i>
            </div>
            <span class="more-label" style="color:var(--text-2)">報價管理</span>
          </button>
        </div>
      </div>

    </div>
  </div>
</div>

<!-- Toast -->
<div id="toast" style="position:fixed; top:10px; right:10px; z-index:60; display:none;">
  <div style="background:#005500; border:2px solid; border-color:#ffffff #404040 #404040 #ffffff;
              box-shadow:2px 2px 6px rgba(0,0,0,.4);
              color:#ffffff;
              padding:6px 14px; border-radius:0;
              font-size: 18px; max-width:280px; font-family:inherit;
              display:flex; align-items:center; gap:8px;"></div>
</div>

<!-- Modal Container -->
<div id="modal-container"></div>

<script>
  // Desktop sidebar show/hide via CSS media query approach
  (function(){
    function checkWidth() {
      var s = document.getElementById('desktop-sidebar')
      var m = document.getElementById('main-area')
      if(!s || !m) return
      if(window.innerWidth >= 768) {
        s.style.display = 'flex'
        m.style.marginLeft = '220px'
        m.style.paddingBottom = '0'
        // hide quick-btn text on all sizes
        var qt = document.getElementById('quick-btn-text')
        if(qt) qt.style.display = ''
      } else {
        s.style.display = 'none'
        m.style.marginLeft = '0'
        m.style.paddingBottom = '72px'
        var qt = document.getElementById('quick-btn-text')
        if(qt) qt.style.display = 'none'
      }
    }
    checkWidth()
    window.addEventListener('resize', checkWidth)
    // show date
    var d = document.getElementById('today-date')
    if(d) { d.textContent = new Date().toLocaleDateString('zh-TW', {month:'numeric',day:'numeric',weekday:'short'}); d.style.display = ''; }
  })()
</script>
<script src="/static/app.js"></script>
</body>
</html>`
}

export default app
