// ============================================================
//  SIDEBAR NAVIGATION
// ============================================================
const navItems = document.querySelectorAll('.nav-item');
const pages   = document.querySelectorAll('.page');

function switchPage(pageId) {
    pages.forEach(p => p.classList.remove('active'));
    navItems.forEach(n => n.classList.remove('active'));

    const targetPage = document.getElementById('page-' + pageId);
    const targetNav  = document.getElementById('nav-' + pageId);
    if (targetPage) targetPage.classList.add('active');
    if (targetNav)  targetNav.classList.add('active');

    // Khi quay lại trang Tạo Planogram → tự động load kệ đang chịn
    if (pageId === 'planogram' && typeof window._pogReloadCurrentShelf === 'function') {
        window._pogReloadCurrentShelf();
    }
}

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        switchPage(item.dataset.page);
    });
});

// ============================================================
//  KIỂM TRA — Upload & Compliance
// ============================================================
const uploadArea             = document.getElementById('upload-area');
const fileInput              = document.getElementById('file-input');
const sourcePreviewContainer = document.getElementById('source-preview-container');
const sourcePreview          = document.getElementById('source-preview');
const analyzeBtn             = document.getElementById('analyze-btn');

const complianceResult   = document.getElementById('compliance-result');
const complianceStatus   = document.getElementById('compliance-status');
const complianceIssues   = document.getElementById('compliance-issues');
const issuesList         = document.getElementById('issues-list');
const complianceImage    = document.getElementById('compliance-image');
const expectedLayout     = document.getElementById('expected-layout');
const resultPlaceholder  = document.getElementById('result-placeholder');
const errorMessage       = document.getElementById('error-message');

let selectedFile = null;
const planogramFileSelect = document.getElementById('planogramFileSelect');

// ---- Load planogram list from backend (hiển thị TÊN KỆ thay vì tên file) ----
async function loadPlanogramFiles() {
    try {
        const res  = await fetch('http://127.0.0.1:5002/api/planograms');
        const data = await res.json();
        if (data.success && data.files.length > 0) {
            const prev = planogramFileSelect.value;
            planogramFileSelect.innerHTML = '<option value="">-- Chọn kệ --</option>';

            if (data.source === 'mongodb' && data.data) {
                // MongoDB: dùng display_name làm nhãn, name (slug) làm value
                data.data.forEach(item => {
                    const opt = document.createElement('option');
                    opt.value       = item.name + '.json';  // tương thích với backend load_planogram
                    opt.textContent = item.display_name;    // hiển thị tên kệ thực sự
                    if (opt.value === prev) opt.selected = true;
                    planogramFileSelect.appendChild(opt);
                });
            } else {
                // Fallback JSON file: bỏ prefix "planogram_ke_" khi hiển thị
                data.files.forEach(f => {
                    const opt = document.createElement('option');
                    opt.value       = f;
                    opt.textContent = f.replace('planogram_', '').replace('.json', '').replace(/_/g, ' ');
                    if (f === prev) opt.selected = true;
                    planogramFileSelect.appendChild(opt);
                });
            }
        }
    } catch (e) {
        console.warn('Không thể tải danh sách planogram:', e.message);
    }
}

loadPlanogramFiles();
document.getElementById('pogRefreshFiles').addEventListener('click', loadPlanogramFiles);

// --- Drag & Drop ---
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
    uploadArea.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); });
});
['dragenter', 'dragover'].forEach(evt => {
    uploadArea.addEventListener(evt, () => uploadArea.classList.add('dragover'));
});
['dragleave', 'drop'].forEach(evt => {
    uploadArea.addEventListener(evt, () => uploadArea.classList.remove('dragover'));
});
uploadArea.addEventListener('drop', e => handleFiles(e.dataTransfer.files));
fileInput.addEventListener('change', function () { handleFiles(this.files); });

