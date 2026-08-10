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
let source = fs.readFileSync(gamePath, "utf8");
source += `
globalThis.testApi = {
  units: UNITS,
  enemies: ENEMIES,
  story: STORY,
  challenges: CHALLENGES,
  setGame(value) { game = value; },
  getGame() { return game; },
  updateEnemies,
  updatePlayers,
  updateSpawning,
  damageEnemy,
  placeSelected,
  setMastery(type, value) { save.mastery[type] = value; save.ranks[type] = 1; },
  getRank(type) { return save.ranks[type]; },
  checkRanks
};`;
vm.runInNewContext(source, context, { filename: gamePath });

const api = context.testApi;
const baseGame = overrides => ({
  config: {}, enemies: [], players: [], hazards: [], projectiles: [], entityId: 20,
  wave: 1, kills: 0, mastery: {}, rankUps: [], over: false,
  ...overrides
});

assert.equal(api.units.rook.attack, 175, "我方车的基准伤害应为150–200区间中值");
assert.equal(api.enemies.soldier.hp, 800, "普通兵卒应提高到800生命");
assert.equal(api.enemies.elephant.hp, 2800, "八卦相应提高到2800生命");
assert.equal(api.enemies.snake.hp, 65000, "紫蛇应提高到65000生命");
assert.ok(api.story.every(level => level.energy === 75), "全部故事关应从75能量开始");
assert.ok(api.challenges.every(level => level.energy === 75), "全部挑战应从75能量开始");

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

const wounded = { type: "pawn", row: 1, col: 1, hp: 200, maxHp: 500, timer: 1, rank: 1 };
const priest = { type: "priest", row: 1, col: 2, hp: 650, maxHp: 650, timer: 0, rank: 1 };
api.setGame(baseGame({ players: [wounded, priest] }));
api.updatePlayers(.1);
assert.equal(wounded.hp, 320, "圣女应治疗邻近友军120生命");

const frost = { type: "frost", row: 2, col: 1, hp: 700, maxHp: 700, timer: 0, rank: 1 };
const frozenEnemy = { type: "soldier", row: 2, x: 5, hp: 500, maxHp: 500, slowTimer: 0 };
api.setGame(baseGame({ players: [frost], enemies: [frozenEnemy] }));
api.updatePlayers(.1);
assert.equal(frozenEnemy.hp, 380, "冰皇应造成120伤害");
assert.ok(frozenEnemy.slowTimer >= 3.5, "冰皇应施加减速状态");

const ballista = { type: "ballista", row: 4, col: 1, hp: 900, maxHp: 900, timer: 0, rank: 1 };
const lineEnemyA = { type: "soldier", row: 4, x: 4, hp: 500, maxHp: 500 };
const lineEnemyB = { type: "soldier", row: 4, x: 7, hp: 500, maxHp: 500 };
api.setGame(baseGame({ players: [ballista], enemies: [lineEnemyA, lineEnemyB] }));
api.updatePlayers(.1);
assert.equal(lineEnemyA.hp, 320, "弩塔应伤害路线上的第一枚敌棋");
assert.equal(lineEnemyB.hp, 320, "弩塔应贯穿并伤害后方敌棋");

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

const piercingTower={type:"ballista",row:2,col:1,hp:900,maxHp:900,timer:0,rank:1};
const enemyBeforeShield={type:"soldier",row:2,x:3,hp:800,maxHp:800};
const enemyBehindShield={type:"soldier",row:2,x:6,hp:800,maxHp:800};
const shieldHazard={type:"shield",isHazard:true,blocksPlant:true,row:2,col:4,hp:6500,maxHp:6500};
api.setGame(baseGame({players:[piercingTower],enemies:[enemyBeforeShield,enemyBehindShield],hazards:[shieldHazard]}));
api.updatePlayers(.1);
assert.equal(enemyBeforeShield.hp,620,"弩箭应能伤害盾碑前方的敌棋");
assert.equal(enemyBehindShield.hp,800,"盾碑应截停弩箭并保护后方敌棋");

console.log("29项核心机制测试通过");
