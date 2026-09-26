import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const mocked=process.env.ASSESSMENT_MOCK==='1';
const origin=process.env.FRONTEND_ORIGIN??'http://127.0.0.1:5173';
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
try{
 const page=await browser.newPage();const errors=[],writes=[];
 page.on('pageerror',e=>errors.push(e.message));
 const fixture={id:'00000000-0000-4000-8000-000000000001',family_code:'HL-TEST-NAV'};
 if(mocked){
  let loggedIn=false;
  const roles=[{roleCode:'GROUP_LEADER',scopeType:'GROUP',scopeId:'test-group'}];
  const user={accountId:'test-leader',displayName:'سرگروه آزمایشی',username:'TestV100_Leader1',roles,availableRoles:roles,effectiveRole:'GROUP_LEADER',simulation:false,redirectTo:'/workspace/livelihood/'+fixture.id};
  const data={family:{id:fixture.id,code:fixture.family_code,groupName:'گروه آزمایشی',version:1},members:[],submissions:[],documents:[],payload:{notes:'جمع‌بندی محفوظ'},review:{state:'DRAFT',version:1},canEdit:true,model:{definition:{indicators:[]}},schema:{income:[],employment:[],expenses:[],evidence:[]},criticalOptions:[],checks:[],documentKinds:{},history:[{occurred_at:'2026-09-26T11:00:00Z',action:'LIVELIHOOD_CREATED'}],result:{missing:[],complete:false,score:null}};
  await page.route('**/api/v1/**',async route=>{
   const path=new URL(route.request().url()).pathname;
   let body={};let status=200;
   if(path==='/api/v1/auth/login'){loggedIn=true;body={user,csrfToken:'test'};}
   else if(path==='/api/v1/auth/me'){status=loggedIn?200:401;body=loggedIn?{user,csrfToken:'test'}:{message:'ورود لازم است'};}
   else if(path==='/api/v1/livelihood/families/'+fixture.id)body=data;
   else if(path.includes('notifications'))body={notifications:[],unread:0};
   await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  });
 }
 await page.goto(origin+'/login');
 await page.locator('#username').fill(process.env.ASSESSMENT_TEST_USER??'TestV100_Leader1');
 assert.ok(mocked||process.env.DEV_SEED_PASSWORD,'Existing development password required');
 await page.locator('#password').fill(mocked?'fixture-password':process.env.DEV_SEED_PASSWORD);
 await page.locator('#password').press('Enter');
 await page.waitForURL(u=>!u.pathname.endsWith('/login'));
 if(new URL(page.url()).pathname==='/select-role')await page.getByRole('button',{name:'سرگروه',exact:false}).click();
 let family=fixture;
 if(!mocked){const families=await page.request.get(origin+'/api/v1/livelihood/families');assert.equal(families.status(),200);
 family=(await families.json()).families.find(f=>f.family_code.startsWith('HL-TEST-'));assert.ok(family,'Existing fictional family required; no seed runs');}
 page.on('request',r=>{if(r.url().includes('/api/')&&!['GET','HEAD','OPTIONS'].includes(r.method()))writes.push(r.url());});
 await page.goto(origin+'/workspace/livelihood/'+family.id);
 const nav=page.getByRole('navigation',{name:'حوزه‌های ارزیابی'});
 await nav.waitFor();assert.equal(await nav.getByRole('link').count(),2);
 assert.equal(await nav.getByRole('link',{name:'معیشت و اقتصاد',exact:true}).getAttribute('aria-current'),'page');
 await page.getByRole('button',{name:'معیشت و اقتصاد',exact:true}).click();
 const original=await page.locator('.livelihood').innerText();
 await nav.getByRole('link',{name:'سلامت و درمان',exact:true}).click();
 await page.waitForURL('**/workspace/health/'+family.id);
 const message=page.getByText('ارزیابی سلامت و درمان این خانواده هنوز تکمیل نشده است.',{exact:true});await message.waitFor();
 assert.equal(await nav.getByRole('link',{name:'سلامت و درمان',exact:true}).getAttribute('aria-current'),'page');
 assert.equal(await page.locator('.guide-content form,.guide-content input,.guide-content button').count(),0);
 await page.reload();await message.waitFor();assert.equal(new URL(page.url()).pathname,'/workspace/health/'+family.id);
 assert.equal(await page.locator('html').getAttribute('dir'),'rtl');assert.equal(await nav.getAttribute('dir'),'rtl');
 await nav.getByRole('link',{name:'معیشت و اقتصاد',exact:true}).click();
 await page.waitForURL('**/workspace/livelihood/'+family.id);
 await page.getByRole('button',{name:'معیشت و اقتصاد',exact:true}).click();
 assert.equal(await page.locator('.livelihood').innerText(),original);
 if(mocked){
  await page.getByRole('button',{name:'نتیجه و ارسال',exact:true}).click();
  assert.ok((await page.locator('.livelihood').innerText()).includes('۱۴۰۵/۰۷/۰۴ - ۱۴:۳۰'));
 }
 assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
 console.log('PASS Assessment navigation ('+(mocked?'simulated API/login':'real login')+'): test-leader, two tabs, health skeleton, refresh, RTL, livelihood return, no data writes or browser errors');
}finally{await browser.close();}
