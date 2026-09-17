import {createDoudizhu,bid,play,pass,autoDoudizhu,ddzView,hints} from '../games/doudizhu.js';
import {createFlying,roll,moveFlying,autoFlying,DEFAULT_FLYING} from '../games/flying.js';

export const ROOM_TTL=24*60*60*1000;
export const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
export function cleanProfile(body) {
  if(typeof body?.nickname!=='string')throw new Error('请输入昵称');
  const nickname=body.nickname.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,'').trim();
  if([...nickname].length<1||[...nickname].length>12)throw new Error('昵称需要 1—12 个字');
  const avatar=body.avatar;
  if(!Number.isInteger(avatar)||avatar<0||avatar>5)throw new Error('头像无效');
  return {nickname,avatar};
}
function cleanOptions(game,body={}) {
  const turnSeconds=body.turnSeconds??45;
  if(![0,30,45,60,90].includes(turnSeconds))throw new Error('回合时限无效');
  const o={turnSeconds};
  if(game==='flying') {
    o.flying={...DEFAULT_FLYING};
    if(body.flying) {
      if(!['6','56','246'].includes(body.flying.takeoff??'6'))throw new Error('起飞规则无效');
      o.flying.takeoff=body.flying.takeoff??'6';
      for(const k of ['jump','flight','bounce','threeSixes'])if(k in body.flying){if(typeof body.flying[k]!=='boolean')throw new Error('规则选项无效');o.flying[k]=body.flying[k];}
    }
  }
  return o;
}
function uuid(){return crypto.randomUUID();}
export class GameRoom {
  constructor(ctx,env) {
    this.ctx=ctx;this.env=env;this.room=null;this.tail=Promise.resolve();
    this.ready=ctx.blockConcurrencyWhile(async()=>{this.room=await ctx.storage.get('room')??null;});
    if(typeof WebSocketRequestResponsePair!=='undefined')ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping','pong'));
  }
  serial(fn) {const next=this.tail.then(()=>this.ready).then(fn);this.tail=next.catch(()=>{});return next;}
  peers(id=null){return this.ctx.getWebSockets().filter(ws=>{try{return ws.readyState===1&&(!id||ws.deserializeAttachment()?.id===id);}catch{return false;}});}
  playerByToken(token){return this.room?.players.find(p=>p.token===token);}
  async persist() {
    if(!this.room)return;
    await this.ctx.storage.put('room',this.room);
    const next=this.room.deadline?Math.min(this.room.expiresAt,this.room.deadline):this.room.expiresAt;
    await this.ctx.storage.setAlarm(next);
  }
  view(id) {
    const r=this.room;
    return {code:r.code,kind:r.kind,host:r.host,seq:r.seq,gameSeq:r.gameSeq,options:r.options,
      players:r.players.map(({id,nickname,avatar,ready,wins})=>({id,nickname,avatar,ready,wins,online:this.peers(id).length>0})),
      me:id,createdAt:r.createdAt,expiresAt:r.expiresAt,deadline:r.deadline,chat:r.chat,
      game:r.game?.kind==='doudizhu'?ddzView(r.game,id):r.game};
  }
  broadcast() {
    if(!this.room)return;
    for(const ws of this.peers()) {try{ws.send(JSON.stringify({type:'state',room:this.view(ws.deserializeAttachment().id)}));}catch{}}
  }
  note(text) {
    this.room.chat.push({id:uuid(),nickname:'房间提示',avatar:0,text,system:true,time:Date.now()});
    this.room.chat=this.room.chat.slice(-40);
  }
  setDeadline(){this.room.deadline=this.room.game?.phase!=='finished' && this.room.game && this.room.options.turnSeconds>0 && this.peers().length?Date.now()+this.room.options.turnSeconds*1000:null;}
  finish() {
    const r=this.room,g=r.game;
    if(g?.phase==='finished'&&!g.counted){
      for(const p of r.players)if(g.kind==='flying'?p.id===g.winner:(p.id===g.landlord)===(g.winner===g.landlord))p.wins++;
      for(const p of r.players)p.ready=p.id===r.host;
      g.counted=true;r.deadline=null;this.note(g.kind==='flying'?`${r.players.find(p=>p.id===g.winner)?.nickname} 获得飞行棋胜利`:g.message);
    }
  }
  async fetch(request) {
    return this.serial(async()=>{
      try {
        const u=new URL(request.url),token=request.headers.get('X-Player-Token');
        if(!token||!/^[a-f0-9]{64}$/.test(token))return json({error:'身份凭证无效'},401);
        if(u.pathname==='/init'){
          if(this.room && this.room.expiresAt>Date.now())return json({error:'房间号冲突'},409);
          if(this.room){for(const ws of this.peers()){try{ws.close(4003,'房间已过期');}catch{}}await this.ctx.storage.deleteAll();}
          const body=await request.json(),profile=cleanProfile(body);
          if(!['flying','doudizhu'].includes(body.kind))throw new Error('只支持飞行棋和斗地主');
          if(!/^\d{6}$/.test(body.code))throw new Error('房间号无效');
          const id=uuid(),now=Date.now();
          this.room={schema:1,code:body.code,kind:body.kind,host:id,options:cleanOptions(body.kind,body.options),
            players:[{id,token,...profile,ready:true,wins:0,seen:[],chatAt:0}],game:null,seq:1,gameSeq:0,chat:[],createdAt:now,expiresAt:now+ROOM_TTL,deadline:null};
          this.note(`${profile.nickname} 创建了房间`);await this.persist();return json({code:body.code,id});
        }
        if(!this.room||this.room.expiresAt<=Date.now())return json({error:'房间不存在或已过期'},404);
        if(u.pathname==='/join'){
          const body=await request.json(),profile=cleanProfile(body);let p=this.playerByToken(token);
          if(!p){
            if(this.room.game && this.room.game.phase!=='finished')throw new Error('这局已经开始，请等待下一局');
            if(this.room.players.length>=(this.room.kind==='flying'?4:3))throw new Error('这个房间已经坐满了');
            p={id:uuid(),token,...profile,ready:false,wins:0,seen:[],chatAt:0};this.room.players.push(p);if(!this.room.host){this.room.host=p.id;p.ready=true;}this.note(`${p.nickname} 加入了房间`);
            if(this.room.game?.phase==='finished'){this.room.game=null;this.room.gameSeq++;for(const x of this.room.players)x.ready=x.id===this.room.host;}
          }else {p.nickname=profile.nickname;p.avatar=profile.avatar;}
          this.room.seq++;this.room.expiresAt=Date.now()+ROOM_TTL;await this.persist();this.broadcast();return json({code:this.room.code,id:p.id});
        }
        const p=this.playerByToken(token);if(!p)return json({error:'请先加入房间'},403);
        if(u.pathname==='/state')return json({room:this.view(p.id)});
        if(u.pathname==='/ws'){
          if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return json({error:'需要 WebSocket'},426);
          const pair=new WebSocketPair(),client=pair[0],server=pair[1];
          for(const old of this.peers(p.id)){try{old.close(4001,'此座位已在另一个页面打开');}catch{}}
          this.ctx.acceptWebSocket(server,[p.id]);
          p.connection=uuid();server.serializeAttachment({id:p.id,connection:p.connection,windowStart:Date.now(),messages:0});
          if(!this.room.deadline)this.setDeadline();
          this.room.seq++;this.room.expiresAt=Date.now()+ROOM_TTL;await this.persist();this.broadcast();
          return new Response(null,{status:101,webSocket:client});
        }
        return json({error:'接口不存在'},404);
      }catch(e){return json({error:e.message||'请求无效'},400);}
    });
  }
  async webSocketMessage(ws,data) {
    return this.serial(async()=>{
      let message;
      try{
        if(data==='ping'){ws.send('pong');return;}
        if(typeof data!=='string'||new TextEncoder().encode(data).length>4096)throw new Error('消息过大');
        message=JSON.parse(data);
        if(!message||typeof message!=='object'||Array.isArray(message))throw new Error('消息格式无效');
        const a=ws.deserializeAttachment(),r=this.room,p=r?.players.find(p=>p.id===a?.id);
        if(!p||p.connection!==a.connection)throw new Error('座位连接已失效');
        if(r.expiresAt<=Date.now())throw new Error('房间已过期，请重新创建房间');
        if(Date.now()-a.windowStart>10000){a.windowStart=Date.now();a.messages=0;}
        if(++a.messages>45)throw new Error('操作太快，请稍后再试');ws.serializeAttachment(a);
        if(message.type==='sync'){ws.send(JSON.stringify({type:'state',room:this.view(p.id)}));return;}
        if(typeof message.id!=='string'||message.id.length>80||message.id.length<8)throw new Error('缺少操作编号');
        if(p.seen.includes(message.id)){ws.send(JSON.stringify({type:'ack',id:message.id}));this.broadcast();return;}
        if(message.type==='hint'){
          if(r.kind!=='doudizhu'||!r.game)throw new Error('当前不能提示');
          ws.send(JSON.stringify({type:'hint',gameSeq:r.gameSeq,moves:hints(r.game,p.id)}));return;
        }
        const backup=structuredClone(r);
        try{
          switch(message.type){
            case 'chat':{
              if(typeof message.text!=='string')throw new Error('聊天内容无效');
              const text=message.text.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,'').trim();
              if(!text||[...text].length>120)throw new Error('聊天内容需要 1—120 个字');
              if(Date.now()-p.chatAt<750)throw new Error('慢一点发，大家才看得清');
              p.chatAt=Date.now();r.chat.push({id:uuid(),nickname:p.nickname,avatar:p.avatar,text,time:Date.now(),playerId:p.id});r.chat=r.chat.slice(-40);break;
            }
            case 'ready':if(r.game&&r.game.phase!=='finished')throw new Error('对局中不能更改准备');p.ready=!p.ready;break;
            case 'settings':{
              this.requireHost(p);if(r.game&&r.game.phase!=='finished')throw new Error('对局中不能修改规则');
              r.options=cleanOptions(r.kind,message.options);for(const x of r.players)x.ready=x.id===r.host;this.note('房主修改了规则，请重新准备');break;
            }
            case 'start':{
              this.requireHost(p);if(r.game&&r.game.phase!=='finished')throw new Error('这一局还没结束');
              if(!r.players.every(x=>x.ready && this.peers(x.id).length))throw new Error('请等待所有玩家在线并准备');
              const ids=r.players.map(x=>x.id);r.game=r.kind==='flying'?createFlying(ids,r.options.flying):createDoudizhu(ids);
              r.gameSeq++;this.setDeadline();this.note('对局开始，祝大家玩得开心');break;
            }
            case 'reset':{
              this.requireHost(p);r.game=null;r.deadline=null;r.gameSeq++;for(const x of r.players)x.ready=x.id===r.host;this.note('房主结束了当前对局，返回等待室');break;
            }
            case 'kick':{
              this.requireHost(p);if(r.game&&r.game.phase!=='finished')throw new Error('只能在等待室移除玩家');
              if(message.player===p.id)throw new Error('不能移除自己');this.removePlayer(message.player);break;
            }
            case 'leave':{
              if(r.game&&r.game.phase!=='finished')throw new Error('对局中座位会保留，关闭页面即可，回来仍可重连');
              this.removePlayer(p.id);break;
            }
            case 'roll':case 'move':case 'bid':case 'play':case 'pass':{
              if(!r.game||r.game.phase==='finished')throw new Error('没有正在进行的对局');
              if(message.gameSeq!==r.gameSeq)throw new Error('牌局已更新，已为你同步，请重新操作');
              if(r.kind==='flying'){
                if(message.type==='roll')roll(r.game,p.id);
                else if(message.type==='move')moveFlying(r.game,p.id,message.piece);
                else throw new Error('这不是飞行棋操作');
              }else{
                if(message.type==='bid')bid(r.game,p.id,message.value);
                else if(message.type==='play')play(r.game,p.id,message.cards);
                else if(message.type==='pass')pass(r.game,p.id);
                else throw new Error('这不是斗地主操作');
              }
              r.gameSeq++;this.setDeadline();this.finish();break;
            }
            default:throw new Error('未知操作');
          }
          if(r.players.includes(p)){p.seen.push(message.id);p.seen=p.seen.slice(-40);}
          r.seq++;r.expiresAt=Date.now()+ROOM_TTL;await this.persist();
        }catch(e){this.room=backup;throw e;}
        try{ws.send(JSON.stringify({type:'ack',id:message.id}));}catch{}
        this.broadcast();
      }catch(e){try{ws.send(JSON.stringify({type:'error',id:message?.id,error:e.message||'操作失败'}));if(this.room)this.broadcast();}catch{}}
    });
  }
  requireHost(p){if(this.room.host!==p.id)throw new Error('只有房主可以操作');}
  removePlayer(id){
    const r=this.room,index=r.players.findIndex(x=>x.id===id);if(index<0)throw new Error('找不到玩家');
    const [p]=r.players.splice(index,1);
    for(const s of this.peers(id)){try{s.send(JSON.stringify({type:'removed'}));s.close(4002,'已离开房间');}catch{}}
    if(r.host===id){r.host=r.players[0]?.id??null;if(r.players[0])r.players[0].ready=true;}
    if(r.game?.phase==='finished'){r.game=null;r.gameSeq++;}
    this.note(`${p.nickname} 离开了房间`);
  }
  async webSocketClose(ws,code,reason,wasClean){
    return this.serial(async()=>{
      try{ws.close(code===1005?1000:code,reason);}catch{}
      if(!this.room)return;
      if(!this.peers().length)this.room.deadline=null;
      this.room.seq++;await this.persist();this.broadcast();
    });
  }
  async webSocketError(ws,error){return this.webSocketClose(ws,1011,'连接异常',false);}
  async alarm(){
    return this.serial(async()=>{
      const r=this.room;if(!r)return;
      if(r.expiresAt<=Date.now()){
        for(const s of this.peers()){try{s.close(4003,'房间已过期');}catch{}}
        this.room=null;await this.ctx.storage.deleteAll();return;
      }
      if(r.deadline&&r.deadline<=Date.now()&&r.game?.phase!=='finished'){
        if(this.peers().length){
          const who=r.players.find(p=>p.id===r.game.ids[r.game.turn]);
          if(r.kind==='flying')autoFlying(r.game);else autoDoudizhu(r.game);
          r.gameSeq++;r.seq++;this.note(`${who?.nickname??'玩家'} 超时，已执行保底操作`);this.setDeadline();this.finish();
        }else r.deadline=null;
      }
      await this.persist();this.broadcast();
    });
  }
}
