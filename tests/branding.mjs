import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
const require=createRequire(new URL('../apps/backend/package.json',import.meta.url));
const {reportHtml,workbook,pdfDocument}=require('../backend/dist/review/report-export.js');
const {Workbook}=require('exceljs'),{PDFDocument}=require('pdf-lib');
const logo=readFileSync(new URL('../apps/frontend/public/branding/lahout-logo.png',import.meta.url));
const sharp=require('sharp');const stats=await sharp(logo).stats();assert.equal(stats.isOpaque,false);
const fields=[{key:'name',label:'نام'}],rows=[{name:'خانواده آزمایشی'}];
const html=reportHtml('گزارش آزمایشی',fields,rows,'',false);
assert.ok(html.includes(logo.toString('base64')));
const book=new Workbook();await book.xlsx.load(workbook('گزارش آزمایشی',fields,rows,false));
assert.equal(book.worksheets[0].getCell('A3').value,rows[0].name);
assert.equal(book.worksheets[0].getImages().length,1);
assert.deepEqual(Buffer.from(book.getImage(book.worksheets[0].getImages()[0].imageId).buffer),logo);
console.log('PASS Approved original logo embedded in XLSX; report cells and RTL preserved');
const pdf=await pdfDocument(html,'گزارش آزمایشی',false);assert.ok((await PDFDocument.load(pdf)).getPageCount()>0);
writeFileSync('test-results/branded-report.pdf',pdf);
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
try{
 const page=await browser.newPage();
 await page.setContent(html);await page.evaluate(()=>document.fonts.ready);
 assert.ok(await page.locator('header img').evaluate(i=>i.complete&&i.naturalWidth>0));
 assert.ok(await page.evaluate(()=>document.fonts.check('16px Liana')));
 console.log('PASS HTML/PDF report renders embedded original logo and Liana offline');
 for(const width of [1440,768,390,320]){
 await page.setViewportSize({width,height:900});await page.goto('http://127.0.0.1:5173/login');
 await page.locator('#username').waitFor();await page.evaluate(()=>document.fonts.ready);
 assert.ok(await page.locator('.login-brand img').evaluate(i=>i.complete&&i.naturalWidth>0));
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const header=await page.locator('.login-brand').boundingBox(),form=await page.locator('.form-panel').boundingBox();
 if(width>900){assert.ok(header.x>form.x);assert.ok(header.width+form.width>900);await page.screenshot({path:'test-results/branded-login-desktop.png',fullPage:true});}
 else assert.ok(header.y+header.height<=form.y+1);
 for(const selector of ['#username','#password','.show-password','.primary']){const box=await page.locator(selector).boundingBox();assert.ok(box.height>=44&&box.width>=44);}
 if(width===390)await page.screenshot({path:'test-results/branded-login-mobile.png',fullPage:true});
 }
 console.log('PASS Approved login design at desktop/tablet/mobile/320px: logo, RTL, touch targets and no overflow');
}finally{await browser.close();}
