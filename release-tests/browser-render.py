"""Render production online modules with an in-memory transport.
Chromium navigation is unavailable in this environment. set_content tests the
real DOM/controller/animation; release-tests/integration.test.mjs separately
runs the server room protocol. This is NOT a Cloudflare network acceptance test.
"""
import asyncio, json, re, base64
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]
P=ROOT/'public/flight'
OUT=ROOT/'test-results'; OUT.mkdir(exist_ok=True)

def wrap(name, path, special=''):
    s=path.read_text()
    s=re.sub(r"import (\w+) from ['\"](.+?)['\"];",lambda m: f"const {m[1]}=__mods['{Path(m[2]).stem}'].default;",s)
    s=re.sub(r"import \{([^}]+)\} from ['\"](.+?)['\"];",lambda m: f"const {{{m[1]}}}=__mods['{Path(m[2]).stem}'];",s)
    names=re.findall(r'export (?:async )?(?:const|function|class) (\w+)',s)
    s=re.sub(r'export default (\w+);',r'const __default=\1;',s)
    s=re.sub(r'\bexport (?=(?:async )?(?:const|function|class))','',s)
    if name=='network':
        s=s.replace('location.href',"'https://catroom.test/flight/?room=123456'").replace("location.protocol==='https:'","true")
    if name=='online':
        s=s.replace("code=new URL(location.href).searchParams.get('room')","code='123456'")
        s=s.replace('location.replace(url);',"window.__exit=url;")
    
    if name=='art':names.append('CT')
    s+=special
    returns=','.join(names)+(',default:__default' if 'const __default=' in s else '')
    return f"__mods['{name}']=(()=>{{\n{s}\nreturn {{{returns.lstrip(',')}}};\n}})();"

JS='const __mods={};\n'
for name in ['engine','art','pieces','view','network']:
    JS+=wrap(name,P/(name+'.js'))+'\n'
