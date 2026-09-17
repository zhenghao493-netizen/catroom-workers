/** Board coordinates are unchanged from v0.1; visuals are independent of rules. */
export const COLORS=['#f06d56','#26a88b','#508fe1','#eeb842'];
export const COLOR_NAMES=['珊瑚红','翡翠绿','天空蓝','日光黄'];
export const TRACK=[
[6,13],[6,12],[6,11],[6,10],[6,9],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8],[0,7],[0,6],
[1,6],[2,6],[3,6],[4,6],[5,6],[6,5],[6,4],[6,3],[6,2],[6,1],[6,0],[7,0],[8,0],
[8,1],[8,2],[8,3],[8,4],[8,5],[9,6],[10,6],[11,6],[12,6],[13,6],[14,6],[14,7],[14,8],
[13,8],[12,8],[11,8],[10,8],[9,8],[8,9],[8,10],[8,11],[8,12],[8,13],[8,14],[7,14],[6,14]
];
const center=([x,y])=>[22+x*24,22+y*24];
const bases=[[2.3,11.7],[2.3,2.3],[11.7,2.3],[11.7,11.7]];
const runways=[[5.05,13.8],[.2,5.05],[8.95,.2],[13.8,8.95]];
export function pieceXY(color,pos,index=0){
  if(pos===-2){const [x,y]=bases[color];return center([x+(index%2?0.85:-.85),y+(index<2?-.85:.85)]);}
  if(pos===-1)return center(runways[color]);
  if(pos<=50)return center(TRACK[(color*13+pos)%52]);
  const n=pos-51;return center([[7,13-n],[1+n,7],[7,1+n],[13-n,7]][color]);
}
export function planeIcon(){return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.5 14.4 13.6 9V3.5a1.6 1.6 0 0 0-3.2 0V9l-7.9 5.4v2.1l7.9-2.4v5.1L8 21v1l4-1 4 1v-1l-2.4-1.8v-5.1l7.9 2.4z"/></svg>';}
export function boardSVG(activeColor=-1){
  let s='<svg class="board-art" viewBox="0 0 380 380" aria-hidden="true"><rect x="2" y="2" width="376" height="376" rx="23" fill="#ffffff"/><rect x="8" y="8" width="364" height="364" rx="19" fill="#f4f7fa" stroke="#e9eef3"/>';
  bases.forEach(([x,y],i)=>{
    const [cx,cy]=center([x,y]);
    s+=`<rect x="${cx-53}" y="${cy-53}" width="106" height="106" rx="22" fill="${COLORS[i]}"/><rect x="${cx-49}" y="${cy-49}" width="98" height="98" rx="19" fill="none" stroke="#fff" stroke-opacity=".36"/><rect x="${cx-38}" y="${cy-38}" width="76" height="76" rx="16" fill="#fff" fill-opacity=".93"/>`;
    if(i===activeColor)s+=`<rect x="${cx-57}" y="${cy-57}" width="114" height="114" rx="26" fill="none" stroke="${COLORS[i]}" stroke-width="2" stroke-dasharray="4 4"/>`;
    for(let k=0;k<4;k++){const [px,py]=pieceXY(i,-2,k);s+=`<circle cx="${px}" cy="${py}" r="15" fill="${COLORS[i]}" fill-opacity=".13" stroke="${COLORS[i]}" stroke-opacity=".25" stroke-width="1.5"/><text x="${px}" y="${py+3}" text-anchor="middle" fill="${COLORS[i]}" opacity=".6" font-family="sans-serif" font-size="9">${k+1}</text>`;}
  });
  TRACK.forEach((xy,i)=>{
    const [x,y]=center(xy),c=(i+2)%4;
    s+=`<rect x="${x-10.5}" y="${y-10.5}" width="21" height="21" rx="5.5" fill="${COLORS[c]}" fill-opacity=".69" stroke="#fff" stroke-width="1.2"/>`;
    if(i%13===0)s+=`<path d="M${x-3.3},${y+3.5} L${x},${y-3.5} L${x+3.3},${y+3.5}" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
  });
  for(let c=0;c<4;c++){
    for(let n=51;n<=56;n++){const [x,y]=pieceXY(c,n);s+=`<rect x="${x-10.5}" y="${y-10.5}" width="21" height="21" rx="5.5" fill="${COLORS[c]}" fill-opacity=".95" stroke="#fff" stroke-width="1.2"/>`;}
    const [x,y]=pieceXY(c,-1);s+=`<circle cx="${x}" cy="${y}" r="11" fill="${COLORS[c]}"/><path d="M${x-3},${y+3} L${x},${y-4} L${x+3},${y+3}" fill="none" stroke="white" stroke-width="1.6"/>`;
    const a=pieceXY(c,18),b=pieceXY(c,30);s+=`<path d="M${a[0]},${a[1]} L${b[0]},${b[1]}" stroke="${COLORS[c]}" stroke-width="1.6" stroke-dasharray="3 5" opacity=".5"/>`;
  }
  s+='<circle cx="190" cy="190" r="18" fill="#fff" stroke="#e9eef3"/><path d="m190 178 3.7 7.5 8.3 1.2-6 5.8 1.4 8.2-7.4-3.9-7.4 3.9 1.4-8.2-6-5.8 8.3-1.2z" fill="#eeb842"/><circle cx="190" cy="190" r="4" fill="#fff" fill-opacity=".6"/></svg>';
  return s;
}
