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
  return {getResponseCode:()=>mode==='quota'?429:200,getContentText:()=>JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({category:mode==='invalid'?'=IMPORTXML(x)':mode==='dynamic'?'자동차 · 오토바이':'즐길 거리'})}]}}]})};
 }}});
vm.runInContext(fs.readFileSync(new URL('./Code.gs',import.meta.url),'utf8'),context);
assert.equal(context.classifyAI_('Trace Of Autumn'),'즐길 거리');
for(mode of ['outage','quota','invalid'])assert.equal(context.classifyAI_('요리 레시피'),'요리');
enabled=false;const before=calls;assert.equal(context.classifyAI_('요리 레시피'),'요리');assert.equal(calls,before);
enabled=true;assert.equal(context.classifyAI_('제목 없는 영상'),'미분류');assert.equal(calls,before);
assert.equal(context.classifyAI_('"수건 가져와!" 테니스 신성, 준우승 후 인과응보라는 말까지 나온 이유'),'운동');
assert.equal(context.classifyAI_('Tennis match controversy and highlights'),'운동');
assert.equal(calls,before,'Explicit sports titles must not depend on ambiguous AI guesses');
mode='dynamic';assert.equal(context.classifyAI_('Honda CT70 motorcycle clutch repair',true,['자동차·오토바이']),'자동차·오토바이');
assert.equal(context.classifyAI_('Honda CT70 motorcycle clutch repair',true,[]),'자동차 · 오토바이');
assert.equal(context.categoryName_('전체 영상'),'');assert.equal(context.categoryName_('<script>'),'');
console.log('PASS: AI category validation, private header, missing key, quota and outage fallback');
