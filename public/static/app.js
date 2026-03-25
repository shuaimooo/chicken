// === 全局狀態 ===
const state = {
  currentPage: 'dashboard',
  customers: [],
  suppliers: [],
  products: [],
  dashboardData: null,
  editingId: null,
  charts: {},
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
}

// === 工具函數 ===
const fmt = (n, d = 0) => (n || 0).toLocaleString('zh-TW', { minimumFractionDigits: d, maximumFractionDigits: d })
const fmtDate = (d) => d ? d.split('T')[0] : ''
const today = () => new Date().toISOString().split('T')[0]
const monthStr = (m) => ['一','二','三','四','五','六','七','八','九','十','十一','十二'][parseInt(m)-1] + '月'

function showToast(msg, type = 'success') {
  const el = document.getElementById('toast')
  const inner = el.querySelector('div')
  inner.className = `px-4 py-3 rounded-lg shadow-lg text-sm max-w-xs ${type === 'success' ? 'bg-gray-800' : 'bg-red-600'} text-white`
  inner.textContent = msg
  el.classList.remove('hidden')
  setTimeout(() => el.classList.add('hidden'), 2500)
}

async function api(method, path, data = null) {
  try {
    const opts = { method, headers: { 'Content-Type': 'application/json' } }
    if (data) opts.body = JSON.stringify(data)
    const res = await fetch(`/api${path}`, opts)
    return await res.json()
  } catch (e) {
    showToast('網路錯誤：' + e.message, 'error')
    return null
  }
}

function showModal(html) {
  const el = document.getElementById('modal-container')
  el.innerHTML = `<div class="modal-overlay" onclick="if(event.target===this)closeModal()">${html}</div>`
}

function closeModal() {
  document.getElementById('modal-container').innerHTML = ''
  state.editingId = null
}

// === 導航 ===
const pageNames = {
  dashboard: '儀表板', sales: '出貨記錄', purchases: '進貨記錄',
  receivables: '應收帳款', payables: '應付帳款', expenses: '費用記錄',
  cashflow: '現金流水帳', reports: '財務報表', inventory: '庫存管理',
  customers: '客戶管理', suppliers: '廠商管理', products: '商品管理',
  prices: '報價管理', weekly: '每週結算單', more: '更多功能',
}

function showPage(page) {
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'))
  document.getElementById(`page-${page}`)?.classList.add('active')
  document.querySelectorAll('.nav-item, .nav-mobile-btn').forEach(el => el.classList.remove('active'))
  document.getElementById(`side-${page}`)?.classList.add('active')
  document.getElementById(`nav-${page}`)?.classList.add('active', '!text-red-600')
  document.getElementById('page-title').textContent = pageNames[page] || page
  state.currentPage = page
  loadPage(page)
}

async function loadPage(page) {
  switch(page) {
    case 'dashboard': await loadDashboard(); break
    case 'sales': await loadSales(); break
    case 'purchases': await loadPurchases(); break
    case 'receivables': await loadReceivables(); break
    case 'payables': await loadPayables(); break
    case 'expenses': await loadExpenses(); break
    case 'cashflow': await loadCashflow(); break
    case 'reports': await loadReports(); break
    case 'inventory': await loadInventory(); break
    case 'customers': await loadCustomers(); break
    case 'suppliers': await loadSuppliers(); break
    case 'products': await loadProducts(); break
    case 'prices': await loadPrices(); break
    case 'weekly': await loadWeekly(); break
  }
}

// === 基礎數據加載 ===
async function preloadData() {
  const [c, s, p] = await Promise.all([
    api('GET', '/customers'),
    api('GET', '/suppliers'),
    api('GET', '/products'),
  ])
  state.customers = c || []
  state.suppliers = s || []
  state.products = p || []
}

