/** One browser session / one seat. Server state and plans are authoritative. */
export class RoomConnection {
  constructor(code,handlers={}){this.code=code;this.handlers=handlers;this.room=null;this.ws=null;this.connected=false;this.synced=false;this.pending=null;this.retry=0;this.stopped=false;this.timer=null;this.heartbeat=null;this.watchdog=null;this.lastPong=0;}
  connect(){
    if(this.stopped)return;clearTimeout(this.timer);this.clearPending();
    const previous=this.ws;if(previous){previous.onclose=null;previous.close();}
    const url=new URL(`/api/rooms/${this.code}/ws`,location.href);url.protocol=location.protocol==='https:'?'wss:':'ws:';
    const ws=new WebSocket(url);this.ws=ws;this.connected=false;this.synced=false;this.handlers.status?.(this);
    ws.onopen=()=>{
      if(ws!==this.ws)return;this.connected=true;this.retry=0;this.lastPong=Date.now();
      clearInterval(this.heartbeat);this.heartbeat=setInterval(()=>{if(ws.readyState!==1)return;if(Date.now()-this.lastPong>55000){ws.close();return;}ws.send('ping');},22000);
      this.handlers.status?.(this);
    };
    ws.onmessage=e=>{
      if(ws!==this.ws)return;this.lastPong=Date.now();if(e.data==='pong')return;
      let m;try{m=JSON.parse(e.data);}catch{return;}
      if(m.type==='state'){
        if(this.room&&m.room.seq<this.room.seq)return;
        if(this.pending&&m.room.gameSeq>this.pending.gameSeq)this.clearPending();
        this.room=m.room;this.synced=true;this.handlers.state?.(m.room,this);
      }else if(m.type==='ack'){
        // ACK can precede state. Do not unlock against the old turn/dice.
        if(this.pending?.id===m.id)this.pending.acked=true;
      }else if(m.type==='error'){
        if(!m.id||this.pending?.id===m.id)this.clearPending();
        this.handlers.error?.(m.error);this.handlers.status?.(this);
      }else if(m.type==='removed'){
        this.stop();this.handlers.removed?.();
      }
    };
    ws.onerror=()=>{};
    ws.onclose=e=>{
      if(ws!==this.ws)return;this.connected=false;this.synced=false;clearInterval(this.heartbeat);this.clearPending();this.handlers.status?.(this);
      if([4001,4002,4003].includes(e.code)){
        this.stopped=true;this.handlers.error?.(e.code===4001?'座位已在另一个页面打开，点击顶部重连可取回':e.code===4003?'房间已过期，请回大厅重新开房':'已离开房间');return;
      }
      if(!this.stopped&&this.retry<12)this.timer=setTimeout(()=>this.connect(),Math.min(15000,600*2**Math.min(this.retry++,5)));
      else if(!this.stopped)this.handlers.error?.('连接暂未恢复，点击顶部重连');
    };
  }
  clearPending(){this.pending=null;clearTimeout(this.watchdog);}
  send(type,extra={}){
    if(!this.connected||!this.synced||this.ws?.readyState!==1||!this.room){this.handlers.error?.('连接正在恢复，请稍等');return false;}
    const game=['roll','move','reset','ready','start'].includes(type);
    if(game&&this.pending)return false;
    const id=crypto.randomUUID?.()??Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
    const packet={...extra,id,type,gameSeq:this.room.gameSeq,protocol:'flight-lab-1'};
    if(game){this.pending={id,gameSeq:this.room.gameSeq};this.watchdog=setTimeout(()=>{
      if(this.ws?.readyState===1){this.ws.send(JSON.stringify({type:'sync'}));this.handlers.error?.('正在核对服务器状态，请稍等');}
      // Never repeat a move automatically. Reconnect obtains a fresh state.
      this.timer=setTimeout(()=>{if(this.pending)this.connect();},5000);
    },7000);}
    this.ws.send(JSON.stringify(packet));this.handlers.status?.(this);return true;
  }
  reconnect(){this.stopped=false;this.clearPending();this.connect();}
  stop(){this.stopped=true;clearTimeout(this.timer);clearInterval(this.heartbeat);this.clearPending();if(this.ws){this.ws.onclose=null;this.ws.close();}this.connected=false;}
}
