const $ = s => document.querySelector(s);
const catalog = window.CATALOG;
const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => `NT$${Number(n).toLocaleString('en-US')}`;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const choices = new Map(), photos = new Map();
let horizontalHintUsed=false, verticalHintUsed=false;
const count=n=>String(n).padStart(2,'0');
let season='summer', index=0, view='home', switching=false, run=0, toastTimer, purchaseIntent=null, gateMode='pending';
let bag=[];try{const saved=JSON.parse(localStorage.getItem('iad-bag')||'[]');if(Array.isArray(saved))bag=saved.filter(p=>p&&typeof p.name==='string'&&Number.isFinite(Number(p.price))&&Number.isInteger(p.qty)&&p.qty>0);}catch{}
const current=()=>catalog[season][index];
const key=()=>season+'/'+current().id;
const selection=()=>{if(!choices.has(key()))choices.set(key(),{color:current().colors.length===1?current().colors[0]:'',size:current().sizes.length===1?current().sizes[0]:''});return choices.get(key());};
const photoIndex=()=>photos.get(key())||0;
const productImage=p=>p.cutoutImage||p.images[0];
const galleryImages=p=>p.cutoutImage?[p.cutoutImage,...p.images.filter(src=>src!==p.cutoutImage)]:p.images;
const displayedImage=()=>galleryImages(current())[photoIndex()];
const route=()=>`#${season}/${encodeURIComponent(current().id)}`;
function notify(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),2300);}
function updateBag(){const n=bag.reduce((a,p)=>a+p.qty,0);document.querySelectorAll('.bag-count').forEach(e=>e.textContent=`(${n})`);try{localStorage.setItem('iad-bag',JSON.stringify(bag));}catch{}}