function handleFiles(files) {
    if (files.length > 0 && files[0].type.startsWith('image/')) {
        selectedFile = files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            sourcePreview.src = e.target.result;
            uploadArea.classList.add('hidden');
            sourcePreviewContainer.classList.remove('hidden');
            analyzeBtn.disabled = false;

            // Reset results
            complianceResult && complianceResult.classList.add('hidden');
            resultPlaceholder.classList.remove('hidden');
            resultPlaceholder.querySelector('p').textContent = 'Sẵn sàng kiểm tra...';
            errorMessage.classList.add('hidden');
        };
        reader.readAsDataURL(selectedFile);
    }
}

// Click preview to re-upload
sourcePreviewContainer.addEventListener('click', () => fileInput.click());

// --- Submit to API ---
analyzeBtn.addEventListener('click', async () => {
    if (!selectedFile) return;

    analyzeBtn.classList.add('loading');
    analyzeBtn.disabled = true;
    complianceResult && complianceResult.classList.add('hidden');
    resultPlaceholder.classList.remove('hidden');
    resultPlaceholder.querySelector('p').textContent = 'AI đang so sánh kệ hàng với biểu đồ chuẩn...';
    errorMessage.classList.add('hidden');

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('planogram', JSON.stringify(customPlanogram));
    // Gửi tên file planogram đã chọn
    const selFile = planogramFileSelect ? planogramFileSelect.value : '';
    if (selFile) formData.append('planogram_file', selFile);

    try {
        const response = await fetch('http://127.0.0.1:5002/api/compliance', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(errText || `Server error: ${response.status}`);
        }

        const data = await response.json();

        complianceResult.classList.remove('hidden');
        resultPlaceholder.classList.add('hidden');

        if (data.status === 'PASSED') {
            complianceStatus.textContent = '✅ Tuân thủ trưng bày: Đạt 100%!';
            complianceStatus.style.color = '#6ee7b7';
            complianceIssues.classList.add('hidden');
        } else {
            complianceStatus.textContent = '❌ Tuân thủ trưng bày: Có lỗi!';
            complianceStatus.style.color = '#fca5a5';
            complianceIssues.classList.remove('hidden');
            issuesList.innerHTML = '';
            data.issues.forEach(issue => {
                const li = document.createElement('li');
                li.textContent = issue;
                issuesList.appendChild(li);
            });
        }

        complianceImage.src = data.annotated_image;
        complianceImage.classList.remove('hidden');
        expectedLayout.textContent = JSON.stringify(data.expected_layout, null, 2);

    } catch (error) {
        console.error('Error:', error);
        errorMessage.textContent = error.message.includes('Failed to fetch')
            ? 'Lỗi kết nối — Máy chủ backend có đang chạy không?'
            : error.message;
        errorMessage.classList.remove('hidden');
        resultPlaceholder.querySelector('p').textContent = 'Lỗi yêu cầu API.';
    } finally {
        analyzeBtn.classList.remove('loading');
        analyzeBtn.disabled = false;
    }
});

// ============================================================
//  Interactive Planogram Builder (internal state only)
// ============================================================
let customPlanogram = { shelves: [] };

// ---- Lưu danh mục sản phẩm lên MongoDB ----
async function saveProductsToMongo(products) {
    try {
        await fetch('http://127.0.0.1:5002/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ products })
        });
    } catch (e) {
        console.warn('Không thể lưu products lên MongoDB:', e.message);
    }
}

// ---- Khôi phục danh mục sản phẩm từ MongoDB khi khởi động ----
async function loadProductsFromMongo(pogState, renderCatalogFn) {
    try {
        const res  = await fetch('http://127.0.0.1:5002/api/products');
        const data = await res.json();
        if (data.success && data.products.length > 0) {
            pogState.products = data.products;
            renderCatalogFn();
        }
    } catch (e) {
        console.warn('Không thể tải products từ MongoDB:', e.message);
    }
}

