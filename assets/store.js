/* One browser-origin state for both pages. Web Locks serialize tab updates. */
(function(){
  'use strict';
  const E=window.FactoryEngine,KEY='factory-er-simulation-v3',LOCK='factory-er-simulation-writer';
  let memory=null,warning='',listeners=[],lastSerialized='';
  function read(){
    try {
      const raw=localStorage.getItem(KEY);if(raw){const s=JSON.parse(raw);if(s.version===E.VERSION&&!E.validate(s.config).length&&s.stations?.length===5&&Number.isFinite(s.elapsed))return s;}
    }catch(_){warning='Browser storage is unavailable. Changes stay in this page only.';}
    return memory||E.create();
  }
  function write(s){memory=s;try{localStorage.setItem(KEY,JSON.stringify(s));}catch(_){warning='Browser storage is unavailable. Changes stay in this page only.';}}
  function emit(){const s=read();const raw=JSON.stringify(s);if(raw!==lastSerialized){lastSerialized=raw;listeners.forEach(f=>f(s));}}
  async function update(action,payload){
    const job=()=>{
      let s=read(),now=Date.now();
      // No invented production while all pages are closed. A long suspension pauses elapsed integration.
      const delta=(now-s.wall)/1000;
      if(delta>0&&delta<3)E.advance(s,delta);
      s.wall=now;
      if(action)s=E.act(s,action,payload);
      s.revision++;write(s);emit();return s;
    };
    return navigator.locks? navigator.locks.request(LOCK,job):job();
  }
  // Initialize without restarting a running tab's clock.
  if(!localStorageSafeExists())write(E.create());
  function localStorageSafeExists(){try{return !!localStorage.getItem(KEY)&&read().version===E.VERSION;}catch(_){return !!memory;}}
  const timer=setInterval(()=>update().catch(e=>{warning=e.message;}),250);
  addEventListener('storage',e=>{if(e.key===KEY)emit();});
  addEventListener('pagehide',()=>clearInterval(timer));
  window.FactoryStore={get:read,dispatch:update,subscribe(fn){listeners.push(fn);fn(read());return()=>listeners=listeners.filter(f=>f!==fn);},warning:()=>warning};
})();
