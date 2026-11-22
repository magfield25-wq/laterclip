const storeName = 'downloads';
let database;

function open() {
 if (!database) {
  database = new Promise((resolve,reject)=>{
   const request = indexedDB.open('laterclip-offline-audio',1);
   request.onupgradeneeded = ()=>request.result.createObjectStore(storeName,{keyPath:'id'});
   request.onerror = ()=>reject(request.error);
   request.onsuccess = ()=>resolve(request.result);
  }).catch(error=>{
   database = null;
   throw error;
  });
 }
 return database;
}

async function transaction(mode,operation) {
 const db = await open();
 return new Promise((resolve,reject)=>{
  const tx = db.transaction(storeName,mode);
  const request = operation(tx.objectStore(storeName));
  tx.oncomplete = ()=>resolve(request.result);
  tx.onabort = ()=>reject(tx.error || request.error);
 });
}

export async function listDownloads() {
 const items = await transaction('readonly',store=>store.getAll());
 return items.filter(item=>item.audio?.size).map(({id,title,platform,downloadedAt,audio})=>
  ({id,title,platform,downloadedAt,size:audio.size}));
}

export async function readDownload(id) {
 return (await transaction('readonly',store=>store.get(id)))?.audio;
}

export async function saveDownload({id,title,platform},audio) {
 await transaction('readwrite',store=>store.put({id,title,platform,audio,downloadedAt:Date.now()}));
}

export async function removeDownload(id) {
 await transaction('readwrite',store=>store.delete(id));
}
