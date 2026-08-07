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
// Always clear product cache on load so prices come from API, not stale localStorage
localStorage.removeItem(STORE_KEY);
const WISHLIST_KEY    = 'st_wishlist_items';
const CART_KEY        = 'st_cart_items';
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
  updateCartBadge();
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

// -- Cart ------------------------------------------------------------------
function getCartItems()  { try { return JSON.parse(localStorage.getItem(CART_KEY))||[]; } catch { return []; } }
function saveCartItems(i){ localStorage.setItem(CART_KEY, JSON.stringify(i)); }

function addToCart(product) {
  if (!product) return;
  let items = getCartItems();
  const ex = items.find(i => i.id === product.id);
  if (ex) { ex.qty = (ex.qty||1)+1; }
  else { items.push({ id:product.id, productId:product.productId, name:product.name,
    price:product.price, img:(product.img||'').replace(/^\.\.\//,''), category:product.category, qty:1 }); }
  saveCartItems(items); updateCartBadge();
  showToast('Cart: "' + product.name + '" added');
  const sid=getSessionId();
  const base=(window.location.hostname==='localhost'||window.location.hostname==='127.0.0.1')?'http://localhost:5000':'';
  fetch(base+'/api/cart',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({session_id:sid,product_id:product.id,productId:product.productId||'',
    name:product.name,price:product.price,img:(product.img||'').replace(/^\.\.\//,''),qty:1})}).catch(function(){});
}

function removeFromCart(id){ saveCartItems(getCartItems().filter(function(i){return i.id!==id;})); updateCartBadge(); renderCartDrawer(); }

function updateCartQty(id, delta){
  var items=getCartItems(), item=items.find(function(i){return i.id===id;});
  if(!item) return;
  item.qty=Math.max(1,(item.qty||1)+delta);
  saveCartItems(items); renderCartDrawer();
}

function cartTotal(){ return getCartItems().reduce(function(s,i){return s+(i.price*(i.qty||1));},0); }

function updateCartBadge(){
  var n=getCartItems().reduce(function(s,i){return s+(i.qty||1);},0);
  document.querySelectorAll('#cartBadge').forEach(function(el){
    el.textContent=n; el.style.display=n>0?'flex':'none';
  });
}

function openCartDrawer(){
  var d=document.getElementById('cartDrawer');
  if(!d){
    d=document.createElement('div'); d.id='cartDrawer';
    d.style.cssText='position:fixed;top:0;right:0;width:min(420px,100vw);height:100vh;background:#faf5ec;z-index:9999;box-shadow:-8px 0 40px rgba(0,0,0,.18);display:flex;flex-direction:column;transform:translateX(100%);transition:transform .35s cubic-bezier(.4,0,.2,1)';
    d.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid rgba(201,162,78,.2)">'
      +'<span style="font-family:\'Cinzel\',serif;font-size:14px;letter-spacing:.2em;color:#7a1f2e">MY CART</span>'
      +'<button onclick="closeCartDrawer()" style="background:none;border:none;font-size:24px;cursor:pointer;color:#7a1f2e">&times;</button>'
      +'</div>'
      +'<div id="cartItems" style="flex:1;overflow-y:auto;padding:16px 24px"></div>'
      +'<div id="cartFooter" style="padding:20px 24px;border-top:1px solid rgba(201,162,78,.2)"></div>';
    document.body.appendChild(d);
    var ov=document.createElement('div'); ov.id='cartOverlay'; ov.onclick=closeCartDrawer;
    ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9998;display:none';
    document.body.appendChild(ov);
  }
  renderCartDrawer();
  setTimeout(function(){
    d.style.transform='translateX(0)';
    document.getElementById('cartOverlay').style.display='block';
    document.body.style.overflow='hidden';
  },10);
}

function closeCartDrawer(){
  var d=document.getElementById('cartDrawer'), ov=document.getElementById('cartOverlay');
  if(d) d.style.transform='translateX(100%)';
  if(ov) ov.style.display='none';
  document.body.style.overflow='';
}

function renderCartDrawer(){
  var items=getCartItems(), el=document.getElementById('cartItems'), fe=document.getElementById('cartFooter');
  if(!el) return;
  if(!items.length){
    el.innerHTML='<div style="text-align:center;padding:60px 0;color:#8c7b6b;font-family:\'Cormorant Garamond\',serif;font-style:italic">Your cart is empty</div>';
    if(fe) fe.innerHTML=''; return;
  }
  el.innerHTML=items.map(function(i){
    return '<div style="display:flex;gap:14px;padding:14px 0;border-bottom:1px solid rgba(201,162,78,.12)">'
      +'<img src="'+i.img+'" alt="'+i.name+'" style="width:72px;height:90px;object-fit:cover;flex-shrink:0" onerror="this.style.background=\'linear-gradient(135deg,#EAD9C4,#E8C5C0)\'"/>'
      +'<div style="flex:1;min-width:0">'
      +'<div style="font-family:\'Cormorant Garamond\',serif;font-size:1rem;color:#1a0a06;margin-bottom:4px">'+i.name+'</div>'
      +'<div style="font-family:\'Jost\',sans-serif;font-size:11px;color:#c9a24e;margin-bottom:10px">&#8377;'+i.price.toLocaleString()+'</div>'
      +'<div style="display:flex;align-items:center;gap:10px">'
      +'<button onclick="updateCartQty('+i.id+',-1)" style="width:26px;height:26px;border:1px solid rgba(201,162,78,.4);background:none;font-size:14px;cursor:pointer;color:#7a1f2e">&minus;</button>'
      +'<span style="font-family:\'Jost\',sans-serif;font-size:13px;min-width:20px;text-align:center">'+(i.qty||1)+'</span>'
      +'<button onclick="updateCartQty('+i.id+',1)" style="width:26px;height:26px;border:1px solid rgba(201,162,78,.4);background:none;font-size:14px;cursor:pointer;color:#7a1f2e">+</button>'
      +'<button onclick="removeFromCart('+i.id+')" style="margin-left:auto;background:none;border:none;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#999;cursor:pointer;font-family:\'Jost\',sans-serif">Remove</button>'
      +'</div></div></div>';
  }).join('');
  var total=cartTotal();
  if(fe) fe.innerHTML=
    '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:16px">'
    +'<span style="font-family:\'Jost\',sans-serif;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#8c7b6b">Total</span>'
    +'<span style="font-family:\'Cormorant Garamond\',serif;font-size:1.6rem;color:#7a1f2e">&#8377;'+total.toLocaleString()+'</span>'
    +'</div>'
    +'<button onclick="checkoutCart()" style="width:100%;padding:14px;background:#7a1f2e;border:none;color:#faf5ec;font-family:\'Jost\',sans-serif;font-size:11px;letter-spacing:.25em;text-transform:uppercase;cursor:pointer;margin-bottom:10px">'
    +'Checkout &mdash; &#8377;'+total.toLocaleString()+'</button>'
    +'<button onclick="closeCartDrawer()" style="width:100%;padding:12px;background:none;border:1px solid rgba(201,162,78,.3);color:#c9a24e;font-family:\'Jost\',sans-serif;font-size:10px;letter-spacing:.2em;text-transform:uppercase;cursor:pointer">Continue Shopping</button>';
}

async function checkoutCart(){
  const items=getCartItems(); if(!items.length) return;
  openSimpleCheckout(async function(customer) {
    await _processCartCheckout(customer);
  });
}

async function _processCartCheckout(customer){
  var items=getCartItems(); if(!items.length) return;
  var total=cartTotal(), amount=(total + (window._checkoutShipping||0))*100;
  var base=(window.location.hostname==='localhost'||window.location.hostname==='127.0.0.1')?'http://localhost:5000':'';
  try {
    var res=await fetch(base+'/api/razorpay/create-order',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({amount:amount,currency:'INR',receipt:'cart_'+Date.now()})});
    var order=await res.json();
    if(!order.id){alert('Could not initiate payment.');return;}
    new window.Razorpay({
      key:window.__RAZORPAY_KEY||'', amount:order.amount, currency:order.currency,
      name:'SissyTrends', description:items.length+' item(s) | '+customer.name, order_id:order.id,
      handler:async function(r){
        var v=await fetch(base+'/api/razorpay/verify',{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify(Object.assign({},r,{amount:order.amount,product_id:0,product_name:items.map(function(i){return i.name;}).join(', '),customer_name:customer.name||r.name||'',customer_email:customer.email||r.email||'',customer_phone:customer.phone||r.contact||'',customer_address:customer.address||''}))});
        var res2=await v.json();
        if(res2.ok){
          saveCartItems([]); updateCartBadge(); closeCartDrawer();
          showOrderComplete({
            order_id:      r.razorpay_order_id,
            payment_id:    r.razorpay_payment_id,
            product_name:  items.map(function(i){return i.name;}).join(', '),
            amount:        order.amount,
            customer_name: customer.name,
            customer_phone: customer.phone
          });
        }
        else alert('Payment verification failed. Please contact us on WhatsApp.');
      },
      prefill:{name:customer.name,email:customer.email,contact:customer.phone}, theme:{color:'#c9a24e'}
    });
    rzp2.on('payment.failed',function(r){logPaymentAttempt({order_id:order.id,status:'failed',error_reason:r.error?.reason||'',amount:order.amount,product_name:items.map(function(i){return i.name;}).join(', '),customer_name:customer.name,customer_phone:customer.phone});});
    rzp2.open();
  } catch(e){ alert('Payment unavailable. Please enquire on WhatsApp.'); }
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

// ── Razorpay Buy Now ─────────────────────────────────────────────

// ── Pre-checkout customer details modal ──────────────────────────
let _checkoutCallback = null; // called with customer details after OTP verified
let _otpSent = false;
let _otpResendTimer = null;

function openCheckoutModal(callback) {
  _checkoutCallback = callback;
  _otpSent = false;

  // Create modal if not exists
  let modal = document.getElementById('checkoutModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'checkoutModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px';
    modal.innerHTML = `
      <div style="background:#faf5ec;max-width:440px;width:100%;position:relative;border:1px solid rgba(201,162,78,.3);animation:fadeSlideUp .3s ease">
        <div style="height:4px;background:linear-gradient(90deg,#7a1f2e,#c9a24e,#7a1f2e)"></div>
        <div style="padding:32px">
          <button onclick="closeCheckoutModal()" style="position:absolute;top:12px;right:16px;background:none;border:none;font-size:22px;cursor:pointer;color:rgba(122,31,46,.4);line-height:1">&times;</button>
          <div style="font-family:'Cinzel',serif;font-size:10px;letter-spacing:.25em;color:#c9a24e;margin-bottom:12px">SECURE CHECKOUT</div>
          <h3 style="font-family:'Cormorant Garamond',serif;font-size:1.6rem;font-weight:400;color:#7a1f2e;margin-bottom:6px">Your Details</h3>
          <p style="font-family:'Jost',sans-serif;font-size:12px;color:#8c7b6b;margin-bottom:24px">Please provide your details to complete the order.</p>

          <div id="checkoutStep1">
            <div style="margin-bottom:14px">
              <label style="display:block;font-family:'Jost',sans-serif;font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:#8c7b6b;margin-bottom:6px">Full Name *</label>
              <input id="coName" type="text" placeholder="e.g. Priya Sharma"
                style="width:100%;padding:10px 14px;border:1px solid rgba(201,162,78,.3);background:#fff;font-family:'Jost',sans-serif;font-size:13px;outline:none;box-sizing:border-box"/>
            </div>
            <div style="margin-bottom:14px">
              <label style="display:block;font-family:'Jost',sans-serif;font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:#8c7b6b;margin-bottom:6px">Email Address <span style="color:#aaa;font-size:9px">(optional)</span></label>
              <input id="coEmail" type="email" placeholder="e.g. priya@email.com"
                style="width:100%;padding:10px 14px;border:1px solid rgba(201,162,78,.3);background:#fff;font-family:'Jost',sans-serif;font-size:13px;outline:none;box-sizing:border-box"/>
            </div>
            <div style="margin-bottom:20px">
              <label style="display:block;font-family:'Jost',sans-serif;font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:#8c7b6b;margin-bottom:6px">Mobile Number *</label>
              <div style="display:flex;gap:8px">
                <span style="padding:10px 12px;background:#f0ebe0;border:1px solid rgba(201,162,78,.3);font-family:'Jost',sans-serif;font-size:13px;color:#5c3d1e">+91</span>
                <input id="coPhone" type="tel" placeholder="10-digit mobile number" maxlength="10"
                  style="flex:1;padding:10px 14px;border:1px solid rgba(201,162,78,.3);background:#fff;font-family:'Jost',sans-serif;font-size:13px;outline:none;box-sizing:border-box"/>
              </div>
            </div>
            <div id="coError" style="display:none;color:#c0392b;font-family:'Jost',sans-serif;font-size:12px;margin-bottom:12px"></div>
            <button onclick="sendOTP()"
              style="width:100%;padding:13px;background:#7a1f2e;border:none;color:#faf5ec;font-family:'Jost',sans-serif;font-size:11px;letter-spacing:.2em;text-transform:uppercase;cursor:pointer">
              Send OTP
            </button>
          </div>

          <div id="checkoutStep2" style="display:none">
            <p style="font-family:'Jost',sans-serif;font-size:13px;color:#5c3d1e;margin-bottom:20px">
              We sent a 6-digit OTP to <strong id="coPhoneDisplay"></strong>.<br>
              <span style="font-size:12px;color:#8c7b6b">Please enter it below to continue.</span>
            </p>
            <div style="margin-bottom:20px">
              <label style="display:block;font-family:'Jost',sans-serif;font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:#8c7b6b;margin-bottom:6px">Enter OTP</label>
              <input id="coOTP" type="tel" maxlength="6" placeholder="6-digit OTP"
                style="width:100%;padding:12px 14px;border:1px solid rgba(201,162,78,.3);background:#fff;font-family:'Jost',sans-serif;font-size:18px;letter-spacing:.3em;text-align:center;outline:none;box-sizing:border-box"/>
            </div>
            <div id="coOTPError" style="display:none;color:#c0392b;font-family:'Jost',sans-serif;font-size:12px;margin-bottom:12px"></div>
            <button onclick="verifyOTP()"
              style="width:100%;padding:13px;background:#7a1f2e;border:none;color:#faf5ec;font-family:'Jost',sans-serif;font-size:11px;letter-spacing:.2em;text-transform:uppercase;cursor:pointer;margin-bottom:10px">
              Verify &amp; Pay
            </button>
            <button onclick="resendOTP()" id="coResendBtn"
              style="width:100%;padding:10px;background:none;border:1px solid rgba(201,162,78,.3);color:#c9a24e;font-family:'Jost',sans-serif;font-size:11px;letter-spacing:.1em;text-transform:uppercase;cursor:pointer">
              Resend OTP (<span id="coResendTimer">30</span>s)
            </button>
          </div>
        </div>
        <div style="height:2px;background:linear-gradient(90deg,transparent,#c9a24e,transparent)"></div>
      </div>`;
    document.body.appendChild(modal);
  }

  // Reset to step 1
  document.getElementById('checkoutStep1').style.display = 'block';
  document.getElementById('checkoutStep2').style.display = 'none';
  document.getElementById('coError').style.display = 'none';
  document.getElementById('coOTPError') && (document.getElementById('coOTPError').style.display = 'none');
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  document.getElementById('coName').focus();
}

function closeCheckoutModal() {
  const modal = document.getElementById('checkoutModal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';
  if (_otpResendTimer) { clearInterval(_otpResendTimer); _otpResendTimer = null; }
}

async function sendOTP() {
  const name  = document.getElementById('coName').value.trim();
  const email = document.getElementById('coEmail').value.trim();
  const phone = document.getElementById('coPhone').value.trim();
  const errEl = document.getElementById('coError');

  // Validate
  if (!name) { errEl.textContent = 'Please enter your name.'; errEl.style.display = 'block'; return; }
  if (email && !/^[^@]+@[^@]+\.[^@]+$/.test(email)) { errEl.textContent = 'Please enter a valid email address.'; errEl.style.display = 'block'; return; }
  if (!/^[6-9]\d{9}$/.test(phone)) { errEl.textContent = 'Please enter a valid 10-digit Indian mobile number.'; errEl.style.display = 'block'; return; }
  errEl.style.display = 'none';

  const btn = document.querySelector('#checkoutStep1 button');
  btn.textContent = 'Sending OTP...'; btn.disabled = true;

  const base = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:5000' : '';
  try {
    const r = await fetch(base + '/api/otp/send', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ phone: '91' + phone })
    });
    const data = await r.json();
    if (data.ok) {
      document.getElementById('checkoutStep1').style.display = 'none';
      document.getElementById('checkoutStep2').style.display = 'block';
      document.getElementById('coPhoneDisplay').textContent = '+91 ' + phone;
      document.getElementById('coOTP').focus();
      startResendTimer();
    } else {
      errEl.textContent = data.error || 'Failed to send OTP. Please try again.';
      errEl.style.display = 'block';
    }
  } catch {
    errEl.textContent = 'Could not connect. Please try again.';
    errEl.style.display = 'block';
  }
  btn.textContent = 'Send OTP'; btn.disabled = false;
}

async function verifyOTP() {
  const otp    = document.getElementById('coOTP').value.trim();
  const phone  = document.getElementById('coPhone').value.trim();
  const errEl  = document.getElementById('coOTPError');

  if (!/^\d{6}$/.test(otp)) { errEl.textContent = 'Please enter the 6-digit OTP.'; errEl.style.display = 'block'; return; }
  errEl.style.display = 'none';

  const btn = document.querySelector('#checkoutStep2 button');
  btn.textContent = 'Verifying...'; btn.disabled = true;

  const base = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:5000' : '';
  try {
    const r = await fetch(base + '/api/otp/verify', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ phone: '91' + phone, otp })
    });
    const data = await r.json();
    if (data.ok) {
      closeCheckoutModal();
      if (_checkoutCallback) {
        _checkoutCallback({
          name:  document.getElementById('coName').value.trim(),
          email: document.getElementById('coEmail').value.trim(),
          phone: '91' + phone
        });
      }
    } else {
      errEl.textContent = data.error || 'Invalid OTP. Please try again.';
      errEl.style.display = 'block';
    }
  } catch {
    errEl.textContent = 'Verification failed. Please try again.';
    errEl.style.display = 'block';
  }
  btn.textContent = 'Verify & Pay'; btn.disabled = false;
}

function startResendTimer() {
  let secs = 30;
  const timerEl  = document.getElementById('coResendTimer');
  const resendBtn = document.getElementById('coResendBtn');
  resendBtn.disabled = true; resendBtn.style.opacity = '0.5';
  _otpResendTimer = setInterval(() => {
    secs--;
    if (timerEl) timerEl.textContent = secs;
    if (secs <= 0) {
      clearInterval(_otpResendTimer); _otpResendTimer = null;
      resendBtn.disabled = false; resendBtn.style.opacity = '1';
      resendBtn.innerHTML = 'Resend OTP';
    }
  }, 1000);
}

async function resendOTP() {
  const phone = document.getElementById('coPhone').value.trim();
  const base  = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:5000' : '';
  const btn   = document.getElementById('coResendBtn');
  btn.disabled = true; btn.innerHTML = 'Sending...';
  await fetch(base + '/api/otp/send', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ phone: '91' + phone })
  });
  startResendTimer();
}


