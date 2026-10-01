import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildCatalog} from './build-catalog.mjs';
test('Official product notes and Pages paths',()=>{
 const c=buildCatalog();assert.equal(c.summer.length,2);assert.equal(c.winter.length,2);
 assert.deepEqual(c.summer.map(p=>p.salePrice),[249,239]);assert.deepEqual(c.winter.map(p=>p.salePrice),[490,880]);
 for(const products of Object.values(c))for(const p of products){assert.ok(p.colors.length);assert.ok(p.sizes.length);assert.ok(p.sizeInfo);assert.ok(p.tryOn);for(const image of p.images){assert.ok(image.startsWith('./'));assert.ok(fs.existsSync(decodeURIComponent(image)));}}
});