// Both videos stay concealed until the pair is playable. Fallback remains a pair of posters.
const videos=[...document.querySelectorAll('.season video')];
videos.forEach(v=>{v.muted=true;v.pause();});
function waitPlayable(video){return new Promise(resolve=>{
 let timer;const finish=ok=>{clearTimeout(timer);video.removeEventListener('canplay',ready);video.removeEventListener('error',failed);resolve(ok);};
 const ready=()=>finish(true),failed=()=>finish(false);
 if(video.readyState>=3){resolve(true);return;}if(video.error){resolve(false);return;}
 video.addEventListener('canplay',ready,{once:true});video.addEventListener('error',failed,{once:true});timer=setTimeout(()=>finish(false),9000);video.load();
});}
async function playPair(){videos.forEach(v=>{v.pause();try{v.currentTime=0;}catch{}});const results=await Promise.race([Promise.all(videos.map(v=>v.play().then(()=>true,()=>false))),new Promise(resolve=>setTimeout(()=>resolve([false,false]),1500))]);return results.every(Boolean);}
async function prepareGate(){
 const ready=await Promise.all(videos.map(waitPlayable));
 const playable=ready.every(Boolean)&&view==='home' ? await playPair() : ready.every(Boolean);
 gateMode=playable?'video':'poster';
 if(!playable)videos.forEach(v=>v.pause());
 $('#opening').classList.toggle('poster-mode',!playable);

 // Reveal the gate as one composited layer, never each season separately.
 await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 if(view==='home')$('#loading').hidden=true;
 $('#opening').classList.remove('gate-pending');$('#opening').removeAttribute('aria-hidden');$('#opening').inert=false;
}
async function showGate(){
 $('#shop').hidden=true;$('#opening').hidden=false;delete document.body.dataset.season;
 $('#loading').hidden=gateMode!=='pending';
 if(gateMode==='video'&&!await playPair()){gateMode='poster';videos.forEach(v=>v.pause());$('#opening').classList.add('poster-mode');}
}
function renderViewer(){
 const p=current();view='browse';$('#product').className='viewer-host';$('#shop').setAttribute('aria-label','商品瀏覽');
 $('#product').innerHTML=`<article class="product-browser" aria-label="${esc(p.name)}，左右切換商品，上下切換照片">
  <div class="product-visual ${p.cutoutImage&&photoIndex()===0?'has-cutout':''}" aria-label="商品主視覺"><img src="${esc(displayedImage())}" alt="${esc(p.name)} 商品照片 ${photoIndex()+1}" draggable="false" fetchpriority="high"></div>
  <button class="info-trigger" data-info aria-label="INFO"><span aria-hidden="true">ⓘ</span> INFO</button>
  ${galleryImages(p).length>1?`<div class="image-hints ${verticalHintUsed?'used':''}"><button data-photo="-1" aria-label="上一張商品照片">↑</button><button data-photo="1" aria-label="下一張商品照片">↓</button></div><span class="image-index" aria-label="圖片位置" aria-live="polite">${count(photoIndex()+1)} / ${count(galleryImages(p).length)}</span>`:''}
  <div class="product-arrows ${horizontalHintUsed?'used':''}"><button data-step="-1" aria-label="上一件商品" ${index===0?'hidden':''}>←</button><button data-step="1" aria-label="下一件商品" ${index===catalog[season].length-1?'hidden':''}>→</button></div>
  <div class="viewer-footer"><span class="viewer-price">${money(p.salePrice||p.price)}</span><div class="purchase"><button data-add><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 7h14l1 14H4L5 7Z M8 7V5a4 4 0 0 1 8 0v2"/></svg>ADD</button><button class="primary" data-buy>立即購買 <span>→</span></button></div></div>
 </article>`;
 bindGestures($('.product-visual'));bindWheel($('.product-visual'));
 fitProductImage();
 const next=catalog[season][index+1];if(next){const preload=new Image();preload.src=productImage(next);}
}
function fitProductImage(){const image=$('.product-visual img');const fit=()=>{if(!image.naturalWidth)return;const ratio=image.naturalWidth/image.naturalHeight,box=image.clientWidth/image.clientHeight;image.style.objectFit=Math.abs(ratio/box-1)<.005?'cover':'contain';};image.addEventListener('load',fit,{once:true});fit();}
function renderGrid(){view='grid';$('#product').className='grid-host';$('#shop').setAttribute('aria-label',season.toUpperCase()+' 商品牆');$('#product').innerHTML=`<div class="season-grid">${catalog[season].map((p,i)=>`<button class="grid-item" data-jump="${i}" aria-label="查看 ${esc(p.name)}"><div class="grid-cover"><img src="${esc(p.coverImage||p.images[0])}" alt="${esc(p.name)}" loading="lazy"></div><span class="grid-name">${esc(p.name)}</span><small>${money(p.salePrice||p.price)}</small></button>`).join('')}</div>`;}
function render(){document.body.dataset.season=season;$('#season-name').textContent=season.toUpperCase();const title=$('#season-name');title.replaceWith(Object.assign(document.createElement(view==='grid'?'span':'button'),{id:'season-name',textContent:season.toUpperCase()}));if(view!=='grid')$('#season-name').setAttribute('data-overview','');$('[data-back]').setAttribute('aria-label','返回季節首頁');view==='grid'?renderGrid():renderViewer();updateBag();}
function applyRoute(){run++;switching=false;purchaseIntent=null;if($('#modal').open)$('#modal').close();$('#toast').classList.remove('show');const parts=location.hash.slice(1).split('/');
 if(!catalog[parts[0]]?.length){view='home';showGate();return;}
 season=parts[0];let id='';try{id=decodeURIComponent(parts[1]||'');}catch{}
 index=Math.max(0,catalog[season].findIndex(p=>p.id===id));view=parts[2]==='grid'?'grid':'browse';
 $('#opening').hidden=true;$('#loading').hidden=true;$('#shop').hidden=false;videos.forEach(v=>v.pause());render();
}
function go(hash,replace=false){if($('#modal').open)$('#modal').close();history[replace?'replaceState':'pushState']({},'',location.pathname+location.search+hash);applyRoute();(view==='home'?$('.season'):$('[data-back]')).focus({preventScroll:true});}
async function step(delta,gesture=false){if(view!=='browse'||switching||$('#modal').open)return;if(gesture)horizontalHintUsed=true;const target=index+delta;if(target<0||target>=catalog[season].length)return;switching=true;const activeRun=++run;
 const el=$('.product-browser');if(!reduced.matches)await el.animate([{opacity:1,transform:'translateX(0)'},{opacity:0,transform:`translateX(${-delta*24}px) scale(.99)`}],{duration:130,fill:'forwards'}).finished.catch(()=>{});
 if(activeRun!==run)return;index=target;history.replaceState({},'',route());render();
 if(!reduced.matches)await $('.product-browser').animate([{opacity:0,transform:`translateX(${delta*24}px) scale(.99)`},{opacity:1,transform:'translateX(0)'}],{duration:230,easing:'ease-out'}).finished.catch(()=>{});if(activeRun===run)switching=false;
}
function changePhoto(delta,gesture=false){if(view!=='browse'||switching||$('#modal').open)return;if(gesture)verticalHintUsed=true;const p=current(),next=(photoIndex()+delta+galleryImages(p).length)%galleryImages(p).length;photos.set(key(),next);const hint=$('.image-hints');if(hint)hint.classList.toggle('used',verticalHintUsed);const position=$('.image-index');if(position)position.textContent=`${count(next+1)} / ${count(galleryImages(p).length)}`;const image=$('.product-visual img');image.src=displayedImage();image.alt=`${p.name} 商品照片 ${next+1}`;fitProductImage();$('.product-visual').classList.toggle('has-cutout',!!p.cutoutImage&&next===0);if(!reduced.matches)image.animate([{opacity:.35,transform:`translateY(${delta*14}px)`},{opacity:1,transform:'translateY(0)'}],{duration:220});}
function bindGestures(el){let start=null,axis=null,suppressUntil=0;const reset=()=>{start=null;axis=null;el.classList.remove('dragging');el.style.removeProperty('--drag-x');el.style.removeProperty('--drag-y');};
 el.addEventListener('pointerdown',e=>{if(!e.isPrimary||e.button!==0)return;start={x:e.clientX,y:e.clientY};axis=null;el.setPointerCapture(e.pointerId);});
 el.addEventListener('pointermove',e=>{if(!start)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;if(!axis){if(Math.max(Math.abs(dx),Math.abs(dy))<12)return;if(Math.abs(dx)>Math.abs(dy)*1.35)axis='x';else if(Math.abs(dy)>Math.abs(dx)*1.35)axis='y';else return;}el.classList.add('dragging');el.style.setProperty('--drag-'+axis,`${Math.max(-35,Math.min(35,(axis==='x'?dx:dy)*.16))}px`);});
 el.addEventListener('pointerup',e=>{if(!start)return;const dx=e.clientX-start.x,dy=e.clientY-start.y,locked=axis;reset();if(locked)suppressUntil=Date.now()+400;if(locked==='x'&&Math.abs(dx)>45)step(dx<0?1:-1,true);if(locked==='y'&&Math.abs(dy)>45)changePhoto(dy<0?1:-1,true);});
 el.addEventListener('pointercancel',reset);el.addEventListener('lostpointercapture',reset);el.addEventListener('click',e=>{if(Date.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation();}},true);
}
function bindWheel(el){let last=0,total=0,axis='',locked=false;el.addEventListener('wheel',e=>{if(e.ctrlKey)return;e.preventDefault();const now=performance.now();if(now-last>220){total=0;axis='';locked=false;}last=now;if(locked)return;const x=Math.abs(e.deltaX),y=Math.abs(e.deltaY);if(!axis){if(x>y*1.35)axis='x';else if(y>x*1.35)axis='y';else return;}total+=(axis==='x'?e.deltaX:e.deltaY)*(e.deltaMode===1?16:1);if(Math.abs(total)>65){locked=true;axis==='x'?step(total>0?1:-1,true):changePhoto(total>0?1:-1,true);}}, {passive:false});}

