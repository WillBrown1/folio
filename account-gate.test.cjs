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
