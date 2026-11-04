export const canonicalSong=(title,artist)=>[title,artist].map(value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'')).join('-');
export function syncPracticeSets(state,sets){
 const before=JSON.stringify(state.sharedSets||[]),count=state.songs.length;
 state.sharedSets=[...sets].sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id)).map(group=>({id:group.id,name:group.name,songs:group.songs.map(entry=>{
  let song=state.songs.find(s=>canonicalSong(s.title,s.artist)===entry.song_key);
  if(!song){song={id:globalThis.crypto.randomUUID(),title:entry.title,artist:entry.artist,bpm:entry.bpm,minutes:entry.minutes,notes:'',lesson:'',sample:false,stage:'learning',rating:0,focused:false};state.songs.push(song);}
  return {songId:song.id,minutes:entry.minutes};
 })}));
 const changed=before!==JSON.stringify(state.sharedSets)||count!==state.songs.length||!!state.sharedPractice;
 state.sharedPractice=null;return changed;
}
export function queueSharedPractice(state,active,part){if(!state.sharingAccount||!part.seconds)return;if(active.socialAccount!==state.sharingAccount){active.socialAccount=state.sharingAccount;active.socialDates={};}active.socialDates??={};state.socialQueue??=[];let slot=active.socialDates[part.date];if(!slot||typeof slot==='string')slot=active.socialDates[part.date]={id:globalThis.crypto.randomUUID(),seconds:0};slot.seconds=Math.min(86400,slot.seconds+part.seconds);let record=state.socialQueue.find(r=>r.id===slot.id);if(!record){const song=state.songs.find(s=>s.id===active.songId);if(!song)return;record={id:slot.id,accountId:state.sharingAccount,date:part.date,songKey:canonicalSong(song.title,song.artist),title:song.title,artist:song.artist,seconds:slot.seconds};state.socialQueue.push(record);}else record.seconds=slot.seconds;}
export function acknowledgeSharedRecords(state,sent){const values=new Map(sent.map(r=>[r.id,r.seconds]));state.socialQueue=(state.socialQueue||[]).filter(r=>!values.has(r.id)||r.seconds>values.get(r.id));}
export function addSharedSet(state,set){const songs=[];for(const entry of set.songs){let song=state.songs.find(s=>canonicalSong(s.title,s.artist)===entry.song_key);if(!song){song={id:globalThis.crypto.randomUUID(),title:entry.title,artist:entry.artist,bpm:entry.bpm,minutes:entry.minutes,notes:'',lesson:'',sample:false};state.songs.push(song);}songs.push({songId:song.id,minutes:entry.minutes});}state.sharedPractice={id:set.id,name:set.name,songs};return songs;}
