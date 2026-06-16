/* ═══════════════════════════════════════════════════════
   SISSYTRENDS BOUTIQUE — Shared JavaScript  v3.0
   Elegant Styles for Every You
   Phone: 9344182144 | help@sissytrends.in
   www.sissytrends.in | Coimbatore
═══════════════════════════════════════════════════════ */

/* ── Brand constants ── */
const BRAND = {
  name:            'SissyTrends Boutique',
  nameShort:       'SissyTrends',
  tagline:         'Elegant Styles for Every You',
  phone:           '919344182144',
  phoneDisplay:    '+91 93441 82144',
  email:           'help@sissytrends.in',
  website:         'www.sissytrends.in',
  instagram:       'https://instagram.com/sissytrendsindia',
  instagramHandle: '@sissytrendsindia',
  facebook:        'https://facebook.com/SissyTrendsIndia',
  whatsapp:        'https://wa.me/919344182144',
  location:        'Coimbatore, Tamil Nadu',
};

/* ════════════════════════════════════════════════════
   STORAGE KEYS
   ════════════════════════════════════════════════════ */
// Resolve API base - works locally (port 5000) and on Render/production
function getApiBase(path) {
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  return isLocal && window.location.port !== '5000'
    ? 'http://localhost:5000' + path
    : path;
}
const STORE_KEY       = 'sissytrends_products_v3';
const WISHLIST_KEY    = 'st_wishlist_items';
const _productCache   = {}; // id → product, populated when products are fetched from API

// ── Session ID ── generate once per browser, persist in localStorage
const SESSION_KEY = 'st_session_id';
function getSessionId() {
  let sid = localStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    localStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}
const ANALYTICS_KEY   = 'st_analytics';
const INQUIRIES_KEY   = 'st_inquiries';
const RECENT_KEY      = 'st_recent_viewed';

/* ════════════════════════════════════════════════════
   PRODUCT ID GENERATION
   ════════════════════════════════════════════════════ */
function generateProductId(category, existingIds) {
  const prefix = { sarees:'SAR', jewellery:'JWL', decor:'DCR' }[category] || 'PRD';
  let n = 1;
  while (existingIds.has(`${prefix}-${String(n).padStart(3,'0')}`)) n++;
  return `${prefix}-${String(n).padStart(3,'0')}`;
}

/* Ensure every product has a productId — run once on load */
function migrateProductIds() {
  const products = getRawProducts();
  const existingPids = new Set(products.map(p => p.productId).filter(Boolean));
  let changed = false;
  products.forEach(p => {
    if (!p.productId) {
      p.productId = generateProductId(p.category, existingPids);
      existingPids.add(p.productId);
      changed = true;
    }
    if (p.available === undefined) { p.available = true; changed = true; }
  });
  if (changed) saveProducts(products);
  return products;
}

/* ════════════════════════════════════════════════════
   ANALYTICS ENGINE
   ════════════════════════════════════════════════════ */
function getAnalytics() {
  try { return JSON.parse(localStorage.getItem(ANALYTICS_KEY)) || { wishlistAdds:{}, wishlistRemoves:{}, wishlistOpens:0 }; }
  catch { return { wishlistAdds:{}, wishlistRemoves:{}, wishlistOpens:0 }; }
}
function saveAnalytics(a) { localStorage.setItem(ANALYTICS_KEY, JSON.stringify(a)); }

function trackWishlistAdd(productId) {
  const a = getAnalytics();
  a.wishlistAdds[productId] = (a.wishlistAdds[productId] || 0) + 1;
  saveAnalytics(a);
}
function trackWishlistRemove(productId) {
  const a = getAnalytics();
  a.wishlistRemoves[productId] = (a.wishlistRemoves[productId] || 0) + 1;
  saveAnalytics(a);
}
function trackWishlistOpen() {
  const a = getAnalytics();
  a.wishlistOpens = (a.wishlistOpens || 0) + 1;
  saveAnalytics(a);
}

/* ════════════════════════════════════════════════════
   INQUIRY LOG
   ════════════════════════════════════════════════════ */
function getInquiries() {
  try { return JSON.parse(localStorage.getItem(INQUIRIES_KEY)) || []; }
  catch { return []; }
}
function logInquiry(product) {
  if (!product) return;
  const inquiries = getInquiries();
  inquiries.unshift({
    timestamp:  new Date().toISOString(),
    productId:  product.productId || product.id,
    productName:product.name,
    category:   product.category,
    price:      product.price,
  });
  if (inquiries.length > 500) inquiries.length = 500;
  localStorage.setItem(INQUIRIES_KEY, JSON.stringify(inquiries));
}

/* ════════════════════════════════════════════════════
   RECENTLY VIEWED
   ════════════════════════════════════════════════════ */
