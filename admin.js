
// deno-lint-ignore-file no-unused-vars
const GOOGLE_SHEET_ID = "1efQ_LCxjLrIThXt0FBt4Z9DPNIX7bmvmNcFQVZf0EN8"; 
const GOOGLE_SHEET_EDIT_URL = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/edit?usp=sharing`;
const REFRESH_STREAM_URL = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv`;
const CATEGORIES_STREAM_URL = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv&gid=1955100008`;

const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwM8ID2ppIXciDN1-SFM0lF_xvgVQEReyOHJGj0zQkC1aXHFXlBbioj2BwJER78sPmAPg/exec";

const authenticatedPasscode = ""; 
const fullDataCache = [];
const filteredAdminCache = [];
const selectedItemIds = new Set();

// Admin Table Pagination
const ADMIN_ITEMS_PER_PAGE = 15;
const adminCurrentPage = 1;

async function handleAdminLogin(e) {
    e.preventDefault();
    const inputEl = document.getElementById('login-passcode-input');
    const btn = document.getElementById('btn-login-submit');
    const inputPass = inputEl.value.trim();

    if (!inputPass) return;

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Verifying Passcode...`;

    try {
        const res = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: "verifyPasscode", passcode: inputPass })
        });

        const data = await res.json();

        if (data.result === "success") {
            authenticatedPasscode = inputPass;
            document.getElementById('auth-login-overlay').classList.add('hidden');
            document.getElementById('admin-main-wrapper').classList.remove('hidden');

            reloadPreview();
            loadSheetCategories();
            showToast("Authenticated session active", "success");
        } else {
            inputEl.className = "w-full p-3 bg-red-950/30 border-2 border-red-500 rounded-xl text-sm text-center text-red-200 tracking-widest focus:outline-none";
            document.getElementById('login-error-msg').classList.remove('hidden');
        }
      } catch {
        showToast("Could not connect to authentication server.", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-lock-open"></i> Authorize Access`;
    }
}

function clearLoginError() {
    const inputEl = document.getElementById('login-passcode-input');
    inputEl.className = "w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-center text-white tracking-widest focus:outline-none focus:border-amber-400 transition-colors";
    document.getElementById('login-error-msg').classList.add('hidden');
}

