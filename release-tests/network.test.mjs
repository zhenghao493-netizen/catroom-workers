import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomConnection} from '../public/flight/network.js';
globalThis.location={href:'https://catroom.test/flight/?room=123456',protocol:'https:'};
class Socket {
  constructor(){this.readyState=0;}
  send(s){this.sent??=[];this.sent.push(s);}
  close(){this.readyState=3;}
  open(){this.readyState=1;this.onopen();}
  state(seq,gameSeq){this.onmessage({data:JSON.stringify({type:'state',room:{seq,gameSeq}})});}
}
globalThis.WebSocket=Socket;
function setup(t){const c=new RoomConnection('123456');c.connect();t.after(()=>c.stop());return c;}
test('connection refuses game commands until first authoritative state',t=>{const c=setup(t);c.ws.open();assert.equal(c.send('roll'),false);c.ws.state(1,0);assert.equal(c.send('roll'),true);});
test('ACK cannot unlock the previous turn; newer state unlocks',t=>{const c=setup(t);c.ws.open();c.ws.state(1,3);c.send('move',{piece:0});const id=c.pending.id;c.ws.onmessage({data:JSON.stringify({type:'ack',id})});assert.equal(c.send('move',{piece:0}),false);c.ws.state(2,3);assert.ok(c.pending);c.ws.state(3,4);assert.equal(c.pending,null);});
test('reconnect blocks stale local choices and does not replay a move',t=>{const c=setup(t);c.ws.open();c.ws.state(2,3);c.send('move',{piece:0});c.reconnect();c.ws.open();assert.equal(c.send('move',{piece:0}),false);assert.equal(c.ws.sent,undefined);c.ws.state(3,4);assert.equal(c.synced,true);});
test('malformed and older state messages cannot replace current state',t=>{const c=setup(t);c.ws.open();c.ws.state(8,9);c.ws.onmessage({data:'oops'});c.ws.state(7,8);assert.equal(c.room.gameSeq,9);});
test('caller cannot override operation identity, sequence or protocol',t=>{const c=setup(t);c.ws.open();c.ws.state(2,3);c.send('move',{piece:1,type:'roll',id:'bad',gameSeq:0,protocol:'old'});const p=JSON.parse(c.ws.sent[0]);assert.equal(p.type,'move');assert.equal(p.gameSeq,3);assert.equal(p.protocol,'flight-lab-1');assert.notEqual(p.id,'bad');});
