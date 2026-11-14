import * as THREE from 'three';
import { FBXLoader } from './vendor/loaders/FBXLoader.js';
import {makeLocomotion} from './locomotion.js';
import {protectCloth} from './cloth.js';
import {taoistSurface} from './materials.js';

// This asset's original FBX bind matrices are preserved. Rebinding through a
// different DCC importer changes its Biped skin, so load the supplied FBX directly.
export async function loadTaoist(onProgress,navigation) {
  const manager=new THREE.LoadingManager();
  manager.setURLModifier(url=>/\.(png|jpg|jpeg)$/i.test(url)
    ? (/weapon|武器|剑/i.test(url)?'./assets/taoist-source/weapon.png':'./assets/taoist-source/diffuse.png') : url);
  const model=await new FBXLoader(manager).loadAsync('./assets/taoist-source/skin.fbx',onProgress);
  const textures=await Promise.all(['diffuse','weapon'].map(n=>new THREE.TextureLoader().loadAsync(`./assets/taoist-source/${n}.png`)));
  textures.forEach(t=>{t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;});
  const normals=await Promise.all(['normal','weapon-normal'].map(n=>new THREE.TextureLoader().loadAsync(`./assets/taoist-source/${n}.png`)));
  normals.forEach(t=>{t.colorSpace=THREE.NoColorSpace;t.anisotropy=4;});
  const materials=textures.map((map,i)=>new THREE.MeshPhysicalMaterial({map,normalMap:normals[i],normalScale:new THREE.Vector2(.68,.68),color:0xf4f1e8,roughness:.82,metalness:.015,specularIntensity:.38,sheen:.18,sheenRoughness:.8,sheenColor:new THREE.Color(0xb7c3b4),envMapIntensity:.7,side:THREE.DoubleSide}));
  let swordSource;
  model.traverse(o=>{if(o.isMesh&&o.name!=='body'){o.geometry.computeBoundingBox();const size=o.geometry.boundingBox.getSize(new THREE.Vector3());if(!swordSource&&o.geometry.attributes.position.count===1920&&size.y>15&&size.x<4)swordSource=o;}});
  if(!swordSource)throw new Error('The original prop sword geometry is missing');
  const swordGeometry=swordSource.geometry.clone(),swordSize=swordGeometry.boundingBox.getSize(new THREE.Vector3()).y,swordScale=1.3/swordSize;
  swordGeometry.translate(0,-.6,0);swordGeometry.rotateZ(Math.PI);swordGeometry.scale(swordScale,swordScale,swordScale);swordGeometry.computeBoundingBox();
  const swordMaterial=materials[1].clone();swordMaterial.metalness=.76;swordMaterial.roughness=.29;swordMaterial.sheen=0;swordMaterial.envMapIntensity=1;swordMaterial.color.set(0xe5eeeb);
  const weapon={geometry:swordGeometry,material:swordMaterial,bladeBase:.14,bladeTip:swordGeometry.boundingBox.max.y,source:'道士_Skin.FBX / 道士武器_剑'};
  model.traverse(o=>{if(o.isLight)o.visible=false;if(o.isMesh){o.material=materials[o.name==='body'?0:1];o.castShadow=true;o.frustumCulled=false;if(o.name!=='body')o.visible=false;}});
  const native=model.animations[0];
  if(!native)throw new Error('The supplied character has no animation timeline');
  const mixer=new THREE.AnimationMixer(model),reference=mixer.clipAction(native);
  reference.play();mixer.setTime(650/30);model.updateMatrixWorld(true);
  const body=model.getObjectByName('body');body.skeleton.update();body.computeBoundingBox();
  const bounds=body.boundingBox.clone().applyMatrix4(body.matrixWorld);
  const scale=2.14/bounds.getSize(new THREE.Vector3()).y;
  const pelvis=model.getObjectByName('Bip001_Pelvis');
  const lateral=model.getObjectByName('Bip001_L_Thigh').getWorldPosition(new THREE.Vector3()).sub(model.getObjectByName('Bip001_R_Thigh').getWorldPosition(new THREE.Vector3()));
  const forwardCorrection=Math.atan2(lateral.z,lateral.x);
  const footNames=['Bip001_L_Toe0','Bip001_R_Toe0','Bip001_L_Foot','Bip001_R_Foot'];
  let feet=footNames.slice(0,2).map(n=>model.getObjectByName(n)).filter(Boolean);
  if(feet.length!==2)feet=footNames.slice(2).map(n=>model.getObjectByName(n)).filter(Boolean);
  const sourceFootY=Math.min(...feet.map(b=>b.getWorldPosition(new THREE.Vector3()).y));
  const soleOffset=(sourceFootY-bounds.min.y)*scale;
  const baseline=new Map();
  for(const track of native.tracks){
    const split=track.name.lastIndexOf('.'),name=track.name.slice(0,split),property=track.name.slice(split+1),node=model.getObjectByName(name);
    if(node&&node[property]?.toArray)baseline.set(track.name,{name,property,node,value:node[property].toArray()});
  }
  const parents=new Map();
  model.traverse(n=>{if(n.isBone)parents.set(n.name,n.parent.getWorldQuaternion(new THREE.Quaternion()).invert());});
  const makePoseClip=(name,duration)=>{
    const count=Math.round(duration*30),times=Array.from({length:count+1},(_,i)=>i/count*duration),tracks=[];
    for(const [key,base] of baseline){
      const animate=base.property==='quaternion'&&base.node.isBone;
      const values=[];
      if(!animate){
        const C=base.property==='quaternion'?THREE.QuaternionKeyframeTrack:THREE.VectorKeyframeTrack;
        tracks.push(new C(key,[0,duration],[...base.value,...base.value]));continue;
      }
      const qBase=new THREE.Quaternion().fromArray(base.value),invParent=parents.get(base.name),parent=invParent.clone().invert();
      const isLeft=base.name.includes('_L_'),side=isLeft?1:-1;
      const wp=base.node.getWorldPosition(new THREE.Vector3());
      const cloth=base.name.startsWith('Bone')&&wp.y<pelvis.getWorldPosition(new THREE.Vector3()).y;
      for(let i=0;i<=count;i++){
        const u=i/count,phase=u*Math.PI*2,p=phase+(isLeft?0:Math.PI);
        let angle=0,axis=new THREE.Vector3(1,0,0);
        if(name==='Walk'||name==='Run'){
          const run=name==='Run',swing=Math.sin(p)*(run?.62:.32),knee=Math.max(0,-Math.sin(p))*(run?.8:.46);
          if(/_(L|R)_Thigh$/.test(base.name))angle=-swing;
          else if(/_(L|R)_Calf$/.test(base.name))angle=knee;
          else if(/_(L|R)_Foot$/.test(base.name))angle=swing*.55-knee*.65;
          else if(/_(L|R)_UpperArm$/.test(base.name))angle=swing*(run?.55:.65);
          else if(/_(L|R)_Forearm$/.test(base.name))angle=run?-.1-.12*Math.sin(p):-.05;
          else if(base.name==='Bip001_Spine')angle=(run?.10:.025)+.015*Math.cos(phase*2);
          else if(cloth)angle=.028*Math.sin(phase+(wp.x>0?0:Math.PI));
        }else if(name==='Jump'){
          const lift=Math.sin(Math.PI*u);
          if(/_(L|R)_Thigh$/.test(base.name))angle=-.35*lift;
          else if(/_(L|R)_Calf$/.test(base.name))angle=.7*lift;
          else if(/_(L|R)_UpperArm$/.test(base.name))angle=-.3*lift;
          else if(cloth)angle=-.06*lift;
        }else if(base.name==='Bip001_Spine2')angle=.01*Math.sin(phase);
        const delta=new THREE.Quaternion().setFromAxisAngle(axis,angle);
        const localDelta=invParent.clone().multiply(delta).multiply(parent);
        localDelta.multiply(qBase).normalize().toArray(values,values.length);
      }
      tracks.push(new THREE.QuaternionKeyframeTrack(key,times,values));
    }
    return new THREE.AnimationClip(name,duration,tracks);
  };
  const proceduralJump=makePoseClip('Jump',.8),idle=makePoseClip('Idle',2.8);
  const locomotion=await makeLocomotion(model,baseline);
  const ranges=[['Cast',140,159],['Sword1',544,568],['Sword2',568,588],['Sword3',588,615],['Sword4',46,80]];
  const clips=[idle,...locomotion,...ranges.map(([n,a,b])=>THREE.AnimationUtils.subclip(native,n,a,b,30)),proceduralJump];
  reference.stop();mixer.stopAllAction();
  const normalizer=new THREE.Group();normalizer.scale.setScalar(scale);normalizer.rotation.y=forwardCorrection;normalizer.add(model);
  const visual=new THREE.Group();visual.name='TaoistCharacter';visual.add(normalizer);
  const temp=new THREE.Vector3(),localFoot=new THREE.Vector3();
  const cloth=protectCloth(body,model,materials[0],navigation);
  const regions=await new THREE.TextureLoader().loadAsync('./assets/taoist-source/surface-mask.png');regions.colorSpace=THREE.NoColorSpace;
  taoistSurface(body,materials[0],regions);
  function settle(player){
    visual.position.set(0,0,0);player.updateMatrixWorld(true);
    pelvis.getWorldPosition(temp);player.worldToLocal(temp);
    let minFoot=Infinity;
    for(const foot of feet){foot.getWorldPosition(localFoot);player.worldToLocal(localFoot);minFoot=Math.min(minFoot,localFoot.y);}
    visual.position.set(-temp.x,soleOffset-minFoot,-temp.z);
    player.updateMatrixWorld(true);
    cloth.update();
  }
  function cameraDistance(distance){
    const opacity=THREE.MathUtils.clamp((distance-.9)/.9,0,1);
    visual.visible=opacity>.02;
    for(const material of materials){
      const transparent=opacity<.999;
      if(material.transparent!==transparent){material.transparent=transparent;material.depthWrite=!transparent;material.needsUpdate=true;}
      material.opacity=opacity;
    }
    return opacity;
  }
  let boneCount=0;model.traverse(n=>{if(n.isBone)boneCount++;});
  function handPosition(side='R'){return model.getObjectByName('Bip001_'+side+'_Hand').getWorldPosition(new THREE.Vector3());}
  function weaponPose(){return {position:handPosition('R'),quaternion:model.getObjectByName('weapon_jianke_1').getWorldQuaternion(new THREE.Quaternion()).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI))};}
  function elbowClearance(){return ['L','R'].map(side=>{const a=model.getObjectByName('Bip001_'+side+'_UpperArm').getWorldPosition(new THREE.Vector3()),b=model.getObjectByName('Bip001_'+side+'_Forearm').getWorldPosition(new THREE.Vector3());const v=b.sub(a).applyQuaternion(visual.parent?.getWorldQuaternion(new THREE.Quaternion()).invert()||new THREE.Quaternion());return {side,outward:Math.abs(v.x),drop:v.y};});}
  return {visual,model,mixer,clips,settle,cameraDistance,handPosition,weaponPose,elbowClearance,cloth,weapon,metadata:{source:'道士_Skin.FBX',boneCount,weightedBoneCount:body.skeleton.bones.length,height:2.14,scale,nativeAttackRanges:ranges,locomotion:'joint-direction retarget from Three.js Mixamo walking/running reference, open elbows',clothCollision:true,material:'MeshPhysicalMaterial',normalMaps:true,surfaceRegions:['skin','cloth','gold trim'],weapon:weapon.source}};
}
