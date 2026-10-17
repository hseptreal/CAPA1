import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
const root=path.dirname(fileURLToPath(import.meta.url));
const file=process.env.CAPA_DATA_FILE || path.join(root,'data/records.json');
if(process.env.VERCEL)throw new Error('Hosted storage and authentication must be configured before deploying this local server.');
fs.mkdirSync(path.dirname(file),{recursive:true});
fs.mkdirSync(path.join(root,'public/evidence'),{recursive:true});
const sourceFile=fs.existsSync(file)?file:path.join(root,'data/seed.json');
let records=fs.existsSync(sourceFile)?JSON.parse(fs.readFileSync(sourceFile,'utf8')):[];
const port=Number(process.env.PORT||3100);
function save(next){fs.writeFileSync(file+'.tmp',JSON.stringify(next,null,2));fs.renameSync(file+'.tmp',file);records=next;}
function fail(message,status=400){throw Object.assign(new Error(message),{status});}
function text(v,max=10000){if(typeof v!=='string'||v.length>max)fail('Invalid text field');return v.trim();}
function date(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||new Date(v+'T00:00:00Z').toISOString().slice(0,10)!==v)fail('Invalid date');return v;}
function fields(b){const o={};for(const k of ['description','location','pic','company','recommendation','enteredBy','raisedBy']){o[k]=text(b[k],k==='description'||k==='recommendation'?10000:200);if(!o[k])fail(k+' is required');}for(const k of ['remark','action','rootCause','prevention'])o[k]=text(b[k]||'');o.issueDate=date(b.issueDate);o.dueDate=date(b.dueDate);if(o.dueDate<o.issueDate)fail('Due date must be on or after issue date');const d=new Date(o.issueDate+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7));o.week=Math.ceil((((d-new Date(Date.UTC(d.getUTCFullYear(),0,1)))/86400000)+1)/7);return o;}
async function body(req){let data='';for await(const part of req){data+=part;if(data.length>12e6)fail('Upload exceeds 8 MB limit',413);}try{return JSON.parse(data);}catch{fail('Invalid JSON');}}
function respond(res,status,data){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
export const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');const pathname=decodeURIComponent(url.pathname);
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');
 if(['POST','PATCH'].includes(req.method)&&req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)fail('Cross-origin request denied',403);
 if(pathname==='/api/findings'&&req.method==='GET')return respond(res,200,records);
 if(pathname==='/api/findings'&&req.method==='POST'){
  const b=await body(req);const f=fields(b);const year=f.issueDate.slice(0,4);const n=Math.max(0,...records.filter(r=>r.id.startsWith('CAPA-'+year+'-')).map(r=>Number(r.id.split('-').at(-1))))+1;
  const r={...f,id:`CAPA-${year}-${String(n).padStart(3,'0')}`,status:'OPEN',photo:'',evidence:[],version:1,history:[{at:new Date().toISOString(),text:'Finding created locally'}]};save([...records,r]);return respond(res,201,r);
 }
 const match=pathname.match(/^\/api\/findings\/([A-Z0-9-]+)$/);
 if(match&&req.method==='PATCH'){
  const b=await body(req);const i=records.findIndex(r=>r.id===match[1]);if(i<0)fail('Finding not found',404);const old=records[i];if(b.version!==old.version)fail('This finding changed. Refresh and try again.',409);
  const r=structuredClone(old);let event='Finding updated';
  if(b.operation==='edit'){if(r.status==='CLOSED')fail('Reopen the finding before editing');Object.assign(r,fields(b));}
  else if(b.operation==='upload'){
   if(r.status==='CLOSED')fail('Reopen the finding before adding evidence');
   const m=typeof b.data==='string'&&b.data.match(/^data:(image\/jpeg|image\/png|application\/pdf);base64,([A-Za-z0-9+/=]+)$/);if(!m)fail('Use a JPG, PNG, or PDF');const bytes=Buffer.from(m[2],'base64');if(bytes.length>8*1024*1024)fail('Maximum file size is 8 MB');
   const mime=m[1];if(!(mime==='image/jpeg'&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255||mime==='image/png'&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||mime==='application/pdf'&&bytes.subarray(0,5).toString()==='%PDF-'))fail('File content does not match its type');
   const name=text(b.name,200);const filename='upload-'+randomUUID()+({'image/jpeg':'.jpg','image/png':'.png','application/pdf':'.pdf'}[mime]);fs.writeFileSync(path.join(root,'public/evidence',filename),bytes);r.evidence.push({name,url:'/evidence/'+filename,type:mime});event='Corrective-action evidence added: '+name;
  }else if(b.operation==='transition'){
   const target=b.status;const allowed={OPEN:['IN_PROGRESS','PENDING_VERIFICATION'],IN_PROGRESS:['PENDING_VERIFICATION'],PENDING_VERIFICATION:['CLOSED','IN_PROGRESS'],CLOSED:['OPEN']};if(!allowed[r.status]?.includes(target))fail('Invalid status transition');
   const note=text(b.note||'');if(target==='PENDING_VERIFICATION'&&(!r.action.trim()||!r.evidence.length))fail('Add corrective action and upload evidence before submitting');if((target==='CLOSED'||target==='OPEN'||r.status==='PENDING_VERIFICATION'&&target==='IN_PROGRESS')&&!note)fail('A verification or reopening note is required');
   r.status=target;event=`Status changed to ${target}${note?': '+note:''}`;
  }else fail('Unknown operation');
  r.version++;r.history.push({at:new Date().toISOString(),text:event});const next=[...records];next[i]=r;save(next);return respond(res,200,r);
 }
 if(pathname.startsWith('/api/'))fail('Not found',404);
 if(req.method!=='GET'&&req.method!=='HEAD')fail('Method not allowed',405);
 const target=path.resolve(root,'public','.'+(pathname==='/'?'/index.html':pathname));if(!target.startsWith(path.join(root,'public')+path.sep))fail('Forbidden',403);
 if(!fs.existsSync(target)||!fs.statSync(target).isFile())fail('Not found',404);
 const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpeg':'image/jpeg','.jpg':'image/jpeg','.png':'image/png','.pdf':'application/pdf'}[path.extname(target)]||'application/octet-stream';
 res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; frame-ancestors 'none'");res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-cache'});if(req.method==='HEAD')res.end();else fs.createReadStream(target).pipe(res);
 }catch(e){respond(res,e.status||500,{error:e.status?e.message:'Unable to save or load data. Please try again.'});}});
server.listen(port,'127.0.0.1',()=>console.log(`CAPA Workshop: http://localhost:${port}`));
