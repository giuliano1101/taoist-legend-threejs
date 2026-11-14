const $=id=>document.getElementById(id);
const app=$('app');
const svg=(body,viewBox='0 0 24 24')=>`<svg viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const icons={
 fire:svg('<path d="M13 2c2 5-3 6-1 10 1-2 3-3 4-4 3 4 5 6 3 10-2 5-11 5-14 0C2 13 6 9 8 7c-1 5 1 6 2 6-1-5 4-7 3-11Z"/><path d="M13 13c3 4 3 7-1 8-4-1-3-4 1-8Z"/>'),
 sword:svg('<path d="m15 3 6-1-1 6-10 10-4-4L15 3Z"/><path d="m6 12 6 6M8 16l-4 4m-2-2 4 4M17 5l-7 9"/>'),
 help:svg('<path d="M5 3h14v18H5zM8 7h8M8 11h8M8 15h5"/>'),
 reset:svg('<path d="M4 9a8 8 0 1 1 0 7M4 3v6h6"/>'),
 sound:svg('<path d="m4 9 4 0 5-5v16l-5-5H4zM17 8c2 2 2 6 0 8m3-11c4 4 4 10 0 14"/>'),
 full:svg('<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>'),
 close:svg('<path d="m6 6 12 12M18 6 6 18"/>')
};
const seal=`<svg class="taoist-seal" viewBox="0 0 100 100" aria-hidden="true"><g fill="none" stroke="currentColor"><circle cx="50" cy="50" r="46" stroke-width=".8"/><circle cx="50" cy="50" r="40" stroke-width=".7"/><circle cx="50" cy="50" r="27" stroke-width=".7"/>${Array.from({length:8},(_,i)=>`<g transform="rotate(${i*45} 50 50)"><path d="M43 10h14m-14 4h6m2 0h6m-14 4h14" stroke-width="1.5"/></g>`).join('')}</g><path d="M50 24a26 26 0 1 0 0 52 13 13 0 0 1 0-26 13 13 0 0 0 0-26Z" fill="currentColor"/><circle cx="50" cy="37" r="3.5" fill="#101814"/><circle cx="50" cy="63" r="3.5" fill="currentColor"/></svg>`;

const hud=document.createElement('div');hud.id='aaa-hud';hud.className='aaa-hud';
hud.innerHTML=`
 <section class="aaa-vitals" aria-label="角色状态">
   <div class="aaa-seal">${seal}</div><div class="aaa-vital-body"><div class="aaa-character-name">少年林正英<span>御火 · 剑修</span></div>
     <div class="aaa-resource"><span>精力</span><div class="aaa-meter energy" role="meter" aria-label="精力" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><i id="aaa-energy"></i></div></div>
     <div class="aaa-resource"><span>真气</span><div class="aaa-meter spirit" role="meter" aria-label="真气" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><i id="aaa-spirit"></i></div></div>
   </div>
 </section>
 <section class="aaa-compass" aria-label="方位与区域"><div class="aaa-compass-line"><span id="aaa-west">西</span><b id="aaa-heading">北</b><span id="aaa-east">东</span></div><div class="aaa-location">长灯巷</div></section>
 <section class="aaa-objective" aria-label="探索进度"><h2><span class="aaa-diamond"></span>雾巷寻踪</h2><p id="aaa-objective-text">沿古巷前行</p><small id="aaa-distance">巷口 · 二十一米</small></section>
 <nav class="aaa-tools" aria-label="游戏工具"></nav>
 <section class="aaa-stance" aria-label="当前招式"><div class="aaa-stance-mark">${icons.sword}</div><div class="aaa-stance-copy"><span class="aaa-stance-title">御剑诀</span><div class="aaa-combo" aria-label="剑招连段">${Array.from({length:4},()=>'<i></i>').join('')}</div></div><div id="aaa-motion-slot"></div></section>
 <section class="aaa-abilities" aria-label="武学快捷栏"><div class="aaa-ability-row">
   <button id="aaa-fire" class="aaa-ability fire" aria-label="施放火球 Q"><span class="aaa-medallion">${icons.fire}<i class="aaa-cooldown"></i></span><span class="aaa-ability-name">御火</span><kbd>Q</kbd></button>
   <span class="aaa-ability-link" aria-hidden="true">☯</span>
   <button id="aaa-sword" class="aaa-ability sword" aria-label="挥剑连招 E"><span class="aaa-medallion">${icons.sword}<i class="aaa-cooldown"></i></span><span class="aaa-ability-name">剑诀</span><kbd>E</kbd></button>
 </div><p class="aaa-input-hint">左键劈砍<span>·</span>Q 御火 · E 剑诀</p></section>
 <div class="aaa-bottom-hint"><span><kbd>WASD</kbd> 行走</span><span><kbd>Shift</kbd> 疾行</span><span><kbd>Space</kbd> 腾跃</span></div>`;
app.append(hud);
const atlasIcon=(column,row)=>`<span class="aaa-icon" style="--atlas-x:${((43+392*column)/874*100).toFixed(4)}%;--atlas-y:${((40+392*row)/874*100).toFixed(4)}%" aria-hidden="true"></span>`;
hud.querySelector('.aaa-seal').innerHTML=atlasIcon(2,2);
hud.querySelector('#aaa-fire .aaa-medallion').innerHTML=atlasIcon(0,0)+'<i class="aaa-cooldown"></i>';
hud.querySelector('#aaa-sword .aaa-medallion').innerHTML=atlasIcon(1,0)+'<i class="aaa-cooldown"></i>';
hud.querySelector('.aaa-ability-link').innerHTML=atlasIcon(2,2);
hud.querySelector('.energy').title='气血：受到怪物攻击时减少，R 键重新开始';
hud.querySelector('.energy').setAttribute('aria-label','气血');
hud.querySelector('.energy').previousElementSibling.textContent='气血';
hud.querySelector('.spirit').title='真气随御火变化，显示当前动作状态';

const nav=hud.querySelector('.aaa-tools');
for(const [id,icon,label] of [['help-button','help','显示操作说明'],['sound-button','sound','关闭音效'],['reset-button','reset','回到起点'],['fullscreen-button','full','切换全屏']]){
 let b=$(id);if(!b){b=document.createElement('button');b.id=id;}
 const coords={help:[1,1],sound:[2,1],reset:[0,2],full:[1,2]}[icon];
 b.className='aaa-tool';b.innerHTML=atlasIcon(...coords);b.setAttribute('aria-label',label);b.title=label;nav.append(b);
}
for(const id of ['motion-label','position-label']){const e=$(id);if(e)$('aaa-motion-slot').append(e);}
const speed=$('speed-label');if(speed){speed.classList.add('aaa-hidden');app.append(speed);}
const cameraMode=$('camera-mode');if(cameraMode){cameraMode.classList.add('aaa-hidden');app.append(cameraMode);}
const close=$('close-help');if(close)close.innerHTML=icons.close;
const welcome=$('welcome');if(welcome){welcome.classList.add('aaa-welcome');welcome.querySelector('.eyebrow')?.remove();welcome.querySelector('h2').textContent='道士林正英传奇';welcome.querySelector('.welcome-copy').innerHTML='长灯巷 · 火与剑<br><span>一袭道袍，行入万重烟雨。</span>';welcome.querySelector('.welcome-note').textContent='准备就绪 · 左键劈砍 · Q 御火 · E 剑诀';$('start-button').innerHTML='<span class="aaa-start-diamond"></span>进入游戏';}
const pause=$('pause');if(pause){pause.classList.add('aaa-pause');pause.querySelector('h2').textContent='静候君归';pause.querySelector('p').textContent='道士林正英传奇';}
const help=$('help');if(help){
 help.classList.add('aaa-help');help.querySelector('h2').textContent='修行手札';help.setAttribute('role','dialog');help.setAttribute('aria-modal','true');
 if(!help.querySelector('#fog-density')){const row=document.createElement('label');row.className='aaa-fog-setting';row.htmlFor='fog-density';row.innerHTML='雾气浓度<input id="fog-density" type="range" min="0" max="140" value="80" aria-label="雾气浓度">';help.append(row);}
 const fogLabel=$('fog-density')?.closest('label');if(fogLabel){fogLabel.classList.add('aaa-fog-setting');const icon=document.createElement('span');icon.className='aaa-fog-symbol';icon.innerHTML=atlasIcon(0,1);fogLabel.prepend(icon);}
 let wasHidden=help.hidden;new MutationObserver(()=>{if(help.hidden===wasHidden)return;wasHidden=help.hidden;if(!help.hidden)$('close-help').focus({preventScroll:true});else $('help-button').focus({preventScroll:true});}).observe(help,{attributes:true,attributeFilter:['hidden']});
}
function pauseForMenu(){if(window.__game?.state.active)window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyP',key:'p',bubbles:true}));}
$('help-button').addEventListener('click',pauseForMenu,{capture:true});
window.addEventListener('keydown',event=>{if(event.code==='KeyH')pauseForMenu();if(event.code==='Escape'&&help&&!help.hidden){help.hidden=true;event.preventDefault();event.stopImmediatePropagation();}},{capture:true});

function skillKey(code){
 const state=window.__game?.state;if(!state?.loaded)return;
 if(!state.active)$('start-button').click();
 window.dispatchEvent(new KeyboardEvent('keydown',{code,key:code.slice(-1).toLowerCase(),bubbles:true}));
 window.dispatchEvent(new KeyboardEvent('keyup',{code,key:code.slice(-1).toLowerCase(),bubbles:true}));
}
$('aaa-fire').onclick=()=>skillKey('KeyQ');$('aaa-sword').onclick=()=>skillKey('KeyE');
let last=performance.now(),energy=100,spirit=100,previousAttacks=0,lastFire=-10,flashUntil=0,arrival=false;
let initialized=false;
function update(now){
 requestAnimationFrame(update);if(now-last<90)return;const dt=Math.min((now-last)/1000,.3);last=now;
 const state=window.__game?.state;if(!state)return;
 hud.inert=!state.loaded;
 document.body.dataset.gameMode=state.mode;
 document.body.classList.toggle('aaa-ready',state.loaded);document.body.classList.toggle('aaa-playing',state.active);document.body.classList.toggle('aaa-started',state.mode!=='preview'&&state.mode!=='loading');
 if(!state.loaded)return;
 if(!initialized){initialized=true;energy=spirit=100;}
 const attacking=state.attackCount!==previousAttacks;
 if(attacking){const fire=state.motion==='Cast';energy=Math.max(35,energy-(fire?3:9));if(fire){spirit=Math.max(20,spirit-18);lastFire=now;}flashUntil=now+360;previousAttacks=state.attackCount;}
 if(state.active){energy=Math.max(20,Math.min(100,energy+dt*(state.speed>2.5?-5:13)));spirit=Math.min(100,spirit+dt*9);}
 const e=typeof state.playerHealth==='number'?state.playerHealth:energy,q=typeof state.qi==='number'?state.qi:spirit;
 hud.querySelector('.energy').title=`气血 ${Math.round(e)} / 100 · R 键重新开始`;
 $('aaa-energy').style.transform=`scaleX(${e/100})`;$('aaa-spirit').style.transform=`scaleX(${q/100})`;
 hud.querySelector('.energy').setAttribute('aria-valuenow',String(Math.round(e)));hud.querySelector('.spirit').setAttribute('aria-valuenow',String(Math.round(q)));
 const compass=((state.yaw+Math.PI)*180/Math.PI%360+360)%360,dirs=['北','东北','东','东南','南','西南','西','西北'];$('aaa-heading').textContent=dirs[Math.round(compass/45)%8];
 const dist=Math.max(0,(state.exit??4.2)-state.position[2]);$('aaa-distance').textContent=`巷口 · ${dist.toFixed(0)} 米`;
 if(state.enemies){const e=state.enemies,total=e.waveSize??6;$('aaa-objective-text').textContent=e.wavePhase==='opening'?'巷中异响 · 留意地面':e.wavePhase==='intermission'?`地底异动 · ${e.waveCountdown.toFixed(1)}s`:e.wavePhase==='emerging'?`第${e.wave}波 · 邪祟破土`:`第${e.wave??1}波 · 清退${e.waveKills??total-e.remaining}/${total}`;arrival=false;}
 else if(dist<.9){$('aaa-objective-text').textContent='已抵达巷口';arrival=true;}else{$('aaa-objective-text').textContent='沿古巷前行';arrival=false;}
 const stage=state.comboStage??state.combat?.stage??0,swordSkill=state.combatKind==='sword';hud.querySelectorAll('.aaa-combo i').forEach((p,i)=>p.classList.toggle('lit',swordSkill&&i<=stage));
 $('aaa-sword').classList.toggle('active',swordSkill);$('aaa-fire').classList.toggle('active',state.motion==='Cast');
 $('aaa-fire').style.setProperty('--cooldown',state.motion==='Cast'?'.55':'0');$('aaa-fire').setAttribute('aria-busy',String(state.motion==='Cast'));
 const stance=hud.querySelector('.aaa-stance-mark');if(stance.dataset.motion!==state.motion){stance.innerHTML=state.motion==='Run'?atlasIcon(2,0):state.motion==='Cast'?atlasIcon(0,0):atlasIcon(1,0);stance.dataset.motion=state.motion;}
 hud.classList.toggle('aaa-hit',now<flashUntil);
}
requestAnimationFrame(update);
Object.defineProperty(window,'__hud',{value:{get state(){return {ready:initialized,energy,spirit,arrival,style:'brass-and-jade-wuxia',reference:'aaa-hud-concept.png'};}}});
