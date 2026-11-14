import * as THREE from 'three';
import {GLTFLoader} from './vendor/loaders/GLTFLoader.js';
import {clone} from './vendor/utils/SkeletonUtils.js';
import {enemyMaterial,enemyDepthMaterial} from './materials.js';
import {ZombieMotion} from './zombie-motion.js';
import {GroundEmergence} from './ground-emergence.js';
import {nurseAmbientVoice,NURSE_VOICE_RANGES} from './zombie-voices.js';
import {variedPath,routeWaypoint} from './enemy-routes.js';

const UP=new THREE.Vector3(0,1,0),HEIGHT=2.14,SPEED=.42,WAVE_SIZE=6;
const flatDistance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

export class EnemySystem{
  static async load(scene,navigation,effects,sound,onPlayerHit,onProgress){
    const gltf=await new GLTFLoader().loadAsync('./assets/enemy/nurse.glb',onProgress);
    return new EnemySystem(gltf.scene,scene,navigation,effects,sound,onPlayerHit);
  }
  constructor(source,scene,navigation,effects,sound,onPlayerHit){
    Object.assign(this,{source,scene,navigation,effects,sound,onPlayerHit});
    source.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(source,true);
    this.scale=HEIGHT/box.getSize(new THREE.Vector3()).y;this.minY=box.min.y;
    this.enemies=[];this.hits=0;this.kills=0;this.attackCount=0;this.playerHits=0;
    const terrainData=new Uint8Array(navigation.cols*navigation.rows*4);
    navigation.heights.forEach((h,i)=>{terrainData[i*4]=Math.round(THREE.MathUtils.clamp(h+.5,0,1)*255);terrainData[i*4+3]=255;});
    this.terrain=new THREE.DataTexture(terrainData,navigation.cols,navigation.rows);this.terrain.minFilter=this.terrain.magFilter=THREE.LinearFilter;this.terrain.needsUpdate=true;
    this.groundFX=new GroundEmergence(scene,navigation);
    this.spawns=this.chooseSpawns(new THREE.Vector3(navigation.spawn[0],0,navigation.spawn[1]),true);
    for(let i=0;i<this.spawns.length;i++)this.enemies.push(this.create(i));
    this.reset();
  }
  nearestPoint(x,z){
    const nav=this.navigation;let best=Infinity,result;
    for(let i=0;i<nav.walk.length;i++)if(nav.walk[i]){
      const p=new THREE.Vector3(nav.origin[0]+(i%nav.cols+.5)*nav.cellSize,0,nav.origin[1]+(Math.floor(i/nav.cols)+.5)*nav.cellSize);
      const d=(p.x-x)**2+(p.z-z)**2;if(d<best){best=d;result=p;}
    }
    result.y=nav.ground(result.x,result.z);return result;
  }
  chooseSpawns(player,initial=false){
    const n=this.navigation,candidates=[];
    for(let i=0;i<n.walk.length;i++)if(n.walk[i]){
      const p=new THREE.Vector3(n.origin[0]+(i%n.cols+.5)*n.cellSize,0,n.origin[1]+(Math.floor(i/n.cols)+.5)*n.cellSize);
      if(initial?p.z>=n.spawn[1]+3.8&&p.z<n.exit-.65:flatDistance(p,player)>3.7)candidates.push(p);
    }
    const min=Math.min(...candidates.map(p=>p.z)),max=Math.max(...candidates.map(p=>p.z)),chosen=[];
    for(let i=0;i<WAVE_SIZE;i++){
      const z=initial?THREE.MathUtils.lerp(min,max,i/(WAVE_SIZE-1)):THREE.MathUtils.lerp(min,max,(i+.5)/WAVE_SIZE),x=i===0&&initial?n.spawn[0]:i%2?-.28:.4;
      let best=Infinity,point;
      for(const p of candidates){if(chosen.some(q=>flatDistance(p,q)<1.05))continue;const score=(p.z-z)**2+(p.x-x)**2*.8;if(score<best){best=score;point=p;}}
      if(!point)point=this.nearestPoint(x,z);else point=point.clone();point.y=n.ground(point.x,point.z);chosen.push(point);
    }
    return initial?chosen:chosen.sort((a,b)=>flatDistance(a,player)-flatDistance(b,player));
  }
  create(id){
    const actor=new THREE.Group(),visual=clone(this.source),uniforms={dissolveAmount:{value:0},hitFlash:{value:0},groundClip:{value:0},enemyTerrain:{value:this.terrain},enemyTerrainOrigin:{value:new THREE.Vector2(...this.navigation.origin)},enemyTerrainSize:{value:new THREE.Vector2(this.navigation.cols*this.navigation.cellSize,this.navigation.rows*this.navigation.cellSize)}};
    visual.scale.multiplyScalar(this.scale);visual.position.y-=this.minY*this.scale;actor.add(visual);this.scene.add(actor);
    const bones=new Map(),rest=new Map(),materials=[];
    visual.traverse(o=>{
      if(o.isBone){bones.set(o.name,o);rest.set(o.name,o.quaternion.clone());}
      if(o.isMesh){o.customDepthMaterial=enemyDepthMaterial(o.material,uniforms);o.material=enemyMaterial(o.material,uniforms);materials.push(o.material);o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}
    });
    const shadow=new THREE.Mesh(new THREE.PlaneGeometry(.9,.9),new THREE.MeshBasicMaterial({map:this.effects.texture,color:0x08130e,transparent:true,opacity:.36,depthWrite:false}));
    shadow.rotation.x=-Math.PI/2;shadow.position.y=.018;actor.add(shadow);
    const enemy={id,actor,visual,bones,rest,uniforms,materials,shadow,hp:100,state:'idle',time:0,phase:id*1.7,attacks:0,hits:0,path:[],pathClock:0,lastHits:new Set(),hitAge:10,moveSpeed:0,growlClock:.4+id*.63,targetable:true,solid:true,hitHeight:HEIGHT,roarAge:10,roarAmount:0,vocalLevel:0,poseClock:0};
    enemy.motion=new ZombieMotion(enemy,this.navigation);return enemy;
  }
  reset(){
    this.sound.zombies?.stopAll();
    this.wave=0;this.groundFX.reset();
    this.nextWave(new THREE.Vector3(this.navigation.spawn[0],0,this.navigation.spawn[1]),true);
    for(const e of this.enemies){
      e.phase=e.id*1.7;e.visual.position.y=-this.minY*this.scale;
      // Prepare the fully buried pose before its first visible frame.
      e.state='emerge';e.motion.beginEmerge();this.pose(e,0);e.state='buried';
    }
    this.hits=this.kills=this.attackCount=this.playerHits=0;
  }
  nextWave(player,initial=false){
    this.wave++;this.waveKills=0;this.wavePhase=initial?'opening':'emerging';this.waveCountdown=initial?1.8:0;const spawns=initial?this.spawns:this.chooseSpawns(player);
    for(const e of this.enemies){
      e.actor.position.copy(spawns[e.id]);e.actor.rotation.set(0,Math.atan2(player.x-e.actor.position.x,player.z-e.actor.position.z),0);e.actor.visible=false;
      e.hp=100;e.state='buried';e.time=0;e.spawnDelay=e.id*.42+Math.random()*.22;e.emergeCue=0;e.path=[];e.pathClock=0;e.lastHits.clear();e.hits=0;e.attacks=0;e.hitAge=10;e.moveSpeed=0;e.targetable=false;e.solid=false;e.hitHeight=0;e.roarAge=10;e.roarAmount=0;e.vocalLevel=0;e.poseClock=0;e.growlClock=6+e.id*.31;
      e.routeSeed=Math.random()*100;e.pace=.85+Math.random()*.27;e.hesitateClock=3+Math.random()*5;e.hesitate=0;e.blockedTime=0;e.routePlans=0;e.routeTarget=null;
      e.uniforms.groundClip.value=1;e.uniforms.dissolveAmount.value=0;e.uniforms.hitFlash.value=0;e.shadow.material.opacity=0;e.motion.reset();
    }
    if(!initial)this.onWave?.(this.wave);
  }
  clearLine(a,b){
    const steps=Math.max(1,Math.ceil(flatDistance(a,b)/.06));
    for(let i=1;i<=steps;i++){const t=i/steps;if(!this.navigation.canStand(THREE.MathUtils.lerp(a.x,b.x,t),THREE.MathUtils.lerp(a.z,b.z,t),true))return false;}
    return true;
  }
  pathTo(a,b){
    const n=this.navigation,start=n.index(a.x,a.z),goal=n.index(b.x,b.z);if(start<0||goal<0)return [];
    const parent=new Int32Array(n.walk.length);parent.fill(-2);parent[start]=-1;const queue=[start];
    for(let k=0;k<queue.length&&parent[goal]===-2;k++){
      const p=queue[k],x=p%n.cols;
      for(const q of [x>0?p-1:-1,x<n.cols-1?p+1:-1,p-n.cols,p+n.cols])if(q>=0&&q<n.walk.length&&n.walk[q]&&parent[q]===-2){parent[q]=p;queue.push(q);}
    }
    if(parent[goal]===-2)return [];
    const path=[];for(let p=goal;p>=0&&p!==start;p=parent[p])path.push(new THREE.Vector3(n.origin[0]+(p%n.cols+.5)*n.cellSize,0,n.origin[1]+(Math.floor(p/n.cols)+.5)*n.cellSize));
    return path.reverse();
  }
  pose(e,dt){e.motion.update(dt);}
  damage(e,amount,type,attackId,point){
    if(e.hp<=0||!e.targetable||e.lastHits.has(attackId))return false;
    e.lastHits.add(attackId);if(e.lastHits.size>64)e.lastHits.delete(e.lastHits.values().next().value);
    e.hp=Math.max(0,e.hp-amount);e.hits++;this.hits++;e.hitAge=0;e.uniforms.hitFlash.value=1;
    this.effects.emit(point||e.actor.position.clone().add(new THREE.Vector3(0,1.1,0)),type==='fire'?0xffa044:0x9effe3,24,1.8);
    this.sound.tone(150,45,.14,.09);this.sound.hiss(.14,.1,1100,220);
    if(e.hp===0){this.groundFX.finish(e);e.state='dissolve';e.time=0;this.kills++;this.waveKills++;e.targetable=false;e.solid=false;this.sound.zombies?.stop(e.id);}
    else if(e.state!=='emerge'){e.state='stagger';e.time=0;}
    if(e.hp>0)this.sound.growl?.(e.actor.position,e.id,'hurt');
    return true;
  }
  hitSegment(a,b,radius,damage,type,attackId){
    const ab=b.clone().sub(a);let hit=false;
    for(const e of this.enemies){
      if(e.hp<=0||!e.targetable)continue;
      const center=e.actor.position.clone().add(new THREE.Vector3(0,Math.min(1.15,e.hitHeight*.55),0));
      const t=THREE.MathUtils.clamp(center.clone().sub(a).dot(ab)/Math.max(ab.lengthSq(),.000001),0,1),p=a.clone().addScaledVector(ab,t);
      if(Math.hypot(p.x-center.x,p.z-center.z)<radius+.31&&p.y>e.actor.position.y+.1&&p.y<e.actor.position.y+e.hitHeight&&this.clearLine(a,center))hit=this.damage(e,damage,type,attackId,p)||hit;
    }
    return hit;
  }
  hitCone(player,range,damage,attackId){
    const dir=new THREE.Vector3(0,0,1).applyQuaternion(player.quaternion);
    for(const e of this.enemies){
      const v=e.actor.position.clone().sub(player.position),d=Math.hypot(v.x,v.z);v.y=0;
      if(e.hp>0&&e.targetable&&e.hitHeight>.65&&d<range&&Math.abs(player.position.y-e.actor.position.y)<.8&&v.normalize().dot(dir)>.35&&this.clearLine(player.position,e.actor.position))this.damage(e,damage,'sword',attackId,e.actor.position.clone().add(new THREE.Vector3(0,1.25,0)));
    }
  }
  constrainPlayer(position,previous){
    for(const e of this.enemies)if(e.hp>0&&e.solid){
      const delta=position.clone().sub(e.actor.position);delta.y=0;const d=delta.length();
      if(d<.61){if(d<.001)delta.copy(previous).sub(e.actor.position).setY(0);delta.normalize();this.navigation.move(position,delta.x*(.61-d),delta.z*(.61-d));
        if(flatDistance(position,e.actor.position)<.5){position.x=previous.x;position.z=previous.z;}
      }
    }
  }
  update(dt,player,active){
    if(!active)return;
    if(this.wavePhase==='opening'){
      this.waveCountdown=Math.max(0,this.waveCountdown-dt);
      if(this.waveCountdown>0)return;
      this.wavePhase='emerging';this.onWave?.(this.wave);
    }
    this.groundFX.update(dt,true);
    for(const e of this.enemies){
      if(e.state==='gone')continue;
      if(e.state==='buried'){
        e.spawnDelay-=dt;if(e.spawnDelay>0)continue;
        e.state='emerge';e.time=0;e.actor.visible=true;e.motion.beginEmerge();this.groundFX.start(e);
      }
      e.time+=dt;e.hitAge+=dt;e.uniforms.hitFlash.value=Math.max(0,1-e.hitAge/.18);
      const distance=flatDistance(e.actor.position,player.position);
      if(e.state==='dissolve'){
        const u=Math.min(1,e.time/1.65);e.uniforms.dissolveAmount.value=u;e.shadow.material.opacity=.36*(1-u);
        if(Math.random()<.6){const p=e.actor.position.clone().add(new THREE.Vector3((Math.random()-.5)*.5,Math.random()*Math.min(HEIGHT,e.hitHeight), (Math.random()-.5)*.4));this.effects.emit(p,0x83bba4,3,.5);}
        if(u>=1){e.state='gone';e.actor.visible=false;}continue;
      }
      if(e.state==='emerge'){
        const effort=THREE.MathUtils.smoothstep(e.time,.8,1.3)*(1-THREE.MathUtils.smoothstep(e.time,4.3,5.4));e.vocalLevel=THREE.MathUtils.lerp(e.vocalLevel,Math.max(this.sound.zombies?.level?.(e.id)||0,effort*.23),1-Math.exp(-dt*13));
        this.pose(e,dt);this.groundFX.progress(e,e.time);
        e.hitHeight=THREE.MathUtils.clamp(e.motion.world(77).y-e.actor.position.y+.24,0,HEIGHT);e.targetable=e.hitHeight>.28;e.solid=e.time>4.5;
        e.shadow.material.opacity=.36*THREE.MathUtils.smoothstep(e.time,3.5,5.5);
        const cues=[.24,.82,2.5,3.3];
        if(e.emergeCue<cues.length&&e.time>=cues[e.emergeCue]){
          const local=new THREE.Vector3(e.emergeCue%2?-.23:.23,0,.4),point=e.actor.localToWorld(local);point.y=this.navigation.ground(point.x,point.z)+.03;this.groundFX.emit(point,e.emergeCue<2?.8:.45);if(distance<12)this.sound.dig?.();if(e.emergeCue===1&&distance<NURSE_VOICE_RANGES.near)this.sound.growl?.(e.actor.position,e.id,'idle');e.emergeCue++;
        }
        if(e.time>=5.5){e.motion.finishEmerge();e.state='idle';e.time=0;e.growlClock=1.3+e.id*.31;e.uniforms.groundClip.value=0;e.targetable=true;e.solid=true;e.hitHeight=HEIGHT;e.idleYaw=e.actor.rotation.y;this.groundFX.finish(e);}
        continue;
      }
      if(e.state==='stagger'){
        if(e.time>.48){e.state='chase';e.time=0;}
      }else if(e.state==='attack'){
        if(e.time>=1.08&&!e.struck){
          e.struck=true;
          const v=player.position.clone().sub(e.actor.position);v.y=0;
          const dir=new THREE.Vector3(0,0,1).applyQuaternion(e.actor.quaternion);
          this.sound.hiss(.45,.08,450,1300);
          if(distance<1.5&&v.normalize().dot(dir)>.45&&Math.abs(player.position.y-e.actor.position.y)<.75&&this.clearLine(e.actor.position,player.position))if(this.onPlayerHit(16,e.actor.position))this.playerHits++;
        }
        if(e.time>2.4){e.state='chase';e.time=0;}
      }else{
        const wasChasing=e.state==='chase';
        e.state=distance<NURSE_VOICE_RANGES.near?'chase':'idle';
        // Approaching a crying nurse should wake her near voice promptly,
        // rather than waiting out the long distant-sob interval.
        if(e.state==='chase'&&!wasChasing)e.growlClock=Math.min(e.growlClock,.35);
        if(distance<1.24){e.state='attack';e.time=0;e.struck=false;e.attacks++;this.attackCount++;this.sound.growl?.(e.actor.position,e.id,'attack');e.growlClock=5.5;}
        if(e.state==='chase'){
          e.pathClock-=dt;e.hesitateClock-=dt;e.hesitate=Math.max(0,e.hesitate-dt);
          if(distance>3.3&&e.hesitateClock<=0){e.hesitate=.2+Math.random()*.4;e.hesitateClock=4+Math.random()*6;}
          while(e.path.length&&flatDistance(e.actor.position,e.path[0])<.1)e.path.shift();
          if(e.pathClock<=0||!e.path.length){e.routeTarget=routeWaypoint(this.navigation,e.actor.position,player.position);e.path=variedPath(this.navigation,e.actor.position,e.routeTarget,e.routeSeed);e.pathClock=2.2+Math.random()*1.4;e.routePlans++;}
          let target=player.position;
          if(e.path.length){let i=Math.min(5,e.path.length-1);while(i>0&&!this.clearWalk(e.actor.position,e.path[i]))i--;target=e.path[i];}
          const v=target.clone().sub(e.actor.position);v.y=0;v.normalize();
          for(const other of this.enemies)if(other!==e&&other.hp>0&&other.solid){const away=e.actor.position.clone().sub(other.actor.position).setY(0),d=away.length();if(d>.01&&d<1.15)v.addScaledVector(away,(1.15-d)*.85/d);}
          v.normalize();e.moveSpeed=THREE.MathUtils.lerp(e.moveSpeed,e.hesitate>0?0:SPEED*e.pace,1-Math.exp(-dt*7));e.moveYaw=Math.atan2(v.x,v.z);
          const previous=e.actor.position.clone(),step=v.multiplyScalar(e.moveSpeed*dt),candidate=previous.clone();this.navigation.move(candidate,step.x,step.z);
          if(this.enemies.every(other=>other===e||other.hp<=0||!other.solid||flatDistance(other.actor.position,candidate)>.69)&&flatDistance(candidate,player.position)>.76){const delta=candidate.clone().sub(e.actor.position);if(delta.lengthSq()>.000001)e.moveYaw=Math.atan2(delta.x,delta.z);e.actor.position.copy(candidate);}
          if(e.moveSpeed>.1&&flatDistance(e.actor.position,previous)<.00001&&step.length()>.002)e.blockedTime+=dt;else e.blockedTime=0;
          if(e.blockedTime>.65){e.pathClock=0;e.routeSeed+=1.7;e.blockedTime=0;}
          e.phase+=dt*2.4;
        }else {e.moveSpeed=0;e.phase+=dt*.7;}
        const targetYaw=e.state==='chase'?e.moveYaw:(e.idleYaw??Math.PI)+Math.sin(e.time*.15+e.id)*.08;
        e.actor.quaternion.slerp(new THREE.Quaternion().setFromAxisAngle(UP,targetYaw),1-Math.exp(-dt*2.5));
      }
      e.actor.position.y=this.navigation.ground(e.actor.position.x,e.actor.position.z);
      e.growlClock-=dt;e.roarAge+=dt;
      if(e.growlClock<=0&&e.state!=='attack'&&e.state!=='stagger'){
        const kind=nurseAmbientVoice(distance,e.state);
        const played=kind&&this.sound.growl?.(e.actor.position,e.id,kind,{distance,occluded:!this.clearLine(e.actor.position,player.position)});
        e.growlClock=played?(kind==='cry'?18+(e.id*1.718+this.wave*.9)%8:7.5+(e.id*1.718+this.wave*.9)%4.5):1.6+(e.id%4)*.65;
        if(played&&kind==='idle'){e.roarAge=0;e.roarDuration=2.5+(e.id%3)*.23;}
      }
      const duration=e.roarDuration||2.6;
      e.roarAmount=THREE.MathUtils.smoothstep(e.roarAge,0,.35)*(1-THREE.MathUtils.smoothstep(e.roarAge,duration-.65,duration));
      const vocal=Math.max(this.sound.zombies?.level?.(e.id)||0,e.roarAmount*(.42+.18*Math.sin(e.roarAge*8+e.id)));
      e.vocalLevel=THREE.MathUtils.lerp(e.vocalLevel,vocal,1-Math.exp(-dt*13));
      e.poseClock+=dt;const interval=distance>16?.065:distance>10?.04:0;
      if(e.poseClock>=interval){this.pose(e,e.poseClock);e.poseClock=0;}
    }
    const remaining=this.enemies.filter(e=>e.hp>0).length;
    if(remaining===0){
      if(this.wavePhase!=='intermission'){this.wavePhase='intermission';this.waveCountdown=2.4;}
      this.waveCountdown=Math.max(0,this.waveCountdown-dt);
      if(this.waveCountdown===0&&this.enemies.every(e=>e.state==='gone'))this.nextWave(player.position);
    }else if(this.wavePhase==='emerging'&&this.enemies.every(e=>e.state!=='buried'&&e.state!=='emerge'))this.wavePhase='active';
  }