function getRecentlyViewed() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; }
  catch { return []; }
}
function trackRecentlyViewed(product) {
  if (!product) return;
  let recent = getRecentlyViewed();
  recent = recent.filter(p => p.id !== product.id);
  const _rimg = (product.img||'').replace(/^\.\.\//, '');
  recent.unshift({ id:product.id, productId:product.productId, name:product.name,
                   price:product.price, img:_rimg, category:product.category,
                   badge:product.badge, fabric:product.fabric||product.type||'' });
  if (recent.length > 10) recent.length = 10;
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
}

/* ════════════════════════════════════════════════════
   WISHLIST ENGINE
   ════════════════════════════════════════════════════ */
function getWishlistItems() {
  try { return JSON.parse(localStorage.getItem(WISHLIST_KEY)) || []; }
  catch { return []; }
}
function saveWishlistItems(items) { localStorage.setItem(WISHLIST_KEY, JSON.stringify(items)); }

function isInWishlist(productId) {
  return getWishlistItems().some(p => p.id === productId);
}

function addToWishlist(product) {
  if (typeof product === 'string') { showToast('❤ Added to wishlist'); return; }
  if (!product) return;
  let items = getWishlistItems();
  if (items.some(p => p.id === product.id)) {
    showToast('Already in your wishlist ♡'); return;
  }
  // Strip "../" prefix so paths resolve correctly from any page depth
  const _img = (product.img||'').replace(/^\.\.\//, '');
  items.push({ id:product.id, productId:product.productId, name:product.name,
               price:product.price, img:_img, category:product.category,
               badge:product.badge, fabric:product.fabric||product.type||'' });
  saveWishlistItems(items);
  trackWishlistAdd(product.productId || product.id);
  updateWishlistBadge();
  showToast(`❤ "${product.name}" added to wishlist`);
  document.querySelectorAll(`[data-wishlist-id="${product.id}"]`).forEach(btn => {
    btn.innerHTML = '♥'; btn.style.color = '#c0392b';
  });
}

function removeFromWishlist(productId) {
  let items = getWishlistItems();
  const removed = items.find(p => p.id === productId);
  items = items.filter(p => p.id !== productId);
  saveWishlistItems(items);
  if (removed) trackWishlistRemove(removed.productId || productId);
  updateWishlistBadge();
}

function updateWishlistBadge() {
  const count = getWishlistItems().length;
  const badge = document.getElementById('wishlistBadge');
  if (badge) {
    badge.textContent = count;
    badge.classList.add('heart-pop');
    setTimeout(() => badge.classList.remove('heart-pop'), 400);
  }
}

function openWishlistPanel() {
  trackWishlistOpen();
  const existing = document.getElementById('wishlistPanel');
  if (existing) {
    existing.style.transform = 'translateX(0)';
    const bd = document.getElementById('wishlistBackdrop');
    if (bd) { bd.style.opacity = '1'; bd.style.pointerEvents = 'auto'; }
    document.body.style.overflow = 'hidden';
    renderWishlistPanel();
    return;
  }
  buildWishlistPanel();
}

function buildWishlistPanel() {
  const el = document.createElement('div');
  el.id = 'wishlistPanel';
  Object.assign(el.style, {
    position:'fixed', top:'0', right:'0', width:'400px', maxWidth:'96vw',
    height:'100vh', background:'#1a0a06',
    borderLeft:'1px solid rgba(201,162,78,.25)', zIndex:'9999',
    overflowY:'auto', fontFamily:"'Jost',sans-serif", color:'#faf5ec',
    transform:'translateX(100%)',
    transition:'transform .35s cubic-bezier(.4,0,.2,1)',
    boxSizing:'border-box',
  });

  el.innerHTML = `
    <div style="position:sticky;top:0;background:#1a0a06;border-bottom:1px solid rgba(201,162,78,.15);
                padding:20px 24px;display:flex;align-items:center;justify-content:space-between;z-index:2">
      <div>
        <div style="font-family:'Cormorant Garamond',serif;font-size:1.3rem;letter-spacing:.1em">My Wishlist</div>
        <div id="wishlistSubtitle" style="font-size:10px;letter-spacing:.2em;color:rgba(201,162,78,.6);
             text-transform:uppercase;margin-top:2px"></div>
      </div>
      <button id="wishlistCloseBtn"
              style="background:none;border:1.5px solid rgba(201,162,78,.4);color:rgba(201,162,78,.9);
                     width:36px;height:36px;cursor:pointer;font-size:20px;line-height:1;
                     display:flex;align-items:center;justify-content:center;flex-shrink:0">
        &times;
      </button>
    </div>
    <div id="wishlistItemsContainer" style="padding:20px 24px"></div>
    <div id="wishlistFooter"
         style="padding:16px 24px;border-top:1px solid rgba(201,162,78,.12);
                position:sticky;bottom:0;background:#1a0a06"></div>
  `;
  document.body.appendChild(el);

  // Backdrop
  const backdrop = document.createElement('div');
  backdrop.id = 'wishlistBackdrop';
  Object.assign(backdrop.style, {
    position:'fixed', top:'0', left:'0', right:'0', bottom:'0',
    background:'rgba(0,0,0,.55)', zIndex:'9998',
    opacity:'0', transition:'opacity .35s', pointerEvents:'none',
  });
  document.body.appendChild(backdrop);

  // Wire close via addEventListener — NOT inline onclick (avoids scope issues)
  el.querySelector('#wishlistCloseBtn').addEventListener('click', closeWishlistPanel);
  backdrop.addEventListener('click', closeWishlistPanel);

  // Double rAF so CSS transition actually fires
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.style.transform = 'translateX(0)';
      backdrop.style.opacity = '1';
      backdrop.style.pointerEvents = 'auto';
    });
  });

  document.body.style.overflow = 'hidden';
  renderWishlistPanel();
}

function closeWishlistPanel() {
  const panel    = document.getElementById('wishlistPanel');
  const backdrop = document.getElementById('wishlistBackdrop');
  if (panel)    panel.style.transform = 'translateX(100%)';
  if (backdrop) { backdrop.style.opacity = '0'; backdrop.style.pointerEvents = 'none'; }
  document.body.style.overflow = '';
}

/* Resolve stored image path for the current page depth.
   Paths are stored without "../" (e.g. "Images/Saree1.jpeg").
   From pages/ subfolder we prepend "../"; from root we don't. */
function resolveImgPath(img) {
  if (!img) return '';
  if (img.startsWith('http') || img.startsWith('//') || img.startsWith('data:')) return img;
  const clean  = img.replace(/^(\.\.\/)+/, '');
  const inPages = window.location.pathname.toLowerCase().includes('/pages/');
  return (inPages ? '../' : '') + clean;
}

