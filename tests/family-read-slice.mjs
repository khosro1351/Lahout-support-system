import assert from 'node:assert/strict';
import path from 'node:path';
export async function testFamilyReadSlice({page,origin,get,req,guide,leader,pool,out,pass}){
 const index=await get('/oversight/families');assert.ok(index.families.length);assert.equal((await req('/oversight/families',leader)).status,403);assert.equal((await req('/oversight/families',{})).status,401);
 for(const f of index.families){assert.equal(f.case_status,'ACTIVE');if(f.assessment_status==='NO_VALID')assert.equal(f.score,null);}
 const target=(await pool.query('SELECT r.family_id,r.id FROM family.investigation_context c JOIN family.research_records r ON r.id=c.research_id LIMIT 1')).rows[0];
 const data=await get('/oversight/families/'+target.family_id);assert.equal(data.research.find(r=>r.id===target.id).context.board_snapshot.length,3);assert.equal(data.research.find(r=>r.id===target.id).visits.length,2);assert.ok(data.notes.length);assert.ok(data.documents.some(d=>d.person_id));
 assert.equal((await req('/oversight/families/'+target.family_id,leader)).status,403);
 await assert.rejects(pool.query("UPDATE family.investigation_context SET findings='changed' WHERE research_id=$1",[target.id]));
 const foreignPerson=(await pool.query('SELECT person_id FROM family.family_memberships WHERE family_id<>$1 LIMIT 1',[target.family_id])).rows[0].person_id;
 await assert.rejects(pool.query('INSERT INTO family.case_notes(family_id,person_id,body,actor_id) VALUES($1,$2,$3,$4)',[target.family_id,foreignPerson,'scope test',guide.user.accountId]),/Member context outside family/);
 assert.ok((await pool.query("SELECT 1 FROM guidance.history WHERE entity_id=$1 AND action='RESEARCH_CONTEXT_RECORDED'",[target.family_id])).rowCount);
 pass('Guide monitoring API protects role; immutable board snapshot, visits, notes and linked evidence remain separate from alerts');
 await page.goto(origin+'/guide');await page.locator('.slice-tile').first().waitFor();await page.locator('.slice-tile').filter({hasText:'خانواده‌های تحت حمایت'}).click();await page.locator('tbody tr').first().waitFor();assert.ok(page.url().includes('/guide/families'));assert.equal(await page.getByLabel('حوزه گزارش').count(),0);
 assert.equal(await page.locator('.slice-grid.five select').count(),5);const rows=await page.locator('tbody tr').count();assert.equal(rows,Math.min(20,index.families.length));const listUrl=page.url();await page.locator('tbody tr').first().locator('td').nth(1).click();assert.equal(page.url(),listUrl);
 for(const status of ['CURRENT','REVIEW_REQUIRED','INCOMPLETE','NO_VALID']){
  await page.getByLabel('وضعیت ارزیابی',{exact:true}).selectOption(status);
  const expected=Math.min(20,index.families.filter(f=>f.assessment_status===status).length);
  // React/router rendering is asynchronous; retain the exact assertion after it settles.
  await page.waitForFunction(({status,expected})=>new URL(location.href).searchParams.get('assessment')===status&&document.querySelectorAll('tbody tr').length===expected,{status,expected});
  assert.equal(await page.locator('tbody tr').count(),expected);
 }
 await page.getByLabel('وضعیت ارزیابی',{exact:true}).selectOption('');
 await page.route('**/api/v1/oversight/groups',route=>route.abort());await page.reload();await page.locator('tbody tr').first().waitFor();assert.ok(await page.getByRole('alert').count());await page.unroute('**/api/v1/oversight/groups');await page.getByRole('button',{name:'تلاش دوباره',exact:true}).click();await page.getByLabel('گروه',{exact:true}).locator('option').nth(1).waitFor({state:'attached'});

 await page.getByLabel('گروه',{exact:true}).selectOption(target?data.family.group_id:'');await page.locator('tbody tr').first().waitFor();const filteredUrl=page.url();await page.locator('tbody tr').first().getByRole('link',{name:'مشاهده پرونده',exact:true}).click();await page.getByRole('link',{name:'بازگشت به فهرست خانواده‌ها',exact:true}).click();assert.equal(page.url(),filteredUrl);
 await page.getByLabel('تعداد در صفحه').selectOption('50');assert.ok(page.url().includes('size=50'));await page.getByRole('button',{name:'خانواده / سرپرست',exact:true}).click();assert.ok(page.url().includes('sort=head_name'));
 await page.getByRole('button',{name:'پاک‌کردن فیلترها',exact:true}).click();await page.locator('.slice-bar').first().click();assert.ok(page.url().includes('domain='));await page.getByRole('button',{name:'پاک‌کردن فیلترها',exact:true}).click();
 pass('Independent monitoring list: five filters, linked chart chip, sorting, page size and exact drill-back state');
 await page.setViewportSize({width:1440,height:1086});
 await page.goto(origin+'/guide/families');await page.locator('tbody tr').first().waitFor();await page.screenshot({path:path.join(out,'slice-02-monitoring.png'),fullPage:true});
 await page.goto(origin+'/guide');await page.locator('.slice-tile').first().waitFor();await page.screenshot({path:path.join(out,'slice-01-dashboard.png'),fullPage:true});
 const family='/guide/families/'+target.family_id;
 await page.goto(origin+family);await page.getByRole('heading',{name:'مشخصات خانواده',exact:true}).waitFor();await page.screenshot({path:path.join(out,'slice-03-family.png'),fullPage:true});
 const member=data.documents.find(d=>d.person_id).person_id;
 const routes=[[family+'/members/'+member,'slice-04-member.png','مشخصات عضو'],[family+'/assessments?legacy=1','slice-05-versions.png','فهرست نسخه‌ها'],[family+'/investigations/'+target.id,'slice-06-investigation.png','هیأت تحقیق'],[family+'/supports/'+data.supports[0].id,'slice-07-support.png','مشخصات حمایت']];
 for(const [route,file,heading] of routes){await page.goto(origin+route);await page.getByRole('heading',{name:heading,exact:true}).waitFor();await page.screenshot({path:path.join(out,file),fullPage:true});assert.equal(await page.getByRole('button',{name:/ذخیره|حذف|تأیید حمایت|رفع هشدار/}).count(),0);}
 await page.goto(origin+family+'/assessments?legacy=1');await page.getByText('مشاهده پاسخ‌ها و نتیجه نسخه',{exact:true}).click();await page.locator('.assessment-domain').first().waitFor();assert.equal(await page.locator('.assessment-domain').count(),5);assert.equal(await page.locator('.assessment-domain input,.assessment-domain select').count(),0);
 await page.locator('.slice-domain').nth(0).click();await page.waitForFunction(()=>document.querySelectorAll('.assessment-domain').length===1);await page.locator('.slice-domain').nth(1).click();await page.waitForURL(url=>url.searchParams.get('domain')==='health');assert.equal(new URL(page.url()).searchParams.getAll('domain').length,1);assert.equal(new URL(page.url()).searchParams.get('domain'),'health');

 pass('Seven real PostgreSQL/browser pages captured; guide versions reuse identical read-only five-domain schema and expose no write controls');
 for(const width of [390,768]){await page.setViewportSize({width,height:900});for(const route of ['/guide','/guide/families',family,...routes.map(r=>r[0])]){await page.goto(origin+route);await page.locator('.guide-slice').waitFor();await page.waitForTimeout(150);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),route+' at '+width);}}
 await page.screenshot({path:path.join(out,'slice-mobile.png'),fullPage:true});await page.setViewportSize({width:1440,height:1086});
 pass('All seven guide read pages fit mobile and tablet without document overflow');
 const pgGroup=(await pool.query('SELECT id FROM organization.groups WHERE id<>$1 ORDER BY id LIMIT 1',[data.family.group_id])).rows[0].id;
 await pool.query("INSERT INTO family.families(family_code,current_group_id,created_by,neighborhood) SELECT 'HL-UI-TEST-'||n,$1,$2,'Development/Test pagination only' FROM generate_series(1,21) n",[pgGroup,guide.user.accountId]);
 await page.goto(origin+'/guide/families');await page.locator('tbody tr').nth(19).waitFor();assert.equal(await page.locator('tbody tr').count(),20);await page.getByRole('button',{name:'بعدی',exact:true}).click();await page.waitForFunction(n=>document.querySelectorAll('tbody tr').length===n,index.families.length+21-20);assert.equal(await page.locator('tbody tr').count(),index.families.length+21-20);await page.getByLabel('تعداد در صفحه').selectOption('100');await page.waitForFunction(n=>document.querySelectorAll('tbody tr').length===n,index.families.length+21);assert.equal(await page.locator('tbody tr').count(),index.families.length+21);
 pass('Real PostgreSQL dataset above twenty rows paginates correctly and resets page for 100-row size');

}
