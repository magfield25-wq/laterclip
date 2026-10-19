import {config} from './config.js';
import {ClipAPI,validEndpoint} from './api.js';
import {thumbnailURL} from './thumbnail.js?v=20261018-facebook1';

const $=selector=>document.querySelector(selector);
const categoryIcons={'요리':'♧','여행':'✈','운동':'↟','배움':'▤','테크':'▣','즐길 거리':'♫','미분류':'▧'};
const librarySections=['전체 영상','아직 안 본 영상','시청 완료'];
const state={clips:[],api:null,busy:false,section:'아직 안 본 영상',editing:null,deleting:null,syncedAt:null};
const sessionKey='laterclip.connection.v1';
const session={
 read(){try{return JSON.parse(sessionStorage.getItem(sessionKey)||'null');}catch{return null;}},
 write(value){try{if(value)sessionStorage.setItem(sessionKey,JSON.stringify(value));else sessionStorage.removeItem(sessionKey);}catch{/* Safari may restrict storage. The in-memory connection still works. */}}
};
let toastTimer;
function renderCategories(){
 const names=[...new Set(state.clips.map(c=>c.category||'미분류'))].sort((a,b)=>a==='미분류'?1:b==='미분류'?-1:a.localeCompare(b,'ko'));
 $('#categories').replaceChildren(...names.map(name=>{
  const button=document.createElement('button');button.dataset.section=name;button.setAttribute('aria-pressed',String(state.section===name));
  const symbol=document.createElement('span');symbol.textContent=categoryIcons[name]||'▦';
  const label=document.createTextNode(name);const count=document.createElement('b');count.textContent=state.clips.filter(c=>(c.category||'미분류')===name).length;
  button.append(symbol,label,count);return button;
 }));
 $('#category-options').replaceChildren(...names.map(name=>{const option=document.createElement('option');option.value=name;return option;}));
 if(!librarySections.includes(state.section)&&!names.includes(state.section))state.section='전체 영상';
}

