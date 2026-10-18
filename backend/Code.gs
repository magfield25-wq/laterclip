/* Bound to the private LaterClip spreadsheet. Deploy instructions: SETUP.md. */
const HEADERS = ['id','savedAt','title','url','platform','category','watched','note','device','updatedAt','thumbnailURL'];
const CATEGORIES = ['요리','여행','운동','배움','테크','즐길 거리','미분류'];

// Editor-visible bootstrap. Disabled permanently after its first successful run.
function initializeLaterClip() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('SETUP_DONE') === 'true') throw new Error('최초 설정이 이미 완료되었습니다.');
  setupLaterClip_();
  props.setProperty('SETUP_DONE','true');
}

// Run once from the editor, then copy API_TOKEN from Project Settings > Script properties.
function setupLaterClip_() {
  const props = PropertiesService.getScriptProperties();
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('시트의 Extensions > Apps Script에서 실행해 주세요.');
  props.setProperty('SPREADSHEET_ID',spreadsheet.getId());
  if (!props.getProperty('API_TOKEN')) props.setProperty('API_TOKEN',(Utilities.getUuid()+Utilities.getUuid()).replace(/-/g,''));
  if (!props.getProperty('WEB_ORIGIN')) props.setProperty('WEB_ORIGIN','https://magfield25-wq.github.io');
  let sheet = spreadsheet.getSheetByName('Clips');
  if (!sheet) sheet = spreadsheet.insertSheet('Clips');
  if (sheet.getLastRow() === 0) sheet.getRange(1,1,1,HEADERS.length).setValues([HEADERS]);
  const existing = sheet.getRange(1,1,1,HEADERS.length).getValues()[0];
  if (HEADERS.some((h,i)=>existing[i]!==h)) throw new Error('기존 데이터는 보존했습니다. Clips 헤더를 확인해 주세요.');
  sheet.setFrozenRows(1);
  sheet.getRange(1,1,1,HEADERS.length).setBackground('#f1f3f4').setFontWeight('bold');
  sheet.setColumnWidth(3,300); sheet.setColumnWidth(4,350);
}

