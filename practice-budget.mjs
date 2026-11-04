const budgetDate=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export const budgetSignature=queue=>JSON.stringify(queue.map(p=>[p.songId,p.minutes]).sort(([a],[b])=>a.localeCompare(b)));
// Allocate whole seconds. A saved plan stays fixed while its timers run.
export function allocateBudget(queue,minutes,logs={}){
 const spent=Object.values(logs).reduce((n,s)=>n+s,0),remaining=Math.max(0,Math.floor(minutes*60-spent));
 const needs=queue.map(p=>Math.max(0,Math.floor(p.minutes*60-(logs[p.songId]||0)))),total=needs.reduce((a,b)=>a+b,0),available=Math.min(remaining,total);
 const shares=needs.map(n=>total?available*n/total:0),whole=shares.map(Math.floor);
 let extra=available-whole.reduce((a,b)=>a+b,0);
 const order=shares.map((n,i)=>({i,fraction:n-whole[i]})).sort((a,b)=>b.fraction-a.fraction||a.i-b.i);
 for(const {i} of order)if(extra>0&&needs[i]>0){whole[i]++;extra--;}
 return Object.fromEntries(queue.map((p,i)=>[p.songId,Math.floor(Math.min(logs[p.songId]||0,p.minutes*60))+whole[i]]));
}
export function makePracticeBudget(queue,minutes,logs={},date=new Date()){
 if(!Number.isInteger(minutes)||minutes<1||minutes>720)throw Error('Choose 1–720 minutes.');
 return {minutes,day:budgetDate(date),signature:budgetSignature(queue),targets:allocateBudget(queue,minutes,logs)};
}
export function applyPracticeBudget(queue,budget,date=new Date()){
 if(!budget)return queue;
 const targets=budget.day===budgetDate(date)&&budget.signature===budgetSignature(queue)?budget.targets:allocateBudget(queue,budget.minutes);
 return queue.map(p=>({...p,minutes:(targets[p.songId]||0)/60})).filter(p=>p.minutes>0);
}
export function validatePracticeBudget(budget){
 if(budget===undefined||budget===null)return;
 if(!Number.isInteger(budget.minutes)||budget.minutes<1||budget.minutes>720||typeof budget.day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(budget.day)||typeof budget.signature!=='string'||budget.signature.length>2000000||!budget.targets||typeof budget.targets!=='object'||Array.isArray(budget.targets)||Object.keys(budget.targets).length>1000||Object.values(budget.targets).some(n=>!Number.isFinite(n)||n<0||n>86400))throw Error('Invalid daily practice limit.');
}