function renderWishlistPanel() {
  const panel = document.getElementById('wishlistPanel');
  if (!panel) return;

  const items    = getWishlistItems();
  const subtitle = document.getElementById('wishlistSubtitle');
  const container= document.getElementById('wishlistItemsContainer');
  const footer   = document.getElementById('wishlistFooter');

  if (subtitle) subtitle.textContent = `${items.length} item${items.length !== 1 ? 's' : ''} saved`;

  if (items.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:60px 0;color:rgba(250,245,236,.3)">
        <div style="font-size:3rem;margin-bottom:12px">♡</div>
        <div style="font-family:'Cormorant Garamond',serif;font-size:1.1rem;margin-bottom:6px">Your wishlist is empty</div>
        <div style="font-size:12px;color:rgba(250,245,236,.2)">Tap the heart on any product to save it here</div>
      </div>`;
    footer.innerHTML = '';
    return;
  }

  container.innerHTML = items.map(p => `
    <div style="display:flex;gap:12px;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid rgba(201,162,78,.08);align-items:flex-start">
      <img src="${resolveImgPath(p.img)}" alt="${p.name}"
           style="width:72px;height:72px;object-fit:cover;border:1px solid rgba(201,162,78,.2);flex-shrink:0;background:#2a1a0e"
           onerror="this.style.opacity='.3'"/>
      <div style="flex:1;min-width:0">
        <div style="font-size:9px;letter-spacing:.2em;color:rgba(201,162,78,.6);text-transform:uppercase;margin-bottom:2px">${p.badge||p.fabric||''}</div>
        <div style="font-family:'Cormorant Garamond',serif;font-size:1rem;line-height:1.3;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</div>
        <div style="font-size:9px;color:rgba(250,245,236,.3);margin-bottom:6px">ID: ${p.productId||'—'}</div>
        <div style="font-family:'Cormorant Garamond',serif;font-size:1.1rem;color:#c9a24e">₹${p.price.toLocaleString()}</div>
      </div>
      <button onclick="removeFromWishlist(${p.id});renderWishlistPanel()"
              style="background:none;border:none;color:rgba(220,80,80,.7);cursor:pointer;font-size:20px;padding:4px;flex-shrink:0;line-height:1" title="Remove">&times;</button>
    </div>`).join('');

  const totalVal = items.reduce((s,p) => s + p.price, 0);
  footer.innerHTML = `
    <div style="display:flex;justify-content:space-between;margin-bottom:14px;font-size:13px">
      <span style="color:rgba(250,245,236,.5)">Total value</span>
      <span style="font-family:'Cormorant Garamond',serif;color:#c9a24e;font-size:1.1rem">₹${totalVal.toLocaleString()}</span>
    </div>
    <button onclick="sendWishlistToWhatsApp()"
            style="width:100%;padding:13px;background:#25d366;border:none;color:#fff;
                   font-family:'Jost',sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;
                   cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:8px">
      <svg width="14" height="14" fill="white" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.122.554 4.112 1.528 5.84L.057 23.5l5.797-1.499A11.938 11.938 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.854 0-3.6-.497-5.11-1.367l-.366-.218-3.44.889.921-3.32-.239-.384A9.955 9.955 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
      Send Wishlist to WhatsApp
    </button>
    <button onclick="closeWishlistPanel()"
            style="width:100%;padding:11px;background:none;border:1px solid rgba(201,162,78,.25);
                   color:rgba(201,162,78,.7);font-family:'Jost',sans-serif;font-size:10px;
                   letter-spacing:2px;text-transform:uppercase;cursor:pointer">
      Continue Browsing
    </button>`;
}

function sendWishlistToWhatsApp() {
  const items = getWishlistItems();
  if (items.length === 0) { showToast('Your wishlist is empty'); return; }
  const lines = items.map((p,i) => `${i+1}. ${p.name} (${p.productId||'—'}) — ₹${p.price.toLocaleString()}`).join('\n');
  const total  = items.reduce((s,p) => s+p.price, 0);
  const text   = encodeURIComponent(
    `🌺 Hello SissyTrends!\n\nHere is my wishlist:\n\n${lines}\n\nTotal: ₹${total.toLocaleString()}\n\nCould you help me with these pieces?`
  );
  window.open(`${BRAND.whatsapp}?text=${text}`, '_blank');
}

/* ════════════════════════════════════════════════════
   QUICK-VIEW MODAL
   ════════════════════════════════════════════════════ */
let _modalProduct  = null;
let _modalImgIndex = 0;

function openModal(productOrId) {
  let product = productOrId;
  if (typeof productOrId === 'number' || typeof productOrId === 'string') {
    // Try _productCache first (live API data), fall back to getProducts()
    product = (typeof _productCache !== 'undefined' && _productCache[productOrId])
      ? _productCache[productOrId]
      : getProducts().find(p => p.id == productOrId);
  }
  if (!product) return;
  _modalProduct  = product;
  _modalImgIndex = 0;
  setTimeout(() => {
    const _imgs = [product.img, product.img2, product.img3, product.img4].filter(Boolean);
    const prev = document.getElementById('modalPrev');
    const next = document.getElementById('modalNext');
    // Show/hide nav arrows and update dots
    if (prev) prev.style.display = _imgs.length > 1 ? 'flex' : 'none';
    if (next) next.style.display = _imgs.length > 1 ? 'flex' : 'none';
    if (typeof _updateModalDots === 'function') _updateModalDots(_imgs.length);
  }, 60);
  trackRecentlyViewed(product);

  const overlay = document.getElementById('modalOverlay');
  if (!overlay) return;

  const imgs = [product.img, product.img2, product.img3, product.img4].filter(Boolean);

  const mainImg = document.getElementById('modalImgEl');
  if (mainImg) { mainImg.src = imgs[0]; mainImg.alt = product.name; mainImg.style.transform = ''; }

  const thumbRow = document.getElementById('modalThumbRow');
  if (thumbRow) {
    if (imgs.length > 1) {
      thumbRow.innerHTML = imgs.map((src,i) => `
        <div onclick="setModalImage(${i})" data-thumb-idx="${i}"
             style="width:52px;height:52px;cursor:pointer;border:2px solid ${i===0?'#c9a24e':'rgba(201,162,78,.2)'};overflow:hidden;flex-shrink:0">
          <img src="${src}" style="width:100%;height:100%;object-fit:cover"
               onerror="this.parentElement.style.background='#2a1a0e'"/>
        </div>`).join('');
      thumbRow.style.display = 'flex';
    } else {
      thumbRow.innerHTML = '';
      thumbRow.style.display = 'none';
    }
  }

  document.getElementById('modalFabric').textContent = product.fabric || product.type || product.subcategory || '';
  document.getElementById('modalName').textContent   = product.name;
  document.getElementById('modalDesc').textContent   = product.desc || '';
  document.getElementById('modalPrice').textContent  = `₹${product.price.toLocaleString()}`;
  document.getElementById('modalPid').textContent    = `ID: ${product.productId || '—'}`;
  document.getElementById('modalNameHidden').value   = product.id;

  const heartBtn = document.getElementById('modalWishlistBtn');
  if (heartBtn) {
    const inWL = isInWishlist(product.id);
    heartBtn.innerHTML = `<span>${inWL ? '♥' : '♡'} ${inWL ? 'In Wishlist' : 'Add to Wishlist'}</span>`;
    heartBtn.style.borderColor = inWL ? '#c0392b' : '';
    heartBtn.style.color       = inWL ? '#c0392b' : '';
  }

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function setModalImage(idx) {
  if (!_modalProduct) return;
  const imgs = [_modalProduct.img, _modalProduct.img2, _modalProduct.img3, _modalProduct.img4].filter(Boolean);
  if (!imgs[idx]) return;
  _modalImgIndex = idx;
  const mainImg = document.getElementById('modalImgEl');
  if (mainImg) { mainImg.src = imgs[idx]; mainImg.style.transform = ''; }
  document.querySelectorAll('[data-thumb-idx]').forEach(t => {
    t.style.borderColor = t.dataset.thumbIdx == idx ? '#c9a24e' : 'rgba(201,162,78,.2)';
  });
}

function closeModal(e) {
  if (!e || e.target === document.getElementById('modalOverlay') || e === true) {
    document.getElementById('modalOverlay')?.classList.remove('open');
    document.body.style.overflow = '';
    _modalProduct = null;
  }
}

function modalWishlistToggle() {
  if (!_modalProduct) return;
  if (isInWishlist(_modalProduct.id)) {
    removeFromWishlist(_modalProduct.id);
    const btn = document.getElementById('modalWishlistBtn');
    if (btn) { btn.innerHTML = '<span>♡ Add to Wishlist</span>'; btn.style.color=''; btn.style.borderColor=''; }
    showToast('Removed from wishlist');
  } else {
    addToWishlist(_modalProduct);
    const btn = document.getElementById('modalWishlistBtn');
    if (btn) { btn.innerHTML = '<span>♥ In Wishlist</span>'; btn.style.color='#c0392b'; btn.style.borderColor='#c0392b'; }
  }
}

function shareProduct() {
  if (!_modalProduct) return;
  const url  = window.location.href.split('?')[0] + `?product=${_modalProduct.id}`;
  const text = `${_modalProduct.name} — ₹${_modalProduct.price.toLocaleString()}\nID: ${_modalProduct.productId||'—'}\n${url}`;
  if (navigator.share) {
    navigator.share({ title:_modalProduct.name, text, url }).catch(()=>{});
  } else {
    navigator.clipboard?.writeText(url)
      .then(()  => showToast('🔗 Product link copied!'))
      .catch(()  => showToast('🔗 Link: ' + url));
  }
}

function enquireOnWhatsApp() {
  if (!_modalProduct) return;
  logInquiry(_modalProduct);
  const p    = _modalProduct;
  const text = encodeURIComponent(
    `Hi SissyTrends! I'm interested in this piece.\n\nProduct: ${p.name}\nID: ${p.productId||'—'}\nCategory: ${p.category}\nPrice: ₹${p.price.toLocaleString()}`
  );
  window.open(`${BRAND.whatsapp}?text=${text}`, '_blank');
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(true); });

