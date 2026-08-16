const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

function dummyElement() {
  return {
    classList: { add() {}, remove() {}, toggle() {} },
    style: { setProperty() {} },
    append() {},
    remove() {},
    addEventListener() {},
    querySelectorAll() { return []; },
    innerHTML: "",
    textContent: "",
    dataset: {}
  };
}

const context = {
  console,
  setTimeout: () => 0,
  clearTimeout() {},
  requestAnimationFrame: () => 0,
  cancelAnimationFrame() {},
  performance: { now: () => 0 },
  structuredClone: value => JSON.parse(JSON.stringify(value)),
  localStorage: { getItem: () => null, setItem() {} },
  window: { scrollTo() {} },
  document: {
    querySelector: dummyElement,
    querySelectorAll: () => [],
    createElement: dummyElement
  },
  Math: Object.assign(Object.create(Math), { random: () => 0 })
};
context.globalThis = context;

const gamePath = path.join(__dirname, "..", "game.js");
const sourcePaths = [path.join(__dirname,"..","js","game-data.js"),path.join(__dirname,"..","js","growth-mode.js"),gamePath];
let source = sourcePaths.map(file=>fs.readFileSync(file,"utf8")).join("\n");
source += `
globalThis.testApi = {
  units: UNITS,
  rankTraits: RANK_TRAITS,
  rookOverload: ROOK_OVERLOAD,
  ultTraits: ULT_TRAITS,
  abilitySpecs: ABILITY_SPECS,
  boardRules: BOARD_RULES,
  enemies: ENEMIES,
  story: STORY,
  challenges: CHALLENGES,
  difficulties: DIFFICULTIES,
  battleBuffs: BATTLE_BUFFS,
  specialUnlocks: SPECIAL_UNLOCKS,
  setGame(value) { game = value; },
  getGame() { return game; },
  updateEnemies,
  updatePlayers,
  updateAbilityEvents,
  updateInfiniteUltimates,
  updateSpawning,
  spawnEnemy,
  spawnFunBatch,
  startSnakePit,
  spawnSnakePitBatch,
  spawnCustomArmy,
  createPlayer,
  damageEnemy,
  damageStatusEnemy,
  enemyFullyVisible,
  damagePlayer,
  collectEnergyBean,
  activateEnergyBean,
  placeSelected,
  normalizeCustomRoom,
  normalizeSnakeCount,
  ultimateCycleSeconds,
  unitArt,
  buildGrowthStage,
  setupGrowthBattle,
  performGrowthBattleAction,
  abilitySummary,
  growthEnemyPool,
  isUnitUnlocked,
  toggleLoadout,
  setStoryUnlocked(value) { save.storyUnlocked = value; },
  setUnlockProgress(key,value) { save.unlockProgress[key] = value; },
  setSpecialUnlocked(type,value) { save.specialUnlocked[type] = value; },
  setSelectedLoadout(value) { selectedLoadout = [...value]; },
  getSelectedLoadout() { return [...selectedLoadout]; },
  setMastery(type, value) { save.mastery[type] = value; save.ranks[type] = 1; },
  getRank(type) { return save.ranks[type]; },
  setRank(type, value) { save.ranks[type] = value; },
  setGrowthState(value) { growthState = {...value}; },
  checkRanks,
  autoCollectDelay: AUTO_COLLECT_DELAY
};`;
vm.runInNewContext(source, context, { filename: gamePath });

const api = context.testApi;
const plain = value => JSON.parse(JSON.stringify(value));
const baseGame = overrides => ({
  config: {}, enemies: [], players: [], hazards: [], projectiles: [], entityId: 20,
  wave: 1, kills: 0, mastery: {}, rankUps: [], over: false,
  ...overrides
});

