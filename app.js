const $ = selector => document.querySelector(selector);
const catalog = window.CATALOG;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number = value => String(value).padStart(2, '0');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let bag = []; try { bag = JSON.parse(localStorage.getItem('iad-bag') || '[]'); if (!Array.isArray(bag)) bag = []; } catch {}
const selections = new Map();
let season = 'summer', index = 0, photo = 0, view = 'home', switching = false, transitionRun = 0, toastTimer, pendingBuy = false;
let wheelTotal = 0, wheelLast = 0, wheelLocked = false;
const current = () => catalog[season][index];
const selection = () => {
  const key = season + '/' + current().id;
  if (!selections.has(key)) selections.set(key, {color:'', size:''});
  return selections.get(key);
};
const productRoute = (detail = false) => `#${season}/${encodeURIComponent(current().id)}${detail ? '/detail' : ''}`;
function notify(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 2500);
}
function priceMarkup(p) {
  const sale = p.salePrice || p.sale;
  return `<div class="price"><span>${esc(sale ? `NT$ ${sale}` : p.price || '價格待補')}</span>${sale && p.price ? `<del>NT$ ${esc(p.price)}</del>` : ''}</div>`;
}
function sizesMarkup(p, showInfo = false) {
  return `<div class="option"><div class="option-label">SIZE ${showInfo ? '<button class="size-link" data-size-info>SIZE INFO ↗</button>' : ''}</div><div class="option-buttons">${p.sizes.map(s => `<button class="choice ${selection().size === s ? 'selected' : ''}" data-size="${esc(s)}" aria-pressed="${selection().size === s}">${esc(s)}</button>`).join('') || '<span class="desc">尺寸資訊待補</span>'}</div></div>`;
}
function colorsMarkup(p) {
  return `<div class="option"><div class="option-label">COLOR <span id="color-name">${esc(selection().color || '請選擇')}</span></div><div class="option-buttons">${p.colors.map(c => `<button class="choice ${selection().color === c ? 'selected' : ''}" data-color="${esc(c)}" aria-pressed="${selection().color === c}">${esc(c)}</button>`).join('') || '<span class="desc">顏色資訊待補</span>'}</div></div>`;
}
const purchaseMarkup = () => '<div class="purchase"><button data-add>ADD TO CART</button><button class="primary" data-buy>BUY NOW / 立即購買</button></div>';
function renderBrowser(p) {
  $('#product').innerHTML = `<article class="product-browser" aria-label="商品瀏覽，左右滑動切換商品">
    <button class="product-visual ${p.cutoutImage ? 'has-cutout' : ''}" data-detail aria-label="查看 ${esc(p.name)} 詳情"><img src="${esc(p.cutoutImage || p.images[0])}" alt="${esc(p.name)}" draggable="false"></button>
    <div class="browser-info"><h1>${esc(p.name)}</h1>${priceMarkup(p)}${colorsMarkup(p)}${sizesMarkup(p)}</div>
    <div class="browse-controls"><button data-step="-1" aria-label="上一件商品" ${catalog[season].length < 2 ? 'disabled' : ''}>←</button><button class="detail-link" data-detail>INFO</button><button data-step="1" aria-label="下一件商品" ${catalog[season].length < 2 ? 'disabled' : ''}>→</button></div>
    ${purchaseMarkup()}
  </article>`;
  bindGesture($('.product-browser'), delta => step(delta));
  bindWheel($('.product-browser'), delta => step(delta));
}
function renderDetail(p) {
  const facts = [['材質', p.material], ['磅數', p.weight], ['版型', p.fit], ['尺寸表', p.sizeInfo || '詳細尺寸數據尚待補齊。'], ['試穿資訊', p.tryOn]].filter(([, value]) => value);
  $('#product').innerHTML = `<article class="product-detail" aria-label="單品詳情">
    <div class="gallery" aria-label="同一商品圖庫，左右滑動切換照片"><img id="product-image" src="${esc(p.images[photo])}" alt="${esc(p.name)} 商品圖 ${photo + 1}" draggable="false"><div class="gallery-controls"><button data-photo="-1" aria-label="上一張照片">←</button><span class="image-count">${number(photo + 1)} / ${number(p.images.length)}</span><button data-photo="1" aria-label="下一張照片">→</button></div></div>
    <div class="thumbnails" aria-label="選擇商品照片">${p.images.map((src, i) => `<button class="thumb" data-thumb="${i}" aria-label="商品照片 ${i + 1}" aria-pressed="${i === photo}"><img src="${esc(src)}" alt="" loading="lazy"></button>`).join('')}</div>
    <div class="details"><span class="item-kicker">${esc(p.id)}</span><h1>${esc(p.name)}</h1>${priceMarkup(p)}<p class="desc">${esc(p.description)}</p>${colorsMarkup(p)}${sizesMarkup(p, true)}<dl class="detail-facts">${facts.map(([label, value]) => `<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl></div>
    ${purchaseMarkup()}
  </article>`;
  bindGesture($('.gallery'), delta => changePhoto(delta));
  bindWheel($('.gallery'), delta => changePhoto(delta));
}
function render() {
  const p = current();
  $('#season-name').textContent = season.toUpperCase();
  $('#item-number').textContent = view === 'detail' ? 'DETAIL' : `${number(index + 1)} / ${number(catalog[season].length)}`;
  $('[data-back]').setAttribute('aria-label', view === 'detail' ? '返回商品瀏覽' : '返回季節首頁');
  $('#shop').setAttribute('aria-label', view === 'detail' ? '商品詳情' : '季節商品瀏覽');
  $('#product').dataset.view = view;
  document.body.dataset.season = season;
  const look = p.lookImages?.[0] || p.images[Math.min(1, p.images.length - 1)];
  $('#look').src = look;
  $('#look').hidden = false;
  if (view === 'detail') renderDetail(p); else renderBrowser(p);
  $('#product').scrollTop = 0;
}
function changePhoto(delta, target) {
  if (view !== 'detail') return;
  const p = current();
  photo = target ?? (photo + delta + p.images.length) % p.images.length;
  $('#product-image').src = p.images[photo];
  $('#product-image').alt = `${p.name} 商品圖 ${photo + 1}`;
  $('.image-count').textContent = `${number(photo + 1)} / ${number(p.images.length)}`;
  document.querySelectorAll('[data-thumb]').forEach(b => b.setAttribute('aria-pressed', +b.dataset.thumb === photo));
  if (!reducedMotion.matches) $('#product-image').animate([{opacity:.4, transform:`translateX(${delta * 12}px)`},{opacity:1, transform:'translateX(0)'}], {duration:180, easing:'ease-out'});
}
async function step(delta) {
  if (view !== 'browse' || switching || catalog[season].length < 2) return;
  switching = true;
  const run = ++transitionRun;
  const old = $('.product-browser');
  if (!reducedMotion.matches) await old.animate([{opacity:1, transform:'translateX(0) scale(1)'},{opacity:0, transform:`translateX(${-delta * 32}px) scale(.985)`}], {duration:120, easing:'ease-in', fill:'forwards'}).finished.catch(() => {});
  if (run !== transitionRun) return;
  index = (index + delta + catalog[season].length) % catalog[season].length;
  photo = 0;
  history.replaceState(history.state, '', productRoute());
  render();
  if (!reducedMotion.matches) await $('.product-browser').animate([{opacity:0, transform:`translateX(${delta * 32}px) scale(.985)`},{opacity:1, transform:'translateX(0) scale(1)'}], {duration:200, easing:'cubic-bezier(.2,.7,.2,1)'}).finished.catch(() => {});
  if (run === transitionRun) switching = false;
}
// Only the active layer owns horizontal gestures. Vertical touch scrolling remains native.
function bindGesture(el, callback) {
  let start = null, dragged = false, suppressClickUntil = 0;
  const reset = () => { start = null; el.classList.remove('dragging'); el.style.removeProperty('--drag'); };
  el.addEventListener('pointerdown', e => {
    const control = e.target.closest('button');
    if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0) || (control && !control.classList.contains('product-visual'))) return;
    start = {x:e.clientX, y:e.clientY}; dragged = false;
  });
  el.addEventListener('pointermove', e => {
    if (!start) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (!dragged && Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { reset(); return; }
    if (Math.abs(dx) > 9 && Math.abs(dx) > Math.abs(dy) * 1.25) {
      dragged = true;
      el.setPointerCapture(e.pointerId);
      el.classList.add('dragging');
      el.style.setProperty('--drag', `${Math.max(-40, Math.min(40, dx * .16))}px`);
    }
  });
  el.addEventListener('pointerup', e => {
    if (!start) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (dragged) suppressClickUntil = Date.now() + 400;
    reset();
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) callback(dx < 0 ? 1 : -1);
  });
  el.addEventListener('pointercancel', reset);
  el.addEventListener('lostpointercapture', reset);
  el.addEventListener('click', e => { if (Date.now() < suppressClickUntil) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
}
function bindWheel(el, callback) {
  el.addEventListener('wheel', e => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || e.ctrlKey) return;
    e.preventDefault();
    const now = performance.now();
    if (now - wheelLast > 180) { wheelTotal = 0; wheelLocked = false; }
    wheelLast = now;
    if (wheelLocked) return;
    wheelTotal += e.deltaX * (e.deltaMode === 1 ? 16 : 1);
    if (Math.abs(wheelTotal) > 65) { wheelLocked = true; callback(wheelTotal > 0 ? 1 : -1); }
  }, {passive:false});
}
function applyRoute() {
  transitionRun++; switching = false;
  $('#opening').classList.remove('leaving');
  const parts = location.hash.slice(1).split('/');
  if (!catalog[parts[0]]?.length) {
    view = 'home'; $('#shop').hidden = true; $('#opening').hidden = false; $('#look').hidden = true;
    delete document.body.dataset.season;
    document.querySelectorAll('video').forEach(v => v.play().catch(() => {}));
    return;
  }
  season = parts[0];
  let id = ''; try { id = decodeURIComponent(parts[1] || ''); } catch { /* invalid route falls back to featured item */ }
  index = Math.max(0, catalog[season].findIndex(p => p.id === id));
  view = 'browse'; photo = 0;
  $('#opening').hidden = true; $('#shop').hidden = false;
  document.querySelectorAll('video').forEach(v => v.pause());
  render();
}
function go(hash, parent, replace = false) {
  if ($('#modal').open) $('#modal').close();
  $('#toast').classList.remove('show');
  history[replace ? 'replaceState' : 'pushState']({iad:true, parent}, '', location.pathname + location.search + hash);
  applyRoute();
  (view === 'home' ? $('.season') : $('[data-back]')).focus({preventScroll:true});
}
async function enter(next) {
  if (switching || !catalog[next]?.length) return;
  switching = true;
  $('#opening').classList.add('leaving');
  const run = ++transitionRun;
  if (!reducedMotion.matches) await new Promise(resolve => setTimeout(resolve, 280));
  if (run !== transitionRun) return;
  season = next; index = 0;
  go(productRoute(), '');
}
function detail() {
 const p=current();
 const facts=[['商品描述',p.description],['材質',p.material],['版型',p.fit],['尺寸表',p.sizeInfo],['試穿資訊',p.tryOn],['出貨資訊',p.shipping]].filter(([,v])=>v);
 openModal('<h2 id="modal-title">'+esc(p.name)+'</h2><dl class="detail-facts">'+facts.map(([k,v])=>'<div><dt>'+esc(k)+'</dt><dd>'+esc(v)+'</dd></div>').join('')+'</dl>');
}
function overview(){openModal('<h2 id="modal-title">'+season.toUpperCase()+'</h2><div class="overview">'+catalog[season].map((p,i)=>'<button data-jump="'+i+'"><img src="'+esc(p.cutoutImage||p.images[0])+'" alt="'+esc(p.name)+'"><span>'+number(i+1)+' / '+esc(p.name)+'</span></button>').join('')+'</div>');}
function back() {
  const destination = view === 'detail' ? productRoute() : '';
  // In-page BACK has a deterministic parent even after refresh or a shared deep link.
  go(destination, '', true);
}
function openModal(content) { $('#modal-content').innerHTML = content; if (!$('#modal').open) $('#modal').showModal(); }
function updateBagCount() { try { localStorage.setItem('iad-bag', JSON.stringify(bag)); } catch {}  document.querySelectorAll('.bag-count').forEach(n => n.textContent = `(${bag.reduce((n,p) => n + p.qty,0)})`); }
function add(buy, confirmed = false) {
  const p = current(), chosen = selection();
  if (p.sizes.length && !chosen.size) { notify('請先選擇尺寸'); return; }
  if (p.colors.length && !chosen.color) {
    pendingBuy = buy;
    openModal(`<div class="modal-options"><h2 id="modal-title">Choose your color.</h2><p>${esc(p.name)} / ${esc(chosen.size)}</p>${colorsMarkup(p)}<button class="modal-action" data-confirm-add>確認選擇</button></div>`);
    return;
  }
  if (confirmed) $('#modal').close();
  const key = [season,p.id,chosen.color,chosen.size].join('|');
  const found = bag.find(p => p.key === key);
  if (found) found.qty++; else bag.push({key,name:p.name,color:chosen.color || '顏色待補',size:chosen.size || '尺寸待補',qty:1,price:p.salePrice || p.sale || p.price || '價格待補'});
  updateBagCount();
  if (buy) openModal(`<span class="item-kicker">CHECKOUT PREVIEW</span><h2 id="modal-title">Good choice.</h2><p>商品已放入購物袋。<br>此版本不會付款或建立正式訂單。</p><p>${esc(p.name)} / ${esc(chosen.color || '顏色待補')} / ${esc(chosen.size || '尺寸待補')}</p>`);
  else notify('ADDED TO BAG — 已加入購物袋');
}
function showBag() {
  openModal('<span class="item-kicker">YOUR SELECTION</span><h2 id="modal-title">Shopping bag.</h2>' + (bag.length ? bag.map((p,i) => `<div class="bag-row"><button data-remove="${i}">移除</button><strong>${esc(p.name)}</strong><br>${esc(p.color)} / ${esc(p.size)} × ${p.qty}<br>${esc(p.price)}</div>`).join('') : '<p>購物袋還是空的。<br>找到一件屬於你的日常。</p>') + '<p>第一階段購物袋，尚未開放付款或建立訂單。</p>');
}
document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  if (b.hasAttribute('data-season')) enter(b.dataset.season);
  if (b.hasAttribute('data-back')) back();
  if (b.hasAttribute('data-detail')) detail();
  if (b.hasAttribute('data-overview')) overview();
  if (b.hasAttribute('data-jump')) { index=Number(b.dataset.jump); go(productRoute(), ''); }
  if (b.hasAttribute('data-step')) step(+b.dataset.step);
  if (b.hasAttribute('data-photo')) changePhoto(+b.dataset.photo);
  if (b.hasAttribute('data-thumb')) changePhoto(0, +b.dataset.thumb);
  if (b.hasAttribute('data-color')) {
    selection().color = b.dataset.color;
    document.querySelectorAll('#color-name').forEach(el => el.textContent = selection().color);
    document.querySelectorAll('[data-color]').forEach(el => { const active = el.dataset.color === selection().color; el.classList.toggle('selected', active); el.setAttribute('aria-pressed', active); });
  }
  if (b.hasAttribute('data-size')) {
    selection().size = b.dataset.size;
    document.querySelectorAll('[data-size]').forEach(el => { const active = el.dataset.size === selection().size; el.classList.toggle('selected', active); el.setAttribute('aria-pressed', active); });
  }
  if (b.hasAttribute('data-size-info')) openModal(`<span class="item-kicker">FIT & MEASUREMENTS</span><h2 id="modal-title">Size info.</h2><p>${esc(current().name)}</p><p class="desc">${esc(current().sizeInfo || '詳細尺寸數據尚待補齊。')}</p>`);
  if (b.hasAttribute('data-add')) add(false);
  if (b.hasAttribute('data-buy')) add(true);
  if (b.hasAttribute('data-confirm-add')) add(pendingBuy, true);
  if (b.hasAttribute('data-bag')) showBag();
  if (b.hasAttribute('data-remove')) { bag.splice(+b.dataset.remove, 1); updateBagCount(); showBag(); }
});
document.addEventListener('keydown', e => {
  if (view === 'home' || $('#modal').open || e.altKey || e.metaKey || e.ctrlKey || e.target.matches('input,textarea,select')) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const delta = e.key === 'ArrowRight' ? 1 : -1; view === 'browse' ? step(delta) : changePhoto(delta); }
});
$('#modal').addEventListener('click', e => {
  if (e.target !== $('#modal')) return;
  const rect = e.target.getBoundingClientRect();
  if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) e.target.close();
});
window.addEventListener('popstate', () => { if ($('#modal').open) $('#modal').close(); applyRoute(); });
applyRoute();

updateBagCount();
