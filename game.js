import * as THREE from 'three';

const $ = (id) => document.getElementById(id);
const errBox = $('err');
function showErr(m){ errBox.style.display='block'; errBox.textContent = String(m).slice(0,500); }
window.addEventListener('error', (e)=> showErr(e.message || e.error));

// ================= Audio (all synthesized, no assets) =================
const AudioSys = {
  ctx:null, master:null,
  init(){ if(this.ctx) return; try{
    this.ctx = new (window.AudioContext||window.webkitAudioContext)();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.35;
    this.master.connect(this.ctx.destination);
  }catch(e){} },
  blip(freq=440,dur=0.08,type='square',vol=0.5,slide=0){
    if(!this.ctx) return; const t=this.ctx.currentTime;
    const o=this.ctx.createOscillator(), g=this.ctx.createGain();
    o.type=type; o.frequency.setValueAtTime(freq,t);
    if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(30,freq+slide),t+dur);
    g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.001,t+dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t+dur+0.02);
  },
  noise(dur=0.2,vol=0.6,lp=1200){
    if(!this.ctx) return; const t=this.ctx.currentTime;
    const n=Math.floor(this.ctx.sampleRate*dur);
    const buf=this.ctx.createBuffer(1,n,this.ctx.sampleRate);
    const d=buf.getChannelData(0); for(let i=0;i<n;i++) d[i]=(Math.random()*2-1)*(1-i/n);
    const s=this.ctx.createBufferSource(); s.buffer=buf;
    const f=this.ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=lp;
    const g=this.ctx.createGain(); g.gain.value=vol;
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t);
  },
  shoot(){ this.noise(0.09,0.5,3200); this.blip(190,0.07,'square',0.25,-120); },
  plasma(){ this.blip(880,0.18,'sawtooth',0.3,-600); },
  eshoot(){ this.blip(320,0.15,'sawtooth',0.18,-150); },
  reload(){ this.blip(500,0.06,'square',0.3); setTimeout(()=>this.blip(700,0.06,'square',0.3),110); },
  boom(){ this.noise(0.6,0.9,500); this.blip(70,0.5,'sine',0.7,-40); },
  hit(){ this.blip(1200,0.05,'square',0.25); },
  hurt(){ this.blip(140,0.25,'sawtooth',0.5,-60); },
  shield(){ this.blip(660,0.3,'sine',0.25,330); },
  wave(){ this.blip(220,0.4,'triangle',0.4,220); setTimeout(()=>this.blip(330,0.4,'triangle',0.4,220),180); },
  click(){ this.blip(700,0.05,'square',0.25); },
  step(alt){ this.noise(0.05,0.16,700+ (alt?300:0)); },
  land(hard){ this.noise(hard?0.25:0.12, hard?0.7:0.4, 300); this.blip(70,0.12,'sine',0.4,-30); },
  slide(){ this.noise(0.45,0.35,900); },
};

// ================= Renderer / scene =================
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, powerPreference:'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;

const QUALITY = { mode:'auto' };
function setShadow(size, frustum){
  if(sun.shadow.mapSize.x!==size){
    sun.shadow.mapSize.set(size,size);
    if(sun.shadow.map){ sun.shadow.map.dispose(); sun.shadow.map=null; }
  }
  if(frustum){
    const c=sun.shadow.camera;
    c.left=-frustum; c.right=frustum; c.top=frustum; c.bottom=-frustum;
    c.updateProjectionMatrix();
  }
}
function renderResLabel(){
  const px = renderer.getPixelRatio();
  const w = Math.round(innerWidth*px), h = Math.round(innerHeight*px);
  const el = $('reslabel');
  const tag = (w>=3000||h>=3000) ? '4K' : (w>=1900||h>=1900) ? 'QHD+' : 'HD';
  if(el) el.textContent = `render: ${w}×${h} · ${tag} · ${QUALITY.mode}`;
}
function applyQuality(){
  const dpr = Math.min(window.devicePixelRatio||1, 4);
  let px = dpr, shadow = true, shadowSize = 1024, density = 1;
  const m = QUALITY.mode;
  if(m==='low'){ px = Math.min(dpr,1); shadow=false; density=0.6; }
  else if(m==='med'){ px = Math.min(dpr,1.5); shadow=true; shadowSize=1024; density=0.85; }
  else if(m==='high'){ px = Math.min(dpr,2); shadow=true; shadowSize=2048; density=1; }
  else if(m==='ultra'){ px = dpr; shadow=true; shadowSize=2048; density=1.25; } // up to 4K on capable GPUs
  else { // auto: phones -> 1.5 cap, ipad -> 2
    const small = Math.min(innerWidth,innerHeight) < 500;
    px = small ? Math.min(dpr,1.6) : Math.min(dpr,2);
    shadow = true; shadowSize = small ? 1024 : 2048;
  }
  renderer.setPixelRatio(px);
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.shadowMap.enabled = shadow;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  setShadow(shadowSize, 80);
  renderResLabel();
  return { density };
}
let qstate = { density: 1 }; // real applyQuality() runs after sun exists (see below)

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b5d6);
scene.fog = new THREE.Fog(0x9fc0d8, 40, 220);

const camera = new THREE.PerspectiveCamera(74, innerWidth/innerHeight, 0.08, 600);

