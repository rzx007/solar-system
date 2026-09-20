/* ================= 实例化行星 ================= */
var PLANETB=[];   // 仅行星，顺序固定，供面板 / 数字键使用
for(var pi=0;pi<PLANETS.length;pi++){
  var pb=buildBody(PLANETS[pi],world,false);
  BODIES.push(pb);
  PLANETB.push(pb);
  var pline=orbitLine(PLANETS[pi].orbit,'#4d6a8c',0.30);
  pb.plane.add(pline);
  pb.orbitLine=pline;
}
var stars=buildStars();
scene.add(stars);
var sunMat=sunObj.surface;
var coronaMat=sunObj.corona;

/* ================= 太阳作为可聚焦天体 ================= */
var sunBody={
  cfg:{name:'太阳', en:'Sun', r:SUN_R},
  isMoon:false, ticks:[],
  tilt:sunObj.group,
  mat:sunMat,
  __posTmp:new THREE.Vector3(0,0,0)
};
sunObj.mesh.userData.body=sunBody;
PICK.push(sunObj.mesh);

/* ================= 相机控制 ================= */
var ctrl={
  theta:0.62, phi:1.18, dist:210, dTheta:0.62, dPhi:1.18, dDist:210,
  target:new THREE.Vector3(0,0,0), want:new THREE.Vector3(0,0,0),
  focus:null,
  /* 聚焦时的"过渡偏移"：与天体的差值，逐帧衰减到 0。
     收敛后 target 与天体完全重合，天体在画面中静止，不再有稳态滞后。 */
  off:new THREE.Vector3(0,0,0)
};
var lastFollowRef=null;   // 上一次被跟随的天体，用于识别焦点切换
var dragging=0, lastX=0, lastY=0, moved=0;
var dom=renderer.domElement;

dom.addEventListener('contextmenu',function(e){ e.preventDefault(); });
dom.addEventListener('pointerdown',function(e){
  var btn=1;
  if(e.button===2){ btn=2; }
  if(e.button===1){ btn=2; }
  dragging=btn;
  lastX=e.clientX; lastY=e.clientY; moved=0;
  dom.setPointerCapture(e.pointerId);
});
dom.addEventListener('pointermove',function(e){
  if(!dragging){ return; }
  var dx=e.clientX-lastX, dy=e.clientY-lastY;
  lastX=e.clientX; lastY=e.clientY;
  moved+=Math.abs(dx)+Math.abs(dy);
  if(dragging===1){
    ctrl.dTheta-=dx*0.0055;
    ctrl.dPhi-=dy*0.0055;
    ctrl.dPhi=clamp(ctrl.dPhi,0.05,Math.PI-0.05);
  } else {
    var right=new THREE.Vector3(), up=new THREE.Vector3(), fwd=new THREE.Vector3();
    camera.matrixWorld.extractBasis(right,up,fwd);
    var kk=ctrl.dDist*0.0016;
    /* 平移前先把落点对齐当前机位，避免从聚焦状态开始拖拽时画面跳变 */
    if(ctrl.focus){ ctrl.focus=null; ctrl.want.copy(ctrl.target); }
    ctrl.want.addScaledVector(right,-dx*kk);
    ctrl.want.addScaledVector(up,dy*kk);
  }
});
dom.addEventListener('pointerup',function(e){
  if(dragging===1){
    if(moved<6){ pickAt(e.clientX,e.clientY); }
  }
  dragging=0;
});
dom.addEventListener('pointercancel',function(){ dragging=0; });
dom.addEventListener('wheel',function(e){
  e.preventDefault();
  ctrl.dDist*=Math.exp(e.deltaY*0.0011);
  ctrl.dDist=clamp(ctrl.dDist,0.35,1800);
  if(ctrl.focus){
    var fb=focusBounds(ctrl.focus);
    ctrl.dDist=clamp(ctrl.dDist,fb.lo,fb.hi);
  }
},{passive:false});