/* ── Page loader ── */
window.addEventListener('load', () => {
  const loader = document.getElementById('pageLoader');
  if (loader) setTimeout(() => loader.classList.add('hidden'), 1200);
});

/* ── DOMContentLoaded ── */
document.addEventListener('DOMContentLoaded', () => {
  migrateProductIds();

  const navbar = document.getElementById('navbar');
  if (navbar) {
    window.addEventListener('scroll', () => navbar.classList.toggle('scrolled', window.scrollY > 60));
  }

  const hamburger   = document.getElementById('hamburger');
  const mobileMenu  = document.getElementById('mobileMenu');
  const mobileClose = document.getElementById('mobileClose');
  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      mobileMenu.classList.toggle('open');
      document.body.style.overflow = mobileMenu.classList.contains('open') ? 'hidden' : '';
    });
    if (mobileClose) mobileClose.addEventListener('click', () => { mobileMenu.classList.remove('open'); document.body.style.overflow = ''; });
    mobileMenu.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', () => { mobileMenu.classList.remove('open'); document.body.style.overflow = ''; }));
  }

  document.querySelectorAll('.mob-acc-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.mob-acc-item');
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.mob-acc-item').forEach(i => i.classList.remove('open'));
      if (!isOpen) item.classList.add('open');
    });
  });

  const revealObs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold:0.08, rootMargin:'0px 0px -30px 0px' });
  document.querySelectorAll('.reveal').forEach(r => revealObs.observe(r));

  updateWishlistBadge();

  const urlParams = new URLSearchParams(window.location.search);
  const pidParam  = urlParams.get('product');
  if (pidParam) {
    const p = getProducts().find(p => p.id == pidParam || p.productId === pidParam);
    if (p) setTimeout(() => openModal(p), 600);
  }
});

/* ── showToast ── */
function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.innerHTML = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2800);
}

/* ════════════════════════════════════════════════════
   PRODUCTS DATA
   ════════════════════════════════════════════════════ */
