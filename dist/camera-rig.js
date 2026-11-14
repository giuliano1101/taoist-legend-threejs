import * as THREE from 'three';

// A shoulder boom follows the character, while the lens looks down the alley.
// The player is deliberately outside the centre ray used by every ranged shot.
export class ThirdPersonCamera{
  constructor(camera,navigation){this.camera=camera;this.navigation=navigation;this.anchor=new THREE.Vector3();this.boom=3.25;this.ready=false;this.shoulder=0;this.last={};}
  sweep(from,to){
    const n=this.navigation,length=from.distanceTo(to),steps=Math.max(1,Math.ceil(length/.035));
    for(let i=1;i<=steps;i++){
      const t=i/steps,p=new THREE.Vector3().lerpVectors(from,to,t),floor=n.ground(p.x,p.z);
      if(!n.canStand(p.x,p.z,true)||p.y<floor+.22||p.y>floor+4.25)return Math.max(0,(i-2)/steps);
    }return 1;
  }
  update(dt,{player,yaw,pitch,zoom,started,instant=false,compact=false}){
    const camera=this.camera,n=this.navigation;
    if(!started){
      this.anchor.copy(player.position).add(new THREE.Vector3(0,compact?.95:1.18,0));
      const d=zoom*(compact?1.3:1.14),back=new THREE.Vector3(Math.sin(yaw)*Math.cos(.1),.22,Math.cos(yaw)*Math.cos(.1)).multiplyScalar(d);
      const desired=this.anchor.clone().add(back),fraction=this.sweep(this.anchor,desired);
      camera.position.lerpVectors(this.anchor,desired,fraction);camera.lookAt(this.anchor);camera.updateMatrixWorld();this.ready=false;
      return {distance:camera.position.distanceTo(this.anchor)};
    }
    const eye=player.position.clone().add(new THREE.Vector3(0,compact?1.86:1.78,0));
    const snap=instant||!this.ready||this.anchor.distanceTo(eye)>4;
    this.anchor.set(eye.x,snap?eye.y:THREE.MathUtils.lerp(this.anchor.y,eye.y,1-Math.exp(-dt*18)),eye.z);
    if(!n.canStand(this.anchor.x,this.anchor.z,true))this.anchor.copy(eye);
    const forward=new THREE.Vector3(-Math.sin(yaw)*Math.cos(pitch),-Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
    const right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
    const shoulderLength=compact?.38:.78,requested=zoom*(compact?1.15:1);
    const desired=this.anchor.clone().addScaledVector(right,shoulderLength).addScaledVector(forward,-requested);
    // Retract the whole diagonal boom. Sliding just the shoulder toward the
    // spine would put the character back under the crosshair next to a wall.
    const safe=requested*this.sweep(this.anchor,desired);
    this.boom=snap||safe<this.boom?safe:THREE.MathUtils.lerp(this.boom,safe,1-Math.exp(-dt*5));
    this.shoulder=shoulderLength*this.boom/requested;
    camera.position.copy(this.anchor).addScaledVector(right,this.shoulder).addScaledVector(forward,-this.boom);
    // Converge slightly in front of the shoulder rather than looking at the body.
    const look=this.anchor.clone().addScaledVector(forward,7);
    camera.lookAt(look);camera.updateMatrixWorld();this.ready=true;
    const body=player.position.clone().add(new THREE.Vector3(0,1.35,0)).project(camera);
    this.last={mode:'over-shoulder',shoulder:this.shoulder,boom:this.boom,requested,bodyNdc:body.toArray(),pitch,collision:safe<requested-.03};
    return {distance:camera.position.distanceTo(this.anchor)};
  }
  aim(enemies,range=null){
    const origin=this.camera.position.clone(),direction=this.camera.getWorldDirection(new THREE.Vector3()),n=this.navigation;
    // Include the boom behind the caster so the centre ray can acquire every
    // reachable target. Keep explicit ranges available for preview callers.
    range??=n.projectileRange+origin.distanceTo(this.anchor);
    let distance=range,kind='range',enemyId=null;
    for(let t=.08;t<=range;t+=.045){
      const p=origin.clone().addScaledVector(direction,t),floor=n.ground(p.x,p.z);
      if(!n.canStand(p.x,p.z,true)||p.y<floor+.06||p.y>floor+4.35){distance=t;kind='wall';break;}
    }
    for(const e of enemies?.enemies||[]){
      if(e.hp<=0||e.targetable===false)continue;
      const ox=origin.x-e.actor.position.x,oz=origin.z-e.actor.position.z,a=direction.x**2+direction.z**2,b=2*(ox*direction.x+oz*direction.z),c=ox**2+oz**2-.31**2;
      const discriminant=b*b-4*a*c;if(a<.00001||discriminant<0)continue;
      for(const t of [(-b-Math.sqrt(discriminant))/(2*a),(-b+Math.sqrt(discriminant))/(2*a)]){
        const y=origin.y+direction.y*t-e.actor.position.y;
        if(t>.08&&t<distance&&y>.12&&y<(e.hitHeight??2.14)){distance=t;kind='enemy';enemyId=e.id;break;}
      }
    }
    return {origin,direction,point:origin.clone().addScaledVector(direction,distance),distance,kind,enemyId};
  }
  get stats(){return this.last;}
}