var ray=new THREE.Raycaster();
var ndc=new THREE.Vector2();
function pickAt(cx,cy){
  var rect=dom.getBoundingClientRect();
  ndc.x=((cx-rect.left)/rect.width)*2-1;
  ndc.y=-((cy-rect.top)/rect.height)*2+1;
  ray.setFromCamera(ndc,camera);
  var hits=ray.intersectObjects(PICK,false);
  if(hits.length>0){
    focusBody(hits[0].object.userData.body);
  } else if(ctrl.focus){
    /* 点空白处取消聚焦：停在原处，不再拉回全景原点 */
    ctrl.want.copy(ctrl.target);
    ctrl.focus=null;
    syncPanel();
  }
}
function focusBody(bd){
  if(!bd){ return; }
  ctrl.focus=bd;
  /* 自由视角的落点跟随当前机位，释放焦点时不会突然跳回原点 */
  ctrl.want.copy(ctrl.target);
  ctrl.dDist=focusDistance(bd);
  lastFocusRef=bd;
  syncPanel();
}
/* 聚焦距离：按天体半径（含行星环外径）推算，使主体占画面约六成且环不被裁切 */
function focusDistance(bd){
  var rr=bd.cfg.r;
  if(bd.cfg.ring){ rr=bd.cfg.r*bd.cfg.ring.outer*1.15; }
  return Math.max(rr*3.2,0.75);
}
/* 聚焦时的缩放边界：滚轮与主循环共用这一个来源，避免两套边界互相回弹 */
function focusBounds(bd){
  var rr=bd.cfg.r;
  if(bd.cfg.ring){ rr=bd.cfg.r*bd.cfg.ring.outer; }
  return { lo:Math.max(rr*1.45,0.35), hi:Math.max(rr*45,140) };
}
function clearFocus(){
  ctrl.focus=null;
  ctrl.dTheta=0.62; ctrl.dPhi=1.18;
  ctrl.want.set(0,0,0);
  ctrl.dDist=210;
  lastFocusRef=null;
  syncPanel();
}

/* ================= 天体导航面板 ================= */
function dotColor(cfg){
  if(cfg.atmoCol){ return cfg.atmoCol; }
  if(cfg.c1){ return cfg.c1; }
  if(cfg.c2){ return cfg.c2; }
  return '#9aa7b5';
}
var panelItems=[];
function addPanelItem(body,indent,color,label){
  var el=document.createElement('div');
  el.className='pitem';
  if(indent){ el.style.paddingLeft='20px'; el.style.fontSize='11px'; }
  var dot=document.createElement('span');
  dot.className='pdot';
  dot.style.color=color;
  dot.style.background=color;
  el.appendChild(dot);
  var tx=document.createElement('span');
  tx.textContent=label;
  el.appendChild(tx);
  el.addEventListener('click',function(){ focusBody(body); });
  $('plist').appendChild(el);
  panelItems.push({el:el, body:body});
}
(function buildPanel(){
  var all=document.createElement('div');
  all.className='pitem';
  all.style.marginBottom='4px';
  all.style.color='#8fb0d0';
  var tx=document.createElement('span');
  tx.textContent='全景视角';
  all.appendChild(tx);
  all.addEventListener('click',function(){ clearFocus(); });
  $('plist').appendChild(all);
  panelItems.push({el:all, body:null});

  addPanelItem(sunBody,false,'#ffb347','太阳 Sun');
  for(var i=0;i<PLANETB.length;i++){
    var p=PLANETB[i];
    addPanelItem(p,false,dotColor(p.cfg),(i+1)+'  '+p.cfg.name+' '+p.cfg.en);
    if(p.moons){
      for(var m=0;m<p.moons.length;m++){
        addPanelItem(p.moons[m],true,dotColor(p.moons[m].cfg),p.moons[m].cfg.name);
      }
    }
  }
})();
var lastFocusRef=undefined;
function syncPanel(){
  for(var i=0;i<panelItems.length;i++){
    var it=panelItems[i];
    if(it.body===ctrl.focus){ it.el.classList.add('on'); }
    else { it.el.classList.remove('on'); }
  }
}

/* ================= 键盘 ================= */
var paused=false, showOrbits=true, showLabels=true, daysPerSec=10.0, simDays=0;
addEventListener('keydown',function(e){
  var k=e.key, kl=k.toLowerCase();
  if(k===' '){ paused=!paused; e.preventDefault(); return; }
  if(k==='Escape'){ clearFocus(); return; }
  if(kl==='r'){ clearFocus(); simDays=0; return; }
  if(kl==='o'){ showOrbits=!showOrbits; return; }
  if(kl==='l'){ showLabels=!showLabels; return; }
  if(k==='['){ daysPerSec=Math.max(0.2,daysPerSec*0.6); return; }
  if(k===']'){ daysPerSec=Math.min(400,daysPerSec*1.7); return; }
  if(k>='1'){
    if(k<='8'){
      var idx=parseInt(k,10)-1;
      if(idx<PLANETB.length){ focusBody(PLANETB[idx]); }
    }
  }
});