// Lights — Reach-like late afternoon
const sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
sun.position.set(-40, 60, 25);
sun.castShadow = true;
sun.shadow.mapSize.set(1024,1024);
sun.shadow.camera.left=-70; sun.shadow.camera.right=70;
sun.shadow.camera.top=70; sun.shadow.camera.bottom=-70;
sun.shadow.camera.far=200;
scene.add(sun);
scene.add(sun.target);
const hemi = new THREE.HemisphereLight(0xbdd8ff, 0x4a5a3a, 0.9);
scene.add(hemi);
const amb = new THREE.AmbientLight(0x334455, 0.35); // lifts night shadows
scene.add(amb);
const rim = new THREE.DirectionalLight(0x6a86ff, 0.55); // cool back-fill for edge definition
rim.position.set(50,30,-60);
scene.add(rim);
qstate = applyQuality();
// Sky dome: gradient + sun disc + drifting clouds + night stars (env-tintable)
const SKY = { night: 0, time: 0, mat: null,
  top: new THREE.Color(0x2a5d9e), mid: new THREE.Color(0x87b5d6), bot: new THREE.Color(0xe8d9b0) };
{
  const skyGeo = new THREE.SphereGeometry(480, 32, 20);
  const skyMat = new THREE.ShaderMaterial({ side:THREE.BackSide, depthWrite:false, fog:false,
    uniforms:{
      top:{value:SKY.top}, mid:{value:SKY.mid}, bot:{value:SKY.bot},
      nightF:{value:0}, time:{value:0},
    },
    vertexShader:'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:`
      varying vec3 vP; uniform vec3 top,mid,bot; uniform float nightF,time;
      float hash(vec3 p){ return fract(sin(dot(p,vec3(12.9898,78.233,45.164)))*43758.5453); }
      void main(){
        vec3 d=normalize(vP); float h=d.y;
        vec3 c=h>0.25?mix(mid,top,smoothstep(0.25,0.9,h)):mix(bot,mid,smoothstep(-0.1,0.25,h));
        // horizon haze
        c=mix(c, vec3(0.95,0.85,0.7)*(1.0-nightF*0.9), (1.0-smoothstep(0.0,0.28,abs(h-0.03)))*0.45);
        // sun disc + glow
        vec3 sd=normalize(vec3(-0.5,0.55,0.3));
        float s=pow(max(dot(d,sd),0.0),350.0);
        c+=vec3(1.0,0.9,0.7)*s*1.5*(1.0-nightF*0.85);
        float glow=pow(max(dot(d,sd),0.0),8.0); c+=vec3(1.0,0.85,0.6)*glow*0.25*(1.0-nightF*0.8);
        // drifting cloud bands
        if(h>0.02){
          vec2 cuv=d.xz/(d.y+0.25);
          float cl=sin(cuv.x*3.1+time*0.03)*sin(cuv.y*2.3-time*0.021);
          cl+=0.5*sin(cuv.x*7.7-time*0.043)*sin(cuv.y*6.1+time*0.03);
          cl=smoothstep(0.55,1.05,cl)*smoothstep(0.02,0.2,h)*(1.0-smoothstep(0.5,0.9,h));
          c=mix(c, vec3(1.02,1.0,0.98)*(1.0-nightF*0.92), cl*0.5*(1.0-nightF*0.55));
        }
        // night stars
        if(nightF>0.01 && h>0.05){
          vec3 cell=floor(d*220.0);
          float star=step(0.9975,hash(cell));
          float tw=0.6+0.4*sin(time*3.0+hash(cell.zyx)*40.0);
          c+=vec3(0.9,0.95,1.0)*star*tw*nightF*smoothstep(0.05,0.4,h);
        }
        // night grade
        c=mix(c, c*vec3(0.12,0.16,0.3)+vec3(0.008,0.012,0.03), nightF*0.88);
        gl_FragColor=vec4(c,1.0);
      }`});
  SKY.mat = skyMat;
  scene.add(new THREE.Mesh(skyGeo, skyMat));
  // additive sun glow sprite (cheap bloom feel)
  {
    const sc=document.createElement('canvas'); sc.width=sc.height=128;
    const sx=sc.getContext('2d');
    const grad=sx.createRadialGradient(64,64,4,64,64,64);
    grad.addColorStop(0,'rgba(255,240,210,0.9)');
    grad.addColorStop(0.35,'rgba(255,220,170,0.35)');
    grad.addColorStop(1,'rgba(255,210,150,0)');
    sx.fillStyle=grad; sx.fillRect(0,0,128,128);
    const st=new THREE.CanvasTexture(sc);
    const spr=new THREE.Sprite(new THREE.SpriteMaterial({ map:st, transparent:true, opacity:0.6,
      blending:THREE.AdditiveBlending, depthWrite:false, fog:false }));
    spr.position.set(-0.5,0.55,0.3).normalize().multiplyScalar(450);
    spr.scale.set(150,150,1);
    scene.add(spr);
  }
}
// Distant mountain ring with snow caps + far city spires
{
  const mGeo = new THREE.ConeGeometry(30, 55, 6);
  const mMat = new THREE.MeshStandardMaterial({ color:0x5a6f86, roughness:0.95, flatShading:true });
  const snowMat = new THREE.MeshStandardMaterial({ color:0xe8f0f8, roughness:0.7, flatShading:true });
  for(let i=0;i<14;i++){
    const a = i/14*Math.PI*2 + 0.2;
    const m = new THREE.Mesh(mGeo, mMat);
    m.position.set(Math.cos(a)*260, -6, Math.sin(a)*260);
    m.rotation.y = a; scene.add(m);
    if(i%3===0){
      const cap = new THREE.Mesh(new THREE.ConeGeometry(11,18,6), snowMat);
      cap.position.set(Math.cos(a)*260, 14, Math.sin(a)*260);
      cap.rotation.y = a; scene.add(cap);
    }
  }
  // far city spires (Reach skyline silhouette) on one horizon
  const cityMat = new THREE.MeshStandardMaterial({ color:0x2c3646, roughness:0.8 });
  const winMat = new THREE.MeshBasicMaterial({ color:0xffd98a });
  for(let i=0;i<9;i++){
    const h = 26+((i*37)%22);
    const bx = -150+i*16+((i*53)%7), bz = -205-((i*29)%18);
    const t = new THREE.Mesh(new THREE.BoxGeometry(7,h,7), cityMat);
    t.position.set(bx, h/2-14, bz); scene.add(t);
    if(i%2===0){
      const win = new THREE.Mesh(new THREE.BoxGeometry(7.2,1.1,7.2), winMat);
      win.position.set(bx, h-16, bz); win.userData.cityWin = true; scene.add(win);
    }
  }
}

// ================= Procedural detail textures (original art, CoD/Halo-grade PBR feel) =================
function makePanelTexture(){
  const c=document.createElement('canvas'); c.width=c.height=256;
  const x=c.getContext('2d');
  x.fillStyle='#c9ced6'; x.fillRect(0,0,256,256);
  for(let i=0;i<2400;i++){ x.fillStyle=`rgba(20,26,34,${Math.random()*0.09})`; x.fillRect(Math.random()*256,Math.random()*256,2,2); }
  for(let i=0;i<800;i++){ x.fillStyle=`rgba(255,255,255,${Math.random()*0.06})`; x.fillRect(Math.random()*256,Math.random()*256,2,2); }
  x.strokeStyle='rgba(30,38,48,0.85)'; x.lineWidth=3;
  for(let i=0;i<=256;i+=64){
    x.beginPath(); x.moveTo(i,0); x.lineTo(i,256); x.stroke();
    x.beginPath(); x.moveTo(0,i); x.lineTo(256,i); x.stroke();
  }
  x.strokeStyle='rgba(255,255,255,0.28)'; x.lineWidth=1;
  for(let i=3;i<=256;i+=64){
    x.beginPath(); x.moveTo(i,0); x.lineTo(i,256); x.stroke();
    x.beginPath(); x.moveTo(0,i); x.lineTo(256,i); x.stroke();
  }
  x.fillStyle='rgba(30,38,48,0.9)';
  for(let gx=0;gx<4;gx++) for(let gy=0;gy<4;gy++)
    for(const [ox,oy] of [[8,8],[56,8],[8,56],[56,56]]){
      x.beginPath(); x.arc(gx*64+ox,gy*64+oy,2.4,0,7); x.fill();
    }
  const gr=x.createLinearGradient(0,170,0,256);
  gr.addColorStop(0,'rgba(60,52,36,0)'); gr.addColorStop(1,'rgba(60,52,36,0.4)');
  x.fillStyle=gr; x.fillRect(0,0,256,256);
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  return t;
}
function makeGunTexture(){
  const c=document.createElement('canvas'); c.width=c.height=128;
  const x=c.getContext('2d');
  x.fillStyle='#39424e'; x.fillRect(0,0,128,128);
  for(let i=0;i<128;i+=2){ x.fillStyle=`rgba(0,0,0,${0.04+Math.random()*0.05})`; x.fillRect(0,i,128,1); }
  x.fillStyle='rgba(160,180,200,0.25)'; x.fillRect(0,0,128,6);
  x.fillStyle='rgba(0,0,0,0.35)';
  for(let i=10;i<128;i+=18) x.fillRect(i,20,8,8);
  x.fillStyle='rgba(87,230,255,0.5)'; x.fillRect(0,118,128,3);
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  return t;
}
const PANEL_TEX = makePanelTexture();
const GUN_TEX = makeGunTexture();
// soft blob shadows grounding structures (conformed to terrain)
let BLOB_TEX = null;
function blobTexture(){
  if(BLOB_TEX) return BLOB_TEX;
  const c=document.createElement('canvas'); c.width=c.height=128;
  const x=c.getContext('2d');
  const g=x.createRadialGradient(64,64,6,64,64,64);
  g.addColorStop(0,'rgba(0,0,0,0.42)'); g.addColorStop(0.7,'rgba(0,0,0,0.22)'); g.addColorStop(1,'rgba(0,0,0,0)');
  x.fillStyle=g; x.fillRect(0,0,128,128);
  BLOB_TEX=new THREE.CanvasTexture(c);
  return BLOB_TEX;
}
function groundPatch(cx,cz,w,d,ry,op){
  ry=ry||0;
  const cos=Math.cos(ry), sin=Math.sin(ry);
  const g=new THREE.PlaneGeometry(w,d,Math.max(2,Math.round(w/2)),Math.max(2,Math.round(d/2)));
  g.rotateX(-Math.PI/2);
  const p=g.attributes.position;
  for(let i=0;i<p.count;i++){
    const lx=p.getX(i), lz=p.getZ(i);
    p.setY(i, groundH(cx+lx*cos+lz*sin, cz-lx*sin+lz*cos)-groundH(cx,cz)+0.06);
  }
  const m=new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map:blobTexture(), transparent:true,
    opacity:op||0.8, depthWrite:false }));
  m.position.set(cx,groundH(cx,cz),cz); m.rotation.y=ry; m.renderOrder=1;
  scene.add(m);
  return m;
}

// ================= Terrain =================
const ARENA = 110; // playable half-extent
function groundH(x,z){
  return Math.sin(x*0.06)*Math.cos(z*0.05)*1.6 + Math.sin(x*0.15+1.3)*0.5 + Math.cos(z*0.11)*0.6;
}
{
  const g = new THREE.PlaneGeometry(560,560,110,110);
  g.rotateX(-Math.PI/2);
  const pos = g.attributes.position;
  const colors = new Float32Array(pos.count*3);
  const cGrass = new THREE.Color(0x5d7a3c), cDry = new THREE.Color(0x8a8a55),
        cRock = new THREE.Color(0x6b6f72), cDark = new THREE.Color(0x3d4a2e),
        cLush = new THREE.Color(0x3f6b2f), cSand = new THREE.Color(0xa89a68);
  const tmp = new THREE.Color();
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i), z=pos.getZ(i);
    const h = groundH(x,z) - Math.max(0,(Math.hypot(x,z)-150))*0.15;
    pos.setY(i,h);
    // layered biome noise: large patches + fine grain
    const n1 = Math.sin(x*0.05+2.0)*Math.cos(z*0.045-1.0);
    const n2 = Math.sin(x*0.21+z*0.13)*Math.sin(z*0.19-x*0.07);
    const n3 = Math.sin(x*0.9)*Math.cos(z*0.8);
    tmp.copy(cGrass).lerp(cDry, THREE.MathUtils.clamp(0.5+n1*0.5,0,1)*0.7);
    if(n2>0.45) tmp.lerp(cLush, 0.55);
    if(n2<-0.5) tmp.lerp(cSand, 0.5);
    tmp.offsetHSL(0, 0, n3*0.03);
    const slope = Math.abs(Math.sin(x*0.06)*0.06)+Math.abs(Math.cos(z*0.05)*0.05);
    if(h>2.2 || slope>0.09) tmp.lerp(cRock,0.55);
    if(h<-1.2) tmp.lerp(cDark,0.5);
    colors[i*3]=tmp.r; colors[i*3+1]=tmp.g; colors[i*3+2]=tmp.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors,3));
  g.computeVertexNormals();
  const ground = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.95, metalness:0 }));
  ground.receiveShadow = true;
  scene.add(ground);
  // fine grain detail texture multiplied over vertex colors
  {
    const nc=document.createElement('canvas'); nc.width=nc.height=256;
    const nx=nc.getContext('2d'); const id=nx.createImageData(256,256);
    for(let i=0;i<id.data.length;i+=4){ const v=222+Math.random()*33; id.data[i]=id.data[i+1]=id.data[i+2]=v; id.data[i+3]=255; }
    nx.putImageData(id,0,0);
    const nt=new THREE.CanvasTexture(nc);
    nt.wrapS=nt.wrapT=THREE.RepeatWrapping; nt.repeat.set(90,90);
    ground.material.map=nt; ground.material.needsUpdate=true;
  }
}
// Water pond with animated shimmer
const pond = (()=>{
  const px=-42, pz=44, py=groundH(px,pz)+0.25;
  const wm = new THREE.MeshStandardMaterial({ color:0x1e5f7a, transparent:true, opacity:0.82,
    roughness:0.08, metalness:0.75 });
  const w = new THREE.Mesh(new THREE.CircleGeometry(13, 28), wm);
  w.rotation.x=-Math.PI/2; w.position.set(px,py,pz); scene.add(w);
  const rim = new THREE.Mesh(new THREE.RingGeometry(13,14.6,28),
    new THREE.MeshStandardMaterial({ color:0x8a8a55, roughness:1 }));
  rim.rotation.x=-Math.PI/2; rim.position.set(px,py+0.02,pz); rim.receiveShadow=true; scene.add(rim);
  return { mesh:w, mat:wm, base:0.82 };
})();
// Scatter: rocks, alloy towers, arches, grass tufts, beacon
// Outpost footprints (declared early so scatter keeps clear of them)
const OUTPOSTS = [
  { x:-24, z:6, ry:0.4 },
  { x:20, z:-4, ry:-0.35 },
  { x:-10, z:-34, ry:0.12 },
];
const segColliders = []; // wall segments {ax,az,bx,bz,r} — buildings you can walk into
function addSeg(ax,az,bx,bz,r){ segColliders.push({ax,az,bx,bz,r}); }
const colliders = []; // {x,z,r}
const ALLOY_GLOW = []; // emissive strips pulsed per env/time
function addCollider(x,z,r){ colliders.push({x,z,r}); }
{
  const rockGeo = new THREE.IcosahedronGeometry(1,0);
  const rockMat = new THREE.MeshStandardMaterial({ color:0x757a7d, roughness:0.9, flatShading:true });
  const towerMat = new THREE.MeshStandardMaterial({ color:0x9aa4ae, metalness:0.55, roughness:0.45, map:PANEL_TEX });
  const darkMat = new THREE.MeshStandardMaterial({ color:0x2b3542, metalness:0.4, roughness:0.6 });
  const glowMat = new THREE.MeshBasicMaterial({ color:0x57e6ff });
  ALLOY_GLOW.push(glowMat);
  const spots = [[-18,-14],[14,-20],[22,16],[-22,18],[0,-34],[-34,2],[30,-6],[-8,28],[8,30]];
  for(const [x,z] of spots){
    const h = groundH(x,z);
    const t = new THREE.Group();
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(3,14+((x*7+z*13)%5+5),3), towerMat);
    pillar.position.y = 7; pillar.castShadow = true; t.add(pillar);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(4.4,1,4.4), darkMat);
    cap.position.y = pillar.position.y+7; cap.castShadow=true; t.add(cap);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(3.15,0.5,3.15), glowMat);
    strip.position.y = 4; t.add(strip);
    t.position.set(x,h,z); t.rotation.y = (x+z)*0.13;
    scene.add(t); addCollider(x,z,3); groundPatch(x,z,7,7,0,0.7);
  }
  // Two arches (Reach-like alloy gates)
  for(const [x,z,ry] of [[0,-8,0.3],[-2,34,1.2]]){
    const a = new THREE.Group();
    const leg = new THREE.BoxGeometry(2,10,2);
    const l1 = new THREE.Mesh(leg, towerMat); l1.position.set(-5,5,0); l1.castShadow=true;
    const l2 = new THREE.Mesh(leg, towerMat); l2.position.set(5,5,0); l2.castShadow=true;
    const top = new THREE.Mesh(new THREE.BoxGeometry(12.5,2,2.4), darkMat); top.position.y=10.5; top.castShadow=true;
    const lite = new THREE.Mesh(new THREE.BoxGeometry(12.6,0.35,0.6), glowMat); lite.position.y=9.4;
    a.add(l1,l2,top,lite); a.position.set(x,groundH(x,z),z); a.rotation.y=ry; scene.add(a);
    addCollider(x-4*Math.cos(ry),z+4*Math.sin(ry),1.8); addCollider(x+4*Math.cos(ry),z-4*Math.sin(ry),1.8);
  }
  // Rocks (kept clear of spawn clearing at 0,26 and outposts)
  for(let i=0;i<56;i++){
    const a=Math.random()*Math.PI*2, r=18+Math.random()*80;
    const x=Math.cos(a)*r, z=Math.sin(a)*r;
    if(Math.hypot(x-0,z-26)<7) continue; // spawn clearing
    if(OUTPOSTS && OUTPOSTS.some(o=>Math.hypot(x-o.x,z-o.z)<9)) continue;
    const s=0.6+Math.random()*2.2;
    const rock=new THREE.Mesh(rockGeo,rockMat);
    rock.position.set(x,groundH(x,z)+s*0.3,z);
    rock.scale.set(s,s*(0.6+Math.random()*0.6),s);
    rock.rotation.set(Math.random()*3,Math.random()*3,Math.random()*3);
    rock.castShadow=true; rock.receiveShadow=true; scene.add(rock);
    if(s>1.4) addCollider(x,z,s*0.9);
  }
  // Low grass detail: small dark tufts hugging the ground (no billboards)
  const tuftGeo = new THREE.ConeGeometry(0.09, 0.5, 4);
  const tuftMat = new THREE.MeshStandardMaterial({ color:0x4c6a30, roughness:1 });
  const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, 460);
  const dummy = new THREE.Object3D();
  for(let i=0;i<460;i++){
    const a=Math.random()*Math.PI*2, r=6+Math.random()*95;
    const x=Math.cos(a)*r, z=Math.sin(a)*r;
    if(Math.hypot(x-0,z-26)<6){ dummy.position.set(0,-50,0); }
    else if(OUTPOSTS.some(o=>Math.hypot(x-o.x,z-o.z)<7.5)){ dummy.position.set(0,-50,0); }
    else dummy.position.set(x,groundH(x,z)+0.2,z);
    dummy.rotation.y=Math.random()*Math.PI;
    const s=0.7+Math.random()*0.9; dummy.scale.set(s,s,s);
    dummy.updateMatrix(); tufts.setMatrixAt(i,dummy.matrix);
  }
  tufts.instanceMatrix.needsUpdate=true; scene.add(tufts);
}
// ================= Enterable outposts =================
// Bunker structures with a door gap, fitted interior, and wall-segment
// colliders (players, allies, and ground enemies can walk in).
const OUTPOST_RECTS = []; // {x,z,ry,w,d} for radar
function buildOutpost(ox, oz, ry){
  const W=10, D=8, H=4, T=0.5, DOOR=2.8;
  const g = new THREE.Group();
  const wallM = new THREE.MeshStandardMaterial({ color:0x9aa0a8, metalness:0.35, roughness:0.55, map:PANEL_TEX });
  const darkM = new THREE.MeshStandardMaterial({ color:0x2b3542, metalness:0.4, roughness:0.6 });
  const trimM = new THREE.MeshBasicMaterial({ color:0x57e6ff });
  const warmM = new THREE.MeshBasicMaterial({ color:0xffc46b });
  const gy = groundH(ox,oz);
  const cos=Math.cos(ry), sin=Math.sin(ry);
  const toWorld=(lx,lz)=>[ox+lx*cos+lz*sin, oz-lx*sin+lz*cos];
  // wall helper: local-space segment -> mesh + world collider
  function wall(ax,az,bx,bz){
    const len=Math.hypot(bx-ax,bz-az);
    if(len<0.05) return;
    const m=new THREE.Mesh(new THREE.BoxGeometry(len,H,T), wallM);
    m.position.set((ax+bx)/2, H/2, (az+bz)/2);
    m.rotation.y = -Math.atan2(bz-az, bx-ax);
    m.castShadow=true; m.receiveShadow=true; g.add(m);
    // top trim strip
    const trim=new THREE.Mesh(new THREE.BoxGeometry(len,0.12,T+0.06), darkM);
    trim.position.set((ax+bx)/2, H+0.02, (az+bz)/2);
    trim.rotation.y = m.rotation.y; g.add(trim);
    const [wax,waz]=toWorld(ax,az), [wbx,wbz]=toWorld(bx,bz);
    addSeg(wax,waz,wbx,wbz,T/2+0.15);
  }
  const hx=W/2, hz=D/2;
  wall(-hx,-hz, hx,-hz);            // back
  wall(-hx,-hz, -hx,hz);            // left
  wall(hx,-hz, hx,hz);              // right
  wall(-hx,hz, -DOOR/2,hz);         // front-left of door
  wall(DOOR/2,hz, hx,hz);           // front-right of door
  // corner pillars
  for(const [px2,pz2] of [[-hx,-hz],[hx,-hz],[-hx,hz],[hx,hz]]){
    const pil=new THREE.Mesh(new THREE.BoxGeometry(0.8,H+0.6,0.8), darkM);
    pil.position.set(px2,(H+0.6)/2,pz2); pil.castShadow=true; g.add(pil);
  }
  // door frame glow posts (find the entrance)
  for(const dx of [-DOOR/2-0.25, DOOR/2+0.25]){
    const post=new THREE.Mesh(new THREE.BoxGeometry(0.3,3.2,0.3), trimM);
    post.position.set(dx,1.6,hz+0.1); g.add(post);
  }
  const lintel=new THREE.Mesh(new THREE.BoxGeometry(DOOR+0.9,0.35,0.4), trimM);
  lintel.position.set(0,3.35,hz+0.1); g.add(lintel);
  // roof slab with overhang
  const roof=new THREE.Mesh(new THREE.BoxGeometry(W+1.6,0.5,D+1.6), darkM);
  roof.position.y=H+0.45; roof.castShadow=true; g.add(roof);
  const roofTrim=new THREE.Mesh(new THREE.BoxGeometry(W+1.7,0.12,D+1.7), trimM);
  roofTrim.position.y=H+0.18; g.add(roofTrim);
  // window slits (emissive) on side + back walls
  for(const [sx,sz,ryy] of [[-hx,0,Math.PI/2],[hx,0,Math.PI/2],[0,-hz,0]]){
    const win=new THREE.Mesh(new THREE.BoxGeometry(2.4,0.5,0.1),
      new THREE.MeshBasicMaterial({ color:0xbfd9ff }));
    win.position.set(sx+(sxx(sx)),2.6,sz+(szz(sz))); win.rotation.y=ryy; g.add(win);
    function sxx(v){ return v<0?0.28:(v>0?-0.28:0); }
    function szz(v){ return v<0?0.28:0; }
  }
  // floor plate
  const floor=new THREE.Mesh(new THREE.BoxGeometry(W-0.4,0.12,D-0.4),
    new THREE.MeshStandardMaterial({ color:0x3a4552, metalness:0.3, roughness:0.7 }));
  floor.position.y=0.06; floor.receiveShadow=true; g.add(floor);
  // interior: ceiling light strip + warm point light
  const strip=new THREE.Mesh(new THREE.BoxGeometry(0.4,0.08,D-1.5), warmM);
  strip.position.set(0,H-0.1,0); g.add(strip);
  const lamp=new THREE.PointLight(0xffc98a, 14, 13, 1.6);
  lamp.position.set(0,3,0); g.add(lamp);
  // interior: side table (solid) + wall shelf
  const table=new THREE.Mesh(new THREE.BoxGeometry(1.6,0.9,1.0), darkM);
  table.position.set(-2.2,0.45,0.5); table.castShadow=true; g.add(table);
  {
    const [wtx,wtz]=toWorld(-2.2,0.5);
    addSeg(wtx-0.8,wtz-0.5,wtx+0.8,wtz-0.5,0.15);
    addSeg(wtx-0.8,wtz+0.5,wtx+0.8,wtz+0.5,0.15);
    addSeg(wtx-0.8,wtz-0.5,wtx-0.8,wtz+0.5,0.15);
    addSeg(wtx+0.8,wtz-0.5,wtx+0.8,wtz+0.5,0.15);
  }
  const shelf=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.12,3.0), wallM);
  shelf.position.set(hx-0.45,1.6,-1); g.add(shelf);
  g.position.set(ox,gy,oz); g.rotation.y=ry;
  scene.add(g);
  g.updateMatrixWorld(true);
  groundPatch(ox,oz,W+3,D+3,ry,0.75);
  OUTPOST_RECTS.push({x:ox,z:oz,ry,w:W,d:D});
  return g;
}
const outpostGroups = OUTPOSTS.map(o=>buildOutpost(o.x,o.z,o.ry));
// Ammo crates (green, refill between waves)
const crates = [];
{
  const boxGeo = new THREE.BoxGeometry(1.2,0.8,1.2);
  const boxMat = new THREE.MeshStandardMaterial({ color:0x1f7a38, roughness:0.5, metalness:0.2, emissive:0x0a3d18, emissiveIntensity:0.6 });
  const lidMat = new THREE.MeshBasicMaterial({ color:0x7dff9a });
  for(let i=0;i<3;i++){
    const g = new THREE.Group();
    const b = new THREE.Mesh(boxGeo, boxMat); b.position.y=0.4; b.castShadow=true;
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.24,0.12,1.24), lidMat); lid.position.y=0.85;
    g.add(b,lid);
    const spots=[[-6,-4],[7,9],[-9,12]];
    g.position.set(spots[i][0], groundH(spots[i][0],spots[i][1]), spots[i][1]);
    scene.add(g); crates.push(g);
  }
  // bonus cache hidden inside outpost 1 (discoverable resupply)
  {
    const g = new THREE.Group();
    const b = new THREE.Mesh(boxGeo, boxMat); b.position.y=0.4; b.castShadow=true;
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.24,0.12,1.24), lidMat); lid.position.y=0.85;
    g.add(b,lid);
    const wp = outpostGroups[0].localToWorld(new THREE.Vector3(1.8,0,-1.2));
    g.position.set(wp.x, groundH(wp.x,wp.z)+0.1, wp.z);
    scene.add(g); crates.push(g);
  }
}

// ================= Environment presets (missions tint the world) =================
const ENVS = {
  day:  { sun:0xfff1d6, sunI:2.2, hemiSky:0xbdd8ff, hemiGnd:0x4a5a3a, hemiI:0.9, amb:0.35, rimI:0.55,
          fog:0x9fc0d8, fogN:40, fogF:220, night:0, exp:1.06,
          top:0x2a5d9e, mid:0x87b5d6, bot:0xe8d9b0 },
  dusk: { sun:0xff9a5c, sunI:1.9, hemiSky:0x8a7bd8, hemiGnd:0x4a3a2e, hemiI:0.7, amb:0.3, rimI:0.5,
          fog:0xc79a7a, fogN:35, fogF:200, night:0.12, exp:1.05,
          top:0x1e2a6e, mid:0xb86a8a, bot:0xffc98a },
  night:{ sun:0x8ab4ff, sunI:0.55, hemiSky:0x223355, hemiGnd:0x0c1410, hemiI:0.5, amb:0.5, rimI:0.9,
          fog:0x0a1424, fogN:25, fogF:170, night:1, exp:1.0,
          top:0x02040c, mid:0x0a1830, bot:0x1c2a44 },
  storm:{ sun:0xcfd8e6, sunI:1.2, hemiSky:0x6a7688, hemiGnd:0x2e3626, hemiI:0.75, amb:0.4, rimI:0.4,
          fog:0x7a8898, fogN:18, fogF:130, night:0.15, exp:1.02,
          top:0x2e3a4e, mid:0x6a7a8e, bot:0xb0a890 },
};
let curEnv = 'day';
function setEnv(name){
  const e = ENVS[name] || ENVS.day;
  curEnv = name;
  sun.color.setHex(e.sun); sun.intensity = e.sunI;
  if(name==='night'){ sun.position.set(30,50,-40); } else { sun.position.set(-40,60,25); }
  hemi.color.setHex(e.hemiSky); hemi.groundColor.setHex(e.hemiGnd); hemi.intensity = e.hemiI;
  amb.intensity = e.amb; rim.intensity = (e.rimI||0.55);
  scene.fog.color.setHex(e.fog); scene.fog.near = e.fogN; scene.fog.far = e.fogF;
  scene.background = scene.fog.color.clone();
  SKY.night = e.night;
  SKY.top.setHex(e.top); SKY.mid.setHex(e.mid); SKY.bot.setHex(e.bot);
  renderer.toneMappingExposure = e.exp;
}

// ================= Player =================
const player = {
  pos: new THREE.Vector3(0, 0, 26),
  vel: new THREE.Vector3(),
  yaw: 0, pitch: 0,
  height: 1.7, radius: 0.6,
  shield: 75, shieldMax: 75, health: 100, healthMax: 100,
  lastDamage: -99, alive: true,
  grounded: true, vy: 0,
  kills: 0, score: 0,
  nades: 3,
  sprinting: false, aiming: false,
  crouched: false, sliding: false, slideT: 0,
  slideDir: new THREE.Vector3(),
  heightCur: 1.7, landDip: 0, coyote: 0, stepT: 0, stepAlt: false,
  recoilP: 0, recoilY: 0, bloom: 0,
  swayX: 0, swayY: 0, lastYaw: 0, lastPitch: 0,
};
player.pos.y = groundH(player.pos.x, player.pos.z) + player.height;

// ================= Weapons (original designs) =================
const weapons = [
  { key:'AR', name:'AR-7 RIDGEBACK', magSize:32, mag:32, reserve:224, auto:true, rpm:540,
    dmg:11, headMul:2, spread:0.022, reloadT:1.5, range:120, tracer:0xffe29f, kick:0.011, zoom:1.0 },
  { key:'PL', name:'P-9 ION LANCE', magSize:100, mag:100, reserve:Infinity, auto:true, rpm:260,
    dmg:22, headMul:1.5, spread:0.008, reloadT:1.8, range:120, tracer:0x57e6ff, kick:0.016, zoom:1.15, plasma:true },
];
let curW = 0, reloadingUntil = 0, reloadDur = 0, lastShot = 0, triggerHeld = false;
let mouseDown = false, mouseAim = false, touchDown = false, touchAim = false;
let vmSprint = 0;

// Viewmodel gun (attached to camera)
const vmGroup = new THREE.Group();
camera.add(vmGroup); scene.add(camera);
let muzzle;
{
  const gunDark = new THREE.MeshStandardMaterial({ color:0x9aa2ae, metalness:0.6, roughness:0.4, map:GUN_TEX });
  const gunMid = new THREE.MeshStandardMaterial({ color:0x6a7684, metalness:0.5, roughness:0.5, map:GUN_TEX });
  const glow = new THREE.MeshBasicMaterial({ color:0x57e6ff });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.09,0.11,0.52), gunDark); body.position.set(0.22,-0.2,-0.5);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,0.3,10), gunMid);
  barrel.rotation.x=Math.PI/2; barrel.position.set(0.22,-0.18,-0.85);
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.03,0.05,0.08), gunMid); sight.position.set(0.22,-0.12,-0.5);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.008,6,6), glow); dot.position.set(0.22,-0.1,-0.5);
  const railL = new THREE.Mesh(new THREE.BoxGeometry(0.012,0.03,0.4), gunMid); railL.position.set(0.168,-0.19,-0.55);
  const railR = railL.clone(); railR.position.x=0.272;
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07,0.14,0.09), gunDark); grip.position.set(0.22,-0.28,-0.36); grip.rotation.x=0.25;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.028,0.007,6,14), gunMid); ring.position.set(0.22,-0.115,-0.42);
  muzzle = new THREE.PointLight(0xffd9a0, 0, 6); muzzle.position.set(0.22,-0.18,-1.0);
  const flash = new THREE.Mesh(new THREE.ConeGeometry(0.06,0.22,8), new THREE.MeshBasicMaterial({color:0xffe29f, transparent:true, opacity:0}));
  flash.rotation.x=-Math.PI/2; flash.position.set(0.22,-0.18,-1.05); flash.name='flash';
  vmGroup.add(body,barrel,sight,dot,muzzle,flash,railL,railR,grip,ring);
  vmGroup.scale.setScalar(0.75);
  vmGroup.position.set(0.03,-0.03,0);
  vmGroup.traverse(o=>{ o.frustumCulled=false; });
}

// Tracers + plasma + particles pools
const tracers = [];
{
  const g = new THREE.BoxGeometry(0.02,0.02,1);
  for(let i=0;i<24;i++){
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color:0xffe29f, transparent:true, opacity:0 }));
    m.visible=false; scene.add(m);
    tracers.push({ mesh:m, t:1, from:new THREE.Vector3(), to:new THREE.Vector3() });
  }
}
function fireTracer(from,to,color){
  const t = tracers.find(t=>t.t>=1) || tracers[0];
  t.t=0; t.from.copy(from); t.to.copy(to);
  t.mesh.material.color.setHex(color); t.mesh.visible=true;
}
const bolts = []; // enemy+player plasma
{
  const g = new THREE.SphereGeometry(0.12,8,8);
  for(let i=0;i<40;i++){
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color:0x66eaff }));
    m.visible=false; scene.add(m);
    bolts.push({ mesh:m, vel:new THREE.Vector3(), life:0, dmg:10, foe:true });
  }
}
function fireBolt(from,dir,speed,dmg,foe,color=0x66eaff){
  const b = bolts.find(b=>b.life<=0) || bolts[0];
  b.mesh.visible=true; b.mesh.position.copy(from);
  b.mesh.material.color.setHex(color);
  b.vel.copy(dir).multiplyScalar(speed); b.life=3; b.dmg=dmg; b.foe=foe;
  b.mesh.scale.setScalar(foe?1:1.3);
}
const parts = [];
{
  const g = new THREE.BoxGeometry(0.09,0.09,0.09);
  for(let i=0;i<120;i++){
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color:0xffaa55, transparent:true }));
    m.visible=false; scene.add(m);
    parts.push({ mesh:m, vel:new THREE.Vector3(), life:0, max:1 });
  }
}
function burst(p,color,n=10,speed=5,up=3){
  let c=0;
  // keep debris out of the camera near-plane (avoids giant screen-filling quads)
  _burstSrc.subVectors(p, camera.position);
  const _d = _burstSrc.length();
  const src = _d<1.4 ? _burstTmp.copy(p).addScaledVector(_burstSrc.normalize(), 1.4-_d) : p;
  for(const q of parts){
    if(q.life>0) continue;
    q.life=q.max=0.4+Math.random()*0.5;
    q.mesh.visible=true; q.mesh.position.copy(src);
    q.mesh.scale.setScalar(1);
    q.mesh.position.x+=(Math.random()-0.5)*0.3;
    q.mesh.position.y+=(Math.random()-0.5)*0.3;
    q.mesh.position.z+=(Math.random()-0.5)*0.3;
    q.mesh.material.color.setHex(color);
    q.vel.set((Math.random()-0.5)*speed, Math.random()*up, (Math.random()-0.5)*speed);
    if(++c>=n) break;
  }
}
function smokePuff(p){ // slow gray hang-time smoke (muzzle, blasts)
  let c=0;
  for(const q of parts){
    if(q.life>0) continue;
    q.life=q.max=0.9+Math.random()*0.5;
    q.mesh.visible=true; q.mesh.position.copy(p);
    q.mesh.scale.setScalar(2+Math.random()*1.5);
    q.mesh.material.color.setHex(0x8a8f96);
    q.vel.set((Math.random()-0.5)*1.2, 2.2+Math.random()*1.6, (Math.random()-0.5)*1.2);
    if(++c>=3) break;
  }
}
const _burstSrc = new THREE.Vector3(), _burstTmp = new THREE.Vector3();
const nades = [];
{
  const g = new THREE.SphereGeometry(0.12,10,10);
  const m0 = new THREE.MeshStandardMaterial({ color:0x223344, metalness:0.7, roughness:0.3 });
  for(let i=0;i<6;i++){
    const m = new THREE.Mesh(g,m0); m.visible=false; m.castShadow=true; scene.add(m);
    nades.push({ mesh:m, vel:new THREE.Vector3(), life:0 });
  }
}

// ================= Enemies (original Krell designs) =================
const enemies = [];
const enemyGroup = new THREE.Group(); scene.add(enemyGroup);
function mat(c){ return new THREE.MeshStandardMaterial({ color:c, roughness:0.75, metalness:0.08, flatShading:true }); }

function buildSkitter(){ // small grunt-like "Skitter"
  const g = new THREE.Group();
  const skin = mat(0x7fae5a), dark = mat(0x3c5228), eye = new THREE.MeshBasicMaterial({color:0xffe14d});
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.42,10,8), skin); body.position.y=0.75; body.castShadow=true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28,10,8), skin); head.position.y=1.25; head.castShadow=true;
  const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.06,6,6), eye); e1.position.set(-0.1,1.3,0.22);
  const e2 = e1.clone(); e2.position.x=0.1;
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.2,0.4,8), dark); tank.position.set(0,0.75,-0.4); tank.rotation.x=0.4;
  const l1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,0.7,6), dark); l1.position.set(-0.25,0.35,0);
  const l2 = l1.clone(); l2.position.x=0.25;
  g.add(body,head,e1,e2,tank,l1,l2);
  g.userData.headY = 1.25;
  return g;
}
function buildKnight(){ // tall elite-like "Vex Knight"
  const g = new THREE.Group();
  const armor = mat(0x4a5fa5), under = mat(0x232a3d), eye = new THREE.MeshBasicMaterial({color:0x66eaff});
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.8,0.9,0.5), armor); torso.position.y=1.45; torso.castShadow=true;
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.55,0.35,0.4), under); pelvis.position.y=0.85;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34,0.42,0.4), armor); head.position.y=2.15; head.castShadow=true;
  const mand1 = new THREE.Mesh(new THREE.BoxGeometry(0.1,0.3,0.12), under); mand1.position.set(-0.14,1.95,0.2);
  const mand2 = mand1.clone(); mand2.position.x=0.14;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.26,0.08,0.05), eye); visor.position.set(0,2.16,0.21);
  const sh1 = new THREE.Mesh(new THREE.BoxGeometry(0.3,0.28,0.3), armor); sh1.position.set(-0.55,1.8,0);
  const sh2 = sh1.clone(); sh2.position.x=0.55;
  const a1 = new THREE.Mesh(new THREE.CylinderGeometry(0.11,0.11,0.7,6), under); a1.position.set(-0.55,1.25,0);
  const a2 = a1.clone(); a2.position.x=0.55;
  const l1 = new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.14,0.85,6), under); l1.position.set(-0.22,0.42,0);
  const l2 = l1.clone(); l2.position.x=0.22;
  g.add(torso,pelvis,head,mand1,mand2,visor,sh1,sh2,a1,a2,l1,l2);
  g.userData.headY = 2.15;
  return g;
}
function buildAegis(){ // jackal-like "Aegis Bearer" with shield
  const g = new THREE.Group();
  const skin = mat(0xb0874f), dark = mat(0x5a4526), eye = new THREE.MeshBasicMaterial({color:0xff5c5c});
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.4,0.9,8), skin); body.position.y=1.0; body.castShadow=true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24,8,8), skin); head.position.set(0,1.65,0.1);
  const crest = new THREE.Mesh(new THREE.ConeGeometry(0.12,0.4,6), dark); crest.position.set(0,1.9,-0.05); crest.rotation.x=-0.5;
  const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.05,6,6), eye); e1.position.set(-0.08,1.68,0.28);
  const e2 = e1.clone(); e2.position.x=0.08;
  const shield = new THREE.Mesh(new THREE.CircleGeometry(0.75,20, -0.9, 1.8),
    new THREE.MeshBasicMaterial({ color:0x55ccff, transparent:true, opacity:0.4, side:THREE.DoubleSide }));
  shield.position.set(0,1.1,0.55);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,0.5,6), dark); arm.position.set(0.35,1.1,0.3); arm.rotation.z=1.1;
  const l1 = new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.09,0.6,6), dark); l1.position.set(-0.15,0.3,0);
  const l2 = l1.clone(); l2.position.x=0.15;
  g.add(body,head,crest,e1,e2,shield,arm,l1,l2);
  g.userData.shieldMesh = shield; g.userData.headY = 1.65;
  return g;
}

function buildDrone(){ // fast hovering gun-drone "Stinger"
  const g = new THREE.Group();
  const hull = mat(0x6a4a9a), dark = mat(0x2c2140), eye = new THREE.MeshBasicMaterial({color:0xff5c8a});
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.34,10,8), hull); core.castShadow=true;
  const optic = new THREE.Mesh(new THREE.SphereGeometry(0.13,8,8), eye); optic.position.set(0,0.02,0.3);
  const sting = new THREE.Mesh(new THREE.ConeGeometry(0.09,0.5,6), dark); sting.position.set(0,-0.1,-0.42); sting.rotation.x=-Math.PI/2;
  g.add(core,optic,sting);
  const rotorG = new THREE.CylinderGeometry(0.3,0.3,0.03,10);
  const rotorM = new THREE.MeshBasicMaterial({ color:0x9a5cff, transparent:true, opacity:0.45, side:THREE.DoubleSide });
  g.userData.rotors = [];
  for(const [rx,rz] of [[-0.5,0.35],[0.5,0.35],[-0.5,-0.35],[0.5,-0.35]]){
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,0.62,6), dark);
    arm.position.set(rx*0.62,0.12,rz*0.62); arm.rotation.z=Math.PI/2; arm.rotation.y=-Math.atan2(rz,rx);
    const rot = new THREE.Mesh(rotorG, rotorM); rot.position.set(rx,0.24,rz);
    g.add(arm,rot); g.userData.rotors.push(rot);
  }
  g.userData.headY = 0.25;
  return g;
}
function buildMauler(){ // huge charging melee tank "Mauler"
  const g = new THREE.Group();
  const hide = mat(0xa03a2c), dark = mat(0x4a1e16), bone = mat(0xd8cba8);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.3,1.3,0.9), hide); torso.position.y=1.45; torso.castShadow=true;
  const hump = new THREE.Mesh(new THREE.SphereGeometry(0.55,8,6), dark); hump.position.set(0,2.2,-0.2);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.45,0.55), dark); head.position.set(0,2.0,0.5); head.castShadow=true;
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.4,0.14,0.5), bone); jaw.position.set(0,1.78,0.52);
  const a1 = new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.26,1.1,7), hide); a1.position.set(-0.85,1.2,0.1); a1.rotation.z=0.25;
  const a2 = a1.clone(); a2.position.x=0.85; a2.rotation.z=-0.25;
  const f1 = new THREE.Mesh(new THREE.SphereGeometry(0.28,7,6), bone); f1.position.set(-1.0,0.6,0.15);
  const f2 = f1.clone(); f2.position.x=1.0;
  const l1 = new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.24,0.9,7), dark); l1.position.set(-0.35,0.45,0);
  const l2 = l1.clone(); l2.position.x=0.35;
  g.add(torso,hump,head,jaw,a1,a2,f1,f2,l1,l2);
  for(let i=0;i<3;i++){
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.12,0.55,5), bone);
    spike.position.set((i-1)*0.35, 2.35-(i%2)*0.15, -0.55); spike.rotation.x=-0.7; g.add(spike);
  }
  g.userData.headY = 2.0;
  return g;
}
function buildLancer(){ // long-range sniper "Lancer"
  const g = new THREE.Group();
  const cloak = mat(0x8a6a35), under = mat(0x3a2f18), glow = new THREE.MeshBasicMaterial({color:0xffd24d});
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55,1.0,0.4), cloak); torso.position.y=1.35; torso.castShadow=true;
  const hood = new THREE.Mesh(new THREE.ConeGeometry(0.32,0.7,7), cloak); hood.position.y=2.15; hood.castShadow=true;
  const eye = new THREE.Mesh(new THREE.BoxGeometry(0.3,0.07,0.06), glow); eye.position.set(0,2.0,0.2);
  const rifle = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,1.6,7), under);
  rifle.position.set(0.3,1.5,0.4); rifle.rotation.x=Math.PI/2-0.08;
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.07,7,7), glow); tip.position.set(0.3,1.56,1.2);
  const cl1 = new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,0.5,6), cloak); cl1.position.set(-0.15,0.85,0.15); cl1.rotation.x=-0.5;
  const cl2 = cl1.clone(); cl2.position.x=0.15;
  const l1 = new THREE.Mesh(new THREE.CylinderGeometry(0.11,0.11,0.8,6), under); l1.position.set(-0.15,0.4,0);
  const l2 = l1.clone(); l2.position.x=0.15;
  g.add(torso,hood,eye,rifle,tip,cl1,cl2,l1,l2);
  g.userData.headY = 2.05;
  return g;
}
function buildWarlord(){ // boss "Krell Warlord"
  const g = buildKnight();
  g.scale.setScalar(1.5);
  const crownM = mat(0xd43a5c);
  for(let i=-2;i<=2;i++){
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.09,0.6,5), crownM);
    horn.position.set(i*0.22, 2.5, -0.05); horn.rotation.x=-0.25; g.add(horn);
  }
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.14,8,8),
    new THREE.MeshBasicMaterial({ color:0xff4d6e }));
  core.position.set(0,1.5,0.28); g.add(core);
  const sh1 = new THREE.Mesh(new THREE.BoxGeometry(0.42,0.4,0.42), crownM); sh1.position.set(-0.62,1.85,0);
  const sh2 = sh1.clone(); sh2.position.x=0.62; g.add(sh1,sh2);
  g.userData.headY = 2.15*1.5;
  return g;
}

const ETYPES = {
  skitter:{ hp:40, shield:0, speed:4.2, scale:1, score:100, dmg:8, range:14, atkCd:1.6, r:0.6, h:1.5, aimY:0.8, color:0x7fae5a },
  knight:{ hp:120, shield:60, speed:3.2, scale:1, score:250, dmg:12, range:26, atkCd:2.0, r:0.7, h:2.4, aimY:1.4, regenShield:true, color:0x4a5fa5 },
  aegis:{ hp:70, shield:40, speed:2.8, scale:1, score:175, dmg:10, range:22, atkCd:2.2, r:0.6, h:1.9, aimY:1.0, color:0x55ccff },
  drone:{ hp:50, shield:20, speed:5.5, scale:1, score:150, dmg:9, range:24, atkCd:1.8, r:0.6, h:1.4, aimY:0, fly:5.0, color:0x9a5cff },
  mauler:{ hp:260, shield:0, speed:3.0, charge:7.0, scale:1, score:350, dmg:25, range:3.2, atkCd:2.4, r:0.9, h:2.6, aimY:1.3, charger:true, color:0xc44a3a },
  lancer:{ hp:80, shield:40, speed:2.6, scale:1, score:300, dmg:22, range:46, atkCd:3.2, r:0.6, h:2.0, aimY:1.4, keeper:true, boltSpeed:46, regenShield:true, color:0xffb347 },
  warlord:{ hp:650, shield:250, speed:3.4, scale:1.5, score:1500, dmg:18, range:30, atkCd:2.4, r:1.0, h:3.6, aimY:2.0, boss:true, slam:true, regenShield:true, color:0xd43a5c },
};
// body-center height used for aiming / bolt collision
function aimH(e){ return e.t.fly ? e.mesh.position.y : e.mesh.position.y + (e.t.aimY||1); }
function spawnEnemy(type,x,z){
  const t = ETYPES[type];
  const mesh = type==='skitter'?buildSkitter():type==='knight'?buildKnight():type==='aegis'?buildAegis()
    :type==='drone'?buildDrone():type==='mauler'?buildMauler():type==='lancer'?buildLancer():buildWarlord();
  mesh.position.set(x, groundH(x,z), z);
  enemyGroup.add(mesh);
  // HP bar sprite
  const barC = document.createElement('canvas'); barC.width=64; barC.height=8;
  const barT = new THREE.CanvasTexture(barC);
  const bar = new THREE.Sprite(new THREE.SpriteMaterial({ map:barT, depthTest:false, transparent:true }));
  bar.scale.set(1.1,0.14,1); bar.position.y = t.h+0.5;
  mesh.add(bar);
  const e = { type, t, mesh, bar, barC, barT,
    hp:t.hp, shield:t.shield, maxhp:t.hp, maxsh:t.shield,
    atkT: Math.random()*1.5, strafe: Math.random()<0.5?1:-1, strafeT: 2+Math.random()*2,
    flash:0, flinch:0, dead:0, bob:Math.random()*6, shieldRegen:0, slamCd:2 };
  enemies.push(e);
  return e;
}
const BAR_COLORS = { knight:'#57e6ff', warlord:'#ff4d6e', lancer:'#ffb347', mauler:'#ff6655', drone:'#c9a6ff' };
function updateHpBar(e){
  const c = e.barC.getContext('2d');
  c.clearRect(0,0,64,8);
  const tot = e.maxhp+e.maxsh, cur = Math.max(0,e.hp)+Math.max(0,e.shield);
  c.fillStyle='rgba(0,0,0,0.6)'; c.fillRect(0,0,64,8);
  c.fillStyle = BAR_COLORS[e.type] || '#ffd24d';
  c.fillRect(1,1,62*Math.max(0,cur/tot),6);
  e.barT.needsUpdate = true;
}
function damageEnemy(e, dmg, isHead, point){
  if(e.dead>0) return;
  // Aegis frontal shield blocks (unless head/flank)
  if(e.type==='aegis' && e.shield>0){
    const toAtk = new THREE.Vector3().subVectors(player.pos, e.mesh.position).normalize();
    const fwd = new THREE.Vector3(0,0,1).applyQuaternion(e.mesh.quaternion);
    if(toAtk.dot(fwd) > 0.25 && !isHead && Math.random()<0.75){
      e.shield -= dmg*0.4;
      burst(point||e.mesh.position, 0x55ccff, 4, 3, 2);
      AudioSys.hit(); updateHpBar(e);
      if(e.shield<=0 && e.mesh.userData.shieldMesh) e.mesh.userData.shieldMesh.visible=false;
      return;
    }
  }
  if(e.shield>0){ e.shield-=dmg; if(e.shield<0){ e.hp+=e.shield; e.shield=0; } }
  else e.hp -= dmg*(isHead? (e.t.headMul||2) : 1);
  e.flash=0.12; e.flinch=1;
  // kinetic knockback shove (bosses barely budge)
  _kb.subVectors(e.mesh.position, player.pos); _kb.y=0;
  if(_kb.lengthSq()>0.0001){
    _kb.normalize().multiplyScalar(e.t.boss?0.03:0.18);
    let kx=e.mesh.position.x+_kb.x, kz=e.mesh.position.z+_kb.z;
    [kx,kz]=collideEnemy(kx,kz,e.t.r||0.6);
    e.mesh.position.x=kx; e.mesh.position.z=kz;
  }
  burst(point||e.mesh.position, 0xff6655, isHead?10:5, 4, 3);
  hitmarker(); AudioSys.hit();
  updateHpBar(e);
  if(e.shield<=0 && e.mesh.userData.shieldMesh && e.type!=='aegis') e.mesh.userData.shieldMesh&&(e.mesh.userData.shieldMesh.visible=false);
  if(e.type==='aegis' && e.shield<=0 && e.mesh.userData.shieldMesh) e.mesh.userData.shieldMesh.visible=false;
  if(e.hp<=0) killEnemy(e, isHead);
}
const _kb=new THREE.Vector3();
function killEnemy(e, isHead){
  e.dead=0.001;
  player.kills++;
  const bonus = isHead?50:0;
  player.score += e.t.score + bonus;
  if(e.t.boss){
    feed('★ WARLORD DOWN  +'+(e.t.score+bonus));
    burst(new THREE.Vector3(e.mesh.position.x, e.mesh.position.y+2, e.mesh.position.z), 0xffd24d, 30, 9, 8);
    rumble(0.7,0.8,300);
  } else {
    feed((isHead?'◉ HEADSHOT · ':'✕ ')+e.type.toUpperCase()+`  +${e.t.score+bonus}`);
  }
  burst(new THREE.Vector3(e.mesh.position.x, e.mesh.position.y+1, e.mesh.position.z), e.t.color, 16, 6, 5);
  AudioSys.boom();
  vibrate(30);
  rumble(0.3,0.35,120);
  updateHUD();
}

// ================= Allies: Ridge Troopers =================
const allies = [];
const ALLY_NAMES = ['KAI-3', 'REYES', 'IBEX', 'DUTCH'];
let wantedAllies = 0;
function buildMarine(){
  const g = new THREE.Group();
  const armor = new THREE.MeshStandardMaterial({ color:0x2e6b5e, roughness:0.6, metalness:0.25, flatShading:true });
  const dark = new THREE.MeshStandardMaterial({ color:0x1c242e, roughness:0.7, flatShading:true });
  const visor = new THREE.MeshBasicMaterial({ color:0xffa63d });
  const l1 = new THREE.Mesh(new THREE.CylinderGeometry(0.11,0.12,0.8,6), dark); l1.position.set(-0.15,0.4,0);
  const l2 = l1.clone(); l2.position.x=0.15;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55,0.7,0.36), armor); torso.position.y=1.15; torso.castShadow=true;
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.6,0.3,0.42), dark); vest.position.y=1.2;
  const a1 = new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.09,0.6,6), armor); a1.position.set(-0.36,1.15,0.1); a1.rotation.x=-1.1;
  const a2 = a1.clone(); a2.position.x=0.36;
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.21,9,7), armor); helm.position.y=1.72; helm.castShadow=true;
  const vis = new THREE.Mesh(new THREE.BoxGeometry(0.26,0.09,0.06), visor); vis.position.set(0,1.72,0.18);
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.4,0.5,0.2), dark); pack.position.set(0,1.2,-0.28);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08,0.1,0.7), dark); gun.position.set(0.3,1.25,-0.35);
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.05,0.05,0.05), visor); lamp.position.set(0.3,1.32,-0.35);
  g.add(l1,l2,torso,vest,a1,a2,helm,vis,pack,gun,lamp);
  g.userData.aimY = 1.25;
  return g;
}
function spawnAllies(n){
  // clear old squad
  for(const a of allies) scene.remove(a.mesh);
  allies.length = 0;
  wantedAllies = n;
  for(let i=0;i<n;i++){
    const mesh = buildMarine();
    const back = 2.5+i*1.2, side = (i%2===0?-1:1)*1.8;
    const x = player.pos.x + Math.sin(player.yaw)*back + Math.cos(player.yaw)*side;
    const z = player.pos.z + Math.cos(player.yaw)*back - Math.sin(player.yaw)*side;
    mesh.position.set(x, groundH(x,z), z);
    scene.add(mesh);
    allies.push({ mesh, name:ALLY_NAMES[i%ALLY_NAMES.length], hp:160, maxhp:160,
      alive:true, atkT:1+Math.random(), bob:Math.random()*6, deathT:0 });
  }
  updateHUD();
}
function refillAllies(){
  const alive = allies.filter(a=>a.alive).length;
  if(alive<wantedAllies && wantedAllies>0){
    // rally: the squad regroups beside you between fights
    spawnAllies(wantedAllies);
    feed('✚ SQUAD RALLIED · '+wantedAllies+' TROOPERS');
  }
}
function damageAlly(a, dmg){
  if(!a.alive) return;
  a.hp -= dmg;
  if(a.hp<=0){
    a.hp=0; a.alive=false; a.deathT=0;
    feed('✚ '+a.name+' IS DOWN');
    burst(new THREE.Vector3(a.mesh.position.x, a.mesh.position.y+1.2, a.mesh.position.z), 0xff6655, 12, 5, 4);
    AudioSys.hurt();
    updateHUD();
  }
}
// enemies shoot the nearest threat: you or a trooper
function pickTarget(fromPos){
  let best = { pos: player.pos, ally: null, d: player.alive ? fromPos.distanceToSquared(player.pos) : Infinity, alive: player.alive };
  for(const a of allies){
    if(!a.alive) continue;
    const d = fromPos.distanceToSquared(a.mesh.position);
    if(d < best.d) best = { pos: a.mesh.position, ally: a, d, alive: true };
  }
  return best;
}
function hurtTarget(dmg, ally){
  if(ally) damageAlly(ally, dmg);
  else damagePlayer(dmg);
}
function updateAllies(dt){
  const fwdX = -Math.sin(player.yaw), fwdZ = -Math.cos(player.yaw);
  const rightX = Math.cos(player.yaw), rightZ = -Math.sin(player.yaw);
  for(let i=0;i<allies.length;i++){
    const a = allies[i];
    if(!a.alive){
      a.deathT+=dt;
      a.mesh.rotation.x = Math.min(Math.PI/2, a.deathT*3);
      if(a.deathT>5) a.mesh.visible=false;
      continue;
    }
    // formation slot behind player
    const lat = (i%2===0?-1:1)*Math.ceil((i+1)/2)*1.7;
    const tx = player.pos.x - fwdX*3 + rightX*lat;
    const tz = player.pos.z - fwdZ*3 + rightZ*lat;
    const dx = tx-a.mesh.position.x, dz = tz-a.mesh.position.z;
    const dd = Math.hypot(dx,dz);
    let moving = false;
    if(dd>1.2){
      const sp = Math.min(6.5, dd*2)*dt;
      let nx = a.mesh.position.x+dx/dd*sp, nz = a.mesh.position.z+dz/dd*sp;
      [nx,nz] = collide(nx,nz);
      a.mesh.position.x=nx; a.mesh.position.z=nz;
      moving = true;
    }
    a.mesh.position.y = groundH(a.mesh.position.x, a.mesh.position.z);
    // acquire nearest enemy
    let best=null, bd=48*48;
    for(const e of enemies){
      if(e.dead>0) continue;
      const d2 = a.mesh.position.distanceToSquared(e.mesh.position);
      if(d2<bd){ bd=d2; best=e; }
    }
    if(best){
      tmpV.subVectors(best.mesh.position, a.mesh.position);
      a.mesh.rotation.y = Math.atan2(tmpV.x, tmpV.z);
      a.atkT-=dt;
      if(a.atkT<=0 && bd<46*46){
        a.atkT = 0.9+Math.random()*0.6;
        const from = new THREE.Vector3(a.mesh.position.x, a.mesh.position.y+1.35, a.mesh.position.z);
        const aim = new THREE.Vector3(best.mesh.position.x, aimH(best), best.mesh.position.z).sub(from);
        const dist = aim.length(); aim.normalize();
        if(dist>4){ // too close: hold fire
          aim.x+=(Math.random()-0.5)*0.05; aim.y+=(Math.random()-0.5)*0.03; aim.normalize();
          fireTracer(from, from.clone().addScaledVector(aim, dist), 0x7dffd4);
          AudioSys.blip(640,0.06,'square',0.1,-200);
          if(Math.random()<0.72) damageEnemy(best, 9, false, new THREE.Vector3(best.mesh.position.x, aimH(best), best.mesh.position.z));
          else burst(new THREE.Vector3(best.mesh.position.x, aimH(best), best.mesh.position.z), 0x7dffd4, 3, 2, 2);
        }
      }
    } else if(moving){
      a.mesh.rotation.y = Math.atan2(dx,dz);
    }
    if(moving){ a.bob+=dt*10; a.mesh.position.y+=Math.abs(Math.sin(a.bob))*0.05; }
  }
}

// ================= Operations: 10 missions + endless ridge =================
const rep = (t,n)=>Array(n).fill(t);
const MISSIONS = [
  { name:'FIRST CONTACT', sub:'Wipe out the Krell scouts', env:'day', allies:0, dmgMul:1,
    comp:[...rep('skitter',8)] },
  { name:'SHIELD WALL', sub:'Aegis bearers inbound — flank them', env:'day', allies:0, dmgMul:1,
    comp:[...rep('skitter',8),...rep('aegis',4)] },
  { name:'KNIGHTFALL', sub:'Elite guard holds the ridge', env:'dusk', allies:1, dmgMul:1,
    comp:[...rep('skitter',6),...rep('aegis',2),...rep('knight',2)] },
  { name:'NIGHT OPS', sub:'Hold the ridge in the dark', env:'night', allies:1, dmgMul:1.1,
    comp:[...rep('skitter',8),...rep('aegis',3),...rep('knight',2),...rep('drone',3)] },
  { name:'THE SWARM', sub:'They just keep coming', env:'day', allies:1, dmgMul:1,
    comp:[...rep('skitter',24),...rep('aegis',2)] },
  { name:'LANCE ALLEY', sub:'Snipers on the high ground', env:'dusk', allies:2, dmgMul:1.05,
    comp:[...rep('lancer',4),...rep('skitter',6),...rep('aegis',2)] },
  { name:'CRUSH THE MAULERS', sub:'Big bodies, bigger fists', env:'day', allies:2, dmgMul:1.05,
    comp:[...rep('mauler',4),...rep('skitter',8),...rep('knight',2)] },
  { name:'DRONE STORM', sub:'Fast movers overhead', env:'storm', allies:2, dmgMul:1.1,
    comp:[...rep('drone',14),...rep('aegis',4),...rep('lancer',2)] },
  { name:"WARLORD'S GUARD", sub:'Kill the Krell Warlord', env:'night', allies:3, dmgMul:1.15,
    comp:[...rep('skitter',6),...rep('aegis',4),...rep('knight',3),...rep('warlord',1)] },
  { name:'LAST STAND', sub:'Everything they have. Hold.', env:'storm', allies:3, dmgMul:1.2,
    comp:[...rep('skitter',12),...rep('drone',8),...rep('aegis',5),...rep('knight',4),...rep('mauler',3),...rep('lancer',3),...rep('warlord',1)] },
];
let missionActive=false, missionIdx=-1, missionDef=null, missionTotal=0;
let selectedOp = localStorage.getItem('rp_sel') || 'endless';
let unlockedOps = parseInt(localStorage.getItem('rp_ops')||'1', 10) || 1;
let resumeOnly = false;
function missionProgress(){
  if(!missionActive) return null;
  const left = enemiesToSpawn.length + enemies.filter(e=>e.dead===0).length;
  return { done: missionTotal-left, total: missionTotal };
}
function startMission(i){
  doFieldReset();
  missionActive=true; missionIdx=i; missionDef=MISSIONS[i];
  missionTotal=missionDef.comp.length;
  setEnv(missionDef.env);
  spawnAllies(missionDef.allies);
  // fixed queue: bosses drop in mid-list, rest shuffled
  const bosses = missionDef.comp.filter(t=>t==='warlord');
  const rest = missionDef.comp.filter(t=>t!=='warlord').sort(()=>Math.random()-0.5);
  rest.splice(Math.floor(rest.length/2), 0, ...bosses);
  enemiesToSpawn = rest;
  waveState='active'; spawnT=1.0; wave=i+1;
  $('wavenum').textContent = 'M'+(i+1);
  $('wavetitle').textContent = 'M'+(i+1)+' · '+missionDef.name;
  $('wavesub').textContent = missionDef.sub.toUpperCase();
  const wb=$('wavebanner'); wb.classList.add('show');
  setTimeout(()=>wb.classList.remove('show'), 2600);
  AudioSys.wave();
  weapons[0].mag=weapons[0].magSize; weapons[0].reserve=224;
  weapons[1].mag=weapons[1].magSize;
  player.nades=3+Math.min(1,missionDef.allies);
  updateHUD();
}
function completeMission(){
  missionActive=false;
  const bonus = 500*(missionIdx+1);
  player.score+=bonus;
  feed('★ MISSION COMPLETE · +'+bonus);
  AudioSys.wave(); setTimeout(()=>AudioSys.wave(),300);
  if(missionIdx+2>unlockedOps && missionIdx<9){
    unlockedOps=missionIdx+2;
    localStorage.setItem('rp_ops', String(unlockedOps));
  }
  waveState='done';
  wave=0;
  renderOps(); refreshPlayBtn();
  const wb=$('wavebanner');
  $('wavetitle').textContent='MISSION COMPLETE';
  $('wavesub').textContent='+'+bonus+' PTS · NEXT OP UNLOCKED';
  wb.classList.add('show');
  setTimeout(()=>{ wb.classList.remove('show'); showMenu(false,false); }, 2600);
  updateHUD();
}
function renderOps(){
  const box=$('ops'); if(!box) return;
  box.innerHTML='';
  const mk=(label,sub,locked,sel,cb,done)=>{
    const b=document.createElement('button');
    b.className='opbtn'+(locked?' locked':'')+(sel?' sel':'');
    b.innerHTML=(done?'<span class="done">✔</span>':'')+'<b>'+label+'</b><span>'+sub+'</span>';
    if(!locked) b.addEventListener('click',()=>{ AudioSys.init(); AudioSys.click(); cb(); });
    box.appendChild(b);
  };
  mk('∞ ENDLESS','Classic ridge defense',false,selectedOp==='endless',()=>{
    selectedOp='endless'; localStorage.setItem('rp_sel','endless'); renderOps(); refreshPlayBtn();
  },false);
  MISSIONS.forEach((m,i)=>{
    const locked = (i+1)>unlockedOps;
    const done = (i+1)<unlockedOps;
    mk('M'+(i+1)+' · '+m.name, m.sub+(m.allies?' · ✚'+m.allies:''), locked, selectedOp===String(i), ()=>{
      selectedOp=String(i); localStorage.setItem('rp_sel',selectedOp); renderOps(); refreshPlayBtn();
    }, done);
  });
}
function opLabel(){
  if(selectedOp==='endless') return null;
  const m=MISSIONS[parseInt(selectedOp,10)];
  return 'M'+(parseInt(selectedOp,10)+1)+' · '+m.name;
}
function refreshPlayBtn(){
  const ol = opLabel();
  $('play').innerHTML = ol ? ('▶ &nbsp;START '+ol) : '▶ &nbsp;DEPLOY · ENDLESS';
}
// ================= Waves (endless mode) =================
let wave = 0, waveState = 'menu', wavePauseT = 0, enemiesToSpawn = [], spawnT = 0;
// shared reset: fresh body, full kit, empty field (keeps score/kills)
function doFieldReset(){
  player.alive=true; player.health=player.healthMax; player.shield=player.shieldMax;
  player.pos.set(0,0,26); player.pos.y=groundH(0,26)+player.height;
  player.yaw=0; player.pitch=0; player.vy=0; player.grounded=true;
  player.crouched=false; player.sliding=false; player.slideT=0;
  player.heightCur=1.7; player.landDip=0; player.recoilP=0; player.recoilY=0; player.bloom=0;
  weapons[0].mag=weapons[0].magSize; weapons[0].reserve=Math.max(weapons[0].reserve,128);
  weapons[1].mag=weapons[1].magSize;
  for(const e of enemies) enemyGroup.remove(e.mesh);
  enemies.length=0; enemiesToSpawn.length=0;
}
function startWave(n){
  wave = n; waveState='active'; enemiesToSpawn=[];
  missionActive=false; missionIdx=-1; missionDef=null;
  if(n===1){ setEnv('day'); spawnAllies(2); }
  else refillAllies();
  const comp = [];
  const knights = Math.min(1+Math.floor(n/2), 6);
  const aegis = Math.min(Math.floor(n/1.5), 5);
  const skitters = 3 + n*2;
  for(let i=0;i<skitters;i++) comp.push('skitter');
  for(let i=0;i<aegis;i++) comp.push('aegis');
  for(let i=0;i<knights;i++) comp.push('knight');
  // shuffle
  comp.sort(()=>Math.random()-0.5);
  enemiesToSpawn = comp;
  spawnT = 0.5;
  $('wavenum').textContent = 'WAVE '+n;
  $('wavetitle').textContent = 'WAVE '+n;
  $('wavesub').textContent = n===1 ? 'HOLD THE RIDGE' : comp.length+' HOSTILES INBOUND';
  const wb=$('wavebanner'); wb.classList.add('show');
  setTimeout(()=>wb.classList.remove('show'), 2400);
  AudioSys.wave();
  // resupply a bit
  weapons[0].reserve = Math.min(448, weapons[0].reserve + 64);
  weapons[1].mag = weapons[1].magSize;
  player.nades = Math.min(4, player.nades+1);
  updateHUD();
}

// ================= Input: keyboard/mouse + iOS touch =================
const keys = {};
let sens = 1.0;
$('sens').addEventListener('input', e=>{ sens=parseFloat(e.target.value); $('sensval').textContent=sens.toFixed(1); });
addEventListener('keydown', e=>{ keys[e.code]=true; if(e.code==='KeyR') startReload(); if(e.code==='KeyQ') swapWeapon();
  if(e.code==='KeyF'||e.code==='KeyE') throwNade();
  if(e.code==='KeyC'||e.code==='ControlLeft') pressCrouch(); });
addEventListener('keyup', e=>{ keys[e.code]=false; });
let pointerLocked=false;
canvas.addEventListener('click', ()=>{
  AudioSys.init();
  if(!isTouch && playing && canvas.requestPointerLock) canvas.requestPointerLock();
});
document.addEventListener('pointerlockchange', ()=>{ pointerLocked = document.pointerLockElement===canvas; });
addEventListener('mousemove', e=>{
  if(!pointerLocked || !playing) return;
  const s = 0.0022*sens*(player.aiming?0.5:1);
  player.yaw -= e.movementX*s; player.pitch -= e.movementY*s;
  player.pitch = THREE.MathUtils.clamp(player.pitch,-1.45,1.45);
});
addEventListener('mousedown', e=>{
  if(!playing) return;
  if(e.button===0 && (pointerLocked||isTouch)) mouseDown=true;
  if(e.button===2) mouseAim=true;
});
addEventListener('mouseup', e=>{ if(e.button===0) mouseDown=false; if(e.button===2) mouseAim=false; });
addEventListener('contextmenu', e=>e.preventDefault());

const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints>0;
if(isTouch){ $('touch').classList.add('on'); }
function vibrate(ms){ if(typeof TPAD!=='undefined' && !TPAD.haptics) return; try{ navigator.vibrate && navigator.vibrate(ms); }catch(e){} }

// joystick
const stick=$('stick'), nub=$('nub');
let stickId=null, stickVec={x:0,y:0};
function stickCenter(){ const r=stick.getBoundingClientRect(); return {x:r.left+r.width/2, y:r.top+r.height/2, rad:r.width/2}; }
stick.addEventListener('touchstart', e=>{ e.preventDefault(); AudioSys.init(); stickId=e.changedTouches[0].identifier; }, {passive:false});
addEventListener('touchmove', e=>{
  for(const t of e.changedTouches){
    if(t.identifier===stickId){
      const c=stickCenter();
      let dx=(t.clientX-c.x)/c.rad, dy=(t.clientY-c.y)/c.rad;
      const l=Math.hypot(dx,dy); if(l>1){ dx/=l; dy/=l; }
      stickVec.x=dx; stickVec.y=dy;
      nub.style.transform=`translate(${dx*36}px,${dy*36}px)`;
    }
  }
  // look
  for(const t of e.changedTouches){
    if(t.identifier===lookId){
      const dx=t.clientX-lookLast.x, dy=t.clientY-lookLast.y;
      lookLast.x=t.clientX; lookLast.y=t.clientY;
      const s=0.0042*sens*(typeof touchLookMul==='undefined'?1:touchLookMul)*(player.aiming?0.5:1);
      player.yaw-=dx*s; player.pitch-=dy*s;
      player.pitch=THREE.MathUtils.clamp(player.pitch,-1.45,1.45);
    }
    // floating FIRE: drag the held fire button to aim while shooting
    if(t.identifier===fireTouchId){
      const dx=t.clientX-fireLast.x, dy=t.clientY-fireLast.y;
      fireLast.x=t.clientX; fireLast.y=t.clientY;
      const fs=0.0042*sens*(typeof touchLookMul==='undefined'?1:touchLookMul)*(player.aiming?0.5:1);
      player.yaw-=dx*fs; player.pitch-=dy*fs;
      player.pitch=THREE.MathUtils.clamp(player.pitch,-1.45,1.45);
      const bx=t.clientX-fireBase.x, by=t.clientY-fireBase.y;
      const bl=Math.hypot(bx,by)||1, cl=Math.min(bl,70);
      $('btnFire').style.transform=`translate(${(bx/bl*cl).toFixed(1)}px,${(by/bl*cl).toFixed(1)}px)`;
    }
  }
}, {passive:false});
addEventListener('touchend', e=>{
  for(const t of e.changedTouches){
    if(t.identifier===stickId){ stickId=null; stickVec.x=stickVec.y=0; nub.style.transform=''; }
    if(t.identifier===lookId) lookId=null;
    if(t.identifier===fireTouchId) releaseFire();
  }
});
addEventListener('touchcancel', e=>{
  for(const t of e.changedTouches){
    if(t.identifier===fireTouchId) releaseFire();
  }
});
let fireTouchId=null, fireLast={x:0,y:0}, fireBase={x:0,y:0};
function releaseFire(){
  fireTouchId=null; touchDown=false;
  const f=$('btnFire'); if(f) f.style.transform='';
}
let lookId=null, lookLast={x:0,y:0};
$('lookpad').addEventListener('touchstart', e=>{ e.preventDefault(); AudioSys.init();
  const t=e.changedTouches[0]; lookId=t.identifier; lookLast.x=t.clientX; lookLast.y=t.clientY; }, {passive:false});
function bindBtn(id, down, up){
  const el=$(id);
  el.addEventListener('touchstart', e=>{ e.preventDefault(); e.stopPropagation(); AudioSys.init(); down(); }, {passive:false});
  el.addEventListener('touchend', e=>{ e.preventDefault(); up&&up(); }, {passive:false});
  el.addEventListener('mousedown', e=>{ e.preventDefault(); down(); });
  el.addEventListener('mouseup', ()=>{ up&&up(); });
}
// FIRE doubles as an aim trackpad: hold to shoot, drag to aim one-thumb
$('btnFire').addEventListener('touchstart', e=>{
  if(typeof TEDIT!=='undefined' && TEDIT.on) return;
  e.preventDefault(); e.stopPropagation(); AudioSys.init();
  const t=e.changedTouches[0];
  touchDown=true; fireTouchId=t.identifier; fireLast={x:t.clientX,y:t.clientY};
  const r=$('btnFire').getBoundingClientRect();
  fireBase={x:r.left+r.width/2, y:r.top+r.height/2};
}, {passive:false});
$('btnFire').addEventListener('touchend', e=>{ e.preventDefault(); releaseFire(); }, {passive:false});
$('btnFire').addEventListener('mousedown', e=>{ e.preventDefault(); touchDown=true; });
$('btnFire').addEventListener('mouseup', ()=>{ touchDown=false; });
bindBtn('btnAim', ()=>{ touchAim=true; }, ()=>{ touchAim=false; });
bindBtn('btnJump', ()=>{ doJump(); });
bindBtn('btnCrouch', ()=>{ pressCrouch(); });
bindBtn('btnReload', ()=>{ startReload(); });
bindBtn('btnSwap', ()=>{ swapWeapon(); });
bindBtn('btnNade', ()=>{ throwNade(); });
// prevent iOS double-tap zoom / scroll
document.addEventListener('gesturestart', e=>e.preventDefault());
document.addEventListener('dblclick', e=>e.preventDefault(), {passive:false});
let lastTouchEnd=0;
document.addEventListener('touchend', e=>{ const n=Date.now(); if(n-lastTouchEnd<300) e.preventDefault(); lastTouchEnd=n; }, {passive:false});

// ================= Customizable touch gamepad =================
// Modern mobile layout: presets, scaling, opacity, drag-to-move editor,
// all persisted to localStorage. Positions are fractions of the touch layer.
const TPAD = { preset:'default', scale:1, opa:0.85, stick:1, look:1,
  showNade:true, haptics:true, autosprint:true, custom:{} };
let touchLookMul = 1;
try{ const s=JSON.parse(localStorage.getItem('rp_tpad')||'null'); if(s) Object.assign(TPAD,s); }catch(e){}
function saveTPAD(){ try{ localStorage.setItem('rp_tpad', JSON.stringify(TPAD)); }catch(e){} }
const TPAD_PRESETS = {
  default:{ stick:[0.10,0.80], btnFire:[0.885,0.70], btnAim:[0.80,0.60], btnJump:[0.795,0.79],
    btnReload:[0.865,0.52], btnSwap:[0.79,0.47], btnNade:[0.685,0.72], btnCrouch:[0.615,0.80] },
  lefty:{ stick:[0.90,0.80], btnFire:[0.115,0.70], btnAim:[0.20,0.60], btnJump:[0.205,0.79],
    btnReload:[0.135,0.52], btnSwap:[0.21,0.47], btnNade:[0.315,0.72], btnCrouch:[0.385,0.80] },
  claw:{ stick:[0.10,0.80], btnFire:[0.90,0.64], btnAim:[0.79,0.54], btnJump:[0.79,0.80],
    btnReload:[0.865,0.46], btnSwap:[0.775,0.41], btnNade:[0.66,0.68], btnCrouch:[0.70,0.87] },
};
const TPAD_SIZE = { stick:128, btnFire:96, btnAim:58, btnJump:62, btnReload:54, btnSwap:54, btnNade:54, btnCrouch:54 };
const TPAD_IDS = ['stick','btnFire','btnAim','btnJump','btnReload','btnSwap','btnNade','btnCrouch'];
function applyTouchLayout(){
  const P = TPAD_PRESETS[TPAD.preset] || TPAD_PRESETS.default;
  for(const id of TPAD_IDS){
    const el=$(id); if(!el) continue;
    const c = (TPAD.custom&&TPAD.custom[id]) || P[id];
    const base = TPAD_SIZE[id]||56;
    const mult = (id==='stick'?TPAD.stick:TPAD.scale);
    const s = Math.round(base*mult);
    el.style.left=(c[0]*100)+'%'; el.style.top=(c[1]*100)+'%';
    el.style.width=s+'px'; el.style.height=s+'px';
    el.style.marginLeft=(-s/2)+'px'; el.style.marginTop=(-s/2)+'px';
    el.style.right='auto'; el.style.bottom='auto';
    if(id!=='stick'){
      el.style.fontSize = s>80?'15px':(s>60?'11px':'10px');
      el.style.opacity = TPAD.opa;
    } else {
      el.style.opacity = Math.min(1,TPAD.opa+0.1);
    }
    if(id==='btnNade') el.style.display = TPAD.showNade?'flex':'none';
  }
  // nub follows stick size
  const ns = Math.round(56*(TPAD_IDS?TPAD.stick:1));
  nub.style.width=ns+'px'; nub.style.height=ns+'px';
  nub.style.marginLeft=(-ns/2)+'px'; nub.style.marginTop=(-ns/2)+'px';
  // left-handed preset mirrors the look area
  const lp=$('lookpad');
  if(TPAD.preset==='lefty'){ lp.style.left='0'; lp.style.right='auto'; }
  else { lp.style.right='0'; lp.style.left='auto'; }
}
const TEDIT = { on:false, drag:null };
function setEdit(on){
  TEDIT.on=on; TEDIT.drag=null;
  $('padeditbar').classList.toggle('on',on);
  if(on) $('tpadpanel').classList.remove('on');
  saveTPAD();
}
for(const id of TPAD_IDS){
  const el=$(id); if(!el) continue;
  el.style.touchAction='none';
  el.addEventListener('pointerdown', e=>{
    if(!TEDIT.on) return;
    e.preventDefault(); e.stopPropagation();
    try{ el.setPointerCapture(e.pointerId); }catch(err){}
    TEDIT.drag={ id };
  });
  el.addEventListener('pointermove', e=>{
    if(!TEDIT.on || !TEDIT.drag || TEDIT.drag.id!==id) return;
    e.preventDefault();
    const r=$('touch').getBoundingClientRect();
    const x=THREE.MathUtils.clamp((e.clientX-r.left)/r.width,0.03,0.97);
    const y=THREE.MathUtils.clamp((e.clientY-r.top)/r.height,0.06,0.94);
    TPAD.custom[id]=[+x.toFixed(3),+y.toFixed(3)];
    el.style.left=(x*100)+'%'; el.style.top=(y*100)+'%';
  });
  const endDrag = ()=>{
    if(TEDIT.drag && TEDIT.drag.id===id){ TEDIT.drag=null; saveTPAD(); }
  };
  el.addEventListener('pointerup', endDrag);
  el.addEventListener('pointercancel', endDrag);
}
function syncTPADPanel(){
  $('tpreset').value=TPAD.preset;
  $('tsize').value=TPAD.scale; $('tsizev').textContent=Math.round(TPAD.scale*100)+'%';
  $('topa').value=TPAD.opa; $('topav').textContent=Math.round(TPAD.opa*100)+'%';
  $('tstk').value=TPAD.stick; $('tstkv').textContent=Math.round(TPAD.stick*100)+'%';
  $('tls').value=touchLookMul; $('tlsv').textContent=(+touchLookMul).toFixed(1);
  $('tshowsr').checked=TPAD.showNade; $('thap').checked=TPAD.haptics; $('tsprint').checked=TPAD.autosprint;
}
function openTouchSettings(){
  AudioSys.init(); AudioSys.click();
  syncTPADPanel();
  $('tpadpanel').classList.add('on');
  if(playing) paused=true;
}
function closeTouchSettings(){
  $('tpadpanel').classList.remove('on');
  if($('menu').classList.contains('hidden')) paused=false;
  saveTPAD();
}
bindBtn('btnGear', ()=>{ openTouchSettings(); });
$('tpadopen').addEventListener('click', ()=>{ openTouchSettings(); });
$('tclose').addEventListener('click', ()=>{ closeTouchSettings(); });
$('tpreset').addEventListener('change', e=>{ TPAD.preset=e.target.value; TPAD.custom={}; applyTouchLayout(); saveTPAD(); });
$('tsize').addEventListener('input', e=>{ TPAD.scale=parseFloat(e.target.value); $('tsizev').textContent=Math.round(TPAD.scale*100)+'%'; applyTouchLayout(); saveTPAD(); });
$('topa').addEventListener('input', e=>{ TPAD.opa=parseFloat(e.target.value); $('topav').textContent=Math.round(TPAD.opa*100)+'%'; applyTouchLayout(); saveTPAD(); });
$('tstk').addEventListener('input', e=>{ TPAD.stick=parseFloat(e.target.value); $('tstkv').textContent=Math.round(TPAD.stick*100)+'%'; applyTouchLayout(); saveTPAD(); });
$('tls').addEventListener('input', e=>{ touchLookMul=parseFloat(e.target.value); $('tlsv').textContent=touchLookMul.toFixed(1); saveTPAD(); });
$('tshowsr').addEventListener('change', e=>{ TPAD.showNade=e.target.checked; applyTouchLayout(); saveTPAD(); });
$('thap').addEventListener('change', e=>{ TPAD.haptics=e.target.checked; saveTPAD(); });
$('tsprint').addEventListener('change', e=>{ TPAD.autosprint=e.target.checked; saveTPAD(); });
$('tmove').addEventListener('click', ()=>{
  if(playing && player.alive){ showMenu(false,true); feed('⏸ paused — arrange your layout'); }
  setEdit(true);
});
$('treset').addEventListener('click', ()=>{
  TPAD.custom={}; TPAD.scale=1; TPAD.opa=0.85; TPAD.stick=1; TPAD.preset='default';
  applyTouchLayout(); syncTPADPanel(); saveTPAD();
});
$('esave').addEventListener('click', ()=>{ setEdit(false); });
$('eexit').addEventListener('click', ()=>{ TPAD.custom={}; applyTouchLayout(); setEdit(false); });

// ================= Controllers: Xbox / PlayStation / Switch Pro / MFi pads =================
// Uses the Gamepad API. Standard-mapped pads (Xbox, PS4/PS5, Switch Pro, Backbone,
// and iOS-paired Bluetooth controllers) expose: L-stick move, R-stick look, RT fire,
// LT aim, A jump, X reload, Y swap, B/RB grenade, LB swap, L3 sprint, Start pause.
// Non-standard layouts fall back to the same index-based best effort.
const Pad = {
  dz: 0.18,
  prev: [],
};
function getPad(){
  // Virtual test pad for automated verification (no hardware needed):
  // window.__VJOY = { active:true, axes:[lx,ly,rx,ry], buttons:[a,b,x,y,...] }
  if(window.__VJOY && window.__VJOY.active){
    const v = window.__VJOY;
    const ax = v.axes || [0,0,0,0];
    const nb = Math.max(17, (v.buttons||[]).length);
    const bs = [];
    for(let i=0;i<nb;i++){ const b=(v.buttons||[])[i]; bs.push({ pressed:!!b, value:b?1:0 }); }
    return { id:'Virtual Test Pad', mapping:'standard', connected:true, axes:[ax[0]||0,ax[1]||0,ax[2]||0,ax[3]||0], buttons:bs };
  }
  try{
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for(const p of pads){ if(p && p.connected) return p; }
  }catch(e){}
  return null;
}
function dzAxis(v){
  const a = Math.abs(v || 0);
  if(a < Pad.dz) return 0;
  return Math.sign(v) * ((a - Pad.dz) / (1 - Pad.dz));
}
function padBtn(p, i){
  const b = p.buttons && p.buttons[i];
  if(!b) return 0;
  return (typeof b.value === 'number') ? b.value : (b.pressed ? 1 : 0);
}
function padBtnP(p, i){ const b = p.buttons && p.buttons[i]; return !!(b && b.pressed); }
function rumble(weak, strong, dur){
  try{
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for(const p of pads){
      if(p && p.connected && p.vibrationActuator && typeof p.vibrationActuator.playEffect === 'function'){
        p.vibrationActuator.playEffect('dual-rumble',
          { duration: dur || 100, weakMagnitude: weak || 0.2, strongMagnitude: strong || 0.2 })
          .catch(()=>{});
        break;
      }
    }
  }catch(e){}
}
function shortPadName(id){
  id = String(id || 'PAD');
  if(/xbox/i.test(id)) return 'XBOX PAD';
  if(/dualsense/i.test(id)) return 'PLAYSTATION PAD';
  if(/dualshock/i.test(id)) return 'PLAYSTATION PAD';
  if(/0+54c/i.test(id)) return 'PLAYSTATION PAD';
  if(/pro controller|nintendo/i.test(id)) return 'SWITCH PRO';
  if(/0+57e/i.test(id)) return 'SWITCH PRO';
  if(/backbone/i.test(id)) return 'BACKBONE ONE';
  if(/virtual test/i.test(id)) return 'TEST PAD';
  return id.slice(0, 18).toUpperCase();
}
function padShowStatus(id){
  $('padstat').classList.add('on');
  $('padname').textContent = '🎮 ' + shortPadName(id);
}
window.addEventListener('gamepadconnected', (e)=>{
  AudioSys.init();
  padShowStatus(e.gamepad && e.gamepad.id);
  feed('🎮 ' + shortPadName(e.gamepad && e.gamepad.id) + ' connected');
  vibrate(20);
  try{ rumble(0.2, 0.2, 120); }catch(err){}
});
window.addEventListener('gamepaddisconnected', ()=>{
  feed('🎮 Controller disconnected');
  if(!getPad() || (getPad() && getPad()._virtual)) $('padstat').classList.remove('on');
});
// Returns {mx,mz,firing,aiming,sprint} for the player update, or null if no pad.
// inGame=false: only menu navigation (A / Start = DEPLOY).
function pollPad(dt, inGame){
  const p = getPad();
  if(!p){ Pad.prev = []; return null; }
  if(!$('padstat').classList.contains('on')) padShowStatus(p.id);
  const n = Math.max(17, (p.buttons || []).length);
  const prev = Pad.prev || [];
  const cur = [];
  for(let i = 0; i < n; i++) cur.push(padBtnP(p, i));
  const edge = (i) => !!(cur[i] && !prev[i]);
  Pad.prev = cur;
  if(!inGame){
    if(!$('menu').classList.contains('hidden') && (edge(0) || edge(9))){
      AudioSys.init();
      $('play').click();
    }
    return null;
  }
  // --- sticks ---
  let mx = dzAxis(p.axes[0]), mz = dzAxis(p.axes[1]);
  if(padBtnP(p, 14)) mx -= 1; // D-pad fallback (arcade sticks / odd layouts)
  if(padBtnP(p, 15)) mx += 1;
  if(padBtnP(p, 12)) mz -= 1;
  if(padBtnP(p, 13)) mz += 1;
  let rx = dzAxis(p.axes[2]), ry = dzAxis(p.axes[3]);
  rx = rx * Math.abs(rx); ry = ry * Math.abs(ry); // quadratic precision curve
  const firing = padBtn(p, 7) > 0.3; // RT / R2 (analog)
  const aiming = padBtn(p, 6) > 0.25;
  const sprint = padBtnP(p, 10) || (TPAD.autosprint && Math.hypot(mx, mz) > 0.95);
  // --- look ---
  if(playing && player.alive && (rx !== 0 || ry !== 0)){
    const rate = 2.8 * sens * (aiming ? 0.55 : 1) * dt;
    player.yaw -= rx * rate;
    player.pitch += -ry * rate;
    player.pitch = THREE.MathUtils.clamp(player.pitch, -1.45, 1.45);
  }
  // --- edge actions ---
  if(playing && player.alive){
    if(edge(0)) doJump();            // A / Cross
    if(edge(2)) startReload();       // X / Square
    if(edge(3) || edge(4)) swapWeapon(); // Y / Triangle, LB
    if(edge(1) || edge(5)) throwNade();  // B / Circle, RB
    if(edge(11)) pressCrouch();      // R3: crouch / slide
  }
  if(edge(9)){ // Start / Options = pause-resume
    if($('menu').classList.contains('hidden')) showMenu(false, true);
    else $('play').click();
  }
  return { mx, mz, firing, aiming, sprint };
}

// ================= Actions =================
let lastPadIn = null;
function moveWish(){
  let ix=0,iz=0;
  if(keys['KeyW']||keys['ArrowUp']) iz-=1;
  if(keys['KeyS']||keys['ArrowDown']) iz+=1;
  if(keys['KeyA']||keys['ArrowLeft']) ix-=1;
  if(keys['KeyD']||keys['ArrowRight']) ix+=1;
  ix+=stickVec.x; iz+=stickVec.y;
  if(lastPadIn){ ix+=lastPadIn.mx; iz+=lastPadIn.mz; }
  const l=Math.hypot(ix,iz); if(l>1){ ix/=l; iz/=l; }
  return {ix,iz};
}
function doJump(){
  if(!player.alive) return;
  if(player.crouched){ player.crouched=false; } // stand out of crouch
  if(player.sliding){ endSlide(true); } // slide-jump keeps momentum feel
  if(player.grounded || player.coyote>0){ player.vy=5.2; player.grounded=false; player.coyote=0; }
}
function pressCrouch(){
  if(!playing||!player.alive) return;
  if(player.sliding){ endSlide(true); return; }
  const {ix,iz}=moveWish();
  const moving = Math.hypot(ix,iz)>0.3;
  if(!player.crouched && player.sprinting && moving && player.grounded){
    // SLIDE: lock direction, dip low, go fast
    player.sliding=true; player.slideT=0.75; player.crouched=false;
    const sin=Math.sin(player.yaw), cos=Math.cos(player.yaw);
    const wx=(ix*cos + iz*sin), wz=(iz*cos - ix*sin);
    const wl=Math.hypot(wx,wz)||1;
    player.slideDir.set(wx/wl,0,wz/wl);
    AudioSys.slide(); vibrate(15);
    burst(new THREE.Vector3(player.pos.x,player.pos.y-1.2,player.pos.z), 0x9a8a68, 8, 4, 2);
  } else {
    player.crouched=!player.crouched;
    if(player.crouched) player.sprinting=false;
    AudioSys.click();
  }
}
function endSlide(stand){ player.sliding=false; player.slideT=0; if(stand) player.crouched=false; }
function swapWeapon(){
  if(!playing||!player.alive) return;
  curW=(curW+1)%weapons.length; reloadingUntil=0;
  AudioSys.click(); updateHUD();
  // swap viewmodel tint
  vmGroup.children.forEach(o=>{});
}
function startReload(){
  const w=weapons[curW];
  if(reloadingUntil>perfNow()) return;
  if(w.key==='PL'){ // vent heat = instant partial
    if(w.mag<w.magSize){ reloadingUntil=perfNow()+w.reloadT; reloadDur=w.reloadT; AudioSys.reload(); }
    return;
  }
  if(w.mag>=w.magSize||w.reserve<=0) return;
  reloadingUntil=perfNow()+w.reloadT; reloadDur=w.reloadT; AudioSys.reload();
}
function finishReload(){
  const w=weapons[curW];
  if(w.key==='PL'){ w.mag=w.magSize; }
  else { const need=w.magSize-w.mag, take=Math.min(need,w.reserve); w.mag+=take; w.reserve-=take; }
  updateHUD();
}
function throwNade(){
  if(!playing||!player.alive||player.nades<=0) return;
  const n=nades.find(n=>n.life<=0); if(!n) return;
  player.nades--;
  const dir=new THREE.Vector3(); camera.getWorldDirection(dir);
  n.mesh.visible=true;
  n.mesh.position.copy(camera.position).addScaledVector(dir,0.6);
  n.vel.copy(dir).multiplyScalar(14); n.vel.y+=4;
  n.life=2.0;
  AudioSys.blip(300,0.1,'square',0.3);
  updateHUD();
}

// ================= Shooting =================
const ray = new THREE.Raycaster();
const fwdV = new THREE.Vector3(), rightV=new THREE.Vector3();
function shoot(){
  const w=weapons[curW];
  const now=perfNow();
  const interval=60/w.rpm;
  if(now-lastShot<interval) return;
  if(reloadingUntil>now) return;
  if(w.mag<=0){ AudioSys.click(); startReload(); return; }
  lastShot=now; w.mag--;
  if(now-lastRumble>0.25){ lastRumble=now; rumble(0.15,0.1,60); }
  AudioSys.init();
  // heat bloom + stance affect spread (sustained fire walks shots, crouch steadies)
  const effSpread = w.spread*(1+player.bloom*1.6)*(player.crouched?0.7:1)*(player.sliding?1.5:1);
  if(w.plasma){
    AudioSys.plasma();
    const dir=new THREE.Vector3(); camera.getWorldDirection(dir);
    dir.x+=(Math.random()-0.5)*effSpread*2; dir.y+=(Math.random()-0.5)*effSpread*2; dir.normalize();
    const from=camera.position.clone().addScaledVector(dir,0.8);
    from.y-=0.15;
    fireBolt(from,dir,42,w.dmg,false,0x66eaff);
    muzzle.color.setHex(0x66eaff); muzzle.intensity=6;
  } else {
    AudioSys.shoot();
    // raycast with spread
    const dir=new THREE.Vector3(); camera.getWorldDirection(dir);
    dir.x+=(Math.random()-0.5)*effSpread*2; dir.y+=(Math.random()-0.5)*effSpread*2; dir.z+=(Math.random()-0.5)*effSpread*2;
    dir.normalize();
    ray.set(camera.position, dir);
    ray.far=w.range;
    if(!ray.camera) ray.camera = camera; // required for Sprite raycast; we exclude bars below anyway
    const meshes=[];
    for(const e of enemies){ if(e.dead!==0) continue; e.mesh.traverse(o=>{ if(o.isMesh) meshes.push(o); }); }
    const hits=ray.intersectObjects(meshes,false);
    let end=camera.position.clone().addScaledVector(dir,w.range);
    window.__LASTSHOT={ hits:hits.length, meshes:meshes.length, dir:[+dir.x.toFixed(3),+dir.y.toFixed(3),+dir.z.toFixed(3)],
      from:[+camera.position.x.toFixed(1),+camera.position.y.toFixed(1),+camera.position.z.toFixed(1)],
      first: hits.length?{ d:+hits[0].distance.toFixed(1), p:[+hits[0].point.x.toFixed(1),+hits[0].point.y.toFixed(1),+hits[0].point.z.toFixed(1)] }:null };
    if(hits.length){
      const h=hits[0];
      end=h.point.clone();
      // find enemy root
      let o=h.object, root=null;
      while(o){ if(enemies.some(e=>e.mesh===o)){ root=enemies.find(e=>e.mesh===o); break; } o=o.parent; }
      if(root){
        const headY=root.mesh.userData.headY||1.5;
        const localY=h.point.y-root.mesh.position.y;
        const isHead = localY>headY-0.25;
        damageEnemy(root, w.dmg*(isHead?w.headMul:1)/(isHead?1:1), isHead, h.point);
        // note: damageEnemy applies headMul again for non-plasma path? keep consistent:
      }
    }
    // impact puff on terrain
    fireTracer(muzzleWorld(), end, w.tracer);
    muzzle.color.setHex(0xffd9a0); muzzle.intensity=8;
    if(hits.length) burst(end, 0xffcc88, 4, 3, 2);
  }
  // recoverable recoil kick + heat bloom + muzzle smoke
  player.recoilP+=w.kick; player.recoilY+=(Math.random()-0.5)*w.kick*0.5;
  player.bloom=Math.min(1,player.bloom+0.13);
  smokePuff(muzzleWorld());
  const fl=vmGroup.getObjectByName('flash');
  if(fl){ fl.material.opacity=0.9; }
  vmGroup.position.z=0.06; // recoil
  vibrate(8);
  if(w.mag===0) startReload();
  updateHUD();
}
const _mw=new THREE.Vector3();
function muzzleWorld(){ muzzle.getWorldPosition(_mw); return _mw.clone(); }
function damagePlayer(dmg){
  if(!player.alive||!playing) return;
  if(missionActive && missionDef) dmg *= (missionDef.dmgMul||1);
  const now=perfNow();
  player.lastDamage=now;
  if(player.shield>0){
    player.shield-=dmg;
    if(player.shield<0){ player.health+=player.shield; player.shield=0; }
  } else player.health-=dmg;
  $('dmg').style.opacity=0.9;
  setTimeout(()=>$('dmg').style.opacity=0,180);
  AudioSys.hurt(); vibrate(40); rumble(0.5,0.6,200);
  if(player.health<=0){ playerDie(); }
  updateHUD();
}
function playerDie(){
  player.alive=false; player.health=0;
  feed('☠ YOU FELL — tap DEPLOY to retry the wave');
  AudioSys.boom();
  setTimeout(()=>{ showMenu(true); }, 1200);
}

// ================= HUD =================
function updateHUD(){
  const w=weapons[curW];
  $('shieldfill').style.width=(100*player.shield/player.shieldMax)+'%';
  $('healthfill').style.width=(100*Math.max(0,player.health)/player.healthMax)+'%';
  $('score').textContent=player.score; $('kills').textContent=player.kills;
  $('left').textContent=enemies.filter(e=>e.dead===0).length+enemiesToSpawn.length;
  $('ammo').innerHTML = w.key==='PL'
    ? `${Math.ceil(w.mag)} <small>/ ∞ HEAT</small>`
    : `${w.mag} <small>/ ${w.reserve}</small>`;
  $('wname').textContent=w.name+(player.nades>0?` · ✸${player.nades}`:' · ✸0');
  // objective line
  const mp = missionActive ? missionProgress() : null;
  if(mp && missionDef) $('objline').textContent = `M${missionIdx+1} · ${missionDef.name} — ${mp.done}/${mp.total}`;
  else if(wave>0) $('objline').textContent = `ENDLESS · WAVE ${wave} — HOLD THE RIDGE`;
  else $('objline').textContent = '';
  // ally pips
  const ab=$('allybox');
  if(ab){
    ab.innerHTML='';
    for(const a of allies){
      const d=document.createElement('div');
      d.className='apip'+(a.alive?'':' down');
      const pct=Math.max(0,Math.round(100*a.hp/a.maxhp));
      d.innerHTML=`✚ ${a.name}<span class="ab"><div style="width:${pct}%"></div></span>`;
      ab.appendChild(d);
    }
  }
}
function feed(msg){
  const d=document.createElement('div'); d.textContent=msg;
  const kf=$('killfeed'); kf.prepend(d);
  while(kf.children.length>4) kf.lastChild.remove();
  setTimeout(()=>{ d.style.opacity='0'; setTimeout(()=>d.remove(),400); }, 3200);
}
let hmT=null;
let lastRumble = -99;
function hitmarker(){
  const h=$('hitmarker'); h.classList.add('show');
  clearTimeout(hmT); hmT=setTimeout(()=>h.classList.remove('show'),90);
}
// Radar
const radar=$('radar'), rctx=radar.getContext('2d');
function drawRadar(){
  const W=radar.width,H=radar.height,cx=W/2,cy=H/2,R=W/2-8;
  rctx.clearRect(0,0,W,H);
  rctx.strokeStyle='rgba(87,230,255,0.35)';
  rctx.beginPath(); rctx.arc(cx,cy,R,0,7); rctx.stroke();
  rctx.beginPath(); rctx.arc(cx,cy,R*0.5,0,7); rctx.stroke();
  const range=60;
  const RCOL = { knight:'#ff5c5c', aegis:'#ffb347', drone:'#c9a6ff', mauler:'#ff6655',
    lancer:'#ffd24d', warlord:'#ff4d6e' };
  rctx.save(); rctx.translate(cx,cy); rctx.rotate(player.yaw);
  for(const e of enemies){
    if(e.dead>0) continue;
    const dx=e.mesh.position.x-player.pos.x, dz=e.mesh.position.z-player.pos.z;
    const d=Math.hypot(dx,dz); if(d>range) continue;
    const sx=dx/range*R, sy=dz/range*R;
    rctx.fillStyle = RCOL[e.type] || '#ffe14d';
    rctx.beginPath(); rctx.arc(sx,sy,e.t.boss?7:(e.type==='knight'?6:4.5),0,7); rctx.fill();
  }
  // allies (green squares)
  rctx.fillStyle='#5dff8a';
  for(const a of allies){
    if(!a.alive) continue;
    const dx=a.mesh.position.x-player.pos.x, dz=a.mesh.position.z-player.pos.z;
    const d=Math.hypot(dx,dz); if(d>range) continue;
    rctx.fillRect(dx/range*R-3.5,dz/range*R-3.5,7,7);
  }
  // crates
  rctx.fillStyle='#7dff9a';
  for(const c of crates){
    const dx=c.position.x-player.pos.x, dz=c.position.z-player.pos.z;
    const d=Math.hypot(dx,dz); if(d>range) continue;
    rctx.fillRect(dx/range*R-3,dz/range*R-3,6,6);
  }
  // enterable outposts (rotated footprints)
  rctx.strokeStyle='rgba(170,190,210,0.65)'; rctx.lineWidth=2;
  for(const o of OUTPOST_RECTS){
    const dx=o.x-player.pos.x, dz=o.z-player.pos.z;
    if(Math.hypot(dx,dz)>range+8) continue;
    rctx.save(); rctx.translate(dx/range*R, dz/range*R); rctx.rotate(-o.ry);
    rctx.strokeRect(-o.w/2/range*R, -o.d/2/range*R, o.w/range*R, o.d/range*R);
    rctx.restore();
  }
  rctx.restore();
  // player wedge
  rctx.fillStyle='#fff';
  rctx.beginPath(); rctx.moveTo(cx,cy-8); rctx.lineTo(cx-5,cy+5); rctx.lineTo(cx+5,cy+5); rctx.closePath(); rctx.fill();
}

// ================= Loop =================
function perfNow(){ return performance.now()/1000; }
const clock = new THREE.Clock();
let playing=false, sceneReady=false, paused=false;
const tmpV=new THREE.Vector3(), tmpV2=new THREE.Vector3();

function collideCircle(px,pz,rad){
  for(const c of colliders){
    const dx=px-c.x, dz=pz-c.z, d=Math.hypot(dx,dz);
    if(d<c.r+rad && d>0.001){
      const push=(c.r+rad-d);
      px+=dx/d*push; pz+=dz/d*push;
    }
  }
  return [px,pz];
}
function collideSeg(px,pz,rad){
  for(const s of segColliders){
    const abx=s.bx-s.ax, abz=s.bz-s.az;
    const len2=abx*abx+abz*abz || 1;
    let t=((px-s.ax)*abx+(pz-s.az)*abz)/len2;
    t=THREE.MathUtils.clamp(t,0,1);
    const cx=s.ax+abx*t, cz=s.az+abz*t;
    const dx=px-cx, dz=pz-cz, d=Math.hypot(dx,dz);
    if(d<s.r+rad){
      if(d>0.001){ const push=(s.r+rad-d); px+=dx/d*push; pz+=dz/d*push; }
      else { px+= (s.r+rad); }
    }
  }
  return [px,pz];
}
function collide(px,pz){
  [px,pz]=collideCircle(px,pz,player.radius);
  [px,pz]=collideSeg(px,pz,player.radius);
  const rr=Math.hypot(px,pz);
  if(rr>ARENA){ px*=ARENA/rr; pz*=ARENA/rr; }
  return [px,pz];
}
function collideEnemy(nx,nz,rad){
  [nx,nz]=collideCircle(nx,nz,rad);
  [nx,nz]=collideSeg(nx,nz,rad);
  return [nx,nz];
}

function updatePlayer(dt){
  const now=perfNow();
  // shield regen (Halo rule: 4s no damage)
  if(now-player.lastDamage>4 && player.shield<player.shieldMax){
    const wasLow = player.shield < player.shieldMax - 1;
    player.shield=Math.min(player.shieldMax, player.shield+22*dt);
    if(wasLow && player.shield>=player.shieldMax-0.5){
      $('heal').style.opacity=1; setTimeout(()=>$('heal').style.opacity=0,350);
      AudioSys.shield();
    }
  }
  if(player.health<player.healthMax && now-player.lastDamage>7)
    player.health=Math.min(player.healthMax, player.health+4*dt);

  // move input (keyboard + touch stick + gamepad)
  const padIn = pollPad(dt, true);
  lastPadIn = padIn;
  let {ix,iz} = moveWish();
  const wishMag = Math.hypot(ix,iz);
  const stickMag = Math.hypot(stickVec.x,stickVec.y);
  player.sprinting=((keys['ShiftLeft']||keys['ShiftRight'])&&iz<0)||!!(padIn&&padIn.sprint)
    || (TPAD.autosprint && stickMag>0.95);
  if(player.crouched||player.sliding) player.sprinting=false;
  player.aiming = mouseAim || touchAim || !!(padIn && padIn.aiming);
  if(player.sprinting) player.aiming=false; // can't ADS while sprinting (gun dips)
  triggerHeld = mouseDown || touchDown || !!(padIn && padIn.firing);
  const sin=Math.sin(player.yaw), cos=Math.cos(player.yaw);
  let mx, mz;
  if(player.sliding){
    // slide: locked momentum + slight steering, friction decay
    player.slideT-=dt;
    const k=Math.max(0,player.slideT/0.75);
    const sp=4.5+6.5*k;
    mx=player.slideDir.x*sp*dt + (ix*cos + iz*sin)*sp*0.25*dt;
    mz=player.slideDir.z*sp*dt + (iz*cos - ix*sin)*sp*0.25*dt;
    if(player.slideT<=0) endSlide(false);
    if(Math.random()<dt*20) burst(new THREE.Vector3(player.pos.x,player.pos.y-1.4,player.pos.z), 0x9a8a68, 2, 3, 1.5);
  } else {
    const speed=(player.sprinting?8.6:player.crouched?2.8:5.6)*(player.aiming?0.55:1);
    mx=(ix*cos + iz*sin)*speed*dt;
    mz=(iz*cos - ix*sin)*speed*dt;
  }
  let nx=player.pos.x+mx, nz=player.pos.z+mz;
  [nx,nz]=collide(nx,nz);
  player.pos.x=nx; player.pos.z=nz;
  // stance height (stand / crouch / slide) with smoothing
  const targetH = player.sliding?0.95:(player.crouched?1.15:1.7);
  player.heightCur += (targetH-player.heightCur)*Math.min(1,dt*12);
  // gravity / jump / landing
  const gy=groundH(nx,nz)+player.heightCur;
  if(player.grounded) player.coyote=0.12; else player.coyote-=dt;
  if(!player.grounded){
    player.vy-=12.5*dt; player.pos.y+=player.vy*dt;
    if(player.pos.y<=gy){
      player.pos.y=gy; player.grounded=true;
      const impact=-player.vy; player.vy=0;
      if(impact>3.5){
        player.landDip=Math.min(0.32,impact*0.028);
        AudioSys.land(impact>8);
        if(impact>6) burst(new THREE.Vector3(nx,gy-1.4,nz), 0x9a8a68, 10, 4, 2);
      }
    }
  } else {
    player.pos.y += (gy-player.pos.y)*Math.min(1,dt*12);
  }
  player.landDip*=Math.pow(0.001,dt);
  if(keys['Space']){ doJump(); keys['Space']=false; }
  // footsteps
  const hSpeed=Math.hypot(mx,mz)/Math.max(dt,0.001);
  if(player.grounded && !player.sliding && hSpeed>2.2 && wishMag>0.2){
    player.stepT-=dt*hSpeed;
    if(player.stepT<=0){ player.stepT=2.1; player.stepAlt=!player.stepAlt; AudioSys.step(player.stepAlt); }
  }
  // reload finish
  if(reloadingUntil>0 && now>=reloadingUntil){ reloadingUntil=0; finishReload(); }
  // trigger
  if(triggerHeld) shoot();
  // recoil recovery + bloom decay
  player.recoilP*=Math.pow(0.0005,dt); player.recoilY*=Math.pow(0.0005,dt);
  player.bloom=Math.max(0,player.bloom-dt*2.2);
  // viewmodel: sprint dip, ADS center, reload dip, look sway, bob, recoil
  const t=perfNow();
  vmSprint += ((player.sprinting?1:0)-vmSprint)*Math.min(1,dt*8);
  let rProg=0;
  if(reloadingUntil>0 && reloadDur>0) rProg=THREE.MathUtils.clamp(1-(reloadingUntil-now)/reloadDur,0,1);
  const dip = Math.sin(Math.min(1,rProg)*Math.PI); // 0->1->0 over reload
  // look-velocity sway (lag behind flicks)
  const yv=(player.yaw-player.lastYaw)/Math.max(dt,0.001), pv=(player.pitch-player.lastPitch)/Math.max(dt,0.001);
  player.lastYaw=player.yaw; player.lastPitch=player.pitch;
  player.swayX+= (THREE.MathUtils.clamp(-yv*0.012,-0.05,0.05)-player.swayX)*Math.min(1,dt*10);
  player.swayY+= (THREE.MathUtils.clamp(pv*0.012,-0.04,0.04)-player.swayY)*Math.min(1,dt*10);
  const aimK = player.aiming?1:0;
  vmGroup.position.set(
    0.03 + player.swayX*0.6 - aimK*0.03 + vmSprint*0.10,
    -0.03 + player.swayY*0.6 + Math.sin(t*9)*0.006*(wishMag>0.1?1:0.2) - dip*0.12 - vmSprint*0.08,
    0 + dip*0.05 - aimK*0.08
  );
  vmGroup.position.z += player.recoilP*0.6;
  vmGroup.rotation.set(-dip*0.5 - vmSprint*0.55 + player.recoilP*1.2, player.swayX*1.5, player.swayY*2);
  const fl=vmGroup.getObjectByName('flash');
  if(fl) fl.material.opacity*=Math.pow(0.001,dt);
  muzzle.intensity*=Math.pow(0.001,dt);
  // camera (eye + landing dip + recoil on top of look)
  camera.position.copy(player.pos);
  camera.position.y -= player.landDip;
  camera.rotation.set(0,0,0);
  camera.rotation.order='YXZ';
  camera.rotation.y=player.yaw+player.recoilY; camera.rotation.x=player.pitch+player.recoilP;
  const targetFov = player.aiming ? 52 : (player.sliding?84:(player.sprinting?79:74));
  camera.fov += (targetFov-camera.fov)*Math.min(1,dt*10);
  camera.updateProjectionMatrix();
  // crosshair bloom
  const ch=$('crosshair');
  if(ch){
    const cs=1+player.bloom*1.6;
    ch.style.transform=`scale(${cs.toFixed(2)})`;
    ch.style.opacity=player.sprinting?0.15:(player.aiming?0.35:0.9);
  }
}

function updateEnemies(dt){
  const now=perfNow();
  // spawning
  if(waveState==='active' && enemiesToSpawn.length){
    spawnT-=dt;
    if(spawnT<=0 && enemies.filter(e=>e.dead===0).length<12){
      const type=enemiesToSpawn.pop();
      const a=Math.random()*Math.PI*2, r=55+Math.random()*25;
      let x=Math.cos(a)*r, z=Math.sin(a)*r;
      x=THREE.MathUtils.clamp(x,-ARENA,ARENA); z=THREE.MathUtils.clamp(z,-ARENA,ARENA);
      const e=spawnEnemy(type,x,z); updateHpBar(e);
      spawnT=0.7;
      updateHUD();
    }
  }
  for(let i=enemies.length-1;i>=0;i--){
    const e=enemies[i];
    if(e.dead>0){
      e.dead+=dt;
      e.mesh.rotation.x=Math.min(Math.PI/2,e.dead*4);
      e.mesh.position.y-=dt*0.6;
      if(e.dead>2.2){ enemyGroup.remove(e.mesh); enemies.splice(i,1); updateHUD(); }
      continue;
    }
    if(e.flash>0){
      // hot emissive hit-flash + physical flinch jerk
      e.flash-=dt;
      const on=e.flash>0;
      e.mesh.traverse(o=>{ if(o.isMesh&&o.material&&o.material.emissive){ o.material.emissive.setHex(on?0x771111:0x000000); } });
    }
    if(e.flinch>0){
      e.flinch=Math.max(0,e.flinch-dt*5);
      e.mesh.rotation.z=Math.sin(e.flinch*22)*0.07*e.flinch;
      if(e.flinch===0) e.mesh.rotation.z=0;
    }
    const p=e.mesh.position;
    tmpV.subVectors(player.pos,p); tmpV.y=0;
    const dist=tmpV.length();
    tmpV.normalize();
    // face player (aegis faces with shield)
    const targetYaw=Math.atan2(tmpV.x,tmpV.z);
    let dy=targetYaw-e.mesh.rotation.y;
    while(dy>Math.PI)dy-=Math.PI*2; while(dy<-Math.PI)dy+=Math.PI*2;
    e.mesh.rotation.y+=dy*Math.min(1,dt*5);
    // strafe + advance (per-archetype locomotion)
    e.strafeT-=dt; if(e.strafeT<=0){ e.strafe*=-1; e.strafeT=1.5+Math.random()*2.5; }
    let want = dist>e.t.range ? 1 : (dist<e.t.range*0.5 ? -0.6 : 0);
    let side = (dist<e.t.range*1.2 && e.type!=='skitter' && !e.t.charger) ? e.strafe*0.7 : 0;
    let step=e.t.speed*dt;
    if(e.t.charger && dist>9){ want=1.9; side=0; step=e.t.charge*dt; // mauler charge!
      if(Math.random()<dt*6) burst(new THREE.Vector3(p.x,p.y+0.3,p.z), 0x8a7a55, 3, 3, 2);
    }
    if(e.t.keeper){ // lancer keeps its distance
      want = dist>e.t.range ? 1 : (dist<e.t.range*0.55 ? -0.9 : 0);
      side = dist<e.t.range ? e.strafe*0.5 : 0;
    }
    let nx=p.x+tmpV.x*step*want + (-tmpV.z)*step*side;
    let nz=p.z+tmpV.z*step*want + (tmpV.x)*step*side;
    // simple separation
    for(const o of enemies){
      if(o===e||o.dead>0) continue;
      const dx=p.x-o.mesh.position.x, dz=p.z-o.mesh.position.z;
      const d=Math.hypot(dx,dz);
      if(d<1.6&&d>0.01){ nx+=dx/d*dt*2; nz+=dz/d*dt*2; }
    }
    const rr=Math.hypot(nx,nz);
    if(!e.t.fly){ [nx,nz]=collideEnemy(nx,nz,e.t.r||0.6); }
    if(rr<ARENA+10){ p.x=nx; p.z=nz; }
    if(e.t.fly){ // hover + sine drift + spinning rotors
      p.y=groundH(p.x,p.z)+e.t.fly+Math.sin(e.bob*1.7)*0.8;
      if(e.mesh.userData.rotors) for(const r of e.mesh.userData.rotors) r.rotation.y+=dt*30;
    } else {
      p.y=groundH(p.x,p.z);
    }
    // bob
    e.bob+=dt*6;
    if(!e.t.fly) e.mesh.position.y+=Math.abs(Math.sin(e.bob))*0.02;
    // shield regen for shielded elites
    if(e.t.regenShield&&e.shield<e.maxsh){
      e.shieldRegen+=dt;
      if(e.shieldRegen>5){ e.shield=Math.min(e.maxsh,e.shield+10*dt); updateHpBar(e); }
    }
    // warlord ground slam
    if(e.t.slam){
      e.slamCd-=dt;
      if(dist<7 && e.slamCd<=0 && player.alive){
        e.slamCd=4;
        burst(new THREE.Vector3(p.x,p.y+0.5,p.z), 0xff4d6e, 26, 10, 7);
        AudioSys.boom(); vibrate(60); rumble(0.6,0.7,250);
        if(player.alive && player.pos.distanceTo(p)<8) damagePlayer(30);
        for(const a of allies){ if(a.alive && a.mesh.position.distanceTo(p)<8) damageAlly(a, 30); }
      }
    }
    // attack (targets nearest of player / allies)
    e.atkT-=dt;
    const tgt = pickTarget(p);
    const tdist = Math.sqrt(tgt.d);
    if(tdist<e.t.range+4 && e.atkT<=0 && tgt.alive){
      // line of sight approx: skip if too far behind cover (cheap)
      e.atkT=e.t.atkCd*(0.8+Math.random()*0.5);
      const from=new THREE.Vector3(p.x,aimH(e),p.z);
      const aim=new THREE.Vector3().subVectors(tgt.pos,from);
      aim.normalize();
      aim.x+=(Math.random()-0.5)*0.06; aim.y+=(Math.random()-0.5)*0.04; aim.normalize();
      if(e.type==='skitter' && tdist<6){
        hurtTarget(e.t.dmg, tgt.ally); // melee lunge
        burst(tgt.pos, 0xff6655, 5, 3, 2);
      } else if(e.t.charger && tdist<e.t.range+1){
        hurtTarget(e.t.dmg, tgt.ally); // mauler smash
        burst(tgt.pos, 0xff5533, 10, 6, 5);
        AudioSys.boom();
      } else {
        const spd = e.t.boltSpeed || 26;
        const col = e.type==='knight'?0x66aaff:e.type==='lancer'?0xffd24d:e.type==='drone'?0xcc88ff:e.type==='warlord'?0xff4d6e:0xff66aa;
        fireBolt(from,aim,spd,e.t.dmg,true,col);
        AudioSys.eshoot();
      }
    }
    e.bar.quaternion.copy(camera.quaternion);
  }
  // wave / mission clear?
  if(waveState==='active' && enemiesToSpawn.length===0 && enemies.every(e=>e.dead>0)){
    if(missionActive){ completeMission(); return; }
    waveState='intermission'; wavePauseT=4;
    feed('✓ RIDGE HELD · +'+(wave*100)+' BONUS');
    player.score+=wave*100;
  } else if(waveState==='intermission'){
    wavePauseT-=dt;
    if(wavePauseT<=0) startWave(wave+1);
  }
}

function updateProjectiles(dt){
  for(const b of bolts){
    if(b.life<=0) continue;
    b.life-=dt;
    b.mesh.position.addScaledVector(b.vel,dt);
    const p=b.mesh.position;
    const gy=groundH(p.x,p.z);
    let hit=false;
    if(p.y<gy+0.1||p.y>60||Math.hypot(p.x,p.z)>200){ hit=true; }
    if(b.foe){
      if(player.alive && p.distanceToSquared(player.pos)<1.1){ damagePlayer(b.dmg); hit=true; burst(p,0xff66aa,6,4,3); }
      if(!hit){
        for(const a of allies){
          if(!a.alive) continue;
          tmpV2.set(a.mesh.position.x, a.mesh.position.y+1.1, a.mesh.position.z);
          if(p.distanceToSquared(tmpV2)<1.4){ damageAlly(a, b.dmg); hit=true; burst(p,0xff66aa,6,4,3); break; }
        }
      }
    } else {
      // player / ally bolts: only ever damage enemies (no friendly fire)
      for(const e of enemies){
        if(e.dead>0) continue;
        tmpV2.set(e.mesh.position.x, aimH(e), e.mesh.position.z);
        if(p.distanceToSquared(tmpV2)<(e.t.r+0.35)*(e.t.r+0.35)+0.6){
          damageEnemy(e,b.dmg,false,p.clone());
          hit=true; break;
        }
      }
    }
    if(hit||b.life<=0){ b.life=0; b.mesh.visible=false; if(hit) burst(p,0x88ddff,4,3,2); }
  }
  // tracers
  for(const t of tracers){
    if(t.t>=1){ t.mesh.visible=false; continue; }
    t.t=Math.min(1,t.t+dt*7);
    const a=t.from, b2=t.to;
    tmpV.lerpVectors(a,b2,t.t);
    t.mesh.position.copy(tmpV);
    t.mesh.lookAt(b2);
    t.mesh.scale.set(1,1,a.distanceTo(b2));
    t.mesh.material.opacity=1-t.t;
  }
  // particles
  for(const q of parts){
    if(q.life<=0) continue;
    q.life-=dt;
    if(q.life<=0){ q.mesh.visible=false; continue; }
    q.vel.y-=9*dt;
    q.mesh.position.addScaledVector(q.vel,dt);
    q.mesh.material.opacity=q.life/q.max;
    q.mesh.rotation.x+=dt*5; q.mesh.rotation.y+=dt*4;
  }
  // nades
  for(const n of nades){
    if(n.life<=0) continue;
    n.life-=dt;
    n.vel.y-=12*dt;
    n.mesh.position.addScaledVector(n.vel,dt);
    const gy=groundH(n.mesh.position.x,n.mesh.position.z)+0.12;
    if(n.mesh.position.y<gy){ n.mesh.position.y=gy; n.vel.y*=-0.4; n.vel.x*=0.7; n.vel.z*=0.7; }
    n.mesh.rotation.x+=dt*6;
    if(n.life<=0){
      n.mesh.visible=false;
      const p=n.mesh.position.clone();
      burst(p,0xffaa55,24,9,7); burst(p,0x555555,12,5,6); smokePuff(p); smokePuff(p);
      AudioSys.boom(); vibrate(60);
      muzzle.intensity=4;
      for(const e of [...enemies]){
        if(e.dead>0) continue;
        const d=e.mesh.position.distanceTo(p);
        if(d<9) damageEnemy(e, 130*(1-d/11), false, e.mesh.position.clone());
      }
      const dp=player.pos.distanceTo(p);
      if(dp<6) damagePlayer(30*(1-dp/7));
    }
  }
}

function animate(){
  requestAnimationFrame(animate);
  window.__FRAMES=(window.__FRAMES||0)+1;
  const dt=Math.min(clock.getDelta(),0.05);
  if(paused){ renderer.render(scene,camera); return; }
  // living-world animation (runs in menu too)
  SKY.time += dt;
  if(SKY.mat){ SKY.mat.uniforms.time.value = SKY.time; SKY.mat.uniforms.nightF.value += (SKY.night-SKY.mat.uniforms.nightF.value)*Math.min(1,dt*1.5); }
  if(pond){ pond.mat.opacity = pond.base + Math.sin(SKY.time*1.3)*0.05; }
  for(const gm of ALLOY_GLOW){ gm.color.setHex(curEnv==='night'?0x66ccff:0x57e6ff); }
  if(playing&&player.alive){
    updatePlayer(dt);
    updateEnemies(dt);
    updateAllies(dt);
    updateProjectiles(dt);
  } else {
    // menu orbit cam (+ gamepad menu navigation: A / Start = DEPLOY)
    pollPad(dt, false);
    const t=perfNow()*0.08;
    camera.position.set(Math.cos(t)*34, groundH(20,20)+9, Math.sin(t)*34);
    camera.lookAt(0,groundH(0,0)+3,0);
    updateProjectiles(dt);
    for(const e of enemies){ e.bar.quaternion.copy(camera.quaternion); }
  }
  // crates bob + pickup
  for(const c of crates){
    c.rotation.y+=dt*0.6;
    c.position.y=groundH(c.position.x,c.position.z)+Math.sin(perfNow()*2+c.position.x)*0.15;
    if(playing&&player.alive&&c.position.distanceTo(player.pos)<2.2){
      weapons[0].reserve=Math.min(448,weapons[0].reserve+48);
      weapons[1].mag=weapons[1].magSize;
      player.nades=Math.min(4,player.nades+1);
      player.health=Math.min(player.healthMax,player.health+25);
      feed('◈ SUPPLY CACHE · ammo + health');
      AudioSys.shield(); updateHUD();
      // move crate away
      const a=Math.random()*Math.PI*2, r=25+Math.random()*40;
      c.position.x=Math.cos(a)*r; c.position.z=Math.sin(a)*r;
    }
  }
  drawRadar();
  renderer.render(scene,camera);
  if(!sceneReady){ sceneReady=true; window.__SCENE_READY=true; }
  // ~1Hz HUD shield refresh (regen smoothness)
  hudT+=dt; if(hudT>0.15){ hudT=0; if(playing) updateHUD(); }
}
let hudT=0;

// ================= Menu / boot =================
function showMenu(dead, resumeOk){
  playing=false;
  resumeOnly=!!resumeOk;
  $('menu').classList.remove('hidden');
  $('hud').classList.remove('on');
  if(dead) $('play').innerHTML = '↻ &nbsp;REDEPLOY · '+(opLabel()||('WAVE '+wave));
  else if(resumeOk) $('play').innerHTML = '▶ &nbsp;RESUME · '+(opLabel()||('WAVE '+wave));
  else refreshPlayBtn();
  if(document.pointerLockElement) document.exitPointerLock();
}
$('play').addEventListener('click', ()=>{
  AudioSys.init(); AudioSys.click();
  const wasAlive = player.alive;
  if(!wasAlive) doFieldReset();
  if(resumeOnly && wasAlive){
    // paused mid-run: just resume
  } else if(selectedOp==='endless'){
    if(wave===0 && !missionActive) startWave(1);
    else if(!wasAlive){ waveState='intermission'; wavePauseT=1.0; }
  } else {
    startMission(parseInt(selectedOp,10));
  }
  resumeOnly=false;
  $('menu').classList.add('hidden');
  $('hud').classList.add('on');
  playing=true;
  paused=false; $('tpadpanel').classList.remove('on');
  $('rotateHint').style.display = (innerHeight>innerWidth && isTouch) ? 'block':'none';
  setTimeout(()=>$('rotateHint').style.display='none', 4000);
  updateHUD();
});
$('how').addEventListener('click', ()=>{
  AudioSys.init(); AudioSys.click();
  const b=$('howbox'); b.style.display=b.style.display==='none'?'block':'none';
});
$('quality').addEventListener('change', e=>{ QUALITY.mode=e.target.value; qstate=applyQuality(); });
addEventListener('resize', ()=>{
  camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
  qstate=applyQuality();
  if(isTouch) $('rotateHint').style.display = (playing&&innerHeight>innerWidth)?'block':'none';
});
addEventListener('orientationchange', ()=>setTimeout(()=>{
  camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); applyQuality();
},200));

updateHUD();
renderOps();
refreshPlayBtn();
setEnv('day');
applyTouchLayout();
animate();
showMenu(false);
setTimeout(()=>{ window.__SCENE_READY = !!sceneReady; }, 500);
// Debug/verification handle (used by automated checks)
// Deterministic single-tick driver (used by automated controller verification;
// the live game uses requestAnimationFrame in animate()).
function step(dt){
  dt = dt || 0.016;
  if(playing && player.alive){
    updatePlayer(dt);
    updateEnemies(dt);
    updateAllies(dt);
    updateProjectiles(dt);
  } else {
    pollPad(dt, false);
  }
}
window.__RP = { player, enemies, weapons, Pad, allies, MISSIONS, TPAD,
  get wave(){ return wave; }, get playing(){ return playing; },
  get curW(){ return curW; },
  get missionActive(){ return missionActive; }, get missionIdx(){ return missionIdx; },
  get selectedOp(){ return selectedOp; }, get unlockedOps(){ return unlockedOps; },
  shoot, startWave, startMission, completeMission, damageEnemy, throwNade, swapWeapon,
  startReload, getPad, pollPad, step, spawnEnemy, spawnAllies, setEnv, renderOps,
  refreshPlayBtn, applyTouchLayout, setEdit, pickTarget };
