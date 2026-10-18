const namespace = 'laterclip';
const randomID = () => [...crypto.getRandomValues(new Uint8Array(16))].map(n=>n.toString(16).padStart(2,'0')).join('');
export function validEndpoint(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'script.google.com' && /^\/macros\/s\/[\w-]+\/exec$/.test(url.pathname) && !url.search && !url.hash ? url.href : null;
  } catch { return null; }
}
export class ClipAPI {
  constructor(endpoint,token) {
    this.endpoint=validEndpoint(endpoint);
    if (!this.endpoint || typeof token!=='string' || token.length<32) throw Error('배포 주소와 개인 연결 키를 확인해 주세요.');
    this.token=token; this.channel=randomID(); this.pending=new Map(); this.source=null; this.destroyed=false;
    this.listener=event=>this.onMessage(event);
    window.addEventListener('message',this.listener);
    this.frame=document.createElement('iframe');
    this.frame.title='비공개 영상 보관함 연결'; this.frame.hidden=true;
    this.frame.referrerPolicy='no-referrer';
    this.ready=new Promise((resolve,reject)=>{this.resolveReady=resolve;this.rejectReady=reject;});
    // Attach a rejection handler immediately, including if a form is closed before connection.
    this.ready.catch(()=>{});
    this.readyTimer=setTimeout(()=>this.rejectReady(Error('연결 시간이 초과됐습니다. Apps Script 배포 주소와 WEB_ORIGIN 설정을 확인해 주세요.')),20000);
    this.frame.src=`${this.endpoint}?view=bridge&channel=${this.channel}`;
    document.body.append(this.frame);
  }
  onMessage(event) {
    const message=event.data;
    if (this.destroyed || !message || message.namespace!==namespace || message.channel!==this.channel) return;
    let host;
    try {host=new URL(event.origin).hostname;} catch {return;}
    if (!/^https:\/\//.test(event.origin) || !/(^|\.)googleusercontent\.com$/.test(host)) return;
    if (message.type==='ready' && !this.source) {
      if (!event.source || event.source===window) return;
      this.source=event.source; this.origin=event.origin; clearTimeout(this.readyTimer); this.resolveReady(); return;
    }
    if (event.source!==this.source || event.origin!==this.origin || message.type!=='response') return;
    const pending=this.pending.get(message.id);
    if (!pending) return;
    clearTimeout(pending.timer);this.pending.delete(message.id);
    if (!message.result?.ok) pending.reject(Error(message.result?.error || '요청을 처리하지 못했습니다.'));
    else pending.resolve(message.result);
  }
  async request(action,fields={}) {
    if (this.destroyed) throw Error('연결이 종료됐습니다. 다시 연결해 주세요.');
    await this.ready;
    const id=randomID();
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.pending.delete(id);reject(Error('응답을 확인하지 못했습니다. 저장 요청이었다면 새로고침으로 확인해 주세요.'));},75000);
      this.pending.set(id,{resolve,reject,timer});
      this.source.postMessage({namespace,channel:this.channel,type:'request',id,payload:{...fields,action,token:this.token}},this.origin);
    });
  }
  close() {
    this.destroyed=true;this.token='';clearTimeout(this.readyTimer);this.rejectReady(Error('연결을 닫았습니다.'));
    window.removeEventListener('message',this.listener);this.frame.remove();
    for(const {reject,timer} of this.pending.values()){clearTimeout(timer);reject(Error('연결을 닫았습니다.'));}
    this.pending.clear();this.source=null;
  }
}
