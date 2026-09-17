import Flight from './engine.js';
const PLANE='M12.868 2.504l3.712 6.496h3.42a3 3 0 0 1 0 6h-3.42l-3.712 6.496a1 1 0 0 1 -.868 .504h-3a1 1 0 0 1 -.962 -1.275l1.636 -5.725h-2.26l-1.707 1.707a1 1 0 0 1 -.707 .293h-3a1 1 0 0 1 -.894 -1.447l1.776 -3.553l-1.776 -3.553a1 1 0 0 1 .894 -1.447h3a1 1 0 0 1 .707 .293l1.707 1.707h2.26l-1.636 -5.725a1 1 0 0 1 .962 -1.275h3a1 1 0 0 1 .868 .504';
const symbol={route:'M5 5a2 2 0 1 0 0 .01M19 19a2 2 0 1 0 0 .01M7 5h7a4 4 0 0 1 0 8H9a3 3 0 0 0 0 6h8',refresh:'M20 8a8 8 0 1 0 1 7M20 3v5h-5',book:'M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Zm0 0v15',volume:'M11 5 6 9H3v6h3l5 4ZM16 9a5 5 0 0 1 0 6m3-9a9 9 0 0 1 0 12',arrow:'M4 12h16m-6-6 6 6-6 6',check:'m5 12 4 4 10-10',lock:'M6 10h12v10H6Zm2 0V7a4 4 0 0 1 8 0v3'};
export function ico(n){return n==='plane'?`<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${PLANE}"/></svg>`:`<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="${symbol[n]||symbol.arrow}"/></svg>`;}

