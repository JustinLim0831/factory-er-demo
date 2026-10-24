(function(){
 'use strict';
 const E=FactoryEngine,S=FactoryStore,U=FactoryUI,{esc,fmt,minute}=U;
 const requested=Number(new URLSearchParams(location.search).get('station'));
 let selected=requested>=1&&requested<=5?requested:1,last=0;
 const descriptions=[
   'A sealed chamber coats wafers. The front load port holds the wafer cassette; pressure drift can stop the process. The round chamber, load port and gas cabinet show the actual job of this cell.',
   'The plasma chamber removes material to transfer a pattern. The RF supply and gas cabinet support the chamber. RF instability interrupts processing; the standby chamber performs the same step.',
   'A gantry picks individual dies from the input tray and places them on a substrate. The moving head represents placement cycles. Deviation is tracked against the configured tolerance.',
   'The bonding head connects the die to its package with fine wire. The spool and wire path show the feed. Vibration or a wire-feed interruption can stop this operation.',
   'Packages pass through a test fixture beneath a camera. Accepted parts continue to the output tray; rejected parts enter the red bin. A reject spike can keep the station running with a priority flag.'
 ];
 function kv(k,v){return `<div class="kv"><span>${k}</span><strong>${v}</strong></div>`;}
 function render(s,force=false){
   if(!force&&performance.now()-last<450)return;last=performance.now();
   const m=E.META[selected-1],c=s.config.stations[selected-1],r=s.stations[selected-1],f=E.facts(s,selected),t=E.tier1(s,selected),p=E.plan(s),can=p.candidates[selected-1],met=E.metrics(s);
   const focus=document.activeElement?.dataset?.floorAction;
   document.getElementById('cellSelector').innerHTML=E.META.map(m=>`<button data-cell="${m.id}" class="${selected===m.id?'active':''}" aria-pressed="${selected===m.id}"><span>${m.code} ${m.short}</span><span class="${E.tier1(s,m.id).tone}">●</span></button>`).join('');
   document.getElementById('selectedCode').textContent=m.code;
   document.getElementById('cellDetails').innerHTML=`<h2>${m.name}</h2><div class="scene-status"><span class="chip ${t.tone}">${t.label}</span></div><p class="model-description">${descriptions[selected-1]}</p>${kv('Lot',esc(c.lot))}${kv('Remaining work',fmt(Math.ceil(f.remaining))+' good units')}${kv('Completed / rejects',fmt(Math.floor(r.done))+' / '+fmt(Math.floor(r.rejects)))}${kv('Order margin',minute(f.slack))}${kv('Urgency',f.urgency.toUpperCase())}${kv(m.sensor,fmt(E.signal(s,selected),selected===4?3:1)+' '+m.unit)}<div class="backup-line"><small>QUALIFIED BACKUP / ST-0${selected}B</small>${kv('State',E.backupStatus(s,selected))}${r.route?kv('Ready in',minute(Math.max(0,r.route.readyAt-s.elapsed))):kv('Changeover',minute(c.setup))}</div><p class="subtle-note">${r.route?'Approved transfer: the lot stays on its backup after original equipment clearance.':r.fault?(can.reason|| (p.selected.includes(selected)?'Amber route: transfer proposed, awaiting operator approval.':'Feasible route waiting for shared recovery resources.')):'No active event. Normal production is shown on the front machine.'}</p><div class="inline-actions">${r.fault&&!r.route&&r.fault.impact==='high'?`<button class="primary" data-floor-action="accept" ${!p.selected.includes(selected)||s.estop?'disabled':''}>Approve transfer</button>`:''}${r.fault?`<button data-floor-action="clear" ${s.estop?'disabled':''}>Clear fault</button>`:''}</div>`;
   if(focus)document.querySelector(`[data-floor-action="${focus}"]`)?.focus({preventScroll:true});
   document.getElementById('floorInject').disabled=!!r.fault||s.estop||!f.remaining;document.getElementById('floorQuality').disabled=!!r.fault||s.estop||!f.remaining;
   document.getElementById('worldSummary').innerHTML=`<div><small>Producing cells</small><strong>${met.running} / 5</strong></div><div><small>Recovery support reserved</small><strong>${p.used} / ${s.config.capacity}</strong></div><div><small>Active process events</small><strong>${met.faults}</strong></div>`;
 }
 function select(id){if(!E.META[id-1])return;selected=id;history.replaceState(null,'',`?station=${id}`);render(S.get(),true);window.dispatchEvent(new CustomEvent('factory-selection',{detail:id}));}
 document.getElementById('cellSelector').onclick=e=>{const b=e.target.closest('[data-cell]');if(b)select(+b.dataset.cell);};
 document.getElementById('cellDetails').onclick=async e=>{const b=e.target.closest('[data-floor-action]');if(b){const s=await U.dispatch(b.dataset.floorAction,{id:selected});if(s)render(s,true);}};
 document.getElementById('floorInject').onclick=()=>U.dispatch('inject',{id:selected,kind:'equipment'});
 document.getElementById('floorQuality').onclick=()=>U.dispatch('inject',{id:selected,kind:'quality'});
 window.FactoryFloor={select,get selected(){return selected;}};S.subscribe(render);
})();
