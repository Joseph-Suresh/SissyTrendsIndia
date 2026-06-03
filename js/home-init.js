  // ── Inject shared nav & footer ──
  document.getElementById('navPlaceholder').outerHTML   = injectNav('Home', true);
  document.getElementById('footerPlaceholder').outerHTML = injectFooter(true);

  /* ── Re-observe reveals injected by nav/footer ── */
  function observeNew(root) {
    if (!root) return;
    root.querySelectorAll && root.querySelectorAll('.reveal:not(.visible)').forEach(r => {
      new IntersectionObserver(([e]) => { if (e.isIntersecting) e.target.classList.add('visible'); },
        { threshold: 0.08 }).observe(r);
    });
  }

  /* ════════════════════════════════════════════════════
     WISHLIST — toggle save/unsave, no duplicates
     Persisted in sessionStorage as a JSON array of IDs
  ════════════════════════════════════════════════════ */
  function getWishlistIds() {
    try { return JSON.parse(sessionStorage.getItem('st_wishlist_ids') || '[]'); } catch { return []; }
  }
  function setWishlistIds(ids) {
    sessionStorage.setItem('st_wishlist_ids', JSON.stringify(ids));
    sessionStorage.setItem('st_wishlist', ids.length);   // keep count in sync
    const badge = document.getElementById('wishlistBadge');
    if (badge) badge.textContent = ids.length;
  }
  function toggleWishlist(id, name, btn) {
    let ids = getWishlistIds();
    const strId = String(id);
    if (ids.includes(strId)) {
      /* Already saved → unsave */
      ids = ids.filter(i => i !== strId);
      setWishlistIds(ids);
      if (btn) { btn.textContent = '♡ Save'; btn.setAttribute('data-saved','0'); }
      showToast(`Removed "${name}" from wishlist`);
    } else {
      /* Not saved → save */
      ids.push(strId);
      setWishlistIds(ids);
      if (btn) { btn.textContent = '♥ Saved'; btn.setAttribute('data-saved','1'); }
      showToast(`❤ "${name}" added to wishlist`);
    }
  }
  /* Toggle for the top-right ♡ icon (no specific item) */
  function toggleWishlistIcon() {
    const badge = document.getElementById('wishlistBadge');
    const count = parseInt(badge?.textContent || '0');
    if (count === 0) showToast('Your wishlist is empty — save items to see them here');
    else showToast(`You have ${count} item${count>1?'s':''} in your wishlist`);
  }

  /* ── Restore badge on page load ── */
  (function restoreWishlistBadge() {
    const badge = document.getElementById('wishlistBadge');
    if (badge) badge.textContent = getWishlistIds().length;
  })();

  /* ════════════════════════════════════════════════════
     FEATURED SAREES — real product images
  ════════════════════════════════════════════════════ */
  const products  = getProducts();
  const sarees    = products.filter(p => p.category === 'sarees').slice(0, 5);
  const sgEl      = document.getElementById('featuredSareeGrid');
  if (sgEl) {
    sgEl.innerHTML = sarees.map((p, i) => {
      const delay  = i * 0.07;
      const isSaved= getWishlistIds().includes(String(p.id));
      return `
        <div class="saree-card reveal" style="transition-delay:${delay}s"
             onclick="openModal('${(p.fabric||'').replace(/'/g,"\\'")}','${p.name.replace(/'/g,"\\'")}','${(p.desc||'').replace(/'/g,"\\'")}','₹${p.price.toLocaleString()}','${p.img}')">
          <img class="saree-img" src="${p.img}" alt="${p.name}"
               onerror="this.style.display='none';this.parentElement.style.background='linear-gradient(135deg,#EAD9C4,#E8C5C0)';this.parentElement.style.aspectRatio='3/4'"/>
          <div class="saree-badge">${p.badge}</div>
          <div class="saree-overlay"></div>
          <div class="saree-info">
            <div class="saree-fabric">${p.fabric || p.subcategory}</div>
            <div class="saree-name">${p.name}</div>
            <div class="saree-price">₹${p.price.toLocaleString()}</div>
            <div class="saree-actions">
              <button class="saree-btn saree-btn-view"
                onclick="event.stopPropagation();openModal('${(p.fabric||'').replace(/'/g,"\\'")}','${p.name.replace(/'/g,"\\'")}','${(p.desc||'').replace(/'/g,"\\'")}','₹${p.price.toLocaleString()}','${p.img}')">
                Quick View
              </button>
              <button class="saree-btn saree-btn-wish"
                id="wish-saree-${p.id}"
                data-saved="${isSaved?1:0}"
                onclick="event.stopPropagation();toggleWishlist(${p.id},'${p.name.replace(/'/g,"\\'")}',this)">
                ${isSaved ? '♥ Saved' : '♡ Save'}
              </button>
            </div>
          </div>
        </div>`;
    }).join('');
    observeNew(sgEl);
  }

  /* ════════════════════════════════════════════════════
     JEWELLERY GRID — real product images from Images folder
  ════════════════════════════════════════════════════ */
  const jwls  = products.filter(p => p.category === 'jewellery').slice(0, 4);
  const jwlEl = document.getElementById('jwlGrid');
  if (jwlEl) {
    jwlEl.innerHTML = jwls.map((p, i) => {
      const isSaved = getWishlistIds().includes(String(p.id));
      return `
        <div class="jwl-card reveal" style="transition-delay:${i*0.09}s"
             onclick="openModal('${(p.type||p.subcategory||'').replace(/'/g,"\\'")}','${p.name.replace(/'/g,"\\'")}','${(p.desc||'').replace(/'/g,"\\'")}','₹${p.price.toLocaleString()}','${p.img}')">
          <div class="jwl-img-wrap">
            <img src="${p.img}" alt="${p.name}"
                 onerror="this.style.display='none';this.parentElement.style.background='linear-gradient(135deg,#2D2520,#8B7355)'"/>
            <div class="jwl-glow"></div>
          </div>
          <div class="jwl-info">
            <div class="jwl-type">${p.type || p.subcategory}</div>
            <div class="jwl-name">${p.name}</div>
            <div class="jwl-price">₹${p.price.toLocaleString()}</div>
            <div style="display:flex;gap:8px;margin-top:10px">
              <button class="saree-btn saree-btn-view" style="background:rgba(201,168,76,0.15);color:var(--gold-lt);font-size:9px;padding:7px 14px;border:none"
                onclick="event.stopPropagation();openModal('${(p.type||p.subcategory||'').replace(/'/g,"\\'")}','${p.name.replace(/'/g,"\\'")}','${(p.desc||'').replace(/'/g,"\\'")}','₹${p.price.toLocaleString()}','${p.img}')">
                Quick View
              </button>
              <button class="saree-btn saree-btn-wish" style="background:transparent;border:1px solid rgba(201,168,76,0.3);color:var(--gold-lt);font-size:9px;padding:7px 14px"
                id="wish-jwl-${p.id}"
                data-saved="${isSaved?1:0}"
                onclick="event.stopPropagation();toggleWishlist(${p.id},'${p.name.replace(/'/g,"\\'")}',this)">
                ${isSaved ? '♥ Saved' : '♡ Save'}
              </button>
            </div>
          </div>
        </div>`;
    }).join('');
    observeNew(jwlEl);
  }

  /* ════════════════════════════════════════════════════
     GALLERY — real local images only
  ════════════════════════════════════════════════════ */
  const galleryImgs = [
    'Images/Saree1.jpeg',
    'Images/Imitation jewels/Heartin on Saree.jpeg',
    'Images/saree2.jpeg',
    'Images/Imitation jewels/Pearl ear.jpeg',
    'Images/V Saree 1.jpeg',
    'Images/Imitation jewels/Squares.jpeg',
    'Images/V Saree 2.jpeg',
    'Images/Imitation jewels/WhatsApp Image 2026-03-04 at 19.29.31.jpeg',
    'Images/saree3.jpeg',
  ];
  const galleryEl = document.getElementById('galleryGrid');
  if (galleryEl) {
    galleryEl.innerHTML = galleryImgs.map((src, i) => `
      <div class="gallery-item" style="aspect-ratio:1">
        <img class="gallery-img" src="${src}" alt="SissyTrends Gallery ${i+1}"
             style="width:100%;height:100%;object-fit:cover;display:block"
             onerror="this.style.display='none';this.parentElement.style.background='linear-gradient(135deg,#EAD9C4,#6B1A2A44)'"/>
        <div class="gallery-overlay">♡</div>
      </div>`).join('');
  }

  /* ── Look thumb swap ── */
  function swapLook(thumb, src) {
    document.querySelectorAll('.look-thumb').forEach(t => t.classList.remove('active'));
    thumb.classList.add('active');
    const mainImg = document.querySelector('.look-main-img img');
    if (mainImg) mainImg.src = src;
  }

  /* ── Fabric chip select ── */
  function selectFabric(chip, name) {
    document.querySelectorAll('.fabric-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
  }

  /* ── "Save Look" button in styled-looks section ── */
  function toggleSaveLook(btn) {
    const lookId = 'bridal-dawn-look';
    let ids = getWishlistIds();
    if (ids.includes(lookId)) {
      ids = ids.filter(i => i !== lookId);
      setWishlistIds(ids);
      btn.textContent = 'Save Look ♡';
      showToast('Removed Bridal Dawn Look from wishlist');
    } else {
      ids.push(lookId);
      setWishlistIds(ids);
      btn.textContent = 'Saved ♥';
      showToast('❤ Bridal Dawn Look saved to wishlist');
    }
  }
