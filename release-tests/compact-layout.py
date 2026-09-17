"""UI 051 local viewport regression. Run: python release-tests/compact-layout.py.
Requires Node, Python Playwright and Chromium (CHROMIUM_PATH may select a binary).
Links the actual production source into one local script; substitutes ONLY room/origin,
HTTP bootstrap, avatar embedding and WebSocket transport. No network calls to live rooms.
Browser screenshots are viewport simulations, not phone hardware acceptance.
"""
import json, pathlib, subprocess, re, base64, os, shutil
from playwright.sync_api import sync_playwright
BASE=pathlib.Path(__file__).resolve().parents[1]
ROOT=BASE/'public'
OUT=BASE/'test-results/compact';OUT.mkdir(parents=True,exist_ok=True)
fixtures=json.loads(subprocess.check_output(['node',str(BASE/'release-tests/compact-fixtures.mjs')],cwd=BASE,text=True))
records=[];errors=[]
def bundle(path):
 def wrap(name,file,imports,out):
  text=(path/file).read_text();text=re.sub(r'^import .*?;\n','',text,flags=re.M);text=text.replace('export default Flight;','').replace('export function ','function ').replace('export async function ','async function ').replace('export const ','const ').replace('export class ','class ')
  # Only the browser bootstrap's origin/room and local avatar loading are substituted.
  if file=='network.js':text=text.replace('location.href',"'https://catroom.test/'")
  if file=='online.js':text=text.replace("new URL(location.href).searchParams.get('room')","'123456'")
  img=(ROOT/'avatars/maodie-photo.png').read_bytes()
  text=text.replace('/avatars/maodie-photo.png?v=034','data:image/png;base64,'+base64.b64encode(img).decode())
  return 'const '+name+'=(()=>{\n'+imports+'\n'+text+'\nreturn '+out+';})();\n'
 js=''
 js+=wrap('Flight','engine.js','','Flight')
 js+=wrap('Art','art.js','','{ico,NAMES,C,CT,boardDrawing}')
 js+=wrap('Pieces','pieces.js','const {ico,NAMES}=Art;','{drawPieces,drawPath,paintDie,moveSummary,animateMove}')
 js+=wrap('View','view.js','const {ico,NAMES,C,CT,boardDrawing}=Art;const {drawPieces,drawPath,paintDie,moveSummary}=Pieces;','{paintView,paintConnection,paintClock}')
 js+=wrap('Network','network.js','','{RoomConnection}')
 if (path/'compact.js').exists():js+=wrap('Compact','compact.js','','{installCompactLayout}')
 js+=wrap('Online','online.js','const {ico,NAMES}=Art;const {RoomConnection}=Network;const {paintView,paintConnection,paintClock}=View;const {animateMove,moveSummary}=Pieces;'+('const {installCompactLayout}=Compact;' if (path/'compact.js').exists() else ''),'{}')
 js+='window.__testEngine=Flight;'
 html=(path/'index.html').read_text();html=re.sub(r'<script\b[^>]*>.*?</script>','',html,flags=re.S)
 def inline(m):
  name=m.group(1).split('?')[0];return '<style>'+ (path/name).read_text()+'</style>'
 html=re.sub(r'<link rel="stylesheet" href="\./([^"]+)">',inline,html)
 return html,js

html,js=bundle(ROOT/'flight')
MOCK=r'''window.__sent=[];window.__sockets=[];window.WebSocket=class {
 constructor(url){this.url=url;this.readyState=0;window.__sockets.push(this);setTimeout(()=>{this.readyState=1;this.onopen?.();setTimeout(()=>this.emit(window.__fixture),20)},20);}
 emit(r){this.onmessage?.({data:JSON.stringify({type:'state',room:r})});}
 send(raw){if(raw==='ping'){this.onmessage?.({data:'pong'});return;}window.__sent.push(JSON.parse(raw));}
 close(){this.readyState=3;this.onclose?.({code:1000});}
};'''
MEASURE=r'''()=>{
 const rect=s=>{const el=document.querySelector(s),r=el?.getBoundingClientRect();return r?{x:r.x,y:r.y,w:r.width,h:r.height,b:r.bottom,r:r.right}:null};
 return {width:innerWidth,height:innerHeight,scrollW:document.documentElement.scrollWidth,scrollH:document.documentElement.scrollHeight,board:rect('#board'),shell:rect('.board-shell'),slot:rect('.board-slot'),seats:rect('#seats'),seat:rect('.seat'),main:rect('#mainAction'),choices:rect('#choices'),panel:rect('.control-panel'),gamebar:rect('.gamebar'),top:rect('.top'),theme:document.body.dataset.theme,phase:document.body.dataset.round,mainText:document.querySelector('#mainAction').textContent,available:document.querySelectorAll('.token.available').length,buttons:[...document.querySelectorAll('.choice')].map(b=>({h:b.getBoundingClientRect().height,w:b.getBoundingClientRect().width,disabled:b.disabled}))};}'''
