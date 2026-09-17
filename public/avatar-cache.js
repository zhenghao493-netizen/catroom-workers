(()=>{
  const VERSION='034';
  const fix=img=>{
    if(!(img instanceof HTMLImageElement))return;
    const raw=img.getAttribute('src')||'';
    if(!raw.startsWith('/avatars/maodie-photo.png')||raw.includes('v='))return;
    img.src=`/avatars/maodie-photo.png?v=${VERSION}`;
  };
  new MutationObserver(list=>{
    for(const m of list){
      if(m.type==='attributes')fix(m.target);
      for(const node of m.addedNodes){
        if(node instanceof HTMLImageElement)fix(node);
        else if(node instanceof Element)node.querySelectorAll('img').forEach(fix);
      }
    }
  }).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['src']});
  document.querySelectorAll('img').forEach(fix);
})();
