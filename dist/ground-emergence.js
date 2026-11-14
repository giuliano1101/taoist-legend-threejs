import * as THREE from 'three';
export class GroundEmergence{
  constructor(scene,navigation){
    Object.assign(this,{scene,navigation});this.holes=new Map();this.chunks=[];this.dust=[];this.emissions=0;
    this.clods=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(.055,0),new THREE.MeshStandardMaterial({color:0x594a36,roughness:1}),256);this.clods.count=0;this.clods.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.clods.frustumCulled=false;scene.add(this.clods);this.dummy=new THREE.Object3D();
    this.dustGeometry=new THREE.BufferGeometry();this.positions=new Float32Array(160*3);this.sizes=new Float32Array(160);this.alphas=new Float32Array(160);
    this.dustGeometry.setAttribute('position',new THREE.BufferAttribute(this.positions,3));this.dustGeometry.setAttribute('pSize',new THREE.BufferAttribute(this.sizes,1));this.dustGeometry.setAttribute('pAlpha',new THREE.BufferAttribute(this.alphas,1));
    const material=new THREE.ShaderMaterial({uniforms:{viewport:{value:800}},transparent:true,depthWrite:false,
      vertexShader:'attribute float pSize,pAlpha;uniform float viewport;varying float opacity;void main(){opacity=pAlpha;vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=min(140.,pSize*projectionMatrix[1][1]*viewport*.5/max(.1,-p.z));}',
      fragmentShader:'varying float opacity;void main(){vec2 p=gl_PointCoord*2.-1.;float n=.72+.28*sin(p.x*13.+sin(p.y*17.));float a=(1.-smoothstep(.1,1.,length(p)))*opacity*n;gl_FragColor=vec4(.12,.105,.08,a);}'
    });
    this.points=new THREE.Points(this.dustGeometry,material);this.points.frustumCulled=false;this.points.onBeforeRender=renderer=>material.uniforms.viewport.value=renderer.getDrawingBufferSize(new THREE.Vector2()).y;scene.add(this.points);
  }
  start(e){
    let hole=this.holes.get(e.id);
    if(!hole){
      const mat=new THREE.ShaderMaterial({uniforms:{opening:{value:0},fade:{value:1},seed:{value:e.id*1.71}},transparent:true,depthWrite:false,side:THREE.DoubleSide,
        vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader:`varying vec2 vUv;uniform float opening,fade,seed;void main(){vec2 p=(vUv-.5)*2.;float a=atan(p.y,p.x),r=length(p);float rim=.65+.055*sin(a*7.+seed)+.04*sin(a*13.-seed);float edge=1.-smoothstep(rim*opening,rim*opening+.12,r);float inner=1.-smoothstep(rim*opening-.12,rim*opening,r);vec3 colour=mix(vec3(.055,.041,.026),vec3(.005,.009,.007),inner);float cracks=pow(max(0.,sin(a*17.+seed)),25.)*smoothstep(.35,.7,r)*(1.-smoothstep(.8,1.,r))*opening;gl_FragColor=vec4(colour,max(edge*.86,cracks*.36)*fade);}`});
      const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1.25,1.5,10,12),mat);mesh.geometry.rotateX(-Math.PI/2);mesh.renderOrder=2;mesh.frustumCulled=false;this.scene.add(mesh);hole={mesh,closing:0};this.holes.set(e.id,hole);
    }
    const p=hole.mesh.geometry.attributes.position;
    for(let i=0;i<p.count;i++)p.setY(i,this.navigation.ground(e.actor.position.x+p.getX(i),e.actor.position.z+p.getZ(i))+.014);
    p.needsUpdate=true;hole.mesh.position.set(e.actor.position.x,0,e.actor.position.z);hole.mesh.material.uniforms.opening.value=0;hole.mesh.material.uniforms.fade.value=1;hole.mesh.visible=true;hole.closing=0;
  }
  progress(e,t){const h=this.holes.get(e.id);if(h)h.mesh.material.uniforms.opening.value=THREE.MathUtils.smoothstep(t,0,.9);}
  finish(e){const h=this.holes.get(e.id);if(h)h.closing=2.5;}
  emit(position,power=1){
    this.emissions++;
    for(let i=0;i<7&&this.chunks.length<250;i++)this.chunks.push({p:position.clone(),v:new THREE.Vector3((Math.random()-.5)*1.5,.7+Math.random()*1.7,(Math.random()-.5)*1.5).multiplyScalar(power),r:new THREE.Vector3(Math.random()*5,Math.random()*5,Math.random()*5),size:.45+Math.random()*.7,life:2.8});
    for(let i=0;i<6&&this.dust.length<155;i++)this.dust.push({p:position.clone(),v:new THREE.Vector3((Math.random()-.5)*.32,.12+Math.random()*.18,(Math.random()-.5)*.32),size:.1+Math.random()*.18,life:1.5,max:1.5});
  }
  update(dt,active){
    if(!active)return;
    for(const h of this.holes.values())if(h.closing>0){h.closing=Math.max(0,h.closing-dt);h.mesh.material.uniforms.fade.value=Math.min(1,h.closing/1.4);if(h.closing===0)h.mesh.visible=false;}
    for(let i=this.chunks.length-1;i>=0;i--){const o=this.chunks[i];o.life-=dt;if(o.life<=0){this.chunks.splice(i,1);continue;}o.v.y-=dt*7.5;o.p.addScaledVector(o.v,dt);const floor=this.navigation.ground(o.p.x,o.p.z)+.025;if(o.p.y<floor){o.p.y=floor;o.v.y=Math.abs(o.v.y)*.18;o.v.x*=.65;o.v.z*=.65;}o.r.x+=dt*o.v.length();o.r.z+=dt*o.v.length()*.8;}
    this.clods.count=this.chunks.length;
    for(let i=0;i<this.chunks.length;i++){const o=this.chunks[i];this.dummy.position.copy(o.p);this.dummy.rotation.set(...o.r.toArray());this.dummy.scale.setScalar(o.size*Math.min(1,o.life/.6));this.dummy.updateMatrix();this.clods.setMatrixAt(i,this.dummy.matrix);}this.clods.instanceMatrix.needsUpdate=true;
    for(let i=this.dust.length-1;i>=0;i--){const o=this.dust[i];o.life-=dt;if(o.life<=0){this.dust.splice(i,1);continue;}o.p.addScaledVector(o.v,dt);o.size+=dt*.18;}
    for(let i=0;i<this.dust.length;i++){const o=this.dust[i];o.p.toArray(this.positions,i*3);this.sizes[i]=o.size;this.alphas[i]=Math.sin(o.life/o.max*Math.PI)*.13;}
    this.dustGeometry.setDrawRange(0,this.dust.length);for(const a of Object.values(this.dustGeometry.attributes))a.needsUpdate=true;
  }
  reset(){for(const h of this.holes.values())h.mesh.visible=false;this.chunks=[];this.dust=[];this.clods.count=0;this.dustGeometry.setDrawRange(0,0);this.emissions=0;}
  get stats(){return {holes:[...this.holes.values()].filter(h=>h.mesh.visible).length,chunks:this.chunks.length,dust:this.dust.length,emissions:this.emissions};}
}