// === 儀表板 ===
async function loadDashboard() {
  const el = document.getElementById('dashboard-content')
  el.innerHTML = '<div class="text-center py-8 text-gray-400"><i class="fas fa-spinner fa-spin text-2xl"></i></div>'
  const data = await api('GET', '/dashboard')
  if (!data) return
  state.dashboardData = data

  el.innerHTML = `
  <!-- KPI Cards -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
    <div class="kpi-card" style="background:linear-gradient(135deg,#dc2626,#b91c1c)">
      <div class="text-xs opacity-80 mb-1">今日出貨</div>
      <div class="text-xl font-bold">$${fmt(data.today.sales_amount)}</div>
      <div class="text-xs opacity-80">${data.today.sales_count} 筆</div>
    </div>
    <div class="kpi-card" style="background:linear-gradient(135deg,#16a34a,#15803d)">
      <div class="text-xs opacity-80 mb-1">本月營收</div>
      <div class="text-xl font-bold">$${fmt(data.month.revenue)}</div>
      <div class="text-xs opacity-80">毛利率 ${data.month.gross_margin}%</div>
    </div>
    <div class="kpi-card" style="background:linear-gradient(135deg,#d97706,#b45309)">
      <div class="text-xs opacity-80 mb-1">應收帳款</div>
      <div class="text-xl font-bold">$${fmt(data.receivable)}</div>
      <div class="text-xs opacity-80">待收款</div>
    </div>
    <div class="kpi-card" style="background:linear-gradient(135deg,#7c3aed,#6d28d9)">
      <div class="text-xs opacity-80 mb-1">年度達成</div>
      <div class="text-xl font-bold">${data.year.achievement}%</div>
      <div class="text-xs opacity-80">$${fmt(data.year.revenue)} / $${fmt(data.year.target)}</div>
    </div>
  </div>

  <!-- 本月損益 & 現金流 -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
    <div class="card p-4">
      <div class="font-bold text-gray-700 mb-3 flex items-center gap-2">
        <i class="fas fa-chart-line text-green-600"></i> 本月損益
      </div>
      <div class="space-y-2">
        <div class="flex justify-between items-center py-1 border-b border-gray-100">
          <span class="text-gray-600 text-sm">營業收入</span>
          <span class="font-semibold amount-positive">+$${fmt(data.month.revenue)}</span>
        </div>
        <div class="flex justify-between items-center py-1 border-b border-gray-100">
          <span class="text-gray-600 text-sm">進貨成本</span>
          <span class="font-semibold amount-negative">-$${fmt(data.month.cost)}</span>
        </div>
        <div class="flex justify-between items-center py-1 border-b border-gray-100">
          <span class="text-gray-600 text-sm">費用支出</span>
          <span class="font-semibold amount-negative">-$${fmt(data.month.expense)}</span>
        </div>
        <div class="flex justify-between items-center py-2">
          <span class="font-bold text-gray-800">月度淨利</span>
          <span class="font-bold text-lg ${data.month.net >= 0 ? 'amount-positive' : 'amount-negative'}">$${fmt(data.month.net)}</span>
        </div>
      </div>
    </div>
    <div class="card p-4">
      <div class="font-bold text-gray-700 mb-3 flex items-center gap-2">
        <i class="fas fa-balance-scale text-blue-600"></i> 資金狀況
      </div>
      <div class="space-y-2">
        <div class="flex justify-between items-center py-1 border-b border-gray-100">
          <span class="text-gray-600 text-sm">應收帳款</span>
          <span class="font-semibold text-green-600">$${fmt(data.receivable)}</span>
        </div>
        <div class="flex justify-between items-center py-1 border-b border-gray-100">
          <span class="text-gray-600 text-sm">待付帳款</span>
          <span class="font-semibold text-red-600">$${fmt(data.payable)}</span>
        </div>
        <div class="flex justify-between items-center py-1 border-b border-gray-100">
          <span class="text-gray-600 text-sm">資金缺口</span>
          <span class="font-semibold ${data.cash_gap >= 0 ? 'text-green-600' : 'text-red-600'}">$${fmt(data.cash_gap)}</span>
        </div>
        <div class="flex justify-between items-center py-2">
          <span class="font-bold text-gray-800">年度達成率</span>
          <div class="flex items-center gap-2">
            <div class="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div class="h-full bg-red-500 rounded-full" style="width:${Math.min(100,data.year.achievement)}%"></div>
            </div>
            <span class="font-bold">${data.year.achievement}%</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 月度趨勢圖 -->
  <div class="card p-4 mb-4">
    <div class="font-bold text-gray-700 mb-3 flex items-center gap-2">
      <i class="fas fa-chart-bar text-red-500"></i> 月度營收趨勢
    </div>
    <canvas id="chart-monthly" height="80"></canvas>
  </div>

  <!-- 最近出貨 -->
  <div class="card p-4">
    <div class="font-bold text-gray-700 mb-3 flex items-center justify-between">
      <div class="flex items-center gap-2"><i class="fas fa-truck text-gray-500"></i> 最近出貨</div>
      <button onclick="showPage('sales')" class="text-red-600 text-sm">查看全部 ></button>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="table-header"><tr>
          <th class="text-left p-2">日期</th>
          <th class="text-left p-2">客戶</th>
          <th class="text-left p-2 hidden sm:table-cell">商品</th>
          <th class="text-right p-2">金額</th>
          <th class="text-center p-2">狀態</th>
        </tr></thead>
        <tbody>
          ${(data.recent_sales || []).map(s => `
          <tr class="border-b border-gray-50">
            <td class="p-2 text-gray-500">${fmtDate(s.date)}</td>
            <td class="p-2 font-medium">${s.customer_name}</td>
            <td class="p-2 text-gray-600 hidden sm:table-cell">${s.product_name}</td>
            <td class="p-2 text-right font-semibold">$${fmt(s.total_amount)}</td>
            <td class="p-2 text-center"><span class="${getStatusClass(s.payment_status)}">${s.payment_status}</span></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>
  `

  // 繪製圖表
  const ctx = document.getElementById('chart-monthly')?.getContext('2d')
  if (ctx) {
    if (state.charts.monthly) state.charts.monthly.destroy()
    const labels = ['1','2','3','4','5','6','7','8','9','10','11','12'].map(m => m + '月')
    const monthMap = {}
    ;(data.monthly_stats || []).forEach(r => { monthMap[r.month] = r.revenue })
    const values = Array.from({length:12}, (_, i) => monthMap[String(i+1).padStart(2,'0')] || 0)
    state.charts.monthly = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: '營收',
          data: values,
          backgroundColor: values.map((v, i) => i === state.month - 1 ? '#dc2626' : '#fca5a5'),
          borderRadius: 6,
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => '$' + fmt(ctx.raw) } } },
        scales: { y: { ticks: { callback: v => '$' + fmt(v) } } }
      }
    })
  }
}

function getStatusClass(status) {
  if (['已付款','已付','已結'].includes(status)) return 'status-paid'
  if (['待付款','未付款','未付','未結'].includes(status)) return 'status-unpaid'
  return 'status-partial'
}

// === 出貨管理 ===
async function loadSales() {
  const el = document.getElementById('sales-content')
  const y = state.year, m = state.month
  const data = await api('GET', `/sales?year=${y}&month=${m}`)
  if (!data) return

  const totalAmt = data.reduce((s, r) => s + (r.total_amount || 0), 0)
  const unpaid = data.filter(r => ['待付款','未付款'].includes(r.payment_status)).reduce((s, r) => s + (r.total_amount || 0), 0)

  el.innerHTML = `
  <div class="flex items-center gap-2 mb-4 flex-wrap">
    <select id="filter-year" class="input-field" style="width:90px" onchange="state.year=parseInt(this.value);loadSales()">
      ${[2024,2025,2026,2027].map(y => `<option value="${y}" ${y===state.year?'selected':''}>${y}年</option>`).join('')}
    </select>
    <select id="filter-month" class="input-field" style="width:90px" onchange="state.month=parseInt(this.value);loadSales()">
      ${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${i+1===state.month?'selected':''}>${i+1}月</option>`).join('')}
    </select>
    <div class="flex-1"></div>
    <button onclick="openSaleModal()" class="btn-primary"><i class="fas fa-plus mr-1"></i>新增出貨</button>
  </div>
  <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
    <div class="card p-3 text-center">
      <div class="text-xs text-gray-500 mb-1">本期筆數</div>
      <div class="text-xl font-bold text-red-600">${data.length}</div>
    </div>
    <div class="card p-3 text-center">
      <div class="text-xs text-gray-500 mb-1">本期總額</div>
      <div class="text-lg font-bold text-green-600">$${fmt(totalAmt)}</div>
    </div>
    <div class="card p-3 text-center col-span-2 md:col-span-1">
      <div class="text-xs text-gray-500 mb-1">待收款</div>
      <div class="text-lg font-bold text-amber-600">$${fmt(unpaid)}</div>
    </div>
  </div>
  <div class="card overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="table-header"><tr>
          <th class="text-left p-3">日期</th>
          <th class="text-left p-3">客戶</th>
          <th class="text-left p-3 hidden md:table-cell">商品</th>
          <th class="text-right p-3 hidden sm:table-cell">數量</th>
          <th class="text-right p-3">金額</th>
          <th class="text-center p-3">狀態</th>
          <th class="text-center p-3">操作</th>
        </tr></thead>
        <tbody>
          ${data.length === 0 ? '<tr><td colspan="7" class="p-8 text-center text-gray-400">尚無資料</td></tr>' :
            data.map(r => `
            <tr class="border-b border-gray-50">
              <td class="p-3 text-gray-500 whitespace-nowrap">${fmtDate(r.date)}</td>
              <td class="p-3 font-medium">${r.customer_name}</td>
              <td class="p-3 text-gray-600 hidden md:table-cell">${r.product_name}${r.spec ? ' '+r.spec+'KG' : ''}</td>
              <td class="p-3 text-right text-gray-600 hidden sm:table-cell">${r.quantity}${r.qty_unit||''}</td>
              <td class="p-3 text-right font-semibold">$${fmt(r.total_amount)}</td>
              <td class="p-3 text-center">
                <button onclick="cycleSaleStatus(${r.id},'${r.payment_status}')" class="${getStatusClass(r.payment_status)}">${r.payment_status}</button>
              </td>
              <td class="p-3 text-center">
                <button onclick="openSaleModal(${r.id})" class="text-blue-500 mr-2"><i class="fas fa-edit"></i></button>
                <button onclick="deleteSale(${r.id})" class="text-red-400"><i class="fas fa-trash"></i></button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`
}

async function cycleSaleStatus(id, current) {
  const statuses = ['待付款', '已付款']
  const next = statuses[(statuses.indexOf(current) + 1) % statuses.length]
  await api('PATCH', `/sales/${id}/pay`, { status: next })
  loadSales()
}

async function deleteSale(id) {
  if (!confirm('確定刪除此筆出貨記錄？')) return
  await api('DELETE', `/sales/${id}`)
  showToast('已刪除')
  loadSales()
}

async function openSaleModal(id = null) {
  state.editingId = id
  let sale = {}
  if (id) {
    const list = await api('GET', `/sales?year=2026`)
    sale = list?.find(r => r.id === id) || {}
  }

  showModal(`
  <div class="modal-box">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-bold">${id ? '編輯' : '新增'}出貨記錄</h2>
      <button onclick="closeModal()" class="text-gray-400 text-xl">✕</button>
    </div>
    <div class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-sm text-gray-600 mb-1 block">日期 *</label>
          <input type="date" id="s-date" class="input-field" value="${sale.date ? fmtDate(sale.date) : today()}">
        </div>
        <div>
          <label class="text-sm text-gray-600 mb-1 block">狀態</label>
          <select id="s-status" class="input-field">
            ${['待付款','已付款','未付款'].map(s => `<option value="${s}" ${sale.payment_status===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div>
        <label class="text-sm text-gray-600 mb-1 block">客戶 *</label>
        <select id="s-customer" class="input-field" onchange="onCustomerChange()">
          <option value="">-- 選擇客戶 --</option>
          ${state.customers.map(c => `<option value="${c.id}" data-name="${c.name}" ${sale.customer_id==c.id?'selected':''}>${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-sm text-gray-600 mb-1 block">商品 *</label>
          <select id="s-product" class="input-field" onchange="onProductChange()">
            <option value="">-- 選擇商品 --</option>
            ${state.products.map(p => `<option value="${p.id}" data-name="${p.name}" data-unit="${p.unit}" data-category="${p.category}" ${sale.product_id==p.id?'selected':''}>${p.name}(${p.category})</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-sm text-gray-600 mb-1 block">規格(KG)</label>
          <input type="number" id="s-spec" class="input-field" value="${sale.spec||''}" placeholder="如 2.5">
        </div>
      </div>
      <div class="grid grid-cols-3 gap-3">
        <div>
          <label class="text-sm text-gray-600 mb-1 block">數量 *</label>
          <input type="number" id="s-qty" class="input-field" value="${sale.quantity||''}" oninput="calcSaleTotal()">
        </div>
        <div>
          <label class="text-sm text-gray-600 mb-1 block">單位</label>
          <select id="s-qty-unit" class="input-field">
            ${['隻','件','KG','斤','盒'].map(u => `<option value="${u}" ${sale.qty_unit===u?'selected':''}>${u}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-sm text-gray-600 mb-1 block">單價 *</label>
          <input type="number" id="s-price" class="input-field" value="${sale.unit_price||''}" oninput="calcSaleTotal()">
        </div>
      </div>
      <div>
        <label class="text-sm text-gray-600 mb-1 block">總金額</label>
        <input type="number" id="s-total" class="input-field bg-gray-50" value="${sale.total_amount||''}" readonly>
      </div>
      <div>
        <label class="text-sm text-gray-600 mb-1 block">備註</label>
        <input type="text" id="s-note" class="input-field" value="${sale.note||''}" placeholder="選填">
      </div>
    </div>
    <div class="flex gap-3 mt-4">
      <button onclick="closeModal()" class="btn-secondary flex-1">取消</button>
      <button onclick="saveSale()" class="btn-primary flex-1">儲存</button>
    </div>
  </div>`)
}

function onCustomerChange() {
  const sel = document.getElementById('s-customer')
  const opt = sel.options[sel.selectedIndex]
  // Could auto-fill price from customer_prices
}

function onProductChange() {
  const sel = document.getElementById('s-product')
  const opt = sel.options[sel.selectedIndex]
  if (opt && opt.dataset.unit) {
    const qtyUnit = document.getElementById('s-qty-unit')
    if (qtyUnit) {
      for (let i = 0; i < qtyUnit.options.length; i++) {
        if (qtyUnit.options[i].value === opt.dataset.unit) qtyUnit.selectedIndex = i
      }
    }
  }
}

function calcSaleTotal() {
  const qty = parseFloat(document.getElementById('s-qty')?.value) || 0
  const price = parseFloat(document.getElementById('s-price')?.value) || 0
  const total = qty * price
  const el = document.getElementById('s-total')
  if (el) el.value = total > 0 ? total.toFixed(0) : ''
}

async function saveSale() {
  const customerSel = document.getElementById('s-customer')
  const productSel = document.getElementById('s-product')
  const data = {
    date: document.getElementById('s-date').value,
    customer_id: customerSel.value || null,
    customer_name: customerSel.options[customerSel.selectedIndex]?.dataset?.name || customerSel.value,
    product_id: productSel.value || null,
    product_name: productSel.options[productSel.selectedIndex]?.dataset?.name || productSel.value,
    category: productSel.options[productSel.selectedIndex]?.dataset?.category || null,
    spec: document.getElementById('s-spec').value || null,
    quantity: parseFloat(document.getElementById('s-qty').value),
    qty_unit: document.getElementById('s-qty-unit').value,
    unit_price: parseFloat(document.getElementById('s-price').value),
    total_amount: parseFloat(document.getElementById('s-total').value) || null,
    payment_status: document.getElementById('s-status').value,
    note: document.getElementById('s-note').value || null,
  }
  if (!data.date || !data.customer_name || !data.product_name || !data.quantity || !data.unit_price) {
    showToast('請填寫必填欄位', 'error'); return
  }
  const res = state.editingId
    ? await api('PUT', `/sales/${state.editingId}`, data)
    : await api('POST', '/sales', data)
  if (res?.success) {
    showToast('儲存成功')
    closeModal()
    loadSales()
    if (state.currentPage === 'dashboard') loadDashboard()
  } else {
    showToast(res?.error || '儲存失敗', 'error')
  }
}

// === 進貨管理 ===
async function loadPurchases() {
  const el = document.getElementById('purchases-content')
  const y = state.year, m = state.month
  const data = await api('GET', `/purchases?year=${y}&month=${m}`)
  if (!data) return

  const totalAmt = data.reduce((s, r) => s + (r.total_amount || 0), 0)
  const unpaid = data.filter(r => r.payment_status === '未付').reduce((s, r) => s + (r.total_amount || 0), 0)

  el.innerHTML = `
  <div class="flex items-center gap-2 mb-4 flex-wrap">
    <select class="input-field" style="width:90px" onchange="state.year=parseInt(this.value);loadPurchases()">
      ${[2024,2025,2026,2027].map(y => `<option value="${y}" ${y===state.year?'selected':''}>${y}年</option>`).join('')}
    </select>
    <select class="input-field" style="width:90px" onchange="state.month=parseInt(this.value);loadPurchases()">
      ${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${i+1===state.month?'selected':''}>${i+1}月</option>`).join('')}
    </select>
    <div class="flex-1"></div>
    <button onclick="openPurchaseModal()" class="btn-primary"><i class="fas fa-plus mr-1"></i>新增進貨</button>
  </div>
  <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
    <div class="card p-3 text-center"><div class="text-xs text-gray-500 mb-1">本期筆數</div><div class="text-xl font-bold text-red-600">${data.length}</div></div>
    <div class="card p-3 text-center"><div class="text-xs text-gray-500 mb-1">本期總額</div><div class="text-lg font-bold text-red-600">$${fmt(totalAmt)}</div></div>
    <div class="card p-3 text-center col-span-2 md:col-span-1"><div class="text-xs text-gray-500 mb-1">待付款</div><div class="text-lg font-bold text-amber-600">$${fmt(unpaid)}</div></div>
  </div>
  <div class="card overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="table-header"><tr>
          <th class="text-left p-3">日期</th>
          <th class="text-left p-3">廠商</th>
          <th class="text-left p-3 hidden md:table-cell">商品</th>
          <th class="text-right p-3 hidden sm:table-cell">數量</th>
          <th class="text-right p-3">金額</th>
          <th class="text-center p-3">狀態</th>
          <th class="text-center p-3">操作</th>
        </tr></thead>
        <tbody>
          ${data.length === 0 ? '<tr><td colspan="7" class="p-8 text-center text-gray-400">尚無資料</td></tr>' :
            data.map(r => `
            <tr class="border-b border-gray-50">
              <td class="p-3 text-gray-500">${fmtDate(r.date)}</td>
              <td class="p-3 font-medium">${r.supplier_name||'-'}</td>
              <td class="p-3 text-gray-600 hidden md:table-cell">${r.product_name||'-'}${r.spec ? ' '+r.spec+'KG' : ''}</td>
              <td class="p-3 text-right text-gray-600 hidden sm:table-cell">${r.quantity}${r.qty_unit||''}</td>
              <td class="p-3 text-right font-semibold">$${fmt(r.total_amount)}</td>
              <td class="p-3 text-center">
                <button onclick="cyclePurchaseStatus(${r.id},'${r.payment_status}')" class="${getStatusClass(r.payment_status)}">${r.payment_status}</button>
              </td>
              <td class="p-3 text-center">
                <button onclick="openPurchaseModal(${r.id})" class="text-blue-500 mr-2"><i class="fas fa-edit"></i></button>
                <button onclick="deletePurchase(${r.id})" class="text-red-400"><i class="fas fa-trash"></i></button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`
}

async function cyclePurchaseStatus(id, current) {
  const next = current === '未付' ? '已付' : '未付'
  await api('PATCH', `/purchases/${id}/pay`, { status: next })
  loadPurchases()
}

async function deletePurchase(id) {
  if (!confirm('確定刪除？')) return
  await api('DELETE', `/purchases/${id}`)
  showToast('已刪除')
  loadPurchases()
}

async function openPurchaseModal(id = null) {
  state.editingId = id
  let r = {}
  if (id) {
    const list = await api('GET', `/purchases?year=2026`)
    r = list?.find(x => x.id === id) || {}
  }

  showModal(`
  <div class="modal-box">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-bold">${id ? '編輯' : '新增'}進貨記錄</h2>
      <button onclick="closeModal()" class="text-gray-400 text-xl">✕</button>
    </div>
    <div class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-sm text-gray-600 mb-1 block">日期 *</label>
          <input type="date" id="p-date" class="input-field" value="${r.date ? fmtDate(r.date) : today()}">
        </div>
        <div>
          <label class="text-sm text-gray-600 mb-1 block">批號</label>
          <input type="text" id="p-batch" class="input-field" value="${r.batch_no||''}" placeholder="如 C005">
        </div>
      </div>
      <div>
        <label class="text-sm text-gray-600 mb-1 block">廠商</label>
        <select id="p-supplier" class="input-field">
          <option value="">-- 選擇廠商 --</option>
          ${state.suppliers.map(s => `<option value="${s.id}" data-name="${s.name}" ${r.supplier_id==s.id?'selected':''}>${s.name}</option>`).join('')}
        </select>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-sm text-gray-600 mb-1 block">商品</label>
          <select id="p-product" class="input-field">
            <option value="">-- 選擇商品 --</option>
            ${state.products.map(p => `<option value="${p.id}" data-name="${p.name}" data-unit="${p.unit}" data-category="${p.category}" ${r.product_id==p.id?'selected':''}>${p.name}(${p.category})</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-sm text-gray-600 mb-1 block">規格(KG)</label>
          <input type="number" id="p-spec" class="input-field" value="${r.spec||''}" step="0.1" placeholder="如 2.5">
        </div>
      </div>
      <div class="grid grid-cols-3 gap-3">
        <div>
          <label class="text-sm text-gray-600 mb-1 block">數量 *</label>
          <input type="number" id="p-qty" class="input-field" value="${r.quantity||''}" oninput="calcPurchaseTotal()">
        </div>
        <div>
          <label class="text-sm text-gray-600 mb-1 block">單位</label>
          <select id="p-qty-unit" class="input-field">
            ${['隻','件','KG','斤'].map(u => `<option value="${u}" ${r.qty_unit===u?'selected':''}>${u}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-sm text-gray-600 mb-1 block">進價</label>
          <input type="number" id="p-cost" class="input-field" value="${r.cost_price||''}" oninput="calcPurchaseTotal()">
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-sm text-gray-600 mb-1 block">總金額</label>
          <input type="number" id="p-total" class="input-field" value="${r.total_amount||''}">
        </div>
        <div>
          <label class="text-sm text-gray-600 mb-1 block">付款狀態</label>
          <select id="p-status" class="input-field">
            ${['未付','已付'].map(s => `<option value="${s}" ${r.payment_status===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div>
        <label class="text-sm text-gray-600 mb-1 block">備註</label>
        <input type="text" id="p-note" class="input-field" value="${r.note||''}">
      </div>
    </div>
    <div class="flex gap-3 mt-4">
      <button onclick="closeModal()" class="btn-secondary flex-1">取消</button>
      <button onclick="savePurchase()" class="btn-primary flex-1">儲存</button>
    </div>
  </div>`)
}

function calcPurchaseTotal() {
  const qty = parseFloat(document.getElementById('p-qty')?.value) || 0
  const cost = parseFloat(document.getElementById('p-cost')?.value) || 0
  const total = qty * cost
  const el = document.getElementById('p-total')
  if (el && total > 0) el.value = total.toFixed(0)
}

async function savePurchase() {
  const supplierSel = document.getElementById('p-supplier')
  const productSel = document.getElementById('p-product')
  const data = {
    date: document.getElementById('p-date').value,
    batch_no: document.getElementById('p-batch').value || null,
    supplier_id: supplierSel.value || null,
    supplier_name: supplierSel.options[supplierSel.selectedIndex]?.dataset?.name || null,
    product_id: productSel.value || null,
    product_name: productSel.options[productSel.selectedIndex]?.dataset?.name || null,
    category: productSel.options[productSel.selectedIndex]?.dataset?.category || null,
    spec: document.getElementById('p-spec').value || null,
    quantity: parseFloat(document.getElementById('p-qty').value),
    qty_unit: document.getElementById('p-qty-unit').value,
    cost_price: parseFloat(document.getElementById('p-cost').value) || null,
    total_amount: parseFloat(document.getElementById('p-total').value) || null,
    payment_status: document.getElementById('p-status').value,
    note: document.getElementById('p-note').value || null,
  }
  if (!data.date || !data.quantity) { showToast('日期和數量必填', 'error'); return }
  const res = state.editingId
    ? await api('PUT', `/purchases/${state.editingId}`, data)
    : await api('POST', '/purchases', data)
  if (res?.success) { showToast('儲存成功'); closeModal(); loadPurchases() }
  else showToast(res?.error || '儲存失敗', 'error')
}

// === 應收帳款 ===
async function loadReceivables() {
  const el = document.getElementById('receivables-content')
  const y = state.year
  const data = await api('GET', `/sales/stats/customer-summary?year=${y}`)
  if (!data) return

  el.innerHTML = `
  <div class="flex items-center gap-2 mb-4">
    <select class="input-field" style="width:90px" onchange="state.year=parseInt(this.value);loadReceivables()">
      ${[2024,2025,2026,2027].map(yr => `<option value="${yr}" ${yr===y?'selected':''}>${yr}年</option>`).join('')}
    </select>
    <span class="text-sm text-gray-500">客戶應收帳款彙總</span>
  </div>
  <div class="card overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="table-header"><tr>
          <th class="text-left p-3">客戶</th>
          <th class="text-right p-3">總銷售額</th>
          <th class="text-right p-3">應收款</th>
          <th class="text-right p-3">已收款</th>
          <th class="text-right p-3">收款率</th>
        </tr></thead>
        <tbody>
          ${data.map(r => {
            const rate = r.revenue > 0 ? ((r.paid || 0) / r.revenue * 100).toFixed(1) : '0'
            return `
            <tr class="border-b border-gray-50">
              <td class="p-3 font-medium">${r.customer_name}</td>
              <td class="p-3 text-right">$${fmt(r.revenue)}</td>
              <td class="p-3 text-right text-amber-600 font-semibold">$${fmt(r.receivable)}</td>
              <td class="p-3 text-right text-green-600">$${fmt(r.paid)}</td>
              <td class="p-3 text-right">
                <div class="flex items-center justify-end gap-2">
                  <div class="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div class="h-full bg-green-500 rounded-full" style="width:${rate}%"></div>
                  </div>
                  <span class="${parseFloat(rate) < 80 ? 'text-red-500' : 'text-green-600'} font-medium">${rate}%</span>
                </div>
              </td>
            </tr>`
          }).join('')}
          <tr class="bg-gray-50 font-bold">
            <td class="p-3">合計</td>
            <td class="p-3 text-right">$${fmt(data.reduce((s,r)=>s+(r.revenue||0),0))}</td>
            <td class="p-3 text-right text-amber-600">$${fmt(data.reduce((s,r)=>s+(r.receivable||0),0))}</td>
            <td class="p-3 text-right text-green-600">$${fmt(data.reduce((s,r)=>s+(r.paid||0),0))}</td>
            <td class="p-3"></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>`
}

// === 應付帳款 ===
async function loadPayables() {
  const el = document.getElementById('payables-content')
  const y = state.year
  const data = await api('GET', `/purchases/stats/summary?year=${y}`)
  if (!data) return

  el.innerHTML = `
  <div class="flex items-center gap-2 mb-4">
    <select class="input-field" style="width:90px" onchange="state.year=parseInt(this.value);loadPayables()">
      ${[2024,2025,2026,2027].map(yr => `<option value="${yr}" ${yr===y?'selected':''}>${yr}年</option>`).join('')}
    </select>
    <span class="text-sm text-gray-500">廠商應付帳款彙總</span>
  </div>
  <div class="card overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="table-header"><tr>
          <th class="text-left p-3">廠商</th>
          <th class="text-right p-3">總採購</th>
          <th class="text-right p-3">待付款</th>
          <th class="text-center p-3">筆數</th>
        </tr></thead>
        <tbody>
          ${data.map(r => `
          <tr class="border-b border-gray-50">
            <td class="p-3 font-medium">${r.supplier_name||'未指定'}</td>
            <td class="p-3 text-right">$${fmt(r.total)}</td>
            <td class="p-3 text-right ${r.unpaid > 0 ? 'text-red-600 font-semibold' : 'text-gray-400'}">$${fmt(r.unpaid)}</td>
            <td class="p-3 text-center text-gray-500">${r.cnt}</td>
          </tr>`).join('')}
          <tr class="bg-gray-50 font-bold">
            <td class="p-3">合計</td>
            <td class="p-3 text-right">$${fmt(data.reduce((s,r)=>s+(r.total||0),0))}</td>
            <td class="p-3 text-right text-red-600">$${fmt(data.reduce((s,r)=>s+(r.unpaid||0),0))}</td>
            <td class="p-3 text-center">${data.reduce((s,r)=>s+r.cnt,0)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>`
}

// === 費用記錄 ===
async function loadExpenses() {
  const el = document.getElementById('expenses-content')
  const y = state.year, m = state.month
  const data = await api('GET', `/expenses?year=${y}&month=${m}`)
  if (!data) return
  const total = data.reduce((s, r) => s + (r.amount || 0), 0)
  const catMap = {}
  data.forEach(r => { catMap[r.category] = (catMap[r.category] || 0) + r.amount })

  el.innerHTML = `
  <div class="flex items-center gap-2 mb-4 flex-wrap">
    <select class="input-field" style="width:90px" onchange="state.year=parseInt(this.value);loadExpenses()">
      ${[2024,2025,2026,2027].map(yr => `<option value="${yr}" ${yr===y?'selected':''}>${yr}年</option>`).join('')}
    </select>
    <select class="input-field" style="width:90px" onchange="state.month=parseInt(this.value);loadExpenses()">
      ${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${i+1===m?'selected':''}>${i+1}月</option>`).join('')}
    </select>
    <div class="flex-1"></div>
    <button onclick="openExpenseModal()" class="btn-primary"><i class="fas fa-plus mr-1"></i>新增費用</button>
  </div>
  <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
    <div class="card p-3 text-center col-span-2 md:col-span-1"><div class="text-xs text-gray-500 mb-1">本期合計</div><div class="text-xl font-bold text-red-600">$${fmt(total)}</div></div>
    ${Object.entries(catMap).map(([cat, amt]) => `<div class="card p-3 text-center"><div class="text-xs text-gray-500 mb-1">${cat}</div><div class="text-base font-bold text-orange-600">$${fmt(amt)}</div></div>`).join('')}
  </div>
  <div class="card overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="table-header"><tr>
          <th class="text-left p-3">日期</th>
          <th class="text-left p-3">類別</th>
          <th class="text-left p-3 hidden md:table-cell">說明</th>
          <th class="text-right p-3">金額</th>
          <th class="text-center p-3">操作</th>
        </tr></thead>
        <tbody>
          ${data.length === 0 ? '<tr><td colspan="5" class="p-8 text-center text-gray-400">尚無資料</td></tr>' :
            data.map(r => `
            <tr class="border-b border-gray-50">
              <td class="p-3 text-gray-500">${fmtDate(r.date)}</td>
              <td class="p-3"><span class="bg-orange-50 text-orange-700 px-2 py-0.5 rounded text-xs">${r.category}</span></td>
              <td class="p-3 text-gray-600 hidden md:table-cell">${r.description||''} ${r.destination||''}</td>
              <td class="p-3 text-right font-semibold text-red-600">$${fmt(r.amount)}</td>
              <td class="p-3 text-center">
                <button onclick="openExpenseModal(${r.id})" class="text-blue-500 mr-2"><i class="fas fa-edit"></i></button>
                <button onclick="deleteExpense(${r.id})" class="text-red-400"><i class="fas fa-trash"></i></button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`
}

async function deleteExpense(id) {
  if (!confirm('確定刪除？')) return
  await api('DELETE', `/expenses/${id}`)
  showToast('已刪除'); loadExpenses()
}

async function openExpenseModal(id = null) {
  state.editingId = id
  let r = {}
  if (id) {
    const list = await api('GET', `/expenses?year=2026`)
    r = list?.find(x => x.id === id) || {}
  }
  showModal(`
  <div class="modal-box">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-bold">${id ? '編輯' : '新增'}費用記錄</h2>
      <button onclick="closeModal()" class="text-gray-400 text-xl">✕</button>
    </div>
    <div class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-sm text-gray-600 mb-1 block">日期 *</label>
          <input type="date" id="e-date" class="input-field" value="${r.date ? fmtDate(r.date) : today()}">
        </div>
        <div>
          <label class="text-sm text-gray-600 mb-1 block">類別 *</label>
          <select id="e-cat" class="input-field">
            ${['油費','過路費','出差-交通','維修','餐費','雜支','其他'].map(c => `<option value="${c}" ${r.category===c?'selected':''}>${c}</option>`).join('')}
          </select>
        </div>
      </div>
      <div>
        <label class="text-sm text-gray-600 mb-1 block">金額 *</label>
        <input type="number" id="e-amount" class="input-field" value="${r.amount||''}">
      </div>
      <div>
        <label class="text-sm text-gray-600 mb-1 block">說明/目的地</label>
        <input type="text" id="e-desc" class="input-field" value="${r.description||''}">
      </div>
      <div>
        <label class="text-sm text-gray-600 mb-1 block">備註</label>
        <input type="text" id="e-note" class="input-field" value="${r.note||''}">
      </div>
    </div>
    <div class="flex gap-3 mt-4">
      <button onclick="closeModal()" class="btn-secondary flex-1">取消</button>
      <button onclick="saveExpense()" class="btn-primary flex-1">儲存</button>
    </div>
  </div>`)
}

async function saveExpense() {
  const data = {
    date: document.getElementById('e-date').value,
    category: document.getElementById('e-cat').value,
    amount: parseFloat(document.getElementById('e-amount').value),
    description: document.getElementById('e-desc').value || null,
    note: document.getElementById('e-note').value || null,
  }
  if (!data.date || !data.amount) { showToast('必填欄位未填', 'error'); return }
  const res = state.editingId
    ? await api('PUT', `/expenses/${state.editingId}`, data)
    : await api('POST', '/expenses', data)
  if (res?.success) { showToast('儲存成功'); closeModal(); loadExpenses() }
  else showToast(res?.error || '儲存失敗', 'error')
}

// === 現金流水帳 ===
async function loadCashflow() {
  const el = document.getElementById('cashflow-content')
  const y = state.year, m = state.month
  const data = await api('GET', `/cashflow?year=${y}&month=${m}`)
  if (!data) return
  const totalIn = data.reduce((s, r) => s + (r.income || 0), 0)
  const totalOut = data.reduce((s, r) => s + (r.expense || 0), 0)

  el.innerHTML = `
  <div class="flex items-center gap-2 mb-4 flex-wrap">
    <select class="input-field" style="width:90px" onchange="state.year=parseInt(this.value);loadCashflow()">
      ${[2024,2025,2026,2027].map(yr => `<option value="${yr}" ${yr===y?'selected':''}>${yr}年</option>`).join('')}
    </select>
    <select class="input-field" style="width:90px" onchange="state.month=parseInt(this.value);loadCashflow()">
      ${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${i+1===m?'selected':''}>${i+1}月</option>`).join('')}
    </select>
    <div class="flex-1"></div>
    <button onclick="openCashflowModal()" class="btn-primary"><i class="fas fa-plus mr-1"></i>新增</button>
  </div>
  <div class="grid grid-cols-3 gap-3 mb-4">
    <div class="card p-3 text-center"><div class="text-xs text-gray-500 mb-1">收入</div><div class="text-lg font-bold text-green-600">+$${fmt(totalIn)}</div></div>
    <div class="card p-3 text-center"><div class="text-xs text-gray-500 mb-1">支出</div><div class="text-lg font-bold text-red-600">-$${fmt(totalOut)}</div></div>
    <div class="card p-3 text-center"><div class="text-xs text-gray-500 mb-1">淨額</div><div class="text-lg font-bold ${totalIn-totalOut>=0?'text-blue-600':'text-red-600'}">$${fmt(totalIn-totalOut)}</div></div>
  </div>
  <div class="card overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="table-header"><tr>
          <th class="text-left p-3">日期</th>
          <th class="text-left p-3">摘要</th>
          <th class="text-right p-3">收入</th>
          <th class="text-right p-3">支出</th>
          <th class="text-right p-3 hidden sm:table-cell">結餘</th>
          <th class="text-center p-3">操作</th>
        </tr></thead>
        <tbody>
          ${data.length === 0 ? '<tr><td colspan="6" class="p-8 text-center text-gray-400">尚無資料</td></tr>' :
            data.map(r => `
            <tr class="border-b border-gray-50">
              <td class="p-3 text-gray-500">${fmtDate(r.date)}</td>
              <td class="p-3">${r.description}<br><span class="text-xs text-gray-400">${r.party||''}</span></td>
              <td class="p-3 text-right amount-positive">${r.income > 0 ? '+$'+fmt(r.income) : ''}</td>
              <td class="p-3 text-right amount-negative">${r.expense > 0 ? '-$'+fmt(r.expense) : ''}</td>
              <td class="p-3 text-right hidden sm:table-cell font-medium">$${fmt(r.balance)}</td>
              <td class="p-3 text-center">
                <button onclick="deleteCashflow(${r.id})" class="text-red-400"><i class="fas fa-trash"></i></button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`
}

async function deleteCashflow(id) {
  if (!confirm('確定刪除？')) return
  await api('DELETE', `/cashflow/${id}`)
  showToast('已刪除'); loadCashflow()
}

function openCashflowModal() {
  showModal(`
  <div class="modal-box">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-bold">新增流水帳</h2>
      <button onclick="closeModal()" class="text-gray-400 text-xl">✕</button>
    </div>
    <div class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-sm text-gray-600 mb-1 block">日期 *</label>
          <input type="date" id="cf-date" class="input-field" value="${today()}">
        </div>
        <div>
          <label class="text-sm text-gray-600 mb-1 block">類別</label>
          <select id="cf-cat" class="input-field">
            ${['收款','付款','費用','進貨','其他'].map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
        </div>
      </div>
      <div>
        <label class="text-sm text-gray-600 mb-1 block">摘要 *</label>
        <input type="text" id="cf-desc" class="input-field" placeholder="如：黃金雞收款">
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-sm text-gray-600 mb-1 block">收入(+)</label>
          <input type="number" id="cf-in" class="input-field" placeholder="0">
        </div>
        <div>
          <label class="text-sm text-gray-600 mb-1 block">支出(-)</label>
          <input type="number" id="cf-out" class="input-field" placeholder="0">
        </div>
      </div>
      <div>
        <label class="text-sm text-gray-600 mb-1 block">往來對象</label>
        <input type="text" id="cf-party" class="input-field" placeholder="客戶/廠商名稱">
      </div>
    </div>
    <div class="flex gap-3 mt-4">
      <button onclick="closeModal()" class="btn-secondary flex-1">取消</button>
      <button onclick="saveCashflow()" class="btn-primary flex-1">儲存</button>
    </div>
  </div>`)
}

async function saveCashflow() {
  const data = {
    date: document.getElementById('cf-date').value,
    description: document.getElementById('cf-desc').value,
    income: parseFloat(document.getElementById('cf-in').value) || 0,
    expense: parseFloat(document.getElementById('cf-out').value) || 0,
    party: document.getElementById('cf-party').value || null,
    category: document.getElementById('cf-cat').value,
  }
  if (!data.date || !data.description) { showToast('日期和摘要必填', 'error'); return }
  const res = await api('POST', '/cashflow', data)
  if (res?.success) { showToast('儲存成功'); closeModal(); loadCashflow() }
  else showToast(res?.error || '失敗', 'error')
}

// === 財務報表 ===
async function loadReports() {
  const el = document.getElementById('reports-content')
  const y = state.year
  const [plData, kpi, customers] = await Promise.all([
    api('GET', `/reports/monthly-pl?year=${y}`),
    api('GET', `/reports/annual-kpi?year=${y}`),
    api('GET', `/reports/customer-analysis?year=${y}`),
  ])
  if (!plData || !kpi) return

  el.innerHTML = `
  <div class="flex items-center gap-2 mb-4">
    <select class="input-field" style="width:90px" onchange="state.year=parseInt(this.value);loadReports()">
      ${[2024,2025,2026,2027].map(yr => `<option value="${yr}" ${yr===y?'selected':''}>${yr}年</option>`).join('')}
    </select>
    <span class="text-base font-bold text-gray-700">${y}年度財務報表</span>
  </div>

  <!-- 年度KPI -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
    <div class="kpi-card" style="background:linear-gradient(135deg,#16a34a,#15803d)">
      <div class="text-xs opacity-80 mb-1">年度營收</div>
      <div class="text-lg font-bold">$${fmt(kpi.revenue)}</div>
      <div class="text-xs opacity-80">目標達成 ${kpi.achievement_rate}%</div>
    </div>
    <div class="kpi-card" style="background:linear-gradient(135deg,#dc2626,#b91c1c)">
      <div class="text-xs opacity-80 mb-1">年度成本</div>
      <div class="text-lg font-bold">$${fmt(kpi.cost)}</div>
      <div class="text-xs opacity-80">費用 $${fmt(kpi.expense)}</div>
    </div>
    <div class="kpi-card" style="background:linear-gradient(135deg,#7c3aed,#6d28d9)">
      <div class="text-xs opacity-80 mb-1">毛利</div>
      <div class="text-lg font-bold">$${fmt(kpi.gross_profit)}</div>
      <div class="text-xs opacity-80">毛利率 ${kpi.gross_margin}%</div>
    </div>
    <div class="kpi-card" style="background:linear-gradient(135deg,#0891b2,#0e7490)">
      <div class="text-xs opacity-80 mb-1">淨利</div>
      <div class="text-lg font-bold">$${fmt(kpi.net_profit)}</div>
      <div class="text-xs opacity-80">淨利率 ${kpi.net_margin}%</div>
    </div>
  </div>

  <!-- 月度損益表 -->
  <div class="card p-4 mb-4">
    <div class="font-bold text-gray-700 mb-3 flex items-center gap-2">
      <i class="fas fa-table text-blue-600"></i> 月度損益表
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="table-header"><tr>
          <th class="text-left p-2">月份</th>
          <th class="text-right p-2">營收</th>
          <th class="text-right p-2 hidden md:table-cell">進貨成本</th>
          <th class="text-right p-2 hidden md:table-cell">毛利</th>
          <th class="text-right p-2 hidden lg:table-cell">毛利率</th>
          <th class="text-right p-2">淨利</th>
        </tr></thead>
        <tbody>
          ${plData.map(r => `
          <tr class="border-b border-gray-50 ${parseFloat(r.month) === state.month ? 'bg-red-50' : ''}">
            <td class="p-2 font-medium">${parseInt(r.month)}月</td>
            <td class="p-2 text-right">${r.revenue > 0 ? '$'+fmt(r.revenue) : '-'}</td>
            <td class="p-2 text-right text-red-600 hidden md:table-cell">${r.cost > 0 ? '$'+fmt(r.cost) : '-'}</td>
            <td class="p-2 text-right hidden md:table-cell">${r.gross_profit > 0 ? '$'+fmt(r.gross_profit) : '-'}</td>
            <td class="p-2 text-right hidden lg:table-cell">${r.gross_margin}%</td>
            <td class="p-2 text-right font-semibold ${r.net_profit >= 0 ? 'text-green-600' : 'text-red-600'}">${r.net_profit !== 0 ? '$'+fmt(r.net_profit) : '-'}</td>
          </tr>`).join('')}
          <tr class="bg-gray-100 font-bold">
            <td class="p-2">全年合計</td>
            <td class="p-2 text-right">$${fmt(plData.reduce((s,r)=>s+r.revenue,0))}</td>
            <td class="p-2 text-right text-red-600 hidden md:table-cell">$${fmt(plData.reduce((s,r)=>s+r.cost,0))}</td>
            <td class="p-2 text-right hidden md:table-cell">$${fmt(plData.reduce((s,r)=>s+r.gross_profit,0))}</td>
            <td class="p-2 hidden lg:table-cell"></td>
            <td class="p-2 text-right text-green-600">$${fmt(plData.reduce((s,r)=>s+r.net_profit,0))}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- 圖表 -->
  <div class="card p-4 mb-4">
    <div class="font-bold text-gray-700 mb-3">月度營收 vs 成本趨勢</div>
    <canvas id="chart-report" height="100"></canvas>
  </div>

  <!-- 客戶分析 -->
  <div class="card p-4">
    <div class="font-bold text-gray-700 mb-3 flex items-center gap-2">
      <i class="fas fa-users text-purple-600"></i> 客戶貢獻分析
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="table-header"><tr>
          <th class="text-left p-2">客戶</th>
          <th class="text-right p-2">銷售額</th>
          <th class="text-right p-2">佔比</th>
          <th class="text-right p-2 hidden md:table-cell">應收款</th>
          <th class="text-center p-2 hidden md:table-cell">收款率</th>
        </tr></thead>
        <tbody>
          ${(customers||[]).map((r, i) => {
            const total = (customers||[]).reduce((s,x)=>s+(x.revenue||0),0)
            const rate = r.revenue > 0 ? (r.paid / r.revenue * 100).toFixed(1) : '0'
            return `<tr class="border-b border-gray-50">
              <td class="p-2 font-medium">${i+1}. ${r.customer_name}</td>
              <td class="p-2 text-right">$${fmt(r.revenue)}</td>
              <td class="p-2 text-right">${total > 0 ? (r.revenue/total*100).toFixed(1) : 0}%</td>
              <td class="p-2 text-right text-amber-600 hidden md:table-cell">$${fmt(r.receivable)}</td>
              <td class="p-2 text-center hidden md:table-cell">${rate}%</td>
            </tr>`
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>`

  // 繪製圖表
  const ctx = document.getElementById('chart-report')?.getContext('2d')
  if (ctx) {
    if (state.charts.report) state.charts.report.destroy()
    const labels = plData.map(r => parseInt(r.month) + '月')
    state.charts.report = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: '營收', data: plData.map(r => r.revenue), backgroundColor: '#86efac', borderRadius: 4 },
          { label: '成本', data: plData.map(r => r.cost), backgroundColor: '#fca5a5', borderRadius: 4 },
          { label: '淨利', data: plData.map(r => r.net_profit), type: 'line', borderColor: '#7c3aed', backgroundColor: 'transparent', pointRadius: 4, tension: 0.4 },
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: ctx => ctx.dataset.label + ': $' + fmt(ctx.raw) } } },
        scales: { y: { ticks: { callback: v => '$' + fmt(v) } } }
      }
    })
  }
}

// === 庫存管理 ===
async function loadInventory() {
  const el = document.getElementById('inventory-content')
  const data = await api('GET', '/purchases?year=2026')
  const salesData = await api('GET', '/sales?year=2026')
  if (!data) return

  // Calculate inventory from purchases - sales
  const invMap = {}
  data.forEach(r => {
    const key = r.product_name || '未知'
    if (!invMap[key]) invMap[key] = { product: key, category: r.category, purchased: 0, sold: 0, cost: r.cost_price || 0 }
    invMap[key].purchased += (r.quantity || 0)
  })
  ;(salesData || []).forEach(r => {
    const key = r.product_name
    if (invMap[key]) invMap[key].sold += (r.quantity || 0)
    else invMap[key] = { product: key, category: r.category, purchased: 0, sold: r.quantity || 0, cost: 0 }
  })

  const inv = Object.values(invMap)
    .map(r => ({ ...r, balance: r.purchased - r.sold }))
    .sort((a, b) => b.purchased - a.purchased)

  el.innerHTML = `
  <div class="mb-4 flex items-center justify-between">
    <h3 class="font-bold text-gray-700">庫存概覽（依進出貨推算）</h3>
    <span class="text-sm text-gray-400">2026年度</span>
  </div>
  <div class="card overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="table-header"><tr>
          <th class="text-left p-3">商品</th>
          <th class="text-center p-3">類別</th>
          <th class="text-right p-3">進貨</th>
          <th class="text-right p-3">出貨</th>
          <th class="text-right p-3">結餘</th>
        </tr></thead>
        <tbody>
          ${inv.map(r => `
          <tr class="border-b border-gray-50">
            <td class="p-3 font-medium">${r.product}</td>
            <td class="p-3 text-center"><span class="${r.category==='生鮮'?'badge-fresh':r.category==='冷凍'?'badge-frozen':'badge-cooked'} px-2 py-0.5 rounded text-xs">${r.category||'其他'}</span></td>
            <td class="p-3 text-right">${fmt(r.purchased)}</td>
            <td class="p-3 text-right">${fmt(r.sold)}</td>
            <td class="p-3 text-right font-semibold ${r.balance < 0 ? 'text-red-600' : 'text-green-600'}">${fmt(r.balance)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`
}

// === 客戶管理 ===
async function loadCustomers() {
  const el = document.getElementById('customers-content')
  const data = await api('GET', '/customers')
  if (!data) return

  el.innerHTML = `
  <div class="flex justify-end mb-4">
    <button onclick="openCustomerModal()" class="btn-primary"><i class="fas fa-plus mr-1"></i>新增客戶</button>
  </div>
  <div class="card overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="table-header"><tr>
          <th class="text-left p-3">代碼</th>
          <th class="text-left p-3">名稱</th>
          <th class="text-left p-3 hidden md:table-cell">電話</th>
          <th class="text-left p-3 hidden md:table-cell">結帳週期</th>
          <th class="text-center p-3">操作</th>
        </tr></thead>
        <tbody>
          ${data.map(r => `
          <tr class="border-b border-gray-50">
            <td class="p-3 text-gray-500">${r.code}</td>
            <td class="p-3 font-medium">${r.name}<br><span class="text-xs text-gray-400">${r.company||''}</span></td>
            <td class="p-3 text-gray-600 hidden md:table-cell">${r.phone||'-'}</td>
            <td class="p-3 hidden md:table-cell"><span class="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs">${r.payment_cycle||'月結'}</span></td>
            <td class="p-3 text-center">
              <button onclick="openCustomerModal(${r.id})" class="text-blue-500 mr-2"><i class="fas fa-edit"></i></button>
              <button onclick="deleteCustomer(${r.id})" class="text-red-400"><i class="fas fa-trash"></i></button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`
}

async function deleteCustomer(id) {
  if (!confirm('確定刪除客戶？')) return
  await api('DELETE', `/customers/${id}`)
  showToast('已刪除'); loadCustomers()
  await preloadData()
}

async function openCustomerModal(id = null) {
  state.editingId = id
  let r = {}
  if (id) r = (await api('GET', `/customers/${id}`)) || {}
  showModal(`
  <div class="modal-box">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-bold">${id ? '編輯' : '新增'}客戶</h2>
      <button onclick="closeModal()" class="text-gray-400 text-xl">✕</button>
    </div>
    <div class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-sm text-gray-600 mb-1 block">代碼 *</label>
          <input type="text" id="c-code" class="input-field" value="${r.code||''}" ${id?'readonly':''}  placeholder="L020">
        </div>
        <div>
          <label class="text-sm text-gray-600 mb-1 block">結帳週期</label>
          <select id="c-cycle" class="input-field">
            ${['現金','雙週結','月結','不定期'].map(c => `<option value="${c}" ${r.payment_cycle===c?'selected':''}>${c}</option>`).join('')}
          </select>
        </div>
      </div>
      <div>
        <label class="text-sm text-gray-600 mb-1 block">客戶名稱 *</label>
        <input type="text" id="c-name" class="input-field" value="${r.name||''}">
      </div>
      <div>
        <label class="text-sm text-gray-600 mb-1 block">公司名稱</label>
        <input type="text" id="c-company" class="input-field" value="${r.company||''}">
      </div>
      <div>
        <label class="text-sm text-gray-600 mb-1 block">聯絡電話</label>
        <input type="tel" id="c-phone" class="input-field" value="${r.phone||''}">
      </div>
      <div>
        <label class="text-sm text-gray-600 mb-1 block">地址</label>
        <input type="text" id="c-addr" class="input-field" value="${r.address||''}">
      </div>
    </div>
    <div class="flex gap-3 mt-4">
      <button onclick="closeModal()" class="btn-secondary flex-1">取消</button>
      <button onclick="saveCustomer()" class="btn-primary flex-1">儲存</button>
    </div>
  </div>`)
}

async function saveCustomer() {
  const data = {
    code: document.getElementById('c-code').value,
    name: document.getElementById('c-name').value,
    company: document.getElementById('c-company').value || null,
    phone: document.getElementById('c-phone').value || null,
    address: document.getElementById('c-addr').value || null,
    payment_cycle: document.getElementById('c-cycle').value,
  }
  if (!data.code || !data.name) { showToast('代碼和名稱必填', 'error'); return }
  const res = state.editingId
    ? await api('PUT', `/customers/${state.editingId}`, data)
    : await api('POST', '/customers', data)
  if (res?.success) {
    showToast('儲存成功'); closeModal(); loadCustomers()
    await preloadData()
  } else showToast(res?.error || '失敗', 'error')
}

// === 廠商管理 ===
async function loadSuppliers() {
  const el = document.getElementById('suppliers-content')
  const data = await api('GET', '/suppliers')
  if (!data) return
  el.innerHTML = `
  <div class="flex justify-end mb-4">
    <button onclick="openSupplierModal()" class="btn-primary"><i class="fas fa-plus mr-1"></i>新增廠商</button>
  </div>
  <div class="card overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="table-header"><tr>
          <th class="text-left p-3">代碼</th>
          <th class="text-left p-3">廠商名稱</th>
          <th class="text-left p-3 hidden md:table-cell">聯絡人</th>
          <th class="text-left p-3 hidden md:table-cell">銀行帳號</th>
          <th class="text-center p-3">操作</th>
        </tr></thead>
        <tbody>
          ${data.map(r => `
          <tr class="border-b border-gray-50">
            <td class="p-3 text-gray-500">${r.code}</td>
            <td class="p-3 font-medium">${r.name}</td>
            <td class="p-3 text-gray-600 hidden md:table-cell">${r.contact||'-'}</td>
            <td class="p-3 text-gray-500 text-xs hidden md:table-cell">${r.bank ? r.bank+' '+r.account : '-'}</td>
            <td class="p-3 text-center">
              <button onclick="openSupplierModal(${r.id})" class="text-blue-500 mr-2"><i class="fas fa-edit"></i></button>
              <button onclick="deleteSupplier(${r.id})" class="text-red-400"><i class="fas fa-trash"></i></button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`
}

async function deleteSupplier(id) {
  if (!confirm('確定刪除廠商？')) return
  await api('DELETE', `/suppliers/${id}`)
  showToast('已刪除'); loadSuppliers(); await preloadData()
}

async function openSupplierModal(id = null) {
  const list = await api('GET', '/suppliers')
  const r = id ? (list?.find(x=>x.id===id) || {}) : {}
  state.editingId = id
  showModal(`
  <div class="modal-box">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-bold">${id ? '編輯' : '新增'}廠商</h2>
      <button onclick="closeModal()" class="text-gray-400 text-xl">✕</button>
    </div>
    <div class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-sm text-gray-600 mb-1 block">代碼 *</label>
          <input type="text" id="su-code" class="input-field" value="${r.code||''}" ${id?'readonly':''} placeholder="K009">
        </div>
        <div>
          <label class="text-sm text-gray-600 mb-1 block">廠商名稱 *</label>
          <input type="text" id="su-name" class="input-field" value="${r.name||''}">
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-sm text-gray-600 mb-1 block">聯絡人</label>
          <input type="text" id="su-contact" class="input-field" value="${r.contact||''}">
        </div>
        <div>
          <label class="text-sm text-gray-600 mb-1 block">電話</label>
          <input type="tel" id="su-phone" class="input-field" value="${r.phone||''}">
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-sm text-gray-600 mb-1 block">銀行代碼</label>
          <input type="text" id="su-bank" class="input-field" value="${r.bank||''}">
        </div>
        <div>
          <label class="text-sm text-gray-600 mb-1 block">帳號</label>
          <input type="text" id="su-account" class="input-field" value="${r.account||''}">
        </div>
      </div>
    </div>
    <div class="flex gap-3 mt-4">
      <button onclick="closeModal()" class="btn-secondary flex-1">取消</button>
      <button onclick="saveSupplier()" class="btn-primary flex-1">儲存</button>
    </div>
  </div>`)
}

async function saveSupplier() {
  const data = {
    code: document.getElementById('su-code').value,
    name: document.getElementById('su-name').value,
    contact: document.getElementById('su-contact').value || null,
    phone: document.getElementById('su-phone').value || null,
    bank: document.getElementById('su-bank').value || null,
    account: document.getElementById('su-account').value || null,
  }
  if (!data.code || !data.name) { showToast('代碼和名稱必填', 'error'); return }
  const res = state.editingId
    ? await api('PUT', `/suppliers/${state.editingId}`, data)
    : await api('POST', '/suppliers', data)
  if (res?.success) { showToast('儲存成功'); closeModal(); loadSuppliers(); await preloadData() }
  else showToast(res?.error || '失敗', 'error')
}

// === 商品管理 ===
async function loadProducts() {
  const el = document.getElementById('products-content')
  const data = await api('GET', '/products')
  if (!data) return
  el.innerHTML = `
  <div class="flex justify-end mb-4">
    <button onclick="openProductModal()" class="btn-primary"><i class="fas fa-plus mr-1"></i>新增商品</button>
  </div>
  <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
    ${['生鮮','冷凍','熟雞'].map(cat => `
    <div class="card p-4">
      <h3 class="font-bold text-gray-700 mb-3 flex items-center gap-2">
        <span class="${cat==='生鮮'?'badge-fresh':cat==='冷凍'?'badge-frozen':'badge-cooked'} px-2 py-0.5 rounded text-xs">${cat}</span>
        ${cat}類（${data.filter(r=>r.category===cat).length}項）
      </h3>
      <div class="space-y-1">
        ${data.filter(r=>r.category===cat).map(r => `
        <div class="flex items-center justify-between py-1 border-b border-gray-50">
          <span class="text-sm">${r.code} - ${r.name} <span class="text-gray-400">(${r.unit})</span></span>
          <div>
            <button onclick="openProductModal(${r.id})" class="text-blue-500 text-xs mr-1"><i class="fas fa-edit"></i></button>
            <button onclick="deleteProduct(${r.id})" class="text-red-400 text-xs"><i class="fas fa-trash"></i></button>
          </div>
        </div>`).join('')}
      </div>
    </div>`).join('')}
  </div>`
}

async function deleteProduct(id) {
  if (!confirm('確定刪除？')) return
  await api('DELETE', `/products/${id}`)
  showToast('已刪除'); loadProducts(); await preloadData()
}

async function openProductModal(id = null) {
  const list = await api('GET', '/products')
  const r = id ? (list?.find(x=>x.id===id) || {}) : {}
  state.editingId = id
  showModal(`
  <div class="modal-box">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-bold">${id ? '編輯' : '新增'}商品</h2>
      <button onclick="closeModal()" class="text-gray-400 text-xl">✕</button>
    </div>
    <div class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-sm text-gray-600 mb-1 block">代碼 *</label>
          <input type="text" id="pr-code" class="input-field" value="${r.code||''}" ${id?'readonly':''} placeholder="C090">
        </div>
        <div>
          <label class="text-sm text-gray-600 mb-1 block">類別 *</label>
          <select id="pr-cat" class="input-field">
            ${['生鮮','冷凍','熟雞'].map(c => `<option value="${c}" ${r.category===c?'selected':''}>${c}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-sm text-gray-600 mb-1 block">商品名稱 *</label>
          <input type="text" id="pr-name" class="input-field" value="${r.name||''}">
        </div>
        <div>
          <label class="text-sm text-gray-600 mb-1 block">單位</label>
          <select id="pr-unit" class="input-field">
            ${['斤','KG','隻','件'].map(u => `<option value="${u}" ${r.unit===u?'selected':''}>${u}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>
    <div class="flex gap-3 mt-4">
      <button onclick="closeModal()" class="btn-secondary flex-1">取消</button>
      <button onclick="saveProduct()" class="btn-primary flex-1">儲存</button>
    </div>
  </div>`)
}

async function saveProduct() {
  const data = {
    code: document.getElementById('pr-code').value,
    name: document.getElementById('pr-name').value,
    category: document.getElementById('pr-cat').value,
    unit: document.getElementById('pr-unit').value,
  }
  if (!data.code || !data.name || !data.category) { showToast('必填欄位未填', 'error'); return }
  const res = state.editingId
    ? await api('PUT', `/products/${state.editingId}`, data)
    : await api('POST', '/products', data)
  if (res?.success) { showToast('儲存成功'); closeModal(); loadProducts(); await preloadData() }
  else showToast(res?.error || '失敗', 'error')
}

// === 報價管理 ===
async function loadPrices() {
  const el = document.getElementById('prices-content')
  const [customerPrices, supplierPrices] = await Promise.all([
    api('GET', '/prices/customer'),
    api('GET', '/prices/supplier'),
  ])

  el.innerHTML = `
  <div class="flex gap-2 mb-4">
    <button onclick="switchPriceTab('customer')" id="ptab-customer" class="tab-btn active">客戶報價</button>
    <button onclick="switchPriceTab('supplier')" id="ptab-supplier" class="tab-btn">廠商報價</button>
    <div class="flex-1"></div>
    <button onclick="openPriceModal('customer')" id="btn-add-price" class="btn-primary text-sm"><i class="fas fa-plus mr-1"></i>新增報價</button>
  </div>
  <div id="price-tab-customer">
    <div class="card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="table-header"><tr>
            <th class="text-left p-3">客戶</th>
            <th class="text-left p-3">商品</th>
            <th class="text-center p-3">類別</th>
            <th class="text-center p-3">單位</th>
            <th class="text-right p-3">報價</th>
            <th class="text-center p-3">操作</th>
          </tr></thead>
          <tbody>
            ${(customerPrices||[]).length === 0 ? '<tr><td colspan="6" class="p-8 text-center text-gray-400">尚無報價資料</td></tr>' :
              (customerPrices||[]).map(r => `
              <tr class="border-b border-gray-50">
                <td class="p-3 font-medium">${r.customer_name}</td>
                <td class="p-3">${r.product_name}</td>
                <td class="p-3 text-center"><span class="${r.category==='生鮮'?'badge-fresh':r.category==='冷凍'?'badge-frozen':'badge-cooked'} px-2 py-0.5 rounded text-xs">${r.category}</span></td>
                <td class="p-3 text-center text-gray-500">${r.unit}</td>
                <td class="p-3 text-right font-bold text-green-600">$${r.price}</td>
                <td class="p-3 text-center">
                  <button onclick="deleteCPrice(${r.id})" class="text-red-400"><i class="fas fa-trash"></i></button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  <div id="price-tab-supplier" class="hidden">
    <div class="card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="table-header"><tr>
            <th class="text-left p-3">廠商</th>
            <th class="text-left p-3">商品</th>
            <th class="text-center p-3">類別</th>
            <th class="text-center p-3">單位</th>
            <th class="text-right p-3">進價</th>
            <th class="text-center p-3">操作</th>
          </tr></thead>
          <tbody>
            ${(supplierPrices||[]).length === 0 ? '<tr><td colspan="6" class="p-8 text-center text-gray-400">尚無報價資料</td></tr>' :
              (supplierPrices||[]).map(r => `
              <tr class="border-b border-gray-50">
                <td class="p-3 font-medium">${r.supplier_name}</td>
                <td class="p-3">${r.product_name}</td>
                <td class="p-3 text-center"><span class="badge-fresh px-2 py-0.5 rounded text-xs">${r.category}</span></td>
                <td class="p-3 text-center text-gray-500">${r.unit}</td>
                <td class="p-3 text-right font-bold text-red-600">$${r.price}</td>
                <td class="p-3 text-center">
                  <button onclick="deleteSPrice(${r.id})" class="text-red-400"><i class="fas fa-trash"></i></button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>`
}

let currentPriceTab = 'customer'
function switchPriceTab(tab) {
  currentPriceTab = tab
  document.getElementById('price-tab-customer').classList.toggle('hidden', tab !== 'customer')
  document.getElementById('price-tab-supplier').classList.toggle('hidden', tab !== 'supplier')
  document.getElementById('ptab-customer').className = 'tab-btn' + (tab === 'customer' ? ' active' : '')
  document.getElementById('ptab-supplier').className = 'tab-btn' + (tab === 'supplier' ? ' active' : '')
  document.getElementById('btn-add-price').onclick = () => openPriceModal(tab)
}

async function deleteCPrice(id) {
  if (!confirm('確定刪除？')) return
  await api('DELETE', `/prices/customer/${id}`)
  showToast('已刪除'); loadPrices()
}

async function deleteSPrice(id) {
  if (!confirm('確定刪除？')) return
  await api('DELETE', `/prices/supplier/${id}`)
  showToast('已刪除'); loadPrices()
}

function openPriceModal(type) {
  const isCustomer = type === 'customer'
  showModal(`
  <div class="modal-box">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-bold">新增${isCustomer ? '客戶' : '廠商'}報價</h2>
      <button onclick="closeModal()" class="text-gray-400 text-xl">✕</button>
    </div>
    <div class="space-y-3">
      <div>
        <label class="text-sm text-gray-600 mb-1 block">${isCustomer ? '客戶' : '廠商'} *</label>
        <select id="price-party" class="input-field">
          <option value="">-- 選擇${isCustomer ? '客戶' : '廠商'} --</option>
          ${(isCustomer ? state.customers : state.suppliers).map(r => `<option value="${r.id}">${r.name}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="text-sm text-gray-600 mb-1 block">商品 *</label>
        <select id="price-product" class="input-field">
          <option value="">-- 選擇商品 --</option>
          ${state.products.map(p => `<option value="${p.id}">${p.name}(${p.category})</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="text-sm text-gray-600 mb-1 block">價格 *</label>
        <input type="number" id="price-val" class="input-field" placeholder="每斤/KG 價格">
      </div>
    </div>
    <div class="flex gap-3 mt-4">
      <button onclick="closeModal()" class="btn-secondary flex-1">取消</button>
      <button onclick="savePrice('${type}')" class="btn-primary flex-1">儲存</button>
    </div>
  </div>`)
}

async function savePrice(type) {
  const partyId = document.getElementById('price-party').value
  const productId = document.getElementById('price-product').value
  const price = document.getElementById('price-val').value
  if (!partyId || !productId || !price) { showToast('必填欄位未填', 'error'); return }
  const body = type === 'customer'
    ? { customer_id: partyId, product_id: productId, price: parseFloat(price) }
    : { supplier_id: partyId, product_id: productId, price: parseFloat(price) }
  const res = await api('POST', `/prices/${type}`, body)
  if (res?.success) { showToast('儲存成功'); closeModal(); loadPrices() }
  else showToast(res?.error || '失敗', 'error')
}

// ============================================================
// === 每週結算單 ===
// ============================================================
let weeklyData = null

// 計算本週週一與週日
function getWeekRange(offsetWeeks = 0) {
  const now = new Date()
  const day = now.getDay() || 7          // 週日→7
  const monday = new Date(now)
  monday.setDate(now.getDate() - day + 1 + offsetWeeks * 7)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt2 = d => d.toISOString().split('T')[0]
  return { start: fmt2(monday), end: fmt2(sunday) }
}

async function loadWeekly() {
  const el = document.getElementById('weekly-content')
  if (!el) return
  const range = getWeekRange(0)  // 本週

  el.innerHTML = `
  <div class="card p-4 mb-4">
    <div class="font-bold text-gray-700 mb-4 flex items-center gap-2">
      <i class="fas fa-receipt text-red-600"></i> 每週結算單產生器
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div>
        <label class="text-sm text-gray-600 mb-1 block">選擇客戶 *</label>
        <select id="ws-customer" class="input-field" onchange="wsAutoFill()">
          <option value="">-- 選擇客戶 --</option>
          ${state.customers.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="text-sm text-gray-600 mb-1 block">起始日期 *</label>
        <input type="date" id="ws-start" value="${range.start}" class="input-field">
      </div>
      <div>
        <label class="text-sm text-gray-600 mb-1 block">結束日期 *</label>
        <input type="date" id="ws-end" value="${range.end}" class="input-field">
      </div>
    </div>
    <!-- 快速週切換 -->
    <div class="flex gap-2 flex-wrap mt-3">
      <button onclick="wsSetWeek(-2)" class="btn-secondary text-sm px-3 py-1.5">前二週</button>
      <button onclick="wsSetWeek(-1)" class="btn-secondary text-sm px-3 py-1.5">上週</button>
      <button onclick="wsSetWeek(0)"  class="btn-primary  text-sm px-3 py-1.5">本週</button>
      <button onclick="wsSetWeek(1)"  class="btn-secondary text-sm px-3 py-1.5">下週</button>
      <div class="flex-1"></div>
      <button onclick="wsLoad()" class="btn-primary px-5">
        <i class="fas fa-search mr-1"></i>查詢
      </button>
    </div>
  </div>

  <div id="ws-result"></div>`
}

function wsSetWeek(offset) {
  const r = getWeekRange(offset)
  document.getElementById('ws-start').value = r.start
  document.getElementById('ws-end').value   = r.end
}

function wsAutoFill() {
  // 根據客戶的 payment_cycle 自動判斷查詢範圍（雙週結等）
  // 這邊維持讓使用者手動選，只是清空結果
  document.getElementById('ws-result').innerHTML = ''
  weeklyData = null
}

async function wsLoad() {
  const customer = document.getElementById('ws-customer').value
  const start    = document.getElementById('ws-start').value
  const end      = document.getElementById('ws-end').value
  if (!customer) { showToast('請選擇客戶', 'error'); return }
  if (!start || !end) { showToast('請輸入日期範圍', 'error'); return }

  const el = document.getElementById('ws-result')
  el.innerHTML = '<div class="text-center py-8 text-gray-400"><i class="fas fa-spinner fa-spin text-2xl"></i></div>'

  const data = await api('GET', `/sales/weekly-statement?customer_name=${encodeURIComponent(customer)}&date_start=${start}&date_end=${end}`)
  if (!data || data.error) {
    el.innerHTML = `<div class="card p-4 text-red-500 text-center">${data?.error || '查詢失敗'}</div>`
    return
  }
  weeklyData = data
  renderStatement(el, data)
}

function renderStatement(container, data) {
  const { customer_name, date_start, date_end, items, summary } = data
  const now = new Date().toLocaleDateString('zh-TW', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' })

  // 依日期分組
  const byDate = {}
  for (const r of items) {
    const d = (r.date || '').split('T')[0]
    if (!byDate[d]) byDate[d] = []
    byDate[d].push(r)
  }
  const dates = Object.keys(byDate).sort()

  const weekdays = ['日','一','二','三','四','五','六']
  const dayRows = dates.map((d, di) => {
    const dayItems = byDate[d]
    const dayTotal = dayItems.reduce((s, r) => s + (r.total_amount || 0), 0)
    const wd = weekdays[new Date(d).getDay()]
    return `
    <tr class="${di % 2 === 0 ? 'statement-row-odd' : 'statement-row-even'}">
      <td class="p-2 pl-3 text-gray-500 text-sm whitespace-nowrap">${d.slice(5)} (${wd})</td>
      <td class="p-2">
        ${dayItems.map(r => `
          <div class="flex flex-wrap items-baseline gap-x-2 text-sm py-0.5">
            <span class="font-medium text-gray-800">${r.product_name}</span>
            ${r.category ? `<span class="statement-badge ${r.category === '生鮮' ? 'badge-fresh' : r.category === '冷凍' ? 'badge-frozen' : 'badge-cooked'}">${r.category}</span>` : ''}
            <span class="text-gray-500">${r.quantity}${r.qty_unit || r.unit || ''}</span>
            ${r.spec ? `<span class="text-gray-400 text-xs">${r.spec}${r.unit || ''}</span>` : ''}
            <span class="text-gray-400 text-xs">×$${fmt(r.unit_price, 0)}</span>
            <span class="font-semibold text-red-600 ml-auto">$${fmt(r.total_amount, 0)}</span>
          </div>`).join('')}
      </td>
      <td class="p-2 pr-3 text-right font-bold text-gray-800 whitespace-nowrap">$${fmt(dayTotal, 0)}</td>
    </tr>`
  }).join('')

  container.innerHTML = `
  <!-- 結算單卡片（capture-area） -->
  <div class="capture-area" id="capture-area">
    <div class="statement-card mb-4" id="statement-card">

      <!-- 標題列 -->
      <div class="statement-header relative overflow-hidden">
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-25deg);font-size:60px;color:rgba(255,255,255,0.06);font-weight:900;white-space:nowrap;pointer-events:none">雞王</div>
        <div class="flex items-start justify-between relative z-10">
          <div>
            <div class="text-xs text-red-200 font-medium mb-0.5">雞王生鮮配送</div>
            <div class="text-2xl font-bold tracking-wide">週結算單</div>
            <div class="text-sm text-red-100 mt-1">
              ${date_start} ～ ${date_end}
            </div>
          </div>
          <div class="text-right">
            <div class="text-xs text-red-200 mb-1">客戶</div>
            <div class="text-xl font-bold">${customer_name}</div>
            <div class="text-xs text-red-200 mt-1">製表：${now}</div>
          </div>
        </div>
        <!-- 統計徽章 -->
        <div class="flex gap-3 mt-3 pt-3 border-t border-red-500 border-opacity-50">
          <div class="flex-1 text-center">
            <div class="text-xs text-red-200">出貨筆數</div>
            <div class="font-bold text-lg">${summary.count}</div>
          </div>
          <div class="flex-1 text-center border-x border-red-500 border-opacity-30">
            <div class="text-xs text-red-200">已收款</div>
            <div class="font-bold text-lg text-green-300">$${fmt(summary.paid, 0)}</div>
          </div>
          <div class="flex-1 text-center">
            <div class="text-xs text-red-200">待收款</div>
            <div class="font-bold text-lg text-yellow-300">$${fmt(summary.unpaid, 0)}</div>
          </div>
        </div>
      </div>

      <!-- 明細表格 -->
      ${items.length === 0 ? `<div class="p-8 text-center text-gray-400"><i class="fas fa-inbox text-3xl mb-2 block"></i>此期間無出貨記錄</div>` : `
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="table-header">
            <tr>
              <th class="p-2 pl-3 text-left text-gray-600 font-semibold whitespace-nowrap">日期</th>
              <th class="p-2 text-left text-gray-600 font-semibold">品項明細</th>
              <th class="p-2 pr-3 text-right text-gray-600 font-semibold whitespace-nowrap">日計</th>
            </tr>
          </thead>
          <tbody>
            ${dayRows}
          </tbody>
        </table>
      </div>

      <!-- 合計列 -->
      <div class="statement-total-row p-4">
        <div class="flex items-center justify-between">
          <div class="font-bold text-gray-800 text-base">
            <i class="fas fa-calculator text-red-600 mr-2"></i>本期合計
          </div>
          <div class="text-2xl font-bold text-red-600">$${fmt(summary.total, 0)}</div>
        </div>
        ${summary.unpaid > 0 ? `
        <div class="mt-2 flex items-center justify-between text-sm">
          <span class="text-gray-500">尚餘待付款</span>
          <span class="font-bold text-orange-600">$${fmt(summary.unpaid, 0)}</span>
        </div>` : `
        <div class="mt-2 flex items-center gap-2 text-green-600 text-sm font-semibold">
          <i class="fas fa-check-circle"></i> 本期款項已全數結清
        </div>`}
      </div>

      <!-- 底部說明 -->
      <div class="px-4 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-400 flex items-center justify-between">
        <span>如有疑問請聯繫雞王業務</span>
        <span class="font-mono">Total: $${fmt(summary.total, 0)}</span>
      </div>
      `}
    </div>
  </div>

  <!-- 操作按鈕（no-print） -->
  <div class="no-print flex flex-wrap gap-3 justify-center mt-4 pb-6">
    <button onclick="wsDownloadPNG()" class="btn-primary flex items-center gap-2 px-6 py-3 text-base shadow-lg">
      <i class="fas fa-download"></i> 下載圖片 (PNG)
    </button>
    <button onclick="window.print()" class="btn-secondary flex items-center gap-2 px-5 py-3 text-base">
      <i class="fas fa-print"></i> 列印
    </button>
    <button onclick="wsShare()" id="ws-share-btn" class="btn-secondary flex items-center gap-2 px-5 py-3 text-base">
      <i class="fas fa-share-alt"></i> 分享
    </button>
    ${summary.unpaid > 0 ? `
    <button onclick="wsMarkPaid()" class="btn-success flex items-center gap-2 px-5 py-3 text-base">
      <i class="fas fa-check"></i> 標記已收款
    </button>` : ''}
  </div>`
}

async function wsDownloadPNG() {
  const el = document.getElementById('statement-card')
  if (!el) { showToast('找不到結算單', 'error'); return }
  showToast('正在產生圖片...', 'success')
  try {
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    })
    const link = document.createElement('a')
    const customer = weeklyData?.customer_name || '客戶'
    const start    = weeklyData?.date_start || ''
    const end      = weeklyData?.date_end || ''
    link.download = `結算單_${customer}_${start}_${end}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
    showToast('圖片已下載！')
  } catch (e) {
    showToast('截圖失敗：' + e.message, 'error')
  }
}

async function wsShare() {
  const el = document.getElementById('statement-card')
  if (!el) return
  try {
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false })
    canvas.toBlob(async (blob) => {
      if (!blob) { showToast('產生圖片失敗', 'error'); return }
      const customer = weeklyData?.customer_name || '客戶'
      const file = new File([blob], `結算單_${customer}.png`, { type: 'image/png' })
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ title: `${customer} 週結算單`, files: [file] })
      } else {
        // Fallback: 直接下載
        wsDownloadPNG()
        showToast('此裝置不支援分享，已改為下載')
      }
    }, 'image/png')
  } catch(e) {
    if (e.name !== 'AbortError') showToast('分享失敗：' + e.message, 'error')
  }
}

async function wsMarkPaid() {
  if (!weeklyData) return
  if (!confirm(`確定要將 ${weeklyData.customer_name} 本期 $${fmt(weeklyData.summary.unpaid, 0)} 標記為已收款？`)) return
  // 找出 items 中待付款的項目，逐一 PATCH
  const unpaidItems = weeklyData.items.filter(r => !['已付款','已付'].includes(r.payment_status))
  let ok = 0
  for (const item of unpaidItems) {
    const res = await api('PATCH', `/sales/${item.id}/pay`, { status: '已付款' })
    if (res?.success) ok++
  }
  showToast(`已更新 ${ok} 筆為已收款`)
  wsLoad()  // 重新查詢更新結果
}

// ============================================================
// === 初始化 ===
async function init() {
  // Set today's date
  document.getElementById('today-date').textContent = new Date().toLocaleDateString('zh-TW')

  // Init DB
  await api('POST', '/init-db')

  // Preload basic data
  await preloadData()

  // Load initial page
  showPage('dashboard')
}

// Start
init()