function safeURL(value) {try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&u.hostname?u.href:null;}catch{return null;}}
function setError(error){$('#error-text').textContent=error?.message||String(error);$('#error-banner').hidden=false;$('#sync-dot').className='status-dot error';$('#sync-status').textContent='연결 실패 · 마지막으로 불러온 목록을 표시합니다';}
function clearError(){$('#error-banner').hidden=true;}
function toast(text){clearTimeout(toastTimer);$('#toast').textContent=text;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,4200);}
function setBusy(busy){state.busy=busy;$('#grid').setAttribute('aria-busy',String(busy));
 for(const selector of ['#add-button','#refresh-button','#save-clip','#confirm-delete','#save-settings','#refresh-metadata','#reclassify-clip'])$(selector).disabled=busy||(!state.api&&['#add-button','#refresh-button'].includes(selector));
 $('#save-clip').textContent=busy?'저장 중…':'저장';$('#save-settings').textContent=busy?'연결 중…':'연결 확인';
 $('#grid').querySelectorAll('button').forEach(b=>b.disabled=busy);
 if(busy){$('#sync-status').textContent='Google Sheets와 연결 중…';$('#sync-dot').className='status-dot busy';}
 else if($('#sync-dot').classList.contains('busy')){
  $('#sync-dot').className=state.api?'status-dot':'status-dot disconnected';
  $('#sync-status').textContent=state.api&&state.syncedAt?`Google Sheets · ${state.syncedAt.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})} 동기화`:'연결 전';
 }
}
function synced(){state.syncedAt=new Date();clearError();$('#sync-status').textContent=`Google Sheets · ${state.syncedAt.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})} 동기화`;$('#sync-dot').className='status-dot';}
function visibleClips(){
 const query=$('#search').value.trim().toLocaleLowerCase(),platform=$('#platform').value;
 return state.clips.filter(c=>(state.section!=='아직 안 본 영상'||!c.watched)&&(state.section!=='시청 완료'||c.watched)&&(librarySections.includes(state.section)||(c.category||'미분류')===state.section)&&(!platform||c.platform===platform)&&(!query||`${c.title} ${c.url} ${c.note}`.toLocaleLowerCase().includes(query)));
}
function render(){
 renderCategories();
 $('#section-title').textContent=state.section;
 const clips=visibleClips();
 $('#subtitle').textContent=state.api?`iPhone과 Mac에서 모아둔 영상 ${clips.length}개`:'마음에 든 영상을 모아두세요.';
 $('[data-total]').textContent=state.clips.length;$('[data-unwatched]').textContent=state.clips.filter(c=>!c.watched).length;$('[data-watched]').textContent=state.clips.filter(c=>c.watched).length;
 document.querySelectorAll('[data-section]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.section===state.section)));
 document.querySelectorAll('[data-category-count]').forEach(b=>b.textContent=state.clips.filter(c=>c.category===b.dataset.categoryCount).length);
 $('#welcome').hidden=!!state.api;$('#empty').hidden=!state.api||clips.length>0;
 const filtering=$('#search').value||$('#platform').value||state.section!=='전체 영상';
 $('#empty-title').textContent=state.clips.length&&filtering?'조건에 맞는 영상이 없습니다':'아직 저장한 영상이 없습니다';
 $('#empty-description').textContent=state.clips.length&&filtering?'검색어나 카테고리를 바꿔보세요.':'Safari의 공유 단축어로 저장하거나 링크를 추가해 주세요.';
 const fragment=document.createDocumentFragment();
 for(const clip of clips){
  const card=$('#video-template').content.cloneNode(true);const article=card.querySelector('article');article.dataset.id=clip.id;
  const url=safeURL(clip.url);
  const title=card.querySelector('.video-title');title.textContent=clip.title||'제목 없는 영상';
  const thumb=card.querySelector('.thumbnail');
  if(url){title.href=url;thumb.href=url;}else{title.removeAttribute('href');thumb.removeAttribute('href');}
  const image=card.querySelector('img');const imageURL=thumbnailURL(clip);
  if(imageURL){image.hidden=false;image.style.opacity='0';image.addEventListener('load',()=>{image.style.opacity='1';});image.addEventListener('error',()=>{image.hidden=true;});image.referrerPolicy='no-referrer';image.src=imageURL;}
  card.querySelector('.video-platform').textContent=clip.platform||'Web';card.querySelector('.category-pill').textContent=clip.category||'미분류';
  const note=card.querySelector('.video-note');note.hidden=!clip.note;note.textContent=clip.note;
  const date=new Date(clip.savedAt);card.querySelector('.video-date').textContent=`${clip.device||'Web'} · ${Number.isNaN(date.getTime())?'날짜 없음':date.toLocaleDateString('ko-KR',{month:'short',day:'numeric'})}`;
  const watch=card.querySelector('.watch-button');watch.textContent=clip.watched?'✓':'○';watch.setAttribute('aria-pressed',String(clip.watched));watch.setAttribute('aria-label',`${clip.title}: ${clip.watched?'미시청':'시청 완료'}으로 변경`);
  fragment.append(card);
 }
 $('#grid').replaceChildren(fragment);
 $('#add-button').disabled=!state.api||state.busy;$('#refresh-button').disabled=!state.api||state.busy;$('#disconnect-button').hidden=!state.api;
}
async function refresh(){
 if(!state.api||state.busy)return;setBusy(true);
 try{const result=await state.api.request('list');if(!Array.isArray(result.clips))throw Error('영상 목록을 받지 못했습니다.');state.clips=result.clips.sort((a,b)=>String(b.savedAt).localeCompare(String(a.savedAt)));synced();render();}
 catch(error){setError(error);}finally{setBusy(false);}
}
function openSettings(){if(state.busy)return;$('#settings-error').hidden=true;$('#endpoint').value=state.api?.endpoint||config.apiURL||'';$('#token').value='';$('#settings-dialog').showModal();}
function openAdd(){if(!state.api||state.busy)return;state.editing=null;$('#clip-form').reset();$('#clip-error').hidden=true;$('#clip-dialog-title').textContent='나중에 볼 영상 저장';$('#edit-fields').hidden=true;$('#url-field').hidden=false;$('#clip-url').required=true;$('#classify-note').hidden=false;$('#clip-dialog').showModal();}
function openEdit(clip){state.editing=clip;$('#clip-error').hidden=true;$('#clip-dialog-title').textContent='영상 정보 수정';$('#edit-fields').hidden=false;$('#url-field').hidden=true;$('#clip-url').required=false;$('#clip-title').value=clip.title;$('#clip-note').value=clip.note||'';$('#clip-category').value=clip.category;$('#clip-watched').checked=clip.watched;$('#classify-note').hidden=true;$('#clip-dialog').showModal();}
function replaceClip(clip){const i=state.clips.findIndex(c=>c.id===clip.id);if(i>=0)state.clips[i]=clip;else state.clips.unshift(clip);}
async function connect(endpoint,token,remember){
 const api=new ClipAPI(endpoint,token);setBusy(true);
 try{
  const result=await api.request('list');if(!Array.isArray(result.clips))throw Error('영상 목록을 받지 못했습니다.');
  state.api?.close();state.api=api;state.clips=result.clips.sort((a,b)=>String(b.savedAt).localeCompare(String(a.savedAt)));state.section='아직 안 본 영상';
  session.write(remember?{endpoint,token}:null);
  $('#token').value='';synced();render();return true;
 }catch(error){api.close();throw error;}finally{setBusy(false);}
}
function disconnect(){if(state.busy)return;state.api?.close();state.api=null;state.clips=[];state.syncedAt=null;session.write(null);$('#token').value='';$('#remember-session').checked=false;clearError();$('#sync-dot').className='status-dot disconnected';$('#sync-status').textContent='연결 전';render();$('#settings-dialog').close();toast('이 기기의 보관함 연결을 해제했습니다.');}

document.addEventListener('click',event=>{
 const button=event.target.closest('button');if(!button)return;
 if(button.dataset.close){if(!state.busy)document.getElementById(button.dataset.close).close();return;}
 if(button.dataset.section){state.section=button.dataset.section;render();return;}
 const card=button.closest('article[data-id]');if(!card||state.busy)return;
 const clip=state.clips.find(c=>c.id===card.dataset.id);if(!clip)return;
 if(button.classList.contains('edit-button'))openEdit(clip);
 else if(button.classList.contains('delete-button')){state.deleting=clip;$('#delete-name').textContent=clip.title;$('#delete-error').hidden=true;$('#delete-dialog').showModal();}
 else if(button.classList.contains('watch-button')){
  setBusy(true);state.api.request('update',{id:clip.id,expectedUpdatedAt:clip.updatedAt,patch:{watched:!clip.watched}}).then(result=>{
   replaceClip(result.clip);synced();render();toast(clip.watched?'미시청으로 변경했습니다.':'시청 완료로 표시했습니다.');
  }).catch(setError).finally(()=>setBusy(false));
 }
});
$('#settings-form').addEventListener('submit',async event=>{
 event.preventDefault();if(state.busy)return;$('#settings-error').hidden=true;
 const endpoint=validEndpoint($('#endpoint').value.trim()),token=$('#token').value.trim();
 if(!endpoint||token.length<32){$('#settings-error').textContent='연결 주소와 32자 이상의 개인 키를 확인해 주세요.';$('#settings-error').hidden=false;return;}
 try{await connect(endpoint,token,$('#remember-session').checked);$('#settings-dialog').close();toast('내 보관함을 연결했습니다.');}
 catch(error){$('#settings-error').textContent=error.message;$('#settings-error').hidden=false;}
});
$('#clip-form').addEventListener('submit',async event=>{
 event.preventDefault();if(state.busy)return;$('#clip-error').hidden=true;const editing=state.editing;
 const title=$('#clip-title').value.trim(),note=$('#clip-note').value.trim();
 const url=safeURL($('#clip-url').value.trim());
 if(!editing&&!url){$('#clip-error').textContent='http 또는 https 영상 링크를 입력해 주세요.';$('#clip-error').hidden=false;return;}
 setBusy(true);
 try{
  const result=editing?await state.api.request('update',{id:editing.id,expectedUpdatedAt:editing.updatedAt,patch:{title,note,category:$('#clip-category').value,watched:$('#clip-watched').checked}}):await state.api.request('save',{url,title,note,device:/iPhone|iPad/.test(navigator.userAgent)?'iPhone':'Mac'});
  if(!result.clip)throw Error('저장 결과를 받지 못했습니다. 새로고침으로 확인해 주세요.');
  replaceClip(result.clip);synced();render();$('#clip-dialog').close();toast(result.duplicate?'이미 저장한 영상입니다.':editing?'영상 정보를 수정했습니다.':'나중에 볼 영상을 저장했습니다.');
 }catch(error){$('#clip-error').textContent=error.message;$('#clip-error').hidden=false;}finally{setBusy(false);}
});
$('#confirm-delete').addEventListener('click',async()=>{
 if(!state.deleting||state.busy)return;const clip=state.deleting;setBusy(true);
 try{await state.api.request('delete',{id:clip.id,expectedUpdatedAt:clip.updatedAt});state.clips=state.clips.filter(c=>c.id!==clip.id);state.deleting=null;synced();render();$('#delete-dialog').close();toast('영상을 삭제했습니다.');}
 catch(error){$('#delete-error').textContent=error.message;$('#delete-error').hidden=false;}finally{setBusy(false);}
});
$('#search').addEventListener('input',render);$('#platform').addEventListener('change',render);
$('#refresh-metadata').addEventListener('click',async()=>{
 if(!state.editing||state.busy)return;
 const clip=state.editing;setBusy(true);$('#clip-error').hidden=true;
 try{
  const result=await state.api.request('refreshMetadata',{id:clip.id,expectedUpdatedAt:clip.updatedAt});
  state.editing=result.clip;state.clips=state.clips.map(c=>c.id===clip.id?result.clip:c);
  $('#clip-title').value=result.clip.title;$('#clip-category').value=result.clip.category;
  synced();render();toast('영상 정보를 갱신했습니다.');
 }catch(error){$('#clip-error').textContent=error.message;$('#clip-error').hidden=false;}
 finally{setBusy(false);}
});
$('#reclassify-clip').addEventListener('click',async()=>{
 if(!state.editing||state.busy)return;
 const clip=state.editing;setBusy(true);$('#clip-error').hidden=true;
 try{
  const result=await state.api.request('reclassify',{id:clip.id,expectedUpdatedAt:clip.updatedAt});
  state.editing=result.clip;replaceClip(result.clip);$('#clip-category').value=result.clip.category;
  synced();render();toast(`카테고리를 ${result.clip.category}(으)로 저장했습니다.`);
 }catch(error){$('#clip-error').textContent=error.message;$('#clip-error').hidden=false;}
 finally{setBusy(false);}
});
$('#settings-button').addEventListener('click',openSettings);$('#connect-button').addEventListener('click',openSettings);
$('#add-button').addEventListener('click',openAdd);$('#disconnect-button').addEventListener('click',disconnect);
$('#refresh-button').addEventListener('click',refresh);$('#retry-button').addEventListener('click',refresh);
for(const id of ['help-button','welcome-help'])document.getElementById(id).addEventListener('click',()=>$('#help-dialog').showModal());
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('cancel',event=>{if(state.busy)event.preventDefault();}));
document.addEventListener('keydown',event=>{
 if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();$('#search').focus();}
 if(event.key.toLowerCase()==='n'&&!event.metaKey&&!event.ctrlKey&&!event.altKey&&!document.querySelector('dialog[open]')&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName))openAdd();
});
setInterval(()=>{if(!document.hidden)refresh();},60000);
render();
try{
 const previous=session.read();
 if(previous?.endpoint&&previous?.token){$('#remember-session').checked=true;connect(previous.endpoint,previous.token,true).catch(error=>{session.write(null);setError(error);});}
}catch{session.write(null);}
