/**
 * Chinese Ludo board geometry adapted from netmanfisher/chinese-ludo (MIT).
 * Game rules remain server-authoritative; this module only maps server positions
 * onto the upstream board artwork and supplies presentation helpers.
 */
export const COLORS=['#f06d56','#26a88b','#508fe1','#eeb842'];
export const COLOR_NAMES=['珊瑚红','翡翠绿','天空蓝','日光黄'];
export const BOARD_SOURCE='/api/assets/chinese-ludo-board';
const SCALE=380/600;
const P=([x,y])=>[x*SCALE,y*SCALE];

// Upstream public loop, 52 cells, clockwise.
export const TRACK=[
[91,212],[122,198],[151,198],[183,212],[209,184],[195,150],[196,120],[209,86],[241,74],[270,74],[300,75],[330,75],[358,74],
[390,86],[404,119],[404,150],[390,184],[416,212],[448,198],[477,198],[508,212],[519,244],[518,276],[520,307],[519,336],[519,366],
[508,399],[477,413],[447,413],[416,400],[391,428],[405,461],[404,491],[390,526],[358,536],[328,537],[299,537],[270,537],[239,536],
[210,526],[195,491],[196,460],[210,427],[182,398],[151,413],[122,413],[90,399],[81,366],[79,335],[80,305],[80,275],[82,245]
];

// Server colour order: red, green, blue, yellow.
const OFFSETS=[26,39,13,0];
const STARTS=[[582,430],[168,582],[429,17],[15,170]];
const HOMES=[
  [[501,501],[555,503],[501,554],[554,554]],
  [[45,501],[97,501],[44,554],[98,554]],
  [[500,44],[553,45],[500,98],[555,99]],
  [[44,45],[100,45],[45,98],[98,96]]
];
const STRETCHES=[
  [[520,306],[477,305],[448,305],[418,305],[389,306],[359,306]],
  [[300,536],[300,492],[299,461],[300,430],[299,399],[299,369]],
  [[300,75],[300,118],[300,150],[300,181],[300,211],[300,242]],
  [[80,306],[123,305],[152,305],[181,305],[211,305],[240,305]]
];
const FINISH=[[325,306],[300,333],[300,278],[274,306]];
const BASE_RECTS=[
  [458,458,132,132], // red
  [10,458,132,132],  // green
  [458,10,132,132],  // blue
  [10,10,132,132]    // yellow
];

export function pieceXY(color,pos,index=0){
  if(pos===-2)return P(HOMES[color][index]??HOMES[color][0]);
  if(pos===-1)return P(STARTS[color]);
  if(pos<=50)return P(TRACK[(OFFSETS[color]+pos)%52]);
  if(pos>=56)return P(FINISH[color]);
  // 51..55 are the five inner cells before the center goal.
  return P(STRETCHES[color][pos-50]);
}

export function planeIcon(){return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.5 14.4 13.6 9V3.5a1.6 1.6 0 0 0-3.2 0V9l-7.9 5.4v2.1l7.9-2.4v5.1L8 21v1l4-1 4 1v-1l-2.4-1.8v-5.1l7.9 2.4z"/></svg>';}

export function boardSVG(activeColor=-1,ownColor=-1){
  let s=`<svg class="board-art board-template" viewBox="0 0 380 380" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><defs><filter id="baseGlow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><image href="${BOARD_SOURCE}" x="0" y="0" width="380" height="380" preserveAspectRatio="xMidYMid slice"/>`;
  if(ownColor>=0){
    const [x,y,w,h]=BASE_RECTS[ownColor].map(v=>v*SCALE);
    s+=`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="none" stroke="#fff" stroke-width="2.6" opacity=".93"/><rect x="${x+2}" y="${y+2}" width="${w-4}" height="${h-4}" rx="6" fill="none" stroke="${COLORS[ownColor]}" stroke-width="3.2" opacity=".86" filter="url(#baseGlow)"/><g transform="translate(${x+8} ${y+9})"><rect x="0" y="0" width="24" height="15" rx="7.5" fill="${COLORS[ownColor]}" stroke="#fff" stroke-width="1.2"/><text x="12" y="10.5" text-anchor="middle" fill="#fff" font-size="7.5" font-weight="800" font-family="sans-serif">我方</text></g>`;
  }
  if(activeColor>=0){
    const [x,y,w,h]=BASE_RECTS[activeColor].map(v=>v*SCALE);
    s+=`<rect x="${x-2}" y="${y-2}" width="${w+4}" height="${h+4}" rx="9" fill="none" stroke="${COLORS[activeColor]}" stroke-width="2.2" stroke-dasharray="4 3" opacity=".95"/>`;
  }
  s+='</svg>';
  return s;
}
