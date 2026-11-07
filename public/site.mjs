export function mountSite({canvas,scene,reducedMotion=false,requestFrame=requestAnimationFrame,cancelFrame=cancelAnimationFrame}){
 const ctx=canvas.getContext('2d');let state=scene,frame=null,paused=false,dead=false,sprite=null,last=0;
 if(typeof Image!=='undefined'){sprite=new Image();sprite.onload=()=>paint(0);sprite.src='/assets/construction/sprites.png';}
 const active=()=>Object.values(state.tasks).some(t=>t.status==='working'&&t.evidence==='observed');
 function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),w,h);}
 function paint(time){
  if(dead)return;ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,800,420);
  rect(0,0,800,420,'#e9e2cf');rect(0,274,800,146,'#bdc5a0');rect(0,310,800,38,'#c3ae87');
  for(let x=18;x<800;x+=42){rect(x,292+(x%3)*9,4,8,'#8e9e78');rect(x+7,297,3,5,'#8e9e78');}
  // Construction geometry: timber hoarding, crane, measured foundations.
  for(let x=36;x<765;x+=28){rect(x,239,5,47,'#a18a63');rect(x+5,247,23,7,'#b7a17b');rect(x+5,268,23,6,'#b7a17b');}
  rect(90,90,12,185,'#be652e');rect(65,90,250,10,'#c67b3c');rect(80,73,190,9,'#d1914d');rect(80,73,7,26,'#c67b3c');
  for(let y=110;y<255;y+=30){rect(102,y,25,5,'#b85c27');rect(122,y,5,30,'#c67b3c');}
  rect(290,100,3,95,'#5f594b');rect(282,194,20,9,'#5f594b');rect(274,205,36,15,'#b9a17a');
  rect(70,273,78,12,'#797461');rect(305,280,268,13,'#8f927d');
  const completed=Object.values(state.tasks).filter(t=>t.status==='completed').length;
  if(completed>0){rect(321,253,230,28,'#a39782');for(let x=330;x<550;x+=35)rect(x,257,2,22,'#d4cab5');}
  if(completed>1){rect(337,181,198,73,'#d7b27f');rect(353,199,38,36,'#6c8587');rect(472,199,38,36,'#6c8587');rect(415,212,36,42,'#796d58');}
  if(completed>2){for(let y=0;y<45;y+=7)rect(326+y*2,181-y,220-y*4,7,'#a75c37');}
  if(completed>3){rect(554,140,4,140,'#5e6452');rect(558,142,40,25,'#356447');}
  if(completed===0){for(let x=330;x<550;x+=55){rect(x,262,4,20,'#887b61');rect(x,262,44,2,'#f6edcf');}}
  rect(638,230,70,50,'#8c9a81');rect(633,220,80,12,'#657b68');rect(650,241,17,20,'#dcd5bd');rect(680,249,17,31,'#4d6153');
  for(let i=0;i<4;i++){rect(190+i*18,269,15,13,'#b87545');rect(200+i*18,256,15,12,'#c98e56');}
  const moving=active()&&!paused&&!reducedMotion&&!globalThis.document?.hidden;
  const positions=[[185,327],[266,289],[582,300],[430+(moving?Math.sin(time/900)*48:0),324],[665,337]];
  for(let i=0;i<5;i++){const [x,y]=positions[i],bob=moving&&i===3?Math.floor(time/180)%2*2:0;rect(x-4,y+49,42,5,'#a7a78c');if(sprite?.complete&&sprite.naturalWidth)ctx.drawImage(sprite,i*20,0,20,28,Math.round(x),y-bob,40,56);else{rect(x+8,y+8,24,14,'#d8953d');rect(x+10,y+22,20,23,['#706a5d','#6f8b91','#ac7548','#6c856a','#8c7584'][i]);}}
 }
 function tick(time){frame=null;if(dead||paused||reducedMotion||globalThis.document?.hidden)return;if(time-last>=32){paint(time);last=time;}if(active())frame=requestFrame(tick);}
 function schedule(){if(!dead&&!paused&&!reducedMotion&&frame===null&&!globalThis.document?.hidden)frame=requestFrame(tick);}
 const visibility=()=>{if(globalThis.document?.hidden){if(frame!==null)cancelFrame(frame);frame=null;}else{paint(0);schedule();}};
 globalThis.document?.addEventListener('visibilitychange',visibility);
 paint(0);schedule();
 return {update(next){state=next;paint(0);schedule();},setPaused(value){paused=value;if(frame!==null){cancelFrame(frame);frame=null;}paint(0);if(!paused)schedule();},destroy(){dead=true;if(frame!==null)cancelFrame(frame);frame=null;globalThis.document?.removeEventListener('visibilitychange',visibility);if(sprite)sprite.onload=null;}};
}
