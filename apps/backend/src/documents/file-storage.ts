import {existsSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,rename,unlink,readdir} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {PDFDocument,PDFName,PDFDict} from 'pdf-lib';
import {AppError} from '../common/app-error';
export const documentPolicy=()=>{
 const n=(key:string,value:number,min:number,max:number)=>{const x=Number(process.env[key]??value);if(!Number.isInteger(x)||x<min||x>max)throw Error('Invalid upload policy: '+key);return x;};
 return {maxBytes:n('UPLOAD_MAX_FILE_BYTES',20*1024*1024,1024,50*1024*1024),maxTotal:n('UPLOAD_MAX_TOTAL_BYTES',50*1024*1024,1024,100*1024*1024),maxFiles:n('UPLOAD_MAX_FILES',30,1,100),maxPdfPages:n('UPLOAD_MAX_PDF_PAGES',100,1,500),target:n('UPLOAD_IMAGE_TARGET_BYTES',500*1024,100*1024,4*1024*1024),dimension:n('UPLOAD_IMAGE_MAX_DIMENSION',2600,1600,5000),quality:n('UPLOAD_IMAGE_QUALITY',85,75,95),minQuality:n('UPLOAD_IMAGE_MIN_QUALITY',78,70,95)};
};
export type StoredFile={id:string;original_name:string;media_type:string;original_size:number;stored_size:number;sha256:string;storage_key:string;pdf_pages:number};
export const hash=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');
function defaultStorageRoot(){let folder=__dirname;while(!existsSync(path.join(folder,'pnpm-workspace.yaml'))){const parent=path.dirname(folder);if(parent===folder)throw Error('Workspace root not found');folder=parent;}return path.resolve(folder,'..','lahout-persistent-data','uploads');}
export class FileStorage{
 readonly root=path.resolve(process.env.UPLOAD_STORAGE_ROOT??defaultStorageRoot());
 private key(key:string){if(!/^[0-9a-f-]{36}$/.test(key))throw new AppError(400,'FILE_KEY','شناسه فایل معتبر نیست.');return path.join(this.root,'files',key);}
 async read(key:string){try{return await readFile(this.key(key));}catch{throw new AppError(503,'STORAGE','فایل فعلاً در دسترس نیست؛ به مسئول سامانه اطلاع دهید.');}}
 async process(file:any):Promise<{meta:StoredFile;bytes:Buffer}>{
  const p=documentPolicy(),extensions:Record<string,string[]>={'image/jpeg':['.jpg','.jpeg'],'image/png':['.png'],'image/webp':['.webp'],'application/pdf':['.pdf'],'text/plain':['.txt']};
  if(!file||typeof file.name!=='string'||file.name.length>200||/[\\/\x00-\x1f]/.test(file.name)||!extensions[file.mediaType]?.includes(path.extname(file.name).toLowerCase())||typeof file.content!=='string'||!/^[A-Za-z0-9+/]*={0,2}$/.test(file.content))throw new AppError(400,'DOCUMENT_TYPE','فایل معتبر JPEG، PNG، WebP یا PDF انتخاب کنید. HEIC فعلاً پشتیبانی نمی‌شود.');
  const bytes=Buffer.from(file.content,'base64');if(!bytes.length||bytes.length>p.maxBytes)throw new AppError(400,'DOCUMENT_SIZE','حجم فایل از حد مجاز بیشتر است.');
  let stored:Buffer=bytes;let media=file.mediaType,pages=1;
  try{
   if(media.startsWith('image/')){
    const options={limitInputPixels:50000000,failOn:'warning' as const};
    const m=await sharp(bytes,options).metadata();
    if(({jpeg:'image/jpeg',png:'image/png',webp:'image/webp'} as any)[m.format??'']!==media||(m.pages??1)>1)throw Error('Invalid image');
    // Decode every accepted image, including small originals; reject corrupt payloads.
    await sharp(bytes,options).stats();
    if(bytes.length>p.target||Math.max(m.width??0,m.height??0)>p.dimension||(m.orientation??1)>1){
     const encode=(quality:number)=>sharp(bytes,options).rotate().resize({width:p.dimension,height:p.dimension,fit:'inside',withoutEnlargement:true}).flatten({background:'#fff'}).jpeg({quality,mozjpeg:true}).toBuffer();
     stored=await encode(p.quality);
     if(stored.length>p.target&&p.minQuality<p.quality)stored=await encode(p.minQuality);
     media='image/jpeg';
    }
   }else if(media==='application/pdf'){
    if(bytes.subarray(0,5).toString()!=='%PDF-')throw Error('Invalid PDF');
    const pdf=await PDFDocument.load(bytes,{ignoreEncryption:false,throwOnInvalidObject:true});
    pages=pdf.getPageCount();if(!pages||pages>p.maxPdfPages)throw Error('PDF page count');
    for(const [,object]of pdf.context.enumerateIndirectObjects())if(object instanceof PDFDict){
     for(const [key,value]of object.entries())if(['JavaScript','JS','OpenAction','AA','EmbeddedFiles','EF','RichMediaContent'].includes(key.decodeText())||value instanceof PDFName&&['JavaScript','Launch','EmbeddedFile','RichMedia'].includes(value.decodeText()))throw Error('Active PDF content');
    }
    const optimized=Buffer.from(await pdf.save({useObjectStreams:true,addDefaultPage:false}));
    if(optimized.length<bytes.length)stored=optimized;
   }else{
    if(bytes.length>256*1024||bytes.includes(0)||!Buffer.from(bytes.toString('utf8'),'utf8').equals(bytes)||/<\s*(script|html|svg)|MZ/.test(bytes.toString('utf8').slice(0,200)))throw Error('Unsafe text');
   }
  }catch{throw new AppError(400,'DOCUMENT_CONTENT','محتوای فایل خراب، ناامن یا با نوع انتخاب‌شده ناسازگار است.');}
  return {bytes:stored,meta:{id:randomUUID(),original_name:file.name.normalize('NFC'),media_type:media,original_size:bytes.length,stored_size:stored.length,sha256:hash(stored),storage_key:randomUUID(),pdf_pages:pages}};
 }
 async persist(operation:string,files:{meta:StoredFile;bytes:Buffer}[]){
  await mkdir(path.join(this.root,'files'),{recursive:true});await mkdir(path.join(this.root,'pending'),{recursive:true});
  const journal=path.join(this.root,'pending',operation+'.json');
  await writeFile(journal,JSON.stringify({at:Date.now(),keys:files.map(f=>f.meta.storage_key)}),{flag:'wx'});
  for(const f of files){const target=this.key(f.meta.storage_key);await writeFile(target+'.tmp',f.bytes,{flag:'wx'});await rename(target+'.tmp',target);}
 }
 async complete(operation:string){await unlink(path.join(this.root,'pending',operation+'.json')).catch(()=>{});}
 async reconcile(referenced:(key:string)=>Promise<boolean>,only?:string){
  const dir=path.join(this.root,'pending');const entries=only?[only+'.json']:await readdir(dir).catch(()=>[]);
  for(const file of entries){if(!/^[0-9a-f-]{36}\.json$/.test(file))continue;
   const entry=JSON.parse(await readFile(path.join(dir,file),'utf8').catch(()=>'null'));if(!entry||!only&&Date.now()-entry.at<3600000)continue;
   for(const key of entry.keys){if(!await referenced(key)){await unlink(this.key(key)).catch(()=>{});await unlink(this.key(key)+'.tmp').catch(()=>{});}}
   await unlink(path.join(dir,file)).catch(()=>{});
  }
 }
}
