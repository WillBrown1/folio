const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
test('a new browser gets signup and cannot navigate to the journal before authentication',async()=>{
 const elements=new Map(),listeners={},classes=new Set();
 function element(id){if(!elements.has(id))elements.set(id,{id,innerHTML:'',textContent:'',dataset:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},addEventListener(){},querySelector(){return null;},close(){},append(){}});return elements.get(id);}
 const document={documentElement:{dataset:{theme:'light'}},body:{append(){},classList:{toggle(name,on){on?classes.add(name):classes.delete(name);}}},getElementById:element,createElement:()=>element('dialog'),querySelector:()=>({content:''}),querySelectorAll:()=>[],addEventListener:(name,fn)=>{(listeners[name]??=[]).push(fn);},activeElement:null};
 let clientOptions;const storage=new Map(),auth={onAuthStateChange(){},async getSession(){return{data:{session:null}};}};
 const context={document,window:{addEventListener(){}},navigator:{},location:{href:'https://example.test/',search:''},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},URL,URLSearchParams,FormData,crypto:globalThis.crypto,setInterval:()=>({unref(){}}),clearInterval(){},setTimeout:()=>0,clearTimeout(){},fetch:async()=>({ok:true,json:async()=>({supabaseUrl:'https://example.supabase.co',supabasePublishableKey:'public'})}),__authModule:{createClient:(_url,_key,options)=>{clientOptions=options;return{auth};}}};
 const bundle=fs.readFileSync('app.bundle.js','utf8').replace("await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm')",'await globalThis.__authModule');
 vm.runInNewContext(bundle,context);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(clientOptions.auth.persistSession,true);
 assert.equal(clientOptions.auth.autoRefreshToken,true);
 assert.equal(typeof clientOptions.auth.storage.getItem,'function');
 assert.equal(typeof clientOptions.auth.storage.setItem,'function');
 assert.equal(clientOptions.auth.storageKey,'sb-example-auth-token');
 assert.ok(classes.has('auth-required'));
 assert.match(element('main').innerHTML,/<h2>Create account<\/h2>/);
 assert.match(element('main').innerHTML,/autocomplete="new-password"/);
 assert.doesNotMatch(element('main').innerHTML,/Scheduled today|song-list/);
 const before=element('main').innerHTML;
 for(const listener of listeners.click)await listener({target:{closest:selector=>selector==='[data-action],[data-view]'?{}:null}});
 assert.equal(element('main').innerHTML,before);
});

test('returning visits and page resume restore a saved account without showing signup',async()=>{
 const {freshState}=await import('./journal.mjs'),{journalDocument}=await import('./cloud-journal.mjs');
 const user={id:'saved-account',user_metadata:{display_name:'Saved player'}},key='sb-example-auth-token',sharedStorage=new Map([[key,JSON.stringify({user})]]);
 async function visit(){
  const elements=new Map(),classes=new Set(),windowEvents={};let sessionReads=0;
  function element(id){if(!elements.has(id))elements.set(id,{id,innerHTML:'',textContent:'',dataset:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},addEventListener(){},querySelector(){return null;},close(){},append(){}});return elements.get(id);}
  const document={documentElement:{dataset:{theme:'light'}},body:{append(){},classList:{toggle(name,on){on?classes.add(name):classes.delete(name);}}},getElementById:element,createElement:()=>element('dialog'),querySelector:()=>({content:''}),querySelectorAll:()=>[],addEventListener(){},activeElement:null,hidden:false,visibilityState:'visible'};
  const profile={id:user.id,display_name:'Saved player',friend_code:'code',share_practice:false};
  const client={from(table){const chain={select(){return this;},eq(){return this;},range(){return this;},async maybeSingle(){return{data:{revision:1,document:journalDocument(freshState())}};},then(resolve,reject){return Promise.resolve({data:table==='repertoire_profiles'?[profile]:[]}).then(resolve,reject);}};return chain;},async rpc(){return{data:[]};},channel(){return{on(){return this;},subscribe(){return this;}};},async removeChannel(){}};
  const context={document,window:{addEventListener:(name,fn)=>{windowEvents[name]=fn;}},navigator:{},location:{href:'https://example.test/',search:''},localStorage:{getItem:k=>sharedStorage.get(k)||null,setItem:(k,v)=>sharedStorage.set(k,v),removeItem:k=>sharedStorage.delete(k)},URL,URLSearchParams,FormData,crypto:globalThis.crypto,setInterval:()=>({unref(){}}),clearInterval(){},setTimeout:(fn)=>{queueMicrotask(fn);return 0;},clearTimeout(){},fetch:async()=>({ok:true,json:async()=>({supabaseUrl:'https://example.supabase.co',supabasePublishableKey:'public'})}),__authModule:{createClient:(_url,_key,options)=>{client.auth={onAuthStateChange(){},async getSession(){sessionReads++;return{data:{session:JSON.parse(await options.auth.storage.getItem(options.auth.storageKey))}};}};return client;}}};
  const bundle=fs.readFileSync('app.bundle.js','utf8').replace("await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm')",'await globalThis.__authModule');
  vm.runInNewContext(bundle,context);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(classes.has('auth-required'),false);assert.match(element('main').innerHTML,/<h1>Practice<\/h1>/);assert.doesNotMatch(element('main').innerHTML,/<h2>Create account/);
  const before=sessionReads;windowEvents.pageshow();await new Promise(resolve=>setImmediate(resolve));assert.ok(sessionReads>before);assert.equal(classes.has('auth-required'),false);
 }
 await visit();await visit();
});
