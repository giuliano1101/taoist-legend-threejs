import * as THREE from 'three';
const vertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
// Use Gaussian alpha-weighted depth, never the navigation mesh silhouette.
const depthFunctions=`
  uniform sampler2D tSceneDepth,tSplatDepth;uniform vec2 nearFar;
  float linearDepth(float d){return nearFar.x*nearFar.y/(nearFar.y-d*(nearFar.y-nearFar.x));}
  float surfaceDepth(vec2 uv){
    float mesh=linearDepth(texture2D(tSceneDepth,uv).r);
    vec4 splat=texture2D(tSplatDepth,uv);
    float expected=splat.r/max(splat.a,.0001);
    float softDepth=mix(36.,clamp(expected,nearFar.x,36.),smoothstep(.08,.72,splat.a));
    return min(mesh,softDepth);
  }
`;
export class Atmosphere{
  constructor(renderer,camera,spark){
    Object.assign(this,{renderer,camera,spark});this.time=0;this.density=1.15;this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.color=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:true});this.color.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
    this.splatDepth=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false});
    this.fog=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false});
    this.depthMaterial=spark.material.clone();this.depthMaterial.uniforms=spark.material.uniforms;this.depthMaterial.depthTest=false;this.depthMaterial.depthWrite=false;this.depthMaterial.toneMapped=false;this.depthMaterial.allowOverride=false;
    this.depthMaterial.fragmentShader=this.depthMaterial.fragmentShader.replace(/if \(encodeLinear\) \{\s*rgba.rgb = srgbToLinear\(rgba.rgb\);\s*\}/,`float viewDepth=(2.0*near*far)/(far+near-vNdc.z*(far-near));rgba.rgb=vec3(viewDepth,0.,0.);`);
    const uniforms={tSceneDepth:{value:this.color.depthTexture},tSplatDepth:{value:this.splatDepth.texture},nearFar:{value:new THREE.Vector2(camera.near,camera.far)},invProjection:{value:camera.projectionMatrixInverse},cameraWorld:{value:camera.matrixWorld},cameraPositionWorld:{value:camera.position},uTime:{value:0},uDensity:{value:this.density},uLightPos:{value:Array.from({length:4},()=>new THREE.Vector3())},uLightColor:{value:Array.from({length:4},()=>new THREE.Vector3())}};
    this.fogMaterial=new THREE.ShaderMaterial({uniforms,vertexShader:vertex,depthTest:false,depthWrite:false,fragmentShader:`
      varying vec2 vUv;${depthFunctions}
      uniform mat4 invProjection,cameraWorld;uniform vec3 cameraPositionWorld;uniform float uTime,uDensity;uniform vec3 uLightPos[4],uLightColor[4];
      float hash3(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
      float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);}
      void main(){
        vec4 view=invProjection*vec4(vUv*2.-1.,1.,1.);vec3 viewRay=normalize(view.xyz/view.w);
        vec3 ray=normalize(mat3(cameraWorld)*viewRay);
        float dist=min(surfaceDepth(vUv)/max(-viewRay.z,.02),36.);
        float stepLength=dist/28.,transmission=1.;vec3 scattered=vec3(0.);
        float jitter=hash3(vec3(gl_FragCoord.xy,4.7));
        for(int i=0;i<28;i++){
          float t=(float(i)+.15+jitter*.7)*stepLength;vec3 p=cameraPositionWorld+ray*t;
          vec3 flow=p*vec3(.55,.68,.55)+vec3(uTime*.047,-uTime*.021,-uTime*.036);
          float cloud=noise3(flow)*.68+noise3(flow*2.07+vec3(5.2,uTime*.025,1.3))*.32;
          float height=exp(-max(p.y-.18,0.)*.62);
          float density=(.022+pow(smoothstep(.18,.86,cloud),1.6)*.32)*height*uDensity*smoothstep(.35,1.9,t);
          float alpha=1.-exp(-density*stepLength);
          vec3 light=mix(vec3(.040,.065,.064),vec3(.115,.158,.139),cloud);
          for(int l=0;l<4;l++){float d=distance(p,uLightPos[l]);light+=uLightColor[l]/(1.+d*d*3.5)*.18;}
          scattered+=transmission*alpha*light;transmission*=1.-alpha;
        }
        gl_FragColor=vec4(scattered,transmission);
      }`});
    this.postMaterial=new THREE.ShaderMaterial({uniforms:{...uniforms,tColor:{value:this.color.texture},tFog:{value:this.fog.texture},pixel:{value:new THREE.Vector2()},fogSize:{value:new THREE.Vector2()}},vertexShader:vertex,depthTest:false,depthWrite:false,fragmentShader:`
      varying vec2 vUv;${depthFunctions}
      uniform sampler2D tColor,tFog;uniform vec2 pixel,fogSize;uniform mat4 invProjection,cameraWorld;uniform vec3 uLightPos[4],uLightColor[4];
      vec3 bright(vec2 uv){return max(texture2D(tColor,uv).rgb-vec3(1.25),vec3(0.));}
      void main(){
        float centerDepth=surfaceDepth(vUv),sum=0.;vec4 fog=vec4(0.);
        vec2 grid=vUv*fogSize-.5,base=floor(grid),f=fract(grid);
        for(int y=0;y<2;y++)for(int x=0;x<2;x++){
          vec2 uv=(base+vec2(float(x),float(y))+.5)/fogSize;
          float bilinear=(x==0?1.-f.x:f.x)*(y==0?1.-f.y:f.y);
          float weight=bilinear*exp(-abs(surfaceDepth(uv)-centerDepth)*2.5)+.00001;
          fog+=texture2D(tFog,uv)*weight;sum+=weight;
        }fog/=sum;
        vec3 color=texture2D(tColor,vUv).rgb,bloom=vec3(0.);
        for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)bloom+=bright(vUv+vec2(float(x),float(y))*pixel*4.);
        vec4 q=invProjection*vec4(vUv*2.-1.,1.,1.);vec3 dir=normalize(q.xyz/q.w);
        vec3 world=(cameraWorld*vec4(dir*centerDepth/max(-dir.z,.02),1.)).xyz;
        for(int l=0;l<4;l++){float d=distance(world,uLightPos[l]);color+=uLightColor[l]/(1.+d*d*4.)*.09;}
        color*=vec3(.85,.94,.94);color=color*fog.a+fog.rgb+bloom*.06;
        float vignette=1.-.18*dot(vUv-.5,vUv-.5)*2.;gl_FragColor=vec4(color*vignette,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
    this.screenCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);this.screenScene=new THREE.Scene();this.quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.fogMaterial);this.screenScene.add(this.quad);this.resize();
  }
  resize(){const size=this.renderer.getDrawingBufferSize(new THREE.Vector2());this.color.setSize(size.x,size.y);const w=Math.ceil(size.x*.5),h=Math.ceil(size.y*.5);this.splatDepth.setSize(w,h);this.fog.setSize(w,h);this.postMaterial.uniforms.pixel.value.set(1/size.x,1/size.y);this.postMaterial.uniforms.fogSize.value.set(w,h);}
  render(scene,dt,active,lights=[]){
    if(active)this.time+=dt*(this.reduced?.2:1);this.fogMaterial.uniforms.uTime.value=this.time;this.fogMaterial.uniforms.uDensity.value=this.density;
    for(let i=0;i<4;i++){const l=lights[i];this.fogMaterial.uniforms.uLightPos.value[i].copy(l?.position||new THREE.Vector3());this.fogMaterial.uniforms.uLightColor.value[i].set(l?.color.r||0,l?.color.g||0,l?.color.b||0).multiplyScalar((l?.intensity||0)*.12);}
    const r=this.renderer,spark=this.spark;r.setRenderTarget(this.color);r.render(scene,this.camera);
    const hidden=[],material=spark.material,background=scene.background,clear=r.getClearColor(new THREE.Color()),clearAlpha=r.getClearAlpha(),auto=spark.autoUpdate,shadowAuto=r.shadowMap.autoUpdate;
    scene.traverse(o=>{if(o!==spark&&(o.isMesh||o.isPoints||o.isSprite)&&o.visible){hidden.push(o);o.visible=false;}});
    try{
      scene.background=null;r.setClearColor(0,0);spark.material=this.depthMaterial;spark.autoUpdate=false;r.shadowMap.autoUpdate=false;
      r.setRenderTarget(this.splatDepth);r.render(scene,this.camera);
    }finally{spark.material=material;spark.autoUpdate=auto;r.shadowMap.autoUpdate=shadowAuto;scene.background=background;r.setClearColor(clear,clearAlpha);for(const o of hidden)o.visible=true;}
    this.quad.material=this.fogMaterial;r.setRenderTarget(this.fog);r.render(this.screenScene,this.screenCamera);
    this.quad.material=this.postMaterial;r.setRenderTarget(null);r.render(this.screenScene,this.screenCamera);
  }
  get stats(){return {density:this.density,time:this.time,raymarchSteps:28,volumetric:true,noise:'3D advection',depth:'alpha-weighted Gaussian surface',proxyWalls:false,bilateralUpsampling:true,exposure:this.renderer.toneMappingExposure,reducedMotion:this.reduced};}
}
