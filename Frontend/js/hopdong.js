// ============================================================
//  HOPDONG.JS — Quản lý hợp đồng nhãn hàng
// ============================================================

const BRAND_COLORS = [
    'linear-gradient(135deg,#6366f1,#4f46e5)',
    'linear-gradient(135deg,#ef4444,#dc2626)',
    'linear-gradient(135deg,#f59e0b,#d97706)',
    'linear-gradient(135deg,#10b981,#059669)',
    'linear-gradient(135deg,#3b82f6,#1d4ed8)',
    'linear-gradient(135deg,#8b5cf6,#7c3aed)',
    'linear-gradient(135deg,#ec4899,#db2777)',
    'linear-gradient(135deg,#14b8a6,#0d9488)',
];

// ─── State ──────────────────────────────────────────────────
let _stores      = [];
let _contracts   = [];
let _products    = [];
let _planograms  = [];
let _selectedPlanogram = null;  // { name, display_name, shelves: [[...]] }

// ─── Popup wizard state ──────────────────────────────────────
const wizard = { step: 1, storeId: null, storeName: null, brand: null, shelfId: null, shelfName: null, rows: [] };

// ─── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await Promise.all([loadContracts(), loadProducts(), loadPlanogramList(), loadStores()]);
    bindEvents();
});

async function loadStores() {
    try {
        const res = await fetch(`${API}/api/stores`);
        const data = await res.json();
        if (data.success) { _stores = data.stores || []; }
    } catch (e) { console.warn('Không thể tải cửa hàng:', e.message); }
}

// ─── API calls ──────────────────────────────────────────────
async function loadContracts() {
    try {
        const res  = await fetch(`${API}/api/contracts`);
        const data = await res.json();
        if (data.success) { _contracts = data.contracts; renderContracts(); }
    } catch (e) { console.warn('Không thể tải hợp đồng:', e.message); }
}

async function loadProducts() {
    try {
        const res  = await fetch(`${API}/api/products`);
        const data = await res.json();
        if (data.success) { _products = data.products; }
    } catch (e) { console.warn('Không thể tải sản phẩm:', e.message); }
}

async function loadPlanogramList(storeId = null) {
    try {
        const url = storeId ? `${API}/api/planograms?store_id=${storeId}` : `${API}/api/planograms`;
        const res  = await fetch(url);
        const data = await res.json();
        if (data.success && data.data) {
            _planograms = data.data;
        } else if (data.success && data.files) {
            _planograms = data.files.map(f => ({ name: f.replace('.json',''), display_name: f.replace('.json','') }));
        }
    } catch (e) { console.warn('Không thể tải danh sách kệ:', e.message); }
}

async function loadPlanogramDetail(name) {
    try {
        const res  = await fetch(`${API}/api/planograms/${name}`);
        const data = await res.json();
        if (data.success) return data.planogram;
    } catch (e) { console.warn('Không thể tải chi tiết kệ:', e.message); }
    return null;
}

