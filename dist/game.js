import * as THREE from 'three';
import { SparkRenderer, SplatMesh } from './vendor/spark/spark.module.js';
import { loadTaoist } from './character.js';
import { CorridorNavigation } from './navigation.js';
import {Atmosphere} from './atmosphere.js';
import {CombatEffects} from './combat-effects.js';
import {GameSound} from './sound.js';
import {EnemySystem} from './enemies.js';
import {setupMaterialLighting} from './materials.js';
import {LaunchScreen} from './launch-screen.js';
import {EnemyHealthUI} from './enemy-health-ui.js';
import {ThirdPersonCamera} from './camera-rig.js';

const $ = (id) => document.getElementById(id);
const canvas = $('world');
const scene = new THREE.Scene();
const background = 0x17251f;
scene.background = new THREE.Color(background);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.04, 120);
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
} catch (error) {
  $('loading-text').textContent = '无法启动 3D 画面';
  $('load-detail').textContent = '请使用支持 WebGL 的 Chrome 或 Edge，并开启硬件加速。';
  document.querySelector('.loading-mark').style.display = 'none';
  throw error;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = .68;
setupMaterialLighting(renderer,scene);

scene.add(new THREE.HemisphereLight(0x9cbab4, 0x17231c, 1.05));
const sun = new THREE.DirectionalLight(0xc7d6cc, 1.15);
sun.position.set(4, 7, 5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = sun.shadow.camera.bottom = -7;
sun.shadow.camera.right = sun.shadow.camera.top = 7;
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 22;
sun.shadow.normalBias = .025;
sun.shadow.bias = -.0002;
sun.shadow.radius = 3;
scene.add(sun, sun.target);
const rim = new THREE.DirectionalLight(0x83b6bd, .38);
rim.position.set(-4, 4, -3);
scene.add(rim);
const spark = new SparkRenderer({renderer,autoUpdate:false,lodSplatCount:matchMedia('(pointer: coarse)').matches?600000:1400000,minSortIntervalMs:24});
scene.add(spark);
let navigation,environment,character,environmentReady=false;
let collisions=0,groundHeight=0,jumpHeight=0,actualSpeed=0;
let cameraDistance=3.3,characterOpacity=1;
let atmosphere,effects,elapsed=0,combatKind=null,queuedKind=null,comboStage=-1,lastSword=-10,fireEmitted=false,emitFire=false,combatYaw=0;
let enemies,playerHealth=100,lastPlayerHit=-10,playerDamageCount=0;
const combatDirection=new THREE.Vector3(0,0,1);
const aimSource='crosshair';
let cameraRig,cameraAim;
const sound=new GameSound();
const launch=new LaunchScreen();let enemyHealthUI,firstFrameReady=false;
let narrationRequest=null,awaitingAutoPointerLock=false,entryInputUntil=0,entryHeldKey=null;
sound.hero.onStarted=id=>{if(id==='loading')launch.narrationStarted();};
sound.hero.onEnded=id=>{if(id==='loading')launch.narrationEnded();};
launch.onEnter=()=>start(true);
function beginLoadingNarration(unmute=false){
  if(started)return narrationRequest;
  if(narrationRequest){if(sound.ctx?.state==='suspended')sound.ctx.resume();return narrationRequest;}
  if(sound.hero.stats.counts.loading>0){if(sound.hero.paused)sound.hero.resume();return;}
  narrationRequest=sound.loadingVoice(unmute).then(syncSoundButton).catch(()=>{}).finally(()=>narrationRequest=null);
  return narrationRequest;
}
sound.hero.preload().then(()=>{if(!started){sound.ensureContext();beginLoadingNarration();}});

const player = new THREE.Group();
scene.add(player);
// A soft contact patch keeps the model grounded even with a wide camera.
const shadowCanvas = document.createElement('canvas');
shadowCanvas.width = shadowCanvas.height = 128;
const ctx = shadowCanvas.getContext('2d');
const fade = ctx.createRadialGradient(64,64,4,64,64,62);
fade.addColorStop(0,'rgba(36,41,26,0.23)');fade.addColorStop(1,'rgba(36,41,26,0)');
ctx.fillStyle=fade;ctx.fillRect(0,0,128,128);
const patch = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 1.05), new THREE.MeshBasicMaterial({ map:new THREE.CanvasTexture(shadowCanvas), transparent:true, depthWrite:false }));
patch.rotation.x=-Math.PI/2;patch.position.y=.008;scene.add(patch);
const floorShadow=new THREE.Mesh(new THREE.PlaneGeometry(5,5),new THREE.ShadowMaterial({color:0x0b1711,opacity:.28,depthWrite:false}));floorShadow.rotation.x=-Math.PI/2;floorShadow.receiveShadow=true;scene.add(floorShadow);

