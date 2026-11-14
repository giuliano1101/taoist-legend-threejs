import * as THREE from 'three';

// Transfer joint directions rather than local rotations: Mixamo and Biped use
// different bone axes. The supplied skin/rest matrices remain untouched.
export async function makeLocomotion(model,baseline){
  const response=await fetch('./assets/locomotion-reference.json');if(!response.ok)throw new Error('Locomotion reference could not load');
  const reference=await response.json(),target=n=>model.getObjectByName('Bip001_'+n);
  const v=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
  const point=n=>n.getWorldPosition(new THREE.Vector3());
  function restore(){for(const b of baseline.values())b.node[b.property].fromArray(b.value);model.updateMatrixWorld(true);}
  restore();
  const tx=point(target('L_Thigh')).sub(point(target('R_Thigh')));tx.y=0;tx.normalize();const tz=new THREE.Vector3().crossVectors(tx,up).normalize();
  // The reference stance turns the head relative to the hips. Direction-only
  // retargeting cannot remove that axial twist from a nearly vertical neck.
  const head=target('Head'),headFacingOffset=Math.atan2(tx.z,tx.x);
  const transformDir=d=>tx.clone().multiplyScalar(d.x).addScaledVector(up,d.y).addScaledVector(tz,d.z).normalize();
  const specs=[['Pelvis','Spine','Hips','Spine'],['Spine','Spine1','Spine','Spine1'],['Spine1','Spine2','Spine1','Spine2'],['Spine2','Neck','Spine2','Neck'],['Neck','Head','Neck','Head']];
  for(const [side,s] of [['L','Left'],['R','Right']])specs.push(
    [side+'_Clavicle',side+'_UpperArm',s+'Shoulder',s+'Arm'],[side+'_UpperArm',side+'_Forearm',s+'Arm',s+'ForeArm'],[side+'_Forearm',side+'_Hand',s+'ForeArm',s+'Hand'],
    [side+'_Thigh',side+'_Calf',s+'UpLeg',s+'Leg'],[side+'_Calf',side+'_Foot',s+'Leg',s+'Foot'],[side+'_Foot',side+'_Toe0',s+'Foot',s+'ToeBase']);
  const map=specs.map(([a,b,c,d])=>({bone:target(a),child:target(b),index:reference.pairs.findIndex(([x,y])=>x===c&&y===d)})).filter(m=>m.bone&&m.child&&m.index>=0);
  for(const m of map){m.rest=point(m.child).sub(point(m.bone)).normalize();m.world=m.bone.getWorldQuaternion(new THREE.Quaternion());}
  const cloth=[];model.traverse(n=>{if(n.isBone&&/^Bone0(15|16|17|18|19|21|22|23|24|25)/.test(n.name))cloth.push({bone:n,base:n.quaternion.clone(),parent:n.parent.getWorldQuaternion(new THREE.Quaternion()),side:Math.sign(point(n).dot(tx))||1});});
  const clips=[];
  for(const name of ['Walk','Run']){
    const original=reference.motions[name];
    const duration=original.duration,count=original.frames.length-1,times=Array.from({length:count+1},(_,i)=>i/count*duration),values=new Map();
    for(const m of map)values.set(m.bone.name,[]);
    values.set(head.name,[]);
    for(const c of cloth)values.set(c.bone.name,[]);
    for(let i=0;i<=count;i++){
      restore();
      for(const m of map){
        let dir=transformDir(new THREE.Vector3().fromArray(original.frames[i][m.index]));
        // Leave room for the broad robe sleeves and preserve a bent, cycling
        // elbow. Forearms follow the arm swing rather than pointing rigidly ahead.
        if(/_UpperArm$/.test(m.bone.name)){
          const swing=dir.dot(tz),side=m.bone.name.includes('_L_')?1:-1;
          const run=name==='Run';
          dir=tx.clone().multiplyScalar(side*(run?.56:.30)).addScaledVector(up,run?-.80:-.92).addScaledVector(tz,swing*(run?1.12:1.0)).normalize();
        }else if(/_Forearm$/.test(m.bone.name)){
          const side=m.bone.name.includes('_L_')?1:-1;
          if(name==='Run'){
            const upper=map.find(a=>a.bone.name===m.bone.name.replace('Forearm','UpperArm'));
            const shoulderSwing=transformDir(new THREE.Vector3().fromArray(original.frames[i][upper.index])).dot(tz);
            const lift=THREE.MathUtils.clamp(.22+shoulderSwing*.8,-.32,.68);
            dir=tx.clone().multiplyScalar(side*.22).addScaledVector(up,lift).addScaledVector(tz,.88).normalize();
          }
          else dir.addScaledVector(tx,-dir.dot(tx)*.7).normalize();
        }
        const world=new THREE.Quaternion().setFromUnitVectors(m.rest,dir).multiply(m.world);
        m.bone.quaternion.copy(m.bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world));
        m.bone.updateMatrixWorld(true);
        m.bone.quaternion.toArray(values.get(m.bone.name),values.get(m.bone.name).length);
      }
      const headWorld=head.getWorldQuaternion(new THREE.Quaternion());
      const gaze=new THREE.Quaternion().setFromAxisAngle(up,-headFacingOffset).multiply(headWorld);
      head.quaternion.copy(head.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(gaze));head.updateMatrixWorld(true);
      head.quaternion.toArray(values.get(head.name),values.get(head.name).length);
      const phase=i/count*Math.PI*2;
      for(const c of cloth){
        const root=c.bone.parent.name==='Bip001_Pelvis',amp=root?(name==='Run'?.11:.055):.022;
        const air=new THREE.Quaternion().setFromEuler(new THREE.Euler((name==='Run'?.13:.035)+amp*Math.sin(phase-c.side*.7),0,c.side*(root?.10:.01)));
        c.bone.quaternion.copy(c.parent.clone().invert().multiply(air).multiply(c.parent).multiply(c.base));c.bone.updateMatrixWorld(true);
        c.bone.quaternion.toArray(values.get(c.bone.name),values.get(c.bone.name).length);
      }
    }
    const tracks=[];
    for(const [key,b] of baseline){
      const data=values.get(b.name);
      if(b.property==='quaternion'&&data)tracks.push(new THREE.QuaternionKeyframeTrack(key,times,data));
      else {const C=b.property==='quaternion'?THREE.QuaternionKeyframeTrack:THREE.VectorKeyframeTrack;tracks.push(new C(key,[0,duration],[...b.value,...b.value]));}
    }
    clips.push(new THREE.AnimationClip(name,duration,tracks));
  }
  restore();
  return clips;
}
