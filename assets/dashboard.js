(function(){
 'use strict';
 const E=FactoryEngine,S=FactoryStore,U=FactoryUI,{esc,fmt,minute,stamp}=U;
 let view='overview',selected=1,draft=E.clone(S.get().config),dirty=false,inspectId=null,lastRender=0;
 const $=id=>document.getElementById(id);
 const chip=(text,tone)=>`<span class="chip ${tone}">${esc(text)}</span>`;
 const btn=(label,action,id,cls='',disabled=false)=>`<button class="${cls}" data-action="${action}" data-id="${id}" ${disabled?'disabled':''}>${label}</button>`;
 function html(id,text){
   const node=$(id);if(!node||node.innerHTML===text)return;
   const active=node.contains(document.activeElement)?document.activeElement:null;
   const key=active?.dataset?.action,st=active?.dataset?.id;
   const open=[...node.querySelectorAll('details')].map(d=>d.open);
   node.innerHTML=text;
   node.querySelectorAll('details').forEach((d,i)=>{if(open[i]!==undefined)d.open=open[i];});
   if(key)node.querySelector(`[data-action="${key}"][data-id="${st}"]`)?.focus({preventScroll:true});
 }
 function events(s,n=200){return s.events.slice(0,n).map(e=>`<div class="event-row"><time>${stamp(e.time)}</time><span class="event-code ${e.level}">${esc(e.code)}</span><span>${esc(e.message)}</span></div>`).join('')||'<div class="empty">No events in this run.</div>';}
 function kpi(label,value,unit,foot){return `<div class="kpi"><label>${label}</label><div class="value">${value}<span class="unit">${unit}</span></div><div class="foot">${foot}</div></div>`;}
 function trace(s,id){
   const c=s.config.stations[id-1],max=Math.max(c.threshold*1.4,E.signal(s,id)*1.2,.01);
   const points=Array.from({length:48},(_,i)=>{const t={...s,elapsed:s.elapsed-(47-i)/8};return `${i*6.38},${56-Math.min(1,E.signal(t,id)/max)*48}`;}).join(' ');
   return `<svg class="trace" viewBox="0 0 300 62" preserveAspectRatio="none" role="img" aria-label="Illustrative process signal and threshold"><line x1="0" x2="300" y1="${56-c.threshold/max*48}" y2="${56-c.threshold/max*48}" stroke="var(--amber)" stroke-dasharray="3 5" opacity=".6"/><polyline points="${points}" fill="none" stroke="var(--accent)" stroke-width="1.6"/></svg>`;
 }
 function kv(k,v){return `<div class="kv"><span>${k}</span><strong>${v}</strong></div>`;}
 function showView(){const key=location.hash.slice(1)||'overview';view=['overview','stations','recovery','activity','simulation','settings'].includes(key)?key:'overview';
   document.querySelectorAll('.view').forEach(el=>el.hidden=el.id!==`view-${view}`);
   document.querySelectorAll('[data-view]').forEach(a=>{a.classList.toggle('active',a.dataset.view===view);if(a.dataset.view===view)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
   render(S.get(),true);
 }
 function render(s,force=false){
   if(!force&&performance.now()-lastRender<480)return;lastRender=performance.now();
   const met=E.metrics(s),plan=E.plan(s);
   $('attention').hidden=!s.estop&&!met.faults&&!S.warning();
   html('attention',s.estop?'<span><strong>Demo E-stop is latched.</strong> All production and recovery actions are suspended.</span><button data-action="reset">Reset run</button>':S.warning()?esc(S.warning()):`<span><strong>${met.faults} active event${met.faults===1?'':'s'}.</strong> ${met.atRisk} order${met.atRisk===1?'':'s'} forecast late. Review the recovery options.</span><a class="button tiny" href="#recovery">Review</a>`);
   if(view==='overview'){
     html('overviewMetrics',kpi('Producing cells',met.running,'/ 5','Primary or active backup')+kpi('Current good-unit capacity',fmt(met.throughput),'u/hr','Calculated from rates and rejects')+kpi('Orders forecast late',met.atRisk,'/ 5','Against configured deadlines')+kpi('Approved completion gain',fmt(met.saved,1),'min','Estimated at transfer approval'));
     html('overviewTable',`<table><thead><tr><th>Process cell</th><th>Status</th><th>Order progress</th><th>Deadline margin</th><th>Backup</th><th></th></tr></thead><tbody>${E.META.map(m=>{const c=s.config.stations[m.id-1],r=s.stations[m.id-1],f=E.facts(s,m.id),t=E.tier1(s,m.id),progress=Math.min(100,(r.done+c.buffer)/c.target*100);return `<tr><td><span class="station-code">${m.code}</span><span class="station-name">${m.name}</span><span class="sub">${esc(c.lot)}</span></td><td>${chip(t.label,t.tone)}</td><td><span class="mono">${fmt(Math.floor(r.done))} / ${fmt(c.target)}</span><span class="sub">${fmt(c.buffer)} allocated stock</span><div class="progress"><span style="width:${progress}%"></span></div></td><td><span class="${f.slack<0?'red':f.urgency==='high'?'amber':'green'}">${f.remaining?minute(f.slack):'Fulfilled'}</span><span class="sub">${f.remaining?f.urgency.toUpperCase()+' urgency':'No remaining work'}</span></td><td><span class="mono">ST-0${m.id}B</span><span class="sub">${E.backupStatus(s,m.id)}</span></td><td>${btn('Inspect','inspect',m.id,'tiny')}</td></tr>`;}).join('')}</tbody></table>`);
     html('recentActivity',events(s,4));
     html('resourceSummary',kv('Concurrent budget',`${s.config.capacity} pts`)+kv('Reserved by active transfers',`${plan.used} pts`)+kv('Available for new transfers',`${plan.available} pts`)+kv('Feasible jobs selected',`${plan.selected.length}`)+`<div class="progress"><span style="width:${Math.min(100,plan.used/Math.max(1,s.config.capacity)*100)}%"></span></div><p class="subtle-note">Recovery support is a shared planning resource, not a sum of unrelated machine production rates.</p>`);
   }
   if(view==='stations') html('stationGrid',E.META.map(m=>{
     const c=s.config.stations[m.id-1],r=s.stations[m.id-1],f=E.facts(s,m.id),t=E.tier1(s,m.id);
     return `<article class="station-card" id="station-${m.id}"><header><div><div class="eyebrow">${m.code} / ${m.process}</div><h3>${m.name}</h3></div>${chip(t.label,t.tone)}</header><p class="small">${r.fault?esc(r.fault.label):'No active process event'}</p><div class="metrics"><div><small>Good units / order</small><h2 class="mono">${fmt(Math.floor(r.done))}<small> / ${fmt(c.target)}</small></h2></div><div><small>Forecast margin</small><h2 class="mono ${f.slack<0?'red':'cyan'}">${minute(f.slack)}</h2></div></div>${trace(s,m.id)}<div class="trace-label"><span>${m.sensor}: ${fmt(E.signal(s,m.id),m.id===4?3:1)} ${m.unit}</span><span>Limit ${c.threshold}</span></div><div class="notice">${t.action}. ${r.fault?`Impact ${r.fault.impact}; calculated urgency ${f.urgency}.`:'Order pressure is monitored continuously.'}</div><details class="advanced-detail"><summary>Order & backup details</summary>${kv('Lot',esc(c.lot))}${kv('Due at scenario minute',fmt(c.deadline))}${kv('Reject rate',fmt(E.rejectRate(s,m.id),1)+'%')}${kv('Same-process backup',E.backupStatus(s,m.id))}</details><div class="inline-actions section-gap">${btn('Inspect','inspect',m.id,'tiny')}${r.fault?btn('Technician clearance','clear',m.id,'tiny',s.estop):''}<a class="button tiny" href="3d-factory.html?station=${m.id}">View equipment ↗</a></div></article>`;
   }).join(''));
   if(view==='recovery')renderRecovery(s,plan);
   if(view==='activity')html('activityLog',events(s));
   if(inspectId)renderInspect(s);
 }
 function renderRecovery(s,p){
   html('optimizerSummary',`<div class="inline-actions"><h2 class="mono">${p.totalWeight} / ${p.available} points</h2><span class="muted">proposed allocation</span><span class="chip cyan">${p.selected.length} selected</span></div><p class="subtle-note">Total budget ${s.config.capacity}; active transfers reserve ${p.used}. Only urgent stopped lots with a qualified, beneficial backup are candidates. Healthy stations keep running.</p><details class="advanced-detail"><summary>How the reference algorithm is used</summary><div class="formula">Maximise Σ selected × recovery value<br>Subject to Σ selected × support points ≤ available budget<br>Recovery value = order priority × (late minutes avoided + 0.1 × earlier completion minutes)<br>JavaScript branch-and-bound / exact for this small candidate set. No OR-Tools runtime.</div></details>`);
   const active=s.stations.filter(r=>r.fault);
   html('optimizerTable',active.length?`<table><thead><tr><th>Lot</th><th>Support points</th><th>Recovery value</th><th>Allocation</th></tr></thead><tbody>${active.map(r=>{const c=s.config.stations[r.id-1],can=p.candidates[r.id-1];return `<tr><td>${esc(c.lot)}<span class="sub">ST-0${r.id}</span></td><td>${c.weight}</td><td>${can.eligible?fmt(can.value,1):'—'}</td><td>${r.route?chip('RESERVED','cyan'):p.selected.includes(r.id)?chip('SELECTED','green'):can.eligible?chip('WAIT FOR CAPACITY','amber'):esc(can.reason)}</td></tr>`;}).join('')}</tbody></table>`:'');
   html('recoveryCards',active.length?active.map(r=>{
     const c=s.config.stations[r.id-1],m=E.META[r.id-1],f=E.facts(s,r.id),t=E.tier1(s,r.id),can=p.candidates[r.id-1];
     let title,reason,actions='';
     if(r.route){title=`Transfer approved · ST-0${r.id}B`;reason=`${E.backupStatus(s,r.id)}. The original equipment fault remains until technician clearance. Reserved support: ${c.weight} points.`;}
     else if(r.fault.impact==='low'){
       title=f.urgency==='high'?'Prioritise output and quality monitoring':'Log and monitor the trend';
       reason=`${t.action}. Low capacity impact does not imply that the equipment or quality issue is absent. Acknowledgement does not change the configured production rate.`;
       if(!r.reviewed)actions=btn(f.urgency==='high'?'Acknowledge priority':'Acknowledge event',f.urgency==='high'?'priority':'ack',r.id,'primary',s.estop);
     }else if(f.urgency==='low'){title='Queue a technician';reason=`Primary remains stopped. Estimated repair and production leave ${minute(f.slack)} before the order deadline.`;}
     else {title=p.selected.includes(r.id)?`Transfer to ST-0${r.id}B`:'Technician attention / transfer pending';reason=can.reason|| (p.selected.includes(r.id)?`Qualified for the same process. ${minute(can.saved)} earlier completion and ${minute(can.tardinessSaved)} less lateness estimated.`:'The backup is feasible, but the shared support budget favours another combination.');
       actions=btn('Approve transfer','accept',r.id,'primary',s.estop||!p.selected.includes(r.id));
     }
     if(!r.technician&&r.fault.impact==='high')actions+=btn('Queue technician','tech',r.id,'',s.estop);
     actions+=btn('Simulate technician clearance','clear',r.id,'quiet',s.estop);
     return `<article class="recovery-card"><div class="recovery-top"><div><div class="eyebrow">${m.code} / ${esc(c.lot)}</div><h2>${title}</h2></div>${chip(f.urgency+' urgency',f.urgency==='high'?'amber':'blue')}</div><p>${reason}</p>${r.fault.impact==='high'&&!r.route?`<div class="route-comparison"><div><small>Wait for repair + primary production</small><strong>${minute(can.primaryFinish-s.elapsed)}</strong><small>Repair assumption: ${minute(c.repair)} from now</small></div><div><small>Wait + changeover + backup production</small><strong>${c.backupEnabled&&c.compatible?minute(can.routeFinish-s.elapsed):'Unavailable'}</strong><small>Changeover ${minute(c.setup)}; busy ${minute(can.busyLeft)}</small></div></div>`:''}<div class="inline-actions">${actions}</div>${r.reviewed||r.technician?`<p class="small">${r.technician?'Technician queued. ':''}${r.reviewed?'Operator has reviewed this event.':''}</p>`:''}</article>`;
   }).join(''):'<div class="panel empty"><h3>No recovery decisions needed</h3><p>Inject a scenario or enable sensor threshold detection in Simulation.</p><a class="button section-gap" href="#simulation">Open simulation</a></div>');
 }
 function renderInspect(s){const id=inspectId,m=E.META[id-1],c=s.config.stations[id-1],r=s.stations[id-1],f=E.facts(s,id),t=E.tier1(s,id);
   $('inspectCode').textContent=m.code;$('inspectTitle').textContent=m.name;
   html('inspectBody',`${chip(t.label,t.tone)}<p class="section-gap">${m.process}. Each displayed lot is already at this process step. A backup performs the same operation.</p><div class="section-gap">${trace(s,id)}</div>${kv('Process signal',fmt(E.signal(s,id),3)+' '+m.unit)}${kv('Lot',esc(c.lot))}${kv('Good units / allocated stock',fmt(Math.floor(r.done))+' / '+c.buffer)}${kv('Remaining good units',fmt(Math.ceil(f.remaining)))}${kv('Deadline / predicted finish',minute(c.deadline)+' / '+minute(f.finish))}${kv('Tier 1',t.action)}${kv('Backup',`ST-0${id}B · ${E.backupStatus(s,id)}`)}<p class="subtle-note">Generated process signal, not a live camera or sensor reading. Open the 3D floor to inspect the equipment, work queue and transfer.</p><a class="button primary" href="3d-factory.html?station=${id}">Open this cell in 3D ↗</a>`);
 }
 function openInspect(id){inspectId=id;renderInspect(S.get());$('inspectDialog').showModal();}
 $('closeInspect').onclick=()=>$('inspectDialog').close();$('inspectDialog').addEventListener('close',()=>inspectId=null);
 $('inspectDialog').addEventListener('click',e=>{if(e.target===$('inspectDialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
 document.addEventListener('click',async e=>{
   const b=e.target.closest('[data-action]');if(b){if(b.dataset.action==='inspect')return openInspect(+b.dataset.id);const result=await U.dispatch(b.dataset.action,{id:+b.dataset.id});if(result)render(result,true);}
   const preset=e.target.closest('[data-preset]');if(preset){const s=await U.dispatch('preset',{name:preset.dataset.preset,id:+$('injectStation').value});if(s){draft=E.clone(s.config);dirty=false;loadEditor();location.hash='recovery';U.toast('Preset loaded. All orders restarted.');}}
 });
 $('injectStation').innerHTML=E.META.map(m=>`<option value="${m.id}">${m.code} ${m.short}</option>`).join('');
 $('injectBtn').onclick=async()=>{const s=await U.dispatch('inject',{id:+$('injectStation').value,kind:$('eventKind').value});if(s){location.hash='recovery';render(s,true);}};
 $('randomFaultBtn').onclick=async()=>{const s=S.get(),ids=s.stations.filter(r=>!r.fault&&E.remaining(s,r.id)>0).map(r=>r.id);if(!ids.length)return U.toast('All stations already have an event or completed order.',true);const id=ids[Math.floor(Math.random()*ids.length)];const result=await U.dispatch('inject',{id,kind:$('eventKind').value});if(result){$('injectStation').value=id;location.hash='recovery';}};
 const field=(key,label,min,max,step=1,hint='')=>`<label class="field">${label}<input name="${key}" type="number" min="${min}" max="${max}" step="${step}" required>${hint?`<small>${hint}</small>`:''}</label>`;
 function capture(){const form=$('simulationForm'),c=draft.stations[selected-1];
   ['capacity','urgencyMargin'].forEach(k=>draft[k]=form.elements[k].value===''?NaN:+form.elements[k].value);draft.autoDetect=form.elements.autoDetect.checked;
   form.querySelectorAll('#stationFields input,#stationFields select').forEach(input=>{c[input.name]=input.type==='checkbox'?input.checked:input.type==='number'?(input.value===''?NaN:+input.value):input.value;});
 }
 function loadEditor(){const form=$('simulationForm'),c=draft.stations[selected-1],m=E.META[selected-1];
   form.elements.capacity.value=draft.capacity;form.elements.urgencyMargin.value=draft.urgencyMargin;form.elements.autoDetect.checked=draft.autoDetect;
   $('editorTabs').innerHTML=E.META.map(m=>`<button type="button" data-edit="${m.id}" class="${m.id===selected?'active':''}" aria-pressed="${m.id===selected}">${m.code}</button>`).join('');
   $('stationFields').innerHTML=`<h3>${m.name}</h3><div class="field-grid section-gap"><label class="field">Lot / order reference<input name="lot" maxlength="40" required></label>${field('target','Order quantity (good units)',1,1000000)}${field('completed','Already completed (good units)',0,1000000)}${field('buffer','Allocated stock (good units)',0,1000000)}${field('deadline','Deadline (scenario minutes)',0,100000,1,'Measured from the start of this run.')}${field('priority','Order priority (1–100)',1,100)}</div><div class="form-section"><h3>Production & recovery</h3><div class="field-grid">${field('rate','Primary rate (gross units/hr)',.1,100000,.1)}${field('rejectPct','Normal rejects (%)',0,99,.1)}${field('repair','Estimated repair (minutes)',0,10080,.1,'Planning assumption; never auto-clears a fault.')}${field('backupRate','Backup rate (gross units/hr)',.1,100000,.1)}${field('setup','Changeover (minutes)',0,1440,.1)}${field('busy','Backup free at scenario minute',0,10080,.1)}${field('weight','Recovery support (points)',1,1000,1,'Reserved while this transferred lot is unfinished.')}<label class="field check"><input name="backupEnabled" type="checkbox">Backup available</label><label class="field check"><input name="compatible" type="checkbox">Product/process qualified</label></div></div><div class="form-section"><h3>Simulated sensor & quality</h3><div class="field-grid">${field('signal',m.sensor+' ('+m.unit+')',0,100000,.001)}${field('threshold','Upper detection threshold ('+m.unit+')',.001,100000,.001)}<label class="field">Threshold event impact<select name="sensorImpact"><option value="high">High · stop primary</option><option value="low">Low · continue and monitor</option></select></label>${field('faultRejectPct','Rejects during quality event (%)',0,99,.1)}</div><p class="subtle-note">When enabled, a sustained threshold crossing for 1 real second creates an event. Signals include a small deterministic ripple. These process signals are illustrative, not measurements from ADXL345 or WCS1700 hardware.</p></div>`;
   Object.entries(c).forEach(([k,v])=>{const input=form.querySelector(`#stationFields [name="${k}"]`);if(input){if(input.type==='checkbox')input.checked=v;else input.value=v;}});
   updatePreview();
 }
 function updatePreview(){
   const errs=E.validate(draft);$('draftStatus').textContent=dirty?'Unsaved inputs':'Saved configuration';
   $('formErrors').hidden=!errs.length;$('formErrors').textContent=errs.slice(0,4).join(' ');
   if(errs.length){$('calculationPreview').innerHTML='<p>Enter valid values to calculate this scenario.</p>';return;}
   const preview=E.create(draft),f=E.facts(preview,selected),c=draft.stations[selected-1];
   if(f.remaining>0)E.inject(preview,selected,'equipment');const stopped=E.facts(preview,selected),can=E.candidate(preview,selected),plan=E.plan(preview);
   $('calculationPreview').innerHTML=`<div class="eyebrow">ST-0${selected} / starting conditions</div><small>Normal order margin</small><div class="big ${f.slack<0?'red':'cyan'}">${minute(f.slack)}</div>${chip(f.urgency+' urgency',f.urgency==='high'?'amber':'green')}${kv('Remaining units',fmt(f.remaining))}${kv('Effective primary rate',fmt(f.rate,1)+' u/hr')}${kv('Normal work duration',minute(f.work))}<div class="form-section"><h3>If equipment stops</h3>${kv('Repair + production',minute(stopped.finish))}${kv('Resulting urgency',stopped.urgency.toUpperCase())}${kv('Backup completion',minute(can.routeFinish))}${kv('Potential earlier finish',minute(can.saved))}<p class="subtle-note">${can.reason|| (plan.selected.includes(selected)?'Selected within the recovery budget.':'Feasible backup, but insufficient recovery support points.')}</p></div><div class="formula">Remaining = order − completed − stock<br>Rate = gross rate × (1 − reject %)<br>Slack = deadline − forecast finish</div><p class="subtle-note">Preview assumes a fresh run and a single equipment fault. Multiple faults compete for the shared budget.</p>`;
 }
 $('simulationForm').addEventListener('input',()=>{capture();dirty=true;updatePreview();});
 $('simulationForm').addEventListener('change',()=>{capture();dirty=true;updatePreview();});
 $('editorTabs').addEventListener('click',e=>{const b=e.target.closest('[data-edit]');if(b){capture();selected=+b.dataset.edit;loadEditor();}});
 $('simulationForm').addEventListener('submit',async e=>{e.preventDefault();capture();draft.speed=S.get().config.speed;updatePreview();if(E.validate(draft).length)return;const submit=$('simulationForm').querySelector('button[type=submit]');submit.disabled=true;const result=await U.dispatch('config',{config:draft});submit.disabled=false;if(result){dirty=false;draft=E.clone(result.config);loadEditor();U.toast('Inputs saved. The simulation restarted from your values.');render(result,true);}});
 $('restoreDefaults').onclick=()=>{draft=E.defaults();dirty=true;loadEditor();U.toast('Default inputs loaded for review. Apply to restart.');};
 $('themeSelect').value=document.body.dataset.theme;$('themeSelect').onchange=e=>{document.body.dataset.theme=e.target.value;U.savePreference('factory-er-theme',e.target.value);};
 $('detailSelect').value=document.body.dataset.detail;$('detailSelect').onchange=e=>{document.body.dataset.detail=e.target.value;U.savePreference('factory-er-detail-mode',e.target.value);};
 addEventListener('hashchange',showView);addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
 let configKey=JSON.stringify(S.get().config);
 S.subscribe(s=>{const next=JSON.stringify(s.config);if(next!==configKey){configKey=next;if(!dirty){draft=E.clone(s.config);loadEditor();}}render(s);});
 loadEditor();showView();
})();
