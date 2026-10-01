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
export function buildCatalog(root=process.cwd()){

 const result={};
 for(const [season,folder] of Object.entries(groups)){
 const group=path.join(root,folder);
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
 const catalog=buildCatalog();fs.writeFileSync('catalog.js','window.CATALOG = '+JSON.stringify(catalog,null,2)+';\n');console.log('Catalog generated:',Object.fromEntries(Object.entries(catalog).map(([s,p])=>[s,p.length])));
}

