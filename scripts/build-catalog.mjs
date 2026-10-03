import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const groups={summer:'SUMMER商品',winter:'WINTER商品'};
export function normalizeOptions(value){
 const values=Array.isArray(value)?value:[String(value??'')];
 const result=[];
 for(const entry of values){
 const text=String(entry).trim();if(!text||/^NONE$/i.test(text))continue;
 if(/^ONE\s+SIZE$/i.test(text)){result.push('ONE SIZE');continue;}
 const tokens=text.split(/[\/／,，、;；|\n]+/).flatMap(part=>/^ONE\s+SIZE$/i.test(part.trim())?['ONE SIZE']:part.trim().split(/\s+/));
 result.push(...tokens.filter(v=>v&&!/^NONE$/i.test(v)));
 }
 return [...new Set(result)];
}
export function buildWinterCatalog(root=process.cwd()){
 const folder=groups.winter,group=path.join(root,folder);
 const dirs=fs.readdirSync(group,{withFileTypes:true}).filter(d=>d.isDirectory()&&/^0[1-5](?:\s|$)/.test(d.name)).sort((a,b)=>Number(a.name.match(/^\d+/)[0])-Number(b.name.match(/^\d+/)[0]));
 if(dirs.length!==5||dirs.some((d,i)=>Number(d.name.match(/^\d+/)[0])!==i+1))throw new Error('WINTER requires exactly folders 01 through 05');
 const saved=JSON.parse(fs.readFileSync(path.join(root,'catalog.js'),'utf8').replace(/^window\.CATALOG = /,'').replace(/;\s*$/,''));
 return dirs.map(d=>{
  if(d.name.startsWith('05 ')){const previous=saved.winter.find(p=>p.name==='WAFFLE KNIT');if(!previous)throw new Error('Missing preserved WAFFLE KNIT data');const remap=url=>url? './'+[folder,d.name,decodeURIComponent(url.split('/').at(-1))].map(encodeURIComponent).join('/'):null;return {...previous,sort:5,featured:false,images:previous.images.map(remap),coverImage:remap(previous.coverImage),cutoutImage:remap(previous.cutoutImage),source:[folder,d.name,'商品資訊.txt'].join('/')};}
  const base=path.join(group,d.name),raw=fs.readFileSync(path.join(base,'商品資訊.txt'),'utf8').replace(/\r/g,'');
  const line=k=>{const v=raw.split('\n').find(v=>v.startsWith(k)&&/^[：: \t$]/.test(v.slice(k.length)));return v?v.slice(k.length).replace(/^[：: \t]+/,'').trim():'';};
  const section=k=>{const lines=raw.split('\n'),start=lines.findIndex(v=>new RegExp('^'+k+'[：:]?$').test(v.trim()));if(start<0)return '';let end=start+1;while(end<lines.length&&!/^(商品名稱|顏色|售價|官網價|尺寸|試穿報告|簡介|商品描述|材質|版型|出貨資訊|備貨資訊|庫存)(?:[：:]|$|\s)/.test(lines[end].trim()))end++;return lines.slice(start+1,end).join('\n').trim();};
  const files=fs.readdirSync(base).filter(f=>/\.(jpg|jpeg|webp|png)$/i.test(f));
  if(!files.length||files.some(f=>!/^\d+[ ._-]/.test(f)))throw new Error('Missing numbered image order: '+d.name);
  files.sort((a,b)=>Number(a.match(/^\d+/)[0])-Number(b.match(/^\d+/)[0]));
  const numbers=files.map(f=>Number(f.match(/^\d+/)[0]));if(numbers[0]!==1||new Set(numbers).size!==numbers.length)throw new Error('Invalid or duplicate image number: '+d.name);
  const asset=f=>'./'+[folder,d.name,f].map(encodeURIComponent).join('/'),sort=Number(d.name.match(/^\d+/)[0]);
  const sizeGuide=section('尺寸'),fitReport=section('試穿報告');
  return {id:sort===4?'winter-2':'winter-0'+sort,name:line('商品名稱')||raw.split('\n')[0].trim(),season:'winter',price:Number(line('售價').replace(/[^\d]/g,'')),salePrice:Number(line('官網價').replace(/[^\d]/g,'')),colors:normalizeOptions(line('顏色')),sizes:normalizeOptions(line('尺寸')),description:line('商品描述')||section('商品描述')||line('簡介')||section('簡介'),material:line('材質')||section('材質'),fit:line('版型')||section('版型'),delivery:line('出貨資訊')||section('出貨資訊')||line('備貨資訊')||section('備貨資訊'),sort,featured:sort===1,images:files.map(asset),coverImage:asset(files[0]),cutoutImage:null,sizeGuide,fitReport,sizeInfo:sizeGuide,tryOn:fitReport,source:[folder,d.name,'商品資訊.txt'].join('/')};
 });
}
export function buildCatalog(root=process.cwd()){

 const result={};
 for(const [season,folder] of Object.entries(groups)){
 const group=path.join(root,folder);
 if(season==='winter'&&fs.readdirSync(group,{withFileTypes:true}).some(d=>d.isDirectory()&&/^0[1-5](?:\s|$)/.test(d.name))){result[season]=buildWinterCatalog(root);continue;}
 result[season]=fs.readdirSync(group,{withFileTypes:true}).filter(d=>d.isDirectory()).map((d,i)=>{
 const base=path.join(group,d.name),raw=fs.readFileSync(path.join(base,'商品資訊.txt'),'utf8').replace(/\r/g,'');
 const line=k=>raw.match(new RegExp('^'+k+'[：:]?[ \\t]*(.+)$','m'))?.[1].trim()||'';
 const optionText=k=>{const lines=raw.split('\n');const found=lines.findIndex(v=>v.startsWith(k+'：')||v.startsWith(k+':')||v===k||v.startsWith(k+' ')||v.startsWith(k+'\t'));if(found<0)return '';const first=lines[found].replace(new RegExp('^'+k+'[：:]?[ \t]*'),'').trim();if(first)return first;const following=[];for(const v of lines.slice(found+1)){if(!v.trim()||/^(顏色|尺寸|售價|官網價|試穿|材質|版型)/.test(v))break;following.push(v);}const text=following.join('\n');return /衣長|胸圍|肩寬|袖長/.test(text)?'':text;};
 const block=k=>raw.match(new RegExp('(?:^|\\n)'+k+'[：:]?[ \\t]*\\n([^]*?)(?=\\n[ \\t]*\\n|$)'))?.[1].trim()||'';
 const meta=fs.existsSync(path.join(base,'product.json'))?JSON.parse(fs.readFileSync(path.join(base,'product.json'),'utf8')):{};
 const asset=f=>{if(typeof f!=='string'||!fs.existsSync(path.join(base,f))||!path.resolve(base,f).startsWith(base+path.sep))throw new Error('Invalid image: '+f);return './'+[folder,d.name,f].map(encodeURIComponent).join('/');};
 const files=fs.readdirSync(base).filter(f=>/\.(jpg|jpeg|webp|png)$/i.test(f)).sort((a,b)=>a.localeCompare(b,'zh-Hant',{numeric:true}));
 if(!files.length)throw new Error('Missing images: '+d.name);
 const cutout=meta.cutoutImage||files.find(f=>/去背|cutout/i.test(f))||null;
 const main=cutout||files.find(f=>f.includes('純白底'))||files[0];
 const images=meta.images||[main,...files.filter(f=>f!==main)];
 const cover=meta.coverImage||images[0];
 const sizeGuide=meta.sizeGuide??meta.sizeInfo??raw.match(/\n尺寸\s*\n([^]*?)(?=\n試穿報告|$)/)?.[1].trim()??'';
 const fitReport=meta.fitReport??meta.tryOn??raw.split('試穿報告')[1]?.trim()??'';
 const sort=Number(meta.sort??line('排序'))||i+1;
 const featured=meta.featured??(/^(true|yes|是|1)$/i.test(line('featured')||line('主推'))||i===0);
 return {id:meta.id||line('編號')||season+'-'+(i+1),name:meta.name||raw.split('\n')[0].trim(),season,price:Number(line('售價').replace(/[^\d]/g,'')),salePrice:Number(line('官網價').replace(/[^\d]/g,'')),description:block('商品描述'),material:line('材質'),fit:line('版型'),delivery:line('出貨資訊')||line('備貨資訊'),...meta,colors:normalizeOptions(meta.colors??optionText('顏色')),sizes:normalizeOptions(meta.sizes??optionText('尺寸')),sort,featured,images:images.map(asset),coverImage:asset(cover),cutoutImage:cutout?asset(cutout):null,sizeGuide,fitReport,sizeInfo:sizeGuide,tryOn:fitReport,source:[folder,d.name,'商品資訊.txt'].join('/')};
 }).sort((a,b)=>a.sort-b.sort||Number(b.featured)-Number(a.featured));
 const ids=new Set();for(const p of result[season]){if(ids.has(p.id))throw new Error('Duplicate id: '+p.id);ids.add(p.id);}
 }
 return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const winterOnly=process.argv.includes('--winter-only');
 const catalog=winterOnly?JSON.parse(fs.readFileSync('catalog.js','utf8').replace(/^window\.CATALOG = /,'').replace(/;\s*$/,'')):buildCatalog();
 if(winterOnly)catalog.winter=buildWinterCatalog();fs.writeFileSync('catalog.js','window.CATALOG = '+JSON.stringify(catalog,null,2)+';\n');console.log('Catalog generated:',Object.fromEntries(Object.entries(catalog).map(([s,p])=>[s,p.length])));
}
