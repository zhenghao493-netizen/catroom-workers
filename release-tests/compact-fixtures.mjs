/** LOCAL TEST ONLY. These states are never deployed or sent to a live room. */
import F from '../public/flight/engine.js';
function make(count,phase='choose',own=0,long=false){
 const active=count===2?[0,2]:count===3?[0,1,2]:[0,1,2,3];
 let s=F.create(active);s.pieces[0]=[7,-1,28,-1];s.pieces[2]=[5,-1,-1,-1];
 if(phase==='choose')s=F.roll(s,3);
 if(phase==='opponent'){s.turn=2;s=F.roll(s,3);}
 if(phase==='finished'){s.pieces[2]=[56,56,56,56];s.winner=2;s.phase='finished';s.turn=2;s.pieces[0]=[31,56,44,56];}
 const ids=active.map(c=>'player-'+c);
 return {code:'123456',me:'player-'+own,host:'player-0',kind:'flying',seq:10,gameSeq:10,options:{turnSeconds:0},deadline:null,players:active.map(c=>({id:'player-'+c,nickname:long?['名字很长的红色小猫猫猫','黄色同学的长长昵称啊啊','蓝色同学长名字显示测试','绿色小猫测试十个字名字'][c]:['mm','阿黄','66','小绿'][c],online:true,avatar:c,ready:true,wins:0})),chat:[{id:'sys-1',nickname:'房间提示',text:'对局开始',system:true},{id:'c-1',nickname:'66',text:'轮到你啦',system:false}],game:{kind:'flying',ruleset:'flight-lab-1',phase:s.phase,ids,colors:active,turn:active.indexOf(s.turn),engine:s,plans:own===s.turn?F.legal(s):[]}};
}
const fixtures={};for(const count of [2,3,4])for(const phase of ['roll','choose','opponent','finished'])for(const own of [0,2])for(const long of [false,true])fixtures[[count,phase,own,long].join('-')]=make(count,phase,own,long);
console.log(JSON.stringify(fixtures));