assert.equal(api.units.rook.attack, 105, "我方车的平衡后基准伤害应为90–120区间中值");
assert.equal(api.units.queen.cost,450,"后应消耗450能量");
assert.equal(api.units.prismQueen.cost,550,"棱镜后应消耗550能量");
assert.equal(api.enemies.soldier.hp, 800, "普通兵卒应提高到800生命");
assert.equal(api.enemies.elephant.hp, 2800, "八卦相应提高到2800生命");
assert.equal(api.enemies.snake.hp, 65000, "紫蛇应提高到65000生命");
assert.equal(api.enemies.shieldGiant.speed,.12,"盾山将的移动速度应翻倍至0.12");
assert.equal(api.enemies.general.speed,.104,"镇国大将的移动速度应翻倍至0.104");
assert.equal(api.enemies.snake.speed,.13,"紫蛇的移动速度应从0.065翻倍至0.13");
assert.equal(api.enemies.shieldGiant.beanDrop,1,"盾山将应掉落1枚能量豆");
assert.equal(api.enemies.general.beanDrop,2,"镇国大将应掉落2枚能量豆");
assert.equal(api.enemies.snake.beanDrop,3,"紫蛇应掉落3枚能量豆");
assert.ok(Object.values(api.enemies).filter(enemy=>enemy.beanDrop).every(enemy=>enemy.beanChance===.5),"所有可掉豆敌人都应只有50%掉落概率");
const enteringSoldier={type:"soldier",row:2,x:8.2,hp:800,maxHp:800};
api.setGame(baseGame({config:{},enemies:[enteringSoldier]}));
assert.equal(api.enemyFullyVisible(enteringSoldier),false,"普通敌棋右缘尚未进入棋盘时应处于无敌状态");
assert.equal(api.damageEnemy(enteringSoldier,100,"pawn"),false,"未完全露出的敌棋应忽略直接攻击");
api.damageStatusEnemy(enteringSoldier,100,"pawn","burn");
assert.equal(enteringSoldier.hp,800,"未完全露出的敌棋也应忽略范围与持续伤害");
const entryGuardPawn={type:"pawn",row:2,col:7,hp:500,maxHp:500,timer:0,rank:1};
api.setGame(baseGame({config:{},players:[entryGuardPawn],enemies:[enteringSoldier]}));
api.updatePlayers(.1);
assert.equal(entryGuardPawn.timer,.15,"我方棋子不应把未完全露出的敌军选作攻击目标");
assert.equal(enteringSoldier.hp,800,"选敌逻辑应保证入场无敌期间不会产生攻击伤害");
enteringSoldier.x=8.1;
assert.equal(api.enemyFullyVisible(enteringSoldier),true,"普通敌棋整个圆盘进入棋盘后应解除无敌");
api.damageEnemy(enteringSoldier,100,"pawn");
assert.equal(enteringSoldier.hp,700,"完全露出的敌棋应恢复正常受击");
const enteringSnake={type:"snake",row:2,x:8,hp:65000,maxHp:65000};
assert.equal(api.enemyFullyVisible(enteringSnake),false,"紫蛇应按更大的首领圆盘计算完全入场位置");
enteringSnake.x=7.9;
assert.equal(api.enemyFullyVisible(enteringSnake),true,"紫蛇整个圆盘进入棋盘后应解除无敌");
assert.equal(api.autoCollectDelay,1500,"能量球与能量豆应在1.5秒后自动领取");
assert.ok(api.story.every(level => level.energy === 75), "全部故事关应从75能量开始");
assert.ok(api.challenges.filter(level=>!level.fun).every(level => level.energy === 75), "全部常规挑战应从75能量开始");
assert.equal(api.challenges.length,10,"开始对战应提供六种常规玩法和四种趣味玩法");
assert.equal(api.challenges.filter(level=>level.fun).length,4,"应提供四种高能量或无限能量趣味关卡");
assert.ok(api.challenges.filter(level=>level.fun).every(level=>level.noCooldown&&level.setupPhase),"趣味关卡应允许无冷却布阵并由玩家手动开始敌潮");
assert.ok(api.challenges.filter(level=>level.fun&&!level.snakePit).every(level=>level.funBatch===100),"原有三种趣味关卡都应在开战时一次投放100名敌军");
const snakePit=api.challenges.find(level=>level.id==="snakePit");
assert.ok(snakePit.snakePit&&snakePit.infiniteEnergy&&snakePit.noCooldown&&snakePit.setupPhase,"万蛇窟应使用无限能量、无冷却、先布阵规则");
assert.equal(api.normalizeSnakeCount(49),100,"万蛇窟蛇数不得低于100");
assert.equal(api.normalizeSnakeCount(956),1000,"万蛇窟蛇数应按100取整并封顶1000");
api.setGame(baseGame({config:snakePit,enemies:[],players:[],entityId:0,wave:0,spawned:0,waveTarget:0,nextWave:0,nextSpawn:0}));
assert.equal(api.startSnakePit(1000),1000,"万蛇窟应记录玩家选择的1000条紫蛇总数");
assert.ok(api.getGame().enemies.length<=40&&api.getGame().enemies.every(enemy=>enemy.type==="snake"),"万蛇窟应只生成紫蛇并限制同屏实体数量");
assert.equal(api.getGame().waveTarget,1000,"万蛇窟应以完整蛇潮总量作为通关目标");
const infiniteQueen={id:301,type:"queen",row:2,col:1,hp:900,maxHp:900,timer:0,rank:1};
api.setGame(baseGame({config:{snakePit:true},players:[infiniteQueen],enemies:[],abilityEvents:[],energy:0,energyCollected:0,beans:0,preparing:false}));
api.updateInfiniteUltimates(0);
assert.equal(api.getGame().abilityEvents.length,15,"万蛇窟中的后应立即排入15发普通弹");
assert.equal(api.ultimateCycleSeconds(infiniteQueen),1.5,"后的无限大招应每1.5秒循环一次");
assert.equal(api.getGame().beans,0,"自动无限大招不应要求或消耗能量豆");
assert.ok(infiniteQueen.ultimateIntroShown&&infiniteQueen.ultGlowTimer>=1.5,"无限大招首次释放后应记录开场演出并点亮所在棋格");
api.getGame().abilityEvents=[];infiniteQueen.infiniteUltTimer=0;api.updateInfiniteUltimates(.01);
assert.equal(api.getGame().abilityEvents.length,15,"后在后续周期仍应重新发射15发，不受开场演出是否重复影响");
const normalizedRoom=api.normalizeCustomRoom({enemies:[{type:"general",count:150,row:3},{type:"missing",count:5,row:0}],units:[{type:"iceBishop",rank:8},{type:"rook",rank:3}]});
assert.deepEqual(plain(normalizedRoom.enemies),[{type:"general",count:100,row:3}],"自定义房间应校验敌军种类、单队数量和出兵行");
assert.deepEqual(plain(normalizedRoom.units),[{type:"iceBishop",rank:5},{type:"rook",rank:3}],"自定义房间应为每种我方棋子保存独立1–5阶设置");
api.setGame(baseGame({config:{customRanks:{rook:5}},enemies:[],players:[],entityId:0,wave:0,spawned:0,waveTarget:0,nextWave:0}));
assert.equal(api.createPlayer("rook",2,1).rank,5,"自定义房间的临时阶位必须传入正式棋子实体");
const customTotal=api.spawnCustomArmy([{type:"soldier",count:3,row:1},{type:"cannon",count:5,row:-1}]);
assert.equal(customTotal,8,"自定义房间应按配置生成全部敌军");
assert.equal(api.getGame().enemies.filter(enemy=>enemy.type==="soldier"&&enemy.row===1).length,3,"指定行的敌军必须全部从该行出现");
assert.deepEqual(plain(api.getGame().enemies.filter(enemy=>enemy.type==="cannon").map(enemy=>enemy.row)),[0,1,2,3,4],"随机行队伍应均匀散布到五条路线");
assert.deepEqual(plain(Object.keys(api.difficulties)),["novice","standard","elite","nightmare"],"每种玩法应提供四档难度");
assert.deepEqual(plain(Object.keys(api.battleBuffs)),["reserve","power","haste","logistics","bean"],"每场战斗前应提供五种互斥增益");
const scoreAttack=api.challenges.find(challenge=>challenge.id==="rush");
assert.equal(scoreAttack.duration,120,"计分赛时长应为120秒");
assert.equal(scoreAttack.targetKills,undefined,"计分赛不应再设置80杀通关目标");
assert.equal(scoreAttack.scoreAttack,true,"百二十秒模式应按时间内击杀数计分");
assert.ok(api.growthEnemyPool("spearPawn").includes("digger")&&api.growthEnemyPool("bishop").includes("elephant"),"成长演示应按我方棋子特性安排不同敌军，不得全部使用兵卒");
assert.deepEqual(plain(Object.keys(api.units)), ["pawn","rook","king","knight","shieldPawn","spearPawn","bishop","twinRook","queen","iceRook","stormKnight","twinBishop","flameRook","royalKing","poisonRook","prismQueen","frostKnight","poisonBishop","twinQueen","iceBishop","flameBishop","shieldKing"], "应保留原有棋子并新增双后、冰象等六种衍生棋");
assert.ok(Object.values(api.units).every(unit => !Object.hasOwn(unit,"symbol")), "我方棋子数据不应再依赖Unicode棋子字形");
assert.ok(api.unitArt("rook").includes("art-rook") && !/[\u2654-\u265f]/.test(api.unitArt("rook")), "棋子应输出自绘CSS结构");
assert.ok(Object.keys(api.units).every(type => api.rankTraits[type]?.length === 5), "成长之路应为每枚棋子提供完整的1–5阶演示资料");
assert.equal(new Set(Object.values(api.rankTraits).map(route=>JSON.stringify(route))).size,Object.keys(api.units).length,"每枚棋子必须拥有不同的五阶成长路线，不能复用同一模板");
assert.ok(api.rankTraits.twinRook[3][0].includes("换线")&&api.rankTraits.iceRook[1][0].includes("净化")&&api.rankTraits.queen[2][0].includes("五线"),"成长路线应包含跨路支援、环境互动与五线调度等非惯式质变");
assert.ok(!source.includes("const LEGACY_RANK_TRAITS = {")&&source.includes("五阶不再默认绑定阵亡效果"),"不得保留旧的统一散射、分裂、破阵、阵亡遗技成长模板");
assert.ok(Object.keys(api.units).every(type => api.ultTraits[type]?.length === 2), "成长之路应为每枚棋子提供能量豆大招资料");
assert.equal(`${api.boardRules.rows}×${api.boardRules.cols}`,"5×9","成长演示与正式战斗应共用5×9棋盘规则");
assert.ok(api.abilitySummary("rook").includes("15发")&&api.abilitySummary("rook").includes("90–120"),"成长演示参数说明应直接读取车的大招实战配置");

