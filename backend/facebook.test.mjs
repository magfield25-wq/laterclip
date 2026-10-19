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
