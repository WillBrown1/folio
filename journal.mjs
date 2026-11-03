import {queueSharedPractice} from './social-core.mjs';
export const DAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
export const STARTER_LESSONS={'Blackbird':'https://www.youtube.com/watch?v=mEn2SEwZKNE','Dust in the Wind':'https://www.youtube.com/watch?v=tvwsFfmKw6A','Wish You Were Here':'https://www.youtube.com/watch?v=sG_K8sGflBY','Landslide':'https://www.youtube.com/watch?v=SERxZkTyQAg'};
export const DEFAULT_SONGS=[
 ['Randall Collins','Norman Blake'],
 ['Seney Stretch','Billy Strings'],
 ["Debra's Waltz",'Billy Strings'],
 ['Dust In A Baggie','Billy Strings'],
 ['Turmoil and Tinfoil','Billy Strings'],
 ['Groundhog','Doc Watson'],
 ['Columbus Stockade Blues','Doc Watson'],
 ['Ready for the Times to Get Better','Doc Watson'],
 ['Hide and Seek','Billy Strings'],
 ['Little White Church','Billy Strings'],
 ['Whiskey Before Breakfast','Norman Blake'],
 ['Summertime','Doc Watson'],
 ['Pretty Daughter','Billy Strings'],
 ['Beaumont Rag','Tony Rice'],
 ['Senor',"Tim O'Brien"],
 ['Here Comes the Sun','The Beatles'],
 ['Walk on Boy','Doc Watson'],
 ['Ripple','Grateful Dead'],
 ['Althea','Grateful Dead'],
 ['Sugar Magnolia','Grateful Dead'],
 ['Frosty Morn','Doc Watson'],
 ['Black Mountain Rag','Billy Strings'],
 ['Never Going Back Again','Fleetwood Mac']
];
const normalizeSong=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const songKey=(title,artist)=>normalizeSong(title)+'-'+normalizeSong(artist);
function makeDefaultSong([title,artist]){return{id:'default-'+songKey(title,artist),title,artist,bpm:null,minutes:10,lesson:'',notes:'',sample:false,defaultSong:true};}
export function migrateDefaults(state){if(state.defaultsRevision>=2)return state;const oldSamples=new Set([songKey('Blackbird','The Beatles'),songKey('Dust in the Wind','Kansas'),songKey('Wish You Were Here','Pink Floyd'),songKey('Landslide','Fleetwood Mac')]);state.songs=state.songs.filter(s=>{if(!s.sample||!oldSamples.has(songKey(s.title,s.artist)))return true;const used=Object.values(state.logs).some(log=>(log[s.id]||0)>0)||state.schedule.some(day=>day.some(p=>p.songId===s.id))||state.active?.songId===s.id||!!s.notes?.trim();if(used)s.sample=false;return used;});for(const entry of DEFAULT_SONGS){const key=songKey(...entry);if(!state.songs.some(s=>songKey(s.title,s.artist)===key))state.songs.push(makeDefaultSong(entry));}state.defaultsRevision=2;return state;}
export const uid=()=>globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
export function dayKey(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export const weekDay=(date=new Date())=>(date.getDay()+6)%7;
export function monday(date=new Date()){const d=new Date(date);d.setHours(0,0,0,0);d.setDate(d.getDate()-weekDay(d));return d;}
export function freshState(){return{version:1,defaultsRevision:2,songs:DEFAULT_SONGS.map(makeDefaultSong),schedule:Array.from({length:7},()=>[]),scheduleEnabled:false,logs:{},active:null};}
export function secondsFor(state,id,key=dayKey()){return Number(state.logs[key]?.[id])||0;}
export function targetFor(state,id,date=new Date()){const shared=state.sharedPractice?.songs?.find(p=>p.songId===id);if(shared)return shared.minutes*60;return state.scheduleEnabled?state.schedule[weekDay(date)].filter(p=>p.songId===id).reduce((n,p)=>n+p.minutes*60,0):0;}
export function todayQueue(state,date=new Date()){return state.scheduleEnabled?state.schedule[weekDay(date)].filter(p=>state.songs.some(s=>s.id===p.songId)).map(p=>({...p,song:state.songs.find(s=>s.id===p.songId),seconds:secondsFor(state,p.songId,dayKey(date))})):[];}
export function splitTime(start,end){const result=[];let cursor=start;while(cursor<end){const d=new Date(cursor),next=new Date(d);next.setHours(24,0,0,0);const until=Math.min(end,next.getTime());result.push({date:dayKey(d),seconds:(until-cursor)/1000});cursor=until;}return result;}
export function dailyTarget(state,id,date=new Date()){return targetFor(state,id,date)||(state.songs.find(s=>s.id===id)?.minutes||10)*60;}
export function accrue(state,now=Date.now()){const a=state.active;if(!a||!a.running)return null;const elapsed=Math.max(0,now-a.lastAt);if(!elapsed)return null;for(const part of splitTime(a.lastAt,now)){queueSharedPractice(state,a,part);state.logs[part.date]??={};state.logs[part.date][a.songId]=(state.logs[part.date][a.songId]||0)+part.seconds;}a.elapsedMs+=elapsed;a.lastAt=now;const date=dayKey(new Date(now)),goal=dailyTarget(state,a.songId,new Date(now));if(secondsFor(state,a.songId,date)>=goal&&a.goalNotified!==date){a.goalNotified=date;return{songId:a.songId,date,goalReached:true};}return null;}

export function youtubeId(input){if(!input?.trim())return '';const text=input.trim();if(/^[\w-]{11}$/.test(text))return text;try{const u=new URL(text);if(!['www.youtube.com','youtube.com','m.youtube.com','youtu.be','www.youtu.be','www.youtube-nocookie.com','youtube-nocookie.com'].includes(u.hostname.toLowerCase()))return null;const id=u.hostname.endsWith('youtu.be')?u.pathname.split('/')[1]:u.searchParams.get('v')||u.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]+)/)?.[1];return /^[\w-]{11}$/.test(id||'')?id:null;}catch{return null;}}
export function validateState(s){if(!s||s.version!==1||!Array.isArray(s.songs)||s.songs.length>1000||!Array.isArray(s.schedule)||s.schedule.length!==7||!s.logs||typeof s.logs!=='object'||Array.isArray(s.logs))throw Error('This is not a valid repertoire backup.');const ids=new Set();for(const song of s.songs){if(typeof song.id!=='string'||!song.id||ids.has(song.id)||typeof song.title!=='string'||!song.title.trim()||song.title.length>200||typeof song.artist!=='string'||typeof song.notes!=='string'||(song.bpm!==null&&(!Number.isFinite(song.bpm)||song.bpm<20||song.bpm>300))||!Number.isFinite(song.minutes)||song.minutes<1||song.minutes>180||youtubeId(song.lesson)===null)throw Error('A song in this backup is invalid.');ids.add(song.id);}for(const day of s.schedule){if(!Array.isArray(day)||day.length>1000)throw Error('Invalid weekly schedule.');const used=new Set();for(const p of day){if(!ids.has(p.songId)||used.has(p.songId)||!Number.isFinite(p.minutes)||p.minutes<1||p.minutes>180)throw Error('Invalid schedule entry.');used.add(p.songId);}}for(const[key,logs]of Object.entries(s.logs)){if(!/^\d{4}-\d{2}-\d{2}$/.test(key)||!logs||typeof logs!=='object'||Array.isArray(logs))throw Error('Invalid practice history.');for(const value of Object.values(logs))if(!Number.isFinite(value)||value<0||value>86400)throw Error('Invalid practice duration.');}return s;}

