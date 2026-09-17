import Flight from './engine.js';
import {boardDrawing,ico,C,CT,NAMES} from './art.js';
import {drawPieces,drawPath,paintDie,moveSummary} from './pieces.js';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function paintView(room,state,net,selected,busy,onSelect){
  const g=room.game,own=g.colors[g.ids.indexOf(room.me)],c=state.turn;
  document.body.dataset.round=state.winner!==null?'finished':state.phase;
  const ourTurn=c===own,blocked=busy||!net.connected||!net.synced||!!net.pending;
  const moves=state.seq===g.engine.seq?g.plans:[],chosen=ourTurn?moves.find(x=>x.index===selected):null;
  document.documentElement.style.setProperty('--accent',C[c]);document.documentElement.style.setProperty('--accentsoft',CT[c]);
  $('#boardArt').innerHTML=boardDrawing(own);drawPieces($('#tokens'),state,own,moves,selected,blocked,onSelect);drawPath($('#pathArt'),blocked?null:chosen);paintDie($('#die'),state.dice||state.lastDie);
  $('#turnDot').style.background=C[c];$('#turnDot').style.boxShadow=`0 0 0 5px ${CT[c]}`;
  const player=room.players.find(p=>p.id===g.ids[g.colors.indexOf(c)]),who=player?.nickname??NAMES[c];
  $('#turnTitle').textContent=state.winner!==null?`${NAMES[state.winner]}获胜`:!net.connected?'正在重连':busy?'飞机移动中':ourTurn?'轮到你了':`等待 ${who}`;
  $('#turnSub').textContent=state.winner!==null?'四架飞机全部回家':`${NAMES[c]}${ourTurn?' · 你来操作':''}${state.phase==='choose'?' · 选择飞机':' · 准备掷骰'}`;
  $('#ownCaption').textContent=`${NAMES[own]}是你 · 发光的才能走`;
  $('.board-caption i').style.background=C[own];
  $('#seats').dataset.count=state.active.length;
  $('#seats').innerHTML=state.active.map(k=>{
    const p=room.players.find(p=>p.id===g.ids[g.colors.indexOf(k)]);
    return `<div class="seat ${k===c?'active':''}" title="${esc(p?.nickname??NAMES[k])} · ${NAMES[k]}${k===own?' · 我':''}" style="--accent:${C[k]}"><div class="seat-head"><img class="avatar" src="/avatars/maodie-photo.png?v=034" alt=""><b>${esc(p?.nickname??NAMES[k])}</b><span class="mini">${NAMES[k]} · ${k===own?'我':p?.online?'在线':'离线'}</span></div><div class="progress">${state.pieces[k].map(p=>`<span class="${p===Flight.FINISH?'done':''}"></span>`).join('')}<small>${state.pieces[k].filter(p=>p===Flight.FINISH).length}/4</small></div></div>`;
  }).join('');
  $('#modeTag').innerHTML='<span class="room-clock"></span>';
  $('#actionHeading').textContent=state.winner!==null?'这局结束了':busy?'飞机移动中':!ourTurn?'等朋友飞一会儿':state.phase==='roll'?'准备起飞':chosen?`${chosen.index+1} 号已选中`:'选择一架飞机';
  $('#dieTitle').textContent=state.winner!==null?`${NAMES[state.winner]}率先到达`:state.phase==='choose'?`掷出了 ${state.dice} 点`:busy?'飞机移动中':ourTurn?'轮到你 · 掷骰子':`等待 ${who}`;
  $('#dieDesc').textContent=chosen?`${chosen.index+1} 号：${moveSummary(chosen)}`:state.winner!==null?(room.host===room.me?'可返回等待室，再开一局':'等待房主开启下一局'):busy?'正在沿航线移动':ourTurn?(state.phase==='choose'?'请选择白圈飞机，再确认':'掷骰后高亮可走飞机'):'轮到你时，可走飞机会亮起';
  $('#choices').replaceChildren();
  for(let i=0;i<4;i++){
    const m=moves.find(x=>x.index===i),p=state.pieces[own][i],can=ourTurn&&!!m&&!blocked;
    const b=document.createElement('button');b.className='choice'+(can?' legal':'');b.disabled=!can;b.dataset.choice=i;b.setAttribute('aria-pressed',String(selected===i&&can));
    b.innerHTML=`<span>${ico('plane')}${i+1}</span><small>${p===Flight.FINISH?'已到达':can?(p===-1?'可起飞':'可移动'):p===-1?'在机场':'等待'}</small>`;b.onclick=()=>onSelect(i);$('#choices').append(b);
  }
  const main=$('#mainAction');main.disabled=blocked||(state.winner!==null?room.host!==room.me:!ourTurn||(state.phase==='choose'&&!chosen));
  main.innerHTML=state.winner!==null?(room.host===room.me?'再来一局':'等待房主开局'):busy?'移动中…':!net.connected?'等待重连':net.pending?'等待服务器确认':!ourTurn?'等待对方行动':state.phase==='roll'?`${ico('plane')}掷骰子`:chosen?`${ico('check')}${chosen.from===-1?'确认起飞':'确认移动'} · ${chosen.index+1} 号`:'先选择发光的飞机';
  $('#selectionNote').textContent=chosen?moveSummary(chosen):state.winner!==null?'房主可在房间菜单返回等待室，再准备开局。':ourTurn&&state.phase==='choose'?'点击棋盘，或用上方大按钮选择。':ourTurn?'掷出 6 可以再来一回合。':'服务器决定骰子和落点，断线回来仍是原座位。';
  $('#selectionNote').classList.toggle('emphasis',!!chosen);
}
export function paintConnection(net){
  const el=$('#connectionStatus');if(!el)return;el.classList.toggle('off',!net.connected);el.innerHTML=`<i></i>${net.connected?'房间 '+net.code:'点击重连'}`;
}
export function paintClock(room){const el=$('.room-clock');if(el)el.textContent=room?.deadline?`${Math.max(0,Math.ceil((room.deadline-Date.now())/1000))} 秒`:'不限时';}
