import * as THREE from 'three';
const ARC=1.24,RADIUS=.97;
export const CRESCENT_ROLLS=[-.22,.27,-1.02,.84];

// The ribbon narrows continuously to zero at BOTH tips. Its leading edge bows
// forward rather than forming a constant-radius tube or a closed ring.
export function crescentPoint(u,v=.23,target=new THREE.Vector3()){
  const angle=(u*2-1)*ARC,taper=Math.pow(Math.max(0,Math.sin(Math.PI*u)),1.18);
  const width=.23*taper,radius=RADIUS+width*(.28-v*1.4);
  return target.set(Math.sin(angle)*radius,Math.cos(angle)*radius-Math.cos(ARC)*RADIUS,-.11*taper*v+.025*Math.sin(angle*2)*taper);
}
const vertex=`varying vec2 vUv;uniform float uAge,uSeed;
void main(){vUv=uv;vec3 p=position;float ends=sin(uv.x*3.14159265);
  p.z+=sin(uv.x*16.-uAge*11.+uSeed)*.014*ends;
  p.xy+=vec2(sin(uv.x*21.+uAge*8.+uSeed),cos(uv.x*18.-uAge*9.))*.004*ends;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
}`;
const fragment=`varying vec2 vUv;uniform float uAge,uFade,uSeed;
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
void main(){
  vec2 uv=vUv;float n=noise(vec2(uv.x*36.-uAge*3.,uAge*2.+uSeed));
  float ridge=.235+(n-.5)*.025;
  float core=exp(-pow(abs(uv.y-ridge)*52.,1.5));
  float body=exp(-pow((uv.y-.39)/.245,2.));
  float halo=exp(-pow((uv.y-.24)/.34,2.));
  float flow=noise(vec2(uv.x*58.-uAge*8.+uSeed,uv.y*11.+uAge*1.6));
  float strand=pow(.5+.5*sin(uv.y*67.+uv.x*10.-uAge*17.+n*4.+flow*3.5),13.);
  float breaks=smoothstep(.28,.76,noise(vec2(uv.x*25.-uAge*4.+uSeed,uv.y*17.+uAge*2.)));
  strand*=body*(.35+.65*flow)*breaks;
  float fringe=1.-smoothstep(.68,.99,uv.y+(flow-.5)*.16);
  float tip=pow(max(0.,sin(uv.x*3.14159265)),.55);
  float alpha=(.28*body*(.62+.38*flow)*fringe+.53*core+.14*strand+.055*halo)*tip*uFade;
  alpha*=smoothstep(0.,.065,uv.y)*(1.-smoothstep(.87,1.,uv.y));
  vec3 color=vec3(.12,.64,.43)+core*vec3(2.1,3.7,3.1)+strand*vec3(.18,1.2,.78);
  gl_FragColor=vec4(color,alpha);
}`;
export function createCrescent(seed=0,stage=0){
  const columns=128,rows=8,positions=[],uv=[],indices=[];
  for(let i=0;i<=columns;i++)for(let j=0;j<=rows;j++){
    const u=i/columns,v=j/rows;positions.push(...crescentPoint(u,v).toArray());uv.push(u,v);
  }
  for(let i=0;i<columns;i++)for(let j=0;j<rows;j++){
    const a=i*(rows+1)+j,b=a+rows+1;indices.push(a,b,a+1,b,b+1,a+1);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeBoundingSphere();
  const material=new THREE.ShaderMaterial({uniforms:{uAge:{value:0},uFade:{value:0},uSeed:{value:seed}},vertexShader:vertex,fragmentShader:fragment,transparent:true,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,depthWrite:false,depthTest:true});
  const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.userData.baseRoll=CRESCENT_ROLLS[stage%4];return mesh;
}
export function updateCrescent(mesh,age,remaining){
  const fadeIn=THREE.MathUtils.smoothstep(age,0,.065),fadeOut=THREE.MathUtils.smoothstep(remaining,0,.26);
  mesh.material.uniforms.uAge.value=age;mesh.material.uniforms.uFade.value=fadeIn*fadeOut;
  mesh.scale.setScalar(.88+.22*THREE.MathUtils.smoothstep(age,0,.72));
  return fadeIn*fadeOut;
}
