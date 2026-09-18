/* ================= 着色器材质工厂 ================= */
function col(hex){ return new THREE.Color(hex); }

function rockyMaterial(cfg,seed){
  var isMoon=!!cfg.isMoon;
  var u={
    uTime:{value:0},
    uSunDir:{value:new THREE.Vector3(1,0,0)},
    uSunCol:{value:new THREE.Color(1.0,0.97,0.92)},
    uC0:{value:col(cfg.c0)}, uC1:{value:col(cfg.c1)},
    uC2:{value:col(cfg.c2)}, uC3:{value:col(cfg.c3)},
    uScale:{value:cfg.scale||3.2},
    uSeed:{value:seed},
    uOcean:{value:cfg.ocean||0},
    uSea:{value:(cfg.sea===undefined?0.5:cfg.sea)},
    uIce:{value:(cfg.ice===undefined?0.97:cfg.ice)},
    uBump:{value:(cfg.bump===undefined?1.0:cfg.bump)},
    uCrater:{value:(cfg.crater===undefined?0.0:cfg.crater)},
    uAtmo:{value:(isMoon?0.03:(cfg.atmo===undefined?0.05:cfg.atmo))}
  };
  return new THREE.ShaderMaterial({uniforms:u,vertexShader:COMMON_VS,fragmentShader:ROCKY_FS});
}

function gasMaterial(cfg,seed){
  var u={
    uTime:{value:0},
    uSunDir:{value:new THREE.Vector3(1,0,0)},
    uSunCol:{value:new THREE.Color(1.0,0.97,0.92)},
    uC0:{value:col(cfg.c0)}, uC1:{value:col(cfg.c1)},
    uC2:{value:col(cfg.c2)}, uC3:{value:col(cfg.c3)},
    uSpotCol:{value:col(cfg.spotCol||'#b4462e')},
    uSpot:{value:(cfg.spot===undefined?0:cfg.spot)},
    uBands:{value:cfg.bands||9.0},
    uSeed:{value:seed},
    uSwirl:{value:(cfg.swirl===undefined?0.5:cfg.swirl)},
    uAtmo:{value:(cfg.atmo===undefined?0.25:cfg.atmo)}
  };
  return new THREE.ShaderMaterial({uniforms:u,vertexShader:COMMON_VS,fragmentShader:GAS_FS});
}

/* ================= 轨道线 ================= */
function orbitLine(radius,color,op){
  var N=240, pts=new Float32Array((N+1)*3), i;
  for(i=0;i<=N;i++){
    var a=(i/N)*Math.PI*2;
    pts[i*3]=Math.cos(a)*radius; pts[i*3+1]=0; pts[i*3+2]=Math.sin(a)*radius;
  }
  var g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(pts,3));
  return new THREE.Line(g,new THREE.LineBasicMaterial({
    color:new THREE.Color(color), transparent:true, opacity:op,
    depthWrite:false, blending:THREE.AdditiveBlending
  }));
}

/* ================= 装配 ================= */
var world=new THREE.Group();
scene.add(world);

var sunObj=buildSun(SUN_R);
world.add(sunObj.group);

var BODIES=[];      // 所有可跟踪天体
var PICK=[];        // 可拾取网格

var labelHost=document.createElement('div');
labelHost.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:4';
document.body.appendChild(labelHost);

function makeLabel(text,cls){
  var d=document.createElement('div');
  d.textContent=text;
  d.style.cssText='position:absolute;transform:translate(-50%,-50%);white-space:nowrap;'+
    'font:11px/1.2 monospace;color:#9fc4e8;text-shadow:0 1px 3px #000;opacity:0;transition:opacity .2s;letter-spacing:.5px';
  if(cls){ d.style.color=cls; }
  labelHost.appendChild(d);
  return d;
}

