import * as THREE from 'three';

// Each nurse keeps a different terrain cost field. Routes stay on the same
// walkable grid as the player, but do not all choose the same shortest line.
export function variedPath(nav,from,to,seed){
  const start=nav.index(from.x,from.z),goal=nav.index(to.x,to.z);
  if(start<0||goal<0||!nav.walk[start]||!nav.walk[goal])return [];
  const parent=new Int32Array(nav.walk.length);parent.fill(-1);
  const cost=new Float32Array(nav.walk.length);cost.fill(Infinity);cost[start]=0;
  const closed=new Uint8Array(nav.walk.length),heap=[];
  const gx=goal%nav.cols,gz=Math.floor(goal/nav.cols);
  const heuristic=i=>Math.abs(i%nav.cols-gx)+Math.abs(Math.floor(i/nav.cols)-gz);
  function push(id,score){let k=heap.length;heap.push({id,score});while(k){const p=(k-1)>>1;if(heap[p].score<=score)break;heap[k]=heap[p];k=p;}heap[k]={id,score};}
  function pop(){const first=heap[0],last=heap.pop();if(heap.length){let k=0;while(k*2+1<heap.length){let c=k*2+1;if(c+1<heap.length&&heap[c+1].score<heap[c].score)c++;if(heap[c].score>=last.score)break;heap[k]=heap[c];k=c;}heap[k]=last;}return first.id;}
  push(start,heuristic(start));
  while(heap.length){
    const p=pop();if(closed[p])continue;if(p===goal)break;closed[p]=1;
    const x=p%nav.cols;
    for(const q of [x>0?p-1:-1,x<nav.cols-1?p+1:-1,p-nav.cols,p+nav.cols]){
      if(q<0||q>=nav.walk.length||!nav.walk[q]||closed[q])continue;
      const wx=nav.origin[0]+(q%nav.cols+.5)*nav.cellSize,wz=nav.origin[1]+(Math.floor(q/nav.cols)+.5)*nav.cellSize;
      const field=.5+.5*Math.sin(wx*2.8+Math.sin(wz*.85+seed)*1.35+seed*2.13);
      const next=cost[p]+1+field*.95;if(next>=cost[q])continue;
      cost[q]=next;parent[q]=p;push(q,next+heuristic(q));
    }
  }
  if(goal!==start&&parent[goal]<0)return [];
  const path=[];for(let p=goal;p!==start;p=parent[p])path.push(new THREE.Vector3(nav.origin[0]+(p%nav.cols+.5)*nav.cellSize,0,nav.origin[1]+(Math.floor(p/nav.cols)+.5)*nav.cellSize));
  return path.reverse();
}

export function routeWaypoint(nav,from,player){
  const forward=player.clone().sub(from).setY(0),distance=forward.length();forward.normalize();
  if(distance<2.6)return player.clone();
  const side=new THREE.Vector3(forward.z,0,-forward.x),advance=Math.min(distance-1.5,1.8+Math.random()*1.4);
  for(let i=0;i<10;i++){
    const target=from.clone().addScaledVector(forward,advance).addScaledVector(side,(Math.random()-.5)*1.3);
    if(nav.canStand(target.x,target.z)){target.y=nav.ground(target.x,target.z);return target;}
  }
  return player.clone();
}