const keys = new Set();
const velocity = new THREE.Vector3();
const yAxis = new THREE.Vector3(0,1,0);
const facingQuaternion = new THREE.Quaternion();
const touch = matchMedia('(pointer: coarse)').matches;
let model, mixer, currentAction, loaded = false, active = false, started = false;
let actions = {}, clips = [], mode = 'loading', yaw = Math.PI, pitch = .10, zoom = 3.25;
let attackTime = 0, attackDuration = 0, attackCount = 0;
let verticalVelocity = 0, grounded = true, travelPhase = 0;
let dragging = false, lastX = 0, lastY = 0, toastTimer, fpsFrames = 0, fpsTime = 0, fps = 0;
let currentMotion = 'Idle', motionTime = 0;
const actionNames = { Idle:'待机', Walk:'行走', Run:'奔跑', Cast:'离火 · 火球',Sword1:'拔剑 · 横斩',Sword2:'回身 · 逆斩',Sword3:'举剑 · 破空',Sword4:'旋身 · 追风', Jump:'跳跃' };
function toast(message) {
  $('toast').textContent = message; $('toast').hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 3000);
}
function setAction(name, duration = .16, force = false) {
  if (!actions[name] || (currentMotion === name && !force)) return;
  const next = actions[name];
  next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
  if (currentAction && currentAction !== next) currentAction.fadeOut(duration);
  next.fadeIn(duration);
  currentAction = next;currentMotion = name;motionTime = 0;
  $('motion-label').textContent = actionNames[name];
}

