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
  search: {
    sales: '', purchases: '', expenses: '', cashflow: '',
    customers: '', suppliers: '', products: '', receivables: '', payables: '',
    inventory: ''
  }
}

// 搜尋工具：高亮關鍵字
function hlSearch(text, kw) {
  if (!kw || !text) return text || ''
  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return String(text).replace(new RegExp(escaped, 'gi'), m => `<mark style="background:#f5c842;color:#000;border-radius:2px;">${m}</mark>`)
}
// 搜尋工具：檢查是否符合關鍵字
function matchSearch(row, fields, kw) {
  if (!kw) return true
  const q = kw.toLowerCase()
  return fields.some(f => String(row[f] || '').toLowerCase().includes(q))
}

// === 工具函數 ===
const fmt = (n, d = 0) => (n || 0).toLocaleString('zh-TW', { minimumFractionDigits: d, maximumFractionDigits: d })
const fmtDate = (d) => d ? d.split('T')[0] : ''
const today = () => new Date().toISOString().split('T')[0]
const monthStr = (m) => ['一','二','三','四','五','六','七','八','九','十','十一','十二'][parseInt(m)-1] + '月'

function showToast(msg, type = 'success') {
  const el = document.getElementById('toast')
  const inner = el.querySelector('div')
  const icon = type === 'success' ? '✓' : '⚠'
  inner.style.background = type === 'success' ? '#005500' : '#aa0000'
  inner.innerHTML = `<span style="font-size: 30px">${icon}</span><span>${msg}</span>`
  el.style.display = 'block'
  clearTimeout(el._t)
  el._t = setTimeout(() => { el.style.display = 'none' }, 2800)
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
  prices: '報價管理', weekly: '每週結算單', ocr: '📷 紙張掃描匯入', more: '更多功能',
}

// 頁面歷史
const _pageHistory = []

function showPage(page) {
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'))
  document.getElementById(`page-${page}`)?.classList.add('active')
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'))
  document.querySelectorAll('.nav-mobile-btn').forEach(el => el.classList.remove('active'))
  document.getElementById(`side-${page}`)?.classList.add('active')
  document.getElementById(`nav-${page}`)?.classList.add('active')
  document.getElementById('page-title').textContent = pageNames[page] || page
  // 記錄頁面歷史（不重複連續相同）
  if (_pageHistory[_pageHistory.length - 1] !== state.currentPage && state.currentPage) {
    _pageHistory.push(state.currentPage)
    if (_pageHistory.length > 20) _pageHistory.shift()
  }
  state.currentPage = page
  // 上一步按鈕：有歷史才顯示
  const backBtn = document.getElementById('back-btn')
  if (backBtn) backBtn.style.display = _pageHistory.length > 0 ? '' : 'none'
  loadPage(page)
}

// 上一步
function goBack() {
  if (_pageHistory.length === 0) return
  const prev = _pageHistory.pop()
  // 直接切換不再推入歷史
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'))
  document.getElementById(`page-${prev}`)?.classList.add('active')
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'))
  document.querySelectorAll('.nav-mobile-btn').forEach(el => el.classList.remove('active'))
  document.getElementById(`side-${prev}`)?.classList.add('active')
  document.getElementById(`nav-${prev}`)?.classList.add('active')
  document.getElementById('page-title').textContent = pageNames[prev] || prev
  state.currentPage = prev
  const backBtn = document.getElementById('back-btn')
  if (backBtn) backBtn.style.display = _pageHistory.length > 0 ? '' : 'none'
  loadPage(prev)
}

// 重製資料確認
function confirmResetData() {
  showModal(`
    <div class="modal-overlay" style="display:flex;align-items:center;justify-content:center;">
    <div style="background:var(--bg-2);border:1px solid var(--border);border-radius:16px;padding:28px 24px;max-width:360px;width:90%;box-shadow:0 8px 40px rgba(0,0,0,.6);">
      <div style="text-align:center;margin-bottom:20px;">
        <div style="font-size:40px;margin-bottom:10px;">⚠️</div>
        <div style="font-size:20px;font-weight:700;color:#f87171;margin-bottom:8px;">確定要重製所有資料？</div>
        <div style="font-size:15px;color:var(--text-dim);line-height:1.6;">
          這將清除：<br>
          <span style="color:#fca5a5;">出貨、進貨、費用、現金流</span><br>
          <span style="color:#fca5a5;">應收、應付、報價記錄</span><br><br>
          <span style="color:var(--green);">保留：客戶、廠商、商品</span><br><br>
          <strong style="color:#f87171;">此操作無法還原！</strong>
        </div>
      </div>
      <div style="display:flex;gap:10px;">
        <button onclick="closeModal()" class="btn-secondary" style="flex:1;padding:10px;">取消</button>
        <button onclick="closeModal();doResetData()" style="flex:1;padding:10px;background:#dc2626;border:none;color:#fff;border-radius:8px;cursor:pointer;font-size:16px;font-weight:700;">
          <i class="fas fa-trash-alt" style="margin-right:5px;"></i>確定清除
        </button>
      </div>
    </div>
    </div>
  `)
}

