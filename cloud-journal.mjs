import {validateState,freshState} from './journal.mjs';
const copy=value=>JSON.parse(JSON.stringify(value));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function journalDocument(state){return copy({version:1,defaultsRevision:state.defaultsRevision||2,focusRevision:state.focusRevision||0,songs:state.songs,schedule:state.schedule,scheduleEnabled:!!state.scheduleEnabled,logs:state.logs});}
export function importLegacyJournal(remote,legacy){
 const out=copy(remote),map=new Map(),key=s=>(s.title+'|'+s.artist).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9|]/g,'');
 for(const song of legacy.songs){let target=out.songs.find(s=>s.id===song.id||key(s)===key(song));if(!target){target=copy(song);out.songs.push(target);}else{for(const field of ['notes','lesson'])if(!target[field]&&song[field])target[field]=song[field];}map.set(song.id,target.id);}
 for(const[day,logs]of Object.entries(legacy.logs)){out.logs[day]??={};for(const[id,seconds]of Object.entries(logs)){const mapped=map.get(id)||id;out.logs[day][mapped]=Math.max(out.logs[day][mapped]||0,seconds);}}
 for(let i=0;i<7;i++)for(const plan of legacy.schedule[i]){const songId=map.get(plan.songId);if(songId&&!out.schedule[i].some(p=>p.songId===songId))out.schedule[i].push({...plan,songId});}
 out.scheduleEnabled=out.scheduleEnabled||legacy.scheduleEnabled;return validateState(out);
}
// Three-way merge: independent edits survive; simultaneous edits to one field use this device's edit.
export function mergeJournal(base,local,remote){
 const out=copy(remote),before=new Map(base.songs.map(s=>[s.id,s])),here=new Map(local.songs.map(s=>[s.id,s])),there=new Map(remote.songs.map(s=>[s.id,s]));
 out.songs=[];
 for(const id of new Set([...there.keys(),...here.keys()])){const b=before.get(id),l=here.get(id),r=there.get(id);if(!l){if(!b&&r)out.songs.push(copy(r));continue;}if(!r){if(!b||!same(l,b))out.songs.push(copy(l));continue;}const song=copy(r);for(const key of new Set([...Object.keys(b||{}),...Object.keys(l)]))if(!same(l[key],b?.[key])){if(l[key]===undefined)delete song[key];else song[key]=copy(l[key]);}out.songs.push(song);}
 out.schedule=remote.schedule.map((day,i)=>copy(same(local.schedule[i],base.schedule[i])?day:local.schedule[i]));
 const ids=new Set(out.songs.map(s=>s.id));out.schedule=out.schedule.map(day=>day.filter(p=>ids.has(p.songId)));
 out.scheduleEnabled=same(local.scheduleEnabled,base.scheduleEnabled)?remote.scheduleEnabled:local.scheduleEnabled;
 out.logs=copy(remote.logs);
 for(const day of new Set([...Object.keys(base.logs),...Object.keys(local.logs)]))for(const id of new Set([...Object.keys(base.logs[day]||{}),...Object.keys(local.logs[day]||{})])){const delta=(local.logs[day]?.[id]||0)-(base.logs[day]?.[id]||0);if(delta){out.logs[day]??={};out.logs[day][id]=Math.max(0,Math.min(86400,(out.logs[day][id]||0)+delta));}}
 out.focusRevision=Math.max(local.focusRevision||0,remote.focusRevision||0);out.defaultsRevision=Math.max(local.defaultsRevision||2,remote.defaultsRevision||2);return validateState(out);
}
export class CloudJournal{
 constructor(hooks){this.hooks=hooks;this.user=null;this.ready=false;this.busy=false;this.pending=false;this.status='';this.interval=setInterval(()=>this.sync().catch(()=>{}),10000);this.interval.unref?.();}
 dispose(){clearInterval(this.interval);clearTimeout(this.timer);}
 key(id=this.user?.id){return 'repertoire.account.'+id;}
 cache(){if(!this.ready)return;try{localStorage.setItem(this.key(),JSON.stringify({state:this.hooks.state(),base:this.base,revision:this.revision,write:this.write}));}catch{this.setStatus('Browser storage unavailable; keep this page open until synced.');}}
 setStatus(text){this.status=text;this.hooks.status(text);}
 changed(){if(!this.ready)return;this.pending=true;this.cache();this.setStatus('Changes saved on this device · syncing');clearTimeout(this.timer);this.timer=setTimeout(()=>this.sync().catch(()=>{}),1500);}
 async connect(user,client){
  if(this.user?.id===user?.id&&this.ready)return;
  if(this.user){await this.sync().catch(()=>{});this.cache();}
  this.ready=false;this.user=user;this.client=client;this.pending=false;this.write=null;clearTimeout(this.timer);
  if(!user){this.hooks.replace(freshState());this.setStatus('Sign in to sync your journal');return;}
  this.setStatus('Loading your journal…');
  let cached;try{cached=JSON.parse(localStorage.getItem(this.key())||'null');if(cached){validateState(cached.state);validateState(cached.base);}}catch{cached=null;}
  let response;try{response=await client.from('repertoire_journals').select('document,revision').eq('user_id',user.id).maybeSingle();if(response.error)throw Error(response.error.message);}catch(error){if(!cached)throw Error('Cannot load your journal. Check your connection and try again.');this.base=cached.base;this.revision=cached.revision;this.write=cached.write;this.hooks.replace(cached.state);this.ready=true;this.pending=true;this.setStatus('Offline · changes saved on this device');return;}
  const row=response.data;
  if(cached?.write){this.base=cached.base;this.revision=cached.revision;this.write=cached.write;this.hooks.replace(cached.state);}
  else if(row){const remote=validateState(row.document);this.base=copy(remote);this.revision=row.revision;let next=cached?{...cached.state,...mergeJournal(cached.base,journalDocument(cached.state),remote)}:{...remote,active:null};if(!localStorage.getItem('repertoire.legacyOwner')){const legacy=this.hooks.legacy();if(legacy)next={...next,...importLegacyJournal(journalDocument(next),journalDocument(legacy))};}this.hooks.replace(next);}
  else{let initial=cached?.state;const claimed=localStorage.getItem('repertoire.legacyOwner');if(!initial&&!claimed){initial=this.hooks.legacy();}initial??=freshState();this.hooks.replace(initial);this.base=journalDocument(freshState());this.revision=0;}
  this.ready=true;this.pending=true;this.cache();await this.sync();
  if(!localStorage.getItem('repertoire.legacyOwner'))localStorage.setItem('repertoire.legacyOwner',user.id);
 }
 async sync(){
  if(!this.ready||this.busy||!this.user)return;
  this.busy=true;const account=this.user.id;
  try{for(let attempt=0;attempt<5;attempt++){
   if(this.user?.id!==account)return;
   if(this.write){const write=this.write,response=await this.client.rpc('repertoire_save_journal',{p_revision:write.revision,p_document:write.document,p_mutation:write.id});if(response.error)throw Error(response.error.message);if(response.data?.saved){const current=this.hooks.state(),latest=mergeJournal(write.captured,journalDocument(current),write.document);this.base=copy(write.document);this.revision=response.data.revision;this.hooks.replace({...current,...latest});}this.write=null;this.cache();}
   const captured=journalDocument(this.hooks.state());
   const result=await this.client.from('repertoire_journals').select('document,revision').eq('user_id',account).maybeSingle();if(result.error)throw Error(result.error.message);
   const row=result.data,remote=row?validateState(row.document):this.base,revision=row?.revision||0;
   const merged=row?mergeJournal(this.base,captured,remote):captured;
   let saved=merged,nextRevision=revision;
   if(!row||!same(merged,remote)){this.write={id:crypto.randomUUID(),revision,document:merged,captured};this.cache();const response=await this.client.rpc('repertoire_save_journal',{p_revision:revision,p_document:merged,p_mutation:this.write.id});if(response.error)throw Error(response.error.message);this.write=null;if(!response.data?.saved){this.cache();continue;}nextRevision=response.data.revision;}
   if(this.user?.id!==account)return;
   const current=this.hooks.state(),latest=mergeJournal(captured,journalDocument(current),saved);
   const changed=!same(journalDocument(current),latest);this.base=copy(saved);this.revision=nextRevision;this.pending=!same(latest,saved);
   if(changed)this.hooks.replace({...current,...latest});this.cache();this.setStatus(this.pending?'Changes saved on this device · syncing':'Synced to your account');return;
  }throw Error('Journal changed on another device; retrying.');}catch(error){this.pending=true;this.cache();this.setStatus('Sync unavailable · changes saved on this device');throw error;}finally{this.busy=false;}
 }
}
