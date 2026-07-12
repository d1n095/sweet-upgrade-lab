// Portar den FIXADE minutesInWindow + splitByDay exakt och testar många fall.
function minutesInWindow(segStart, segEnd, ruleFrom, ruleTo) {
  const dayStart = new Date(segStart); dayStart.setHours(0,0,0,0);
  const segS = (segStart - dayStart)/60000;
  let segE = (segEnd - dayStart)/60000;
  if (segE < segS) segE += 1440;
  const baseWindows = ruleTo <= ruleFrom ? [[ruleFrom,1440],[0,ruleTo]] : [[ruleFrom,ruleTo]];
  const windows = [];
  for (const [f,t] of baseWindows){windows.push([f,t]);windows.push([f+1440,t+1440]);}
  let overlap=0;
  for (const [wF,wT] of windows) overlap += Math.max(0, Math.min(segE,wT)-Math.max(segS,wF));
  return overlap;
}
function splitByDay(start,end){const out=[];let cur=new Date(start);while(cur<end){const nx=new Date(cur);nx.setHours(24,0,0,0);out.push({s:new Date(cur),e:nx<end?nx:new Date(end)});cur=nx;}return out;}
const toMin=h=>{const[a,b]=h.split(":").map(Number);return a*60+(b||0);};

function nightOB(startISO,endISO){
  const start=new Date(startISO); let end=new Date(endISO);
  if(end<=start)end=new Date(end.getTime()+86400000);
  let m=0; for(const seg of splitByDay(start,end)) m+=minutesInWindow(seg.s,seg.e,toMin("22:00"),toMin("06:00"));
  return m;
}
function eveOB(startISO,endISO){ // icke-midnatt-regel 18:00-22:00
  const start=new Date(startISO); let end=new Date(endISO);
  if(end<=start)end=new Date(end.getTime()+86400000);
  let m=0; for(const seg of splitByDay(start,end)) m+=minutesInWindow(seg.s,seg.e,toMin("18:00"),toMin("22:00"));
  return m;
}

const tests=[
  ["22:00->02:00 natt-OB", nightOB("2026-01-10T22:00","2026-01-10T02:00"), 240],
  ["23:00->07:00 natt-OB (natt+morgon)", nightOB("2026-01-10T23:00","2026-01-10T07:00"), 420], // 23-06 = 7h
  ["08:00->16:00 dag, ingen natt-OB", nightOB("2026-01-10T08:00","2026-01-10T16:00"), 0],
  ["18:00->22:00 kväll-OB (icke-midnatt regel)", eveOB("2026-01-10T18:00","2026-01-10T22:00"), 240],
  ["20:00->23:00 kväll-OB bara 18-22 delen", eveOB("2026-01-10T20:00","2026-01-10T23:00"), 120],
  ["00:00->06:00 helt inom natt", nightOB("2026-01-10T00:00","2026-01-10T06:00"), 360],
  ["06:00->22:00 mitt på dan, noll natt", nightOB("2026-01-10T06:00","2026-01-10T22:00"), 0],
  ["21:00->23:00 bara 22-23 är natt", nightOB("2026-01-10T21:00","2026-01-10T23:00"), 60],
];
let pass=0;
for(const [name,got,exp] of tests){
  const ok=got===exp; if(ok)pass++;
  console.log(`${ok?"✓":"✗"} ${name}: ${got}min ${ok?"":"(väntat "+exp+")"}`);
}
console.log(`\n${pass}/${tests.length} testfall gröna`);