export const C=['var(--r)','var(--y)','var(--b)','var(--g)'], CT=['var(--rt)','var(--yt)','var(--bt)','var(--gt)'];
export const NAMES=['红方','黄方','蓝方','绿方'];
const T=Flight.topology;
const posString=n=>`${n.x},${n.y}`;
export function boardDrawing(own){
  let s=`<defs><pattern id="dots" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".6" fill="var(--ink)" opacity=".045"/></pattern><symbol id="plane" viewBox="0 0 24 24"><path fill="currentColor" d="${PLANE}"/></symbol></defs><rect class="board-bg" width="600" height="600" rx="23"/><rect width="600" height="600" fill="url(#dots)" rx="23"/>`;
  // Secondary flight bridges are under private lanes and main-route tiles.
  s+='<g class="flight-guide">';
  T.shortcuts.forEach((f,c)=>{const a=T.nodes[f.from],b=T.nodes[f.to],mx=(a.x+b.x)/2,my=(a.y+b.y)/2;const offset=c%2?[-11,0]:[0,-12];s+=`<path d="M${posString(a)}L${posString(b)}" stroke="${C[c]}"/><text class="flymark" x="${mx+offset[0]}" y="${my+offset[1]}" text-anchor="middle" fill="${C[c]}" transform="rotate(${c%2?0:90} ${mx+offset[0]} ${my+offset[1]})">› ›</text>`;});
  s+='</g>';
  // Five private squares and a goal wedge use the very same path nodes as moves.
  for(let c=0;c<4;c++) {
    const lane=T.paths[c].slice(50);
    s+=`<path class="lane-bed" d="M${lane.map(posString).join('L')}"/>`;
    lane.slice(1,-1).forEach((n,j)=>{s+=`<rect x="${n.x-16.5}" y="${n.y-16.5}" width="33" height="33" rx="6" fill="${C[c]}"/><path d="M${n.x-12} ${n.y-11}h24" stroke="#fff" stroke-opacity=".3" stroke-linecap="round"/><g transform="translate(${n.x} ${n.y}) rotate(${c*90})"><path d="M-3.5-4 1.5 0-3.5 4" fill="none" stroke="#fff" stroke-opacity="${j===0?.9:.47}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>`;});
  }
  // A continuous band subdivided at the midpoints makes the public loop explicit.
  const xy=T.track, pts=xy.map(p=>p.join(',')).join(' ');
  s+=`<polyline class="loop-bed" points="${pts} ${xy[0].join(',')}"/>`;
  for(let i=0;i<52;i++) {
    const a=xy[(i+51)%52],p=xy[i],b=xy[(i+1)%52],m=[(a[0]+p[0])/2,(a[1]+p[1])/2],n=[(b[0]+p[0])/2,(b[1]+p[1])/2];
    s+=`<path class="public-tile" stroke="${C[T.nodes['L'+i].color]}" d="M${m}L${p}L${n}"/>`;
  }
  for(let i=0;i<52;i++) {
    const a=xy[i],b=xy[(i+1)%52],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),nx=-dy/len,ny=dx/len,mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2;
    s+=`<path class="tile-separator" d="M${mx+nx*16.5} ${my+ny*16.5}L${mx-nx*16.5} ${my-ny*16.5}"/>`;
  }
  // Arrows consistently point to the next actual node, not a hand-painted direction.
  s+='<g class="route-guide">';
  [0,3,7,10,13,16,20,23,26,29,33,36,39,42,46,49].forEach(i=>{const a=xy[i],b=xy[(i+1)%52],ang=Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI;s+=`<g transform="translate(${a}) rotate(${ang})"><circle r="8" class="direction"/><path d="M-3 0h6m-2.5-2.7L3.2 0 .5 2.7" class="directionpath"/></g>`;});
  s+='</g>';
  // Flight launch cells receive a discreet double-chevron, using exact IDs.
  T.shortcuts.forEach((f,c)=>{const a=T.nodes[f.from];s+=`<circle cx="${a.x}" cy="${a.y}" r="9" fill="${C[c]}" stroke="#fff" stroke-width="1.5"/><path d="M${a.x-4} ${a.y-3}l3 3-3 3m5-6 3 3-3 3" stroke="#fff" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`;});
  // Four compact airports, same orientation as the game turn order.
  const rects=[[18,18],[444,18],[444,444],[18,444]];
  for(let c=0;c<4;c++) {
    const [x,y]=rects[c],mine=c===own;
    s+=`<rect x="${x}" y="${y}" width="138" height="138" rx="19" fill="${CT[c]}" stroke="${C[c]}" stroke-opacity=".45" stroke-width="1.5"/>`;
    if(mine)s+=`<rect x="${x-4}" y="${y-4}" width="146" height="146" rx="22" class="selfbase-outline" style="stroke:${C[c]}"/>`;
    // Airport text stays upright for every corner.
    s+=`<text x="${x+69}" y="${y+15}" class="base-label" fill="${C[c]}" text-anchor="middle">${NAMES[c]}${mine?' · 我':''}</text>`;
    T.bases[c].forEach((n,i)=>{s+=`<circle cx="${n.x}" cy="${n.y}" r="21.5" class="base-slot" stroke="${C[c]}"/><text class="home-ghost-number" x="${n.x}" y="${n.y+3.5}" text-anchor="middle">${i+1}</text>`;});
    const gate=T.runways[c],first=T.paths[c][1];
    s+=`<path d="M${posString(gate)}L${posString(first)}" stroke="${C[c]}" stroke-width="2" stroke-dasharray="3 3" fill="none" opacity=".8"/><circle cx="${gate.x}" cy="${gate.y}" r="12" fill="${C[c]}" stroke="#fff" stroke-width="2"/><g style="color:#fff" transform="translate(${gate.x} ${gate.y}) rotate(${c*90+40})"><use href="#plane" x="-8" y="-8" width="16" height="16"/></g>`;
  }
  const tris=['248,248 300,300 248,352','248,248 352,248 300,300','352,248 352,352 300,300','248,352 300,300 352,352'];
  tris.forEach((p,c)=>s+=`<polygon points="${p}" fill="${C[c]}" stroke="var(--paper)" stroke-width="2"/>`);
  s+=`<circle cx="300" cy="300" r="18" fill="var(--paper)"/><path d="m300 288 3.3 7 7.7 1.1-5.5 5.4 1.3 7.6-6.8-3.6-6.8 3.6 1.3-7.6-5.5-5.4 7.7-1.1z" fill="var(--y)"/>`;
  return s;
}
