"use strict";

const $ = (q, root = document) => root.querySelector(q);
const $$ = (q, root = document) => [...root.querySelectorAll(q)];
const AUTO_COLLECT_DELAY = 1500;
const RESOURCE_FLIGHT_DURATION = 680;

let save = loadSave();
let game = null;
let dialogue = null;
let toastTimer = 0;
let pendingBattle = null;
let pendingChallenge = null;
let pendingBuffBattle = null;
let selectedBattleBuff = null;
let selectedLoadout = [];
let loadoutFocusType = "pawn";
let customRoomDraft = null;
let snakePitDraft = 100;
let growthState = {type:"pawn",mode:"rank",rank:1};
let growthDemoToken = 0;
let growthDemoGame = null;
let growthDemoRaf = 0;
let effectLayerOverride = null;
let growthScaleObserver = null;

function loadSave(){
  try { const stored=JSON.parse(localStorage.getItem("chessWarSave")||"{}");return {...defaults,...stored,ranks:{...defaults.ranks,...stored.ranks},mastery:{...defaults.mastery,...stored.mastery},unlockProgress:{...defaults.unlockProgress,...stored.unlockProgress},specialUnlocked:{...defaults.specialUnlocked,...stored.specialUnlocked}}; }
  catch { return structuredClone(defaults); }
}
function persist(){ localStorage.setItem("chessWarSave", JSON.stringify(save)); }
function showScreen(id){if(id!=="growthScreen"){cancelAnimationFrame(growthDemoRaf);growthDemoToken++;}$$(".screen").forEach(s=>s.classList.toggle("active",s.id===id)); window.scrollTo(0,0); }
function toast(text){ const el=$("#toast"); el.textContent=text; el.classList.add("show"); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove("show"),1800); }
function clamp(n,a,b){ return Math.max(a,Math.min(b,n)); }
function fmtTime(sec){ sec=Math.max(0,Math.round(sec)); return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,"0")}`; }
function unitArt(type,extra=""){
  const u=UNITS[type]||UNITS.pawn;
  return `<span class="unit-art art-${u.shape} skin-${type} ${extra}" style="--art-color:${u.color}" aria-hidden="true"><i class="art-body"></i><i class="art-mark"></i><i class="art-glow"></i></span>`;
}

function init(){
  $$('[data-open]').forEach(b=>b.addEventListener('click',()=>{ const id=b.dataset.open; if(id==='archiveScreen') renderArchive(); showScreen(id); }));
  $("#storyButton").onclick=()=>{ renderStory(); showScreen("storyScreen"); };
  $("#battleButton").onclick=()=>{ renderChallenges(); showScreen("battleScreen"); };
  $("#growthButton").onclick=()=>{ renderGrowth(); showScreen("growthScreen"); };
  $("#dialogueNext").onclick=nextDialogue;
  $("#dialogueSkip").onclick=finishDialogue;
  $("#pauseButton").onclick=()=>setPause(true);
  $("#beanButton").onclick=selectEnergyBean;
  $("#resumeButton").onclick=()=>setPause(false);
  $("#pauseQuit").onclick=quitGame;
  $("#gameQuit").onclick=()=>setPause(true);
  $("#loadoutBack").onclick=()=>{showScreen(pendingBattle?.kind==='story'?'storyScreen':pendingBattle?.snakePit?'snakePitScreen':'difficultyScreen');};
  $("#difficultyBack").onclick=()=>{pendingChallenge=null;showScreen('battleScreen');};
  $("#snakePitBack").onclick=()=>{pendingChallenge=null;renderChallenges();showScreen('battleScreen');};
  $("#snakeCountRange").oninput=event=>{snakePitDraft=normalizeSnakeCount(event.target.value);renderSnakePitConfig();};
  $("#snakePitStart").onclick=confirmSnakePit;
  $("#customRoomBack").onclick=()=>{save.customRoom=structuredClone(customRoomDraft);persist();renderChallenges();showScreen('battleScreen');};
  $("#customAddEnemy").onclick=()=>{if(customRoomDraft.enemies.length>=12){toast('最多编排12支敌军队伍');return;}customRoomDraft.enemies.push({type:'soldier',count:5,row:-1});renderCustomRoom();};
  $("#customRoomStart").onclick=startCustomRoom;
  $("#buffBack").onclick=()=>{if(pendingBuffBattle?.kind==='custom'){pendingBuffBattle=null;selectedBattleBuff=null;renderCustomRoom();showScreen('customRoomScreen');return;}pendingBattle=pendingBuffBattle;pendingBuffBattle=null;selectedBattleBuff=null;renderLoadout();showScreen('loadoutScreen');};
  $("#buffStart").onclick=confirmBattleBuff;
  $("#startAssault").onclick=startPreparedAssault;
  $("#loadoutStart").onclick=confirmLoadout;
  $("#resultHome").onclick=()=>{ stopGame(); showScreen("homeScreen"); updateHome(); };
  $("#resultNext").onclick=handleResultNext;
  buildGrid(); updateHome();
}

function updateHome(){
  const total=Object.keys(ENEMIES).length;
  $("#archiveCount").textContent=`${Math.min(save.archiveUnlocked,total)}/${total}`;
}

function renderStory(){
  const map=$("#levelMap"); map.innerHTML="";
  STORY.forEach((lvl,i)=>{
    const unlocked=i<save.storyUnlocked;
    const complete=i<save.storyUnlocked-1;
    const card=document.createElement("button");
    card.className=`level-card ${!unlocked?'locked':''} ${i===save.storyUnlocked-1?'current':''} ${lvl.boss?'boss':''}`;
    card.innerHTML=`<span class="level-index">CHAPTER ${String(i+1).padStart(2,"0")}</span><span class="level-state">${complete?'✓ 已完成':unlocked?'可挑战':'◈ 未解锁'}</span><h4>${lvl.title}</h4><p>${lvl.subtitle}</p><span class="level-icon">${lvl.icon}</span>`;
    if(unlocked) card.onclick=()=>startStory(i);
    map.append(card);
  });
  $("#storyProgressLabel").textContent=`第 ${Math.min(save.storyUnlocked,6)} / 6 章`;
  $("#storyProgressBar").style.width=`${(Math.min(save.storyUnlocked,6)/6)*100}%`;
}

function renderChallenges(){
  $("#challengeGrid").innerHTML=CHALLENGES.map(c=>`<button class="challenge-card" data-id="${c.id}"><div class="challenge-visual">${c.icon}</div><div class="challenge-content"><span class="eyebrow">${c.label}</span><h3>${c.title}</h3><p>${c.text}</p><span class="challenge-objective">${c.objective}</span></div></button>`).join("")+`<button class="challenge-card custom-challenge-card" id="customRoomButton"><div class="challenge-visual">编</div><div class="challenge-content"><span class="eyebrow">CUSTOM ROOM</span><h3>自定义房间</h3><p>自由设定敌军种类、数量和出兵行，并指定我方棋子及其临时阶位。</p><span class="challenge-objective">目标 · 打完你亲手编排的棋局</span></div></button>`;
  $$(".challenge-card[data-id]").forEach(el=>el.onclick=()=>{const config=CHALLENGES.find(c=>c.id===el.dataset.id);if(config?.snakePit)openSnakePitConfig(config);else openDifficulty(config);});
  $("#customRoomButton").onclick=openCustomRoom;
}
function normalizeSnakeCount(value){return clamp(Math.round((+value||100)/100)*100,100,1000);}
function openSnakePitConfig(config=CHALLENGES.find(c=>c.snakePit),count=save.snakePitCount||100){
  pendingChallenge=config;snakePitDraft=normalizeSnakeCount(count);renderSnakePitConfig();showScreen('snakePitScreen');
}
function renderSnakePitConfig(){
  const count=normalizeSnakeCount(snakePitDraft);snakePitDraft=count;$("#snakeCountValue").textContent=count;$("#snakeCountRange").value=String(count);$("#snakeThreatValue").textContent=count>=800?'灭国级':count>=500?'灾厄级':count>=300?'围城级':'侵袭级';
  $$("[data-snake-count]").forEach(button=>{button.classList.toggle('active',+button.dataset.snakeCount===count);button.onclick=()=>{snakePitDraft=+button.dataset.snakeCount;renderSnakePitConfig();};});
}
function confirmSnakePit(){
  const config=pendingChallenge||CHALLENGES.find(c=>c.snakePit),snakeCount=normalizeSnakeCount(snakePitDraft);save.snakePitCount=snakeCount;persist();openLoadout({kind:'challenge',...config,snakeCount,title:`${config.title} · ${snakeCount}蛇`});
}
function defaultCustomRoom(){return {enemies:[{type:'soldier',count:10,row:-1}],units:[{type:'pawn',rank:1},{type:'rook',rank:1},{type:'king',rank:1}]};}
function normalizeCustomRoom(value){
  const room=value&&Array.isArray(value.enemies)&&Array.isArray(value.units)?structuredClone(value):defaultCustomRoom();room.enemies=room.enemies.filter(e=>ENEMIES[e.type]).slice(0,12).map(e=>({type:e.type,count:clamp(Math.round(+e.count||1),1,100),row:clamp(Math.round(Number.isFinite(+e.row)?+e.row:-1),-1,4)}));room.units=room.units.filter(u=>UNITS[u.type]).slice(0,6).map(u=>({type:u.type,rank:clamp(Math.round(+u.rank||1),1,5)}));if(!room.enemies.length)room.enemies=defaultCustomRoom().enemies;if(!room.units.length)room.units=defaultCustomRoom().units;return room;
}
function openCustomRoom(){customRoomDraft=normalizeCustomRoom(save.customRoom);renderCustomRoom();showScreen('customRoomScreen');}
function renderCustomRoom(){
  if(!customRoomDraft)customRoomDraft=defaultCustomRoom();const total=customRoomDraft.enemies.reduce((sum,e)=>sum+e.count,0),enemyOptions=Object.entries(ENEMIES).map(([type,e])=>`<option value="${type}">${e.name} · ${e.char}</option>`).join(''),rowOptions='<option value="-1">随机行</option>'+Array.from({length:5},(_,i)=>`<option value="${i}">第 ${i+1} 行</option>`).join('');
  $("#customRoomSummary").textContent=`敌军 ${total} · 我方 ${customRoomDraft.units.length} 种`;$("#customUnitCount").textContent=customRoomDraft.units.length;
  $("#customEnemyRows").innerHTML=customRoomDraft.enemies.map((entry,index)=>`<div class="custom-enemy-row" data-custom-enemy="${index}" style="--enemy-accent:${ENEMIES[entry.type].boss?'#9c3b82':'#a43c32'}"><select data-custom-enemy-type>${enemyOptions}</select><input data-custom-enemy-count type="number" min="1" max="100" value="${entry.count}" aria-label="敌军数量"><select data-custom-enemy-row>${rowOptions}</select><button data-custom-enemy-remove title="删除这一队">×</button></div>`).join('');
  $$("[data-custom-enemy]").forEach(row=>{const index=+row.dataset.customEnemy,entry=customRoomDraft.enemies[index],type=$("[data-custom-enemy-type]",row),count=$("[data-custom-enemy-count]",row),lane=$("[data-custom-enemy-row]",row);type.value=entry.type;lane.value=String(entry.row);type.onchange=()=>{entry.type=type.value;renderCustomRoom();};count.oninput=()=>{entry.count=clamp(Math.round(+count.value||1),1,100);const sum=customRoomDraft.enemies.reduce((total,e)=>total+e.count,0);$("#customRoomSummary").textContent=`敌军 ${sum} · 我方 ${customRoomDraft.units.length} 种`;$("#customRoomStart").disabled=!customRoomDraft.units.length||!sum||sum>300;};count.onchange=renderCustomRoom;lane.onchange=()=>{entry.row=+lane.value;renderCustomRoom();};$("[data-custom-enemy-remove]",row).onclick=()=>{if(customRoomDraft.enemies.length===1){toast('至少保留一支敌军队伍');return;}customRoomDraft.enemies.splice(index,1);renderCustomRoom();};});
  $("#customUnitGrid").innerHTML=Object.entries(UNITS).map(([type,u])=>{const chosen=customRoomDraft.units.find(x=>x.type===type),rank=chosen?.rank||1;return `<div class="custom-unit-entry ${chosen?'selected':''}" data-custom-unit="${type}" style="--unit-color:${u.color}" role="button" tabindex="0">${unitArt(type,'compact-art')}<strong>${u.name}</strong><small>${u.family}</small><span class="custom-rank-picker">${Array.from({length:5},(_,i)=>`<button class="${rank===i+1?'active':''}" data-custom-rank="${i+1}" title="设为${i+1}阶">${i+1}阶</button>`).join('')}</span></div>`;}).join('');
  $$("[data-custom-unit]").forEach(card=>{const type=card.dataset.customUnit;card.onclick=event=>{if(event.target.closest('[data-custom-rank]'))return;const index=customRoomDraft.units.findIndex(u=>u.type===type);if(index>=0)customRoomDraft.units.splice(index,1);else if(customRoomDraft.units.length>=6){toast('自定义房间最多选择6种我方棋子');return;}else customRoomDraft.units.push({type,rank:1});renderCustomRoom();};$$("[data-custom-rank]",card).forEach(button=>button.onclick=event=>{event.stopPropagation();let chosen=customRoomDraft.units.find(u=>u.type===type);if(!chosen){if(customRoomDraft.units.length>=6){toast('自定义房间最多选择6种我方棋子');return;}chosen={type,rank:+button.dataset.customRank};customRoomDraft.units.push(chosen);}else chosen.rank=+button.dataset.customRank;renderCustomRoom();});});
  $("#customRoomStart").disabled=!customRoomDraft.units.length||!total||total>300;
}
function startCustomRoom(){
  const total=customRoomDraft.enemies.reduce((sum,e)=>sum+e.count,0);if(total>300){toast('房间敌军总数不能超过300');return;}if(!customRoomDraft.units.length){toast('至少选择一种我方棋子');return;}save.customRoom=structuredClone(customRoomDraft);persist();const loadout=customRoomDraft.units.map(u=>u.type),customRanks=Object.fromEntries(customRoomDraft.units.map(u=>[u.type,u.rank]));pendingBuffBattle={kind:'custom',id:'custom',title:'自定义房间',objective:'清除自定义敌军',waves:1,energy:2000,setupPhase:true,customEnemies:structuredClone(customRoomDraft.enemies),customRanks,loadout};openBuffSelection();
}
function openDifficulty(config){
  pendingChallenge=config;$("#difficultyMission").textContent=config.title;$("#difficultyTitle").textContent=config.title;$("#difficultyText").textContent=config.text;$("#difficultyObjective").textContent=config.objective;
  $("#difficultyGrid").innerHTML=Object.entries(DIFFICULTIES).map(([key,d])=>`<button class="difficulty-card difficulty-${key}" data-difficulty="${key}"><span>${d.label}</span><b>${d.name}</b><p>${d.desc}</p><div><i>生命 ×${d.hp}</i><i>攻击 ×${d.damage}</i><i>敌量 ×${d.count}</i></div></button>`).join('');
  $$("[data-difficulty]").forEach(button=>button.onclick=()=>startChallenge(config,button.dataset.difficulty));showScreen('difficultyScreen');
}

function renderArchive(selected=0){
  const keys=Object.keys(ENEMIES);
  $("#archiveList").innerHTML=keys.map((k,i)=>{ const e=ENEMIES[k], locked=i>=save.archiveUnlocked; return `<button class="archive-item ${i===selected&&!locked?'active':''} ${locked?'locked':''}" data-i="${i}"><b>${locked?'?':e.char}</b><span><b>${locked?'未解密':e.name}</b><small>${locked?'完成更多故事关卡':'汉界军 · UNIT '+String(i+1).padStart(2,'0')}</small></span></button>`; }).join("");
  $$(".archive-item:not(.locked)").forEach(el=>el.onclick=()=>renderArchive(+el.dataset.i));
  const i=Math.min(selected,save.archiveUnlocked-1), e=ENEMIES[keys[i]];
  $("#archiveDetail").innerHTML=`<div class="archive-hero"><div class="archive-disc">${e.char}</div><div class="archive-title"><span>ENEMY FILE · ${String(i+1).padStart(3,'0')}</span><h3>${e.name}</h3><p>${e.boss?'统御蛇影军团的最终首领':'汉界军标准作战单位'} · ${e.range?'远程型':e.speed>.2?'高速型':e.hp>1200?'重甲型':'近战型'}</p><div class="stat-bars">${['耐久','攻击','速度'].map((n,j)=>`<div class="stat-bar"><span>${n}</span><b>${e.stats[j]}</b><div><i style="width:${e.stats[j]}%"></i></div></div>`).join('')}</div></div></div><div class="intel-note"><b>作战笔记</b><p>${e.intel}</p></div>`;
}

function startStory(index){
  const level=STORY[index];
  const config={kind:'story',storyIndex:index,title:level.title,waves:level.waves,energy:level.energy,boss:level.boss,featured:level.featured};
  runDialogue(level.pre,{title:`第 ${index+1} 章\n${level.title}`, onDone:()=>openLoadout(config)});
}
function startChallenge(config,difficulty='standard'){const difficultyData=DIFFICULTIES[difficulty]||DIFFICULTIES.standard;openLoadout({kind:'challenge',...config,title:`${config.title} · ${difficultyData.name}`,difficulty,difficultyData});}

function specialUnlockRule(type){return SPECIAL_UNLOCKS[type]||null;}
function isUnitUnlocked(type){const u=UNITS[type],rule=specialUnlockRule(type);return !!u&&(u.unlockKey?(!!save.specialUnlocked[type]||(!rule?.battleOnly&&(save.unlockProgress[u.unlockKey]||0)>=rule.target)):save.storyUnlocked>=(u.unlockAt||99));}
function unlockProgressText(type){
  const rule=specialUnlockRule(type),u=UNITS[type];if(!rule)return `第 ${u.unlockAt} 章解锁`;if(save.specialUnlocked[type])return `特殊条件已完成 · ${rule.name}`;
  const value=rule.battleOnly?(game?.used?.queen||0):(save.unlockProgress[u.unlockKey]||0);return `${rule.description} · ${Math.min(rule.target,Math.floor(value))}/${rule.target}`;
}
function unlockSpecial(type){if(save.specialUnlocked[type])return false;save.specialUnlocked[type]=true;persist();toast(`秘藏棋子解锁 · ${UNITS[type].name}`);return true;}
function recordUnlockProgress(key,amount=1){
  if(!game||game.preview||amount<=0)return;save.unlockProgress[key]=(save.unlockProgress[key]||0)+amount;
  Object.entries(UNITS).filter(([,u])=>u.unlockKey===key).forEach(([type])=>{const rule=specialUnlockRule(type);if(rule&&!rule.battleOnly&&save.unlockProgress[key]>=rule.target)unlockSpecial(type);});persist();
}
function openLoadout(config){
  pendingBattle=config;const available=Object.keys(UNITS).filter(isUnitUnlocked),remembered=(save.lastLoadout||[]).filter(k=>available.includes(k));selectedLoadout=(remembered.length?remembered:['pawn','rook','king'].filter(k=>available.includes(k))).slice(0,6);loadoutFocusType=selectedLoadout[0]||available[0]||'pawn';renderLoadout();showScreen('loadoutScreen');
}
function renderLoadoutPreview(){
  const type=UNITS[loadoutFocusType]?loadoutFocusType:(selectedLoadout[0]||'pawn'),u=UNITS[type],rank=save.ranks[type]||1,selected=selectedLoadout.includes(type),unlocked=isUnitUnlocked(type);$("#loadoutUnitPreview").style.setProperty('--unit-color',u.color);$("#loadoutUnitPreview").innerHTML=`<span class="loadout-preview-art">${unitArt(type,'loadout-preview-piece')}</span><div><span>${u.family} · ${unlocked?'已解锁':unlockProgressText(type)}</span><h3>${u.name}</h3><p>${u.desc}</p></div><aside><small>当前阶位</small><b>${rank}阶</b><i>${selected?'✓ 已加入编队':`✦ ${u.cost} 能量`}</i></aside>`;
}
function renderLoadout(){
  $("#loadoutMission").textContent=pendingBattle?.title||'战斗编队';$("#loadoutCount").textContent=selectedLoadout.length;
  $("#loadoutSlots").innerHTML=Array.from({length:6},(_,i)=>{const k=selectedLoadout[i],u=k&&UNITS[k];return `<span class="loadout-slot ${u?'filled':''}">${u?`${unitArt(k,'compact-art')}<small>${u.name}</small>`:'<b>＋</b><small>空位</small>'}</span>`;}).join('');
  $("#loadoutRoster").innerHTML=Object.entries(UNITS).map(([k,u])=>{const unlocked=isUnitUnlocked(k),selected=selectedLoadout.includes(k),state=unlocked?(selected?'已上场':'点击选择'):unlockProgressText(k),rank=save.ranks[k]||1;return `<button class="roster-card ${selected?'selected':''} ${unlocked?'':'locked'} ${loadoutFocusType===k?'focused':''}" data-unit="${k}" style="--unit-color:${u.color}" title="${u.name} · ${u.desc} · ${state}" aria-label="${u.name}，${rank}阶，需要${u.cost}能量，${state}" ${unlocked?'':'disabled'}><span class="choice-card-art">${unitArt(k,'choice-art')}</span><span class="choice-card-rank">${rank}</span><span class="choice-card-footer"><i>✦</i>${u.cost}</span></button>`;}).join('');
  $$(".roster-card:not(.locked)").forEach(el=>{el.onclick=()=>toggleLoadout(el.dataset.unit);el.onmouseenter=()=>{loadoutFocusType=el.dataset.unit;renderLoadoutPreview();};el.onfocus=()=>{loadoutFocusType=el.dataset.unit;renderLoadoutPreview();};});renderLoadoutPreview();$("#loadoutStart").disabled=selectedLoadout.length===0;
}
function toggleLoadout(type){loadoutFocusType=type;const index=selectedLoadout.indexOf(type);if(index>=0)selectedLoadout.splice(index,1);else if(selectedLoadout.length>=6){toast('每场最多选择6种棋子');renderLoadoutPreview();return;}else selectedLoadout.push(type);renderLoadout();}
function confirmLoadout(){if(!pendingBattle||!selectedLoadout.length)return;save.lastLoadout=[...selectedLoadout];persist();if(pendingBattle.snakePit){const config={...pendingBattle,loadout:[...selectedLoadout]};pendingBattle=null;beginGame(config);return;}pendingBuffBattle={...pendingBattle,loadout:[...selectedLoadout]};pendingBattle=null;openBuffSelection();}
function openBuffSelection(){
  if(!pendingBuffBattle)return;selectedBattleBuff=null;$("#buffMission").textContent=pendingBuffBattle.title;$("#buffSelectionText").textContent='尚未选择增益';$("#buffStart").disabled=true;
  $("#buffGrid").innerHTML=Object.entries(BATTLE_BUFFS).map(([key,b])=>`<button class="buff-card" data-buff="${key}"><span>${b.label}</span><b class="buff-icon">${b.icon}</b><h3>${b.name}</h3><p>${b.desc}</p><i>选择此增益</i></button>`).join('');
  $$("[data-buff]").forEach(button=>button.onclick=()=>{selectedBattleBuff=button.dataset.buff;$$('[data-buff]').forEach(card=>card.classList.toggle('selected',card===button));$("#buffSelectionText").textContent=`已选择 · ${BATTLE_BUFFS[selectedBattleBuff].name}`;$("#buffStart").disabled=false;});showScreen('buffScreen');
}
function confirmBattleBuff(){if(!pendingBuffBattle||!selectedBattleBuff)return;const config={...pendingBuffBattle,buff:selectedBattleBuff,buffData:BATTLE_BUFFS[selectedBattleBuff]};pendingBuffBattle=null;selectedBattleBuff=null;beginGame(config);}

function runDialogue(lines, opts){ dialogue={lines,index:0,...opts}; showScreen("dialogueScreen"); renderDialogue(); }
function renderDialogue(){
  const d=dialogue.lines[dialogue.index];
  $("#sceneTitle").textContent=dialogue.title||"王冠军\n战地记录";
  $("#dialogueSpeaker").textContent=d.s;
  $("#dialogueText").textContent=d.t;
  $("#portraitLeft").innerHTML=unitArt(d.side==='left'?'king':'pawn','portrait-art');
  $("#portraitRight").innerHTML=d.villain?'<span>蛇</span>':d.side==='right'?'<span class="xiangqi-portrait">兵</span>':'<span>蛇</span>';
  $("#portraitLeft").classList.toggle("dim",d.side!=="left");
  $("#portraitRight").classList.toggle("dim",d.side!=="right");
  $("#dialogueNext").innerHTML=dialogue.index===dialogue.lines.length-1?'进入战场 <span>→</span>':'继续 <span>→</span>';
}
function nextDialogue(){ if(++dialogue.index>=dialogue.lines.length) finishDialogue(); else renderDialogue(); }
function finishDialogue(){ const cb=dialogue?.onDone; dialogue=null; if(cb) cb(); }

function buildGridInto(grid,onCell=null){
  grid.innerHTML="";
  for(let r=0;r<BOARD_RULES.rows;r++) for(let c=0;c<BOARD_RULES.cols;c++){
    const cell=document.createElement("div"); cell.className="grid-cell"; cell.dataset.row=r; cell.dataset.col=c;
    if(onCell)cell.onclick=()=>onCell(r,c);grid.append(cell);
  }
}
function buildGrid(){
  buildGridInto($("#grid"),placeSelected);
  $("#laneLabels").innerHTML=Array.from({length:BOARD_RULES.rows},(_,i)=>`<span>0${i+1}</span>`).join("");
}

function beginGame(config){
  stopGame();
  const startingEnergy=config.infiniteEnergy?999999:(config.energy??75)+(config.buffData?.energy||0),startingBeans=Math.min(3,(config.startingBeans||0)+(config.buffData?.beans||0));
  game={ config, energy:startingEnergy, energyCollected:startingEnergy, beans:startingBeans, beanDrops:[], abilityEvents:[], selected:config.loadout?.[0]||'pawn', cooldowns:{}, players:[], enemies:[], hazards:[], projectiles:[], kills:0, wave:0, spawned:0, waveTarget:0, nextSpawn:1, nextWave:config.setupPhase?999:2.5, elapsed:0, paused:false, over:false, preparing:!!config.setupPhase,lastTime:performance.now(), orbTimer:8, entityId:0, used:{}, rankUps:[], bossSpawned:false };
  Object.keys(UNITS).forEach(k=>game.cooldowns[k]=0);
  if(config.protect){
    const p=createPlayer('king',2,0,true); p.hp=1500; p.maxHp=1500; game.players.push(p);
  }
  renderUnitTray(); updateGameHeader(); renderEntities(); showScreen("gameScreen");
  $("#missionTitle").textContent=config.kind==='story'?`第 ${config.storyIndex+1} 章 · ${config.title}`:config.title;
  $("#startAssault").classList.toggle('show',game.preparing);$("#battleTip").textContent=game.preparing?'布阵阶段：敌军尚未出现，摆好后点击“开始来敌”':`战前增益：${config.buffData?.name||'无'} · ${config.protect?'特殊王棋绝不能被摧毁':'选择棋子，再点击空格部署'}`;
  game.raf=requestAnimationFrame(gameLoop);
}
function startPreparedAssault(){
  if(!game||!game.preparing)return;game.preparing=false;game.lastTime=performance.now();$("#startAssault").classList.remove('show');
  if(game.config.snakePit){const total=startSnakePit(game.config.snakeCount);$("#battleTip").textContent=`万蛇窟开启：${total}条紫蛇将持续入场，所有棋子无限释放大招！`;toast(`万蛇窟开启 · ${total}蛇潮`);}
  else if(game.config.customEnemies){const total=spawnCustomArmy(game.config.customEnemies);$("#battleTip").textContent=`自定义敌军已按房间编排出动，共${total}枚！`;toast(`房间开战 · ${total}枚敌棋入场`);}
  else if(game.config.funBatch){spawnFunBatch(game.config.funBatch);$("#battleTip").textContent=`${game.config.funBatch}名重甲敌军已经同时出动！`;toast(`阵型锁定 · ${game.config.funBatch}名重甲来袭`);}
  else {game.nextWave=.35;$("#battleTip").textContent='重甲敌潮已经出动！';toast('阵型锁定 · 重甲军团来袭');}
}
function spawnCustomArmy(entries){
  const laneDepth=[0,0,0,0,0];let total=0;game.wave=1;game.nextWave=999;
  entries.forEach(entry=>{for(let i=0;i<entry.count;i++){const row=entry.row<0?i%BOARD_RULES.rows:entry.row,enemy=spawnEnemy(entry.type,row);enemy.x=9.2+laneDepth[row]*.72+(total%2)*.08;laneDepth[row]++;total++;}});game.waveTarget=total;game.spawned=total;return total;
}
function spawnFunBatch(count){
  game.wave=1;game.waveTarget=count;game.spawned=count;game.nextWave=999;
  for(let i=0;i<count;i++){const type=game.config.theme==='beanFun'?['shieldGiant','general','chariot','guard'][i%4]:(i%3===2?'general':'shieldGiant'),enemy=spawnEnemy(type,i%BOARD_RULES.rows);enemy.x=9.2+Math.floor(i/BOARD_RULES.rows)*.82+(i%2)*.16;}
}
const SNAKE_PIT_ACTIVE_CAP=40;
function spawnSnakePitBatch(limit=SNAKE_PIT_ACTIVE_CAP){
  const remaining=Math.max(0,game.waveTarget-game.spawned),room=Math.max(0,SNAKE_PIT_ACTIVE_CAP-game.enemies.length),count=Math.min(limit,remaining,room),laneDepth=[0,0,0,0,0];
  game.enemies.forEach(enemy=>laneDepth[enemy.row]++);
  for(let i=0;i<count;i++){const row=(game.spawned+i)%BOARD_RULES.rows,enemy=spawnEnemy('snake',row);enemy.x=9.25+laneDepth[row]*.72+(i%2)*.08;laneDepth[row]++;game.spawned++;}
  return count;
}
function startSnakePit(count){
  game.wave=1;game.waveTarget=normalizeSnakeCount(count);game.spawned=0;game.nextWave=999;game.nextSpawn=0;spawnSnakePitBatch(SNAKE_PIT_ACTIVE_CAP);return game.waveTarget;
}

function renderUnitTray(){
  const shovel=`<button class="shovel-card ${game.selected==='shovel'?'selected':''}" data-tool="shovel" title="铲除误放的我方棋子"><span class="shovel-icon"><i></i></span><b>铲子</b><small>移除棋子</small></button>`;
  const allowed=new Set(game.config.loadout||['pawn','rook','king']);
  $("#unitTray").innerHTML=shovel+Object.entries(UNITS).filter(([k])=>allowed.has(k)).map(([k,u])=>{const rank=game.config.customRanks?.[k]??save.ranks[k]??1;return `<button class="unit-card unit-${k} ${game.selected===k?'selected':''}" style="--unit-color:${u.color}" data-unit="${k}" title="${u.name} · ${u.desc} · ${rank}阶 · 需要${u.cost}能量" aria-label="${u.name}，${rank}阶，需要${u.cost}能量"><span class="choice-card-art">${unitArt(k,'choice-art')}</span><span class="choice-card-rank">${rank}</span><span class="choice-card-footer"><i>✦</i>${u.cost}</span></button>`;}).join("");
  $(".shovel-card").onclick=()=>{ game.selected='shovel'; renderUnitTray(); $("#battleTip").textContent='铲子已选中：点击我方棋子将其移除'; };
  $$(".unit-card").forEach(el=>el.onclick=()=>{ game.selected=el.dataset.unit; const tip=UNITS[game.selected].desc;renderUnitTray(); $("#battleTip").textContent=game.config.protect?`特殊王棋不可铲除 · ${tip}`:tip; });
  updateTrayState();
}
function selectEnergyBean(){
  if(!game||game.over||game.paused)return;
  if((game.beans||0)<=0){toast('击破盾山将、镇国大将等强敌可获得能量豆');return;}
  game.selected=game.selected==='bean'?(game.config.loadout?.[0]||'pawn'):'bean';
  renderUnitTray();updateGameHeader();
  $("#battleTip").textContent=game.selected==='bean'?'能量豆已选中：点击一枚我方棋子发动爆发技':'选择棋子，再点击空格部署';
}
function updateTrayState(){
  if(!game) return;
  $$(".unit-card").forEach(el=>{
    const k=el.dataset.unit,u=UNITS[k],cd=game.cooldowns[k];
    el.classList.toggle("disabled",game.energy<u.cost||cd>0);
    el.classList.toggle("cooling",cd>0);
    el.style.setProperty('--cool',cd/u.cd);
  });
}

function rankMult(type,rank=save.ranks[type]){ return 1+(rank-1)*.08; }
function rollAttackDamage(unit){const min=unit.attackMin??unit.attack-15,max=unit.attackMax??unit.attack+15;return min+Math.random()*(max-min);}
function createPlayer(type,row,col,protectedUnit=false,rank=game?.config?.customRanks?.[type]??save.ranks[type]){
  const u=UNITS[type], mult=rankMult(type,rank);
  return {id:++game.entityId,type,row,col,hp:Math.round(u.hp*mult),maxHp:Math.round(u.hp*mult),timer:u.attackMode==='support'?6:1, protectedUnit, rank,traitHits:0,attackCycles:0,supportCycles:0,kills:0,lastHitTimer:0,traitCooldown:0,storedShots:0,combo:0,charge:0,weatherTimer:4,prismMode:0,rainbowHits:{},revived:false};
}
function placeSelected(row,col){
  if(!game||game.paused||game.over) return;
  const occupant=game.players.find(p=>p.row===row&&p.col===col);
  const hazard=game.hazards.find(h=>h.row===row&&h.col===col&&h.blocksPlant);
  if(game.selected==='bean'){
    if((game.beans||0)<=0){game.selected=game.config.loadout?.[0]||'pawn';toast('没有可用的能量豆');renderUnitTray();updateGameHeader();return;}
    if(!occupant){toast('请点击一枚我方棋子发动爆发技');return;}
    game.beans--;activateEnergyBean(occupant);game.selected=occupant.type;renderUnitTray();updateGameHeader();return;
  }
  if(game.selected==='shovel'){
    if(!occupant){ toast(hazard?'敌方冰面或盾碑无法用铲子清除':'这里没有可以铲除的棋子'); return; }
    if(occupant.protectedUnit){ toast("任务目标王棋不可铲除"); return; }
    game.players=game.players.filter(p=>p!==occupant); flattenPiece(occupant.col+.5,occupant.row+.5,occupant.type,'shovel');
    toast(`${UNITS[occupant.type].name}已被铲除`); renderEntities(); return;
  }
  const type=game.selected,u=UNITS[type];
  if(occupant){ toast("这个棋位已经被占用"); return; }
  if(hazard){ toast(hazard.type==='ice'?'此格已结冰，无法部署':'盾碑占据了此格，必须先摧毁'); return; }
  if(game.energy<u.cost){ toast("能量不足"); return; }
  if(game.cooldowns[type]>0){ toast(`${u.name}仍在整备中`); return; }
  game.energy-=u.cost;const frugalKing=game.players.find(p=>p.type==='king'&&p.rank>=2&&Math.hypot(p.col-col,p.row-row)<=1.55);if(frugalKing){const refund=Math.round(u.cost*.2);game.energy+=refund;floatText(col+.5,row+.1,`节俭 +${refund}`,'#ffe084');}if(game.config.infiniteEnergy)game.energy=999999;game.players.push(createPlayer(type,row,col)); game.cooldowns[type]=game.config.noCooldown?0:u.cd*(game.config.buffData?.cooldown||1); game.used[type]=(game.used[type]||0)+1;if(type==='queen'&&game.used.queen>=2&&!game.preview)unlockSpecial('twinQueen');
  pulseAt(col+.5,row+.5,'deploy'); updateGameHeader(); renderUnitTray(); renderEntities();
}

function ultimateCinematic(p){
  const u=UNITS[p.type],title=ULT_TRAITS[p.type]?.[0]||'能量觉醒',layer=getEffectLayer(),flash=document.createElement('i'),banner=document.createElement('div');
  flash.className=`ultimate-screen-flash ultimate-${p.type}`;flash.style.setProperty('--ultimate-color',u.color);layer.append(flash);
  banner.className=`ultimate-announcement ultimate-${p.type}`;banner.style.setProperty('--ultimate-color',u.color);banner.innerHTML=`<small>${u.name} · ENERGY BURST</small><strong>${title}</strong>`;layer.append(banner);
  combatVisual('ultimateFocus',p.col+.5,p.row+.5);setTimeout(()=>{flash.remove();banner.remove();},1450);
}

function activateEnergyBean(p,options={}){
  const u=UNITS[p.type],mult=rankMult(p.type,p.rank),spec=ABILITY_SPECS[p.type],preview=options.preview||game.preview,showIntro=options.cinematic!==false;
  if(showIntro){ultimateCinematic(p);pulseAt(p.col+.5,p.row+.5,'bean');floatText(p.col+.5,p.row+.1,'能量觉醒!','#c9f57a');combatVisual('beanAura',p.col+.5,p.row+.5);}
  p.ultGlowTimer=Math.max(p.ultGlowTimer||0,ultimateCycleSeconds(p));
  if(p.type==='pawn'){
    combatVisual('swordSlam',p.col+.5,p.row+.5);combatVisual('ultimateShockwave',p.col+.6,p.row+.5,p.col+spec.frontCells+1,p.row+.5);for(let col=p.col+1;col<=Math.min(BOARD_RULES.cols-1,p.col+spec.frontCells);col++)combatVisual('groundCrack',col+.5,p.row+.5);
    [...game.enemies].filter(e=>enemyFullyVisible(e)&&e.row===p.row&&e.x>=p.col+1&&e.x<p.col+1+spec.frontCells).forEach(e=>damageStatusEnemy(e,spec.damage,p.type,'crack'));
  }else if(p.type==='berserkerPawn'){
    const targets=[...game.enemies].filter(e=>enemyFullyVisible(e)&&Math.hypot(e.x-p.col,e.row-p.row)<=spec.radius);targets.forEach(e=>damageStatusEnemy(e,Math.round(spec.damage*mult),p.type,'slash'));healPlayer(p,spec.healPerHit*targets.length);combatVisual('royalSweep',p.col+.5,p.row+.5);combatVisual('fireVortex',p.col+.5,p.row+.5);
  }else if(p.type==='shieldPawn'){
    p.beanArmor=Math.round(spec.armor*mult);p.hp=p.maxHp;combatVisual('fortress',p.col+.5,p.row+.5);combatVisual('shieldRunes',p.col+.5,p.row+.5);floatText(p.col+.5,p.row+.2,`+护甲 ${p.beanArmor}`,'#d6e5dc');
  }else if(p.type==='spearPawn'){
    p.weaponHidden=1.25;queueRapidAbility(p,spec.shots,spec.interval,spec.projectile);combatVisual('spearRain',p.col+.5,p.row+.5);combatVisual('spearHalo',p.col+.5,p.row+.5);
  }else if(p.type==='rook'){
    queueRapidAbility(p,spec.shots,spec.interval,spec.projectile);
  }else if(p.type==='twinRook'){
    queueRapidAbility(p,spec.shots,spec.interval,spec.projectile);
  }else if(p.type==='superRook'){
    combatVisual('royalSweep',p.col+.5,p.row+.5);queueFanAbility(p,spec);
  }else if(p.type==='iceRook'){
    combatVisual('iceWave',p.col+.55,p.row+.5,9.25,p.row+.5);
    for(let col=p.col+1;col<BOARD_RULES.cols;col++){addIceHazard(p.row,col);combatVisual('iceRise',col+.5,p.row+.5);}
    [...game.enemies].filter(e=>enemyFullyVisible(e)&&e.row===p.row).forEach(e=>damageStatusEnemy(e,spec.freezeDamage,p.type,'freeze'));
    queueRapidAbility(p,spec.shots,spec.interval,spec.projectile);
  }else if(p.type==='flameRook'){
    combatVisual('fireVortex',p.col+.5,p.row+.5);queueRapidAbility(p,spec.shots,spec.interval,spec.projectile);
  }else if(p.type==='poisonRook'){
    fireProjectile(p.col+.5,p.row+.62,9.6,p.row+.62,spec.projectile,1.55);combatVisual('toxicLaunch',p.col+.5,p.row+.5);combatVisual('toxicWave',p.col+.5,p.row+.62,9.4,p.row+.62);
    [...game.enemies].filter(e=>enemyFullyVisible(e)&&e.row===p.row&&e.x>p.col).forEach(e=>damageStatusEnemy(e,spec.damage,p.type,'poison'));
  }else if(p.type==='bombardRook'){
    const targets=[...game.enemies].filter(enemyFullyVisible).sort((a,b)=>b.hp-a.hp).slice(0,spec.maxTargets);targets.forEach(target=>{damageStatusEnemy(target,Math.round(spec.damage*mult),p.type,'bombard');game.enemies.filter(e=>e!==target&&Math.hypot(e.x-target.x,e.row-target.row)<=1.5).slice(0,3).forEach(e=>damageStatusEnemy(e,Math.round(spec.damage*spec.splash*mult),p.type,'bombard'));combatVisual('fireVortex',target.x+.5,target.row+.5);});combatVisual('stormCloud',4.5,2.5);
  }else if(p.type==='king'){
    const gain=Math.round(spec.energy*mult);game.energy+=gain;game.energyCollected+=gain;p.hp=p.maxHp;floatText(p.col+.5,p.row+.25,`+${gain}`,'#ffe977');combatVisual('royalBloom',p.col+.5,p.row+.5);combatVisual('royalPillars',p.col+.5,p.row+.5);
  }else if(p.type==='royalKing'){
    const gain=Math.round(spec.energy*mult);game.energy+=gain;game.energyCollected+=gain;game.players.forEach(ally=>healPlayer(ally,Math.round(spec.healAll*mult)));floatText(p.col+.5,p.row+.25,`+${gain}`,'#ffe977');combatVisual('royalBloom',p.col+.5,p.row+.5);combatVisual('royalPillars',p.col+.5,p.row+.5);
  }else if(p.type==='shieldKing'){
    const gain=Math.round(spec.energy*mult);game.energy+=gain;game.energyCollected+=gain;game.players.forEach(ally=>ally.beanArmor=(ally.beanArmor||0)+Math.round(spec.armorAll*mult));floatText(p.col+.5,p.row+.25,`全军护甲 +${Math.round(spec.armorAll*mult)}`,'#cde7df');combatVisual('fortress',p.col+.5,p.row+.5);combatVisual('shieldRunes',p.col+.5,p.row+.5);
  }else if(p.type==='warKing'){
    const gain=Math.round(spec.energy*mult);game.energy+=gain;game.energyCollected+=gain;game.players.forEach(ally=>{ally.beanArmor=(ally.beanArmor||0)+Math.round(spec.armorAll*mult);ally.timer=0;});floatText(p.col+.5,p.row+.25,`总攻 +${gain}`,'#ffd07a');combatVisual('royalSweep',p.col+.5,p.row+.5);combatVisual('royalPillars',p.col+.5,p.row+.5);
  }else if(p.type==='knight'){
    combatVisual('knightCharge',p.col+.5,p.row+.5,9.4,p.row+.5);[...game.enemies].filter(e=>enemyFullyVisible(e)&&e.row===p.row&&e.x>p.col).slice(0,spec.maxTargets).forEach(e=>damageStatusEnemy(e,Math.round(spec.damage*mult),p.type,'charge'));
  }else if(p.type==='stormKnight'){
    game.enemies.filter(enemyFullyVisible).forEach((e,i)=>{game.abilityEvents.push({t:i*.035,kind:'lightning',sourceType:p.type,row:p.row,col:p.col,rank:p.rank,targetId:e.id,damage:Math.round(spec.damage*mult)});});combatVisual('stormCloud',4.5,2.5);
  }else if(p.type==='frostKnight'){
    game.enemies.filter(enemyFullyVisible).forEach(e=>{damageStatusEnemy(e,Math.round(spec.damage*mult),p.type,'freeze');if(game.enemies.includes(e)){e.frozenTimer=spec.freezeSeconds;e.slowTimer=spec.freezeSeconds;}});combatVisual('iceWave',.5,2.5,9.3,2.5);combatVisual('stormCloud',4.5,2.5);
  }else if(p.type==='guardianKnight'){
    game.enemies.filter(enemyFullyVisible).forEach(e=>{damageStatusEnemy(e,Math.round(spec.damage*mult),p.type,'charge');if(game.enemies.includes(e))e.frozenTimer=Math.max(e.frozenTimer||0,spec.freezeSeconds);});combatVisual('knightCharge',p.col+.5,p.row+.5,9.4,p.row+.5);combatVisual('shieldRunes',p.col+.5,p.row+.5);
  }else if(['bishop','twinBishop','iceBishop','flameBishop'].includes(p.type)){
    const damage=Math.round(spec.damage*mult);[...game.enemies].filter(e=>enemyFullyVisible(e)&&Math.abs(Math.abs(e.x-p.col)-Math.abs(e.row-p.row))<1.25).forEach(e=>{damageStatusEnemy(e,damage,p.type,p.type==='iceBishop'?'freeze':p.type==='flameBishop'?'burn':'arc');if(game.enemies.includes(e)&&p.type==='iceBishop'){e.frozenTimer=spec.freezeSeconds;e.slowTimer=spec.freezeSeconds;}if(game.enemies.includes(e)&&p.type==='flameBishop'){e.burnTimer=spec.burnSeconds;e.burnDps=spec.burnDps;e.burnSource=p.type;}combatVisual('arcBurst',e.x+.5,e.row+.5);});if(p.type==='flameBishop')game.hazards=game.hazards.filter(h=>h.type!=='ice');combatVisual('diagonalCross',p.col+.5,p.row+.5);combatVisual('arcMandala',p.col+.5,p.row+.5);
  }else if(p.type==='poisonBishop'){
    game.enemies.filter(enemyFullyVisible).forEach(e=>{damageStatusEnemy(e,Math.round(spec.damage*mult),p.type,'poison');if(game.enemies.includes(e)){e.poisonTimer=spec.poisonSeconds;e.poisonDps=spec.poisonDps;e.poisonSource=p.type;e.noRegenTimer=spec.poisonSeconds;}});combatVisual('toxicWave',p.col+.5,p.row+.5,9.3,p.row+.5);combatVisual('arcMandala',p.col+.5,p.row+.5);
  }else if(p.type==='lightBishop'){
    game.players.forEach(ally=>{healPlayer(ally,Math.round(spec.healAll*mult));ally.beanArmor=(ally.beanArmor||0)+Math.round(spec.armorAll*mult);});game.enemies.filter(enemyFullyVisible).forEach(e=>damageStatusEnemy(e,Math.round(spec.damage*mult),p.type,'radiance'));combatVisual('royalPillars',p.col+.5,p.row+.5);combatVisual('arcMandala',p.col+.5,p.row+.5);
  }else if(p.type==='queen'){
    combatVisual('royalSweep',p.col+.5,p.row+.5);queueMultiLaneAbility(p,spec,'queenRapid');
  }else if(p.type==='twinQueen'){
    combatVisual('royalSweep',p.col+.5,p.row+.5);queueMultiLaneAbility(p,spec,'queenRapid');combatVisual('doubleMuzzle',p.col+.7,p.row+.5);
  }else if(p.type==='prismQueen'){
    combatVisual('prismBurst',p.col+.5,p.row+.5);queueMultiLaneAbility(p,spec,'prismRapid');
  }else if(p.type==='shadowQueen'){
    game.enemies.filter(enemyFullyVisible).forEach(e=>{const marks=e.shadowMarks||0;damageStatusEnemy(e,Math.round(spec.damage*mult*(1+marks*.35)),p.type,'shadow');if(game.enemies.includes(e))e.shadowMarks=marks?0:1;});combatVisual('prismBurst',p.col+.5,p.row+.5);combatVisual('royalSweep',p.col+.5,p.row+.5);
  }else if(p.type==='superQueen'){
    combatVisual('royalSweep',p.col+.5,p.row+.5);combatVisual('prismBurst',p.col+.5,p.row+.5);queueFanAbility(p,spec);
  }
  p.timer=['rook','twinRook','iceRook','flameRook','spearPawn','twinQueen','superRook','superQueen'].includes(p.type)?1.6:p.type==='poisonRook'?1.55:.7;if(!preview&&!options.auto){save.mastery[p.type]=(save.mastery[p.type]||0)+2;checkRanks(p.type);$("#battleTip").textContent=`${u.name}已发动能量豆爆发`;}
}

function ultimateCycleSeconds(p){
  const spec=ABILITY_SPECS[p.type];if(!spec?.shots)return 1.5;if(spec.kind==='fan')return Math.max(1.5,(spec.perLane||spec.shots)*spec.interval);const paired=p.type==='twinRook'||p.type==='twinQueen',rounds=paired?spec.shots/2:spec.shots;return Math.max(1.5,rounds*spec.interval);
}
function updateInfiniteUltimates(dt){
  if(!game.config.snakePit||game.preparing)return;
  for(const p of [...game.players]){p.infiniteUltTimer=(p.infiniteUltTimer??0)-dt;if(p.infiniteUltTimer<=0){activateEnergyBean(p,{auto:true,cinematic:!p.ultimateIntroShown});p.ultimateIntroShown=true;p.infiniteUltTimer=ultimateCycleSeconds(p);}}
}

function queueRapidAbility(p,count,interval,kind){game.abilityEvents=game.abilityEvents||[];const paired=p.type==='twinRook';for(let i=0;i<count;i++)game.abilityEvents.push({t:paired?Math.floor(i/2)*interval*2:i*interval,kind:'rapid',variant:kind,sourceType:p.type,sourceId:p.id,row:p.row,col:p.col,rank:p.rank,barrel:paired?i%2:null});const charge=combatVisual('rapidCharge',p.col+.5,p.row+.5);charge.classList.add(`visual-charge-${p.type}`);}
function queueMultiLaneAbility(p,spec,kind){game.abilityEvents=game.abilityEvents||[];const paired=p.type==='twinQueen';for(let i=0;i<spec.shots;i++)game.abilityEvents.push({t:paired?Math.floor(i/2)*spec.interval*2:i*spec.interval,kind,sourceType:p.type,sourceId:p.id,row:p.row,col:p.col,rank:p.rank,barrel:paired?i%2:null});const charge=combatVisual('rapidCharge',p.col+.5,p.row+.5);charge.classList.add(`visual-charge-${p.type}`);}
function queueFanAbility(p,spec){
  game.abilityEvents=game.abilityEvents||[];const rows=spec.lanes===3?adjacentRows(p.row):[p.row],count=spec.perLane||spec.shots;
  rows.forEach((row,lane)=>{for(let i=0;i<count;i++){const progress=count===1?.5:i/(count-1);game.abilityEvents.push({t:i*spec.interval,kind:'fanRapid',sourceType:p.type,sourceId:p.id,row,col:p.col,rank:p.rank,angle:(progress-.5)*spec.fanDegrees,lane,shot:i});}});
  const charge=combatVisual('rapidCharge',p.col+.5,p.row+.5);charge.classList.add(`visual-charge-${p.type}`);
}
function firePairedProjectiles(x,y,firstTarget,secondTarget,kind='twinRook'){
  // 双弹共用同一水平弹道，用 x 偏移保持“前后紧邻”，不再上下竖排。
  const gap=.3;
  fireProjectile(x+gap,y,targetX(firstTarget)+.5+gap,firstTarget.row+.5,kind);
  fireProjectile(x-gap,y,targetX(secondTarget)+.5-gap,secondTarget.row+.5,kind);
}
function fireRookShot(p,target,mult,storedMult=1){
  const present=target.isHazard?game.hazards.includes(target):game.enemies.includes(target);if(!present)return false;
  damageTarget(target,Math.round(rollAttackDamage(UNITS.rook)*mult*storedMult),p.type,p);flashShot(p,target);combatVisual('muzzle',p.col+.72,p.row+.5);return true;
}
function fireRookAttack(p,target,mult,storedMult=1){
  const shots=p.rank>=5&&Math.random()<ROOK_OVERLOAD.chance?ROOK_OVERLOAD.shots:1;
  const fired=fireRookShot(p,target,mult,storedMult);if(!fired||shots===1)return fired;
  game.abilityEvents=game.abilityEvents||[];for(let i=1;i<shots;i++)game.abilityEvents.push({t:i*ROOK_OVERLOAD.interval,kind:'rookFollowup',sourceId:p.id,target,mult,storedMult});return true;
}
function updateAbilityEvents(dt){
  game.abilityEvents=game.abilityEvents||[];
  for(const event of game.abilityEvents)event.t-=dt;
  const ready=game.abilityEvents.filter(event=>event.t<=0);game.abilityEvents=game.abilityEvents.filter(event=>event.t>0);
  ready.forEach(executeAbilityEvent);
}
function executeAbilityEvent(event){
  if(event.kind==='rookFollowup'){
    const attacker=game.players.find(p=>p.id===event.sourceId);if(attacker)fireRookShot(attacker,event.target,event.mult,event.storedMult);return;
  }
  if(event.kind==='lightning'){
    const target=game.enemies.find(e=>e.id===event.targetId);if(target){damageStatusEnemy(target,event.damage,event.sourceType,'storm');combatVisual('lightningStrike',target.x+.5,target.row+.5);}return;
  }
  if(event.kind==='quadRepeat'){
    const attacker=game.players.find(p=>p.id===event.sourceId);if(attacker)fireQuadVolley(attacker,event.row,rankMult(attacker.type,attacker.rank));return;
  }
  if(event.kind==='fanRapid'){
    const spec=ABILITY_SPECS[event.sourceType],mult=rankMult(event.sourceType,event.rank),attacker=game.players.find(p=>p.id===event.sourceId)||null,angle=event.angle*Math.PI/180,ox=event.col+.58,oy=event.row+.5,tx=9.65,ty=oy+Math.tan(angle)*(tx-ox);
    const target=[...game.enemies.filter(enemyFullyVisible),...game.hazards.filter(h=>h.type==='shield')].filter(candidate=>{const cx=targetX(candidate)+.5;if(cx<=ox)return false;const rayY=oy+Math.tan(angle)*(cx-ox);return Math.abs(candidate.row+.5-rayY)<=.48;}).sort((a,b)=>targetX(a)-targetX(b))[0];
    fireProjectile(ox,oy,tx,ty,spec.projectile,.72);if(event.shot%8===0)combatVisual('muzzle',ox+.12,oy);if(target){const amount=spec.damageMin+Math.random()*(spec.damageMax-spec.damageMin);damageTarget(target,Math.round(amount*mult),event.sourceType,attacker);}return;
  }
  if(event.kind==='queenRapid'||event.kind==='prismRapid'){
    const spec=ABILITY_SPECS[event.sourceType],mult=rankMult(event.sourceType,event.rank),attacker=game.players.find(p=>p.id===event.sourceId)||null;
    adjacentRows(event.row).forEach(row=>{
      if(event.kind==='queenRapid'){
        const target=nearestLaneTarget(row,event.col,9),tx=target?targetX(target)+.5:9.5,shotY=row+.5+(event.barrel==null?0:event.barrel?.09:-.09);fireProjectile(event.col+.6,shotY,tx,shotY,'rook');combatVisual('muzzle',event.col+.75,shotY);if(target){const amount=spec.damageMin?spec.damageMin+Math.random()*(spec.damageMax-spec.damageMin):spec.damage;damageTarget(target,Math.round(amount*mult),event.sourceType,attacker);}
      }else{
        combatVisual('prismLane',event.col+.5,row+.5,9.3,row+.5);game.enemies.filter(e=>enemyFullyVisible(e)&&e.row===row&&e.x>event.col).forEach(e=>damageEnemy(e,Math.round(spec.damage*mult),event.sourceType,attacker));
      }
    });return;
  }
  if(event.kind!=='rapid')return;
  const mult=rankMult(event.sourceType,event.rank),variant=event.variant;
  if(variant==='spearVolley'){
    const spec=ABILITY_SPECS[event.sourceType],target=game.enemies.filter(e=>enemyFullyVisible(e)&&e.row===event.row&&e.x>event.col).sort((a,b)=>a.x-b.x)[0],tx=target?target.x+.5:9.5;fireProjectile(event.col+.62,event.row+.25,tx,event.row+.5,'spearVolley');combatVisual('spearRelease',event.col+.62,event.row+.3);if(target)damageEnemy(target,Math.round(spec.damage*mult),event.sourceType,game.players.find(p=>p.id===event.sourceId)||null);return;
  }
  const target=nearestLaneTarget(event.row,event.col,9),tx=target?targetX(target)+.5:9.5,ty=event.row+.5+(event.barrel==null?0:event.barrel?.09:-.09);
  fireProjectile(event.col+.6,ty,tx,ty,variant);combatVisual(variant==='iceRook'?'iceMuzzle':variant==='flameRook'?'fireMuzzle':'muzzle',event.col+.75,ty);
  if(!target)return;
  const spec=ABILITY_SPECS[event.sourceType];let amount=spec.damage??UNITS[variant].attack;if(spec.damageMin)amount=spec.damageMin+Math.random()*(spec.damageMax-spec.damageMin);
  const hit=damageTarget(target,Math.round(amount*mult),event.sourceType,game.players.find(p=>p.id===event.sourceId)||null);
  if(hit&&!target.isHazard&&variant==='iceRook')target.slowTimer=Math.max(target.slowTimer||0,3.5);
  if(hit&&!target.isHazard&&variant==='flameRook'){target.burnTimer=spec.burnSeconds;target.burnDps=Math.round(spec.burnDps*mult);target.burnSource=event.sourceType;}
}

function gameLoop(now){
  if(!game||game.over) return;
  const dt=Math.min((now-game.lastTime)/1000,.05); game.lastTime=now;
  if(!game.paused){ updateGame(dt); renderEntities(); }
  game.raf=requestAnimationFrame(gameLoop);
}

function updateGame(dt){
  if(game.preparing){Object.keys(game.cooldowns).forEach(k=>game.cooldowns[k]=0);updateTrayState();updateGameHeader();return;}
  game.elapsed+=dt;
  Object.keys(game.cooldowns).forEach(k=>game.cooldowns[k]=Math.max(0,game.cooldowns[k]-dt));
  game.orbTimer-=dt;
  if(game.orbTimer<=0){ spawnEnergyOrb(); game.orbTimer=8+Math.random()*4; }
  updateSpawning(dt);
  updateInfiniteUltimates(dt);
  updatePlayers(dt);
  updateAbilityEvents(dt);
  updateEnemies(dt);
  updateProjectiles(dt);
  updateTrayState(); updateGameHeader();
  checkEndConditions();
}

function updateSpawning(dt){
  const cfg=game.config;
  if(cfg.snakePit){game.nextSpawn-=dt;if(game.spawned<game.waveTarget&&game.enemies.length<SNAKE_PIT_ACTIVE_CAP&&game.nextSpawn<=0){spawnSnakePitBatch(5);game.nextSpawn=.25;}return;}
  if(cfg.funBatch)return;
  if(cfg.id==='rush'){
    game.nextSpawn-=dt;
    if(game.nextSpawn<=0){ const type=rushEnemyType();spawnEnemy(type,Math.floor(Math.random()*5),.62);game.spawned++;game.nextSpawn=(.48+Math.random()*.34)*(cfg.difficultyData?.spawnInterval||1); }
    return;
  }
  if(game.wave===0){ game.nextWave-=dt; if(game.nextWave<=0) startWave(); return; }
  if(game.spawned<game.waveTarget){
    game.nextSpawn-=dt;
    if(game.nextSpawn<=0){
      const count=game.wave>=6?8:game.wave>=5?7:game.wave>=4?6:Math.min(4,game.wave-1);
      const forced=guaranteedEnemyForWave(cfg,game.wave,game.spawned);
      spawnEnemy(forced||pickEnemy(count,cfg),Math.floor(Math.random()*5)); game.spawned++; game.nextSpawn=(Math.max(.65,1.75-game.wave*.12)+Math.random()*.65)*(cfg.difficultyData?.spawnInterval||1);
    }
  } else if(game.enemies.length===0 && game.wave<cfg.waves){ game.nextWave-=dt; if(game.nextWave<=0) startWave(); }
  if(cfg.boss&&game.wave===cfg.waves&&!game.bossSpawned){ spawnEnemy('snake',2); game.bossSpawned=true; }
}
function startWave(){
  game.wave++; game.spawned=0; game.waveTarget=Math.ceil((4+game.wave*2)*(game.config.difficultyData?.count||1)); game.nextSpawn=.3; game.nextWave=3;
  toast(game.config.boss&&game.wave===game.config.waves?'最终波 · 紫蛇现身':`第 ${game.wave} 波来袭`);
}
function pickEnemy(tier,cfg=game.config){
  if(cfg?.theme==='giantFun'){const pool=tier>=5?['shieldGiant','general','general','shieldGiant','guard']:['shieldGiant','guard','general'];return pool[Math.floor(Math.random()*pool.length)];}
  if(cfg?.theme==='beanFun'){const pool=['shieldGiant','general','chariot','guard'];return pool[Math.floor(Math.random()*pool.length)];}
  if(cfg?.theme==='armored'){const pool=tier>=7?['chariot','guard','shieldGiant','general']:tier>=4?['chariot','guard','shieldGiant']:['guard','chariot'];return pool[Math.floor(Math.random()*pool.length)];}
  if(cfg?.theme==='frozen'){const pool=tier>=6?['iceChariot','horse','guard','shieldGiant']:['iceChariot','horse','soldier'];return pool[Math.floor(Math.random()*pool.length)];}
  if(cfg?.theme==='trick'){const pool=tier>=6?['digger','jester','chariot','elephant']:['chariot','jester','elephant'];return pool[Math.floor(Math.random()*pool.length)];}
  const pool=['soldier']; if(tier>=1)pool.push('cannon'); if(tier>=2)pool.push('horse'); if(tier>=3)pool.push('chariot'); if(tier>=4)pool.push('guard');
  if(tier>=5)pool.push('elephant'); if(tier>=6)pool.push('digger','jester'); if(tier>=7)pool.push('shieldGiant','iceChariot');if(tier>=8)pool.push('general');
  return pool[Math.floor(Math.random()*pool.length)];
}
function guaranteedEnemyForWave(cfg,wave,index){
  if(cfg.theme==='giantFun')return index<Math.min(5,wave+1)?(index%3===2?'general':'shieldGiant'):null;
  if(cfg.theme==='beanFun')return index<3?['shieldGiant','general','shieldGiant'][index]:null;
  if(index===0&&cfg.theme==='armored')return wave>=5?'general':wave>=4?'shieldGiant':wave>=2?'chariot':'guard';
  if(index===0&&cfg.theme==='frozen')return 'iceChariot';
  if(index===0&&cfg.theme==='trick')return ['chariot','digger','jester','elephant'][Math.min(3,wave-1)];
  if(cfg.featured==='elephant'&&wave>=2&&index===0)return 'elephant';
  if(index===0&&wave===2)return 'digger';if(index===0&&wave===3)return 'jester';if(index===0&&wave===4)return 'iceChariot';if(index===0&&wave===5)return 'elephant';if(index===0&&wave>=6)return 'shieldGiant';if(index===1&&wave>=6)return 'general';return null;
}
function rushEnemyType(){
  if(game.elapsed>=30&&game.spawned%20===0)return 'shieldGiant';if(game.elapsed>=25&&game.spawned%16===0)return 'iceChariot';if(game.elapsed>=20&&game.spawned%14===0)return 'jester';if(game.elapsed>=15&&game.spawned%12===0)return 'digger';return pickEnemy(Math.min(8,Math.floor(game.elapsed/14)));
}
function spawnEnemy(type,row,hpScale=1){
  const e=ENEMIES[type];
  const scaling=game.config.id==='rush'?.64:1+(Math.max(0,game.wave-1)*.045);
  const difficulty=game.config.difficultyData||DIFFICULTIES.standard,hp=Math.round(e.hp*scaling*hpScale*difficulty.hp);
  const enemy={id:++game.entityId,type,row,x:9.35,hp,maxHp:hp,attackTimer:e.rate,jumped:false,summonTimer:e.summoner?10:7,teleportTimer:5,noHitTime:0,regenTick:0,slowTimer:0,burnTimer:0,burnDps:0,poisonTimer:0,poisonDps:0,vulnerableTimer:0,statusTick:0,reflectTimer:3.5,reflectActive:0,lastTrailCol:null};
  game.enemies.push(enemy); return enemy;
}

function updatePlayers(dt){
  for(const p of [...game.players]){
    if(p.spore){p.expire-=dt;if(p.expire<=0){game.players=game.players.filter(ally=>ally!==p);combatVisual('toxicLaunch',p.col+.5,p.row+.5);continue;}}
    p.weaponHidden=Math.max(0,(p.weaponHidden||0)-dt);p.ultGlowTimer=Math.max(0,(p.ultGlowTimer||0)-dt);p.lastHitTimer=(p.lastHitTimer||0)+dt;p.traitCooldown=Math.max(0,(p.traitCooldown||0)-dt);p.rageTimer=Math.max(0,(p.rageTimer||0)-dt);
    if(p.type==='shieldPawn'&&p.rank>=2&&p.lastHitTimer>=2&&p.hp<p.maxHp){p.regenTick=(p.regenTick||0)+dt;if(p.regenTick>=1){p.regenTick-=1;healPlayer(p,45);}}
    if(p.type==='king'&&p.rank>=3&&game.energy<50&&p.traitCooldown<=0){game.energy+=35;game.energyCollected+=35;p.traitCooldown=15;floatText(p.col+.5,p.row+.15,'应急金库 +35','#ffe071');combatVisual('royalBloom',p.col+.5,p.row+.5);}
    if(p.type==='stormKnight'&&p.rank>=5&&game.enemies.length>=5){p.weatherTimer=(p.weatherTimer||4)-dt;if(p.weatherTimer<=0){p.weatherTimer=4;game.enemies.slice().sort(()=>Math.random()-.5).slice(0,3).forEach(e=>{damageStatusEnemy(e,90,p.type,'storm');combatVisual('lightningStrike',e.x+.5,e.row+.5);});}}
    p.timer-=dt;
    if(p.timer>0) continue;
    const u=UNITS[p.type], mult=rankMult(p.type,p.rank),warAura=game.players.some(ally=>ally.type==='warKing'&&ally.rank>=2&&ally!==p&&Math.hypot(ally.col-p.col,ally.row-p.row)<=1.55),attackSpeed=(game.config.buffData?.attackSpeed||1)*(warAura?1.15:1);
    if(['king','royalKing','shieldKing','warKing'].includes(p.type)){
      const royal=p.type==='royalKing',shield=p.type==='shieldKing',war=p.type==='warKing',rank=p.rank||save.ranks[p.type];p.supportCycles=(p.supportCycles||0)+1;const crowned=!royal&&!shield&&!war&&rank>=5&&p.supportCycles>=5,interest=royal&&rank>=2?Math.min(15,Math.floor(game.energy/100)*3):0,variety=royal&&rank>=5?new Set(game.players.map(ally=>ally.type)).size*5:0,gain=(crowned?50:royal?45:shield?30:war?20:25)+interest+variety;game.energy+=gain;game.energyCollected+=gain;
      if(shield){const allies=game.players.filter(a=>a!==p&&(rank>=5?a.row===p.row:Math.hypot(a.col-p.col,a.row-p.row)<=1.55));allies.forEach(a=>a.beanArmor=Math.min(700,(a.beanArmor||0)+100));if(rank>=3)allies.forEach(a=>a.timer=Math.max(0,a.timer-.5));combatVisual('shieldRunes',p.col+.5,p.row+.5);}
      if(war){const adjacent=game.players.filter(a=>a!==p&&Math.hypot(a.col-p.col,a.row-p.row)<=1.55);adjacent.forEach(a=>{a.timer=Math.max(0,a.timer-1);if(rank>=3)a.beanArmor=Math.min(700,(a.beanArmor||0)+100);});if(rank>=4){const weakest=game.players.filter(a=>a!==p&&a.hp<a.maxHp).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];if(weakest)healPlayer(weakest,150);}if(rank>=5&&p.supportCycles%3===0)game.players.filter(a=>a!==p).forEach(a=>{a.timer=Math.max(0,a.timer-1);a.beanArmor=Math.min(700,(a.beanArmor||0)+150);});combatVisual('royalSweep',p.col+.5,p.row+.5);}
      game.cooldowns=game.cooldowns||{};if(!war&&rank>=3&&p.supportCycles%3===0)Object.keys(game.cooldowns).forEach(k=>game.cooldowns[k]=Math.max(0,game.cooldowns[k]-2));if(!royal&&!war&&rank>=4){const cooling=Object.keys(game.cooldowns).filter(k=>game.cooldowns[k]>0);if(cooling.length){const key=cooling[Math.floor(Math.random()*cooling.length)];game.cooldowns[key]=Math.max(0,game.cooldowns[key]-2);}}
      p.timer=war?9:royal||shield?10:8;floatText(p.col+.5,p.row+.2,`${war?'号令 ':crowned?'加冕 ':interest?`利息+${interest} `:''}+${gain}`,'#f3d273');pulseAt(p.col+.5,p.row+.5,crowned?'bean':'energy');if(!game.preview){save.mastery[p.type]=(save.mastery[p.type]||0)+.5;checkRanks(p.type);}continue;
    }
    if(p.type==='pawn'){
      const rescue=p.rank>=4&&game.players.some(a=>(a.type==='king'||a.type==='royalKing')&&a.hp/a.maxHp<.5),range=p.promoted?3.25:2.25,target=nearestLaneTarget(p.row,p.col,range); if(target){ damageTarget(target,Math.round(u.attack*mult),p.type,p); p.timer=Math.max(.32,(.9-(p.rank-1)*.05)*(rescue?.5:1))/attackSpeed;combatVisual('swordSlash',targetX(target)+.45,target.row+.5); } else p.timer=.15;
    } else if(p.type==='shieldPawn'){
      const target=nearestLaneTarget(p.row,p.col,1.7);if(target){damageTarget(target,Math.round(u.attack*mult),p.type,p);p.timer=Math.max(.65,1-(p.rank-1)*.05)/attackSpeed;combatVisual('shieldBash',targetX(target)+.35,target.row+.5);}else p.timer=.2;
    } else if(p.type==='spearPawn'){
      const target=game.enemies.filter(e=>enemyFullyVisible(e)&&e.row===p.row&&e.x>=p.col&&e.x-p.col<=5).sort((a,b)=>a.x-b.x)[0];if(target){damageEnemy(target,Math.round(u.attack*mult),p.type,p);p.weaponHidden=.62;combatVisual('spearRelease',p.col+.62,p.row+.3);fireProjectile(p.col+.62,p.row+.3,target.x+.5,target.row+.5,'spearPawn');p.timer=Math.max(.7,1.1-(p.rank-1)*.06)/attackSpeed;}else p.timer=.2;
    } else if(p.type==='berserkerPawn'){
      const low=p.hp/p.maxHp<.35,targets=visibleFlatTargets(p.row,p.col,2.3).slice(0,p.rank>=5&&low?3:1);if(targets.length){targets.forEach(target=>{const amount=Math.round(u.attack*mult);damageTarget(target,amount,p.type,p);if(p.rank>=3)healPlayer(p,Math.round(amount*.3));combatVisual('swordSlash',targetX(target)+.4,target.row+.5);});const missing=Math.floor((1-p.hp/p.maxHp)/.2),frenzy=p.rank>=2?1+Math.min(.5,missing*.1):1,rage=p.rank>=4&&p.rageTimer>0?2:1;p.timer=Math.max(.32,1.05/(frenzy*rage*attackSpeed));}else p.timer=.18;
    } else if(p.type==='rook'){
      if(p.rank>=3&&!combatTargetsInLane(p.row,p.col,7).length){p.storedShots=Math.min(2,(p.storedShots||0)+1);p.timer=.5;floatText(p.col+.5,p.row+.1,'重弹装填','#f1d084');continue;}const storedMult=p.storedShots>0?2:1;if(storedMult>1)p.storedShots--;
      let hit=false;
      visibleFlatTargets(p.row,p.col,7).sort((a,b)=>Math.abs(targetX(a)-p.col)-Math.abs(targetX(b)-p.col)).slice(0,p.rank>=2?1:2).forEach(e=>{if(fireRookAttack(p,e,mult,storedMult))hit=true;});
      [...game.enemies.filter(e=>enemyFullyVisible(e)&&Math.abs(e.x-p.col)<.65&&Math.abs(e.row-p.row)<=4),...game.hazards.filter(h=>h.type==='shield'&&Math.abs(h.col-p.col)<.65)].slice(0,2).forEach(e=>{if(fireRookAttack(p,e,mult))hit=true;});
      p.timer=hit?Math.max(.75,1.2-(p.rank-1)*.06)/attackSpeed:.2;
    } else if(p.type==='bombardRook'){
      p.attackCycles=(p.attackCycles||0)+1;let candidates=game.enemies.filter(e=>enemyFullyVisible(e)&&e.row===p.row&&e.x>p.col);if(p.rank>=4)candidates.sort((a,b)=>game.enemies.filter(e=>enemyFullyVisible(e)&&Math.hypot(e.x-b.x,e.row-b.row)<=1.7).length-game.enemies.filter(e=>enemyFullyVisible(e)&&Math.hypot(e.x-a.x,e.row-a.row)<=1.7).length);else candidates.sort((a,b)=>a.x-b.x);const target=candidates[0];if(target){const radius=p.rank>=2?1.7:1.15,extras=game.enemies.filter(e=>enemyFullyVisible(e)&&e!==target&&Math.hypot(e.x-target.x,e.row-target.row)<=radius).slice(0,p.rank>=2?4:2),victims=[target,...extras],double=p.rank>=5&&p.attackCycles%3===0;damageEnemy(target,Math.round(u.attack*mult),p.type,p);extras.forEach(e=>damageEnemy(e,Math.round(u.attack*mult*.5),p.type,p));if(double)victims.filter(e=>game.enemies.includes(e)).forEach(e=>damageEnemy(e,Math.round(u.attack*mult),p.type,p));if(p.rank>=3&&p.attackCycles%4===0)victims.filter(e=>game.enemies.includes(e)).forEach(e=>e.slowTimer=Math.max(e.slowTimer||0,3));fireProjectile(p.col+.5,p.row+.25,target.x+.5,target.row+.5,'bombardRook',.48);combatVisual('fireVortex',target.x+.5,target.row+.5);p.timer=1.8/attackSpeed;}else p.timer=.2;
    } else if(p.type==='knight'){
      if(p.rank>=4&&p.hp/p.maxHp<.25&&p.traitCooldown<=0){p.col=Math.max(0,p.col-2);healPlayer(p,Math.round(p.maxHp*.35));p.traitCooldown=15;combatVisual('leapTrail',p.col+2.5,p.row+.5,p.col+.5,p.row+.5);p.timer=1;continue;}const leapRange=2.6+Math.min(2,(p.kills||0)*.25),target=game.enemies.filter(e=>enemyFullyVisible(e)&&Math.hypot(e.x-p.col,e.row-p.row)<=leapRange&&(p.rank>=2||e.row===p.row)).sort((a,b)=>a.hp-b.hp)[0];
      if(target){damageEnemy(target,Math.round(u.attack*mult),p.type,p);combatVisual('leapTrail',p.col+.5,p.row+.5,target.x+.5,target.row+.5);combatVisual('hoofStrike',target.x+.5,target.row+.5);p.timer=Math.max(.85,1.35-(p.rank-1)*.07)/attackSpeed;} else p.timer=.2;
    } else if(p.type==='frostKnight'){
      const target=game.enemies.filter(e=>enemyFullyVisible(e)&&Math.hypot(e.x-p.col,e.row-p.row)<=3.2).sort((a,b)=>a.hp-b.hp)[0];if(target){damageEnemy(target,Math.round(u.attack*mult),p.type,p);const nearby=game.enemies.filter(e=>enemyFullyVisible(e)&&Math.hypot(e.x-target.x,e.row-target.row)<=1.5);nearby.forEach(e=>e.slowTimer=Math.max(e.slowTimer||0,p.rank>=3?4:2.5));if(p.rank>=4&&target.frozenTimer>0)p.timer=0;else p.timer=Math.max(.85,1.4-(p.rank-1)*.07)/attackSpeed;combatVisual('leapTrail',p.col+.5,p.row+.5,target.x+.5,target.row+.5);combatVisual('iceRise',target.x+.5,target.row+.5);}else p.timer=.2;
    } else if(p.type==='guardianKnight'){
      const target=game.enemies.filter(e=>enemyFullyVisible(e)&&Math.hypot(e.x-p.col,e.row-p.row)<=3.3).sort((a,b)=>a.hp-b.hp)[0];if(target){damageEnemy(target,Math.round(u.attack*mult),p.type,p);const killed=!game.enemies.includes(target);if(!killed)target.frozenTimer=Math.max(target.frozenTimer||0,.6);if(p.rank>=2)p.beanArmor=Math.min(700,(p.beanArmor||0)+80);if(p.rank>=3)game.enemies.filter(e=>Math.hypot(e.x-target.x,e.row-target.row)<=1.35).forEach(e=>e.frozenTimer=Math.max(e.frozenTimer||0,.8));if(p.rank>=4){const ally=game.players.filter(a=>a!==p).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];if(ally)ally.beanArmor=Math.min(700,(ally.beanArmor||0)+150);}combatVisual('knightCharge',p.col+.5,p.row+.5,target.x+.5,target.row+.5);combatVisual('shieldRunes',target.x+.5,target.row+.5);p.timer=p.rank>=5&&killed?0:1.45/attackSpeed;}else p.timer=.2;
    } else if(p.type==='bishop'){
      const targets=game.enemies.filter(e=>enemyFullyVisible(e)&&Math.abs(Math.abs(e.x-p.col)-Math.abs(e.row-p.row))<.72&&Math.abs(e.x-p.col)<5).slice(0,1+(p.rank>=4));
      if(targets.length){p.attackCycles=(p.attackCycles||0)+1;const healing=p.rank>=2&&p.attackCycles%2===0;if(healing){const ally=[...game.players].filter(a=>a!==p&&a.hp<a.maxHp).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];if(ally){healPlayer(ally,80);combatVisual('royalBeam',p.col+.5,p.row+.5,ally.col+.5,ally.row+.5);}}else targets.forEach(e=>{damageEnemy(e,Math.round(u.attack*mult),p.type,p);if(p.rank>=3&&e.type==='jester')e.reflectActive=0;combatVisual('arcBurst',e.x+.5,e.row+.5)});p.timer=Math.max(.95,1.5-(p.rank-1)*.08)/attackSpeed;}else p.timer=.2;
    } else if(p.type==='lightBishop'){
      p.attackCycles=(p.attackCycles||0)+1;const allWounded=game.players.filter(a=>a!==p&&a.hp<a.maxHp).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp),wide=p.rank>=5&&p.attackCycles%3===0,healOne=(ally,amount)=>{const missing=ally.maxHp-ally.hp;healPlayer(ally,amount);if(p.rank>=3&&amount>missing)ally.beanArmor=Math.min(300,(ally.beanArmor||0)+(amount-missing));if(p.rank>=4)ally.timer=Math.max(0,ally.timer-.5);combatVisual('royalBeam',p.col+.5,p.row+.5,ally.col+.5,ally.row+.5);};if(wide)allWounded.forEach(a=>healOne(a,90));else{if(allWounded[0])healOne(allWounded[0],110);if(p.rank>=2&&allWounded[1])healOne(allWounded[1],55);}const targets=game.enemies.filter(e=>enemyFullyVisible(e)&&Math.abs(Math.abs(e.x-p.col)-Math.abs(e.row-p.row))<.85&&Math.abs(e.x-p.col)<6).slice(0,wide?2:1);targets.forEach(e=>{damageEnemy(e,Math.round(u.attack*mult),p.type,p);combatVisual('arcBurst',e.x+.5,e.row+.5);});if(allWounded.length||targets.length)p.timer=1.45/attackSpeed;else p.timer=.2;
    } else if(p.type==='queen'){
      p.attackCycles=(p.attackCycles||0)+1;const rows=p.rank>=3&&p.attackCycles%3===0?[0,1,2,3,4]:adjacentRows(p.row),targets=rows.map(r=>nearestLaneTarget(r,p.col,9)).filter(Boolean);
      if(targets.length){targets.forEach(e=>{const amount=Math.round(rollAttackDamage(u)*mult);damageTarget(e,amount,p.type,p);fireProjectile(p.col+.55,e.row+.5,targetX(e)+.5,e.row+.5,'rook');combatVisual('muzzle',p.col+.72,e.row+.5)});if(p.rank>=4&&rows.length===5)game.players.filter(a=>a!==p&&UNITS[a.type].shape==='rook').forEach(a=>a.timer=Math.max(0,a.timer-.35));p.timer=Math.max(.75,1.2-(p.rank-1)*.06)/attackSpeed;} else p.timer=.2;
    } else if(p.type==='superQueen'){
      p.attackCycles=(p.attackCycles||0)+1;const rows=p.rank>=3&&p.attackCycles%3===0?[0,1,2,3,4]:adjacentRows(p.row);let fired=0;rows.forEach(row=>fired+=fireQuadVolley(p,row,mult));if(fired){if(p.rank>=4&&rows.length===5)game.players.filter(a=>a!==p&&UNITS[a.type].shape==='rook').forEach(a=>a.timer=Math.max(0,a.timer-.5));if(p.rank>=5){game.abilityEvents=game.abilityEvents||[];rows.forEach(row=>game.abilityEvents.push({t:.3,kind:'quadRepeat',sourceId:p.id,row}));}p.timer=1.5/attackSpeed;}else p.timer=.2;
    } else if(p.type==='shadowQueen'){
      p.attackCycles=(p.attackCycles||0)+1;const rows=p.rank>=3&&p.attackCycles%3===0?[0,1,2,3,4]:adjacentRows(p.row),target=game.enemies.filter(e=>enemyFullyVisible(e)&&rows.includes(e.row)&&e.x>p.col).sort((a,b)=>a.hp-b.hp)[0];if(target){const third=(target.shadowMarks||0)>=2;damageEnemy(target,Math.round(u.attack*mult),p.type,p);if(game.enemies.includes(target)){target.shadowMarks=(target.shadowMarks||0)+1;if(p.rank>=2)target.vulnerableTimer=Math.max(target.vulnerableTimer||0,2);if(third){target.shadowMarks=0;damageStatusEnemy(target,Math.round(260*mult),p.type,'shadow');if(p.rank>=4){const next=game.enemies.filter(e=>e!==target&&Math.hypot(e.x-target.x,e.row-target.row)<=2).sort((a,b)=>a.hp-b.hp)[0];if(next)next.shadowMarks=(next.shadowMarks||0)+1;}if(p.rank>=5&&game.enemies.includes(target)&&target.hp/target.maxHp<.2)damageStatusEnemy(target,350,p.type,'shadow');}}fireProjectile(p.col+.55,p.row+.5,target.x+.5,target.row+.5,'shadowQueen',.3);combatVisual('prismLane',p.col+.5,p.row+.5,target.x+.5,target.row+.5);p.timer=1.25/attackSpeed;}else p.timer=.2;
    } else if(p.type==='twinQueen'){
      p.attackCycles=(p.attackCycles||0)+1;let rows=adjacentRows(p.row);if(p.rank>=3&&p.attackCycles%4===0)rows=[0,1,2,3,4];let fired=0;const lone=p.rank>=5&&new Set(game.players.filter(a=>UNITS[a.type].attack>0).map(a=>a.type)).size===1;rows.forEach(row=>{const targets=visibleFlatTargets(row,p.col,9),copies=lone?2:1;for(let copy=0;copy<copies;copy++){const first=targets[copy*2]||targets[0],second=p.rank>=2?(targets[copy*2+1]||first):first;if(!first)continue;const amount=Math.round(u.attack*mult);damageTarget(first,amount,p.type,p);if(second&&(second.isHazard?game.hazards.includes(second):game.enemies.includes(second)))damageTarget(second,amount,p.type,p);firePairedProjectiles(p.col+.5-copy*.5,row+.5,first,second);fired+=2;}});if(fired){combatVisual('doubleMuzzle',p.col+.72,p.row+.5);p.timer=Math.max(.78,1.3-(p.rank-1)*.06)/attackSpeed;}else p.timer=.2;
    } else if(p.type==='twinRook'){
      let targets=visibleFlatTargets(p.row,p.col,7);if(!targets.length&&p.rank>=4){const supportRows=[p.row-1,p.row+1].filter(row=>row>=0&&row<5).sort((a,b)=>game.enemies.filter(e=>enemyFullyVisible(e)&&e.row===b).length-game.enemies.filter(e=>enemyFullyVisible(e)&&e.row===a).length);targets=visibleFlatTargets(supportRows[0],p.col,7);}const target=targets[0];if(target){const second=p.rank>=2?(targets[1]||target):target,amount=Math.round(u.attack*mult);damageTarget(target,amount,p.type,p);if(second&&(second.isHazard?game.hazards.includes(second):game.enemies.includes(second)))damageTarget(second,amount,p.type,p);p.combo=(p.lastTargetId===target.id?(p.combo||0)+2:2);p.lastTargetId=target.id;firePairedProjectiles(p.col+.5,p.row+.5,target,second);combatVisual('doubleMuzzle',p.col+.7,p.row+.5);const frenzy=p.rank>=5&&p.combo>=10;p.timer=Math.max(.42,(1.25-(p.rank-1)*.06)*(frenzy?.5:1))/attackSpeed;if(frenzy)floatText(p.col+.5,p.row+.08,'极速鼓点','#ffe07c');}else p.timer=.2;
    } else if(p.type==='superRook'){
      p.attackCycles=(p.attackCycles||0)+1;const fired=fireQuadVolley(p,p.row,mult);if(fired){game.abilityEvents=game.abilityEvents||[];if(p.rank>=3&&p.attackCycles%2===0)game.abilityEvents.push({t:.15,kind:'quadRepeat',sourceId:p.id,row:p.row});if(p.rank>=5)game.abilityEvents.push({t:.3,kind:'quadRepeat',sourceId:p.id,row:p.row});p.timer=1.5/attackSpeed;}else p.timer=.2;
    } else if(p.type==='iceRook'){
      const target=nearestLaneTarget(p.row,p.col,7);if(target){const hit=damageTarget(target,Math.round(u.attack*mult),p.type,p);if(hit&&!target.isHazard){target.slowTimer=Math.max(target.slowTimer,3.5+(p.rank-1)*.3);if(p.rank>=3){target.iceHits=(target.iceHits||0)+1;if(target.iceHits%3===0){target.frozenTimer=1.5;recordUnlockProgress('iceSculptures');floatText(target.x+.5,target.row+.1,'冰雕','#b8f4ff');}}if(p.rank>=4&&target.frozenTimer>0)target.x=Math.min(9.2,target.x+.6);}if(p.rank>=2){const ice=game.hazards.filter(h=>h.type==='ice'&&h.row===p.row&&h.col>p.col).sort((a,b)=>a.col-b.col)[0];if(ice){game.hazards=game.hazards.filter(h=>h!==ice);floatText(ice.col+.5,ice.row+.1,'冰面净化','#c8f7ff');}}fireProjectile(p.col+.5,p.row+.5,targetX(target)+.5,target.row+.5,'iceRook',.27);combatVisual('iceMuzzle',p.col+.72,p.row+.5);if(hit)pulseAt(targetX(target)+.5,target.row+.5,'freeze');p.timer=Math.max(.8,1.25-(p.rank-1)*.06)/attackSpeed;}else p.timer=.2;
    } else if(p.type==='flameRook'){
      const target=nearestLaneTarget(p.row,p.col,7);if(target){const hit=damageTarget(target,Math.round(u.attack*mult),p.type,p);if(hit&&!target.isHazard){target.burnTimer=3;target.burnDps=Math.round(u.burnDps*mult);target.burnSource=p.type;if(p.rank>=2)target.litTimer=3;}if(p.rank>=3){const before=game.hazards.length;game.hazards=game.hazards.filter(h=>!(h.type==='ice'&&h.row===p.row&&h.col>p.col&&h.col<=targetX(target)));const melted=before-game.hazards.length;if(melted){recordUnlockProgress('meltedIce',melted);floatText(targetX(target)+.5,p.row+.1,'熔冰','#ffb06d');}}fireProjectile(p.col+.5,p.row+.5,targetX(target)+.5,target.row+.5,'flameRook',.25);combatVisual('fireMuzzle',p.col+.72,p.row+.5);if(hit)pulseAt(targetX(target)+.5,target.row+.5,'burn');p.timer=Math.max(.75,1.2-(p.rank-1)*.06)/attackSpeed;}else p.timer=.2;
    } else if(p.type==='poisonRook'){
      const visible=visibleFlatTargets(p.row,p.col,7),target=p.rank>=2?(visible.find(e=>!e.isHazard&&(e.poisonTimer||0)<=0)||visible[0]):visible[0];if(target){const hit=damageTarget(target,Math.round(u.attack*mult),p.type,p);if(hit&&!target.isHazard){target.poisonTimer=8;target.poisonDps=Math.round(u.poisonDps*mult);target.poisonSource=p.type;}fireProjectile(p.col+.5,p.row+.5,targetX(target)+.5,target.row+.5,'poisonRook',.3);combatVisual('toxicMuzzle',p.col+.72,p.row+.5);if(hit)pulseAt(targetX(target)+.5,target.row+.5,'poison');p.timer=Math.max(.85,1.3-(p.rank-1)*.06)/attackSpeed;}else p.timer=.2;
    } else if(['iceBishop','flameBishop','poisonBishop'].includes(p.type)){
      let targets=game.enemies.filter(e=>enemyFullyVisible(e)&&Math.abs(Math.abs(e.x-p.col)-Math.abs(e.row-p.row))<.85&&Math.abs(e.x-p.col)<6);if(p.type==='poisonBishop'&&p.rank>=2)targets.sort((a,b)=>((a.poisonTimer||0)>0)-((b.poisonTimer||0)>0)||b.hp-a.hp);const target=targets[0];if(target){const wasCold=(target.slowTimer||0)>0||(target.frozenTimer||0)>0;damageEnemy(target,Math.round(u.attack*mult),p.type,p);if(game.enemies.includes(target)&&p.type==='iceBishop'){target.slowTimer=Math.max(target.slowTimer||0,3.5);target.iceBishopHits=(target.iceBishopHits||0)+1;if(target.iceBishopHits%3===0){target.frozenTimer=2;floatText(target.x+.5,target.row+.1,'斜线冰封','#b8f4ff');}if(p.rank>=4&&target.type==='jester'&&target.frozenTimer>0){target.reflectActive=0;target.reflectTimer=6;}}if(game.enemies.includes(target)&&p.type==='flameBishop'){target.burnTimer=3;target.burnDps=Math.round(u.burnDps*mult);target.burnSource=p.type;if(p.rank>=3&&wasCold)damageStatusEnemy(target,160,p.type,'burn');if(target.type==='elephant'&&p.rank>=4)target.summonTimer=Math.max(target.summonTimer,8);const before=game.hazards.length;game.hazards=game.hazards.filter(h=>!(h.type==='ice'&&Math.abs(Math.abs(h.col-p.col)-Math.abs(h.row-p.row))<.75));const melted=before-game.hazards.length;if(melted)recordUnlockProgress('meltedIce',melted);}if(game.enemies.includes(target)&&p.type==='poisonBishop'){target.poisonTimer=8;target.poisonDps=Math.round(u.poisonDps*mult);target.poisonSource=p.type;if(p.rank>=4)target.noRegenTimer=8;}fireProjectile(p.col+.5,p.row+.5,target.x+.5,target.row+.5,p.type,.34);combatVisual('arcBurst',target.x+.5,target.row+.5);const infected=p.type==='poisonBishop'?game.enemies.filter(e=>(e.poisonTimer||0)>0).length:0;p.timer=Math.max(.72,1.28-(p.rank-1)*.06)/(attackSpeed*(p.rank>=5?1+Math.min(.4,infected*.04):1));}else p.timer=.2;
    } else if(p.type==='stormKnight'){
      const target=game.enemies.filter(e=>enemyFullyVisible(e)&&Math.hypot(e.x-p.col,e.row-p.row)<=3.2).sort((a,b)=>a.hp-b.hp)[0];
      if(target){damageEnemy(target,Math.round(u.attack*mult),p.type,p);combatVisual('lightningLink',p.col+.5,p.row+.5,target.x+.5,target.row+.5);game.enemies.filter(e=>enemyFullyVisible(e)&&e!==target&&Math.hypot(e.x-target.x,e.row-target.row)<=1.8).slice(0,p.rank>=2?3:2).forEach(e=>{damageEnemy(e,Math.round(u.chainDamage*mult),p.type,p);combatVisual('lightningLink',target.x+.5,target.row+.5,e.x+.5,e.row+.5);});pulseAt(target.x+.5,target.row+.5,'storm');p.timer=Math.max(.95,1.5-(p.rank-1)*.07)/attackSpeed;}else p.timer=.2;
    } else if(p.type==='twinBishop'){
      const limit=p.rank>=4?4:p.rank>=2?3:2,targets=game.enemies.filter(e=>enemyFullyVisible(e)&&Math.abs(Math.abs(e.x-p.col)-Math.abs(e.row-p.row))<.85&&Math.abs(e.x-p.col)<5.5).sort((a,b)=>a.x-b.x).slice(0,limit);if(targets.length){targets.forEach(e=>{damageEnemy(e,Math.round(u.attack*mult),p.type,p);combatVisual('arcBurst',e.x+.5,e.row+.5);});combatVisual('diagonalCross',p.col+.5,p.row+.5);p.timer=Math.max(.95,1.55-(p.rank-1)*.08)/attackSpeed;}else p.timer=.2;
    } else if(p.type==='prismQueen'){
      const rows=adjacentRows(p.row),targets=game.enemies.filter(e=>enemyFullyVisible(e)&&rows.includes(e.row)&&e.x>p.col);if(targets.length){p.prismMode=(p.prismMode||0)+1;rows.forEach(row=>combatVisual('prismLane',p.col+.5,row+.5,9.3,row+.5));targets.forEach(e=>{damageEnemy(e,Math.round(u.attack*mult),p.type,p);if(p.rank>=2){const mode=p.prismMode%3;if(mode===0)e.slowTimer=Math.max(e.slowTimer||0,1.5);if(mode===1){e.burnTimer=2;e.burnDps=20;e.burnSource=p.type;}if(mode===2)e.vulnerableTimer=Math.max(e.vulnerableTimer||0,2);}if(p.rank>=4&&e.type==='jester'){e.reflectActive=0;e.slowTimer=1;}});pulseAt(p.col+.5,p.row+.5,'prism');const speed=p.rank>=3?1+Math.min(.35,targets.length*.035):1;p.timer=.8/(attackSpeed*speed);}else p.timer=.15;
    }
  }
}
function enemyFullyVisible(e){
  if(!Number.isFinite(e?.x))return true;const data=ENEMIES[e.type]||{},halfWidth=data.giant?.7:data.boss?.59:data.large?.525:.39;return e.x+.5+halfWidth<=BOARD_RULES.cols+.001;
}
function nearestEnemy(row,col,range){ return game.enemies.filter(e=>enemyFullyVisible(e)&&e.row===row&&e.x>=col-.2&&e.x-col<=range).sort((a,b)=>a.x-b.x)[0]; }
function adjacentRows(row){const start=clamp(row-1,0,BOARD_RULES.rows-3);return [start,start+1,start+2];}
function targetX(target){return target.isHazard?target.col:target.x;}
function combatTargetsInLane(row,col,range){return [...game.enemies.filter(e=>enemyFullyVisible(e)&&e.row===row&&e.x>=col-.25&&e.x-col<=range),...game.hazards.filter(h=>h.type==='shield'&&h.row===row&&h.col>=col&&h.col-col<=range)];}
function visibleFlatTargets(row,col,range){const targets=combatTargetsInLane(row,col,range).sort((a,b)=>targetX(a)-targetX(b)),shieldIndex=targets.findIndex(t=>t.isHazard);return shieldIndex>=0?targets.slice(0,shieldIndex+1):targets;}
function nearestLaneTarget(row,col,range){return visibleFlatTargets(row,col,range)[0];}
function damageTarget(target,amount,source,attacker){return target.isHazard?damageHazard(target,amount):damageEnemy(target,amount,source,attacker);}
function targetStillPresent(target){return !!target&&(target.isHazard?game.hazards.includes(target):game.enemies.includes(target));}
function fireQuadVolley(p,row,mult){
  const initial=visibleFlatTargets(row,p.col,9);if(!initial.length)return 0;const shield=initial.find(target=>target.isHazard)||null;
  for(let i=0;i<4;i++){
    const live=visibleFlatTargets(row,p.col,9),preferred=p.rank>=2?initial[i]:initial[0],target=targetStillPresent(shield)?shield:targetStillPresent(preferred)?preferred:live[0],gap=(i-1.5)*.16,tx=target?targetX(target)+.5+gap:9.5+gap;
    fireProjectile(p.col+.55+gap,row+.5,tx,row+.5,'rook',.3);if(target)damageTarget(target,Math.round(rollAttackDamage(UNITS.rook)*mult),p.type,p);
  }
  combatVisual('doubleMuzzle',p.col+.72,row+.5);return 4;
}

function updateEnemies(dt){
  for(const e of [...game.enemies]){
    const data=ENEMIES[e.type],difficulty=game.config.difficultyData||DIFFICULTIES.standard;e.attackTimer-=dt;e.slowTimer=Math.max(0,(e.slowTimer||0)-dt);e.frozenTimer=Math.max(0,(e.frozenTimer||0)-dt);e.litTimer=Math.max(0,(e.litTimer||0)-dt);
    e.burnTimer=Math.max(0,(e.burnTimer||0)-dt);e.poisonTimer=Math.max(0,(e.poisonTimer||0)-dt);e.vulnerableTimer=Math.max(0,(e.vulnerableTimer||0)-dt);e.statusTick=(e.statusTick||0)+dt;
    if(e.statusTick>=1){e.statusTick-=1;if(e.burnTimer>0)damageStatusEnemy(e,e.burnDps,e.burnSource,'burn');if(!game.enemies.includes(e))continue;if(e.poisonTimer>0)damageStatusEnemy(e,e.poisonDps,e.poisonSource,'poison');if(!game.enemies.includes(e))continue;}
    if(data.reflector){e.reflectTimer-=dt;e.reflectActive=Math.max(0,(e.reflectActive||0)-dt);if(e.reflectTimer<=0){e.reflectActive=1.5;e.reflectTimer=5;pulseAt(e.x+.5,e.row+.5,'mirror');floatText(e.x+.5,e.row+.2,'镜幕!','#efb6ff');}}
    if(data.iceTrail){const trailCol=clamp(Math.floor(e.x),0,8);if(trailCol!==e.lastTrailCol){addIceHazard(e.row,trailCol);e.lastTrailCol=trailCol;}}
    if(data.teleport){
      e.teleportTimer-=dt;
      if(e.teleportTimer<=0){ const oldRow=e.row,choices=[0,1,2,3,4].filter(r=>r!==oldRow);pulseAt(e.x+.5,oldRow+.5,'teleport');e.row=choices[Math.floor(Math.random()*choices.length)];e.teleportTimer=5;pulseAt(e.x+.5,e.row+.5,'teleport');floatText(e.x+.5,e.row+.2,'换线','#e7a65c');continue; }
    }
    if(data.summoner){
      e.summonTimer-=dt;
      if(e.summonTimer<=0){ const summoned=spawnEnemy(['soldier','cannon','horse'][Math.floor(Math.random()*3)],Math.floor(Math.random()*5),.75);summoned.x=Math.min(9.2,e.x+.8);const plagueBishop=game.players.find(p=>p.type==='poisonBishop'&&p.rank>=3),carrier=game.enemies.find(x=>x!==summoned&&(x.poisonTimer||0)>0&&Math.hypot(x.x-e.x,x.row-e.row)<2);if(plagueBishop&&carrier){summoned.poisonTimer=6;summoned.poisonDps=UNITS.poisonBishop.poisonDps;summoned.poisonSource='poisonBishop';floatText(summoned.x+.5,summoned.row+.1,'援军染毒','#a9e87a');}e.summonTimer=10;pulseAt(e.x+.5,e.row+.5,'bagua');toast('八卦相召来了一枚援军'); }
    }
    if(data.boss){
      e.noHitTime+=dt;e.regenTick+=dt;e.noRegenTimer=Math.max(0,(e.noRegenTimer||0)-dt);
      if(e.noRegenTimer<=0&&e.noHitTime>=1&&e.regenTick>=1&&e.hp<e.maxHp){ const ticks=Math.floor(e.regenTick);const heal=Math.min(e.maxHp-e.hp,data.regen*ticks);e.hp+=heal;e.regenTick-=ticks;floatText(e.x+.5,e.row+.15,`+${heal}`,'#cf77ad');pulseAt(e.x+.5,e.row+.5,'heal'); }
      e.summonTimer-=dt;
      if(e.summonTimer<=0){ spawnEnemy('soldier',Math.floor(Math.random()*5),.8); spawnEnemy(Math.random()>.5?'horse':'cannon',Math.floor(Math.random()*5),.8); e.summonTimer=e.hp/e.maxHp<.5?4:7; toast("紫蛇召唤了援军"); }
    }
    const laneTargets=game.players.filter(p=>p.row===e.row&&p.col<=e.x).sort((a,b)=>b.col-a.col);
    let target=laneTargets[0];
    const dist=target?e.x-target.col:99;
    if(e.type==='horse'&&!e.jumped&&target&&dist<1.35&&target.col>0){ e.x=Math.max(.1,target.col-.85); e.jumped=true; pulseAt(e.x+.5,e.row+.5,'jump'); continue; }
    if(data.cannon&&enemyFullyVisible(e)&&e.frozenTimer<=0&&laneTargets.length>=2){
      const cannonTarget=laneTargets[1],cannonDist=e.x-cannonTarget.col;
      if(cannonDist<=5.2){ if(e.attackTimer<=0){ damagePlayer(cannonTarget,150*difficulty.damage,e);fireProjectile(e.x+.5,e.row+.5,cannonTarget.col+.5,cannonTarget.row+.5,'cannon',.38);e.attackTimer=data.rate; } continue; }
    }
    if(data.giant&&target&&dist<=.82){ if(e.attackTimer<=0){ crushPlayer(target,e);e.attackTimer=data.rate; } continue; }
    if(data.shoveler&&target&&dist<=.72){if(e.attackTimer<=0){flingPlayer(target,e);e.attackTimer=data.rate;}continue;}
    const attackRange=data.range||.62;
    if(e.frozenTimer>0)continue;
    if(target&&dist<=attackRange){
      if(e.attackTimer<=0){ damagePlayer(target,data.damage*difficulty.damage*(data.boss&&e.hp/e.maxHp<.5?1.45:1),e); e.attackTimer=data.rate; }
    } else {
      const aura=game.enemies.some(g=>g.type==='guard'&&g.id!==e.id&&g.row===e.row&&Math.abs(g.x-e.x)<1.4);
      e.x-=data.speed*difficulty.speed*(data.boss&&e.hp/e.maxHp<.5?1.5:1)*(aura?1.05:1)*(e.slowTimer>0?.55:1)*dt;
    }
    if(e.x<-.25){if(game.preview){game.over=true;return;}endGame(false,"有敌军突破了最后防线");return;}
  }
}

function damagePlayer(p,amount,enemy){
  amount*=1-(UNITS[p.type]?.armor||0);
  if(p.type==='shieldPawn')recordUnlockProgress('shieldDamage',amount);
  p.lastHitTimer=0;p.regenTick=0;
  if(p.type==='shieldPawn'&&p.rank>=5){const protectedAllies=game.players.filter(a=>a!==p&&a.row===p.row&&a.col<p.col);if(protectedAllies.length)amount*=.65;}
  if((p.beanArmor||0)>0){const absorbed=Math.min(p.beanArmor,amount);p.beanArmor-=absorbed;amount-=absorbed;floatText(p.col+.5,p.row+.2,`护甲 -${Math.round(absorbed)}`,'#cde2d7');pulseAt(p.col+.5,p.row+.5,'armor');if(amount<=0)return;}
  if(p.type==='pawn'&&p.rank>=2&&enemy&&game.enemies.includes(enemy)){damageStatusEnemy(enemy,45,p.type,'slash');combatVisual('swordSlash',enemy.x+.5,enemy.row+.5);}
  p.hp-=amount; floatText(p.col+.5,p.row+.25,`-${Math.round(amount)}`,'#ff7b63'); pulseAt(p.col+.5,p.row+.5,enemy?.type||'enemy');
  if(p.hp<=0){
    triggerPlayerDeathTrait(p);
    game.players=game.players.filter(x=>x!==p);
    fallenPlayer(p.col+.5,p.row+.5,p.type);
    if(p.protectedUnit){if(game.preview)game.over=true;else endGame(false,"需要保护的王棋被摧毁了");}
  }
}
function healPlayer(p,amount){const before=p.hp;p.hp=Math.min(p.maxHp,p.hp+amount);if(p.hp>before){floatText(p.col+.5,p.row+.2,`+${Math.round(p.hp-before)}`,'#9ce6bd');pulseAt(p.col+.5,p.row+.5,'heal');}}
function crushPlayer(p,enemy){
  if(p.type==='shieldKing'&&p.rank>=5&&!p.crushWardUsed){p.crushWardUsed=true;p.hp=Math.max(1,p.hp);combatVisual('fortress',p.col+.5,p.row+.5);floatText(p.col+.5,p.row+.15,'王城格挡!','#cde7df');return;}
  triggerPlayerDeathTrait(p);game.players=game.players.filter(x=>x!==p);flattenPiece(p.col+.5,p.row+.5,p.type,'crush');floatText(p.col+.5,p.row+.15,'碾碎!','#ff735c');
  if(p.protectedUnit){if(game.preview)game.over=true;else endGame(false,"镇国大将砸碎了需要保护的王棋");}
}
function flingPlayer(p,enemy){
  triggerPlayerDeathTrait(p);game.players=game.players.filter(x=>x!==p);flingPiece(p.col+.5,p.row+.5,p.type);floatText(p.col+.5,p.row+.15,'铲飞!','#ffc177');
  if(p.protectedUnit){if(game.preview)game.over=true;else endGame(false,"掘阵卒铲飞了需要保护的王棋");}
}
function damageEnemy(e,amount,source,attacker=null,alreadyBuffed=false){
  const data=ENEMIES[e.type],mode=UNITS[source]?.attackMode;
  if(!enemyFullyVisible(e))return false;
  if(!alreadyBuffed)amount*=game.config.buffData?.damage||1;
  if(data.flatImmune&&mode==='flat'){floatText(e.x+.5,e.row+.18,'格挡','#c4b7a2');pulseAt(e.x+.5,e.row+.5,'block');return false;}
  if(data.reflector&&e.reflectActive>0&&mode!=='melee'&&mode!=='support'){
    floatText(e.x+.5,e.row+.18,'反弹!','#efb6ff');pulseAt(e.x+.5,e.row+.5,'mirror');
    if(attacker&&game.players.includes(attacker)){const reflected=Math.round(amount*.75);damagePlayer(attacker,reflected,e);fireProjectile(e.x+.5,e.row+.5,attacker.col+.5,attacker.row+.5,'reflect',.28);}return false;
  }
  if((e.vulnerableTimer||0)>0)amount*=RANK_RULES.vulnerableMultiplier;
  if((e.litTimer||0)>0)amount*=1.15;
  const guarded=game.enemies.some(g=>g.type==='guard'&&g.id!==e.id&&g.row===e.row&&Math.abs(g.x-e.x)<1.5);
  if(guarded) amount*=.65;
  e.hp-=amount;if(data.boss){e.noHitTime=0;e.regenTick=0;}if(!game.preview)save.mastery[source]=(save.mastery[source]||0)+.04;floatText(e.x+.5,e.row+.18,`-${Math.round(amount)}`,'#ffe195'); pulseAt(e.x+.5,e.row+.5,'hit');
  if(attacker&&game.players.includes(attacker))applyRankHitTraits(attacker,e,amount);
  if(e.hp<=0&&game.enemies.includes(e))defeatEnemy(e,source);return true;
}

function applyRankHitTraits(attacker,target,amount){
  const rank=attacker.rank||save.ranks[attacker.type]||1;if(rank<2)return;attacker.traitHits=(attacker.traitHits||0)+1;
  const candidates=game.enemies.filter(e=>enemyFullyVisible(e)&&e!==target&&Math.hypot(e.x-target.x,e.row-target.row)<=2.1).sort((a,b)=>Math.hypot(a.x-target.x,a.row-target.row)-Math.hypot(b.x-target.x,b.row-target.row));
  const splash=(targets,factor,label='扩散')=>targets.filter(e=>game.enemies.includes(e)).forEach((extra,index)=>{damageEnemy(extra,Math.round(amount*factor),attacker.type,null,true);combatVisual(UNITS[attacker.type].shape==='knight'?'lightningLink':'arcBurst',target.x+.5,target.row+.5,extra.x+.5,extra.row+.5);if(!index)floatText(extra.x+.5,extra.row+.12,label,'#f4d484');});
  if(attacker.type==='pawn'){if(rank>=3&&attacker.kills>=3)attacker.promoted=true;return;}
  if(attacker.type==='shieldPawn'){if(rank>=3)target.slowTimer=Math.max(target.slowTimer||0,2.2);if(rank>=4&&attacker.traitCooldown<=0&&attacker.col<8&&!game.players.some(p=>p!==attacker&&p.row===attacker.row&&p.col===attacker.col+1)&&!game.hazards.some(h=>h.row===attacker.row&&h.col===attacker.col+1)){attacker.col++;attacker.traitCooldown=8;floatText(attacker.col+.5,attacker.row+.1,'挪盾','#d5e4db');}return;}
  if(attacker.type==='spearPawn'){if(rank>=2&&game.enemies.includes(target))damageEnemy(target,Math.round(amount*.35),attacker.type,null,true);if(rank>=4&&(ENEMIES[target.type].giant||ENEMIES[target.type].large||ENEMIES[target.type].boss))damageEnemy(target,Math.round(target.maxHp*.01),attacker.type,null,true);if(rank>=5)game.enemies.filter(e=>e!==target&&e.row===target.row&&e.x>target.x).forEach(e=>damageEnemy(e,Math.round(amount*.45),attacker.type,null,true));return;}
  if(attacker.type==='rook'){if(rank>=4&&target.isHazard){damageHazard(target,amount*2);if(!game.hazards.includes(target)){game.energy+=25;game.energyCollected+=25;}}return;}
  if(['twinRook','iceRook','flameRook','poisonRook','knight','stormKnight','bishop','twinBishop','queen','prismQueen'].includes(attacker.type))return;
}

function triggerPlayerDeathTrait(p){
  const rank=p.rank||save.ranks[p.type]||1;if(rank<5||p.deathTraitFired)return;p.deathTraitFired=true;
  // 五阶不再默认绑定阵亡效果；成长质变在存活时持续生效。
}
function damageStatusEnemy(e,amount,source,kind){if(!amount||!source||!enemyFullyVisible(e))return false;amount*=game.config.buffData?.damage||1;e.hp-=amount;if(ENEMIES[e.type]?.boss){e.noHitTime=0;e.regenTick=0;}floatText(e.x+.5,e.row+.18,`-${Math.round(amount)}`,kind==='burn'?'#ff9d55':'#a8e66f');pulseAt(e.x+.5,e.row+.5,kind);if(e.hp<=0)defeatEnemy(e,source);return true;}
function defeatEnemy(e,source){const data=ENEMIES[e.type],killer=game.players.find(p=>p.type===source);fallenEnemy(e);if(killer){killer.kills=(killer.kills||0)+1;if(killer.type==='pawn'&&killer.rank>=3&&killer.kills===3){killer.promoted=true;floatText(killer.col+.5,killer.row+.1,'过河升变!','#ffe088');}if(killer.type==='pawn'&&killer.rank>=5&&killer.promoted){game.energy+=15;game.energyCollected+=15;killer.timer=0;}if(killer.type==='berserkerPawn'&&killer.rank>=4){killer.rageTimer=3;floatText(killer.col+.5,killer.row+.1,'斩敌暴怒!','#ff7767');}if(killer.type==='flameRook'&&killer.rank>=4&&e.burnTimer>0){const next=game.enemies.filter(x=>enemyFullyVisible(x)&&x!==e&&x.row===e.row&&x.burnTimer<=0).sort((a,b)=>a.x-b.x)[0];if(next){next.burnTimer=3;next.burnDps=e.burnDps;next.burnSource=source;floatText(next.x+.5,next.row+.1,'火种接力','#ff9b55');}}if(killer.type==='poisonRook'&&killer.rank>=5&&e.poisonTimer>0){const col=clamp(Math.floor(e.x),0,8);if(!game.players.some(p=>p.row===e.row&&p.col===col))game.players.push({id:++game.entityId,type:'shieldPawn',spore:true,row:e.row,col,hp:300,maxHp:300,timer:99,rank:1,expire:3});}}
  if(data.leavesShield)leaveShieldAt(e);if(data.beanDrop&&Math.random()<(data.beanChance??.5))dropEnergyBeans(e,data.beanDrop);game.enemies=game.enemies.filter(x=>x!==e);game.kills++;if(!game.preview){save.mastery[source]=(save.mastery[source]||0)+.8;checkRanks(source);}}
function once(fn){let called=false;return()=>{if(called)return;called=true;fn?.();};}
function flyResourceToCounter(sourceEl,targetSelector,kind,onArrive){
  const target=$(targetSelector),finish=once(onArrive);
  if(!sourceEl||!target||typeof sourceEl.getBoundingClientRect!=='function'||typeof target.getBoundingClientRect!=='function'||!document.body){finish();return;}
  const start=sourceEl.getBoundingClientRect(),end=target.getBoundingClientRect(),flight=document.createElement('span');
  flight.className=`resource-flight ${kind}-flight`;flight.setAttribute?.('aria-hidden','true');
  flight.style.left=`${start.left}px`;flight.style.top=`${start.top}px`;flight.style.width=`${Math.max(start.width,36)}px`;flight.style.height=`${Math.max(start.height,36)}px`;
  flight.style.setProperty('--fly-x',`${end.left+end.width/2-(start.left+start.width/2)}px`);flight.style.setProperty('--fly-y',`${end.top+end.height/2-(start.top+start.height/2)}px`);
  flight.innerHTML=kind==='bean'?'<i></i>':'✦';document.body.append(flight);target.classList.add('receiving');
  requestAnimationFrame(()=>flight.classList.add('flying'));
  setTimeout(()=>{flight.remove();target.classList.remove('receiving');finish();},RESOURCE_FLIGHT_DURATION);
}
function beanDropElement(drop){return document.querySelector?.(`[data-bean-id="${drop.id}"]`)||null;}
function beanCapacity(state){return Math.max(0,3-(state.beans||0)-(state.pendingBeanClaims||0));}
function scheduleBeanAutoCollect(drop,owner=game,delay=AUTO_COLLECT_DELAY){
  clearTimeout(drop.autoCollectTimer);drop.autoCollectTimer=setTimeout(()=>{
    if(game!==owner||owner.over||!owner.beanDrops?.includes(drop))return;
    if(beanCapacity(owner)<=0){scheduleBeanAutoCollect(drop,owner,350);return;}
    collectEnergyBean(drop,{automatic:true,owner});
  },delay);
}
function dropEnergyBeans(enemy,count){
  const owner=game;owner.beanDrops=owner.beanDrops||[];
  for(let i=0;i<count;i++){const drop={id:++owner.entityId,row:enemy.row,x:clamp(enemy.x+(i-(count-1)/2)*.34,.2,8.8)};owner.beanDrops.push(drop);if(!owner.preview)scheduleBeanAutoCollect(drop,owner);}
  toast(`${ENEMIES[enemy.type].name}掉落了${count}枚能量豆`);
}
function collectEnergyBean(drop,{automatic=false,owner=game}={}){
  if(!owner||game!==owner||owner.over||!owner.beanDrops?.includes(drop))return;
  if(beanCapacity(owner)<=0){if(!automatic)toast('能量豆槽已满（最多3枚）');else scheduleBeanAutoCollect(drop,owner,350);return;}
  const source=beanDropElement(drop);clearTimeout(drop.autoCollectTimer);owner.beanDrops=owner.beanDrops.filter(b=>b!==drop);
  const finish=()=>{if(game!==owner||owner.over)return;owner.pendingBeanClaims=Math.max(0,(owner.pendingBeanClaims||0)-(automatic?1:0));owner.beans=Math.min(3,(owner.beans||0)+1);floatText(drop.x+.5,drop.row+.15,'能量豆 +1','#c9f57a');pulseAt(drop.x+.5,drop.row+.5,'bean');updateGameHeader();toast('获得1枚能量豆：点击右上角后选择棋子');};
  if(automatic){owner.pendingBeanClaims=(owner.pendingBeanClaims||0)+1;flyResourceToCounter(source,'#beanButton','bean',finish);}else{finish();flyResourceToCounter(source,'#beanButton','bean');}
}
function leaveShieldAt(enemy){const row=enemy.row,col=clamp(Math.round(enemy.x),0,8),existing=game.hazards.find(h=>h.type==='shield'&&h.row===row&&h.col===col);if(existing){existing.hp=existing.maxHp;}else game.hazards.push({id:++game.entityId,type:'shield',isHazard:true,blocksPlant:true,row,col,x:col,hp:6500,maxHp:6500});pulseAt(col+.5,row+.5,'shield');toast('盾山将留下了一座盾碑');}
function addIceHazard(row,col){if(!game.hazards.some(h=>h.type==='ice'&&h.row===row&&h.col===col)){game.hazards.push({id:++game.entityId,type:'ice',isHazard:true,blocksPlant:true,row,col,x:col});pulseAt(col+.5,row+.5,'ice');}}
function damageHazard(hazard,amount){if(hazard.type!=='shield')return false;amount*=game.config.buffData?.damage||1;hazard.hp-=amount;floatText(hazard.col+.5,hazard.row+.2,`-${Math.round(amount)}`,'#d8c9ae');pulseAt(hazard.col+.5,hazard.row+.5,'shield');if(hazard.hp<=0){game.hazards=game.hazards.filter(h=>h!==hazard);toast('盾碑已被摧毁');}return true;}
function checkRanks(type){
  const thresholds=[0,35,100,250,600], current=save.ranks[type];
  if(current<5&&save.mastery[type]>=thresholds[current]){ save.ranks[type]++; game.rankUps.push(`${UNITS[type].name}升至 ${save.ranks[type]} 阶`); persist(); toast(`${UNITS[type].name}完成升阶：${save.ranks[type]} 阶`); }
}

function flashShot(p,e){
  fireProjectile(p.col+.5,p.row+.5,targetX(e)+.5,e.row+.5,p.type);
}
function fireProjectile(x,y,tx,ty,kind='gold',duration=0){const scenic=clamp(Math.hypot(tx-x,ty-y)*.105,.46,1.05);game.projectiles.push({id:++game.entityId,x,y,tx,ty,kind,t:0,duration:Math.max(duration,scenic)});}
function updateProjectiles(dt){ game.projectiles.forEach(p=>p.t+=dt); game.projectiles=game.projectiles.filter(p=>p.t<p.duration); }

function spawnEnergyOrb(){
  if(!game||game.over) return;
  const owner=game,orb=document.createElement('button');orb.className='energy-orb';orb.textContent='✦';orb.style.left=`${(1+Math.random()*7)*100/9}%`;orb.style.top=`${(.5+Math.random()*4)*20}%`;
  const collect=automatic=>{
    if(game!==owner||owner.over||!orb.isConnected||orb.dataset.claimed)return;orb.dataset.claimed='true';
    const finish=()=>{if(game!==owner||owner.over)return;owner.energy+=50;owner.energyCollected+=50;updateGameHeader();floatText(4.5,2.5,'+50','#ffe78d');};
    if(automatic){flyResourceToCounter(orb,'#energyCounter','energy',finish);orb.remove();}else{finish();flyResourceToCounter(orb,'#energyCounter','energy');orb.remove();}
  };
  orb.onclick=()=>collect(false);$("#effectLayer").append(orb);setTimeout(()=>collect(true),AUTO_COLLECT_DELAY);
}

function renderEntities(state=game,layer=$("#entityLayer")){
  if(!state||!layer)return;
  layer.innerHTML="";
  state.players.forEach(p=>{
    const u=UNITS[p.type];if((p.ultGlowTimer||0)>0){const glow=document.createElement('i');glow.className=`ultimate-tile-glow glow-${p.type}`;glow.style.left=`${(p.col+.5)*100/9}%`;glow.style.top=`${(p.row+.5)*20}%`;glow.style.setProperty('--ultimate-color',u.color);layer.append(glow);}const el=document.createElement('div');el.className=`piece player-piece player-${p.type} ${p.weaponHidden>0?'weapon-hidden':''} ${p.beanArmor>0?'bean-armored':''}`;el.style.left=`${(p.col+.5)*100/9}%`;el.style.top=`${(p.row+.5)*20}%`;el.style.color=u.color;
    el.innerHTML=`${unitArt(p.type,'battle-art')}<span class="hp-bar"><i style="width:${clamp(p.hp/p.maxHp*100,0,100)}%"></i></span>${p.beanArmor>0?`<span class="armor-bar"><i style="width:${clamp(p.beanArmor/2000*100,0,100)}%"></i></span>`:''}<span class="rank-pips">${'◆'.repeat(p.rank)}</span>`;layer.append(el);
  });
  state.enemies.forEach(e=>{
    const d=ENEMIES[e.type],el=document.createElement('div');el.className=`piece enemy-piece enemy-${e.type} ${d.boss?'boss-piece':''} ${d.giant?'giant-piece':''} ${d.large?'large-piece':''} ${d.summoner?'elephant-piece':''} ${e.slowTimer>0?'slowed-piece':''} ${e.burnTimer>0?'burning-piece':''} ${e.poisonTimer>0?'poisoned-piece':''} ${e.vulnerableTimer>0?'vulnerable-piece':''} ${e.shadowMarks>0?'shadow-marked':''} ${e.reflectActive>0?'reflecting-piece':''}`;el.style.left=`${(e.x+.5)*100/9}%`;el.style.top=`${(e.row+.5)*20}%`;
    el.innerHTML=`${enemyDecoration(e.type)}<span class="piece-symbol">${d.char}</span><span class="hp-bar"><i style="width:${clamp(e.hp/e.maxHp*100,0,100)}%"></i></span>`;layer.append(el);
  });
  state.hazards.forEach(h=>{const el=document.createElement('div');el.className=`board-hazard ${h.type}-hazard`;el.style.left=`${(h.col+.5)*100/9}%`;el.style.top=`${(h.row+.5)*20}%`;el.innerHTML=h.type==='shield'?`<span>盾</span><span class="hp-bar"><i style="width:${clamp(h.hp/h.maxHp*100,0,100)}%"></i></span>`:'<span>❄</span>';layer.append(el);});
  (state.beanDrops||[]).forEach(drop=>{const el=document.createElement('button');el.className='energy-bean-drop';el.dataset.beanId=drop.id;el.title='拾取能量豆（1.5秒后自动收入）';el.style.left=`${(drop.x+.5)*100/9}%`;el.style.top=`${(drop.row+.5)*20}%`;el.innerHTML='<span><i></i></span>';el.onclick=()=>collectEnergyBean(drop);layer.append(el);});
  state.projectiles.forEach(p=>{ const t=clamp(p.t/p.duration,0,1),x=p.x+(p.tx-p.x)*t,arc=(p.kind==='spearPawn'?Math.sin(Math.PI*t)*.72:p.kind==='spearVolley'?Math.sin(Math.PI*t)*1.05:0),y=p.y+(p.ty-p.y)*t-arc,el=document.createElement('i');el.className=`projectile proj-${p.kind||'gold'}`;el.style.left=`${x*100/9}%`;el.style.top=`${y*20}%`;el.style.setProperty('--shot-angle',`${Math.atan2((p.ty-p.y)*5,(p.tx-p.x)*9)}rad`);el.style.setProperty('--shot-spin',`${t*720}deg`);layer.append(el); });
}

function getEffectLayer(){return effectLayerOverride||$("#effectLayer");}
function floatText(x,y,text,color){
  const el=document.createElement('span');el.className='damage-number';el.textContent=text;el.style.color=color;el.style.left=`${x*100/9}%`;el.style.top=`${y*20}%`;getEffectLayer().append(el);setTimeout(()=>el.remove(),850);
}
function enemyDecoration(type){
  if(type==='digger')return '<span class="shovel-prop"><i></i></span>';
  if(type==='iceChariot')return '<span class="frost-cart"><i></i><i></i></span>';
  if(type==='jester')return '<span class="mirror-orbit"><i></i><i></i><i></i><i></i></span>';
  return '';
}
function pulseAt(x,y,kind='hit'){ const el=document.createElement('i');el.className=`hit-flash effect-${kind}`;el.style.left=`${x*100/9}%`;el.style.top=`${y*20}%`;getEffectLayer().append(el);setTimeout(()=>el.remove(),750); }
function combatVisual(type,x,y,tx=x,ty=y){
  const el=document.createElement('i'),distance=Math.hypot(tx-x,ty-y),angle=Math.atan2(ty-y,tx-x);el.className=`combat-visual visual-${type}`;el.style.left=`${x*100/9}%`;el.style.top=`${y*20}%`;el.style.setProperty('--visual-distance',`${distance}`);el.style.setProperty('--visual-angle',`${angle}rad`);el.innerHTML='<b></b><span></span>';getEffectLayer().append(el);setTimeout(()=>el.remove(),type==='knightCharge'||type==='rapidCharge'||type==='stormCloud'?1700:1100);return el;
}
function flattenPiece(x,y,type,reason){ const el=document.createElement('span');el.className=`flattened-piece ${reason}`;el.innerHTML=unitArt(type,'effect-art');el.style.left=`${x*100/9}%`;el.style.top=`${y*20}%`;getEffectLayer().append(el);setTimeout(()=>el.remove(),1100); }
function flingPiece(x,y,type){const el=document.createElement('span');el.className='flung-piece';el.innerHTML=unitArt(type,'effect-art');el.style.left=`${x*100/9}%`;el.style.top=`${y*20}%`;getEffectLayer().append(el);setTimeout(()=>el.remove(),1200);}
function fallenPlayer(x,y,type){const el=document.createElement('span');el.className='fallen-unit fallen-player';el.innerHTML=unitArt(type,'effect-art');el.style.left=`${x*100/9}%`;el.style.top=`${y*20}%`;getEffectLayer().append(el);setTimeout(()=>el.remove(),1500);}
function fallenEnemy(enemy){const d=ENEMIES[enemy.type],el=document.createElement('span');el.className=`fallen-unit fallen-enemy ${d.large||d.giant?'fallen-large':''}`;el.textContent=d.char;el.style.left=`${(enemy.x+.5)*100/9}%`;el.style.top=`${(enemy.row+.5)*20}%`;getEffectLayer().append(el);setTimeout(()=>el.remove(),1500);}

function updateGameHeader(){
  if(!game)return;
  $("#energyValue").textContent=Math.floor(game.energy);
  $("#beanValue").textContent=game.beans||0;$("#beanButton").classList.toggle('ready',(game.beans||0)>0);$("#beanButton").classList.toggle('selected',game.selected==='bean');
  const c=game.config;
  if(c.id==='rush'){
    $("#objectiveLabel").textContent=`剩余 ${fmtTime(c.duration-game.elapsed)}`;$("#objectiveValue").textContent=`击破 ${game.kills}`;$("#objectiveBar").style.width=`${clamp(game.elapsed/c.duration*100,0,100)}%`;
  } else if(c.snakePit){
    $("#objectiveLabel").textContent=`万蛇窟 · ${game.waveTarget||c.snakeCount} 条`;$("#objectiveValue").textContent=`击破 ${game.kills} / ${game.waveTarget||c.snakeCount}`;$("#objectiveBar").style.width=`${clamp(game.kills/(game.waveTarget||c.snakeCount||1)*100,0,100)}%`;
  } else {
    $("#objectiveLabel").textContent=`第 ${Math.max(1,game.wave)} 波 / 共 ${c.waves} 波`;$("#objectiveValue").textContent=`${Math.max(0,game.wave-1)} / ${c.waves}`;$("#objectiveBar").style.width=`${clamp(((game.wave-1)+(game.waveTarget?game.spawned/game.waveTarget:.0))/c.waves*100,0,100)}%`;
  }
}
function checkEndConditions(){
  const c=game.config;
  if(c.id==='rush'){if(game.elapsed>=c.duration)endGame(true,`计时结束 · 本局共击破 ${game.kills} 枚敌棋`);return;}
  if(game.wave>=c.waves&&game.spawned>=game.waveTarget&&game.enemies.length===0) endGame(true,c.snakePit?`${game.waveTarget}条紫蛇已全部肃清`:c.protect?'王棋安然无恙':'全部波次已被击退');
}

function setPause(value){ if(!game||game.over)return;game.paused=value;game.lastTime=performance.now();$("#pauseOverlay").classList.toggle('show',value); }
function quitGame(){ stopGame();$("#pauseOverlay").classList.remove('show');showScreen('homeScreen');updateHome(); }
function stopGame(){ if(game?.raf)cancelAnimationFrame(game.raf);game=null;$("#effectLayer").innerHTML='';$("#entityLayer").innerHTML='';$$('.resource-flight').forEach(el=>el.remove());$$('.receiving').forEach(el=>el.classList.remove('receiving')); }

function endGame(win,reason){
  if(!game||game.over)return; game.over=true;cancelAnimationFrame(game.raf);persist();
  const snapshot={...game,players:[...game.players],enemies:[...game.enemies]};
  $("#resultEmblem").textContent=win?'胜':'败';$("#resultEyebrow").textContent=win?'MISSION COMPLETE':'MISSION FAILED';$("#resultTitle").textContent=win?'防线守住了':'王冠军失守';$("#resultText").textContent=reason;
  $("#statKills").textContent=game.kills;$("#statEnergy").textContent=game.energyCollected;$("#statTime").textContent=fmtTime(game.elapsed);$("#rankReport").textContent=game.rankUps.length?`升阶成果 · ${game.rankUps.join(' / ')}`:'棋子熟练度已记录';
  $("#resultNext").textContent=win&&game.config.kind==='story'?'继续故事':win?'再来一局':'重新挑战';
  $("#resultNext").dataset.win=String(win);$("#resultNext").dataset.kind=game.config.kind;$("#resultNext").dataset.index=game.config.storyIndex??'';$("#resultNext").dataset.challenge=game.config.id||'';$("#resultNext").dataset.difficulty=game.config.difficulty||'standard';$("#resultNext").dataset.snakeCount=game.config.snakeCount||'';
  if(win&&game.config.kind==='story'){
    const i=game.config.storyIndex,archiveMilestones=[2,3,4,5,8,12];save.storyUnlocked=Math.max(save.storyUnlocked,Math.min(6,i+2));save.archiveUnlocked=Math.max(save.archiveUnlocked,archiveMilestones[i]);persist();updateHome();snapshot.justWonStory=i;
  }
  game.snapshot=snapshot;showScreen('resultScreen');
}

function handleResultNext(){
  if(!game)return;const snap=game.snapshot||game,win=$("#resultNext").dataset.win==='true',kind=$("#resultNext").dataset.kind,index=+($("#resultNext").dataset.index||0),challengeId=$("#resultNext").dataset.challenge,difficulty=$("#resultNext").dataset.difficulty||'standard',snakeCount=+($("#resultNext").dataset.snakeCount||100);stopGame();
  if(kind==='story'&&win){
    const level=STORY[index];runDialogue(level.post,{title:`第 ${index+1} 章\n任务完成`,onDone:()=>{renderStory();showScreen('storyScreen');}});
  } else if(kind==='story'){ startStory(index); }
  else if(kind==='custom'){openCustomRoom();}
  else if(challengeId==='snakePit'){openSnakePitConfig(CHALLENGES.find(c=>c.id===challengeId),snakeCount);}
  else { startChallenge(CHALLENGES.find(c=>c.id===challengeId)||CHALLENGES[0],difficulty); }
}


init();
