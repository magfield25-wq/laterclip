import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
let mode='normal',requests=[];
const ctx=vm.createContext({UrlFetchApp:{fetch:(url,options)=>{
 requests.push(url);assert.equal(options.followRedirects,false);
 if(mode==='redirect')return {getResponseCode:()=>302,getHeaders:()=>({Location:'https://attacker.example/private'})};
 if(mode==='blocked')throw Error('blocked');
 return {getResponseCode:()=>200,getContentText:()=>'<meta content="16K views &#xb7; 233 reactions | Honda CT70 &amp; classic bike" property="og:title"><meta property="og:image" content="https://scontent.example.fbcdn.net/photo.jpg?a=1&amp;b=2">'};
}}});
vm.runInContext(fs.readFileSync(new URL('./Code.gs',import.meta.url),'utf8'),ctx);
let meta=ctx.metadata_('https://www.facebook.com/reel/123');
assert.equal(meta.title,'Honda CT70 & classic bike');
assert.equal(meta.thumbnailURL,'https://scontent.example.fbcdn.net/photo.jpg?a=1&b=2');
assert.equal(ctx.facebookURL_('https://facebook.com.attacker.example/reel/1'),false);
assert.equal(ctx.facebookURL_('https://facebook.com@attacker.example/reel/1'),false);
assert.equal(ctx.facebookURL_('https://facebook.com:443/reel/1'),false);
mode='redirect';requests=[];assert.equal(ctx.metadata_('https://www.facebook.com/reel/123').title,'');assert.equal(requests.length,1);
mode='blocked';assert.equal(ctx.metadata_('https://www.facebook.com/reel/123').thumbnailURL,'');
console.log('PASS: public Facebook metadata, HTML entities, reversed attributes, redirect allowlist, access failure');

// iPhone Share URLs redirect to a reel with temporary tracking/session parameters.
// Resolve only Facebook redirects and fetch the canonical numeric reel URL.
requests=[];
ctx.UrlFetchApp.fetch=(url,options)=>{
 requests.push(url);assert.equal(options.followRedirects,false);
 if(url.includes('/share/r/'))return {getResponseCode:()=>302,getHeaders:()=>({location:'https://www.facebook.com/reel/1106912448491243/?fs=e&mibextid=wwXIfr&rdid=temporary&share_url=encoded'})};
 assert.equal(url,'https://www.facebook.com/reel/1106912448491243/');
 return {getResponseCode:()=>200,getContentText:()=>'<meta property="og:title" content="공개 릴스 제목"><meta property="og:image" content="https://scontent.example.fbcdn.net/reel.jpg">'};
};
meta=ctx.metadata_('https://www.facebook.com/share/r/example/?mibextid=wwXIfr');
assert.equal(meta.title,'공개 릴스 제목');assert.ok(meta.thumbnailURL.endsWith('/reel.jpg'));
assert.equal(requests.length,2);
assert.equal(ctx.facebookMetadataTarget_('https://m.facebook.com/reel/123/?tracking=1'),'https://www.facebook.com/reel/123/');
assert.equal(ctx.facebookMetadataTarget_('https://facebook.com.attacker.example/reel/123/?x=1'),'https://facebook.com.attacker.example/reel/123/?x=1');
console.log('PASS: iPhone share redirects canonicalized, public metadata retained, lookalike hosts never rewritten');

// Empty app shell is retried once; successful fields are combined without losing data.
requests=[];let pass=0;
ctx.UrlFetchApp.fetch=()=>({getResponseCode:()=>200,getContentText:()=>++pass===1?'<html></html>':'<meta property="og:title" content="Recovered"><meta property="og:image" content="https://a.fbcdn.net/recovered.jpg">'});
meta=ctx.facebookMetadata_('https://www.facebook.com/reel/222/');
assert.equal(meta.title,'Recovered');assert.ok(meta.thumbnailURL);assert.equal(pass,2);
let count=0;ctx.UrlFetchApp.fetch=()=>{count++;return {getResponseCode:()=>302,getHeaders:()=>({Location:'https://www.facebook.com/login/?next=public-post'})};};
meta=ctx.facebookMetadata_('https://www.facebook.com/story.php?story_fbid=123&id=456');
assert.equal(meta.diagnostic,'Facebook 로그인 필요');assert.equal(count,2); // Two public requests; no login or bypass attempt.
assert.equal(ctx.facebookMetadataTarget_('https://www.facebook.com/story.php?story_fbid=123&id=456&rdid=temporary'),'https://www.facebook.com/story.php?story_fbid=123&id=456');
console.log('PASS: bounded retry recovers empty responses; login-required content is detected without following login redirects');

const cached=new Map();ctx.CacheService={getScriptCache:()=>({get:k=>cached.get(k)||null,put:(k,v,ttl)=>{assert.equal(ttl,900);cached.set(k,v);}})};
ctx.SpreadsheetApp={flush(){}};ctx.classifyAI_=()=> '테크';
ctx.facebookMetadata_=()=>({title:'공개 디자인 가이드',thumbnailURL:'https://a.fbcdn.net/recovered.jpg'});
const clips=[{id:'one',url:'https://www.facebook.com/reel/222/',platform:'Facebook',title:'제목 없는 영상',category:'미분류',thumbnailURL:'',updatedAt:'2026-01-01T00:00:00Z',watched:true,note:'내 메모',archivedAt:''}];
let writes=0;const fakeSheet={getRange:(row,col,n,w)=>{assert.equal(row,2);return {setValues:()=>writes++};}};
ctx.retryMissingFacebookMetadata_(clips,[['id'],['one']],fakeSheet);
assert.equal(writes,1);assert.equal(clips[0].category,'테크');assert.equal(clips[0].watched,true);assert.equal(clips[0].note,'내 메모');
ctx.retryMissingFacebookMetadata_(clips,[['id'],['one']],fakeSheet);assert.equal(writes,1);
const manual={...clips[0],title:'직접 쓴 제목',category:'직접 분류',thumbnailURL:''};ctx.applyFacebookMetadata_(manual,[]);
assert.equal(manual.title,'직접 쓴 제목');assert.equal(manual.category,'직접 분류');
console.log('PASS: list retry persists recovered metadata, avoids repeat fetches, preserves watched/notes/manual edits');
assert.equal(ctx.facebookMetadataTarget_('https://www.facebook.com/share/r/ABC123/?mibextid=x'),'https://www.facebook.com/share/r/ABC123/');
// Canonical targets disclosed by a login redirect can still be tried publicly,
// but the login URL itself is never requested.
let seen=[];ctx.UrlFetchApp.fetch=url=>{seen.push(url);return url.includes('/share/')?{getResponseCode:()=>302,getHeaders:()=>({Location:'https://www.facebook.com/login/?next='+encodeURIComponent('https://www.facebook.com/reel/333/')})}:{getResponseCode:()=>200,getContentText:()=>'<meta property="og:title" content="Public"><meta property="og:image" content="https://a.fbcdn.net/public.jpg">'};};
meta=ctx.facebookMetadataAttempt_('https://www.facebook.com/share/r/ABC123/',{});
assert.equal(meta.title,'Public');assert.equal(seen.some(u=>u.includes('/login/')),false);
console.log('PASS: tracking removed; only allowed public canonical targets may be followed from a redirect');
