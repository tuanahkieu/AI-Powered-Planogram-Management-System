// ============================================================
//  PLANOGRAM.JS — Trang Tạo Planogram (planogram.html)
//  Requires: js/shared.js loaded first
// ============================================================
import { API, customPlanogram, allFetchedPlanograms, loadStores, loadPlanogramFiles, renderPlanogramDropdown, saveProductsToMongo, loadProductsFromMongo } from '../../utils/shared.js';

(function () {
    // ---- State ----
    const pogState = {
        shelves: [
            {
                id: 'shelf-1', name: 'Kệ 1', store_id: 'store_1',
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
    let selectedCatalogId = null;  // ID sản phẩm đang chọn trong catalog
    let _lockedRows     = [];  // [{ row, brand, color, end_date }] — tầng bị khóa bởi hợp đồng

    // Bảng màu sắc đẹp, đa dạng — tránh trùng lặp
    const COLOR_PALETTE = [
        '#ef4444','#f97316','#f59e0b','#eab308','#84cc16',
        '#22c55e','#10b981','#14b8a6','#06b6d4','#0ea5e9',
        '#3b82f6','#6366f1','#8b5cf6','#a855f7','#ec4899',
        '#f43f5e','#0891b2','#059669','#7c3aed','#db2777',
    ];
    let _colorIndex = Math.floor(Math.random() * COLOR_PALETTE.length);

    function randomColor() {
        const color = COLOR_PALETTE[_colorIndex % COLOR_PALETTE.length];
        _colorIndex++;
        return color;
    }

    const shelfSelector = document.getElementById('pogShelfSelector');
    const storeSelector = document.getElementById('pogStoreSelector');
    const fixture       = document.getElementById('pogFixture');
    const catalog       = document.getElementById('pogCatalog');
    const catalogCount  = document.getElementById('pogCatalogCount');
    const propsContent  = document.getElementById('pogPropsContent');
    const modal         = document.getElementById('pogModalAddProduct');
    const toast         = document.getElementById('pogToast');

    if (!shelfSelector) return;

    init();

    async function init() {
        if (storeSelector) {
            storeSelector.addEventListener('change', () => {
                const btnAddShelf = document.getElementById('pogBtnAddShelf');
                if (btnAddShelf) btnAddShelf.disabled = !storeSelector.value;
                shelfSelector.disabled = !storeSelector.value;

                renderShelfSelector();
                if (shelfSelector.options.length > 0 && shelfSelector.options[0].value) {
                    shelfSelector.value = shelfSelector.options[0].value;
                    shelfSelector.dispatchEvent(new Event('change'));
                } else {
                    selectedShelfId = null;
                    fixture.innerHTML = '';
                    showEmptyProps();
                }
            });
            
            // Initial state
            const btnAddShelf = document.getElementById('pogBtnAddShelf');
            if (btnAddShelf) btnAddShelf.disabled = !storeSelector.value;
            shelfSelector.disabled = !storeSelector.value;
        }
        renderCatalog();
        renderShelfSelector();
        renderCanvas();
        showShelfProps(selectedShelfId);
        bindTopbarBtns();
        bindModal();

        // Đảm bảo load products TRƯỚC để autoFillLockedTiers có dữ liệu
        await loadProductsFromMongo(pogState, renderCatalog);
        const firstMongoShelfId = await loadSavedShelves();

        // Nếu URL có ?shelf=<mongoName> (từ ke.html bấm Chỉnh sửa), tự chọn đúng kệ
        const urlParams   = new URLSearchParams(window.location.search);
        const targetShelf = urlParams.get('shelf');
        if (targetShelf) {
            const found = pogState.shelves.find(s => s._mongoName === targetShelf);
            if (found) {
                selectedShelfId = found.id;
                shelfSelector.value = found.id;
                _lockedRows = [];
                renderCanvas();
                showShelfProps(selectedShelfId);
                await loadShelfDataFromMongo(found.id);
            }
        } else if (firstMongoShelfId) {
            // Không có URL param → tự động chọn kệ mới nhất từ MongoDB
            selectedShelfId = firstMongoShelfId;
            shelfSelector.value = firstMongoShelfId;
            _lockedRows = [];
            renderCanvas();
            showShelfProps(selectedShelfId);
            await loadShelfDataFromMongo(firstMongoShelfId);
        }

        // Auto-refresh contract locks khi user quay lại tab này
        document.addEventListener('visibilitychange', async () => {
            if (document.visibilityState === 'visible') {
                const shelf = pogState.shelves.find(s => s.id === selectedShelfId);
                if (shelf?._mongoName) {
                    await loadContractLocks(shelf._mongoName);
                }
            }
        });
    }


    // ================================================================
    //  CONTRACT LOCK — Tải tầng bị khóa cho kệ hiện tại
    // ================================================================
    async function loadContractLocks(shelfMongoName) {
        if (!shelfMongoName) { _lockedRows = []; return; }
        try {
            const res  = await fetch(`${API}/api/contracts/shelf/${shelfMongoName}`);
            const data = await res.json();
            _lockedRows = data.success ? (data.locked_rows || []) : [];
        } catch (e) {
            _lockedRows = [];
        }

        // ── Tự động điền sản phẩm đúng brand vào tầng bị khóa ────────────
        autoFillLockedTiers();
        // ──────────────────────────────────────────────────────────────────

        // Cập nhật lại canvas để hiện badge khóa
        renderCanvas();
        syncCustomPlanogram();
    }

    function autoFillLockedTiers() {
        const shelf = pogState.shelves.find(s => s.id === selectedShelfId);
        if (!shelf) return;

        let anyChange = false;

        _lockedRows.forEach(lock => {
            const tier = shelf.tiers[lock.row];
            if (!tier) return;

            // Tìm sản phẩm trong catalog khớp brand của hợp đồng
            const brandProds = pogState.products.filter(p => isProdMatchingLockedBrand(p, lock));

            if (brandProds.length === 0) {
                showToast(`\u26a0\ufe0f Không tìm thấy sản phẩm "${lock.brand}" trong danh mục!`, 'error');
                return;
            }

            // Xóa các sản phẩm SAI brand (giữ lại đúng brand)
            const before = tier.products.length;
            tier.products = tier.products.filter(p => isProdMatchingLockedBrand(p, lock));

            // Chọn 1 loại cụ thể (ưu tiên sản phẩm đã có trên tầng, nếu không lấy sản phẩm đầu tiên tìm được)
            const proto = tier.products.length > 0 ? tier.products[0] : brandProds[0];
            
            // Giữ lại các sản phẩm đúng loại cụ thể này (loại bỏ các loại khác dù cùng brand để đồng nhất 1 loại)
            tier.products = tier.products.filter(p => p.id === proto.id);

            // Fill thêm sản phẩm đúng brand cho đến maxProducts
            let idx = 0;
            while (tier.products.length < tier.maxProducts) {
                tier.products.push({
                    ...proto,
                    placedId: 'pl-auto-' + lock.row + '-' + Date.now() + '-' + idx
                });
                idx++;
                anyChange = true;
            }

            if (tier.products.length !== before) anyChange = true;
        });

        if (anyChange) {
            showToast('\u2705 Đã tự động xếp sản phẩm theo hợp đồng!', 'success');
        }
    }

    function isProdMatchingLockedBrand(prod, lockInfo) {
        if (!lockInfo) return true; // không có lock → cho phép
        const normalize = s => (s || '').toLowerCase().replace(/[\s\-_]+/g, '');
        const prodNorm  = normalize(prod.name);
        const brandNorm = normalize(lockInfo.brand);
        
        // 1) So khớp chính xác sau normalize
        if (prodNorm === brandNorm) return true;
        
        // 2) Sản phẩm bắt đầu bằng brand (ví dụ: "mirinda-xaxi-chai" vs brand "mirinda")
        // Cho phép hợp đồng chung chung (mirinda) dùng sản phẩm cụ thể (mirinda-xaxi)
        if (prodNorm.startsWith(brandNorm)) return true;
        
        // 3) Chứa nhau — chỉ chấp nhận nếu sản phẩm cụ thể chứa tên brand chung chung
        if (brandNorm.length >= 4 && prodNorm.includes(brandNorm)) return true;
        
        return false;
    }

    function isRowLocked(tierIndex) {
        return _lockedRows.some(l => l.row === tierIndex);
    }

    function getRowLockInfo(tierIndex) {
        return _lockedRows.find(l => l.row === tierIndex) || null;
    }

    // ================================================================
    //  LOAD KỆ ĐÃ LƯU TỪ MONGODB
    // ================================================================
    async function loadSavedShelves() {
        let firstShelfId = null; // ID của kệ đầu tiên (mới nhất) từ MongoDB
        try {
            const res  = await fetch(`${API}/api/planograms`);
            const data = await res.json();
            if (!data.success || !data.data || data.source !== 'mongodb') return null;

            data.data.forEach((item, idx) => {
                let existing = pogState.shelves.find(s => s._mongoName === item.name);
                
                const storeId = item.store_id || null; // Use real store_id from backend
                
                // If not found by mongoName, try matching by name AND store_id
                if (!existing) {
                    existing = pogState.shelves.find(s => s.name === item.display_name && s.store_id === storeId);
                }

                if (existing) {
                    existing._mongoName = item.name;
                    existing._loaded    = false;
                    existing.store_id   = storeId;
                    if (idx === 0) firstShelfId = existing.id;
                } else {
                    const newId = 'shelf-mongo-' + item.name;
                    pogState.shelves.push({
                        id: newId, name: item.display_name,
                        _mongoName: item.name, _loaded: false,
                        store_id: storeId,
                        tiers: [
                            { id: `t-${newId}-1`, name: 'Tầng 1', maxProducts: 10, products: [] },
                            { id: `t-${newId}-2`, name: 'Tầng 2', maxProducts: 10, products: [] },
                            { id: `t-${newId}-3`, name: 'Tầng 3', maxProducts: 10, products: [] },
                        ]
                    });
                    if (idx === 0) firstShelfId = newId;
                }
            });

            renderShelfSelector();
        } catch (e) {
            console.warn('Không thể tải danh sách kệ:', e.message);
        }
        return firstShelfId;
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
            // Load contract locks cho kệ vừa tải xong
            await loadContractLocks(shelf._mongoName);
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
            el.className = 'pog-cat-item' + (prod.id === selectedCatalogId ? ' pog-cat-selected' : '');
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

            // Click: hiển thị chi tiết sản phẩm ở props panel
            el.addEventListener('click', e => {
                if (e.target.closest('.pog-cat-del-btn')) return;
                selectedCatalogId = prod.id;
                clearItemSel();
                // Bỏ highlight tất cả catalog items
                document.querySelectorAll('.pog-cat-item').forEach(i => i.classList.remove('pog-cat-selected'));
                el.classList.add('pog-cat-selected');
                showCatalogProductProps(prod);
            });

            el.querySelector('.pog-cat-del-btn').addEventListener('click', e => {
                e.stopPropagation();
                e.preventDefault();
                deleteCatalogProduct(prod.id);
            });

            catalog.appendChild(el);
        });
    }

    // ================================================================
    //  CATALOG PRODUCT DETAIL — hiện thông tin sản phẩm khi click
    // ================================================================
    function showCatalogProductProps(prod) {
        // Đếm số lần sản phẩm xuất hiện trên kệ hiện tại
        const currentShelf = pogState.shelves.find(s => s.id === selectedShelfId);
        let totalPlaced = 0;
        const tierBreakdown = [];
        if (currentShelf) {
            currentShelf.tiers.forEach(tier => {
                const count = tier.products.filter(p => p.id === prod.id).length;
                if (count > 0) {
                    totalPlaced += count;
                    tierBreakdown.push(`${tier.name}: ${count} SP`);
                }
            });
        }

        const placedInfo = totalPlaced > 0
            ? `<div class="pog-prod-placed-info">
                <span class="pog-prod-placed-count">${totalPlaced} SP trên kệ</span>
                <span class="pog-prod-placed-detail">${tierBreakdown.join(' · ')}</span>
               </div>`
            : `<div class="pog-prod-placed-info pog-prod-placed-empty">Chưa đặt trên kệ nào</div>`;

        propsContent.innerHTML = `
            <div class="pog-cat-detail">
                <div class="pog-cat-detail-hero" style="background:${prod.color}20;border-color:${prod.color}40">
                    <div class="pog-cat-detail-dot" style="background:${prod.color}"></div>
                    <div class="pog-cat-detail-title">${prod.name}</div>
                    <div class="pog-cat-detail-code">${prod.code}</div>
                </div>
                <div class="pog-prop-row"><span class="pog-prop-label">Tên sản phẩm</span><span class="pog-prop-value">${prod.name}</span></div>
                <div class="pog-prop-row"><span class="pog-prop-label">Mã SKU</span><span class="pog-prop-value" style="font-family:monospace;letter-spacing:0.05em">${prod.code || '—'}</span></div>
                <div class="pog-prop-row"><span class="pog-prop-label">Danh mục</span><span class="pog-prop-value">${prod.category || '—'}</span></div>
                <div class="pog-prop-row">
                    <span class="pog-prop-label">Màu đại diện</span>
                    <span class="pog-prop-value" style="display:flex;align-items:center;gap:0.5rem">
                        <span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:${prod.color};flex-shrink:0"></span>
                        <span style="font-family:monospace;font-size:0.82rem">${prod.color}</span>
                    </span>
                </div>
                ${placedInfo}
                <hr class="pog-divider">
                <button class="pog-danger-btn" id="catDetailDelBtn">Xóa Sản Phẩm Này</button>
            </div>`;

        document.getElementById('catDetailDelBtn').addEventListener('click', () => {
            selectedCatalogId = null;
            deleteCatalogProduct(prod.id);
            showEmptyProps();
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
        const selectedStore = storeSelector ? storeSelector.value : '';
        
        if (!selectedStore) {
            shelfSelector.innerHTML = '<option value="">-- Cần chọn cửa hàng --</option>';
            return;
        }

        const filtered = pogState.shelves.filter(s => s.store_id === selectedStore);

        if (filtered.length === 0) {
            shelfSelector.innerHTML = '<option value="">-- Cửa hàng chưa có kệ --</option>';
            return;
        }

        filtered.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = s.name;
            if (s.id === selectedShelfId) opt.selected = true;
            shelfSelector.appendChild(opt);
        });
    }

    shelfSelector.addEventListener('change', async () => {
        if (!shelfSelector.value) {
            fixture.innerHTML = '';
            showEmptyProps();
            return;
        }
        selectedShelfId = shelfSelector.value;
        _lockedRows = [];
        renderCanvas();
        showShelfProps(selectedShelfId);

        const shelf = pogState.shelves.find(s => s.id === selectedShelfId);
        // loadShelfDataFromMongo đã gọi loadContractLocks bên trong nếu cần load
        // Nếu shelf đã được load sẵn (_loaded=true), ta cần gọi trực tiếp
        if (shelf?._mongoName && shelf._loaded) {
            await loadContractLocks(shelf._mongoName);
        } else {
            await loadShelfDataFromMongo(selectedShelfId);
            // loadContractLocks đã được gọi bên trong loadShelfDataFromMongo
        }
    });

    // ================================================================
    //  CANVAS
    // ================================================================
    function renderCanvas() {
        fixture.innerHTML = '';
        const shelf = pogState.shelves.find(s => s.id === selectedShelfId);
        if (!shelf) return;

        shelf.tiers.forEach((tier, tierIndex) => {
            const locked   = isRowLocked(tierIndex);
            const lockInfo = getRowLockInfo(tierIndex);

            const row = document.createElement('div');
            row.className = 'pog-tier-row' + (locked ? ' pog-tier-locked' : '');
            row.dataset.tierId = tier.id;

            const label = document.createElement('div');
            label.className = 'pog-tier-label';
            label.innerHTML = tier.name + (locked
                ? `<span class="tier-lock-badge" title="Tầng đang có hợp đồng với ${lockInfo?.brand} (hết hạn ${lockInfo?.end_date})" style="background:${lockInfo?.color || '#6366f1'}">🔒</span>`
                : '');

            const drop = document.createElement('div');
            drop.className = 'pog-tier-drop';
            drop.dataset.tierId = tier.id;
            const slotPx = 40;
            const tierW  = (Math.max(2, tier.products.length + 1) * slotPx + 16) + 'px';
            drop.style.width    = tierW;
            drop.style.minWidth = 'unset';
            drop.style.flex     = 'none';
            row.style.width     = tierW;

            const badge = document.createElement('div');
            badge.className = 'pog-count-badge';
            badge.id = 'pgbadge-' + tier.id;
            badge.textContent = `${tier.products.length} SP`;
            drop.appendChild(badge);

            tier.products.forEach(p => drop.appendChild(makePlacedEl(p, tier, locked)));

            drop.addEventListener('dragover', e => {
                e.preventDefault();
                // Kiểm tra ĐỘNG lúc kéo qua — không dùng closure
                const curLocked   = isRowLocked(tierIndex);
                const curLockInfo = getRowLockInfo(tierIndex);
                if (curLocked && draggedProdId) {
                    const dragProd = pogState.products.find(p => p.id === draggedProdId);
                    if (dragProd && !isProdMatchingLockedBrand(dragProd, curLockInfo)) {
                        e.dataTransfer.dropEffect = 'none';
                        drop.classList.add('drag-over-blocked');
                        drop.classList.remove('drag-over');
                        return;
                    }
                }
                drop.classList.add('drag-over');
                drop.classList.remove('drag-over-blocked');
            });
            drop.addEventListener('dragleave', () => {
                drop.classList.remove('drag-over');
                drop.classList.remove('drag-over-blocked');
            });
            drop.addEventListener('drop', e => {
                e.preventDefault();
                drop.classList.remove('drag-over');
                drop.classList.remove('drag-over-blocked');
                if (!draggedProdId) return;
                const prod = pogState.products.find(p => p.id === draggedProdId);
                if (!prod) return;

                // ── Kiểm tra ĐỘNG tại thời điểm drop (không dùng closure) ──
                const curLocked   = isRowLocked(tierIndex);
                const curLockInfo = getRowLockInfo(tierIndex);
                if (curLocked) {
                    if (!isProdMatchingLockedBrand(prod, curLockInfo)) {
                        showToast(`Tầng này chỉ dành cho "${curLockInfo.brand}" theo hợp đồng!`, 'error');
                        draggedProdId = null;
                        return;
                    }
                }
                // ──────────────────────────────────────────────────────────

                if (tier.products.length >= tier.maxProducts) {
                    showToast(`Kệ đã đầy (tối đa ${tier.maxProducts} SP)`, 'error');
                    return;
                }
                const entry = { ...prod, placedId: 'pl-' + Date.now() };
                tier.products.push(entry);
                // Re-check lock sau khi thêm (state đã cập nhật)
                drop.insertBefore(makePlacedEl(entry, tier, curLocked), badge);
                updateBadge(tier);
                resizeTierDrop(tier, drop, row);
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

    function makePlacedEl(entry, tier, locked = false) {
        const el = document.createElement('div');
        // Kiểm tra xem sản phẩm có đúng brand của hợp đồng không
        const tierIndex = pogState.shelves
            .find(s => s.id === selectedShelfId)
            ?.tiers.indexOf(tier) ?? -1;
        const lockInfo  = locked ? getRowLockInfo(tierIndex) : null;
        const isMismatch = locked && !isProdMatchingLockedBrand(entry, lockInfo);

        el.className = 'pog-placed' + (locked ? ' pog-placed-locked' : '') + (isMismatch ? ' pog-placed-mismatch' : '');
        el.dataset.placedId = entry.placedId;
        el.innerHTML = `
            <div class="pog-placed-dot" style="background:${entry.color}"></div>
            <div class="pog-placed-name">${entry.name}</div>
            ${isMismatch ? '<div class="pog-placed-lock" title="Sản phẩm không đúng brand hợp đồng!">⚠️</div>' : (locked ? '<div class="pog-placed-lock">🔒</div>' : '')}`;
        el.addEventListener('click', e => {
            e.stopPropagation();
            clearItemSel();
            selectedItemEl = el;
            el.classList.add('pog-item-selected');
            showProductProps(entry, tier, locked);
        });
        return el;
    }

    function updateBadge(tier) {
        const b = document.getElementById('pgbadge-' + tier.id);
        if (b) b.textContent = `${tier.products.length} SP`;
    }

    const SLOT_PX = 40;
    function resizeTierDrop(tier, dropEl, rowEl) {
        // Nếu không truyền DOM ref thì tự tìm
        const drop = dropEl || document.querySelector(`.pog-tier-drop[data-tier-id="${tier.id}"]`);
        const row  = rowEl  || drop?.closest('.pog-tier-row');
        if (!drop || !row) return;
        const w = (Math.max(2, tier.products.length + 1) * SLOT_PX + 16) + 'px';
        drop.style.width = w;
        row.style.width  = w;
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
    function showProductProps(entry, tier, locked = false) {
        const lockInfo = locked ? _lockedRows.find(l => {
            const shelf = pogState.shelves.find(s => s.id === selectedShelfId);
            return l.row === (shelf?.tiers.indexOf(tier) ?? -1);
        }) : null;

        const removeBtn = locked
            ? `<div class="pog-lock-notice">Sản phẩm này thuộc hợp đồng với <strong>${lockInfo?.brand || 'nhãn hàng'}</strong> (hết hạn ${lockInfo?.end_date || '—'}). Không thể xóa khi hợp đồng còn hiệu lực.</div>`
            : `<button class="pog-danger-btn" id="pogBtnRemoveItem">Xóa Khỏi Tầng</button>`;

        propsContent.innerHTML = `
            <div class="pog-prop-row"><span class="pog-prop-label">Tên</span><span class="pog-prop-value">${entry.name}</span></div>
            <div class="pog-prop-row"><span class="pog-prop-label">Mã SKU</span><span class="pog-prop-value">${entry.code}</span></div>
            <div class="pog-prop-row"><span class="pog-prop-label">Danh Mục</span><span class="pog-prop-value">${entry.category}</span></div>
            <div class="pog-prop-row"><span class="pog-prop-label">Tầng</span><span class="pog-prop-value">${tier.name}</span></div>
            <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem;">
                <div style="width:24px;height:24px;border-radius:50%;background:${entry.color};flex-shrink:0;"></div>
                <span style="font-size:0.78rem;color:var(--text-3);">Màu đại diện</span>
            </div>
            ${removeBtn}`;

        if (!locked) {
            document.getElementById('pogBtnRemoveItem').addEventListener('click', () => {
                const idx = tier.products.findIndex(p => p.placedId === entry.placedId);
                if (idx !== -1) tier.products.splice(idx, 1);
                if (selectedItemEl) { selectedItemEl.remove(); selectedItemEl = null; }
                updateBadge(tier);
                resizeTierDrop(tier);
                syncCustomPlanogram();
                showEmptyProps();
            });
        }
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
            `<option value="${t.id}" ${t.id === activeTierId ? 'selected' : ''}>${t.name} (${t.products.length} SP)</option>`).join('');

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
                    <button class="pog-apply-btn" id="cfgApplyTiers">Áp Dụng</button>
                </div>
                <hr class="pog-divider">
                <div class="pog-section-title">Tên Từng Tầng</div>
                <div class="pog-tier-names" id="cfgTierNames">${tierNamesHTML}</div>
                <div class="pog-apply-row">
                    <button class="pog-apply-btn" id="cfgSaveTierNames">Lưu Tên Tầng</button>
                </div>
                <hr class="pog-divider">
                <div class="pog-section-title">Xóa Hàng Sản Phẩm</div>
                <select class="pog-select" id="cfgClearTierSel" style="margin-bottom:0.4rem; width:100%;">${clearTierOptions}</select>
                <button class="pog-apply-btn" id="cfgClearTier" style="background:rgba(245,158,11,0.12);border-color:rgba(245,158,11,0.35);color:#fbbf24;width:100%;margin-bottom:0.5rem;">
                    Xóa Toàn Bộ Tầng Đã Chọn
                </button>
                <hr class="pog-divider">
                <button class="pog-danger-btn" id="cfgDeleteShelf">Xóa Kệ Này</button>
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
            const tierId    = document.getElementById('cfgClearTierSel').value;
            const tier      = shelf.tiers.find(t => t.id === tierId);
            if (!tier) return;
            const tierIndex = shelf.tiers.indexOf(tier);
            if (isRowLocked(tierIndex)) {
                const info = getRowLockInfo(tierIndex);
                showToast(`Tầng này đang bị khóa bởi hợp đồng với "${info?.brand}"`, 'error');
                return;
            }
            tier.products = [];
            syncCustomPlanogram();
            renderCanvas();
            showShelfProps(shelfId);
            showToast(`Đã xóa toàn bộ SP trong ${tier.name}!`, 'success');
        });

        document.getElementById('cfgDeleteShelf').addEventListener('click', async () => {
            if (pogState.shelves.length <= 1) { showToast('Cần ít nhất 1 kệ!', 'error'); return; }

            const shelfToDelete = pogState.shelves.find(s => s.id === shelfId);
            if (!shelfToDelete) return;

            // Nếu kệ đã được lưu lên MongoDB, gọi API xóa trước
            if (shelfToDelete._mongoName) {
                try {
                    const res = await fetch(`${API}/api/planograms/${shelfToDelete._mongoName}`, {
                        method: 'DELETE'
                    });
                    const result = await res.json();
                    if (!result.success) {
                        showToast(`Không thể xóa kệ khỏi MongoDB: ${result.error || 'Lỗi không xác định'}`, 'error');
                        return;
                    }
                } catch (err) {
                    showToast(`Lỗi kết nối — không thể xóa: ${err.message}`, 'error');
                    return;
                }
            }

            // Xóa khỏi state sau khi xóa MongoDB thành công
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
            if (storeSelector && !storeSelector.value) {
                showToast('Vui lòng chọn cửa hàng trước khi thêm kệ!', 'error');
                return;
            }
            const selectedStore = storeSelector ? storeSelector.value : 'store_1';
            const newId = 'shelf-' + Date.now();
            const storeShelves = pogState.shelves.filter(s => s.store_id === selectedStore);
            const num   = storeShelves.length + 1;
            pogState.shelves.push({
                id: newId, name: `Kệ ${num}`,
                store_id: selectedStore,
                tiers: [
                    { id:`t-${newId}-1`, name:'Tầng 1', maxProducts:10, products:[] },
                    { id:`t-${newId}-2`, name:'Tầng 2', maxProducts:10, products:[] },
                    { id:`t-${newId}-3`, name:'Tầng 3', maxProducts:10, products:[] },
                ]
            });
            if (storeSelector && !storeSelector.value) {
                storeSelector.value = selectedStore;
            }
            selectedShelfId = newId;
            _lockedRows = []; // Reset locks for new shelf
            
            renderShelfSelector();
            renderCanvas();
            showShelfProps(newId);
            showToast(`Đã thêm Kệ ${num}!`, 'success');
        });

        // Import từ AI (lấy labels từ model)
        const btnImportAI = document.getElementById('pogBtnImportAI');
        if (btnImportAI) {
            btnImportAI.addEventListener('click', async () => {
                btnImportAI.textContent = '⏳ Đang tải...';
                btnImportAI.disabled = true;
                try {
                    const res = await fetch(`${API}/api/model-labels`);
                    const data = await res.json();
                    if (data.success && data.labels) {
                        let addedCount = 0;
                        data.labels.forEach((label, idx) => {
                            // Kiểm tra xem sản phẩm đã có trong danh mục chưa
                            const exists = pogState.products.some(p => p.name.toLowerCase() === label.toLowerCase());
                            if (!exists) {
                                // Chọn màu ngẫu nhiên cho sản phẩm AI
                                const colors = ['#ef4444', '#0ea5e9', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e'];
                                const color = colors[idx % colors.length];
                                
                                pogState.products.push({
                                    id: 'p-ai-' + Date.now() + idx,
                                    name: label,
                                    code: `AI-${String(idx + 1).padStart(3, '0')}`,
                                    category: 'Nhận diện AI',
                                    color: color
                                });
                                addedCount++;
                            }
                        });
                        
                        if (addedCount > 0) {
                            renderCatalog();
                            saveProductsToMongo(pogState.products);
                            showToast(`Đã import ${addedCount} sản phẩm từ AI!`, 'success');
                        } else {
                            showToast('Tất cả sản phẩm AI đã có trong danh mục!', 'success');
                        }
                    } else {
                        showToast('Lỗi: Không thể tải nhãn từ AI', 'error');
                    }
                } catch (err) {
                    showToast('Lỗi kết nối tới Backend', 'error');
                    console.error(err);
                } finally {
                    btnImportAI.textContent = '✨ Import từ AI';
                    btnImportAI.disabled = false;
                }
            });
        }

        document.getElementById('pogBtnSave').addEventListener('click', async () => {
            if (storeSelector && !storeSelector.value) {
                showToast('Vui lòng chọn cửa hàng!', 'error');
                return;
            }
            const shelf      = pogState.shelves.find(s => s.id === selectedShelfId);
            if (!shelf) {
                showToast('Không có kệ để lưu!', 'error');
                return;
            }
            const exportData = {
                shelves: (shelf ? shelf.tiers : []).map(t => t.products.map(p => p.name))
            };
            syncCustomPlanogram();

            const storeId = shelf ? shelf.store_id : (storeSelector ? storeSelector.value : null);
            const storeShelves = pogState.shelves.filter(s => s.store_id === storeId);
            const shelfIndex  = storeShelves.findIndex(s => s.id === selectedShelfId) + 1;
            const prefix = storeId ? `${storeId}_` : '';
            const filename    = `planogram_${prefix}ke_${shelfIndex}.json`;
            const displayName = shelf ? shelf.name : `Kệ ${shelfIndex}`;

            try {
                const res = await fetch(`${API}/api/save-planogram`, {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({
                        ...exportData,
                        _filename:     filename,
                        _display_name: displayName,
                        _products:     pogState.products,
                        store_id:      storeId
                    })
                });
                const result = await res.json();
                if (result.success) {
                    if (shelf) {
                        shelf._mongoName = filename.replace('.json', '');
                        shelf._loaded    = true;
                    }
                    showToast(`Đã lưu "${displayName}" lên MongoDB!`, 'success');
                    renderShelfSelector();
                } else if (res.status === 409) {
                    // Tầng bị khóa bởi hợp đồng
                    const msgs = (result.violations || []).join('\n• ');
                    showToast(`Không thể lưu — tầng bị khóa bởi hợp đồng active`, 'error');
                    // Hiển thị chi tiết trong alert
                    alert(`Không thể lưu vì các tầng sau đang bị khóa bởi hợp đồng:\n\n• ${msgs}\n\nHãy xóa hợp đồng liên quan hoặc chờ hợp đồng hết hạn.`);
                } else {
                    throw new Error(result.error || 'Lỗi không xác định');
                }
            } catch (err) {
                showToast(`Lỗi kết nối — không thể lưu: ${err.message}`, 'error');
            }
        });
    }

    // ================================================================
    //  MODAL — ADD PRODUCT
    // ================================================================
    function bindModal() {
        const openModal  = () => { modal.classList.remove('hidden'); document.getElementById('pogProdName').focus(); };
        const closeModal = () => modal.classList.add('hidden');

        document.getElementById('pogBtnAddProduct').addEventListener('click', () => {
            // Gán màu random khi mở modal — người dùng có thể đổi thủ công
            document.getElementById('pogProdColor').value = randomColor();
            openModal();
        });
        document.getElementById('pogModalClose').addEventListener('click', closeModal);
        document.getElementById('pogModalCancel').addEventListener('click', closeModal);
        modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

        document.getElementById('pogModalConfirm').addEventListener('click', () => {
            const name     = document.getElementById('pogProdName').value.trim();
            const code     = document.getElementById('pogProdCode').value.trim();
            const category = document.getElementById('pogProdCategory').value.trim();
            const color = document.getElementById('pogProdColor').value;
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
            document.getElementById('pogProdColor').value = randomColor();
        });

        // Add Store Modal Binding
        const storeModal = document.getElementById('pogModalAddStore');
        const openStoreModal = () => { storeModal.classList.remove('hidden'); document.getElementById('pogStoreName').focus(); };
        const closeStoreModal = () => storeModal.classList.add('hidden');

        const btnAddStore = document.getElementById('pogBtnAddStore');
        if (btnAddStore) btnAddStore.addEventListener('click', openStoreModal);

        const btnStoreClose = document.getElementById('pogStoreModalClose');
        if (btnStoreClose) btnStoreClose.addEventListener('click', closeStoreModal);

        const btnStoreCancel = document.getElementById('pogStoreModalCancel');
        if (btnStoreCancel) btnStoreCancel.addEventListener('click', closeStoreModal);

        if (storeModal) storeModal.addEventListener('click', e => { if (e.target === storeModal) closeStoreModal(); });

        const btnStoreConfirm = document.getElementById('pogStoreModalConfirm');
        if (btnStoreConfirm) {
            btnStoreConfirm.addEventListener('click', async () => {
                const name = document.getElementById('pogStoreName').value.trim();
                if (!name) { showToast('Vui lòng nhập tên cửa hàng', 'error'); return; }
                
                try {
                    const res = await fetch(`${API}/api/stores`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name })
                    });
                    const data = await res.json();
                    if (data.success) {
                        showToast(`Đã thêm cửa hàng "${name}"`, 'success');
                        closeStoreModal();
                        document.getElementById('pogStoreName').value = '';
                        // Reload stores (using loadStores from shared.js)
                        if (typeof loadStores === 'function') {
                            await loadStores();
                            if (storeSelector) {
                                storeSelector.value = data.store.store_id;
                                storeSelector.dispatchEvent(new Event('change'));
                            }
                        }
                    } else {
                        showToast(data.error || 'Lỗi khi tạo cửa hàng', 'error');
                    }
                } catch (e) {
                    showToast('Lỗi kết nối', 'error');
                }
            });
        }

        const btnDeleteStore = document.getElementById('pogBtnDeleteStore');
        if (btnDeleteStore) {
            btnDeleteStore.addEventListener('click', async () => {
                if (!storeSelector) return;
                const storeId = storeSelector.value;
                if (!storeId) {
                    showToast('Vui lòng chọn cửa hàng cần xóa', 'error');
                    return;
                }
                
                const storeName = storeSelector.options[storeSelector.selectedIndex].text;
                if (!confirm(`Bạn có chắc chắn muốn xóa cửa hàng "${storeName}" không?\nLưu ý: Hành động này không thể hoàn tác.`)) return;

                try {
                    const res = await fetch(`${API}/api/stores/${storeId}`, {
                        method: 'DELETE'
                    });
                    const data = await res.json();
                    if (data.success) {
                        showToast(`Đã xóa cửa hàng "${storeName}"`, 'success');
                        if (typeof loadStores === 'function') {
                            await loadStores();
                            if (storeSelector) {
                                storeSelector.dispatchEvent(new Event('change'));
                            }
                        }
                    } else {
                        showToast(data.error || 'Lỗi khi xóa cửa hàng', 'error');
                    }
                } catch (e) {
                    showToast('Lỗi kết nối', 'error');
                }
            });
        }
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
