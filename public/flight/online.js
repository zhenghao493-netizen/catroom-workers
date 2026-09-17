import Flight from './engine.js';
import {RoomConnection} from './network.js';
import {ico,NAMES} from './art.js';
import {paintView,paintConnection,paintClock} from './view.js';
import {animateMove,moveSummary} from './pieces.js';
const $=s=>document.querySelector(s),code=new URL(location.href).searchParams.get('room');
let room=null,visual=null,selected=null,busy=false,generation=0,queued=null,toastTimer=null,seen=new Set(),firstChat=true,lane=0,logged=-1;
let danmaku=true;try{danmaku=JSON.parse(localStorage.getItem('catroom.danmaku')??'true');}catch{}
function announce(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4200);}
function paint(){if(!room?.game?.engine||!$('#boardArt'))return;paintView(room,visual,net,selected,busy,select);paintConnection(net);paintClock(room);}
function select(i){if(busy||!net.connected||!net.synced||net.pending||!room?.game?.plans?.some(m=>m.index===i)||room.game.ids[room.game.turn]!==room.me)return;selected=i;paint();}
function exit(url){generation++;net.stop();location.replace(url);}
function lobby(){exit('/?room='+code);}
function showDialog(title,body){const d=$('#dialog');d.replaceChildren();const head=document.createElement('div');head.className='dialog-head';const h=document.createElement('h2');h.textContent=title;const close=document.createElement('button');close.className='close';close.textContent='×';close.setAttribute('aria-label','关闭');close.onclick=()=>d.close();head.append(h,close);d.append(head);const section=document.createElement('div');section.innerHTML=body;d.append(section);if(!d.open)d.showModal();return section;}
function logEvent(s){if(s.seq===logged)return;logged=s.seq;const ev=s.lastEvent;if(!ev)return;const li=document.createElement('li');li.textContent=ev.type==='move'?`${NAMES[ev.color]} ${ev.index+1} 号：${moveSummary(ev)}`:`${NAMES[ev.color]}掷出 ${ev.die}${ev.skipped?(ev.reason==='threeSixes'?'，连续三个 6，本次跳过':'，无可移动飞机'):''}`;$('#log')?.prepend(li);while($('#log')?.children.length>16)$('#log').lastElementChild.remove();}
function updateChat(r){
  const list=$('#chatLog');if(!list)return;
  const bottom=list.scrollHeight-list.scrollTop-list.clientHeight<50;list.replaceChildren();
  for(const m of r.chat){const li=document.createElement('li');if(m.system)li.className='system';else{const n=document.createElement('b');n.textContent=m.nickname;li.append(n);}li.append(document.createTextNode(m.text));list.append(li);
    if(!firstChat&&!seen.has(m.id)&&!m.system&&danmaku&&!matchMedia('(prefers-reduced-motion:reduce)').matches){const e=document.createElement('span');e.className='danmaku-item';e.style.top=((lane++%3)*38)+'px';const n=document.createElement('b');n.textContent=m.nickname;e.append(n,document.createTextNode(m.text));$('#danmaku').append(e);setTimeout(()=>e.remove(),8100);}seen.add(m.id);
  }
  if(seen.size>300)seen=new Set(r.chat.map(m=>m.id));firstChat=false;if(bottom)list.scrollTop=list.scrollHeight;$('#chatCount').textContent=r.chat.filter(m=>!m.system).length+' 条';
}
async function receive(next){
  if(!next.game||next.kind!=='flying'){lobby();return;}
  room=next;updateChat(room);paintConnection(net);paintClock(room);
  if(room.upgradeRequired||room.game.ruleset!=='flight-lab-1'||!room.game.engine){showUpgrade();return;}
  const s=room.game.engine;
  if(!visual){visual=Flight.clone(s);logEvent(s);paint();return;}
  if(busy){queued=next;return;}
  if(s.seq===visual.seq){paint();return;}
  const previous=visual;selected=null;
  const ev=s.lastEvent;
  if(s.seq===previous.seq+1&&ev?.type==='move'&&previous.pieces[ev.color]?.[ev.index]===ev.from){
    busy=true;paint();const gen=++generation;await animateMove(ev,()=>gen===generation);
    if(gen!==generation)return;busy=false;
  }
  visual=Flight.clone(s);logEvent(s);paint();
  if(queued){const q=queued;queued=null;if(q.game?.engine?.seq!==visual.seq)await receive(q);else{room=q;paint();}}
}
function showUpgrade(){
  generation++;busy=false;visual=null;queued=null;
  const app=$('.app');if(app.querySelector('.upgrade'))return;
  app.innerHTML='<section class="upgrade"><h2>旧对局需要重新开局</h2><p>这局使用旧版棋子编号，不能直接套用新棋盘。原房间、玩家、聊天和胜场均保留；旧棋局已暂停，不会继续自动走棋。</p><p>请房主确认后返回等待室，大家重新准备即可使用新版。</p><button id="upgradeReset">房主确认：返回等待室</button><a href="/">返回大厅</a></section>';
  $('#upgradeReset').disabled=room.host!==room.me;$('#upgradeReset').onclick=()=>net.send('reset');
}
const net=new RoomConnection(code,{state:receive,status:()=>{if($('#connectionStatus'))paintConnection(net);if(!busy)paint();},error:announce,removed:()=>exit('/')});
for(const el of document.querySelectorAll('[data-icon]'))el.innerHTML=ico(el.dataset.icon);
function setTheme(t){if(!['day','night','cream'].includes(t))t='day';document.body.dataset.theme=t;document.querySelectorAll('.theme-switch button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.theme===t)));document.querySelector('meta[name="theme-color"]').content=t==='night'?'#0e202c':t==='cream'?'#f3ede2':'#edf3f6';try{localStorage.setItem('catroom.flightlab.theme',t);}catch{}}
try{setTheme(localStorage.getItem('catroom.flightlab.theme'));}catch{setTheme('day');}
document.querySelectorAll('.theme-switch button').forEach(b=>b.onclick=()=>setTheme(b.dataset.theme));
$('#connectionStatus').onclick=()=>net.connected?announce('房间号：'+code):net.reconnect();
$('#mainAction').onclick=()=>{
  if(busy||!room?.game?.engine||room.game.ids[room.game.turn]!==room.me)return;
  if(room.game.engine.phase==='roll')net.send('roll');else if(selected!==null)net.send('move',{piece:selected});
};
$('#routeToggle').onclick=()=>{const off=$('#board').classList.toggle('hide-guide');$('#routeToggle').setAttribute('aria-pressed',String(!off));};
$('#chatOpen').onclick=()=>{$('#chatInput').scrollIntoView({block:'center',behavior:'smooth'});$('#chatInput').focus();};
$('#chatForm').onsubmit=e=>{e.preventDefault();const input=$('#chatInput'),text=input.value.trim();if(!text)return;if(net.send('chat',{text}))input.value='';};
$('#danmakuToggle').checked=!!danmaku;$('#danmakuToggle').onchange=e=>{danmaku=e.target.checked;try{localStorage.setItem('catroom.danmaku',JSON.stringify(danmaku));}catch{}};
function rules(){const o=room?.game?.engine?.options;if(!o)return;showDialog('本局规则',`<ol><li><b>${o.takeoff.join(' / ')} 点起飞：</b>起飞只到起飞位；掷出 6 可以再掷。</li><li><b>公共路线顺时针：</b>按骰子逐格走完，再结算跳格。</li><li><b>同色跳格${o.jump?'已开启':'已关闭'}；飞行捷径${o.flight?'已开启':'已关闭'}。</b>开启时，同色跳 4 格，跳到飞行入口可继续飞 12 格；飞完不再跳。终点入口不触发跳格。</li><li><b>撞机只结算最终公共落点。</b>经过、跳过、飞越都不撞回；终点通道安全。同色可叠停，不叠飞、不拦路。</li><li><b>第 50 步到入口，再走 6 步到终点。</b>${o.bounce?'超过终点按多余步数反弹。':'必须精确到达，超出的飞机不可选。'}</li><li><b>三连 6 ${o.threeSixes?'已开启':'已关闭'}：</b>${o.threeSixes?'第三次跳过，前两次不撤回。':'不跳过第三次。'}</li><li>四架到达即获胜。${room.options.turnSeconds?`每次操作时限 ${room.options.turnSeconds} 秒，超时由服务器保底操作。`:'本局不限时。'}</li></ol><p>可走列表、骰子、落点和撞机都由服务器裁定。三套外观只影响显示。</p>`);}
$('#rules').onclick=rules;
$('#credits').onclick=()=>showDialog('版本与素材', '<p>猫猫开局 v0.5.0。棋盘与联机服务器共用同一套规则节点；飞机图标采用 Tabler Icons（MIT）。</p><p><a href="./LICENSE.Tabler.txt" target="_blank" rel="noopener">查看素材许可全文</a></p><p>当前页面是朋友房联机版，不是原先的离线演示局面。</p>');
$('#backRoom').onclick=()=>{
  if(!room)return;const panel=showDialog('房间 '+code,'<p>返回大厅会保留对局座位；重开会结束本局，请先和朋友确认。</p><div class="menu-actions"><button id="copyInvite">复制邀请链接</button><button id="goHall">返回大厅 · 保留座位</button><button class="danger" id="resetRoom">结束本局，返回等待室</button></div>');
  panel.querySelector('#goHall').onclick=()=>exit('/');
  panel.querySelector('#resetRoom').disabled=room.host!==room.me;
  panel.querySelector('#resetRoom').onclick=()=>{const p=showDialog('确认结束本局？','<p>所有人将返回原房间等待室，聊天和胜场保留。正在进行的棋局会结束。</p><div class="menu-actions"><button id="confirmReset">确认返回等待室</button></div>');p.querySelector('#confirmReset').onclick=()=>{if(net.send('reset'))$('#dialog').close();};};
  panel.querySelector('#copyInvite').onclick=async()=>{const text=location.origin+'/?room='+code;try{await navigator.clipboard.writeText(text);announce('邀请链接已复制');}catch{announce('房间号：'+code);}};
};
const clock=setInterval(()=>paintClock(room),1000);
window.addEventListener('pagehide',()=>{generation++;net.stop();clearInterval(clock);});
window.__FLIGHT_ONLINE__={getRoom:()=>room?structuredClone(room):null,getBusy:()=>busy,getSelected:()=>selected};
async function start(){
  if(!/^\d{6}$/.test(code??'')){announce('请从大厅输入房间号进入');setTimeout(()=>exit('/'),1000);return;}
  try{const r=await fetch(`/api/rooms/${code}/state`,{credentials:'same-origin',cache:'no-store'});if(r.status===401||r.status===403){lobby();return;}if(!r.ok)throw new Error('房间不存在或已过期，请返回大厅');net.connect();}catch(e){announce(e.message);}
}
start();
