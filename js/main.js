

// ── Modal image swipe / nav ──────────────────────────────────────
let _swipeX0 = null;
function _swipeStart(e) {
  _swipeX0 = e.touches ? e.touches[0].clientX : e.clientX;
  const up = ev => {
    if (_swipeX0 === null) return;
    const x1 = ev.changedTouches ? ev.changedTouches[0].clientX : ev.clientX;
    if (Math.abs(x1 - _swipeX0) > 40) _modalNav(x1 < _swipeX0 ? 1 : -1);
    _swipeX0 = null;
    document.removeEventListener('mouseup', up);
    document.removeEventListener('touchend', up);
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
    el.style.transition = 'opacity .18s';
    el.style.opacity = '0';
    setTimeout(() => { el.src = imgs[_modalImgIndex]; el.style.opacity = '1'; }, 160);
  }
  _updateModalDots(imgs.length);
}
function _updateModalDots(total) {
  const dots = document.getElementById('modalDots');
  if (!dots) return;
  if (total < 2) { dots.style.display = 'none'; return; }
  dots.style.display = 'flex';
  dots.innerHTML = Array.from({length:total},(_,i) =>
    `<div onclick="_modalNav(${i-_modalImgIndex})" style="width:7px;height:7px;border-radius:50%;cursor:pointer;background:${i===_modalImgIndex?'#fff':'rgba(255,255,255,.35)'};transition:background .2s"></div>`
  ).join('');
}
