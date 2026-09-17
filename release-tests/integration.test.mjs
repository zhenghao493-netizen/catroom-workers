import test from 'node:test';
import assert from 'node:assert/strict';
import Flight from '../public/flight/engine.js';
import {roll} from '../src/games/flying.js';
import {installGlobals,createNamespace} from './memory-runtime.mjs';
import worker from '../src/worker.js';
installGlobals();
async function fixture(kind='flying',count=2){
  const ns=createNamespace(),env={ROOMS:ns,ASSETS:{fetch:()=>new Response('asset')}},peers=[];
  const req=(pathname,body,cookie)=>new Request('https://test.local'+pathname,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});
  const response=await worker.fetch(req('/api/rooms',{nickname:'朋友0',avatar:0,kind,options:{turnSeconds:45}}),env);
  assert.equal(response.status,200);const {code}=await response.json();
  const open=async(cookie,i,join=true)=>{
    if(join&&i){const r=await worker.fetch(req(`/api/rooms/${code}/join`,{nickname:'朋友'+i,avatar:i%6},cookie),env);assert.equal(r.status,200);}
    const res=await worker.fetch(new Request(`https://test.local/api/rooms/${code}/ws`,{headers:{Cookie:cookie,Upgrade:'websocket',Origin:'https://test.local'}}),env);assert.equal(res.status,101);
    const ws=res.webSocket,p={ws,cookie,state:null,messages:[]};ws.receive=data=>{if(data==='pong')return;const m=JSON.parse(data);p.messages.push(m);if(m.type==='state')p.state=m.room;};ws.drain();peers[i]=p;return p;
  };
  await open(response.headers.get('Set-Cookie').split(';')[0],0);
  for(let i=1;i<count;i++)await open('catroom_sid='+String(i).repeat(64),i);
  const object=()=>ns.entries.get(code).object;
  const send=async(i,type,extra={})=>{const m={type,id:crypto.randomUUID(),gameSeq:object().room.gameSeq,protocol:'flight-lab-1',...extra};await object().webSocketMessage(peers[i].ws.peer,JSON.stringify(m));return m;};
  const start=async()=>{for(let i=1;i<count;i++)await send(i,'ready');await send(0,'start');assert.ok(object().room.game);};
  const die=async(n)=>{const r=object().room,g=r.game;roll(g,g.ids[g.turn],()=>n-1);r.gameSeq++;r.seq++;await object().persist();object().broadcast();};
  return {ns,env,peers,code,object,send,start,open,die};
}
for(const n of [2,3,4])test(`${n} network seats: same state and server legal plans`,async()=>{
  const f=await fixture('flying',n);await f.start();assert.deepEqual(f.object().room.game.colors,n===2?[0,2]:[0,1,2,3].slice(0,n));
  await f.die(6);const g=f.object().room.game;assert.deepEqual(g.moves,[0,1,2,3]);assert.deepEqual(g.plans,Flight.legal(g.engine));
  await f.send(0,'move',{piece:2});assert.equal(g.engine.pieces[0][2],0);
  for(const p of f.peers){assert.deepEqual(p.state.game,f.peers[0].state.game);assert.equal(p.state.release,'0.5.0');assert.equal(JSON.stringify(p.state).includes('catroom_sid'),false);assert.ok(p.state.players.every(p=>!('token'in p)));}
});
test('wrong actor, unmovable piece and stale browser protocol are rejected',async()=>{
  const f=await fixture();await f.start();const before=structuredClone(f.object().room.game);
  await f.send(1,'roll');assert.deepEqual(f.object().room.game,before);
  await f.send(0,'roll',{protocol:'old'});assert.deepEqual(f.object().room.game,before);
  await f.die(6);await f.send(0,'move',{piece:0});await f.die(3);
  const snapshot=structuredClone(f.object().room.game);assert.deepEqual(snapshot.moves,[0]);await f.send(0,'move',{piece:1});assert.deepEqual(f.object().room.game,snapshot);
});
test('duplicate command cannot move twice; stale sequence cannot change state',async()=>{
  const f=await fixture();await f.start();await f.die(6);const m=await f.send(0,'move',{piece:0});const s=structuredClone(f.object().room);
  await f.send(0,'move',m);assert.deepEqual(f.object().room.game,s.game);assert.equal(f.object().room.gameSeq,s.gameSeq);
  await f.send(0,'roll',{gameSeq:s.gameSeq-1});assert.deepEqual(f.object().room.game,s.game);
});
test('server roll ignores a client-supplied dice field',async()=>{
  const f=await fixture();await f.start();await f.send(0,'roll',{die:99,dice:99});const g=f.object().room.game;assert.ok(g.lastDice>=1&&g.lastDice<=6);assert.notEqual(g.lastDice,99);
});
test('move event, prediction, geometry and final position share the same node IDs',async()=>{
  const f=await fixture();await f.start();const g=f.object().room.game;g.engine.pieces[0][0]=13;
  await f.die(1);const planned=structuredClone(g.plans[0]);assert.deepEqual(planned.steps.map(s=>s.kind),['walk','jump','flight']);
  await f.send(0,'move',{piece:0});assert.deepEqual(g.event.steps,planned.steps);assert.equal(Flight.at(0,g.engine.pieces[0][0]).id,planned.targetId);
});
test('real room capture updates all players consistently',async()=>{
  const f=await fixture();await f.start();const g=f.object().room.game;g.engine.pieces[0][0]=11;g.engine.pieces[2][0]=38;
  await f.die(1);assert.equal(g.plans[0].captures.length,1);await f.send(0,'move',{piece:0});assert.equal(g.engine.pieces[2][0],-1);
  assert.deepEqual(f.peers[0].state.game,f.peers[1].state.game);
});
test('room rehydration and same-seat reconnect preserve engine and turn',async()=>{
  const f=await fixture();await f.start();await f.die(6);await f.send(0,'move',{piece:0});const g=structuredClone(f.object().room.game),me=f.peers[0].state.me;
  await f.ns.evict(f.code);assert.deepEqual(f.object().room.game,g);await f.open(f.peers[0].cookie,0,false);
  assert.equal(f.peers[0].state.me,me);assert.deepEqual(f.peers[0].state.game,g);
});
test('chat broadcasts without advancing game sequence',async()=>{
  const f=await fixture();await f.start();const seq=f.object().room.gameSeq;
  await f.send(1,'chat',{text:'hello <b>unsafe</b>'});assert.equal(f.object().room.gameSeq,seq);assert.equal(f.peers[0].state.chat.at(-1).text,'hello <b>unsafe</b>');
});
test('timeout uses the same engine and legal move list',async()=>{
  const f=await fixture();await f.start();await f.die(6);const r=f.object().room;r.deadline=Date.now()-1;
  await f.object().alarm();assert.equal(r.game.engine.pieces[0].filter(p=>p===0).length,1);assert.equal(r.game.engine.phase,'roll');assert.ok(r.chat.at(-1).text.includes('超时'));
});
test('legacy flying is paused and only host may explicitly reset; chat/wins retained',async()=>{
  const f=await fixture();await f.start();const r=f.object().room;r.game={kind:'flying',phase:'playing',ids:r.players.map(p=>p.id),colors:[0,2],turn:0,pieces:[[-2,-2,-2,-2],[-2,-2,-2,-2]],dice:null};r.players[0].wins=3;r.deadline=Date.now()-1;
  const old=structuredClone(r.game);assert.equal(f.object().view(r.host).upgradeRequired,true);await f.send(0,'roll');assert.deepEqual(r.game,old);
  await f.object().alarm();assert.deepEqual(r.game,old);assert.equal(r.deadline,null);await f.send(1,'reset');assert.deepEqual(f.object().room.game,old);
  const chats=f.object().room.chat.length;await f.send(0,'reset');assert.equal(f.object().room.game,null);assert.equal(f.object().room.players[0].wins,3);assert.equal(f.object().room.chat.length,chats+1);
});
test('winning move updates victory count once and stops deadline',async()=>{
  const f=await fixture();await f.start();const g=f.object().room.game;g.engine.pieces[0]=[56,56,56,55];await f.die(1);
  const m=await f.send(0,'move',{piece:3});assert.equal(g.phase,'finished');assert.equal(g.winner,g.ids[0]);assert.equal(f.object().room.players[0].wins,1);assert.equal(f.object().room.deadline,null);
  await f.send(0,'move',m);assert.equal(f.object().room.players[0].wins,1);
});
test('distinct rooms are isolated',async()=>{
  const a=await fixture(),b=await fixture();await a.start();await b.start();const before=structuredClone(b.object().room.game);await a.die(6);await a.send(0,'move',{piece:0});assert.deepEqual(b.object().room.game,before);
});
test('Doudizhu starts, keeps hands private and retains its bidding flow',async()=>{
  const f=await fixture('doudizhu',3);await f.start();const g=f.object().room.game;assert.equal(g.kind,'doudizhu');assert.equal(g.phase,'bidding');
  assert.equal(f.peers[0].state.game.hand.length,17);assert.equal(f.peers[1].state.game.hand.length,17);assert.notDeepEqual(f.peers[0].state.game.hand,f.peers[1].state.game.hand);assert.equal('hands'in f.peers[0].state.game,false);
  await f.send(g.turn,'bid',{value:3});assert.equal(f.object().room.game.phase,'playing');assert.equal(f.object().view(g.ids[0]).upgradeRequired,false);
});
