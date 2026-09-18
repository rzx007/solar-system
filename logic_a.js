'use strict';
/* ===== 3D 太阳系 · 程序化着色，无贴图贴图 ===== */
function $(id){ return document.getElementById(id); }
function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
function smooth01(v){ v=clamp(v,0,1); return v*v*(3.0-2.0*v); }
function lerp(a,b,t){ return a+(b-a)*t; }

/* ---- 环境自检 ---- */
function envCheck(){
  var out={}, cv=document.createElement('canvas');
  var gl=cv.getContext('webgl2')||cv.getContext('webgl');
  out.gl=!!gl; out.ver=gl?gl.getParameter(gl.VERSION):null;
  var dbg=gl&&gl.getExtension('WEBGL_debug_renderer_info');
  out.renderer=(dbg&&gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL))||(gl?gl.getParameter(gl.RENDERER):null);
  out.three=(typeof THREE!=='undefined')?THREE.REVISION:null;
  return out;
}
var ENV=envCheck();
var isSoft=/SwiftShader|llvmpipe|Software|Microsoft Basic/i.test(String(ENV.renderer||''));

/* ---- 渲染器 ---- */
var appEl=$('app');
var renderer=new THREE.WebGLRenderer({antialias:!isSoft,powerPreference:'high-performance'});
renderer.setSize(innerWidth,innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, isSoft?1:1.75));
renderer.outputEncoding=THREE.LinearEncoding;
renderer.toneMapping=THREE.NoToneMapping;
renderer.shadowMap.enabled=false;
appEl.appendChild(renderer.domElement);
renderer.domElement.style.touchAction='none';

var scene=new THREE.Scene();
var camera=new THREE.PerspectiveCamera(52,innerWidth/innerHeight,0.1,400000);

/* ---- 共享 GLSL 噪声库 ---- */
var NOISE_GLSL=[
'vec3 hash33(vec3 p){',
'  p=fract(p*vec3(0.1031,0.1030,0.0973));',
'  p+=dot(p,p.yxz+33.33);',
'  return fract((p.xxy+p.yxx)*p.zyx);',
'}',
'float hash13(vec3 p){',
'  p=fract(p*0.1031); p+=dot(p,p.zyx+31.32);',
'  return fract((p.x+p.y)*p.z);',
'}',
'float vnoise(vec3 x){',
'  vec3 i=floor(x), f=fract(x);',
'  f=f*f*(3.0-2.0*f);',
'  float n000=hash13(i), n100=hash13(i+vec3(1.0,0.0,0.0));',
'  float n010=hash13(i+vec3(0.0,1.0,0.0)), n110=hash13(i+vec3(1.0,1.0,0.0));',
'  float n001=hash13(i+vec3(0.0,0.0,1.0)), n101=hash13(i+vec3(1.0,0.0,1.0));',
'  float n011=hash13(i+vec3(0.0,1.0,1.0)), n111=hash13(i+vec3(1.0,1.0,1.0));',
'  float x00=mix(n000,n100,f.x), x10=mix(n010,n110,f.x);',
'  float x01=mix(n001,n101,f.x), x11=mix(n011,n111,f.x);',
'  return mix(mix(x00,x10,f.y), mix(x01,x11,f.y), f.z);',
'}',
'float fbm(vec3 p, int oct){',
'  float a=0.5, s=0.0, t=0.0;',
'  for(int i=0;i<7;i++){ if(i>=oct) break;',
'    s+=a*vnoise(p); t+=a; p*=2.03; a*=0.5;',
'  }',
'  return s/max(t,0.0001);',
'}',
'float ridged(vec3 p, int oct){',
'  float a=0.5, s=0.0, t=0.0;',
'  for(int i=0;i<7;i++){ if(i>=oct) break;',
'    float n=1.0-abs(vnoise(p)*2.0-1.0); s+=a*n*n; t+=a; p*=2.07; a*=0.5;',
'  }',
'  return s/max(t,0.0001);',
'}',
'vec3 aces(vec3 x){',
'  x*=0.62;',
'  return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0);',
'}',
'vec3 toSRGB(vec3 c){',
'  c=clamp(c,0.0,1.0);',
'  return mix(c*12.92, 1.055*pow(c,vec3(1.0/2.4))-0.055, step(vec3(0.0031308),c));',
'}'
].join('\n');
/* ANCHOR_A_END */
