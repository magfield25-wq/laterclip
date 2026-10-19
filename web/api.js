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
    this.token=token; this.destroyed=false; this.pending=new Set();
  }
  async request(action,fields={}) {
    if (this.destroyed) throw Error('연결이 종료됐습니다. 다시 연결해 주세요.');
    const controller=new AbortController();
    this.pending.add(controller);
    const timer=setTimeout(()=>controller.abort(),75000);
    try {
      // A simple CORS request needs no preflight. Never send Google cookies or put the key in a URL.
      const response=await fetch(this.endpoint,{
        method:'POST',mode:'cors',credentials:'omit',redirect:'follow',referrerPolicy:'no-referrer',
        headers:{'Content-Type':'text/plain;charset=UTF-8'},
        body:JSON.stringify({...fields,action,token:this.token}),signal:controller.signal
      });
      if (!response.ok) throw Error('서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      let result;
      try {result=await response.json();} catch {throw Error('서버 응답을 읽지 못했습니다. 배포 주소를 확인해 주세요.');}
      if (!result?.ok) throw Error(result?.error || '요청을 처리하지 못했습니다.');
      return result;
    } catch(error) {
      if (this.destroyed) throw Error('연결이 종료됐습니다. 다시 연결해 주세요.');
      if (controller.signal.aborted) throw Error('응답 시간이 초과됐습니다. 저장 요청이었다면 새로고침으로 확인해 주세요.');
      if (error instanceof TypeError) throw Error('서버에 연결하지 못했습니다. 인터넷 연결과 배포 주소를 확인해 주세요.');
      throw error;
    } finally {clearTimeout(timer);this.pending.delete(controller);}
  }
  close() {
    this.destroyed=true;this.token='';
    for(const controller of this.pending)controller.abort();
    this.pending.clear();
  }
}
