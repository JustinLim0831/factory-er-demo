(function(){
 'use strict';
 const E=FactoryEngine,S=FactoryStore;
 const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=(n,d=0)=>Number.isFinite(n)?n.toLocaleString('en-US',{maximumFractionDigits:d,minimumFractionDigits:d}):'—';
 const minute=n=>`${fmt(n,1)} min`;
 const stamp=n=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(Math.floor(n%60)).padStart(2,'0')}:${String(Math.floor(n*60%60)).padStart(2,'0')}`;
 let toastTimer;
 function toast(t,error=false){const el=document.getElementById('toast');el.textContent=t;el.classList.toggle('red',error);el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,6000);}
 async function dispatch(t,p){try{return await S.dispatch(t,p);}catch(e){toast(e.message,true);return null;}}
 function preference(k,fallback){try{return localStorage.getItem(k)||fallback;}catch(_){return fallback;}}
 function savePreference(k,v){try{localStorage.setItem(k,v);}catch(_){toast('Your browser could not save this preference.',true);}}
 document.body.dataset.theme=preference('factory-er-theme','aqua');document.body.dataset.detail=preference('factory-er-detail-mode','complete');
 const factory=document.body.dataset.page==='factory';
 document.getElementById('appHeader').innerHTML=`<a class="brand" href="index.html"><span class="brand-mark">F</span><span>FACTORY ER<div class="brand-sub">Operations & recovery</div></span></a><div class="header-actions"><span class="chip green header-state" id="headerState">Running</span><span class="clock" id="clock">00:00:00</span><button id="pauseBtn" class="quiet">Pause</button><select id="speedSelect" aria-label="Simulation speed">${[1,10,30,60,120].map(v=>`<option value="${v}">${v}× speed</option>`).join('')}</select><button id="emergencyStopBtn" class="danger">Demo E-stop</button><button id="resetBtn" class="quiet">Reset run</button></div>`;
 const views=[['overview','Overview','◫'],['stations','Stations','▤'],['recovery','Recovery','↗'],['activity','Activity','≡'],['simulation','Simulation','⌘'],['settings','Settings','⚙']];
 document.getElementById('navigation').innerHTML=`<div class="nav-caption">WORKSPACE</div>${views.slice(0,4).map(([key,label,i])=>`<a class="nav-link" href="${factory?'index.html':''}#${key}" data-view="${key}"><span class="nav-icon">${i}</span>${label}</a>`).join('')}<a class="nav-link ${factory?'active':''}" href="3d-factory.html"><span class="nav-icon">◇</span>3D factory</a><div class="nav-divider"></div>${views.slice(4).map(([key,label,i])=>`<a class="nav-link" href="${factory?'index.html':''}#${key}" data-view="${key}"><span class="nav-icon">${i}</span>${label}</a>`).join('')}<div class="sidebar-note">SIMULATION MODE<br>Local browser session<br><span class="cyan">No machine commands</span></div>`;
 document.getElementById('pauseBtn').onclick=()=>dispatch('pause');
 document.getElementById('speedSelect').onchange=e=>dispatch('speed',{value:+e.target.value});
 document.getElementById('emergencyStopBtn').onclick=()=>dispatch('estop');
 document.getElementById('resetBtn').onclick=()=>{dispatch('reset');toast('Run reset using the saved configuration.');};
 S.subscribe(s=>{document.getElementById('clock').textContent=stamp(s.elapsed);document.getElementById('pauseBtn').textContent=s.paused?'Resume':'Pause';document.getElementById('speedSelect').value=s.config.speed;
   const el=document.getElementById('headerState');el.className=`chip header-state ${s.estop?'red':E.metrics(s).faults?'amber':'green'}`;el.textContent=s.estop?'E-STOP LATCHED':E.metrics(s).faults?'Attention':'Running';
   document.getElementById('emergencyStopBtn').disabled=s.estop;
 });
 window.FactoryUI={esc,fmt,minute,stamp,toast,dispatch,preference,savePreference};
})();