function logoutAdmin() {
    authenticatedPasscode = "";
    document.getElementById('login-passcode-input').value = "";
    clearLoginError();
    document.getElementById('admin-main-wrapper').classList.add('hidden');
    document.getElementById('auth-login-overlay').classList.remove('hidden');
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast-animate pointer-events-auto px-4 py-3 rounded-xl shadow-2xl border text-xs font-bold flex items-center gap-3 text-white ${
        type === 'success' ? 'bg-emerald-600 border-emerald-500' : 'bg-red-600 border-red-500'
    }`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

async function loadSheetCategories() {
    const selectElement = document.getElementById('add-category-select');
    const filterSelect = document.getElementById('admin-category-filter');

    try {
        const res = await fetch(`${CATEGORIES_STREAM_URL}&t=${new Date().getTime()}`);
        const csv = await res.text();
        const lines = csv.split(/\r?\n/).filter(line => line.trim() !== '');
        
        selectElement.innerHTML = '';
        if (filterSelect) filterSelect.innerHTML = `<option value="all">All Categories</option>`;

        lines.forEach(catLine => {
            const cleanCat = catLine.replace(/^"|"$/g, '').trim();
            if(cleanCat && cleanCat.toLowerCase() !== 'category') {
                const opt = document.createElement('option');
                opt.value = cleanCat;
                opt.innerText = cleanCat;
                selectElement.appendChild(opt);

                if (filterSelect) {
                    const filterOpt = document.createElement('option');
                    filterOpt.value = cleanCat;
                    filterOpt.innerText = cleanCat;
                    filterSelect.appendChild(filterOpt);
                }
            }
        });

        const customOpt = document.createElement('option');
        customOpt.value = "__CUSTOM__";
        customOpt.innerText = "➕ Create New Category...";
        selectElement.appendChild(customOpt);

   } catch {
        selectElement.innerHTML = '<option value="Kitchen Appliances">Kitchen Appliances</option><option value="Electrical Switches">Electrical Switches</option><option value="__CUSTOM__">➕ Create New Category...</option>';
    }
}

function handleCategorySelection(select) {
    const customWrapper = document.getElementById('custom-category-wrapper');
    if(select.value === "__CUSTOM__") customWrapper.classList.remove('hidden');
    else customWrapper.classList.add('hidden');
}

function autoSuggestProductId() {
    const cat = document.getElementById('add-category-select').value;
    if(cat === "__CUSTOM__") cat = document.getElementById('add-custom-category').value.trim();
    
    const prefix = "ITEM";
    if (cat && cat.length >= 3) {
        prefix = cat.substring(0, 4).toUpperCase().replace(/[^A-Z]/g, '');
    }

    const highestNum = 0;
    fullDataCache.forEach(p => {
        if (p.id.toUpperCase().startsWith(prefix)) {
            const parts = p.id.split('-');
            const num = parseInt(parts[parts.length - 1]);
            if (!isNaN(num) && num > highestNum) highestNum = num;
        }
    });

    const nextNum = String(highestNum + 1).padStart(3, '0');
    const suggestedId = `${prefix}-${nextNum}`;

    const inputEl = document.getElementById('add-product-id');
    inputEl.value = suggestedId;
    clearIdValidationError();
    showToast(`Suggested Product ID: ${suggestedId}`, "success");
}

function clearIdValidationError() {
    const inputEl = document.getElementById('add-product-id');
    inputEl.className = "w-full p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-100 uppercase font-mono focus:outline-none focus:border-amber-400 transition-colors";
    document.getElementById('id-error-msg').classList.add('hidden');
}

async function reloadPreview() {
    const tbody = document.getElementById('admin-preview-body');
    tbody.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-amber-400"><i class="fa-solid fa-spinner animate-spin mr-2"></i> Syncing from Google Sheet...</td></tr>`;
    selectedItemIds.clear();
    updateBulkDeleteUI();

    try {
        const res = await fetch(`${REFRESH_STREAM_URL}&t=${new Date().getTime()}`);
        const csv = await res.text();
        fullDataCache = parseCSV(csv);
        resetAdminPaginationAndFilter();
    } catch {
        tbody.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-red-400">Failed to pull database. Check Sheet sharing settings.</td></tr>`;
    }
}

// RESET PAGINATION & APPLY ADVANCED FILTERS
function resetAdminPaginationAndFilter() {
    adminCurrentPage = 1;
    applyAdminFilters();
}

function applyAdminFilters() {
    const term = document.getElementById('admin-search').value.toLowerCase().trim();
    const selectedCategory = document.getElementById('admin-category-filter').value;
    const stockFilter = document.getElementById('admin-stock-filter').value;
    const sortBy = document.getElementById('admin-sort-select').value;

    // 1. FILTERING
    filteredAdminCache = fullDataCache.filter(p => {
        const matchSearch = p.title.toLowerCase().includes(term) || p.id.toLowerCase().includes(term);
        const matchCat = selectedCategory === "all" || p.category === selectedCategory;
        const matchStock = stockFilter === "all" || 
            (stockFilter === "instock" && p.stockQty > 0) || 
            (stockFilter === "outofstock" && p.stockQty <= 0);

        return matchSearch && matchCat && matchStock;
    });

    // 2. SORTING
    filteredAdminCache.sort((a, b) => {
        if (sortBy === "id_asc") return a.id.localeCompare(b.id);
        if (sortBy === "title_asc") return a.title.localeCompare(b.title);
        if (sortBy === "price_low") return parseFloat(a.price) - parseFloat(b.price);
        if (sortBy === "price_high") return parseFloat(b.price) - parseFloat(a.price);
        if (sortBy === "stock_low") return a.stockQty - b.stockQty;
        return 0;
    });

    document.getElementById('admin-count').innerText = filteredAdminCache.length;
    renderAdminTablePage();
}