async function loadWorld(){
  try{
  function showProgress(part,event){launch.transfer(part,event);}
  const presentationPromise=launch.presentation();
  const audioPromise=sound.preload().then(ok=>{if(!ok)throw new Error('Game audio failed to decode');launch.set('audio',1);});
  const navResponse=await fetch('./assets/corridor-navigation.json');
  if(!navResponse.ok)throw new Error('Navigation could not load');
  navigation=new CorridorNavigation(await navResponse.json());
  cameraRig=new ThirdPersonCamera(camera,navigation);
  atmosphere=new Atmosphere(renderer,camera,spark);effects=new CombatEffects(scene,navigation,sound);
  for(const z of [-19,-13,-7,-1,5,9]){const lamp=new THREE.PointLight(0xff5c2b,2.6,5,2);lamp.position.set(-1,2.9,z);scene.add(lamp);}
  environment=new SplatMesh({url:'./assets/corridor.spz',lod:true,nonLod:false,onProgress:e=>showProgress('environment',e),raycastable:false});
  environment.rotation.y=navigation.environment.rotationY;
  environment.scale.setScalar(navigation.environment.scale);
  environment.position.fromArray(navigation.environment.position);scene.add(environment);
  const characterPromise=loadTaoist(e=>showProgress('character',e),navigation).then(value=>{launch.set('character',1);return value;});
  const enemyPromise=EnemySystem.load(scene,navigation,effects,sound,hurtPlayer,e=>showProgress('enemies',e)).then(value=>{launch.set('enemies',1);return value;});
  const environmentPromise=environment.initialized.then(value=>{launch.set('environment',1);return value;});
  const results=await Promise.all([characterPromise,environmentPromise,enemyPromise,presentationPromise,audioPromise]);
  enemies=results[2];effects.enemies=enemies;
  enemies.onWave=wave=>toast(`地底传来异响 · 第 ${wave} 波`);
  character=results[0];
  effects.setWeapon(character.weapon);
  model=character.model;player.add(character.visual);mixer=character.mixer;clips=character.clips;
  for (const clip of clips) {
    const action = mixer.clipAction(clip);
    if (clip.name.startsWith('Sword') || clip.name==='Cast' || clip.name === 'Jump') {
      action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true;
    }
    actions[clip.name] = action;
  }
  const required = Object.keys(actionNames);
  const missing = required.filter(name => !actions[name]);
  if (missing.length) throw new Error(`Missing animations: ${missing.join(', ')}`);
  player.position.set(navigation.spawn[0],navigation.ground(...navigation.spawn),navigation.spawn[1]);
  groundHeight=player.position.y;player.rotation.y=Math.PI;
  currentMotion='';setAction('Idle', 0);mixer.update(0);character.settle(player);
  enemyHealthUI=new EnemyHealthUI(enemies,camera);
  await prepareFirstFrame();
  environmentReady=true;firstFrameReady=true;loaded = true;mode = 'preview';
  spark.autoUpdate=true;launch.complete();
  window.dispatchEvent(new Event('game-ready'));
  }catch(error){
  console.error('World loading failed',error);
  mode = 'error';$('loading-text').textContent='角色或环境加载失败';
  launch.fail();
  $('load-detail').textContent='请检查本地服务器是否运行，然后重新加载。';
  $('retry-button').hidden=false;document.querySelector('.loading-mark').style.display='none';
  }
}
async function prepareFirstFrame(){
  launch.set('gpu',.05,'正在准备光影与动作');
  updateCamera(.1,true);
  for(const clip of clips){
    mixer.stopAllAction();mixer.clipAction(clip).reset().play();mixer.setTime(clip.duration*.5);character.settle(player);
  }
  mixer.stopAllAction();currentMotion='';setAction('Idle',0,true);mixer.update(0);character.settle(player);
  const warmupSoundCounts={...sound.counts};
  effects.cast(player,character.handPosition('R'));effects.swordAttack(0,player,.8);
  // Compile the clipped buried bodies too, before the opening emergence.
  for(const e of enemies.enemies)e.actor.visible=true;
  scene.traverse(o=>{const ms=Array.isArray(o.material)?o.material:[o.material];for(const m of ms)if(m)for(const v of Object.values(m))if(v?.isTexture)renderer.initTexture(v);});
  await renderer.compileAsync(scene,camera);
  atmosphere.render(scene,0,false,effects.lights);
  for(const e of enemies.enemies)e.actor.visible=false;
  effects.reset();effects.fireCount=effects.swordCount=0;Object.assign(sound.counts,warmupSoundCounts);
  launch.set('gpu',.4,'正在准备古巷画面');
  const deadline=performance.now()+120000;let stable=0,lastCount=0;
  // Spark initializes decoding before its LoD worker and sorted GPU buffers exist.
  // Drive those steps while the opaque cover remains above the real canvas.
  while(stable<4){
    if(performance.now()>deadline)throw new Error('The initial point-cloud frame did not become ready');
    await spark.update({scene,camera});
    atmosphere.render(scene,0,false,effects.lights);
    const count=spark.activeSplats;
    const settled=count>1000&&!spark.sorting&&!spark.lodDirty&&spark.lodInitQueue.length===0;
    stable=settled&&Math.abs(count-lastCount)<Math.max(100,count*.01)?stable+1:0;lastCount=count;
    if(count>1000)launch.set('gpu',.8,'正在完成首次画面');
    await new Promise(resolve=>requestAnimationFrame(resolve));
  }
  renderer.getContext().finish();
  await new Promise(resolve=>requestAnimationFrame(resolve));
}
loadWorld();
$('retry-button').onclick=()=>location.reload();

