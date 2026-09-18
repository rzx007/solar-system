/* ================= 星空 ================= */
function buildStars(){
  var N=9000, pos=new Float32Array(N*3), col=new Float32Array(N*3), siz=new Float32Array(N);
  var c=new THREE.Color(), i;
  for(i=0;i<N;i++){
    var u=Math.random()*2-1, th=Math.random()*Math.PI*2, r=Math.sqrt(1-u*u);
    var band=Math.random()<0.34;
    var x=r*Math.cos(th), y=u, z=r*Math.sin(th);
    if(band){ var tilt=0.36; var yy=y*Math.cos(tilt)-z*Math.sin(tilt); var zz=y*Math.sin(tilt)+z*Math.cos(tilt); y=yy*0.34; z=zz; var L=Math.sqrt(x*x+y*y+z*z); x/=L; y/=L; z/=L; }
    var R=28000+Math.random()*9000;
    pos[i*3]=x*R; pos[i*3+1]=y*R; pos[i*3+2]=z*R;
    var t=Math.random();
    if(t<0.14) c.setRGB(0.62,0.72,1.0);
    else if(t<0.30) c.setRGB(0.78,0.85,1.0);
    else if(t<0.62) c.setRGB(1.0,1.0,0.98);
    else if(t<0.82) c.setRGB(1.0,0.93,0.76);
    else c.setRGB(1.0,0.78,0.56);
    var b=0.35+Math.pow(Math.random(),2.2)*0.95;
    col[i*3]=c.r*b; col[i*3+1]=c.g*b; col[i*3+2]=c.b*b;
    siz[i]=(band?0.7:1.0)*(0.8+Math.pow(Math.random(),3.0)*2.6);
  }
  var g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(pos,3));
  g.setAttribute('aColor',new THREE.BufferAttribute(col,3));
  g.setAttribute('aSize',new THREE.BufferAttribute(siz,1));
  var m=new THREE.ShaderMaterial({
    uniforms:{uTime:{value:0},uPR:{value:renderer.getPixelRatio()}},
    vertexShader:[
      'attribute vec3 aColor; attribute float aSize;',
      'varying vec3 vColor; varying float vTw;',
      'uniform float uTime; uniform float uPR;',
      'void main(){',
      '  vColor=aColor;',
      '  vec4 mv=modelViewMatrix*vec4(position,1.0);',
      '  vTw=0.72+0.28*sin(uTime*(1.3+fract(aSize)*4.0)+position.x*0.0017+position.z*0.0009);',
      '  gl_PointSize=aSize*uPR*(2.2+vTw*1.4);',
      '  gl_Position=projectionMatrix*mv;',
      '}'
    ].join('\n'),
    fragmentShader:[
      'varying vec3 vColor; varying float vTw;',
      'void main(){',
      '  vec2 d=gl_PointCoord-vec2(0.5);',
      '  float r=length(d);',
      '  float a=smoothstep(0.5,0.04,r);',
      '  float spike=smoothstep(0.5,0.0,abs(d.x))*smoothstep(0.09,0.0,abs(d.y))*0.5',
      '             +smoothstep(0.5,0.0,abs(d.y))*smoothstep(0.09,0.0,abs(d.x))*0.5;',
      '  float i2=a*a+spike*0.42;',
      '  if(i2<=0.001) discard;',
      '  gl_FragColor=vec4(toSRGB(vColor*vTw*i2*1.9),1.0);',
      '}'
    ].join('\n'),
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending
  });
  m.fragmentShader=NOISE_GLSL+'\n'+m.fragmentShader;
  var pts=new THREE.Points(g,m);
  pts.frustumCulled=false;
  pts.renderOrder=-10;
  return pts;
}