api.setStoryUnlocked(1);
assert.deepEqual(plain(Object.keys(api.units).filter(api.isUnitUnlocked)), ["pawn","rook","king"], "初始应只解锁兵、车、王");
api.setStoryUnlocked(3);
assert.ok(api.isUnitUnlocked("bishop") && api.isUnitUnlocked("twinRook") && api.isUnitUnlocked("spearPawn"), "第3章应解锁象、双车与投矛兵");
api.setStoryUnlocked(6);
assert.ok(api.isUnitUnlocked("poisonRook") && api.isUnitUnlocked("prismQueen"), "第6章应解锁毒车与棱镜后");
assert.ok(!api.isUnitUnlocked("twinQueen")&&!api.isUnitUnlocked("iceBishop"),"秘藏衍生棋不能仅靠故事推进解锁");
assert.equal(api.specialUnlocks.twinQueen.description,"在同一局战斗中部署2枚后","双后应拥有可执行的同局部署条件");
api.setUnlockProgress("iceSculptures",12);
assert.ok(api.isUnitUnlocked("iceBishop"),"累计制造12次冰雕后应解锁冰象");
api.setSpecialUnlocked("twinQueen",true);
assert.ok(api.isUnitUnlocked("twinQueen"),"达成特殊条件后双后应进入可用状态");
api.setSelectedLoadout(["pawn","rook","king","knight","bishop","twinRook"]);
api.toggleLoadout("queen");
assert.equal(api.getSelectedLoadout().length, 6, "每场编队不得超过6种棋子");

api.setGame(baseGame({config:{difficultyData:api.difficulties.elite},wave:1}));
const eliteSoldier=api.spawnEnemy("soldier",2);
assert.equal(eliteSoldier.hp,1080,"精英难度应把敌军生命提高到1.35倍");
const eliteStartX=eliteSoldier.x;eliteSoldier.attackTimer=2;
api.updateEnemies(.1);
assert.ok(eliteSoldier.x<eliteStartX-.019,"精英难度应实际提高敌军移动速度");

const escapedPreview={type:"soldier",row:0,x:-.3,hp:800,maxHp:800,attackTimer:2,slowTimer:0,burnTimer:0,poisonTimer:0,vulnerableTimer:0,statusTick:0};
api.setGame(baseGame({preview:true,enemies:[escapedPreview],config:{}}));
api.updateEnemies(.1);
assert.equal(api.getGame().over,true,"成长演示被突破时只能结束当前演示轮");
assert.equal(api.getGame().enemies.length,1,"成长演示被突破不得进入正式战败结算并改写战场实体");

api.setGame(baseGame({config:{theme:"giantFun",difficultyData:api.difficulties.standard},wave:0,spawned:0,waveTarget:0,nextWave:999}));
api.spawnFunBatch(100);
assert.equal(api.getGame().enemies.length,100,"趣味关卡按钮应一次性创建100名敌军");
assert.equal(api.getGame().spawned,100,"趣味关卡应把整批100名敌军记为已投放");
assert.ok(api.getGame().enemies.every(enemy=>enemy.type==="shieldGiant"||enemy.type==="general"),"无限巨人类关卡的100名敌军应基本全为盾山将和镇国大将");

const powerTarget={type:"soldier",row:1,x:5,hp:1000,maxHp:1000};
api.setGame(baseGame({config:{buffData:api.battleBuffs.power},enemies:[powerTarget]}));
api.damageEnemy(powerTarget,100,"pawn");
assert.equal(powerTarget.hp,885,"锋刃军令应把我方伤害提高15%");

const hastePawn={type:"pawn",row:2,col:1,hp:500,maxHp:500,timer:0,rank:1};
const hasteTarget={type:"soldier",row:2,x:2.5,hp:800,maxHp:800};
api.setGame(baseGame({config:{buffData:api.battleBuffs.haste},players:[hastePawn],enemies:[hasteTarget]}));
api.updatePlayers(.1);
assert.equal(hastePawn.timer,.75,"疾行号角应使兵的0.9秒攻击间隔提高20%至0.75秒");

const chariot = { type: "chariot", row: 0, x: 6, hp: 2000, maxHp: 2000, attackTimer: 1, teleportTimer: 0 };
api.setGame(baseGame({ enemies: [chariot] }));
api.updateEnemies(.1);
assert.equal(chariot.row, 1, "敌車计时结束后应切换到其它路线");
assert.equal(chariot.teleportTimer, 5, "敌車换线计时应重置为5秒");

const front = { type: "pawn", row: 0, col: 4, hp: 500, maxHp: 500 };
const behind = { type: "king", row: 0, col: 2, hp: 800, maxHp: 800 };
const cannon = { type: "cannon", row: 0, x: 6, hp: 700, maxHp: 700, attackTimer: 0 };
api.setGame(baseGame({ enemies: [cannon], players: [front, behind] }));
api.updateEnemies(.1);
assert.equal(front.hp, 500, "炮架棋子不应受到隔子炮伤害");
assert.equal(behind.hp, 650, "隔子炮应对后方第二枚棋子造成150伤害");

const elephant = { type: "elephant", row: 2, x: 5, hp: 1500, maxHp: 1500, attackTimer: 1, summonTimer: 0 };
api.setGame(baseGame({ enemies: [elephant] }));
api.updateEnemies(.1);
assert.equal(api.getGame().enemies.length, 2, "八卦相应召唤一枚援军");

const tank = { type: "rook", row: 3, col: 4, hp: 999999, maxHp: 999999 };
const general = { type: "general", row: 3, x: 4.5, hp: 22000, maxHp: 22000, attackTimer: 0 };
api.setGame(baseGame({ enemies: [general], players: [tank] }));
api.updateEnemies(.1);
assert.equal(api.getGame().players.length, 0, "大将应无视生命值直接碾碎接触的棋子");

const snake = { type: "snake", row: 2, x: 7, hp: 64900, maxHp: 65000, attackTimer: 1, summonTimer: 9, noHitTime: .95, regenTick: .95 };
api.setGame(baseGame({ enemies: [snake] }));
api.updateEnemies(.1);
assert.equal(snake.hp, 65000, "紫蛇未受击满1秒后应回复100生命");
api.damageEnemy(snake, 10, "pawn");
assert.equal(snake.noHitTime, 0, "紫蛇受击后应重置脱战回血计时");

