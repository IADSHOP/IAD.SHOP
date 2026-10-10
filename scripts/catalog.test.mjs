import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildCatalog} from './build-catalog.mjs';
test('Official product notes and Pages paths',()=>{
 const c=JSON.parse(fs.readFileSync('catalog.js','utf8').replace(/^window\.CATALOG = /,'').replace(/;\s*$/,''));assert.equal(c.summer.length,5);assert.equal(c.winter.length,11);
 assert.deepEqual(c.summer.map(p=>p.salePrice),[249,239,880,2280,2080]);assert.deepEqual(c.winter.map(p=>p.salePrice),[6280,2280,1280,1080,490,5280,1880,1880,2280,2180,2280]);
 assert.deepEqual(c.winter.map(p=>p.sort),[1,2,3,4,5,6,7,8,9,10,11]);
 for(const [index,count] of [[4,8],[5,6]]){const p=c.winter[index];assert.deepEqual(p.images.map(image=>decodeURIComponent(image).split('/').at(-1)),Array.from({length:count},(_,i)=>String(i+1).padStart(2,'0')+'.jpg'));assert.equal(p.coverImage,p.images[0]);}
 assert.equal(c.winter[4].id,'winter-1');assert.ok(c.winter[4].tryOn.includes('169/65'));assert.equal(c.winter[5].id,'winter-06');assert.deepEqual(c.winter[5].sizes,['L','XL']);
 for(const [index,numbers] of [[6,[1,2,3,4,5,7,8,9]],[7,[0,1,2,3,4,5,6,7,8]],[8,[1,2,3,4,5,6,7]]]){const p=c.winter[index];assert.deepEqual(p.images.map(image=>Number(decodeURIComponent(image).split('/').at(-1).match(/^\d+/)[0])),numbers);assert.equal(p.coverImage,p.images[0]);assert.deepEqual(p.sizes,['F']);}
 for(const products of Object.values(c))for(const p of products){assert.ok(p.colors.length);assert.ok(p.sizes.length);if(p.season==='summer'?p.sort<=2:p.sort<=6){assert.ok(p.sizeInfo);assert.ok(p.tryOn);}for(const image of p.images){assert.ok(image.startsWith('./'));assert.ok(fs.existsSync(decodeURIComponent(image)));}}
 const rebuilt=buildCatalog();assert.deepEqual(rebuilt,c,'Published catalog must survive the CI rebuild');
});

import os from 'node:os';
import path from 'node:path';
test('Curated order, cover/cutout paths, and information aliases',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'iad-catalog-'));
 try{
 for(const folder of ['SUMMER商品','WINTER商品']){
 for(const [name,sort] of [['a',20],['b',1]]){
 const base=path.join(root,folder,name);fs.mkdirSync(base,{recursive:true});
 fs.writeFileSync(path.join(base,'商品資訊.txt'),'Test\n顏色 白色\n尺寸 F\n售價$280\n官網價$239\n\n尺寸\n衣長33\n\n試穿報告\nMODEL 165/54');
 for(const image of ['main.jpg','cover.jpg','cutout.png'])fs.writeFileSync(path.join(base,image),'image-fixture');
 fs.writeFileSync(path.join(base,'product.json'),JSON.stringify({id:name,sort,coverImage:'cover.jpg',cutoutImage:'cutout.png',images:['main.jpg'],sizeGuide:'CUSTOM SIZE',fitReport:'CUSTOM FIT',delivery:'SOURCE DELIVERY'}));
 }
 }
 const c=buildCatalog(root);for(const products of Object.values(c)){assert.deepEqual(products.map(p=>p.id),['b','a']);for(const p of products){assert.ok(p.coverImage.endsWith('cover.jpg'));assert.ok(p.cutoutImage.endsWith('cutout.png'));assert.ok(p.images[0].endsWith('main.jpg'));assert.equal(p.sizeGuide,'CUSTOM SIZE');assert.equal(p.fitReport,'CUSTOM FIT');assert.equal(p.delivery,'SOURCE DELIVERY');}}
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('Option data handles slash lists, ONE SIZE, NONE and multiline notes',async()=>{
 const {normalizeOptions}=await import('./build-catalog.mjs');
 assert.deepEqual(normalizeOptions('S / M / L'),['S','M','L']);
 assert.deepEqual(normalizeOptions('ONE SIZE'),['ONE SIZE']);
 assert.deepEqual(normalizeOptions('NONE'),[]);
 assert.deepEqual(normalizeOptions(['NONE','ONE SIZE']),['ONE SIZE']);
 assert.deepEqual(normalizeOptions('S / ONE SIZE'),['S','ONE SIZE']);
 assert.deepEqual(normalizeOptions('黑色／白色'),['黑色','白色']);
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'iad-options-'));
 try{
 for(const [folder,notes] of [['SUMMER商品','Test\n顏色：黑色 / 白色\n尺寸：\nONE SIZE\n\n售價$280\n官網價$249'],['WINTER商品','Test\n顏色：NONE\n尺寸：S / M / L\n\n售價$590']]){
 const base=path.join(root,folder,'test');fs.mkdirSync(base,{recursive:true});fs.writeFileSync(path.join(base,'商品資訊.txt'),notes);fs.writeFileSync(path.join(base,'main.jpg'),'fixture');
 }
 const c=buildCatalog(root);assert.deepEqual(c.summer[0].sizes,['ONE SIZE']);assert.deepEqual(c.summer[0].colors,['黑色','白色']);assert.deepEqual(c.winter[0].colors,[]);assert.deepEqual(c.winter[0].sizes,['S','M','L']);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
