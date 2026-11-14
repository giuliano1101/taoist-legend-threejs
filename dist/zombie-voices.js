const names=['idle-a','idle-b','attack','hurt','cry-a','cry-b'];
export const NURSE_VOICE_RANGES={near:9.5,cry:10,max:34};
export function nurseAmbientVoice(distance,state){
  if(['attack','stagger','buried','emerge','dissolve','gone'].includes(state))return null;
  if(distance<=NURSE_VOICE_RANGES.near)return 'idle';
  return distance>=NURSE_VOICE_RANGES.cry&&distance<NURSE_VOICE_RANGES.max?'cry':null;
}
export class ZombieVoices {
  constructor(){
    this.voices=new Map();this.buffers={};this.counts={idle:0,attack:0,hurt:0,cry:0};this.error=null;this.lastCryAt=-Infinity;this.history=[];
    this.bytes=Promise.all(names.map(async name=>{
      const response=await fetch(new URL(`./assets/audio/zombie-${name}.ogg`,import.meta.url));
      if(!response.ok)throw new Error(`Zombie voice HTTP ${response.status}`);
      return [name,await response.arrayBuffer()];
    })).catch(error=>{this.error=error.message;return null;});
  }
  preload(){
    if(!this.preloading)this.preloading=this.bytes.then(async entries=>{
      if(!entries)return false;
      try{const decoder=new OfflineAudioContext(1,1,32000);await Promise.all(entries.map(async([name,bytes])=>this.buffers[name]=await decoder.decodeAudioData(bytes)));return true;}
      catch(error){this.error=error.message;return false;}
    });
    return this.preloading;
  }
  prepare(ctx,output){
    if(this.ctx)return;
    this.ctx=ctx;this.bus=ctx.createGain();this.bus.gain.value=.9;
    this.meter=ctx.createAnalyser();this.meter.fftSize=512;this.samples=new Float32Array(512);
    this.bus.connect(this.meter);this.meter.connect(output);
  }
  play(position,id,kind='idle',options={}){
    if(!this.ctx||!this.buffers.attack||this.ctx.state!=='running'||!(kind in this.counts))return false;
    const ambient=kind==='idle'||kind==='cry',ctx=this.ctx,t=ctx.currentTime;
    if(kind==='cry'&&(t-this.lastCryAt<12||[...this.voices.values()].some(v=>v.kind==='cry')))return false;
    if(this.voices.has(id)){if(ambient)return false;this.stop(id);}
    if(this.voices.size>=3){if(ambient)return false;const idle=[...this.voices].find(([,v])=>v.kind==='cry')||[...this.voices].find(([,v])=>v.kind==='idle');if(!idle)return false;this.stop(idle[0]);}
    const name=kind==='idle'?(this.counts.idle%2?'idle-b':'idle-a'):kind==='cry'?(this.counts.cry%2?'cry-b':'cry-a'):kind;
    const source=ctx.createBufferSource(),panner=ctx.createPanner(),gain=ctx.createGain(),filter=ctx.createBiquadFilter(),analyser=ctx.createAnalyser();analyser.fftSize=128;
    source.buffer=this.buffers[name];source.playbackRate.value=.985+(id%3)*.015;
    panner.panningModel='HRTF';panner.distanceModel='inverse';panner.refDistance=4.2;panner.maxDistance=NURSE_VOICE_RANGES.max;panner.rolloffFactor=.95;
    panner.positionX.value=position.x;panner.positionY.value=position.y+1.65;panner.positionZ.value=position.z;
    const volume=(kind==='attack'?.95:kind==='cry'?1.1:.86)*(options.occluded?.48:1);
    filter.type='lowpass';filter.frequency.value=kind==='cry'?Math.max(1500,5200-(options.distance||16)*95)*(options.occluded?.65:1):6500;filter.Q.value=.5;
    gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(volume,t+(kind==='cry'?.18:.045));
    source.connect(analyser);analyser.connect(gain);gain.connect(panner);panner.connect(filter);filter.connect(this.bus);
    const voice={source,gain,panner,filter,analyser,samples:new Float32Array(128),level:0,position,kind,name,distance:options.distance??null,occluded:Boolean(options.occluded)};this.voices.set(id,voice);this.counts[kind]++;
    if(kind==='cry')this.lastCryAt=t;
    this.history.push({id,kind,name,time:t,distance:options.distance??null});if(this.history.length>24)this.history.shift();
    source.onended=()=>{source.disconnect();analyser.disconnect();gain.disconnect();panner.disconnect();filter.disconnect();if(this.voices.get(id)===voice)this.voices.delete(id);};
    source.start();return true;
  }
  update(listener){for(const [id,voice] of this.voices){const {position,panner,analyser,samples}=voice;panner.positionX.value=position.x;panner.positionY.value=position.y+1.65;panner.positionZ.value=position.z;
    if(listener){voice.distance=Math.hypot(position.x-listener.x,position.z-listener.z);if(voice.distance>=NURSE_VOICE_RANGES.max||(voice.kind==='cry'&&voice.distance<NURSE_VOICE_RANGES.near)){this.stop(id);continue;}
      if(voice.kind==='cry')voice.filter.frequency.setTargetAtTime(Math.max(1500,5200-voice.distance*95)*(voice.occluded?.65:1),this.ctx.currentTime,.15);}
    analyser.getFloatTimeDomainData(samples);voice.level=Math.min(1,Math.sqrt(samples.reduce((s,v)=>s+v*v,0)/samples.length)*9);}}
  level(id){return this.voices.get(id)?.level||0;}
  stop(id){const voice=this.voices.get(id);if(!voice)return;const t=this.ctx.currentTime;voice.gain.gain.cancelScheduledValues(t);voice.gain.gain.setTargetAtTime(0,t,.015);voice.source.stop(t+.075);this.voices.delete(id);}
  stopAll(){for(const id of this.voices.keys())this.stop(id);}
  get stats(){
    let rms=0;if(this.meter){this.meter.getFloatTimeDomainData(this.samples);rms=Math.sqrt(this.samples.reduce((sum,v)=>sum+v*v,0)/this.samples.length);}
    return {ready:names.every(n=>this.buffers[n]),profile:'female-performer-natural-pitch',playing:this.voices.size,emitterIds:[...this.voices.keys()],voices:[...this.voices].map(([id,v])=>({id,kind:v.kind,name:v.name,distance:v.distance,rate:v.source.playbackRate.value,cutoff:v.filter.frequency.value})),history:this.history,rms,...this.counts,error:this.error};
  }
}
