import * as THREE from 'three';
const names={idle:'低吼',chase:'逼近',attack:'蓄力',stagger:'受创',emerge:'破土'};
export class EnemyHealthUI {
  constructor(system,camera){
    this.system=system;this.camera=camera;this.point=new THREE.Vector3();
    this.root=document.createElement('div');this.root.className='enemy-health-layer';
    document.getElementById('app').append(this.root);
    this.rows=system.enemies.map(e=>{
      const node=document.createElement('div');node.className='enemy-plaque';node.hidden=true;node.dataset.enemyId=e.id;
      node.innerHTML='<div class="enemy-name-row"><span class="enemy-name">怨灵护士</span><span class="enemy-state"></span></div><div class="enemy-health-track" role="progressbar" aria-label="怨灵护士气血" aria-valuemin="0" aria-valuemax="100"><i class="enemy-health-lag"></i><i class="enemy-health-fill"></i></div><div class="enemy-health-foot"><span class="enemy-status">邪祟</span><span class="enemy-hp">100 / 100</span></div><div class="enemy-windup"><i></i></div>';
      this.root.append(node);
      return {node,track:node.querySelector('[role=progressbar]'),fill:node.querySelector('.enemy-health-fill'),lag:node.querySelector('.enemy-health-lag'),state:node.querySelector('.enemy-state'),hp:node.querySelector('.enemy-hp'),windup:node.querySelector('.enemy-windup i'),lastHp:100};
    });
  }
  update(active){
    this.root.hidden=!active;if(!active){this.layoutTime=0;return;}
    if(!this.layoutTime||performance.now()-this.layoutTime>250||this.viewport!==`${innerWidth}/${innerHeight}`){
      this.viewport=`${innerWidth}/${innerHeight}`;this.layoutTime=performance.now();
      this.hudRects=[...document.querySelectorAll('.aaa-vitals,.aaa-compass,.aaa-objective,.aaa-tools,.aaa-stance,.aaa-abilities,.aaa-bottom-hint,.touch-pad,.touch-actions,#toast:not([hidden]),#hero-voice-caption:not([hidden])')]
        .filter(node=>node.getClientRects().length&&getComputedStyle(node).visibility!=='hidden')
        .map(node=>node.getBoundingClientRect());
    }
    const occupied=[];
    const ordered=this.system.enemies.map((e,i)=>({e,i,d:this.camera.position.distanceTo(e.actor.position)})).sort((a,b)=>a.d-b.d);
    for(const {e,i,d}of ordered){
      const row=this.rows[i],attack=e.state==='attack',visible=e.hp>0&&e.targetable!==false&&e.actor.visible&&d<9&&(e.hp<100||d<7||attack);
      if(!visible){row.node.hidden=true;continue;}
      if(e.state==='emerge')this.point.copy(e.motion.world(77)).add(new THREE.Vector3(0,.36,0));else {this.point.copy(e.actor.position);this.point.y+=2.48;}this.point.project(this.camera);
      const x=(this.point.x*.5+.5)*innerWidth,rawY=(-this.point.y*.5+.5)*innerHeight;
      // A close enemy's head may project into the compass. Keep its warning
      // readable beneath that HUD instead of dropping the imminent threat.
      if(row.viewport!==this.viewport){row.node.hidden=false;row.width=row.node.offsetWidth;row.height=row.node.offsetHeight;row.viewport=this.viewport;}
      const w=row.width,h=row.height,left=x-w/2;
      let top=Math.max(innerWidth<650?170:150,rawY-h/2);
      for(let pass=0;pass<4;pass++)for(const rect of this.hudRects){
        if(left<rect.right+8&&left+w>rect.left-8&&top<rect.bottom+8&&top+h>rect.top-8)top=rect.bottom+12;
      }
      const onScreen=this.point.z>-1&&this.point.z<1&&x>w/2+8&&x<innerWidth-w/2-8&&rawY>-40&&top+h<innerHeight-18;
      const clear=this.system.clearLine(this.camera.position,e.actor.position);
      if(!onScreen||!clear||occupied.some(p=>left<p.right+8&&left+w>p.left-8&&top<p.bottom+8&&top+h>p.top-8)){row.node.hidden=true;continue;}
      occupied.push({left,right:left+w,top,bottom:top+h});row.node.hidden=false;row.node.style.transform=`translate3d(${Math.round(left)}px,${Math.round(top)}px,0)`;
      row.node.classList.toggle('is-attacking',attack);row.node.classList.toggle('is-hit',e.hitAge<.23);
      row.node.classList.toggle('is-critical',e.hp<=30);row.state.textContent=e.state==='emerge'?(e.motion.emergence?.stage||'破土'):e.state==='idle'?(e.roarAmount>.15?'嘶吼':'游荡'):names[e.state]||'';
      row.node.querySelector('.enemy-status').textContent=attack?(e.time<1.08?'即将攻击':'攻击中'):'邪祟';
      row.windup.style.transform=`scaleX(${Math.min(e.time/1.08,1)})`;
      if(row.lastHp!==e.hp){
        row.node.classList.toggle('is-reset',e.hp>row.lastHp);row.lastHp=e.hp;
        row.fill.style.transform=`scaleX(${e.hp/100})`;row.lag.style.transform=`scaleX(${e.hp/100})`;
        row.track.setAttribute('aria-valuenow',String(e.hp));row.hp.textContent=`${e.hp} / 100`;
      }
    }
  }
}
