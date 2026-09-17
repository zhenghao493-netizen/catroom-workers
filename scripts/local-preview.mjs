/** Offline UI/protocol preview ONLY. Deploy src/worker.js with Wrangler. */
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {installGlobals,createNamespace} from '../release-tests/memory-runtime.mjs';
installGlobals();
const {default:worker}=await import('../src/worker.js');
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const rooms=createNamespace({alarms:true});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.json':'application/json'};
const env={ROOMS:rooms,CAT_PHOTOS:'off',ASSETS:{async fetch(req){
  const pathname=decodeURIComponent(new URL(req.url).pathname);
  let file=path.resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
  if(!file.startsWith(root))return new Response('Forbidden',{status:403});
  try{return new Response(await readFile(file),{headers:{'Content-Type':mime[path.extname(file)]??'application/octet-stream','Cache-Control':'no-store'}});}catch{
    if(!path.extname(pathname))return new Response(await readFile(path.join(root,'index.html')),{headers:{'Content-Type':'text/html; charset=utf-8'}});
    return new Response('Not found',{status:404});
  }
}}};
async function convert(req){const a=[];let n=0;for await(const chunk of req){n+=chunk.length;if(n>8192)throw new Error('too large');a.push(chunk);}return new Request(`http://${req.headers.host}${req.url}`,{method:req.method,headers:req.headers,body:a.length?Buffer.concat(a):undefined});}
const server=http.createServer(async(req,res)=>{
  try{
    // TEST HARNESS ONLY: this HTTP server is never the deployed Worker.
    if(process.env.CATROOM_TEST==='1'&&req.url?.startsWith('/__test__/')){
      const body=await (await convert(req)).json();const obj=rooms.entries.get(body.code)?.object;
      if(!obj)throw new Error('missing test room');await obj.tail;
      const {createFlying,roll}=await import('../src/games/flying.js');
      const r=obj.room;const g=r.game;
      if(req.url==='/__test__/scenario'){
        r.game=createFlying(g.ids,r.options.flying);const n=r.game;n.engine.seq=g.engine?.seq??0;
        n.engine.pieces[0]=body.pieces??[12,-1,45,-1];
        if(body.otherPieces)n.engine.pieces[n.colors[1]]=body.otherPieces;
        roll(n,n.ids[0],()=>body.die-1);r.gameSeq++;r.seq++;await obj.persist();obj.broadcast();
      }else if(req.url==='/__test__/legacy'){
        r.game={kind:'flying',phase:'playing',ids:g.ids,colors:[0,2],turn:0,pieces:[[-2,-2,-2,-2],[-2,-2,-2,-2]],dice:null};r.seq++;await obj.persist();obj.broadcast();
      }
      res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true,game:r.game}));return;
    }
    if(req.url==='/api/health'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true,app:'catroom',runtime:'local-test-adapter',version:'0.5.0'}));return;}
    const result=await worker.fetch(await convert(req),env);res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));
  }catch(e){res.writeHead(500);res.end('Local preview error');console.error(e);}
});
function frame(payload,opcode=1){
  const b=Buffer.from(payload);let header;
  if(b.length<126){header=Buffer.from([128|opcode,b.length]);}
  else{header=Buffer.alloc(4);header[0]=128|opcode;header[1]=126;header.writeUInt16BE(b.length,2);}
  return Buffer.concat([header,b]);
}
server.on('upgrade',async(req,socket,head)=>{
  try{
    const request=new Request(`http://${req.headers.host}${req.url}`,{headers:req.headers});
    const response=await worker.fetch(request,env);
    if(response.status!==101){socket.end(`HTTP/1.1 ${response.status} Error\r\nConnection: close\r\n\r\n`);return;}
    const key=req.headers['sec-websocket-key'];if(!key){socket.destroy();return;}
    const accept=createHash('sha1').update(key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    const ws=response.webSocket;
    ws.receive=data=>{if(!socket.destroyed)socket.write(frame(data));};
    ws.onClose=(code,reason)=>{if(!socket.destroyed){const p=Buffer.alloc(2);p.writeUInt16BE(code>=1000?code:1000);socket.end(frame(Buffer.concat([p,Buffer.from(reason).subarray(0,100)]),8));}};
    ws.drain();let buffer=Buffer.alloc(0),fragment=[];
    const consume=chunk=>{
      buffer=Buffer.concat([buffer,chunk]);
      while(buffer.length>=2){
        const op=buffer[0]&15,fin=!!(buffer[0]&128),masked=!!(buffer[1]&128);let len=buffer[1]&127,offset=2;
        if(len===126){if(buffer.length<4)return;len=buffer.readUInt16BE(2);offset=4;}
        else if(len===127){socket.destroy();return;}
        if(len>8192||!masked){socket.destroy();return;}
        if(buffer.length<offset+4+len)return;
        const mask=buffer.subarray(offset,offset+4),payload=Buffer.from(buffer.subarray(offset+4,offset+4+len));
        for(let i=0;i<payload.length;i++)payload[i]^=mask[i%4];buffer=buffer.subarray(offset+4+len);
        if(op===8){ws.close(1000,'');return;}if(op===9){socket.write(frame(payload,10));continue;}if(op===10)continue;
        if(op!==1&&op!==0){socket.destroy();return;}fragment.push(payload);
        if(fragment.reduce((n,b)=>n+b.length,0)>8192){socket.destroy();return;}
        if(fin){ws.send(Buffer.concat(fragment).toString('utf8'));fragment=[];}
      }
    };
    socket.on('data',consume);
    socket.on('error',()=>{});
    socket.on('close',()=>{
      const serverWs=ws.peer;
      ws.readyState=3;serverWs.readyState=3;
      const room=rooms.entries.get(req.url.match(/rooms\/(\d+)/)?.[1]);
      if(room)void room.object.webSocketClose(serverWs,1000,'local disconnect',true);
    });
    if(head.length)consume(head);
  }catch(e){console.error(e);socket.destroy();}
});
const port=Number(process.env.PORT??8787);
server.listen(port,'127.0.0.1',()=>console.log(`猫猫开局离线预览 http://127.0.0.1:${port}\n运行真实应用逻辑，但 Durable Object API 为测试替身；不是 Cloudflare 部署验证。`));