function placeModal(){const r=$('#screen').getBoundingClientRect();Object.assign($('#modal').style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});}
function openModal(content,mode='info'){const modal=$('#modal');modal.dataset.mode=mode;$('#modal-content').innerHTML=content;placeModal();if(!modal.open)modal.showModal();$('#modal-content').scrollTop=0;}
function optionsMarkup(requiredOnly=false){const p=current(),s=selection();return [['COLOR',p.colors,'color'],['SIZE',p.sizes,'size']].filter(([,items])=>requiredOnly?items.length>1:items.length).map(([label,items,field])=>`<section class="info-options"><h3>${label}</h3><div class="option-buttons">${items.map(value=>`<button class="choice ${s[field]===value?'selected':''}" data-${field}="${esc(value)}" aria-pressed="${s[field]===value}">${esc(value)}</button>`).join('')}</div></section>`).join('');}
function info(){purchaseIntent=null;const p=current();const facts=[['DESCRIPTION',p.description],['SIZE GUIDE',p.sizeGuide||p.sizeInfo],['FIT',p.fit],['FIT REPORT',p.fitReport||p.tryOn],['MATERIAL',p.material],['DELIVERY',p.delivery||p.shipping]].filter(([,v])=>v);
 openModal(`<div class="info-editorial"><h2 id="modal-title">${esc(p.name)}</h2><div class="info-price">${money(p.salePrice||p.price)} ${p.salePrice&&p.price?`<del>${money(p.price)}</del>`:''}</div>${optionsMarkup()}${facts.map(([label,text])=>`<section class="info-section"><h3>${label}</h3><p>${esc(text)}</p></section>`).join('')}</div>`);
}
function optionOverlay(intent){purchaseIntent=intent;const p=current();openModal(`<div class="info-editorial option-editorial"><h2 id="modal-title">${p.colors.length>1?'SELECT OPTION':'SELECT SIZE'}</h2><p class="option-product">${esc(p.name)} · ${money(p.salePrice||p.price)}</p>${optionsMarkup(true)}<button class="overlay-action" data-confirm>${intent==='buy'?'立即購買 →':'ADD TO BAG →'}</button><p class="selection-note" role="status"></p></div>`,'options');}
function select(field,value){selection()[field]=value;document.querySelectorAll(`[data-${field}]`).forEach(b=>{const active=b.dataset[field]===value;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',active);});}
function add(intent,confirmed=false){const p=current(),s=selection();if((p.colors.length&&!s.color)||(p.sizes.length&&!s.size)){if(confirmed){$('.selection-note').textContent='請先選擇顏色與尺寸';return;}optionOverlay(intent);return;}
 const itemKey=[season,p.id,s.color,s.size].join('|');const found=bag.find(p=>p.key===itemKey);if(found)found.qty++;else bag.push({key:itemKey,id:p.id,season,name:p.name,color:s.color,size:s.size,qty:1,price:Number(p.salePrice||p.price),image:productImage(p)});updateBag();purchaseIntent=null;if($('#modal').open)$('#modal').close();if(intent==='buy')showBag();else notify('ADDED TO BAG');}
function showBag(checkout=false){purchaseIntent=null;const total=bag.reduce((n,p)=>n+Number(p.price)*p.qty,0);openModal(`<div class="bag-content"><h2 id="modal-title">${checkout?'CHECKOUT':'BAG'}</h2>${checkout?'<p class="bag-note">購買預覽。此階段不會付款或建立正式訂單。</p>':''}${bag.length?bag.map((p,i)=>`<article class="bag-row">${p.image?`<img src="${esc(p.image)}" alt="${esc(p.name)}">`:''}<div><strong>${esc(p.name)}</strong><p>${esc(p.color)} / ${esc(p.size)}</p><span>${money(p.price)}</span><div class="quantity"><button data-qty="${i}" data-delta="-1" aria-label="減少 ${esc(p.name)} 數量" ${p.qty<=1?'disabled':''}>−</button><span>${p.qty}</span><button data-qty="${i}" data-delta="1" aria-label="增加 ${esc(p.name)} 數量">+</button><button data-remove="${i}" class="remove">REMOVE</button></div></div></article>`).join(''):'<p class="bag-note">購物袋還是空的。</p>'}<div class="bag-total"><span>TOTAL</span><span>${money(total)}</span></div><button class="overlay-action" data-checkout ${!bag.length?'disabled':''}>CHECKOUT →</button><p class="bag-note">尚未開放付款與正式訂單。</p></div>`,'bag');}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;
 if(b.hasAttribute('data-season')){season=b.dataset.season;index=0;go(route());}
 if(b.hasAttribute('data-back'))go('');
 if(b.hasAttribute('data-overview')&&view==='browse')go(route()+'/grid');
 if(b.hasAttribute('data-jump')){index=Number(b.dataset.jump);go(route(),true);}
 if(b.hasAttribute('data-step'))step(Number(b.dataset.step));
 if(b.hasAttribute('data-info'))info();
 if(b.hasAttribute('data-photo'))changePhoto(Number(b.dataset.photo));
 if(b.hasAttribute('data-color'))select('color',b.dataset.color);
 if(b.hasAttribute('data-size'))select('size',b.dataset.size);
 if(b.hasAttribute('data-add'))add('add');if(b.hasAttribute('data-buy'))add('buy');
 if(b.hasAttribute('data-confirm'))add(purchaseIntent||'add',true);
 if(b.hasAttribute('data-bag'))showBag();
 if(b.hasAttribute('data-remove')){bag.splice(Number(b.dataset.remove),1);updateBag();showBag();}
 if(b.hasAttribute('data-qty')){const item=bag[Number(b.dataset.qty)];item.qty=Math.max(1,item.qty+Number(b.dataset.delta));updateBag();showBag();}
 if(b.hasAttribute('data-checkout'))showBag(true);
});
document.addEventListener('keydown',e=>{if(view!=='browse'||$('#modal').open||e.altKey||e.ctrlKey||e.metaKey)return;if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();step(e.key==='ArrowRight'?1:-1);}if(['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();changePhoto(e.key==='ArrowDown'?1:-1);}});
$('#modal').addEventListener('close',()=>{purchaseIntent=null;});
window.addEventListener('resize',()=>{if($('#modal').open)placeModal();});
window.visualViewport?.addEventListener('resize',()=>{if($('#modal').open)placeModal();});
window.addEventListener('popstate',applyRoute);window.addEventListener('hashchange',applyRoute);
applyRoute();prepareGate();updateBag();
