import * as THREE from 'three';
const boneName=n=>'3D游戏动画素材'+String(n).padStart(3,'0');
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const clamp=THREE.MathUtils.clamp;
const ease=t=>{t=clamp(t,0,1);return t*t*t*(t*(t*6-15)+10);};
const lerp=THREE.MathUtils.lerp;
const STRIDE=.60,STANCE=.64;

// Two-bone IK uses the supplied bind skeleton's measured lengths and knee poles.
// Feet stay at world-space contact points; only an airborne foot changes anchor.
export class ZombieMotion {
  constructor(enemy,navigation){
    this.e=enemy;this.nav=navigation;this.bones=enemy.bones;
    this.pelvis=this.bone(3);this.rootRest=this.pelvis.position.clone();
    this.visualRest=enemy.visual.position.clone();enemy.actor.updateMatrixWorld(true);
    this.basePelvis=this.local(3);
    this.legs=[[-1,101,104,108,109],[1,90,93,97,98]].map(([side,hip,knee,ankle,toe],i)=>{
      const a=this.world(hip),b=this.world(knee),c=this.world(ankle);
      const foot=this.local(ankle),end=this.local(toe),dir=end.clone().sub(foot).normalize();
      return {side,hip,knee,ankle,toe,index:i,upper:a.distanceTo(b),lower:b.distanceTo(c),base:foot,restDir:dir,ankleHeight:foot.y,
        target:V(),anchor:V(),from:V(),landing:V(),rotation:new THREE.Quaternion(),swing:false,settling:false};
    });
    this.arms=[[-1,8,11,14,23,19,27],[1,37,40,43,52,48,56]].map(([side,shoulder,elbow,hand,middle,index,ring])=>({side,shoulder,elbow,hand,middle,index,ring,
      upper:this.world(shoulder).distanceTo(this.world(elbow)),lower:this.world(elbow).distanceTo(this.world(hand)),shoulderHeight:this.local(shoulder).y}));
    this.reset();
  }
  bone(n){return this.bones.get(boneName(n));}
  world(n){return this.bone(n).getWorldPosition(V());}
  local(n){return this.e.actor.worldToLocal(this.world(n));}
  toWorld(p){return this.e.actor.localToWorld(p.clone());}
  reset(){
    const e=this.e;
    for(const [name,q]of e.rest)this.bones.get(name).quaternion.copy(q);
    this.pelvis.position.copy(this.rootRest);e.visual.position.copy(this.visualRest);e.actor.updateMatrixWorld(true);
    this.travel=0;this.lastPosition=e.actor.position.clone();this.blend=0;this.age=0;this.state=e.state;this.transitionAge=1;this.transition=null;
    this.rootOffset=V();this.contacts=0;this.maxLockError=0;this.emergence=null;this.crawlAnchors=null;
    for(const f of this.legs){
      f.swing=false;f.settling=false;f.phase=f.index*.5;
      const p=V(f.side*.13,f.ankleHeight,f.base.z+.19-STRIDE*f.phase);
      f.anchor.copy(this.toWorld(p));f.anchor.y=this.nav.ground(f.anchor.x,f.anchor.z)+f.ankleHeight;
      f.target.copy(f.anchor);f.rotation.copy(e.actor.quaternion);
    }
  }
  aim(n,child,target){
    const b=this.bone(n),p=this.world(n),a=this.world(child).sub(p).normalize(),d=target.clone().sub(p).normalize();
    const q=b.getWorldQuaternion(new THREE.Quaternion());
    const parent=b.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    b.quaternion.copy(parent.multiply(new THREE.Quaternion().setFromUnitVectors(a,d)).multiply(q));b.updateMatrixWorld(true);
  }
  rotate(n,axis,angle){
    const b=this.bone(n),q=b.getWorldQuaternion(new THREE.Quaternion()),parent=b.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    const a=axis.clone().applyQuaternion(this.e.actor.quaternion);
    b.quaternion.copy(parent.multiply(new THREE.Quaternion().setFromAxisAngle(a,angle)).multiply(q));b.updateMatrixWorld(true);
  }
  solve(hip,knee,tip,target,upper,lower,pole){
    const a=this.world(hip),d=target.clone().sub(a),distance=clamp(d.length(),Math.abs(upper-lower)+.001,upper+lower-.001);
    d.normalize();const x=(upper*upper-lower*lower+distance*distance)/(2*distance),h=Math.sqrt(Math.max(0,upper*upper-x*x));
    const bend=pole.clone().applyQuaternion(this.e.actor.quaternion);bend.addScaledVector(d,-bend.dot(d)).normalize();
    const joint=a.clone().addScaledVector(d,x).addScaledVector(bend,h);
    this.aim(hip,knee,joint);this.aim(knee,tip,target);
  }
  contact(f){
    f.anchor.copy(f.target);f.anchor.y=this.nav.ground(f.anchor.x,f.anchor.z)+f.ankleHeight;
    f.target.copy(f.anchor);f.swing=false;f.settling=false;f.rotation.copy(this.e.actor.quaternion);this.contacts++;
  }
  feet(dt,moving){
    for(const f of this.legs){
      f.phase=(this.travel+f.index*.5)%1;
      if(moving){
        f.settling=false;
        if(f.phase>=STANCE){
          if(!f.swing){
            f.from.copy(f.target);f.landing.copy(this.toWorld(V(f.side*.13,f.ankleHeight,f.base.z+.19+STRIDE*(1-STANCE))));
            f.landing.y=this.nav.ground(f.landing.x,f.landing.z)+f.ankleHeight;f.swing=true;
          }
          const u=(f.phase-STANCE)/(1-STANCE);
          f.target.lerpVectors(f.from,f.landing,ease(u));
          f.target.y+=Math.sin(Math.PI*u)*(f.side<0?.048:.034);
          f.rotation.slerp(this.e.actor.quaternion,1-Math.exp(-dt*9));
        }else{
          if(f.swing)this.contact(f);f.target.copy(f.anchor);
        }
      }else if(f.swing){
        if(!f.settling){f.from.copy(f.target);f.landing.copy(this.toWorld(V(f.side*.13,f.ankleHeight,f.base.z+.14)));f.landing.y=this.nav.ground(f.landing.x,f.landing.z)+f.ankleHeight;f.settleAge=0;f.settling=true;}
        f.settleAge+=dt;const u=Math.min(1,f.settleAge/.20);f.target.lerpVectors(f.from,f.landing,ease(u));
        if(u===1)this.contact(f);
      }else f.target.copy(f.anchor);
    }
  }
  wrist(arm,drop,curl=1){
    const p=this.world(arm.hand),forward=this.world(arm.middle).sub(p).normalize();
    const across=this.world(arm.index).sub(this.world(arm.ring));across.addScaledVector(forward,-across.dot(forward)).normalize();
    const current=new THREE.Matrix4().makeBasis(across,forward.clone().cross(across).normalize(),forward);
    const z=V(arm.side*.03,-drop,1).normalize().applyQuaternion(this.e.actor.quaternion);
    const x=V(-arm.side,0,0).applyQuaternion(this.e.actor.quaternion);x.addScaledVector(z,-x.dot(z)).normalize();
    const desired=new THREE.Matrix4().makeBasis(x,z.clone().cross(x).normalize(),z);
    const change=new THREE.Quaternion().setFromRotationMatrix(desired.multiply(current.invert()));
    const b=this.bone(arm.hand),world=b.getWorldQuaternion(new THREE.Quaternion()),parent=b.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    b.quaternion.copy(parent.multiply(change).multiply(world));b.updateMatrixWorld(true);
    const start=arm.side<0?19:48;
    for(let finger=0;finger<4;finger++){
      const n=start+finger*4;this.rotate(n,V(1,0,0),(.11+finger*.025)*curl);this.rotate(n+1,V(1,0,0),.32*curl);this.rotate(n+2,V(1,0,0),.25*curl);
    }
  }
  beginEmerge(){
    this.reset();this.emergence={stage:'破土',progress:0};this.crawlAnchors={hands:[],rear:[],front:[]};this.leadArmIndex=this.e.id%2;this.leadFootSide=this.leadArmIndex===0?1:-1;
    const anchor=(x,z,height)=>{const p=this.toWorld(V(x,0,z));p.y=this.nav.ground(p.x,p.z)+height;return p;};
    for(const a of this.arms)this.crawlAnchors.hands.push(anchor(a.side*.27,.52,.035));
    for(const f of this.legs){this.crawlAnchors.rear.push(anchor(f.side*.14,-.62,f.ankleHeight));this.crawlAnchors.front.push(anchor(f.side*.13,f.side===this.leadFootSide?.24:f.base.z+.12,f.ankleHeight));}
  }
  emerge(dt){
    const e=this.e,t=clamp(e.time,0,5.5);if(!this.crawlAnchors)this.beginEmerge();
    for(const [name,q]of e.rest)this.bones.get(name).quaternion.copy(q);
    this.pelvis.position.copy(this.rootRest);e.visual.position.copy(this.visualRest);e.actor.updateMatrixWorld(true);
    const breach=ease(t/1.2),drag=ease((t-1.2)/1.5),kneel=ease((t-2.7)/1),rise=ease((t-3.7)/1.8);
    const height=lerp(lerp(lerp(-.85,-.25,breach),.34,drag),.42,kneel)*(1-rise)+(this.basePelvis.y-.075)*rise;
    const z=lerp(.0,-.07,drag)*(1-rise),root=this.toWorld(V(this.basePelvis.x,height,z));
    this.pelvis.position.copy(this.pelvis.parent.worldToLocal(root));e.actor.updateMatrixWorld(true);
    const bend=lerp(1.5,1.30,kneel)*(1-rise)+.145*rise,flinch=Math.exp(-e.hitAge*12)*.05;
    this.rotate(4,V(1,0,0),bend*.32-flinch);this.rotate(5,V(1,0,0),bend*.24);this.rotate(6,V(1,0,0),bend*.44);
    this.rotate(6,V(0,0,1),Math.sin(t*1.8+e.id)*.025*(1-rise));
    this.rotate(77,V(1,0,0),-.45*(1-rise)-.035*rise);this.rotate(77,V(0,0,1),-.075);
    this.rotate(84,V(1,0,0),.025+.20*(e.vocalLevel||0));
    const plans=this.arms.map((a,i)=>{
      const lead=i===this.leadArmIndex,contact=this.crawlAnchors.hands[i].clone(),reach=ease((t-(lead?.08:.35))/.65),release=ease((t-(lead?3.0:2.35))/(lead?1.05:.95));
      contact.y=lerp(contact.y-.5,contact.y,reach);return {a,contact,reach,release};
    });
    const handTarget=plan=>{
      const a=plan.a,shoulder=this.local(a.shoulder),guard=this.toWorld(shoulder.clone().add(V(a.side*.035,a.side<0?-.19:-.27,a.side<0?.49:.45)));
      return plan.contact.clone().lerp(guard,plan.release);
    };
    // The planted palms support the body. Lower the root to the measured arm
    // reach before solving elbows; never stretch an arm or lift a planted hand.
    for(let pass=0;pass<2;pass++){
      let drop=0;
      for(const plan of plans){if(plan.release>.995)continue;const a=plan.a,shoulder=this.world(a.shoulder),target=handTarget(plan),horizontal=Math.hypot(shoulder.x-target.x,shoulder.z-target.z),reach=a.upper+a.lower-.004;
        const maxY=target.y+Math.sqrt(Math.max(.005,reach*reach-horizontal*horizontal));drop=Math.max(drop,(shoulder.y-maxY)/Math.max(.05,1-plan.release));}
      if(drop<=.0001)break;const root=this.world(3);root.y-=drop;this.pelvis.position.copy(this.pelvis.parent.worldToLocal(root));e.actor.updateMatrixWorld(true);
    }
    const hands=[];
    for(let i=0;i<this.arms.length;i++){
      const {a,reach,release}=plans[i],target=handTarget(plans[i]);
      this.solve(a.shoulder,a.elbow,a.hand,target,a.upper,a.lower,V(a.side,-.15,-.2));this.wrist(a,.32*release,.08+.92*release);
      hands.push({side:a.side,planted:reach===1&&release===0,target:target.toArray(),position:this.world(a.hand).toArray(),lockError:this.world(a.hand).distanceTo(target)});
    }
    for(let i=0;i<this.legs.length;i++){
      const f=this.legs[i],rear=this.crawlAnchors.rear[i].clone(),u=f.side===this.leadFootSide?ease((t-2.3)/.95):ease((t-3.65)/1.05),uncover=ease((t-.7)/1.8);
      rear.y-=.65*(1-uncover);f.target.copy(rear).lerp(this.crawlAnchors.front[i],u);f.target.y+=Math.sin(Math.PI*u)*.12;
      f.swing=u<1;f.rotation.copy(e.actor.quaternion);
      this.solve(f.hip,f.knee,f.ankle,f.target,f.upper,f.lower,u<.3?V(f.side*.08,-.85,.3):V(f.side*.06,0,1));
      const dir=V(0,-.78,-.62).normalize().lerp(f.restDir,u).normalize().applyQuaternion(e.actor.quaternion);this.aim(f.ankle,f.toe,this.world(f.ankle).add(dir));
    }
    e.actor.updateMatrixWorld(true);
    this.lastPosition.copy(e.actor.position);
    this.emergence={stage:t<1.2?'破土':t<2.7?'双手撑地':t<3.7?'单膝跪起':'推地站稳',progress:t/5.5,rootHeight:this.local(3).y,hands,headHeight:this.world(77).y-e.actor.position.y,feet:this.legs.map(f=>({side:f.side,planted:!f.swing,position:this.world(f.ankle).toArray(),target:f.target.toArray(),lockError:this.world(f.ankle).distanceTo(f.target)}))};
  }
  finishEmerge(){
    this.transition=new Map([...this.bones].map(([name,b])=>[name,b.quaternion.clone()]));this.transitionAge=0;this.state='idle';this.travel=0;this.blend=0;this.lastPosition.copy(this.e.actor.position);
    this.rootOffset.copy(this.local(3).sub(this.basePelvis));
    for(const f of this.legs){f.anchor.copy(f.target);f.swing=false;f.settling=false;f.rotation.copy(this.e.actor.quaternion);}
    this.emergence=null;this.crawlAnchors=null;
  }
  update(dt){
    if(this.e.state==='emerge'){this.emerge(dt);return;}
    const e=this.e,delta=e.actor.position.clone().sub(this.lastPosition);delta.y=0;this.lastPosition.copy(e.actor.position);
    const moving=e.state==='chase'&&delta.length()>.00001;
    if(moving)this.travel+=delta.length()/STRIDE;
    this.age+=dt;this.blend=lerp(this.blend,e.state==='chase'?1:0,1-Math.exp(-dt*5));
    if(this.state!==e.state){this.state=e.state;this.transition=new Map([...this.bones].map(([name,b])=>[name,b.quaternion.clone()]));this.transitionAge=0;}
    this.transitionAge+=dt;
    for(const [name,q]of e.rest)this.bones.get(name).quaternion.copy(q);
    this.pelvis.position.copy(this.rootRest);e.visual.position.copy(this.visualRest);e.actor.updateMatrixWorld(true);
    this.feet(dt,moving);
    const cycle=this.travel*Math.PI*2,sway=Math.sin(cycle),attack=e.state==='attack',t=e.time,side=e.attacks%2===0?1:-1;
    const coil=attack?ease(t/.72):0,hit=attack?ease((t-.94)/.18):0,follow=attack?ease((t-1.12)/.26):0,back=attack?ease((t-1.4)/1):0;
    const intensity=coil*(1-back),strike=hit*(1-back),hurt=e.state==='stagger'?Math.sin(Math.PI*clamp(t/.48,0,1)):0;
    const idle=e.state==='idle',cry=e.roarAmount||0,vocal=e.vocalLevel||0,breath=Math.sin(this.age*1.6+e.id*1.3),idleSway=Math.sin(this.age*.63+e.id);
    const groundAverage=this.legs.reduce((s,f)=>s+f.target.y-f.ankleHeight,0)/2;
    const desired=V(sway*.012*this.blend+(idle?idleSway*.022:0),groundAverage-e.actor.position.y-.055+Math.cos(cycle*2)*.006*this.blend+(idle?breath*.012:0),-.035*intensity+.09*strike+(idle?Math.sin(this.age*.8+e.id)*.018:0));
    if(dt===0)this.rootOffset.copy(desired);else this.rootOffset.lerp(desired,1-Math.exp(-dt*18));
    const root=this.toWorld(this.basePelvis.clone().add(this.rootOffset));this.pelvis.position.copy(this.pelvis.parent.worldToLocal(root));e.actor.updateMatrixWorld(true);
    this.rotate(3,V(0,0,1),-.018*sway*this.blend);
    this.rotate(4,V(1,0,0),.045-.055*intensity+.095*strike-.10*hurt+breath*.012-cry*.035);
    this.rotate(5,V(0,1,0),side*(-.14*intensity+.34*strike));
    this.rotate(6,V(1,0,0),.10+.035*this.blend+.06*strike-.12*hurt+cry*.08+breath*.009);
    this.rotate(6,V(0,1,0),.018*sway*this.blend+(idle?.035*idleSway:0));
    this.rotate(77,V(0,0,1),-.075+.035*Math.sin(this.age*.9+e.id)+cry*.035*Math.sin(this.age*7));
    this.rotate(77,V(1,0,0),-.035+.05*intensity-.14*cry);
    this.rotate(84,V(1,0,0),.025+.32*vocal);
    for(const arm of this.arms){
      const dominant=arm.side===side;
      const shoulder=this.local(arm.shoulder);
      const guard=shoulder.clone().add(V(arm.side*.035,-(arm.side<0?.19:.27),lerp(arm.side<0?.49:.45,arm.side<0?.54:.49,this.blend)));
      let target=guard.clone();
      if(idle){target.x+=arm.side*.018*Math.sin(this.age*.8+e.id);target.y+=cry*.09;target.z+=cry*.055;}
      if(attack&&dominant){
        const wind=shoulder.clone().add(V(side*.18,-.05,-.16));
        const reach=shoulder.clone().add(V(-side*.10,-.21,.54));
        const through=shoulder.clone().add(V(-side*.45,-.45,.35));
        target.lerp(wind,coil).lerp(reach,hit).lerp(through,follow).lerp(guard,back);
      }else if(attack){target.z+=.05*strike;target.y-=.07*intensity;}
      target.y+=.012*Math.sin(this.age*1.3+arm.side+e.id)-.06*hurt;
      this.solve(arm.shoulder,arm.elbow,arm.hand,this.toWorld(target),arm.upper,arm.lower,V(arm.side,-.4,-.05));
      this.wrist(arm,.32+.1*hurt);
    }
    // Smooth upper-body state changes. Leg IK runs afterwards, so feet remain locked.
    if(this.transition&&this.transitionAge<.18){
      const u=ease(this.transitionAge/.18);
      for(const [name,b]of this.bones){const n=Number(name.slice(-3));if(n>=4&&n<89&&this.transition.has(name))b.quaternion.slerpQuaternions(this.transition.get(name),b.quaternion.clone(),u);}
      e.actor.updateMatrixWorld(true);
    }
    let drop=0;
    for(const f of this.legs){
      const hip=this.world(f.hip),horizontal=Math.hypot(hip.x-f.target.x,hip.z-f.target.z),length=f.upper+f.lower-.003;
      const allowed=f.target.y+Math.sqrt(Math.max(.01,length*length-horizontal*horizontal));drop=Math.max(drop,hip.y-allowed);
    }
    if(drop>0){const p=this.world(3);p.y-=Math.min(.09,drop+.001);this.pelvis.position.copy(this.pelvis.parent.worldToLocal(p));e.actor.updateMatrixWorld(true);}
    for(const f of this.legs){
      this.solve(f.hip,f.knee,f.ankle,f.target,f.upper,f.lower,V(f.side*.06,0,1));
      const dir=f.restDir.clone().applyQuaternion(f.rotation);
      if(f.swing&&!f.settling){const u=(f.phase-STANCE)/(1-STANCE);dir.applyAxisAngle(V(1,0,0).applyQuaternion(f.rotation),-.07*Math.sin(Math.PI*u));}
      this.aim(f.ankle,f.toe,this.world(f.ankle).add(dir));
    }
    e.actor.updateMatrixWorld(true);
    this.maxLockError=Math.max(this.maxLockError,...this.legs.filter(f=>!f.swing).map(f=>this.world(f.ankle).distanceTo(f.target)));
  }
  get stats(){
    return {type:'world-space foot-plant IK zombie shamble',stride:STRIDE,travel:this.travel,contacts:this.contacts,maxLockError:this.maxLockError,emergence:this.emergence,idleVocal:{roar:this.e.roarAmount||0,mouth:this.e.vocalLevel||0},
      feet:this.legs.map(f=>({side:f.side,planted:!f.swing,phase:f.phase,hip:this.world(f.hip).toArray(),knee:this.world(f.knee).toArray(),ankle:this.world(f.ankle).toArray(),toe:this.world(f.toe).toArray(),target:f.target.toArray(),lockError:this.world(f.ankle).distanceTo(f.target),soleHeight:this.world(f.ankle).y-f.ankleHeight-this.nav.ground(f.target.x,f.target.z),flatnessDegrees:THREE.MathUtils.radToDeg(this.world(f.toe).sub(this.world(f.ankle)).normalize().angleTo(f.restDir.clone().applyQuaternion(f.rotation)))})),
      hands:this.arms.map(a=>this.local(a.hand).toArray()),pelvis:this.local(3).toArray()};
  }
}