  clearWalk(a,b){const n=Math.max(1,Math.ceil(flatDistance(a,b)/.05));for(let i=1;i<=n;i++)if(!this.navigation.canStand(THREE.MathUtils.lerp(a.x,b.x,i/n),THREE.MathUtils.lerp(a.z,b.z,i/n)))return false;return true;}
  get stats(){return {source:'fbx.FBX',height:HEIGHT,speed:SPEED,attackDuration:2.4,windup:1.08,hits:this.hits,kills:this.kills,attacks:this.attackCount,playerHits:this.playerHits,remaining:this.enemies.filter(e=>e.hp>0).length,wave:this.wave,waveSize:WAVE_SIZE,waveKills:this.waveKills,wavePhase:this.wavePhase,waveCountdown:this.waveCountdown,ground:this.groundFX.stats,material:'MeshPhysicalMaterial',normalMaps:true,enemies:this.enemies.map(e=>({id:e.id,hp:e.hp,state:e.state,time:e.time,position:e.actor.position.toArray(),yaw:e.actor.rotation.y,hits:e.hits,attacks:e.attacks,dissolve:e.uniforms.dissolveAmount.value,visible:e.actor.visible,boneCount:e.bones.size,walkable:this.navigation.canStand(e.actor.position.x,e.actor.position.z),targetable:e.targetable,solid:e.solid,hitHeight:e.hitHeight,roar:e.roarAmount,vocal:e.vocalLevel,route:{seed:e.routeSeed,pace:e.pace,plans:e.routePlans,target:e.routeTarget?.toArray(),pausing:e.hesitate>0},motion:e.motion.stats}))};}
}
