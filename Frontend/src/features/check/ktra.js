// ============================================================
//  KTRA.JS — Trang Kiểm Tra (index.html)
// ============================================================

import { API, loadPlanogramFiles, customPlanogram } from '../../utils/shared.js';

const uploadArea             = document.getElementById('upload-area');
const fileInput              = document.getElementById('file-input');
const sourcePreviewContainer = document.getElementById('source-preview-container');
const sourcePreview          = document.getElementById('source-preview');
const analyzeBtn             = document.getElementById('analyze-btn');

const complianceResult  = document.getElementById('compliance-result');
const complianceStatus  = document.getElementById('compliance-status');
const complianceIssues  = document.getElementById('compliance-issues');
const issuesList        = document.getElementById('issues-list');
const complianceImage   = document.getElementById('compliance-image');
const expectedLayout    = document.getElementById('expected-layout');
const resultPlaceholder = document.getElementById('result-placeholder');
const errorMessage      = document.getElementById('error-message');

let selectedFile = null;

// Load danh sách kệ vào dropdown khi trang mở
loadPlanogramFiles();
document.getElementById('pogRefreshFiles')?.addEventListener('click', loadPlanogramFiles);

// ─── Drag & Drop ───────────────────────────────────────────────
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
    uploadArea.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); });
});
['dragenter', 'dragover'].forEach(evt => {
    uploadArea.addEventListener(evt, () => uploadArea.classList.add('dragover'));
});
['dragleave', 'drop'].forEach(evt => {
    uploadArea.addEventListener(evt, () => uploadArea.classList.remove('dragover'));
});
uploadArea.addEventListener('drop',   e => handleFiles(e.dataTransfer.files));
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

// Click preview → chọn lại ảnh
sourcePreviewContainer.addEventListener('click', () => fileInput.click());

// ─── Kiểm tra AI ──────────────────────────────────────────────
analyzeBtn.addEventListener('click', async () => {
    if (!selectedFile) return;

    analyzeBtn.classList.add('loading');
    analyzeBtn.disabled = true;
    complianceResult && complianceResult.classList.add('hidden');
    resultPlaceholder.classList.remove('hidden');
    resultPlaceholder.querySelector('p').textContent = 'AI đang so sánh kệ hàng với biểu đồ chuẩn...';
    errorMessage.classList.add('hidden');

    const planogramFileSelect = document.getElementById('planogramFileSelect');
    const storeSelect = document.getElementById('storeSelect');
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('planogram', JSON.stringify(customPlanogram));
    
    if (storeSelect && storeSelect.value) {
        formData.append('store_id', storeSelect.value);
    }

    const selFile = planogramFileSelect ? planogramFileSelect.value : '';
    if (selFile) {
        formData.append('planogram_file', selFile);
        const selOption = planogramFileSelect.options[planogramFileSelect.selectedIndex];
        formData.append('planogram_display_name', selOption ? selOption.text : 'Unknown Shelf');
    }

    try {
        const response = await fetch(`${API}/api/compliance`, {
            method: 'POST',
            body:   formData
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
