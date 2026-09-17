/** Server adapter for the approved, shared Flight rules. Never accept client dice. */
import Flight from '../../public/flight/engine.js';
import {randomInt} from './random.js';
export const RULESET='flight-lab-1';
export const FINISH=Flight.FINISH;
export const DEFAULT_FLYING={takeoff:'6',jump:true,flight:true,bounce:true,threeSixes:true};
export function isCurrentFlying(g){return g?.ruleset===RULESET&&g.engine?.schema===RULESET;}
function requireCurrent(g){if(!isCurrentFlying(g))throw new Error('旧版飞行棋已暂停，请房主返回等待室重新开局');}
function project(g,s){
  g.engine=s;g.turn=s.active.indexOf(s.turn);g.phase=s.winner===null?'playing':'finished';
  g.pieces=g.colors.map(c=>[...s.pieces[c]]);g.dice=s.dice;g.lastDice=s.lastDie;g.sixes=s.sixes;
  g.plans=Flight.legal(s);g.moves=g.plans.map(m=>m.index);
  g.winner=s.winner===null?null:g.ids[g.colors.indexOf(s.winner)];g.event=s.lastEvent;
  const ev=s.lastEvent;
  g.message=!ev?'等待掷骰子':ev.type==='roll'?(ev.skipped?(ev.reason==='threeSixes'?'连续三个 6，本次跳过':'没有可移动的飞机'):`掷出了 ${ev.die}，请选择飞机`):ev.finished?'一架飞机到达终点':ev.captures.length?`撞回 ${ev.captures.length} 架飞机`:'飞机移动';
  if(g.winner)g.message='四架飞机全部到达，获得胜利';
  return g;
}
export function createFlying(ids,opts={}){
  if(!Array.isArray(ids)||ids.length<2||ids.length>4||new Set(ids).size!==ids.length)throw new Error('飞行棋需要 2—4 位不同玩家');
  const colors=ids.length===2?[0,2]:ids.map((_,i)=>i);
  const options={...DEFAULT_FLYING,...opts};
  const s=Flight.create(colors,{...options,takeoff:String(options.takeoff).split('').map(Number)});
  return project({kind:'flying',ruleset:RULESET,ids:[...ids],colors,options},s);
}
export function movable(g){requireCurrent(g);return Flight.legal(g.engine).map(m=>m.index);}
export function globalCell(g,seat,progress){requireCurrent(g);return Flight.at(g.colors[seat],progress).id;}
export function roll(g,id,rand=randomInt){
  requireCurrent(g);if(g.ids[g.turn]!==id)throw new Error('还没轮到你');
  return project(g,Flight.roll(g.engine,rand(6)+1));
}
export function moveFlying(g,id,index){
  requireCurrent(g);if(g.ids[g.turn]!==id)throw new Error('还没轮到你');
  return project(g,Flight.execute(g.engine,index).state);
}
export function autoFlying(g){
  requireCurrent(g);const actor=g.ids[g.turn];
  if(g.engine.phase==='roll')roll(g,actor);
  if(g.ids[g.turn]===actor&&g.engine.phase==='choose'){
    const i=Flight.chooseBot(g.engine);if(i!==null)moveFlying(g,actor,i);
  }
}