const BADGE_ICON_MAP = {
  'soft silk':'🥻','kanjivaram':'🪡','banarasi':'✨','velvet':'🌹',
  'cotton':'🌿','linen':'🌿','cotton & linen':'🌿','silk':'🥻','silk saree':'🥻',
  'necklace sets':'💎','necklace set':'💎','earrings':'✨',
  'full sets':'👑','full set':'👑','bridal':'🌸','bridal collection':'🌸','bridal set':'🌸',
  'diyas':'🪔','diyas & lamps':'🪔','gifting':'🎁','gift set':'🎁',
  'new arrival':'🆕','bestseller':'⭐','heritage':'🏺',
  "editor's pick":'✦','trending':'🔥','everyday':'🌸','sustainable':'🌿','curated':'✦','new':'🆕',
};
function badgeIcon(label) { return BADGE_ICON_MAP[(label||'').toLowerCase().trim()] || '✦'; }

const SUBCATEGORIES = {
  sarees: [
    { key:'soft-silk',    label:'Soft Silk',      icon:'🥻' },
    { key:'Maheswari Silk Cotton', label:'Maheswari Silk Cotton', icon:'🪡' },
    { key:'Fancy Silk',            label:'Fancy Silk',            icon:'✨' },
    { key:'Cool Cotton',           label:'Cool Cotton',            icon:'🌹' },
    { key:'cotton-linen', label:'Cotton & Linen', icon:'🌿' },
  ],
  jewellery: [
    { key:'necklace-sets', label:'Necklace Sets',     icon:'💎' },
    { key:'earrings',      label:'Earrings',          icon:'✨' },
    { key:'full-sets',     label:'Full Sets',         icon:'👑' },
    { key:'bridal',        label:'Bridal Collection', icon:'🌸' },
  ],
  decor: [
    { key:'diyas',   label:'Diyas & Lamps', icon:'🪔' },
    { key:'gifting', label:'Gifting',       icon:'🎁' },
  ],
};

function getSubcategories(cat) {
  try {
    const products = getDefaultProducts();
    const catProds = products.filter(p => p.category === cat);
    const base = (SUBCATEGORIES[cat]||[]).filter(s => catProds.some(p => p.subcategory === s.key));
    const usedKeys = new Set(base.map(s => s.key));
    const badgeSeen = new Set();
    const badgeEntries = [];
    catProds.forEach(p => {
      if (!p.badge) return;
      const key = p.badge.toLowerCase().replace(/[^a-z0-9]+/g,'-');
      if (!usedKeys.has(key) && !badgeSeen.has(key)) {
        badgeSeen.add(key);
        badgeEntries.push({ key, label:p.badge, icon:badgeIcon(p.badge) });
      }
    });
    return [...base, ...badgeEntries];
  } catch { return SUBCATEGORIES[cat]||[]; }
}

function getRawProducts() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || getDefaultProducts(); }
  catch { return getDefaultProducts(); }
}
function getProducts() { return migrateProductIds(); }
function saveProducts(p) { localStorage.setItem(STORE_KEY, JSON.stringify(p)); }