async function doResetData() {
  showToast('清除中…', 'error')
  const res = await api('POST', '/reset-data')
  if (res?.success) {
    showToast('✓ 資料已全部清除', 'success')
    // 清除前端快取
    window._salesMerged = []
    window._purchasesMerged = []
    window._expensesData = []
    window._cashflowData = []
    window._receivablesData = []
    window._payablesData = []
    window._inventoryData = []
    // 重新載入當前頁面
    setTimeout(() => loadPage(state.currentPage), 500)
  } else {
    showToast('清除失敗：' + (res?.error || '未知錯誤'), 'error')
  }
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
    case 'ocr':    loadOcr(); break
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
  <div style="display:grid; grid-template-columns:repeat(2,1fr); gap:10px; margin-bottom:12px;">
    <div class="kpi-card gold">
      <div class="kpi-label">今日出貨</div>
      <div class="kpi-value">$${fmt(data.today.sales_amount)}</div>
      <div class="kpi-sub">${data.today.sales_count} 筆</div>
    </div>
    <div class="kpi-card green">
      <div class="kpi-label">本月營收</div>
      <div class="kpi-value">$${fmt(data.month.revenue)}</div>
      <div class="kpi-sub">毛利 ${data.month.gross_margin}%</div>
    </div>
    <div class="kpi-card red">
      <div class="kpi-label">應收帳款</div>
      <div class="kpi-value">$${fmt(data.receivable)}</div>
      <div class="kpi-sub">待收款</div>
    </div>
    <div class="kpi-card blue">
      <div class="kpi-label">年度達成</div>
      <div class="kpi-value">${data.year.achievement}%</div>
      <div class="kpi-sub">目標 $${fmt(data.year.target)}</div>
    </div>
  </div>

  <!-- 本月損益 + 趨勢圖 -->
  <div style="display:grid; grid-template-columns:1fr 1.6fr; gap:10px; margin-bottom:12px;">
    <!-- 左：損益明細 -->
    <div class="card" style="padding:10px 12px;">
      <div style="font-size: 22px;font-weight:700;color:var(--text);margin-bottom:8px;">本月損益</div>
      <div style="display:flex;flex-direction:column;gap:0;">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);">
          <span style="font-size: 22px;color:var(--text-2);">營業收入</span>
          <span class="amount-positive" style="font-size: 23px;font-weight:700;">+$${fmt(data.month.revenue)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);">
          <span style="font-size: 22px;color:var(--text-2);">進貨成本</span>
          <span class="amount-negative" style="font-size: 23px;font-weight:700;">-$${fmt(data.month.cost)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);">
          <span style="font-size: 22px;color:var(--text-2);">費用支出</span>
          <span class="amount-negative" style="font-size: 23px;font-weight:700;">-$${fmt(data.month.expense)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0 0;">
          <span style="font-size: 22px;font-weight:700;color:var(--text);">月度淨利</span>
          <span style="font-size: 30px;font-weight:800;" class="${data.month.net >= 0 ? 'amount-positive' : 'amount-negative'}">$${fmt(data.month.net)}</span>
        </div>
      </div>
      <hr style="border:none;border-top:1px solid var(--border);margin:10px 0;">
      <div style="font-size: 22px;font-weight:700;color:var(--text);margin-bottom:6px;">資金狀況</div>
      <div style="display:flex;flex-direction:column;gap:0;">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid var(--border);">
          <span style="font-size: 22px;color:var(--text-2);">應收</span>
          <span style="font-size: 23px;font-weight:700;color:var(--green);">$${fmt(data.receivable)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid var(--border);">
          <span style="font-size: 22px;color:var(--text-2);">待付</span>
          <span style="font-size: 23px;font-weight:700;color:var(--red);">$${fmt(data.payable)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;">
          <span style="font-size: 22px;color:var(--text-2);">缺口</span>
          <span style="font-size: 23px;font-weight:700;color:${data.cash_gap >= 0 ? 'var(--green)' : 'var(--red)'};">$${fmt(data.cash_gap)}</span>
        </div>
      </div>
      <div style="margin-top:8px;">
        <div style="display:flex;justify-content:space-between;font-size: 21px;color:var(--text-dim);margin-bottom:4px;">
          <span>年度達成</span><span>${data.year.achievement}%</span>
        </div>
        <div style="height:8px;background:#cccccc;overflow:hidden;border:1px solid #aaaaaa;">
          <div style="height:100%;background:var(--win-header);width:${Math.min(100,data.year.achievement)}%;transition:width .5s;"></div>
        </div>
      </div>
    </div>

    <!-- 右：趨勢圖 -->
    <div class="card" style="padding:10px 12px;display:flex;flex-direction:column;">
      <div style="font-size: 22px;font-weight:700;color:var(--text);margin-bottom:8px;">月度營收趨勢</div>
      <div style="flex:1; position:relative; min-height:160px;">
        <canvas id="chart-monthly" style="position:absolute;inset:0;width:100%!important;height:100%!important;"></canvas>
      </div>
    </div>
  </div>

  <!-- 最近出貨 -->
  <div class="tbl-wrap">
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px 8px;">
      <span style="font-size: 22px;font-weight:700;color:var(--text);">最近出貨</span>
      <button onclick="showPage('sales')" class="btn-secondary" style="font-size: 22px;">全部 →</button>
    </div>
    <table>
      <thead class="table-header"><tr>
        <th style="text-align:left;">日期</th>
        <th style="text-align:left;">客戶</th>
        <th style="text-align:left;">商品</th>
        <th style="text-align:right;">金額</th>
        <th style="text-align:center;">狀態</th>
      </tr></thead>
      <tbody>
        ${(data.recent_sales || []).map(s => `
        <tr>
          <td class="tc-dim">${fmtDate(s.date)}</td>
          <td class="fc tc-bold" title="${s.customer_name}">${s.customer_name}</td>
          <td class="fc" title="${s.product_name}">${s.product_name}</td>
          <td class="td-num tc-gold">$${fmt(s.total_amount)}</td>
          <td class="td-ctr"><span class="${getStatusClass(s.payment_status)}">${s.payment_status}</span></td>
        </tr>`).join('')}
      </tbody>
    </table>
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
          backgroundColor: values.map((v, i) => i === state.month - 1 ? '#005500' : '#99bb99'),
          borderColor: values.map((v, i) => i === state.month - 1 ? '#003300' : '#669966'),
          borderWidth: 1,
          borderRadius: 0,
          borderSkipped: false,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ' $' + fmt(ctx.raw) }, backgroundColor: '#ffffff', titleColor: '#000000', bodyColor: '#000000', padding: 8, cornerRadius: 0, borderColor: '#808080', borderWidth: 1 }
        },
        scales: {
          y: { ticks: { callback: v => '$' + (v >= 1000 ? (v/1000).toFixed(0)+'K' : v), font: { size: 11 }, color: '#333333' }, grid: { color: '#dddddd' } },
          x: { ticks: { font: { size: 11 }, color: '#333333' }, grid: { display: false } }
        }
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

  // ── 合併：同日期 + 同客戶 + 同品項 → 加總 KG / 數量 / 金額
  // key = date|customer_id|product_id
  const merged = []
  const keyMap = {}
  for (const r of data) {
    const key = `${r.date}|${r.customer_id||r.customer_name}|${r.product_id||r.product_name}`
    if (keyMap[key] !== undefined) {
      const g = merged[keyMap[key]]
      g.total_kg      = parseFloat(((g.total_kg || 0) + parseFloat(r.spec || 0)).toFixed(2))
      g.total_qty    += parseFloat(r.quantity || 0)
      g.total_amount += parseFloat(r.total_amount || 0)
      g.ids.push(r.id)
      // 狀態：若有任何待付則顯示待付
      if (['待付款','未付款'].includes(r.payment_status)) g.payment_status = r.payment_status
    } else {
      keyMap[key] = merged.length
      merged.push({
        ...r,
        total_kg:     parseFloat(r.spec || 0),
        total_qty:    parseFloat(r.quantity || 0),
        total_amount: parseFloat(r.total_amount || 0),
        ids: [r.id],
      })
    }
  }

  const totalAmt = merged.reduce((s, r) => s + r.total_amount, 0)
  const unpaid   = merged.filter(r => ['待付款','未付款'].includes(r.payment_status)).reduce((s, r) => s + r.total_amount, 0)

  el.innerHTML = `
  <!-- 標題列 -->
  <div class="filter-bar">
    <select onchange="state.year=parseInt(this.value);loadSales()">
      ${[2024,2025,2026,2027].map(y => `<option value="${y}" ${y===state.year?'selected':''}>${y}年</option>`).join('')}
    </select>
    <select onchange="state.month=parseInt(this.value);loadSales()">
      ${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${i+1===state.month?'selected':''}>${i+1}月</option>`).join('')}
    </select>
    <input id="sales-search" type="text" placeholder="🔍 搜尋客戶/品項/狀態…" value="${state.search.sales}"
      oninput="state.search.sales=this.value;renderSalesTable()"
      style="flex:1;min-width:120px;max-width:220px;padding:5px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-2);color:var(--text);font-size:16px;">
    <button onclick="openSaleModal()" class="btn-primary" style="margin-left:auto;"><i class="fas fa-plus"></i>新增出貨</button>
  </div>

  <!-- 摘要卡片 -->
  <div class="sum-cards">
    <div class="sum-card">
      <div class="sum-card-label">筆數</div>
      <div class="sum-card-value blue">${merged.length}</div>
    </div>
    <div class="sum-card">
      <div class="sum-card-label">本期總額</div>
      <div class="sum-card-value green">$${fmt(totalAmt)}</div>
    </div>
    <div class="sum-card">
      <div class="sum-card-label">待收款</div>
      <div class="sum-card-value red">$${fmt(unpaid)}</div>
    </div>
  </div>

  <div id="sales-table-wrap"></div>`

  // 儲存 merged 供 renderSalesTable 使用
  window._salesMerged = merged
  renderSalesTable()
}

function renderSalesTable() {
  const wrap = document.getElementById('sales-table-wrap')
  if (!wrap) return
  const kw = state.search.sales
  const merged = (window._salesMerged || []).filter(r =>
    matchSearch(r, ['customer_name','product_name','category','payment_status'], kw)
  )
  const countEl = document.querySelector('#sales-content .sum-card-value.blue')
  if (countEl) countEl.textContent = merged.length

  wrap.innerHTML = `
  <div class="tbl-wrap">
    <table class="ftbl">
      <colgroup>
        <col style="width:88px">
        <col style="width:72px">
        <col style="width:46px">
        <col style="width:72px">
        <col style="width:52px">
        <col style="width:44px">
        <col style="width:54px">
        <col style="width:70px">
        <col style="width:54px">
        <col style="width:56px">
      </colgroup>
      <thead class="table-header"><tr>
        <th>日期</th><th>客戶</th><th class="td-ctr">類別</th><th>品項</th>
        <th class="td-num">KG</th><th class="td-num">數量</th><th class="td-num">單價</th>
        <th class="td-num">金額</th><th class="td-ctr">狀態</th><th class="td-ctr">操作</th>
      </tr></thead>
      <tbody>
        ${merged.length === 0
          ? `<tr><td colspan="10" style="text-align:center;padding:28px;color:var(--text-dim);">${kw ? '找不到符合「'+kw+'」的記錄' : '尚無資料'}</td></tr>`
          : merged.map(r => `
          <tr>
            <td class="fc tc-dim">${fmtDate(r.date)}</td>
            <td class="fc tc-bold" title="${r.customer_name}">${hlSearch(r.customer_name, kw)}</td>
            <td class="td-ctr">${r.category ? `<span class="${r.category==='生鮮'?'badge-fresh':r.category==='冷凍'?'badge-frozen':'badge-cooked'}">${r.category}</span>` : '-'}</td>
            <td class="fc tc-sub" title="${r.product_name}">${hlSearch(r.product_name, kw)}</td>
            <td class="td-num tc-blue">${r.total_kg > 0 ? parseFloat(r.total_kg).toFixed(1) : '-'}</td>
            <td class="td-num">${Math.round(r.total_qty)}</td>
            <td class="td-num">${r.unit_price ? parseFloat(r.unit_price).toFixed(1) : '-'}</td>
            <td class="td-num tc-gold">$${fmt(r.total_amount)}</td>
            <td class="td-ctr">
              <button onclick="cycleSaleStatus(${r.ids[0]},'${r.payment_status}')" class="${getStatusClass(r.payment_status)}" style="cursor:pointer;">${r.payment_status}</button>
            </td>
            <td class="td-ctr">
              ${r.ids.length === 1
                ? `<button onclick="openSaleModal(${r.ids[0]})" class="ic-btn ic-edit"><i class="fas fa-edit"></i></button><button onclick="deleteSale(${r.ids[0]})" class="ic-btn ic-del"><i class="fas fa-trash"></i></button>`
                : `<button onclick="showSaleGroup([${r.ids.join(',')}])" class="ic-btn ic-grp" title="${r.ids.length}筆"><i class="fas fa-layer-group"></i>${r.ids.length}</button>`
              }
            </td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>`
}

// 合併列有多筆時，展開顯示明細讓使用者選擇編輯/刪除哪一筆
function showSaleGroup(ids) {
  const listHTML = ids.map((id, i) => `
    <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--border);">
      <span style="color:var(--text-2); font-size: 28px;">第 ${i+1} 筆 (ID: ${id})</span>
      <div style="display:flex; gap:10px;">
        <button onclick="openSaleModal(${id}); closeModal();" class="btn-secondary" style="font-size: 26px; padding:6px 14px;"><i class="fas fa-edit"></i> 編輯</button>
        <button onclick="deleteSale(${id}); closeModal();" class="btn-danger" style="font-size: 26px; padding:6px 12px;"><i class="fas fa-trash"></i> 刪除</button>
      </div>
    </div>`).join('')
  showModal(`
    <div class="modal-handle"></div>
    <div class="modal-title"><i class="fas fa-layer-group"></i>合併筆數 — 選擇操作</div>
    ${listHTML}
    <div style="margin-top:14px; text-align:right;">
      <button onclick="closeModal()" class="btn-secondary">關閉</button>
    </div>
  `)
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

// ═══════════════════════════════════════════════════════
// 計價公式：
// 生鮮：公斤 ÷ 0.6 × 單價
// 冷凍：KG × 單價
// 熟雞：(生鮮 或 冷凍) + (隻數 × 煮工費)
// ═══════════════════════════════════════════════════════

// 取得商品資訊
function getSaleCalcInfo() {
  const productSel = document.getElementById('s-product')
  if (!productSel) return null

  const opt = productSel.options[productSel.selectedIndex]
  if (!opt || !opt.value) return null

  const category = opt.dataset.category || ''
  const cookType = document.getElementById('s-cook-type')?.value || '生鮮'

  return {
    category, // 生鮮 / 冷凍 / 熟雞
    effectiveCategory: category === '熟雞' ? cookType : category,
    isCooked: category === '熟雞'
  }
}

// 主計算
function calcSaleTotal() {
  const spec  = parseFloat(document.getElementById('s-spec')?.value) || 0    // 規格KG
  const count = parseFloat(document.getElementById('s-qty')?.value) || 0     // 數量（隻）
  const price = parseFloat(document.getElementById('s-price')?.value) || 0   // 單價
  const cook  = parseFloat(document.getElementById('s-cook-fee')?.value) || 0

  const info = getSaleCalcInfo()
  if (!info) return

  const { effectiveCategory, isCooked } = info

  let base = 0
  let formula = ''

  // ───── 計價公式 ─────
  if (effectiveCategory === '生鮮') {
    // 生鮮：KG ÷ 0.6 × 單價（斤計）
    base = (spec / 0.6) * price
    formula = `${spec}KG ÷ 0.6 × $${price}/斤 = $${Math.round(base).toLocaleString()}`
  } else if (effectiveCategory === '冷凍') {
    // 冷凍：KG × 單價/KG × 數量
    base = spec * price * count
    formula = `${spec}KG × $${price}/KG × ${count}隻 = $${Math.round(base).toLocaleString()}`
  } else {
    base = spec * price * count
    formula = `${spec} × $${price} × ${count} = $${Math.round(base).toLocaleString()}`
  }

  // ───── 熟雞加工費 ─────
  let cookTotal = 0
  let cookNote = ''
  if (isCooked && cook > 0 && count > 0) {
    cookTotal = cook * count
    cookNote = ` + 煮工費 $${cook} × ${count}隻 = $${Math.round(cookTotal).toLocaleString()}`
  }

  // ───── 總計 ─────
  const total = base + cookTotal
  const totalEl = document.getElementById('s-total')
  if (totalEl) totalEl.value = total > 0 ? Math.round(total) : ''

  // 計算提示
  const hint = document.getElementById('s-calc-hint')
  if (hint && spec > 0 && price > 0) {
    hint.textContent = formula + cookNote + `  →  合計 $${Math.round(total).toLocaleString()}`
    hint.style.display = 'block'
  } else if (hint) {
    hint.style.display = 'none'
  }
}

async function openSaleModal(id = null) {
  state.editingId = id
  let sale = {}
  if (id) {
    const list = await api('GET', `/sales?year=${state.year}`)
    sale = list?.find(r => r.id === id) || {}
  }

  // 取得已選商品的 category（編輯時）
  const editCategory = sale.category || ''
  const isCooked = editCategory === '熟雞'
  // 從 note 中解析煮工費（格式: "煮工費:50" 或 sale.cook_fee）
  const cookFeeMatch = (sale.note || '').match(/煮工費[:：](\d+)/)
  const cookFee = cookFeeMatch ? cookFeeMatch[1] : ''

  showModal(`
  <div class="modal-box">
    <div class="modal-handle"></div>
    <div class="modal-title">
      <i class="fas fa-${id ? 'edit' : 'plus-circle'}"></i>
      ${id ? '編輯' : '新增'}出貨記錄
      <button class="btn-secondary" style="margin-left:auto;font-size: 24px;padding:2px 8px;" onclick="closeModal()">✕</button>
    </div>

    <!-- 日期 + 付款狀態 -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;padding:0 14px;">
      <div>
        <label>日期 *</label>
        <input type="date" id="s-date" class="input-field" value="${sale.date ? fmtDate(sale.date) : today()}">
      </div>
      <div>
        <label>付款狀態 *</label>
        <select id="s-status" class="input-field">
          ${['待付款','已付款','未付款'].map(s => `<option value="${s}" ${sale.payment_status===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
    </div>

    <!-- 客戶 -->
    <div style="margin-bottom:10px;">
      <label>客戶 *</label>
      <select id="s-customer" class="input-field" onchange="onCustomerChange()">
        <option value="">-- 選擇客戶 --</option>
        ${state.customers.map(c => `<option value="${c.id}" data-name="${c.name}" ${sale.customer_id==c.id?'selected':''}>${c.name}</option>`).join('')}
      </select>
    </div>

    <!-- 品項 + 類別 -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;padding:0 14px;">
      <div>
        <label>品項 *</label>
        <select id="s-product" class="input-field" onchange="onProductChange()">
          <option value="">-- 選擇商品 --</option>
          ${state.products.map(p => `<option value="${p.id}" data-name="${p.name}" data-unit="${p.unit}" data-category="${p.category}" ${sale.product_id==p.id?'selected':''}>${p.name}（${p.category}）</option>`).join('')}
        </select>
      </div>
      <div>
        <label>類別 *</label>
        <input type="text" id="s-category-display" class="input-field" readonly
               style="background:var(--bg-2);color:var(--text-dim);"
               value="${sale.category||''}" placeholder="選商品後自動帶入">
      </div>
    </div>

    <!-- 規格KG + 數量 -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;padding:0 14px;">
      <div>
        <label>規格(KG) ─ 每隻重</label>
        <input type="number" id="s-spec" class="input-field" value="${sale.spec||''}"
               step="0.1" min="0" max="999.9" placeholder="XXX.X" oninput="calcSaleTotal()"
               style="text-align:right;">
      </div>
      <div>
        <label id="s-qty-label">數量（隻/件）*</label>
        <div style="display:flex;gap:6px;align-items:center;">
          <input type="number" id="s-qty" class="input-field" value="${sale.quantity||''}"
                 step="1" min="0" max="999" placeholder="XXX" oninput="calcSaleTotal()"
                 style="text-align:right;flex:1;">
          <select id="s-qty-unit" class="input-field" style="width:60px;padding:9px 4px;flex-shrink:0;">
            <option value="隻" ${(sale.qty_unit||'隻')==='隻'?'selected':''}>隻</option>
            <option value="件" ${(sale.qty_unit||'隻')==='件'?'selected':''}>件</option>
          </select>
        </div>
      </div>
    </div>

    <!-- 熟雞專用：底層類型 -->
    <div id="s-cook-section" style="display:${isCooked?'grid':'none'};grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;
         background:rgba(212,163,75,.06);border:1px solid rgba(212,163,75,.15);border-radius:8px;padding:10px;">
      <div>
        <label style="color:var(--orange);">熟雞底層類型 *</label>
        <select id="s-cook-type" class="input-field" onchange="calcSaleTotal()">
          <option value="生鮮" ${(sale.unit||'')!=='KG'?'selected':''}>生鮮雞（KG÷0.6×單價）</option>
          <option value="冷凍" ${(sale.unit||'')==='KG'?'selected':''}>冷凍雞（KG×單價×數量）</option>
        </select>
      </div>
      <div>
        <label style="color:var(--orange);">煮工費（元/隻）</label>
        <input type="number" id="s-cook-fee" class="input-field" value="${cookFee}" placeholder="如 50" oninput="calcSaleTotal()">
      </div>
    </div>

    <!-- 單價 -->
    <div style="margin-bottom:10px;">
      <label id="s-price-label">單價 *</label>
      <input type="number" id="s-price" class="input-field" value="${sale.unit_price||''}"
             step="0.1" min="0" max="999.9" placeholder="XXX.X" oninput="calcSaleTotal()"
             style="text-align:right;">
    </div>

    <!-- 計算公式提示 -->
    <div id="s-calc-hint" style="display:none;font-size: 26px;color:var(--orange);
         background:rgba(212,163,75,.06);border:1px solid rgba(212,163,75,.15);
         border-radius:6px;padding:7px 10px;margin-bottom:10px;letter-spacing:.3px;"></div>

    <!-- 合計 + 差額 -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;padding:0 14px;">
      <div>
        <label>合計金額（自動計算）</label>
        <input type="number" id="s-total" class="input-field" value="${sale.total_amount||''}"
               style="background:var(--bg-2);font-weight:700;font-size: 30px;color:var(--orange);text-align:right;"
               placeholder="XXXXXX" readonly>
      </div>
      <div>
        <label>差額（手動調整）</label>
        <input type="number" id="s-diff" class="input-field" value="${sale.diff_amount||''}"
               placeholder="正負皆可" oninput="">
      </div>
    </div>

    <!-- 備註 -->
    <div style="margin-bottom:14px;">
      <label>備註</label>
      <input type="text" id="s-note" class="input-field" value="${sale.note||''}" placeholder="選填">
    </div>

    <div style="display:flex;gap:10px;">
      <button onclick="closeModal()" class="btn-secondary" style="flex:1;">取消</button>
      <button onclick="saveSale()" class="btn-primary" style="flex:1;">
        <i class="fas fa-check"></i> 儲存
      </button>
    </div>
  </div>`)

  // 初始化：若有既有商品，觸發一次計算
  if (sale.product_id) setTimeout(() => calcSaleTotal(), 50)
}

function onCustomerChange() {
  // 未來可自動帶入客戶報價
}

function onProductChange() {
  const sel = document.getElementById('s-product')
  const opt = sel.options[sel.selectedIndex]
  if (!opt || !opt.value) return

  const category = opt.dataset.category || ''

  // 更新類別顯示欄
  const catDisplay = document.getElementById('s-category-display')
  if (catDisplay) catDisplay.value = category

  // 顯示/隱藏熟雞區塊
  const cookSection = document.getElementById('s-cook-section')
  if (cookSection) cookSection.style.display = category === '熟雞' ? 'grid' : 'none'

  // 更新標籤提示
  updateSaleLabels(category)
  calcSaleTotal()
}

function setSelectValue(sel, val) {
  for (let i = 0; i < sel.options.length; i++) {
    if (sel.options[i].value === val) { sel.selectedIndex = i; return }
  }
}

function updateSaleLabels(category) {
  const qtyLabel   = document.getElementById('s-qty-label')
  const priceLabel = document.getElementById('s-price-label')
  if (!qtyLabel || !priceLabel) return

  if (category === '生鮮') {
    qtyLabel.textContent   = '數量（隻/件）*'
    priceLabel.textContent = '單價（元/斤）*'
  } else if (category === '冷凍') {
    qtyLabel.textContent   = '數量（隻/件）*'
    priceLabel.textContent = '單價（元/KG）*'
  } else if (category === '熟雞') {
    qtyLabel.textContent   = '數量（隻）*'
    priceLabel.textContent = '原料單價 *'
  } else {
    qtyLabel.textContent   = '數量 *'
    priceLabel.textContent = '單價 *'
  }
}

async function saveSale() {
  const customerSel = document.getElementById('s-customer')
  const productSel  = document.getElementById('s-product')
  const productOpt  = productSel.options[productSel.selectedIndex]
  const category    = productOpt?.dataset?.category || null
  const cookFee     = parseFloat(document.getElementById('s-cook-fee')?.value) || 0
  const cookType    = document.getElementById('s-cook-type')?.value || ''

  // 組建備註（含煮工費紀錄）
  let note = document.getElementById('s-note').value || ''
  if (category === '熟雞' && cookFee > 0) {
    note = note ? `${note}；煮工費：${cookFee}` : `煮工費：${cookFee}`
  }

  const data = {
    date:           document.getElementById('s-date').value,
    customer_id:    customerSel.value || null,
    customer_name:  customerSel.options[customerSel.selectedIndex]?.dataset?.name || customerSel.value,
    product_id:     productSel.value || null,
    product_name:   productOpt?.dataset?.name || '',
    category,
    unit:           (category === '冷凍' || cookType === '冷凍') ? 'KG' : '斤',
    spec:           parseFloat(document.getElementById('s-spec').value) || null,
    quantity:       parseFloat(document.getElementById('s-qty').value),
    qty_unit:       document.getElementById('s-qty-unit')?.value || '隻',
    unit_price:     parseFloat(document.getElementById('s-price').value),
    total_amount:   parseFloat(document.getElementById('s-total').value) || null,
    diff_amount:    parseFloat(document.getElementById('s-diff')?.value) || null,
    payment_status: document.getElementById('s-status').value,
    note,
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

  // ── 合併：同日期 + 同廠商 + 同品項 → 加總
  const merged = []
  const keyMap = {}
  for (const r of data) {
    const key = `${r.date}|${r.supplier_id||r.supplier_name}|${r.product_id||r.product_name}`
    if (keyMap[key] !== undefined) {
      const g = merged[keyMap[key]]
      g.total_kg      = parseFloat(((g.total_kg || 0) + parseFloat(r.spec || 0)).toFixed(2))
      g.total_qty    += parseFloat(r.quantity || 0)
      g.total_amount += parseFloat(r.total_amount || 0)
      g.ids.push(r.id)
      if (r.payment_status === '未付') g.payment_status = '未付'
    } else {
      keyMap[key] = merged.length
      merged.push({
        ...r,
        total_kg:     parseFloat(r.spec || 0),
        total_qty:    parseFloat(r.quantity || 0),
        total_amount: parseFloat(r.total_amount || 0),
        ids: [r.id],
      })
    }
  }

  const totalAmt = merged.reduce((s, r) => s + r.total_amount, 0)
  const unpaid   = merged.filter(r => r.payment_status === '未付').reduce((s, r) => s + r.total_amount, 0)

  el.innerHTML = `
  <div class="filter-bar">
    <select onchange="state.year=parseInt(this.value);loadPurchases()">
      ${[2024,2025,2026,2027].map(y => `<option value="${y}" ${y===state.year?'selected':''}>${y}年</option>`).join('')}
    </select>
    <select onchange="state.month=parseInt(this.value);loadPurchases()">
      ${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${i+1===state.month?'selected':''}>${i+1}月</option>`).join('')}
    </select>
    <input id="purchases-search" type="text" placeholder="🔍 搜尋廠商/品項…" value="${state.search.purchases}"
      oninput="state.search.purchases=this.value;renderPurchasesTable()"
      style="flex:1;min-width:120px;max-width:220px;padding:5px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-2);color:var(--text);font-size:16px;">
    <button onclick="openPurchaseModal()" class="btn-primary" style="margin-left:auto;"><i class="fas fa-plus"></i>新增進貨</button>
  </div>

  <div class="sum-cards">
    <div class="sum-card">
      <div class="sum-card-label">筆數</div>
      <div class="sum-card-value blue">${merged.length}</div>
    </div>
    <div class="sum-card">
      <div class="sum-card-label">本期總額</div>
      <div class="sum-card-value red">$${fmt(totalAmt)}</div>
    </div>
    <div class="sum-card">
      <div class="sum-card-label">待付款</div>
      <div class="sum-card-value">$${fmt(unpaid)}</div>
    </div>
  </div>

  <div id="purchases-table-wrap"></div>`

  window._purchasesMerged = merged
  renderPurchasesTable()
}

function renderPurchasesTable() {
  const wrap = document.getElementById('purchases-table-wrap')
  if (!wrap) return
  const kw = state.search.purchases
  const merged = (window._purchasesMerged || []).filter(r =>
    matchSearch(r, ['supplier_name','product_name','payment_status'], kw)
  )
  const countEl = document.querySelector('#purchases-content .sum-card-value.blue')
  if (countEl) countEl.textContent = merged.length

  wrap.innerHTML = `
  <div class="tbl-wrap">
    <table class="ftbl">
      <colgroup>
        <col style="width:88px"><col style="width:72px"><col style="width:72px">
        <col style="width:52px"><col style="width:44px"><col style="width:54px">
        <col style="width:70px"><col style="width:54px"><col style="width:56px">
      </colgroup>
      <thead class="table-header"><tr>
        <th>日期</th><th>廠商</th><th>品項</th>
        <th class="td-num">KG</th><th class="td-num">數量</th><th class="td-num">單價</th>
        <th class="td-num">金額</th><th class="td-ctr">狀態</th><th class="td-ctr">操作</th>
      </tr></thead>
      <tbody>
        ${merged.length === 0
          ? `<tr><td colspan="9" style="text-align:center;padding:28px;color:var(--text-dim);">${kw ? '找不到「'+kw+'」' : '尚無資料'}</td></tr>`
          : merged.map(r => `
          <tr>
            <td class="fc tc-dim">${fmtDate(r.date)}</td>
            <td class="fc tc-bold" title="${r.supplier_name||''}">${hlSearch(r.supplier_name||'-', kw)}</td>
            <td class="fc tc-sub" title="${r.product_name||'-'}">${hlSearch(r.product_name||'-', kw)}</td>
            <td class="td-num tc-blue">${r.total_kg > 0 ? parseFloat(r.total_kg).toFixed(1) : '-'}</td>
            <td class="td-num">${Math.round(r.total_qty)}</td>
            <td class="td-num">${r.cost_price ? parseFloat(r.cost_price).toFixed(1) : '-'}</td>
            <td class="td-num tc-gold">$${fmt(r.total_amount)}</td>
            <td class="td-ctr">
              <button onclick="cyclePurchaseStatus(${r.ids[0]},'${r.payment_status}')" class="${getStatusClass(r.payment_status)}" style="cursor:pointer;">${r.payment_status}</button>
            </td>
            <td class="td-ctr">
              ${r.ids.length === 1
                ? `<button onclick="openPurchaseModal(${r.ids[0]})" class="ic-btn ic-edit"><i class="fas fa-edit"></i></button><button onclick="deletePurchase(${r.ids[0]})" class="ic-btn ic-del"><i class="fas fa-trash"></i></button>`
                : `<button onclick="showPurchaseGroup([${r.ids.join(',')}])" class="ic-btn ic-grp" title="${r.ids.length}筆"><i class="fas fa-layer-group"></i>${r.ids.length}</button>`
              }
            </td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>`
}

function showPurchaseGroup(ids) {
  const listHTML = ids.map((id, i) => `
    <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--border);">
      <span style="color:var(--text-2); font-size: 28px;">第 ${i+1} 筆 (ID: ${id})</span>
      <div style="display:flex; gap:10px;">
        <button onclick="openPurchaseModal(${id}); closeModal();" class="btn-secondary" style="font-size: 26px; padding:6px 14px;"><i class="fas fa-edit"></i> 編輯</button>
        <button onclick="deletePurchase(${id}); closeModal();" class="btn-danger" style="font-size: 26px; padding:6px 12px;"><i class="fas fa-trash"></i> 刪除</button>
      </div>
    </div>`).join('')
  showModal(`
    <div class="modal-handle"></div>
    <div class="modal-title"><i class="fas fa-layer-group"></i>合併筆數 — 選擇操作</div>
    ${listHTML}
    <div style="margin-top:14px; text-align:right;">
      <button onclick="closeModal()" class="btn-secondary">關閉</button>
    </div>
  `)
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
    const list = await api('GET', `/purchases?year=${state.year}`)
    r = list?.find(x => x.id === id) || {}
  }
  const editCategory = r.category || ''
  const isCooked = editCategory === '熟雞'
  const cookFeeMatch = (r.note || '').match(/煮工費[:：](\d+)/)
  const cookFee = cookFeeMatch ? cookFeeMatch[1] : ''

  showModal(`
  <div class="modal-box">
    <div class="modal-handle"></div>
    <div class="modal-title">
      <i class="fas fa-${id ? 'edit' : 'plus-circle'}"></i>
      ${id ? '編輯' : '新增'}進貨記錄
      <button class="btn-secondary" style="margin-left:auto;font-size: 24px;padding:2px 8px;" onclick="closeModal()">✕</button>
    </div>

    <!-- 日期 + 付款狀態 -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;padding:0 14px;">
      <div>
        <label>日期 *</label>
        <input type="date" id="p-date" class="input-field" value="${r.date ? fmtDate(r.date) : today()}">
      </div>
      <div>
        <label>付款狀態 *</label>
        <select id="p-status" class="input-field">
          ${['未付','已付'].map(s => `<option value="${s}" ${r.payment_status===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
    </div>

    <!-- 廠商 -->
    <div style="margin-bottom:10px;">
      <label>廠商</label>
      <select id="p-supplier" class="input-field">
        <option value="">-- 選擇廠商 --</option>
        ${state.suppliers.map(s => `<option value="${s.id}" data-name="${s.name}" ${r.supplier_id==s.id?'selected':''}>${s.name}</option>`).join('')}
      </select>
    </div>

    <!-- 品項 + 類別 -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;padding:0 14px;">
      <div>
        <label>品項</label>
        <select id="p-product" class="input-field" onchange="onPurchaseProductChange()">
          <option value="">-- 選擇商品 --</option>
          ${state.products.map(p => `<option value="${p.id}" data-name="${p.name}" data-unit="${p.unit}" data-category="${p.category}" ${r.product_id==p.id?'selected':''}>${p.name}（${p.category}）</option>`).join('')}
        </select>
      </div>
      <div>
        <label>類別</label>
        <input type="text" id="p-category-display" class="input-field" readonly
               style="background:var(--bg-2);color:var(--text-dim);"
               value="${r.category||''}" placeholder="選商品後自動帶入">
      </div>
    </div>

    <!-- 熟雞專用 -->
    <div id="p-cook-section" style="display:${isCooked?'grid':'none'};grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;
         background:rgba(212,163,75,.06);border:1px solid rgba(212,163,75,.15);border-radius:8px;padding:10px;">
      <div>
        <label style="color:var(--orange);">熟雞底層類型 *</label>
        <select id="p-cook-type" class="input-field" onchange="calcPurchaseTotal()">
          <option value="生鮮" ${(r.unit||'')!=='KG'?'selected':''}>生鮮雞（KG÷0.6×單價）</option>
          <option value="冷凍" ${(r.unit||'')==='KG'?'selected':''}>冷凍雞（KG×單價×數量）</option>
        </select>
      </div>
      <div>
        <label style="color:var(--orange);">煮工費（元/隻）</label>
        <input type="number" id="p-cook-fee" class="input-field" value="${cookFee}" placeholder="如 50" oninput="calcPurchaseTotal()">
      </div>
    </div>

    <!-- 規格 + 數量 -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;padding:0 14px;">
      <div>
        <label>規格(KG) ─ 每隻重</label>
        <input type="number" id="p-spec" class="input-field" value="${r.spec||''}"
               step="0.1" min="0" max="999.9" placeholder="XXX.X" oninput="calcPurchaseTotal()"
               style="text-align:right;">
      </div>
      <div>
        <label id="p-qty-label">數量（隻/件）</label>
        <div style="display:flex;gap:6px;align-items:center;">
          <input type="number" id="p-qty" class="input-field" value="${r.quantity||''}"
                 step="1" min="0" max="999" placeholder="XXX" oninput="calcPurchaseTotal()"
                 style="text-align:right;flex:1;">
          <select id="p-qty-unit" class="input-field" style="width:60px;padding:9px 4px;flex-shrink:0;">
            <option value="隻" ${(r.qty_unit||'隻')==='隻'?'selected':''}>隻</option>
            <option value="件" ${(r.qty_unit||'隻')==='件'?'selected':''}>件</option>
          </select>
        </div>
      </div>
    </div>

    <!-- 單價 -->
    <div style="margin-bottom:10px;">
      <label id="p-cost-label">進價 *</label>
      <input type="number" id="p-cost" class="input-field" value="${r.cost_price||''}"
             step="0.1" min="0" max="999.9" placeholder="XXX.X" oninput="calcPurchaseTotal()"
             style="text-align:right;">
    </div>

    <!-- 計算公式提示 -->
    <div id="p-calc-hint" style="display:none;font-size: 26px;color:var(--orange);
         background:rgba(212,163,75,.06);border:1px solid rgba(212,163,75,.15);
         border-radius:6px;padding:7px 10px;margin-bottom:10px;letter-spacing:.3px;"></div>

    <!-- 合計 + 差額 -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;padding:0 14px;">
      <div>
        <label>總金額（自動計算）</label>
        <input type="number" id="p-total" class="input-field" value="${r.total_amount||''}"
               style="background:var(--bg-2);font-weight:700;font-size: 30px;color:var(--orange);text-align:right;"
               placeholder="XXXXXX" readonly>
      </div>
      <div>
        <label>差額（手動調整）</label>
        <input type="number" id="p-diff" class="input-field" value="${r.diff_amount||''}"
               placeholder="正負皆可">
      </div>
    </div>

    <!-- 備註 -->
    <div style="margin-bottom:14px;">
      <label>備註</label>
      <input type="text" id="p-note" class="input-field" value="${r.note||''}" placeholder="選填">
    </div>

    <div style="display:flex;gap:10px;">
      <button onclick="closeModal()" class="btn-secondary" style="flex:1;">取消</button>
      <button onclick="savePurchase()" class="btn-primary" style="flex:1;">
        <i class="fas fa-check"></i> 儲存
      </button>
    </div>
  </div>`)

  if (r.product_id) setTimeout(() => calcPurchaseTotal(), 50)
}
function onPurchaseProductChange() {
  const sel = document.getElementById('p-product')
  const opt = sel?.options[sel.selectedIndex]
  if (!opt || !opt.value) return
  const category = opt.dataset.category || ''

  // 更新類別顯示欄
  const catDisplay = document.getElementById('p-category-display')
  if (catDisplay) catDisplay.value = category

  // 顯示/隱藏熟雞區塊
  const cookSection = document.getElementById('p-cook-section')
  if (cookSection) cookSection.style.display = category === '熟雞' ? 'grid' : 'none'

  // 更新標籤
  const qtyLabel  = document.getElementById('p-qty-label')
  const costLabel = document.getElementById('p-cost-label')
  if (category === '生鮮') {
    if (qtyLabel)  qtyLabel.textContent  = '數量（隻/件）'
    if (costLabel) costLabel.textContent = '進價（元/斤）*'
  } else if (category === '冷凍') {
    if (qtyLabel)  qtyLabel.textContent  = '數量（隻/件）'
    if (costLabel) costLabel.textContent = '進價（元/KG）*'
  } else {
    if (qtyLabel)  qtyLabel.textContent  = '數量（隻/件）'
    if (costLabel) costLabel.textContent = '進價 *'
  }
  calcPurchaseTotal()
}

function calcPurchaseTotal() {
  const spec  = parseFloat(document.getElementById('p-spec')?.value)  || 0
  const count = parseFloat(document.getElementById('p-qty')?.value)   || 0
  const cost  = parseFloat(document.getElementById('p-cost')?.value)  || 0
  const cook  = parseFloat(document.getElementById('p-cook-fee')?.value) || 0
  const productSel = document.getElementById('p-product')
  const category = productSel?.options[productSel.selectedIndex]?.dataset?.category || ''

  // 熟雞：用 cook-type 的有效類別
  const cookType = document.getElementById('p-cook-type')?.value || ''
  const effectiveCat = category === '熟雞' ? cookType : category
  const isCooked = category === '熟雞'

  let base = 0
  let formula = ''
  if (effectiveCat === '生鮮') {
    base = (spec / 0.6) * cost
    formula = `${spec}KG ÷ 0.6 × $${cost}/斤 = $${Math.round(base).toLocaleString()}`
  } else if (effectiveCat === '冷凍') {
    base = spec * cost * count
    formula = `${spec}KG × $${cost}/KG × ${count}隻 = $${Math.round(base).toLocaleString()}`
  } else {
    base = spec * cost * count
    formula = `${spec} × $${cost} × ${count} = $${Math.round(base).toLocaleString()}`
  }

  let cookTotal = 0
  let cookNote = ''
  if (isCooked && cook > 0 && count > 0) {
    cookTotal = cook * count
    cookNote = ` + 煮工費 $${cook} × ${count}隻 = $${Math.round(cookTotal).toLocaleString()}`
  }

  const total = base + cookTotal
  const el = document.getElementById('p-total')
  if (el) el.value = total > 0 ? Math.round(total) : ''

  const hint = document.getElementById('p-calc-hint')
  if (hint && spec > 0 && cost > 0) {
    hint.textContent = formula + cookNote + `  →  合計 $${Math.round(total).toLocaleString()}`
    hint.style.display = 'block'
  } else if (hint) {
    hint.style.display = 'none'
  }
}

async function savePurchase() {
  const supplierSel = document.getElementById('p-supplier')
  const productSel = document.getElementById('p-product')
  const category = productSel.options[productSel.selectedIndex]?.dataset?.category || null
  const cookFee = parseFloat(document.getElementById('p-cook-fee')?.value) || 0
  const cookType = document.getElementById('p-cook-type')?.value || ''

  let note = document.getElementById('p-note').value || ''
  if (category === '熟雞' && cookFee > 0) {
    note = note ? `${note}；煮工費：${cookFee}` : `煮工費：${cookFee}`
  }

  const data = {
    date: document.getElementById('p-date').value,
    supplier_id: supplierSel.value || null,
    supplier_name: supplierSel.options[supplierSel.selectedIndex]?.dataset?.name || null,
    product_id: productSel.value || null,
    product_name: productSel.options[productSel.selectedIndex]?.dataset?.name || null,
    category,
    unit: (category === '冷凍' || cookType === '冷凍') ? 'KG' : '斤',
    spec: parseFloat(document.getElementById('p-spec').value) || null,
    quantity: parseFloat(document.getElementById('p-qty').value),
    qty_unit: document.getElementById('p-qty-unit')?.value || '隻',
    cost_price: parseFloat(document.getElementById('p-cost').value) || null,
    total_amount: parseFloat(document.getElementById('p-total').value) || null,
    diff_amount: parseFloat(document.getElementById('p-diff')?.value) || null,
    payment_status: document.getElementById('p-status').value,
    note,
  }
  if (!data.date) { showToast('日期必填', 'error'); return }
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
  <div class="flex items-center gap-2 mb-4 flex-wrap">
    <select class="input-field" style="width:90px" onchange="state.year=parseInt(this.value);loadReceivables()">
      ${[2024,2025,2026,2027].map(yr => `<option value="${yr}" ${yr===y?'selected':''}>${yr}年</option>`).join('')}
    </select>
    <input id="receivables-search" type="text" placeholder="🔍 搜尋客戶名稱…" value="${state.search.receivables}"
      oninput="state.search.receivables=this.value;renderReceivablesTable()"
      style="flex:1;min-width:120px;max-width:200px;padding:5px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-2);color:var(--text);font-size:16px;">
    <span class="text-sm text-gray-500">客戶應收帳款彙總</span>
  </div>
  <div id="receivables-table-wrap"></div>`

  window._receivablesData = data
  renderReceivablesTable()
}

function renderReceivablesTable() {
  const wrap = document.getElementById('receivables-table-wrap')
  if (!wrap) return
  const kw = state.search.receivables
  const data = (window._receivablesData || []).filter(r =>
    matchSearch(r, ['customer_name'], kw)
  )
  wrap.innerHTML = `
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
              <td class="p-3 font-medium">${hlSearch(r.customer_name,kw)}</td>
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
  <div class="flex items-center gap-2 mb-4 flex-wrap">
    <select class="input-field" style="width:90px" onchange="state.year=parseInt(this.value);loadPayables()">
      ${[2024,2025,2026,2027].map(yr => `<option value="${yr}" ${yr===y?'selected':''}>${yr}年</option>`).join('')}
    </select>
    <input id="payables-search" type="text" placeholder="🔍 搜尋廠商名稱…" value="${state.search.payables}"
      oninput="state.search.payables=this.value;renderPayablesTable()"
      style="flex:1;min-width:120px;max-width:200px;padding:5px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-2);color:var(--text);font-size:16px;">
    <span class="text-sm text-gray-500">廠商應付帳款彙總</span>
  </div>
  <div id="payables-table-wrap"></div>`

  window._payablesData = data
  renderPayablesTable()
}

function renderPayablesTable() {
  const wrap = document.getElementById('payables-table-wrap')
  if (!wrap) return
  const kw = state.search.payables
  const data = (window._payablesData || []).filter(r =>
    matchSearch(r, ['supplier_name'], kw)
  )
  wrap.innerHTML = `
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
          ${data.length === 0 ? `<tr><td colspan="4" class="p-8 text-center text-gray-400">${kw?'找不到「'+kw+'」':'尚無資料'}</td></tr>` :
          data.map(r => `
          <tr class="border-b border-gray-50">
            <td class="p-3 font-medium">${hlSearch(r.supplier_name||'未指定',kw)}</td>
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
    <input id="expenses-search" type="text" placeholder="🔍 搜尋類別/說明…" value="${state.search.expenses}"
      oninput="state.search.expenses=this.value;renderExpensesTable()"
      style="flex:1;min-width:110px;max-width:200px;padding:5px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-2);color:var(--text);font-size:16px;">
    <button onclick="openExpenseModal()" class="btn-primary"><i class="fas fa-plus mr-1"></i>新增費用</button>
  </div>
  <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
    <div class="card p-3 text-center col-span-2 md:col-span-1"><div class="text-xs text-gray-500 mb-1">本期合計</div><div class="text-xl font-bold text-red-600">$${fmt(total)}</div></div>
    ${Object.entries(catMap).map(([cat, amt]) => `<div class="card p-3 text-center"><div class="text-xs text-gray-500 mb-1">${cat}</div><div class="text-base font-bold text-orange-600">$${fmt(amt)}</div></div>`).join('')}
  </div>
  <div id="expenses-table-wrap"></div>`

  window._expensesData = data
  renderExpensesTable()
}

function renderExpensesTable() {
  const wrap = document.getElementById('expenses-table-wrap')
  if (!wrap) return
  const kw = state.search.expenses
  const data = (window._expensesData || []).filter(r =>
    matchSearch(r, ['category','description','destination'], kw)
  )
  wrap.innerHTML = `
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
          ${data.length === 0 ? `<tr><td colspan="5" class="p-8 text-center text-gray-400">${kw?'找不到「'+kw+'」':'尚無資料'}</td></tr>` :
            data.map(r => `
            <tr class="border-b border-gray-50">
              <td class="p-3 text-gray-500">${fmtDate(r.date)}</td>
              <td class="p-3"><span class="bg-orange-50 text-orange-700 px-2 py-0.5 rounded text-xs">${hlSearch(r.category,kw)}</span></td>
              <td class="p-3 text-gray-600 hidden md:table-cell">${hlSearch((r.description||'')+' '+(r.destination||''),kw)}</td>
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
           ${['油費','跑-竹雞','跑-送貨','跑-代班','雜支','其他'].map(c => `<option value="${c}" ${r.category===c?'selected':''}>${c}</option>`).join('')}
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
    <input id="cashflow-search" type="text" placeholder="🔍 搜尋摘要/對象…" value="${state.search.cashflow}"
      oninput="state.search.cashflow=this.value;renderCashflowTable()"
      style="flex:1;min-width:110px;max-width:200px;padding:5px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-2);color:var(--text);font-size:16px;">
    <button onclick="openCashflowModal()" class="btn-primary"><i class="fas fa-plus mr-1"></i>新增</button>
  </div>
  <div class="grid grid-cols-3 gap-3 mb-4">
    <div class="card p-3 text-center"><div class="text-xs text-gray-500 mb-1">收入</div><div class="text-lg font-bold text-green-600">+$${fmt(totalIn)}</div></div>
    <div class="card p-3 text-center"><div class="text-xs text-gray-500 mb-1">支出</div><div class="text-lg font-bold text-red-600">-$${fmt(totalOut)}</div></div>
    <div class="card p-3 text-center"><div class="text-xs text-gray-500 mb-1">淨額</div><div class="text-lg font-bold ${totalIn-totalOut>=0?'text-blue-600':'text-red-600'}">$${fmt(totalIn-totalOut)}</div></div>
  </div>
  <div id="cashflow-table-wrap"></div>`

  window._cashflowData = data
  renderCashflowTable()
}

function renderCashflowTable() {
  const wrap = document.getElementById('cashflow-table-wrap')
  if (!wrap) return
  const kw = state.search.cashflow
  const data = (window._cashflowData || []).filter(r =>
    matchSearch(r, ['description','party','category'], kw)
  )
  wrap.innerHTML = `
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
          ${data.length === 0 ? `<tr><td colspan="6" class="p-8 text-center text-gray-400">${kw?'找不到「'+kw+'」':'尚無資料'}</td></tr>` :
            data.map(r => `
            <tr class="border-b border-gray-50">
              <td class="p-3 text-gray-500">${fmtDate(r.date)}</td>
              <td class="p-3">${hlSearch(r.description,kw)}<br><span class="text-xs text-gray-400">${hlSearch(r.party||'',kw)}</span></td>
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
    <div class="kpi-card green">
      <div class="kpi-label">年度營收</div>
      <div class="kpi-value">$${fmt(kpi.revenue)}</div>
      <div class="kpi-sub">目標達成 ${kpi.achievement_rate}%</div>
    </div>
    <div class="kpi-card red">
      <div class="kpi-label">年度成本</div>
      <div class="kpi-value">$${fmt(kpi.cost)}</div>
      <div class="kpi-sub">費用 $${fmt(kpi.expense)}</div>
    </div>
    <div class="kpi-card gold">
      <div class="kpi-label">毛利</div>
      <div class="kpi-value">$${fmt(kpi.gross_profit)}</div>
      <div class="kpi-sub">毛利率 ${kpi.gross_margin}%</div>
    </div>
    <div class="kpi-card blue">
      <div class="kpi-label">淨利</div>
      <div class="kpi-value">$${fmt(kpi.net_profit)}</div>
      <div class="kpi-sub">淨利率 ${kpi.net_margin}%</div>
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
          { label: '營收', data: plData.map(r => r.revenue), backgroundColor: '#86efac', borderColor: '#1a9e5c', borderRadius: 4 },
          { label: '成本', data: plData.map(r => r.cost), backgroundColor: '#fca5a5', borderColor: '#d63b3b', borderRadius: 4 },
          { label: '淨利', data: plData.map(r => r.net_profit), type: 'line', borderColor: '#e07b2a', backgroundColor: 'transparent', pointRadius: 4, tension: 0.4 },
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
  const yr = state.year
  const [purchData, salesData] = await Promise.all([
    api('GET', `/purchases?year=${yr}`),
    api('GET', `/sales?year=${yr}`),
  ])
  if (!purchData) return

  // 以 product_name + category 為 key，彙總
  const invMap = {}

  purchData.forEach(r => {
    const key = r.product_name || '未知'
    if (!invMap[key]) invMap[key] = {
      product: key,
      category: r.category || '-',
      unit: r.unit || r.qty_unit || '隻',
      purchased: 0,
      sold: 0,
      lastCost: 0,
      lastDate: '',
    }
    invMap[key].purchased += parseFloat(r.quantity || 0)
    // 取最近一筆進貨的成本價
    if (r.date >= invMap[key].lastDate) {
      invMap[key].lastCost = parseFloat(r.cost_price || 0)
      invMap[key].lastDate = r.date || ''
    }
  })

  ;(salesData || []).forEach(r => {
    const key = r.product_name
    if (invMap[key]) {
      invMap[key].sold += parseFloat(r.quantity || 0)
    } else {
      invMap[key] = {
        product: key,
        category: r.category || '-',
        unit: r.unit || r.qty_unit || '隻',
        purchased: 0,
        sold: parseFloat(r.quantity || 0),
        lastCost: 0,
        lastDate: r.date || '',
      }
    }
  })

  const inv = Object.values(invMap)
    .map(r => ({ ...r, balance: Math.round(r.purchased - r.sold) }))
    .sort((a, b) => b.purchased - a.purchased)

  const totalPurch = inv.reduce((s, r) => s + r.purchased, 0)
  const totalSold  = inv.reduce((s, r) => s + r.sold, 0)

  el.innerHTML = `
  <div class="filter-bar">
    <select onchange="state.year=parseInt(this.value);loadInventory()">
      ${[2024,2025,2026,2027].map(y=>`<option value="${y}" ${y===yr?'selected':''}>${y}年</option>`).join('')}
    </select>
    <input id="inventory-search" type="text" placeholder="🔍 搜尋品項/類別…" value="${state.search.inventory}"
      oninput="state.search.inventory=this.value;renderInventoryTable()"
      style="flex:1;min-width:110px;max-width:200px;padding:5px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-2);color:var(--text);font-size:16px;">
    <span style="font-size:18px;color:var(--text-dim);margin-left:4px;">庫存概覽</span>
  </div>

  <div class="sum-cards" style="grid-template-columns:repeat(3,1fr);">
    <div class="sum-card"><div class="sum-card-label">品項數</div><div class="sum-card-value blue">${inv.length}</div></div>
    <div class="sum-card"><div class="sum-card-label">進貨總量</div><div class="sum-card-value green">${fmt(totalPurch)}</div></div>
    <div class="sum-card"><div class="sum-card-label">出貨總量</div><div class="sum-card-value red">${fmt(totalSold)}</div></div>
  </div>

  <div id="inventory-table-wrap"></div>`

  window._inventoryData = inv
  renderInventoryTable()
}

function renderInventoryTable() {
  const wrap = document.getElementById('inventory-table-wrap')
  if (!wrap) return
  const kw = state.search.inventory
  const inv = (window._inventoryData || []).filter(r =>
    matchSearch(r, ['product','category'], kw)
  )
  wrap.innerHTML = `
  <div class="tbl-wrap">
    <table class="ftbl">
      <colgroup>
        <col style="width:100px"><col style="width:48px"><col style="width:72px">
        <col style="width:40px"><col style="width:72px"><col style="width:62px"><col style="width:70px">
      </colgroup>
      <thead class="table-header"><tr>
        <th>品項</th><th class="td-ctr">類別</th><th class="td-num">進貨</th>
        <th class="td-ctr">單位</th><th class="td-num">出貨</th><th class="td-num">單價</th><th class="td-num">結餘</th>
      </tr></thead>
      <tbody>
        ${inv.length === 0
          ? `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-dim);">${kw?'找不到「'+kw+'」':'尚無資料'}</td></tr>`
          : inv.map(r => `
          <tr>
            <td class="fc tc-bold" title="${r.product}">${hlSearch(r.product,kw)}</td>
            <td class="td-ctr"><span class="${r.category==='生鮮'?'badge-fresh':r.category==='冷凍'?'badge-frozen':'badge-cooked'}">${r.category}</span></td>
            <td class="td-num tc-blue">${fmt(r.purchased, 0)}</td>
            <td class="td-ctr tc-dim">${r.unit}</td>
            <td class="td-num">${fmt(r.sold, 0)}</td>
            <td class="td-num">${r.lastCost > 0 ? '$'+parseFloat(r.lastCost).toFixed(1) : '-'}</td>
            <td class="td-num" style="font-weight:700;color:${r.balance < 0 ? 'var(--red)' : r.balance === 0 ? 'var(--text-dim)' : 'var(--green)'};">${fmt(r.balance, 0)}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>`
}

// === 客戶管理 ===
async function loadCustomers() {
  const el = document.getElementById('customers-content')
  const data = await api('GET', '/customers')
  if (!data) return

  el.innerHTML = `
  <div class="flex gap-2 mb-4 flex-wrap items-center">
    <input id="customers-search" type="text" placeholder="🔍 搜尋客戶名稱/代碼…" value="${state.search.customers}"
      oninput="state.search.customers=this.value;renderCustomersTable()"
      style="flex:1;min-width:150px;max-width:260px;padding:5px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-2);color:var(--text);font-size:16px;">
    <button onclick="openCustomerModal()" class="btn-primary" style="margin-left:auto;"><i class="fas fa-plus mr-1"></i>新增客戶</button>
  </div>
  <div id="customers-table-wrap"></div>`

  window._customersData = data
  renderCustomersTable()
}

function renderCustomersTable() {
  const wrap = document.getElementById('customers-table-wrap')
  if (!wrap) return
  const kw = state.search.customers
  const data = (window._customersData || []).filter(r =>
    matchSearch(r, ['name','code','phone','company'], kw)
  )
  wrap.innerHTML = `
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
          ${data.length === 0 ? `<tr><td colspan="5" class="p-8 text-center text-gray-400">${kw?'找不到「'+kw+'」':'尚無資料'}</td></tr>` :
          data.map(r => `
          <tr class="border-b border-gray-50">
            <td class="p-3 text-gray-500">${hlSearch(r.code,kw)}</td>
            <td class="p-3 font-medium">${hlSearch(r.name,kw)}<br><span class="text-xs text-gray-400">${r.company||''}</span></td>
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
  <div class="flex gap-2 mb-4 flex-wrap items-center">
    <input id="suppliers-search" type="text" placeholder="🔍 搜尋廠商名稱/代碼…" value="${state.search.suppliers}"
      oninput="state.search.suppliers=this.value;renderSuppliersTable()"
      style="flex:1;min-width:150px;max-width:260px;padding:5px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-2);color:var(--text);font-size:16px;">
    <button onclick="openSupplierModal()" class="btn-primary" style="margin-left:auto;"><i class="fas fa-plus mr-1"></i>新增廠商</button>
  </div>
  <div id="suppliers-table-wrap"></div>`

  window._suppliersData = data
  renderSuppliersTable()
}

function renderSuppliersTable() {
  const wrap = document.getElementById('suppliers-table-wrap')
  if (!wrap) return
  const kw = state.search.suppliers
  const data = (window._suppliersData || []).filter(r =>
    matchSearch(r, ['name','code','contact','phone'], kw)
  )
  wrap.innerHTML = `
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
          ${data.length === 0 ? `<tr><td colspan="5" class="p-8 text-center text-gray-400">${kw?'找不到「'+kw+'」':'尚無資料'}</td></tr>` :
          data.map(r => `
          <tr class="border-b border-gray-50">
            <td class="p-3 text-gray-500">${hlSearch(r.code,kw)}</td>
            <td class="p-3 font-medium">${hlSearch(r.name,kw)}</td>
            <td class="p-3 text-gray-600 hidden md:table-cell">${hlSearch(r.contact||'-',kw)}</td>
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
  // 同時取商品、供應商報價、客戶報價、最近進貨
  const [data, supPrices, custPrices, purchData] = await Promise.all([
    api('GET', '/products'),
    api('GET', '/prices/supplier'),
    api('GET', '/prices/customer'),
    api('GET', '/purchases?year=2026'),
  ])
  if (!data) return

  // 建立供應商報價 map: product_id -> [{supplier_name, price}]
  const supMap = {}
  ;(supPrices || []).forEach(p => {
    if (!supMap[p.product_id]) supMap[p.product_id] = []
    supMap[p.product_id].push({ name: p.supplier_name, price: p.price })
  })

  // 建立最近進貨日期 map: product_name -> 最新date
  const lastBuyMap = {}
  ;(purchData || []).forEach(r => {
    const k = r.product_id || r.product_name
    if (!lastBuyMap[k] || r.date > lastBuyMap[k]) lastBuyMap[k] = r.date
  })
  // product_id -> last date
  const lastBuyById = {}
  ;(purchData || []).forEach(r => {
    if (!lastBuyById[r.product_id] || r.date > lastBuyById[r.product_id])
      lastBuyById[r.product_id] = r.date
  })

  el.innerHTML = `
  <div class="filter-bar">
    <input id="products-search" type="text" placeholder="🔍 搜尋品項/類別…" value="${state.search.products}"
      oninput="state.search.products=this.value;renderProductsTable()"
      style="flex:1;min-width:120px;max-width:220px;padding:5px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-2);color:var(--text);font-size:16px;">
    <button onclick="openProductModal()" class="btn-primary" style="margin-left:auto;"><i class="fas fa-plus"></i> 新增商品</button>
  </div>
  <div id="products-table-wrap"></div>`

  window._productsData = data
  window._productsSupMap = supMap
  window._productsLastBuy = lastBuyById
  renderProductsTable()
}

function renderProductsTable() {
  const wrap = document.getElementById('products-table-wrap')
  if (!wrap) return
  const kw = state.search.products
  const data = (window._productsData || []).filter(r =>
    matchSearch(r, ['name','code','category'], kw)
  )
  const supMap = window._productsSupMap || {}
  const lastBuyById = window._productsLastBuy || {}
  wrap.innerHTML = `
  <div class="tbl-wrap">
    <table class="ftbl">
      <colgroup>
        <col style="width:80px"><col style="width:100px"><col style="width:48px">
        <col style="width:40px"><col style="width:180px"><col style="width:68px">
      </colgroup>
      <thead class="table-header"><tr>
        <th>日期</th><th>品項</th><th class="td-ctr">類別</th>
        <th class="td-ctr">單位</th><th>供應商報價</th><th class="td-ctr">操作</th>
      </tr></thead>
      <tbody>
        ${data.length === 0
          ? `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-dim);">${kw?'找不到「'+kw+'」':'尚無資料'}</td></tr>`
          : data.map(r => {
              const sups = supMap[r.id] || []
              const supStr = sups.length ? sups.map(s => `${s.name} $${s.price}`).join('　') : '-'
              const lastDate = lastBuyById[r.id] ? fmtDate(lastBuyById[r.id]) : '-'
              return `
              <tr>
                <td class="tc-dim">${lastDate}</td>
                <td class="fc tc-bold" title="${r.name}">${hlSearch(r.name,kw)}</td>
                <td class="td-ctr"><span class="${r.category==='生鮮'?'badge-fresh':r.category==='冷凍'?'badge-frozen':'badge-cooked'}">${r.category}</span></td>
                <td class="td-ctr tc-dim">${r.unit||'-'}</td>
                <td class="fc tc-sub" title="${supStr}">${supStr}</td>
                <td class="td-ctr">
                  <button onclick="openProductModal(${r.id})" class="ic-btn ic-edit"><i class="fas fa-edit"></i></button>
                  <button onclick="deleteProduct(${r.id})" class="ic-btn ic-del"><i class="fas fa-trash"></i></button>
                </td>
              </tr>`
            }).join('')}
      </tbody>
    </table>
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
  const nowStr = new Date().toLocaleDateString('zh-TW', {
    year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit'
  })

  // ── 依日期分組 ──
  const byDate = {}
  for (const r of items) {
    const d = (r.date || '').split('T')[0]
    if (!byDate[d]) byDate[d] = []
    byDate[d].push(r)
  }
  const dates = Object.keys(byDate).sort()
  const WD = ['日','一','二','三','四','五','六']

  // ── 重量顯示（給客戶看，只顯示數量+單位，不算公式）──
  function displayQty(r) {
    const qty = r.quantity || 0
    const unit = r.qty_unit || r.unit || ''
    return `${qty}${unit}`
  }

  // ── 每天的品項列 + 當天小計 ──
  const dayBlocks = dates.map(d => {
    const dayItems = byDate[d]
    const dayTotal = dayItems.reduce((s, r) => s + (r.total_amount || 0), 0)
    const dt = new Date(d + 'T12:00:00')
    const wd = WD[dt.getDay()]
    const dateLabel = `${parseInt(d.slice(5,7))}/${parseInt(d.slice(8,10))} (${wd})`

    // 每筆品項
    const itemRows = dayItems.map(r => `
      <tr class="st-item-row">
        <td class="st-td-date"></td>
        <td class="st-td-product" style="font-size: 15px;color:#aaa;white-space:nowrap;">${r.category||''}</td>
        <td class="st-td-product">${r.product_name}</td>
        <td class="st-td-qty">${r.spec ? r.spec + ' KG' : '-'}</td>
        <td class="st-td-price">$${fmt(r.unit_price, 0)}</td>
        <td class="st-td-qty">${displayQty(r)}</td>
        <td class="st-td-amt">$${fmt(r.total_amount, 0)}</td>
      </tr>`).join('')

    // 當天小計列
    const subtotalRow = `
      <tr class="st-subtotal-row">
        <td class="st-td-date">${dateLabel}</td>
        <td class="st-td-product" colspan="5" style="text-align:right;font-size: 18px;color:#888;letter-spacing:.5px;">當日小計</td>
        <td class="st-td-amt" style="color:#1a1a1a;font-weight:800;">$${fmt(dayTotal, 0)}</td>
      </tr>`

    return itemRows + subtotalRow
  }).join('')

  // ── 空白結算單 ──
  if (items.length === 0) {
    container.innerHTML = `
    <div style="background:#fff;border:1px solid #e0e0e0;border-radius:12px;padding:48px;text-align:center;color:#aaa;">
      <div style="font-size: 39px;margin-bottom:12px;">📋</div>
      <div style="font-size: 22px;">此期間無出貨記錄</div>
    </div>`
    return
  }

  // ── 總計與收款區 ──
  const isPaid = summary.unpaid <= 0
  const totalSection = `
    <tr class="st-total-row">
      <td colspan="6" style="
        padding:14px 16px;
        font-size: 20px;font-weight:700;letter-spacing:.5px;color:#555;
        text-align:right;border-top:2px solid #1a1a1a;">
        ${date_start} ～ ${date_end} 貨款合計
      </td>
      <td style="
        padding:14px 16px;
        font-size: 29px;font-weight:900;color:#1a1a1a;
        text-align:right;border-top:2px solid #1a1a1a;
        white-space:nowrap;">
        $${fmt(summary.total, 0)}
      </td>
    </tr>
    <tr>
      <td colspan="6" style="padding:6px 16px;font-size: 19px;color:#888;text-align:right;">已付款</td>
      <td style="padding:6px 16px;font-size: 20px;font-weight:700;color:#16a34a;text-align:right;">$${fmt(summary.paid || 0, 0)}</td>
    </tr>
    <tr>
      <td colspan="6" style="padding:6px 16px 14px;font-size: 19px;color:#888;text-align:right;">待收款</td>
      <td style="padding:6px 16px 14px;font-size: 23px;font-weight:900;color:#dc2626;text-align:right;">$${fmt(summary.unpaid || 0, 0)}</td>
    </tr>
    ${(summary.unpaid || 0) <= 0 ? `
    <tr>
      <td colspan="7" style="padding:8px 16px 14px;text-align:right;">
        <span style="font-size: 19px;font-weight:700;color:#16a34a;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:20px;padding:3px 12px;">
          ✓ 款項已結清
        </span>
      </td>
    </tr>` : ''}`

  container.innerHTML = `
  <div class="capture-area" id="capture-area">

    <!-- ════ 正式對客戶結算單（statement-card）════ -->
    <div id="statement-card" style="
      background:#ffffff;
      border:1px solid #d0d0d0;
      border-radius:4px;
      font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue','PingFang TC','Microsoft JhengHei',sans-serif;
      color:#1a1a1a;
      max-width:640px;
      margin:0 auto;
      overflow:hidden;">

      <!-- 頂部：公司資訊 + 單據標題 -->
      <div style="
        background:#1a1a1a;color:#fff;
        padding:20px 22px 16px;
        display:flex;align-items:flex-start;justify-content:space-between;">
        <div>
          <div style="font-size: 27px;font-weight:900;letter-spacing:1px;margin-bottom:4px;">陸旺畜產實業有限公司</div>
          <div style="font-size: 18px;color:#888;letter-spacing:.5px;">LU WANG LIVESTOCK INDUSTRY CO., LTD.</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size: 25px;font-weight:800;letter-spacing:2px;color:#d4a34b;">出貨結算單</div>
          <div style="font-size: 18px;color:#666;margin-top:4px;">製表：${nowStr}</div>
        </div>
      </div>

      <!-- 客戶資訊 + 期間 -->
      <div style="
        background:#f7f7f7;border-bottom:1px solid #e0e0e0;
        padding:12px 22px;
        display:flex;align-items:center;justify-content:space-between;
        flex-wrap:wrap;gap:8px;">
        <div>
          <span style="font-size: 18px;color:#888;letter-spacing:.5px;display:block;margin-bottom:2px;">客戶</span>
          <span style="font-size: 24px;font-weight:800;color:#1a1a1a;">${customer_name}</span>
        </div>
        <div style="text-align:right;">
          <span style="font-size: 18px;color:#888;letter-spacing:.5px;display:block;margin-bottom:2px;">結算期間</span>
          <span style="font-size: 21px;font-weight:700;color:#1a1a1a;">${date_start} ～ ${date_end}</span>
        </div>
      </div>

      <!-- 明細表格 -->
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;">
          <!-- 欄位標頭 -->
          <thead>
            <tr style="background:#f0f0f0;border-bottom:2px solid #1a1a1a;">
              <th class="st-th" style="width:70px;">日期</th>
              <th class="st-th" style="width:50px;">類別</th>
              <th class="st-th" style="text-align:left;">品項</th>
              <th class="st-th">總重(KG)</th>
              <th class="st-th">單價</th>
              <th class="st-th">數量</th>
              <th class="st-th">金額</th>
            </tr>
          </thead>
          <tbody>
            ${dayBlocks}
            <!-- 空行 -->
            <tr><td colspan="7" style="height:8px;background:#fafafa;border-top:1px solid #eee;"></td></tr>
            <!-- 合計區 -->
            ${totalSection}
          </tbody>
        </table>
      </div>

      <!-- 付款帳戶資訊 -->
      <div style="
        background:#1a1a1a;
        padding:14px 22px;
        display:flex;align-items:center;justify-content:space-between;
        flex-wrap:wrap;gap:6px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="
            background:#d4a34b;border-radius:4px;
            padding:4px 10px;
            font-size:16px;font-weight:800;color:#1a1a1a;
            letter-spacing:1px;white-space:nowrap;">
            匯款帳戶
          </div>
          <div>
            <div style="font-size:17px;color:#aaa;line-height:1.3;">玉山銀行 808</div>
            <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:2px;font-family:monospace;">
              0842-979-176643
            </div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:15px;color:#666;">如有疑問請與業務確認</div>
          <div style="font-size:15px;color:#444;font-family:monospace;margin-top:2px;">NO.${date_start.replace(/-/g,'')}${summary.count}</div>
        </div>
      </div>
    </div>

    <!-- 操作按鈕 -->
    <div class="no-print" style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-top:20px;padding-bottom:24px;">
      <button onclick="wsDownloadPNG()" class="btn-primary" style="padding:10px 22px;font-size: 21px;">
        <i class="fas fa-download"></i> 下載圖片
      </button>
      <button onclick="window.print()" class="btn-secondary" style="padding:10px 20px;font-size: 21px;">
        <i class="fas fa-print"></i> 列印
      </button>
      <button onclick="wsShare()" id="ws-share-btn" class="btn-secondary" style="padding:10px 20px;font-size: 21px;">
        <i class="fas fa-share-alt"></i> 分享
      </button>
      ${summary.unpaid > 0 ? `
      <button onclick="wsMarkPaid()" class="btn-success" style="padding:10px 20px;font-size: 21px;">
        <i class="fas fa-check"></i> 標記已收款
      </button>` : ''}
    </div>
  </div>

  <style>
    /* 結算單專用樣式（白底列印友善） */
    .st-th {
      padding:9px 12px;
      font-size: 18px;font-weight:700;
      letter-spacing:.8px;text-transform:uppercase;
      color:#555;text-align:right;
      white-space:nowrap;
    }
    .st-item-row td { border-bottom:1px solid #f0f0f0; }
    .st-item-row:last-of-type td { border-bottom:none; }
    .st-td-date {
      padding:8px 12px;font-size: 19px;color:#888;
      white-space:nowrap;vertical-align:middle;
      width:70px;
    }
    .st-td-product {
      padding:8px 12px;font-size: 20px;font-weight:600;color:#1a1a1a;
      text-align:left;vertical-align:middle;
    }
    .st-td-price {
      padding:8px 12px;font-size: 20px;color:#555;
      text-align:right;vertical-align:middle;white-space:nowrap;
    }
    .st-td-qty {
      padding:8px 12px;font-size: 20px;color:#555;
      text-align:right;vertical-align:middle;white-space:nowrap;
    }
    .st-td-amt {
      padding:8px 16px 8px 12px;font-size: 20px;font-weight:700;color:#1a1a1a;
      text-align:right;vertical-align:middle;white-space:nowrap;
    }
    .st-subtotal-row td {
      padding:6px 16px 10px 12px;
      background:#fafafa;border-top:1px solid #e8e8e8;border-bottom:2px solid #d0d0d0;
      font-size: 19px;
    }
    .st-subtotal-row .st-td-date {
      font-weight:700;color:#1a1a1a;font-size: 20px;
    }
    @media print {
      .no-print { display:none !important; }
      body { background:#fff !important; }
      #statement-card { border:1px solid #ccc !important; box-shadow:none !important; }
    }
  </style>`
}

async function wsDownloadPNG() {
  const el = document.getElementById('statement-card')
  if (!el) { showToast('找不到結算單', 'error'); return }
  showToast('正在產生圖片...', 'success')
  try {
    const canvas = await html2canvas(el, {
      scale: 2.5,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      letterRendering: true,
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
    const canvas = await html2canvas(el, { scale: 2.5, useCORS: true, backgroundColor: '#ffffff', logging: false, letterRendering: true })
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
// === 登出 ===
async function doLogout() {
  if (!confirm('確定要登出嗎？')) return
  await fetch('/api/auth/logout', { method: 'POST' })
  location.reload()
}

// === 📷 紙張掃描匯入 ===
let _ocrResults = []

function loadOcr() {
  const el = document.getElementById('ocr-content')
  if (!el) return
  el.innerHTML = `
  <div style="max-width:680px; margin:0 auto;">

    <!-- 標題區 -->
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
      <div style="width:44px;height:44px;border-radius:10px;background:rgba(79,209,197,.15);
                  display:flex;align-items:center;justify-content:center;">
        <i class="fas fa-camera" style="color:#4fd1c5;font-size:20px;"></i>
      </div>
      <div>
        <div style="font-size:20px;font-weight:700;color:var(--text);">紙張掃描匯入</div>
        <div style="font-size:13px;color:var(--text-dim);">拍照上傳手寫記錄，自動識別重量並匯入出貨/進貨</div>
      </div>
    </div>

    <!-- 上傳區 -->
    <div style="background:var(--bg-2);border:2px dashed var(--border);border-radius:14px;
                padding:28px 22px;margin-bottom:16px;">
      <div style="text-align:center;margin-bottom:18px;">
        <i class="fas fa-file-image" style="font-size:36px;color:var(--text-dim);margin-bottom:10px;display:block;"></i>
        <div style="font-size:15px;color:var(--text-dim);">選擇手寫記錄的照片</div>
      </div>

      <!-- 預覽圖 -->
      <div id="ocr-img-preview" style="display:none;text-align:center;margin-bottom:16px;">
        <img id="ocr-preview-img" style="max-width:100%;max-height:300px;border-radius:8px;border:1px solid var(--border);" />
      </div>

      <div style="display:flex;flex-direction:column;gap:10px;align-items:center;">
        <label style="cursor:pointer;width:100%;">
          <input type="file" id="ocr-file-input" accept="image/*" capture="environment"
                 style="display:none;" onchange="ocrPreviewImage(this)">
          <div style="width:100%;padding:12px;background:var(--bg-3);border:1px solid var(--border);
                      border-radius:10px;text-align:center;cursor:pointer;font-size:15px;color:var(--text-2);">
            <i class="fas fa-upload" style="margin-right:6px;"></i>選擇圖片 / 拍照
          </div>
        </label>
        <button onclick="ocrRecognize()"
          style="width:100%;padding:13px;background:linear-gradient(135deg,#4fd1c5,#38b2ac);
                 border:none;border-radius:10px;color:#fff;font-size:16px;font-weight:700;
                 cursor:pointer;letter-spacing:1px;">
          <i class="fas fa-magic" style="margin-right:6px;"></i>AI 識別重量
        </button>
      </div>

      <div id="ocr-status" style="margin-top:14px;text-align:center;font-size:14px;color:var(--text-dim);min-height:20px;"></div>
    </div>

    <!-- 識別結果區 -->
    <div id="ocr-result-area" style="display:none;">
      <div style="background:var(--bg-2);border:1px solid var(--border);border-radius:14px;padding:18px;margin-bottom:14px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
          <span style="font-size:15px;font-weight:700;color:var(--text);">
            <i class="fas fa-list-ul" style="color:#4fd1c5;margin-right:6px;"></i>識別結果
            <span id="ocr-count-badge" style="background:rgba(79,209,197,.2);color:#4fd1c5;
                  border-radius:20px;padding:2px 10px;font-size:13px;margin-left:6px;"></span>
          </span>
          <button onclick="ocrAddRow()"
            style="padding:6px 14px;background:var(--bg-3);border:1px solid var(--border);
                   border-radius:8px;color:var(--text-2);font-size:13px;cursor:pointer;">
            <i class="fas fa-plus"></i> 新增列
          </button>
        </div>

        <!-- 表格 -->
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <thead>
              <tr style="background:var(--bg-3);border-bottom:1px solid var(--border);">
                <th style="padding:8px 10px;text-align:center;color:var(--text-dim);width:36px;">#</th>
                <th style="padding:8px 10px;text-align:center;color:var(--text-dim);">重量 (KG)</th>
                <th style="padding:8px 10px;text-align:center;color:var(--text-dim);">數量 (隻)</th>
                <th style="padding:8px 10px;text-align:center;color:var(--text-dim);width:40px;">刪</th>
              </tr>
            </thead>
            <tbody id="ocr-tbody"></tbody>
            <tfoot>
              <tr style="background:var(--bg-3);border-top:2px solid var(--border);">
                <td colspan="2" style="padding:8px 10px;text-align:right;color:var(--text-dim);font-size:13px;">合計 KG</td>
                <td colspan="2" style="padding:8px 10px;text-align:center;font-weight:700;color:var(--text);" id="ocr-total-kg">0</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <!-- 匯入設定 -->
      <div style="background:var(--bg-2);border:1px solid var(--border);border-radius:14px;padding:18px;margin-bottom:14px;">
        <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:14px;">
          <i class="fas fa-cog" style="color:#4fd1c5;margin-right:6px;"></i>匯入設定
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <label style="font-size:13px;color:var(--text-dim);display:block;margin-bottom:5px;">匯入類型</label>
            <select id="ocr-import-type" class="input-field">
              <option value="sales">📤 出貨記錄</option>
              <option value="purchases">📥 進貨記錄</option>
            </select>
          </div>
          <div>
            <label style="font-size:13px;color:var(--text-dim);display:block;margin-bottom:5px;">日期</label>
            <input type="date" id="ocr-import-date" class="input-field" value="${today()}">
          </div>
          <div>
            <label style="font-size:13px;color:var(--text-dim);display:block;margin-bottom:5px;">客戶／廠商</label>
            <select id="ocr-party-select" class="input-field">
              <option value="">-- 選擇 --</option>
            </select>
          </div>
          <div>
            <label style="font-size:13px;color:var(--text-dim);display:block;margin-bottom:5px;">品項</label>
            <select id="ocr-product-select" class="input-field">
              <option value="">-- 選擇 --</option>
            </select>
          </div>
          <div>
            <label style="font-size:13px;color:var(--text-dim);display:block;margin-bottom:5px;">單價 ($/KG)</label>
            <input type="number" id="ocr-unit-price" class="input-field" placeholder="例：84" step="0.5">
          </div>
          <div>
            <label style="font-size:13px;color:var(--text-dim);display:block;margin-bottom:5px;">付款狀態</label>
            <select id="ocr-pay-status" class="input-field">
              <option value="待付款">待付款</option>
              <option value="已付款">已付款</option>
            </select>
          </div>
        </div>
      </div>

      <!-- 確認按鈕 -->
      <div style="display:flex;gap:10px;">
        <button onclick="ocrConfirmImport()"
          style="flex:1;padding:14px;background:linear-gradient(135deg,#4fd1c5,#38b2ac);
                 border:none;border-radius:10px;color:#fff;font-size:16px;font-weight:700;cursor:pointer;">
          <i class="fas fa-check"></i> 確認匯入
        </button>
        <button onclick="ocrReset()"
          style="padding:14px 20px;background:var(--bg-3);border:1px solid var(--border);
                 border-radius:10px;color:var(--text-2);font-size:15px;cursor:pointer;">
          <i class="fas fa-redo"></i> 重設
        </button>
      </div>
    </div>

  </div>`

  // 填充客戶/廠商選單
  ocrFillSelects()
}

function ocrFillSelects() {
  const typeEl = document.getElementById('ocr-import-type')
  if (!typeEl) return
  const isSales = typeEl.value === 'sales'

  const partyEl = document.getElementById('ocr-party-select')
  const list = isSales ? state.customers : state.suppliers
  partyEl.innerHTML = '<option value="">-- 選擇 --</option>' +
    (list || []).map(x => `<option value="${x.id}|${x.name}">${x.name}</option>`).join('')

  const prodEl = document.getElementById('ocr-product-select')
  prodEl.innerHTML = '<option value="">-- 選擇 --</option>' +
    (state.products || []).map(x => `<option value="${x.id}|${x.name}|${x.category}">${x.name}（${x.category}）</option>`).join('')

  typeEl.addEventListener('change', ocrFillSelects)
}

function ocrPreviewImage(input) {
  const file = input.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = e => {
    const img = document.getElementById('ocr-preview-img')
    img.src = e.target.result
    document.getElementById('ocr-img-preview').style.display = 'block'
    document.getElementById('ocr-status').textContent = `已選擇：${file.name}`
  }
  reader.readAsDataURL(file)
}

async function ocrRecognize() {
  const fileInput = document.getElementById('ocr-file-input')
  const file = fileInput?.files?.[0]
  if (!file) { showToast('請先選擇圖片', 'error'); return }

  const statusEl = document.getElementById('ocr-status')
  statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> AI 識別中，請稍候...'
  statusEl.style.color = '#f59e0b'

  try {
    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64 = e.target.result.split(',')[1]
      const mediaType = file.type || 'image/jpeg'

      const data = await api('POST', '/ocr-recognize', { image: base64, media_type: mediaType })
      if (!data || data.error) throw new Error(data?.error || '識別失敗')

      _ocrResults = data.weights || []
      ocrRenderTable()

      statusEl.innerHTML = `<i class="fas fa-check-circle" style="color:#4fd1c5"></i> 識別成功：${_ocrResults.length} 筆`
      statusEl.style.color = '#4fd1c5'
      document.getElementById('ocr-result-area').style.display = 'block'
    }
    reader.readAsDataURL(file)
  } catch (err) {
    statusEl.innerHTML = `<i class="fas fa-times-circle" style="color:var(--red)"></i> ${err.message}`
    statusEl.style.color = 'var(--red)'
  }
}

function ocrRenderTable() {
  const tbody = document.getElementById('ocr-tbody')
  if (!tbody) return
  tbody.innerHTML = _ocrResults.map((item, i) => `
    <tr style="border-bottom:1px solid var(--border);">
      <td style="padding:7px 10px;text-align:center;color:var(--text-dim);">${i + 1}</td>
      <td style="padding:7px 10px;text-align:center;">
        <input type="number" value="${item.kg}" step="0.1" min="0"
          style="width:90px;padding:5px 8px;background:var(--bg-3);border:1px solid var(--border);
                 border-radius:6px;color:var(--text);text-align:center;font-size:14px;"
          onchange="_ocrResults[${i}].kg=parseFloat(this.value)||0; ocrUpdateTotal()">
      </td>
      <td style="padding:7px 10px;text-align:center;">
        <input type="number" value="${item.qty || 1}" min="1"
          style="width:70px;padding:5px 8px;background:var(--bg-3);border:1px solid var(--border);
                 border-radius:6px;color:var(--text);text-align:center;font-size:14px;"
          onchange="_ocrResults[${i}].qty=parseInt(this.value)||1; ocrUpdateTotal()">
      </td>
      <td style="padding:7px 10px;text-align:center;">
        <button onclick="_ocrResults.splice(${i},1);ocrRenderTable()"
          style="background:none;border:none;color:var(--red);cursor:pointer;font-size:14px;">
          <i class="fas fa-times"></i>
        </button>
      </td>
    </tr>`).join('')
  ocrUpdateTotal()
  document.getElementById('ocr-count-badge').textContent = `${_ocrResults.length} 筆`
}

function ocrUpdateTotal() {
  const total = _ocrResults.reduce((s, r) => s + (parseFloat(r.kg) || 0), 0)
  const el = document.getElementById('ocr-total-kg')
  if (el) el.textContent = total.toFixed(1) + ' KG'
}

function ocrAddRow() {
  _ocrResults.push({ kg: 0, qty: 1 })
  ocrRenderTable()
  document.getElementById('ocr-result-area').style.display = 'block'
}

async function ocrConfirmImport() {
  if (_ocrResults.length === 0) { showToast('沒有資料可匯入', 'error'); return }

  const importType  = document.getElementById('ocr-import-type')?.value
  const dateVal     = document.getElementById('ocr-import-date')?.value
  const partyVal    = document.getElementById('ocr-party-select')?.value
  const productVal  = document.getElementById('ocr-product-select')?.value
  const unitPrice   = parseFloat(document.getElementById('ocr-unit-price')?.value || '0')
  const payStatus   = document.getElementById('ocr-pay-status')?.value

  if (!partyVal)   { showToast('請選擇客戶／廠商', 'error'); return }
  if (!productVal) { showToast('請選擇品項', 'error'); return }
  if (!unitPrice)  { showToast('請輸入單價', 'error'); return }

  const [partyId, partyName]              = partyVal.split('|')
  const [productId, productName, prodCat] = productVal.split('|')

  let ok = 0, fail = 0

  for (const row of _ocrResults) {
    const kg  = parseFloat(row.kg) || 0
    const qty = parseInt(row.qty)  || 1
    if (kg <= 0) { fail++; continue }

    const total = Math.round(kg * unitPrice)

    if (importType === 'sales') {
      const payload = {
        date: dateVal,
        customer_id:   parseInt(partyId),
        customer_name: partyName,
        product_id:    parseInt(productId),
        product_name:  productName,
        category:      prodCat || '生鮮',
        spec:          kg,
        unit:          'KG',
        quantity:      qty,
        qty_unit:      '隻',
        unit_price:    unitPrice,
        total_amount:  total,
        payment_status: payStatus,
        note:          '[掃描匯入]'
      }
      const res = await api('POST', '/sales', payload)
      if (res?.id || res?.success) ok++; else fail++
    } else {
      const payload = {
        date:           dateVal,
        supplier_id:    parseInt(partyId),
        supplier_name:  partyName,
        product_id:     parseInt(productId),
        product_name:   productName,
        category:       prodCat || '生鮮',
        spec:           kg,
        total_weight:   kg,
        unit:           'KG',
        quantity:       qty,
        qty_unit:       '隻',
        cost_price:     unitPrice,
        total_amount:   total,
        payment_status: '未付',
        note:          '[掃描匯入]'
      }
      const res = await api('POST', '/purchases', payload)
      if (res?.id || res?.success) ok++; else fail++
    }
  }

  if (ok > 0) {
    showToast(`✅ 成功匯入 ${ok} 筆${fail > 0 ? `，失敗 ${fail} 筆` : ''}`)
    ocrReset()
    // 跳到對應頁面
    showPage(importType === 'sales' ? 'sales' : 'purchases')
  } else {
    showToast(`匯入失敗，請確認設定`, 'error')
  }
}

function ocrReset() {
  _ocrResults = []
  const fi = document.getElementById('ocr-file-input')
  if (fi) fi.value = ''
  document.getElementById('ocr-img-preview').style.display = 'none'
  document.getElementById('ocr-result-area').style.display = 'none'
  document.getElementById('ocr-status').textContent = ''
}

// ============================================================
// === ⚡ 快速輸入（步驟式底部表單）===
// ============================================================
const QE = {
  step: 1,
  total: 7,
  data: {
    type: 'sales',      // sales | purchases
    date: '',
    category: '',
    kg: null,
    qty: 1,
    unit_price: null,
    total_amount: null,
    party_id: null,
    party_name: '',
    product_id: null,
    product_name: '',
    prod_category: '',
    pay_status: '待付款',
  }
}

function openQuickEntry() {
  // 重設
  QE.step = 1
  QE.data = {
    type: 'sales', date: today(), category: '生鮮',
    kg: null, qty: 1, unit_price: null, total_amount: null,
    party_id: null, party_name: '',
    product_id: null, product_name: '', prod_category: '生鮮',
    pay_status: '待付款',
  }
  const ov = document.getElementById('quick-entry-overlay')
  ov.style.display = 'flex'
  qeRender()
}

function closeQuickEntry() {
  document.getElementById('quick-entry-overlay').style.display = 'none'
}

// 點背景關閉
document.getElementById('quick-entry-overlay')?.addEventListener('click', function(e) {
  if (e.target === this) closeQuickEntry()
})

function qeRender() {
  const body = document.getElementById('qe-body')
  if (!body) return

  // 進度條
  const pct = Math.round((QE.step - 1) / QE.total * 100)
  const stepLabels = ['類型','日期','類別','品項','重量','單價','確認']
  const stepsHTML = stepLabels.map((l, i) => `
    <div style="display:flex;flex-direction:column;align-items:center;flex:1;">
      <div style="width:26px;height:26px;border-radius:50%;font-size:12px;font-weight:700;
                  display:flex;align-items:center;justify-content:center;
                  background:${i + 1 < QE.step ? '#22c55e' : i + 1 === QE.step ? '#f59e0b' : 'var(--bg-3)'};
                  color:${i + 1 <= QE.step ? '#fff' : 'var(--text-dim)'};
                  border:2px solid ${i + 1 < QE.step ? '#22c55e' : i + 1 === QE.step ? '#f59e0b' : 'var(--border)'};">
        ${i + 1 < QE.step ? '<i class="fas fa-check" style="font-size:10px;"></i>' : i + 1}
      </div>
      <div style="font-size:10px;color:${i + 1 === QE.step ? '#f59e0b' : 'var(--text-dim)'};margin-top:3px;">${l}</div>
    </div>`).join('')

  let stepContent = ''

  // ── Step 1：出貨 or 進貨 ──
  if (QE.step === 1) {
    stepContent = `
      <div style="font-size:18px;font-weight:700;color:var(--text);margin-bottom:18px;">
        這筆是？
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px;">
        <button onclick="QE.data.type='sales'; qeNext()"
          style="padding:22px 10px;border-radius:14px;border:2px solid ${QE.data.type==='sales'?'#f59e0b':'var(--border)'};
                 background:${QE.data.type==='sales'?'rgba(245,158,11,.12)':'var(--bg-3)'};
                 color:var(--text);cursor:pointer;font-size:16px;font-weight:700;">
          <div style="font-size:30px;margin-bottom:6px;">📤</div>
          出貨
        </button>
        <button onclick="QE.data.type='purchases'; qeNext()"
          style="padding:22px 10px;border-radius:14px;border:2px solid ${QE.data.type==='purchases'?'#f59e0b':'var(--border)'};
                 background:${QE.data.type==='purchases'?'rgba(245,158,11,.12)':'var(--bg-3)'};
                 color:var(--text);cursor:pointer;font-size:16px;font-weight:700;">
          <div style="font-size:30px;margin-bottom:6px;">📥</div>
          進貨
        </button>
      </div>`
  }

  // ── Step 2：日期 ──
  else if (QE.step === 2) {
    stepContent = `
      <div style="font-size:18px;font-weight:700;color:var(--text);margin-bottom:18px;">
        <i class="fas fa-calendar-alt" style="color:#f59e0b;margin-right:8px;"></i>日期
      </div>
      <input type="date" id="qe-date" value="${QE.data.date}"
        style="width:100%;padding:16px;font-size:20px;border-radius:12px;
               background:var(--bg-3);border:2px solid var(--border);color:var(--text);
               margin-bottom:20px;box-sizing:border-box;">
      <div style="display:flex;gap:8px;margin-bottom:20px;">
        ${[-1, 0].map(d => {
          const dt = new Date(); dt.setDate(dt.getDate() + d)
          const val = dt.toISOString().split('T')[0]
          const label = d === 0 ? '今天' : '昨天'
          return `<button onclick="document.getElementById('qe-date').value='${val}'"
            style="flex:1;padding:10px;border-radius:10px;border:1px solid var(--border);
                   background:var(--bg-3);color:var(--text-2);font-size:14px;cursor:pointer;">${label}</button>`
        }).join('')}
      </div>`
  }

  // ── Step 3：類別 + 客戶/廠商 ──
  else if (QE.step === 3) {
    const isSales = QE.data.type === 'sales'
    const partyLabel = isSales ? '客戶' : '廠商'
    const partyList = isSales ? (state.customers || []) : (state.suppliers || [])
    stepContent = `
      <div style="font-size:18px;font-weight:700;color:var(--text);margin-bottom:16px;">
        <i class="fas fa-tag" style="color:#f59e0b;margin-right:8px;"></i>類別
      </div>
      <div style="display:flex;gap:8px;margin-bottom:20px;">
        ${['生鮮','冷凍','熟雞'].map(c => `
          <button onclick="QE.data.category='${c}';QE.data.prod_category='${c}';qeRender()"
            style="flex:1;padding:14px 6px;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;
                   border:2px solid ${QE.data.category===c?'#f59e0b':'var(--border)'};
                   background:${QE.data.category===c?'rgba(245,158,11,.15)':'var(--bg-3)'};
                   color:${QE.data.category===c?'#f59e0b':'var(--text-2)'};">${c}</button>`).join('')}
      </div>
      <div style="font-size:18px;font-weight:700;color:var(--text);margin-bottom:12px;">
        <i class="fas fa-user" style="color:#f59e0b;margin-right:8px;"></i>${partyLabel}
      </div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:20px;max-height:180px;overflow-y:auto;">
        ${partyList.map(p => `
          <button onclick="QE.data.party_id=${p.id};QE.data.party_name='${p.name}';qeRender()"
            style="padding:12px 8px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;text-align:left;
                   border:2px solid ${QE.data.party_id===p.id?'#f59e0b':'var(--border)'};
                   background:${QE.data.party_id===p.id?'rgba(245,158,11,.15)':'var(--bg-3)'};
                   color:${QE.data.party_id===p.id?'#f59e0b':'var(--text-2)'};">
            ${p.name}
          </button>`).join('')}
      </div>`
  }

  // ── Step 4：品項 ──
  else if (QE.step === 4) {
    const filtered = (state.products || []).filter(p =>
      !QE.data.category || p.category === QE.data.category)
    const all = (state.products || [])
    const list = filtered.length > 0 ? filtered : all
    stepContent = `
      <div style="font-size:18px;font-weight:700;color:var(--text);margin-bottom:16px;">
        <i class="fas fa-drumstick-bite" style="color:#f59e0b;margin-right:8px;"></i>品項
        <span style="font-size:13px;color:var(--text-dim);font-weight:400;margin-left:6px;">${QE.data.category}</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;max-height:240px;overflow-y:auto;margin-bottom:20px;">
        ${list.map(p => `
          <button onclick="QE.data.product_id=${p.id};QE.data.product_name='${p.name}';QE.data.prod_category='${p.category}';qeRender()"
            style="padding:12px 8px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;
                   border:2px solid ${QE.data.product_id===p.id?'#f59e0b':'var(--border)'};
                   background:${QE.data.product_id===p.id?'rgba(245,158,11,.15)':'var(--bg-3)'};
                   color:${QE.data.product_id===p.id?'#f59e0b':'var(--text-2)'};">
            ${p.name}
          </button>`).join('')}
      </div>`
  }

  // ── Step 5：重量 + 數量 ──
  else if (QE.step === 5) {
    stepContent = `
      <div style="font-size:18px;font-weight:700;color:var(--text);margin-bottom:16px;">
        <i class="fas fa-weight-hanging" style="color:#f59e0b;margin-right:8px;"></i>重量 &amp; 數量
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
        <div>
          <label style="font-size:13px;color:var(--text-dim);display:block;margin-bottom:6px;">總重量 (KG)</label>
          <input type="number" id="qe-kg" value="${QE.data.kg ?? ''}" placeholder="例：24.3"
            step="0.1" min="0" inputmode="decimal"
            style="width:100%;padding:14px;font-size:22px;font-weight:700;border-radius:12px;
                   background:var(--bg-3);border:2px solid var(--border);color:var(--text);
                   box-sizing:border-box;text-align:center;"
            oninput="QE.data.kg=parseFloat(this.value)||null; qeCalcTotal()">
        </div>
        <div>
          <label style="font-size:13px;color:var(--text-dim);display:block;margin-bottom:6px;">數量 (隻)</label>
          <input type="number" id="qe-qty" value="${QE.data.qty}" placeholder="1"
            min="1" inputmode="numeric"
            style="width:100%;padding:14px;font-size:22px;font-weight:700;border-radius:12px;
                   background:var(--bg-3);border:2px solid var(--border);color:var(--text);
                   box-sizing:border-box;text-align:center;"
            oninput="QE.data.qty=parseInt(this.value)||1">
        </div>
      </div>
      <!-- 拍照 OCR -->
      <div style="border:1px dashed var(--border);border-radius:12px;padding:12px;margin-bottom:16px;">
        <div style="font-size:13px;color:var(--text-dim);margin-bottom:8px;">
          <i class="fas fa-camera" style="margin-right:4px;"></i>或拍照讓 AI 讀取數字
        </div>
        <label style="cursor:pointer;">
          <input type="file" accept="image/*" capture="environment" style="display:none;"
            onchange="qeOcrImage(this)">
          <div style="padding:10px;background:var(--bg-3);border:1px solid var(--border);
                      border-radius:8px;text-align:center;font-size:14px;color:var(--text-2);">
            <i class="fas fa-camera" style="margin-right:6px;"></i>拍照識別
          </div>
        </label>
        <div id="qe-ocr-status" style="font-size:13px;color:var(--text-dim);margin-top:6px;min-height:16px;"></div>
      </div>`
  }

  // ── Step 6：單價 + 計算 ──
  else if (QE.step === 6) {
    const total = (QE.data.kg && QE.data.unit_price)
      ? Math.round(QE.data.kg * QE.data.unit_price) : null
    if (total !== null) QE.data.total_amount = total
    stepContent = `
      <div style="font-size:18px;font-weight:700;color:var(--text);margin-bottom:16px;">
        <i class="fas fa-dollar-sign" style="color:#f59e0b;margin-right:8px;"></i>單價
      </div>
      <input type="number" id="qe-price" value="${QE.data.unit_price ?? ''}" placeholder="例：84"
        step="0.5" min="0" inputmode="decimal"
        style="width:100%;padding:16px;font-size:24px;font-weight:700;border-radius:12px;
               background:var(--bg-3);border:2px solid var(--border);color:var(--text);
               box-sizing:border-box;text-align:center;margin-bottom:14px;"
        oninput="QE.data.unit_price=parseFloat(this.value)||null; qeCalcTotal()">

      <!-- 自動計算結果 -->
      <div id="qe-calc-box" style="background:var(--bg-3);border-radius:12px;padding:16px;margin-bottom:16px;">
        <div style="font-size:13px;color:var(--text-dim);margin-bottom:8px;">自動計算</div>
        <div style="display:flex;align-items:center;gap:8px;font-size:16px;color:var(--text-2);">
          <span id="qe-calc-kg">${QE.data.kg ?? '?'} KG</span>
          <span>×</span>
          <span id="qe-calc-price">$${QE.data.unit_price ?? '?'}</span>
          <span>=</span>
          <span id="qe-calc-total" style="font-size:22px;font-weight:900;color:#f59e0b;">
            ${QE.data.total_amount ? '$' + fmt(QE.data.total_amount, 0) : '—'}
          </span>
        </div>
      </div>
      <!-- 付款狀態 -->
      <div style="display:flex;gap:8px;margin-bottom:8px;">
        ${(QE.data.type === 'sales' ? ['待付款','已付款'] : ['未付','已付']).map(s => `
          <button onclick="QE.data.pay_status='${s}';qeRender()"
            style="flex:1;padding:10px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;
                   border:2px solid ${QE.data.pay_status===s?'#f59e0b':'var(--border)'};
                   background:${QE.data.pay_status===s?'rgba(245,158,11,.15)':'var(--bg-3)'};
                   color:${QE.data.pay_status===s?'#f59e0b':'var(--text-2)'};">${s}</button>`).join('')}
      </div>`
  }

  // ── Step 7：確認 ──
  else if (QE.step === 7) {
    const isSales = QE.data.type === 'sales'
    stepContent = `
      <div style="font-size:18px;font-weight:700;color:var(--text);margin-bottom:16px;">
        <i class="fas fa-check-circle" style="color:#22c55e;margin-right:8px;"></i>確認送出
      </div>
      <div style="background:var(--bg-3);border-radius:14px;padding:16px;margin-bottom:20px;">
        <table style="width:100%;font-size:14px;border-collapse:collapse;">
          <tr><td style="padding:6px 0;color:var(--text-dim);width:80px;">類型</td>
              <td style="padding:6px 0;font-weight:700;color:var(--text);">${isSales ? '📤 出貨' : '📥 進貨'}</td></tr>
          <tr><td style="padding:6px 0;color:var(--text-dim);">日期</td>
              <td style="padding:6px 0;font-weight:700;color:var(--text);">${QE.data.date}</td></tr>
          <tr><td style="padding:6px 0;color:var(--text-dim);">${isSales ? '客戶' : '廠商'}</td>
              <td style="padding:6px 0;font-weight:700;color:var(--text);">${QE.data.party_name || '—'}</td></tr>
          <tr><td style="padding:6px 0;color:var(--text-dim);">品項</td>
              <td style="padding:6px 0;font-weight:700;color:var(--text);">${QE.data.product_name || '—'}</td></tr>
          <tr><td style="padding:6px 0;color:var(--text-dim);">類別</td>
              <td style="padding:6px 0;font-weight:700;color:var(--text);">${QE.data.category}</td></tr>
          <tr><td style="padding:6px 0;color:var(--text-dim);">重量</td>
              <td style="padding:6px 0;font-weight:700;color:var(--text);">${QE.data.kg} KG × ${QE.data.qty} 隻</td></tr>
          <tr><td style="padding:6px 0;color:var(--text-dim);">單價</td>
              <td style="padding:6px 0;font-weight:700;color:var(--text);">$${QE.data.unit_price}/KG</td></tr>
          <tr style="border-top:1px solid var(--border);">
            <td style="padding:10px 0 4px;color:var(--text-dim);font-size:15px;">金額</td>
            <td style="padding:10px 0 4px;font-size:24px;font-weight:900;color:#f59e0b;">
              $${fmt(QE.data.total_amount, 0)}
            </td></tr>
          <tr><td style="padding:4px 0;color:var(--text-dim);">狀態</td>
              <td style="padding:4px 0;font-weight:700;color:var(--text);">${QE.data.pay_status}</td></tr>
        </table>
      </div>
      <button onclick="qeSubmit()"
        style="width:100%;padding:16px;border:none;border-radius:14px;
               background:linear-gradient(135deg,#22c55e,#16a34a);
               color:#fff;font-size:18px;font-weight:800;cursor:pointer;letter-spacing:1px;">
        <i class="fas fa-check"></i> 確認送出
      </button>`
  }

  // 導航按鈕
  const navHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:16px;padding-top:12px;border-top:1px solid var(--border);">
      <button onclick="${QE.step > 1 ? 'QE.step--; qeRender()' : 'closeQuickEntry()'}"
        style="padding:10px 18px;border-radius:10px;border:1px solid var(--border);
               background:var(--bg-3);color:var(--text-2);font-size:15px;cursor:pointer;">
        ${QE.step > 1 ? '<i class="fas fa-arrow-left"></i> 上一步' : '<i class="fas fa-times"></i> 關閉'}
      </button>
      ${QE.step < QE.total ? `
      <button onclick="qeNext()"
        style="padding:10px 24px;border-radius:10px;border:none;
               background:#f59e0b;color:#fff;font-size:15px;font-weight:700;cursor:pointer;">
        下一步 <i class="fas fa-arrow-right"></i>
      </button>` : ''}
    </div>`

  body.innerHTML = `
    <!-- 進度步驟 -->
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px;padding:0 4px;">
      ${stepsHTML}
    </div>
    ${stepContent}
    ${navHTML}
  `
}

function qeCalcTotal() {
  const kg    = QE.data.kg
  const price = QE.data.unit_price
  const total = (kg && price) ? Math.round(kg * price) : null
  QE.data.total_amount = total

  // 即時更新顯示（Step 6 才有這些元素）
  const tEl = document.getElementById('qe-calc-total')
  const kEl = document.getElementById('qe-calc-kg')
  const pEl = document.getElementById('qe-calc-price')
  if (tEl) tEl.textContent = total ? '$' + fmt(total, 0) : '—'
  if (kEl) kEl.textContent = (kg ?? '?') + ' KG'
  if (pEl) pEl.textContent = '$' + (price ?? '?')
}

function qeNext() {
  // 讀取當前 step 的輸入值
  if (QE.step === 2) {
    const d = document.getElementById('qe-date')?.value
    if (!d) { showToast('請選擇日期', 'error'); return }
    QE.data.date = d
  }
  if (QE.step === 3) {
    if (!QE.data.party_id) { showToast('請選擇' + (QE.data.type === 'sales' ? '客戶' : '廠商'), 'error'); return }
  }
  if (QE.step === 4) {
    if (!QE.data.product_id) { showToast('請選擇品項', 'error'); return }
  }
  if (QE.step === 5) {
    const kg  = parseFloat(document.getElementById('qe-kg')?.value || '') || null
    const qty = parseInt(document.getElementById('qe-qty')?.value || '') || 1
    if (!kg) { showToast('請輸入重量', 'error'); return }
    QE.data.kg  = kg
    QE.data.qty = qty
  }
  if (QE.step === 6) {
    const price = parseFloat(document.getElementById('qe-price')?.value || '') || null
    if (!price) { showToast('請輸入單價', 'error'); return }
    QE.data.unit_price   = price
    QE.data.total_amount = Math.round((QE.data.kg || 0) * price)
  }
  QE.step++
  qeRender()
}

async function qeOcrImage(input) {
  const file = input?.files?.[0]
  if (!file) return
  const statusEl = document.getElementById('qe-ocr-status')
  if (statusEl) statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> AI 識別中...'

  const reader = new FileReader()
  reader.onload = async (e) => {
    const base64 = e.target.result.split(',')[1]
    const data = await api('POST', '/ocr-recognize', { image: base64, media_type: file.type || 'image/jpeg' })
    if (!data || data.error) {
      if (statusEl) statusEl.innerHTML = '❌ 識別失敗：' + (data?.error || '未知錯誤')
      return
    }
    const weights = data.weights || []
    if (weights.length === 0) {
      if (statusEl) statusEl.innerHTML = '⚠️ 找不到數字，請手動輸入'
      return
    }
    // 取第一筆填入 KG，數量為所有筆數
    const totalKg = weights.reduce((s, w) => s + (w.kg || 0), 0)
    const totalQty = weights.reduce((s, w) => s + (w.qty || 1), 0)
    QE.data.kg  = Math.round(totalKg * 10) / 10
    QE.data.qty = totalQty
    const kgEl  = document.getElementById('qe-kg')
    const qtyEl = document.getElementById('qe-qty')
    if (kgEl)  kgEl.value  = QE.data.kg
    if (qtyEl) qtyEl.value = QE.data.qty
    if (statusEl) statusEl.innerHTML = `✅ 識別 ${weights.length} 筆，合計 ${QE.data.kg} KG × ${totalQty} 隻`
    qeCalcTotal()
  }
  reader.readAsDataURL(file)
}

async function qeSubmit() {
  const d = QE.data
  if (!d.kg || !d.unit_price || !d.product_id || !d.party_id) {
    showToast('資料不完整，請檢查', 'error'); return
  }

  let res
  if (d.type === 'sales') {
    res = await api('POST', '/sales', {
      date:           d.date,
      customer_id:    d.party_id,
      customer_name:  d.party_name,
      product_id:     d.product_id,
      product_name:   d.product_name,
      category:       d.category || d.prod_category,
      spec:           d.kg,
      unit:           'KG',
      quantity:       d.qty,
      qty_unit:       '隻',
      unit_price:     d.unit_price,
      total_amount:   d.total_amount,
      payment_status: d.pay_status,
      note:           '[快速輸入]'
    })
  } else {
    res = await api('POST', '/purchases', {
      date:           d.date,
      supplier_id:    d.party_id,
      supplier_name:  d.party_name,
      product_id:     d.product_id,
      product_name:   d.product_name,
      category:       d.category || d.prod_category,
      spec:           d.kg,
      total_weight:   d.kg,
      unit:           'KG',
      quantity:       d.qty,
      qty_unit:       '隻',
      cost_price:     d.unit_price,
      total_amount:   d.total_amount,
      payment_status: d.pay_status,
      note:           '[快速輸入]'
    })
  }

  if (res?.id || res?.success) {
    closeQuickEntry()
    showToast(`✅ 已新增${d.type === 'sales' ? '出貨' : '進貨'}：${d.product_name} ${d.kg}KG $${fmt(d.total_amount,0)}`)
    // 跳到對應頁面
    showPage(d.type === 'sales' ? 'sales' : 'purchases')
  } else {
    showToast('送出失敗：' + (res?.error || '請重試'), 'error')
  }
}

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

// 手機浮動按鈕：在小螢幕顯示
function initFab() {
  const fab = document.getElementById('fab-quick')
  if (!fab) return
  if (window.innerWidth <= 768) {
    fab.style.display = 'flex'
  }
  window.addEventListener('resize', () => {
    fab.style.display = window.innerWidth <= 768 ? 'flex' : 'none'
  })
}

// Start
init()
initFab()
