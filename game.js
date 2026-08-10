"use strict";

const $ = (q, root = document) => root.querySelector(q);
const $$ = (q, root = document) => [...root.querySelectorAll(q)];

const UNITS = {
  pawn: { name: "兵", symbol: "♙", cost: 50, hp: 500, cd: 5, attack: 150, attackMode:"melee", color: "#ddd0b6", desc: "近卫 · 敌人进入前方2格后攻击" },
  rook: { name: "车", symbol: "♖", cost: 150, hp: 1200, cd: 10, attack: 175, attackMode:"flat", color: "#d7c39b", desc: "重装 · 每2秒向四方开火，每发随机150–200伤害" },
  king: { name: "王", symbol: "♔", cost: 50, hp: 800, cd: 10, attack: 0, attackMode:"support", color: "#e9d59e", desc: "后勤 · 每8秒生产25能量" },
  knight: { name: "马", symbol: "♘", cost: 100, hp: 750, cd: 8, attack: 260, attackMode:"leap", color: "#c9d0cb", desc: "游骑 · 跃击可绕过盾碑并伤害掘阵卒" },
  bishop: { name: "象", symbol: "♗", cost: 125, hp: 650, cd: 8, attack: 300, attackMode:"arc", color: "#d7c7b7", desc: "弧击 · 弧线攻击可越过盾碑并伤害掘阵卒" },
  queen: { name: "后", symbol: "♕", cost: 225, hp: 900, cd: 15, attack: 220, attackMode:"flat", color: "#ead3ad", desc: "统御 · 同时压制相邻三路" },
  priest: { name: "圣女", symbol: "✚", cost: 125, hp: 650, cd: 12, attack: 0, attackMode:"support", color: "#a8e0c3", desc: "圣愈 · 每4秒治疗周围友军120生命" },
  frost: { name: "冰皇", symbol: "❄", cost: 175, hp: 700, cd: 14, attack: 120, attackMode:"flat", color: "#9ddcf0", desc: "寒潮 · 远程攻击并使敌人减速45%" },
  ballista: { name: "弩塔", symbol: "⛉", cost: 200, hp: 900, cd: 15, attack: 180, attackMode:"flat", color: "#e0a66e", desc: "穿云 · 贯穿敌军，但会被盾碑截停" }
};

const ENEMIES = {
  soldier: { name: "兵卒", char: "兵", hp: 800, speed: .18, damage: 100, rate: 1.5, intel: "最常见的前锋。生命提高到800，成群出现时会快速挤垮单点防线。", stats:[50,30,20] },
  cannon: { name: "隔子炮", char: "炮", hp: 1100, speed: .13, damage: 150, rate: 2.1, cannon: true, intel: "拥有1100生命，以第一枚棋子为炮架，越过它轰击后方第二枚棋子，炮弹固定造成150伤害。", stats:[60,60,20] },
  horse: { name: "赤马", char: "馬", hp: 1300, speed: .24, damage: 150, rate: 1.4, intel: "生命提高到1300，移动迅速，首次接敌时会向前跳过一个棋位。", stats:[65,45,55] },
  chariot: { name: "诡道铁车", char: "車", hp: 3200, speed: .095, damage: 240, rate: 1.8, teleport: true, intel: "拥有3200生命，每隔5秒保持横向位置不变，随机换入另一条路线。", stats:[95,70,35] },
  guard: { name: "玄士", char: "士", hp: 1800, speed: .12, damage: 90, rate: 1.7, shield: .35, intel: "拥有1800生命，并为附近敌军提供减伤结界。优先消灭它。", stats:[80,30,25] },
  elephant: { name: "八卦相", char: "相", hp: 2800, speed: .105, damage: 120, rate: 1.8, summoner: true, intel: "拥有2800生命。脚下展开八卦阵，每隔10秒在附近召来一枚兵、炮或马；八卦迷阵从第2波起保证登场。", stats:[90,45,20] },
  digger: { name:"掘阵卒", char:"掘", hp:2200, speed:.155, damage:99999, rate:1.4, shoveler:true, flatImmune:true, intel:"举起玄铁铲，完全无视车、后、冰皇与弩塔的平射；接触后直接铲飞我方棋子。用兵近战、马跃击或象弧击破解。", stats:[82,100,34] },
  jester: { name:"镜戏丑", char:"镜", hp:2400, speed:.13, damage:130, rate:1.7, reflector:true, intel:"每5秒展开1.5秒镜幕。镜幕期间远程攻击不会造成伤害，反而会把75%的伤害弹回攻击者。", stats:[84,72,27] },
  shieldGiant: { name:"盾山将", char:"盾", hp:14000, speed:.06, damage:300, rate:1.6, leavesShield:true, large:true, intel:"重甲近卫。死亡时在当前位置留下6500生命的盾碑，占据棋格并截停所有平射。", stats:[100,86,10] },
  iceChariot: { name:"霜辙车", char:"冰", hp:6500, speed:.085, damage:240, rate:1.8, iceTrail:true, intel:"所经棋格会永久结冰。本局中冰格无法再部署棋子，必须提前完成阵型。", stats:[98,70,18] },
  general: { name: "镇国大将", char: "将", hp: 32000, speed: .052, damage: 99999, rate: 1.25, giant: true, intel: "生命提高到32000，体形是普通敌棋的两倍。接触我方棋子便直接将其砸扁。", stats:[100,100,8] },
  snake: { name: "紫蛇", char: "蛇", hp: 65000, speed: .065, damage: 360, rate: 1.2, boss: true, regen: 100, intel: "生命提高到65000。若连续1秒没有受到攻击，之后每秒回复100生命。", stats:[100,100,40] }
};

