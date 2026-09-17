import { randomInt } from './random.js';
export const FINISH=56;
export const DEFAULT_FLYING={takeoff:'6',jump:true,flight:true,bounce:true,threeSixes:true};
export function createFlying(ids,options={}) {
  if(ids.length<2||ids.length>4)throw new Error('飞行棋需要 2—4 位玩家');
  const colors=ids.length===2?[0,2]:ids.map((_,i)=>i);
  return {kind:'flying',phase:'playing',ids:[...ids],colors,pieces:ids.map(()=>[-2,-2,-2,-2]),turn:0,dice:null,lastDice:null,sixes:0,options:{...DEFAULT_FLYING,...options},winner:null,message:'轮到第一位玩家掷骰子',moves:[],event:null};
}
export const globalCell=(g,seat,position)=>(g.colors[seat]*13+position)%52;
export function movable(g,die=g.dice) {
  if(!die)return [];
  return g.pieces[g.turn].flatMap((p,i)=>{
    if(p===FINISH)return [];
    if(p===-2)return String(g.options.takeoff).includes(String(die))?[i]:[];
    if(!g.options.bounce && p+die>FINISH)return [];
    return [i];
  });
}
function advance(g,extra=false){g.dice=null;g.moves=[];if(!extra){g.turn=(g.turn+1)%g.ids.length;g.sixes=0;}}
export function roll(g,id,rand=randomInt) {
  if(g.phase!=='playing'||g.ids[g.turn]!==id||g.dice!==null)throw new Error('当前不能掷骰子');
  g.dice=rand(6)+1;g.lastDice=g.dice;g.sixes=g.dice===6?g.sixes+1:0;
  g.event={type:'roll',seat:g.turn,die:g.dice};
  if(g.options.threeSixes&&g.sixes===3){g.message='连续三个 6，本回合跳过';advance(g);return;}
  g.moves=movable(g);
  g.message=`掷出了 ${g.dice}，请选择飞机`;
  if(!g.moves.length){g.message=`掷出了 ${g.dice}，没有可移动的飞机`;advance(g,g.dice===6);}
}
export function moveFlying(g,id,index) {
  if(g.phase!=='playing'||g.ids[g.turn]!==id||!Number.isInteger(index)||!movable(g).includes(index))throw new Error('这架飞机现在不能移动');
  const seat=g.turn,from=g.pieces[seat][index],die=g.dice,route=[],hit=[];
  let p=from===-2?-1:from+die;
  if(p>FINISH)p=FINISH-(p-FINISH);
  route.push(p);
  if(p>=0&&p<=50){
    if(g.options.flight&&p===18){p=30;route.push(p);}
    else if(g.options.jump&&p%4===2&&p+4<=50){p+=4;route.push(p);if(g.options.flight&&p===18){p=30;route.push(p);}}
    for(const dest of route){
      const at=globalCell(g,seat,dest);
      for(let s=0;s<g.ids.length;s++)if(s!==seat)for(let k=0;k<4;k++){
        const other=g.pieces[s][k];
        if(other>=0&&other<=50&&globalCell(g,s,other)===at){g.pieces[s][k]=-2;hit.push({seat:s,index:k});}
      }
    }
  }
  g.pieces[seat][index]=p;g.event={type:'move',seat,index,from,to:p,route,hit,die};
  g.message=from===-2?'飞机进入起飞位':p===FINISH?'一架飞机到达终点':route.length>1?'同色跳跃 / 飞行':'飞机移动';
  if(hit.length)g.message+=`，撞回 ${hit.length} 架飞机`;
  if(g.pieces[seat].every(x=>x===FINISH)){g.winner=id;g.phase='finished';g.dice=null;g.moves=[];g.message='四架飞机全部到达，获得胜利';}
  else advance(g,die===6);
}
export function autoFlying(g) {
  const id=g.ids[g.turn];
  if(g.dice===null)roll(g,id);
  if(g.dice!==null&&g.ids[g.turn]===id){const available=movable(g);if(available.length)moveFlying(g,id,available.sort((a,b)=>g.pieces[g.turn][b]-g.pieces[g.turn][a])[0]);}
}
