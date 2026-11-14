import {HorrorBgm} from './horror-bgm.js';
import {ZombieVoices} from './zombie-voices.js';
import {HeroVoices} from './hero-voices.js';
export class GameSound {
  constructor(){this.muted=localStorage.getItem('kongjing-muted')==='true';this.counts={steps:0,sword:0,fire:0,impact:0};this.stepDistance=0;this.bgm=new HorrorBgm();this.zombies=new ZombieVoices();this.hero=new HeroVoices(speaking=>this.bgm.duck(speaking));this.hero.setMuted(this.muted);}
  async preload(){return (await Promise.all([this.bgm.preload(),this.zombies.preload(),this.hero.preload()])).every(Boolean);}
  ensureContext(){
    if(!this.ctx){
      this.ctx=new (window.AudioContext||window.webkitAudioContext)();
      this.master=this.ctx.createGain();this.master.gain.value=this.muted?0:.55;
      const compressor=this.ctx.createDynamicsCompressor();compressor.threshold.value=-12;compressor.ratio.value=5;this.master.connect(compressor);compressor.connect(this.ctx.destination);
      this.zombies.prepare(this.ctx,this.master);
      // Dialogue can play on the cover, before gameplay sound becomes active.
      this.hero.prepare(this.ctx,compressor);
      this.noise=this.ctx.createBuffer(1,this.ctx.sampleRate*2,this.ctx.sampleRate);const d=this.noise.getChannelData(0);let state=731;
      for(let i=0;i<d.length;i++){state=(state*1664525+1013904223)>>>0;d[i]=(state/2147483648-1)*.8;}
    }
  }
  async loadingVoice(unmute=true){
    this.ensureContext();if(this.ctx.state==='suspended')await this.ctx.resume();
    if(this.gameStarted)return false;
    if(this.muted&&unmute){this.muted=false;localStorage.setItem('kongjing-muted','false');this.hero.setMuted(false);this.level();}
    return this.hero.play('loading');
  }
  async unlock(){
    this.gameStarted=true;this.ensureContext();this.active=true;
    if(this.ctx.state==='suspended')await this.ctx.resume();this.level();
    if(await this.bgm.prepare(this.ctx,this.master)){if(this.active)this.bgm.play();}
    if(this.active)this.hero.resume();
  }
  level(){if(this.ctx)this.master.gain.setTargetAtTime(this.active&&!this.muted?.55:0,this.ctx.currentTime,.035);}
  pause(){this.active=false;this.level();this.bgm.pause();this.zombies.stopAll();this.hero.pause();this.stepDistance=0;}
  growl(position,id,kind,options){if(!this.active||this.muted)return false;return this.zombies.play(position,id,kind,options);}
  dig(){if(!this.ctx||!this.active||this.muted)return;const t=this.ctx.currentTime;if(t-(this.lastDig||-10)<.45)return;this.lastDig=t;this.tone(72,24,.52,.10);this.hiss(.48,.12,850,140);}
  listen(position,forward){
    if(!this.ctx)return;const l=this.ctx.listener;
    l.positionX.value=position.x;l.positionY.value=position.y+1.5;l.positionZ.value=position.z;
    l.forwardX.value=forward.x;l.forwardY.value=forward.y;l.forwardZ.value=forward.z;l.upX.value=0;l.upY.value=1;l.upZ.value=0;this.zombies.update(position);
  }
  toggle(){this.muted=!this.muted;localStorage.setItem('kongjing-muted',String(this.muted));this.level();this.hero.setMuted(this.muted);return this.muted;}
  tone(f0,f1,duration,gain,type='sine',delay=0){
    if(!this.ctx||!this.active||this.muted)return;
    const t=this.ctx.currentTime+delay,osc=this.ctx.createOscillator(),g=this.ctx.createGain();osc.type=type;osc.frequency.setValueAtTime(f0,t);osc.frequency.exponentialRampToValueAtTime(Math.max(f1,10),t+duration);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(gain,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+duration);osc.connect(g);g.connect(this.master);osc.start(t);osc.stop(t+duration+.01);
  }
  hiss(duration,gain,frequency,endFrequency,delay=0,pan=0){
    if(!this.ctx||!this.active||this.muted)return;
    const t=this.ctx.currentTime+delay,src=this.ctx.createBufferSource(),filter=this.ctx.createBiquadFilter(),g=this.ctx.createGain(),p=this.ctx.createStereoPanner();
    src.buffer=this.noise;filter.type='bandpass';filter.Q.value=.7;filter.frequency.setValueAtTime(frequency,t);filter.frequency.exponentialRampToValueAtTime(endFrequency,t+duration);p.pan.value=pan;
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(gain,t+.015);g.gain.exponentialRampToValueAtTime(.0001,t+duration);
    src.connect(filter);filter.connect(g);g.connect(p);p.connect(this.master);src.start(t,(this.counts.steps*.173)%1);src.stop(t+duration+.02);
  }
  update(dt,speed,running,grounded){
    if(!this.active||!grounded||speed<.3){this.stepDistance=0;return;}
    this.stepDistance+=speed*dt;
    if(this.stepDistance>(running?1.02:.66)){
      this.stepDistance=0;this.counts.steps++;const side=this.counts.steps%2?-.12:.12;
      this.tone(running?125:105,38,.11,running?.15:.09);this.hiss(.10,running?.19:.11,1000,300,0,side);this.hiss(.035,.09,2500,1600,.006,side);
    }
  }
  sword(stage){this.counts.sword++;this.hiss(.32,.24,400+stage*70,2100+stage*350);this.tone(740+stage*90,220,.24,.045,'triangle',.025);this.hiss(.44,.08,4200,1600,.06);}
  fire(){this.counts.fire++;this.tone(125,65,.42,.18,'triangle');this.hiss(.6,.28,700,2600);this.hiss(.75,.11,2200,500,.08);}
  impact(){this.counts.impact++;this.tone(160,28,.38,.16);this.hiss(.4,.2,1300,180);}
  get stats(){return {state:this.ctx?.state||'locked',muted:this.muted,active:this.active,bgm:this.bgm.stats,zombies:this.zombies.stats,hero:this.hero.stats,...this.counts};}
}
