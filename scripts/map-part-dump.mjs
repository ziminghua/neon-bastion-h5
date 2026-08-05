import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';

const out='artifacts/scene-smoke';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({
  headless:true,
  executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',
  args:['--no-sandbox','--disable-dev-shm-usage']
});
const page=await browser.newPage({viewport:{width:1600,height:900}});
await page.goto('http://127.0.0.1:8080/?qa=build',{waitUntil:'networkidle',timeout:45000});
const data=await page.evaluate(()=>({
  delivery:window.__RENDERED_MAP_DELIVERY||'',
  diagnostics:window.__RENDERED_MAP_DELIVERY_DIAGNOSTICS||null
}));
await fs.writeFile(`${out}/runtime-delivery-map-base64.txt`,data.delivery);
await fs.writeFile(`${out}/runtime-delivery-diagnostics.json`,JSON.stringify(data.diagnostics,null,2));
await browser.close();
console.log(JSON.stringify({delivery:data.delivery.length,diagnostics:data.diagnostics}));
