import * as THREE from 'three';
import {createFlame} from './flame.js';
import {createCrescent,updateCrescent,crescentPoint,CRESCENT_ROLLS} from './crescent-qi.js';
const up=new THREE.Vector3(0,1,0),forward=new THREE.Vector3();
function glowTexture(){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),g=x.createRadialGradient(32,32,1,32,32,31);g.addColorStop(0,'#fff');g.addColorStop(.16,'#fff');g.addColorStop(.45,'rgba(255,255,255,.35)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);}
export class CombatEffects {
  constructor(scene,navigation,sound){
    this.scene=scene;this.navigation=navigation;this.sound=sound;this.texture=glowTexture();this.projectiles=[];this.bursts=[];this.energies=[];this.particles=[];this.swordTime=0;this.stage=0;this.fireCount=0;this.swordCount=0;this.impactCount=0;
    this.group=new THREE.Group();scene.add(this.group);this.lights=Array.from({length:4},()=>{const l=new THREE.PointLight(0xff781f,0,4,2);scene.add(l);return l;});
    this.crescentWarmup=createCrescent();this.crescentWarmup.position.y=1.25;this.group.add(this.crescentWarmup);this.qiEmitted=0;
    const bladeGeo=new THREE.BufferGeometry();const vertices=new Float32Array([-.035,0,0,.035,0,0,0,1.05,0,0,0,-.014,0,0,.014,0,1.05,0]);bladeGeo.setAttribute('position',new THREE.BufferAttribute(vertices,3));bladeGeo.computeVertexNormals();
    this.sword=new THREE.Group();this.blade=new THREE.Mesh(bladeGeo,new THREE.MeshStandardMaterial({color:0xdbf8ed,metalness:.78,roughness:.23,emissive:0x54cfc5,emissiveIntensity:1.8,side:THREE.DoubleSide}));this.blade.position.y=.11;this.sword.add(this.blade);
    const handle=new THREE.Mesh(new THREE.CylinderGeometry(.024,.024,.19,8),new THREE.MeshStandardMaterial({color:0x142d2b,metalness:.3,roughness:.4}));this.sword.add(handle);
    const guard=new THREE.Mesh(new THREE.BoxGeometry(.22,.035,.065),new THREE.MeshStandardMaterial({color:0xc6a552,metalness:.7,roughness:.3}));guard.position.y=.105;this.sword.add(guard);this.group.add(this.sword);this.sword.visible=false;
    this.trailPositions=new Float32Array(40*6*3);this.trailColors=new Float32Array(40*6*3);this.trailUvs=new Float32Array(40*6*2);this.history=[];
    this.trailGeo=new THREE.BufferGeometry();this.trailGeo.setAttribute('position',new THREE.BufferAttribute(this.trailPositions,3));this.trailGeo.setAttribute('color',new THREE.BufferAttribute(this.trailColors,3));
    this.trailGeo.setAttribute('uv',new THREE.BufferAttribute(this.trailUvs,2));
    this.trail=new THREE.Mesh(this.trailGeo,new THREE.ShaderMaterial({vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;void main(){float edge=pow(max(0.,sin(vUv.x*3.14159)),1.6);float fade=pow(1.-vUv.y,2.2);float a=edge*fade*.23;gl_FragColor=vec4(mix(vec3(.08,1.3,.9),vec3(1.,2.6,2.),pow(edge,4.)),a);}',transparent:true,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,depthWrite:false}));this.trail.frustumCulled=false;this.group.add(this.trail);
    this.particleGeometry=new THREE.BufferGeometry();this.positions=new Float32Array(1800*3);this.colors=new Float32Array(1800*3);this.particleGeometry.setAttribute('position',new THREE.BufferAttribute(this.positions,3));this.particleGeometry.setAttribute('color',new THREE.BufferAttribute(this.colors,3));
    this.particleSizes=new Float32Array(1800);this.particleGeometry.setAttribute('particleScale',new THREE.BufferAttribute(this.particleSizes,1));
    this.points=new THREE.Points(this.particleGeometry,new THREE.PointsMaterial({size:.065,map:this.texture,transparent:true,opacity:.85,vertexColors:true,depthWrite:false,blending:THREE.AdditiveBlending}));
    this.points.material.onBeforeCompile=shader=>{shader.vertexShader='attribute float particleScale;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('gl_PointSize = size;','gl_PointSize = size * particleScale;');};this.points.material.customProgramCacheKey=()=> 'embers-size-v7';this.points.frustumCulled=false;this.group.add(this.points);
  }
  sprite(color,size,opacity=1){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:this.texture,color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending}));s.scale.setScalar(size);this.group.add(s);return s;}
  setWeapon(weapon){
    for(const o of [...this.sword.children]){this.sword.remove(o);o.geometry?.dispose();o.material?.dispose();}
    this.blade=new THREE.Mesh(weapon.geometry,weapon.material);this.blade.castShadow=true;this.sword.add(this.blade);this.swordSource=weapon.source;this.bladeBase=weapon.bladeBase;this.bladeTip=weapon.bladeTip;
    const glowMaterial=new THREE.ShaderMaterial({uniforms:{uTime:{value:0}},transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`varying vec2 vUv;uniform float uTime;void main(){float side=pow(max(0.,1.-abs(vUv.x*2.-1.)),2.8);float ends=smoothstep(0.,.1,vUv.y)*(1.-smoothstep(.88,1.,vUv.y));float flow=.36+.64*pow(.5+.5*sin(vUv.y*24.-uTime*15.),3.);gl_FragColor=vec4(vec3(.24,2.4,1.65)*flow,side*ends*.6);}`});
    this.swordGlow=new THREE.Group();const length=weapon.bladeTip-weapon.bladeBase;
    for(const angle of [0,Math.PI/2]){const ribbon=new THREE.Mesh(new THREE.PlaneGeometry(.14,length,1,24),glowMaterial);ribbon.position.y=weapon.bladeBase+length/2;ribbon.rotation.y=angle;this.swordGlow.add(ribbon);}
    this.sword.add(this.swordGlow);this.swordGlowMaterial=glowMaterial;
    const shellMaterial=weapon.material.clone();shellMaterial.color.set(0x76dac2);shellMaterial.emissive.set(0x208b79);shellMaterial.emissiveIntensity=.8;shellMaterial.transparent=true;shellMaterial.opacity=.14;shellMaterial.depthWrite=false;shellMaterial.blending=THREE.AdditiveBlending;
    const shell=new THREE.Mesh(weapon.geometry,shellMaterial);shell.scale.set(1.07,1,1.08);this.sword.add(shell);
  }
  emit(position,color,n=12,power=1){for(let i=0;i<n&&this.particles.length<1750;i++)this.particles.push({p:position.clone(),v:new THREE.Vector3((Math.random()-.5)*power,(Math.random()-.2)*power,(Math.random()-.5)*power),c:new THREE.Color(color),life:.3+Math.random()*.4,max:.7});}
  emitQi(position,velocity,n=1,power=.3){
    for(let i=0;i<n&&this.particles.length<1750;i++){
      const life=.28+Math.random()*.34,v=velocity.clone().add(new THREE.Vector3((Math.random()-.5)*power,(Math.random()-.25)*power,(Math.random()-.5)*power));
      this.particles.push({p:position.clone(),v,c:new THREE.Color().setRGB(.42+Math.random()*.18,1.5+Math.random()*.35,1.12+Math.random()*.25),life,max:life,kind:'qi'});this.qiEmitted++;
    }
  }
  launchCrescent(player,forward){
    const mesh=createCrescent(this.swordCount*.73,this.stage),roll=CRESCENT_ROLLS[this.stage];
    mesh.position.copy(player.position).addScaledVector(forward,.6);mesh.position.y+=1.25;
    mesh.quaternion.setFromAxisAngle(up,player.rotation.y).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),roll));
    this.group.add(mesh);this.energies.push({mesh,v:forward.clone().multiplyScalar(7),life:.8,age:0,emission:0,yaw:player.rotation.y,roll,stage:this.stage,collided:false,attackId:'sword-'+this.swordCount,damage:[35,40,50,65][this.stage]});
  }
  cast(player,hand,aim,target=null){
    const p=hand.clone();p.y=Math.max(p.y,player.position.y+1.22);
    if(!this.navigation.canStand(p.x,p.z,true))p.copy(player.position).add(new THREE.Vector3(0,1.35,0));
    const dir=target?target.clone().sub(p).normalize():aim?aim.clone().normalize():new THREE.Vector3(0,.015,1).applyQuaternion(player.quaternion).normalize();
    const offset=Math.min(.16,target?p.distanceTo(target)*.1:.16),muzzle=p.clone().addScaledVector(dir,offset);
    if(this.navigation.canStand(muzzle.x,muzzle.z,true))p.copy(muzzle);
    this.lastFireDirection=dir.toArray();this.lastFireOrigin=p.toArray();this.lastFireTarget=target?.toArray()||null;
    const core=createFlame(this.fireCount*.173);core.quaternion.setFromUnitVectors(up,dir);this.group.add(core);core.position.copy(p);
    const range=this.navigation.projectileRange,speed=8;
    const aura=this.sprite(0xff701a,.83,.25);aura.position.copy(p);this.fireCount++;this.projectiles.push({p,v:dir.clone().multiplyScalar(speed),core,aura,life:range/speed,range,distance:0,time:0,emission:0,attackId:'fire-'+this.fireCount});this.sound.fire();
  }
  swordAttack(stage,player,duration=.65,basic=false){this.swordDuration=duration;this.swordTime=duration;this.stage=stage;this.basicSword=basic;if(basic)this.basicCount=(this.basicCount||0)+1;this.history=[];this.swordCount++;this.sword.visible=true;this.sound.sword(stage);this.attackOrigin=player.position.clone();this.attackYaw=player.rotation.y;this.released=false;this.swordEmission=0;}
  burst(position,color=0xff7d25){const sprite=this.sprite(color,.2,.6);sprite.position.copy(position);const volume=createFlame(this.impactCount*.43);volume.position.copy(position);volume.quaternion.setFromUnitVectors(up,new THREE.Vector3(0,-1,0));this.group.add(volume);this.bursts.push({sprite,volume,p:position.clone(),life:.65,max:.65,color:new THREE.Color(color)});this.emit(position,color,38,2.1);this.impactCount++;this.sound.impact();}
  reset(){for(const o of this.projectiles){this.group.remove(o.core,o.aura);o.core.geometry.dispose();o.core.material.dispose();o.aura.material.dispose();}for(const o of this.energies){this.group.remove(o.mesh);o.mesh.geometry.dispose();o.mesh.material.dispose();}for(const o of this.bursts){this.group.remove(o.sprite,o.volume);o.sprite.material.dispose();o.volume?.geometry.dispose();o.volume?.material.dispose();}this.projectiles=[];this.lastFireImpact=null;this.energies=[];this.bursts=[];this.particles=[];this.history=[];this.trailGeo.setDrawRange(0,0);this.particleGeometry.setDrawRange(0,0);this.sword.visible=false;this.swordTime=0;this.crescentWarmup.visible=false;this.lights.forEach(l=>l.intensity=0);}
  update(dt,time,player,character,active){
    this.lights.forEach(l=>l.intensity=0);
    if(!active){return;}
    let li=0;
    for(let i=this.projectiles.length-1;i>=0;i--){const o=this.projectiles[i],flightDt=Math.min(dt,o.life);o.life=Math.max(0,o.life-flightDt);o.time+=flightDt;const steps=Math.max(1,Math.ceil(o.v.length()*flightDt/.05));let reason=null;
      for(let k=0;k<steps;k++){const previous=o.p.clone();o.p.addScaledVector(o.v,flightDt/steps);o.distance+=previous.distanceTo(o.p);if(!this.navigation.canStand(o.p.x,o.p.z,true)){reason='wall';break;}if(o.p.y<this.navigation.ground(o.p.x,o.p.z)+.08||o.p.y>4.8){reason='ground-or-ceiling';break;}if(this.enemies?.hitSegment(previous,o.p,.23,50,'fire',o.attackId)){reason='enemy';break;}}
      if(reason||o.life<=0){this.lastFireImpact={position:o.p.toArray(),reason:reason||'range',distance:o.distance,age:o.time,attackId:o.attackId};this.burst(o.p);this.group.remove(o.core,o.aura);o.core.geometry.dispose();o.core.material.dispose();o.aura.material.dispose();this.projectiles.splice(i,1);continue;}
      o.core.position.copy(o.p);o.core.material.uniforms.uTime.value=o.time;o.core.material.uniforms.uFade.value=Math.min(1,o.time/.07,o.life/.2);o.core.scale.setScalar(.94+.035*Math.sin(time*21+o.time*11));o.aura.position.copy(o.p);o.aura.scale.setScalar(.8+.05*Math.sin(time*29));o.aura.material.opacity=.22+.035*Math.sin(time*33);
      o.emission+=dt*95;while(o.emission>=1&&this.particles.length<1750){o.emission--;const life=.28+Math.random()*.4;this.particles.push({p:o.p.clone().addScaledVector(o.v,-Math.random()*.055),v:o.v.clone().multiplyScalar(-.06-Math.random()*.12).add(new THREE.Vector3((Math.random()-.5)*.8,.4+Math.random(),(Math.random()-.5)*.8)),c:new THREE.Color(),life,max:life,kind:'ember'});}
      if(li<4){const l=this.lights[li++];l.position.copy(o.p);l.color.set(0xff6c1c);l.intensity=13+Math.sin(time*27)*1.2;}
    }
    this.swordTime=Math.max(0,this.swordTime-dt);
    if(this.swordTime>0){
      const u=1-this.swordTime/this.swordDuration,hand=character.handPosition('R');forward.set(0,0,1).applyQuaternion(player.quaternion);
      if(u>.18&&u<.7)this.enemies?.hitCone(player,this.basicSword?1.7:1.85,this.basicSword?25:[35,40,50,65][this.stage],'sword-'+this.swordCount);
      const pose=character.weaponPose();this.sword.position.copy(pose.position);this.sword.quaternion.copy(pose.quaternion);this.sword.scale.setScalar(1);this.sword.visible=true;
      if(this.swordGlowMaterial)this.swordGlowMaterial.uniforms.uTime.value=time;
      const direction=up.clone().applyQuaternion(pose.quaternion),tip=hand.clone().addScaledVector(direction,this.bladeTip||1.18),base=hand.clone().addScaledVector(direction,this.bladeBase||.22);this.history.unshift({tip,base});if(this.history.length>12)this.history.pop();
      if(u>.12&&u<.8){this.swordEmission+=dt*54;const n=Math.min(5,Math.floor(this.swordEmission));this.swordEmission-=n;this.emitQi(tip,new THREE.Vector3(0,.04,0),n,.32);}
      if(li<4){const l=this.lights[li++];l.position.copy(tip);l.color.set(0x72e8d9);l.intensity=8;}
      if(u>.3&&!this.released){this.released=true;if(!this.basicSword)this.launchCrescent(player,forward);}
    }else {this.sword.visible=false;if(this.history.length)this.history.pop();}
    let count=0;for(let i=0;i<this.history.length-1;i++){const a=this.history[i],b=this.history[i+1];const t=i/this.history.length,t2=(i+1)/this.history.length;const uv=[[0,t],[1,t],[1,t2],[0,t],[1,t2],[0,t2]];let j=0;for(const p of [a.base,a.tip,b.tip,a.base,b.tip,b.base]){p.toArray(this.trailPositions,count*3);this.trailUvs.set(uv[j++],count*2);count++;}}
    this.trailGeo.setDrawRange(0,count);this.trailGeo.attributes.position.needsUpdate=true;this.trailGeo.attributes.uv.needsUpdate=true;
    for(let i=this.energies.length-1;i>=0;i--){
      const o=this.energies[i];o.life-=dt;o.age+=dt;
      if(!o.collided){
        const steps=Math.max(1,Math.ceil(o.v.length()*dt/.06));
        for(let j=0;j<steps;j++){
          const previous=o.mesh.position.clone(),next=previous.clone().addScaledVector(o.v,dt/steps);
          if(!this.navigation.canStand(next.x,next.z,true)){
            o.collided=true;o.life=Math.min(o.life,.15);this.emitQi(previous,new THREE.Vector3(0,.12,0),24,1.3);break;
          }
          o.mesh.position.copy(next);this.enemies?.hitSegment(previous,next,.45,o.damage,'sword',o.attackId);
        }
      }
      o.mesh.quaternion.setFromAxisAngle(up,o.yaw).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),o.roll+Math.sin(o.age*3)*.065));
      const fade=updateCrescent(o.mesh,o.age,o.life);o.mesh.updateWorldMatrix(true,false);
      if(!o.collided){
        o.emission+=dt*78;let n=Math.min(5,Math.floor(o.emission));o.emission-=n;
        while(n-->0){const u=.04+Math.random()*.92,p=o.mesh.localToWorld(crescentPoint(u,.22+Math.random()*.34));const v=new THREE.Vector3(Math.sign(u-.5)*(.08+Math.random()*.16)+(Math.random()-.5)*.22,-.12+Math.random()*.44,-.35-Math.random()*.55).applyQuaternion(o.mesh.quaternion);this.emitQi(p,v,1,.35);}
      }
      if(li<4){const l=this.lights[li++];l.position.copy(o.mesh.position);l.color.set(0x76dec2);l.intensity=3.4*fade;}
      if(o.life<=0){this.group.remove(o.mesh);o.mesh.geometry.dispose();o.mesh.material.dispose();this.energies.splice(i,1);}
    }
    for(let i=this.bursts.length-1;i>=0;i--){const o=this.bursts[i];o.life-=dt;const age=1-o.life/o.max;o.sprite.scale.setScalar(age*1.7+.3);o.sprite.material.opacity=Math.max(0,o.life/o.max)*.5;o.volume.scale.setScalar(.6+age*1.1);o.volume.material.uniforms.uTime.value=age*.8;o.volume.material.uniforms.uFade.value=Math.max(0,o.life/o.max);if(li<4){const l=this.lights[li++];l.position.copy(o.p);l.color.copy(o.color);l.intensity=18*Math.max(0,o.life/o.max);}if(o.life<=0){this.group.remove(o.sprite,o.volume);o.sprite.material.dispose();o.volume.geometry.dispose();o.volume.material.dispose();this.bursts.splice(i,1);}}
    for(let i=this.particles.length-1;i>=0;i--){const p=this.particles[i];p.life-=dt;if(p.life<=0){this.particles.splice(i,1);continue;}p.p.addScaledVector(p.v,dt);if(p.kind==='qi'){p.v.multiplyScalar(Math.exp(-dt*1.7));p.v.y+=dt*.06;}else p.v.y+=dt*.35;}
    for(let i=0;i<this.particles.length;i++){const p=this.particles[i];p.p.toArray(this.positions,i*3);this.particleSizes[i]=p.kind==='ember'?.22+.3*p.life/p.max:p.kind==='qi'?.16+.32*Math.sqrt(p.life/p.max):1;if(p.kind==='ember'){const heat=p.life/p.max;p.c.setRGB(2.2,Math.max(.03,heat*heat*.95),heat**4*.18);}p.c.clone().multiplyScalar(p.life/p.max).toArray(this.colors,i*3);}
    this.particleGeometry.setDrawRange(0,this.particles.length);this.particleGeometry.attributes.position.needsUpdate=true;this.particleGeometry.attributes.color.needsUpdate=true;this.particleGeometry.attributes.particleScale.needsUpdate=true;
  }
  get stats(){return {fireballs:this.fireCount,swordAttacks:this.swordCount,basicAttacks:this.basicCount||0,basicActive:this.swordTime>0&&this.basicSword,impacts:this.impactCount,projectiles:this.projectiles.length,particles:this.particles.length,stage:this.stage,swordVisible:this.sword.visible,lastFireDirection:this.lastFireDirection,lastFireOrigin:this.lastFireOrigin,lastFireTarget:this.lastFireTarget,lastFireImpact:this.lastFireImpact,fireRange:this.navigation.projectileRange,flame:'48-step turbulent emissive volume',flights:this.projectiles.map(o=>({position:o.p.toArray(),velocity:o.v.toArray(),age:o.time,distance:o.distance,range:o.range,life:o.life})),swordSource:this.swordSource||'procedural',swordEnergy:'tapered crescent ribbon with flowing filaments',crescents:this.energies.map(o=>({position:o.mesh.position.toArray(),age:o.age,life:o.life,fade:o.mesh.material.uniforms.uFade.value,roll:o.roll,collided:o.collided,damage:o.damage,attackId:o.attackId,geometry:o.mesh.geometry.type})),qiParticles:this.particles.filter(p=>p.kind==='qi').length,qiEmitted:this.qiEmitted};}
}
