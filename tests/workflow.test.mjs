import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
test('Local CAPA workflow, validation, conflicts and persistence',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'capa-test-'));const dataFile=path.join(dir,'records.json');
 const fixtures=Array.from({length:8},(_,i)=>({id:`CAPA-2026-${String(i+1).padStart(3,'0')}`,issueDate:'2026-09-01',dueDate:'2026-09-20',week:36,enteredBy:'Test admin',raisedBy:'Test inspector',description:'Synthetic inspection finding',location:'Test location',pic:'Test PIC',company:'Test company',recommendation:'Test recommendation',status:'OPEN',remark:'',photo:'/evidence/test-fixture.png',action:'',rootCause:'',prevention:'',evidence:[],history:[],version:1}));
 fs.writeFileSync(dataFile,JSON.stringify(fixtures));
 const start=()=>{const p=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'3101',CAPA_DATA_FILE:dataFile},stdio:['ignore','pipe','pipe']});return new Promise((resolve,reject)=>{p.stdout.once('data',()=>resolve(p));p.once('error',reject);p.once('exit',code=>{if(code)reject(Error('Server exited '+code));});});};
 let processChild=await start();
 const call=async(method,url,body)=>{const response=await fetch('http://127.0.0.1:3101/api/findings'+url,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});return {status:response.status,data:await response.json()};};
 try{
  let all=(await call('GET','')).data;assert.equal(all.length,8);assert.equal(all.filter(r=>r.photo).length,8);
  let r=all[0];const patch=async data=>call('PATCH','/'+r.id,{version:r.version,...data});
  assert.equal((await patch({operation:'transition',status:'CLOSED'})).status,400);
  assert.equal((await patch({operation:'transition',status:'PENDING_VERIFICATION'})).status,400);
  assert.equal((await patch({operation:'edit',...r,dueDate:'2026-02-30'})).status,400);
  r=(await patch({...r,operation:'edit',action:'Corrective action completed',rootCause:'Storage unavailable',prevention:'Daily inspection'})).data;
  assert.equal((await call('PATCH','/'+r.id,{version:1,operation:'transition',status:'IN_PROGRESS'})).status,409);
  assert.equal((await patch({operation:'upload',name:'fake.png',data:'data:image/png;base64,aGVsbG8='})).status,400);
  const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jX1cAAAAASUVORK5CYII=';
  r=(await patch({operation:'upload',name:'test.png',data:'data:image/png;base64,'+png})).data;
  const evidencePath=path.resolve('public','.'+r.evidence[0].url);
  r=(await patch({operation:'transition',status:'PENDING_VERIFICATION'})).data;assert.equal(r.status,'PENDING_VERIFICATION');
  assert.equal((await patch({operation:'transition',status:'CLOSED'})).status,400);
  r=(await patch({operation:'transition',status:'CLOSED',note:'Photo reviewed'})).data;assert.equal(r.status,'CLOSED');
  assert.equal((await patch({...r,operation:'edit'})).status,400);
  processChild.kill();await new Promise(resolve=>processChild.once('exit',resolve));processChild=await start();
  all=(await call('GET','')).data;assert.equal(all[0].status,'CLOSED');assert.equal(all[0].action,'Corrective action completed');
  r=(await patch({operation:'transition',status:'OPEN',note:'Follow-up required'})).data;assert.equal(r.status,'OPEN');
  const created=await call('POST','',{...r,description:'Test finding'});assert.equal(created.status,201);assert.equal(created.data.id,'CAPA-2026-009');assert.equal(created.data.week,36);
  fs.unlinkSync(evidencePath);
 }finally{processChild.kill();await new Promise(resolve=>processChild.once('exit',resolve));fs.rmSync(dir,{recursive:true,force:true});}
});
