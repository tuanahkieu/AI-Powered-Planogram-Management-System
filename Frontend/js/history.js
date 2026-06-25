// ============================================================
//  HISTORY.JS — Lịch Sử Kiểm Tra (history.html)
// ============================================================

const storeSelect = document.getElementById('storeSelect');
const historyTable = document.getElementById('history-table');
const historyTbody = document.getElementById('history-tbody');
const loadingDiv = document.getElementById('history-loading');
const btnRefresh = document.getElementById('btnRefreshHistory');

// Modal
const modal = document.getElementById('detailModal');
const modalTitle = document.getElementById('modalTitle');
const modalImg = document.getElementById('modalImg');
const modalIssues = document.getElementById('modalIssues');
const modalNoIssues = document.getElementById('modalNoIssues');
const closeModalBtn = document.getElementById('closeModalBtn');
const deleteLogBtn = document.getElementById('deleteLogBtn');

let currentLogs = [];
let currentLogId = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Tải danh sách cửa hàng vào storeSelect (dùng loadStores từ shared.js nếu có)
    if (typeof loadStores === 'function') {
        await loadStores();
    }
    
    // Khi chọn cửa hàng khác, tải lại lịch sử
    storeSelect.addEventListener('change', () => {
        loadHistory(storeSelect.value);
    });

    // Nút refresh
    btnRefresh.addEventListener('click', () => {
        if (storeSelect.value) loadHistory(storeSelect.value);
    });

    // Đóng Modal
    closeModalBtn.addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });

    // Xóa lịch sử trong modal
    deleteLogBtn.addEventListener('click', async () => {
        if (!currentLogId) return;
        if (!confirm('Bạn có chắc chắn muốn xóa lịch sử này không?')) return;
        
        try {
            const res = await fetch(`${API}/api/compliance-logs/${currentLogId}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                showToast('Đã xóa lịch sử thành công!', 'success');
                modal.classList.add('hidden');
                
                // Xóa dòng tương ứng trên giao diện thay vì reload
                const rowToDel = document.querySelector(`tr[data-log-id="${currentLogId}"]`);
                if (rowToDel) {
                    rowToDel.style.display = 'none';
                    if (rowToDel.parentNode) rowToDel.parentNode.removeChild(rowToDel);
                }
                
                currentLogs = currentLogs.filter(l => l._id !== currentLogId);
                if (currentLogs.length === 0) {
                    loadingDiv.textContent = 'Chưa có lịch sử kiểm tra nào cho cửa hàng này.';
                    loadingDiv.classList.remove('hidden');
                    historyTable.classList.add('hidden');
                }
            } else {
                showToast(`Lỗi: ${data.error}`, 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('Lỗi kết nối máy chủ.', 'error');
        }
    });

    // Khởi tạo ban đầu
    if (storeSelect.options.length > 1) {
        // Tự động chọn cửa hàng đầu tiên nếu chưa chọn
        if (!storeSelect.value && storeSelect.options[1]) {
            storeSelect.value = storeSelect.options[1].value;
            loadHistory(storeSelect.value);
        }
    }
});

async function loadHistory(storeId) {
    if (!storeId) {
        loadingDiv.textContent = 'Vui lòng chọn cửa hàng để xem lịch sử...';
        loadingDiv.classList.remove('hidden');
        historyTable.classList.add('hidden');
        return;
    }

    loadingDiv.textContent = 'Đang tải lịch sử...';
    loadingDiv.classList.remove('hidden');
    historyTable.classList.add('hidden');
    historyTbody.innerHTML = '';

    try {
        const res = await fetch(`${API}/api/compliance-logs?store_id=${storeId}&limit=50`);
        const data = await res.json();

        if (data.success) {
            currentLogs = data.logs || [];
            
            if (currentLogs.length === 0) {
                loadingDiv.textContent = 'Chưa có lịch sử kiểm tra nào cho cửa hàng này.';
            } else {
                renderTable(currentLogs);
                loadingDiv.classList.add('hidden');
                historyTable.classList.remove('hidden');
            }
        } else {
            loadingDiv.textContent = `Lỗi: ${data.error || 'Không thể tải lịch sử'}`;
        }
    } catch (e) {
        console.error(e);
        loadingDiv.textContent = 'Lỗi kết nối máy chủ.';
    }
}

function renderTable(logs) {
    logs.forEach((log, index) => {
        const tr = document.createElement('tr');
        
        // Format ngày giờ
        const dateObj = new Date(log.checked_at + 'Z'); // MongoDB UTC
        const dateStr = dateObj.toLocaleString('vi-VN');

        const statusClass = log.status === 'PASSED' ? 'status-passed' : 'status-failed';
        const statusText = log.status === 'PASSED' ? 'Đạt' : 'Có lỗi';
        const issuesCount = log.issues ? log.issues.length : 0;

        tr.dataset.logId = log._id;
        tr.innerHTML = `
            <td>${dateStr}</td>
            <td>${log.planogram_display_name || 'Không rõ'}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>${issuesCount} lỗi</td>
            <td style="text-align: center;">
                <button class="delete-row-btn" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: #ef4444;" title="Xóa lịch sử">🗑️</button>
            </td>
        `;

        tr.addEventListener('click', () => openDetailModal(log._id));
        
        // Nút xóa ngay trên dòng
        const deleteBtn = tr.querySelector('.delete-row-btn');
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation(); // Ngăn không mở modal
            if (!confirm('Bạn có chắc chắn muốn xóa lịch sử này không?')) return;
            
            try {
                const res = await fetch(`${API}/api/compliance-logs/${log._id}`, { method: 'DELETE' });
                const data = await res.json();
                if (data.success) {
                    showToast('Đã xóa lịch sử thành công!', 'success');
                    
                    // Xóa dòng khỏi giao diện ngay lập tức một cách an toàn
                    tr.style.display = 'none';
                    if (tr.parentNode) tr.parentNode.removeChild(tr);
                    
                    // Cập nhật mảng
                    currentLogs = currentLogs.filter(l => l._id !== log._id);
                    if (currentLogs.length === 0) {
                        loadingDiv.textContent = 'Chưa có lịch sử kiểm tra nào cho cửa hàng này.';
                        loadingDiv.classList.remove('hidden');
                        historyTable.classList.add('hidden');
                    }
                } else {
                    showToast(`Lỗi: ${data.error}`, 'error');
                }
            } catch (err) {
                console.error(err);
                showToast('Lỗi kết nối máy chủ.', 'error');
            }
        });

        historyTbody.appendChild(tr);
    });
}

function openDetailModal(logId) {
    const log = currentLogs.find(l => l._id === logId);
    if (!log) return;

    currentLogId = log._id;

    const dateObj = new Date(log.checked_at + 'Z');
    modalTitle.textContent = `Chi Tiết - ${log.planogram_display_name} (${dateObj.toLocaleString('vi-VN')})`;
    
    if (log.annotated_image) {
        modalImg.src = log.annotated_image;
        modalImg.style.display = 'block';
    } else {
        modalImg.style.display = 'none';
    }

    modalIssues.innerHTML = '';
    if (log.issues && log.issues.length > 0) {
        modalNoIssues.style.display = 'none';
        modalIssues.style.display = 'block';
        log.issues.forEach(iss => {
            const li = document.createElement('li');
            li.textContent = iss;
            modalIssues.appendChild(li);
        });
    } else {
        modalIssues.style.display = 'none';
        modalNoIssues.style.display = 'block';
    }

    modal.classList.remove('hidden');
}