function renderAdminTablePage() {
    const tbody = document.getElementById('admin-preview-body');
    tbody.innerHTML = '';

    if (filteredAdminCache.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-slate-500">No products matching the selected filters.</td></tr>`;
        updateAdminPaginationUI(0);
        return;
    }

    const totalPages = Math.ceil(filteredAdminCache.length / ADMIN_ITEMS_PER_PAGE);
    updateAdminPaginationUI(totalPages);

    const startIndex = (adminCurrentPage - 1) * ADMIN_ITEMS_PER_PAGE;
    const pageItems = filteredAdminCache.slice(startIndex, startIndex + ADMIN_ITEMS_PER_PAGE);

    pageItems.forEach(p => {
        const isOutOfStock = p.stockQty <= 0;
        const isChecked = selectedItemIds.has(p.id);
        const mediaCount = p.rawMediaUrls ? p.rawMediaUrls.split(',').filter(s=>s.trim()).length : 1;
        const primaryCover = p.image || 'https://placehold.co/100';

        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-900/40 transition-colors";
        tr.innerHTML = `
            <td class="p-4 text-center">
                <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleRowSelection('${p.id}', this.checked)" class="row-checkbox rounded bg-slate-900 border-slate-700 text-amber-400 cursor-pointer">
            </td>
            <td class="p-4 font-mono text-slate-400 text-xs font-bold">${p.id}</td>
            <td class="p-4 flex items-center gap-3">
                <img src="${primaryCover}" class="w-10 h-10 object-cover rounded border border-slate-800" onerror="this.src='https://placehold.co/100'">
                <div>
                    <span class="font-semibold text-slate-100 block">${p.title}</span>
                    <span class="text-[10px] text-slate-400 block">${p.category}</span>
                    <span class="text-[9px] bg-slate-800 text-amber-400 font-mono px-1.5 py-0.5 rounded border border-slate-700 inline-block mt-0.5"><i class="fa-solid fa-photo-film mr-1"></i>${mediaCount} Media</span>
                </div>
            </td>
            <td class="p-4 font-mono font-bold text-amber-400">₹${p.price}</td>
            <td class="p-4 font-mono text-xs text-slate-400">${p.retailPrice ? '₹' + p.retailPrice : '--'}</td>
            <td class="p-4 font-mono text-xs">
                ${isOutOfStock ? `<span class="text-red-400 font-bold">0 (Out)</span>` : `<span class="text-emerald-400">${p.stockQty}</span>`}
            </td>
            <td class="p-4 font-mono text-xs text-slate-300">${p.minQty}</td>
            <td class="p-4 text-center">
                <div class="flex items-center justify-center gap-2">
                    <button onclick="openEmailModal('${p.title}', '${p.price}')" class="p-1.5 bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white rounded transition-colors" title="Send Email Invoice"><i class="fa-solid fa-envelope text-xs"></i></button>
                    <button onclick="editProduct('${p.id}')" class="p-1.5 bg-slate-800 hover:bg-amber-400 hover:text-slate-950 text-slate-300 rounded transition-colors" title="Edit"><i class="fa-solid fa-pen-to-square text-xs"></i></button>
                    <button onclick="deleteSingleProduct('${p.id}')" class="p-1.5 bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white rounded transition-colors" title="Delete"><i class="fa-solid fa-trash-can text-xs"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function updateAdminPaginationUI(totalPages) {
    const actualPages = totalPages === 0 ? 1 : totalPages;
    document.getElementById('admin-current-page').innerText = adminCurrentPage;
    document.getElementById('admin-total-pages').innerText = actualPages;

    document.getElementById('admin-prev-btn').disabled = (adminCurrentPage === 1);
    document.getElementById('admin-next-btn').disabled = (adminCurrentPage >= actualPages);
}

function changeAdminPage(delta) {
    adminCurrentPage += delta;
    renderAdminTablePage();
}

function editProduct(productId) {
    const item = fullDataCache.find(p => p.id === productId);
    if (!item) return;

    document.getElementById('editing-product-id').value = item.id;
    
    const idInput = document.getElementById('add-product-id');
    idInput.value = item.id;
    idInput.readOnly = true;
    idInput.className = "w-full p-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-400 font-mono cursor-not-allowed";

    document.getElementById('add-title').value = item.title;
    document.getElementById('add-price').value = item.price;
    document.getElementById('add-retail-price').value = item.retailPrice || '';
    document.getElementById('add-stock-qty').value = item.stockQty;
    document.getElementById('add-min-qty').value = item.minQty;
    document.getElementById('add-image').value = item.rawMediaUrls || item.image || '';

    document.getElementById('btn-auto-id').classList.add('hidden');
    document.getElementById('form-header-title').innerHTML = `<i class="fa-solid fa-pen-to-square text-amber-400"></i> Update Product (#${item.id})`;
    document.getElementById('clear-form-btn').classList.remove('hidden');
    
    const submitBtn = document.getElementById('submit-item-btn');
    submitBtn.className = "w-full bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold py-3 rounded-lg text-xs uppercase tracking-wider flex items-center justify-center gap-2";
    submitBtn.innerHTML = `<i class="fa-solid fa-arrows-rotate"></i> Update Product in Sheet`;

    globalThis.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetFormToCreateState() {
    document.getElementById('editing-product-id').value = '';
    document.getElementById('add-product-form').reset();
    
    const idInput = document.getElementById('add-product-id');
    idInput.readOnly = false;
    clearIdValidationError();

    document.getElementById('btn-auto-id').classList.remove('hidden');
    document.getElementById('form-header-title').innerHTML = `<i class="fa-solid fa-cloud-arrow-up text-amber-400"></i> Add New Product`;
    document.getElementById('clear-form-btn').classList.add('hidden');
    const submitBtn = document.getElementById('submit-item-btn');
    submitBtn.className = "w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg text-xs uppercase tracking-wider flex items-center justify-center gap-2";
    submitBtn.innerHTML = `<i class="fa-solid fa-plus-circle"></i> Save Item to Google Sheet`;
}

async function handleProductSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('submit-item-btn');
    const editingId = document.getElementById('editing-product-id').value;
    const isEditing = Boolean(editingId);

    const typedId = document.getElementById('add-product-id').value.trim().toUpperCase();

    if (!isEditing) {
        const duplicate = fullDataCache.find(p => p.id.toUpperCase() === typedId);
        if (duplicate) {
            const idInput = document.getElementById('add-product-id');
            idInput.className = "w-full p-2.5 bg-red-950/30 border-2 border-red-500 rounded-lg text-sm text-red-200 uppercase font-mono focus:outline-none";
            document.getElementById('id-error-msg').classList.remove('hidden');
            showToast(`Product ID '${typedId}' already exists!`, "error");
            idInput.focus();
            return;
        }
    }

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> ${isEditing ? 'Updating...' : 'Saving...'}`;

    const payload = {
        action: isEditing ? "updateProduct" : "addProduct",
        passcode: authenticatedPasscode,
        id: typedId,
        title: document.getElementById('add-title').value.trim(),
        category: document.getElementById('add-category-select').value === "__CUSTOM__" ? document.getElementById('add-custom-category').value.trim() : document.getElementById('add-category-select').value,
        price: document.getElementById('add-price').value.trim(),
        retailPrice: document.getElementById('add-retail-price').value.trim(),
        stockQty: document.getElementById('add-stock-qty').value,
        minQty: document.getElementById('add-min-qty').value,
        image: document.getElementById('add-image').value.trim()
    };

    try {
        await fetch(GOOGLE_APPS_SCRIPT_URL, { 
            method: 'POST', 
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload) 
        });

        showToast(isEditing ? "Item updated!" : "Item saved to Sheet!", "success");
        resetFormToCreateState();
        setTimeout(reloadPreview, 1200);
    } catch {
        showToast("Network operation failed.", "error");
    } finally {
        btn.disabled = false;
    }
}

async function deleteSingleProduct(productId) {
    if (!confirm(`Delete item #${productId}?`)) return;

    try {
        await fetch(GOOGLE_APPS_SCRIPT_URL, { 
            method: 'POST', 
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: "deleteProduct", passcode: authenticatedPasscode, id: productId }) 
        });

        showToast(`Item deleted!`, "success");
        setTimeout(reloadPreview, 1200);
    } catch  { showToast("Could not delete item.", "error"); }
}

function toggleRowSelection(productId, isChecked) {
    if (isChecked) selectedItemIds.add(productId);
    else selectedItemIds.delete(productId);
    updateBulkDeleteUI();
}

function toggleSelectAllRows(masterCheckbox) {
    document.querySelectorAll('.row-checkbox').forEach(cb => cb.checked = masterCheckbox.checked);
    selectedItemIds.clear();
    if (masterCheckbox.checked) filteredAdminCache.forEach(p => selectedItemIds.add(p.id));
    updateBulkDeleteUI();
}

function updateBulkDeleteUI() {
    const btn = document.getElementById('bulk-delete-btn');
    document.getElementById('selected-count').innerText = selectedItemIds.size;
    if (selectedItemIds.size > 0) btn.classList.remove('hidden');
    else btn.classList.add('hidden');
}

async function handleBulkDelete() {
    if (!confirm(`Bulk delete ${selectedItemIds.size} items?`)) return;

    try {
        await fetch(GOOGLE_APPS_SCRIPT_URL, { 
            method: 'POST', 
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: "bulkDeleteProducts", passcode: authenticatedPasscode, ids: Array.from(selectedItemIds) }) 
        });

        showToast("Bulk delete completed!", "success");
        setTimeout(reloadPreview, 1200);
    } catch { showToast("Bulk delete failed.", "error"); }
}

