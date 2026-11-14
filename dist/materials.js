import * as THREE from 'three';
const ashShader=`varying vec3 vDissolvePosition,vEnemyWorld;uniform float dissolveAmount,hitFlash,groundClip;uniform sampler2D enemyTerrain;uniform vec2 enemyTerrainOrigin,enemyTerrainSize;
  float ashHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
  float ashNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(ashHash(i),ashHash(i+vec3(1,0,0)),f.x),mix(ashHash(i+vec3(0,1,0)),ashHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(ashHash(i+vec3(0,0,1)),ashHash(i+vec3(1,0,1)),f.x),mix(ashHash(i+vec3(0,1,1)),ashHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
`;
const ashTest=`float ash=ashNoise(vDissolvePosition*1.6)*.7+ashNoise(vDissolvePosition*4.5)*.3;
  float threshold=dissolveAmount*1.25-.1;
  if(dissolveAmount>0.&&ash<threshold)discard;`;
const groundTest=`if(groundClip>.5){float terrain=texture2D(enemyTerrain,(vEnemyWorld.xz-enemyTerrainOrigin)/enemyTerrainSize).r-.5;if(vEnemyWorld.y<terrain+.008)discard;}`;
function ashVertex(shader,uniforms){
  Object.assign(shader.uniforms,uniforms);
  shader.vertexShader='varying vec3 vDissolvePosition,vEnemyWorld;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvDissolvePosition=position;');
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvEnemyWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
  shader.fragmentShader=ashShader+shader.fragmentShader;
}

// A small, prefiltered radiance environment: cool sky, warm lantern bounce and
// dark walls. It lights all physical materials in the same colour space.
export function setupMaterialLighting(renderer,scene){
  const studio=new THREE.Scene();studio.background=new THREE.Color(0x121c19);
  const panel=(color,intensity,w,h,p)=>{
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide}));
    m.material.color.multiplyScalar(intensity);m.position.set(...p);m.lookAt(0,0,0);studio.add(m);
  };
  panel(0xb0ccc3,3.5,5,8,[0,7,0]);panel(0xc2c7ad,2,3,6,[4,3,4]);
  panel(0xff7542,2.5,1,3,[-3,2,-1]);panel(0x75aab2,1.2,2,5,[3,2,-4]);
  const generator=new THREE.PMREMGenerator(renderer),target=generator.fromScene(studio,.16,.1,40);
  scene.environment=target.texture;scene.environmentIntensity=.7;
  studio.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});generator.dispose();
  return target;
}

export function taoistSurface(body,material,regions){
  const g=body.geometry,ids=g.attributes.skinIndex,weights=g.attributes.skinWeight,skin=new Float32Array(ids.count);
  for(let i=0;i<ids.count;i++)for(let j=0;j<4;j++){
    if(/Head|Neck|Hand|Finger/.test(body.skeleton.bones[ids.getComponent(i,j)]?.name||''))skin[i]+=weights.getComponent(i,j);
  }
  g.setAttribute('skinSurface',new THREE.BufferAttribute(skin,1));
  const previous=material.onBeforeCompile;
  material.onBeforeCompile=function(shader,renderer){
    previous.call(this,shader,renderer);
    shader.uniforms.taoistRegions={value:regions};
    shader.vertexShader='attribute float skinSurface;varying float vSkinSurface;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvSkinSurface=skinSurface;');
    shader.fragmentShader='varying float vSkinSurface;uniform sampler2D taoistRegions;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      vec3 region=texture2D(taoistRegions,vMapUv).rgb;
      float skinRegion=max(smoothstep(.35,.85,vSkinSurface),smoothstep(.35,.75,region.b));
      roughnessFactor=mix(.85,.48,skinRegion);
    `).replace('#include <metalnessmap_fragment>',`#include <metalnessmap_fragment>
      float gilding=smoothstep(.25,.8,region.g)*(1.-skinRegion);
      metalnessFactor=mix(.015,.72,gilding);
      roughnessFactor=mix(roughnessFactor,.43,gilding);
    `);
  };
  material.customProgramCacheKey=()=> 'taoist-capsule-cloth-physical-v4';
}

export function enemyMaterial(source,uniforms){
  const hair=source.alphaTest>0;
  const material=new THREE.MeshPhysicalMaterial({
    name:source.name,map:source.map,normalMap:source.normalMap,normalScale:new THREE.Vector2(.7,.7),
    color:0xe5e7dc,roughness:hair?.82:.7,metalness:0,specularIntensity:.38,
    sheen:hair?.25:.12,sheenRoughness:.8,sheenColor:new THREE.Color(0xbfc9be),
    side:THREE.DoubleSide,alphaTest:hair?.38:0,envMapIntensity:.65
  });
  material.onBeforeCompile=shader=>{
    ashVertex(shader,uniforms);
    shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>','#include <alphatest_fragment>\n'+groundTest);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      float skinTint=smoothstep(.02,.16,diffuseColor.r-diffuseColor.b)*smoothstep(.04,.25,diffuseColor.r);
      roughnessFactor=mix(.83,.49,skinTint);
    `).replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
      ${ashTest}
      float edge=dissolveAmount>0.?1.-smoothstep(0.,.065,ash-threshold):0.;
      totalEmissiveRadiance+=vec3(.16,1.9,1.3)*edge+vec3(.9,.28,.12)*hitFlash;
    `);
  };
  material.customProgramCacheKey=()=> 'nurse-physical-dissolve-ground-v8';
  return material;
}

export function enemyDepthMaterial(source,uniforms){
  const material=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:source.map,alphaTest:source.alphaTest>0?.38:0,side:THREE.DoubleSide});
  material.onBeforeCompile=shader=>{
    ashVertex(shader,uniforms);
    shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>','#include <alphatest_fragment>\n'+groundTest+'\n'+ashTest);
  };
  material.customProgramCacheKey=()=> 'nurse-dissolve-shadow-ground-v8';
  return material;
}