// ============================================================
//  PLANOGRAM BUILDER — Full Implementation
// ============================================================
(function () {
    // ---- State ----
    const pogState = {
        shelves: [
            {
                id: 'shelf-1', name: 'Kệ 1',
                tiers: [
                    { id: 'tier-1-1', name: 'Tầng 1', maxProducts: 10, products: [] },
                    { id: 'tier-1-2', name: 'Tầng 2', maxProducts: 10, products: [] },
                    { id: 'tier-1-3', name: 'Tầng 3', maxProducts: 10, products: [] },
                ]
            }
        ],
        products: [
            { id: 'p1', name: 'Coca Cola',  code: 'POG-001', category: 'Đồ Uống', color: '#ef4444' },
            { id: 'p2', name: 'Pepsi',      code: 'POG-002', category: 'Đồ Uống', color: '#0ea5e9' },
            { id: 'p3', name: 'Mirinda',    code: 'POG-003', category: 'Đồ Uống', color: '#f59e0b' },
            { id: 'p4', name: 'Olong Tea',  code: 'POG-004', category: 'Đồ Uống', color: '#10b981' },
        ]
    };

    let selectedShelfId = pogState.shelves[0].id;
    let draggedProdId   = null;
    let selectedItemEl  = null;

    // DOM
    const shelfSelector = document.getElementById('pogShelfSelector');
    const fixture       = document.getElementById('pogFixture');
    const catalog       = document.getElementById('pogCatalog');
    const catalogCount  = document.getElementById('pogCatalogCount');
    const propsContent  = document.getElementById('pogPropsContent');
    const modal         = document.getElementById('pogModalAddProduct');
    const toast         = document.getElementById('pogToast');

    if (!shelfSelector) return;

    init();

    function init() {
        renderCatalog();
        renderShelfSelector();
        renderCanvas();
        showShelfProps(selectedShelfId);
        bindTopbarBtns();
        bindModal();
        // Khôi phục sản phẩm + kệ đã lưu từ MongoDB
        loadProductsFromMongo(pogState, renderCatalog);
        loadSavedShelves();
    }

    // ================================================================
    //  LOAD KỆ ĐÃ LƯĀU TỪ MONGODB
    // ================================================================

    // Fetch danh sách kệ từ MongoDB và thêm vào pogState nếu chưa có
    async function loadSavedShelves() {
        try {
            const res  = await fetch('http://127.0.0.1:5002/api/planograms');
            const data = await res.json();
            if (!data.success || !data.data || data.source !== 'mongodb') return;

            data.data.forEach(item => {
                // Ưu tiên tìm theo _mongoName trước (đã lưu từ session trước)
                let existing = pogState.shelves.find(s => s._mongoName === item.name);

                // Nếu chưa có, tìm theo tên hiển thị để merge (tránh trùng "Kệ 1")
                if (!existing) {
                    existing = pogState.shelves.find(s => s.name === item.display_name);
                }

                if (existing) {
                    // Merge: gắn slug MongoDB vào kệ đã có, chưa load sản phẩm
                    existing._mongoName = item.name;
                    existing._loaded    = false;
                } else {
                    // Kệ mới hoàn toàn → thêm vào state
                    const newId = 'shelf-mongo-' + item.name;
                    pogState.shelves.push({
                        id:         newId,
                        name:       item.display_name,
                        _mongoName: item.name,
                        _loaded:    false,
                        tiers: [
                            { id: `t-${newId}-1`, name: 'Tầng 1', maxProducts: 10, products: [] },
                            { id: `t-${newId}-2`, name: 'Tầng 2', maxProducts: 10, products: [] },
                            { id: `t-${newId}-3`, name: 'Tầng 3', maxProducts: 10, products: [] },
                        ]
                    });
                }
            });

            renderShelfSelector();
        } catch (e) {
            console.warn('Không thể tải danh sách kệ:', e.message);
        }
    }

    // Fetch đầy đủ dữ liệu của một kệ và hiển thị sản phẩm trên canvas
    async function loadShelfDataFromMongo(shelfId) {
        const shelf = pogState.shelves.find(s => s.id === shelfId);
        if (!shelf || !shelf._mongoName || shelf._loaded) return;

        try {
            const res  = await fetch(`http://127.0.0.1:5002/api/planograms/${shelf._mongoName}`);
            const data = await res.json();
            if (!data.success || !data.planogram) return;

            const savedTiers = data.planogram.shelves || [];  // list[list[str]]

            // Rebuild tiers: map tên sản phẩm → object từ catalog
            shelf.tiers = savedTiers.map((tierProducts, i) => {
                const tierId   = `t-${shelfId}-${i + 1}`;
                const products = tierProducts.map((name, j) => {
                    const found = pogState.products.find(p => p.name === name);
                    return found
                        ? { ...found, placedId: `pl-${tierId}-${j}` }
                        : { id: 'ph-' + Date.now() + j, name, code: '', category: '', color: '#6b7280', placedId: `pl-${tierId}-${j}` };
                });
                return {
                    id:          tierId,
                    name:        data.planogram.tier_names?.[i] || `Tầng ${i + 1}`,
                    maxProducts: Math.max(10, products.length),
                    products
                };
            });

            shelf._loaded = true;
            renderCanvas();
            showShelfProps(shelfId);
            showToast(`Đã tải kệ "${shelf.name}" từ MongoDB!`, 'success');
        } catch (e) {
            console.warn('Không thể tải dữ liệu kệ:', e.message);
        }
    }

    // ---- Sync customPlanogram for compliance (uses product names) ----
    function syncCustomPlanogram() {
        const shelf = pogState.shelves.find(s => s.id === selectedShelfId);
        if (!shelf) return;
        customPlanogram.shelves = shelf.tiers.map(t => t.products.map(p => p.name));
    }

    // ================================================================
    //  CATALOG — with delete button per product
    // ================================================================
    function renderCatalog() {
        catalog.innerHTML = '';
        catalogCount.textContent = pogState.products.length;
        pogState.products.forEach(prod => {
            const el = document.createElement('div');
            el.className = 'pog-cat-item';
            el.draggable = true;
            el.dataset.prodId = prod.id;
            el.innerHTML = `
                <div class="pog-cat-dot" style="background:${prod.color}"></div>
                <div class="pog-cat-info" style="flex:1;min-width:0;">
                    <span class="pog-cat-name">${prod.name}</span>
                    <span class="pog-cat-code">${prod.code}</span>
                </div>
                <button class="pog-cat-del-btn" data-prod-id="${prod.id}" title="Xóa sản phẩm">✕</button>`;

            el.addEventListener('dragstart', e => {
                draggedProdId = prod.id;
                e.dataTransfer.effectAllowed = 'copy';
                e.dataTransfer.setData('text/plain', prod.id);
            });

            el.querySelector('.pog-cat-del-btn').addEventListener('click', e => {
                e.stopPropagation();
                e.preventDefault();
                deleteCatalogProduct(prod.id);
            });

            catalog.appendChild(el);
        });
    }

    function deleteCatalogProduct(prodId) {
        pogState.products = pogState.products.filter(p => p.id !== prodId);
        pogState.shelves.forEach(shelf => {
            shelf.tiers.forEach(tier => {
                tier.products = tier.products.filter(p => p.id !== prodId);
            });
        });
        renderCatalog();
        renderCanvas();
        syncCustomPlanogram();
        saveProductsToMongo(pogState.products);  // ← tự động lưu lên MongoDB
        showToast('Đã xóa sản phẩm khỏi danh mục!', 'success');
    }

    // ================================================================
    //  SHELF SELECTOR
    // ================================================================
    function renderShelfSelector() {
        shelfSelector.innerHTML = '';
        pogState.shelves.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = s.name;
            if (s.id === selectedShelfId) opt.selected = true;
            shelfSelector.appendChild(opt);
        });
    }

    shelfSelector.addEventListener('change', () => {
        selectedShelfId = shelfSelector.value;
        renderCanvas();
        showShelfProps(selectedShelfId);
        // Nếu kệ lấy từ MongoDB chưa được load → tải sản phẩm
        loadShelfDataFromMongo(selectedShelfId);
    });

    // ================================================================
    //  CANVAS — tier min-width scales with maxProducts
    // ================================================================
    function renderCanvas() {
        fixture.innerHTML = '';
        const shelf = pogState.shelves.find(s => s.id === selectedShelfId);
        if (!shelf) return;

        shelf.tiers.forEach(tier => {
            const row = document.createElement('div');
            row.className = 'pog-tier-row';
            row.dataset.tierId = tier.id;

            const label = document.createElement('div');
            label.className = 'pog-tier-label';
            label.textContent = tier.name;

            const drop = document.createElement('div');
            drop.className = 'pog-tier-drop';
            drop.dataset.tierId = tier.id;
            // Exact width = 40px per slot + 16px padding
            const slotPx = 40;
            const tierW  = (tier.maxProducts * slotPx + 16) + 'px';
            drop.style.width    = tierW;
            drop.style.minWidth = 'unset';
            drop.style.flex     = 'none';
            // Row matches drop width so shelf-board ::after is same size
            row.style.width     = tierW;

            const badge = document.createElement('div');
            badge.className = 'pog-count-badge';
            badge.id = 'pgbadge-' + tier.id;
            badge.textContent = `${tier.products.length}/${tier.maxProducts}`;
            drop.appendChild(badge);

            tier.products.forEach(p => drop.appendChild(makePlacedEl(p, tier)));

            drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag-over'); });
            drop.addEventListener('dragleave', () => drop.classList.remove('drag-over'));
            drop.addEventListener('drop', e => {
                e.preventDefault();
                drop.classList.remove('drag-over');
                if (!draggedProdId) return;
                const prod = pogState.products.find(p => p.id === draggedProdId);
                if (!prod) return;
                if (tier.products.length >= tier.maxProducts) {
                    showToast(`Kệ đã đầy (tối đa ${tier.maxProducts} SP)`, 'error');
                    return;
                }
                const entry = { ...prod, placedId: 'pl-' + Date.now() };
                tier.products.push(entry);
                drop.insertBefore(makePlacedEl(entry, tier), badge);
                updateBadge(tier);
                syncCustomPlanogram();
                draggedProdId = null;
            });

            row.addEventListener('click', e => {
                if (e.target.closest('.pog-placed')) return;
                clearItemSel();
                document.querySelectorAll('.pog-tier-row').forEach(r => r.classList.remove('pog-selected'));
                row.classList.add('pog-selected');
                showShelfProps(selectedShelfId, tier.id);
            });

            row.appendChild(label);
            row.appendChild(drop);
            fixture.appendChild(row);
        });
    }

    function makePlacedEl(entry, tier) {
        const el = document.createElement('div');
        el.className = 'pog-placed';
        el.dataset.placedId = entry.placedId;
        el.innerHTML = `
            <div class="pog-placed-dot" style="background:${entry.color}"></div>
            <div class="pog-placed-name">${entry.name}</div>`;
        el.addEventListener('click', e => {
            e.stopPropagation();
            clearItemSel();
            selectedItemEl = el;
            el.classList.add('pog-item-selected');
            showProductProps(entry, tier);
        });
        return el;
    }

    function updateBadge(tier) {
        const b = document.getElementById('pgbadge-' + tier.id);
        if (b) b.textContent = `${tier.products.length}/${tier.maxProducts}`;
    }

    function clearItemSel() {
        if (selectedItemEl) { selectedItemEl.classList.remove('pog-item-selected'); selectedItemEl = null; }
    }

    document.addEventListener('click', e => {
        if (!e.target.closest('.pog-placed') && !e.target.closest('#pogPropsContent')) clearItemSel();
    });

    // ================================================================
    //  PROPERTIES — PLACED PRODUCT
    // ================================================================
    function showProductProps(entry, tier) {
        propsContent.innerHTML = `
            <div class="pog-prop-row"><span class="pog-prop-label">Tên</span><span class="pog-prop-value">${entry.name}</span></div>
            <div class="pog-prop-row"><span class="pog-prop-label">Mã SKU</span><span class="pog-prop-value">${entry.code}</span></div>
            <div class="pog-prop-row"><span class="pog-prop-label">Danh Mục</span><span class="pog-prop-value">${entry.category}</span></div>
            <div class="pog-prop-row"><span class="pog-prop-label">Tầng</span><span class="pog-prop-value">${tier.name}</span></div>
            <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem;">
                <div style="width:24px;height:24px;border-radius:50%;background:${entry.color};flex-shrink:0;"></div>
                <span style="font-size:0.78rem;color:var(--text-3);">Màu đại diện</span>
            </div>
            <button class="pog-danger-btn" id="pogBtnRemoveItem">🗑 Xóa Khỏi Tầng</button>`;

        document.getElementById('pogBtnRemoveItem').addEventListener('click', () => {
            const idx = tier.products.findIndex(p => p.placedId === entry.placedId);
            if (idx !== -1) tier.products.splice(idx, 1);
            if (selectedItemEl) { selectedItemEl.remove(); selectedItemEl = null; }
            updateBadge(tier);
            syncCustomPlanogram();
            showEmptyProps();
        });
    }

    // ================================================================
    //  PROPERTIES — SHELF CONFIG
    // ================================================================
    function showShelfProps(shelfId, activeTierId) {
        const shelf = pogState.shelves.find(s => s.id === shelfId);
        if (!shelf) return;

        const tierNamesHTML = shelf.tiers.map((t, i) => `
            <div class="pog-tier-nm-row">
                <span>${i+1}.</span>
                <input type="text" data-tier-id="${t.id}" value="${t.name}" placeholder="Tên tầng ${i+1}">
            </div>`).join('');

        const clearTierOptions = shelf.tiers.map(t =>
            `<option value="${t.id}">${t.name} (${t.products.length} SP)</option>`).join('');

        propsContent.innerHTML = `
            <div class="pog-cfg-form">
                <div class="pog-cfg-field">
                    <label class="pog-cfg-label">Tên kệ</label>
                    <input type="text" class="pog-input" id="cfgShelfName" value="${shelf.name}">
                </div>
                <hr class="pog-divider">
                <div class="pog-section-title">Cấu Hình Tầng</div>
                <div class="pog-cfg-field">
                    <label class="pog-cfg-label">Số tầng</label>
                    <input type="number" class="pog-input" id="cfgNumTiers" value="${shelf.tiers.length}" min="1" max="10">
                </div>
                <div class="pog-cfg-field">
                    <label class="pog-cfg-label">SP tối đa / tầng</label>
                    <input type="number" class="pog-input" id="cfgMaxProd" value="${shelf.tiers[0]?.maxProducts ?? 10}" min="1" max="30">
                </div>
                <div class="pog-apply-row">
                    <button class="pog-apply-btn" id="cfgApplyTiers">✔ Áp Dụng</button>
                </div>
                <hr class="pog-divider">
                <div class="pog-section-title">Tên Từng Tầng</div>
                <div class="pog-tier-names" id="cfgTierNames">${tierNamesHTML}</div>
                <div class="pog-apply-row">
                    <button class="pog-apply-btn" id="cfgSaveTierNames">💾 Lưu Tên Tầng</button>
                </div>
                <hr class="pog-divider">
                <div class="pog-section-title">Xóa Hàng Sản Phẩm</div>
                <select class="pog-input" id="cfgClearTierSel" style="margin-bottom:0.4rem;">${clearTierOptions}</select>
                <button class="pog-apply-btn" id="cfgClearTier" style="background:rgba(245,158,11,0.12);border-color:rgba(245,158,11,0.35);color:#fbbf24;width:100%;margin-bottom:0.5rem;">
                    🧹 Xóa Toàn Bộ Tầng Đã Chọn
                </button>
                <hr class="pog-divider">
                <button class="pog-danger-btn" id="cfgDeleteShelf">🗑 Xóa Kệ Này</button>
            </div>`;

        document.getElementById('cfgApplyTiers').addEventListener('click', () => {
            const n    = parseInt(document.getElementById('cfgNumTiers').value) || 1;
            const max  = parseInt(document.getElementById('cfgMaxProd').value) || 10;
            const name = document.getElementById('cfgShelfName').value.trim() || shelf.name;
            shelf.name = name;
            const existing = shelf.tiers;
            const rebuilt  = [];
            for (let i = 0; i < n; i++) {
                if (existing[i]) { existing[i].maxProducts = max; rebuilt.push(existing[i]); }
                else rebuilt.push({ id:`tier-${shelfId}-${i+1}-${Date.now()}`, name:`Tầng ${i+1}`, maxProducts: max, products: [] });
            }
            shelf.tiers = rebuilt;
            syncCustomPlanogram();
            renderCanvas();
            renderShelfSelector();
            showShelfProps(shelfId);
            showToast(`Cập nhật ${shelf.name}: ${n} tầng, tối đa ${max} SP`, 'success');
        });

        document.getElementById('cfgSaveTierNames').addEventListener('click', () => {
            document.querySelectorAll('#cfgTierNames input').forEach(inp => {
                const tier = shelf.tiers.find(t => t.id === inp.dataset.tierId);
                if (tier) tier.name = inp.value.trim() || tier.name;
            });
            renderCanvas();
            showShelfProps(shelfId);
            showToast('Đã lưu tên các tầng!', 'success');
        });

        document.getElementById('cfgShelfName').addEventListener('change', () => {
            shelf.name = document.getElementById('cfgShelfName').value.trim() || shelf.name;
            renderShelfSelector();
        });

        document.getElementById('cfgClearTier').addEventListener('click', () => {
            const tierId = document.getElementById('cfgClearTierSel').value;
            const tier   = shelf.tiers.find(t => t.id === tierId);
            if (!tier) return;
            tier.products = [];
            syncCustomPlanogram();
            renderCanvas();
            showShelfProps(shelfId);
            showToast(`Đã xóa toàn bộ SP trong ${tier.name}!`, 'success');
        });

        document.getElementById('cfgDeleteShelf').addEventListener('click', () => {
            if (pogState.shelves.length <= 1) { showToast('Cần ít nhất 1 kệ!', 'error'); return; }
            pogState.shelves = pogState.shelves.filter(s => s.id !== shelfId);
            selectedShelfId  = pogState.shelves[0].id;
            renderShelfSelector();
            renderCanvas();
            showEmptyProps();
            showToast('Đã xóa kệ!', 'success');
        });
    }

    function showEmptyProps() {
        propsContent.innerHTML = '<p class="pog-empty-state">Bấm vào kệ để cấu hình số tầng, số sản phẩm tối đa và tên tầng.</p>';
    }

    // ================================================================
    //  TOP BAR BUTTONS
    // ================================================================
    function bindTopbarBtns() {
        document.getElementById('pogBtnAddShelf').addEventListener('click', () => {
            const newId = 'shelf-' + Date.now();
            const num   = pogState.shelves.length + 1;
            pogState.shelves.push({
                id: newId, name: `Kệ ${num}`,
                tiers: [
                    { id:`t-${newId}-1`, name:'Tầng 1', maxProducts:10, products:[] },
                    { id:`t-${newId}-2`, name:'Tầng 2', maxProducts:10, products:[] },
                    { id:`t-${newId}-3`, name:'Tầng 3', maxProducts:10, products:[] },
                ]
            });
            selectedShelfId = newId;
            renderShelfSelector();
            renderCanvas();
            showShelfProps(newId);
            showToast(`Đã thêm Kệ ${num}!`, 'success');
        });

        // Lưu MongoDB (có tên kệ thực sự + danh mục sản phẩm)
        document.getElementById('pogBtnSave').addEventListener('click', async () => {
            const shelf      = pogState.shelves.find(s => s.id === selectedShelfId);
            const exportData = {
                shelves: (shelf ? shelf.tiers : []).map(t => t.products.map(p => p.name))
            };
            syncCustomPlanogram();

            const shelfIndex = pogState.shelves.findIndex(s => s.id === selectedShelfId) + 1;
            const filename     = `planogram_ke_${shelfIndex}.json`;
            const displayName  = shelf ? shelf.name : `Kệ ${shelfIndex}`;  // Tên kệ thực sự

            try {
                const res = await fetch('http://127.0.0.1:5002/api/save-planogram', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...exportData,
                        _filename:     filename,
                        _display_name: displayName,          // ← tên kệ thực sự
                        _products:     pogState.products     // ← snapshot danh mục
                    })
                });
                const result = await res.json();
                if (result.success) {
                    // Đánh dấu kệ với MongoDB slug để lần sau không fetch lại
                    if (shelf) {
                        shelf._mongoName = filename.replace('.json', '');
                        shelf._loaded    = true;
                    }
                    showToast(`✅ Đã lưu "${displayName}" lên MongoDB!`, 'success');
                    loadPlanogramFiles();   // Cập nhật dropdown Kiểm tra
                    renderShelfSelector();  // Cập nhật dropdown Tạo Planogram
                } else {
                    throw new Error(result.error || 'Lỗi không xác định');
                }
            } catch (err) {
                const blob = new Blob([JSON.stringify(exportData, null, 4)], { type: 'application/json' });
                const url  = URL.createObjectURL(blob);
                const a    = document.createElement('a');
                a.href = url; a.download = filename; a.click();
                URL.revokeObjectURL(url);
                showToast('⚠️ Backend lỗi — đã tải file về máy', 'error');
            }
        });
    }

    // ================================================================
    //  MODAL — ADD PRODUCT
    // ================================================================
    function bindModal() {
        const openModal  = () => { modal.classList.remove('hidden'); document.getElementById('pogProdName').focus(); };
        const closeModal = () => modal.classList.add('hidden');

        document.getElementById('pogBtnAddProduct').addEventListener('click', openModal);
        document.getElementById('pogModalClose').addEventListener('click', closeModal);
        document.getElementById('pogModalCancel').addEventListener('click', closeModal);
        modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

        document.getElementById('pogModalConfirm').addEventListener('click', () => {
            const name     = document.getElementById('pogProdName').value.trim();
            const code     = document.getElementById('pogProdCode').value.trim();
            const category = document.getElementById('pogProdCategory').value.trim();
            const color    = document.getElementById('pogProdColor').value;
            if (!name) { showToast('Nhập tên sản phẩm!', 'error'); return; }
            const newProd = {
                id: 'p-' + Date.now(), name,
                code: code || `POG-${String(pogState.products.length + 1).padStart(3,'0')}`,
                category: category || 'Chưa phân loại', color
            };
            pogState.products.push(newProd);
            renderCatalog();
            saveProductsToMongo(pogState.products);  // ← tự động lưu lên MongoDB
            closeModal();
            showToast(`Đã thêm "${name}"!`, 'success');
            ['pogProdName','pogProdCode','pogProdCategory'].forEach(id => document.getElementById(id).value = '');
            document.getElementById('pogProdColor').value = '#6366f1';
        });
    }

    // ================================================================
    //  TOAST
    // ================================================================
    let toastTimer;
    function showToast(msg, type = 'success') {
        toast.textContent = msg;
        toast.className   = `pog-toast pog-toast-${type}`;
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.add('hidden'), 2800);
    }

    // Expose global hook → switchPage dùng khi quay lại trang
    window._pogReloadCurrentShelf = function () {
        // Luôn redraw canvas kệ hiện tại khi vào lại trang
        renderCanvas();
        showShelfProps(selectedShelfId);
        // Nếu là kệ MongoDB chưa load → fetch về
        const shelf = pogState.shelves.find(s => s.id === selectedShelfId);
        if (shelf && shelf._mongoName && !shelf._loaded) {
            loadShelfDataFromMongo(selectedShelfId);
        }
    };
})();

