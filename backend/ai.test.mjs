import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
let mode='success',calls=0,enabled=true;
const context=vm.createContext({PropertiesService:{getScriptProperties:()=>({getProperty:k=>k==='GEMINI_API_KEY'&&enabled?'test-secret':null})},
 UrlFetchApp:{fetch:(url,options)=>{
  calls++;assert.ok(url.startsWith('https://generativelanguage.googleapis.com/v1beta/models/gemini-'));
  assert.ok(!url.includes('test-secret'));assert.equal(options.headers['x-goog-api-key'],'test-secret');
  const payload=JSON.parse(options.payload);assert.equal(payload.contents[0].parts.length,1);
  if(mode==='outage')throw Error('offline');
  return {getResponseCode:()=>mode==='quota'?429:200,getContentText:()=>JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({category:mode==='invalid'?'untrusted':'즐길 거리'})}]}}]})};
 }}});
vm.runInContext(fs.readFileSync(new URL('./Code.gs',import.meta.url),'utf8'),context);
assert.equal(context.classifyAI_('Trace Of Autumn'),'즐길 거리');
for(mode of ['outage','quota','invalid'])assert.equal(context.classifyAI_('요리 레시피'),'요리');
enabled=false;const before=calls;assert.equal(context.classifyAI_('요리 레시피'),'요리');assert.equal(calls,before);
enabled=true;assert.equal(context.classifyAI_('제목 없는 영상'),'미분류');assert.equal(calls,before);
console.log('PASS: AI category validation, private header, missing key, quota and outage fallback');
