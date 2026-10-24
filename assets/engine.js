/* Factory ER: shared, deterministic presentation model. No machine connections.
 * Branch-and-bound knapsack adapted from the supplied index.html.txt.
 * It allocates concurrent recovery support, not unrelated process capacity.
 */
(function (root) {
  'use strict';
  const VERSION = 3;
  const META = [
    {id:1, code:'ST-01', name:'CVD Deposition', short:'Deposition', process:'Wafer coating', sensor:'Chamber pressure', unit:'torr', base:2.1, threshold:3.4, weight:42, value:71, rate:120},
    {id:2, code:'ST-02', name:'Plasma Etch', short:'Etch', process:'Pattern transfer', sensor:'RF power', unit:'W', base:210, threshold:340, weight:58, value:28, rate:150},
    {id:3, code:'ST-03', name:'Die Bonder', short:'Die bond', process:'Die placement', sensor:'Placement deviation', unit:'µm', base:4.2, threshold:9.5, weight:35, value:91, rate:180},
    {id:4, code:'ST-04', name:'Wire Bonder', short:'Wire bond', process:'Electrical connections', sensor:'Vibration', unit:'g', base:0.18, threshold:0.65, weight:29, value:83, rate:160},
    {id:5, code:'ST-05', name:'Final Test / Package', short:'Test & pack', process:'Quality inspection', sensor:'Reject signal', unit:'%', base:1.2, threshold:6, weight:54, value:63, rate:200}
  ];
  const clone = x => JSON.parse(JSON.stringify(x));
  function defaults() {
    return {capacity:70, urgencyMargin:20, speed:30, autoDetect:false, stations:META.map((m,i)=>({
      id:m.id, lot:`LOT-26-${String.fromCharCode(65+i)}17`, target:300, completed:100, buffer:0,
      rate:m.rate, rejectPct:1, deadline:[110,240,100,300,180][i], priority:m.value,
      weight:m.weight, repair:60, backupRate:m.rate*1.2, setup:5, busy:0,
      backupEnabled:true, compatible:true, signal:m.base, threshold:m.threshold,
      sensorImpact:'high', faultRejectPct:12
    }))};
  }
  function validate(c) {
    const errors=[];
    function num(v,lo,hi,label,integer=false) {
      if(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi||(integer&&!Number.isInteger(v))) errors.push(`${label}: enter ${integer?'a whole number':'a number'} from ${lo} to ${hi}.`);
    }
    if(!c||!Array.isArray(c.stations)||c.stations.length!==5) return ['Exactly five station configurations are required.'];
    num(c.capacity,0,1000,'Recovery capacity',true); num(c.urgencyMargin,0,1440,'Urgency margin'); num(c.speed,1,120,'Playback speed');
    if(typeof c.autoDetect!=='boolean') errors.push('Automatic detection must be on or off.');
    c.stations.forEach((s,i)=>{
      if(!s||s.id!==i+1) {errors.push('Station IDs must stay in their original order.');return;}
      const tag=META[i].code;
      if(typeof s.lot!=='string'||!s.lot.trim()||s.lot.length>40) errors.push(`${tag}: lot name must contain 1–40 characters.`);
      [['target',1,1000000],['completed',0,1000000],['buffer',0,1000000],['priority',1,100],['weight',1,1000]].forEach(([k,a,b])=>num(s[k],a,b,`${tag} ${k}`,true));
      [['rate',0.1,100000],['rejectPct',0,99],['deadline',0,100000],['repair',0,10080],['backupRate',0.1,100000],['setup',0,1440],['busy',0,10080],['signal',0,100000],['threshold',0.001,100000],['faultRejectPct',0,99]].forEach(([k,a,b])=>num(s[k],a,b,`${tag} ${k}`));
      if(s.completed>s.target) errors.push(`${tag}: completed quantity cannot exceed the order quantity.`);
      if(s.buffer>s.target-s.completed) errors.push(`${tag}: allocated stock cannot exceed the unfilled quantity.`);
      if(!['high','low'].includes(s.sensorImpact)) errors.push(`${tag}: choose a valid sensor-event impact.`);
      if(typeof s.backupEnabled!=='boolean'||typeof s.compatible!=='boolean') errors.push(`${tag}: invalid backup settings.`);
    });
    return errors;
  }
  // Exact for this five-candidate model; no CP-SAT runtime or timing guarantee.
  function solveKnapsack(items, capacity) {
    if(!Number.isFinite(capacity)||capacity<0) throw Error('Invalid capacity');
    if(items.some(i=>!Number.isFinite(i.weight)||i.weight<=0||!Number.isFinite(i.value)||i.value<0)) throw Error('Invalid knapsack item');
    const sorted=items.slice().sort((a,b)=>b.value/b.weight-a.value/a.weight||String(a.id).localeCompare(String(b.id)));
    let best={selected:[], totalValue:0,totalWeight:0};
    function bound(k,cap,value) {
      for(let i=k;i<sorted.length;i++) {
        const take=Math.min(cap,sorted[i].weight); value+=take/ sorted[i].weight*sorted[i].value;cap-=take;
        if(cap<=0)break;
      } return value;
    }
    const stack=[{k:0,cap:capacity,value:0,weight:0,ids:[]}];
    while(stack.length) {
      const n=stack.pop();
      if(n.value>best.totalValue+1e-9) best={selected:n.ids,totalValue:n.value,totalWeight:n.weight};
      if(n.k===sorted.length||bound(n.k,n.cap,n.value)<=best.totalValue+1e-9)continue;
      const item=sorted[n.k]; stack.push({...n,k:n.k+1});
      if(item.weight<=n.cap)stack.push({k:n.k+1,cap:n.cap-item.weight,value:n.value+item.value,weight:n.weight+item.weight,ids:[...n.ids,item.id]});
    } return best;
  }
  function create(c=defaults(),wall=Date.now()) {
    const errors=validate(c); if(errors.length)throw Error(errors.join('\n'));
    return {version:VERSION,config:clone(c),elapsed:0,wall,paused:false,estop:false,revision:0,
      stations:c.stations.map(s=>({id:s.id,done:s.completed,rejects:0,fault:null,reviewed:false,technician:false,priorityLocked:false,route:null,overSeconds:0})),
      events:[{time:0,code:'SYSTEM',message:'Simulation ready. No PLC connection or real sensor feed.',level:'info'}]};
  }
  function log(s,code,message,level='info') {s.events.unshift({time:s.elapsed,code,message,level});s.events=s.events.slice(0,200);}
  function remaining(s,id) {const c=s.config.stations[id-1],r=s.stations[id-1];return Math.max(0,c.target-r.done-c.buffer);}
  function rejectRate(s,id) {const c=s.config.stations[id-1],r=s.stations[id-1];return r.fault?.kind==='quality'?Math.max(c.rejectPct,c.faultRejectPct):c.rejectPct;}
  function goodRate(s,id,backup=false) {const c=s.config.stations[id-1];return (backup?c.backupRate:c.rate)*(1-(backup?c.rejectPct:rejectRate(s,id))/100);}
  function facts(s,id) {
    const c=s.config.stations[id-1],r=s.stations[id-1],rem=remaining(s,id);
    const rate=goodRate(s,id),work=rem/rate*60;
    const primaryFinish=s.elapsed+work+(r.fault?.impact==='high'?c.repair:0);
    const activeFinish=r.route?Math.max(s.elapsed,r.route.readyAt)+rem/goodRate(s,id,true)*60:primaryFinish;
    const slack=c.deadline-activeFinish;
    return {remaining:rem,work,primaryFinish,finish:activeFinish,slack,urgency:rem>1e-7&&slack<=s.config.urgencyMargin?'high':'low',lateness:Math.max(0,activeFinish-c.deadline),rate};
  }
  function tier1(s,id) {
    const r=s.stations[id-1],f=facts(s,id);
    if(s.estop)return {key:'estop',label:'E-STOP',tone:'red',stop:true,action:'Simulated line stop latched'};
    if(r.fault?.impact==='high')return {key:'stop',label:r.route?'STOPPED · TRANSFERRED':'STOPPED',tone:'red',stop:true,action:'Stop primary and alarm'};
    if(f.remaining<1e-7)return {key:'complete',label:'COMPLETE',tone:'muted',stop:true,action:'Order fulfilled'};
    if(r.fault&&f.urgency==='high')return {key:'priority',label:'PRIORITY',tone:'amber',stop:false,action:'Continue and flag priority'};
    if(r.fault)return {key:'logged',label:'LOGGED',tone:'blue',stop:false,action:'Continue and log trend'};
    if(r.route)return {key:'transferred',label:'TRANSFERRED',tone:'cyan',stop:true,action:'Primary idle; lot remains on backup'};
    return {key:'running',label:'RUNNING',tone:'green',stop:false,action:'Normal operation'};
  }
  function candidate(s,id) {
    const c=s.config.stations[id-1],r=s.stations[id-1],f=facts(s,id);
    let reason='';
    const routeFinish=Math.max(s.elapsed,c.busy)+c.setup+f.remaining/goodRate(s,id,true)*60;
    const saved=f.primaryFinish-routeFinish;
    const tardinessSaved=Math.max(0,f.primaryFinish-c.deadline)-Math.max(0,routeFinish-c.deadline);
    if(s.estop)reason='Line E-stop is latched.';
    else if(f.remaining<1e-7)reason='No remaining work.';
    else if(!r.fault||r.fault.impact!=='high')reason='No stopped lot needs a transfer.';
    else if(r.route)reason='This lot has already been transferred.';
    else if(f.urgency!=='high')reason='Deadline margin allows a technician queue.';
    else if(!c.backupEnabled)reason='Backup is unavailable.';
    else if(!c.compatible)reason='Backup is not qualified for this product and process.';
    else if(saved<=0)reason='Waiting for repair finishes no later than transfer.';
    const value=c.priority*(Math.max(0,tardinessSaved)+0.1*Math.max(0,saved));
    return {id,weight:c.weight,value,eligible:!reason,reason,routeFinish,primaryFinish:f.primaryFinish,saved:Math.max(0,saved),tardinessSaved:Math.max(0,tardinessSaved),busyLeft:Math.max(0,c.busy-s.elapsed)};
  }
  function plan(s) {
    const used=s.stations.reduce((a,r)=>a+(r.route&&remaining(s,r.id)>1e-7?s.config.stations[r.id-1].weight:0),0);
    const available=Math.max(0,s.config.capacity-used),candidates=META.map(m=>candidate(s,m.id));
    const result=solveKnapsack(candidates.filter(c=>c.eligible),available);
    return {used,available,candidates,...result};
  }
  function backupStatus(s,id) {
    const r=s.stations[id-1],c=s.config.stations[id-1];
    if(s.estop)return 'E-STOP';
    if(r.route&&remaining(s,id)<1e-7)return 'COMPLETE';
    if(r.route)return s.elapsed<r.route.readyAt?'CHANGEOVER':'RUNNING';
    if(!c.backupEnabled)return 'OFFLINE';
    if(!c.compatible)return 'INCOMPATIBLE';
    if(c.busy>s.elapsed)return 'BUSY';
    return 'STANDBY';
  }
  function signal(s,id) {
    const c=s.config.stations[id-1],r=s.stations[id-1];
    const elevated=r.fault?.kind==='equipment'?Math.max(c.signal,c.threshold*1.25):r.fault?.kind==='quality'?Math.max(c.signal,c.threshold*1.1):c.signal;
    return Math.max(0,elevated + Math.sin(s.elapsed*2+id)*Math.max(c.signal*0.025,0.001));
  }
  function inject(s,id,kind='equipment',impact) {
    const r=s.stations[id-1]; if(!r)throw Error('Unknown station');
    if(s.estop)throw Error('Reset the simulated E-stop before injecting an event.');
    if(r.fault)throw Error('Clear the existing fault before injecting another event at this station.');
    if(remaining(s,id)<1e-7)throw Error('This order is complete. Reset or edit its quantities first.');
    const labels={equipment:'Process equipment fault',quality:'Vision reject spike',trend:'Minor process deviation',sensor:'Sensor threshold exceeded'};
    if(!labels[kind])throw Error('Unknown event type');
    r.fault={kind,label:labels[kind],impact:impact||((kind==='equipment'||kind==='sensor')?'high':'low'),at:s.elapsed};
    r.reviewed=false;r.technician=false;
    log(s,META[id-1].code,`${r.fault.label}. ${tier1(s,id).action}; ${facts(s,id).urgency} order urgency.`,r.fault.impact==='high'?'red':'amber');
  }
  function advance(s,realSeconds) {
    if(s.paused||realSeconds<=0)return;
    const dt=realSeconds*s.config.speed/60,from=s.elapsed;s.elapsed+=dt;
    s.stations.forEach(r=>{
      const c=s.config.stations[r.id-1],rem=remaining(s,r.id);
      if(s.estop)return;
      if(s.config.autoDetect&&!r.fault&&!r.route&&rem>0) {
        r.overSeconds=signal(s,r.id)>c.threshold?r.overSeconds+realSeconds:0;
        if(r.overSeconds>=1)inject(s,r.id,'sensor',c.sensorImpact);
      }
      const runPrimary=!r.route&&!tier1(s,r.id).stop;
      const duration=r.route?Math.max(0,s.elapsed-Math.max(from,r.route.readyAt)):runPrimary?dt:0;
      if(!duration||!rem)return;
      const rate=goodRate(s,r.id,!!r.route),made=Math.min(rem,rate*duration/60);
      const reject=(r.route?c.rejectPct:rejectRate(s,r.id))/100;
      r.done+=made; r.rejects+=made/(1-reject)*reject;
      if(remaining(s,r.id)<1e-7)log(s,META[r.id-1].code,`Order ${c.lot} fulfilled${r.route?' on backup':''}.`,'green');
    });
  }
  function act(s,type,p={}) {
    if(type==='reset')return create(s.config,s.wall);
    if(type==='defaults')return create(defaults(),s.wall);
    if(type==='config') {
      const errors=validate(p.config);if(errors.length)throw Error(errors.join('\n'));
      return create(p.config,s.wall);
    }
    if(type==='pause'){s.paused=!s.paused;return s;}
    if(type==='speed'){if(![1,10,30,60,120].includes(+p.value))throw Error('Invalid speed');s.config.speed=+p.value;return s;}
    if(type==='clearlog'){s.events=[];return s;}
    if(type==='estop') {
      if(!s.estop){s.estop=true;log(s,'MAIN PLC','Demo E-stop latched. All primary and backup production halted.','red');}
      return s;
    }
    if(type==='preset') {
      const c=clone(s.config);c.autoDetect=false;
      if(!['urgent-stop','urgent-quality','queue','trend','competing'].includes(p.name))throw Error('Unknown scenario');
      c.stations.forEach(st=>{st.completed=100;st.target=300;st.buffer=0;st.signal=META[st.id-1].base;st.deadline=480;st.backupEnabled=true;st.compatible=true;st.busy=0;st.repair=60;});
      const id=p.id||1;c.stations[id-1].deadline=p.name.startsWith('urgent')?45:480;
      if(p.name==='competing'){c.capacity=60;c.stations[0].deadline=45;c.stations[2].deadline=45;}
      s=create(c,s.wall);
      if(p.name==='competing'){inject(s,1);inject(s,3);}
      else inject(s,id,p.name==='urgent-quality'?'quality':p.name==='trend'?'trend':'equipment');
      return s;
    }
    if(type==='inject'){inject(s,+p.id,p.kind,p.impact);return s;}
    const id=+p.id,r=s.stations[id-1];if(!r)throw Error('Unknown station');
    if(s.estop)throw Error('Reset the simulated E-stop before taking recovery actions.');
    if(type==='accept') {
      const current=plan(s),c=current.candidates[id-1];
      if(!current.selected.includes(id))throw Error(c.reason||'Recovery resources are allocated to a higher-value feasible combination.');
      const conf=s.config.stations[id-1];
      r.route={acceptedAt:s.elapsed,readyAt:Math.max(s.elapsed,conf.busy)+conf.setup,saved:c.saved,latenessSaved:c.tardinessSaved};
      r.reviewed=true;r.technician=true;
      log(s,META[id-1].code,`Operator approved transfer to ST-0${id}B. ${c.saved.toFixed(1)} min earlier completion estimated. Primary fault remains.`, 'cyan');
    } else if(type==='clear') {
      if(!r.fault)throw Error('There is no fault to clear.');
      r.fault=null;r.reviewed=false;r.technician=false;r.priorityLocked=false;r.overSeconds=0;
      // Sensor clearance resets the injected scenario value, avoiding immediate re-trigger.
      s.config.stations[id-1].signal=META[id-1].base;
      log(s,META[id-1].code,`Simulated technician clearance. ${r.route?'Transferred work stays on backup.':'Primary operation released.'}`,'green');
    } else if(type==='tech'||type==='ack'||type==='priority') {
      if(!r.fault)throw Error('There is no event to review.');
      r.reviewed=true;
      if(type==='tech')r.technician=true;
      if(type==='priority')r.priorityLocked=true;
      log(s,META[id-1].code,type==='tech'?'Technician queued. No repair has been performed.':type==='priority'?'Priority monitoring acknowledged. Production rate unchanged.':'Event acknowledged. Detection and monitoring remain active.');
    } else throw Error('Unknown action');
    return s;
  }
  function metrics(s) {
    const running=META.filter(m=>(!tier1(s,m.id).stop||backupStatus(s,m.id)==='RUNNING')&&!s.estop);
    return {running:running.length,throughput:running.reduce((a,m)=>a+goodRate(s,m.id,!!s.stations[m.id-1].route),0),
      faults:s.stations.filter(r=>r.fault).length,atRisk:META.filter(m=>facts(s,m.id).lateness>0&&remaining(s,m.id)>0).length,
      good:s.stations.reduce((a,r)=>a+Math.floor(r.done),0),remaining:META.reduce((a,m)=>a+remaining(s,m.id),0),
      saved:s.stations.reduce((a,r)=>a+(r.route?.saved||0),0)};
  }
  const api={VERSION,META,defaults,validate,create,solveKnapsack,remaining,rejectRate,goodRate,facts,tier1,candidate,plan,backupStatus,signal,inject,advance,act,metrics,clone};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FactoryEngine=api;
})(typeof window!=='undefined'?window:globalThis);
