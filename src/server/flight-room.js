/** Keep the existing room/auth/chat implementation and storage namespace.
 * Legacy flying saves are paused, not translated with ambiguous coordinates.
 * The host explicitly resets them. Doudizhu rooms are untouched.
 */
import {GameRoom as BaseRoom} from './room.js';
import {isCurrentFlying,RULESET} from '../games/flying.js';
export class GameRoom extends BaseRoom {
  legacyFlying(){return this.room?.game?.kind==='flying'&&!isCurrentFlying(this.room.game);}
  view(id){return {...super.view(id),release:'0.5.0',upgradeRequired:this.legacyFlying()};}
  setDeadline(){if(this.legacyFlying())this.room.deadline=null;else super.setDeadline();}
  async alarm(){
    await this.ready;
    if(this.legacyFlying()&&this.room.expiresAt>Date.now())return this.serial(async()=>{
      this.room.deadline=null;await this.persist();this.broadcast();
    });
    return super.alarm();
  }
  async webSocketMessage(ws,data){
    await this.ready;
    let m;try{m=typeof data==='string'?JSON.parse(data):null;}catch{}
    if(m&&['roll','move'].includes(m.type)&&this.room?.kind==='flying'){
      const error=this.legacyFlying()?'旧版飞行棋已暂停，请房主返回等待室重新开局':m.protocol!==RULESET?'页面版本过旧，请刷新后再操作':null;
      if(error){try{ws.send(JSON.stringify({type:'error',id:m.id,error}));}catch{}return;}
    }
    return super.webSocketMessage(ws,data);
  }
}