function getDefaultProducts() {
  return [
    { id:1,  productId:'SAR-001', available:true, name:'Crimson Soft Silk',       category:'sarees',    subcategory:'soft-silk',    fabric:'Soft Silk',       price:4500,  badge:'New Arrival',   img:'../Images/Saree1.jpeg',   desc:'Draped in silken grace — this deep crimson soft silk speaks the language of celebration and feminine confidence.',  occasion:'bridal'  },
    { id:2,  productId:'SAR-002', available:true, name:'Ivory Soft Silk',          category:'sarees',    subcategory:'soft-silk',    fabric:'Soft Silk',       price:3800,  badge:'Bestseller',    img:'../Images/saree3.jpeg',   desc:'Pure ivory grace — a saree that carries the quiet confidence of a woman who knows her worth.',  occasion:'festive' },
    { id:3,  productId:'SAR-003', available:true, name:'Rose Petal Soft Silk',     category:'sarees',    subcategory:'soft-silk',    fabric:'Soft Silk',       price:4200,  badge:'Trending',      img:'../Images/saree2.jpeg',   desc:'Blush-toned soft silk with a delicate sheen.', occasion:'wedding' },
    { id:4,  productId:'SAR-004', available:true, name:'Classic Kanjivaram Gold',  category:'sarees',    subcategory:'kanjivaram',   fabric:'Kanjivaram Silk', price:12500, badge:'Heritage',      img:'../Images/Saree1.jpeg',   desc:'The heirloom you pass down — a classic Kanjivaram in deep gold and maroon.', occasion:'bridal'  },
    { id:5,  productId:'SAR-005', available:true, name:'Peacock Kanjivaram',       category:'sarees',    subcategory:'kanjivaram',   fabric:'Kanjivaram Silk', price:14800, badge:"Editor's Pick", img:'../Images/saree2.jpeg',   desc:'Rich teal with peacock motifs in zari.', occasion:'wedding' },
    { id:6,  productId:'SAR-006', available:true, name:'The Golden Thread',        category:'sarees',    subcategory:'banarasi',     fabric:'Banarasi Weave',  price:8500,  badge:'Heritage',      img:'../Images/saree2.jpeg',   desc:'Where Banaras lives in every zari — ivory and gold in perfect conversation.', occasion:'wedding' },
    { id:7,  productId:'SAR-007', available:true, name:'Midnight Banarasi',        category:'sarees',    subcategory:'banarasi',     fabric:'Banarasi Silk',   price:9200,  badge:'New',           img:'../Images/saree3.jpeg',   desc:'Deep navy Banarasi with silver brocade.', occasion:'party' },
    { id:8,  productId:'SAR-008', available:true, name:'Velvet Vermilion',         category:'sarees',    subcategory:'velvet',       fabric:'Velvet Silk',     price:6800,  badge:"Editor's Pick", img:'../Images/V Saree 1.jpeg',desc:'Deep and luxurious — velvet silk in a shade that commands every room.', occasion:'party' },
    { id:9,  productId:'SAR-009', available:true, name:'Heritage Velvet',          category:'sarees',    subcategory:'velvet',       fabric:'Velvet Weave',    price:5900,  badge:'New',           img:'../Images/V Saree 2.jpeg',desc:'Rich heritage woven into every thread.', occasion:'bridal' },
    { id:10, productId:'SAR-010', available:true, name:'Regal Drape',              category:'sarees',    subcategory:'velvet',       fabric:'Velvet Cotton',   price:4800,  badge:'Trending',      img:'../Images/V Saree 3.jpeg',desc:'Regal without trying, warm without effort.', occasion:'wedding' },
    { id:11, productId:'SAR-011', available:true, name:'Deep Velvet Dream',        category:'sarees',    subcategory:'velvet',       fabric:'Premium Velvet',  price:7200,  badge:'Curated',       img:'../Images/V Saree 4.jpeg',desc:'A dream in deep velvet.', occasion:'festive' },
    { id:12, productId:'SAR-012', available:true, name:'Morning Mist Cotton',      category:'sarees',    subcategory:'cotton-linen', fabric:'Pure Cotton',     price:2200,  badge:'Everyday',      img:'../Images/saree3.jpeg',   desc:'Light as a whisper, graceful as dawn.', occasion:'casual' },
    { id:13, productId:'SAR-013', available:true, name:'Sun-Kissed Linen',         category:'sarees',    subcategory:'cotton-linen', fabric:'Pure Linen',      price:2800,  badge:'Sustainable',   img:'../Images/saree2.jpeg',   desc:'Effortless heritage — linen reborn for the modern woman.', occasion:'casual' },
    { id:14, productId:'JWL-001', available:true, name:'Heart of Gold Necklace',   category:'jewellery', subcategory:'necklace-sets',fabric:'Necklace Set',    price:1200,  badge:'Bestseller',    img:'../Images/Imitation jewels/Heartin on Saree.jpeg', desc:'Golden hearts in a delicate setting.', occasion:'festive' },
    { id:15, productId:'JWL-002', available:true, name:'Stone Elegance Necklace',  category:'jewellery', subcategory:'necklace-sets',fabric:'Necklace Set',    price:1600,  badge:'New',           img:'../Images/Imitation jewels/Heartin stones .jpeg', desc:'Richly embellished with hand-set stones.', occasion:'bridal' },
    { id:16, productId:'JWL-003', available:true, name:'Pearl Classic Earrings',   category:'jewellery', subcategory:'earrings',     fabric:'Earrings',        price:650,   badge:"Editor's Pick", img:'../Images/Imitation jewels/Pearl ear.jpeg',        desc:'Timeless pearl drops in an antique setting.', occasion:'casual' },
    { id:17, productId:'JWL-004', available:true, name:'Geometric Gold Earrings',  category:'jewellery', subcategory:'earrings',     fabric:'Earrings',        price:750,   badge:'Trending',      img:'../Images/Imitation jewels/Squares.jpeg',          desc:'Bold geometric forms in antique gold.', occasion:'wedding' },
    { id:18, productId:'JWL-005', available:true, name:'Geometric Temple Set',     category:'jewellery', subcategory:'full-sets',    fabric:'Full Set',        price:2200,  badge:'Trending',      img:'../Images/Imitation jewels/Squares.jpeg',          desc:'Bold geometric forms meet temple jewellery.', occasion:'wedding' },
    { id:19, productId:'JWL-006', available:true, name:'Royal Bridal Grand Set',   category:'jewellery', subcategory:'bridal',       fabric:'Bridal Set',      price:3500,  badge:'Bridal',        img:'../Images/Imitation jewels/WhatsApp Image 2026-03-04 at 19.29.31.jpeg', desc:'A complete bridal jewellery ensemble.', occasion:'bridal' },
    { id:20, productId:'JWL-007', available:true, name:'Bridal Stone Set',         category:'jewellery', subcategory:'bridal',       fabric:'Bridal Set',      price:2800,  badge:'New',           img:'../Images/Imitation jewels/Heartin stones.jpeg',  desc:'A dazzling stone-studded bridal set.', occasion:'bridal' },
    { id:21, productId:'DCR-001', available:true, name:'Festival Diya',            category:'decor',     subcategory:'diyas',        fabric:'Diya',            price:350,   badge:'Festive',       img:'../Images/Decorative handcrafts/Diya.webp',        desc:'Hand-crafted festive diya.', occasion:'festive' },
    { id:22, productId:'DCR-002', available:true, name:'Festive Gift Box',         category:'decor',     subcategory:'gifting',      fabric:'Gift Set',        price:1200,  badge:'Gift',          img:'../Images/Decorative handcrafts/Diya.webp',        desc:'A curated festive gift box.', occasion:'festive' },
  ];
}

/* ── Render product card ── */
function renderProductCard(product, delay = 0) {
  const inWL  = isInWishlist(product.id);
  const isOut = product.available === false;

  return `
    <div class="product-card reveal" style="transition-delay:${delay}s;position:relative"
         onclick="openModal(${product.id})">
      <div class="img-wrap" style="position:relative">
        <img src="${product.img}" alt="${product.name}" loading="lazy"
             onerror="this.style.display='none';this.parentElement.style.background='linear-gradient(135deg,#EAD9C4,#E8C5C0)';this.parentElement.style.minHeight='260px'"/>
        ${isOut ? `<div style="position:absolute;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:2"><div style="background:#7a1f2e;color:#faf5ec;font-family:'Cinzel',serif;font-size:11px;letter-spacing:.25em;padding:8px 18px;transform:rotate(-15deg)">OUT OF STOCK</div></div>` : ''}
        <button data-wishlist-id="${product.id}"
                onclick="event.stopPropagation();addToWishlist(_productCache[${product.id}])"
                style="position:absolute;top:10px;right:10px;background:rgba(26,10,6,.7);border:1px solid rgba(201,162,78,.3);color:${inWL?'#c0392b':'rgba(250,245,236,.7)'};width:34px;height:34px;border-radius:50%;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;z-index:3">
          ${inWL ? '♥' : '♡'}
        </button>
      </div>
      <div class="card-body">
        <div class="card-badge">${product.badge||product.fabric||''}</div>
        <div style="font-family:'Jost',sans-serif;font-size:9px;letter-spacing:.15em;color:rgba(201,162,78,.4);margin-bottom:2px">${product.productId||''}</div>
        <div class="card-name">${product.name}</div>
        <p class="card-desc">${(product.desc||'').substring(0,75)}…</p>
        <div class="card-price">₹${product.price.toLocaleString()}</div>
        <div class="card-actions">
          <button class="btn-primary" style="width:100%;justify-content:center;padding:11px"
            onclick="event.stopPropagation();openModal(${product.id})">
            <span>Quick View</span><span class="arrow">→</span>
          </button>
          <button class="btn-wa" style="width:100%;padding:10px"
            onclick="event.stopPropagation();_modalProduct=getProducts().find(p=>p.id===${product.id});enquireOnWhatsApp()">
            <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.122.554 4.112 1.528 5.84L.057 23.5l5.797-1.499A11.938 11.938 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.854 0-3.6-.497-5.11-1.367l-.366-.218-3.44.889.921-3.32-.239-.384A9.955 9.955 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
            WhatsApp
          </button>
        </div>
      </div>
    </div>`;
}

