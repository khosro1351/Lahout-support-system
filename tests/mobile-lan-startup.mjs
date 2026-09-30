import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
const origin=process.env.LAN_TEST_ORIGIN??'http://192.168.1.8:5175',results=[];
const pass=name=>{results.push({name,status:'PASS'});console.log('PASS '+name);};
const response=await fetch(origin+'/login');assert.equal(response.status,200);assert.match(await response.text(),/<div id="root">/);
assert.equal((await (await fetch(origin+'/api/v1/health/ready')).json()).postgres,'ok');
pass('LAN login and PostgreSQL readiness');
const before=JSON.parse(readFileSync('.local/mobile/state.json','utf8'));
execFileSync(process.execPath,['scripts/mobile-lan.mjs','start'],{stdio:'pipe'});
assert.equal(JSON.parse(readFileSync('.local/mobile/state.json','utf8')).pid,before.pid);
pass('Repeated start does not duplicate the gateway');
for(const headers of [{origin:'http://evil.invalid'},{}])assert.equal((await fetch(origin+'/api/v1/auth/login',{method:'POST',headers:{...headers,'content-type':'application/json'},body:'{}'})).status,403);
assert.equal((await fetch(origin+'/api/v1/family-workspace/families',{headers:{origin}})).status,401);
pass('Foreign/missing Origin and unauthenticated private API blocked');
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
try{const page=await browser.newPage(),errors=[],fontEvidence=[];const cdp=await page.context().newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');page.on('pageerror',e=>errors.push(e.message));
for(const width of [1440,768,390]){await page.setViewportSize({width,height:844});await page.goto(origin+'/login');await page.locator('#username').waitFor();assert.equal(await page.locator('html').getAttribute('dir'),'rtl');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.ok(await page.locator('#password').isVisible());await page.evaluate(()=>document.fonts.ready);const computed=await page.evaluate(()=>Object.fromEntries(['body','h2','label','#username','.primary'].map(q=>[q,getComputedStyle(document.querySelector(q)).fontFamily])));assert.ok(Object.values(computed).every(f=>f.includes('Liana')));const {root}=await cdp.send('DOM.getDocument');const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:root.nodeId,selector:'h2'});const actual=await cdp.send('CSS.getPlatformFontsForNode',{nodeId});assert.ok(actual.fonts.some(f=>f.isCustomFont&&/Liana/i.test(f.familyName)));fontEvidence.push({width,computed,actual});}
writeFileSync('test-results/login-font-after.json',JSON.stringify(fontEvidence,null,2));pass('Login renders the local Liana font, verified via computed styles and actual glyph font at desktop/tablet/mobile');
assert.deepEqual(errors,[]);await page.screenshot({path:'test-results/mobile-lan-login.png'});pass('Desktop/tablet/mobile real login assets, RTL, no overflow or JavaScript errors');
}finally{await browser.close();}
writeFileSync('test-results/mobile-lan-startup-results.json',JSON.stringify({at:new Date().toISOString(),origin,results},null,2));
