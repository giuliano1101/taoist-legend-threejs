import * as THREE from 'three';

export function protectCloth(body,model,material,navigation){
  const g=body.geometry,ids=g.attributes.skinIndex,weights=g.attributes.skinWeight,mask=new Float32Array(ids.count);
  for(let i=0;i<ids.count;i++){
    let w=0;for(let j=0;j<4;j++){const n=body.skeleton.bones[ids.getComponent(i,j)]?.name||'';if(/^Bone/.test(n)&&!/^Bone0(59|60|61|96)$/.test(n))w+=weights.getComponent(i,j);}
    mask[i]=w>.18?1:0;
  }
  g.setAttribute('clothMask',new THREE.BufferAttribute(mask,1));
  const pairs=[['L_Thigh','L_Calf',.145],['R_Thigh','R_Calf',.145],['L_Calf','L_Foot',.108],['R_Calf','R_Foot',.108],['Pelvis','Spine',.205],['L_UpperArm','L_Forearm',.105],['R_UpperArm','R_Forearm',.105]];
  const a=pairs.map(()=>new THREE.Vector3()),b=pairs.map(()=>new THREE.Vector3()),r=new Float32Array(pairs.length);
  const navData=new Float32Array(navigation.cols*navigation.rows*4);
  for(let i=0;i<navigation.walk.length;i++){navData[i*4]=navigation.camera[i];navData[i*4+1]=navigation.heights[i];}
  const navTexture=new THREE.DataTexture(navData,navigation.cols,navigation.rows,THREE.RGBAFormat,THREE.FloatType);navTexture.needsUpdate=true;
  const worldToLocal=new THREE.Matrix4(),center=new THREE.Vector2();
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,{clothA:{value:a},clothB:{value:b},clothR:{value:r},clothNavigation:{value:navTexture},clothNavOrigin:{value:new THREE.Vector2(...navigation.origin)},clothNavSize:{value:new THREE.Vector2(navigation.cols*navigation.cellSize,navigation.rows*navigation.cellSize)},clothInverse:{value:worldToLocal},clothCenter:{value:center}});
    shader.vertexShader='attribute float clothMask; uniform vec3 clothA[7]; uniform vec3 clothB[7]; uniform float clothR[7];uniform sampler2D clothNavigation;uniform vec2 clothNavOrigin,clothNavSize,clothCenter;uniform mat4 clothInverse;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <skinning_vertex>',`#include <skinning_vertex>
      if(clothMask>.5){
        for(int ci=0;ci<7;ci++){
          vec3 ab=clothB[ci]-clothA[ci];float h=clamp(dot(transformed-clothA[ci],ab)/max(dot(ab,ab),.00001),0.,1.);
          vec3 cp=clothA[ci]+ab*h, away=transformed-cp;float cd=length(away);
          if(cd<clothR[ci]&&cd>.0001)transformed=cp+away*(clothR[ci]/cd);
        }
        vec3 cw=(modelMatrix*vec4(transformed,1.)).xyz;
        vec2 cuv=(cw.xz-clothNavOrigin)/clothNavSize;
        if(texture2D(clothNavigation,cuv).r<.5||any(lessThan(cuv,vec2(0.)))||any(greaterThan(cuv,vec2(1.)))){
          vec2 origin=cw.xz;float lo=0.,hi=1.;
          for(int j=0;j<8;j++){float mid=(lo+hi)*.5;vec2 p=mix(clothCenter,origin,mid),uv=(p-clothNavOrigin)/clothNavSize;if(texture2D(clothNavigation,uv).r>.5&&all(greaterThanEqual(uv,vec2(0.)))&&all(lessThanEqual(uv,vec2(1.))))lo=mid;else hi=mid;}
          cw.xz=mix(clothCenter,origin,max(0.,lo-.02));
        }
        cw.y=max(cw.y,texture2D(clothNavigation,(cw.xz-clothNavOrigin)/clothNavSize).g+.018);
        transformed=(clothInverse*vec4(cw,1.)).xyz;
      }`);
  };
  material.customProgramCacheKey=()=> 'taoist-capsule-cloth-v3';
  let updates=0;
  function update(){
    body.updateWorldMatrix(true,false);const s=new THREE.Vector3();body.getWorldScale(s);const unit=Math.max(Math.abs(s.x),Math.abs(s.y),Math.abs(s.z));
    worldToLocal.copy(body.matrixWorld).invert();const hip=model.getObjectByName('Bip001_Pelvis').getWorldPosition(new THREE.Vector3());center.set(hip.x,hip.z);
    for(let i=0;i<pairs.length;i++){
      model.getObjectByName('Bip001_'+pairs[i][0]).getWorldPosition(a[i]);body.worldToLocal(a[i]);
      model.getObjectByName('Bip001_'+pairs[i][1]).getWorldPosition(b[i]);body.worldToLocal(b[i]);r[i]=(pairs[i][2]+.018)/unit;
    }updates++;
  }
  return {update,get stats(){return {capsules:7,wallAndFloorCollision:true,protectedVertices:mask.reduce((n,v)=>n+v,0),updates};}};
}
