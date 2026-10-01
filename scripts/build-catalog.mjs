import fs from 'node:fs';
import path from 'node:path';
const groups={summer:'SUMMER商品',winter:'WINTER商品'};
export function buildCatalog(){
 const result={};
 for(const [season,folder] of Object.entries(groups)){
 result[season]=fs.readdirSync(folder,{withFileTypes:true}).filter(d=>d.isDirectory()).map((d,i)=>{
 const base=path.join(folder,d.name),raw=fs.readFileSync(path.join(base,'商品資訊.txt'),'utf8').replace(/\r/g,'');
 const line=k=>raw.match(new RegExp('^'+k+'(.+)$','m'))?.[1].trim()||'';
 const meta=fs.existsSync(path.join(base,'product.json'))?JSON.parse(fs.readFileSync(path.join(base,'product.json'),'utf8')):{};
 const asset=f=>'./'+[folder,d.name,f].map(encodeURIComponent).join('/');
 const files=fs.readdirSync(base).filter(f=>/\.(jpg|jpeg|webp|png)$/i.test(f)).sort((a,b)=>a.localeCompare(b,'zh-Hant',{numeric:true}));
 const cutout=meta.cutoutImage||files.find(f=>/去背|cutout/i.test(f))||null;
 const cover=meta.coverImage||cutout||files.find(f=>f.includes('純白底'))||files[0];
 const images=[cover,...files.filter(f=>f!==cover)];
 return {id:line('編號')||season+'-'+(i+1),name:raw.split('\n')[0].trim(),season,price:Number(line('售價').replace(/[^\d]/g,'')),salePrice:Number(line('官網價').replace(/[^\d]/g,'')),colors:line('顏色').split(/\s+/).filter(Boolean),sizes:line('尺寸').split(/\s+/).filter(Boolean),description:'',material:'',fit:'',sizeInfo:raw.match(/\n尺寸\s*\n([^]*?)(?=\n試穿報告|$)/)?.[1].trim()||'',tryOn:raw.split('試穿報告')[1]?.trim()||'',sort:i+1,featured:i===0,...meta,images:images.map(asset),cutoutImage:cutout?asset(cutout):null,source:base+'/商品資訊.txt'};
 }).sort((a,b)=>a.sort-b.sort);
 }
 return result;
}
fs.writeFileSync('catalog.js','window.CATALOG = '+JSON.stringify(buildCatalog(),null,2)+';\n');
console.log('Catalog generated: 4 products');
