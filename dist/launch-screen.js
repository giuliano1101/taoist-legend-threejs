const weights={character:20,environment:38,enemies:14,audio:6,presentation:6,gpu:16};
export class LaunchScreen {
  constructor(){
    this.parts=Object.fromEntries(Object.keys(weights).map(k=>[k,0]));this.percent=0;this.ready=false;this.voiceStarted=false;this.voiceFinished=false;this.entered=false;this.autoTimer=null;
    this.root=document.getElementById('launch-screen');this.track=document.getElementById('load-progressbar');
  }
  set(part,value,message){
    this.parts[part]=Math.max(this.parts[part]||0,Math.min(1,value));
    this.percent=Math.floor(Object.entries(weights).reduce((sum,[key,weight])=>sum+this.parts[key]*weight,0));
    document.getElementById('progress').style.width=`${this.percent}%`;
    document.getElementById('load-percent').textContent=`${this.percent}%`;
    this.track.setAttribute('aria-valuenow',String(this.percent));
    if(message)document.getElementById('loading-text').textContent=message;
    document.getElementById('load-detail').textContent=this.percent<84?'角色、古巷与邪祟正在准备':'正在准备首次画面，请稍候';
  }
  transfer(part,event){this.set(part,event.total?event.loaded/event.total*.85:0);}
  async presentation(){
    const images=[document.getElementById('launch-art'),...['wuxia-icons.png','lacquer-panel.png','brass-banner.png'].map(name=>Object.assign(new Image(),{src:'./assets/ui/'+name}))];
    this.images=images;
    await Promise.all(images.map(image=>image.decode()));
    await document.fonts.load('16px KongjingSerif','道士林正英传奇 怨灵护士 蓄力 进入游戏');
    await document.fonts.ready;this.set('presentation',1);
  }
  complete(){
    this.set('gpu',1,'准备就绪');this.ready=true;this.root.classList.add('is-ready');
    document.getElementById('loading').hidden=true;document.getElementById('welcome').hidden=false;
    document.getElementById('start-button').textContent='按任意键进入游戏';
    this.updateEntryHint();this.queueAutoEntry();
  }
  narrationStarted(){this.voiceStarted=true;this.updateEntryHint();}
  narrationEnded(){this.voiceFinished=true;this.updateEntryHint();this.queueAutoEntry();}
  updateEntryHint(){
    const hint=document.getElementById('launch-entry-hint');
    if(hint)hint.textContent=this.voiceFinished?'100% · 即将进入游戏':this.voiceStarted?'100% · 念咒结束后自动进入':'100% · 按键或点击画面进入';
  }
  queueAutoEntry(){
    if(!this.ready||!this.voiceFinished||this.entered||this.autoTimer||document.hidden)return;
    // Leave the completed loading prompt visible for a moment, even on a slow load.
    this.autoTimer=setTimeout(()=>{this.autoTimer=null;if(!this.entered&&!document.hidden)this.onEnter?.();},600);
  }
  enter(){clearTimeout(this.autoTimer);this.autoTimer=null;this.entered=true;this.root.hidden=true;}
  fail(){this.root.classList.add('has-error');document.getElementById('load-detail').textContent='资源准备失败，请检查本地文件后重试。';}
  get stats(){return {percent:this.percent,ready:this.ready,voiceStarted:this.voiceStarted,voiceFinished:this.voiceFinished,entered:this.entered,autoPending:Boolean(this.autoTimer),parts:{...this.parts}};}
}