api.setMastery("pawn", 34.9);
api.checkRanks("pawn");
assert.equal(api.getRank("pawn"), 1, "35熟练度以前不应升到2阶");
api.setMastery("pawn", 35);
api.checkRanks("pawn");
assert.equal(api.getRank("pawn"), 2, "2阶门槛应为35熟练度");

const twinRook = { type: "twinRook", row: 1, col: 1, hp: 1100, maxHp: 1100, timer: 0, rank: 1 };
const doubleTarget = { type: "soldier", row: 1, x: 5, hp: 800, maxHp: 800 };
api.setGame(baseGame({ players: [twinRook], enemies: [doubleTarget] }));
api.updatePlayers(.1);
assert.equal(doubleTarget.hp, 640, "双车每轮应连发两枚80伤害的车弹");
assert.equal(twinRook.timer,1.25,"双车平衡后应提高到每1.25秒攻击一次");
assert.equal(api.getGame().projectiles[0].y,api.getGame().projectiles[1].y,"双车两弹应在同一水平弹道，不得上下竖排");
assert.ok(api.getGame().projectiles[0].x>api.getGame().projectiles[1].x&&api.getGame().projectiles[0].tx>api.getGame().projectiles[1].tx,"双车两弹应一前一后紧邻飞行");
assert.ok(api.getGame().projectiles[0].x-api.getGame().projectiles[1].x>=.55,"双车两弹之间应留出清晰空隙，不得视觉连体");

const iceRook = { type: "iceRook", row: 2, col: 1, hp: 1000, maxHp: 1000, timer: 0, rank: 1 };
const frozenEnemy = { type: "soldier", row: 2, x: 5, hp: 800, maxHp: 800, slowTimer: 0 };
api.setGame(baseGame({ players: [iceRook], enemies: [frozenEnemy] }));
api.updatePlayers(.1);
assert.equal(frozenEnemy.hp, 725, "冰车应造成75伤害");
assert.ok(frozenEnemy.slowTimer >= 3.5, "冰车应施加减速状态");

const flameRook = { type: "flameRook", row: 3, col: 1, hp: 1050, maxHp: 1050, timer: 0, rank: 1 };
const burningEnemy = { type: "soldier", row: 3, x: 5, hp: 800, maxHp: 800, burnTimer: 0, poisonTimer: 0, statusTick: 0, slowTimer: 0, attackTimer: 2 };
api.setGame(baseGame({ players: [flameRook], enemies: [burningEnemy] }));
api.updatePlayers(.1);
assert.equal(burningEnemy.hp, 705, "焰车的首发应造成95伤害");
burningEnemy.statusTick = .95;
api.updateEnemies(.1);
assert.equal(burningEnemy.hp, 665, "焰车应每秒追加40点燃烧伤害");

const poisonRook = { type: "poisonRook", row: 4, col: 1, hp: 1050, maxHp: 1050, timer: 0, rank: 1 };
const poisonedEnemy = { type: "soldier", row: 4, x: 5, hp: 800, maxHp: 800, burnTimer: 0, poisonTimer: 0, statusTick: 0, slowTimer: 0, attackTimer: 2 };
api.setGame(baseGame({ players: [poisonRook], enemies: [poisonedEnemy] }));
api.updatePlayers(.1);
assert.equal(poisonedEnemy.hp, 740, "毒车的首发应造成60伤害");
poisonedEnemy.statusTick = .95;
api.updateEnemies(.1);
assert.equal(poisonedEnemy.hp, 710, "毒车应每秒追加30点中毒伤害");

const shieldPawn={type:"shieldPawn",row:0,col:1,hp:1100,maxHp:1100,timer:1,rank:1};
api.setGame(baseGame({players:[shieldPawn]}));
api.damagePlayer(shieldPawn,200,{type:"soldier"});
assert.equal(shieldPawn.hp,980,"盾兵应减免40%受到的伤害");

const spearPawn={type:"spearPawn",row:0,col:1,hp:450,maxHp:450,timer:0,rank:1};
const spearDigger={type:"digger",row:0,x:5,hp:2200,maxHp:2200};
api.setGame(baseGame({players:[spearPawn],enemies:[spearDigger]}));
api.updatePlayers(.1);
assert.equal(spearDigger.hp,2125,"投矛兵应以75伤害弧线攻击掘阵卒");
assert.ok(spearPawn.weaponHidden>0,"投矛时棋子手上的矛应暂时消失");
assert.equal(api.getGame().projectiles[0].kind,"spearPawn","投矛兵应抛出自己手上的矛，而不是普通炮弹");
assert.ok(api.getGame().projectiles[0].duration>=.46,"子弹飞行应放慢以便看清弹道");

const stormKnight={type:"stormKnight",row:1,col:1,hp:700,maxHp:700,timer:0,rank:1};
const stormMain={type:"soldier",row:1,x:3,hp:800,maxHp:800};
const stormChain={type:"soldier",row:2,x:4,hp:800,maxHp:800};
api.setGame(baseGame({players:[stormKnight],enemies:[stormMain,stormChain]}));
api.updatePlayers(.1);
assert.equal(stormMain.hp,650,"雷马主目标应受到150伤害");
assert.equal(stormChain.hp,740,"雷马应链击邻近敌棋60伤害");

const twinBishop={type:"twinBishop",row:2,col:1,hp:700,maxHp:700,timer:0,rank:1};
const diagonalA={type:"soldier",row:0,x:3,hp:800,maxHp:800};
const diagonalB={type:"soldier",row:4,x:3,hp:800,maxHp:800};
api.setGame(baseGame({players:[twinBishop],enemies:[diagonalA,diagonalB]}));
api.updatePlayers(.1);
assert.equal(diagonalA.hp,665,"双象应以135伤害命中第一枚对角线敌棋");
assert.equal(diagonalB.hp,665,"双象应同时命中第二枚对角线敌棋");

const royalKing={type:"royalKing",row:2,col:1,hp:900,maxHp:900,timer:0,rank:1};
api.setGame(baseGame({players:[royalKing],energy:0,energyCollected:0}));
api.updatePlayers(.1);
assert.equal(api.getGame().energy,45,"金王应每轮生产45能量");

const prismQueen={type:"prismQueen",row:2,col:1,hp:850,maxHp:850,timer:0,rank:1};
const prismTargets=Array.from({length:5},(_,row)=>({type:"soldier",row,x:5,hp:800,maxHp:800}));
const prismRear={type:"soldier",row:2,x:7,hp:800,maxHp:800};
api.setGame(baseGame({players:[prismQueen],enemies:[...prismTargets,prismRear]}));
api.updatePlayers(.1);
assert.equal(prismTargets[0].hp,800,"棱镜后不应再攻击相邻三路之外的第1路");
assert.equal(prismTargets[4].hp,800,"棱镜后不应再攻击相邻三路之外的第5路");
assert.ok(prismTargets.slice(1,4).every(enemy=>enemy.hp===750),"棱镜后应对相邻三路各造成50穿透伤害");
assert.equal(prismRear.hp,750,"棱镜后应穿透前排并命中同路后方敌军");
assert.equal(prismQueen.timer,.8,"棱镜后应每0.8秒发射一次棱光");

