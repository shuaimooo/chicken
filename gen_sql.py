import csv, re

csv_path = '/home/user/uploaded_files/2026 - 2026年 (2).csv'

def clean_money(s):
    if not s:
        return 0.0
    s = s.strip().replace('$','').replace(',','').replace(' ','')
    m = re.match(r'\(([0-9.]+)\)', s)
    if m:
        return -float(m.group(1))
    try:
        return float(s)
    except:
        return 0.0

def clean_num(s):
    if not s:
        return 0.0
    s = s.strip().replace(',','')
    try:
        return float(s)
    except:
        return 0.0

def esc(s):
    return str(s).replace("'", "''")

customers = {}   # code -> name
suppliers_list = []  # ordered unique names
products  = {}   # code -> {name, category}
rows = []

# Known supplier codes from system seed (K001-K008)
# We'll auto-assign codes K101+ for CSV suppliers not in system
SUPPLIER_CODE_MAP = {
    '雞王': 'K001',
    '興隆': 'K002',
    '小毛': 'K003',
    '小齊': 'K004',
    '太順': 'K005',
    '牧穀': 'K006',
    '阿聽': 'K007',
}

with open(csv_path, encoding='utf-8-sig') as f:
    reader = csv.reader(f)
    next(reader)  # skip header
    for row in reader:
        if len(row) < 18 or not row[3].strip():
            continue
        cust_code    = row[1].strip()
        cust_name    = row[2].strip()
        sale_date    = row[3].strip()
        category     = row[4].strip()
        product_name = row[5].strip()
        spec_kg      = clean_num(row[6])     # KG per unit
        unit1        = row[7].strip()        # KG
        qty          = clean_num(row[8])     # 數量
        unit2        = row[9].strip()        # 隻/件
        unit_price   = clean_money(row[10])  # 單價
        total_price  = clean_money(row[11])  # 總售價
        note         = row[12].strip()       # 備註
        prod_code    = row[13].strip()       # 商碼
        paid_status  = row[14].strip()       # 已付款/未付款
        cost_price   = clean_money(row[15])  # 成本
        total_cost   = clean_money(row[16])  # 總成本
        supplier     = row[17].strip()       # 廠商
        settle_stat  = row[18].strip() if len(row) > 18 else ''

        m2 = re.match(r'(\d{4})/(\d+)/(\d+)', sale_date)
        if not m2:
            continue
        sale_date_fmt = "%s-%02d-%02d" % (m2.group(1), int(m2.group(2)), int(m2.group(3)))

        customers[cust_code] = cust_name
        if supplier and supplier not in [s['name'] for s in suppliers_list]:
            code = SUPPLIER_CODE_MAP.get(supplier, 'K%03d' % (100 + len(suppliers_list)))
            suppliers_list.append({'code': code, 'name': supplier})
        if prod_code:
            products[prod_code] = {'name': product_name, 'category': category}

        if paid_status == '已付款' and settle_stat == '已結款':
            pay_st = '已付款'
        elif paid_status == '未付款':
            pay_st = '待付款'
        else:
            pay_st = '待付款'

        qty_unit = unit2 or '隻'

        # Store cost info in note
        note_ext = note
        if supplier:
            parts = []
            if note:
                parts.append(note)
            parts.append('[廠商:%s 成本:%.1f 總成本:%.0f]' % (supplier, cost_price, total_cost))
            note_ext = ' '.join(parts)

        rows.append({
            'sale_date': sale_date_fmt,
            'cust_code': cust_code,
            'cust_name': cust_name,
            'category': category,
            'prod_code': prod_code,
            'prod_name': product_name,
            'spec': spec_kg,
            'unit': 'KG',
            'qty': qty,
            'qty_unit': qty_unit,
            'unit_price': unit_price,
            'total_amount': total_price,
            'payment_status': pay_st,
            'note': note_ext,
        })

# ---- Generate SQL ----
lines = []
lines.append("-- 2026 CSV 完整匯入 SQL")
lines.append("-- 客戶 %d / 廠商 %d / 商品 %d / 銷售 %d" % (len(customers), len(suppliers_list), len(products), len(rows)))
lines.append("")