function lockMouse() {
  if (touch || !canvas.requestPointerLock) return;
  try { const result = canvas.requestPointerLock(); result?.catch(()=>toast('按住鼠标右键拖动视角，左键击打')); }
  catch { toast('按住鼠标右键拖动视角，左键击打'); }
}
function start(automatic=false) {
  if (!loaded) return;
  automatic=automatic===true;
  const firstStart=!started;
  if(playerHealth<=0)reset();
  if(!started)player.quaternion.setFromAxisAngle(yAxis,yaw+Math.PI);
  started=true;active=true;mode='playing';
  updateCamera(0,true);$('reticle').hidden=false;
  launch.enter();
  if(firstStart)sound.hero.stop();
  sound.unlock().then(()=>{if(firstStart&&active)sound.hero.play('opening');}).catch(()=>toast('点击音效按钮可重新启用声音'));syncSoundButton();
  $('welcome').hidden=true;$('pause').hidden=true;$('quick-controls').hidden=false;
  $('help').hidden=true;$('touch-controls').hidden=!touch;
  $('camera-mode').textContent=touch?'拖动画面旋转':'第三人称 · 右键拖动视角';
  canvas.focus({preventScroll:true});awaitingAutoPointerLock=automatic&&!touch;if(!automatic)lockMouse();
}
function pause() {
  if (!started || !active) return;
  active=false;mode='paused';keys.clear();dragging=false;
  velocity.set(0,0,0);queuedKind=null;sound.pause();
  $('pause').hidden=false;$('reticle').hidden=true;$('touch-controls').hidden=true;
  $('camera-mode').textContent='已暂停';
  if (document.pointerLockElement===canvas) document.exitPointerLock();
}
function reset() {
  if(!navigation)return;
  player.position.set(navigation.spawn[0],navigation.ground(...navigation.spawn),navigation.spawn[1]);player.rotation.set(0,started?0:Math.PI,0);velocity.set(0,0,0);
  groundHeight=player.position.y;jumpHeight=0;actualSpeed=0;
  verticalVelocity=0;grounded=true;attackTime=0;queuedKind=null;combatKind=null;comboStage=-1;emitFire=false;effects?.reset();
  enemies?.reset();playerHealth=100;lastPlayerHit=-10;playerDamageCount=0;
  sound.hero.stop();
  document.body.classList.remove('combat-hurt');
  $('pause').querySelector('h2').textContent='静候君归';$('resume-button').innerHTML='继续操作 <span aria-hidden="true">↗</span>';
  if(mode==='defeated')mode='paused';
  yaw=Math.PI;pitch=.10;zoom=3.25;keys.clear();setAction('Idle',.14,true);updateCamera(0,true);
  toast('已回到起点');
}
function hurtPlayer(amount,origin){
  if(!active||elapsed-lastPlayerHit<.85||playerHealth<=0)return false;
  playerHealth=Math.max(0,playerHealth-amount);lastPlayerHit=elapsed;playerDamageCount++;
  const away=player.position.clone().sub(origin);away.y=0;away.normalize();navigation.move(player.position,away.x*.12,away.z*.12);
  sound.tone(100,28,.24,.14);sound.hiss(.2,.15,700,180);
  if(playerHealth===0){pause();mode='defeated';$('pause').querySelector('h2').textContent='气血已尽';$('resume-button').innerHTML='重返巷口 <span aria-hidden="true">↗</span>';}
  return true;
}
function attack(kind='sword') {
  if (!active || !grounded) return;
  if (attackTime>0) {queuedKind=kind;return;}
  let name;
  if(kind==='sword'){comboStage=elapsed-lastSword<3?(comboStage+1)%4:0;lastSword=elapsed;name='Sword'+(comboStage+1);}
  else name=kind==='basic'?'Sword3':'Cast';
  cameraAim=cameraRig.aim(enemies);
  combatDirection.copy(cameraAim.point).sub(player.position).setY(0).normalize();
  combatKind=kind;combatYaw=Math.atan2(combatDirection.x,combatDirection.z);fireEmitted=false;
  attackDuration=actions[name].getClip().duration;attackTime=.0001;attackCount++;
  setAction(name,.07,true);
  if(kind==='basic')$('motion-label').textContent='普通劈砍';
  if(kind==='sword'||kind==='basic')effects.swordAttack(kind==='basic'?0:comboStage,player,attackDuration,kind==='basic');
}
function primary(){
  attack('basic');
}
function jump() {
  if (!active || !grounded || attackTime>0) return;
  verticalVelocity=4.5;grounded=false;setAction('Jump',.1,true);
}
function toggleFullscreen() {
  if(document.fullscreenElement) document.exitFullscreen?.().catch(()=>{});
  else $('app').requestFullscreen?.().catch(()=>toast('当前窗口不支持全屏，请在独立浏览器打开。'));
}
$('start-button').onclick=start;$('resume-button').onclick=start;
$('reset-button').onclick=reset;$('fullscreen-button').onclick=toggleFullscreen;
$('help-button').onclick=()=>{$('help').hidden=!$('help').hidden;};
$('close-help').onclick=()=>{$('help').hidden=true;};
function syncSoundButton(){const b=$('sound-button');if(b){b.setAttribute('aria-label',sound.muted?'开启音乐和音效':'关闭音乐和音效');b.title='背景音乐与音效 · M';b.setAttribute('aria-pressed',String(!sound.muted));b.classList.toggle('muted',sound.muted);}}
if($('sound-button'))$('sound-button').onclick=()=>{sound.toggle();syncSoundButton();};
if($('fog-density'))$('fog-density').oninput=e=>{if(atmosphere)atmosphere.density=Number(e.target.value)/70;};
syncSoundButton();
document.addEventListener('pointerlockchange',()=>{
  const locked=document.pointerLockElement===canvas;
  $('reticle').hidden=!active;
  if(locked)$('camera-mode').textContent='第三人称 · 鼠标已锁定';
  else if(active)pause();
});
document.addEventListener('pointerlockerror',()=>{
  if(active){$('camera-mode').textContent='第三人称 · 右键拖动视角';toast('按住鼠标右键拖动视角，左键击打');}
});
addEventListener('keydown',(event)=>{
  if(event.target instanceof HTMLButtonElement && ['Space','Enter'].includes(event.code))return;
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code))event.preventDefault();
  if(!event.repeat){
    if(event.code==='KeyH'){$('help').hidden=!$('help').hidden;return;}
    if(event.code==='KeyF'){toggleFullscreen();return;}
    if(event.code==='KeyR'){if(loaded)reset();return;}
    if(event.code==='KeyP'){if(active)pause();else if(started)start();return;}
    if(event.code==='Escape'){pause();return;}
    if(event.code==='Enter' && !active){start();return;}
    if(event.code==='Space')jump();
    if(event.code==='KeyJ'||event.code==='KeyE')attack('sword');
    if(event.code==='KeyQ')attack('fire');
    if(event.code==='KeyM'){sound.toggle();syncSoundButton();return;}
  }
  if(active)keys.add(event.code);
});
// Consume the entry press before it can also move, jump, cast or open a menu.
document.addEventListener('keydown',event=>{
  if(event.code===entryHeldKey){event.preventDefault();event.stopImmediatePropagation();return;}
  if(started||event.repeat||event.ctrlKey||event.metaKey||event.altKey||['ControlLeft','ControlRight','AltLeft','AltRight','MetaLeft','MetaRight','F5','F12'].includes(event.code))return;
  if(loaded){event.preventDefault();event.stopImmediatePropagation();entryInputUntil=performance.now()+350;entryHeldKey=event.code;keys.clear();start();}
  else if(event.code!=='KeyM')beginLoadingNarration();
},{capture:true});
document.addEventListener('keyup',event=>{if(event.code===entryHeldKey)entryHeldKey=null;},{capture:true});
document.addEventListener('pointerdown',event=>{
  if(started)return;
  if(loaded){event.preventDefault();event.stopImmediatePropagation();entryInputUntil=performance.now()+350;keys.clear();start();}
  else if(!event.target.closest?.('#loading-voice'))beginLoadingNarration();
},{capture:true});
document.addEventListener('contextmenu',event=>{if(performance.now()<entryInputUntil)event.preventDefault();},{capture:true});
addEventListener('keyup',(event)=>keys.delete(event.code));
addEventListener('blur',()=>{keys.clear();if(active)pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();if(!started)sound.hero.pause();}else if(!started){if(sound.hero.paused)sound.hero.resume();launch.queueAutoEntry();}});
canvas.addEventListener('contextmenu',event=>event.preventDefault());
canvas.addEventListener('pointerdown',(event)=>{
  if(event.pointerType==='touch'){
    dragging=true;lastX=event.clientX;lastY=event.clientY;canvas.setPointerCapture(event.pointerId);return;
  }
  if(event.button===2){dragging=true;lastX=event.clientX;lastY=event.clientY;canvas.setPointerCapture(event.pointerId);}
  else if(event.button===0){if(started&&!active)start();else if(active){if(awaitingAutoPointerLock){awaitingAutoPointerLock=false;lockMouse();}else primary();}}
});
addEventListener('pointerup',()=>dragging=false);
addEventListener('pointercancel',()=>{dragging=false;keys.clear();});
addEventListener('mousemove',(event)=>{
  if(document.pointerLockElement===canvas && active){yaw-=event.movementX*.0024;pitch=THREE.MathUtils.clamp(pitch+event.movementY*.0024,-.65,.80);}
});
canvas.addEventListener('pointermove',(event)=>{
  if(!active || !dragging || document.pointerLockElement===canvas)return;
  const sensitivity=event.pointerType==='touch'?.004:.0024;
  yaw-=(event.clientX-lastX)*sensitivity;pitch=THREE.MathUtils.clamp(pitch+(event.clientY-lastY)*sensitivity,-.65,.80);
  lastX=event.clientX;lastY=event.clientY;
});
canvas.addEventListener('wheel',(event)=>{event.preventDefault();zoom=THREE.MathUtils.clamp(zoom+event.deltaY*.0025,2.1,4.8);},{passive:false});
for(const button of document.querySelectorAll('[data-key]')){
  button.addEventListener('pointerdown',e=>{e.preventDefault();if(!active)return;keys.add(button.dataset.key);button.classList.add('pressed');button.setPointerCapture(e.pointerId);});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,()=>{keys.delete(button.dataset.key);button.classList.remove('pressed');});
}
$('touch-attack').onpointerdown=e=>{e.preventDefault();attack('sword');};
if($('touch-fire'))$('touch-fire').onpointerdown=e=>{e.preventDefault();attack('fire');};
$('touch-jump').onpointerdown=e=>{e.preventDefault();jump();};

