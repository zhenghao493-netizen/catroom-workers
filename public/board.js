import Flight from './flight/engine.js';
import {boardDrawing,ico} from './flight/art.js';
export const COLORS=['#e7584c','#e6af31','#3b8bdd','#22a784'];
export const COLOR_NAMES=['红方','黄方','蓝方','绿方'];
export const TRACK=Flight.topology.track;
export const planeIcon=()=>ico('plane');
export const pieceXY=(c,p,i=0)=>{const n=Flight.at(c,p,i);return[n.x*380/600,n.y*380/600];};
export function boardSVG(){return `<svg class="board-art" viewBox="0 0 600 600" style="--r:#e7584c;--y:#e6af31;--b:#3b8bdd;--g:#22a784;--rt:#fff0e9;--yt:#fff8da;--bt:#e6f3ff;--gt:#e1f5ee;--ink:#1b3346;--paper:#fff;--board:#eaf2f5;--type:sans-serif" aria-hidden="true"><style>.board-art .board-bg{fill:#eaf2f5}.board-art .loop-bed,.board-art .lane-bed{fill:none;stroke:#cedee5;stroke-width:39;stroke-linejoin:round}.board-art .public-tile{fill:none;stroke-width:33;stroke-linejoin:round}.board-art .tile-separator{stroke:#eaf2f5;stroke-width:3}.board-art .flight-guide{display:none}.board-art .base-slot{fill:#fff;stroke-width:1}.board-art .base-label{font:700 12px sans-serif}.board-art .direction{fill:white}.board-art .directionpath{fill:none;stroke:#1b3346;stroke-width:2}.board-art .home-ghost-number{font:10px sans-serif;fill:#789}</style>${boardDrawing(-1)}</svg>`;}
