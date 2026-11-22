import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';

const rows=[['id','savedAt','title','url','platform','category','watched','note','device','updatedAt','thumbnailURL']];
const secret='a'.repeat(64);
let writes=0, reads=0;
let audioFolder = null;
// Emulate Sheets' apostrophe escape: the cell is stored as literal text, not a formula.
const literal=v=>typeof v==='string' && v.startsWith("'") ? v.slice(1) : v;
const sheet={
 getDataRange:()=>({getValues:()=>{reads++;return rows.map(r=>[...r]);}}),
 appendRow:r=>{writes++;rows.push(r.map(literal));},
 getRange:(row,col,height,width)=>({setValues:matrix=>{writes++;matrix.forEach((values,i)=>{rows[row-1+i] ||= [];values.forEach((v,j)=>{rows[row-1+i][col-1+j]=literal(v);});});}}),
 deleteRow:()=>{throw Error('Rows must never be permanently deleted');}
};
const context=vm.createContext({Date,JSON,Error,SyntaxError,String,Math,encodeURIComponent,
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>k==='API_TOKEN'?secret:k==='SPREADSHEET_ID'?'sheet-id':k==='AUDIO_FOLDER_ID'?audioFolder:null})},
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

audioFolder='private-folder';
const queued=call({action:'save',url:'https://youtu.be/zyxwvutsrqp'}).clip;
assert.equal(queued.audioStatus,'queued');
assert.equal(rows[0][12],'audio');
assert.equal(call({action:'save',url:queued.url}).clip.audioStatus,'queued');
assert.equal(call({action:'list'}).clips.find(c=>c.id===first.clip.id).audioStatus,'available');
const {job}=call({action:'audioClaim'});
assert.equal(job.videoID,'zyxwvutsrqp');
assert.equal(job.folder,audioFolder);
assert.equal(call({action:'audioClaim'}).job,null);
assert.equal(call({action:'audioFinish',id:queued.id,lease:'wrong'}).ok,false);
assert.equal(call({action:'audioFinish',id:queued.id,lease:job.lease}).ok,true);
assert.equal(call({action:'list'}).clips.find(c=>c.id===queued.id).audioStatus,'failed');
assert.equal(call({action:'audioRetry',id:queued.id}).clip.audioStatus,'queued');
const {job:retry}=call({action:'audioClaim'});
let fileFolder='other-folder';
context.DriveApp={getFileById:id=>{
 assert.equal(id,'mp3-file');
 let hasParent=true;
 return {getParents:()=>({hasNext:()=>hasParent,next:()=>{hasParent=false;return {getId:()=>fileFolder};}}),
  getName:()=>queued.id+'.mp3',isTrashed:()=>false,getMimeType:()=>'audio/mpeg',getId:()=>id,getSize:()=>1024*1024+3};
}};
const finish=()=>call({action:'audioFinish',id:queued.id,lease:retry.lease,fileID:'mp3-file'});
assert.equal(finish().ok,false,'Reject files outside the configured folder');
fileFolder=audioFolder;
assert.equal(finish().ok,true);
assert.equal(finish().ok,true,'Finishing can be retried after a lost response');
assert.equal(call({action:'list'}).clips.find(c=>c.id===queued.id).audioStatus,'ready');
context.ScriptApp={getOAuthToken:()=> 'google-token'};
context.Utilities.base64Encode=bytes=>Buffer.from(bytes).toString('base64');
context.UrlFetchApp.fetch=(url,options)=>{
 assert.equal(options.headers.Range,'bytes=1048576-1048578');
 assert.equal(options.headers.Authorization,'Bearer google-token');
 assert.equal(url,'https://www.googleapis.com/drive/v3/files/mp3-file?alt=media');
 return {getResponseCode:()=>206,getContent:()=>[1,2,3]};
};
assert.equal(call({action:'audioRead',id:queued.id,offset:1}).ok,false);
const chunk=call({action:'audioRead',id:queued.id,offset:1024*1024});
assert.equal(chunk.data,'AQID');
assert.equal(chunk.nextOffset,chunk.size);
console.log('PASS: automatic audio queue, exclusive claim, failure retry, private Drive file validation and ranged playback');