/* ── Contact form ── */
function sendViaWhatsApp() {
  const name  = document.getElementById('cName')?.value || 'A visitor';
  const phone = document.getElementById('cPhone')?.value || '';
  const msg   = document.getElementById('cMsg')?.value || '';
  const occ   = document.getElementById('cOccasion')?.value || '';
  const text  = encodeURIComponent(`🌺 Hello SissyTrends Boutique!\n\nName: ${name}\nPhone: ${phone}${occ?'\nOccasion: '+occ:''}\nMessage: ${msg}`);
  window.open(`${BRAND.whatsapp}?text=${text}`, '_blank');
}

/* ════════════════════════════════════════════════════
   NAV INJECTION
   ════════════════════════════════════════════════════ */
function injectNav(activePage, isRoot) {
  const b = isRoot ? '' : '../';

  function megaCol(catKey, catLabel, catIcon, catHref) {
    const subs = SUBCATEGORIES[catKey] || [];
    return `<div class="mega-col">
      <div class="mega-col-head"><a href="${catHref}">${catIcon} ${catLabel}</a></div>
      ${subs.map(s=>`<a class="mega-sub-link" href="${b}pages/categories.html?cat=${catKey}&sub=${s.key}"><span class="sub-icon">${s.icon}</span>${s.label}</a>`).join('')}
    </div>`;
  }

  function mobAccordion(catKey, catLabel, catIcon, catHref) {
    const subs = SUBCATEGORIES[catKey] || [];
    return `<div class="mob-acc-item">
      <button class="mob-acc-toggle">${catIcon} ${catLabel}<span class="mob-acc-arrow">▾</span></button>
      <div class="mob-acc-body">
        <a href="${catHref}" data-close>View All ${catLabel}</a>
        ${subs.map(s=>`<a href="${b}pages/categories.html?cat=${catKey}&sub=${s.key}" data-close>${s.icon} ${s.label}</a>`).join('')}
      </div>
    </div>`;
  }

  const act = lbl => lbl === activePage ? 'active' : '';

  return `
  <div class="page-loader" id="pageLoader"><div class="loader-logo">SissyTrends</div><div class="loader-bar"></div><div class="loader-sub">Elegant Styles for Every You</div></div>
  <div class="toast" id="toast"></div>

  <!-- MODAL -->
  <div class="modal-overlay" id="modalOverlay" onclick="closeModal(event)">
    <div class="modal-box" onclick="event.stopPropagation()">
      <div class="modal-img" style="position:relative">
                <div id="modalImgSwiper" style="position:relative;overflow:hidden;min-height:320px"
             ontouchstart="_swipeStart(event)" onmousedown="_swipeStart(event)">
          <img id="modalImgEl" src="" alt="" style="width:100%;height:100%;object-fit:cover;display:block;min-height:320px;cursor:zoom-in"
             onclick="this.style.transform=this.style.transform?'':'scale(1.6)';this.style.transition='transform .3s'" title="Tap to zoom"/>
          <button id="modalPrev" onclick="_modalNav(-1)" style="display:none;position:absolute;left:8px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,.45);border:none;color:#fff;font-size:22px;width:36px;height:36px;cursor:pointer;border-radius:50%;z-index:2">&#8249;</button>
          <button id="modalNext" onclick="_modalNav(1)"  style="display:none;position:absolute;right:8px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,.45);border:none;color:#fff;font-size:22px;width:36px;height:36px;cursor:pointer;border-radius:50%;z-index:2">&#8250;</button>
          <div id="modalDots" style="display:none;position:absolute;bottom:8px;left:50%;transform:translateX(-50%);gap:5px;z-index:2"></div>
        </div>
        <div id="modalThumbRow" style="display:none;gap:6px;padding:10px;position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,.6));overflow-x:auto"></div>
      </div>
      <div class="modal-body">
        <button class="modal-close" onclick="closeModal(true)">✕</button>
        <div id="modalFabric" style="font-family:var(--font-body);font-size:9.5px;letter-spacing:3px;text-transform:uppercase;color:var(--gold);margin-bottom:4px"></div>
        <div id="modalName"   style="font-family:var(--font-display);font-size:1.6rem;font-weight:400;color:var(--maroon-deep);line-height:1.2;margin-bottom:4px"></div>
        <div id="modalPid"    style="font-family:'Jost',sans-serif;font-size:10px;letter-spacing:.15em;color:rgba(201,162,78,.45);margin-bottom:10px"></div>
        <p   id="modalDesc"   style="font-family:var(--font-body);font-size:13px;font-weight:300;line-height:1.9;color:var(--taupe);margin-bottom:18px"></p>
        <div id="modalPrice"  style="font-family:var(--font-display);font-size:1.8rem;color:var(--maroon);margin-bottom:24px"></div>
        <input type="hidden" id="modalNameHidden"/>
        <div style="display:flex;flex-direction:column;gap:10px">
          <button id="modalWishlistBtn" class="btn-primary" style="width:100%;justify-content:center" onclick="modalWishlistToggle()"><span>♡ Add to Wishlist</span></button>
          <button class="btn-wa" style="width:100%;justify-content:center;padding:12px;border:none;cursor:pointer;background:#25d366;color:#fff;font-family:'Jost',sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;display:flex;align-items:center;gap:8px" onclick="enquireOnWhatsApp()">
            <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.122.554 4.112 1.528 5.84L.057 23.5l5.797-1.499A11.938 11.938 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.854 0-3.6-.497-5.11-1.367l-.366-.218-3.44.889.921-3.32-.239-.384A9.955 9.955 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
            Enquire on WhatsApp
          </button>
          <button style="width:100%;padding:11px;background:none;border:1px solid rgba(201,162,78,.3);color:rgba(201,162,78,.8);font-family:'Jost',sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px" onclick="shareProduct()">
            🔗 Share Product
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- MOBILE MENU -->
  <div class="mobile-menu" id="mobileMenu">
    <button class="mobile-menu-close" id="mobileClose">✕</button>
    <a class="mob-link" href="${b}index.html" data-close>Home</a>
    ${mobAccordion('sarees',    'Sarees',    '🥻', `${b}pages/categories.html?cat=sarees`)}
    ${mobAccordion('jewellery', 'Jewellery', '💎', `${b}pages/categories.html?cat=jewellery`)}
    ${mobAccordion('decor',     'Décor',     '🪔', `${b}pages/categories.html?cat=decor`)}
    <a class="mob-link" href="${b}pages/heritage.html" data-close>Our Story</a>
    <a class="mob-link" href="${b}pages/contact.html"  data-close>Contact</a>
    <a class="mob-link nav-special" href="${b}pages/matcher.html" data-close>✦ Style Personality Matcher</a>
  </div>

  <!-- NAVBAR -->
  <nav id="navbar">
    <div class="nav-inner">
      <a href="${b}index.html" class="nav-logo">
        <span class="nav-logo-name">SissyTrends</span>
        <span class="nav-logo-sub">Elegant Styles for Every You</span>
      </a>
      <ul class="nav-links">
        <li><a href="${b}index.html" class="${act('Home')}">Home</a></li>
        <li class="has-mega">
          <a href="${b}pages/collections.html" class="${act('Shop')}">Shop <span class="nav-chevron">▾</span></a>
          <div class="mega-menu">
            ${megaCol('sarees',    'Sarees',    '🥻', `${b}pages/categories.html?cat=sarees`)}
            ${megaCol('jewellery', 'Jewellery', '💎', `${b}pages/categories.html?cat=jewellery`)}
            ${megaCol('decor',     'Décor',     '🪔', `${b}pages/categories.html?cat=decor`)}
            <div class="mega-footer"><a href="${b}pages/collections.html">✦ View All Products →</a></div>
          </div>
        </li>
        <li><a href="${b}pages/heritage.html" class="${act('Our Story')}">Our Story</a></li>
        <li><a href="${b}pages/contact.html"  class="${act('Contact')}">Contact</a></li>
        <li><a href="${b}pages/matcher.html" class="nav-special ${act('Matcher')}">✦ Style Matcher</a></li>
      </ul>
      <div class="nav-actions">
        <button class="nav-icon-btn" title="My Wishlist" onclick="openWishlistPanel()" style="position:relative">
          ♡<span class="nav-badge" id="wishlistBadge">0</span>
        </button>
        <button class="nav-hamburger" id="hamburger" aria-label="Open menu">
          <span></span><span></span><span></span>
        </button>
      </div>
    </div>
  </nav>`;
}

