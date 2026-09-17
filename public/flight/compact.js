/** Presentation only. Never reads dice, changes a plan or sends a room command. */
export function installCompactLayout(){
  const $=s=>document.querySelector(s);
  const mq=matchMedia('(max-width:720px), (max-width:1100px) and (max-height:540px) and (orientation:landscape)');
  const tools=$('#toolsDialog'),chat=$('#chatDialog'),slot=$('.board-slot');
  // Move the ORIGINAL controls: listeners, chat draft and live updates are retained.
  const moved=[['.theme-switch','#toolsTheme'],['.panel-actions','#toolsActions'],['.chat-panel','#chatSlot'],['.log','#toolsLog'],['#credits','#toolsCredits']].map(([a,b])=>{
    const node=$(a),anchor=document.createComment('compact-layout-home');node.before(anchor);return {node,anchor,target:$(b)};
  });
  let frame=0,observer=null,closed=false;
  function measure(){
    frame=0;if(closed||!slot?.isConnected)return;
    document.documentElement.style.setProperty('--overlay-height',`${Math.round(window.visualViewport?.height||innerHeight)}px`);
    if(!mq.matches){slot.style.removeProperty('--board-edge');return;}
    const r=slot.getBoundingClientRect(),edge=Math.max(0,Math.floor(Math.min(r.width,r.height)));
    const value=edge+'px';if(slot.style.getPropertyValue('--board-edge')!==value)slot.style.setProperty('--board-edge',value);
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(measure);}
  function relocate(){
    tools.close();chat.close();
    for(const x of moved)if(mq.matches)x.target.append(x.node);else x.anchor.after(x.node);
    schedule();
  }
  function openChat(){
    if(mq.matches){tools.close();if(!chat.open)chat.showModal();$('#chatLog').scrollTop=$('#chatLog').scrollHeight;}
    else $('#chatInput').scrollIntoView({block:'center',behavior:'smooth'});
    $('#chatInput').focus({preventScroll:mq.matches});schedule();
  }
  $('#displaySettings').onclick=()=>{if(!tools.open)tools.showModal();schedule();};
  $('#toolsClose').onclick=()=>tools.close();$('#chatClose').onclick=()=>chat.close();
  function closeBeforeAction(e){if(e.target.closest('#backRoom,#rules,#chatOpen,#credits'))tools.close();}
  tools.addEventListener('click',closeBeforeAction,true);
  tools.addEventListener('close',schedule);chat.addEventListener('close',schedule);
  mq.addEventListener('change',relocate);window.addEventListener('resize',schedule);
  window.visualViewport?.addEventListener('resize',schedule);
  if(typeof ResizeObserver!=='undefined'){observer=new ResizeObserver(schedule);observer.observe(slot);}
  relocate();
  return {openChat,destroy(){closed=true;cancelAnimationFrame(frame);observer?.disconnect();mq.removeEventListener('change',relocate);window.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('resize',schedule);tools.removeEventListener('click',closeBeforeAction,true);tools.removeEventListener('close',schedule);chat.removeEventListener('close',schedule);}};
}
