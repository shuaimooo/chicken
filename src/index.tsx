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
  <style>
    * { -webkit-tap-highlight-color: transparent; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .nav-item.active { background: rgba(255,255,255,0.2); }
    .card { background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .btn-primary { background: #dc2626; color: white; border-radius: 8px; padding: 8px 16px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
    .btn-primary:hover { background: #b91c1c; }
    .btn-secondary { background: #f3f4f6; color: #374151; border-radius: 8px; padding: 8px 16px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
    .btn-secondary:hover { background: #e5e7eb; }
    .btn-success { background: #16a34a; color: white; border-radius: 8px; padding: 8px 16px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
    .btn-success:hover { background: #15803d; }
    .input-field { border: 1px solid #d1d5db; border-radius: 8px; padding: 8px 12px; width: 100%; font-size: 16px; outline: none; transition: border-color 0.2s; }
    .input-field:focus { border-color: #dc2626; box-shadow: 0 0 0 3px rgba(220,38,38,0.1); }
    select.input-field { background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e"); background-position: right 8px center; background-repeat: no-repeat; background-size: 16px; appearance: none; }
    .table-header { background: #fef2f2; }
    .status-paid { background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .status-unpaid { background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .status-partial { background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 50; display: flex; align-items: flex-end; justify-content: center; }
    @media (min-width: 640px) { .modal-overlay { align-items: center; } }
    .modal-box { background: white; width: 100%; max-width: 600px; border-radius: 16px 16px 0 0; padding: 20px; max-height: 90vh; overflow-y: auto; }
    @media (min-width: 640px) { .modal-box { border-radius: 16px; } }
    .sidebar { width: 240px; flex-shrink: 0; }
    @media (max-width: 767px) { .sidebar { display: none; } .mobile-nav { display: flex; } }
    @media (min-width: 768px) { .mobile-nav { display: none; } }
    .loading { display: inline-block; width: 20px; height: 20px; border: 3px solid rgba(255,255,255,.3); border-radius: 50%; border-top-color: #fff; animation: spin 1s ease-in-out infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .kpi-card { border-radius: 12px; padding: 16px; color: white; }
    .badge-fresh { background: #dcfce7; color: #166534; }
    .badge-frozen { background: #dbeafe; color: #1e40af; }
    .badge-cooked { background: #fef3c7; color: #92400e; }
    tbody tr:hover { background: #fafafa; }
    .page { display: none; }
    .page.active { display: block; }
    .tab-btn { padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500; color: #6b7280; transition: all 0.2s; }
    .tab-btn.active { background: #dc2626; color: white; }
    .amount-positive { color: #16a34a; font-weight: 600; }
    .amount-negative { color: #dc2626; font-weight: 600; }
    ::-webkit-scrollbar { width: 4px; height: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 2px; }
    .swipe-close { cursor: pointer; }
  </style>
</head>
<body class="bg-gray-50 min-h-screen">

<!-- Mobile Bottom Nav -->
<div class="mobile-nav fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 px-1 py-2 grid grid-cols-5 gap-1">
  <button onclick="showPage('dashboard')" id="nav-dashboard" class="flex flex-col items-center py-1 px-2 rounded-lg text-gray-500 nav-mobile-btn">
    <i class="fas fa-chart-pie text-lg"></i><span class="text-xs mt-0.5">儀表板</span>
  </button>
  <button onclick="showPage('sales')" id="nav-sales" class="flex flex-col items-center py-1 px-2 rounded-lg text-gray-500 nav-mobile-btn">
    <i class="fas fa-truck text-lg"></i><span class="text-xs mt-0.5">出貨</span>
  </button>
  <button onclick="showPage('purchases')" id="nav-purchases" class="flex flex-col items-center py-1 px-2 rounded-lg text-gray-500 nav-mobile-btn">
    <i class="fas fa-shopping-cart text-lg"></i><span class="text-xs mt-0.5">進貨</span>
  </button>
  <button onclick="showPage('finance')" id="nav-finance" class="flex flex-col items-center py-1 px-2 rounded-lg text-gray-500 nav-mobile-btn">
    <i class="fas fa-wallet text-lg"></i><span class="text-xs mt-0.5">財務</span>
  </button>
  <button onclick="showPage('more')" id="nav-more" class="flex flex-col items-center py-1 px-2 rounded-lg text-gray-500 nav-mobile-btn">
    <i class="fas fa-bars text-lg"></i><span class="text-xs mt-0.5">更多</span>
  </button>
</div>

<div class="flex min-h-screen">
  <!-- Desktop Sidebar -->
  <div class="sidebar bg-red-700 text-white flex flex-col fixed top-0 bottom-0 left-0 z-30 overflow-y-auto hidden md:flex">
    <div class="p-4 border-b border-red-600">
      <div class="flex items-center gap-2">
        <div class="w-10 h-10 bg-white rounded-full flex items-center justify-center">
          <span class="text-red-700 text-lg font-bold">雞</span>
        </div>
        <div>
          <div class="font-bold text-lg">雞王</div>
          <div class="text-xs text-red-200">進銷存管理系統</div>
        </div>
      </div>
    </div>
    <nav class="flex-1 p-3 space-y-1">
      <button onclick="showPage('dashboard')" id="side-dashboard" class="nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-red-100 hover:bg-red-600 transition-colors">
        <i class="fas fa-chart-pie w-5"></i><span>儀表板</span>
      </button>
      <div class="text-red-300 text-xs font-semibold px-3 pt-3 pb-1">銷售管理</div>
      <button onclick="showPage('sales')" id="side-sales" class="nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-red-100 hover:bg-red-600 transition-colors">
        <i class="fas fa-truck w-5"></i><span>出貨記錄</span>
      </button>
      <button onclick="showPage('receivables')" id="side-receivables" class="nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-red-100 hover:bg-red-600 transition-colors">
        <i class="fas fa-hand-holding-usd w-5"></i><span>應收帳款</span>
      </button>
      <div class="text-red-300 text-xs font-semibold px-3 pt-3 pb-1">採購管理</div>
      <button onclick="showPage('purchases')" id="side-purchases" class="nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-red-100 hover:bg-red-600 transition-colors">
        <i class="fas fa-shopping-cart w-5"></i><span>進貨記錄</span>
      </button>
      <button onclick="showPage('payables')" id="side-payables" class="nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-red-100 hover:bg-red-600 transition-colors">
        <i class="fas fa-file-invoice-dollar w-5"></i><span>應付帳款</span>
      </button>
      <div class="text-red-300 text-xs font-semibold px-3 pt-3 pb-1">財務</div>
      <button onclick="showPage('expenses')" id="side-expenses" class="nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-red-100 hover:bg-red-600 transition-colors">
        <i class="fas fa-gas-pump w-5"></i><span>費用記錄</span>
      </button>
      <button onclick="showPage('cashflow')" id="side-cashflow" class="nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-red-100 hover:bg-red-600 transition-colors">
        <i class="fas fa-exchange-alt w-5"></i><span>現金流水帳</span>
      </button>
      <button onclick="showPage('reports')" id="side-reports" class="nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-red-100 hover:bg-red-600 transition-colors">
        <i class="fas fa-chart-bar w-5"></i><span>財務報表</span>
      </button>
      <div class="text-red-300 text-xs font-semibold px-3 pt-3 pb-1">基本資料</div>
      <button onclick="showPage('inventory')" id="side-inventory" class="nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-red-100 hover:bg-red-600 transition-colors">
        <i class="fas fa-boxes w-5"></i><span>庫存管理</span>
      </button>
      <button onclick="showPage('customers')" id="side-customers" class="nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-red-100 hover:bg-red-600 transition-colors">
        <i class="fas fa-users w-5"></i><span>客戶管理</span>
      </button>
      <button onclick="showPage('suppliers')" id="side-suppliers" class="nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-red-100 hover:bg-red-600 transition-colors">
        <i class="fas fa-store w-5"></i><span>廠商管理</span>
      </button>
      <button onclick="showPage('products')" id="side-products" class="nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-red-100 hover:bg-red-600 transition-colors">
        <i class="fas fa-tag w-5"></i><span>商品管理</span>
      </button>
      <button onclick="showPage('prices')" id="side-prices" class="nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-red-100 hover:bg-red-600 transition-colors">
        <i class="fas fa-dollar-sign w-5"></i><span>報價管理</span>
      </button>
    </nav>
  </div>

  <!-- Main content -->
  <div class="flex-1 md:ml-60 pb-20 md:pb-4">
    <!-- Top header -->
    <div class="bg-white border-b border-gray-200 sticky top-0 z-20 px-4 py-3 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center md:hidden">
          <span class="text-white font-bold text-sm">雞</span>
        </div>
        <h1 id="page-title" class="text-lg font-bold text-gray-800">儀表板</h1>
      </div>
      <div class="flex items-center gap-2">
        <span id="today-date" class="text-sm text-gray-500"></span>
        <button onclick="showPage('sales'); openSaleModal()" class="btn-primary text-sm px-3 py-1.5">
          <i class="fas fa-plus mr-1"></i>快速出貨
        </button>
      </div>
    </div>

    <!-- Pages -->
    <div class="p-4">
      <!-- Dashboard -->
      <div id="page-dashboard" class="page active">
        <div id="dashboard-content"></div>
      </div>

      <!-- Sales -->
      <div id="page-sales" class="page">
        <div id="sales-content"></div>
      </div>

      <!-- Purchases -->
      <div id="page-purchases" class="page">
        <div id="purchases-content"></div>
      </div>

      <!-- Receivables -->
      <div id="page-receivables" class="page">
        <div id="receivables-content"></div>
      </div>

      <!-- Payables -->
      <div id="page-payables" class="page">
        <div id="payables-content"></div>
      </div>

      <!-- Expenses -->
      <div id="page-expenses" class="page">
        <div id="expenses-content"></div>
      </div>

      <!-- Cashflow -->
      <div id="page-cashflow" class="page">
        <div id="cashflow-content"></div>
      </div>

      <!-- Reports -->
      <div id="page-reports" class="page">
        <div id="reports-content"></div>
      </div>

      <!-- Inventory -->
      <div id="page-inventory" class="page">
        <div id="inventory-content"></div>
      </div>

      <!-- Customers -->
      <div id="page-customers" class="page">
        <div id="customers-content"></div>
      </div>

      <!-- Suppliers -->
      <div id="page-suppliers" class="page">
        <div id="suppliers-content"></div>
      </div>

      <!-- Products -->
      <div id="page-products" class="page">
        <div id="products-content"></div>
      </div>

      <!-- Prices -->
      <div id="page-prices" class="page">
        <div id="prices-content"></div>
      </div>

      <!-- More (mobile) -->
      <div id="page-more" class="page">
        <div class="grid grid-cols-2 gap-3">
          <button onclick="showPage('receivables')" class="card p-4 flex flex-col items-center gap-2 text-center">
            <i class="fas fa-hand-holding-usd text-2xl text-green-600"></i>
            <span class="text-sm font-medium">應收帳款</span>
          </button>
          <button onclick="showPage('payables')" class="card p-4 flex flex-col items-center gap-2 text-center">
            <i class="fas fa-file-invoice-dollar text-2xl text-red-600"></i>
            <span class="text-sm font-medium">應付帳款</span>
          </button>
          <button onclick="showPage('expenses')" class="card p-4 flex flex-col items-center gap-2 text-center">
            <i class="fas fa-gas-pump text-2xl text-orange-500"></i>
            <span class="text-sm font-medium">費用記錄</span>
          </button>
          <button onclick="showPage('cashflow')" class="card p-4 flex flex-col items-center gap-2 text-center">
            <i class="fas fa-exchange-alt text-2xl text-blue-600"></i>
            <span class="text-sm font-medium">現金流水帳</span>
          </button>
          <button onclick="showPage('reports')" class="card p-4 flex flex-col items-center gap-2 text-center">
            <i class="fas fa-chart-bar text-2xl text-purple-600"></i>
            <span class="text-sm font-medium">財務報表</span>
          </button>
          <button onclick="showPage('inventory')" class="card p-4 flex flex-col items-center gap-2 text-center">
            <i class="fas fa-boxes text-2xl text-yellow-600"></i>
            <span class="text-sm font-medium">庫存管理</span>
          </button>
          <button onclick="showPage('customers')" class="card p-4 flex flex-col items-center gap-2 text-center">
            <i class="fas fa-users text-2xl text-indigo-600"></i>
            <span class="text-sm font-medium">客戶管理</span>
          </button>
          <button onclick="showPage('suppliers')" class="card p-4 flex flex-col items-center gap-2 text-center">
            <i class="fas fa-store text-2xl text-teal-600"></i>
            <span class="text-sm font-medium">廠商管理</span>
          </button>
          <button onclick="showPage('products')" class="card p-4 flex flex-col items-center gap-2 text-center">
            <i class="fas fa-tag text-2xl text-pink-600"></i>
            <span class="text-sm font-medium">商品管理</span>
          </button>
          <button onclick="showPage('prices')" class="card p-4 flex flex-col items-center gap-2 text-center">
            <i class="fas fa-dollar-sign text-2xl text-amber-600"></i>
            <span class="text-sm font-medium">報價管理</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Toast -->
<div id="toast" class="fixed top-4 right-4 z-50 hidden">
  <div class="bg-gray-800 text-white px-4 py-3 rounded-lg shadow-lg text-sm max-w-xs"></div>
</div>

<!-- Modal Container -->
<div id="modal-container"></div>

<script src="/static/app.js"></script>
</body>
</html>`
}

export default app
