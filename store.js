// deno-lint-ignore-file no-unused-vars

const WHATSAPP_NUMBER = "919039421800";
const GOOGLE_SHEET_ID = "1efQ_LCxjLrIThXt0FBt4Z9DPNIX7bmvmNcFQVZf0EN8"; 
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwM8ID2ppIXciDN1-SFM0lF_xvgVQEReyOHJGj0zQkC1aXHFXlBbioj2BwJER78sPmAPg/exec";

const MAIN_DATA_URL = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv`;
const CATEGORIES_DATA_URL = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv&gid=1955100008`;

const defaultItems = [
    { id: "KITCH-001", title: "Coffee machine", category: "Kitchen Appliances", price: "193", retailPrice: "300", mediaList: [{ type: "image", url: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=500" }], details: "Coffee maker device.", stockQty: 100, minQty: 1 }
];

const catalogItems = [];
const filteredItemsCache = []; 
const allStoreReviews = []; 
const currentActiveProductId = null;
const currentActiveMediaList = [];
const currentMediaIndex = 0;

// Lightbox Pan/Zoom State
const lightboxZoomScale = 1;
const lightboxPanX = 0, lightboxPanY = 0;
const isDraggingLightbox = false;
const dragStartX = 0, dragStartY = 0;

const markedFavorites = JSON.parse(localStorage.getItem('shop_customer_favorites')) || [];
const onlyShowFavs = false;
const shoppingCart = {};

const ITEMS_PER_PAGE = 10; 
const currentPage = 1;
const currentLayoutView = "grid"; 

async function loadInitialData() {
    // 1. Fetch Main Catalog First
    try {
        const response = await fetch(`${MAIN_DATA_URL}&timestamp=${new Date().getTime()}`);
        if (!response.ok) throw new Error("Failed to load catalog");
        parseCsvToCatalog(await response.text());
        populateChatDropdown();
    } catch {
        console.warn("Using default fallback items due to fetch error:", e.message);
        catalogItems = defaultItems;
        populateChatDropdown();
    }

    // 2. Fetch Categories Tab CSV (or Fallback to Unique Catalog Categories)
    try {
        const catResponse = await fetch(`${CATEGORIES_DATA_URL}&timestamp=${new Date().getTime()}`);
        if (catResponse.ok) {
            const catCsv = await catResponse.text();
            populateCategoriesFromCsv(catCsv);
        } else {
            generateFallbackCategories();
        }
    } catch {
        console.warn("Could not load categories sheet tab, extracting from main catalog instead.");
        generateFallbackCategories();
    }

    fetchStoreReviews();
    applyFilters();
    updateCartUI();
}

async function fetchStoreReviews() {
    if (!GOOGLE_APPS_SCRIPT_URL) return;
    try {
        const res = await fetch(GOOGLE_APPS_SCRIPT_URL);
        if (res.ok) {
            allStoreReviews = await res.json();
            applyFilters();
        }
    } catch { // intentionally kept empty}
}

function isVideoUrl(url) {
    if(!url) return false;
    const cleanUrl = url.toLowerCase();
    return cleanUrl.includes('.mp4') || cleanUrl.includes('.webm') || cleanUrl.includes('.ogg') || cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be');
}

function parseMediaUrls(rawString) {
    if (!rawString || !rawString.trim()) {
        return [{ type: 'image', url: 'https://placehold.co/600x600?text=No+Image' }];
    }
    
    const urls = rawString.split(',').map(s => s.trim()).filter(s => s.length > 0);
    if (urls.length === 0) return [{ type: 'image', url: 'https://placehold.co/600x600?text=No+Image' }];

    return urls.map(u => ({
        type: isVideoUrl(u) ? 'video' : 'image',
        url: u
    }));
}

function getItemRatingSummary(productId) {
    const itemReviews = allStoreReviews.filter(r => String(r.productId) === String(productId));
    if (itemReviews.length === 0) {
        return { count: 0, avg: 0, html: `<span class="text-slate-400 font-normal"><i class="fa-regular fa-star mr-1"></i>No reviews</span>` };
    }

    const total = itemReviews.reduce((sum, r) => sum + (parseInt(r.rating) || 5), 0);
    const avg = (total / itemReviews.length).toFixed(1);
    
    return {
        count: itemReviews.length,
        avg: avg,
        html: `<span class="text-amber-500 font-bold"><i class="fa-solid fa-star mr-1"></i>${avg} (${itemReviews.length})</span>`
    };
}

function populateCategoriesFromCsv(csvText) {
    const filterDropdown = document.getElementById('category-filter');
    if (!filterDropdown) return;

    const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
    const categoriesList = [];

    lines.forEach(category => {
        const cleanCat = category.replace(/^"|"$/g, '').trim();
        const lowerCat = cleanCat.toLowerCase();
        if (cleanCat && lowerCat !== 'category' && lowerCat !== 'categories') {
            categoriesList.push(cleanCat);
        }
    });

    if (categoriesList.length === 0) {
        generateFallbackCategories();
        return;
    }

    // Deduplicate and Sort Categories
    categoriesList = [...new Set(categoriesList)].sort();

    filterDropdown.innerHTML = `<option value="all">All Categories</option>`;
    categoriesList.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.innerText = category;
        filterDropdown.appendChild(option);
    });
}

// Fallback: Dynamically generate category list from catalog items
function generateFallbackCategories() {
    const filterDropdown = document.getElementById('category-filter');
    if (!filterDropdown) return;

    const uniqueCategories = [...new Set(catalogItems.map(item => item.category).filter(c => c && c.trim() !== ''))].sort();
    
    filterDropdown.innerHTML = `<option value="all">All Categories</option>`;
    uniqueCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.innerText = category;
        filterDropdown.appendChild(option);
    });
}