JS+="__mods.random={randomInt:()=>5};\n"
JS+=wrap('adapter',ROOT/'src/games/flying.js')
JS+=r'''
const A=__mods.adapter,F=__mods.engine.default;
let g=A.createFlying(['p0','p1']);
let r={code:'123456',kind:'flying',host:'p0',me:'p0',seq:1,gameSeq:1,
  players:[{id:'p0',nickname:'耄耋1',avatar:0,online:true,wins:0},{id:'p1',nickname:'大魏君王',avatar:1,online:true,wins:0}],
  options:{turnSeconds:45},deadline:Date.now()+45000,chat:[],game:g};
let transport=null,sends=[];
function publish(){r.seq++;if(transport?.readyState===1)transport.onmessage?.({data:JSON.stringify({type:'state',room:r})});}
class MemorySocket {
  constructor(){transport=this;this.readyState=0;setTimeout(()=>{this.readyState=1;this.onopen?.();setTimeout(()=>publish(),60);},0);}
  send(text){if(text==='ping'){this.onmessage?.({data:'pong'});return;}const p=JSON.parse(text);sends.push(p);if(p.type==='sync'){publish();return;}
    this.onmessage?.({data:JSON.stringify({type:'ack',id:p.id})});
    setTimeout(()=>{try{if(p.gameSeq!==r.gameSeq&&['roll','move'].includes(p.type))throw Error('stale');
      if(p.type==='roll')A.roll(g,r.me,()=>5);else if(p.type==='move')A.moveFlying(g,r.me,p.piece);
      else if(p.type==='chat')r.chat.push({id:p.id,nickname:'耄耋1',text:p.text,system:false});
      if(['roll','move'].includes(p.type))r.gameSeq++;publish();
    }catch(e){this.onmessage?.({data:JSON.stringify({type:'error',id:p.id,error:e.message})});publish();}},70);
  }
  close(){this.readyState=3;this.onclose?.({code:1000});}
}
window.WebSocket=MemorySocket;
window.fetch=async()=>({ok:true,status:200});
window.__harness={
  inject(spec={}){
    let seq=(g.engine?.seq||0)+2;const old=r.players;
    g=A.createFlying(spec.four?['p0','p1','p2','p3']:['p0','p1'],spec.options||{});g.engine.seq=seq;
    g.engine.pieces[0]=spec.red||[2,-1,8,-1];if(spec.blue)g.engine.pieces[2]=spec.blue;
    if(spec.turn!==undefined)g.engine.turn=spec.turn;
    A.roll(g,g.ids[g.colors.indexOf(g.engine.turn)],()=> (spec.die||3)-1);
    r.game=g;r.players=g.ids.map((id,i)=>old.find(p=>p.id===id)||{id,nickname:'朋友'+i,avatar:i,online:true,wins:0});r.gameSeq++;publish();
  },
  chat(text){r.chat.push({id:'chat-'+Date.now()+Math.random(),nickname:'测试好友',text});publish();},
  get(){return structuredClone(r);}, sends(){return structuredClone(sends);},
  disconnect(){transport.close();},
  legacy(){r.game={kind:'flying',ids:['p0','p1'],turn:0,phase:'playing'};r.upgradeRequired=true;publish();}
};
'''
JS+=wrap('online',P/'online.js')
markup=(P/'index.html').read_text()
markup=re.sub(r'<link rel="stylesheet"[^>]*>','',markup)
markup=re.sub(r'<script type="module"[^>]*></script>','',markup)
css='\n'.join((P/n).read_text() for n in ['style-0.css','style-1.css','style-2.css','online.css'])
# The environment is offline; only the test copy embeds the existing local avatar.
image=ROOT/'public/avatars/maodie-photo.png'
if image.exists():JS=JS.replace('/avatars/maodie-photo.png?v=034','data:image/png;base64,'+base64.b64encode(image.read_bytes()).decode())
markup=markup.replace('</head>','<style>'+css+'</style></head>').replace('</body>','<script>'+JS+'</script></body>')
(OUT/'render-harness.html').write_text(markup)
async def main():
    checks=[];errors=[]
    async with async_playwright() as pw:
        browser=await pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        page=await browser.new_page(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
        page.on('pageerror',lambda e:errors.append(str(e)))
        await page.set_content(markup,wait_until='domcontentloaded');await page.wait_for_timeout(200)
        async def check(ok,name):
            assert ok, name+'; '+str(errors);checks.append(name)
        await check(await page.locator('.token').count()==8,'two-player room renders 8 planes')
        await check(await page.locator('.token.available').count()==0,'before roll no legal highlight')
        await page.evaluate('__harness.inject()');await page.wait_for_timeout(80)
        await check(await page.locator('.token.available').count()==2,'only two server-legal planes highlighted')
        await check(await page.locator('[data-choice]:not(:disabled)').count()==2,'large buttons agree with server plans')
        before=await page.evaluate('__harness.get().game.engine.pieces[0][0]')
        await page.locator('[data-choice="0"]').click()
        await check(await page.locator('.token.selected').count()==1,'gold selected token')
        await check(await page.locator('#pathArt .preview-target').count()==1,'real landing target present')
        await check(await page.evaluate('__harness.get().game.engine.pieces[0][0]')==before,'selection cannot mutate server position')
        expected=await page.evaluate('__harness.get().game.plans.find(p=>p.index===0).to')
        await page.locator('#mainAction').click();await page.wait_for_timeout(1400)
        await check(await page.evaluate('__harness.get().game.engine.pieces[0][0]')==expected,'confirmation applies authoritative landing')
        await check(await page.locator('.token.available').count()==0,'opponent turn never highlights own planes')
        await check(await page.locator('#mainAction').is_disabled(),'opponent turn cannot submit')
        for name,opts in [('同色跳格',{'red':[1,-1,-1,-1],'die':1}),('飞行捷径',{'red':[17,-1,-1,-1],'die':1}),('跳后飞行',{'red':[13,-1,-1,-1],'die':1}),('终点入口',{'red':[49,-1,-1,-1],'die':1}),('终点通道',{'red':[50,-1,-1,-1],'die':1}),('终点反弹',{'red':[54,-1,-1,-1],'die':4}),('起飞',{'red':[-1,-1,-1,-1],'die':6})]:
            await page.evaluate('(x)=>__harness.inject(x)',opts);await page.wait_for_timeout(60)
            await page.locator('[data-choice="0"]').click()
            target=await page.evaluate('__harness.get().game.plans.find(x=>x.index===0).targetId')
            await page.locator('#mainAction').click();await page.wait_for_timeout(2000)
            await check(await page.locator('.token[data-color="0"][data-index="0"]').get_attribute('data-node')==target,name+' preview and animation agree')
        await page.evaluate('__harness.inject({four:true})');await page.wait_for_timeout(70)
        await check(await page.locator('.token').count()==16,'four-player room renders16')
        await page.evaluate('__harness.chat("<img src=x onerror=window.pwned=1>")');await page.wait_for_timeout(40)
        await check(await page.locator('#chatLog img').count()==0,'chat HTML escaped')
        await check(not await page.evaluate('!!window.pwned'),'chat cannot execute script')
        await page.locator('#chatInput').fill('联机测试');await page.locator('#chatForm button').click();await page.wait_for_timeout(150)
        await check(await page.locator('#chatLog').inner_text() and '联机测试' in await page.locator('#chatLog').inner_text(),'chat sends through controller')
        await page.locator('[data-choice="0"]').click()
        for theme in ['day','night','cream']:
            await page.locator('button[data-theme="'+theme+'"]').click();await page.wait_for_timeout(60)
            await check(await page.locator('body').get_attribute('data-theme')==theme,theme+' theme works')
            await check(await page.evaluate('document.documentElement.scrollWidth<=390'),theme+' no horizontal overflow')
            await page.screenshot(path=str(OUT/(theme+'-online.png')),full_page=True)
        await page.locator('#rules').click();await check(await page.locator('#dialog').is_visible(),'rules dialog opens');await page.locator('#dialog .close').click()
        await page.evaluate('__harness.legacy()');await page.wait_for_timeout(80)
        await check(await page.locator('.upgrade').count()==1,'legacy room pauses explicitly')
        await page.evaluate('__harness.chat("旧房间保留")');await page.wait_for_timeout(60)
        await check(not errors,'no browser runtime errors: '+str(errors))
        await browser.close()
    report={'checks':len(checks),'passed':checks,'errors':errors,'scope':'production UI/controller rendered offline; in-memory transport, not Cloudflare acceptance'}
    (OUT/'browser-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2))
asyncio.run(main())
