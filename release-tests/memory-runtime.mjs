/** Test double for the small subset of Durable Object APIs used by the app.
 * Not Miniflare/workerd. Not a production server. Same application modules run
 * unchanged; Cloudflare's storage gates/billing/real eviction are NOT emulated.
 */
import {GameRoom} from '../src/server/flight-room.js';
const NativeResponse=globalThis.Response;
export class MemorySocket {
  constructor(){this.readyState=1;this.attachment=null;this.buffer=[];this.receive=null;this.onClose=null;}
  serializeAttachment(x){this.attachment=structuredClone(x);}
  deserializeAttachment(){return structuredClone(this.attachment);}
  send(x){if(this.readyState!==1)throw new Error('closed socket');if(this.peer.receive)this.peer.receive(x);else this.peer.buffer.push(x);}
  close(code=1000,reason=''){if(this.readyState!==1)return;this.readyState=3;this.peer.readyState=3;this.onClose?.(code,reason);this.peer.onClose?.(code,reason);}
  drain(){for(const x of this.buffer.splice(0))this.receive?.(x);}
}
export function installGlobals(){
  globalThis.WebSocketPair=class {constructor(){this[0]=new MemorySocket();this[1]=new MemorySocket();this[0].peer=this[1];this[1].peer=this[0];}};
  globalThis.WebSocketRequestResponsePair=class{constructor(request,response){this.request=request;this.response=response;}};
  globalThis.Response=class extends NativeResponse{constructor(body,options={}){if(options.status===101){super(null,{status:200,headers:options.headers});Object.defineProperty(this,'status',{value:101});this.webSocket=options.webSocket;}else super(body,options);}};
}
export function createNamespace({alarms=false}={}) {
  const entries=new Map();
  function get(name){
    if(entries.has(name))return entries.get(name).object;
    const entry={map:new Map(),sockets:[],alarm:null,timer:null,auto:null,object:null};
    const ctx={
      storage:{
        async get(k){return structuredClone(entry.map.get(k));},
        async put(k,v){entry.map.set(k,structuredClone(v));},
        async deleteAll(){entry.map.clear();clearTimeout(entry.timer);entry.alarm=null;},
        async setAlarm(time){entry.alarm=Number(time);if(alarms){clearTimeout(entry.timer);entry.timer=setTimeout(()=>entry.object.alarm().catch(console.error),Math.max(1,Number(time)-Date.now()));entry.timer.unref();}}
      },
      blockConcurrencyWhile:fn=>fn(),
      acceptWebSocket(ws){entry.sockets.push(ws);ws.receive=data=>{if(entry.auto&&data===entry.auto.request)ws.send(entry.auto.response);else void entry.object.webSocketMessage(ws,data);};},
      getWebSockets(){return entry.sockets.filter(s=>s.readyState===1);},
      setWebSocketAutoResponse(pair){entry.auto=pair;}
    };
    entry.ctx=ctx;entry.object=new GameRoom(ctx,{});entries.set(name,entry);return entry.object;
  }
  return {idFromName:x=>x,get,entries,
    async evict(name){const e=entries.get(name);await e.object.tail;e.object=new GameRoom(e.ctx,{});await e.object.ready;return e.object;},
    close(){for(const e of entries.values())clearTimeout(e.timer);}
  };
}
