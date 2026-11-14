export class CorridorNavigation {
  constructor(data){Object.assign(this,data);}
  // A straight shot can span any two points in this navigation map. Derive
  // its safety limit from the current map rather than the original alley.
  get projectileRange(){return Math.hypot(this.cols*this.cellSize,this.rows*this.cellSize);}
  index(x,z){const ix=Math.floor((x-this.origin[0])/this.cellSize),iz=Math.floor((z-this.origin[1])/this.cellSize);return ix<0||iz<0||ix>=this.cols||iz>=this.rows?-1:iz*this.cols+ix;}
  canStand(x,z,camera=false){const i=this.index(x,z);return i>=0&&Boolean((camera?this.camera:this.walk)[i]);}
  ground(x,z){
    const gx=(x-this.origin[0])/this.cellSize-.5,gz=(z-this.origin[1])/this.cellSize-.5;
    const ix=Math.floor(gx),iz=Math.floor(gz),tx=gx-ix,tz=gz-iz;
    const at=(a,b)=>this.heights[Math.max(0,Math.min(this.rows-1,b))*this.cols+Math.max(0,Math.min(this.cols-1,a))];
    return (at(ix,iz)*(1-tx)+at(ix+1,iz)*tx)*(1-tz)+(at(ix,iz+1)*(1-tx)+at(ix+1,iz+1)*tx)*tz;
  }
  move(position,dx,dz){
    const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/(this.cellSize*.4))),sx=dx/steps,sz=dz/steps;
    for(let i=0;i<steps;i++){
      if(this.canStand(position.x+sx,position.z+sz)){position.x+=sx;position.z+=sz;}
      else {
        if(this.canStand(position.x+sx,position.z))position.x+=sx;
        if(this.canStand(position.x,position.z+sz))position.z+=sz;
      }
    }
    return position;
  }
  cameraFraction(from,to){
    const dx=to.x-from.x,dz=to.z-from.z,steps=Math.ceil(Math.hypot(dx,dz)/.04);
    for(let i=1;i<=steps;i++){
      const t=i/steps;
      if(!this.canStand(from.x+dx*t,from.z+dz*t,true))return Math.max(0,(i-2)/steps);
    }
    return 1;
  }
}
