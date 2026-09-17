import {randomInt,shuffle} from './random.js';
import {sortCards,recognize,beats,legalMoves,rank} from './cards.js';
export function createDoudizhu(ids,rand=randomInt,dealer=null) {
  if(ids.length!==3) throw new Error('斗地主需要三位玩家');
  const deck=shuffle(Array.from({length:54},(_,i)=>i),rand);
  return { kind:'doudizhu', phase:'bidding', ids:[...ids], hands:Object.fromEntries(ids.map((id,i)=>[id,sortCards(deck.slice(i*17,(i+1)*17))])), bottom:deck.slice(51), turn:dealer??rand(3), first:dealer, bids:[null,null,null], highBid:0, landlord:null, last:null, passes:0, played:[], marks:{}, bombs:0, winner:null, message:'发牌完成，请依次叫分。' };
}
export function bid(g,id,value,rand=randomInt) {
  if(g.phase!=='bidding'||g.ids[g.turn]!==id) throw new Error('还没轮到你叫分');
  if(!Number.isInteger(value)||value<0||value>3||(value!==0&&value<=g.highBid)) throw new Error('只能不叫，或叫更高的分数');
  g.bids[g.turn]=value; if(value>g.highBid){g.highBid=value;g.landlord=id;}
  g.message=value?`叫 ${value} 分`:'不叫'; g.marks[id]=g.message;
  if(value===3||g.bids.every(x=>x!==null)) {
    if(!g.landlord){ const next=(g.turn+1)%3; Object.assign(g,createDoudizhu(g.ids,rand,next));g.message='三位都不叫，重新洗牌。';return; }
    g.hands[g.landlord]=sortCards([...g.hands[g.landlord],...g.bottom]);
    g.phase='playing'; g.turn=g.ids.indexOf(g.landlord);g.message='地主先出牌';g.marks={};
  } else g.turn=(g.turn+1)%3;
}
export function play(g,id,cards) {
  if(g.phase!=='playing'||g.ids[g.turn]!==id) throw new Error('还没轮到你出牌');
  if(!Array.isArray(cards)||!cards.length||cards.some(c=>!g.hands[id].includes(c))) throw new Error('请选择自己的手牌');
  const rule=recognize(cards,g.last?.rule.type);
  if(!rule) throw new Error('这组牌不符合牌型规则');
  if(!beats(rule,g.last?.rule)) throw new Error('这组牌压不过上一手');
  g.hands[id]=g.hands[id].filter(c=>!cards.includes(c));
  g.played.push(...cards);g.last={id,cards:sortCards(cards),rule};g.passes=0;
  g.marks[id]='已出牌';if(rule.type==='bomb'||rule.type==='rocket')g.bombs++;
  g.message='';
  if(!g.hands[id].length){g.phase='finished';g.winner=id;g.message=id===g.landlord?'地主获胜':'农民获胜';}
  else {g.turn=(g.turn+1)%3;delete g.marks[g.ids[g.turn]];}
}
export function pass(g,id) {
  if(g.phase!=='playing'||g.ids[g.turn]!==id) throw new Error('还没轮到你');
  if(!g.last||g.last.id===id) throw new Error('你是本轮先手，不能不出');
  g.marks[id]='不出';g.passes++;g.turn=(g.turn+1)%3;
  if(g.passes===2){g.turn=g.ids.indexOf(g.last.id);g.last=null;g.passes=0;g.marks={};g.message='新一轮，先手自由出牌';}
  else g.message='';
  delete g.marks[g.ids[g.turn]];
}
export function autoDoudizhu(g) {
  const id=g.ids[g.turn];
  if(g.phase==='bidding') return bid(g,id,0);
  if(g.last) return pass(g,id);
  const c=[...g.hands[id]].sort((a,b)=>rank(a)-rank(b)||a-b)[0];
  play(g,id,[c]);
}
export function ddzView(g,id) {
  return {kind:g.kind,phase:g.phase,ids:g.ids,turn:g.turn,bids:g.bids,highBid:g.highBid,landlord:g.phase==='bidding'?null:g.landlord,
    bottom:g.phase==='bidding'?[]:g.bottom,counts:Object.fromEntries(g.ids.map(p=>[p,g.hands[p].length])),
    hand:g.hands[id]??[],last:g.last,marks:g.marks,bombs:g.bombs,winner:g.winner,message:g.message,
    revealed:g.phase==='finished'?g.hands:null};
}
export function hints(g,id) {
  if(g.phase!=='playing'||g.ids[g.turn]!==id) throw new Error('轮到你时才可以提示');
  return legalMoves(g.hands[id],g.last?.rule).slice(0,40).map(m=>m.cards);
}
