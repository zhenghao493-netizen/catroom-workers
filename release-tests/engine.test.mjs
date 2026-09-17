'use strict';
import test from 'node:test';
import assert from 'node:assert/strict';
import F from '../public/flight/engine.js';
const T=F.topology;
function configured(color=0,p=0,die=1,opts={}) {const s=F.create([0,1,2,3],opts);s.turn=color;s.pieces[color][0]=p;return F.roll(s,die);}
const summary={exhaustiveMoveConfigurations:0,collisionCases:0,completedSimulatedGames:0,simulatedActions:0};
test('52 unique public nodes, four symmetric quarters',()=>{
 assert.equal(T.track.length,52);assert.equal(new Set(T.track.map(p=>p.join(','))).size,52);
 for(let i=0;i<52;i++){const [x,y]=T.track[i];assert.deepEqual(T.track[(i+13)%52],[600-y,x]);}
});
test('96 distinct physical node IDs and coordinates',()=>{
 assert.equal(Object.keys(T.nodes).length,96);assert.equal(new Set(Object.values(T.nodes).map(n=>`${n.x},${n.y}`)).size,96);
});
test('four 57-node routes: runway + 50 public + 5 lane + goal',()=>{
 for(let c=0;c<4;c++){const p=T.paths[c];assert.equal(p.length,57);assert.equal(p[0].type,'runway');assert.equal(p.filter(n=>n.type==='loop').length,50);assert.equal(p.filter(n=>n.type==='lane').length,5);assert.equal(p[56].type,'goal');assert.equal(new Set(p.map(n=>n.id)).size,57);}
});
test('red/yellow/blue/green entry IDs match the appropriate middle lane',()=>{
 assert.deepEqual(T.paths.map(p=>p[50].id),['L49','L10','L23','L36']);
 for(let c=0;c<4;c++){assert.equal(T.paths[c][50].color,c);assert.equal(T.paths[c][51].type,'lane');}
});
test('all normal consecutive route nodes are spatially continuous',()=>{
 for(const path of T.paths)for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i];const d=Math.hypot(a.x-b.x,a.y-b.y);assert.ok(d>0&&d<65,`${a.id}->${b.id}: ${d}`);}
});
test('shared physical public nodes keep the SAME object identity across colours',()=>{
 for(let a=0;a<4;a++)for(let b=a+1;b<4;b++)for(const n of T.paths[a])if(n.type==='loop'){const other=T.paths[b].find(k=>k.id===n.id);if(other)assert.equal(other,n);}
});
test('private nodes are never shared by different colours',()=>{
 for(let a=0;a<4;a++)for(let b=a+1;b<4;b++)assert.equal(T.paths[a].filter(n=>n.type!=='loop').some(n=>T.paths[b].includes(n)),false);
});
test('same-colour cells occur at progress 2 + 4k (entry excluded from jumps)',()=>{
 for(let c=0;c<4;c++)for(let p=1;p<=50;p++)assert.equal(F.at(c,p).color===c,p%4===2);
});
test('special flight IDs match coloured board markers and advance twelve',()=>{
 for(let c=0;c<4;c++){const sh=T.shortcuts[c];assert.equal(T.paths[c][18].id,sh.from);assert.equal(T.paths[c][30].id,sh.to);assert.equal(T.nodes[sh.from].color,c);assert.equal(T.nodes[sh.to].color,c);}
});
test('invalid seats, options, coordinates and die rolls rejected',()=>{
 for(const seats of [[0],[0,0],[0,4],[0,1,2,3,4]])assert.throws(()=>F.create(seats));
 assert.throws(()=>F.create([0,2],{takeoff:[0]}));assert.throws(()=>F.create([0,2],{bounce:'yes'}));
 for(const die of [0,7,1.2,null,'6'])assert.throws(()=>F.roll(F.create(),die));
 assert.throws(()=>F.at(4,0));assert.throws(()=>F.at(0,57));assert.throws(()=>F.at(0,-2));
});
test('takeoff only enters runway and six grants another roll',()=>{
 const s=configured(0,-1,6),r=F.execute(s,2);assert.equal(r.state.pieces[0][2],0);assert.equal(r.move.steps.length,1);assert.equal(r.move.steps[0].kind,'takeoff');assert.equal(r.state.turn,0);assert.equal(r.state.phase,'roll');
});
test('three takeoff variants permit only their listed values',()=>{
 for(const takeoff of [[6],[5,6],[2,4,6]])for(let d=1;d<=6;d++){const s=F.create([0,2],{takeoff});assert.equal(!!F.plan(s,0,0,d),takeoff.includes(d));}
});
test('no-move roll changes turn without moving any piece',()=>{
 const original=F.create([0,2]),s=F.roll(original,3);assert.equal(s.turn,2);assert.equal(s.phase,'roll');assert.equal(s.dice,null);assert.equal(s.lastEvent.reason,'noMoves');assert.deepEqual(s.pieces,original.pieces);
});
test('cannot roll twice or execute an unavailable piece',()=>{
 const s=configured(0,5,1);assert.throws(()=>F.roll(s,1));assert.throws(()=>F.execute(s,1));assert.throws(()=>F.execute(s,-1));assert.throws(()=>F.execute(F.create(),0));
});
test('ordinary movement records EVERY intermediate tile, including turns',()=>{
 const s=configured(0,12,3),m=F.legal(s)[0];assert.deepEqual(m.steps.map(x=>x.progress),[13,14,15]);assert.deepEqual(m.steps.map(x=>x.nodeId),['L12','L13','L14']);assert.equal(m.to,15);
});
test('colour jump four, once, then stop',()=>{
 for(let c=0;c<4;c++){const s=configured(c,5,1),m=F.legal(s)[0];assert.deepEqual(m.steps.map(x=>[x.progress,x.kind]),[[6,'walk'],[10,'jump']]);}
});
test('flight is 18 to 30 in this explicitly runway-zero representation',()=>{
 for(let c=0;c<4;c++){const m=F.legal(configured(c,17,1))[0];assert.deepEqual(m.steps.map(x=>[x.progress,x.kind]),[[18,'walk'],[30,'flight']]);}
});
test('a colour jump onto the launch cell leads to ONE flight',()=>{
 for(let c=0;c<4;c++){const m=F.legal(configured(c,13,1))[0];assert.deepEqual(m.steps.map(x=>x.progress),[14,18,30]);assert.deepEqual(m.steps.map(x=>x.kind),['walk','jump','flight']);}
});
test('jump and flight switches work independently',()=>{
 assert.equal(F.legal(configured(0,5,1,{jump:false}))[0].to,6);
 assert.equal(F.legal(configured(0,17,1,{flight:false}))[0].to,22);
 assert.equal(F.legal(configured(0,17,1,{jump:false}))[0].to,30);
 assert.equal(F.legal(configured(0,13,1,{flight:false}))[0].to,18);
 assert.equal(F.legal(configured(0,17,1,{jump:false,flight:false}))[0].to,18);
});
test('no colour jump at the home entrance, and next move enters private lane',()=>{
 for(let c=0;c<4;c++){assert.equal(F.legal(configured(c,49,1))[0].to,50);const m=F.legal(configured(c,49,3))[0];assert.deepEqual(m.steps.map(x=>x.progress),[50,51,52]);assert.equal(T.nodes[m.steps[1].nodeId].type,'lane');}
});
test('home lane never triggers colour jump or flight',()=>{
 for(let c=0;c<4;c++)for(let p=50;p<=55;p++)for(let die=1;die<=6;die++){const m=F.plan(F.create(),c,0,die);const s=F.create();s.pieces[c][0]=p;const actual=F.plan(s,c,0,die);assert.ok(actual.steps.every(x=>!['jump','flight'].includes(x.kind)));}
});
test('bounce follows goal then reverses each excess step',()=>{
 const m=F.legal(configured(0,54,5))[0];assert.deepEqual(m.steps.map(x=>x.progress),[55,56,55,54,53]);assert.equal(m.to,53);assert.equal(m.finished,false);
});
test('exact finish option marks overshoot pieces as unavailable',()=>{
 const s=F.create([0,2],{bounce:false});s.pieces[0][0]=54;assert.equal(F.plan(s,0,0,3),null);assert.equal(F.plan(s,0,0,2).to,56);
});
test('completed piece cannot be selected again',()=>{
 const s=F.create();s.pieces[0][0]=56;for(let die=1;die<=6;die++)assert.equal(F.plan(s,0,0,die),null);
});
test('capture uses actual shared node IDs for every colour pair',()=>{
 for(let a=0;a<4;a++)for(let b=0;b<4;b++)if(a!==b)for(let p=1;p<=50;p++){
  const target=T.paths[a][p],bp=T.paths[b].findIndex(n=>n.id===target.id);if(bp<1)continue;
  const s=F.create([a,b],{jump:false,flight:false});s.turn=a;s.pieces[a][0]=p-1;s.pieces[b][0]=bp;const m=F.plan(s,a,0,1);assert.equal(m.targetId,T.paths[b][bp].id);assert.deepEqual(m.captures.map(x=>x.color),[b]);const r=F.execute(F.roll(s,1),0);assert.equal(r.state.pieces[b][0],-1);summary.collisionCases++;
 }
});
test('former red-blue coordinate mismatch cannot cause missed or phantom capture',()=>{
 let s=F.create([0,2],{jump:false,flight:false});s.pieces[0][0]=11;s.pieces[2][0]=38;assert.equal(F.plan(s,0,0,1).captures.length,1); // both L11
 s.pieces[2][0]=12;assert.equal(F.plan(s,0,0,1).captures.length,0); // same progress, different public nodes
});
test('only final landing captures, not intermediate walk or jump origin',()=>{
 const s=F.create([0,2]);s.pieces[0][0]=5; // -> L5 / jump -> L9
 s.pieces[2][0]=T.paths[2].findIndex(n=>n.id==='L5');assert.equal(F.plan(s,0,0,1).captures.length,0);
 s.pieces[2][0]=T.paths[2].findIndex(n=>n.id==='L9');assert.equal(F.plan(s,0,0,1).captures.length,1);
});
test('all opposing pieces at the final node are captured; own stacking is allowed',()=>{
 const s=F.create([0,2],{jump:false,flight:false});s.pieces[0]=[11,12,-1,-1];s.pieces[2]=[38,38,38,38];const m=F.plan(s,0,0,1);assert.equal(m.captures.length,4);assert.equal(m.to,12);const out=F.execute(F.roll(s,1),0).state;assert.deepEqual(out.pieces[0],[12,12,-1,-1]);assert.deepEqual(out.pieces[2],[-1,-1,-1,-1]);
});
test('private lane and runway never capture another colour by numeric progress',()=>{
 const s=F.create();s.pieces[0][0]=50;for(let c=1;c<4;c++)s.pieces[c][0]=51;assert.equal(F.plan(s,0,0,1).captures.length,0);
});
test('third consecutive six skips only the third move and resets streak',()=>{
 let s=F.create([0,2]);s=F.execute(F.roll(s,6),0).state;s=F.execute(F.roll(s,6),0).state;const old=F.clone(s.pieces);s=F.roll(s,6);assert.equal(s.turn,2);assert.equal(s.sixes,0);assert.equal(s.lastEvent.reason,'threeSixes');assert.deepEqual(s.pieces,old);
});
test('all four finished ends game with no extra turn even on six',()=>{
 const s=F.create([0,2]);s.pieces[0]=[56,56,56,50];const out=F.execute(F.roll(s,6),3).state;assert.equal(out.winner,0);assert.equal(out.phase,'finished');assert.equal(out.dice,null);assert.deepEqual(F.legal(out),[]);assert.throws(()=>F.roll(out,6));
});
test('planning and reducer functions do not mutate inputs',()=>{
 const s=configured(0,12,3),before=JSON.stringify(s);F.legal(s);F.execute(s,0);assert.equal(JSON.stringify(s),before);const u=F.create(),v=JSON.stringify(u);F.roll(u,6);assert.equal(JSON.stringify(u),v);
});
test('exhaustive single-piece positions/dice/options agree with independent arithmetic oracle',()=>{
 for(let c=0;c<4;c++)for(let p=-1;p<=56;p++)for(let die=1;die<=6;die++)for(const takeoff of [[6],[5,6],[2,4,6]])for(const jump of [false,true])for(const flight of [false,true])for(const bounce of [false,true]){
  const s=F.create([0,1,2,3],{takeoff,jump,flight,bounce});s.pieces[c][0]=p;
  let expected=null;
  if(p<56){if(p===-1){if(takeoff.includes(die))expected=0;}else if(bounce||p+die<=56){expected=p+die>56?112-p-die:p+die;if(expected>=1&&expected<=50){if(flight&&expected===18)expected=30;else if(jump&&expected%4===2&&expected<50){expected+=4;if(flight&&expected===18)expected=30;}}}}
  const m=F.plan(s,c,0,die);assert.equal(m?.to??null,expected,JSON.stringify({c,p,die,takeoff,jump,flight,bounce}));
  if(m){assert.equal(m.steps.at(-1).nodeId,F.at(c,m.to,0).id);assert.equal(m.finished,m.to===56);assert.ok(m.steps.every(k=>k.progress>=0&&k.progress<=56));if(p>=0)assert.equal(m.steps.filter(k=>['walk','bounce'].includes(k.kind)).length,die);}
  summary.exhaustiveMoveConfigurations++;
 }
});
test('100 seeded complete games preserve invariants and terminate',()=>{
 let seed=0x7a138cf;const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)%6+1;};
 for(let n=0;n<100;n++){
  let s=F.create(n%2?[0,2]:[0,1,2,3],{bounce:n%3!==0,takeoff:n%5?[6]:[2,4,6]});let acts=0;
  while(s.winner===null&&acts<12000){
   s=s.phase==='roll'?F.roll(s,random()):F.execute(s,F.chooseBot(s)).state;
   assert.ok(s.active.includes(s.turn));assert.ok(s.pieces.flat().every(p=>Number.isInteger(p)&&p>=-1&&p<=56));
   if(s.phase==='choose'){assert.ok(F.legal(s).length>0);assert.ok(s.dice>=1&&s.dice<=6);}
   for(let a=0;a<4;a++)for(let b=a+1;b<4;b++)for(const pa of s.pieces[a])if(pa>=1&&pa<=50)for(const pb of s.pieces[b])if(pb>=1&&pb<=50)assert.notEqual(F.at(a,pa).id,F.at(b,pb).id,'opponents left on same public cell after settlement');
   acts++;
  }
  assert.notEqual(s.winner,null,`game ${n} did not finish`);assert.ok(s.pieces[s.winner].every(x=>x===56));summary.completedSimulatedGames++;summary.simulatedActions+=acts;
 }
});
test('save exact test coverage counts',()=>{
 assert.equal(summary.exhaustiveMoveConfigurations,33408);assert.equal(summary.completedSimulatedGames,100);
 console.log('RULE_COVERAGE '+JSON.stringify(summary));
});
