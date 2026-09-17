import {GameRoom,json} from './server/room.js';
import {randomInt} from './games/random.js';
import {serveAvatar} from './server/avatar-sources.js';
export {GameRoom};
const COOKIE='catroom_sid';
async function compressedAsset(request,env,path,type){
  const asset=await env.ASSETS.fetch(new Request(new URL(path,request.url),{method:'GET',headers:request.headers}));
  if(!asset.ok)return asset;
  let bytes=new Uint8Array(await asset.arrayBuffer());
  const isGzip=bytes.length>2&&bytes[0]===0x1f&&bytes[1]===0x8b;
  if(isGzip){
    try{
      const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
      bytes=new Uint8Array(await new Response(stream).arrayBuffer());
    }catch{
      return new Response('asset decompression failed',{status:500,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
    }
  }
  const headers=new Headers();
  headers.set('Content-Type',type);
  headers.set('Cache-Control','no-store');
  headers.set('X-Content-Type-Options','nosniff');
  headers.set('X-Catroom-Asset','plain');
  return new Response(bytes,{status:200,headers});
}
async function boundedBody(request,maxBytes=4096){
  if(!request.body)return '';
  const reader=request.body.getReader(),parts=[];let size=0;
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();return null;}parts.push(value);}
  const bytes=new Uint8Array(size);let at=0;for(const part of parts){bytes.set(part,at);at+=part.byteLength;}
  return new TextDecoder().decode(bytes);
}
function session(request){
  const match=(request.headers.get('Cookie')??'').match(/(?:^|;\s*)catroom_sid=([a-f0-9]{64})(?:;|$)/);
  if(match)return {token:match[1],fresh:false};
  const bytes=crypto.getRandomValues(new Uint8Array(32));return {token:Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join(''),fresh:true};
}
function secureResponse(response,request,sid){
  if(response.status===101)return response;
  const headers=new Headers(response.headers);
  if(sid?.fresh)headers.set('Set-Cookie',`${COOKIE}=${sid.token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000${new URL(request.url).protocol==='https:'?'; Secure':''}`);
  headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','same-origin');
  return new Response(response.body,{status:response.status,headers});
}
export default {
  async fetch(request,env,ctx){
    try{
      const url=new URL(request.url);
      if(request.method==='GET'&&url.pathname==='/app.js')return compressedAsset(request,env,'/app.js.gz','text/javascript; charset=utf-8');
      if(request.method==='GET'&&url.pathname==='/style.css')return compressedAsset(request,env,'/style.css.gz','text/css; charset=utf-8');
      if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
      const imageRoute=url.pathname.match(/^\/api\/avatars\/([0-5])$/);
      if(imageRoute&&request.method==='GET')return serveAvatar(request,env,ctx,Number(imageRoute[1]));
      if(url.pathname==='/api/health')return json({ok:true,app:'catroom',version:'0.3.2',runtime:'cloudflare-workers'});
      const origin=request.headers.get('Origin');
      if(origin&&origin!==url.origin)return json({error:'不接受跨站请求'},403);
      if(request.method!=='GET'&&request.method!=='POST')return json({error:'不支持的请求方法'},405);
      const sid=session(request);
      let body=null;
      if(request.method==='POST'){
        if(!request.headers.get('Content-Type')?.includes('application/json'))return json({error:'需要 JSON 请求'},415);
        if(Number(request.headers.get('Content-Length'))>4096)return json({error:'请求过大'},413);
        const raw=await boundedBody(request);if(raw===null)return json({error:'请求过大'},413);
        try{body=JSON.parse(raw);}catch{return json({error:'JSON 格式无效'},400);}
        if(!body||typeof body!=='object'||Array.isArray(body))return json({error:'请求格式无效'},400);
      }
      const call=(code,path,method,body)=>{
        const id=env.ROOMS.idFromName(code),stub=env.ROOMS.get(id),headers=new Headers(request.headers);
        headers.set('X-Player-Token',sid.token);headers.delete('Content-Length');headers.delete('Cookie');
        if(body)headers.set('Content-Type','application/json');
        return stub.fetch(new Request(`https://internal${path}`,{method,headers,body:body?JSON.stringify(body):undefined}));
      };
      if(url.pathname==='/api/rooms'&&request.method==='POST'){
        for(let i=0;i<6;i++){
          const code=String(100000+randomInt(900000)),result=await call(code,'/init','POST',{...body,code});
          if(result.status!==409)return secureResponse(result,request,sid);
        }
        return json({error:'暂时无法分配房间号，请再试一次'},503);
      }
      const m=url.pathname.match(/^\/api\/rooms\/(\d{6})\/(join|state|ws)$/);
      if(!m)return json({error:'接口不存在'},404);
      if((m[2]==='join')!==(request.method==='POST'))return json({error:'请求方法无效'},405);
      return secureResponse(await call(m[1],`/${m[2]}`,request.method,body),request,sid);
    }catch{return json({error:'服务暂时不可用，请稍后重试'},500);}
  }
};
