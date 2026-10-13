/* Original circular rigid-body arena engine. Fixed step, seeded randomness. */
(function(root){
'use strict';
const skills=['sword','armor','potion','wither','crystal','fire','hook','none'];
const presets=[
{id:'knight',name:'钻石剑士',avatar:'⚔️',hp:180,attack:19,mass:1.3,bounce:.95,speed:155,skill:'sword'},
{id:'crystal',name:'紫水晶簇',avatar:'💎',hp:155,attack:14,mass:1,bounce:1,speed:145,skill:'crystal'},
{id:'fire',name:'营火',avatar:'🔥',hp:210,attack:12,mass:1.8,bounce:.9,speed:115,skill:'fire'},
{id:'hook',name:'钓鱼竿',avatar:'🎣',hp:160,attack:13,mass:1,bounce:.98,speed:175,skill:'hook'},
{id:'tank',name:'铁甲守卫',avatar:'🛡️',hp:270,attack:11,mass:2.8,bounce:.85,speed:105,skill:'armor'},
{id:'heal',name:'药水术士',avatar:'🧪',hp:150,attack:12,mass:.9,bounce:1,speed:150,skill:'potion'},
{id:'wither',name:'凋灵',avatar:'☠️',hp:850,attack:24,mass:3.5,bounce:.92,speed:125,skill:'wither'}];
function validate(data){
 if(!data||!Array.isArray(data.fighters)||data.fighters.length<1||data.fighters.length>40)throw Error('fighters 必须包含 1–40 个角色');
 const ids=new Set();
 const fighters=data.fighters.map((f,i)=>{
  if(!f||typeof f!=='object')throw Error('角色格式错误');
  const id=String(f.id||'custom-'+i).slice(0,60); if(ids.has(id))throw Error('角色 id 不能重复'); ids.add(id);
  const out={id,name:String(f.name||'自制角色').slice(0,30),avatar:String(f.avatar||'🔮'),skill:f.skill||'none'};
  if(!skills.includes(out.skill))throw Error('未知技能: '+out.skill);
  if(out.avatar.length>1500000)throw Error('头像过大');
  if(out.avatar.length>20&&!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(out.avatar))throw Error('头像只接受表情或上传后生成的 PNG/JPEG/WebP 数据，不允许外部 URL/原始 SVG');
  for(const [k,lo,hi,def] of [['hp',10,5000,180],['attack',1,200,15],['mass',.2,10,1],['bounce',.4,1.2,.95],['speed',40,350,150]]){
   const n=Number(f[k]??def);if(!Number.isFinite(n)||n<lo||n>hi)throw Error(`${out.name}: ${k} 应在 ${lo}–${hi} 之间`);out[k]=n;
  }return out;
 });
 let roster=data.roster;
 if(roster===undefined)roster=fighters.slice(0,12).map((f,i)=>({id:f.id,team:i%2}));
 if(!Array.isArray(roster)||roster.length<2||roster.length>12||!roster.every(r=>r&&ids.has(r.id)&&(r.team===0||r.team===1))||new Set(roster.map(r=>r.team)).size!==2)throw Error('roster 需要 2–12 名选手，且双方都有成员');
 return {version:1,fighters,roster:roster.map(r=>({id:r.id,team:r.team})),seed:(Number.isFinite(Number(data.seed))?Math.floor(Number(data.seed)):2025)>>>0};
}
class Arena{
 constructor(config){this.config=validate(config);this.seed=this.config.seed;this.time=0;this.events=[];this.shots=[];this.cool=new Map();this.result=null;this.width=960;this.height=600;
 this.balls=this.config.roster.map((r,i)=>{const f=this.config.fighters.find(f=>f.id===r.id);return {...f,uid:i,team:r.team,x:r.team?740:220,y:60+(this.config.roster.filter((v,j)=>j<i&&v.team===r.team).length+.5)*480/this.config.roster.filter(v=>v.team===r.team).length,r:f.skill==='wither'?36:25,health:f.hp,vx:(r.team?-1:1)*(f.speed*.7),vy:(this.random()-.5)*f.speed*1.5,next:1+this.random()*2,burn:0,trail:[]};});
 }
 random(){this.seed=(1664525*this.seed+1013904223)>>>0;return this.seed/4294967296;}
 event(type,detail){this.events.push({type,time:this.time,...detail});}
 hit(target,amount,source,kind='碰撞'){
 if(target.health<=0)return; amount=Math.max(1,Math.round(amount*(target.skill==='armor'?.65:1)));target.health=Math.max(0,target.health-amount);this.event('hit',{x:target.x,y:target.y,amount,team:target.team,kind,source:source.name,target:target.name});
 if(target.health===0)this.event('kill',{source:source.name,target:target.name,team:source.team});
 }
 step(dt=1/120){if(this.result)return;this.time+=dt;
 for(const b of this.balls){if(b.health<=0)continue;
 const enemies=this.balls.filter(x=>x.team!==b.team&&x.health>0);const t=enemies.sort((a,c)=>Math.hypot(a.x-b.x,a.y-b.y)-Math.hypot(c.x-b.x,c.y-b.y))[0];
 if(t){let dx=t.x-b.x,dy=t.y-b.y,d=Math.hypot(dx,dy)||1;b.vx+=dx/d*32*dt;b.vy+=dy/d*32*dt;}
 const v=Math.hypot(b.vx,b.vy)||1;const desired=b.speed;const factor=1+(desired/v-1)*Math.min(1,dt*1.8);b.vx*=factor;b.vy*=factor;
 b.x+=b.vx*dt;b.y+=b.vy*dt;
 for(const [p,vel,size] of [['x','vx',this.width],['y','vy',this.height]]){if(b[p]<b.r){b[p]=b.r;b[vel]=Math.abs(b[vel])*b.bounce;}if(b[p]>size-b.r){b[p]=size-b.r;b[vel]=-Math.abs(b[vel])*b.bounce;}}
 if(b.burn>this.time&&Math.floor(this.time*2)!==Math.floor((this.time-dt)*2))this.hit(b,3,{name:'持续灼烧'},'灼烧');
 if(this.time>=b.next&&t){b.next=this.time+({wither:2.5,crystal:3,fire:2,hook:3.5,potion:4,sword:3}[b.skill]||4);
  if(['wither','crystal'].includes(b.skill)){const n=b.skill==='wither'?3:5;for(let k=0;k<n;k++){const a=Math.atan2(t.y-b.y,t.x-b.x)+(k-(n-1)/2)*.23;this.shots.push({x:b.x,y:b.y,vx:Math.cos(a)*290,vy:Math.sin(a)*290,life:3,owner:b,kind:b.skill});}this.event('skill',{source:b.name,kind:b.skill,x:b.x,y:b.y});}
  if(b.skill==='fire'){for(const e of enemies)if(Math.hypot(e.x-b.x,e.y-b.y)<150){e.burn=this.time+3;this.hit(e,b.attack*.65,b,'火焰');}this.event('pulse',{x:b.x,y:b.y,team:b.team});}
  if(b.skill==='hook'){const d=Math.hypot(t.x-b.x,t.y-b.y)||1;t.vx+=(b.x-t.x)/d*160;t.vy+=(b.y-t.y)/d*160;this.hit(t,b.attack*.6,b,'钩索');this.event('link',{x:b.x,y:b.y,tx:t.x,ty:t.y});}
  if(b.skill==='potion'){const ally=this.balls.filter(e=>e.team===b.team&&e.health>0).sort((a,c)=>a.health/a.hp-c.health/c.hp)[0];const n=Math.min(22,ally.hp-ally.health);ally.health+=n;this.event('heal',{x:ally.x,y:ally.y,amount:n});}
  if(b.skill==='sword'&&Math.hypot(t.x-b.x,t.y-b.y)<130){this.hit(t,b.attack*1.2,b,'剑气');this.event('link',{x:b.x,y:b.y,tx:t.x,ty:t.y});}
 }
 }
 for(let i=0;i<this.balls.length;i++)for(let j=i+1;j<this.balls.length;j++){
 const a=this.balls[i],b=this.balls[j];if(a.health<=0||b.health<=0)continue;let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d>=a.r+b.r)continue;
 if(d<.001){dx=1;dy=0;d=1;}const nx=dx/d,ny=dy/d,ia=1/a.mass,ib=1/b.mass,over=a.r+b.r-d;
 a.x-=nx*over*ia/(ia+ib);a.y-=ny*over*ia/(ia+ib);b.x+=nx*over*ib/(ia+ib);b.y+=ny*over*ib/(ia+ib);
 const rel=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;if(rel<0){const impulse=-(1+Math.min(a.bounce,b.bounce))*rel/(ia+ib);a.vx-=impulse*nx*ia;a.vy-=impulse*ny*ia;b.vx+=impulse*nx*ib;b.vy+=impulse*ny*ib;}
 const key=i+':'+j;if(a.team!==b.team&&this.time>(this.cool.get(key)||0)){this.cool.set(key,this.time+.4);const scale=.8+Math.min(Math.abs(rel)/300,.6);this.hit(a,b.attack*scale,b);this.hit(b,a.attack*scale,a);}
 }
 for(const s of this.shots){s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=dt;for(const b of this.balls)if(b.team!==s.owner.team&&b.health>0&&Math.hypot(s.x-b.x,s.y-b.y)<b.r+6){this.hit(b,s.owner.attack*.7,s.owner,s.kind==='wither'?'凋灵骷髅':'晶簇');if(s.kind==='wither')b.burn=this.time+2;s.life=0;break;}}
 this.shots=this.shots.filter(s=>s.life>0&&s.x>=0&&s.y>=0&&s.x<=960&&s.y<=600);
 const alive=new Set(this.balls.filter(b=>b.health>0).map(b=>b.team));if(alive.size<2||this.time>=180){this.result=alive.size===1?[...alive][0]:'draw';this.event('end',{winner:this.result});}
 }
}
const api={Arena,validate,presets,skills};if(typeof module!=='undefined')module.exports=api;else root.Marble=api;
})(typeof window!=='undefined'?window:globalThis);
