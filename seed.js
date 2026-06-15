const fs = require('fs');
const path = require('path');
const db = require('./db');
const { migrate } = require('./schema');
migrate();
function readJson(name, fallback){ try{return JSON.parse(fs.readFileSync(path.join(__dirname,'..',name),'utf8'));}catch{return fallback;} }
const categories = readJson('categories.json', []);
if(categories.length){
  const ins = db.prepare('INSERT INTO categories(name_en,name_ar,active,sort_order) VALUES(?,?,?,?) ON CONFLICT(name_en) DO NOTHING');
  categories.forEach((c,i)=> ins.run(c.name_en || c.name || c, c.name_ar || '', c.active === false ? 0 : 1, i));
}
const products = readJson('products.json', []);
if(products.length){
  const findCat = db.prepare('SELECT id FROM categories WHERE name_en=?');
  const ins = db.prepare('INSERT INTO products(sku,name_en,name_ar,category_id,description_en,description_ar,base_price,vat_rate,active,data_json) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(sku) DO NOTHING');
  products.forEach((p,i)=>{
    const catId = findCat.get(p.category)?.id || null;
    ins.run(p.id || p.sku || `SKU-${i+1}`, p.name || p.name_en || 'Product', p.name_ar || '', catId, p.description || p.description_en || '', p.description_ar || '', p.price || p.base_price || 0, p.vat_rate || 15, p.active === false ? 0 : 1, JSON.stringify(p));
  });
}
console.log('Seed completed.');