// ─── Render contracts list ───────────────────────────────────
function renderContracts() {
    const grid = document.getElementById('contracts-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (_contracts.length === 0) {
        grid.innerHTML = `
            <div class="empty-contracts">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                </svg>
                <p>Chưa có hợp đồng nào</p>
                <span>Nhấn "+ Thêm hợp đồng" để bắt đầu</span>
            </div>`;
        return;
    }

    _contracts.forEach((c, i) => {
        const statusClass = c.status === 'active' ? 'active' : c.status === 'expired' ? 'expired' : 'pending';
        const statusText  = c.status === 'active' ? 'Còn hiệu lực' : c.status === 'expired' ? 'Hết hạn' : 'Chờ gia hạn';
        const color       = c.brand_color || BRAND_COLORS[i % BRAND_COLORS.length];
        const letter      = (c.brand_name || '?')[0].toUpperCase();
        const endDate     = c.end_date ? new Date(c.end_date).toLocaleDateString('vi-VN') : '—';
        const rowsText    = Array.isArray(c.rows) ? `Tầng ${c.rows.map(r => r+1).join(', ')}` : '';
        const storeText   = c.store_name ? `${c.store_name} · ` : '';

        const card = document.createElement('div');
        card.className = 'contract-card';
        card.innerHTML = `
            <div class="contract-logo" style="background:${color}">${letter}</div>
            <div class="contract-info">
                <h4>${c.brand_name || 'Không tên'}</h4>
                <p>${storeText}${c.shelf_name || ''} · ${rowsText}</p>
                <span class="contract-tag ${statusClass}">${statusText}</span>
            </div>
            <div class="contract-date">
                <span>Hết hạn</span>
                <strong>${endDate}</strong>
            </div>
            <button class="contract-delete-btn" data-id="${c._id}" title="Xóa hợp đồng">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14H6L5 6"/>
                    <path d="M10 11v6M14 11v6"/>
                    <path d="M9 6V4h6v2"/>
                </svg>
            </button>`;
        grid.appendChild(card);
    });

    // Bind delete buttons
    grid.querySelectorAll('.contract-delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            if (!confirm('Xóa hợp đồng này?')) return;
            try {
                const res = await fetch(`${API}/api/contracts/${id}`, { method: 'DELETE' });
                const d   = await res.json();
                if (d.success) { await loadContracts(); showToast('Đã xóa hợp đồng', 'success'); }
                else showToast(d.error || 'Lỗi xóa', 'error');
            } catch (e) { showToast('Lỗi kết nối', 'error'); }
        });
    });
}

// ─── Popup open / close ──────────────────────────────────────
function openAddContractPopup() {
    wizard.step = 1; wizard.storeId = null; wizard.storeName = null; wizard.brand = null; wizard.shelfId = null;
    wizard.shelfName = null; wizard.rows = [];
    document.getElementById('contract-popup-overlay').classList.add('active');
    renderWizardStep();
}

function closePopup() {
    document.getElementById('contract-popup-overlay').classList.remove('active');
}

function bindEvents() {
    document.getElementById('btn-add-contract').addEventListener('click', openAddContractPopup);
    document.getElementById('contract-popup-overlay').addEventListener('click', e => {
        if (e.target === e.currentTarget) closePopup();
    });
    document.getElementById('popup-close-btn').addEventListener('click', closePopup);
}

// ─── Wizard rendering ────────────────────────────────────────
function renderWizardStep() {
    // Update step indicators
    for (let i = 1; i <= 4; i++) {
        const dot = document.getElementById(`wizard-step-${i}`);
        if (dot) {
            dot.classList.toggle('active', i === wizard.step);
            dot.classList.toggle('done', i < wizard.step);
        }
    }
    const label = ['Chọn cửa hàng', 'Chọn nhãn hàng', 'Chọn kệ hàng', 'Chọn tầng & ngày'][wizard.step - 1];
    document.getElementById('wizard-step-label').textContent = label;

    const body = document.getElementById('wizard-body');
    if (wizard.step === 1) renderStep1(body);
    else if (wizard.step === 2) renderStep2(body);
    else if (wizard.step === 3) renderStep3(body);
    else renderStep4(body);
}

// Step 1 — Chọn cửa hàng
function renderStep1(body) {
    if (_stores.length === 0) {
        body.innerHTML = `
            <div class="wizard-empty">
                <p>Không tìm thấy cửa hàng trong hệ thống</p>
            </div>
            <div class="wizard-footer">
                <button class="btn btn-secondary" onclick="closePopup()">Đóng</button>
            </div>`;
        return;
    }

    const storeCards = _stores.map(s => {
        const isActive = wizard.storeId === s.store_id;
        return `
            <div class="shelf-card ${isActive ? 'selected' : ''}" onclick="selectStore('${s.store_id}','${s.name.replace(/'/g,"\\'")}')">
                <div class="shelf-card-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                        <polyline points="9 22 9 12 15 12 15 22"></polyline>
                    </svg>
                </div>
                <span class="shelf-card-name">${s.name}</span>
                ${isActive ? '<div class="shelf-check">✓</div>' : ''}
            </div>`;
    }).join('');

    body.innerHTML = `
        <div class="shelf-grid" id="store-grid">${storeCards}</div>
        <div class="wizard-footer">
            <button class="btn btn-secondary" onclick="closePopup()">Hủy</button>
            <button class="btn btn-primary" id="step1-next" ${wizard.storeId ? '' : 'disabled'} onclick="goStep(2)">Tiếp theo →</button>
        </div>`;
}