const STORY = [
  { title:"遗落的兵徽", subtitle:"击退追踪而来的兵卒", icon:"兵", waves:3, unlock:"soldier", energy:75,
    pre:[{s:"亚瑟",t:"露西的兵徽……断口还很新。紫蛇一定刚从这里经过。",side:"left"},{s:"白兵·诺亚",t:"前面有动静！汉界的兵卒正向我们压来。",side:"right"},{s:"亚瑟",t:"守住五条通路。今天，王冠不会后退。",side:"left"}],
    post:[{s:"白兵·诺亚",t:"敌人退了！我从他们身上找到了一份行军记录。",side:"right"},{s:"亚瑟",t:"资料记下了。我们离紫蛇又近了一步。",side:"left"}]},
  { title:"炮火回廊", subtitle:"突破远程火炮封锁", icon:"炮", waves:4, unlock:"cannon", energy:75,
    pre:[{s:"白兵·诺亚",t:"小心，那些圆盘后面藏着火炮。它们会隔着棋位攻击。",side:"right"},{s:"亚瑟",t:"让马越过火线。先打掉它们。",side:"left"}],
    post:[{s:"亚瑟",t:"炮阵已经沉默。露西，坚持住。",side:"left"},{s:"？？？",t:"你以为穿过几条走廊，就能追上我吗？",side:"right",villain:true}]},
  { title:"赤马疾风", subtitle:"抵挡高速骑阵", icon:"馬", waves:4, unlock:"horse", energy:75,
    pre:[{s:"亚瑟",t:"地面在震。它们的马比我们预想得更快。",side:"left"},{s:"白马·莱恩",t:"那就由我来教它们，什么才叫真正的跃击。",side:"right"}],
    post:[{s:"白马·莱恩",t:"在鞍袋里发现了地图。紫蛇去了王城方向。",side:"right"},{s:"亚瑟",t:"下一站，铁车关。",side:"left"}]},
  { title:"铁车关", subtitle:"摧毁重甲攻城车", icon:"車", waves:5, unlock:"chariot", energy:75,
    pre:[{s:"黑后·薇拉",t:"正面硬碰硬不是勇敢，是浪费。让我的火力覆盖三条路。",side:"right"},{s:"亚瑟",t:"全军就位。拆掉这道铁墙。",side:"left"}],
    post:[{s:"黑后·薇拉",t:"铁车的甲片上有蛇鳞纹章。它在害怕我们。",side:"right"},{s:"亚瑟",t:"很好。让它继续害怕。",side:"left"}]},
  { title:"八卦迷阵", subtitle:"击破护盾与召唤阵", icon:"相", waves:5, unlock:"elephant", featured:"elephant", energy:75,
    pre:[{s:"亚瑟",t:"敌人的阵线被紫光连在一起。玄士在护盾后藏了召唤阵。",side:"left"},{s:"白象·斐恩",t:"敌相每隔一段时间就会召来援军。必须尽快切断八卦阵。",side:"right"}],
    post:[{s:"白象·斐恩",t:"结界散了。王城大门就在前方。",side:"right"},{s:"露西",t:"亚瑟……别来。它在等你。",side:"right"},{s:"亚瑟",t:"我答应过你。最后一格，我也会走完。",side:"left"}]},
  { title:"紫蛇王城", subtitle:"最终决战 · 营救露西", icon:"蛇", waves:6, unlock:"snake", energy:75, boss:true,
    pre:[{s:"紫蛇",t:"王终于走进了我的棋局。你每前进一步，都在替我完成布局。",side:"right",villain:true},{s:"亚瑟",t:"棋局结束了。放开露西。",side:"left"},{s:"紫蛇",t:"六万五千生命、镇国大将，还有会自愈的蛇鳞。让你的火力停一秒试试。",side:"right",villain:true}],
    post:[{s:"紫蛇",t:"不可能……两种棋，怎么会站在同一条线上……",side:"right",villain:true},{s:"露西",t:"因为你只看见了棋子，却没看见棋子之间的选择。",side:"right"},{s:"亚瑟",t:"回家吧，露西。",side:"left"}]}
];

const CHALLENGES = [
  { id:"survival", icon:"♜", label:"ENDURANCE", title:"六波坚守", text:"从75能量起步，敌军会逐波增强。撑过全部六波即可获胜。", objective:"目标 · 撑过 6 波", waves:6, energy:75 },
  { id:"rush", icon:"80", label:"TIME ATTACK", title:"百二十秒", text:"从75能量起步，在倒计时结束前击破80个敌人。", objective:"目标 · 120秒内击破80敌", duration:120, targetKills:80, energy:75 },
  { id:"protect", icon:"♔", label:"ROYAL GUARD", title:"守护王棋", text:"从75能量起步，保护中央后排王棋并击退五波。", objective:"目标 · 保护特殊王棋", waves:5, protect:true, energy:75 }
];

const defaults = { storyUnlocked:1, archiveUnlocked:1, ranks:{pawn:1,rook:1,king:1,knight:1,bishop:1,queen:1,priest:1,frost:1,ballista:1}, mastery:{pawn:0,rook:0,king:0,knight:0,bishop:0,queen:0,priest:0,frost:0,ballista:0} };
let save = loadSave();
let game = null;
let dialogue = null;
let toastTimer = 0;

