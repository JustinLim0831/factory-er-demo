import * as THREE from './vendor/three.module.js';
import { OrbitControls } from './vendor/OrbitControls.js';
const E=window.FactoryEngine,S=window.FactoryStore,F=window.FactoryFloor;
const canvas=document.getElementById('factory-canvas'),wrap=document.getElementById('worldWrap');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'low-power'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
const scene=new THREE.Scene();scene.background=new THREE.Color('#111a21');
const camera=new THREE.OrthographicCamera(-27,27,19,-19,.1,180);
camera.position.set(27,34,38);
const controls=new OrbitControls(camera,canvas);controls.target.set(0,0,1);controls.enableDamping=true;controls.dampingFactor=.09;controls.minZoom=.65;controls.maxZoom=5;controls.maxPolarAngle=Math.PI*.46;controls.minPolarAngle=.12;
scene.add(new THREE.HemisphereLight(0xd8f1ff,0x5d6872,2.7));
const sun=new THREE.DirectionalLight(0xffefdd,3.2);sun.position.set(-12,30,12);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-30;sun.shadow.camera.right=30;sun.shadow.camera.top=20;sun.shadow.camera.bottom=-20;sun.shadow.bias=-.001;sun.shadow.normalBias=.03;scene.add(sun);
const palette={body:0xc2d0d4,dark:0x334957,black:0x1d303d,glass:0x41677a,accent:0x58bcae,green:0x81d5ac,red:0xff7186,amber:0xedc37b,gray:0x68818e,wafer:0x7266a7,copper:0xd9a568};
const mats=new Map();
function material(color,extra={}){const key=color+JSON.stringify(extra);if(!mats.has(key))mats.set(key,new THREE.MeshStandardMaterial({color,roughness:.58,metalness:.12,...extra}));return mats.get(key);}
function box(parent,x,y,z,w,h,d,color,extra={}){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material(color,extra));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function cylinder(parent,x,y,z,r,h,color){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,28),material(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function line(parent,points,color,dashed=false){const geo=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p)));const m=dashed?new THREE.LineDashedMaterial({color,dashSize:.25,gapSize:.18}):new THREE.LineBasicMaterial({color});const l=new THREE.Line(geo,m);if(dashed)l.computeLineDistances();parent.add(l);return l;}
function label(parent,text,x,y,z,width=4.5,color='#d4e5e8',size=32){const cv=document.createElement('canvas');cv.width=640;cv.height=96;const ctx=cv.getContext('2d');ctx.font=`600 ${size}px Arial`;ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,320,48);const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,depthTest:false,transparent:true}));sp.position.set(x,y,z);sp.scale.set(width,width*.15,1);parent.add(sp);return sp;}
function updateLabel(sprite,text,color){if(sprite.userData.text===text&&sprite.userData.color===color)return;const cv=sprite.material.map.image,ctx=cv.getContext('2d');ctx.clearRect(0,0,640,96);ctx.font='600 30px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(text,320,48);sprite.material.map.needsUpdate=true;sprite.userData={text,color};}
box(scene,0,-.23,1,47,.45,23,0x263642);
const grid=new THREE.GridHelper(46,46,0x3c505e,0x31434f);grid.position.y=.008;scene.add(grid);
// Clear physical organization: each primary has one same-process backup.
box(scene,0,.012,1.8,43,.022,2.3,0x324451);
for(let x=-20;x<=20;x+=2.2)box(scene,x,.03,1.8,.8,.015,.06,0x728690);
label(scene,'PRIMARY PROCESS CELLS',-13,.3,-7,9,'#a8c6d0',28);
label(scene,'QUALIFIED BACKUP EQUIPMENT',-10,.3,10,10,'#839fab',28);
const cells=[],pickables=[];
function wafer(parent,x,y,z,scale=1){cylinder(parent,x,y,z,.38*scale,.05,palette.wafer);for(let i=-2;i<=2;i++)line(parent,[[x-.24*scale,y+.03,z+i*.10*scale],[x+.24*scale,y+.03,z+i*.10*scale]],0xb8adcb);}
function equipment(id,x,z,backup=false){
 const group=new THREE.Group();group.position.set(x,0,z);scene.add(group);group.userData.stationId=id;
 box(group,0,.14,0,5.7,.24,4.1,backup?0x35464f:0x405963);
 const stripe=box(group,0,.28,1.95,5.65,.025,.045,backup?palette.gray:palette.accent);
 const body=box(group,0,.86,0,3.5,1.15,2.15,backup?0x9cacb5:palette.body);body.userData.stationId=id;pickables.push(body);
 box(group,-1.18,1.2,1.085,.55,.32,.04,palette.black);box(group,-1.18,1.21,1.112,.42,.18,.012,palette.accent);
 for(let i=0;i<4;i++)box(group,1.1+i*.12,.7,1.085,.04,.43,.02,palette.dark);
 const conveyor=box(group,0,.8,1.35,4.5,.17,.52,palette.black);
 for(let i=0;i<12;i++){const r=cylinder(group,-2+i*.36,.91,1.35,.09,.43,palette.gray);r.rotation.x=Math.PI/2;}
 const movers=[];
 if(id===1){
   cylinder(group,.2,1.77,-.1,1.08,.7,palette.body);cylinder(group,.2,2.14,-.1,.92,.08,palette.dark);cylinder(group,.2,2.2,-.1,.5,.06,palette.glass);
   box(group,-1.25,1.65,.8,.75,.6,.7,palette.dark);for(let i=0;i<4;i++)box(group,-1.25,1.46+i*.1,1.16,.56,.035,.12,palette.wafer);
   const arm=box(group,.2,1.45,.8,1.1,.07,.15,palette.accent);movers.push({obj:arm,mode:'slide',base:.2});
   box(group,2.25,1.25,-.65,.72,2,.8,palette.dark);line(group,[[2.25,2.22,-.65],[.2,2.6,-.65],[.2,2.25,-.1]],0x82a5b5);
 }else if(id===2){
   cylinder(group,-.45,1.78,0,.82,.75,palette.dark);cylinder(group,-.45,2.17,0,.8,.1,palette.glass);
   const rf=cylinder(group,-.45,2.3,0,.48,.1,palette.accent);movers.push({obj:rf,mode:'rotate'});
   box(group,1.1,1.85,-.2,.85,.85,1,palette.body);for(let i=0;i<3;i++)box(group,1.1,1.6+i*.2,.31,.6,.035,.02,palette.dark);
   for(let i=0;i<2;i++){cylinder(group,2.35,.91,-.5+i*.75,.23,1.45,palette.gray);line(group,[[2.35,1.65,-.5+i*.75],[2.35,2.6,-.5+i*.75],[-.45,2.6,0],[-.45,2.36,0]],palette.accent);}
 }else if(id===3){
   box(group,-1.35,2,0,.2,1.3,.25,palette.dark);box(group,1.35,2,0,.2,1.3,.25,palette.dark);box(group,0,2.62,0,2.95,.2,.32,palette.body);
   const head=new THREE.Group();head.position.set(0,2.15,0);group.add(head);box(head,0,0,0,.46,.6,.45,palette.accent);cylinder(head,0,-.45,0,.06,.3,palette.dark);movers.push({obj:head,mode:'gantry'});
   for(let ix=0;ix<3;ix++)for(let iz=0;iz<3;iz++)box(group,-.9+ix*.2,1.47,-.3+iz*.2,.13,.04,.13,palette.wafer);
   box(group,.7,1.47,0,.8,.03,.65,0x416957);
 }else if(id===4){
   box(group,.25,1.85,-.3,.65,.8,.6,palette.dark);const head=box(group,.25,1.9,.23,.45,.55,.4,palette.accent);movers.push({obj:head,mode:'bond'});
   const spool=cylinder(group,-1,2.05,-.2,.48,.2,palette.copper);spool.rotation.x=Math.PI/2;movers.push({obj:spool,mode:'spool'});
   line(group,[[-1,2.52,-.2],[-.7,2.8,.1],[.25,2.45,.25],[.25,1.5,.4]],palette.copper);
   box(group,.25,1.48,.45,.8,.035,.65,0x416957);for(let i=0;i<6;i++)line(group,[[i*.07+.05,1.52,.4],[i*.11-.05,1.57,.65]],palette.copper);
 }else{
   box(group,-.6,1.9,.3,.16,1.3,.18,palette.dark);box(group,.6,1.9,.3,.16,1.3,.18,palette.dark);box(group,0,2.5,.3,1.4,.15,.25,palette.body);
   box(group,0,2.26,.3,.43,.4,.43,palette.accent);cylinder(group,0,2.04,.3,.15,.08,palette.glass);
   const gate=box(group,.7,1.04,1.25,.8,.1,.12,palette.copper);movers.push({obj:gate,mode:'gate'});
   box(group,2.15,.55,1.1,.6,.6,.7,0x497663);box(group,2.15,.5,-.2,.6,.5,.7,0x814854);
   label(group,'PASS',2.2,1.05,1.15,1,'#a3dbc0',32);label(group,'REJECT',2.2,1,-.2,1.3,'#f5a7af',28);
 }
 const lamp=new THREE.Mesh(new THREE.SphereGeometry(.11,12,12),new THREE.MeshStandardMaterial({color:palette.green,emissive:palette.green,emissiveIntensity:.4}));lamp.position.set(-1.6,2.9,-.8);group.add(lamp);box(group,-1.6,2.4,-.8,.055,.8,.055,palette.dark);
 const sensor=box(group,1.55,1.4,.7,.18,.1,.18,palette.accent);sensor.userData.stationId=id;pickables.push(sensor);
 const input=[];for(let i=0;i<6;i++){const tray=box(group,-2.4,.45+i*.12,-.5,.65,.1,.75,palette.wafer);input.push(tray);}
 const packets=[];for(let i=0;i<4;i++){const p=box(group,-1.6+i,1.04,1.35,.25,.13,.28,id===5?palette.body:palette.wafer);packets.push(p);}
 const idlabel=label(group,`ST-0${id}${backup?'B':''}  ${E.META[id-1].short.toUpperCase()}`,0,3.55,0,5.6,backup?'#adc0c7':'#ecf6f5',29);
 const status=label(group,backup?'STANDBY':'RUNNING',0,3.1,0,4,'#81d5ac',30);
 const queue=label(group,'',-2.2,1.5,-.5,2.4,'#b4c4d0',26);
 group.traverse(o=>{if(o.isMesh){o.userData.stationId=id;pickables.push(o);}});
 return {group,body,lamp,stripe,movers,packets,input,status,queue,idlabel};
}
for(let id=1;id<=5;id++){
 const x=(id-3)*8;
 const primary=equipment(id,x,-2.5),backup=equipment(id,x,6,true);
 const pts=[[x+2,.17,-.2],[x+2,.17,1],[x+2,.17,3],[x+2,.17,4.3]];
 const proposed=line(scene,pts,palette.amber,true),approved=line(scene,pts,palette.accent,false);
 const arrow=new THREE.Mesh(new THREE.ConeGeometry(.23,.55,3),material(palette.accent));arrow.rotation.x=Math.PI/2;arrow.position.set(x+2,.18,4.2);scene.add(arrow);
 const trolley=box(scene,x+2,.42,1,.6,.3,.85,palette.accent);
 const outline=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(6.2,.06,4.6)),new THREE.LineBasicMaterial({color:palette.accent}));outline.position.set(x,.3,-2.5);scene.add(outline);
 cells.push({id,x,primary,backup,proposed,approved,arrow,trolley,outline});
}
// The main PLC cabinet is a shared controller, not another production station.
box(scene,-21.2,1.2,1.8,1.15,2.4,1.2,palette.body);box(scene,-21.2,1.5,2.42,.7,.35,.03,palette.dark);box(scene,-21.2,1.5,2.445,.52,.19,.015,palette.accent);label(scene,'MAIN PLC',-21.2,3,1.8,3.1,'#adc9cb',30);
let snapshot=S.get(),lastTime=performance.now(),motion=0;
const colors={green:'#81d5ac',red:'#ff8994',amber:'#edc37b',cyan:'#79d6cb',blue:'#85b8ee',muted:'#8999a5'};
function update(s){snapshot=s;const p=E.plan(s);
 cells.forEach(cell=>{
   const id=cell.id,r=s.stations[id-1],t=E.tier1(s,id),bs=E.backupStatus(s,id),rem=E.remaining(s,id);
   const pc=colors[t.tone],bc=bs==='RUNNING'?colors.green:bs==='CHANGEOVER'?colors.amber:bs==='E-STOP'?colors.red:colors.muted;
   cell.primary.lamp.material.color.set(pc);cell.primary.lamp.material.emissive.set(pc);
   cell.backup.lamp.material.color.set(bc);cell.backup.lamp.material.emissive.set(bc);
   updateLabel(cell.primary.status,t.label,pc);updateLabel(cell.backup.status,bs,bc);
   updateLabel(cell.primary.queue,r.route?'TRANSFERRED':`${Math.ceil(rem)} queued`,'#b7c8d2');
   updateLabel(cell.backup.queue,r.route?`${Math.ceil(rem)} queued`:'Standby','#a0b5c0');
   cell.primary.input.forEach((o,i)=>o.visible=!r.route&&i<Math.ceil(rem/40));cell.backup.input.forEach((o,i)=>o.visible=!!r.route&&i<Math.ceil(rem/40));
   cell.proposed.visible=!r.route&&p.selected.includes(id)&&!s.estop;cell.approved.visible=!!r.route&&rem>0;
   cell.arrow.visible=cell.proposed.visible||cell.approved.visible;cell.arrow.material=material(r.route?palette.accent:palette.amber);
   cell.trolley.visible=!!r.route&&bs==='CHANGEOVER';
   if(r.route){const duration=Math.max(.001,r.route.readyAt-r.route.acceptedAt),progress=THREE.MathUtils.clamp((s.elapsed-r.route.acceptedAt)/duration,0,1);cell.trolley.position.z=-.2+progress*4.4;}
   cell.outline.visible=id===F.selected;
 });
}
S.subscribe(update);addEventListener('factory-selection',()=>update(snapshot));
function fit(){const w=wrap.clientWidth,h=wrap.clientHeight;renderer.setSize(w,h,false);const aspect=w/h;const halfW=26;camera.left=-halfW;camera.right=halfW;camera.top=halfW/aspect;camera.bottom=-halfW/aspect;camera.updateProjectionMatrix();}
new ResizeObserver(fit).observe(wrap);fit();
function overview(top=false){controls.target.set(0,0,1);camera.position.set(top?0:25,top?50:36,top?1.01:40);camera.zoom=1;camera.updateProjectionMatrix();controls.update();}
document.getElementById('overviewCamera').onclick=()=>overview();document.getElementById('topCamera').onclick=()=>overview(true);
document.getElementById('focusCamera').onclick=()=>{const x=(F.selected-3)*8;controls.target.set(x,0,1.5);camera.position.set(x+10,18,22);camera.zoom=2.2;camera.updateProjectionMatrix();controls.update();};
const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let down=null;
canvas.addEventListener('pointerdown',e=>down=[e.clientX,e.clientY]);
canvas.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(pickables,false)[0];if(hit)F.select(hit.object.userData.stationId);});
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
function animate(now){requestAnimationFrame(animate);if(document.hidden||now-lastTime<50)return;const dt=Math.min((now-lastTime)/1000,.1);lastTime=now;
 if(!snapshot.paused&&!snapshot.estop)motion+=dt;
 cells.forEach(cell=>{const id=cell.id,r=snapshot.stations[id-1];
   [cell.primary,cell.backup].forEach((machine,index)=>{
     const running=index?E.backupStatus(snapshot,id)==='RUNNING':!E.tier1(snapshot,id).stop&&!r.route;
     if(!running||snapshot.paused||snapshot.estop||reduced.matches)return;
     machine.group.userData.phase=(machine.group.userData.phase||0)+dt*Math.min(2,snapshot.config.stations[id-1].rate/120);const phase=machine.group.userData.phase;
     machine.packets.forEach((o,i)=>{o.position.x=-1.9+((phase*.55+i)/4%1)*3.8;});
     machine.movers.forEach(({obj,mode,base})=>{if(mode==='slide')obj.position.x=base+Math.sin(phase)*.35;if(mode==='rotate')obj.rotation.y=phase*.4;if(mode==='gantry')obj.position.x=Math.sin(phase*1.6)*.75;if(mode==='bond')obj.position.y=1.9+Math.sin(phase*5)*.07;if(mode==='spool')obj.rotation.y=phase*.3;if(mode==='gate')obj.rotation.y=Math.sin(phase*1.4)*.4;});
   });
   // Reject-bin colour reflects the current reject burden, not random camera noise.
 });
 controls.update();renderer.render(scene,camera);
}
overview();document.getElementById('sceneMessage').hidden=true;window.factory3DReady=true;
window.factory3DDiagnostics=()=>({cells:cells.length,selected:F.selected,states:cells.map(c=>({id:c.id,primary:E.tier1(snapshot,c.id).label,backup:E.backupStatus(snapshot,c.id),proposed:c.proposed.visible,approved:c.approved.visible,phase:c.primary.group.userData.phase||0,backupPhase:c.backup.group.userData.phase||0}))});
requestAnimationFrame(animate);
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();document.getElementById('sceneMessage').hidden=false;document.getElementById('sceneMessage').innerHTML='<strong>3D graphics paused</strong><p>The browser lost its graphics context. Reload this page to restore the scene. Your simulation state is saved.</p>';});