const queen={type:"queen",row:2,col:1,hp:900,maxHp:900,timer:0,rank:1};
const queenTargets=[1,2,3].map(row=>({type:"soldier",row,x:5,hp:800,maxHp:800}));
api.setGame(baseGame({players:[queen],enemies:queenTargets}));
api.updatePlayers(.1);
assert.ok(queenTargets.every(enemy=>enemy.hp===710),"后应像三台车一样向相邻三路各发一枚90伤害普通炮弹");
assert.equal(api.getGame().projectiles.length,3,"后每轮应生成三枚普通炮弹");
assert.ok(api.getGame().projectiles.every(projectile=>projectile.kind==="rook"),"后的弹体必须使用普通车弹而不是圣光");
assert.equal(queen.timer,1.2,"后应提高到每1.2秒攻击一次");

const twinQueen={type:"twinQueen",row:2,col:1,hp:950,maxHp:950,timer:0,rank:1};
const twinQueenTargets=[1,2,3].map(row=>({type:"soldier",row,x:5,hp:800,maxHp:800}));
api.setGame(baseGame({players:[twinQueen],enemies:twinQueenTargets}));
api.updatePlayers(.1);
assert.ok(twinQueenTargets.every(enemy=>enemy.hp===660),"双后应向三路各连续发射两枚70伤害炮弹");
assert.equal(api.getGame().projectiles.length,6,"双后每轮应生成六枚可见炮弹");
for(let i=0;i<6;i+=2){assert.equal(api.getGame().projectiles[i].y,api.getGame().projectiles[i+1].y,"双后每路两弹应保持水平紧邻");assert.ok(api.getGame().projectiles[i].x-api.getGame().projectiles[i+1].x>=.55,"双后的双弹应水平分开且不得视觉连体");}

const awakenedRook={id:501,type:"rook",row:2,col:1,hp:1200,maxHp:1200,timer:0,rank:5,storedShots:0};
const awakenedTarget={type:"soldier",row:2,x:5,hp:5000,maxHp:5000};
api.setGame(baseGame({players:[awakenedRook],enemies:[awakenedTarget],abilityEvents:[]}));
api.updatePlayers(.1);
assert.equal(api.getGame().abilityEvents.length,api.rookOverload.shots-1,"车5阶20%判定成功时，本发应改为共4发普通车弹");
for(let i=0;i<3;i++)api.updateAbilityEvents(.081);
assert.equal(api.getGame().projectiles.length,api.rookOverload.shots,"车的4连射应产生4枚普通弹体");
assert.ok(api.getGame().projectiles.every(projectile=>projectile.kind==="rook"),"4连射不应使用专属弹体");
assert.ok(!source.includes("五阶连击")&&!api.rankTraits.rook[4][1].includes("追加"),"4连射不应显示专属连击标注或使用“追加”描述");
context.Math.random=()=>.2;const quietTarget={type:"soldier",row:2,x:5,hp:1000,maxHp:1000};awakenedRook.timer=0;api.setGame(baseGame({players:[awakenedRook],enemies:[quietTarget],abilityEvents:[]}));api.updatePlayers(.1);assert.equal(api.getGame().abilityEvents.length,0,"车5阶4连射应严格按20%概率判定");context.Math.random=()=>0;

const iceBishop={type:"iceBishop",row:2,col:1,hp:680,maxHp:680,timer:0,rank:1};
const iceBishopTarget={type:"soldier",row:3,x:2,hp:800,maxHp:800,slowTimer:0,frozenTimer:0};
api.setGame(baseGame({players:[iceBishop],enemies:[iceBishopTarget]}));
for(let i=0;i<3;i++){iceBishop.timer=0;api.updatePlayers(.1);}
assert.equal(iceBishopTarget.hp,515,"冰象应按实战参数连续造成三次95伤害");
assert.ok(iceBishopTarget.frozenTimer>0&&iceBishopTarget.slowTimer>0,"冰象三次命中同一目标后应真正冻结它");

api.setSpecialUnlocked("twinQueen",false);
api.setGame(baseGame({config:{loadout:["queen"]},selected:"queen",energy:1000,energyCollected:1000,cooldowns:{queen:0},used:{},abilityEvents:[],beanDrops:[]}));
api.placeSelected(1,1);api.getGame().cooldowns.queen=0;api.placeSelected(2,1);
assert.ok(api.isUnitUnlocked("twinQueen"),"同局实际部署两枚后时应立即解锁双后");

const edgePrism={type:"prismQueen",row:0,col:1,hp:850,maxHp:850,timer:0,rank:1};
const edgeTargets=[0,1,2,3].map(row=>({type:"soldier",row,x:5,hp:800,maxHp:800}));
api.setGame(baseGame({players:[edgePrism],enemies:edgeTargets}));
api.updatePlayers(.1);
assert.ok(edgeTargets.slice(0,3).every(enemy=>enemy.hp===750)&&edgeTargets[3].hp===800,"棱镜后部署在边路时也必须向棋盘内偏移并保持完整三路");

const beanPrism={type:"prismQueen",row:2,col:1,hp:850,maxHp:850,timer:1,rank:1,id:81};
const beanPrismFront=[1,2,3].map(row=>({id:90+row,type:"soldier",row,x:4,hp:2000,maxHp:2000}));
const beanPrismRear=[1,2,3].map(row=>({id:100+row,type:"soldier",row,x:7,hp:2000,maxHp:2000}));
api.setGame(baseGame({preview:true,players:[beanPrism],enemies:[...beanPrismFront,...beanPrismRear],abilityEvents:[],energy:0,energyCollected:0}));
api.activateEnergyBean(beanPrism,{preview:true});
for(let i=0;i<16;i++)api.updateAbilityEvents(.11);
assert.ok([...beanPrismFront,...beanPrismRear].every(enemy=>enemy.hp===1250),"棱镜后大招也应只用三路50伤害穿透棱光，不得恢复五路高伤害");

const beanQueen={type:"queen",row:2,col:1,hp:900,maxHp:900,timer:1,rank:1,id:82};
const beanQueenFront=[1,2,3].map(row=>({id:110+row,type:"soldier",row,x:4,hp:2000,maxHp:2000}));
const beanQueenRear=[1,2,3].map(row=>({id:120+row,type:"soldier",row,x:7,hp:2000,maxHp:2000}));
api.setGame(baseGame({preview:true,players:[beanQueen],enemies:[...beanQueenFront,...beanQueenRear],abilityEvents:[],energy:0,energyCollected:0}));
api.activateEnergyBean(beanQueen,{preview:true});
for(let i=0;i<16;i++)api.updateAbilityEvents(.11);
assert.ok(beanQueenFront.every(enemy=>enemy.hp===650),"后大招应在三路各连发15枚90伤害普通车弹");
assert.ok(beanQueenRear.every(enemy=>enemy.hp===2000),"后的普通车弹不应获得棱镜穿透能力");