/* ================= 太阳 ================= */
function buildSun(radius){
  var grp=new THREE.Group();
  var geo=new THREE.IcosahedronGeometry(radius,isSoft?5:6);
  var mat=new THREE.ShaderMaterial({
    uniforms:{uTime:{value:0}},
    vertexShader:[
      'varying vec3 vN; varying vec3 vP; varying vec3 vView;',
      'void main(){',
      '  vN=normalize(mat3(modelMatrix)*normal);',
      '  vec4 wp=modelMatrix*vec4(position,1.0);',
      '  vP=normalize(position);',
      '  vView=normalize(cameraPosition-wp.xyz);',
      '  gl_Position=projectionMatrix*viewMatrix*wp;',
      '}'
    ].join('\n'),
    fragmentShader:[
      'varying vec3 vN; varying vec3 vP; varying vec3 vView;',
      'uniform float uTime;',
      'void main(){',
      '  vec3 p=vP; float t=uTime*0.05;',
      '  float g1=fbm(p*9.0+vec3(0.0,t,0.0),5);',
      '  float g2=fbm(p*24.0-vec3(t*1.4,0.0,t*0.8),4);',
      '  float cells=ridged(p*5.5+vec3(t*0.5,0.0,t*0.2),4);',
      '  float h=g1*0.55+g2*0.22+cells*0.42;',
      '  vec3 col=mix(vec3(0.86,0.26,0.03),vec3(1.0,0.70,0.22),smoothstep(0.30,0.80,h));',
      '  col=mix(col,vec3(1.0,0.95,0.72),pow(smoothstep(0.66,1.0,h),1.6));',
      '  col+=vec3(1.0,1.0,0.9)*pow(smoothstep(0.80,1.0,h),3.0)*1.4;',
      '  float spot=smoothstep(0.60,0.70,fbm(p*3.1+vec3(t*0.16,0.0,0.0),4));',
      '  col*=1.0-spot*0.72;',
      '  float mu=max(dot(normalize(vN),normalize(vView)),0.0);',
      '  col*=(0.42+0.58*pow(mu,0.52));',
      '  gl_FragColor=vec4(toSRGB(aces(col*2.15)),1.0);',
      '}'
    ].join('\n')
  });
  mat.fragmentShader=NOISE_GLSL+'\n'+mat.fragmentShader;
  var mesh=new THREE.Mesh(geo,mat);
  grp.add(mesh);
  var cs=new THREE.Mesh(
    new THREE.IcosahedronGeometry(radius*1.045,4),
    new THREE.ShaderMaterial({
      uniforms:{uTime:{value:0}},
      vertexShader:['varying vec3 vN; varying vec3 vV;',
        'void main(){ vec4 wp=modelMatrix*vec4(position,1.0);',
        ' vN=normalize(mat3(modelMatrix)*normal); vV=normalize(cameraPosition-wp.xyz);',
        ' gl_Position=projectionMatrix*viewMatrix*wp; }'].join('\n'),
      fragmentShader:['varying vec3 vN; varying vec3 vV; uniform float uTime;',
        'void main(){',
        ' float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),3.2);',
        ' gl_FragColor=vec4(toSRGB(vec3(1.0,0.55,0.18)*f*0.42),1.0);',
        '}'].join('\n'),
      transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.BackSide
    })
  );
  cs.material.fragmentShader=NOISE_GLSL+'\n'+cs.material.fragmentShader;
  grp.add(cs);
  var glow=new THREE.Mesh(
    new THREE.PlaneGeometry(radius*5.2,radius*5.2),
    new THREE.ShaderMaterial({
      uniforms:{uTime:{value:0}},
      vertexShader:['varying vec2 vUv;','void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }'].join('\n'),
      fragmentShader:['varying vec2 vUv;',
        'void main(){',
        ' vec2 d=vUv-vec2(0.5); float r=length(d)*2.0;',
        ' float core=pow(max(0.0,1.0-r),6.0)*0.44;',
        ' float halo=pow(max(0.0,1.0-r),2.6)*0.085;',
        ' float a2=core+halo;',
        ' if(a2<=0.001) discard;',
        ' gl_FragColor=vec4(toSRGB(vec3(1.0,0.66,0.30)*a2),1.0);',
        '}'].join('\n'),
      transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, depthTest:true
    })
  );
  glow.renderOrder=-5;
  glow.material.fragmentShader=NOISE_GLSL+'\n'+glow.material.fragmentShader;
  grp.add(glow);
  return {group:grp, mesh:mesh, surface:mat, corona:cs.material, glow:glow.material, glowMesh:glow};
}
/* ANCHOR_B1_END */


