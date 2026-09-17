import Flight from './engine.js';
import {ico,NAMES} from './art.js';
const T=Flight.topology;
export function drawPieces(host,state,own,moves,selected,blocked,onSelect){
  const indices=new Set(!blocked&&state.turn===own?moves.map(m=>m.index):[]),groups={};host.replaceChildren();
  for(const c of state.active)for(let i=0;i<4;i++){const n=Flight.at(c,state.pieces[c][i],i);(groups[n.id]??=[]).push([c,i]);}
  for(const c of state.active)for(let i=0;i<4;i++){
    const p=state.pieces[c][i],n=Flight.at(c,p,i),available=c===state.turn&&indices.has(i),finished=p===Flight.FINISH;
    const b=document.createElement('button');b.type='button';b.className=`token ${c===own?'own':''} ${available?'available':''} ${available&&selected===i?'selected':''} ${indices.size&&!available?'muted':''} ${finished?'finished':''}`;
    b.dataset.color=c;b.dataset.index=i;b.dataset.node=n.id;
    const siblings=groups[n.id],slot=siblings.findIndex(x=>x[0]===c&&x[1]===i),jitter=siblings.length>1?[(slot%2?1:-1)*5,(slot<2?-1:1)*5]:[0,0];
    b.style.left=(n.x+jitter[0])/6+'%';b.style.top=(n.y+jitter[1])/6+'%';
    b.disabled=!available;b.setAttribute('aria-label',`${NAMES[c]} ${i+1} 号飞机，${finished?'已到终点':available?'可移动':p===-1?'在机场':'当前不可移动'}`);b.setAttribute('aria-pressed',String(available&&selected===i));
    b.innerHTML=`<span class="coin">${ico('plane')}</span><span class="number">${finished?'✓':i+1}</span><span class="piece-label">${selected===i&&available?'已选':'可走'}</span>`;
    b.onclick=()=>onSelect(i);host.append(b);
  }
}
export function drawPath(host,m){
  if(!m){host.innerHTML='';return;}
  let n=Flight.at(m.color,m.from,m.index),s='',count=0;
  for(const step of m.steps){
    const to=T.nodes[step.nodeId];if(!to)throw new Error('未知路线节点');
    const special=['jump','flight','takeoff'].includes(step.kind);
    const d=special?`M${n.x} ${n.y}Q${(n.x+to.x)/2+10} ${(n.y+to.y)/2-14} ${to.x} ${to.y}`:`M${n.x} ${n.y}L${to.x} ${to.y}`;
    s+=`<path d="${d}" class="preview-line-under"/><path d="${d}" class="${special?'preview-special':'preview-line'}"/>`;
    if(!special){count++;s+=`<circle cx="${to.x}" cy="${to.y}" r="7.5" fill="#fff" stroke="#183b50" stroke-width=".6"/><text x="${to.x}" y="${to.y+3.5}" class="preview-num" text-anchor="middle">${count}</text>`;}
    n=to;
  }
  host.innerHTML=s+`<circle cx="${n.x}" cy="${n.y}" r="20" class="preview-target"/>`;
}
export function paintDie(el,d){
  const map={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
  el.innerHTML=Array.from({length:9},(_,i)=>`<i style="visibility:${(map[d]||[]).includes(i)?'visible':'hidden'}"></i>`).join('');el.setAttribute('aria-label',d?`${d} 点`:'等待掷骰子');
}
export function moveSummary(m){
  const words=[];words.push(m.from===-1?'进入起飞位':`走 ${m.die} 格`);
  if(m.steps.some(s=>s.kind==='jump'))words.push('同色跳 4 格');
  if(m.steps.some(s=>s.kind==='flight'))words.push('飞行 12 格');
  if(m.steps.some(s=>s.kind==='bounce'))words.push('越过终点后反弹');
  if(m.finished)words.push('到达终点');else if(T.nodes[m.targetId].type==='lane')words.push(`终点通道第 ${T.nodes[m.targetId].step} 格`);
  if(m.captures.length)words.push(`撞回 ${m.captures.length} 架`);return words.join(' → ');
}
export async function animateMove(m,isCurrent){
  const token=document.querySelector(`#tokens .token[data-color="${m.color}"][data-index="${m.index}"]`);if(!token)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  token.classList.remove('muted','available');token.classList.add('moving');let prev=Flight.at(m.color,m.from,m.index);
  for(const step of m.steps){
    if(!isCurrent())return;
    const n=T.nodes[step.nodeId];if(!n)return;
    const special=['flight','jump','takeoff'].includes(step.kind),ms=reduced?0:special?420:125;
    token.classList.toggle('airborne',special);token.style.transition=`left ${ms}ms ${special?'ease-in-out':'linear'},top ${ms}ms ${special?'ease-in-out':'linear'}`;
    token.style.left=n.x/6+'%';token.style.top=n.y/6+'%';token.dataset.node=n.id;
    token.querySelector('svg').style.transform=`rotate(${Math.atan2(n.y-prev.y,n.x-prev.x)*180/Math.PI}deg)`;
    await new Promise(r=>setTimeout(r,ms+12));prev=n;
  }
}