function updatePlayer(dt) {
  const right=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);
  const forward=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0);
  const input=new THREE.Vector3(right,0,-forward);
  if(input.lengthSq()>0)input.normalize().applyAxisAngle(yAxis,yaw);
  const running=keys.has('ShiftLeft')||keys.has('ShiftRight');
  const speed=(running?3.4:1.4)*(attackTime>0?.20:1);
  velocity.lerp(input.multiplyScalar(speed),1-Math.exp(-dt*12));
  if(velocity.lengthSq()<.00003)velocity.set(0,0,0);
  const oldX=player.position.x,oldZ=player.position.z;
  navigation.move(player.position,velocity.x*dt,velocity.z*dt);
  enemies?.constrainPlayer(player.position,new THREE.Vector3(oldX,player.position.y,oldZ));
  const movedX=player.position.x-oldX,movedZ=player.position.z-oldZ;
  actualSpeed=Math.hypot(movedX,movedZ)/Math.max(dt,.001);
  if(Math.abs(movedX-velocity.x*dt)>.00001||Math.abs(movedZ-velocity.z*dt)>.00001){
    collisions++;
    velocity.x=movedX/dt;velocity.z=movedZ/dt;
  }
  // Keep facing the requested heading when collision resolution slides the
  // capsule sideways. A wall must not turn a forward walk into a side step.
  if(input.lengthSq()>.001 && attackTime===0){
    facingQuaternion.setFromAxisAngle(yAxis,Math.atan2(input.x,input.z));
    player.quaternion.slerp(facingQuaternion,1-Math.exp(-dt*14));
  }
  if(!grounded){
    verticalVelocity-=12*dt;jumpHeight+=verticalVelocity*dt;
    if(jumpHeight<=0){jumpHeight=0;verticalVelocity=0;grounded=true;}
  }
  if(attackTime>0){
    if(combatKind==='fire'&&cameraAim){combatDirection.copy(cameraAim.point).sub(player.position).setY(0).normalize();combatYaw=Math.atan2(combatDirection.x,combatDirection.z);}
    facingQuaternion.setFromAxisAngle(yAxis,combatYaw);player.quaternion.slerp(facingQuaternion,1-Math.exp(-dt*20));
    attackTime+=dt;
    if(combatKind==='fire'&&attackTime>.20&&!fireEmitted){emitFire=true;fireEmitted=true;}
    if(attackTime>=attackDuration){attackTime=0;combatKind=null;if(queuedKind){const kind=queuedKind;queuedKind=null;attack(kind);}}
  }
  if(grounded && attackTime===0){
    const moving=velocity.length()>.13;
    setAction(moving?(running?'Run':'Walk'):'Idle',.18);
    if(moving && currentAction){
      // Match the stride rate to acceleration so easing into a walk doesn't skate.
      currentAction.setEffectiveTimeScale(THREE.MathUtils.clamp(actualSpeed/(running?3.4:1.4),.35,1.1));
    }
  }
  groundHeight=THREE.MathUtils.lerp(groundHeight,navigation.ground(player.position.x,player.position.z),1-Math.exp(-dt*18));
  player.position.y=groundHeight+jumpHeight;
  travelPhase+=actualSpeed*dt;
}
function updateCamera(dt, instant=false) {
  if(!cameraRig){camera.position.set(0,1.8,-3.3);camera.lookAt(0,1.1,0);return;}
  const result=cameraRig.update(dt,{player,yaw,pitch,zoom,started,instant,compact:innerWidth<650});
  cameraDistance=result.distance;
  if(character)characterOpacity=character.cameraDistance(cameraDistance);
  cameraAim=cameraRig.aim(enemies);
  $('reticle').classList.toggle('on-target',cameraAim.kind==='enemy');
  $('reticle').classList.toggle('blocked',cameraAim.distance<1.2);
}

