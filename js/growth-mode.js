"use strict";

// 成长之路界面、正式战斗同源演示以及按阶位布置的专属场景。
function renderGrowth(type=growthState.type){
  growthState.type=type;const u=UNITS[type],unlocked=isUnitUnlocked(type);
  $("#growthRoster").innerHTML=Object.entries(UNITS).map(([key,item])=>{const unlocked=isUnitUnlocked(key),rank=save.ranks[key]||1,state=unlocked?`${rank}阶`:unlockProgressText(key);return `<button class="growth-unit ${key===type?'active':''} ${unlocked?'':'preview-locked'}" data-growth-unit="${key}" style="--unit-color:${item.color}" title="${item.name} · ${item.family} · ${state}" aria-label="${item.name}，${rank}阶，${state}"><span class="choice-card-art">${unitArt(key,'choice-art')}</span><span class="choice-card-rank">${rank}</span><span class="choice-card-footer growth-card-name">${item.name}</span></button>`;}).join('');
  $$("[data-growth-unit]").forEach(button=>button.onclick=()=>{growthState.mode='rank';growthState.rank=1;renderGrowth(button.dataset.growthUnit);});
  $("#growthUnitArt").innerHTML=unitArt(type,'growth-hero-art');$("#growthFamily").textContent=u.family+(unlocked?' · 已解锁':` · ${unlockProgressText(type)}`);$("#growthUnitName").textContent=u.name;$("#growthUnitDesc").textContent=u.desc;$("#growthCurrentRank").textContent=`${save.ranks[type]} 阶`;
  $("#growthTabs").innerHTML=RANK_TRAITS[type].map((trait,index)=>`<button class="${growthState.mode==='rank'&&growthState.rank===index+1?'active':''}" data-growth-rank="${index+1}"><b>${index+1}</b><span>${index+1}阶</span>${save.ranks[type]>=index+1?'<i>已达成</i>':'<i>预览</i>'}</button>`).join('')+`<button class="ultimate ${growthState.mode==='ult'?'active':''}" data-growth-ult="1"><b>豆</b><span>能量大招</span><i>实战预演</i></button>`;
  $$("[data-growth-rank]").forEach(button=>button.onclick=()=>{growthState.mode='rank';growthState.rank=+button.dataset.growthRank;renderGrowth(type);});
  $("[data-growth-ult]").onclick=()=>{growthState.mode='ult';renderGrowth(type);};
  $("#growthReplay").onclick=playGrowthDemo;
  const trait=growthState.mode==='ult'?ULT_TRAITS[type]:RANK_TRAITS[type][growthState.rank-1],roman=['I','II','III','IV','V'];
  $("#growthDemoTitle").textContent=growthState.mode==='ult'?`能量豆 · ${trait[0]}`:`${growthState.rank}阶 · ${trait[0]}`;$("#growthTraitTag").textContent=growthState.mode==='ult'?'ENERGY BEAN':`RANK ${roman[growthState.rank-1]}`;$("#growthTraitName").textContent=trait[0];$("#growthTraitText").textContent=trait[1];
  $("#growthTraitMeta").innerHTML=growthState.mode==='ult'?`<span>消耗 1 枚能量豆</span><span>${abilitySummary(type)}</span>`:`<span>${rankParameterSummary(growthState.rank,type)}</span><span>${growthState.rank<=save.ranks[type]?'当前存档已生效':'可提前预览'}</span>`;
  playGrowthDemo();
}

