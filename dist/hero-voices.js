const LINES={loading:'天灵灵地灵灵，四方八面显神灵，七星明灯引路。',opening:'天圆地方，律令九章，吾今下笔，万鬼伏藏！'};
export class HeroVoices{
  constructor(onSpeaking){
    this.onSpeaking=onSpeaking;this.buffers={};this.counts={loading:0,opening:0};this.error=null;this.offset=0;this.muted=false;this.request=0;
    this.ready=Promise.all(Object.keys(LINES).map(async id=>{
      const r=await fetch(new URL(`./assets/audio/hero-${id}.ogg`,import.meta.url));if(!r.ok)throw Error(`Hero voice HTTP ${r.status}`);
      const bytes=await r.arrayBuffer(),decoder=new OfflineAudioContext(1,1,24000);this.buffers[id]=await decoder.decodeAudioData(bytes);
    })).then(()=>true).catch(e=>{this.error=e.message;return false;});
  }
  preload(){return this.ready;}
  prepare(ctx,output){if(this.ctx)return;this.ctx=ctx;this.gain=ctx.createGain();this.gain.gain.value=this.muted?0:.88;this.gain.connect(output);}
  setMuted(muted){this.muted=muted;if(this.ctx)this.gain.gain.setTargetAtTime(muted?0:.88,this.ctx.currentTime,.025);}
  caption(id){
    for(const [key,nodeId] of [['loading','loading-voice-caption'],['opening','hero-voice-caption']]){
      const el=document.getElementById(nodeId);if(el){el.hidden=key!==id;el.textContent=key===id?LINES[key]:'';}
    }
    const button=document.getElementById('loading-voice');if(button){button.textContent=id==='loading'?'念咒中…':this.counts.loading?'语音已开启':'开启角色语音';button.disabled=id==='loading'||this.counts.loading>0;}
  }
  async play(id){
    const token=++this.request;this.stop(false);this.id=id;this.offset=0;this.paused=false;
    if(!await this.ready||token!==this.request||!this.ctx)return false;
    this.counts[id]++;this.begin(id,0);return true;
  }
  begin(id,offset){
    const source=this.ctx.createBufferSource();source.buffer=this.buffers[id];source.connect(this.gain);this.source=source;this.id=id;this.offset=offset;this.startedAt=this.ctx.currentTime;this.paused=false;
    this.caption(id);this.onSpeaking?.(true);this.onStarted?.(id);
    source.onended=()=>{source.disconnect();if(this.source===source){this.source=null;this.id=null;this.offset=0;this.caption(null);this.onSpeaking?.(false);this.onEnded?.(id);}};
    source.start(0,offset);
  }
  stop(cancel=true){
    if(cancel)this.request++;
    if(this.source){const old=this.source;this.source=null;old.onended=()=>old.disconnect();old.stop();}
    this.id=null;this.offset=0;this.paused=false;this.caption(null);this.onSpeaking?.(false);
  }
  pause(){
    if(!this.source)return;const id=this.id,offset=this.offset+this.ctx.currentTime-this.startedAt;
    this.stop();this.id=id;this.offset=Math.min(offset,this.buffers[id].duration-.001);this.paused=true;
  }
  resume(){if(this.paused&&this.id)this.begin(this.id,this.offset);}
  get stats(){return {ready:Object.keys(this.buffers).length===2,playing:Boolean(this.source),id:this.id,paused:Boolean(this.paused),position:this.offset+(this.source?this.ctx.currentTime-this.startedAt:0),durations:Object.fromEntries(Object.entries(this.buffers).map(([k,v])=>[k,v.duration])),counts:{...this.counts},muted:this.muted,error:this.error};}
}