function parseCsvToCatalog(text) {
    const lines = text.split(/\r?\n/);
    if(lines.length < 2) return;
    const clean = t => t ? t.replace(/^"|"$/g, '').trim() : '';
    const splitRow = r => r.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || r.split(',');

    const headers = splitRow(lines[0]).map(h => clean(h).toLowerCase());
    catalogItems = [];

    for(const i = 1; i < lines.length; i++) {
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
        const rawPhotoUrl = obj['photo url'] || obj['photourl'] || obj['image'] || '';

        if(id && title) {
            const stock = parseInt(rawStock);
            if(isNaN(stock)) stock = 999;
            const min = parseInt(rawMin);
            if(isNaN(min) || min < 1) min = 1;

            catalogItems.push({
                id: String(id).trim(),
                title: String(title).trim(),
                category: String(category).trim(),
                price: String(wholesalePrice).trim(),
                retailPrice: String(retailPrice).trim(),
                mediaList: parseMediaUrls(rawPhotoUrl),
                details: obj['details'] || '',
                stockQty: stock,
                minQty: min
            });
        }
    }
}

function populateChatDropdown() {
    const select = document.getElementById('chat-product-select');
    if(!select) return;
    select.innerHTML = `<option value="__GENERAL__">General Inquiry (No Product)</option>`;
    catalogItems.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.innerText = `${p.title} (ID: ${p.id})`;
        select.appendChild(opt);
    });
}

function switchLayoutView(targetView) {
    currentLayoutView = targetView;
    const gridBtn = document.getElementById('view-grid-btn');
    const listBtn = document.getElementById('view-list-btn');
    const gridContainer = document.getElementById('showroom-grid');

    if (targetView === "grid") {
        gridBtn.className = "w-10 h-10 rounded-md flex items-center justify-center bg-slate-100 border border-slate-200 text-slate-900 transition-all";
        listBtn.className = "w-10 h-10 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-800 transition-all";
        gridContainer.className = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 scroll-mt-24";
    } else {
        gridBtn.className = "w-10 h-10 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-800 transition-all";
        listBtn.className = "w-10 h-10 rounded-md flex items-center justify-center bg-slate-100 border border-slate-200 text-slate-900 transition-all";
        gridContainer.className = "flex flex-col gap-4 w-full scroll-mt-24";
    }
    applyFilters();
}

