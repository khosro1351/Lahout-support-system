import {Workbook} from 'exceljs';
import {inflateRawSync} from 'node:zlib';
export const columns=['نام','نام خانوادگی','کد ملی','شماره تماس','جنسیت','تاریخ تولد'];
export const keys=['first_name','last_name','national_id','mobile','sex','birth_date'];
export const normalize=(v:string)=>v.trim().replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/[۰-۹٠-٩]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.includes(c)?'۰۱۲۳۴۵۶۷۸۹'.indexOf(c):'٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/[\u200c\s]+/g,' ');
const calendar=new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn',{timeZone:'UTC',year:'numeric',month:'numeric',day:'numeric'});
export function jalaliDate(value:string):string|null{
 const v=normalize(value);if(!v)return '';if(!/^\d{4}\/\d{2}\/\d{2}$/.test(v))return null;
 const [y,m,d]=v.split('/').map(Number);if(y<1||m<1||m>12||d<1||d>31)return null;
 const target=y*10000+m*100+d;let lo=Math.floor(Date.UTC(y+620,0,1)/86400000),hi=Math.floor(Date.UTC(y+623,0,1)/86400000);
 while(lo<=hi){const mid=Math.floor((lo+hi)/2),date=new Date(mid*86400000),p=Object.fromEntries(calendar.formatToParts(date).map(x=>[x.type,x.value])),key=Number(p.year)*10000+Number(p.month)*100+Number(p.day);if(key===target){const iso=date.toISOString().slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(iso)?iso:null;}if(key<target)lo=mid+1;else hi=mid-1;}return null;
}
// Bound actual decompression before the workbook parser allocates XML objects.
function checkArchive(buffer:Buffer){
 let end=-1;for(let i=buffer.length-22;i>=Math.max(0,buffer.length-65557);i--)if(buffer.readUInt32LE(i)===0x06054b50){end=i;break;}
 if(end<0)throw Error('فایل XLSX معتبر نیست.');const count=buffer.readUInt16LE(end+10);let offset=buffer.readUInt32LE(end+16),total=0;
 if(!count||count>1000||offset>=end)throw Error('ساختار فایل Excel پشتیبانی نمی‌شود.');
 for(let n=0;n<count;n++){
  if(offset+46>end||buffer.readUInt32LE(offset)!==0x02014b50)throw Error('فایل Excel ناقص است.');
  const flags=buffer.readUInt16LE(offset+8),method=buffer.readUInt16LE(offset+10),size=buffer.readUInt32LE(offset+20),rawSize=buffer.readUInt32LE(offset+24),nameLen=buffer.readUInt16LE(offset+28),extra=buffer.readUInt16LE(offset+30),comment=buffer.readUInt16LE(offset+32),local=buffer.readUInt32LE(offset+42);
  if(flags&1||![0,8].includes(method)||rawSize>8*1024*1024||local+30>buffer.length)throw Error('فایل رمزگذاری‌شده یا بیش از حد بزرگ است.');
  const start=local+30+buffer.readUInt16LE(local+26)+buffer.readUInt16LE(local+28);if(start+size>buffer.length)throw Error('فایل Excel ناقص است.');
  const packed=buffer.subarray(start,start+size),raw=method===8?inflateRawSync(packed,{maxOutputLength:8*1024*1024}):packed;total+=raw.length;
  if(raw.length!==rawSize||total>12*1024*1024)throw Error('حجم محتوای Excel بیش از حد مجاز است.');offset+=46+nameLen+extra+comment;
 }
 if(offset!==end)throw Error('فهرست محتوای فایل Excel معتبر نیست.');
}
export async function template(){const book=new Workbook(),sheet=book.addWorksheet('خانواده‌ها',{views:[{rightToLeft:true,state:'frozen',ySplit:1}]});sheet.addRow(columns);sheet.columns=columns.map((_,i)=>({width:i===1?26:22,numFmt:'@'}));sheet.getRow(1).font={bold:true};sheet.getCell('A1').note='الزامی؛ هر ردیف یک خانواده و سرپرست';sheet.getCell('B1').note='الزامی';sheet.getCell('C1').note='اختیاری؛ ۱۰ رقم به صورت متن، صفرهای آغازین حفظ شوند';sheet.getCell('D1').note='اختیاری؛ شماره ۱۱ رقمی با صفر آغازین یا +98';sheet.getCell('E1').note='اختیاری: زن، مرد یا نامشخص';sheet.getCell('F1').note='اختیاری؛ تاریخ شمسی متنی YYYY/MM/DD مانند 1365/07/21';return Buffer.from(await book.xlsx.writeBuffer());}
export type ParsedRow={row:number;sheet:string;data:Record<string,string|null>;errors:{sheet:string;row:number;column:string;message:string}[];empty:boolean};
export async function parseExcel(bytes:Buffer):Promise<{rows:ParsedRow[];errors:string[]}>{
 try{checkArchive(bytes);const book=new Workbook();await book.xlsx.load(bytes as any);
  if(book.worksheets.length!==1)return {rows:[],errors:['فایل باید دقیقاً یک Sheet داشته باشد.']};const sheet=book.worksheets[0];
  if(sheet.rowCount>3001||sheet.columnCount>6)return {rows:[],errors:['حداکثر ۳۰۰۰ ردیف و فقط شش ستون قالب رسمی مجاز است؛ ستون گروه یا سرگروه پذیرفته نیست.']};
  if(columns.some((v,i)=>normalize(sheet.getRow(1).getCell(i+1).text)!==v))return {rows:[],errors:['عنوان و ترتیب شش ستون باید دقیقاً مطابق قالب رسمی باشد.']};
  const rows:ParsedRow[]=[];for(let index=2;index<=sheet.rowCount;index++){
   const row=sheet.getRow(index),values=columns.map((_,i)=>normalize(row.getCell(i+1).text)),r:ParsedRow={row:index,sheet:sheet.name,data:{},errors:[],empty:values.every(v=>!v)};
   const error=(i:number,message:string)=>r.errors.push({sheet:sheet.name,row:index,column:columns[i],message});
   for(let i=0;i<6;i++){const cell=row.getCell(i+1);r.data[keys[i]]=values[i]||null;if(cell.type===6||typeof cell.value==='object'&&cell.value!==null&&('formula' in cell.value||'sharedFormula' in cell.value))error(i,'فرمول قابل ورود نیست؛ مقدار متنی وارد کنید.');if(values[i].length>100)error(i,'مقدار بیش از حد طولانی است.');}
   if(!r.empty){for(const i of [0,1])if(!values[i])error(i,'این ستون الزامی است.');if(values[2]&&!/^\d{10}$/.test(values[2]))error(2,'کد ملی باید ۱۰ رقم باشد؛ صفر آغازین را به صورت متن حفظ کنید.');
    const phone=values[3].replace(/[\s()-]/g,'').replace(/^(\+98|0098)/,'0');r.data.mobile=phone||null;if(phone&&!/^0\d{10}$/.test(phone))error(3,'شماره تماس ۱۱ رقمی با صفر آغازین یا پیش‌شماره +98 لازم است.');
    const sex:Record<string,string>={'زن':'FEMALE','مرد':'MALE','نامشخص':'UNKNOWN'};if(values[4]&&!sex[values[4]])error(4,'جنسیت باید زن، مرد یا نامشخص باشد.');r.data.sex=sex[values[4]]??null;
    const birth=jalaliDate(values[5]);r.data.birth_date=birth||null;if(birth===null||row.getCell(6).value instanceof Date)error(5,'تاریخ شمسی معتبر با قالب YYYY/MM/DD وارد کنید؛ تاریخ عددی Excel پذیرفته نیست.');
   }
   rows.push(r);
  }return {rows,errors:rows.some(r=>!r.empty)?[]:['هیچ ردیف اطلاعاتی در فایل وجود ندارد.']};
 }catch{return {rows:[],errors:['فایل XLSX خوانا نیست، رمزگذاری شده یا بیش از حد مجاز بزرگ است.']};}
}