# 建表 (init)
lines.append("-- ==== 建表 ====")
lines.append("CREATE TABLE IF NOT EXISTS customers (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, contact TEXT, phone TEXT, company TEXT, address TEXT, payment_cycle TEXT DEFAULT '月結', note TEXT, active INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);")
lines.append("CREATE TABLE IF NOT EXISTS suppliers (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, contact TEXT, phone TEXT, bank TEXT, account TEXT, note TEXT, active INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);")
lines.append("CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, category TEXT NOT NULL, unit TEXT DEFAULT '斤', note TEXT, active INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);")
lines.append("CREATE TABLE IF NOT EXISTS customer_prices (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL, product_id INTEGER NOT NULL, price REAL NOT NULL, effective_date DATE DEFAULT CURRENT_DATE, note TEXT, FOREIGN KEY (customer_id) REFERENCES customers(id), FOREIGN KEY (product_id) REFERENCES products(id));")
lines.append("CREATE TABLE IF NOT EXISTS supplier_prices (id INTEGER PRIMARY KEY AUTOINCREMENT, supplier_id INTEGER NOT NULL, product_id INTEGER NOT NULL, price REAL NOT NULL, effective_date DATE DEFAULT CURRENT_DATE, note TEXT, FOREIGN KEY (supplier_id) REFERENCES suppliers(id), FOREIGN KEY (product_id) REFERENCES products(id));")
lines.append("CREATE TABLE IF NOT EXISTS purchases (id INTEGER PRIMARY KEY AUTOINCREMENT, date DATE NOT NULL, batch_no TEXT, supplier_id INTEGER, supplier_name TEXT, product_id INTEGER, product_name TEXT, category TEXT, spec REAL, total_weight REAL, unit TEXT, quantity REAL NOT NULL, qty_unit TEXT DEFAULT '隻', cost_price REAL, sell_price REAL, total_amount REAL, payment_status TEXT DEFAULT '未付', note TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);")
lines.append("CREATE TABLE IF NOT EXISTS sales (id INTEGER PRIMARY KEY AUTOINCREMENT, date DATE NOT NULL, customer_id INTEGER, customer_name TEXT NOT NULL, product_id INTEGER, product_name TEXT NOT NULL, category TEXT, spec REAL, unit TEXT, quantity REAL NOT NULL, qty_unit TEXT, unit_price REAL NOT NULL, total_amount REAL NOT NULL, payment_status TEXT DEFAULT '待付款', payment_date DATE, payment_cycle TEXT, note TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);")
lines.append("CREATE TABLE IF NOT EXISTS expenses (id INTEGER PRIMARY KEY AUTOINCREMENT, date DATE NOT NULL, category TEXT NOT NULL, amount REAL NOT NULL, description TEXT, destination TEXT, note TEXT, payment_status TEXT DEFAULT '已付', created_at DATETIME DEFAULT CURRENT_TIMESTAMP);")
lines.append("CREATE TABLE IF NOT EXISTS cashflow (id INTEGER PRIMARY KEY AUTOINCREMENT, date DATE NOT NULL, flow_no TEXT, description TEXT NOT NULL, income REAL DEFAULT 0, expense REAL DEFAULT 0, balance REAL DEFAULT 0, party TEXT, category TEXT, ref_type TEXT, ref_id INTEGER, note TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);")
lines.append("CREATE TABLE IF NOT EXISTS receivables (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL, customer_name TEXT NOT NULL, period_start DATE NOT NULL, period_end DATE NOT NULL, payment_due DATE, total_amount REAL DEFAULT 0, paid_amount REAL DEFAULT 0, balance REAL DEFAULT 0, status TEXT DEFAULT '待付款', note TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);")
lines.append("CREATE TABLE IF NOT EXISTS payables (id INTEGER PRIMARY KEY AUTOINCREMENT, supplier_id INTEGER NOT NULL, supplier_name TEXT NOT NULL, period_start DATE NOT NULL, period_end DATE NOT NULL, payment_due DATE, total_amount REAL DEFAULT 0, paid_amount REAL DEFAULT 0, balance REAL DEFAULT 0, status TEXT DEFAULT '未付', note TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);")
lines.append("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);")
lines.append("")

# 1. 客戶
lines.append("-- ==== 客戶 ====")
for code, name in customers.items():
    lines.append("INSERT OR IGNORE INTO customers (code, name, active) VALUES ('%s', '%s', 1);" % (esc(code), esc(name)))

lines.append("")
# 2. 廠商
lines.append("-- ==== 廠商 ====")
for sup in suppliers_list:
    lines.append("INSERT OR IGNORE INTO suppliers (code, name, active) VALUES ('%s', '%s', 1);" % (esc(sup['code']), esc(sup['name'])))

lines.append("")
# 3. 商品
lines.append("-- ==== 商品 ====")
for code, info in products.items():
    pname = info['name']
    pcat  = info['category']
    lines.append("INSERT OR IGNORE INTO products (code, name, category, unit, active) VALUES ('%s', '%s', '%s', '斤', 1);" % (esc(code), esc(pname), esc(pcat)))

lines.append("")
# 4. 銷售
lines.append("-- ==== 銷售記錄 (%d筆) ====" % len(rows))
for r in rows:
    cid_expr = "(SELECT id FROM customers WHERE code='%s' LIMIT 1)" % esc(r['cust_code'])
    pid_expr = "(SELECT id FROM products WHERE code='%s' LIMIT 1)" % esc(r['prod_code'])
    lines.append(
        "INSERT INTO sales (date, customer_id, customer_name, product_id, product_name, "
        "category, spec, unit, quantity, qty_unit, unit_price, total_amount, payment_status, note) "
        "VALUES ('%s', %s, '%s', %s, '%s', '%s', %s, '%s', %s, '%s', %s, %s, '%s', '%s');" % (
            r['sale_date'], cid_expr, esc(r['cust_name']),
            pid_expr, esc(r['prod_name']),
            esc(r['category']),
            r['spec'], r['unit'],
            r['qty'], esc(r['qty_unit']),
            r['unit_price'], r['total_amount'],
            r['payment_status'], esc(r['note'])
        )
    )

sql_text = "\n".join(lines)
with open('/home/user/webapp/import_2026.sql', 'w', encoding='utf-8') as f:
    f.write(sql_text)

print("SQL 生成完成: %d 行" % len(lines))
print("客戶 %d / 廠商 %d / 商品 %d / 銷售 %d" % (len(customers), len(suppliers_list), len(products), len(rows)))
