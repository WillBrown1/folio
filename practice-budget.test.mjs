import test from 'node:test';
import assert from 'node:assert/strict';
import {allocateBudget,makePracticeBudget,applyPracticeBudget} from './practice-budget.mjs';
import {freshState,plannedQueue,todayQueue,dailyTarget,dailyPracticeGoal,dayKey,validateState,accrue} from './journal.mjs';
import {journalDocument,mergeJournal} from './cloud-journal.mjs';
const date=new Date(2026,10,5,10),queue=[{songId:'a',minutes:10},{songId:'b',minutes:20}],clone=x=>structuredClone(x);
test('time is divided proportionally with exact whole-second totals and no inflated targets',()=>{
 assert.deepEqual(allocateBudget(queue,15),{a:300,b:600});
 assert.deepEqual(allocateBudget(queue,60),{a:600,b:1200});
 const targets=allocateBudget([{songId:'a',minutes:10},{songId:'b',minutes:10},{songId:'c',minutes:10}],1);
 assert.deepEqual(targets,{a:20,b:20,c:20});
});
test('setting a limit accounts for prior practice and extra songs without discarding recorded time',()=>{
 const logs={a:240.3,extra:180.2},targets=allocateBudget(queue,15,logs);
 assert.equal(targets.a+targets.b+logs.extra<=900,true);
 assert.ok(targets.a>=logs.a);assert.ok(targets.a<600);assert.ok(targets.b<1200);
 assert.deepEqual(logs,{a:240.3,extra:180.2});
 const exhausted=allocateBudget(queue,5,{a:600,extra:10});
 assert.deepEqual(exhausted,{a:600,b:0});
 assert.equal(allocateBudget(queue,15,{a:603.7}).a,600,'a completed target is not inflated to its overrun');
});
test('song goals stay fixed while timers run and the daily preference carries to tomorrow',()=>{
 const state=freshState(),raw=plannedQueue(state,date),id=raw[0].songId;
 state.practiceBudget=makePracticeBudget(raw,15,{},date);
 const goal=dailyTarget(state,id,date);assert.equal(goal,300);
 state.active={songId:id,running:true,lastAt:+date,elapsedMs:0};
 accrue(state,+date+60000);assert.equal(dailyTarget(state,id,date),goal);
 assert.equal(state.logs[dayKey(date)][id],60);
 const tomorrow=new Date(+date+86400000);assert.equal(dailyTarget(state,id,tomorrow),goal);
 assert.equal(dailyPracticeGoal(state,tomorrow),900);
 assert.equal(validateState(state),state);
});
test('shared sets use the same budget while source song targets remain unchanged',()=>{
 const state=freshState(),[a,b]=state.songs;state.sharedPractice={songs:[{songId:a.id,minutes:10},{songId:b.id,minutes:20}]};
 state.practiceBudget=makePracticeBudget(plannedQueue(state,date),15,{},date);
 assert.deepEqual(todayQueue(state,date).map(p=>p.minutes),[5,10]);
 assert.equal(dailyTarget(state,b.id,date),600);assert.equal(b.minutes,10);assert.equal(state.sharedPractice.songs[1].minutes,20);
});
test('plan changes refit to the budget, zero-time songs are deferred, and queue order does not reset a plan',()=>{
 const budget=makePracticeBudget(queue,5,{a:240},date);
 const fitted=applyPracticeBudget(queue,budget,date),reversed=applyPracticeBudget([...queue].reverse(),budget,date);
 assert.equal(fitted[0].minutes,reversed[1].minutes);
 assert.ok(applyPracticeBudget([{songId:'c',minutes:10}],budget,date)[0].minutes<=5);
 assert.deepEqual(applyPracticeBudget(queue,makePracticeBudget(queue,5,{a:600},date),date).map(p=>p.songId),['a']);
});
test('budget sync survives unrelated remote edits, supports removal, and rejects invalid backups',()=>{
 const base=journalDocument(freshState()),local=clone(base),remote=clone(base);
 local.practiceBudget=makePracticeBudget(plannedQueue(local,date),20,{},date);remote.songs[0].notes='remote';
 const merged=mergeJournal(base,local,remote);assert.deepEqual(merged.practiceBudget,local.practiceBudget);assert.equal(merged.songs[0].notes,'remote');
 const removed=clone(merged);delete removed.practiceBudget;assert.equal(mergeJournal(merged,removed,merged).practiceBudget,undefined);
 assert.deepEqual(journalDocument(merged).practiceBudget,merged.practiceBudget);
 for(const value of [0,-1,721,1.5,NaN])assert.throws(()=>makePracticeBudget(queue,value));
 assert.throws(()=>validateState({...base,practiceBudget:{minutes:20,targets:{a:-1}}}));
});