api.setGame(baseGame({config:{featured:"elephant",waves:5},wave:2,spawned:0,waveTarget:8,nextSpawn:0,nextWave:3}));
api.updateSpawning(.1);
assert.equal(api.getGame().enemies[0].type,"elephant","八卦迷阵第2波应保证首枚敌相登场");

const flatShooter={type:"rook",row:0,col:1,hp:1200,maxHp:1200,timer:1,rank:1};
const digger={type:"digger",row:0,x:5,hp:2200,maxHp:2200,attackTimer:1};
api.setGame(baseGame({players:[flatShooter],enemies:[digger]}));
api.damageEnemy(digger,200,"rook",flatShooter);
assert.equal(digger.hp,2200,"掘阵卒应完全格挡平射伤害");
api.damageEnemy(digger,300,"bishop");
assert.equal(digger.hp,1900,"象的弧线攻击应能伤害掘阵卒");

const mirrorShooter={type:"rook",row:1,col:1,hp:1200,maxHp:1200,timer:1,rank:1};
const jester={type:"jester",row:1,x:5,hp:2400,maxHp:2400,attackTimer:1,reflectActive:1};
api.setGame(baseGame({players:[mirrorShooter],enemies:[jester]}));
api.damageEnemy(jester,200,"rook",mirrorShooter);
assert.equal(jester.hp,2400,"镜幕期间镜戏丑不应受到远程伤害");
assert.equal(mirrorShooter.hp,1050,"镜幕应把75%的伤害反弹给攻击者");

const shieldGiant={type:"shieldGiant",row:2,x:4.2,hp:50,maxHp:14000,attackTimer:1};
api.setGame(baseGame({enemies:[shieldGiant]}));
api.damageEnemy(shieldGiant,100,"bishop");
assert.equal(api.getGame().hazards[0].type,"shield","盾山将死亡后应留下盾碑");
assert.equal(api.getGame().hazards[0].hp,6500,"盾碑应拥有6500生命");
assert.equal(api.getGame().beanDrops.length,1,"盾山将死亡位置应出现1枚可拾取能量豆");
const droppedBean=api.getGame().beanDrops[0];
api.collectEnergyBean(droppedBean);
assert.equal(api.getGame().beans,1,"拾取后能量豆库存应增加1");
assert.equal(api.getGame().beanDrops.length,0,"拾取后场上能量豆应消失");

context.Math.random=()=>.75;
const noDropGiant={type:"shieldGiant",row:1,x:4.2,hp:50,maxHp:14000,attackTimer:1};
api.setGame(baseGame({enemies:[noDropGiant]}));
api.damageEnemy(noDropGiant,100,"bishop");
assert.equal(api.getGame().beanDrops?.length||0,0,"50%判定失败时强敌不应掉落能量豆");
context.Math.random=()=>0;

const beanKing={type:"king",row:2,col:1,hp:500,maxHp:800,timer:1,rank:1};
api.setGame(baseGame({config:{loadout:["king"]},players:[beanKing],selected:"bean",beans:1,beanDrops:[],energy:0,energyCollected:0}));
api.placeSelected(2,1);
assert.equal(api.getGame().beans,0,"发动爆发技应消耗1枚能量豆");
assert.equal(api.getGame().energy,500,"王的能量豆技能应立即生产500能量");
assert.equal(beanKing.hp,800,"王发动能量豆后应恢复全部生命");

const beanRook={type:"rook",row:2,col:2,hp:1200,maxHp:1200,timer:1,rank:1};
const beanLaneEnemy={type:"soldier",row:2,x:6,hp:5000,maxHp:5000};
const beanColumnEnemy={type:"soldier",row:4,x:2.2,hp:1000,maxHp:1000};
api.setGame(baseGame({config:{loadout:["rook"]},players:[beanRook],enemies:[beanLaneEnemy,beanColumnEnemy],selected:"bean",beans:1,beanDrops:[],abilityEvents:[],energy:0,energyCollected:0}));
api.placeSelected(2,2);
for(let i=0;i<16;i++)api.updateAbilityEvents(.11);
assert.equal(beanLaneEnemy.hp,3650,"车的能量豆技能应在1.5秒内连发15枚90伤害炮弹");
assert.equal(beanColumnEnemy.hp,1000,"车的能量豆连发应沿当前横行攻击");

const beanPawn={type:"pawn",row:1,col:2,hp:500,maxHp:500,timer:1,rank:1};
const crackEnemyA={type:"soldier",row:1,x:3.2,hp:1000,maxHp:1000};
const crackEnemyB={type:"soldier",row:1,x:4.7,hp:1000,maxHp:1000};
const crackEnemySafe={type:"soldier",row:1,x:5.2,hp:1000,maxHp:1000};
api.setGame(baseGame({config:{loadout:["pawn"]},players:[beanPawn],enemies:[crackEnemyA,crackEnemyB,crackEnemySafe],selected:"bean",beans:1,beanDrops:[],abilityEvents:[],energy:0,energyCollected:0}));
api.placeSelected(1,2);
assert.equal(crackEnemyA.hp,500,"兵的能量豆地裂应伤害前方第1格敌人500点");
assert.equal(crackEnemyB.hp,500,"兵的能量豆地裂应伤害前方第2格敌人500点");
assert.equal(crackEnemySafe.hp,1000,"兵的能量豆地裂不应超过前方2格");

const beanIce={type:"iceRook",row:1,col:1,hp:1000,maxHp:1000,timer:1,rank:1};
const beanIceEnemy={type:"soldier",row:1,x:5,hp:5000,maxHp:5000,slowTimer:0};
api.setGame(baseGame({config:{loadout:["iceRook"]},players:[beanIce],enemies:[beanIceEnemy],hazards:[],selected:"bean",beans:1,beanDrops:[],abilityEvents:[],energy:0,energyCollected:0}));
api.placeSelected(1,1);
assert.equal(beanIceEnemy.hp,4900,"冰车大招铺冰时应无法避免地造成100伤害");
assert.equal(api.getGame().hazards.filter(h=>h.type==="ice").length,7,"冰车大招应冻结自己前方所有棋格");
for(let i=0;i<16;i++)api.updateAbilityEvents(.11);
assert.equal(beanIceEnemy.hp,3775,"冰车铺冰后应连发15枚75伤害冰炮弹");

