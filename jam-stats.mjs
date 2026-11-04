import {canonicalSong} from './social-core.mjs';
export function statsDay(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export function statsShift(day,offset){const date=new Date(day+'T12:00:00');date.setDate(date.getDate()+offset);return statsDay(date);}
export function statsStart(range,today=statsDay()){return range==='today'?today:range==='week'?statsShift(today,-6):range==='month'?statsShift(today,-29):null;}
export function rankPlayers(profiles,getTotal){
 const values=profiles.map(profile=>({...profile,seconds:profile.share_practice?getTotal(profile.id):null}));
 values.sort((a,b)=>(a.seconds===null)-(b.seconds===null)||(b.seconds||0)-(a.seconds||0)||a.display_name.localeCompare(b.display_name)||a.id.localeCompare(b.id));
 let rank=0,previous=null;return values.map((person,index)=>{if(person.seconds!==null){if(previous!==person.seconds)rank=index+1;previous=person.seconds;}return{...person,rank:person.seconds===null?null:rank};});
}
export function friendCatalog(projection,sharedRows){
 const songs=new Map(),ids=new Map(),archivedDays={},journalDays={};
 for(const song of projection?.songs||[]){const key=canonicalSong(song.title,song.artist);ids.set(song.id,key);if(!songs.has(key))songs.set(key,{key,title:song.title,artist:song.artist||'',bpm:song.bpm??null,days:{}});}
 for(const[day,log]of Object.entries(projection?.logs||{})){if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!log||typeof log!=='object')continue;for(const[id,seconds]of Object.entries(log)){if(!Number.isFinite(Number(seconds))||Number(seconds)<=0)continue;journalDays[day]=(journalDays[day]||0)+Number(seconds);const key=ids.get(id);if(!key){archivedDays[day]=(archivedDays[day]||0)+Number(seconds);continue;}const song=songs.get(key);song.days[day]=(song.days[day]||0)+Number(seconds);}}
 const sharedDays=new Map();for(const row of sharedRows){const key=row.song_key;if(!songs.has(key))songs.set(key,{key,title:row.title,artist:row.artist||'',bpm:null,days:{}});const days=sharedDays.get(key)||{};days[row.practice_day]=(days[row.practice_day]||0)+Number(row.seconds);sharedDays.set(key,days);}
 for(const[key,days]of sharedDays)for(const[day,seconds]of Object.entries(days)){const song=songs.get(key);song.days[day]=Math.max(song.days[day]||0,seconds);}
 const attributed=catalogDays([...songs.values()]),residual={};for(const day of Object.keys(archivedDays)){const seconds=Math.max(0,(journalDays[day]||0)-(attributed[day]||0));if(seconds)residual[day]=seconds;}if(Object.keys(residual).length)songs.set('archived-practice',{key:'archived-practice',title:'Archived practice',artist:'Removed songs',bpm:null,days:residual});
 return [...songs.values()].sort((a,b)=>a.title.localeCompare(b.title)||a.artist.localeCompare(b.artist));
}
export function catalogTotal(song,range='all',today=statsDay()){const start=statsStart(range,today);return Object.entries(song.days).reduce((sum,[day,seconds])=>sum+(day<=today&&(!start||day>=start)?seconds:0),0);}
export function catalogDays(songs){const days={};for(const song of songs)for(const[day,seconds]of Object.entries(song.days))days[day]=(days[day]||0)+seconds;return days;}
