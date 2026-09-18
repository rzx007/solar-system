/* ================= 行星环顶点着色器（需要 uv） ================= */
var RING_VS=[
'varying vec2 vUv; varying vec3 vWorld; varying vec3 vNw; varying vec3 vView;',
'void main(){',
'  vUv=uv;',
'  vec4 wp=modelMatrix*vec4(position,1.0);',
'  vWorld=wp.xyz;',
'  vNw=normalize(mat3(modelMatrix)*normal);',
'  vView=normalize(cameraPosition-wp.xyz);',
'  gl_Position=projectionMatrix*viewMatrix*wp;',
'}'
].join('\n');
/* ================= 云层 ================= */
var CLOUD_FS=[
'varying vec3 vLocal; varying vec3 vNw; varying vec3 vView; varying vec3 vWorld;',
'uniform float uTime; uniform vec3 uSunDir; uniform vec3 uSunCol;',
'uniform vec3 uSeed; uniform float uCover; uniform float uCloudCol;',
'void main(){',
'  vec3 p=normalize(vLocal);',
'  float t=uTime*0.0045;',
'  float q=fbm(p*3.4+vec3(t,0.0,t*0.4)+uSeed,5);',
'  float w=fbm(p*7.0+vec3(0.0,t*1.6,0.0)+uSeed*2.0,4);',
'  float d=q*0.72+w*0.34;',
'  float band=1.0-0.42*pow(abs(p.y),1.4);',
'  float a=smoothstep(uCover,uCover+0.30,d)*band;',
'  if(a<=0.004) discard;',
'  vec3 nrm=normalize(vNw);',
'  vec3 L=normalize(uSunDir);',
'  float term=clamp((dot(nrm,L)+0.30)/1.30,0.0,1.0);',
'  vec3 c=mix(vec3(0.42,0.48,0.58),vec3(1.0,1.0,1.0),pow(term,0.6));',
'  gl_FragColor=vec4(toSRGB(aces(c*term*1.25*uSunCol)),a*0.86);',
'}'
].join('\n');
CLOUD_FS=NOISE_GLSL+'\n'+CLOUD_FS;

/* ================= 大气壳 ================= */
function makeAtmoMesh(radius,color,power,intensity){
  var m=new THREE.ShaderMaterial({
    uniforms:{uCol:{value:new THREE.Color(color)},uPow:{value:power},uInt:{value:intensity},uSunDir:{value:new THREE.Vector3(1,0,0)}},
    vertexShader:[
      'varying vec3 vNw; varying vec3 vView; varying vec3 vLocal;',
      'void main(){',
      '  vLocal=normalize(position);',
      '  vec4 wp=modelMatrix*vec4(position,1.0);',
      '  vNw=normalize(mat3(modelMatrix)*normal);',
      '  vView=normalize(cameraPosition-wp.xyz);',
      '  gl_Position=projectionMatrix*viewMatrix*wp;',
      '}'
    ].join('\n'),
    fragmentShader:[
      'varying vec3 vNw; varying vec3 vView; varying vec3 vLocal;',
      'uniform vec3 uCol; uniform float uPow; uniform float uInt; uniform vec3 uSunDir;',
      'void main(){',
      '  float f=pow(1.0-abs(dot(normalize(vNw),normalize(vView))),uPow);',
      '  vec3 L=normalize(uSunDir);',
      '  float lit=clamp(dot(normalize(vLocal),L)*0.5+0.5,0.0,1.0);',
      '  vec3 c=uCol*f*uInt*(0.10+pow(lit,1.5)*1.35);',
      '  if(max(max(c.r,c.g),c.b)<=0.0015) discard;',
      '  gl_FragColor=vec4(toSRGB(c),1.0);',
      '}'
    ].join('\n'),
    transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.FrontSide
  });
  m.fragmentShader=NOISE_GLSL+'\n'+m.fragmentShader;
  return new THREE.Mesh(new THREE.IcosahedronGeometry(radius,isSoft?3:4),m);
}

/* ================= 行星环 ================= */
var RING_FS=[
'varying vec2 vUv; varying vec3 vWorld; varying vec3 vNw; varying vec3 vView;',
'uniform float uTime; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uPlanetPos;',
'uniform vec3 uC0; uniform vec3 uC1; uniform float uPlanetR; uniform float uOpacity; uniform float uInnerRatio;',
'void main(){',
'  vec2 d=vUv-vec2(0.5);',
'  float r=length(d)*2.0;',
'  float span=max(0.0001,1.0-uInnerRatio);',
'  float rn=(r-uInnerRatio)/span;',
'  if(rn<0.0) discard;',
'  if(rn>1.0) discard;',
'  float t=rn;',
'  float fine=fbm(vec3(t*46.0,0.0,0.0),4);',
'  float med=fbm(vec3(t*15.0,3.7,1.2),3);',
'  float bands=0.55+0.45*sin(t*150.0+med*5.0);',
'  float density=smoothstep(0.02,0.16,t)*smoothstep(1.0,0.80,t);',
'  density*=0.45+0.75*fine;',
'  density*=0.55+0.60*med;',
'  density*=0.70+0.30*bands;',
'  float gap=smoothstep(0.020,0.050,abs(t-0.44))*smoothstep(0.015,0.045,abs(t-0.71));',
'  density*=mix(0.10,1.0,gap);',
'  if(density<=0.004) discard;',
'  vec3 alb=mix(uC0,uC1,smoothstep(0.15,0.85,fine));',
'  alb*=0.75+0.45*med;',
'  vec3 L=normalize(uSunDir);',
'  vec3 rel=vWorld-uPlanetPos;',
'  float along=dot(rel,L);',
'  vec3 perp=rel-L*along;',
'  float shadow=1.0;',
'  if(along>0.0){ if(length(perp)<uPlanetR) shadow=0.22; }',
'  float lit=0.55+0.45*abs(dot(normalize(rel),L));',
'  vec3 col=alb*lit*shadow*1.15*uSunCol;',
'  gl_FragColor=vec4(toSRGB(aces(col)),density*uOpacity);',
'}'
].join('\n');
RING_FS=NOISE_GLSL+'\n'+RING_FS;
/* ANCHOR_B3B_END */

