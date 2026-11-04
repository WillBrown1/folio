export const CONFIDENCE=['Not rated','Starting','Building','Getting there','Solid','Ready'];
export const focusDay=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export function shiftFocusDay(key,days){const date=new Date(key+'T12:00:00');date.setDate(date.getDate()+days);return focusDay(date);}
export function migrateFocus(state){
 if(state.focusRevision>=1)return state;
 const missing=state.songs.filter(song=>song.focused===undefined),scheduled=[...new Set((state.schedule||[]).flat().map(p=>p.songId))];
 const recent=state.songs.filter(s=>Object.values(state.logs).some(log=>(log[s.id]||0)>0)).sort((a,b)=>lastPractice(state,b.id).localeCompare(lastPractice(state,a.id)));
 const selected=new Set([...scheduled,...recent.map(s=>s.id),...state.songs.map(s=>s.id)].slice(0,3));
 for(const song of state.songs){song.stage??='learning';song.rating??=0;if(missing.includes(song))song.focused=song.stage==='learning'&&selected.has(song.id);}
 state.focusRevision=1;return state;
}
export function lastPractice(state,id,before=null){return Object.keys(state.logs).filter(day=>(!before||day<before)&&(state.logs[day]?.[id]||0)>0).sort().at(-1)||'';}
export function reviewDue(state,song,date=new Date()){
 if(song.review?.nextDate)return song.review.nextDate;
 const last=lastPractice(state,song.id,focusDay(date));return last?shiftFocusDay(last,song.review?.interval||3):focusDay(date);
}
export function focusQueue(state,date=new Date()){
 const day=focusDay(date),learning=state.songs.filter(s=>s.stage!=='maintaining'&&s.focused).slice(0,3);
 const maintaining=state.songs.filter(s=>s.stage==='maintaining'&&(reviewDue(state,s,date)<=day||(state.logs[day]?.[s.id]||0)>0||s.review?.lastDate===day)).sort((a,b)=>{
  const aDone=(state.logs[day]?.[a.id]||0)>0||a.review?.lastDate===day,bDone=(state.logs[day]?.[b.id]||0)>0||b.review?.lastDate===day;
  return Number(bDone)-Number(aDone)||reviewDue(state,a,date).localeCompare(reviewDue(state,b,date))||a.id.localeCompare(b.id);
 }).slice(0,2);
 return [...learning,...maintaining].map(song=>({songId:song.id,minutes:song.minutes,song,seconds:Number(state.logs[day]?.[song.id])||0,kind:song.stage==='maintaining'?'maintaining':'learning'}));
}
export function setSongStage(song,stage,date=new Date()){
 if(!['learning','maintaining'].includes(stage))throw Error('Choose Learning or Maintaining.');
 if(song.stage===stage)return;
 song.stage=stage;
 if(stage==='maintaining'){song.focused=false;song.review={interval:3,nextDate:focusDay(date),lastDate:null,feedback:null};}
}
export function toggleSongFocus(state,id){const song=state.songs.find(s=>s.id===id);if(!song)return;
 if(song.stage==='maintaining')throw Error('Move this song to Learning first.');
 if(!song.focused&&state.songs.filter(s=>s.stage!=='maintaining'&&s.focused).length>=3)throw Error('Choose up to 3 learning songs.');
 song.focused=!song.focused;
}
export function recordFeedback(song,feedback,date=new Date()){
 if(!['struggled','okay','comfortable'].includes(feedback))throw Error('Choose a practice result.');
 const day=focusDay(date),previous=(song.review?.lastDate===day?song.review.previousInterval:song.review?.interval)||3,interval=feedback==='struggled'?1:feedback==='okay'?Math.max(2,Math.min(7,previous)):Math.min(30,Math.max(3,previous*2));
 song.review={interval,previousInterval:previous,nextDate:shiftFocusDay(day,interval),lastDate:day,feedback};return song.review;
}
export function finishSongPractice(song,date=new Date()){if(song?.stage!=='maintaining')return;const day=focusDay(date),interval=song.review?.interval||3,previousInterval=(song.review?.lastDate===day?song.review.previousInterval:interval)||interval;song.review={interval,previousInterval,nextDate:shiftFocusDay(day,interval),lastDate:day,feedback:null};}
export function validateFocus(state){
 if(state.focusRevision!==undefined&&(!Number.isInteger(state.focusRevision)||state.focusRevision<0))throw Error('Invalid focus settings.');
 for(const song of state.songs){
  if(song.stage!==undefined&&!['learning','maintaining'].includes(song.stage))throw Error('Invalid song stage.');
  if(song.rating!==undefined&&(!Number.isInteger(song.rating)||song.rating<0||song.rating>5))throw Error('Invalid song rating.');
  if(song.focused!==undefined&&typeof song.focused!=='boolean')throw Error('Invalid song focus.');
  if(song.review!==undefined){const r=song.review;if(!r||!Number.isInteger(r.interval)||r.interval<1||r.interval>30||(r.previousInterval!==undefined&&(!Number.isInteger(r.previousInterval)||r.previousInterval<1||r.previousInterval>30))||!/^\d{4}-\d{2}-\d{2}$/.test(r.nextDate)||shiftFocusDay(r.nextDate,0)!==r.nextDate||(r.lastDate!==null&&(!/^\d{4}-\d{2}-\d{2}$/.test(r.lastDate)||shiftFocusDay(r.lastDate,0)!==r.lastDate))||(r.feedback!==null&&!['struggled','okay','comfortable'].includes(r.feedback)))throw Error('Invalid practice review.');}
 }
 return state;
}
