// ============================================================
//  PLANOGRAM.JS — Trang Tạo Planogram (planogram.html)
//  Requires: js/shared.js loaded first
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
        loadProductsFromMongo(pogState, renderCatalog);
        loadSavedShelves();
    }

    // ================================================================
    //  LOAD KỆ ĐÃ LƯU TỪ MONGODB
    // ================================================================
    async function loadSavedShelves() {
        try {
            const res  = await fetch(`${API}/api/planograms`);
            const data = await res.json();
            if (!data.success || !data.data || data.source !== 'mongodb') return;

            data.data.forEach(item => {
                let existing = pogState.shelves.find(s => s._mongoName === item.name);
                if (!existing) existing = pogState.shelves.find(s => s.name === item.display_name);

                if (existing) {
                    existing._mongoName = item.name;
                    existing._loaded    = false;
                } else {
                    const newId = 'shelf-mongo-' + item.name;
                    pogState.shelves.push({
                        id: newId, name: item.display_name,
                        _mongoName: item.name, _loaded: false,
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

    async function loadShelfDataFromMongo(shelfId) {
        const shelf = pogState.shelves.find(s => s.id === shelfId);
        if (!shelf || !shelf._mongoName || shelf._loaded) return;

        try {
            const res  = await fetch(`${API}/api/planograms/${shelf._mongoName}`);
            const data = await res.json();
            if (!data.success || !data.planogram) return;

            const savedTiers = data.planogram.shelves || [];
            shelf.tiers = savedTiers.map((tierProducts, i) => {
                const tierId   = `t-${shelfId}-${i + 1}`;
                const products = tierProducts.map((name, j) => {
                    const found = pogState.products.find(p => p.name === name);
                    return found
                        ? { ...found, placedId: `pl-${tierId}-${j}` }
                        : { id: 'ph-' + Date.now() + j, name, code: '', category: '', color: '#6b7280', placedId: `pl-${tierId}-${j}` };
                });
                return {
                    id: tierId,
                    name: data.planogram.tier_names?.[i] || `Tầng ${i + 1}`,
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

    function syncCustomPlanogram() {
        const shelf = pogState.shelves.find(s => s.id === selectedShelfId);
        if (!shelf) return;
        customPlanogram.shelves = shelf.tiers.map(t => t.products.map(p => p.name));
    }

    // ================================================================
    //  CATALOG
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
        saveProductsToMongo(pogState.products);
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
        loadShelfDataFromMongo(selectedShelfId);
    });

    // ================================================================
    //  CANVAS
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
            const slotPx = 40;
            const tierW  = (tier.maxProducts * slotPx + 16) + 'px';
            drop.style.width    = tierW;
            drop.style.minWidth = 'unset';
            drop.style.flex     = 'none';
            row.style.width     = tierW;

            const badge = document.createElement('div');
            badge.className = 'pog-count-badge';
            badge.id = 'pgbadge-' + tier.id;
            badge.textContent = `${tier.products.length}/${tier.maxProducts}`;
            drop.appendChild(badge);

            tier.products.forEach(p => drop.appendChild(makePlacedEl(p, tier)));

            drop.addEventListener('dragover',  e => { e.preventDefault(); drop.classList.add('drag-over'); });
            drop.addEventListener('dragleave', ()  => drop.classList.remove('drag-over'));
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
            const max  = parseInt(document.getElementById('cfgMaxProd').value)  || 10;
            const name = document.getElementById('cfgShelfName').value.trim()  || shelf.name;
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

        document.getElementById('pogBtnSave').addEventListener('click', async () => {
            const shelf      = pogState.shelves.find(s => s.id === selectedShelfId);
            const exportData = {
                shelves: (shelf ? shelf.tiers : []).map(t => t.products.map(p => p.name))
            };
            syncCustomPlanogram();

            const shelfIndex  = pogState.shelves.findIndex(s => s.id === selectedShelfId) + 1;
            const filename    = `planogram_ke_${shelfIndex}.json`;
            const displayName = shelf ? shelf.name : `Kệ ${shelfIndex}`;

            try {
                const res = await fetch(`${API}/api/save-planogram`, {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({
                        ...exportData,
                        _filename:     filename,
                        _display_name: displayName,
                        _products:     pogState.products
                    })
                });
                const result = await res.json();
                if (result.success) {
                    if (shelf) {
                        shelf._mongoName = filename.replace('.json', '');
                        shelf._loaded    = true;
                    }
                    showToast(`✅ Đã lưu "${displayName}" lên MongoDB!`, 'success');
                    renderShelfSelector();
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
            saveProductsToMongo(pogState.products);
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
})();
