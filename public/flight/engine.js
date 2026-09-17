/* Catroom Flight Lab — shared rules used by the Worker and browser.
 * One topology supplies board drawing, legal moves, collision IDs and animation.
 * Ruleset: takeoff consumes that roll; six grants another roll; third consecutive
 * six is skipped (no rollback); one colour jump can lead to one flight; no jump
 * after flight; only the final resting public cell captures; private lanes safe.
 */
'use strict';
const Flight = (() => {
  const COLORS = ['red','yellow','blue','green'];
  const LABELS = ['红方','黄方','蓝方','绿方'];
  const nodes = Object.create(null);
  const paths = [], bases = [], runways = [];
  const quarter = [[54,198],[96,180],[132,180],[162,198],[198,162],[180,132],[180,96],[198,54],[228,42],[264,42],[300,42],[336,42],[372,42]];
  const rotate = (p,q) => { let [x,y]=p; for(let n=0;n<q;n++) [x,y]=[600-y,x]; return [x,y]; };
  const track = [];
  for(let q=0;q<4;q++) for(const p of quarter) track.push(rotate(p,q));
  function node(id,xy,type,color=null,extra={}) {
    const n=Object.freeze({id,x:xy[0],y:xy[1],type,color,...extra}); nodes[id]=n; return n;
  }
  for(let i=0;i<52;i++) node('L'+i,track[i],'loop',(i+3)%4,{index:i});
  for(let c=0;c<4;c++) {
    bases[c]=[[57,57],[119,57],[57,119],[119,119]].map((p,i)=>node(`H${c}:${i}`,rotate(p,c),'hangar',c));
    runways[c]=node(`S${c}`,rotate([20,157],c),'runway',c);
    const loop=Array.from({length:50},(_,i)=>nodes['L'+((c*13+i)%52)]);
    const lane=[84,120,156,192,228,272].map((x,i)=>node(`F${c}:${i+1}`,rotate([x,300],c),i===5?'goal':'lane',c,{step:i+1}));
    paths[c]=Object.freeze([runways[c],...loop,...lane]);
  }
  const FINISH=paths[0].length-1;
  const starts=COLORS.map((_,c)=>c*13);
  const shortcuts=COLORS.map((_,c)=>Object.freeze({from:'L'+((c*13+17)%52),to:'L'+((c*13+29)%52)}));
  const defaults=Object.freeze({takeoff:[6],jump:true,flight:true,bounce:true,threeSixes:true});
  const topology=Object.freeze({nodes:Object.freeze(nodes),track:Object.freeze(track),paths:Object.freeze(paths),bases:Object.freeze(bases),runways:Object.freeze(runways),shortcuts:Object.freeze(shortcuts),starts:Object.freeze(starts),finish:FINISH,colors:COLORS,labels:LABELS});
  const clone=x=>JSON.parse(JSON.stringify(x));
  function options(input={}) {
    const o={...defaults,...input,takeoff:[...(input.takeoff||defaults.takeoff)]};
    if(!['6','5,6','2,4,6'].includes([...o.takeoff].sort().join(',')))throw new Error('起飞点数无效');
    for(const k of ['jump','flight','bounce','threeSixes'])if(typeof o[k]!=='boolean')throw new Error('规则选项无效');
    return o;
  }
  function create(active=[0,1,2,3],opts={}) {
    if(!Array.isArray(active)||active.length<2||active.length>4||new Set(active).size!==active.length||active.some(c=>!Number.isInteger(c)||c<0||c>3))throw new Error('需要 2—4 个不同阵营');
    return {schema:'flight-lab-1',active:[...active],pieces:Array.from({length:4},()=>[-1,-1,-1,-1]),turn:active[0],phase:'roll',dice:null,lastDie:null,sixes:0,winner:null,seq:0,options:options(opts),lastEvent:null};
  }
  function at(color,progress,index=0) {
    if(!Number.isInteger(color)||color<0||color>3)throw new Error('阵营无效');
    if(!Number.isInteger(progress)||progress < -1||progress>FINISH)throw new Error('棋子进度无效');
    if(!Number.isInteger(index)||index<0||index>3)throw new Error('棋子编号无效');
    return progress===-1?bases[color][index]:paths[color][progress];
  }
  function plan(state,color,index,die) {
    if(!state.active.includes(color)||!Number.isInteger(index)||index<0||index>3||!Number.isInteger(die)||die<1||die>6||state.winner!==null)return null;
    const from=state.pieces[color][index],o=state.options,path=paths[color];
    if(!Number.isInteger(from)||from < -1||from>=FINISH)return null;
    const steps=[]; let to=from,dir=1;
    const push=(progress,kind)=>steps.push({progress,nodeId:path[progress].id,kind});
    if(from===-1) {
      if(!o.takeoff.includes(die))return null;
      to=0; push(to,'takeoff');
    } else {
      if(!o.bounce&&from+die>FINISH)return null;
      for(let k=0;k<die;k++) {
        if(to===FINISH)dir=-1;
        to+=dir;push(to,dir===1?'walk':'bounce');
      }
      const indexOf=id=>path.findIndex(n=>n.id===id);
      const fly=()=>{
        if(o.flight&&path[to].id===shortcuts[color].from){to=indexOf(shortcuts[color].to);push(to,'flight');return true;}
        return false;
      };
      if(path[to].type==='loop'&&!fly()&&o.jump&&path[to].color===color&&to<50) {
        const dest=to+4;
        if(dest<=50&&path[dest].type==='loop'){to=dest;push(to,'jump');fly();}
      }
    }
    const target=path[to],captures=[];
    if(target.type==='loop')for(const c of state.active)if(c!==color)for(let i=0;i<4;i++) {
      const p=state.pieces[c][i];
      if(p>=0&&at(c,p,i).id===target.id)captures.push({color:c,index:i,from:p});
    }
    return {color,index,die,from,to,steps,targetId:target.id,captures,finished:to===FINISH};
  }
  function legal(state) {
    if(state.phase!=='choose'||state.winner!==null||!state.dice)return [];
    return [0,1,2,3].map(i=>plan(state,state.turn,i,state.dice)).filter(Boolean);
  }
  function advance(state,extra=false) {
    state.phase='roll';state.dice=null;
    if(!extra){state.turn=state.active[(state.active.indexOf(state.turn)+1)%state.active.length];state.sixes=0;}
  }
  function roll(state,die) {
    if(state.phase!=='roll'||state.winner!==null)throw new Error('现在不能掷骰子');
    if(!Number.isInteger(die)||die<1||die>6)throw new Error('骰子必须为 1—6');
    const s=clone(state);s.seq++;s.lastDie=die;s.dice=die;s.sixes=die===6?s.sixes+1:0;s.phase='choose';
    s.lastEvent={type:'roll',color:s.turn,die,skipped:false,reason:''};
    if(s.options.threeSixes&&s.sixes===3){s.lastEvent.skipped=true;s.lastEvent.reason='threeSixes';advance(s);}
    else if(!legal(s).length){s.lastEvent.skipped=true;s.lastEvent.reason='noMoves';advance(s,die===6);}
    return s;
  }
  function execute(state,index) {
    const m=legal(state).find(x=>x.index===index);
    if(!m)throw new Error('这架飞机本轮不可移动');
    const s=clone(state);s.pieces[m.color][index]=m.to;
    for(const hit of m.captures)s.pieces[hit.color][hit.index]=-1;
    s.seq++;s.lastEvent={type:'move',...m};
    if(s.pieces[m.color].every(p=>p===FINISH)){s.winner=m.color;s.phase='finished';s.dice=null;}
    else advance(s,m.die===6);
    return {state:s,move:m};
  }
  function chooseBot(state) {
    const moves=legal(state);
    return moves.sort((a,b)=>score(b)-score(a))[0]?.index??null;
    function score(m){return (m.finished?10000:0)+m.captures.length*180+(m.from===-1?35:0)+(m.to-m.from)*3+m.to;}
  }
  function randomDie() {
    if(!globalThis.crypto?.getRandomValues)return 1+Math.floor(Math.random()*6);
    const a=new Uint32Array(1),limit=4294967292;do{crypto.getRandomValues(a);}while(a[0]>=limit);return a[0]%6+1;
  }
  return Object.freeze({topology,create,at,plan,legal,roll,execute,chooseBot,randomDie,FINISH,clone});
})();
export default Flight;