def assert_check(name,condition,data=None):
 records.append({'name':name,'pass':bool(condition),**({'details':data} if not condition else {})})
 if not condition:print('FAIL',name,data)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),args=['--no-sandbox'])
 context=browser.new_context(viewport={'width':390,'height':700},device_scale_factor=2,is_mobile=True,has_touch=True)
 page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html);page.evaluate('window.__fixture='+json.dumps(fixtures['2-choose-0-false']));page.add_script_tag(content=MOCK+"window.fetch=async()=>new Response('{}',{status:200});");page.add_script_tag(content=js);page.wait_for_selector('.token');page.wait_for_timeout(250)
 print('INITIAL',json.dumps(page.evaluate(MEASURE),ensure_ascii=False))
 page.screenshot(path=str(OUT/'compact-first.png'))
 sizes=[(320,568),(360,600),(375,627),(390,664),(390,700),(416,720),(430,760),(390,844),(844,390)]
 for w,h in sizes:
  page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(80)
  for count in [2,3,4]:
   for phase in ['roll','choose','opponent','finished']:
    room=fixtures[f'{count}-{phase}-0-true'];room['seq']=100+len(records);room['gameSeq']=100+len(records);room['game']['engine']['seq']=100+len(records)
    page.evaluate('(r)=>{window.__fixture=r;window.__sockets.at(-1).emit(r)}',room);page.wait_for_timeout(60)
    m=page.evaluate(MEASURE);label=f'{w}x{h}/{count}/{phase}'
    assert_check(label+'/one-screen',m['scrollW']<=w+1 and m['scrollH']<=h+1 and m['board']['y']>=0 and m['main']['b']<=h and m['choices']['b']<=h,m)
    assert_check(label+'/square-no-overlap',abs(m['board']['w']-m['board']['h'])<1 and (m['board']['b']<=m['seats']['y'] or m['board']['r']<=m['seats']['x']) and m['choices']['y']>=m['main']['b']-1,m)
    assert_check(label+'/seat-and-touch',m['seat']['h']<=45 and all(b['h']>=44 and b['w']>=44 for b in m['buttons']),m)
 page.set_viewport_size({'width':390,'height':700});room=fixtures['2-choose-0-false'];room['seq']=1000;room['gameSeq']=1000;room['game']['engine']['seq']=1000
 page.evaluate('(r)=>{window.__fixture=r;window.__sockets.at(-1).emit(r)}',room);page.wait_for_timeout(100)
 for theme in ['day','night','cream']:
  page.click('#displaySettings');page.wait_for_selector('#toolsDialog[open]');page.click(f'#toolsDialog [data-theme={theme}]');page.click('#toolsClose');page.wait_for_timeout(80)
  assert_check('theme/'+theme,page.evaluate('document.body.dataset.theme')==theme)
  page.screenshot(path=str(OUT/f'compact-{theme}.png'))
 page.click('#displaySettings');page.click('#toolsDialog [data-theme=day]');page.click('#toolsClose')
 page.click('[data-choice="0"]');page.wait_for_timeout(80)
 assert_check('select-only/no-send',page.evaluate('window.__sent.length')==0)
 assert_check('selected/path+button',page.locator('.token.selected').count()==1 and page.locator('#pathArt .preview-target').count()==1 and page.locator('#mainAction').is_enabled())
 page.screenshot(path=str(OUT/'compact-selected.png'))
 page.click('#mainAction');page.wait_for_timeout(50)
 assert_check('send-one-move+lock',page.evaluate('window.__sent.filter(x=>x.type==="move").length')==1 and page.locator('#mainAction').is_disabled())
 # Server acknowledgement + authoritative update exercises the real animation controller.
 page.evaluate('''async()=>{const F=window.__testEngine;const r=structuredClone(window.__fixture);const result=F.execute(r.game.engine,0);r.game.engine=result.state;r.game.turn=r.game.colors.indexOf(result.state.turn);r.game.plans=[];r.seq++;r.gameSeq++;window.__fixture=r;window.__sockets.at(-1).emit(r);}''');page.wait_for_timeout(1500)
 assert_check('animated-move-complete',not page.evaluate('window.__FLIGHT_ONLINE__.getBusy()'))
 page.click('#displaySettings');page.click('#chatOpen');page.wait_for_selector('#chatDialog[open]')
 assert_check('chat/dialog-not-page-scroll',not page.locator('#toolsDialog').is_visible() and page.evaluate('scrollY')==0)
 page.fill('#chatInput','消息 <b>不执行</b>');page.click('#chatForm button');page.wait_for_timeout(20)
 assert_check('chat/send-preserved',page.evaluate('window.__sent.some(x=>x.type==="chat"&&x.text==="消息 <b>不执行</b>")'))
 page.fill('#chatInput','保留草稿');page.click('#chatClose');page.click('#displaySettings');page.click('#chatOpen')
 assert_check('chat/draft-preserved',page.input_value('#chatInput')=='保留草稿')
 page.screenshot(path=str(OUT/'compact-chat.png'))
 page.set_viewport_size({'width':390,'height':360});page.wait_for_timeout(100)
 cr=page.locator('#chatDialog').bounding_box();ir=page.locator('#chatInput').bounding_box()
 assert_check('chat/short-keyboard-space',cr['y']>=0 and cr['y']+cr['height']<=361 and ir['y']+ir['height']<=361,{'dialog':cr,'input':ir})
 page.set_viewport_size({'width':390,'height':700});page.wait_for_timeout(100);page.click('#chatClose')
 page.click('#displaySettings');page.click('#rules');page.wait_for_selector('#dialog[open]')
 assert_check('rules/single-dialog',page.locator('dialog[open]').count()==1 and '白圈是可走' in page.locator('#dialog').inner_text());page.locator('#dialog .close').click()
 room=fixtures['2-finished-0-false'];room['seq']=2000;room['gameSeq']=2000;room['game']['engine']['seq']=2000
 page.evaluate('(r)=>{window.__fixture=r;window.__sockets.at(-1).emit(r)}',room);page.wait_for_timeout(80)
 page.screenshot(path=str(OUT/'compact-finished.png'))
 assert_check('finished/host-rematch',page.locator('#mainAction').is_enabled() and page.locator('#mainAction').inner_text()=='再来一局')
 page.click('#mainAction');assert_check('rematch/explicit-confirmation',page.locator('#confirmRematch').count()==1 and not page.evaluate('window.__sent.some(x=>x.type==="reset")'))
 page.locator('#dialog .close').click()
 page.click('#displaySettings');page.click('#chatOpen');page.fill('#chatInput','旋转保留');page.set_viewport_size({'width':1280,'height':900});page.wait_for_timeout(100)
 assert_check('desktop/restore-and-close',page.locator('.right .chat-panel').count()==1 and page.locator('.title-row .theme-switch').count()==1 and page.locator('dialog[open]').count()==0 and page.input_value('#chatInput')=='旋转保留')
 page.screenshot(path=str(OUT/'desktop.png'))
 page.set_viewport_size({'width':390,'height':700});page.wait_for_timeout(100)
 # Non-host victory view must not expose an enabled reset button.
 room=fixtures['2-finished-2-false'];room['seq']=3000;room['gameSeq']=3000;room['game']['engine']['seq']=3000
 page.evaluate('(r)=>{window.__fixture=r;window.__sockets.at(-1).emit(r)}',room);page.wait_for_timeout(100)
 assert_check('finished/guest-waits-for-host',page.locator('#mainAction').is_disabled() and page.locator('#mainAction').inner_text()=='等待房主开局')
 page.screenshot(path=str(OUT/'compact-finished-guest.png'))
 # Text chat stays escaped after being received and the turn selection is not changed.
 room['seq']=3001;room['chat'].append({'id':'xss-1','nickname':'<script>name</script>','text':'<img src=x onerror=alert(1)>','system':False})
 page.evaluate('(r)=>window.__sockets.at(-1).emit(r)',room);page.wait_for_timeout(30)
 assert_check('chat/received-escaped',page.locator('#chatLog script,#chatLog img').count()==0 and '<img src=x' in page.locator('#chatLog').text_content())
 page.evaluate("window.__sockets.at(-1).onclose({code:4001})");page.wait_for_timeout(50)
 assert_check('disconnect/actions-disabled',page.locator('#mainAction').is_disabled() and page.locator('.token.available').count()==0)
 assert_check('portrait/re-enter-compact',page.locator('#chatSlot .chat-panel').count()==1 and page.locator('#toolsTheme .theme-switch').count()==1)
 assert_check('browser/no-exceptions',not errors,errors)
 browser.close()
(OUT/'layout-report.json').write_text(json.dumps({'scope':'Chromium mobile viewports with local mocked WebSocket; no production game commands sent','checks':len(records),'passed':sum(x['pass'] for x in records),'errors':errors,'results':records},ensure_ascii=False,indent=2));print('TOTAL',len(records),'PASS',sum(x['pass'] for x in records));

if any(not r['pass'] for r in records):
 raise SystemExit(1)