function doGet(e) {
  if (e && e.parameter && e.parameter.view === 'bridge') {
    const channel = String(e.parameter.channel || '');
    if (!/^[a-f0-9]{32}$/.test(channel)) return json_({ok:false,error:'잘못된 연결 요청입니다.'});
    const origin = PropertiesService.getScriptProperties().getProperty('WEB_ORIGIN');
    if (!/^https:\/\/[a-z0-9-]+\.github\.io$/i.test(origin || '')) return json_({ok:false,error:'WEB_ORIGIN 설정을 확인해 주세요.'});
    const template = HtmlService.createTemplateFromFile('Bridge');
    template.allowedOrigin = origin; template.channel = channel;
    return template.evaluate().setTitle('LaterClip connection').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  return json_({ok:true, service:'LaterClip', version:2});
}
// Public RPC entry point. All access still goes through token validation in doPost.
function callLaterClip(request) {
  return JSON.parse(doPost({postData:{contents:JSON.stringify(request)}}).getContent());
}
function doPost(e) {
  let lock;
  try {
    const raw = e && e.postData && e.postData.contents;
    if (!raw || raw.length > 20000) throw new Error('잘못된 요청입니다.');
    const request = JSON.parse(raw);
    const props = PropertiesService.getScriptProperties();
    const secret = props.getProperty('API_TOKEN');
    if (!secret || secret.length < 32 || request.token !== secret) return json_({ok:false,error:'인증 키를 확인해 주세요.'});
    const sheetID = props.getProperty('SPREADSHEET_ID');
    if (!sheetID) throw new Error('SPREADSHEET_ID 설정이 필요합니다.');
    lock = LockService.getScriptLock(); lock.waitLock(25000);
    const sheet = SpreadsheetApp.openById(sheetID).getSheetByName('Clips');
    if (!sheet) throw new Error('Clips 탭이 없습니다.');
    const rows = sheet.getDataRange().getValues();
    if (HEADERS.some((h,i) => rows[0][i] !== h)) throw new Error('시트의 헤더 순서를 확인해 주세요.');
    const clips = rows.slice(1).filter(r => r[0]).map(record_);
    if (request.action === 'list') return json_({ok:true,clips:clips.reverse()});
    if (request.action === 'save') {
      const url = normalizeURL_(request.url);
      const duplicate = clips.find(c => normalizeURL_(c.url) === url);
      if (duplicate) return json_({ok:true,clip:duplicate,duplicate:true});
      const meta = metadata_(url);
      const title = bounded_(request.title, 300) || meta.title || '제목 없는 영상';
      const now = new Date().toISOString();
      const clip = {id:Utilities.getUuid(),savedAt:now,title,url,platform:platform_(url),
        category:classify_(title),watched:false,note:bounded_(request.note,2000),
        device:request.device === 'iPhone' ? 'iPhone' : 'Mac',updatedAt:now,thumbnailURL:meta.thumbnailURL};
      sheet.appendRow(HEADERS.map(h => safeCell_(clip[h])));
      SpreadsheetApp.flush();
      return json_({ok:true,clip,duplicate:false});
    }
    if (request.action === 'update' || request.action === 'delete') {
      const index = rows.findIndex((r,i) => i > 0 && r[0] === request.id);
      if (index < 1) throw new Error('영상을 찾지 못했습니다. 새로고침해 주세요.');
      const clip = record_(rows[index]);
      if (!request.expectedUpdatedAt || request.expectedUpdatedAt !== clip.updatedAt) {
        return json_({ok:false,error:'다른 곳에서 수정된 항목입니다. 새로고침 후 다시 시도해 주세요.',conflict:true});
      }
      if (request.action === 'delete') { sheet.deleteRow(index+1); return json_({ok:true}); }
      const patch = request.patch || {};
      if ('category' in patch) {
        if (!CATEGORIES.includes(patch.category)) throw new Error('지원하지 않는 카테고리입니다.');
        clip.category = patch.category;
      }
      if ('title' in patch) clip.title = bounded_(patch.title,300) || '제목 없는 영상';
      if ('note' in patch) clip.note = bounded_(patch.note,2000);
      if ('watched' in patch) {
        if (typeof patch.watched !== 'boolean') throw new Error('시청 상태가 올바르지 않습니다.');
        clip.watched = patch.watched;
      }
      clip.updatedAt = new Date(Math.max(Date.now(), Date.parse(clip.updatedAt)+1 || 0)).toISOString();
      sheet.getRange(index+1,1,1,HEADERS.length).setValues([HEADERS.map(h => safeCell_(clip[h]))]);
      SpreadsheetApp.flush(); return json_({ok:true,clip});
    }
    throw new Error('지원하지 않는 요청입니다.');
  } catch (error) {
    // No request contents or credentials are written to logs.
    return json_({ok:false,error: error instanceof SyntaxError ? '요청 형식을 확인해 주세요.' : String(error.message || '요청에 실패했습니다.')});
  } finally { if (lock && lock.hasLock()) lock.releaseLock(); }
}

function json_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
function bounded_(value,max) { return typeof value === 'string' ? value.trim().slice(0,max) : ''; }
function safeCell_(v) { return typeof v === 'string' && /^[\s]*[=+@-]/.test(v) ? "'"+v : v; }
function record_(row) {
  const result = {};
  HEADERS.forEach((h,i) => result[h] = row[i] instanceof Date ? row[i].toISOString() : row[i]);
  result.watched = result.watched === true || String(result.watched).toLowerCase() === 'true';
  for (const h of HEADERS) if (h !== 'watched') result[h] = String(result[h] == null ? '' : result[h]);
  return result;
}
function youtubeID_(url) {
  const match = String(url).match(/^https?:\/\/(?:www\.|m\.)?(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|embed\/))([A-Za-z0-9_-]{11})(?:[?&#/]|$)/i);
  return match ? match[1] : '';
}
function normalizeURL_(raw) {
  const text = bounded_(raw,4096);
  if (!/^https?:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::\d+)?(?:[/?#][^\s]*)?$/i.test(text)) throw new Error('http 또는 https 링크를 입력해 주세요.');
  const id = youtubeID_(text);
  if (id) return 'https://www.youtube.com/watch?v='+id;
  const parts = text.split('#')[0].split('?');
  const query = (parts[1] || '').split('&').filter(p => p && !/^(utm_[^=]*|fbclid|si|feature)=/i.test(p));
  return parts[0]+(query.length ? '?'+query.join('&') : '');
}
function platform_(url) {
  if (youtubeID_(url)) return 'YouTube';
  if (/^https?:\/\/(?:[a-z0-9-]+\.)?(facebook\.com|fb\.watch)(?:[/:?#]|$)/i.test(url)) return 'Facebook';
  return 'Web';
}
function metadata_(url) {
  const id = youtubeID_(url);
  const meta = {title:'',thumbnailURL:id ? 'https://i.ytimg.com/vi/'+id+'/hqdefault.jpg' : ''};
  if (!id) return meta;
  try {
    // Only contact YouTube's fixed endpoint; never fetch an arbitrary submitted URL.
    const response = UrlFetchApp.fetch('https://www.youtube.com/oembed?format=json&url='+encodeURIComponent(url), {muteHttpExceptions:true});
    if (response.getResponseCode() === 200) meta.title = bounded_(JSON.parse(response.getContentText()).title,300);
  } catch (_) { /* A metadata failure must not prevent saving the link. */ }
  return meta;
}
function classify_(title) {
  const rules = [
    ['요리',['요리','레시피','맛집','recipe','cooking','baking']],
    ['여행',['여행','관광','travel','hotel']],
    ['운동',['운동','헬스','요가','workout','fitness','pilates']],
    ['테크',['코딩','인공지능','아이폰','프로그래밍','coding','swift','technology']],
    ['배움',['강의','공부','영어','역사','tutorial','lesson','science']],
    ['즐길 거리',['음악','코미디','웃긴','영화','music','comedy','funny']]
  ];
  let best = '미분류', score = 0;
  for (const [category,words] of rules) {
    const count = words.filter(w => title.toLowerCase().includes(w)).length;
    if (count > score) { best = category; score = count; }
  }
  return best;
}

// In a sheet-bound script, manual sheet edits also invalidate stale app edits.
function onEdit(e) {
  if (!e || e.range.getSheet().getName() !== 'Clips' || e.range.getRow() < 2) return;
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    for (let row=e.range.getRow(); row<=e.range.getLastRow(); row++) {
      e.range.getSheet().getRange(row,10).setValue(new Date().toISOString());
    }
  } finally { lock.releaseLock(); }
}