function abilitySummary(type){
  const s=ABILITY_SPECS[type];if(s.kind==='fan')return `实战同源：${s.lanes===3?'三组':'一组'}${s.fanDegrees}度扇形，共${s.shots}发普通弹，每发${s.damageMin}–${s.damageMax}伤害`;if(s.shots)return `实战同源：${s.shots}发 × ${s.damageMin?`${s.damageMin}–${s.damageMax}`:s.damage}伤害，间隔${s.interval}秒${s.freezeDamage?`，先造成${s.freezeDamage}冻结伤害`:''}`;if(s.energy)return `实战同源：立即获得${s.energy}能量${s.healAll?`，全体治疗${s.healAll}`:''}${s.armorAll?`，全体获得${s.armorAll}护甲`:''}`;if(s.kind==='radiance')return `实战同源：全体治疗${s.healAll}、获得${s.armorAll}护甲，并对全场敌军造成${s.damage}伤害`;if(s.kind==='whirl')return `实战同源：半径${s.radius}格内每名敌军${s.damage}伤害，每命中一名恢复${s.healPerHit}生命`;if(s.kind==='bombard')return `实战同源：轰击最多${s.maxTargets}名敌军，每炮${s.damage}伤害并产生${Math.round(s.splash*100)}%溅射`;if(s.markAll)return `实战同源：全场每名敌军${s.damage}基础伤害，并按暗印层数增幅`;if(s.armor)return `实战同源：获得${s.armor}基础护甲并回满生命`;if(s.frontCells)return `实战同源：前方${s.frontCells}格，每名敌军${s.damage}伤害`;return `实战同源：每名目标${s.damage}伤害${s.maxTargets?`，最多${s.maxTargets}名`:''}${s.freezeSeconds?`，停顿${s.freezeSeconds}秒`:''}`;
}
function rankParameterSummary(rank,type){return `实战同源：${RANK_TRAITS[type][rank-1][1]}`;}
function buildGrowthStage(){return `<div class="growth-board-scale"><div class="board"><div class="river-mark"><span>楚 河</span><span>漢 界</span></div><div class="grid growth-battle-grid"></div><div class="entity-layer growth-entity-layer"></div><div class="effect-layer growth-effect-layer"></div></div></div>`;}
function withBattleContext(state,effectLayer,action){const liveGame=game,liveEffect=effectLayerOverride;game=state;effectLayerOverride=effectLayer;try{return action();}finally{game=liveGame;effectLayerOverride=liveEffect;}}
function addGrowthEnemy(state,type,row,x){const enemy=spawnEnemy(type,row);enemy.x=x;return enemy;}
function growthEnemyPool(type){
  if(type==='spearPawn')return ['digger','guard','cannon'];
  if(UNITS[type].shape==='bishop')return ['digger','elephant','guard'];
  if(UNITS[type].shape==='knight')return ['horse','chariot','guard'];
  if(UNITS[type].shape==='queen')return ['soldier','cannon','horse','chariot','guard'];
  if(UNITS[type].shape==='rook')return ['soldier','chariot','guard','jester'];
  if(type==='shieldPawn')return ['horse','chariot','soldier'];
  if(UNITS[type].shape==='king')return ['soldier','horse','cannon'];
  return ['soldier','horse','cannon'];
}
function nextGrowthEnemy(state,type){const pool=growthEnemyPool(type),index=state.demoSpawnIndex||0;state.demoSpawnIndex=index+1;return pool[index%pool.length];}
function configureGrowthScenario(state,player,type,rank,mode){
  if(mode!=='rank')return;
  const addIce=(row,cols)=>cols.forEach(col=>{if(!state.hazards.some(h=>h.type==='ice'&&h.row===row&&h.col===col))state.hazards.push({id:++state.entityId,type:'ice',isHazard:true,blocksPlant:true,row,col,x:col});});
  if(type==='flameRook'&&rank>=3)addIce(player.row,[3,4,5,6]);
  if(type==='flameBishop')addIce(player.row-1,[2,4,6]);
  if(type==='iceRook'&&rank===2)addIce(player.row,[3,4,5]);
  if(type==='stormKnight'&&rank===2)addIce(player.row,[3,4]);
  if(type==='rook'&&rank===3){state.enemies=[];player.timer=0;player.storedShots=0;}
  if(type==='rook'&&rank>=4)state.hazards.push({id:++state.entityId,type:'shield',isHazard:true,blocksPlant:true,row:player.row,col:4,x:4,hp:900,maxHp:900});
  if(type==='spearPawn'&&rank>=4){state.enemies=[];addGrowthEnemy(state,'shieldGiant',player.row,6);}
  if(type==='poisonRook'&&rank>=4){state.enemies=[];const snake=addGrowthEnemy(state,'snake',player.row,6.4);snake.hp=4200;snake.maxHp=5000;}
  if(type==='poisonBishop'&&rank>=4){state.enemies=[];const snake=addGrowthEnemy(state,'snake',player.row+1,5.4);snake.hp=4200;snake.maxHp=5000;}
  if(type==='bishop'&&rank>=3){state.enemies=[];const jester=addGrowthEnemy(state,'jester',player.row+1,4);jester.reflectActive=1.5;}
  if(type==='knight'&&rank===4){player.hp=Math.round(player.maxHp*.2);player.col=4;player.traitCooldown=0;}
  if(type==='pawn'&&rank>=3){player.kills=rank>=5?3:2;player.promoted=rank>=5;state.enemies.forEach(e=>e.hp=Math.min(e.hp,120));}
  if(type==='king'){state.energy=rank>=3?20:100;state.cooldowns={pawn:5,rook:8,king:0};player.supportCycles=rank>=5?4:rank>=3?2:0;}
  if(type==='royalKing'){state.energy=rank===2?500:100;state.cooldowns={pawn:5,rook:8,king:4};player.supportCycles=rank>=3?2:0;}
  if(type==='twinBishop'&&rank>=2){state.players.push(createPlayer('pawn',1,3,false,1));state.players[state.players.length-1].hp=120;}
  if(type==='lightBishop'){const first=createPlayer('pawn',1,2,false,1),second=createPlayer('shieldPawn',3,2,false,1);first.hp=120;second.hp=260;state.players.push(first,second);}
}
function syncGrowthBattleScale(stage){
  const holder=$(".growth-board-scale",stage),board=$(".board",holder);if(!holder||!board||!stage.clientWidth||!stage.clientHeight)return;
  const scale=Math.min(stage.clientWidth/board.offsetWidth,stage.clientHeight/board.offsetHeight),x=(stage.clientWidth-board.offsetWidth*scale)/2,y=(stage.clientHeight-board.offsetHeight*scale)/2;
  holder.style.width=`${board.offsetWidth}px`;holder.style.height=`${board.offsetHeight}px`;holder.style.transform=`translate(${x}px,${y}px) scale(${scale})`;holder.dataset.scale=String(scale);
}
function setupGrowthBattle(stage){
  const {type,mode,rank}=growthState,demoRank=mode==='rank'?rank:save.ranks[type],spec=ABILITY_SPECS[type];
  stage.innerHTML=buildGrowthStage();buildGridInto($(".growth-battle-grid",stage));const entityLayer=$(".growth-entity-layer",stage),effectLayer=$(".growth-effect-layer",stage);
  if(growthScaleObserver)growthScaleObserver.disconnect();if(typeof ResizeObserver!=="undefined"){growthScaleObserver=new ResizeObserver(()=>syncGrowthBattleScale(stage));growthScaleObserver.observe(stage);}requestAnimationFrame(()=>syncGrowthBattleScale(stage));
  const state={preview:true,config:{id:'growth',loadout:[type]},energy:0,energyCollected:0,beans:1,beanDrops:[],abilityEvents:[],selected:type,cooldowns:{},players:[],enemies:[],hazards:[],projectiles:[],kills:0,wave:1,spawned:0,waveTarget:0,elapsed:0,paused:false,over:false,entityId:0,used:{},rankUps:[]};
  withBattleContext(state,effectLayer,()=>{
    const player=createPlayer(type,2,1,false,demoRank);player.timer=0;state.players.push(player);state.demoPlayer=player;
    const support=['support','fortress'].includes(spec.kind)||UNITS[type].attackMode==='support';
    if(support){[1,3].forEach(row=>{const ally=createPlayer('pawn',row,2,false,1);ally.hp=Math.round(ally.maxHp*.3);state.players.push(ally);addGrowthEnemy(state,nextGrowthEnemy(state,type),row,7.2);});}
    else if(mode==='ult'&&['queen','twinQueen','prismQueen','superQueen'].includes(type))[1,2,3].forEach(row=>{addGrowthEnemy(state,nextGrowthEnemy(state,type),row,5);addGrowthEnemy(state,nextGrowthEnemy(state,type),row,7);});
    else if(UNITS[type].shape==='bishop'){[[1,2],[0,3],[3,2],[4,3]].forEach(([row,x])=>addGrowthEnemy(state,nextGrowthEnemy(state,type),row,x));}
    else if(UNITS[type].shape==='queen')[1,2,3].forEach(row=>addGrowthEnemy(state,nextGrowthEnemy(state,type),row,5));
    else if(UNITS[type].shape==='knight'){[3,4,5].forEach(x=>addGrowthEnemy(state,nextGrowthEnemy(state,type),2,x));addGrowthEnemy(state,nextGrowthEnemy(state,type),1,3);}
    else if(UNITS[type].shape==='pawn'&&type!=='spearPawn'){addGrowthEnemy(state,nextGrowthEnemy(state,type),2,2.2);addGrowthEnemy(state,nextGrowthEnemy(state,type),2,3.2);addGrowthEnemy(state,nextGrowthEnemy(state,type),1,2.5);}
    else {addGrowthEnemy(state,nextGrowthEnemy(state,type),2,5);addGrowthEnemy(state,nextGrowthEnemy(state,type),2,7);addGrowthEnemy(state,nextGrowthEnemy(state,type),1,5.3);addGrowthEnemy(state,nextGrowthEnemy(state,type),3,5.3);}
    if(mode==='rank'){const cycle={pawn:3,shieldPawn:4,spearPawn:4,rook:5,twinRook:5,iceRook:3,flameRook:4,poisonRook:4,superRook:2,knight:3,stormKnight:3,frostKnight:3,bishop:3,twinBishop:3,iceBishop:3,flameBishop:3,poisonBishop:4,prismQueen:5}[type];if(cycle)player.traitHits=cycle-1;if(type==='queen'&&rank===3)player.attackCycles=2;if(type==='twinQueen'&&rank===3)player.attackCycles=3;if(type==='superQueen'&&rank>=3)player.attackCycles=2;configureGrowthScenario(state,player,type,rank,mode);}
    renderEntities(state,entityLayer);
  });
  return {state,entityLayer,effectLayer};
}
function performGrowthBattleAction(state){const p=state.demoPlayer;if(growthState.mode==='ult')activateEnergyBean(p,{preview:true});else p.timer=0;}
function replenishGrowthBattle(state){
  const p=state.demoPlayer;if(!p||!state.players.includes(p)||state.enemies.length)return;
  if(UNITS[p.type].shape==='queen')adjacentRows(p.row).forEach(row=>{addGrowthEnemy(state,nextGrowthEnemy(state,p.type),row,7.2);if(p.type==='prismQueen')addGrowthEnemy(state,nextGrowthEnemy(state,p.type),row,8.4);});
  else if(UNITS[p.type].shape==='bishop')[[0,3],[1,2],[3,2],[4,3]].forEach(([row,x])=>addGrowthEnemy(state,nextGrowthEnemy(state,p.type),row,x));
  else if(UNITS[p.type].shape==='knight'){addGrowthEnemy(state,nextGrowthEnemy(state,p.type),p.row,4.5);addGrowthEnemy(state,nextGrowthEnemy(state,p.type),clamp(p.row-1,0,4),5.2);}
  else {addGrowthEnemy(state,nextGrowthEnemy(state,p.type),p.row,7.2);addGrowthEnemy(state,nextGrowthEnemy(state,p.type),p.row,8.4);}
}
function playGrowthDemo(){
  const stage=$("#growthDemoStage");if(!stage)return;cancelAnimationFrame(growthDemoRaf);const token=++growthDemoToken;let scene=setupGrowthBattle(stage),last=performance.now(),elapsed=0,cast=false,replenishTimer=0;growthDemoGame=scene.state;
  const resetCycle=now=>{scene=setupGrowthBattle(stage);growthDemoGame=scene.state;last=now;elapsed=0;cast=false;replenishTimer=0;};
  const frame=now=>{if(token!==growthDemoToken)return;const dt=Math.min((now-last)/1000,.05);last=now;elapsed+=dt;replenishTimer+=dt;withBattleContext(scene.state,scene.effectLayer,()=>{
    if(!cast&&elapsed>=.55){cast=true;performGrowthBattleAction(scene.state);}
    updatePlayers(dt);updateEnemies(dt);updateAbilityEvents(dt);updateProjectiles(dt);
    if(replenishTimer>=.8){replenishTimer=0;replenishGrowthBattle(scene.state);}
    renderEntities(scene.state,scene.entityLayer);
  });
  const playerGone=!scene.state.players.includes(scene.state.demoPlayer),cycleDone=scene.state.over||elapsed>=9||(playerGone&&elapsed>=2.4);if(cycleDone)resetCycle(now);growthDemoRaf=requestAnimationFrame(frame);};growthDemoRaf=requestAnimationFrame(frame);
}
