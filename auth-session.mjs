// Use Supabase's existing storage key; retain a second durable browser copy.
// No credentials are logged, sent anywhere new, or stored in cookies.
export function indexedSessionBackup(factory=globalThis.indexedDB){
 let opened;
 function open(){if(!factory)return Promise.resolve(null);if(opened)return opened;opened=new Promise(resolve=>{let request,settled=false;const finish=value=>{if(settled){value?.close();return;}settled=true;clearTimeout(timer);resolve(value);};const timer=setTimeout(()=>finish(null),4000);try{request=factory.open('repertoire-auth',1);request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('sessions'))request.result.createObjectStore('sessions');};request.onsuccess=()=>finish(request.result);request.onerror=()=>finish(null);request.onblocked=()=>finish(null);}catch{finish(null);}});return opened;}
 async function run(mode,key,value){const db=await open();if(!db)return{ok:false,value:null};return new Promise(resolve=>{let transaction,request;try{transaction=db.transaction('sessions',mode==='get'?'readonly':'readwrite');const store=transaction.objectStore('sessions');request=mode==='get'?store.get(key):mode==='set'?store.put(value,key):store.delete(key);transaction.oncomplete=()=>resolve({ok:true,value:mode==='get'?(request.result??null):null});transaction.onerror=transaction.onabort=()=>resolve({ok:false,value:null});}catch{resolve({ok:false,value:null});}});}
 return{get:async key=>(await run('get',key)).value,set:async(key,value)=>(await run('set',key,value)).ok,remove:async key=>(await run('remove',key)).ok};
}
export function persistentSessionStorage(primary,backup=indexedSessionBackup()){
 if(!primary)try{primary=globalThis.localStorage;}catch{}
 return{
  async getItem(key){let value=null;try{value=primary?.getItem(key)??null;}catch{}if(value!==null){await backup.set(key,value);return value;}value=await backup.get(key);if(value!==null)try{primary.setItem(key,value);}catch{}return value;},
  async setItem(key,value){let stored=false;try{primary.setItem(key,value);stored=true;}catch{}const backed=await backup.set(key,value);if(!stored&&!backed)throw Error('This browser cannot remember your sign-in. Open Folio in a regular Safari or Chrome tab.');},
  async removeItem(key){await backup.remove(key);try{primary.removeItem(key);}catch{}}
 };
}
export class SessionQueue{
 constructor(apply){this.apply=apply;this.queue=Promise.resolve();}
 accept(user){this.queue=this.queue.catch(()=>{}).then(()=>this.apply(user));return this.queue;}
}