let previousTime=performance.now(),hudTime=0;
function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min((now-previousTime)/1000,.04);previousTime=now;
  if(loaded){
    if(active)elapsed+=dt;
    if(active){updatePlayer(dt);motionTime+=dt;}
    if(active||!started)mixer.update(dt);
    character.settle(player);
    enemies.update(dt,player,active);
    document.body.classList.toggle('combat-hurt',elapsed-lastPlayerHit<.22);
    updateCamera(dt);
    if(emitFire&&active){emitFire=false;effects.cast(player,character.handPosition('R'),null,cameraAim.point);}
    effects.update(dt,elapsed,player,character,active);
    sound.update(dt,actualSpeed,keys.has('ShiftLeft')||keys.has('ShiftRight'),grounded&&active);
    enemyHealthUI?.update(active);
    patch.position.x=player.position.x;patch.position.z=player.position.z;
    patch.position.y=groundHeight+.012;
    floorShadow.position.set(player.position.x,groundHeight+.016,player.position.z);
    patch.material.opacity=Math.max(.1,1-jumpHeight*.65);
    patch.scale.setScalar(1+jumpHeight*.2);
    sun.position.set(player.position.x+4,7,player.position.z+5);
    sun.target.position.set(player.position.x,0,player.position.z);sound.listen(player.position,camera.getWorldDirection(new THREE.Vector3()));
  }else updateCamera(dt);
  if(atmosphere)atmosphere.render(scene,dt,active||!started,effects?.lights);else renderer.render(scene,camera);
  hudTime+=dt;fpsFrames++;fpsTime+=dt;
  if(fpsTime>=1){fps=Math.round(fpsFrames/fpsTime);fpsFrames=0;fpsTime=0;}
  if(hudTime>.1){
    hudTime=0;$('speed-label').innerHTML=`${(active?actualSpeed:0).toFixed(1)} <small>m/s</small>`;
    $('position-label').textContent=navigation?`距起点 ${Math.hypot(player.position.x-navigation.spawn[0],player.position.z-navigation.spawn[1]).toFixed(1)} m`:'通道正在准备';
  }
}
updateCamera(.1,true);requestAnimationFrame(frame);
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);atmosphere?.resize();});

