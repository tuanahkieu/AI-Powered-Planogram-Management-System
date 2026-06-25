// ============================================================
//  SHARED.JS — Dùng chung cho tất cả các trang
// ============================================================

const API = 'http://127.0.0.1:5002';

// ─── Active nav item theo URL hiện tại ──────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const current = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-item[href]').forEach(item => {
        if (item.getAttribute('href') === current) {
            item.classList.add('active');
        }
    });
});

// ─── Shared state ─────────────────────────────────────────────
let customPlanogram = { shelves: [] };
let allFetchedPlanograms = [];

// ─── Load Stores ──────────────────────────────────────────────────────────────
async function loadStores() {
    try {
        const res = await fetch(`${API}/api/stores`);
        const data = await res.json();
        if (data.success && data.stores) {
            const sels = [document.getElementById('storeSelect'), document.getElementById('pogStoreSelector')];
            sels.forEach(sel => {
                if (!sel) return;
                const prev = sel.value;
                sel.innerHTML = '<option value="">-- Chọn cửa hàng --</option>';
                data.stores.forEach(store => {
                    const opt = document.createElement('option');
                    opt.value = store.store_id;
                    opt.textContent = store.name;
                    if (store.store_id === prev) opt.selected = true;
                    sel.appendChild(opt);
                });
            });
        }
    } catch (e) {
        console.warn('Không thể tải danh sách cửa hàng:', e.message);
    }
}

// ─── Load danh sách planogram (dropdown Kiểm Tra) ─────────────
async function loadPlanogramFiles() {
    const sel = document.getElementById('planogramFileSelect');
    if (!sel) return;
    try {
        const res  = await fetch(`${API}/api/planograms`);
        const data = await res.json();
        if (data.success && data.files.length > 0) {
            allFetchedPlanograms = [];
            if (data.source === 'mongodb' && data.data) {
                allFetchedPlanograms = data.data.map((item) => ({
                    value: item.name + '.json',
                    text: item.display_name,
                    store_id: item.store_id
                }));
            } else {
                allFetchedPlanograms = data.files.map((f) => ({
                    value: f,
                    text: f.replace('planogram_', '').replace('.json', '').replace(/_/g, ' '),
                    store_id: null
                }));
            }
            renderPlanogramDropdown();
        }
    } catch (e) {
        console.warn('Không thể tải danh sách planogram:', e.message);
    }
}

function renderPlanogramDropdown() {
    const sel = document.getElementById('planogramFileSelect');
    const storeSel = document.getElementById('storeSelect');
    if (!sel) return;

    const selectedStore = storeSel ? storeSel.value : '';
    const prev = sel.value;
    sel.innerHTML = '<option value="">-- Chọn kệ --</option>';

    const filtered = selectedStore 
        ? allFetchedPlanograms.filter(p => p.store_id === selectedStore)
        : allFetchedPlanograms;

    filtered.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.value;
        opt.textContent = item.text;
        if (opt.value === prev) opt.selected = true;
        sel.appendChild(opt);
    });
}

// Lắng nghe sự kiện đổi cửa hàng
document.addEventListener('DOMContentLoaded', () => {
    loadStores();
    const storeSel = document.getElementById('storeSelect');
    if (storeSel) {
        storeSel.addEventListener('change', renderPlanogramDropdown);
    }
});

// ─── Lưu / load danh mục sản phẩm ────────────────────────────
async function saveProductsToMongo(products) {
    try {
        await fetch(`${API}/api/products`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ products })
        });
    } catch (e) {
        console.warn('Không thể lưu products lên MongoDB:', e.message);
    }
}

async function loadProductsFromMongo(pogState, renderCatalogFn) {
    // Palette màu đẹp — dùng chung với planogram.js
    const PALETTE = [
        '#ef4444','#f97316','#f59e0b','#eab308','#84cc16',
        '#22c55e','#10b981','#14b8a6','#06b6d4','#0ea5e9',
        '#3b82f6','#6366f1','#8b5cf6','#a855f7','#ec4899',
        '#f43f5e','#0891b2','#059669','#7c3aed','#db2777',
    ];
    let _ci = 0;
    const nextColor = () => { const c = PALETTE[_ci % PALETTE.length]; _ci++; return c; };

    try {
        const res  = await fetch(`${API}/api/products`);
        const data = await res.json();
        if (data.success && data.products.length > 0) {
            // Gán màu ngẫu nhiên cho sản phẩm chưa có màu hoặc còn màu mặc định cũ
            const DEFAULT_COLORS = new Set(['#6366f1', '#6b7280', '', null, undefined]);
            pogState.products = data.products.map(p => ({
                ...p,
                color: DEFAULT_COLORS.has(p.color) ? nextColor() : p.color
            }));
            renderCatalogFn();
        }
    } catch (e) {
        console.warn('Không thể tải products từ MongoDB:', e.message);
    }
}

