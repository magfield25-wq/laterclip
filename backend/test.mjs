import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';

const rows=[['id','savedAt','title','url','platform','category','watched','note','device','updatedAt','thumbnailURL']];
const secret='a'.repeat(64);
let writes=0, reads=0;
// Emulate Sheets' apostrophe escape: the cell is stored as literal text, not a formula.
const literal=v=>typeof v==='string' && v.startsWith("'") ? v.slice(1) : v;
const sheet={
 getDataRange:()=>({getValues:()=>{reads++;return rows.map(r=>[...r]);}}),
 appendRow:r=>{writes++;rows.push(r.map(literal));},
 getRange:(row,col,height,width)=>({setValues:matrix=>{writes++;matrix.forEach((values,i)=>{rows[row-1+i] ||= [];values.forEach((v,j)=>{rows[row-1+i][col-1+j]=literal(v);});});}}),
 deleteRow:()=>{throw Error('Rows must never be permanently deleted');}
};
const context=vm.createContext({Date,JSON,Error,SyntaxError,String,Math,encodeURIComponent,
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>k==='API_TOKEN'?secret:k==='SPREADSHEET_ID'?'sheet-id':null})},
 LockService:{getScriptLock:()=>({waitLock:()=>{},hasLock:()=>true,releaseLock:()=>{}})},
 SpreadsheetApp:{openById:id=>{assert.equal(id,'sheet-id');return {getSheetByName:name=>name==='Clips'?sheet:null};},flush:()=>{}},
 Utilities:{getUuid:randomUUID},
 UrlFetchApp:{fetch:()=>{throw new Error('Simulated metadata outage');}},
 ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>Object.assign(JSON.parse(text),{getContent:()=>text})})}
});
vm.runInContext(fs.readFileSync(new URL('./Code.gs',import.meta.url),'utf8'),context);
const call=body=>context.doPost({postData:{contents:JSON.stringify({token:secret,...body})}});
assert.equal(call({token:'wrong',action:'list'}).ok,false);
assert.equal(reads,0,'Unauthenticated requests must never read the sheet');
assert.equal(context.doPost({postData:{contents:'broken'}}).ok,false);
let first=call({action:'save',url:'https://youtu.be/abcdefghijk?si=tracking',title:'간단한 요리 레시피',device:'iPhone'});
assert.equal(first.ok,true);assert.equal(first.clip.category,'요리');assert.equal(first.clip.device,'iPhone');
assert.equal(first.clip.url,'https://www.youtube.com/watch?v=abcdefghijk');
assert.equal(first.clip.thumbnailURL,'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg');
const duplicate=call({action:'save',url:'https://www.youtube.com/shorts/abcdefghijk',device:'Mac'});
assert.equal(duplicate.duplicate,true);assert.equal(rows.length,2);
assert.equal(call({action:'save',url:'javascript:alert(1)'}).ok,false);
assert.equal(call({action:'save',url:'https://youtube.com.attacker.example/shorts/abcdefghijk'}).clip.platform,'Web');
const fb=call({action:'save',url:'https://www.facebook.com/reel/123?fbclid=test',device:'iPhone'});
assert.equal(fb.ok,true);assert.equal(fb.clip.title,'제목 없는 영상');assert.equal(fb.clip.category,'미분류');
const updated=call({action:'update',id:first.clip.id,expectedUpdatedAt:first.clip.updatedAt,patch:{watched:true,title:'=IMPORTXML("https://example.com")',category:'배움'}});
assert.equal(updated.ok,true);assert.equal(updated.clip.watched,true);
assert.notEqual(updated.clip.updatedAt,first.clip.updatedAt);
const before=writes;
assert.equal(call({action:'update',id:first.clip.id,expectedUpdatedAt:first.clip.updatedAt,patch:{watched:false}}).conflict,true);
assert.equal(writes,before,'A stale client must not overwrite new data');
assert.equal(call({action:'update',id:first.clip.id,expectedUpdatedAt:updated.clip.updatedAt,patch:{category:'=invalid'}}).ok,false);
assert.equal(context.safeCell_(' =IMPORTXML("x")'),"' =IMPORTXML(\"x\")");
assert.equal(context.safeCell_('ordinary text'),'ordinary text');
assert.equal(call({action:'list'}).clips.length,3);
const archived=call({action:'delete',id:first.clip.id,expectedUpdatedAt:updated.clip.updatedAt});
assert.equal(archived.ok,true);assert.ok(archived.clip.archivedAt);
assert.equal(rows.length,4,'Archive keeps all physical sheet rows');
assert.equal(call({action:'list'}).clips.length,2);
assert.equal(call({action:'list',includeArchived:true}).clips.length,3);
assert.equal(call({action:'restore',id:first.clip.id,expectedUpdatedAt:updated.clip.updatedAt}).conflict,true);
const restored=call({action:'restore',id:first.clip.id,expectedUpdatedAt:archived.clip.updatedAt});
assert.equal(restored.clip.archivedAt,'');assert.equal(restored.clip.watched,true);assert.equal(restored.clip.category,'배움');
const archivedAgain=call({action:'archive',id:first.clip.id,expectedUpdatedAt:restored.clip.updatedAt});
assert.equal(archivedAgain.ok,true);
const resaved=call({action:'save',url:first.clip.url});
assert.equal(resaved.restored,true);assert.equal(resaved.clip.id,first.clip.id);assert.equal(resaved.clip.archivedAt,'');
assert.equal(rows.length,4,'Saving an archived URL restores its original row');
assert.equal(call({action:'unsupported'}).ok,false);
assert.equal(context.callLaterClip({action:'list',token:secret}).ok,true);
assert.equal(context.callLaterClip({action:'list',token:'wrong'}).ok,false);
const custom=call({action:'update',id:fb.clip.id,expectedUpdatedAt:fb.clip.updatedAt,patch:{category:'자동차·오토바이'}});
assert.equal(custom.ok,true);assert.equal(custom.clip.category,'자동차·오토바이');
console.log('PASS: auth, malformed input, URL validation, metadata failure, category rules, cross-format deduplication, formula escaping, revision conflicts, update, list, delete');
