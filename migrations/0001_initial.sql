-- 客戶清單
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  contact TEXT,
  phone TEXT,
  company TEXT,
  address TEXT,
  payment_cycle TEXT DEFAULT '月結',
  note TEXT,
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 廠商資料
CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  contact TEXT,
  phone TEXT,
  bank TEXT,
  account TEXT,
  note TEXT,
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 商品清單
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,  -- 生鮮/冷凍/熟雞
  unit TEXT DEFAULT '斤',
  note TEXT,
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 報價表（客戶報價）
CREATE TABLE IF NOT EXISTS customer_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  price REAL NOT NULL,
  effective_date DATE DEFAULT CURRENT_DATE,
  note TEXT,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- 供應商報價
CREATE TABLE IF NOT EXISTS supplier_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  price REAL NOT NULL,
  effective_date DATE DEFAULT CURRENT_DATE,
  note TEXT,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- 進貨紀錄
CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date DATE NOT NULL,
  batch_no TEXT,
  supplier_id INTEGER,
  supplier_name TEXT,
  product_id INTEGER,
  product_name TEXT,
  category TEXT,
  spec REAL,           -- 規格(KG/斤)
  total_weight REAL,   -- 總重
  unit TEXT,
  quantity REAL NOT NULL,
  qty_unit TEXT DEFAULT '隻',
  cost_price REAL,     -- 進價(每斤/KG)
  sell_price REAL,     -- 售價
  total_amount REAL,   -- 總金額
  payment_status TEXT DEFAULT '未付',
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- 出貨/銷售明細
CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date DATE NOT NULL,
  customer_id INTEGER,
  customer_name TEXT NOT NULL,
  product_id INTEGER,
  product_name TEXT NOT NULL,
  category TEXT,
  spec REAL,
  unit TEXT,
  quantity REAL NOT NULL,
  qty_unit TEXT,
  unit_price REAL NOT NULL,
  total_amount REAL NOT NULL,
  payment_status TEXT DEFAULT '待付款',
  payment_date DATE,
  payment_cycle TEXT,
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- 費用記錄
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date DATE NOT NULL,
  category TEXT NOT NULL,  -- 油費/過路費/出差/其他
  amount REAL NOT NULL,
  description TEXT,
  destination TEXT,
  note TEXT,
  payment_status TEXT DEFAULT '已付',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 現金流水帳
CREATE TABLE IF NOT EXISTS cashflow (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date DATE NOT NULL,
  flow_no TEXT,
  description TEXT NOT NULL,
  income REAL DEFAULT 0,
  expense REAL DEFAULT 0,
  balance REAL DEFAULT 0,
  party TEXT,       -- 客戶/廠商名稱
  category TEXT,    -- 分類
  ref_type TEXT,    -- sales/purchase/expense
  ref_id INTEGER,
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 應收帳款（週結/月結彙總）
CREATE TABLE IF NOT EXISTS receivables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  customer_name TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  payment_due DATE,
  total_amount REAL DEFAULT 0,
  paid_amount REAL DEFAULT 0,
  balance REAL DEFAULT 0,
  status TEXT DEFAULT '待付款',
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- 應付帳款
CREATE TABLE IF NOT EXISTS payables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL,
  supplier_name TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  payment_due DATE,
  total_amount REAL DEFAULT 0,
  paid_amount REAL DEFAULT 0,
  balance REAL DEFAULT 0,
  status TEXT DEFAULT '未付',
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

-- 系統設定
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(payment_status);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(date);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_cashflow_date ON cashflow(date);