const beanFlame={type:"flameRook",row:2,col:1,hp:1050,maxHp:1050,timer:1,rank:1};
const beanFlameEnemy={type:"soldier",row:2,x:5,hp:5000,maxHp:5000,burnTimer:0};
api.setGame(baseGame({config:{loadout:["flameRook"]},players:[beanFlame],enemies:[beanFlameEnemy],selected:"bean",beans:1,beanDrops:[],abilityEvents:[],energy:0,energyCollected:0}));
api.placeSelected(2,1);for(let i=0;i<16;i++)api.updateAbilityEvents(.11);
assert.equal(beanFlameEnemy.hp,3575,"焰车大招应连发15枚95伤害火炮弹");
assert.equal(beanFlameEnemy.burnTimer,3,"焰车大招炮弹应保留燃烧效果");

const beanPoison={type:"poisonRook",row:3,col:1,hp:1050,maxHp:1050,timer:1,rank:1};
const beanPoisonEnemyA={type:"soldier",row:3,x:4,hp:3000,maxHp:3000};
const beanPoisonEnemyB={type:"soldier",row:3,x:7,hp:3000,maxHp:3000};
api.setGame(baseGame({config:{loadout:["poisonRook"]},players:[beanPoison],enemies:[beanPoisonEnemyA,beanPoisonEnemyB],selected:"bean",beans:1,beanDrops:[],abilityEvents:[],energy:0,energyCollected:0}));
api.placeSelected(3,1);
assert.equal(beanPoisonEnemyA.hp,1500,"巨型毒球应对碰到的敌人造成1500伤害");
assert.equal(beanPoisonEnemyB.hp,1500,"巨型毒球应顺地面穿过整行");
assert.equal(api.getGame().projectiles[0].kind,"giantPoison","毒车大招应生成沿地面滚动的巨型毒球");

const iceChariot={type:"iceChariot",row:3,x:7.2,hp:6500,maxHp:6500,attackTimer:1,lastTrailCol:null};
api.setGame(baseGame({enemies:[iceChariot]}));
api.updateEnemies(.1);
assert.equal(api.getGame().hazards[0].type,"ice","霜辙车经过的格子应转为冰面");
assert.equal(api.getGame().hazards[0].col,7,"冰面应出现在霜辙车经过的棋格");

const shoveVictim={type:"pawn",row:4,col:3,hp:500,maxHp:500,rank:1};
const closeDigger={type:"digger",row:4,x:3.6,hp:2200,maxHp:2200,attackTimer:0};
api.setGame(baseGame({players:[shoveVictim],enemies:[closeDigger]}));
api.updateEnemies(.1);
assert.equal(api.getGame().players.length,0,"掘阵卒接敌后应直接铲飞我方棋子");

const blockedIce={type:"ice",isHazard:true,blocksPlant:true,row:0,col:0};
api.setGame(baseGame({selected:"pawn",energy:75,cooldowns:{pawn:0},used:{},hazards:[blockedIce]}));
api.placeSelected(0,0);
assert.equal(api.getGame().players.length,0,"冰面棋格不应允许部署棋子");

const shieldShooter={type:"rook",row:2,col:1,hp:1200,maxHp:1200,timer:0,rank:1};
const enemyBehindShield={type:"soldier",row:2,x:6,hp:800,maxHp:800};
const shieldHazard={type:"shield",isHazard:true,blocksPlant:true,row:2,col:4,hp:6500,maxHp:6500};
api.setGame(baseGame({players:[shieldShooter],enemies:[enemyBehindShield],hazards:[shieldHazard]}));
api.updatePlayers(.1);
assert.equal(enemyBehindShield.hp,800,"盾碑应截停弩箭并保护后方敌棋");
assert.equal(shieldHazard.hp,6410,"平衡后的90伤害车弹应先命中盾碑");

api.setRank("rook",2);
const scatterRook={type:"rook",row:1,col:1,hp:1200,maxHp:1200,rank:2,traitHits:0,storedShots:0,timer:0};
const scatterMain={type:"soldier",row:1,x:5,hp:1000,maxHp:1000};
const scatterExtra={type:"soldier",row:2,x:5.4,hp:1000,maxHp:1000};
api.setGame(baseGame({players:[scatterRook],enemies:[scatterMain,scatterExtra]}));
api.damageEnemy(scatterMain,100,"rook",scatterRook);
assert.equal(scatterExtra.hp,1000,"车2阶应改为转台集中索敌，不再套用跳弹散射模板");

api.setRank("rook",3);scatterRook.rank=3;scatterRook.traitHits=0;scatterRook.timer=0;scatterRook.storedShots=0;
api.setGame(baseGame({players:[scatterRook],enemies:[]}));
api.updatePlayers(.1);
assert.equal(scatterRook.storedShots,1,"车3阶在没有目标时应装填一枚重弹，而不是周期范围爆炸");

api.setRank("rook",4);scatterRook.rank=4;scatterRook.traitHits=0;scatterMain.hp=1000;
api.setGame(baseGame({players:[scatterRook],enemies:[scatterMain]}));
api.damageEnemy(scatterMain,100,"rook",scatterRook);api.damageEnemy(scatterMain,100,"rook",scatterRook);
assert.equal(scatterMain.hp,800,"车4阶只针对盾碑进行拆障强化，不应给普通敌人套通用破阵印记");

const healingShield={type:"shieldPawn",row:2,col:1,hp:800,maxHp:1100,rank:2,traitHits:0,lastHitTimer:2,regenTick:.95,timer:1,traitCooldown:0};
const shieldTarget={type:"soldier",row:2,x:2.2,hp:1000,maxHp:1000,slowTimer:0};
api.setGame(baseGame({players:[healingShield],enemies:[shieldTarget]}));
api.updatePlayers(.1);
assert.equal(healingShield.hp,845,"盾兵2阶应在脱战后自愈，而不是在攻击时套用追伤模板");

const freezingRook={type:"iceRook",row:2,col:1,hp:1000,maxHp:1000,rank:3,traitHits:2};
const frozenTarget={type:"soldier",row:2,x:5,hp:1000,maxHp:1000,slowTimer:0};
api.setGame(baseGame({players:[freezingRook],enemies:[frozenTarget]}));
api.damageEnemy(frozenTarget,100,"iceRook",freezingRook);
assert.equal(frozenTarget.slowTimer,0,"冰车的冰雕需要由连续实战射击触发，不再使用通用命中计数模板");

const fiveLaneQueen={type:"queen",row:2,col:1,hp:900,maxHp:900,timer:0,rank:3,traitHits:0,attackCycles:2};
const fiveLaneTargets=Array.from({length:5},(_,row)=>({type:"soldier",row,x:5,hp:1000,maxHp:1000}));
api.setGame(baseGame({players:[fiveLaneQueen],enemies:fiveLaneTargets}));
api.updatePlayers(.1);
assert.ok(fiveLaneTargets.every(enemy=>enemy.hp<1000),"后3阶每第3轮应从三线射手质变为覆盖全部五路");