// ── Order Complete Popup ──────────────────────────────────────────
function showOrderComplete(details) {
  // details: { order_id, payment_id, product_name, amount, customer_name, customer_phone }
  let popup = document.getElementById('orderCompletePopup');
  if (!popup) {
    popup = document.createElement('div');
    popup.id = 'orderCompletePopup';
    popup.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:99999;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto';
    document.body.appendChild(popup);
  }
  const amt = details.amount ? '\u20b9' + Math.round(details.amount / 100).toLocaleString() : '';
  popup.innerHTML = `
    <div style="background:#faf5ec;max-width:480px;width:100%;position:relative;animation:fadeSlideUp .35s ease;border:1px solid rgba(201,162,78,.3);margin:auto">
      <button onclick="document.getElementById('orderCompletePopup').style.display='none';document.body.style.overflow='';" style="position:absolute;top:10px;right:10px;background:rgba(122,31,46,.08);border:none;width:30px;height:30px;border-radius:50%;font-size:18px;cursor:pointer;color:#7a1f2e;z-index:2;line-height:1">&times;</button>
      <div style="height:4px;background:linear-gradient(90deg,#7a1f2e,#c9a24e,#7a1f2e)"></div>
      <div style="padding:36px 32px">
        <!-- Success icon -->
        <div style="text-align:center;margin-bottom:20px">
          <div style="width:64px;height:64px;background:linear-gradient(135deg,#2ea043,#27ae60);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h2 style="font-family:'Cormorant Garamond',serif;font-size:1.8rem;font-weight:400;color:#7a1f2e;margin-bottom:4px">Order Confirmed!</h2>
          <p style="font-family:'Jost',sans-serif;font-size:12px;color:#8c7b6b">Thank you for shopping with SissyTrends</p>
        </div>

        <!-- Order details -->
        <div style="background:#f5ede0;border:1px solid rgba(201,162,78,.2);padding:18px;margin-bottom:20px">
          <div style="font-family:'Cinzel',serif;font-size:9px;letter-spacing:.25em;color:#c9a24e;margin-bottom:12px">ORDER DETAILS</div>
          ${details.product_name ? `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(201,162,78,.15)"><span style="font-family:'Jost',sans-serif;font-size:12px;color:#8c7b6b">Product</span><span style="font-family:'Jost',sans-serif;font-size:12px;color:#5c3d1e;max-width:60%;text-align:right">${details.product_name}</span></div>` : ''}
          ${amt ? `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(201,162,78,.15)"><span style="font-family:'Jost',sans-serif;font-size:12px;color:#8c7b6b">Amount Paid</span><span style="font-family:'Cormorant Garamond',serif;font-size:1.1rem;color:#7a1f2e;font-weight:600">${amt}</span></div>` : ''}
          ${details.payment_id ? `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(201,162,78,.15)"><span style="font-family:'Jost',sans-serif;font-size:12px;color:#8c7b6b">Payment ID</span><span style="font-family:'Jost',sans-serif;font-size:11px;color:#5c3d1e">${details.payment_id}</span></div>` : ''}
          ${details.order_id ? `<div style="display:flex;justify-content:space-between;padding:6px 0"><span style="font-family:'Jost',sans-serif;font-size:12px;color:#8c7b6b">Order ID</span><span style="font-family:'Jost',sans-serif;font-size:11px;color:#5c3d1e">${details.order_id}</span></div>` : ''}
        </div>

        <!-- Contact info -->
        <div style="background:#fff8f0;border:1px solid rgba(201,162,78,.2);padding:18px;margin-bottom:24px">
          <div style="font-family:'Cinzel',serif;font-size:9px;letter-spacing:.25em;color:#c9a24e;margin-bottom:12px">CONTACT US</div>
          <p style="font-family:'Jost',sans-serif;font-size:12px;color:#5c3d1e;margin-bottom:10px">Our team will reach out to you shortly regarding your order. For any queries:</p>
          <div style="display:flex;flex-direction:column;gap:8px">
            <a href="https://wa.me/919344182144?text=Hi!%20I%20just%20placed%20an%20order%20(${details.payment_id||''})%20on%20SissyTrends"
               target="_blank"
               style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#25d366;color:#fff;text-decoration:none;font-family:'Jost',sans-serif;font-size:11px;letter-spacing:.1em;text-transform:uppercase">
              <svg width="16" height="16" fill="white" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.122.554 4.112 1.528 5.84L.057 23.5l5.797-1.499A11.938 11.938 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.854 0-3.6-.497-5.11-1.367l-.366-.218-3.44.889.921-3.32-.239-.384A9.955 9.955 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
              WhatsApp Us
            </a>
            <div style="display:flex;align-items:center;gap:10px;padding:8px 14px;background:#f0ebe0;font-family:'Jost',sans-serif;font-size:12px;color:#5c3d1e">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c9a24e" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.67A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
              +91 93441 82144
            </div>
            <div style="display:flex;align-items:center;gap:10px;padding:8px 14px;background:#f0ebe0;font-family:'Jost',sans-serif;font-size:12px;color:#5c3d1e">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c9a24e" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              help@sissytrends.in
            </div>
          </div>
        </div>

        <button onclick="document.getElementById('orderCompletePopup').style.display='none';document.body.style.overflow='';"
          style="width:100%;padding:13px;background:#7a1f2e;border:none;color:#faf5ec;font-family:'Jost',sans-serif;font-size:11px;letter-spacing:.2em;text-transform:uppercase;cursor:pointer">
          Continue Shopping
        </button>
      </div>
      <div style="height:2px;background:linear-gradient(90deg,transparent,#c9a24e,transparent)"></div>
    </div>`;
  popup.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}


// ── Simple pre-checkout modal (no OTP) ───────────────────────────
// ── Leaflet map loader ───────────────────────────────────────────
function loadLeaflet(cb) {
  if (window.L) { cb(); return; }
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(link);
  var script = document.createElement('script');
  script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  script.onload = cb;
  document.head.appendChild(script);
}

// Warehouse: Saravanampatti, Coimbatore
var ORIGIN_LAT = 11.0780, ORIGIN_LON = 77.0347;

function haversineKm(lat1, lon1, lat2, lon2) {
  var R = 6371;
  var dLat = (lat2-lat1)*Math.PI/180;
  var dLon = (lon2-lon1)*Math.PI/180;
  var a = Math.sin(dLat/2)*Math.sin(dLat/2)
        + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)
        * Math.sin(dLon/2)*Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Weight: 0.5 kg per item. Shipping based on distance + weight slabs
// Uses India Post / courier standard approximation
// ── India Post Speed Post 2026 official rates (excl. GST + 18%) ──
// Source: clickpost.ai/blog/india-post-courier-charges (Jul 2026)
// Weight per category: Saree=500g, Jewellery=100g, Decor=500g

// Item weights in grams by category
var ITEM_WEIGHT_G = {
  sarees:    500,  // 0.5 kg
  jewellery: 100,  // 0.1 kg
  decor:     500   // 0.5 kg
};

// Speed Post rate table [local, <=200km, 201-1000km, 1001-2000km, >2000km]
// Rows: [up to 50g, 51-200g, 201-500g, each additional 500g]
var SP_RATES = [
  [15, 35, 35, 35, 35],   // up to 50g
  [25, 35, 40, 60, 70],   // 51-200g
  [30, 50, 60, 80, 90],   // 201-500g
  [10, 15, 30, 40, 50]    // each additional 500g
];

function getZoneIndex(distKm) {
  if (distKm <= 10)   return 0;  // Local
  if (distKm <= 200)  return 1;  // Up to 200 km
  if (distKm <= 1000) return 2;  // 201-1000 km
  if (distKm <= 2000) return 3;  // 1001-2000 km
  return 4;                       // Above 2000 km
}

function getZoneName(distKm) {
  if (distKm <= 10)   return 'Local';
  if (distKm <= 200)  return 'Up to 200 km';
  if (distKm <= 1000) return '201–1000 km';
  if (distKm <= 2000) return '1001–2000 km';
  return 'Above 2000 km';
}

function calcIndiaPostRate(totalWeightG, zoneIdx) {
  var cost = 0;
  if (totalWeightG <= 50)       cost = SP_RATES[0][zoneIdx];
  else if (totalWeightG <= 200) cost = SP_RATES[1][zoneIdx];
  else if (totalWeightG <= 500) cost = SP_RATES[2][zoneIdx];
  else {
    // Base for first 500g
    cost = SP_RATES[2][zoneIdx];
    // Each additional 500g slab
    var remaining = totalWeightG - 500;
    var extraSlabs = Math.ceil(remaining / 500);
    cost += extraSlabs * SP_RATES[3][zoneIdx];
  }
  // Add 18% GST
  return Math.round(cost * 1.18);
}

function calcShipping(distKm, cartItems) {
  // cartItems: array of {category, qty} or just a count
  var totalWeightG = 0;
  var itemSummary = [];

  if (Array.isArray(cartItems) && cartItems.length > 0) {
    cartItems.forEach(function(item) {
      var cat  = (item.category || 'sarees').toLowerCase();
      var wt   = ITEM_WEIGHT_G[cat] || 500;
      var qty  = item.qty || 1;
      totalWeightG += wt * qty;
      itemSummary.push(qty + '×' + cat + '(' + wt + 'g)');
    });
  } else {
    // Fallback: treat as saree count
    var qty = (typeof cartItems === 'number') ? cartItems : 1;
    totalWeightG = qty * 500;
    itemSummary.push(qty + '×saree(500g)');
  }

  var zoneIdx   = getZoneIndex(distKm);
  var zoneName  = getZoneName(distKm);
  var baseRate  = calcIndiaPostRate(totalWeightG, zoneIdx);
  var weightKg  = (totalWeightG / 1000).toFixed(2);

  var breakdown = itemSummary.join(' + ')
    + ' = ' + totalWeightG + 'g'
    + ' · ' + zoneName
    + ' · India Post Speed Post (incl. GST)';

  return {
    cost:      baseRate,
    label:     baseRate === 0 ? 'Free Delivery' : '₹' + baseRate,
    zone:      zoneName,
    weightKg:  weightKg,
    weightG:   totalWeightG,
    breakdown: breakdown
  };
}

function getCartItemCount() {
  try {
    var items = JSON.parse(localStorage.getItem('st_cart_items') || '[]');
    if (!items.length) return 1;
    return items.reduce(function(s, i){ return s + (i.qty||1); }, 0);
  } catch(e) { return 1; }
}

function getCartItemsForShipping() {
  try {
    var items = JSON.parse(localStorage.getItem('st_cart_items') || '[]');
    return items.length ? items : null;
  } catch(e) { return null; }
}

function openMapPicker() {
  var mapModal = document.getElementById('mapPickerModal');
  if (!mapModal) {
    mapModal = document.createElement('div');
    mapModal.id = 'mapPickerModal';
    mapModal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px';
    mapModal.innerHTML =
      '<div style="background:#faf5ec;width:100%;max-width:580px;border:1px solid rgba(201,162,78,.3)">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid rgba(201,162,78,.2)">'
      +'<span style="font-family:\'Cinzel\',serif;font-size:10px;letter-spacing:.2em;color:#7a1f2e">PIN YOUR DELIVERY LOCATION (INDIA ONLY)</span>'
      +'<button onclick="closeMapPicker()" style="background:none;border:none;font-size:22px;cursor:pointer;color:rgba(122,31,46,.4)">&times;</button>'
      +'</div>'
      +'<div id="leafletMap" style="height:340px;width:100%"></div>'
      +'<div style="padding:14px 16px;border-top:1px solid rgba(201,162,78,.2)">'
      +'<div id="mapAddressPreview" style="font-family:\'Jost\',sans-serif;font-size:12px;color:#5c3d1e;min-height:18px;margin-bottom:8px">Move the pin to your exact location</div>'
      +'<div id="mapShippingInfo" style="display:none;background:#f5ede0;border:1px solid rgba(201,162,78,.25);padding:10px 12px;margin-bottom:8px;font-family:\'Jost\',sans-serif;font-size:11px">'
      +'  <div style="display:flex;justify-content:space-between;margin-bottom:4px">'
      +'    <span id="mapDistLabel" style="color:#8c7b6b"></span>'
      +'    <span id="mapShipCost" style="color:#7a1f2e;font-weight:700;font-size:13px"></span>'
      +'  </div>'
      +'  <div id="mapShipBreakdown" style="color:#aaa;font-size:10px"></div>'
      +'</div>'
      +'<div id="mapIndiaError" style="display:none;color:#c0392b;font-family:\'Jost\',sans-serif;font-size:11px;padding:6px 0;margin-bottom:6px">&#9888; We only deliver within India. Please move the pin inside India.</div>'
      +'<button onclick="confirmMapAddress()" id="mapConfirmBtn" style="width:100%;padding:11px;background:#7a1f2e;border:none;color:#faf5ec;font-family:\'Jost\',sans-serif;font-size:11px;letter-spacing:.2em;text-transform:uppercase;cursor:pointer">Confirm This Location</button>'
      +'</div>'
      +'</div>';
    document.body.appendChild(mapModal);
  }
  mapModal.style.display = 'flex';

  loadLeaflet(function() {
    setTimeout(function() {
      if (window._leafletMap) { window._leafletMap.remove(); window._leafletMap = null; }

      var defaultLat = 11.0168, defaultLon = 76.9558; // Coimbatore center
      var indiaBounds = window.L.latLngBounds([[6.55, 68.11], [35.67, 97.40]]);
      var map = window.L.map('leafletMap', { maxBounds: indiaBounds, maxBoundsViscosity: 1.0 })
                        .setView([defaultLat, defaultLon], 11);
      window._leafletMap = map;

      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '\u00a9 OpenStreetMap', minZoom: 5, maxZoom: 18
      }).addTo(map);

      // Warehouse marker
      window.L.circleMarker([ORIGIN_LAT, ORIGIN_LON], {
        radius: 8, color: '#c9a24e', fillColor: '#c9a24e', fillOpacity: 0.9, weight: 2
      }).addTo(map).bindPopup('<b style="font-size:11px">SissyTrends Warehouse<br>Saravanampatti, Coimbatore</b>');

      var marker = window.L.marker([defaultLat, defaultLon], { draggable: true }).addTo(map);
      window._mapMarker = marker;
      window._mapAddress = '';
      window._mapShipping = 0;
      window._mapDistKm = 0;

      function isInIndia(lat, lon) {
        return lat >= 6.55 && lat <= 35.67 && lon >= 68.11 && lon <= 97.40;
      }

      function updateUI(lat, lon) {
        var errEl   = document.getElementById('mapIndiaError');
        var shipEl  = document.getElementById('mapShippingInfo');
        var distEl  = document.getElementById('mapDistLabel');
        var costEl  = document.getElementById('mapShipCost');
        var brkEl   = document.getElementById('mapShipBreakdown');
        var btn     = document.getElementById('mapConfirmBtn');

        if (!isInIndia(lat, lon)) {
          if (errEl) errEl.style.display = 'block';
          if (shipEl) shipEl.style.display = 'none';
          if (btn) { btn.disabled = true; btn.style.opacity = '0.4'; }
          window._mapShipping = -1;
          return;
        }
        if (errEl) errEl.style.display = 'none';
        if (btn) { btn.disabled = false; btn.style.opacity = '1'; }

        var distKm = Math.round(haversineKm(ORIGIN_LAT, ORIGIN_LON, lat, lon));
        var cartItems = getCartItemsForShipping();
        var qty = cartItems ? getCartItemCount() : 1;
        var ship   = calcShipping(distKm, cartItems || qty);

        window._mapDistKm   = distKm;
        window._mapShipping = ship.cost;
        window._mapShipObj  = ship;

        if (shipEl) shipEl.style.display = 'block';
        if (distEl) distEl.textContent = '~' + distKm + ' km \u00b7 ' + qty + ' item(s) \u00b7 ' + ship.weightKg + 'kg';
        if (costEl) costEl.textContent = 'Shipping: ' + ship.label;
        if (brkEl)  brkEl.textContent  = ship.breakdown;
      }

      function reverseGeocode(lat, lon) {
        var base = (window.location.hostname==='localhost'||window.location.hostname==='127.0.0.1')
          ? 'http://localhost:5000' : '';
        fetch(base+'/api/geocode?lat='+lat+'&lon='+lon)
          .then(function(r){return r.json();})
          .then(function(d){
            var addr = d.location || (lat.toFixed(4)+', '+lon.toFixed(4));
            window._mapAddress = addr;
            var el = document.getElementById('mapAddressPreview');
            if (el) el.innerHTML = '\uD83D\uDCCD <b>'+addr+'</b>';
            updateUI(lat, lon);
          }).catch(function(){
            window._mapAddress = lat.toFixed(4)+', '+lon.toFixed(4);
            updateUI(lat, lon);
          });
      }

      marker.on('dragend', function(e) {
        var pos = e.target.getLatLng();
        if (!isInIndia(pos.lat, pos.lng)) {
          marker.setLatLng([defaultLat, defaultLon]);
          reverseGeocode(defaultLat, defaultLon);
        } else {
          reverseGeocode(pos.lat, pos.lng);
        }
      });

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(pos) {
          var lat = pos.coords.latitude, lon = pos.coords.longitude;
          if (isInIndia(lat, lon)) {
            map.setView([lat, lon], 14);
            marker.setLatLng([lat, lon]);
            reverseGeocode(lat, lon);
          } else {
            reverseGeocode(defaultLat, defaultLon);
          }
        }, function() { reverseGeocode(defaultLat, defaultLon); }, { timeout: 6000 });
      } else {
        reverseGeocode(defaultLat, defaultLon);
      }

      setTimeout(function(){ map.invalidateSize(); }, 100);
    }, 100);
  });
}

function closeMapPicker() {
  var m = document.getElementById('mapPickerModal');
  if (m) m.style.display = 'none';
}

function confirmMapAddress() {
  if (window._mapShipping === -1) return;
  var addr   = window._mapAddress || '';
  var ship   = window._mapShipObj || { cost:0, label:'Free Delivery', breakdown:'' };
  var distKm = window._mapDistKm  || 0;

  var el = document.getElementById('scAddress');
  if (el && addr) el.value = addr;

  // Show shipping below address
  var shipEl = document.getElementById('scShippingInfo');
  if (!shipEl) {
    shipEl = document.createElement('div');
    shipEl.id = 'scShippingInfo';
    shipEl.style.cssText = 'font-family:\'Jost\',sans-serif;font-size:11px;padding:8px 12px;background:#f5ede0;border:1px solid rgba(201,162,78,.2);margin-top:6px';
    if (el && el.parentNode) el.parentNode.appendChild(shipEl);
  }
  shipEl.innerHTML =
    '<span style="color:#8c7b6b">~'+distKm+' km &mdash; '+ship.weightKg+'kg &mdash; </span>'
    +'<span style="color:#7a1f2e;font-weight:600">Shipping: '+ship.label+'</span>'
    +(ship.breakdown ? '<br><span style="color:#aaa;font-size:10px">'+ship.breakdown+'</span>' : '');

  window._checkoutShipping = ship.cost;
  window._checkoutDistKm   = distKm;
  window._checkoutShipLabel = ship.label;
  closeMapPicker();
}

// ── Address autocomplete (India only via Nominatim proxy) ───────────
var _addrTimer = null;
function addressAutocomplete(query) {
  var sugEl = document.getElementById('scAddressSuggestions');
  if (!sugEl) return;
  if (!query || query.length < 3) { sugEl.style.display = 'none'; return; }
  clearTimeout(_addrTimer);
  _addrTimer = setTimeout(function() {
    var base = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:5000' : '';
    fetch(base + '/api/address-suggest?q=' + encodeURIComponent(query))
      .then(function(r) { return r.json(); })
      .then(function(results) {
        if (!results.length) { sugEl.style.display = 'none'; return; }
        sugEl.innerHTML = results.map(function(r) {
          // Show: display name (state)
          var parts  = r.display_name.split(', ');
          var state  = r.address && r.address.state ? r.address.state : '';
          var label  = parts.slice(0, 3).join(', ');
          var sub    = state ? state : parts.slice(-2).join(', ');
          return '<div onclick="selectAddress(\'' + r.display_name.replace(/'/g, '') + '\', ' + r.lat + ', ' + r.lon + ')"'
            + ' style="padding:10px 14px;cursor:pointer;border-bottom:1px solid rgba(201,162,78,.1);font-family:\'Jost\',sans-serif"'
            + ' onmouseover="this.style.background=\'#fdf5e6\'" onmouseout="this.style.background=\'#fff\'">'
            + '<div style="font-size:13px;color:#1a0a06">' + label + '</div>'
            + '<div style="font-size:11px;color:#c9a24e;margin-top:2px">' + sub + '</div>'
            + '</div>';
        }).join('');
        sugEl.style.display = 'block';
      }).catch(function() { sugEl.style.display = 'none'; });
  }, 400);
}

function selectAddress(displayName, lat, lon) {
  var input  = document.getElementById('scAddress');
  var sugEl  = document.getElementById('scAddressSuggestions');
  if (input) input.value = displayName;
  if (sugEl) sugEl.style.display = 'none';
  // Update shipping based on selected location
  var distKm = Math.round(haversineKm(ORIGIN_LAT, ORIGIN_LON, lat, lon));
  var cartItems = getCartItemsForShipping();
  var ship = calcShipping(distKm, cartItems || 1);
  window._checkoutShipping  = ship.cost;
  window._checkoutDistKm    = distKm;
  window._checkoutShipLabel = ship.label;
  // Show shipping below address
  var shipEl = document.getElementById('scShippingInfo');
  if (!shipEl) {
    shipEl = document.createElement('div');
    shipEl.id = 'scShippingInfo';
    shipEl.style.cssText = 'font-family:\'Jost\',sans-serif;font-size:11px;padding:8px 12px;background:#f5ede0;border:1px solid rgba(201,162,78,.2);margin-top:6px';
    var addrInput = document.getElementById('scAddress');
    if (addrInput && addrInput.parentNode && addrInput.parentNode.parentNode) {
      addrInput.parentNode.parentNode.appendChild(shipEl);
    }
  }
  shipEl.innerHTML =
    '<span style="color:#8c7b6b">~' + distKm + ' km &mdash; </span>'
    + '<span style="color:#7a1f2e;font-weight:600">Shipping: ' + ship.label + '</span>'
    + (ship.breakdown ? '<br><span style="color:#aaa;font-size:10px">' + ship.breakdown + '</span>' : '');
}

// ── Pincode-based shipping calculation ───────────────────────────
// Approximate road distance from Coimbatore to each state (km)
var STATE_DIST_KM = {
  'Tamil Nadu':120,'Kerala':180,'Karnataka':350,'Andhra Pradesh':650,
  'Telangana':800,'Puducherry':500,'Goa':800,'Maharashtra':1050,
  'Gujarat':1450,'Rajasthan':1800,'Madhya Pradesh':1400,'Chhattisgarh':1500,
  'Odisha':1700,'West Bengal':2100,'Jharkhand':2000,'Bihar':2200,
  'Uttar Pradesh':2000,'Delhi':2100,'Chandigarh':2400,'Haryana':2200,
  'Punjab':2500,'Himachal Pradesh':2600,'Jammu and Kashmir':2900,
  'Ladakh':3100,'Sikkim':2800,'Assam':2800,'Meghalaya':2900,
  'Manipur':3000,'Mizoram':3000,'Nagaland':3100,'Arunachal Pradesh':3200,
  'Tripura':2900,'Uttarakhand':2400,'Andaman and Nicobar Islands':1800,
  'Lakshadweep':700,'Dadra and Nagar Haveli and Daman and Diu':1400
};

// 3-digit pincode prefix to state
var PIN3_STATE = {
  '600':'Tamil Nadu','601':'Tamil Nadu','602':'Tamil Nadu','603':'Tamil Nadu',
  '604':'Tamil Nadu','605':'Tamil Nadu','606':'Tamil Nadu','607':'Tamil Nadu',
  '608':'Tamil Nadu','609':'Tamil Nadu','610':'Tamil Nadu','611':'Tamil Nadu',
  '612':'Tamil Nadu','613':'Tamil Nadu','614':'Tamil Nadu','615':'Tamil Nadu',
  '616':'Tamil Nadu','617':'Tamil Nadu','618':'Tamil Nadu','619':'Tamil Nadu',
  '620':'Tamil Nadu','621':'Tamil Nadu','622':'Tamil Nadu','623':'Tamil Nadu',
  '624':'Tamil Nadu','625':'Tamil Nadu','626':'Tamil Nadu','627':'Tamil Nadu',
  '628':'Tamil Nadu','629':'Tamil Nadu','630':'Tamil Nadu','631':'Tamil Nadu',
  '632':'Tamil Nadu','633':'Tamil Nadu','634':'Tamil Nadu','635':'Tamil Nadu',
  '636':'Tamil Nadu','637':'Tamil Nadu','638':'Tamil Nadu','639':'Tamil Nadu',
  '640':'Tamil Nadu','641':'Tamil Nadu','642':'Tamil Nadu','643':'Tamil Nadu',
  '644':'Tamil Nadu','645':'Tamil Nadu','646':'Tamil Nadu','647':'Tamil Nadu',
  '648':'Tamil Nadu','649':'Tamil Nadu','650':'Tamil Nadu','651':'Tamil Nadu',
  '652':'Tamil Nadu','653':'Tamil Nadu','654':'Tamil Nadu','655':'Tamil Nadu',
  '656':'Tamil Nadu','657':'Tamil Nadu','658':'Tamil Nadu','659':'Tamil Nadu',
  '660':'Tamil Nadu','661':'Tamil Nadu',
  '670':'Kerala','671':'Kerala','672':'Kerala','673':'Kerala','674':'Kerala',
  '675':'Kerala','676':'Kerala','677':'Kerala','678':'Kerala','679':'Kerala',
  '680':'Kerala','681':'Kerala','682':'Kerala','683':'Kerala','684':'Kerala',
  '685':'Kerala','686':'Kerala','687':'Kerala','688':'Kerala','689':'Kerala',
  '560':'Karnataka','561':'Karnataka','562':'Karnataka','563':'Karnataka',
  '564':'Karnataka','565':'Karnataka','566':'Karnataka','567':'Karnataka',
  '568':'Karnataka','569':'Karnataka','570':'Karnataka','571':'Karnataka',
  '572':'Karnataka','573':'Karnataka','574':'Karnataka','575':'Karnataka',
  '576':'Karnataka','577':'Karnataka','578':'Karnataka','579':'Karnataka',
  '580':'Karnataka','581':'Karnataka','582':'Karnataka','583':'Karnataka',
  '584':'Karnataka','585':'Karnataka','586':'Karnataka','587':'Karnataka',
  '588':'Karnataka','589':'Karnataka',
  '500':'Telangana','501':'Telangana','502':'Telangana','503':'Telangana',
  '504':'Telangana','505':'Telangana','506':'Telangana','507':'Telangana',
  '508':'Telangana','509':'Telangana',
  '515':'Andhra Pradesh','516':'Andhra Pradesh','517':'Andhra Pradesh',
  '518':'Andhra Pradesh','519':'Andhra Pradesh','520':'Andhra Pradesh',
  '521':'Andhra Pradesh','522':'Andhra Pradesh','523':'Andhra Pradesh',
  '524':'Andhra Pradesh','525':'Andhra Pradesh','530':'Andhra Pradesh',
  '531':'Andhra Pradesh','532':'Andhra Pradesh','533':'Andhra Pradesh',
  '534':'Andhra Pradesh','535':'Andhra Pradesh',
  '403':'Goa',
  '400':'Maharashtra','401':'Maharashtra','402':'Maharashtra',
  '410':'Maharashtra','411':'Maharashtra','412':'Maharashtra',
  '413':'Maharashtra','414':'Maharashtra','415':'Maharashtra',
  '416':'Maharashtra','421':'Maharashtra','422':'Maharashtra',
  '423':'Maharashtra','424':'Maharashtra','425':'Maharashtra',
  '431':'Maharashtra','440':'Maharashtra','441':'Maharashtra',
  '442':'Maharashtra','443':'Maharashtra','444':'Maharashtra',
  '445':'Maharashtra','446':'Maharashtra',
  '360':'Gujarat','361':'Gujarat','362':'Gujarat','363':'Gujarat',
  '364':'Gujarat','365':'Gujarat','366':'Gujarat','367':'Gujarat',
  '368':'Gujarat','370':'Gujarat','380':'Gujarat','382':'Gujarat',
  '383':'Gujarat','384':'Gujarat','385':'Gujarat','387':'Gujarat',
  '388':'Gujarat','389':'Gujarat','390':'Gujarat','391':'Gujarat',
  '392':'Gujarat','393':'Gujarat','394':'Gujarat','395':'Gujarat',
  '396':'Gujarat',
  '302':'Rajasthan','303':'Rajasthan','304':'Rajasthan','305':'Rajasthan',
  '306':'Rajasthan','307':'Rajasthan','311':'Rajasthan','312':'Rajasthan',
  '313':'Rajasthan','314':'Rajasthan','321':'Rajasthan','322':'Rajasthan',
  '323':'Rajasthan','324':'Rajasthan','325':'Rajasthan','326':'Rajasthan',
  '327':'Rajasthan','328':'Rajasthan','331':'Rajasthan','332':'Rajasthan',
  '333':'Rajasthan','334':'Rajasthan','335':'Rajasthan','341':'Rajasthan',
  '342':'Rajasthan','343':'Rajasthan','344':'Rajasthan',
  '452':'Madhya Pradesh','453':'Madhya Pradesh','454':'Madhya Pradesh',
  '455':'Madhya Pradesh','456':'Madhya Pradesh','457':'Madhya Pradesh',
  '458':'Madhya Pradesh','459':'Madhya Pradesh','460':'Madhya Pradesh',
  '461':'Madhya Pradesh','462':'Madhya Pradesh','463':'Madhya Pradesh',
  '464':'Madhya Pradesh','465':'Madhya Pradesh','466':'Madhya Pradesh',
  '467':'Madhya Pradesh','470':'Madhya Pradesh','471':'Madhya Pradesh',
  '472':'Madhya Pradesh','473':'Madhya Pradesh','474':'Madhya Pradesh',
  '475':'Madhya Pradesh','476':'Madhya Pradesh','477':'Madhya Pradesh',
  '478':'Madhya Pradesh','480':'Madhya Pradesh','481':'Madhya Pradesh',
  '482':'Madhya Pradesh','483':'Madhya Pradesh','484':'Madhya Pradesh',
  '485':'Madhya Pradesh','486':'Madhya Pradesh','487':'Madhya Pradesh',
  '488':'Madhya Pradesh','489':'Madhya Pradesh',
  '490':'Chhattisgarh','491':'Chhattisgarh','492':'Chhattisgarh',
  '493':'Chhattisgarh','494':'Chhattisgarh','495':'Chhattisgarh',
  '496':'Chhattisgarh','497':'Chhattisgarh',
  '751':'Odisha','752':'Odisha','753':'Odisha','754':'Odisha',
  '755':'Odisha','756':'Odisha','757':'Odisha','758':'Odisha',
  '700':'West Bengal','711':'West Bengal','712':'West Bengal',
  '713':'West Bengal','721':'West Bengal','722':'West Bengal',
  '723':'West Bengal','731':'West Bengal','732':'West Bengal',
  '733':'West Bengal','734':'West Bengal','741':'West Bengal',
  '742':'West Bengal','743':'West Bengal','744':'West Bengal',
  '800':'Bihar','801':'Bihar','802':'Bihar','803':'Bihar',
  '804':'Bihar','805':'Bihar','811':'Bihar','812':'Bihar',
  '813':'Bihar','814':'Bihar','815':'Bihar','816':'Bihar',
  '821':'Bihar','822':'Bihar','823':'Bihar','824':'Bihar',
  '825':'Bihar','826':'Bihar','827':'Jharkhand','828':'Jharkhand',
  '829':'Jharkhand','831':'Jharkhand','832':'Jharkhand','833':'Jharkhand',
  '834':'Jharkhand','835':'Jharkhand',
  '201':'Uttar Pradesh','202':'Uttar Pradesh','203':'Uttar Pradesh',
  '204':'Uttar Pradesh','205':'Uttar Pradesh','206':'Uttar Pradesh',
  '207':'Uttar Pradesh','208':'Uttar Pradesh','209':'Uttar Pradesh',
  '210':'Uttar Pradesh','211':'Uttar Pradesh','212':'Uttar Pradesh',
  '221':'Uttar Pradesh','226':'Uttar Pradesh','231':'Uttar Pradesh',
  '241':'Uttar Pradesh','261':'Uttar Pradesh','271':'Uttar Pradesh',
  '281':'Uttar Pradesh','282':'Uttar Pradesh','283':'Uttar Pradesh',
  '110':'Delhi','111':'Delhi',
  '121':'Haryana','122':'Haryana','123':'Haryana','124':'Haryana',
  '125':'Haryana','126':'Haryana','127':'Haryana','128':'Haryana',
  '131':'Haryana','132':'Haryana','133':'Haryana','134':'Haryana',
  '135':'Haryana','136':'Haryana',
  '140':'Punjab','141':'Punjab','142':'Punjab','143':'Punjab',
  '144':'Punjab','145':'Punjab','146':'Punjab','147':'Punjab',
  '148':'Punjab','151':'Punjab','152':'Punjab','153':'Punjab',
  '154':'Punjab','155':'Punjab','160':'Chandigarh',
  '171':'Himachal Pradesh','172':'Himachal Pradesh','173':'Himachal Pradesh',
  '174':'Himachal Pradesh','175':'Himachal Pradesh','176':'Himachal Pradesh',
  '177':'Himachal Pradesh',
  '180':'Jammu and Kashmir','181':'Jammu and Kashmir','182':'Jammu and Kashmir',
  '190':'Jammu and Kashmir','191':'Jammu and Kashmir','192':'Jammu and Kashmir',
  '193':'Jammu and Kashmir','194':'Jammu and Kashmir',
  '244':'Uttarakhand','246':'Uttarakhand','247':'Uttarakhand',
  '248':'Uttarakhand','249':'Uttarakhand','263':'Uttarakhand',
  '781':'Assam','782':'Assam','783':'Assam','784':'Assam','785':'Assam',
  '786':'Assam','787':'Assam','788':'Assam','793':'Meghalaya','794':'Meghalaya',
  '795':'Manipur','796':'Mizoram','797':'Nagaland','798':'Nagaland',
  '790':'Arunachal Pradesh','791':'Arunachal Pradesh','792':'Arunachal Pradesh',
  '799':'Tripura','744':'Andaman and Nicobar Islands'
};

function getPinState(pin) {
  if (!pin || pin.length !== 6) return null;
  return PIN3_STATE[pin.substring(0,3)] || null;
}

var _pinTimer = null;
function lookupPincode(pin) {
  if (!pin || !/^\d{6}$/.test(pin)) return;
  clearTimeout(_pinTimer);
  _pinTimer = setTimeout(function() {
    var shipEl = getOrCreateShippingEl();
    // Try pincode prefix map first
    var state = getPinState(pin);
    // Fall back to selected state dropdown
    if (!state) {
      var selState = document.getElementById('scState');
      if (selState && selState.value) state = selState.value;
    }
    if (!state) {
      if (shipEl) shipEl.innerHTML = '<span style="color:#aaa">Select your state to see shipping cost</span>';
      return;
    }
    var distKm    = STATE_DIST_KM[state] || 1500;
    var cartItems = getCartItemsForShipping();
    var ship      = calcShipping(distKm, cartItems || 1);
    window._checkoutShipping  = ship.cost;
    window._checkoutDistKm    = distKm;
    window._checkoutShipLabel = ship.label;
    if (shipEl) {
      shipEl.innerHTML =
        '<span style="color:#8c7b6b">' + state + ' \u00b7 ~' + distKm + ' km \u00b7 </span>'
        + '<span style="color:#7a1f2e;font-weight:700">Shipping: ' + ship.label + '</span>'
        + '<br><span style="color:#aaa;font-size:10px">' + ship.breakdown + '</span>';
    }
  }, 300);
}

function getOrCreateShippingEl() {
  var el = document.getElementById('scShippingInfo');
  if (!el) {
    el = document.createElement('div');
    el.id = 'scShippingInfo';
    el.style.cssText = 'font-family:\'Jost\',sans-serif;font-size:11px;padding:8px 12px;background:#f5ede0;border:1px solid rgba(201,162,78,.2);margin-top:6px';
    var state = document.getElementById('scState');
    if (state && state.parentNode) state.parentNode.insertBefore(el, state.nextSibling);
  }
  return el;
}

function openSimpleCheckout(callback) {
  var modal = document.getElementById('simpleCheckoutModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'simpleCheckoutModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:99999;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto';
    modal.innerHTML =
      '<div style="background:#faf5ec;max-width:440px;width:100%;position:relative;border:1px solid rgba(201,162,78,.3);margin:auto">'
      +'<div style="height:4px;background:linear-gradient(90deg,#7a1f2e,#c9a24e,#7a1f2e)"></div>'
      +'<div style="padding:28px 28px 24px">'
      +'<button onclick="closeSimpleCheckout()" style="position:absolute;top:10px;right:14px;background:none;border:none;font-size:22px;cursor:pointer;color:rgba(122,31,46,.4)">&times;</button>'
      +'<div style="font-family:\'Cinzel\',serif;font-size:10px;letter-spacing:.25em;color:#c9a24e;margin-bottom:8px">CHECKOUT</div>'
      +'<h3 style="font-family:\'Cormorant Garamond\',serif;font-size:1.5rem;font-weight:400;color:#7a1f2e;margin-bottom:18px">Your Details</h3>'
      +'<div style="margin-bottom:12px">'
      +'<label style="display:block;font-family:\'Jost\',sans-serif;font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:#8c7b6b;margin-bottom:5px">Full Name *</label>'
      +'<input id="scName" type="text" placeholder="e.g. Priya Sharma" style="width:100%;padding:10px 12px;border:1px solid rgba(201,162,78,.3);background:#fff;font-family:\'Jost\',sans-serif;font-size:13px;outline:none;box-sizing:border-box"/>'
      +'</div>'
      +'<div style="margin-bottom:12px">'
      +'<label style="display:block;font-family:\'Jost\',sans-serif;font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:#8c7b6b;margin-bottom:5px">Mobile Number *</label>'
      +'<div style="display:flex;gap:6px">'
      +'<span style="padding:10px 10px;background:#f0ebe0;border:1px solid rgba(201,162,78,.3);font-family:\'Jost\',sans-serif;font-size:13px;color:#5c3d1e;white-space:nowrap">+91</span>'
      +'<input id="scPhone" type="tel" placeholder="10-digit mobile" maxlength="10" style="flex:1;padding:10px 12px;border:1px solid rgba(201,162,78,.3);background:#fff;font-family:\'Jost\',sans-serif;font-size:13px;outline:none;box-sizing:border-box"/>'
      +'</div></div>'
      +'<div style="margin-bottom:12px">'
      +'<label style="display:block;font-family:\'Jost\',sans-serif;font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:#8c7b6b;margin-bottom:5px">Email <span style="color:#aaa;font-size:9px">(optional)</span></label>'
      +'<input id="scEmail" type="email" placeholder="e.g. priya@email.com" style="width:100%;padding:10px 12px;border:1px solid rgba(201,162,78,.3);background:#fff;font-family:\'Jost\',sans-serif;font-size:13px;outline:none;box-sizing:border-box"/>'
      +'</div>'
      +'<div style="margin-bottom:12px">'
      +'<label style="display:block;font-family:\'Jost\',sans-serif;font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:#8c7b6b;margin-bottom:5px">Delivery Address *</label>'
      +'<input id="scHouse" type="text" placeholder="House / Flat / Door No. & Street" style="width:100%;padding:10px 12px;border:1px solid rgba(201,162,78,.3);background:#fff;font-family:\'Jost\',sans-serif;font-size:13px;outline:none;box-sizing:border-box;margin-bottom:6px"/>'
      +'<input id="scArea" type="text" placeholder="Area / Locality / Landmark" style="width:100%;padding:10px 12px;border:1px solid rgba(201,162,78,.3);background:#fff;font-family:\'Jost\',sans-serif;font-size:13px;outline:none;box-sizing:border-box;margin-bottom:6px"/>'
      +'<div style="display:flex;gap:6px;margin-bottom:6px">'
      +'<input id="scCity" type="text" placeholder="City *" style="flex:1;padding:10px 12px;border:1px solid rgba(201,162,78,.3);background:#fff;font-family:\'Jost\',sans-serif;font-size:13px;outline:none;box-sizing:border-box"/>'
      +'<input id="scPincode" type="tel" placeholder="Pincode *" maxlength="6" style="width:110px;padding:10px 12px;border:1px solid rgba(201,162,78,.3);background:#fff;font-family:\'Jost\',sans-serif;font-size:13px;outline:none;box-sizing:border-box" oninput="lookupPincode(this.value)"/>'
      +'</div>'
      +'<select id="scState" onchange="lookupPincode(document.getElementById(\'scPincode\').value)" style="width:100%;padding:10px 12px;border:1px solid rgba(201,162,78,.3);background:#fff;font-family:\'Jost\',sans-serif;font-size:13px;outline:none;box-sizing:border-box;color:#5c3d1e">'
      +'<option value="">Select State *</option>'
      +'<option>Andhra Pradesh</option><option>Arunachal Pradesh</option><option>Assam</option>'
      +'<option>Bihar</option><option>Chhattisgarh</option><option>Goa</option><option>Gujarat</option>'
      +'<option>Haryana</option><option>Himachal Pradesh</option><option>Jharkhand</option>'
      +'<option>Karnataka</option><option>Kerala</option><option>Madhya Pradesh</option>'
      +'<option>Maharashtra</option><option>Manipur</option><option>Meghalaya</option>'
      +'<option>Mizoram</option><option>Nagaland</option><option>Odisha</option>'
      +'<option>Punjab</option><option>Rajasthan</option><option>Sikkim</option>'
      +'<option>Tamil Nadu</option><option>Telangana</option><option>Tripura</option>'
      +'<option>Uttar Pradesh</option><option>Uttarakhand</option><option>West Bengal</option>'
      +'<option>Andaman and Nicobar Islands</option><option>Chandigarh</option>'
      +'<option>Dadra and Nagar Haveli and Daman and Diu</option>'
      +'<option>Delhi</option><option>Jammu and Kashmir</option><option>Ladakh</option>'
      +'<option>Lakshadweep</option><option>Puducherry</option>'
      +'</select>'
      +'</div>'
      +'<div id="scError" style="display:none;color:#c0392b;font-family:\'Jost\',sans-serif;font-size:12px;margin-bottom:12px"></div>'
      +'<div style="margin-bottom:14px">'
      +'<label style="display:block;font-family:\'Jost\',sans-serif;font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:#8c7b6b;margin-bottom:5px">Coupon Code <span style="color:#aaa;font-size:9px">(optional)</span></label>'
      +'<div style="display:flex;gap:6px">'
      +'<input id="scCoupon" type="text" placeholder="e.g. SHIP50" style="flex:1;padding:10px 12px;border:1px solid rgba(201,162,78,.3);background:#fff;font-family:\'Jost\',sans-serif;font-size:13px;outline:none;box-sizing:border-box;text-transform:uppercase" oninput="this.value=this.value.toUpperCase()"/>'
      +'<button onclick="applyCoupon()" type="button" style="padding:10px 14px;background:#c9a24e;border:none;color:#1a0a06;font-family:\'Jost\',sans-serif;font-size:10px;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;white-space:nowrap">Apply</button>'
      +'</div>'
      +'<div id="scCouponMsg" style="display:none;font-family:\'Jost\',sans-serif;font-size:11px;margin-top:6px"></div>'
      +'</div>'
      +'<button onclick="submitSimpleCheckout()" style="width:100%;padding:13px;background:#7a1f2e;border:none;color:#faf5ec;font-family:\'Jost\',sans-serif;font-size:11px;letter-spacing:.2em;text-transform:uppercase;cursor:pointer">Proceed to Payment</button>'
      +'</div>'
      +'<div style="height:2px;background:linear-gradient(90deg,transparent,#c9a24e,transparent)"></div>'
      +'</div>';
    document.body.appendChild(modal);
  }
  document.getElementById('scName').value = '';
  document.getElementById('scPhone').value = '';
  document.getElementById('scEmail').value = '';
  ['scHouse','scArea','scCity','scPincode'].forEach(function(id){
    var el = document.getElementById(id); if(el) el.value = '';
  });
  var st = document.getElementById('scState'); if(st) st.value = '';
  document.getElementById('scError').style.display = 'none';
  var couponInput = document.getElementById('scCoupon'); if(couponInput) couponInput.value = '';
  var couponMsg   = document.getElementById('scCouponMsg'); if(couponMsg) { couponMsg.style.display='none'; couponMsg.textContent=''; }
  window._couponApplied = false;
  var shipEl = document.getElementById('scShippingInfo');
  if (shipEl) shipEl.remove();
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  document.getElementById('scName').focus();
  modal._callback = callback;
}

function closeSimpleCheckout() {
  var modal = document.getElementById('simpleCheckoutModal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';
}

async function applyCoupon() {
  var code    = (document.getElementById('scCoupon')?.value || '').trim().toUpperCase();
  var msgEl   = document.getElementById('scCouponMsg');
  var shipping = window._checkoutShipping || 0;
  if (!code) { if(msgEl){msgEl.textContent='Please enter a coupon code.';msgEl.style.color='#c0392b';msgEl.style.display='block';} return; }
  var base = (location.hostname==='localhost'||location.hostname==='127.0.0.1') ? 'http://localhost:5000' : '';
  try {
    var r = await fetch(base+'/api/coupon/validate', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({code:code, shipping:shipping})
    });
    var data = await r.json();
    if (data.ok) {
      window._checkoutShipping  = 0;
      window._checkoutShipLabel = 'FREE ('+code+')';
      window._couponApplied     = code;
      if(msgEl){msgEl.textContent='\u2714 '+data.message;msgEl.style.color='#27ae60';msgEl.style.display='block';}
      // Update shipping display
      var shipEl = document.getElementById('scShippingInfo');
      if(shipEl) shipEl.innerHTML = '<span style="color:#27ae60;font-weight:700">✔ Free Shipping Applied ('+code+')</span>';
    } else {
      window._couponApplied = false;
      if(msgEl){msgEl.textContent='\u2718 '+(data.error||'Invalid code');msgEl.style.color='#c0392b';msgEl.style.display='block';}
    }
  } catch(e) {
    if(msgEl){msgEl.textContent='Could not validate coupon. Please try again.';msgEl.style.color='#c0392b';msgEl.style.display='block';}
  }
}
function submitSimpleCheckout() {
  var name    = document.getElementById('scName').value.trim();
  var phone   = document.getElementById('scPhone').value.trim();
  var email   = document.getElementById('scEmail').value.trim();
  var house   = document.getElementById('scHouse')   ? document.getElementById('scHouse').value.trim()   : '';
  var area    = document.getElementById('scArea')    ? document.getElementById('scArea').value.trim()    : '';
  var city    = document.getElementById('scCity')    ? document.getElementById('scCity').value.trim()    : '';
  var pincode = document.getElementById('scPincode') ? document.getElementById('scPincode').value.trim() : '';
  var state   = document.getElementById('scState')   ? document.getElementById('scState').value.trim()   : '';
  var address = [house, area, city, state, pincode].filter(Boolean).join(', ');
  var errEl   = document.getElementById('scError');

  if (!name) { errEl.textContent = 'Please enter your name.'; errEl.style.display = 'block'; return; }
  if (!/^[6-9]\d{9}$/.test(phone)) { errEl.textContent = 'Please enter a valid 10-digit Indian mobile number.'; errEl.style.display = 'block'; return; }
  if (email && !/^[^@]+@[^@]+\.[^@]+$/.test(email)) { errEl.textContent = 'Please enter a valid email address.'; errEl.style.display = 'block'; return; }
  if (!city)  { errEl.textContent = 'Please enter your city.'; errEl.style.display = 'block'; return; }
  if (!state) { errEl.textContent = 'Please select your state.'; errEl.style.display = 'block'; return; }
  if (!pincode || !/^\d{6}$/.test(pincode)) { errEl.textContent = 'Please enter a valid 6-digit pincode.'; errEl.style.display = 'block'; return; }

  errEl.style.display = 'none';
  closeSimpleCheckout();
  var modal = document.getElementById('simpleCheckoutModal');
  if (modal && modal._callback) {
    modal._callback({ name:name, phone:'91'+phone, email:email, address:address, shipping:window._checkoutShipping||0, distKm:window._checkoutDistKm||0, shippingLabel:window._checkoutShipLabel||'Free Delivery' });
  }
}

async function buyNow() {
  if (!_modalProduct) return;
  openSimpleCheckout(async function(customer) {
    await _processBuyNow(customer);
  });
}


// ── Log all payment outcomes to DB ───────────────────────────────
async function logPaymentAttempt(data) {
  const base = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5000' : '';
  fetch(base + '/api/orders/attempt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).catch(() => {});
}

async function _processBuyNow(customer) {
  if (!_modalProduct) return;
  const product = _modalProduct;
  const amount  = (product.price * 100) + ((window._checkoutShipping || 0) * 100); // paise incl. shipping
  const apiBase = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5000' : '';

  try {
    // 1. Create Razorpay order on server
    const res = await fetch(`${apiBase}/api/razorpay/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount,
        currency: 'INR',
        receipt: `receipt_${product.productId}_${Date.now()}`
      })
    });
    const order = await res.json();
    if (!order.id) { alert('Could not initiate payment. Please try again.'); return; }

    // 2. Open Razorpay checkout
    const options = {
      key:         window.__RAZORPAY_KEY || '',
      amount:      order.amount,
      currency:    order.currency,
      name:        'SissyTrends',
      description: product.name + ' | ' + customer.name,
      image:       product.img ? (apiBase + product.img) : '',
      order_id:    order.id,
      handler: async function(response) {
        // 3. Verify payment on server
        const verify = await fetch(`${apiBase}/api/razorpay/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            razorpay_order_id:   response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature:  response.razorpay_signature,
            amount:              order.amount,
            product_id:          product.id,
            product_name:        product.name,
            customer_name:       customer.name    || response.name    || '',
            customer_email:      customer.email   || response.email   || '',
            customer_phone:      customer.phone   || response.contact || '',
            customer_address:    customer.address || ''
          })
        });
        const result = await verify.json();
        if (result.ok) {
          // If coupon was applied, increment the used counter
          if (window._couponApplied) {
            fetch(apiBase+'/api/coupon/use', {method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).catch(function(){});
            window._couponApplied = false;
          }
          closeModal();
          showOrderComplete({
            order_id:       response.razorpay_order_id,
            payment_id:     response.razorpay_payment_id,
            product_name:   product.name,
            amount:         order.amount,
            customer_name:  customer.name,
            customer_phone: customer.phone
          });
        } else {
          alert('Payment verification failed. Please contact us on WhatsApp.');
        }
      },
      prefill: { name: customer.name, email: customer.email, contact: customer.phone },
      method: { upi: true, card: true, netbanking: true, wallet: true },
      theme:   { color: '#c9a24e' },
    };

    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', function(resp) {
      var reason = (resp.error?.reason || '').toLowerCase();
      var desc   = (resp.error?.description || '').toLowerCase();
      // User cancelled/closed the payment window — not a real failure, stay silent
      var isCancelled = reason.includes('cancel') || desc.includes('cancel')
        || reason.includes('close') || desc.includes('close')
        || reason === 'payment_cancelled';
      logPaymentAttempt({
        order_id:      order.id,
        payment_id:    resp.error?.metadata?.payment_id || '',
        status:        isCancelled ? 'dismissed' : 'failed',
        error_reason:  resp.error?.reason || '',
        error_desc:    resp.error?.description || '',
        amount:        order.amount,
        product_id:    product.id,
        product_name:  product.name,
        customer_name: customer.name,
        customer_email:customer.email,
        customer_phone:customer.phone
      });
      if (!isCancelled) {
        alert('Payment failed: ' + (resp.error?.description || 'Please try again or enquire on WhatsApp.'));
      }
    });
    options.modal = {
      ondismiss: function() {
        logPaymentAttempt({
          order_id:      order.id,
          payment_id:    '',
          status:        'dismissed',
          error_reason:  'Customer closed payment window',
          error_desc:    '',
          amount:        order.amount,
          product_id:    product.id,
          product_name:  product.name,
          customer_name: customer.name,
          customer_email:customer.email,
          customer_phone:customer.phone
        });
      }
    };
    rzp.open();

  } catch(e) {
    alert('Payment service unavailable. Please enquire on WhatsApp.');
    console.error(e);
  }
}

// ── Location capture ────────────────────────────────────────────
async function getCustomerLocation() {
  if (localStorage.getItem('st_loc_denied') === '1') return '';
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(''); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude: lat, longitude: lon } = pos.coords;
          const base = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:5000' : '';
          const r = await fetch(`${base}/api/geocode?lat=${lat}&lon=${lon}`);
          const d = await r.json();
          resolve(d.location || '');
        } catch { resolve(''); }
      },
      (err) => {
        if (err.code === 1) localStorage.setItem('st_loc_denied', '1');
        resolve('');
      },
      { timeout: 5000 }
    );
  });
}

async function enquireOnWhatsApp() {
  if (!_modalProduct) return;
  const p    = _modalProduct;
  const base = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:5000' : '';
  // Get location (non-blocking — submits even if denied)
  const location = await getCustomerLocation();
  // Save to DB
  fetch(base + '/api/inquiries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      product_id: p.id, product_name: p.name,
      category: p.category, price: p.price,
      type: 'product', location: location
    })
  }).catch(() => {});
  // Open WhatsApp
  const text = encodeURIComponent(`Hi SissyTrends! I'm interested in this piece.\n\nProduct: ${p.name}\nID: ${p.productId||'—'}\nPrice: \u20b9${p.price.toLocaleString()}${location ? '\nLocation: '+location : ''}`);
  window.open(`${BRAND.whatsapp}?text=${text}`, '_blank');
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(true); });

/* ── Page loader ── */
window.addEventListener('load', () => {
  const loader = document.getElementById('pageLoader');
  if (loader) setTimeout(() => loader.classList.add('hidden'), 1200);
});

// ── Product Search Overlay ───────────────────────────────────────────
function openSearchOverlay() {
  let ov = document.getElementById('searchOverlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'searchOverlay';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(26,10,6,.93);z-index:99999;display:flex;flex-direction:column;align-items:center;padding:80px 20px 40px;backdrop-filter:blur(4px)';
    ov.innerHTML = `
      <button onclick="closeSearchOverlay()" style="position:absolute;top:20px;right:24px;background:none;border:none;color:rgba(250,245,236,.5);font-size:28px;cursor:pointer">&times;</button>
      <div style="width:100%;max-width:600px">
        <div style="font-family:'Cinzel',serif;font-size:9px;letter-spacing:.3em;color:#c9a24e;text-align:center;margin-bottom:16px">SEARCH PRODUCTS</div>
        <div style="position:relative">
          <input id="searchInput" type="text" placeholder="Search sarees, jewellery, decor..."
            style="width:100%;padding:16px 48px 16px 20px;background:rgba(250,245,236,.06);border:1px solid rgba(201,162,78,.3);color:#faf5ec;font-family:'Jost',sans-serif;font-size:14px;outline:none;box-sizing:border-box"
            oninput="runSearch(this.value)" onkeydown="if(event.key==='Escape')closeSearchOverlay()"/>
          <svg style="position:absolute;right:16px;top:50%;transform:translateY(-50%);opacity:.4" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#faf5ec" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </div>
        <div id="searchResults" style="margin-top:16px;max-height:60vh;overflow-y:auto"></div>
      </div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', function(e){ if(e.target===ov) closeSearchOverlay(); });
  }
  ov.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  setTimeout(function(){ var el=document.getElementById('searchInput'); if(el) el.focus(); }, 100);
}

function closeSearchOverlay() {
  var ov = document.getElementById('searchOverlay');
  if (ov) ov.style.display = 'none';
  document.body.style.overflow = '';
}

function runSearch(query) {
  var resultsEl = document.getElementById('searchResults');
  if (!resultsEl) return;
  query = query.trim().toLowerCase();
  if (!query) { resultsEl.innerHTML = ''; return; }
  var products = getProducts();
  var matches  = products.filter(function(p) {
    return (p.name||'').toLowerCase().includes(query) ||
           (p.category||'').toLowerCase().includes(query) ||
           (p.subcategory||'').toLowerCase().includes(query) ||
           (p.desc||'').toLowerCase().includes(query) ||
           (p.productId||'').toLowerCase().includes(query);
  }).slice(0, 12);
  if (!matches.length) {
    resultsEl.innerHTML = '<div style="text-align:center;color:rgba(250,245,236,.3);font-family:\'Cormorant Garamond\',serif;font-style:italic;padding:30px">No products found</div>';
    return;
  }
  resultsEl.innerHTML = matches.map(function(p) {
    return '<div onclick="closeSearchOverlay();openModal('+p.id+')"'
      +' style="display:flex;gap:14px;padding:12px;cursor:pointer;border-bottom:1px solid rgba(201,162,78,.1)"'
      +' onmouseover="this.style.background=\'rgba(201,162,78,.06)\'" onmouseout="this.style.background=\'\'" >'
      +'<img src="'+(p.img||'')+'" style="width:52px;height:64px;object-fit:cover;flex-shrink:0;background:rgba(201,162,78,.1)"'
      +' onerror="this.style.background=\'linear-gradient(135deg,#2D2520,#8B7355)\'"/>'
      +'<div style="flex:1;min-width:0">'
      +'<div style="font-family:\'Cormorant Garamond\',serif;font-size:1rem;color:#faf5ec;margin-bottom:3px">'+p.name+'</div>'
      +'<div style="font-family:\'Jost\',sans-serif;font-size:10px;color:rgba(201,162,78,.6);letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px">'+(p.category||'')+(p.subcategory?' · '+p.subcategory:'')+'</div>'
      +'<div style="font-family:\'Cormorant Garamond\',serif;font-size:1rem;color:#c9a24e">&#8377;'+(p.price||0).toLocaleString()+'</div>'
      +'</div>'
      +(p.badge?'<span style="align-self:flex-start;font-family:\'Jost\',sans-serif;font-size:9px;letter-spacing:.1em;padding:2px 8px;background:rgba(201,162,78,.15);color:#c9a24e;text-transform:uppercase">'+p.badge+'</span>':'')
      +'</div>';
  }).join('');
}

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
  updateCartBadge();

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

const SUBCAT_ICONS = {
  'soft-silk':'🦵','Soft Silk':'🦵',
  'Maheswari Silk Cotton':'🪡','Silk Cotton':'🪡',
  'Bamboo Silk cotton':'🎋','Bamboo Silk Cotton':'🎋',
  'Fancy Silk':'✨','Chettinad Cotton':'🌿',
  'Mul-mul cotton':'🌿','Pochampally Ikat':'🧣',
  'Cool Cotton':'🌹','cotton-linen':'🌿',
  'Cotton & Linen':'🌿','necklace-sets':'💎',
  'Necklace Sets':'💎','earrings':'✨','Earrings':'✨',
  'full-sets':'👑','Full Sets':'👑',
  'bridal':'🌸','Bridal Collection':'🌸',
  'diyas':'🪔','Diyas & Lamps':'🪔',
  'gifting':'🎁','Gifting':'🎁',
};
const SUBCATEGORIES = {
  sarees: [
    { key:'soft-silk',             label:'Soft Silk',             icon:'🦵' },
    { key:'Maheswari Silk Cotton', label:'Maheswari Silk Cotton', icon:'🪡' },
    { key:'Fancy Silk',            label:'Fancy Silk',            icon:'✨' },
    { key:'Chettinad Cotton',      label:'Chettinad Cotton',      icon:'🌿' },
    { key:'Mul-mul cotton',        label:'Mul-Mul Cotton',        icon:'🌿' },
    { key:'Bamboo Silk cotton',    label:'Bamboo Silk Cotton',    icon:'🎋' },
    { key:'Silk Cotton',           label:'Silk Cotton',           icon:'🪡' },
    { key:'Pochampally Ikat',      label:'Pochampally Ikat',      icon:'🧣' },
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
const _subcatCache = {};
async function getSubcategoriesAsync(cat) {
  if (_subcatCache[cat]) return _subcatCache[cat];
  try {
    const base = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:5000' : '';
    const r = await fetch(`${base}/api/subcategories?category=${cat}`);
    if (!r.ok) throw new Error('API error');
    const keys = await r.json();
    const result = keys.map(key => ({ key, label:key, icon: SUBCAT_ICONS[key] || '💠' }));
    _subcatCache[cat] = result;
    return result;
  } catch { return SUBCATEGORIES[cat] || []; }
}
function getSubcategories(cat) { return SUBCATEGORIES[cat] || []; }

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
            onclick="event.stopPropagation();_modalProduct=_productCache[${product.id}]||getProducts().find(p=>p.id===${product.id});enquireOnWhatsApp()">
            <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.122.554 4.112 1.528 5.84L.057 23.5l5.797-1.499A11.938 11.938 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.854 0-3.6-.497-5.11-1.367l-.366-.218-3.44.889.921-3.32-.239-.384A9.955 9.955 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
            WhatsApp
          </button>
        </div>
      </div>
    </div>`;
}

/* ── Contact form ── */
async function sendViaWhatsApp() {
  const name  = document.getElementById('cName')?.value.trim() || '';
  const phone = document.getElementById('cPhone')?.value.trim() || '';
  const msg   = document.getElementById('cMsg')?.value.trim() || '';
  const occ   = document.getElementById('cOccasion')?.value || '';
  if (!name) { alert('Please enter your name.'); return; }
  if (!phone) { alert('Please enter your WhatsApp number.'); return; }
  const text = encodeURIComponent(`🌺 Hello SissyTrends Boutique!\n\nName: ${name}\nPhone: ${phone}${occ?'\nOccasion: '+occ:''}${msg?'\nMessage: '+msg:''}`);
  window.open(`${BRAND.whatsapp}?text=${text}`, '_blank');
}

/* ════════════════════════════════════════════════════
   NAV INJECTION
   ════════════════════════════════════════════════════ */
function injectNav(activePage, isRoot) {
  const b = isRoot ? '' : '../';

  function megaCol(catKey, catLabel, catIcon, catHref, subs) {
    subs = subs || SUBCATEGORIES[catKey] || [];
    return `<div class="mega-col">
      <div class="mega-col-head"><a href="${catHref}">${catIcon} ${catLabel}</a></div>
      <div id="mega-subs-${catKey}">
        ${subs.map(s=>`<a class="mega-sub-link" href="${b}pages/categories.html?cat=${catKey}&sub=${encodeURIComponent(s.key)}"><span class="sub-icon">${s.icon}</span>${s.label}</a>`).join('')}
      </div>
    </div>`;
  }
  function mobAccordion(catKey, catLabel, catIcon, catHref, subs) {
    subs = subs || SUBCATEGORIES[catKey] || [];
    return `<div class="mob-acc-item">
      <button class="mob-acc-toggle">${catIcon} ${catLabel}<span class="mob-acc-arrow">▾</span></button>
      <div class="mob-acc-body" id="mob-subs-${catKey}">
        <a href="${catHref}" data-close>View All ${catLabel}</a>
        ${subs.map(s=>`<a href="${b}pages/categories.html?cat=${catKey}&sub=${encodeURIComponent(s.key)}" data-close>${s.icon} ${s.label}</a>`).join('')}
      </div>
    </div>`;
  }
  (async () => {
    for (const cat of ['sarees','jewellery','decor']) {
      const subs = await getSubcategoriesAsync(cat);
      if (!subs.length) continue;
      const megaEl = document.getElementById(`mega-subs-${cat}`);
      if (megaEl) megaEl.innerHTML = subs.map(s =>
        `<a class="mega-sub-link" href="${b}pages/categories.html?cat=${cat}&sub=${encodeURIComponent(s.key)}"><span class="sub-icon">${s.icon}</span>${s.label}</a>`
      ).join('');
      const mobEl = document.getElementById(`mob-subs-${cat}`);
      if (mobEl) {
        const first = mobEl.querySelector('a')?.outerHTML || '';
        mobEl.innerHTML = first + subs.map(s =>
          `<a href="${b}pages/categories.html?cat=${cat}&sub=${encodeURIComponent(s.key)}" data-close>${s.icon} ${s.label}</a>`
        ).join('');
      }
    }
  })();

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
          <div style="display:flex;gap:8px">
            <button style="flex:1;padding:12px;border:none;cursor:pointer;background:#c9a24e;color:#1a0a06;font-family:'Jost',sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;font-weight:600" onclick="addToCart(_modalProduct)">+ Add to Cart</button>
            <button style="flex:1;padding:12px;border:none;cursor:pointer;background:#7a1f2e;color:#faf5ec;font-family:'Jost',sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;font-weight:600" onclick="buyNow()">Buy Now</button>
          </div>
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
        <button class="nav-icon-btn" title="Search Products" onclick="openSearchOverlay()" style="position:relative">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </button>
        <button class="nav-icon-btn" title="My Cart" onclick="openCartDrawer()" style="position:relative">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          <span class="nav-badge" id="cartBadge" style="display:none">0</span>
        </button>
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

// ── Modal image swipe / nav ──────────────────────────────────────
let _swipeX0 = null;
function _swipeStart(e) {
  _swipeX0 = e.touches ? e.touches[0].clientX : e.clientX;
  const up = ev => {
    if (_swipeX0 === null) return;
    const x1 = ev.changedTouches ? ev.changedTouches[0].clientX : ev.clientX;
    if (Math.abs(x1 - _swipeX0) > 40) _modalNav(x1 < _swipeX0 ? 1 : -1);
    _swipeX0 = null;
  };
  document.addEventListener(e.touches ? 'touchend' : 'mouseup', up, {once:true});
}
function _modalNav(dir) {
  if (!_modalProduct) return;
  const imgs = [_modalProduct.img,_modalProduct.img2,_modalProduct.img3,_modalProduct.img4].filter(Boolean);
  if (imgs.length < 2) return;
  _modalImgIndex = (_modalImgIndex + dir + imgs.length) % imgs.length;
  const el = document.getElementById('modalImgEl');
  if (el) {
    el.style.opacity = '0';
    el.style.transition = 'opacity .18s';
    setTimeout(() => { el.src = imgs[_modalImgIndex]; el.style.opacity = '1'; }, 160);
  }
  _updateModalDots(imgs.length);
}
function _updateModalDots(total) {
  const dots = document.getElementById('modalDots');
  if (!dots) return;
  if (total < 2) { dots.style.display = 'none'; return; }
  dots.style.display = 'flex';
  dots.innerHTML = Array.from({length: total}, (_, i) =>
    `<div onclick="_modalNav(${i - _modalImgIndex})" style="width:7px;height:7px;border-radius:50%;cursor:pointer;background:${i === _modalImgIndex ? '#fff' : 'rgba(255,255,255,.35)'};transition:background .2s;margin:0 2px"></div>`
  ).join('');
}
