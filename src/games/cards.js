/**
 * Dou Dizhu rule recognizer; adapted from liukaijv/poker-ddz CardRule.
 * Original Copyright (c) 2018 noop, MIT; see vendor/poker-ddz.LICENSE.
 * Changes: immutable integer cards, correct group ranking, wing validation,
 * explicit ambiguous-plane handling, comparison and bounded move generation.
 */
export const rank = c => c < 52 ? Math.floor(c / 4) + 3 : c - 36;
export const sortCards = cards => [...cards].sort((a,b) => rank(b)-rank(a) || b-a);
export const TYPES = {
  single:'单张', pair:'对子', triple:'三张', triple1:'三带一', triple2:'三带一对',
  straight:'顺子', pairs:'连对', plane:'飞机', plane1:'飞机带单', plane2:'飞机带对',
  four2:'四带二', four22:'四带两对', bomb:'炸弹', rocket:'王炸'
};
export function groups(cards) {
  const g = new Map();
  for (const c of cards) { const r = rank(c); if (!g.has(r)) g.set(r,[]); g.get(r).push(c); }
  return new Map([...g].sort((a,b) => a[0]-b[0]));
}
export function possibleStraight(ranks) {
  const a = [...ranks].map(Number).sort((a,b)=>b-a);
  return a.length >= 2 && a[0] < 15 && a.every((v,i) => !i || a[i-1] - v === 1);
}
export function recognize(cards, preferred = null) {
  if (!Array.isArray(cards) || !cards.length || cards.length>20 || new Set(cards).size!==cards.length || cards.some(c=>!Number.isInteger(c)||c<0||c>53)) return null;
  const g=groups(cards), n=cards.length, rs=[...g.keys()], sizes=[...g.values()].map(a=>a.length);
  const out=[], add=(type,r)=>out.push({type,rank:r,size:n});
  const of = k => rs.filter(r=>g.get(r).length===k);
  if(n===1) add('single',rs[0]);
  if(n===2 && sizes[0]===2) add('pair',rs[0]);
  if(n===2 && rs[0]===16 && rs[1]===17) add('rocket',17);
  if(n===3 && sizes[0]===3) add('triple',rs[0]);
  if(n===4 && sizes[0]===4) add('bomb',rs[0]);
  if(n===4 && of(3).length===1) add('triple1',of(3)[0]);
  if(n===5 && of(3).length===1 && of(2).length===1) add('triple2',of(3)[0]);
  if(n>=5 && rs.length===n && possibleStraight(rs)) add('straight',rs.at(-1));
  if(n>=6 && n%2===0 && sizes.every(x=>x===2) && possibleStraight(rs)) add('pairs',rs.at(-1));
  if(n>=6 && n%3===0 && sizes.every(x=>x===3) && possibleStraight(rs)) add('plane',rs.at(-1));
  for (const wing of [1,2]) {
    const k=n/(3+wing);
    if (!Number.isInteger(k)||k<2) continue;
    for(let start=3;start+k-1<=14;start++) {
      const body=Array.from({length:k},(_,i)=>start+i);
      if(!body.every(r=>g.get(r)?.length===3)) continue;
      const rest=rs.filter(r=>!body.includes(r));
      if(wing===1 && rest.reduce((sum,r)=>sum+g.get(r).length,0)===k && rest.every(r=>g.get(r).length<=2) && !(rest.includes(16)&&rest.includes(17))) add('plane1',start+k-1);
      if(wing===2 && rest.length===k && rest.every(r=>g.get(r).length===2)) add('plane2',start+k-1);
    }
  }
  if(n===6 && of(4).length===1 && !(g.has(16)&&g.has(17))) add('four2',of(4)[0]);
  if(n===8 && of(4).length===1 && of(2).length===2) add('four22',of(4)[0]);
  return (preferred && out.filter(x=>x.type===preferred).sort((a,b)=>b.rank-a.rank)[0]) || out[0] || null;
}
export function beats(play, previous) {
  if(!play) return false;
  if(!previous) return true;
  if(previous.type==='rocket') return false;
  if(play.type==='rocket') return true;
  if(play.type==='bomb' && previous.type!=='bomb') return true;
  return play.type===previous.type && play.size===previous.size && play.rank>previous.rank;
}
function combinations(a,k,limit=256) {
  const out=[];
  function walk(start,picked) {
    if(out.length>=limit) return;
    if(picked.length===k) { out.push([...picked]); return; }
    for(let i=start;i<=a.length-(k-picked.length);i++) { picked.push(a[i]); walk(i+1,picked); picked.pop(); if(out.length>=limit) break; }
  }
  if(k>=0&&k<=a.length) walk(0,[]);
  return out;
}
export function legalMoves(hand,previous=null) {
  const g=groups(hand), rs=[...g.keys()], result=[], seen=new Set();
  const wanted = type => !previous || previous.type===type;
  function add(cards) {
    const p=recognize(cards,previous?.type);
    if(!beats(p,previous)) return;
    const key=cards.slice().sort((a,b)=>a-b).join(',');
    if(seen.has(key)) return;
    seen.add(key); result.push({cards:sortCards(cards), ...p});
  }
  for (const r of rs) {
    const a=g.get(r);
    for (const [n,t] of [[1,'single'],[2,'pair'],[3,'triple'],[4,'bomb']]) if(a.length>=n && (wanted(t)||t==='bomb')) add(a.slice(0,n));
    if(a.length>=3) for(const s of rs.filter(s=>s!==r)) {
      if(wanted('triple1')) add([...a.slice(0,3),g.get(s)[0]]);
      if(wanted('triple2') && g.get(s).length>=2) add([...a.slice(0,3),...g.get(s).slice(0,2)]);
    }
    if(a.length===4 && (wanted('four2')||wanted('four22'))) {
      const others=rs.filter(s=>s!==r);
      if(wanted('four2')) {
        const pool=others.flatMap(s=>g.get(s).slice(0,2));
        for(const wing of combinations(pool,2)) add([...a,...wing]);
      }
      if(wanted('four22')) for(const wing of combinations(others.filter(s=>g.get(s).length>=2),2)) add([...a,...wing.flatMap(s=>g.get(s).slice(0,2))]);
    }
  }
  if(g.has(16)&&g.has(17)) add([52,53]);
  for(const [mult,min,t] of [[1,5,'straight'],[2,3,'pairs'],[3,2,'plane']]) {
    if(!wanted(t) && !(mult===3&&(wanted('plane1')||wanted('plane2')))) continue;
    for(let start=3;start<=14;start++) {
      const body=[];
      for(let end=start;end<=14 && g.get(end)?.length>=mult;end++) {
        body.push(...g.get(end).slice(0,mult)); const k=end-start+1;
        if(k<min) continue;
        if(wanted(t)) add(body);
        if(mult===3) {
          const others=rs.filter(r=>r<start||r>end);
          if(wanted('plane1') && k*4<=hand.length && (!previous||previous.size===k*4)) {
            const pool=others.flatMap(r=>g.get(r).slice(0,2));
            for(const wing of combinations(pool,k)) add([...body,...wing]);
          }
          if(wanted('plane2') && k*5<=hand.length && (!previous||previous.size===k*5)) {
            for(const wing of combinations(others.filter(r=>g.get(r).length>=2),k)) add([...body,...wing.flatMap(r=>g.get(r).slice(0,2))]);
          }
        }
      }
    }
  }
  return result.sort((a,b)=> {
    const power = x => x.type==='rocket'?2:x.type==='bomb'?1:0;
    return power(a)-power(b) || (previous ? a.rank-b.rank : b.size-a.size || a.rank-b.rank);
  });
}