const retreatKnight={type:"knight",row:2,col:4,hp:100,maxHp:750,timer:0,rank:4,traitHits:0,traitCooldown:0,kills:0};
api.setGame(baseGame({players:[retreatKnight]}));
api.updatePlayers(.1);
assert.equal(retreatKnight.col,2,"马4阶残血时应主动跳回左侧休整");
assert.ok(retreatKnight.hp>100&&retreatKnight.traitCooldown===15,"回营应恢复生命并进入15秒冷却");

api.setRank("pawn",5);
const legacyPawn={type:"pawn",row:2,col:2,hp:10,maxHp:500,rank:5};
const legacyA={type:"soldier",row:2,x:3.2,hp:1000,maxHp:1000};
const legacyB={type:"soldier",row:2,x:4.8,hp:1000,maxHp:1000};
api.setGame(baseGame({players:[legacyPawn],enemies:[legacyA,legacyB]}));
api.damagePlayer(legacyPawn,50,{type:"soldier"});
assert.equal(legacyA.hp,1000,"兵5阶不再绑定阵亡范围伤害");
assert.equal(legacyB.hp,1000,"五阶成长应在存活时产生玩法变化，而非统一死亡遗技");

api.setRank("king",3);
const growthKing={type:"king",row:2,col:1,hp:800,maxHp:800,timer:0,rank:3,supportCycles:0};
api.setGame(baseGame({players:[growthKing],energy:0,energyCollected:0}));
for(let i=0;i<3;i++){growthKing.timer=0;api.updatePlayers(.1);}
assert.equal(api.getGame().energy,110,"王3阶应触发应急金库并保持固定产能，不再套用第三次双倍产能");

api.setRank("twinRook",1);api.setGrowthState({type:"twinRook",mode:"ult",rank:1});
const twinRookDemo=api.buildGrowthStage();
assert.ok(twinRookDemo.includes('growth-board-scale')&&twinRookDemo.includes('<div class="board">')&&twinRookDemo.includes("entity-layer")&&twinRookDemo.includes("effect-layer")&&!twinRookDemo.includes("demo-shot"),"成长演示必须在原尺寸正式棋盘内挂载正式战斗渲染层，不能再独立绘制炮弹");
const growthCss=fs.readFileSync(path.join(__dirname,"..","styles.css"),"utf8");
const pageHtml=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
assert.ok(pageHtml.includes('id="snakePitScreen"')&&pageHtml.includes('id="snakeCountRange"')&&pageHtml.includes('min="100" max="1000" step="100"'),"万蛇窟应提供100–1000条紫蛇数量选择界面");
assert.ok(growthCss.includes(".ultimate-tile-glow{")&&growthCss.includes("@keyframes ultimateTileGlow"),"棋子释放大招时应在对应棋格显示动态底光");
assert.ok(growthCss.includes(".growth-board-scale{position:absolute")&&growthCss.includes("transform-origin:top left"),"成长演示必须整体等比缩放原尺寸正式棋盘");
assert.ok(!growthCss.includes(".growth-demo-stage.board")&&!growthCss.includes(".demo-shot")&&!growthCss.includes("@keyframes demoProjectile"),"成长演示不得覆盖正式棋盘尺寸或保留独立弹体动画");
assert.ok(growthCss.includes(".fallen-unit{")&&growthCss.includes("@keyframes unitFall"),"棋子正常死亡必须播放倒地动画");
assert.ok(growthCss.includes(".ultimate-announcement{")&&growthCss.includes(".visual-ultimateFocus")&&growthCss.includes(".visual-prismBurst"),"所有棋子大招应具备统一登场演出及棋子家族专属效果");
assert.ok(source.includes("ultimateCinematic(p)")&&source.includes("ULT_TRAITS[p.type]?.[0]"),"大招演出标题必须直接读取实战棋子的能量豆技能资料");
assert.ok(source.includes("fallenPlayer(p.col+.5,p.row+.5,p.type)")&&source.includes("fallenEnemy(e)"),"我方和敌方普通死亡都必须挂载倒地动画");
assert.ok(!source.includes("else if(growthState.rank===5)damagePlayer"),"五阶成长演示不得再通过强制杀死棋子播放旧死亡效果");
assert.ok(source.includes("configureGrowthScenario(state,player,type,rank,mode)")&&source.includes("type==='flameRook'&&rank>=3")&&source.includes("addIce(player.row,[3,4,5,6])"),"成长演示应按棋子和阶位配置场景，焰车熔冰路线前方必须放置冰面");
assert.ok(fs.existsSync(path.join(__dirname,"..","js","game-data.js"))&&fs.existsSync(path.join(__dirname,"..","js","growth-mode.js")),"大型game.js应拆分出数据层和成长演示模块");
const sharedTwinRook={type:"twinRook",row:2,col:1,hp:1100,maxHp:1100,timer:0,rank:1,id:91};
api.setGame(baseGame({preview:true,players:[sharedTwinRook],abilityEvents:[],energy:0,energyCollected:0}));
api.activateEnergyBean(sharedTwinRook,{preview:true});
assert.equal(api.getGame().abilityEvents.length,api.abilitySpecs.twinRook.shots,"成长演示调用的正式大招函数应按实战参数排入30发炮弹事件");
assert.equal(api.getGame().abilityEvents.filter(event=>event.barrel===0).length,15,"双车大招第一排应为15发");assert.equal(api.getGame().abilityEvents.filter(event=>event.barrel===1).length,15,"双车大招第二排应为15发");
assert.equal(api.getGame().abilityEvents[0].t,api.getGame().abilityEvents[1].t,"双车大招应每次同时从两排各发一弹");
api.updateAbilityEvents(.01);assert.equal(api.getGame().projectiles.length,2,"双车大招首轮应同时射出两弹");assert.notEqual(api.getGame().projectiles[0].y,api.getGame().projectiles[1].y,"双车大招应分成两条上下弹道");
const sharedTwinQueen={type:"twinQueen",row:2,col:1,hp:950,maxHp:950,timer:0,rank:1,id:92};
api.setGame(baseGame({preview:true,players:[sharedTwinQueen],abilityEvents:[],energy:0,energyCollected:0}));api.activateEnergyBean(sharedTwinQueen,{preview:true});assert.equal(api.getGame().abilityEvents.length,api.abilitySpecs.twinQueen.shots,"双后大招应保持30发，分为两排各15发");assert.equal(api.getGame().abilityEvents.filter(event=>event.barrel===0).length,15,"双后大招第一排应为15发");assert.equal(api.getGame().abilityEvents.filter(event=>event.barrel===1).length,15,"双后大招第二排应为15发");assert.equal(api.getGame().abilityEvents[0].t,api.getGame().abilityEvents[1].t,"双后大招两排应成对开火");api.updateAbilityEvents(.01);assert.equal(api.getGame().projectiles.length,6,"双后大招首轮应向三路各射出上下两弹");assert.notEqual(api.getGame().projectiles[0].y,api.getGame().projectiles[3].y,"双后大招每路应分成两条上下弹道");

console.log("成长之路与核心战斗机制测试通过");
