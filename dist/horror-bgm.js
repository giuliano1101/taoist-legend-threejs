// Local original score, decoded once and looped sample-accurately by Web Audio.
export class HorrorBgm {
  constructor(){
    this.title='雾巷 · 夜行';this.volume=.55;this.offset=0;this.error=null;
    this.bytes=fetch(new URL('./assets/audio/fog-alley-night.ogg',import.meta.url))
      .then(r=>{if(!r.ok)throw new Error(`BGM HTTP ${r.status}`);return r.arrayBuffer();})
      .catch(error=>{this.error=error.message;return null;});
  }
  preload(){
    if(!this.preloading)this.preloading=this.bytes.then(async bytes=>{
      if(!bytes)return false;
      try{
        const decoder=new OfflineAudioContext(2,1,32000);
        this.buffer=await decoder.decodeAudioData(bytes);return true;
      }catch(error){this.error=error.message;console.warn('Background music unavailable',error);return false;}
    });
    return this.preloading;
  }
  async prepare(ctx,output){
    this.ctx=ctx;this.output=output;return this.preload();
  }
  play(){
    if(!this.buffer||this.source)return;
    const t=this.ctx.currentTime;
    const source=this.ctx.createBufferSource(),gain=this.ctx.createGain();
    source.buffer=this.buffer;source.loop=true;
    gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(this.volume*(this.ducked?.24:1),t+1.2);
    source.connect(gain);gain.connect(this.output);
    source.start(t,this.offset%this.buffer.duration);
    source.onended=()=>{source.disconnect();gain.disconnect();};
    this.source=source;this.gain=gain;this.startedAt=t;
  }
  pause(){
    if(!this.source)return;
    const t=this.ctx.currentTime,source=this.source,gain=this.gain;
    this.offset=(this.offset+t-this.startedAt)%this.buffer.duration;
    gain.gain.cancelAndHoldAtTime(t);gain.gain.linearRampToValueAtTime(0,t+.3);
    source.stop(t+.32);this.source=null;this.gain=null;
  }
  duck(speaking){
    this.ducked=speaking;if(!this.gain)return;
    const t=this.ctx.currentTime;this.gain.gain.cancelAndHoldAtTime(t);this.gain.gain.setTargetAtTime(this.volume*(speaking?.24:1),t,speaking?.09:.4);
  }
  get stats(){
    return {title:this.title,ready:Boolean(this.buffer),playing:Boolean(this.source),loop:true,
      duration:this.buffer?.duration||0,volume:this.volume,ducked:Boolean(this.ducked),error:this.error,
      position:this.buffer?(this.offset+(this.source?this.ctx.currentTime-this.startedAt:0))%this.buffer.duration:0};
  }
}
