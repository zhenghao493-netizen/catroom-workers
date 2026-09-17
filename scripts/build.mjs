/** Rebuild static assets at DEPLOY TIME, never decode gzip in a browser request.
 * The archived v0.3 lobby/DDZ sources are retained, not rewritten. Only flying
 * room navigation is changed; the new flying UI and shared engine are plain JS.
 */
import {readFile,writeFile,mkdir,readdir,cp,rm} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url)),src=resolve(root,'public'),out=resolve(root,'dist');
process.chdir(root);
async function unpack(name){
  const files=(await readdir(resolve(src,'_packed'))).filter(n=>n.startsWith(name+'-')&&n.endsWith('.b64')).sort();
  if(!files.length)throw new Error('Missing archived source: '+name);
  files.forEach((f,i)=>{if(f!==`${name}-${String(i).padStart(2,'0')}.b64`)throw new Error('Non-contiguous source chunks');});
  const chunks=await Promise.all(files.map(f=>readFile(resolve(src,'_packed',f),'utf8')));
  return gunzipSync(Buffer.from(chunks.join('').replace(/\s/g,''),'base64')).toString('utf8');
}
function once(text,from,to){if(text.split(from).length!==2)throw new Error('Unexpected legacy source: '+from);return text.replace(from,to);}
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
await cp(src,out,{recursive:true,filter:p=>!/[\/]_(?:packed|encoded|bundle)(?:[\/]|$)/.test(p)&&!p.endsWith('.gz')});
let app=await unpack('app');
app=once(app,'function render(){',`function render(){
  if(room?.kind==='flying'&&room.game){
    intentional=true;clearTimeout(retryTimer);clearInterval(heartbeat);
    if(socket){socket.onclose=null;socket.close();}
    location.replace('/flight/?room='+encodeURIComponent(room.code));return;
  }`);
await writeFile(resolve(out,'app.js'),app);await writeFile(resolve(out,'style.css'),await unpack('style'));
let index=await readFile(resolve(src,'index.html'),'utf8');
index=index.replace(/<link\b[^>]*href="\/flying-enhance\.css[^>]*>/g,'').replace(/\/app\.js\?v=\d+/g,'/app.js?v=050').replace(/\/style\.css\?v=\d+/g,'/style.css?v=050');
await writeFile(resolve(out,'index.html'),index);
await cp(resolve(root,'vendor/tabler.LICENSE'),resolve(out,'flight/LICENSE.Tabler.txt'));
async function checkJS(dir){for(const d of await readdir(dir,{withFileTypes:true})){const p=resolve(dir,d.name);if(d.isDirectory())await checkJS(p);else if(extname(p)==='.js')execFileSync(process.execPath,['--check',p],{stdio:'pipe'});}}
await checkJS(out);
// This manifest also lets deployment smoke tests identify the actual build.
const files=['app.js','style.css','flight/engine.js','flight/online.js','flight/art.js'];
const hashes={};for(const f of files)hashes[f]=createHash('sha256').update(await readFile(resolve(out,f))).digest('hex');
await writeFile(resolve(out,'release.json'),JSON.stringify({version:'0.5.0',ruleset:'flight-lab-1',files:hashes},null,2));
if(!process.argv.includes('--skip-tests'))execFileSync(process.execPath,['--test','release-tests/engine.test.mjs','release-tests/integration.test.mjs','release-tests/network.test.mjs'],{stdio:'inherit'});
console.log('Catroom 0.5.0 build verified: plain static assets and shared flying engine');