function buildBody(cfg,parentGroup,isMoon){
  var b={cfg:cfg, isMoon:!!isMoon, ticks:[]};
  var inc=cfg.inc||0;

  b.plane=new THREE.Object3D();
  b.plane.rotation.x=inc;
  parentGroup.add(b.plane);

  var rCfg=isMoon?cfg.dist:cfg.orbit;
  b.pivot=new THREE.Object3D();
  b.plane.add(b.pivot);

  b.carrier=new THREE.Object3D();
  b.carrier.position.x=rCfg;
  b.pivot.add(b.carrier);

  b.tilt=new THREE.Object3D();
  b.tilt.rotation.z=THREE.MathUtils.degToRad(cfg.tilt||0);
  b.carrier.add(b.tilt);

  var detail=isMoon?(isSoft?2:3):(isSoft?3:(cfg.type==='gas'?5:4));
  var geo=new THREE.IcosahedronGeometry(cfg.r,detail);
  var seed=new THREE.Vector3(Math.random()*90,Math.random()*90,Math.random()*90);
  b.seed=seed;
  b.mat=(cfg.type==='gas')?gasMaterial(cfg,seed):rockyMaterial(cfg,seed);
  b.mesh=new THREE.Mesh(geo,b.mat);
  b.mesh.userData.body=b;
  b.tilt.add(b.mesh);
  PICK.push(b.mesh);

  if(!isMoon){
    if(cfg.atmoCol){
      b.atmo=makeAtmoMesh(cfg.r*(cfg.type==='gas'?1.035:1.055),cfg.atmoCol,cfg.atmoPow||3.0,cfg.atmoInt||0.6);
      b.tilt.add(b.atmo);
      b.ticks.push(function(sunDir){ b.atmo.material.uniforms.uSunDir.value.copy(sunDir); });
    }
    if(cfg.cloudCover!==undefined){
      var cm=new THREE.ShaderMaterial({
        uniforms:{
          uTime:{value:0}, uSunDir:{value:new THREE.Vector3(1,0,0)},
          uSunCol:{value:new THREE.Color(1.0,0.97,0.92)},
          uSeed:{value:new THREE.Vector3(Math.random()*50,Math.random()*50,Math.random()*50)},
          uCover:{value:cfg.cloudCover},
          uCloudCol:{value:new THREE.Color(cfg.cloudCol||'#ffffff')},
        },
        vertexShader:COMMON_VS, fragmentShader:CLOUD_FS,
        transparent:true, depthWrite:false, side:THREE.FrontSide
      });
      b.clouds=new THREE.Mesh(new THREE.IcosahedronGeometry(cfg.r*(cfg.cloudR||1.015),isSoft?3:4),cm);
      b.tilt.add(b.clouds);
      b.ticks.push(function(sunDir,t){
        b.clouds.material.uniforms.uSunDir.value.copy(sunDir);
        b.clouds.material.uniforms.uTime.value=t;
      });
    }
    if(cfg.ring){
      var rg=new THREE.RingGeometry(cfg.r*cfg.ring.inner,cfg.r*cfg.ring.outer,isSoft?96:180,8);
      var rm=new THREE.ShaderMaterial({
        uniforms:{
          uTime:{value:0}, uSunDir:{value:new THREE.Vector3(1,0,0)},
          uSunCol:{value:new THREE.Color(1.0,0.97,0.92)},
          uPlanetPos:{value:new THREE.Vector3()},
          uC0:{value:col(cfg.ring.c0)}, uC1:{value:col(cfg.ring.c1)},
          uPlanetR:{value:cfg.r}, uOpacity:{value:cfg.ring.opacity},
          uInnerRatio:{value:cfg.ring.inner/cfg.ring.outer}
        },
        vertexShader:RING_VS, fragmentShader:RING_FS,
        transparent:true, depthWrite:false, side:THREE.DoubleSide
      });
      b.ring=new THREE.Mesh(rg,rm);
      b.ring.rotation.x=-Math.PI/2;
      b.tilt.add(b.ring);
      var tmp=new THREE.Vector3();
      b.ticks.push(function(sunDir){
        b.ring.material.uniforms.uSunDir.value.copy(sunDir);
        b.tilt.getWorldPosition(tmp);
        b.ring.material.uniforms.uPlanetPos.value.copy(tmp);
      });
    }
    b.label=makeLabel(cfg.name+'  '+cfg.en);
  }

  if(cfg.moons){
    b.moons=[];
    for(var i=0;i<cfg.moons.length;i++){
      var mc=Object.assign({},cfg.moons[i]);
      mc.isMoon=true;
      var mb=buildBody(mc,b.tilt,true);
      mb.parent=b;
      b.moons.push(mb);
      BODIES.push(mb);
    }
  }

  // 每帧：太阳方向 + 时间 + 自转 + 公转
  b.pivot.rotation.y=Math.random()*Math.PI*2;
  b.mesh.rotation.y=Math.random()*Math.PI*2;
  b.__posTmp=new THREE.Vector3();
  return b;
}
/* ANCHOR_C2_END */