/* ── Footer ── */
function injectFooter(isRoot) {
  const b = isRoot ? '' : '../';
  return `
  <footer>
    <div class="footer-inner">
      <div class="footer-grid">
        <div>
          <div class="footer-brand-name">SissyTrends</div>
          <div class="footer-brand-sub">Elegant Styles for Every You</div>
          <p class="footer-about">A curated boutique in Coimbatore celebrating India's textile heritage.</p>
          <div class="footer-socials">
            <a href="${BRAND.whatsapp}" target="_blank" class="footer-social">💬</a>
            <a href="${BRAND.instagram}" target="_blank" class="footer-social">📸</a>
            <a href="${BRAND.facebook}" target="_blank" class="footer-social">f</a>
          </div>
        </div>
        <div>
          <p class="footer-heading">Shop</p>
          <ul class="footer-links">
            <li><a href="${b}pages/collections.html">All Products</a></li>
            <li><a href="${b}pages/categories.html?cat=sarees">All Sarees</a></li>
            <li><a href="${b}pages/categories.html?cat=jewellery">Jewellery</a></li>
            <li><a href="${b}pages/categories.html?cat=decor">Décor</a></li>
          </ul>
        </div>
        <div>
          <p class="footer-heading">Information</p>
          <ul class="footer-links">
            <li><a href="${b}pages/heritage.html">Our Story</a></li>
            <li><a href="${b}pages/contact.html">Contact Us</a></li>
          </ul>
        </div>
        <div>
          <p class="footer-heading">Get In Touch</p>
          <div class="footer-policies">
            <span>📍 ${BRAND.location}</span>
            <span>📞 <a href="tel:+919344182144" style="color:inherit">${BRAND.phoneDisplay}</a></span>
            <span>✉ <a href="mailto:${BRAND.email}" style="color:inherit">${BRAND.email}</a></span>
          </div>
        </div>
      </div>
      <div class="footer-bottom">
        <p>© 2025 SissyTrends Boutique, Coimbatore. All rights reserved.</p>
        <em>Crafted with love for Indian women everywhere</em>
      </div>
    </div>
  </footer>
  <a href="${BRAND.whatsapp}?text=Hi%20SissyTrends!%20I%27d%20love%20help%20finding%20the%20perfect%20style." target="_blank" class="float-wa" title="Chat with our stylist">
    <svg fill="white" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.122.554 4.112 1.528 5.84L.057 23.5l5.797-1.499A11.938 11.938 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.854 0-3.6-.497-5.11-1.367l-.366-.218-3.44.889.921-3.32-.239-.384A9.955 9.955 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
  </a>`;
}
