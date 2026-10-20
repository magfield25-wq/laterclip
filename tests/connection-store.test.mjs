import assert from 'node:assert/strict';
import {createConnectionStore} from '../web/connection-store.js';
const key='laterclip.connection.v1',data={endpoint:'https://script.google.com/macros/s/test/exec',token:'a'.repeat(64)};
function storage(){const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};}
const local=storage(),oldTab=storage();oldTab.setItem(key,JSON.stringify(data));
let store=createConnectionStore(()=>local,()=>oldTab);
assert.deepEqual(store.read(),data);assert.equal(local.getItem(key),null); // Legacy tab consent does not silently persist.
assert.equal(store.write(data),true);assert.equal(oldTab.getItem(key),null);
store=createConnectionStore(()=>local,()=>storage()); // New browser session, same local storage.
assert.deepEqual(store.read(),{...data,remember:true});
assert.equal(store.write(null),true);assert.equal(store.read(),null);
local.setItem(key,'broken JSON');assert.equal(store.read(),null);
const blocked=()=>{throw Error('Storage blocked');};
store=createConnectionStore(blocked,blocked);assert.equal(store.read(),null);assert.equal(store.write(data),false);
console.log('PASS: explicit durable storage, restart reconnect, legacy consent, disconnect cleanup, corrupt/blocked storage');
