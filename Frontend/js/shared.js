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

// ─── Load danh sách planogram (dropdown Kiểm Tra) ─────────────
async function loadPlanogramFiles() {
    const sel = document.getElementById('planogramFileSelect');
    if (!sel) return;
    try {
        const res  = await fetch(`${API}/api/planograms`);
        const data = await res.json();
        if (data.success && data.files.length > 0) {
            const prev = sel.value;
            sel.innerHTML = '<option value="">-- Chọn kệ --</option>';
            if (data.source === 'mongodb' && data.data) {
                data.data.forEach(item => {
                    const opt = document.createElement('option');
                    opt.value       = item.name + '.json';
                    opt.textContent = item.display_name;
                    if (opt.value === prev) opt.selected = true;
                    sel.appendChild(opt);
                });
            } else {
                data.files.forEach(f => {
                    const opt = document.createElement('option');
                    opt.value       = f;
                    opt.textContent = f.replace('planogram_', '').replace('.json', '').replace(/_/g, ' ');
                    if (f === prev) opt.selected = true;
                    sel.appendChild(opt);
                });
            }
        }
    } catch (e) {
        console.warn('Không thể tải danh sách planogram:', e.message);
    }
}

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
    try {
        const res  = await fetch(`${API}/api/products`);
        const data = await res.json();
        if (data.success && data.products.length > 0) {
            pogState.products = data.products;
            renderCatalogFn();
        }
    } catch (e) {
        console.warn('Không thể tải products từ MongoDB:', e.message);
    }
}