function applyFilters() {
    const grid = document.getElementById('showroom-grid');
    const emptyState = document.getElementById('empty-state');
    if(!grid) return;

    const term = document.getElementById('search-input').value.toLowerCase();
    const cat = document.getElementById('category-filter').value;

    document.getElementById('fav-count').innerText = markedFavorites.length;
    grid.innerHTML = '';

    filteredItemsCache = catalogItems.filter(p => {
        const matchSearch = p.title.toLowerCase().includes(term) || (p.details && p.details.toLowerCase().includes(term));
        const matchCat = cat === 'all' || p.category === cat;
        const matchFav = !onlyShowFavs || markedFavorites.includes(p.id);
        return matchSearch && matchCat && matchFav;
    });

    if(filteredItemsCache.length === 0) {
        emptyState.classList.remove('hidden');
        updatePaginationControls(0);
        return;
    }
    emptyState.classList.add('hidden');

    const totalPages = Math.ceil(filteredItemsCache.length / ITEMS_PER_PAGE);
    updatePaginationControls(totalPages);

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedItemsChunk = filteredItemsCache.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    paginatedItemsChunk.forEach(p => {
        const isFav = markedFavorites.includes(p.id);
        const inCartQty = shoppingCart[p.id] || 0;
        const isOutOfStock = p.stockQty <= 0;
        const ratingSummary = getItemRatingSummary(p.id);
        const primaryCover = p.mediaList && p.mediaList.length > 0 ? p.mediaList[0] : { type: 'image', url: 'https://placehold.co/400x300?text=Electricals' };
        const hasMultipleMedia = p.mediaList.length > 1;
        
        const itemCard = document.createElement('div');
        
        const renderActionButton = () => {
            if (isOutOfStock) {
                return `<button disabled class="w-full bg-slate-200 text-slate-400 font-semibold py-2 rounded-lg text-xs flex items-center justify-center gap-2 cursor-not-allowed"><i class="fa-solid fa-lock"></i> Out of Stock</button>`;
            }
            if (inCartQty > 0) {
                return `
                    <div class="flex items-center justify-between bg-slate-100 rounded-lg p-1 border border-slate-200 w-full">
                        <button onclick="changeQty('${p.id}', -1)" class="w-8 h-8 bg-white hover:bg-slate-200 text-slate-900 rounded font-bold flex items-center justify-center transition-colors">-</button>
                        <span class="font-bold text-sm text-slate-900 px-2">${inCartQty}</span>
                        <button onclick="changeQty('${p.id}', 1)" class="w-8 h-8 bg-white hover:bg-slate-200 text-slate-900 rounded font-bold flex items-center justify-center transition-colors">+</button>
                    </div>
                `;
            }
            return `<button onclick="addToCart('${p.id}')" class="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2 rounded-lg text-xs flex items-center justify-center gap-2 transition-colors"><i class="fa-solid fa-cart-plus"></i> Add to List</button>`;
        };

        if (currentLayoutView === "grid") {
            itemCard.className = `bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs flex flex-col justify-between group hover:shadow-md transition-all relative ${isOutOfStock ? 'opacity-85' : ''}`;
            itemCard.innerHTML = `
                <div class="h-44 bg-slate-900 relative overflow-hidden cursor-pointer" onclick="openDetailsModal('${p.id}')">
                    ${primaryCover.type === 'video' ? `
                        <video src="${primaryCover.url}" class="w-full h-full object-cover" muted loop autoplay playsinline></video>
                        <span class="absolute top-2 left-2 bg-slate-950/80 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 z-10"><i class="fa-solid fa-circle-play"></i> Video</span>
                    ` : `
                        <img src="${primaryCover.url}" class="w-full h-full object-cover group-hover:scale-102 transition-transform" onerror="this.src='https://placehold.co/400x300?text=Electricals'">
                    `}
                    ${hasMultipleMedia ? `<span class="absolute bottom-2 right-2 bg-slate-950/80 text-white text-[10px] font-mono px-1.5 py-0.5 rounded shadow z-10"><i class="fa-solid fa-images mr-1"></i>${p.mediaList.length}</span>` : ''}
                    ${isOutOfStock ? `
                        <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center">
                            <span class="bg-red-600 text-white text-xs font-black px-3 py-1.5 rounded-md tracking-wider uppercase shadow-md"><i class="fa-solid fa-triangle-exclamation mr-1"></i> Out of Stock</span>
                        </div>
                    ` : ''}
                    <div class="absolute top-2.5 right-2.5 flex flex-col gap-1.5 z-10">
                        <button onclick="event.stopPropagation(); toggleFav('${p.id}')" class="bg-white/90 w-8 h-8 rounded-full flex items-center justify-center text-slate-600 hover:text-red-500 shadow-xs"><i class="${isFav ? 'fa-solid text-red-500' : 'fa-regular'} fa-heart"></i></button>
                        <button onclick="event.stopPropagation(); openChatWithProduct('${p.id}')" class="bg-white/90 w-8 h-8 rounded-full flex items-center justify-center text-emerald-600 hover:text-emerald-700 shadow-xs" title="Ask details on WhatsApp"><i class="fa-brands fa-whatsapp text-xs"></i></button>
                    </div>
                </div>
                <div class="p-4 flex-1 flex flex-col justify-between">
                    <div class="cursor-pointer" onclick="openDetailsModal('${p.id}')">
                        <div class="flex justify-between items-center text-xs mb-1">
                            <span class="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-sm uppercase">${p.category}</span>
                            <span class="text-[11px]">${ratingSummary.html}</span>
                        </div>
                        <h4 class="font-bold text-slate-900 mt-1 mb-1 line-clamp-1 group-hover:text-amber-600 transition-colors">${p.title}</h4>
                        <p class="text-[10px] text-slate-400 font-mono">ID: ${p.id}</p>
                    </div>
                    <div class="mt-2">
                        <div class="flex items-baseline gap-1 mb-1">
                            <span class="text-lg font-extrabold text-slate-900"><span class="text-xs font-normal text-slate-400">₹</span>${p.price}</span>
                            ${p.retailPrice ? `<span class="text-xs text-slate-400 line-through">MRP ₹${p.retailPrice}</span>` : ''}
                        </div>
                        <p class="text-[10px] text-slate-500 font-medium mb-3"><i class="fa-solid fa-boxes-packing text-amber-500 mr-1"></i>Min. Order Quantity: <strong>${p.minQty} units</strong></p>
                        
                        <div id="action-wrapper-${p.id}">
                            ${renderActionButton()}
                        </div>
                    </div>
                </div>
            `;
        } else {
            itemCard.className = `bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between group hover:shadow-md transition-all relative p-3 sm:p-4 gap-3 sm:gap-5 w-full ${isOutOfStock ? 'opacity-85' : ''}`;
            itemCard.innerHTML = `
                <div class="w-full sm:w-36 h-36 sm:h-32 bg-slate-900 rounded-lg relative overflow-hidden flex-shrink-0 cursor-pointer" onclick="openDetailsModal('${p.id}')">
                    ${primaryCover.type === 'video' ? `
                        <video src="${primaryCover.url}" class="w-full h-full object-cover" muted loop autoplay playsinline></video>
                    ` : `
                        <img src="${primaryCover.url}" class="w-full h-full object-cover group-hover:scale-102 transition-transform" onerror="this.src='https://placehold.co/400x300?text=Electricals'">
                    `}
                    ${hasMultipleMedia ? `<span class="absolute bottom-2 right-2 bg-slate-950/80 text-white text-[10px] font-mono px-1.5 py-0.5 rounded shadow z-10"><i class="fa-solid fa-images mr-1"></i>${p.mediaList.length}</span>` : ''}
                </div>
                
                <div class="flex-1 min-w-0 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 w-full">
                    <div class="cursor-pointer flex-1 min-w-0" onclick="openDetailsModal('${p.id}')">
                        <div class="flex items-center gap-3 mb-1">
                            <span class="text-[8px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded-sm uppercase">${p.category}</span>
                            <span class="text-[11px]">${ratingSummary.html}</span>
                        </div>
                        <h4 class="font-bold text-sm sm:text-base text-slate-900 truncate mb-1">${p.title}</h4>
                        <p class="text-[10px] text-slate-400 font-mono mb-1">ID: ${p.id}</p>
                        <p class="text-[10px] text-slate-500 font-medium"><i class="fa-solid fa-boxes-packing text-amber-500 mr-1"></i>Min. Order Quantity: <strong>${p.minQty} units</strong></p>
                    </div>

                    <div class="flex flex-col items-end justify-center w-full md:w-48 gap-2 border-t border-slate-100 md:border-0 pt-2 md:pt-0">
                        <div class="text-right w-full flex justify-between md:justify-end items-baseline gap-2">
                            <span class="text-xs text-slate-400 md:hidden">Price:</span>
                            <div>
                                <span class="text-base sm:text-xl font-black text-slate-900">₹${p.price}</span>
                                ${p.retailPrice ? `<span class="text-[10px] text-slate-400 line-through ml-1">MRP ₹${p.retailPrice}</span>` : ''}
                            </div>
                        </div>

                        <div class="flex items-center gap-2 w-full">
                            <button onclick="openChatWithProduct('${p.id}')" class="h-9 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs flex items-center justify-center transition-colors shadow-2xs" title="Ask details on WhatsApp">
                                <i class="fa-brands fa-whatsapp text-base"></i>
                            </button>
                            <div class="flex-1" id="action-wrapper-${p.id}">
                                ${renderActionButton()}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        grid.appendChild(itemCard);
    });
}

function openDetailsModal(id) {
    const product = catalogItems.find(p => p.id === id);
    if (!product) return;

    currentActiveProductId = product.id;
    currentActiveMediaList = product.mediaList || [{ type: 'image', url: 'https://placehold.co/600x600?text=No+Image' }];
    currentMediaIndex = 0;

    document.getElementById('modal-category').innerText = product.category;
    document.getElementById('modal-title').innerText = product.title;
    document.getElementById('modal-id').innerText = product.id;
    document.getElementById('modal-details').innerText = product.details || "No technical specs listed.";
    document.getElementById('modal-price').innerText = product.price;

    const mrpWrapper = document.getElementById('modal-mrp-wrapper');
    if (product.retailPrice) {
        document.getElementById('modal-mrp').innerText = product.retailPrice;
        mrpWrapper.classList.remove('hidden');
    } else {
        mrpWrapper.classList.add('hidden');
    }

    document.getElementById('modal-moq-text').innerHTML = `<i class="fa-solid fa-boxes-packing text-amber-500 mr-1"></i> Min. Order Quantity: <strong>${product.minQty} units</strong> (In Stock: ${product.stockQty})`;

    const isOutOfStock = product.stockQty <= 0;
    const statusBadge = document.getElementById('modal-status-badge');
    statusBadge.innerText = isOutOfStock ? "Out of Stock" : "Available";
    statusBadge.className = isOutOfStock ? "text-xs bg-red-100 text-red-700 font-bold px-3 py-1 rounded-md uppercase border border-red-200" : "text-xs bg-emerald-100 text-emerald-700 font-bold px-3 py-1 rounded-md uppercase border border-emerald-200";

    const inCartQty = shoppingCart[product.id] || 0;
    const actionContainer = document.getElementById('modal-action-wrapper');
    if (isOutOfStock) {
        actionContainer.innerHTML = `
            <button disabled class="flex-1 bg-slate-200 text-slate-400 font-semibold py-3 rounded-xl text-sm cursor-not-allowed"><i class="fa-solid fa-lock mr-1"></i> Out of Stock</button>
            <button onclick="openChatWithProduct('${product.id}')" class="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold px-4 py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-1.5"><i class="fa-brands fa-whatsapp text-lg"></i> Ask Details</button>
        `;
    } else if (inCartQty > 0) {
        actionContainer.innerHTML = `
            <div class="flex items-center justify-between bg-slate-100 rounded-lg p-1 border border-slate-200 max-w-xs flex-1">
                <button onclick="changeQty('${product.id}', -1); openDetailsModal('${product.id}')" class="w-10 h-10 bg-white text-slate-900 rounded-lg font-bold flex items-center justify-center">-</button>
                <span class="font-bold text-base text-slate-900 px-2">${inCartQty}</span>
                <button onclick="changeQty('${product.id}', 1); openDetailsModal('${product.id}')" class="w-10 h-10 bg-white text-slate-900 rounded-lg font-bold flex items-center justify-center">+</button>
            </div>
            <button onclick="openChatWithProduct('${product.id}')" class="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold px-4 rounded-xl transition-colors flex items-center justify-center gap-1.5"><i class="fa-brands fa-whatsapp text-lg"></i> Ask Details</button>
        `;
    } else {
        actionContainer.innerHTML = `
            <button onclick="addToCart('${product.id}'); openDetailsModal('${product.id}')" class="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors"><i class="fa-solid fa-cart-plus"></i> Add to List</button>
            <button onclick="openChatWithProduct('${product.id}')" class="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold px-4 rounded-xl transition-colors flex items-center justify-center gap-1.5"><i class="fa-brands fa-whatsapp text-lg"></i> Ask Details</button>
        `;
    }

    renderModalStageMedia();
    renderItemReviewsFeed(product.id);
    document.getElementById('details-modal').classList.remove('invisible', 'opacity-0');
}

function renderModalStageMedia() {
    const displayBox = document.getElementById('modal-main-display');
    const thumbsBox = document.getElementById('modal-thumbnails-strip');
    const counterBadge = document.getElementById('media-counter-badge');
    
    if (currentActiveMediaList.length === 0) return;

    const activeMedia = currentActiveMediaList[currentMediaIndex];
    counterBadge.innerText = `${currentMediaIndex + 1} / ${currentActiveMediaList.length}`;

    document.getElementById('stage-btn-prev').style.display = currentActiveMediaList.length > 1 ? 'flex' : 'none';
    document.getElementById('stage-btn-next').style.display = currentActiveMediaList.length > 1 ? 'flex' : 'none';

    if (activeMedia.type === 'video') {
        displayBox.innerHTML = `
            <video src="${activeMedia.url}" controls autoplay class="w-full h-full object-contain bg-black"></video>
        `;
    } else {
        displayBox.innerHTML = `
            <img src="${activeMedia.url}" class="w-full h-full object-contain cursor-pointer" onclick="openFullScreenLightbox()" onerror="this.src='https://placehold.co/600x600?text=No+Image'">
        `;
    }

    thumbsBox.innerHTML = '';
    if (currentActiveMediaList.length > 1) {
        currentActiveMediaList.forEach((m, idx) => {
            const thumb = document.createElement('div');
            const isActive = idx === currentMediaIndex;
            thumb.className = `w-14 h-14 rounded-lg overflow-hidden border-2 flex-shrink-0 cursor-pointer relative bg-slate-900 ${isActive ? 'border-amber-400 ring-2 ring-amber-400/50' : 'border-slate-200 opacity-60 hover:opacity-100'}`;
            
            if (m.type === 'video') {
                thumb.innerHTML = `
                    <video src="${m.url}" class="w-full h-full object-cover"></video>
                    <span class="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-xs"><i class="fa-solid fa-play"></i></span>
                `;
            } else {
                thumb.innerHTML = `<img src="${m.url}" class="w-full h-full object-cover" onerror="this.src='https://placehold.co/100'">`;
            }
            
            thumb.onclick = () => {
                currentMediaIndex = idx;
                renderModalStageMedia();
            };
            thumbsBox.appendChild(thumb);
        });
        thumbsBox.classList.remove('hidden');
    } else {
        thumbsBox.classList.add('hidden');
    }
}

function changeActiveMedia(delta) {
    if (currentActiveMediaList.length <= 1) return;
    currentMediaIndex = (currentMediaIndex + delta + currentActiveMediaList.length) % currentActiveMediaList.length;
    renderModalStageMedia();
}

function openFullScreenLightbox() {
    if (currentActiveMediaList.length === 0) return;
    lightboxZoomScale = 1;
    lightboxPanX = 0;
    lightboxPanY = 0;
    
    renderLightboxContent();
    document.getElementById('lightbox-modal').classList.remove('invisible', 'opacity-0');
}

function closeLightbox() {
    document.getElementById('lightbox-modal').classList.add('invisible', 'opacity-0');
}

function renderLightboxContent() {
    const contentBox = document.getElementById('lightbox-content-box');
    const counter = document.getElementById('lightbox-counter');
    const item = currentActiveMediaList[currentMediaIndex];

    counter.innerText = `${currentMediaIndex + 1} / ${currentActiveMediaList.length}`;
    document.getElementById('lightbox-btn-prev').style.display = currentActiveMediaList.length > 1 ? 'flex' : 'none';
    document.getElementById('lightbox-btn-next').style.display = currentActiveMediaList.length > 1 ? 'flex' : 'none';

    if (item.type === 'video') {
        contentBox.innerHTML = `<video src="${item.url}" controls autoplay class="max-w-full max-h-[85vh] object-contain"></video>`;
    } else {
        contentBox.innerHTML = `<img src="${item.url}" id="lightbox-img" class="max-w-full max-h-[85vh] object-contain transition-transform duration-100" style="transform: translate(${lightboxPanX}px, ${lightboxPanY}px) scale(${lightboxZoomScale});" onerror="this.src='https://placehold.co/800'">`;
    }
}

function navigateLightbox(delta) {
    currentMediaIndex = (currentMediaIndex + delta + currentActiveMediaList.length) % currentActiveMediaList.length;
    lightboxZoomScale = 1;
    lightboxPanX = 0;
    lightboxPanY = 0;
    renderLightboxContent();
    renderModalStageMedia();
}

function zoomLightbox(delta) {
    lightboxZoomScale = Math.max(0.8, Math.min(5, lightboxZoomScale + delta));
    updateLightboxTransform();
}

function resetLightboxZoom() {
    lightboxZoomScale = 1;
    lightboxPanX = 0;
    lightboxPanY = 0;
    updateLightboxTransform();
}

function updateLightboxTransform() {
    const img = document.getElementById('lightbox-img');
    if (img) {
        img.style.transform = `translate(${lightboxPanX}px, ${lightboxPanY}px) scale(${lightboxZoomScale})`;
    }
}

function startLightboxPan(e) {
    if (lightboxZoomScale <= 1) return;
    isDraggingLightbox = true;
    dragStartX = (e.clientX || e.touches[0].clientX) - lightboxPanX;
    dragStartY = (e.clientY || e.touches[0].clientY) - lightboxPanY;
}

function doLightboxPan(e) {
    if (!isDraggingLightbox) return;
    e.preventDefault();
    lightboxPanX = (e.clientX || e.touches[0].clientX) - dragStartX;
    lightboxPanY = (e.clientY || e.touches[0].clientY) - dragStartY;
    updateLightboxTransform();
}

function endLightboxPan() {
    isDraggingLightbox = false;
}

function addToCart(id) {
    const product = catalogItems.find(p => p.id === id);
    if (product && product.stockQty <= 0) {
        showToast("This item is currently out of stock!", "error");
        return;
    }
    shoppingCart[id] = product.minQty;
    updateCartUI();
    applyFilters();
    showToast(`Added ${product.minQty} units (Minimum Order Requirement)`, "success");
}

function changeQty(id, delta) {
    const product = catalogItems.find(p => p.id === id);
    if (!product || !shoppingCart[id]) return;

    const newQty = shoppingCart[id] + delta;
    
    if (newQty < product.minQty) {
        delete shoppingCart[id];
        showToast("Removed from list (below Minimum Order Quantity)", "info");
    } else if (newQty > product.stockQty) {
        showToast(`Only ${product.stockQty} units available in stock!`, "error");
        return;
    } else {
        shoppingCart[id] = newQty;
    }

    updateCartUI();
    applyFilters();
}

function updateCartUI() {
    const listContainer = document.getElementById('cart-items-list');
    const badge = document.getElementById('cart-badge');
    const totalSpan = document.getElementById('cart-total-price');
    if(!listContainer) return;
    
    listContainer.innerHTML = '';
    const totalItemCount = 0;
    const grandTotal = 0;

    Object.keys(shoppingCart).forEach(id => {
        const product = catalogItems.find(p => p.id === id);
        if (!product) return;

        const qty = shoppingCart[id];
        totalItemCount += qty;
        const priceNum = parseInt(String(product.price).replace(/,/g, '')) || 0;
        grandTotal += (priceNum * qty);
        const thumb = product.mediaList[0] ? product.mediaList[0].url : 'https://placehold.co/100';

        const itemRow = document.createElement('div');
        itemRow.className = "flex items-center gap-3 py-3 border-b border-slate-100";
        itemRow.innerHTML = `
            <img src="${thumb}" class="w-12 h-12 object-cover rounded border bg-slate-50" onerror="this.src='https://placehold.co/100'">
            <div class="flex-1 min-w-0">
                <h5 class="font-bold text-sm text-slate-900 truncate">${product.title}</h5>
                <p class="text-xs text-slate-400">Min: ${product.minQty} | ₹${product.price} each</p>
                <div class="flex items-center gap-2 mt-1.5">
                    <button onclick="changeQty('${id}', -1)" class="w-5 h-5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-bold text-xs flex items-center justify-center">-</button>
                    <span class="text-xs font-bold text-slate-800 px-1">${qty}</span>
                    <button onclick="changeQty('${id}', 1)" class="w-5 h-5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-bold text-xs flex items-center justify-center">+</button>
                </div>
            </div>
            <p class="font-extrabold text-sm text-slate-900 whitespace-nowrap">₹${(priceNum * qty).toLocaleString()}</p>
        `;
        listContainer.appendChild(itemRow);
    });

    badge.innerText = totalItemCount;
    totalSpan.innerText = grandTotal.toLocaleString();

    if (totalItemCount === 0) {
        listContainer.innerHTML = `<div class="text-center py-12 text-slate-400 text-sm"><i class="fa-solid fa-basket-shopping text-3xl mb-2 block"></i> Your store list is empty.</div>`;
    }
}

function renderItemReviewsFeed(productId) {
    const feedContainer = document.getElementById('reviews-feed');
    const badge = document.getElementById('review-count-badge');
    if (!feedContainer) return;

    feedContainer.innerHTML = '';
    const itemReviews = allStoreReviews.filter(r => String(r.productId) === String(productId));
    badge.innerText = `(${itemReviews.length} ${itemReviews.length === 1 ? 'review' : 'reviews'})`;

    if (itemReviews.length === 0) {
        feedContainer.innerHTML = `<p class="text-xs text-slate-400 text-center py-4">No reviews yet for this item.</p>`;
        return;
    }

    itemReviews.slice().reverse().forEach(rev => {
        const stars = "⭐".repeat(parseInt(rev.rating) || 5);
        const card = document.createElement('div');
        card.className = "bg-white p-2.5 rounded-lg border border-slate-200 text-xs";
        card.innerHTML = `
            <div class="flex justify-between items-center">
                <span class="font-bold text-slate-800">${rev.customerName || 'Customer'}</span>
                <span class="text-[10px] text-slate-400">${rev.timestamp ? String(rev.timestamp).split(',')[0] : ''}</span>
            </div>
            <div class="text-[11px]">${stars}</div>
            <p class="text-slate-600">${rev.reviewText || ''}</p>
        `;
        feedContainer.appendChild(card);
    });
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed top-5 right-5 z-50 flex flex-col gap-2 pointer-events-none';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `pointer-events-auto px-4 py-3 rounded-xl shadow-2xl border text-xs font-bold flex items-center gap-3 text-white transition-all ${
        type === 'success' ? 'bg-emerald-600 border-emerald-500' : 'bg-slate-800 border-slate-700'
    }`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

async function submitBoundReview(e) {
    e.preventDefault();
    const submitBtn = document.getElementById('review-submit-btn');
    
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Submitting...`;

    const name = document.getElementById('review-name').value.trim() || "Customer";
    const rating = parseInt(document.getElementById('selected-star-val').value) || 5;
    const text = document.getElementById('review-text').value.trim();

    const payload = {
        action: "addReview",
        productId: currentActiveProductId,
        customerName: name,
        rating: rating,
        reviewText: text
    };

    try {
        await fetch(GOOGLE_APPS_SCRIPT_URL, { 
            method: 'POST', 
            mode: 'no-cors', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload) 
        });

        allStoreReviews.push({ 
            timestamp: new Date().toLocaleDateString("en-IN"), 
            productId: currentActiveProductId, 
            customerName: name, 
            rating: rating, 
            reviewText: text 
        });

        renderItemReviewsFeed(currentActiveProductId);
        applyFilters();
        document.getElementById('item-review-form').reset();
        setStarRating(5);

        showToast("Review submitted successfully!", "success");
    } catch {
        showToast("Could not submit review.", "error");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i class="fa-solid fa-paper-plane text-xs"></i> Submit Review`;
    }
}

function closeDetailsModal() { document.getElementById('details-modal').classList.add('invisible', 'opacity-0'); }
function updatePaginationControls(totalPages) {
    const actualTotal = totalPages === 0 ? 1 : totalPages;
    document.getElementById('current-page-display').innerText = currentPage;
    document.getElementById('total-pages-display').innerText = actualTotal;
    document.getElementById('btn-prev-page').disabled = (currentPage === 1);
    document.getElementById('btn-next-page').disabled = (currentPage >= actualTotal);
}

function changePage(delta) { 
    currentPage += delta; 
    applyFilters(); 
    const catalogElem = document.getElementById('showroom-grid');
    if (catalogElem) catalogElem.scrollIntoView({ behavior: 'smooth' });
}

function toggleCartDrawer() { document.getElementById('cart-overlay').classList.toggle('invisible'); document.getElementById('cart-overlay').classList.toggle('opacity-0'); }

function sendBulkWhatsAppOrder() {
    const keys = Object.keys(shoppingCart);
    if (keys.length === 0) { alert("Please select items!"); return; }

    const messageText = `⚡ *WHOLESALE ORDER INQUIRY - MUN LIGHT* ⚡\n\n`;
    const runningTotal = 0;

    keys.forEach((id, index) => {
        const item = catalogItems.find(p => p.id === id);
        if (!item) return;
        const qty = shoppingCart[id];
        const priceNum = parseInt(String(item.price).replace(/,/g, '')) || 0;
        const subtotal = priceNum * qty;
        runningTotal += subtotal;

        messageText += `${index + 1}. *${item.title}*\n   - 🆔 ItemID: \`${item.id}\`\n   - 📦 Quantity: ${qty} units\n   - 💰 Subtotal: ₹${subtotal.toLocaleString()}\n\n`;
    });

    messageText += `───────────────────\n🛒 *Total Order Value:* ₹${runningTotal.toLocaleString()}\n\nPlease confirm stock and billing invoice.`;
    globalThis.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(messageText)}`, '_blank');
}

function toggleFav(id) {
    markedFavorites = markedFavorites.includes(id) ? markedFavorites.filter(fId => fId !== id) : [...markedFavorites, id];
    localStorage.setItem('shop_customer_favorites', JSON.stringify(markedFavorites));
    applyFilters();
}

function toggleFavFilter() { onlyShowFavs = !onlyShowFavs; resetToFirstPageAndFilter(); }
function resetToFirstPageAndFilter() { currentPage = 1; applyFilters(); }

const currentSelectedRating = 5;
function setStarRating(rating) { currentSelectedRating = rating; document.getElementById('selected-star-val').value = rating; highlightStars(rating); }
function highlightStars(count) {
    document.querySelectorAll('#star-rating-picker .star-btn').forEach((star, index) => {
        star.className = index < count ? "fa-solid fa-star star-btn text-amber-400" : "fa-regular fa-star star-btn text-slate-300";
    });
}
function resetStarHighlight() { highlightStars(currentSelectedRating); }
function updateCharCount(textarea) { document.getElementById('char-counter').innerText = `${150 - textarea.value.length} left`; }

function toggleChatWidget() { document.getElementById('chat-widget').classList.toggle('hidden'); }

function openChatWithProduct(productId) {
    closeDetailsModal();
    const select = document.getElementById('chat-product-select');
    if (select) select.value = productId;
    document.getElementById('chat-widget').classList.remove('hidden');
    document.getElementById('chat-message-text').focus();
}

function sendCustomChatInquiry() {
    const productId = document.getElementById('chat-product-select').value;
    const message = document.getElementById('chat-message-text').value.trim();

    if (!message) {
        showToast("Please enter your question details!", "error");
        return;
    }

    const msgPayload = `💬 *MUN LIGHT ELECTRICALS INQUIRY* 💬\n\n`;
    if (productId !== "__GENERAL__") {
        const product = catalogItems.find(p => p.id === productId);
        if (product) {
            msgPayload += `👉 *Regarding:* ${product.title}\n🆔 *ItemID:* \`${product.id}\`\n💰 *Price:* ₹${product.price}\n\n`;
        }
    } else {
        msgPayload += `👉 *Regarding:* General Store Inquiry\n\n`;
    }

    msgPayload += `📝 *Question:* ${message}`;
    globalThis.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msgPayload)}`, '_blank');
    document.getElementById('chat-message-text').value = '';
    toggleChatWidget();
}

globalThis.addEventListener('DOMContentLoaded', loadInitialData);
globalThis.addToCart = addToCart;
globalThis.changeQty = changeQty;
globalThis.toggleFav = toggleFav;
globalThis.toggleFavFilter = toggleFavFilter;
globalThis.switchLayoutView = switchLayoutView;
globalThis.openDetailsModal = openDetailsModal;