function loadSave(){
  try { const stored=JSON.parse(localStorage.getItem("chessWarSave")||"{}");return {...defaults,...stored,ranks:{...defaults.ranks,...stored.ranks},mastery:{...defaults.mastery,...stored.mastery}}; }
  catch { return structuredClone(defaults); }
}
function persist(){ localStorage.setItem("chessWarSave", JSON.stringify(save)); }
function showScreen(id){ $$(".screen").forEach(s=>s.classList.toggle("active",s.id===id)); window.scrollTo(0,0); }
function toast(text){ const el=$("#toast"); el.textContent=text; el.classList.add("show"); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove("show"),1800); }
function clamp(n,a,b){ return Math.max(a,Math.min(b,n)); }
function fmtTime(sec){ sec=Math.max(0,Math.round(sec)); return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,"0")}`; }

function init(){
  $$('[data-open]').forEach(b=>b.addEventListener('click',()=>{ const id=b.dataset.open; if(id==='archiveScreen') renderArchive(); showScreen(id); }));
  $("#storyButton").onclick=()=>{ renderStory(); showScreen("storyScreen"); };
  $("#battleButton").onclick=()=>{ renderChallenges(); showScreen("battleScreen"); };
  $("#dialogueNext").onclick=nextDialogue;
  $("#dialogueSkip").onclick=finishDialogue;
  $("#pauseButton").onclick=()=>setPause(true);
  $("#resumeButton").onclick=()=>setPause(false);
  $("#pauseQuit").onclick=quitGame;
  $("#gameQuit").onclick=()=>setPause(true);
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
  $("#challengeGrid").innerHTML=CHALLENGES.map(c=>`<button class="challenge-card" data-id="${c.id}"><div class="challenge-visual">${c.icon}</div><div class="challenge-content"><span class="eyebrow">${c.label}</span><h3>${c.title}</h3><p>${c.text}</p><span class="challenge-objective">${c.objective}</span></div></button>`).join("");
  $$(".challenge-card").forEach(el=>el.onclick=()=>startChallenge(CHALLENGES.find(c=>c.id===el.dataset.id)));
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
  runDialogue(level.pre,{title:`第 ${index+1} 章\n${level.title}`, onDone:()=>beginGame({kind:'story',storyIndex:index,title:level.title,waves:level.waves,energy:level.energy,boss:level.boss,featured:level.featured})});
}
function startChallenge(config){ beginGame({kind:'challenge',...config,title:config.title}); }

function runDialogue(lines, opts){ dialogue={lines,index:0,...opts}; showScreen("dialogueScreen"); renderDialogue(); }
function renderDialogue(){
  const d=dialogue.lines[dialogue.index];
  $("#sceneTitle").textContent=dialogue.title||"王冠军\n战地记录";
  $("#dialogueSpeaker").textContent=d.s;
  $("#dialogueText").textContent=d.t;
  $("#portraitLeft").innerHTML=`<span>${d.side==='left'?'♔':'♙'}</span>`;
  $("#portraitRight").innerHTML=`<span>${d.villain?'蛇':d.side==='right'?'♟':'蛇'}</span>`;
  $("#portraitLeft").classList.toggle("dim",d.side!=="left");
  $("#portraitRight").classList.toggle("dim",d.side!=="right");
  $("#dialogueNext").innerHTML=dialogue.index===dialogue.lines.length-1?'进入战场 <span>→</span>':'继续 <span>→</span>';
}
function nextDialogue(){ if(++dialogue.index>=dialogue.lines.length) finishDialogue(); else renderDialogue(); }
function finishDialogue(){ const cb=dialogue?.onDone; dialogue=null; if(cb) cb(); }

function buildGrid(){
  const grid=$("#grid");
  grid.innerHTML="";
  for(let r=0;r<5;r++) for(let c=0;c<9;c++){
    const cell=document.createElement("div"); cell.className="grid-cell"; cell.dataset.row=r; cell.dataset.col=c;
    cell.onclick=()=>placeSelected(r,c); grid.append(cell);
  }
  $("#laneLabels").innerHTML=Array.from({length:5},(_,i)=>`<span>0${i+1}</span>`).join("");
}

function beginGame(config){
  stopGame();
  const startingEnergy=config.energy??75;
  game={ config, energy:startingEnergy, energyCollected:startingEnergy, selected:'pawn', cooldowns:{}, players:[], enemies:[], hazards:[], projectiles:[], kills:0, wave:0, spawned:0, waveTarget:0, nextSpawn:1, nextWave:2.5, elapsed:0, paused:false, over:false, lastTime:performance.now(), orbTimer:8, entityId:0, used:{}, rankUps:[], bossSpawned:false };
  Object.keys(UNITS).forEach(k=>game.cooldowns[k]=0);
  if(config.protect){
    const p=createPlayer('king',2,0,true); p.hp=1500; p.maxHp=1500; game.players.push(p);
  }
  renderUnitTray(); updateGameHeader(); renderEntities(); showScreen("gameScreen");
  $("#missionTitle").textContent=config.kind==='story'?`第 ${config.storyIndex+1} 章 · ${config.title}`:config.title;
  $("#battleTip").textContent=config.protect?'特殊王棋已部署：绝不能让它被摧毁':'选择棋子，再点击空格部署';
  game.raf=requestAnimationFrame(gameLoop);
}

function renderUnitTray(){
  const shovel=`<button class="shovel-card ${game.selected==='shovel'?'selected':''}" data-tool="shovel" title="铲除误放的我方棋子"><span>♠</span><b>铲子</b><small>移除棋子</small></button>`;
  $("#unitTray").innerHTML=shovel+Object.entries(UNITS).map(([k,u])=>`<button class="unit-card unit-${k} ${game.selected===k?'selected':''}" style="--unit-color:${u.color}" data-unit="${k}" title="${u.desc}"><span class="unit-symbol">${u.symbol}</span><span class="unit-name">${u.name}</span><span class="unit-cost">✦ ${u.cost}</span><span class="unit-rank">${'◆'.repeat(save.ranks[k])}${'◇'.repeat(5-save.ranks[k])}</span></button>`).join("");
  $(".shovel-card").onclick=()=>{ game.selected='shovel'; renderUnitTray(); $("#battleTip").textContent='铲子已选中：点击我方棋子将其移除'; };
  $$(".unit-card").forEach(el=>el.onclick=()=>{ game.selected=el.dataset.unit; const tip=UNITS[game.selected].desc;renderUnitTray(); $("#battleTip").textContent=game.config.protect?`特殊王棋不可铲除 · ${tip}`:tip; });
  updateTrayState();
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

function rankMult(type){ return 1+(save.ranks[type]-1)*.15; }
function createPlayer(type,row,col,protectedUnit=false){
  const u=UNITS[type], mult=rankMult(type);
  return {id:++game.entityId,type,row,col,hp:Math.round(u.hp*mult),maxHp:Math.round(u.hp*mult),timer: type==='king'?6:1, protectedUnit, rank:save.ranks[type]};
}
function placeSelected(row,col){
  if(!game||game.paused||game.over) return;
  const occupant=game.players.find(p=>p.row===row&&p.col===col);
  const hazard=game.hazards.find(h=>h.row===row&&h.col===col&&h.blocksPlant);
  if(game.selected==='shovel'){
    if(!occupant){ toast(hazard?'敌方冰面或盾碑无法用铲子清除':'这里没有可以铲除的棋子'); return; }
    if(occupant.protectedUnit){ toast("任务目标王棋不可铲除"); return; }
    game.players=game.players.filter(p=>p!==occupant); flattenPiece(occupant.col+.5,occupant.row+.5,UNITS[occupant.type].symbol,'shovel');
    toast(`${UNITS[occupant.type].name}已被铲除`); renderEntities(); return;
  }
  const type=game.selected,u=UNITS[type];
  if(occupant){ toast("这个棋位已经被占用"); return; }
  if(hazard){ toast(hazard.type==='ice'?'此格已结冰，无法部署':'盾碑占据了此格，必须先摧毁'); return; }
  if(game.energy<u.cost){ toast("能量不足"); return; }
  if(game.cooldowns[type]>0){ toast(`${u.name}仍在整备中`); return; }
  game.energy-=u.cost; game.players.push(createPlayer(type,row,col)); game.cooldowns[type]=u.cd; game.used[type]=(game.used[type]||0)+1;
  pulseAt(col+.5,row+.5,'deploy'); updateGameHeader(); renderUnitTray(); renderEntities();
}

function gameLoop(now){
  if(!game||game.over) return;
  const dt=Math.min((now-game.lastTime)/1000,.05); game.lastTime=now;
  if(!game.paused){ updateGame(dt); renderEntities(); }
  game.raf=requestAnimationFrame(gameLoop);
}

function updateGame(dt){
  game.elapsed+=dt;
  Object.keys(game.cooldowns).forEach(k=>game.cooldowns[k]=Math.max(0,game.cooldowns[k]-dt));
  game.orbTimer-=dt;
  if(game.orbTimer<=0){ spawnEnergyOrb(); game.orbTimer=8+Math.random()*4; }
  updateSpawning(dt);
  updatePlayers(dt);
  updateEnemies(dt);
  updateProjectiles(dt);
  updateTrayState(); updateGameHeader();
  checkEndConditions();
}

function updateSpawning(dt){
  const cfg=game.config;
  if(cfg.id==='rush'){
    game.nextSpawn-=dt;
    if(game.nextSpawn<=0){ const type=rushEnemyType();spawnEnemy(type,Math.floor(Math.random()*5),.62);game.spawned++;game.nextSpawn=.48+Math.random()*.34; }
    return;
  }
  if(game.wave===0){ game.nextWave-=dt; if(game.nextWave<=0) startWave(); return; }
  if(game.spawned<game.waveTarget){
    game.nextSpawn-=dt;
    if(game.nextSpawn<=0){
      const count=game.wave>=6?8:game.wave>=5?7:game.wave>=4?6:Math.min(4,game.wave-1);
      const forced=guaranteedEnemyForWave(cfg,game.wave,game.spawned);
      spawnEnemy(forced||pickEnemy(count),Math.floor(Math.random()*5)); game.spawned++; game.nextSpawn=Math.max(.65,1.75-game.wave*.12)+Math.random()*.65;
    }
  } else if(game.enemies.length===0 && game.wave<cfg.waves){ game.nextWave-=dt; if(game.nextWave<=0) startWave(); }
  if(cfg.boss&&game.wave===cfg.waves&&!game.bossSpawned){ spawnEnemy('snake',2); game.bossSpawned=true; }
}
function startWave(){
  game.wave++; game.spawned=0; game.waveTarget=4+game.wave*2; game.nextSpawn=.3; game.nextWave=3;
  toast(game.config.boss&&game.wave===game.config.waves?'最终波 · 紫蛇现身':`第 ${game.wave} 波来袭`);
}
function pickEnemy(tier){
  const pool=['soldier']; if(tier>=1)pool.push('cannon'); if(tier>=2)pool.push('horse'); if(tier>=3)pool.push('chariot'); if(tier>=4)pool.push('guard');
  if(tier>=5)pool.push('elephant'); if(tier>=6)pool.push('digger','jester'); if(tier>=7)pool.push('shieldGiant','iceChariot');if(tier>=8)pool.push('general');
  return pool[Math.floor(Math.random()*pool.length)];
}
function guaranteedEnemyForWave(cfg,wave,index){
  if(cfg.featured==='elephant'&&wave>=2&&index===0)return 'elephant';
  if(index===0&&wave===2)return 'digger';if(index===0&&wave===3)return 'jester';if(index===0&&wave===4)return 'iceChariot';if(index===0&&wave===5)return 'elephant';if(index===0&&wave>=6)return 'shieldGiant';if(index===1&&wave>=6)return 'general';return null;
}
function rushEnemyType(){
  if(game.elapsed>=30&&game.spawned%20===0)return 'shieldGiant';if(game.elapsed>=25&&game.spawned%16===0)return 'iceChariot';if(game.elapsed>=20&&game.spawned%14===0)return 'jester';if(game.elapsed>=15&&game.spawned%12===0)return 'digger';return pickEnemy(Math.min(8,Math.floor(game.elapsed/14)));
}
function spawnEnemy(type,row,hpScale=1){
  const e=ENEMIES[type];
  const scaling=game.config.id==='rush'?.64:1+(Math.max(0,game.wave-1)*.045);
  const enemy={id:++game.entityId,type,row,x:9.35,hp:Math.round(e.hp*scaling*hpScale),maxHp:Math.round(e.hp*scaling*hpScale),attackTimer:e.rate,jumped:false,summonTimer:e.summoner?10:7,teleportTimer:5,noHitTime:0,regenTick:0,slowTimer:0,reflectTimer:3.5,reflectActive:0,lastTrailCol:null};
  game.enemies.push(enemy); return enemy;
}

function updatePlayers(dt){
  for(const p of [...game.players]){
    p.timer-=dt;
    if(p.timer>0) continue;
    const u=UNITS[p.type], mult=rankMult(p.type);
    if(p.type==='king'){
      const gain=Math.round(25+(save.ranks.king-1)*5); game.energy+=gain; game.energyCollected+=gain; p.timer=Math.max(5,8-(save.ranks.king-1)*.5); floatText(p.col+.5,p.row+.2,`+${gain}`,'#f3d273');pulseAt(p.col+.5,p.row+.5,'energy'); save.mastery.king=(save.mastery.king||0)+.5; checkRanks('king'); continue;
    }
    if(p.type==='pawn'){
      const target=nearestLaneTarget(p.row,p.col,2.25); if(target){ damageTarget(target,Math.round(u.attack*mult),p.type,p); p.timer=Math.max(.8,1.5-(p.rank-1)*.08); flashShot(p,target); } else p.timer=.15;
    } else if(p.type==='rook'){
      let hit=false;
      visibleFlatTargets(p.row,p.col,7).sort((a,b)=>Math.abs(targetX(a)-p.col)-Math.abs(targetX(b)-p.col)).slice(0,2).forEach(e=>{damageTarget(e,Math.round((150+Math.random()*50)*mult),p.type,p);flashShot(p,e);hit=true;});
      [...game.enemies.filter(e=>Math.abs(e.x-p.col)<.65&&Math.abs(e.row-p.row)<=4),...game.hazards.filter(h=>h.type==='shield'&&Math.abs(h.col-p.col)<.65)].slice(0,2).forEach(e=>{damageTarget(e,Math.round((150+Math.random()*50)*mult),p.type,p);flashShot(p,e);hit=true;});
      p.timer=hit?Math.max(1.25,2-(p.rank-1)*.1):.2;
    } else if(p.type==='knight'){
      const target=game.enemies.filter(e=>Math.hypot(e.x-p.col,e.row-p.row)<=2.6).sort((a,b)=>a.hp-b.hp)[0];
      if(target){damageEnemy(target,Math.round(u.attack*mult),p.type,p);flashShot(p,target);p.timer=Math.max(1.3,2.2-(p.rank-1)*.12);} else p.timer=.2;
    } else if(p.type==='bishop'){
      const targets=game.enemies.filter(e=>Math.abs(Math.abs(e.x-p.col)-Math.abs(e.row-p.row))<.72&&Math.abs(e.x-p.col)<5).slice(0,1+(p.rank>=4));
      if(targets.length){targets.forEach(e=>{damageEnemy(e,Math.round(u.attack*mult),p.type,p);flashShot(p,e)});p.timer=Math.max(1.5,2.5-(p.rank-1)*.12);}else p.timer=.2;
    } else if(p.type==='queen'){
      const targets=[p.row-1,p.row,p.row+1].filter(r=>r>=0&&r<5).map(r=>nearestLaneTarget(r,p.col,9)).filter(Boolean);
      if(targets.length){targets.forEach(e=>{damageTarget(e,Math.round(u.attack*mult),p.type,p);flashShot(p,e)});p.timer=Math.max(.85,1.5-(p.rank-1)*.1);} else p.timer=.2;
    } else if(p.type==='priest'){
      const allies=game.players.filter(a=>a!==p&&Math.hypot(a.col-p.col,a.row-p.row)<=1.55&&a.hp<a.maxHp);
      if(allies.length){const heal=Math.round(120*mult);allies.forEach(a=>healPlayer(a,heal));pulseAt(p.col+.5,p.row+.5,'heal');save.mastery.priest=(save.mastery.priest||0)+.3*allies.length;checkRanks('priest');p.timer=Math.max(2.8,4-(p.rank-1)*.12);}else p.timer=.35;
    } else if(p.type==='frost'){
      const target=nearestLaneTarget(p.row,p.col,5.5);if(target){const hit=damageTarget(target,Math.round(u.attack*mult),p.type,p);if(hit&&!target.isHazard)target.slowTimer=Math.max(target.slowTimer,3.5+(p.rank-1)*.35);fireProjectile(p.col+.5,p.row+.5,targetX(target)+.5,target.row+.5,'frost',.3);if(hit)pulseAt(targetX(target)+.5,target.row+.5,'freeze');p.timer=Math.max(1.45,2.4-(p.rank-1)*.1);}else p.timer=.2;
    } else if(p.type==='ballista'){
      let targets=combatTargetsInLane(p.row,p.col,9).sort((a,b)=>targetX(a)-targetX(b));const shieldIndex=targets.findIndex(t=>t.isHazard);if(shieldIndex>=0)targets=targets.slice(0,shieldIndex+1);
      if(targets.length){targets.forEach(e=>damageTarget(e,Math.round(u.attack*mult),p.type,p));const last=targets[targets.length-1];fireProjectile(p.col+.5,p.row+.5,targetX(last)+.7,last.row+.5,'ballista',.34);pulseAt(p.col+.5,p.row+.5,'pierce');p.timer=Math.max(2.1,3-(p.rank-1)*.12);}else p.timer=.25;
    }
  }
}
function nearestEnemy(row,col,range){ return game.enemies.filter(e=>e.row===row&&e.x>=col-.2&&e.x-col<=range).sort((a,b)=>a.x-b.x)[0]; }
function targetX(target){return target.isHazard?target.col:target.x;}
function combatTargetsInLane(row,col,range){return [...game.enemies.filter(e=>e.row===row&&e.x>=col-.25&&e.x-col<=range),...game.hazards.filter(h=>h.type==='shield'&&h.row===row&&h.col>=col&&h.col-col<=range)];}
function visibleFlatTargets(row,col,range){const targets=combatTargetsInLane(row,col,range).sort((a,b)=>targetX(a)-targetX(b)),shieldIndex=targets.findIndex(t=>t.isHazard);return shieldIndex>=0?targets.slice(0,shieldIndex+1):targets;}
function nearestLaneTarget(row,col,range){return visibleFlatTargets(row,col,range)[0];}
function damageTarget(target,amount,source,attacker){return target.isHazard?damageHazard(target,amount):damageEnemy(target,amount,source,attacker);}

function updateEnemies(dt){
  for(const e of [...game.enemies]){
    const data=ENEMIES[e.type]; e.attackTimer-=dt;e.slowTimer=Math.max(0,(e.slowTimer||0)-dt);
    if(data.reflector){e.reflectTimer-=dt;e.reflectActive=Math.max(0,(e.reflectActive||0)-dt);if(e.reflectTimer<=0){e.reflectActive=1.5;e.reflectTimer=5;pulseAt(e.x+.5,e.row+.5,'mirror');floatText(e.x+.5,e.row+.2,'镜幕!','#efb6ff');}}
    if(data.iceTrail){const trailCol=clamp(Math.floor(e.x),0,8);if(trailCol!==e.lastTrailCol){addIceHazard(e.row,trailCol);e.lastTrailCol=trailCol;}}
    if(data.teleport){
      e.teleportTimer-=dt;
      if(e.teleportTimer<=0){ const oldRow=e.row,choices=[0,1,2,3,4].filter(r=>r!==oldRow);pulseAt(e.x+.5,oldRow+.5,'teleport');e.row=choices[Math.floor(Math.random()*choices.length)];e.teleportTimer=5;pulseAt(e.x+.5,e.row+.5,'teleport');floatText(e.x+.5,e.row+.2,'换线','#e7a65c');continue; }
    }
    if(data.summoner){
      e.summonTimer-=dt;
      if(e.summonTimer<=0){ const summoned=spawnEnemy(['soldier','cannon','horse'][Math.floor(Math.random()*3)],Math.floor(Math.random()*5),.75);summoned.x=Math.min(9.2,e.x+.8);e.summonTimer=10;pulseAt(e.x+.5,e.row+.5,'bagua');toast('八卦相召来了一枚援军'); }
    }
    if(data.boss){
      e.noHitTime+=dt;e.regenTick+=dt;
      if(e.noHitTime>=1&&e.regenTick>=1&&e.hp<e.maxHp){ const ticks=Math.floor(e.regenTick);const heal=Math.min(e.maxHp-e.hp,data.regen*ticks);e.hp+=heal;e.regenTick-=ticks;floatText(e.x+.5,e.row+.15,`+${heal}`,'#cf77ad');pulseAt(e.x+.5,e.row+.5,'heal'); }
      e.summonTimer-=dt;
      if(e.summonTimer<=0){ spawnEnemy('soldier',Math.floor(Math.random()*5),.8); spawnEnemy(Math.random()>.5?'horse':'cannon',Math.floor(Math.random()*5),.8); e.summonTimer=e.hp/e.maxHp<.5?4:7; toast("紫蛇召唤了援军"); }
    }
    const laneTargets=game.players.filter(p=>p.row===e.row&&p.col<=e.x).sort((a,b)=>b.col-a.col);
    let target=laneTargets[0];
    const dist=target?e.x-target.col:99;
    if(e.type==='horse'&&!e.jumped&&target&&dist<1.35&&target.col>0){ e.x=Math.max(.1,target.col-.85); e.jumped=true; pulseAt(e.x+.5,e.row+.5,'jump'); continue; }
    if(data.cannon&&laneTargets.length>=2){
      const cannonTarget=laneTargets[1],cannonDist=e.x-cannonTarget.col;
      if(cannonDist<=5.2){ if(e.attackTimer<=0){ damagePlayer(cannonTarget,150,e);fireProjectile(e.x+.5,e.row+.5,cannonTarget.col+.5,cannonTarget.row+.5,'cannon',.38);e.attackTimer=data.rate; } continue; }
    }
    if(data.giant&&target&&dist<=.82){ if(e.attackTimer<=0){ crushPlayer(target,e);e.attackTimer=data.rate; } continue; }
    if(data.shoveler&&target&&dist<=.72){if(e.attackTimer<=0){flingPlayer(target,e);e.attackTimer=data.rate;}continue;}
    const attackRange=data.range||.62;
    if(target&&dist<=attackRange){
      if(e.attackTimer<=0){ damagePlayer(target,data.damage*(data.boss&&e.hp/e.maxHp<.5?1.45:1),e); e.attackTimer=data.rate; }
    } else {
      const aura=game.enemies.some(g=>g.type==='guard'&&g.id!==e.id&&g.row===e.row&&Math.abs(g.x-e.x)<1.4);
      e.x-=data.speed*(data.boss&&e.hp/e.maxHp<.5?1.5:1)*(aura?1.05:1)*(e.slowTimer>0?.55:1)*dt;
    }
    if(e.x<-.25){ endGame(false,"有敌军突破了最后防线"); return; }
  }
}

function damagePlayer(p,amount,enemy){
  p.hp-=amount; floatText(p.col+.5,p.row+.25,`-${Math.round(amount)}`,'#ff7b63'); pulseAt(p.col+.5,p.row+.5,enemy?.type||'enemy');
  if(p.hp<=0){
    game.players=game.players.filter(x=>x!==p);
    if(p.protectedUnit){ endGame(false,"需要保护的王棋被摧毁了"); }
  }
}
function healPlayer(p,amount){const before=p.hp;p.hp=Math.min(p.maxHp,p.hp+amount);if(p.hp>before){floatText(p.col+.5,p.row+.2,`+${Math.round(p.hp-before)}`,'#9ce6bd');pulseAt(p.col+.5,p.row+.5,'heal');}}
function crushPlayer(p,enemy){
  game.players=game.players.filter(x=>x!==p);flattenPiece(p.col+.5,p.row+.5,UNITS[p.type].symbol,'crush');floatText(p.col+.5,p.row+.15,'碾碎!','#ff735c');
  if(p.protectedUnit) endGame(false,"镇国大将砸碎了需要保护的王棋");
}
function flingPlayer(p,enemy){
  game.players=game.players.filter(x=>x!==p);flingPiece(p.col+.5,p.row+.5,UNITS[p.type].symbol);floatText(p.col+.5,p.row+.15,'铲飞!','#ffc177');
  if(p.protectedUnit)endGame(false,"掘阵卒铲飞了需要保护的王棋");
}
function damageEnemy(e,amount,source,attacker=null){
  const data=ENEMIES[e.type],mode=UNITS[source]?.attackMode;
  if(data.flatImmune&&mode==='flat'){floatText(e.x+.5,e.row+.18,'格挡','#c4b7a2');pulseAt(e.x+.5,e.row+.5,'block');return false;}
  if(data.reflector&&e.reflectActive>0&&mode!=='melee'&&mode!=='support'){
    floatText(e.x+.5,e.row+.18,'反弹!','#efb6ff');pulseAt(e.x+.5,e.row+.5,'mirror');
    if(attacker&&game.players.includes(attacker)){const reflected=Math.round(amount*.75);damagePlayer(attacker,reflected,e);fireProjectile(e.x+.5,e.row+.5,attacker.col+.5,attacker.row+.5,'reflect',.28);}return false;
  }
  const guarded=game.enemies.some(g=>g.type==='guard'&&g.id!==e.id&&g.row===e.row&&Math.abs(g.x-e.x)<1.5);
  if(guarded) amount*=.65;
  e.hp-=amount;if(data.boss){e.noHitTime=0;e.regenTick=0;} save.mastery[source]=(save.mastery[source]||0)+.04; floatText(e.x+.5,e.row+.18,`-${Math.round(amount)}`,'#ffe195'); pulseAt(e.x+.5,e.row+.5,'hit');
  if(e.hp<=0){if(data.leavesShield)leaveShieldAt(e);game.enemies=game.enemies.filter(x=>x!==e);game.kills++;save.mastery[source]=(save.mastery[source]||0)+.8;checkRanks(source);}return true;
}
function leaveShieldAt(enemy){const row=enemy.row,col=clamp(Math.round(enemy.x),0,8),existing=game.hazards.find(h=>h.type==='shield'&&h.row===row&&h.col===col);if(existing){existing.hp=existing.maxHp;}else game.hazards.push({id:++game.entityId,type:'shield',isHazard:true,blocksPlant:true,row,col,x:col,hp:6500,maxHp:6500});pulseAt(col+.5,row+.5,'shield');toast('盾山将留下了一座盾碑');}
function addIceHazard(row,col){if(!game.hazards.some(h=>h.type==='ice'&&h.row===row&&h.col===col)){game.hazards.push({id:++game.entityId,type:'ice',isHazard:true,blocksPlant:true,row,col,x:col});pulseAt(col+.5,row+.5,'ice');}}
function damageHazard(hazard,amount){if(hazard.type!=='shield')return false;hazard.hp-=amount;floatText(hazard.col+.5,hazard.row+.2,`-${Math.round(amount)}`,'#d8c9ae');pulseAt(hazard.col+.5,hazard.row+.5,'shield');if(hazard.hp<=0){game.hazards=game.hazards.filter(h=>h!==hazard);toast('盾碑已被摧毁');}return true;}
function checkRanks(type){
  const thresholds=[0,35,100,250,600], current=save.ranks[type];
  if(current<5&&save.mastery[type]>=thresholds[current]){ save.ranks[type]++; game.rankUps.push(`${UNITS[type].name}升至 ${save.ranks[type]} 阶`); persist(); toast(`${UNITS[type].name}完成升阶：${save.ranks[type]} 阶`); }
}

function flashShot(p,e){
  fireProjectile(p.col+.5,p.row+.5,targetX(e)+.5,e.row+.5,p.type,.18);
}
function fireProjectile(x,y,tx,ty,kind='gold',duration=.18){ game.projectiles.push({id:++game.entityId,x,y,tx,ty,kind,t:0,duration}); }
function updateProjectiles(dt){ game.projectiles.forEach(p=>p.t+=dt); game.projectiles=game.projectiles.filter(p=>p.t<p.duration); }

function spawnEnergyOrb(){
  if(!game||game.over) return;
  const orb=document.createElement('button'); orb.className='energy-orb'; orb.textContent='✦'; orb.style.left=`${(1+Math.random()*7)*100/9}%`; orb.style.top=`${(.5+Math.random()*4)*20}%`;
  orb.onclick=()=>{ if(!orb.isConnected)return;game.energy+=50;game.energyCollected+=50;orb.remove();updateGameHeader();floatText(4.5,2.5,'+50','#ffe78d'); };
  $("#effectLayer").append(orb); setTimeout(()=>orb.remove(),7000);
}

function renderEntities(){
  if(!game)return;
  const layer=$("#entityLayer");
  layer.innerHTML="";
  game.players.forEach(p=>{
    const u=UNITS[p.type],el=document.createElement('div');el.className=`piece player-piece player-${p.type}`;el.style.left=`${(p.col+.5)*100/9}%`;el.style.top=`${(p.row+.5)*20}%`;el.style.color=u.color;
    el.innerHTML=`<span class="piece-symbol">${u.symbol}</span><span class="hp-bar"><i style="width:${clamp(p.hp/p.maxHp*100,0,100)}%"></i></span><span class="rank-pips">${'◆'.repeat(p.rank)}</span>`;layer.append(el);
  });
  game.enemies.forEach(e=>{
    const d=ENEMIES[e.type],el=document.createElement('div');el.className=`piece enemy-piece enemy-${e.type} ${d.boss?'boss-piece':''} ${d.giant?'giant-piece':''} ${d.large?'large-piece':''} ${d.summoner?'elephant-piece':''} ${e.slowTimer>0?'slowed-piece':''} ${e.reflectActive>0?'reflecting-piece':''}`;el.style.left=`${(e.x+.5)*100/9}%`;el.style.top=`${(e.row+.5)*20}%`;
    el.innerHTML=`<span class="piece-symbol">${d.char}</span><span class="hp-bar"><i style="width:${clamp(e.hp/e.maxHp*100,0,100)}%"></i></span>`;layer.append(el);
  });
  game.hazards.forEach(h=>{const el=document.createElement('div');el.className=`board-hazard ${h.type}-hazard`;el.style.left=`${(h.col+.5)*100/9}%`;el.style.top=`${(h.row+.5)*20}%`;el.innerHTML=h.type==='shield'?`<span>盾</span><span class="hp-bar"><i style="width:${clamp(h.hp/h.maxHp*100,0,100)}%"></i></span>`:'<span>❄</span>';layer.append(el);});
  game.projectiles.forEach(p=>{ const t=p.t/p.duration,x=p.x+(p.tx-p.x)*t,y=p.y+(p.ty-p.y)*t,el=document.createElement('i');el.className=`projectile proj-${p.kind||'gold'}`;el.style.left=`${x*100/9}%`;el.style.top=`${y*20}%`;layer.append(el); });
}

function floatText(x,y,text,color){
  const el=document.createElement('span');el.className='damage-number';el.textContent=text;el.style.color=color;el.style.left=`${x*100/9}%`;el.style.top=`${y*20}%`;$("#effectLayer").append(el);setTimeout(()=>el.remove(),850);
}
function pulseAt(x,y,kind='hit'){ const el=document.createElement('i');el.className=`hit-flash effect-${kind}`;el.style.left=`${x*100/9}%`;el.style.top=`${y*20}%`;$("#effectLayer").append(el);setTimeout(()=>el.remove(),750); }
function flattenPiece(x,y,symbol,reason){ const el=document.createElement('span');el.className=`flattened-piece ${reason}`;el.textContent=symbol;el.style.left=`${x*100/9}%`;el.style.top=`${y*20}%`;$("#effectLayer").append(el);setTimeout(()=>el.remove(),1100); }
function flingPiece(x,y,symbol){const el=document.createElement('span');el.className='flung-piece';el.textContent=symbol;el.style.left=`${x*100/9}%`;el.style.top=`${y*20}%`;$("#effectLayer").append(el);setTimeout(()=>el.remove(),1200);}

function updateGameHeader(){
  if(!game)return;
  $("#energyValue").textContent=Math.floor(game.energy);
  const c=game.config;
  if(c.id==='rush'){
    $("#objectiveLabel").textContent=`剩余 ${fmtTime(c.duration-game.elapsed)}`;$("#objectiveValue").textContent=`${game.kills} / ${c.targetKills}`;$("#objectiveBar").style.width=`${clamp(game.kills/c.targetKills*100,0,100)}%`;
  } else {
    $("#objectiveLabel").textContent=`第 ${Math.max(1,game.wave)} 波 / 共 ${c.waves} 波`;$("#objectiveValue").textContent=`${Math.max(0,game.wave-1)} / ${c.waves}`;$("#objectiveBar").style.width=`${clamp(((game.wave-1)+(game.waveTarget?game.spawned/game.waveTarget:.0))/c.waves*100,0,100)}%`;
  }
}
function checkEndConditions(){
  const c=game.config;
  if(c.id==='rush'){ if(game.kills>=c.targetKills)endGame(true,"八十枚敌棋已全部击破"); else if(game.elapsed>=c.duration)endGame(false,`时间结束：击破 ${game.kills} / ${c.targetKills}`); return; }
  if(game.wave>=c.waves&&game.spawned>=game.waveTarget&&game.enemies.length===0) endGame(true,c.protect?'王棋安然无恙':'全部波次已被击退');
}

function setPause(value){ if(!game||game.over)return;game.paused=value;game.lastTime=performance.now();$("#pauseOverlay").classList.toggle('show',value); }
function quitGame(){ stopGame();$("#pauseOverlay").classList.remove('show');showScreen('homeScreen');updateHome(); }
function stopGame(){ if(game?.raf)cancelAnimationFrame(game.raf);game=null;$("#effectLayer").innerHTML='';$("#entityLayer").innerHTML=''; }

function endGame(win,reason){
  if(!game||game.over)return; game.over=true;cancelAnimationFrame(game.raf);persist();
  const snapshot={...game,players:[...game.players],enemies:[...game.enemies]};
  $("#resultEmblem").textContent=win?'♔':'♚';$("#resultEyebrow").textContent=win?'MISSION COMPLETE':'MISSION FAILED';$("#resultTitle").textContent=win?'防线守住了':'王冠军失守';$("#resultText").textContent=reason;
  $("#statKills").textContent=game.kills;$("#statEnergy").textContent=game.energyCollected;$("#statTime").textContent=fmtTime(game.elapsed);$("#rankReport").textContent=game.rankUps.length?`升阶成果 · ${game.rankUps.join(' / ')}`:'棋子熟练度已记录';
  $("#resultNext").textContent=win&&game.config.kind==='story'?'继续故事':win?'再来一局':'重新挑战';
  $("#resultNext").dataset.win=String(win);$("#resultNext").dataset.kind=game.config.kind;$("#resultNext").dataset.index=game.config.storyIndex??'';$("#resultNext").dataset.challenge=game.config.id||'';
  if(win&&game.config.kind==='story'){
    const i=game.config.storyIndex,archiveMilestones=[2,3,4,5,8,12];save.storyUnlocked=Math.max(save.storyUnlocked,Math.min(6,i+2));save.archiveUnlocked=Math.max(save.archiveUnlocked,archiveMilestones[i]);persist();updateHome();snapshot.justWonStory=i;
  }
  game.snapshot=snapshot;showScreen('resultScreen');
}

function handleResultNext(){
  if(!game)return;const snap=game.snapshot||game,win=$("#resultNext").dataset.win==='true',kind=$("#resultNext").dataset.kind,index=+($("#resultNext").dataset.index||0),challengeId=$("#resultNext").dataset.challenge;stopGame();
  if(kind==='story'&&win){
    const level=STORY[index];runDialogue(level.post,{title:`第 ${index+1} 章\n任务完成`,onDone:()=>{renderStory();showScreen('storyScreen');}});
  } else if(kind==='story'){ startStory(index); }
  else { startChallenge(CHALLENGES.find(c=>c.id===challengeId)||CHALLENGES[0]); }
}

init();
