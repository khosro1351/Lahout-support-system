import {Inject,Injectable,OnModuleInit} from '@nestjs/common';
import {Pool,PoolClient} from 'pg';
import {randomUUID} from 'node:crypto';
import {PG_POOL} from '../database/database.constants';
import {GuidanceService,id,input,str} from '../guidance/guidance.service';
import type {AuthUser} from '../auth/auth.types';
import {AppError} from '../common/app-error';
import {FileStorage,documentPolicy,hash,StoredFile} from './file-storage';
type Authorize=(c:PoolClient)=>Promise<unknown>;
@Injectable()
export class DocumentsService implements OnModuleInit{
 readonly storage=new FileStorage();
 constructor(@Inject(PG_POOL) private pool:Pool,private g:GuidanceService){}
 private referenced=async(key:string)=>(await this.pool.query('SELECT 1 FROM family.document_files WHERE storage_key=$1 LIMIT 1',[key])).rowCount!==0;
 async onModuleInit(){await this.storage.reconcile(this.referenced).catch(()=>console.warn('Document recovery pending; retry when storage and database are available.'));}
 async list(db:Pool|PoolClient,familyId:string,includeArchived=false,selectedIds?:string[]){return (await db.query(`SELECT d.id,d.name,d.media_type,c.category,c.recorded_at AS created_at,a.username AS creator_name,
 (SELECT sum(original_size) FROM family.document_files WHERE document_id=d.id)::bigint AS original_size,
 v.series_id,v.revision,COALESCE(s.archived,false) AS archived,
 COALESCE((SELECT sum(pdf_pages) FROM family.document_files WHERE document_id=d.id),1)::int AS page_count,
 COALESCE((SELECT sum(stored_size) FROM family.document_files WHERE document_id=d.id),octet_length(d.content))::bigint AS stored_size,
 CASE WHEN s.archived THEN 'ARCHIVED' WHEN EXISTS(SELECT 1 FROM assessment.domain_submissions WHERE snapshot->'documents' @> jsonb_build_array(jsonb_build_object('id',d.id))) OR EXISTS(SELECT 1 FROM assessment.health_submissions WHERE snapshot->'documents' @> jsonb_build_array(jsonb_build_object('id',d.id))) OR EXISTS(SELECT 1 FROM assessment.snapshots WHERE evidence @> jsonb_build_array(jsonb_build_object('id',d.id))) THEN 'SUBMITTED' ELSE 'DRAFT' END AS status
 FROM family.documents d LEFT JOIN family.document_context c ON c.document_id=d.id LEFT JOIN identity.accounts a ON a.id=c.actor_id LEFT JOIN family.document_versions v ON v.document_id=d.id LEFT JOIN family.document_series s ON s.id=v.series_id
 WHERE d.family_id=$1 AND CASE WHEN $3::uuid[] IS NOT NULL THEN d.id=ANY($3) ELSE (v.document_id IS NULL OR (s.current_document_id=d.id AND ($2::boolean OR NOT s.archived))) END ORDER BY c.recorded_at,d.id`,[familyId,includeArchived,selectedIds??null])).rows;}
 async manifest(familyId:string,documentId:string){
  const doc=(await this.pool.query('SELECT d.id,d.name,d.media_type,v.series_id,v.revision,s.archived FROM family.documents d LEFT JOIN family.document_versions v ON v.document_id=d.id LEFT JOIN family.document_series s ON s.id=v.series_id WHERE d.id=$1 AND d.family_id=$2',[id(documentId),familyId])).rows[0];
  if(!doc)throw new AppError(404,'DOCUMENT','مدرک پیدا نشد.');
  let files=(await this.pool.query('SELECT id,position,original_name,media_type,original_size,stored_size,pdf_pages,sha256 FROM family.document_files WHERE document_id=$1 ORDER BY position',[documentId])).rows;
  if(!files.length){const legacy=(await this.pool.query('SELECT name,media_type,content FROM family.documents WHERE id=$1',[documentId])).rows[0];if(legacy?.content)files=[{id:documentId,position:1,original_name:legacy.name,media_type:legacy.media_type,original_size:legacy.content.length,stored_size:legacy.content.length,pdf_pages:1,sha256:hash(legacy.content)}];}
  const versions=doc.series_id?(await this.pool.query('SELECT v.document_id AS id,v.revision,v.created_at FROM family.document_versions v WHERE series_id=$1 ORDER BY revision DESC',[doc.series_id])).rows:[];
  return {...doc,files,versions};
 }
 async file(familyId:string,documentId:string,fileId?:string){
  const doc=(await this.pool.query('SELECT * FROM family.documents WHERE id=$1 AND family_id=$2',[id(documentId),familyId])).rows[0];if(!doc)throw new AppError(404,'DOCUMENT','مدرک پیدا نشد.');
  const f=(await this.pool.query('SELECT * FROM family.document_files WHERE document_id=$1 AND ($2::uuid IS NULL OR id=$2) ORDER BY position LIMIT 1',[documentId,fileId?id(fileId):null])).rows[0];
  if(fileId&&!f&&!(fileId===documentId&&doc.content))throw new AppError(404,'FILE','صفحه پیدا نشد.');
  if(f){const bytes=await this.storage.read(f.storage_key);if(hash(bytes)!==f.sha256)throw new AppError(503,'FILE_INTEGRITY','فایل نیازمند بررسی فنی است.');return {name:f.media_type==='image/jpeg'&&!/\.jpe?g$/i.test(f.original_name)?f.original_name.replace(/\.[^.]+$/,'.jpg'):f.original_name,media_type:f.media_type,content:bytes};}
  return doc;
 }
 async write(familyId:string,value:unknown,u:AuthUser,authorize:Authorize){
  const b=input(value),requestId=id(b.requestId),name=str(b.name,150),category=str(b.category,80),files=b.files;
  const policy=documentPolicy();if(!Array.isArray(files)||files.length>policy.maxFiles)throw new AppError(400,'FILES','تعداد فایل‌ها معتبر نیست.');
  if(files.reduce((n,f)=>n+Math.ceil((typeof f?.content==='string'?f.content.length:0)*3/4),0)>policy.maxTotal)throw new AppError(400,'SIZE','مجموع حجم فایل‌ها از حد مجاز بیشتر است.');
  const requestHash=hash(JSON.stringify({familyId,...b})),operation=randomUUID();let persisted=false;
  try{return await this.g.tx(u,async c=>{
   await authorize(c);
   const existing=(await c.query('SELECT v.*,s.family_id FROM family.document_versions v JOIN family.document_series s ON s.id=v.series_id WHERE request_id=$1',[requestId])).rows[0];
   if(existing){if(existing.family_id!==familyId||existing.request_hash!==requestHash)throw new AppError(409,'RETRY','درخواست تکراری با محتوای متفاوت است.');return {id:existing.document_id,name,replayed:true};}
   let series:any=null,previous:any[]=[],revision=1;const processed:{meta:StoredFile;bytes:Buffer}[]=[];
   if(b.documentId){
    series=(await c.query('SELECT s.*,v.revision FROM family.document_series s JOIN family.document_versions v ON v.document_id=s.current_document_id WHERE s.current_document_id=$1 AND s.family_id=$2 FOR UPDATE OF s',[id(b.documentId),familyId])).rows[0];
    if(!series){
     const legacy=(await c.query('SELECT * FROM family.documents d WHERE id=$1 AND family_id=$2 AND content IS NOT NULL AND NOT EXISTS(SELECT 1 FROM family.document_versions WHERE document_id=d.id) FOR UPDATE',[id(b.documentId),familyId])).rows[0];
     if(legacy){const meta:StoredFile={id:legacy.id,original_name:legacy.name,media_type:legacy.media_type,original_size:legacy.content.length,stored_size:legacy.content.length,sha256:hash(legacy.content),storage_key:randomUUID(),pdf_pages:1};
      processed.push({meta,bytes:legacy.content});series={id:randomUUID(),current_document_id:legacy.id,revision:1,archived:false};
      await c.query('INSERT INTO family.document_series(id,family_id,current_document_id,created_by) VALUES($1,$2,$3,$4)',[series.id,familyId,legacy.id,u.accountId]);
      await c.query('INSERT INTO family.document_versions(document_id,series_id,revision,request_id,request_hash,created_by) VALUES($1,$2,1,$3,$4,$5)',[legacy.id,series.id,randomUUID(),hash(legacy.content),u.accountId]);
      await c.query('INSERT INTO family.document_files(id,document_id,position,original_name,media_type,original_size,stored_size,sha256,storage_key,pdf_pages) VALUES($1,$1,1,$2,$3,$4,$4,$5,$6,1)',[legacy.id,meta.original_name,meta.media_type,meta.original_size,meta.sha256,meta.storage_key]);
     }
    }
    if(!series||series.archived)throw new AppError(409,'DOCUMENT_VERSION','نسخه جاری تغییر کرده یا مدرک بایگانی شده است.');
    previous=(await c.query('SELECT * FROM family.document_files WHERE document_id=$1 ORDER BY position',[series.current_document_id])).rows;revision=series.revision+1;
   }
   let pages:StoredFile[]=previous;
   const added=[];for(const f of files)added.push(await this.storage.process(f));processed.push(...added);
   if(b.replaceFileId){const index=previous.findIndex(p=>p.id===id(b.replaceFileId));if(index<0||added.length!==1)throw new AppError(400,'PAGE','برای جایگزینی یک صفحه انتخاب کنید.');pages=[...previous];pages[index]=added[0].meta;}
   else pages=[...previous,...added.map(f=>f.meta)];
   if(b.order){if(!Array.isArray(b.order)||b.order.length!==pages.length||new Set(b.order).size!==pages.length||b.order.some(k=>!pages.some(p=>p.id===k)))throw new AppError(400,'ORDER','ترتیب صفحات معتبر نیست.');pages=b.order.map(k=>pages.find(p=>p.id===k)!);}
   if(!pages.length||pages.length>policy.maxFiles)throw new AppError(400,'PAGES','حداقل یک فایل لازم است.');
   persisted=true;await this.storage.persist(operation,processed);
   const doc=(await c.query('INSERT INTO family.documents(family_id,name,media_type,content) VALUES($1,$2,$3,NULL) RETURNING id,name,media_type',[familyId,name,pages[0].media_type])).rows[0];
   if(!series){series={id:randomUUID()};await c.query('INSERT INTO family.document_series(id,family_id,current_document_id,created_by) VALUES($1,$2,$3,$4)',[series.id,familyId,doc.id,u.accountId]);}
   else await c.query('UPDATE family.document_series SET current_document_id=$2 WHERE id=$1',[series.id,doc.id]);
   await c.query('INSERT INTO family.document_versions(document_id,series_id,revision,request_id,request_hash,created_by) VALUES($1,$2,$3,$4,$5,$6)',[doc.id,series.id,revision,requestId,requestHash,u.accountId]);
   await c.query('INSERT INTO family.document_context(document_id,category,actor_id) VALUES($1,$2,$3)',[doc.id,category,u.accountId]);
   for(const [index,p]of pages.entries())await c.query('INSERT INTO family.document_files(id,document_id,position,original_name,media_type,original_size,stored_size,sha256,storage_key,pdf_pages) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[randomUUID(),doc.id,index+1,p.original_name,p.media_type,p.original_size,p.stored_size,p.sha256,p.storage_key,p.pdf_pages]);
   await this.g.history(c,u,'FAMILY',familyId,b.documentId?'DOCUMENT_VERSION_CREATED':'DOCUMENT_CREATED',b.documentId?{id:b.documentId}:null,{id:doc.id,seriesId:series.id,revision,pages:pages.length,name,category});
   return doc;
  },false);}catch(e){
   if(persisted)await this.storage.reconcile(this.referenced,operation).catch(()=>console.warn('Document cleanup retained in persistent recovery journal.'));
   throw e instanceof AppError?e:new AppError(503,'UPLOAD_FAILED','ذخیره مدرک کامل نشد؛ دوباره تلاش کنید. اگر خطا تکرار شد به مسئول سامانه اطلاع دهید.');
  }finally{if(persisted)await this.storage.reconcile(this.referenced,operation).catch(()=>{});}
 }
 async archive(familyId:string,documentId:string,value:unknown,u:AuthUser,authorize:Authorize){
  const reason=str(input(value).reason,2000);return this.g.tx(u,async c=>{await authorize(c);
   let s=(await c.query('UPDATE family.document_series SET archived=true WHERE current_document_id=$1 AND family_id=$2 AND NOT archived RETURNING id',[id(documentId),familyId])).rows[0];
   if(!s){const legacy=(await c.query('SELECT * FROM family.documents d WHERE id=$1 AND family_id=$2 AND content IS NOT NULL AND NOT EXISTS(SELECT 1 FROM family.document_versions WHERE document_id=d.id) FOR UPDATE',[id(documentId),familyId])).rows[0];if(legacy){s={id:randomUUID()};await c.query('INSERT INTO family.document_series(id,family_id,current_document_id,created_by,archived) VALUES($1,$2,$3,$4,true)',[s.id,familyId,documentId,u.accountId]);await c.query('INSERT INTO family.document_versions(document_id,series_id,revision,request_id,request_hash,created_by) VALUES($1,$2,1,$3,$4,$5)',[documentId,s.id,randomUUID(),hash(legacy.content),u.accountId]);}}
   if(!s)throw new AppError(409,'DOCUMENT','فقط نسخه جاری قابل بایگانی است.');
   await this.g.history(c,u,'FAMILY',familyId,'DOCUMENT_ARCHIVED',{id:documentId},{archived:true},reason);return {ok:true};
  },false);
 }
}