/* ================= 主循环 ================= */
var clock=new THREE.Clock();
var fps=0, fpsAcc=0, fpsN=0, hudAcc=0;
var sunDir=new THREE.Vector3();
var tmpPos=new THREE.Vector3();
var camPos=new THREE.Vector3();
var lv=new THREE.Vector3();

function projectPoint(p,out){
  lv.copy(p).project(camera);
  out.x=(lv.x*0.5+0.5)*innerWidth;
  out.y=(-lv.y*0.5+0.5)*innerHeight;
  out.z=lv.z;
  return out;
}
var scr={x:0,y:0,z:0};

function tick(){
  requestAnimationFrame(tick);
  var dt=Math.min(clock.getDelta(),0.05);
  var t=clock.elapsedTime;

  if(!paused){ simDays+=dt*daysPerSec; }

  /* 公转 / 自转 / 云层自转 */
  var years=simDays/365.25;
  for(var i=0;i<BODIES.length;i++){
    var b=BODIES[i];
    b.pivot.rotation.y=-(years/b.cfg.period)*Math.PI*2;
    if(!paused){
      b.mesh.rotation.y+=dt*(b.cfg.spin===undefined?1.0:b.cfg.spin)*0.05;
      if(b.clouds){ b.clouds.rotation.y+=dt*(b.cfg.cloudSpin===undefined?1.0:b.cfg.cloudSpin)*0.05; }
    }
  }

  /* 太阳方向（太阳位于原点）+ 每体回调 */
  for(var q=0;q<BODIES.length;q++){
    var bb=BODIES[q];
    bb.tilt.getWorldPosition(tmpPos);
    if(tmpPos.lengthSq()>1e-6){
      sunDir.copy(tmpPos).multiplyScalar(-1).normalize();
    } else {
      sunDir.set(1,0,0);
    }
    bb.mat.uniforms.uSunDir.value.copy(sunDir);
    bb.mat.uniforms.uTime.value=t;
    for(var j=0;j<bb.ticks.length;j++){ bb.ticks[j](sunDir,t); }
  }

  /* 太阳 / 星空动画 */
  sunMat.uniforms.uTime.value=t;
  coronaMat.uniforms.uTime.value=t;
  sunObj.glowMesh.quaternion.copy(camera.quaternion);
  stars.material.uniforms.uTime.value=t;

  /* 相机：非聚焦时用指数阻尼回到自由视点；
     聚焦时改用"过渡偏移衰减"，收敛后与天体刚性同步 —— 无稳态滞后，天体在画面中静止。 */
  if(ctrl.focus){
    ctrl.focus.tilt.getWorldPosition(tmpPos);
    if(ctrl.focus!==lastFollowRef){
      /* 焦点切换：把当前差值记为过渡偏移，之后只衰减这个偏移 */
      lastFollowRef=ctrl.focus;
      ctrl.off.copy(ctrl.target).sub(tmpPos);
    }
    ctrl.off.multiplyScalar(Math.exp(-7.0*dt));
    if(ctrl.off.lengthSq()<1e-8){ ctrl.off.set(0,0,0); }
    ctrl.target.copy(tmpPos).add(ctrl.off);
  } else {
    lastFollowRef=null;
    ctrl.off.set(0,0,0);
    ctrl.target.lerp(ctrl.want,1-Math.exp(-8.0*dt));
  }
  var damp=1-Math.exp(-9.0*dt);
  ctrl.theta+=(ctrl.dTheta-ctrl.theta)*damp;
  ctrl.phi+=(ctrl.dPhi-ctrl.phi)*damp;

  /* 聚焦时约束缩放区间：与滚轮共用 focusBounds，避免边界互相打架导致回弹 */
  if(ctrl.focus){
    var fb=focusBounds(ctrl.focus);
    if(ctrl.dDist<fb.lo){ ctrl.dDist=fb.lo; }
    if(ctrl.dDist>fb.hi){ ctrl.dDist=fb.hi; }
  }
  ctrl.dist+=(ctrl.dDist-ctrl.dist)*(1-Math.exp(-6.0*dt));

  var sp=Math.sin(ctrl.phi), cp=Math.cos(ctrl.phi);
  camPos.set(
    ctrl.target.x+ctrl.dist*sp*Math.sin(ctrl.theta),
    ctrl.target.y+ctrl.dist*cp,
    ctrl.target.z+ctrl.dist*sp*Math.cos(ctrl.theta)
  );
  camera.position.copy(camPos);
  camera.lookAt(ctrl.target);
  camera.updateMatrixWorld();

  /* 面板高亮同步（仅在焦点变化时更新 DOM） */
  if(ctrl.focus!==lastFocusRef){
    lastFocusRef=ctrl.focus;
    syncPanel();
  }

  /* 标签投影 */
  var halfH=innerHeight*0.5;
  var tanHalf=Math.tan(THREE.MathUtils.degToRad(camera.fov*0.5));
  for(var n=0;n<BODIES.length;n++){
    var bd=BODIES[n];
    if(!bd.label){ continue; }
    if(!showLabels){ bd.label.style.opacity='0'; continue; }
    bd.tilt.getWorldPosition(tmpPos);
    var dist=camera.position.distanceTo(tmpPos);
    var apparent=(bd.cfg.r/Math.max(dist,0.001))*(halfH/tanHalf);
    if(apparent<1.4){ bd.label.style.opacity='0'; continue; }
    projectPoint(tmpPos,scr);
    var off=false;
    if(scr.z>1){ off=true; }
    if(scr.x<-200){ off=true; }
    if(scr.x>innerWidth+200){ off=true; }
    if(scr.y<-200){ off=true; }
    if(scr.y>innerHeight+200){ off=true; }
    if(off){ bd.label.style.opacity='0'; continue; }
    bd.label.style.opacity=String(clamp(apparent/6.0,0.30,0.92));
    bd.label.style.left=scr.x+'px';
    bd.label.style.top=(scr.y-apparent-13)+'px';
  }

  /* 轨道线 */
  for(var o=0;o<BODIES.length;o++){
    if(BODIES[o].orbitLine){ BODIES[o].orbitLine.visible=showOrbits; }
  }

  renderer.render(scene,camera);

  fpsAcc+=dt; fpsN++; hudAcc+=dt;
  if(hudAcc>0.25){
    fps=fpsN/Math.max(fpsAcc,0.0001); fpsAcc=0; fpsN=0; hudAcc=0;
    updateHUD();
  }
}

