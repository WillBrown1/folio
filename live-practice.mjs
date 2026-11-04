import {canonicalSong} from './social-core.mjs';
export const LIVE_TTL_MS=20000;
export function liveSamples(rows,userId,now=Date.now()){
 return [...rows.values()].filter(row=>row.user_id===userId&&row.online&&row.receivedAt<=now&&now-row.receivedAt+(row.ageSeconds||0)*1000<LIVE_TTL_MS);
}
export function livePracticeTotal(saved,rows,userId,date,songKey=null,now=Date.now()){
 const records=saved.filter(r=>r.user_id===userId&&r.practice_day===date&&(!songKey||r.song_key===songKey));
 let total=records.reduce((sum,row)=>sum+Number(row.seconds),0);const stored=new Map(records.map(row=>[row.id,Number(row.seconds)])),events=new Map();
 for(const row of rows.values()){
  if(row.user_id!==userId||row.practice_day!==date)continue;
  for(const event of row.events||[]){if(event.date!==date||(songKey&&event.songKey!==songKey))continue;const extra=row.online&&row.running&&row.active_event===event.id?Math.max(0,Math.min(LIVE_TTL_MS,now-row.receivedAt))/1000:0;events.set(event.id,Math.max(events.get(event.id)||0,Number(event.seconds)+extra));}
 }
 for(const[id,seconds]of events)total+=Math.max(0,seconds-(stored.get(id)||0));return total;
}
export function livePracticeStatus(rows,userId,now=Date.now()){
 const samples=liveSamples(rows,userId,now),active=samples.filter(r=>r.running&&r.song_title).sort((a,b)=>b.receivedAt-a.receivedAt)[0];
 return active?{online:true,practicing:true,title:active.song_title,songKey:active.song_key}:{online:!!samples.length,practicing:false,title:'',songKey:null};
}
export class LivePractice{
 constructor(hooks){this.hooks=hooks;this.rows=new Map();this.recent=new Map();this.user=null;this.enabled=false;this.available=false;this.socketReady=false;try{this.device=sessionStorage.getItem('repertoire.liveDevice')||crypto.randomUUID();sessionStorage.setItem('repertoire.liveDevice',this.device);}catch{this.device=crypto.randomUUID();}this.interval=setInterval(()=>this.publish().catch(()=>{}),5000);this.interval.unref?.();this.poll=setInterval(()=>this.pull().catch(()=>{}),15000);this.poll.unref?.();document.addEventListener('visibilitychange',()=>{this.publish(document.hidden).catch(()=>{});if(!document.hidden)this.pull().catch(()=>{});});window.addEventListener('pagehide',()=>this.publish(true).catch(()=>{}));window.addEventListener('offline',()=>{this.socketReady=false;this.rows.clear();this.hooks.tick();});window.addEventListener('online',()=>{this.publish().catch(()=>{});this.pull().catch(()=>{});});}
 async configure(user,client,enabled){
  if(this.user?.id===user?.id&&this.client===client){const changed=this.enabled!==enabled;this.enabled=enabled;if(changed)await this.publish(!enabled).catch(()=>{});return;}
  if(this.user)await this.stop();this.user=user;this.client=client;this.enabled=enabled;this.rows.clear();this.recent.clear();this.available=false;
  if(!user)return;
  try{const key='repertoire.liveDevice.'+user.id;this.device=sessionStorage.getItem(key)||crypto.randomUUID();sessionStorage.setItem(key,this.device);}catch{this.device=crypto.randomUUID();}
  const account=user.id;
  this.channel=client.channel('repertoire-live-'+account+'-'+this.device);
  for(const event of ['INSERT','UPDATE']){
   this.channel.on('postgres_changes',{event,schema:'public',table:'repertoire_live_sessions'},message=>{if(this.user?.id!==account)return;this.receive(message.new);this.hooks.tick();});
   this.channel.on('postgres_changes',{event,schema:'public',table:'repertoire_practice_sessions'},message=>{if(this.user?.id===account)this.hooks.record(message.new);});
   this.channel.on('postgres_changes',{event,schema:'public',table:'repertoire_profiles'},message=>{if(this.user?.id===account)this.hooks.profile(message.new);});
  }
  this.channel.subscribe(status=>{if(this.user?.id!==account)return;this.socketReady=status==='SUBSCRIBED';if(this.socketReady){this.pull().catch(()=>{});this.publish().catch(()=>{});}else if(['CLOSED','CHANNEL_ERROR','TIMED_OUT'].includes(status)){this.rows.clear();this.hooks.tick();}});
  await this.pull().catch(()=>{});await this.publish().catch(()=>{});
 }
 receive(row,ageSeconds=0){if(!row?.id||!row.user_id||!Array.isArray(row.events))return;const old=this.rows.get(row.id);if(old&&Date.parse(old.updated_at)>Date.parse(row.updated_at))return;this.rows.set(row.id,{...row,ageSeconds:0,receivedAt:Date.now()-Math.max(0,Number(ageSeconds)||0)*1000});}
 async pull(){if(!this.user||this.pulling||document.hidden)return;this.pulling=true;const account=this.user.id;try{const{data,error}=await this.client.rpc('repertoire_live_snapshot');if(error)throw error;if(this.user?.id!==account)return;const ids=new Set();for(const row of data||[]){ids.add(row.id);this.receive(row,row.age_seconds);}for(const id of this.rows.keys())if(!ids.has(id))this.rows.delete(id);this.available=true;this.hooks.tick();}catch(error){this.available=false;throw error;}finally{this.pulling=false;}}
 remember(records){for(const row of records)this.recent.set(row.id,{...row,rememberedAt:Date.now()});for(const[id,row]of this.recent)if(Date.now()-row.rememberedAt>1200000)this.recent.delete(id);}
 payload(offline=false){
  const state=this.hooks.state(),date=this.hooks.date(),active=state.active,song=state.songs.find(s=>s.id===active?.songId),online=this.enabled&&!offline&&!document.hidden;
  const events=new Map();for(const record of [...this.recent.values(),...(state.socialQueue||[])])if(record.accountId===this.user.id&&record.date===date)events.set(record.id,{id:record.id,date:record.date,songKey:record.songKey,seconds:record.seconds});
  const slot=active?.socialAccount===this.user.id?active.socialDates?.[date]:null;
  if(slot&&song)events.set(slot.id,{id:slot.id,date,songKey:canonicalSong(song.title,song.artist),seconds:slot.seconds});
  return{practice_day:date,online,running:online&&!!active?.running&&!!song,song_key:online&&song?canonicalSong(song.title,song.artist):null,song_title:online&&song?song.title:null,active_event:online&&slot?slot.id:null,events:this.enabled?[...events.values()].slice(-100):[]};
 }
 changed(){if(!this.user||!this.enabled)return;const data=this.payload(),key=[data.online,data.running,data.song_key,data.active_event].join('|');if(key===this.lastSignature)return;clearTimeout(this.changeTimer);this.changeTimer=setTimeout(()=>this.publish().catch(()=>{}),100);}
 async publish(offline=false){
  if(!this.user||!this.client||this.publishing||(!this.enabled&&!offline))return;this.publishing=true;const account=this.user.id,data=this.payload(offline);this.lastSignature=[data.online,data.running,data.song_key,data.active_event].join('|');
  try{const{data:row,error}=await this.client.rpc('repertoire_live_heartbeat',{p_device:this.device,p_state:data});if(error)throw error;if(this.user?.id!==account)return;if(row)this.receive(row);this.hooks.tick();}finally{this.publishing=false;}
 }
 async stop(){await this.publish(true).catch(()=>{});const channel=this.channel;this.channel=null;this.user=null;this.rows.clear();this.recent.clear();this.socketReady=false;this.available=false;if(channel)await this.client.removeChannel(channel);this.hooks.tick();}
}
