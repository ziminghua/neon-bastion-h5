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
const parts=await page.evaluate(()=>({
  tail0:window.__RENDERED_MAP_DELIVERY_TAIL?.[0]||'',
  tail5:window.__RENDERED_MAP_DELIVERY_TAIL?.[5]||''
}));
await fs.writeFile(`${out}/runtime-tail-00.txt`,parts.tail0);
await fs.writeFile(`${out}/runtime-tail-05.txt`,parts.tail5);
await browser.close();
console.log(JSON.stringify({tail0:parts.tail0.length,tail5:parts.tail5.length}));