function openEmailModal(title, price) {
    document.getElementById('email-order-items').value = `1x ${title} @ Rs ${price}`;
    document.getElementById('email-total-amount').value = price;
    document.getElementById('email-modal').classList.remove('invisible', 'opacity-0');
}

function closeEmailModal() { document.getElementById('email-modal').classList.add('invisible', 'opacity-0'); }

async function handleSendEmailNotification(e) {
    e.preventDefault();
    const btn = document.getElementById('send-email-btn');
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Sending Email Invoice...`;

    const payload = {
        action: "sendOrderEmail",
        passcode: authenticatedPasscode,
        customerName: document.getElementById('email-cust-name').value.trim(),
        customerEmail: document.getElementById('email-cust-addr').value.trim(),
        orderItems: document.getElementById('email-order-items').value.trim(),
        totalAmount: document.getElementById('email-total-amount').value,
        orderId: Math.floor(100000 + Math.random() * 900000)
    };

    try {
        await fetch(GOOGLE_APPS_SCRIPT_URL, { 
            method: 'POST', 
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload) 
        });

        showToast("Order invoice email sent successfully!", "success");
        closeEmailModal();
    } catch  {
        showToast("Could not send email.", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Send Email with UPI Scanner`;
    }
}

function parseCSV(text) {
    const lines = text.split(/\r?\n/);
    if(lines.length < 2) return [];
    const clean = t => t ? t.replace(/^"|"$/g, '').trim() : '';
    const splitRow = r => r.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || r.split(',');

    const headers = splitRow(lines[0]).map(h => clean(h).toLowerCase());
    const list = [];

    for(const i=1; i<lines.length; i++) {
        if(!lines[i].trim()) continue;
        const cols = splitRow(lines[i]);
        const obj = {};
        headers.forEach((h, idx) => obj[h] = clean(cols[idx]));

        const id = obj['product id'] || obj['productid'] || obj['id'];
        const title = obj['product name'] || obj['productname'] || obj['title'];
        const wholesalePrice = obj['wholesale price'] || obj['wholesaleprice'] || obj['price'] || '0';
        const retailPrice = obj['retail price'] || obj['retailprice'] || '';
        const rawStock = obj['stock qty'] || obj['stockqty'] || obj['stock_qty'];
        const rawMin = obj['moq'] || obj['min qty'] || obj['min_qty'];
        const category = obj['category'] || 'General';
        const rawMedia = obj['photo url'] || obj['photourl'] || obj['image'] || '';

        if(id && title) {
            const stock = parseInt(rawStock);
            if(isNaN(stock)) stock = 999;
            const min = parseInt(rawMin);
            if(isNaN(min) || min < 1) min = 1;

            const firstUrl = rawMedia.split(',')[0] ? rawMedia.split(',')[0].trim() : '';

            list.push({
                id: String(id).trim(),
                title: String(title).trim(),
                category: String(category).trim(),
                price: String(wholesalePrice).trim(),
                retailPrice: String(retailPrice).trim(),
                image: firstUrl,
                rawMediaUrls: String(rawMedia).trim(),
                details: obj['details'] || '',
                stockQty: stock,
                minQty: min
            });
        }
    }
    return list;
}

globalThis.addToCart = addToCart;
globalThis.changeQty = changeQty;
globalThis.toggleFav = toggleFav;
globalThis.toggleFavFilter = toggleFavFilter;
globalThis.sendBulkWhatsAppOrder = sendBulkWhatsAppOrder;
globalThis.openChatWithProduct = openChatWithProduct;
globalThis.submitBoundReview = submitBoundReview;
