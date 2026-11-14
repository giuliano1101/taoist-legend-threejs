import * as THREE from 'three';

// An emitting, absorbing fire volume. Turbulence advects through its head and
// tapered wake; there is no opaque polygonal fireball under the flame.
export function createFlame(seed=0){
  const material=new THREE.ShaderMaterial({
    uniforms:{uTime:{value:0},uSeed:{value:seed},uFade:{value:1},uInverse:{value:new THREE.Matrix4()}},
    transparent:true,premultipliedAlpha:true,depthWrite:false,side:THREE.BackSide,
    vertexShader:`varying vec3 vLocal;void main(){vLocal=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`
      varying vec3 vLocal;uniform mat4 uInverse;uniform float uTime,uSeed,uFade;
      float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
      float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      float fbm(vec3 p){return noise3(p)*.57+noise3(p*2.03+4.2)*.29+noise3(p*4.07-1.7)*.14;}
      vec3 fireColour(float heat){vec3 c=mix(vec3(.13,.018,.002),vec3(2.3,.22,.005),smoothstep(.03,.4,heat));c=mix(c,vec3(3.8,1.2,.06),smoothstep(.38,.8,heat));return mix(c,vec3(5.,3.3,.9),smoothstep(.78,1.,heat));}
      void main(){
        vec3 ro=(uInverse*vec4(cameraPosition,1.)).xyz,rd=normalize(vLocal-ro);
        vec3 inv=1./(rd+vec3(.000001)),t0=(vec3(-.5,-1.5,-.5)-ro)*inv,t1=(vec3(.5,.5,.5)-ro)*inv;
        vec3 lo=min(t0,t1),hi=max(t0,t1);float start=max(0.,max(max(lo.x,lo.y),lo.z)),end=min(min(hi.x,hi.y),hi.z);
        if(end<=start)discard;float stepLength=(end-start)/48.,trans=1.;vec3 colour=vec3(0.);
        float jitter=hash(vec3(gl_FragCoord.xy,uSeed));
        for(int i=0;i<48;i++){
          vec3 p=ro+rd*(start+(float(i)+.2+jitter*.6)*stepLength);
          float tail=clamp(-p.y/1.35,0.,1.);
          vec3 flow=p*vec3(5.,3.5,5.)+vec3(uSeed,uTime*5.3,-uTime*.7);
          vec2 curl=vec2(noise3(flow*.55+8.),noise3(flow*.55-5.))-.5;
          float radius=mix(.275,.035,pow(tail,.85))*(.72+.55*noise3(vec3(p.y*7.,uTime*4.5,uSeed))),radial=length(p.xz-curl*tail*.44);
          float wake=(1.-smoothstep(radius*.55,radius+.07,radial))*(1.-smoothstep(1.05,1.48,-p.y))*(1.-smoothstep(.0,.32,p.y));
          float head=exp(-dot(p*vec3(1.,.95,1.),p*vec3(1.,.95,1.))*16.);
          float turbulence=fbm(flow+vec3(curl*2.4,0.));
          float hotCore=exp(-dot(p,p)*90.);
          float density=(max(0.,max(wake,head)*(turbulence*2.8)-.8)+hotCore*.6)*uFade;
          float heat=clamp(density*.35+head*.6-tail*.34-radial*.2,0.,1.);
          float soot=(1.-smoothstep(radius*.8,radius*2.2,radial))*smoothstep(.15,.65,tail)*(1.-smoothstep(.82,1.,tail))*max(0.,turbulence-.25)*.35*uFade;
          float extinction=density*6.5+soot*1.1,alpha=1.-exp(-extinction*stepLength);
          vec3 source=(fireColour(heat)*density*6.5+vec3(.035,.03,.024)*soot*1.1)/max(extinction,.0001);
          colour+=trans*alpha*source;trans*=1.-alpha;
        }
        float alpha=1.-trans;if(alpha<.006)discard;gl_FragColor=vec4(colour,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const geometry=new THREE.BoxGeometry(1,2,1);geometry.translate(0,-.5,0);
  const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.name='TurbulentFireVolume';
  mesh.onBeforeRender=()=>{material.uniforms.uInverse.value.copy(mesh.matrixWorld).invert();material.uniformsNeedUpdate=true;};
  return mesh;
}
