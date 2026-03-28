import csv, re, json

path = '/home/user/uploaded_files/未命名的試算表 - 2026年.csv'

def clean_money(s):
    s = str(s).strip()
    s = re.sub(r'[\$,\s]', '', s)
    try:
        return float(s)
    except:
        return 0.0

def clean_date(s):
    s = str(s).strip()
    m = re.match(r'(\d{4})/(\d{1,2})/(\d{1,2})', s)
    if m:
        return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    return s

def esc(s):
    return str(s).replace("'", "''")

# Customer name -> (id, code)
customer_map = {
    '王英吉':       (1,  'L001'),
    '黃金好食雞':   (3,  'L003'),
    '雞世家':       (4,  'L005'),
    '好食在好吃雞肉':(7,  'L011'),
    '日日快餐':     (8,  'L016'),
    '零售收現':     (10, 'L018'),
    '池進財':       (11, 'L019'),
}

# Product name -> (id, code) — use first match by name
product_map = {
    '放山土公':   (1,  'C001'),
    '放山土母':   (2,  'C002'),
    '文昌公':     (4,  'C004'),
    '文昌母':     (5,  'C005'),
    '珍珠母':     (11, 'C011'),
    '仿土公':     (12, 'C012'),
    '仿土母':     (13, 'C013'),
    '雞佛':       (15, 'C015'),
    '太空鴨':     (17, 'C017'),
    '鹿野':       (20, 'C024'),
    '雞胸肉':     (21, 'C071'),
    '台灣-骨8':   (22, 'C075'),
    '閹雞':       (23, 'C076'),
    '甘蔗雞':     (24, 'C080'),
    '次雞公':     (763,'C046'),
    '次雞':       (768,'C022'),
}

rows = []
with open(path, encoding='utf-8-sig') as f:
    reader = csv.reader(f)
    headers = next(reader)
    for row in reader:
        rows.append(row)

lines = []
lines.append("-- ============================================")
lines.append("-- REPLACE SALES: Clear all existing + insert new 242 rows")
lines.append("-- ============================================")
lines.append("")
lines.append("DELETE FROM sales;")
lines.append("")

ok = 0
skip = 0
new_products = {}
new_customers = {}

for i, r in enumerate(rows):
    if len(r) < 12:
        skip += 1
        continue
    date_raw = r[3].strip()
    cust_name = r[2].strip()
    category = r[4].strip()
    prod_name = r[5].strip()
    spec_raw  = r[6].strip()
    unit      = r[7].strip() if len(r)>7 else 'KG'
    qty_raw   = r[8].strip()
    qty_unit  = r[9].strip() if len(r)>9 else '隻'
    price_raw = r[10] if len(r)>10 else '0'
    total_raw = r[11] if len(r)>11 else '0'
    note      = r[12].strip() if len(r)>12 else ''
    paid_raw  = r[14].strip() if len(r)>14 else ''
    cost_raw  = r[15] if len(r)>15 else '0'
    tcost_raw = r[16] if len(r)>16 else '0'
    supplier  = r[17].strip() if len(r)>17 else ''
    settle    = r[18].strip() if len(r)>18 else ''

    if not date_raw or not cust_name or not prod_name:
        skip += 1
        continue

    date = clean_date(date_raw)
    
    try:
        spec = float(spec_raw) if spec_raw else None
    except:
        spec = None

    try:
        qty = float(qty_raw)
    except:
        qty = 0.0

    price = clean_money(price_raw)
    total = clean_money(total_raw)
    cost  = clean_money(cost_raw)
    tcost = clean_money(tcost_raw)

    # payment status
    if paid_raw in ('已付款', '已結款') or settle in ('已結款',):
        pay_status = '已付款'
    else:
        pay_status = '待付款'

    # customer
    if cust_name in customer_map:
        cust_id, cust_code = customer_map[cust_name]
    else:
        new_customers[cust_name] = True
        cust_id = 'NULL'
        cust_code = ''

    # product
    if prod_name in product_map:
        prod_id, prod_code = product_map[prod_name]
    else:
        new_products[prod_name] = category
        prod_id = 'NULL'
        prod_code = ''

    # build note with cost info
    extra_note = f"[廠商:{esc(supplier)} 成本:{cost} 總成本:{tcost}]"
    full_note = extra_note if not note else f"{esc(note)} {extra_note}"

    spec_val = f"{spec}" if spec is not None else "NULL"
    unit_val = f"'{esc(unit)}'" if unit else "'KG'"
    qty_unit_val = f"'{esc(qty_unit)}'" if qty_unit else "'隻'"

    lines.append(
        f"INSERT INTO sales (date, customer_id, customer_name, product_id, product_name, "
        f"category, spec, unit, quantity, qty_unit, unit_price, total_amount, "
        f"payment_status, note) VALUES ("
        f"'{date}', {cust_id}, '{esc(cust_name)}', {prod_id}, '{esc(prod_name)}', "
        f"'{esc(category)}', {spec_val}, {unit_val}, {qty}, {qty_unit_val}, "
        f"{price}, {total}, '{pay_status}', '{full_note}');"
    )
    ok += 1

print(f"OK: {ok}, Skip: {skip}")
if new_products:
    print(f"New products not in map: {new_products}")
if new_customers:
    print(f"New customers not in map: {new_customers}")

with open('/home/user/webapp/replace_sales_2026.sql', 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

print(f"Generated {len(lines)} lines -> replace_sales_2026.sql")
