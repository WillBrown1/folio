import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSong,queueSharedPractice,acknowledgeSharedRecords,addSharedSet,syncPracticeSets} from './social-core.mjs';
import {freshState,accrue,dayKey,dailyTarget,todayQueue,dailyPracticeGoal,validateState} from './journal.mjs';
test('song keys match capitalization, punctuation and diacritics across devices',()=>{assert.equal(canonicalSong('Señor',"Tim O’Brien"),canonicalSong('Senor',"Tim O'Brien"));assert.equal(canonicalSong('Althea','GRATEFUL DEAD'),canonicalSong('althea','Grateful Dead'));assert.notEqual(canonicalSong('Summertime','Doc Watson'),canonicalSong('Summertime','Other Artist'));});
test('practice is not queued without opted-in account sharing',()=>{const s=freshState(),a={songId:s.songs[0].id};queueSharedPractice(s,a,{date:'2026-11-03',seconds:12});assert.equal(s.socialQueue,undefined);});
test('uploads preserve a stable event ID and cumulative seconds after acknowledgment',()=>{const s=freshState(),a={songId:s.songs[0].id};s.sharingAccount='alice';queueSharedPractice(s,a,{date:'2026-11-03',seconds:10});const sent=s.socialQueue.map(r=>({...r})),id=sent[0].id;acknowledgeSharedRecords(s,sent);assert.equal(s.socialQueue.length,0);queueSharedPractice(s,a,{date:'2026-11-03',seconds:5});assert.equal(s.socialQueue[0].id,id);assert.equal(s.socialQueue[0].seconds,15);});
test('acknowledging an older upload does not discard newer elapsed time',()=>{const s=freshState(),a={songId:s.songs[0].id};s.sharingAccount='alice';queueSharedPractice(s,a,{date:'2026-11-03',seconds:10});const sent=s.socialQueue.map(r=>({...r}));queueSharedPractice(s,a,{date:'2026-11-03',seconds:3});acknowledgeSharedRecords(s,sent);assert.equal(s.socialQueue[0].seconds,13);});
test('new accounts never inherit another account event ID or cumulative time',()=>{const s=freshState(),a={songId:s.songs[0].id};s.sharingAccount='alice';queueSharedPractice(s,a,{date:'2026-11-03',seconds:10});s.sharingAccount='bob';queueSharedPractice(s,a,{date:'2026-11-03',seconds:3});assert.equal(s.socialQueue.length,2);assert.notEqual(s.socialQueue[0].id,s.socialQueue[1].id);assert.equal(s.socialQueue[1].accountId,'bob');assert.equal(s.socialQueue[1].seconds,3);});
test('timer integration queues per-day sessions and survives serialization',()=>{const s=freshState(),date=new Date(2026,10,3,23,59,50);s.sharingAccount='alice';s.active={songId:s.songs[0].id,lastAt:+date,elapsedMs:0,targetSeconds:60,running:true};accrue(s,+date+20000);assert.equal(s.socialQueue.length,2);assert.equal(s.socialQueue[0].seconds,10);assert.equal(s.socialQueue[1].seconds,10);const restored=JSON.parse(JSON.stringify(s));accrue(restored,+date+25000);assert.equal(restored.socialQueue[1].seconds,15);assert.equal(restored.socialQueue[1].id,s.socialQueue[1].id);});
test('shared sets reuse existing songs and preserve notes and IDs',()=>{const s=freshState(),song=s.songs[0];song.notes='Keep these notes';const group={id:'set1',name:'Weekly set',songs:[{song_key:canonicalSong(song.title,song.artist),title:song.title,artist:song.artist,bpm:100,minutes:15},{song_key:canonicalSong('New tune','Artist'),title:'New tune',artist:'Artist',bpm:null,minutes:8}]};addSharedSet(s,group);assert.equal(s.songs.length,24);assert.equal(s.sharedPractice.songs[0].songId,song.id);assert.equal(song.notes,'Keep these notes');assert.equal(song.bpm,null);assert.equal(dailyTarget(s,song.id),900);s.sharedPractice=null;assert.equal(dailyTarget(s,song.id),600);});

import {makePracticeBudget} from './practice-budget.mjs';
import {journalDocument} from './cloud-journal.mjs';
test('current sets appear alongside focus automatically without duplicate daily targets',()=>{
 const state=freshState(),song=state.songs[0];song.notes='Private notes';
 const entry={song_key:canonicalSong(song.title,song.artist),title:song.title,artist:song.artist,bpm:120,minutes:15};
 const groups=[{id:'one',name:'Weekly set',songs:[entry,{song_key:canonicalSong('New song','Artist'),title:'New song',artist:'Artist',bpm:null,minutes:5}]},{id:'two',name:'Second set',songs:[{...entry,minutes:20}]}];
 assert.equal(syncPracticeSets(state,groups),true);assert.equal(syncPracticeSets(state,groups),false);
 const queue=todayQueue(state);assert.equal(queue.filter(p=>p.songId===song.id).length,1);assert.equal(dailyTarget(state,song.id),1200);
 assert.equal(queue.length,4);assert.equal(state.songs.length,24);assert.equal(song.minutes,10);assert.equal(song.bpm,null);assert.equal(song.notes,'Private notes');
 assert.equal(validateState(state),state);assert.equal(journalDocument(state).sharedSets,undefined);
 state.practiceBudget=makePracticeBudget(queue,15);assert.ok(todayQueue(state).reduce((sum,p)=>sum+p.minutes,0)<=15.000001);assert.equal(dailyPracticeGoal(state),900);
 syncPracticeSets(state,[]);assert.equal(state.sharedSets.length,0);assert.equal(state.songs.length,24);assert.equal(song.notes,'Private notes');
});
test('set edits and removed membership refresh automatically without removing practice history',()=>{
 const state=freshState(),song=state.songs[0],entry={song_key:canonicalSong(song.title,song.artist),title:song.title,artist:song.artist,bpm:null,minutes:12};
 state.logs[dayKey()]={[song.id]:42};state.sharedPractice={id:'old',songs:[]};
 syncPracticeSets(state,[{id:'one',name:'Before',songs:[entry]}]);assert.equal(state.sharedPractice,null);assert.equal(dailyTarget(state,song.id),720);
 syncPracticeSets(state,[{id:'one',name:'After',songs:[{...entry,minutes:18}]}]);assert.equal(state.sharedSets[0].name,'After');assert.equal(dailyTarget(state,song.id),1080);
 syncPracticeSets(state,[]);assert.equal(dailyTarget(state,song.id),600);assert.equal(state.logs[dayKey()][song.id],42);
});