function selectStore(id, name) {
    wizard.storeId = id; wizard.storeName = name;
    wizard.shelfId = null; wizard.shelfName = null; wizard.rows = [];
    document.querySelectorAll('#store-grid .shelf-card').forEach(c => c.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
    const btn = document.getElementById('step1-next');
    if (btn) btn.disabled = false;
}

// Step 2 — Chọn brand từ danh sách sản phẩm trong DB
function renderStep2(body) {
    // Unique brands derived from products
    const brands = _products.length > 0
        ? [...new Map(_products.map(p => [p.name, p])).values()]
        : [];

    if (brands.length === 0) {
        body.innerHTML = `
            <div class="wizard-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px;color:var(--text-muted)">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <p>Không tìm thấy sản phẩm trong cơ sở dữ liệu</p>
                <span style="font-size:.8rem;color:var(--text-muted)">Hãy thêm sản phẩm qua trang Tạo Planogram trước</span>
            </div>
            <div class="wizard-manual">
                <label class="form-label">Nhập tên nhãn hàng thủ công</label>
                <input id="manual-brand-input" class="form-input" type="text" placeholder="VD: Coca-Cola Vietnam" autofocus>
            </div>
            <div class="wizard-footer">
                <button class="btn btn-secondary" onclick="goStep(1)">← Quay lại</button>
                <button class="btn btn-primary" onclick="selectManualBrand()">Tiếp theo →</button>
            </div>`;
        return;
    }

    const searchHtml = `
        <div class="wizard-search">
            <input id="brand-search" class="form-input" type="text" placeholder="🔍 Tìm kiếm nhãn hàng..." oninput="filterBrands(this.value)">
        </div>`;

    const brandCards = brands.map((p, i) => {
        const color  = p.color || BRAND_COLORS[i % BRAND_COLORS.length];
        const letter = (p.name || '?')[0].toUpperCase();
        const isActive = wizard.brand && wizard.brand.name === p.name;
        return `
            <div class="brand-card ${isActive ? 'selected' : ''}" data-name="${p.name}" data-color="${color}"
                 onclick="selectBrand('${p.name.replace(/'/g,"\\'")}','${color}')">
                <div class="brand-avatar" style="background:${color}">${letter}</div>
                <div class="brand-card-info">
                    <span class="brand-card-name">${p.name}</span>
                    ${p.code ? `<span class="brand-card-code">${p.code}</span>` : ''}
                </div>
                ${isActive ? '<div class="brand-check">✓</div>' : ''}
            </div>`;
    }).join('');

    body.innerHTML = `
        ${searchHtml}
        <div class="brand-grid" id="brand-grid">${brandCards}</div>
        <div class="wizard-footer">
            <button class="btn btn-secondary" onclick="goStep(1)">← Quay lại</button>
            <button class="btn btn-primary" id="step2-next" ${wizard.brand ? '' : 'disabled'} onclick="goStep(3)">Tiếp theo →</button>
        </div>`;
}

function filterBrands(q) {
    document.querySelectorAll('.brand-card').forEach(card => {
        const name = card.dataset.name.toLowerCase();
        card.style.display = name.includes(q.toLowerCase()) ? '' : 'none';
    });
}

function selectBrand(name, color) {
    wizard.brand = { name, color };
    document.querySelectorAll('.brand-card').forEach(c => {
        const match = c.dataset.name === name;
        c.classList.toggle('selected', match);
        c.innerHTML = c.innerHTML.replace(/<div class="brand-check">.*?<\/div>/g, '');
        if (match) c.innerHTML += '<div class="brand-check">✓</div>';
    });
    const btn = document.getElementById('step2-next');
    if (btn) btn.disabled = false;
}

function selectManualBrand() {
    const val = document.getElementById('manual-brand-input')?.value.trim();
    if (!val) { showToast('Vui lòng nhập tên nhãn hàng', 'error'); return; }
    wizard.brand = { name: val, color: BRAND_COLORS[0] };
    goStep(3);
}

// Step 3 — Chọn kệ
async function renderStep3(body) {
    body.innerHTML = `<div class="wizard-loading">Đang tải danh sách kệ...</div>`;
    await loadPlanogramList(wizard.storeId);

    if (_planograms.length === 0) {
        body.innerHTML = `
            <div class="wizard-empty">
                <p>Chưa có kệ nào trong hệ thống</p>
                <span>Hãy tạo kệ trước qua trang Tạo Planogram</span>
            </div>
            <div class="wizard-footer">
                <button class="btn btn-secondary" onclick="goStep(2)">← Quay lại</button>
                <button class="btn btn-secondary" onclick="closePopup()">Đóng</button>
            </div>`;
        return;
    }

    const shelfCards = _planograms.map(p => {
        const isActive = wizard.shelfId === p.name;
        return `
            <div class="shelf-card ${isActive ? 'selected' : ''}" onclick="selectShelf('${p.name}','${(p.display_name || p.name).replace(/'/g,"\\'")}')">
                <div class="shelf-card-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/>
                        <line x1="3" y1="18" x2="21" y2="18"/><line x1="5" y1="6" x2="5" y2="18"/>
                        <line x1="19" y1="6" x2="19" y2="18"/>
                    </svg>
                </div>
                <span class="shelf-card-name">${p.display_name || p.name}</span>
                ${isActive ? '<div class="shelf-check">✓</div>' : ''}
            </div>`;
    }).join('');

    body.innerHTML = `
        <div class="shelf-grid" id="shelf-grid">${shelfCards}</div>
        <div class="wizard-footer">
            <button class="btn btn-secondary" onclick="goStep(2)">← Quay lại</button>
            <button class="btn btn-primary" id="step3-next" ${wizard.shelfId ? '' : 'disabled'} onclick="goStep(4)">Tiếp theo →</button>
        </div>`;
}

function selectShelf(id, name) {
    wizard.shelfId = id; wizard.shelfName = name; wizard.rows = [];
    document.querySelectorAll('.shelf-card').forEach(c => c.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
    const btn = document.getElementById('step3-next');
    if (btn) btn.disabled = false;
}

// Step 4 — Chọn tầng + ngày
async function renderStep4(body) {
    body.innerHTML = `<div class="wizard-loading">Đang tải thông tin kệ...</div>`;
    _selectedPlanogram = await loadPlanogramDetail(wizard.shelfId);

    const shelves = _selectedPlanogram?.shelves || [];
    const today   = new Date().toISOString().split('T')[0];
    const nextYear = new Date(Date.now() + 365*86400000).toISOString().split('T')[0];

    let rowsHtml = '';
    if (shelves.length === 0) {
        rowsHtml = `<p class="text-muted" style="padding:.5rem 0">Kệ này chưa có tầng nào được cấu hình.</p>`;
    } else {
        rowsHtml = shelves.map((row, i) => {
            const preview = row.slice(0, 3).join(', ') + (row.length > 3 ? ` +${row.length-3}` : '');
            const isChecked = wizard.rows.includes(i);
            return `
                <label class="row-option ${isChecked ? 'checked' : ''}">
                    <input type="checkbox" value="${i}" ${isChecked ? 'checked' : ''} onchange="toggleRow(${i}, this)">
                    <div class="row-option-info">
                        <span class="row-option-title">Tầng ${i + 1}</span>
                        <span class="row-option-preview">${preview || 'Trống'}</span>
                    </div>
                    <div class="row-option-count">${row.length} sản phẩm</div>
                </label>`;
        }).join('');
    }

    body.innerHTML = `
        <div class="step3-section">
            <label class="form-label">Chọn tầng áp dụng *</label>
            <div class="rows-list">${rowsHtml}</div>
        </div>
        <div class="step3-grid">
            <div class="step3-section">
                <label class="form-label" for="start-date">Ngày bắt đầu</label>
                <input id="start-date" class="form-input" type="date" value="${today}">
            </div>
            <div class="step3-section">
                <label class="form-label" for="end-date">Ngày kết thúc *</label>
                <input id="end-date" class="form-input" type="date" value="${nextYear}">
            </div>
        </div>
        <div class="step3-section">
            <label class="form-label" for="contract-status">Trạng thái</label>
            <select id="contract-status" class="form-input">
                <option value="active">Còn hiệu lực</option>
                <option value="pending">Chờ xác nhận</option>
                <option value="expired">Hết hạn</option>
            </select>
        </div>
        <div class="wizard-footer">
            <button class="btn btn-secondary" onclick="goStep(3)">← Quay lại</button>
            <button class="btn btn-primary" onclick="submitContract()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                Lưu hợp đồng
            </button>
        </div>`;
}

function toggleRow(index, checkbox) {
    const label = checkbox.closest('.row-option');
    if (checkbox.checked) {
        if (!wizard.rows.includes(index)) wizard.rows.push(index);
        label.classList.add('checked');
    } else {
        wizard.rows = wizard.rows.filter(r => r !== index);
        label.classList.remove('checked');
    }
}

// ─── Navigation ──────────────────────────────────────────────
function goStep(n) {
    if (n === 2 && !wizard.storeId) { showToast('Vui lòng chọn cửa hàng', 'error'); return; }
    if (n === 3 && !wizard.brand) { showToast('Vui lòng chọn nhãn hàng', 'error'); return; }
    if (n === 4 && !wizard.shelfId) { showToast('Vui lòng chọn kệ hàng', 'error'); return; }
    wizard.step = n;
    renderWizardStep();
}

// ─── Submit ──────────────────────────────────────────────────
async function submitContract() {
    const endDate  = document.getElementById('end-date')?.value;
    const startDate = document.getElementById('start-date')?.value;
    const status   = document.getElementById('contract-status')?.value || 'active';

    if (!endDate) { showToast('Vui lòng chọn ngày kết thúc', 'error'); return; }
    if (wizard.rows.length === 0 && (_selectedPlanogram?.shelves?.length > 0)) {
        showToast('Vui lòng chọn ít nhất một tầng', 'error'); return;
    }

    const payload = {
        store_id:    wizard.storeId,
        store_name:  wizard.storeName,
        brand_name:  wizard.brand.name,
        brand_color: wizard.brand.color,
        brand_code:  wizard.brand.name.toLowerCase().replace(/\s+/g, '_'),
        shelf_id:    wizard.shelfId,
        shelf_name:  wizard.shelfName,
        rows:        wizard.rows,
        start_date:  startDate,
        end_date:    endDate,
        status,
    };

    const saveBtn = document.querySelector('#wizard-body .btn-primary');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Đang lưu...'; }

    try {
        const res  = await fetch(`${API}/api/contracts`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            closePopup();
            await loadContracts();
            showToast('✅ Hợp đồng đã được lưu!', 'success');
        } else {
            showToast(data.error || 'Lưu thất bại', 'error');
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Lưu hợp đồng'; }
        }
    } catch (e) {
        showToast('Lỗi kết nối tới server', 'error');
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Lưu hợp đồng'; }
    }
}

// ─── Toast notification ──────────────────────────────────────
function showToast(msg, type = 'info') {
    let toast = document.getElementById('hd-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'hd-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.className = `hd-toast hd-toast-${type} visible`;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.remove('visible'), 3000);
}
