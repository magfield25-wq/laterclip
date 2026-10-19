import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const legacyHeaders=['id','savedAt','title','url','platform','category','watched','note','device','updatedAt','thumbnailURL'];
const legacyClip=['legacy','2026-10-18T00:00:00Z','Original title','https://youtu.be/abcdefghijk','YouTube','운동',true,'My note','Mac','2026-10-18T00:00:00Z','https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg'];
const rows=[[...legacyHeaders],[...legacyClip]],token='x'.repeat(64);
let headerWrites=0;
const sheet={getDataRange:()=>({getValues:()=>rows.map(r=>[...r])}),getRange:(row,col)=>({setValues:values=>{
 assert.equal(row,1);assert.equal(col,12);assert.deepEqual(JSON.parse(JSON.stringify(values)),[['archivedAt']]);
 rows[0][11]='archivedAt';headerWrites++;
}})};
const ctx=vm.createContext({PropertiesService:{getScriptProperties:()=>({getProperty:key=>key==='API_TOKEN'?token:'sheet'})},
 LockService:{getScriptLock:()=>({waitLock(){},hasLock:()=>true,releaseLock(){}})},
 SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet})},
 ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>JSON.parse(text)})}});
vm.runInContext(fs.readFileSync(new URL('./Code.gs',import.meta.url),'utf8'),ctx);
const list=()=>ctx.doPost({postData:{contents:JSON.stringify({token,action:'list',includeArchived:true})}});
let result=list();assert.equal(result.ok,true);assert.equal(result.clips.length,1);assert.equal(result.clips[0].archivedAt,'');
assert.deepEqual(rows[1],legacyClip);assert.deepEqual(rows[0].slice(0,11),legacyHeaders);
list();assert.equal(headerWrites,1,'Migration only appends the missing header once');
console.log('PASS: existing 11-column sheet migrates without changing saved rows');