function updateHUD(){
  var focusName='自由视角';
  if(ctrl.focus){ focusName=ctrl.focus.cfg.name+' ('+ctrl.focus.cfg.en+')'; }
  var gl2='WebGL1';
  if(String(ENV.ver===null?'':ENV.ver).indexOf('2')>=0){ gl2='WebGL2'; }
  var soft='';
  if(isSoft){ soft=' · 软件渲染'; }
  var lines=[
    'FPS       '+fps.toFixed(0),
    '模拟时间  '+simDays.toFixed(1)+' 天（'+(simDays/365.25).toFixed(2)+' 地球年）',
    '流速      '+daysPerSec.toFixed(2)+' 天/秒'+(paused?'  [已暂停]':''),
    '焦点      '+focusName,
    '天体      '+BODIES.length+' 个（8 行星 + '+(BODIES.length-8)+' 卫星）',
    '环境      '+gl2+' · three r'+ENV.three+soft
  ];
  $('hud').innerHTML=lines.join('\n');
}

/* ================= 自适应 ================= */
addEventListener('resize',function(){
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
  stars.material.uniforms.uPR.value=renderer.getPixelRatio();
});

/* ================= 启动 ================= */
(function boot(){
  if(!ENV.gl){
    $('hud').innerHTML='WebGL 不可用：当前环境无法创建 3D 上下文。';
    return;
  }
  if(!ENV.three){
    $('hud').innerHTML='three.js 未加载。';
    return;
  }
  camera.position.set(0,80,210);
  camera.lookAt(0,0,0);
  renderer.render(scene,camera);
  tick();
})();
/* ANCHOR_D_END */