// Read-only diagnostics for checking actual keyboard/mouse outcomes in a browser.
Object.defineProperty(window,'__game',{value:{get state(){
  const bones=[];model?.traverse(n=>{if(n.isBone)bones.push({name:n.name,q:n.quaternion.toArray()});});
  return {loaded,mode,active,motion:currentMotion,position:player.position.toArray(),speed:actualSpeed,grounded,attackCount,animations:clips.map(c=>({name:c.name,duration:c.duration})),bones,yaw,pitch,zoom,fps,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,environmentReady,firstFrameReady,loading:launch.stats,activeSplats:spark.activeSplats,character:character?.metadata,walkable:navigation?.canStand(player.position.x,player.position.z),groundHeight,jumpHeight,collisions,spawn:navigation?.spawn,exit:navigation?.exit,elbows:character?.elbowClearance(),aimSource,cameraRig:cameraRig?.stats,aim:cameraAim?{point:cameraAim.point.toArray(),direction:cameraAim.direction.toArray(),distance:cameraAim.distance,kind:cameraAim.kind,enemyId:cameraAim.enemyId}:null,facing:new THREE.Vector3(0,0,1).applyQuaternion(player.quaternion).toArray(),camera:camera.position.toArray(),cameraDistance,characterOpacity,combat:effects?.stats,sound:sound.stats,fog:atmosphere?.stats,cloth:character?.cloth.stats,combatKind,comboStage,playerHealth,playerDamageCount,enemies:enemies?.stats};
}}});
