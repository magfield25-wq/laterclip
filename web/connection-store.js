const key='laterclip.connection.v1';
const parse=raw=>{try{const v=JSON.parse(raw||'null');return v&&typeof v.endpoint==='string'&&typeof v.token==='string'&&v.token.length>=32?{endpoint:v.endpoint,token:v.token}:null;}catch{return null;}};
export function createConnectionStore(persistent,temporary) {
 const read=storage=>{try{return parse(storage().getItem(key));}catch{return null;}};
 const remove=storage=>{try{storage().removeItem(key);return true;}catch{return false;}};
 return {
  read(){const saved=read(persistent);return saved?{...saved,remember:true}:read(temporary);},
  write(value){
   if(!value){const a=remove(persistent),b=remove(temporary);return a&&b;}
   try{persistent().setItem(key,JSON.stringify({endpoint:value.endpoint,token:value.token}));remove(temporary);return true;}catch{return false;}
  }
 };
}
