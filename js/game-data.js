"use strict";

// 棋子、成长路线、敌军、关卡与难度的集中数据定义。
const UNITS = {
  pawn: { name: "兵", family:"基础棋", unlockAt:1, shape:"pawn", cost: 50, hp: 500, cd: 5, attack: 90, attackMode:"melee", color: "#ddd0b6", desc: "近卫 · 每0.9秒挥剑攻击前方2格内的敌军" },
  rook: { name: "车", family:"基础棋", unlockAt:1, shape:"rook", cost: 150, hp: 1200, cd: 10, attack:105, attackMode:"flat", color: "#d7c39b", desc: "重装 · 每1.2秒向四方开火，每发随机90–120伤害" },
  king: { name: "王", family:"基础棋", unlockAt:1, shape:"king", cost: 50, hp: 800, cd: 10, attack: 0, attackMode:"support", color: "#e9d59e", desc: "后勤 · 每8秒生产25能量" },
  knight: { name: "马", family:"基础棋", unlockAt:2, shape:"knight", cost: 100, hp: 750, cd: 8, attack: 170, attackMode:"leap", color: "#c9d0cb", desc: "游骑 · 每1.35秒跃击，可绕过盾碑并伤害掘阵卒" },
  shieldPawn: { name:"盾兵", family:"兵系衍生", unlockAt:2, shape:"pawn", cost:75, hp:1100, cd:8, attack:55, attackMode:"melee", armor:.4, color:"#b8b6a7", desc:"铁卫 · 受到的伤害减少40%，每1秒以盾击缠住重甲敌军" },
  spearPawn: { name:"投矛兵", family:"兵系衍生", unlockAt:3, shape:"pawn", cost:100, hp:450, cd:8, attack:75, attackMode:"arc", color:"#d8b887", desc:"投手 · 每1.1秒向前5格投矛，弧线可越盾" },
  bishop: { name: "象", family:"基础棋", unlockAt:3, shape:"bishop", cost: 125, hp: 650, cd: 8, attack: 180, attackMode:"arc", color: "#d7c7b7", desc: "弧击 · 每1.5秒沿斜线越盾攻击" },
  twinRook: { name:"双车", family:"车系衍生", unlockAt:3, shape:"rook", cost:225, hp:1100, cd:14, attack:80, attackMode:"flat", color:"#e1c37c", desc:"连发 · 每1.25秒向同一目标连续发射两枚80伤害车弹" },
  queen: { name: "后", family:"基础棋", unlockAt:4, shape:"queen", cost: 450, hp: 900, cd: 15, attack:105, attackMode:"flat", color: "#ead3ad", desc: "三线炮台 · 每1.2秒向本路及相邻两路各发一枚普通车弹" },
  iceRook: { name:"冰车", family:"车系衍生", unlockAt:4, shape:"rook", cost:175, hp:1000, cd:12, attack:75, attackMode:"flat", color:"#91ddeb", desc:"寒弹 · 每1.25秒造成75伤害，并减速45%持续3.5秒" },
  stormKnight: { name:"雷马", family:"马系衍生", unlockAt:4, shape:"knight", cost:175, hp:700, cd:11, attack:150, attackMode:"leap", chainDamage:60, color:"#91d8e5", desc:"链雷 · 每1.5秒跃击，并链击附近两枚敌棋各60伤害" },
  twinBishop: { name:"双象", family:"象系衍生", unlockAt:4, shape:"bishop", cost:200, hp:700, cd:12, attack:135, attackMode:"arc", color:"#c8aee0", desc:"双弧 · 每1.55秒同时攻击最多两枚对角线敌棋" },
  flameRook: { name:"焰车", family:"车系衍生", unlockAt:5, shape:"rook", cost:200, hp:1050, cd:13, attack:158, attackMode:"flat", element:"flame", projectile:"flameRook", color:"#ef8a52", desc:"烈火弹 · 单体命中，造成普通车弹1.5倍伤害，不再持续灼烧" },
  royalKing: { name:"金王", family:"王系衍生", unlockAt:5, shape:"king", cost:125, hp:900, cd:14, attack:0, attackMode:"support", color:"#f0c75e", desc:"富矿 · 每10秒生产45能量，适合中后期扩张阵地" },
  poisonRook: { name:"毒车", family:"车系衍生", unlockAt:6, shape:"rook", cost:200, hp:1050, cd:13, attack:60, attackMode:"flat", poisonDps:30, color:"#9b5ed1", desc:"蚀弹 · 每1.3秒攻击；2阶起毒层可无限叠加，每次命中刷新8秒" },
  electricRook: { name:"电能车", family:"车系衍生", unlockAt:6, shape:"rook", cost:225, hp:1000, cd:13, attack:70, attackMode:"flat", element:"electric", projectile:"electricRook", color:"#e7e65d", desc:"贯电弹 · 每1.3秒发射可无限穿透本路敌军的电能弹；5阶形成跨路雷网" },
  iceQueen: { name:"冰后", family:"后系衍生", unlockAt:6, shape:"queen", cost:600, hp:880, cd:18, attack:70, attackMode:"flat", element:"ice", projectile:"iceRook", color:"#83ddec", desc:"三路寒令 · 每1.3秒向连续三路发射冰弹，造成伤害并减速" },
  flameQueen: { name:"焰后", family:"后系衍生", unlockAt:6, shape:"queen", cost:650, hp:900, cd:19, attack:158, attackMode:"flat", element:"flame", projectile:"flameRook", color:"#ef8650", desc:"三路炎令 · 每1.25秒向连续三路发射1.5倍普通弹伤害的单体火弹" },
  poisonQueen: { name:"毒后", family:"后系衍生", unlockAt:6, shape:"queen", cost:650, hp:860, cd:19, attack:55, attackMode:"flat", element:"poison", projectile:"poisonRook", poisonDps:25, color:"#a56add", desc:"三路蛊令 · 每1.35秒向连续三路发射毒弹，优先扩散到未中毒敌军" },
  electricQueen: { name:"电能后", family:"后系衍生", unlockAt:6, shape:"queen", cost:700, hp:850, cd:20, attack:65, attackMode:"flat", element:"electric", projectile:"electricRook", color:"#f0ea62", desc:"三路电令 · 每1.35秒向连续三路发射可无限穿透的电能弹；5阶构成跨路雷网" },
  prismQueen: { name:"棱镜后", family:"后系衍生", unlockAt:6, shape:"queen", cost:550, hp:850, cd:18, attack:50, attackMode:"beam", color:"#ef9bd8", desc:"穿透棱光 · 每0.8秒扫射本路及相邻两路，行内所有敌军各受50伤害" },
  frostKnight: { name:"霜马", family:"马系衍生", unlockAt:5, shape:"knight", cost:160, hp:720, cd:10, attack:120, attackMode:"leap", color:"#a7e6ee", desc:"霜跃 · 每1.4秒跃击，落点寒气减速周围敌军" },
  poisonBishop: { name:"毒象", family:"象系衍生", unlockAt:6, shape:"bishop", cost:190, hp:620, cd:11, attack:85, attackMode:"arc", poisonDps:24, color:"#8e59c5", desc:"疫线 · 每1.25秒沿斜线投射毒弧，中毒可向召唤援军传播" },
  twinQueen: { name:"双后", family:"后系秘藏", unlockKey:"doubleQueen", shape:"queen", cost:700, hp:950, cd:22, attack:70, attackMode:"flat", color:"#ffd37f", desc:"六连王令 · 每1.3秒向三路各发两枚70伤害普通炮弹" },
  iceBishop: { name:"冰象", family:"象系秘藏", unlockKey:"iceSculptures", shape:"bishop", cost:180, hp:680, cd:12, attack:95, attackMode:"arc", color:"#88dff2", desc:"冰封斜线 · 弧光稳定减速，3阶起概率凝成可完全冻结目标的大冰棱" },
  flameBishop: { name:"焰象", family:"象系秘藏", unlockKey:"meltedIce", shape:"bishop", cost:195, hp:660, cd:12, attack:105, attackMode:"arc", burnDps:34, color:"#f28c52", desc:"熔岩斜线 · 点燃斜线敌军，并可熔化弧光经过的冰格" },
  shieldKing: { name:"御盾王", family:"王系秘藏", unlockKey:"shieldDamage", shape:"king", cost:175, hp:1300, cd:16, attack:0, attackMode:"support", armor:.2, color:"#b8cfca", desc:"御令 · 每10秒生产30能量，并为相邻友军补充护甲" },
  berserkerPawn: { name:"狂战兵", family:"兵系衍生", unlockAt:4, shape:"pawn", cost:100, hp:650, cd:9, attack:115, attackMode:"melee", color:"#d96a5f", desc:"血刃 · 每1.05秒近战；生命越低攻击越快，升阶后可吸血与横扫" },
  bombardRook: { name:"炮车", family:"车系衍生", unlockAt:5, shape:"rook", cost:250, hp:950, cd:15, attack:130, attackMode:"arc", color:"#d59a58", desc:"重炮 · 每1.8秒轰击敌群，主目标周围敌军也会受到爆炸伤害" },
  warKing: { name:"战王", family:"王系衍生", unlockAt:4, shape:"king", cost:160, hp:1050, cd:14, attack:0, attackMode:"support", color:"#dc775b", desc:"战旗 · 每9秒生产20能量，并推进相邻友军的攻击计时" },
  guardianKnight: { name:"圣骑", family:"马系衍生", unlockAt:5, shape:"knight", cost:190, hp:980, cd:12, attack:125, attackMode:"leap", armor:.1, color:"#e4cf87", desc:"裁决冲锋 · 跃击并短暂眩晕敌军，升阶后为友军提供护甲" },
  lightBishop: { name:"光象", family:"象系衍生", unlockAt:5, shape:"bishop", cost:210, hp:700, cd:12, attack:85, attackMode:"arc", color:"#f1dd9a", desc:"圣光 · 每1.45秒治疗最虚弱友军，同时以斜光攻击一名敌军" },
  shadowQueen: { name:"影后", family:"后系衍生", unlockAt:6, shape:"queen", cost:500, hp:820, cd:17, attack:90, attackMode:"flat", color:"#a88acb", desc:"暗印 · 攻击三路内最虚弱敌军，三层暗印爆发额外伤害" },
  superRook: { name:"超级车", family:"车系终极", unlockAt:6, shape:"rook", cost:600, hp:1250, cd:18, attack:105, attackMode:"flat", color:"#8ff1d7", desc:"四联炮台 · 每1.5秒向本路同时发射4枚普通车弹" },
  superQueen: { name:"超级后", family:"后系终极", unlockAt:6, shape:"queen", cost:1500, hp:1000, cd:24, attack:105, attackMode:"flat", color:"#b5f3dc", desc:"十二联王令 · 每1.5秒向连续三路各发射4枚普通后弹" },
  superIceRook: { name:"超级冰车", family:"超级融合种", fusionOnly:true, fusionBase:"superRook", fusionSource:"iceRook", shape:"rook", cost:0, hp:1400, cd:0, attack:70, attackMode:"flat", element:"ice", projectile:"iceRook", color:"#70e8ef", desc:"四联寒潮 · 由超级车与冰车融合，每轮4枚冰弹同时减速并冻结敌军" },
  superFlameRook: { name:"超级焰车", family:"超级融合种", fusionOnly:true, fusionBase:"superRook", fusionSource:"flameRook", shape:"rook", cost:0, hp:1420, cd:0, attack:158, attackMode:"flat", element:"flame", projectile:"flameRook", color:"#ff8a4d", desc:"四联熔炉 · 由超级车与焰车融合，每轮4枚1.5倍普通弹伤害的单体火弹" },
  superPoisonRook: { name:"超级毒车", family:"超级融合种", fusionOnly:true, fusionBase:"superRook", fusionSource:"poisonRook", shape:"rook", cost:0, hp:1380, cd:0, attack:55, attackMode:"flat", element:"poison", projectile:"poisonRook", poisonDps:35, color:"#a04fdf", desc:"四联菌炮 · 由超级车与毒车融合，每轮4枚毒弹优先感染不同敌军" },
  superElectricRook: { name:"超级电能车", family:"超级融合种", fusionOnly:true, fusionBase:"superRook", fusionSource:"electricRook", shape:"rook", cost:0, hp:1360, cd:0, attack:65, attackMode:"flat", element:"electric", projectile:"electricRook", color:"#f4ef63", desc:"四联电轨 · 由超级车与电能车融合，每轮4枚电能弹无限穿透本路敌军" },
  superIceQueen: { name:"超级冰后", family:"超级融合种", fusionOnly:true, fusionBase:"superQueen", fusionSource:"iceQueen", shape:"queen", cost:0, hp:1120, cd:0, attack:70, attackMode:"flat", element:"ice", projectile:"iceRook", color:"#80eff4", desc:"十二联冰令 · 由超级后与冰后融合，连续三路各发4枚冰弹" },
  superFlameQueen: { name:"超级焰后", family:"超级融合种", fusionOnly:true, fusionBase:"superQueen", fusionSource:"flameQueen", shape:"queen", cost:0, hp:1140, cd:0, attack:158, attackMode:"flat", element:"flame", projectile:"flameRook", color:"#ff9360", desc:"十二联炎令 · 由超级后与焰后融合，连续三路各发4枚1.5倍普通弹伤害的单体火弹" },
  superPoisonQueen: { name:"超级毒后", family:"超级融合种", fusionOnly:true, fusionBase:"superQueen", fusionSource:"poisonQueen", shape:"queen", cost:0, hp:1100, cd:0, attack:55, attackMode:"flat", element:"poison", projectile:"poisonRook", poisonDps:35, color:"#b25ce8", desc:"十二联蛊令 · 由超级后与毒后融合，连续三路各发4枚毒弹" },
  superElectricQueen: { name:"超级电能后", family:"超级融合种", fusionOnly:true, fusionBase:"superQueen", fusionSource:"electricQueen", shape:"queen", cost:0, hp:1080, cd:0, attack:65, attackMode:"flat", element:"electric", projectile:"electricRook", color:"#fff36a", desc:"十二联电令 · 由超级后与电能后融合，连续三路各发4枚无限穿透电能弹" }
};

const FUSION_RECIPES = {
  superRook:{iceRook:"superIceRook",flameRook:"superFlameRook",poisonRook:"superPoisonRook",electricRook:"superElectricRook"},
  superQueen:{iceQueen:"superIceQueen",flameQueen:"superFlameQueen",poisonQueen:"superPoisonQueen",electricQueen:"superElectricQueen"}
};

const SPECIAL_UNLOCKS = {
  twinQueen:{name:"双冠齐鸣",description:"在同一局战斗中部署2枚后",target:2,battleOnly:true},
  iceBishop:{name:"寒晶收集",description:"用冰车累计制造12次冰雕",target:12},
  flameBishop:{name:"破冰者",description:"用焰车累计熔化15格冰面",target:15},
  shieldKing:{name:"铁壁功勋",description:"让盾兵累计承受6000点伤害",target:6000}
};

// 每枚棋子拥有独立的五阶路线；说明与下方实战分支一一对应。
const RANK_TRAITS = {
  pawn:[["近卫剑术","接敌后挥剑攻击前方2格。"],["守格反击","同路敌军攻击它时，立刻回敬一次45伤害剑击。"],["过河升变","累计击败3敌后升变为先锋：攻击距离增加1格。"],["救驾","王系棋子生命低于一半时，兵的攻击频率提高一倍。"],["冠军兵","升变后每次斩敌返还15能量，并立刻寻找下一个目标。"]],
  shieldPawn:[["铁壁","持盾承受伤害，常驻减伤40%。"],["架盾休整","连续2秒未受伤后每秒恢复45生命。"],["路障姿态","停止攻击，敌人接触它时移动速度降至25%。"],["挪盾","前方相邻格空闲时，受击会向前挪一格堵路，冷却8秒。"],["移动城墙","身后同路友军获得35%减伤，盾兵不再被普通击退。"]],
  spearPawn:[["越障投矛","手中长矛以抛物线越过盾碑攻击。"],["回旋枪","长矛飞回时再次伤害同一目标，造成35%伤害。"],["插地枪阵","每第4矛在目标格留下3秒枪阵，路过敌军持续受伤。"],["猎巨矛","自动优先瞄准巨型与Boss，命中时追加目标最大生命1%的伤害。"],["百步穿杨","攻击距离覆盖整路，长矛连续贯穿同路所有敌人。"]],
  rook:[["四向炮台","每轮向横纵方向寻找目标并发射车弹。"],["转台追踪","可把本轮全部炮口集中到最靠近左侧的敌人。"],["装填抉择","无敌人时储存重弹；下次开火消耗储弹并造成双倍伤害。"],["拆障工程","攻击盾碑造成三倍伤害，摧毁后返还25能量。"],["四联超装填","每发车弹有20%概率改为4连射，4发均为普通车弹。"]],
  twinRook:[["双膛连发","像双发射手一样，每轮向同一目标连射2弹。"],["左右分工","两炮优先锁定不同敌人，敌人不足时才集火。"],["节拍连射","连续攻击同一目标时逐步加速，换目标后重置。"],["过热换线","同路没有敌人时，会支援敌军最多的相邻一路。"],["无限鼓点","连续命中10次进入3秒极速模式，攻击间隔减半。"]],
  iceRook:[["寒冰弹","普通冰弹使命中目标减速45%，持续3.5秒。"],["延时低温","冰冻与减速时间增加0.5秒。"],["大冰棱","每发有25%概率变为大冰棱，将命中目标完全冻住。"],["冰棱增压","大冰棱发射概率提升到50%。"],["整格冰封","大冰棱命中时有30%概率改为冻结目标所在整格内的所有敌军。"]],
  flameRook:[["烈火弹","火弹只命中单体，造成普通车弹1.5倍伤害，不再灼烧。"],["快速引燃","火弹装填加快，缩短下一轮攻击等待。"],["熔冰","火弹经过的冰面会被融化，并留下可再次部署的格子。"],["炽热瞄准","优先锁定本路生命最高的单体目标。"],["赤热重膛","每第5轮齐射两枚1.5倍火弹，仍然只造成即时单体伤害。"]],
  poisonRook:[["蚀毒弹","毒弹令目标中毒8秒，每次命中刷新持续时间。"],["万蛊叠生","从2阶开始，每次毒弹命中都会增加1层毒，层数没有上限，每层各造成一份毒伤。"],["菌丝寄生","中毒敌人被八卦相召唤出的援军靠近时，会把毒传过去。"],["逆疗孢子","中毒会封锁紫蛇和其他敌军的生命回复。"],["孢子傀儡","中毒敌人死亡时留下短命孢子兵，向右阻挡敌军3秒。"]],
  electricRook:[["贯电弹","电能弹可无限穿透本路敌军，但对单体只造成一般伤害。"],["蓄电加速","攻击间隔额外缩短0.08秒。"],["纵深增压","同一发电能弹命中第3名及之后的敌军时，伤害提高25%。"],["动能回收","每穿透一名敌军返还0.04秒装填时间，每发最多返还0.24秒。"],["五路雷网","每发电能弹首次命中时，向其他各路最近敌军链出一道45%伤害电流。"]],
  king:[["能量生产","像向日葵一样，每8秒生产25能量。"],["节俭王令","相邻棋子首次部署时返还其消耗的20%。"],["应急金库","能量低于50时立刻产出35能量，冷却15秒。"],["轮换号令","每次生产减少随机一张未就绪棋子卡2秒冷却。"],["加冕","同一王生产5次后加冕：以后每次产出50能量。"]],
  royalKing:[["富矿生产","每10秒生产45能量。"],["利息","每拥有100未使用能量，产量额外增加3点，上限15点。"],["黄金时刻","每第3次生产令所有棋子卡立即冷却2秒。"],["悬赏令","随机标记一名强敌；击杀它额外获得35能量。"],["国库共鸣","场上每有一种不同棋子，金王产量增加5点。"]],
  knight:[["跳跃突袭","跨越障碍跃击范围内生命最低的敌人。"],["换路落点","本路无目标时可跃击相邻一路的敌军。"],["踩头借力","击杀目标后立刻跃向附近下一名敌军。"],["回营","生命低于25%时跳回左侧并休整回血，冷却15秒。"],["巡游骑士","每次击杀永久增加0.25格跃击范围，本局最多增加2格。"]],
  stormKnight:[["二段链雷","跃击后电流额外跳向附近2名敌军。"],["导电冰面","电流经过冰格时范围扩大，额外寻找一名目标。"],["蓄雷","没有目标时积蓄雷荷；下次攻击每层雷荷增加一道链雷。"],["避雷针","优先攻击血量最高的敌人，并把其设为5秒导电核心。"],["雷暴天气","场上存在5名以上敌人时，每4秒随机落下3道雷。"]],
  bishop:[["斜线弧击","沿对角线越过盾碑发动弧光攻击。"],["换色棱镜","每次攻击在治疗光与伤害光间交替：治疗最虚弱友军80生命。"],["镜面传送","弧光命中镜戏丑时不被反弹，反而使其镜幕提前结束。"],["斜线护送","弧光经过的友军获得3秒30%减伤。"],["大主教","攻击时同时激活两条对角线，一条伤敌、一条治疗友军。"]],
  twinBishop:[["双重斜光","每轮同时攻击两名对角线敌军。"],["交点蓄能","两束光在同一格交汇时，为自己积累1层能量。"],["能量转赠","积累3层后自动给生命最低友军添加300护甲。"],["改写斜线","本轮无目标时，下轮可旋转攻击路线，搜索米字范围。"],["八面镜宫","四条斜线永久存在，进入线上的敌人每秒受45伤害。"]],
  queen:[["三线炮台","像三线射手一样向本路及相邻两路发射普通车弹。"],["王后换位","所在路被突破至左侧3格时，可与后方最安全友军交换位置一次。"],["五线敕令","每第3轮改为覆盖棋盘全部5路。"],["棋局调度","每次五线齐射后，所有车系棋子的计时推进0.35秒。"],["临场指挥","场上每少一路友军，后就接管该路并额外发射一枚炮弹。"]],
  prismQueen:[["三路穿透","每0.8秒照射3路，光束贯穿路内全部敌军。"],["棱镜转色","每轮在减速蓝光、灼烧红光与破甲紫光之间轮换。"],["折光角度","目标越多，光束越细但攻击越快，最多提高35%频率。"],["镜戏共振","照到开镜的镜戏丑时使镜子过载，关闭反弹并眩晕1秒。"],["虹桥","连续照射同一路5次后建立5秒虹桥，该路所有友军攻击加速25%。"]],
  frostKnight:[["霜跃","跃击落点爆出寒气，附近敌军减速。"],["冰橇换路","本路无敌时沿冰痕滑向相邻路攻击。"],["冻蹄印","落点留下3秒冻蹄印，经过敌军持续减速。"],["碎冰借力","击中被冻结敌军时立刻再次起跳。"],["极昼巡游","每第三次跃击召出冰影，同时扑向另外两路。"]],
  poisonBishop:[["疫线","沿斜线释放可越障的毒弧。"],["菌落择主","优先攻击尚未中毒且生命最高的敌军。"],["召援传染","敌相召出的援军靠近中毒者时立即染毒。"],["双毒相克","两条毒线交汇时生成腐蚀区，封锁敌军回复。"],["百蛊棋盘","每有一名中毒敌军，攻击间隔缩短4%，最多40%。"]],
  twinQueen:[["六连王令","三路各由一枚后开火，每路连续发射2弹。"],["双后异议","两枚炮弹分别优先攻击不同目标，避免浪费火力。"],["左右议会","每第四轮分别支援上下最危险的一路。"],["王令接力","任一后系棋子开大后，双后立即免费齐射一轮。"],["双冠残局","场上只剩双后一种攻击棋时，复制所有射弹形成十二连令。"]],
  iceBishop:[["低温斜线","普通冰弧使命中目标减速45%，持续3.5秒。"],["延时冰镜","冰冻与减速时间增加0.5秒。"],["冰棱折射","每次斜击有25%概率凝成大冰棱并完全冻住目标。"],["高密冰晶","大冰棱出现概率提升到50%。"],["冰格折射","大冰棱有30%概率冻结目标所在整格内的所有敌军。"]],
  flameBishop:[["熔岩斜线","火弧点燃沿线敌军并熔化经过的冰面。"],["余烬写字","被熔化的格子留下火印，首个踏入敌军会被点燃。"],["冷热爆裂","命中减速或冻结目标时产生额外160伤害的蒸汽爆。"],["八卦焚阵","命中敌相时焚毁其召唤计时，并延后下一次召唤。"],["日珥回廊","火弧抵达边缘后沿另一条斜线回扫一次。"]],
  shieldKing:[["御令","每10秒生产30能量，并给相邻友军补充100护甲。"],["王城垛口","相邻盾兵可替王系棋子承受一半伤害。"],["整军号令","每次生产使相邻棋子立刻推进0.5秒攻击计时。"],["护城税","友军护甲吸收每满500伤害，返还20能量。"],["移动王城","每次生产把护甲扩散到同路全部友军，且自身免疫砸碎一次。"]],
  berserkerPawn:[["血刃突进","持双刃攻击前方2格内最近的敌军。"],["逆境狂热","每损失20%生命，攻击频率提高10%。"],["饮血","每次命中恢复所造成伤害的30%。"],["斩敌暴怒","击败敌军后进入3秒暴怒，攻击频率再提高一倍。"],["猩红横扫","生命低于35%时，每次攻击同时斩击前方最多3名敌军。"]],
  bombardRook:[["落点爆破","炮弹命中后，对目标周围1格敌军造成50%爆炸伤害。"],["广域弹头","爆炸半径扩大，额外波及最多4名敌军。"],["震荡弹坑","每第4炮使命中区域敌军减速3秒。"],["密集测算","优先轰击周围敌军数量最多的目标。"],["双响重炮","每第3炮在同一落点再次爆炸，第二次造成完整伤害。"]],
  warKing:[["战旗号令","每9秒生产20能量，并让相邻友军提前1秒攻击。"],["鼓舞光环","相邻友军的攻击频率提高15%。"],["列阵护肩","每次号令为相邻友军补充100护甲。"],["战地救援","每次号令治疗生命比例最低的友军150生命。"],["全军共振","每第3次号令推进全体友军1秒攻击，并补充150护甲。"]],
  guardianKnight:[["裁决冲锋","跃击附近目标并使其停顿0.6秒。"],["圣盾回响","每次命中为自身补充80护甲。"],["震地裁决","落点周围敌军也会停顿0.8秒。"],["护卫落点","跃击后为附近生命最低友军补充150护甲。"],["连环裁决","击败目标后立即寻找下一名敌军再次跃击。"]],
  lightBishop:[["圣光双效","每轮治疗最虚弱友军，并攻击一名斜线敌军。"],["折射治疗","治疗光会再跳向第二名受伤友军，效果为50%。"],["圣光护甲","过量治疗转化为最多300点护甲。"],["净化棱光","治疗时使友军的下一轮攻击提前0.5秒。"],["黎明回廊","每第3轮治疗全体受伤友军，并同时照射两名斜线敌军。"]],
  shadowQueen:[["暗影敕令","从三路中锁定生命最低的敌军并施加暗印。"],["蚀甲暗印","被标记敌军受到的伤害提高20%，持续2秒。"],["五路潜行","每第3轮将搜索范围扩展到全部5路。"],["影印转移","暗印爆发时会把一层暗印转移给附近敌军。"],["终局处刑","生命低于20%的三层暗印目标会直接受到额外350伤害。"]],
  superRook:[["四弹齐射","每轮向本路并排发射4枚普通车弹。"],["四点火控","有多个目标时，4枚炮弹会优先分击不同目标。"],["双层弹匣","每第2轮齐射会在0.15秒后完整再射一轮。"],["补位追射","前一枚炮弹击破目标后，后续炮弹自动改攻下一目标。"],["四拍回响","每轮齐射都会在0.3秒后完整复奏；可与双层弹匣叠加。"]],
  superQueen:[["三路四联","连续三路各并排发射4枚普通后弹。"],["分路议会","每路的4枚炮弹优先分击该路不同目标。"],["五路总令","每第3轮改为五路各发射4枚炮弹。"],["车后协同","五路齐射后推进全部车系棋子的攻击计时。"],["天幕复奏","每轮齐射都会在0.3秒后按原覆盖路线完整复奏。"]]
};

Object.assign(RANK_TRAITS,{
  iceQueen:[["三路寒令","连续三路各发射一枚普通减速冰弹。"],["延时王令","冰冻与减速时间增加0.5秒。"],["冰棱敕令","每枚冰弹有25%概率变为可完全冻结目标的大冰棱。"],["冰棱增幅","大冰棱发射概率提升到50%。"],["整格冬幕","大冰棱有30%概率冻结目标所在整格内的所有敌军。"]],
  flameQueen:[["三路炎令","连续三路各发射一枚1.5倍普通弹伤害的单体火弹。"],["急令装填","火弹轮次的等待时间进一步缩短。"],["五路火幕","每第3轮改为向全部五路发射单体火弹。"],["熔界巡火","火弹会熔化覆盖路线中的冰面。"],["双令齐发","每第5轮每路追加一枚1.5倍火弹，不附带持续灼烧。"]],
  poisonQueen:[["三路蛊令","连续三路各发射一枚持续中毒的毒弹。"],["择净施毒","每路优先选择尚未中毒的敌军。"],["五路毒幕","每第3轮改为向全部五路扩散毒弹。"],["逆疗王令","中毒同步封锁敌军回复。"],["百蛊议会","场上每名中毒敌军都会略微提高毒后的攻击频率。"]],
  electricQueen:[["三路贯电","连续三路各发射一枚可无限穿透的低伤电能弹。"],["电令加速","攻击间隔额外缩短0.08秒。"],["纵深电压","每发命中第3名及之后的敌军时，伤害提高25%。"],["王庭回收","每穿透一名敌军返还0.04秒装填时间，每发最多返还0.24秒。"],["五路雷庭","每发首次命中都会向其他各路最近敌军链出45%伤害电流。"]],
  superIceRook:[["四联冰炮","本路同时发射4枚普通减速冰弹。"],["延时寒匣","冰冻与减速时间增加0.5秒。"],["四联冰棱","每枚冰弹有25%概率成为可完全冻结目标的大冰棱。"],["冰棱过载","大冰棱发射概率提升到50%。"],["整格寒潮","大冰棱有30%概率冻结目标所在整格内的所有敌军。"]],
  superFlameRook:[["四联火炮","本路同时发射4枚1.5倍普通弹伤害的单体火弹。"],["熔匣加速","四联火炮的轮次等待时间缩短。"],["双层熔匣","每第2轮在0.15秒后再次完整齐射。"],["熔路火控","每轮清除本路前方全部冰面。"],["赤热回响","每轮0.3秒后复奏，所有火弹仍只造成即时单体伤害。"]],
  superPoisonRook:[["四联毒炮","本路同时发射4枚毒弹。"],["分目标染毒","4枚毒弹优先感染不同目标。"],["双层菌匣","每第2轮在0.15秒后再次完整齐射。"],["逆疗菌潮","中毒目标完全停止回复。"],["孢子回响","每轮0.3秒后复奏，击败中毒目标会留下孢子兵。"]],
  superElectricRook:[["四联电轨","本路同时发射4枚无限穿透的电能弹。"],["电轨加速","攻击间隔额外缩短0.08秒。"],["纵深超压","每发命中第3名及之后的敌军时伤害提高25%。"],["四轨回收","每穿透一名敌军返还0.04秒装填，每发最多0.24秒。"],["雷网回响","每发首次命中向其他各路最近敌军链出45%伤害电流。"]],
  superIceQueen:[["十二联冰令","连续三路各同时发射4枚普通减速冰弹。"],["寒廷延时","冰冻与减速时间增加0.5秒。"],["冰棱议会","每枚冰弹有25%概率成为可完全冻结目标的大冰棱。"],["冰棱总令","大冰棱发射概率提升到50%。"],["整格天幕","大冰棱有30%概率冻结目标所在整格内的所有敌军。"]],
  superFlameQueen:[["十二联炎令","连续三路各同时发射4枚1.5倍普通弹伤害的单体火弹。"],["炎廷加速","十二联炎令的轮次等待时间缩短。"],["五路火幕","每第3轮改为五路各发射4枚单体火弹。"],["熔廷协同","五路齐射熔化全场冰面并推进焰系棋子。"],["赤日天幕","每轮0.3秒后复奏，不再引爆或附加持续灼烧。"]],
  superPoisonQueen:[["十二联蛊令","连续三路各同时发射4枚毒弹。"],["分路毒议","每路毒弹优先感染不同目标。"],["五路毒幕","每第3轮改为五路各发射4枚毒弹。"],["逆疗议会","五路齐射令全部中毒目标停止回复。"],["万蛊天幕","每轮0.3秒后复奏，毒军越多攻击越快。"]],
  superElectricQueen:[["十二联电令","连续三路各同时发射4枚无限穿透电能弹。"],["雷廷加速","攻击间隔额外缩短0.08秒。"],["纵深雷压","每发命中第3名及之后的敌军时伤害提高25%。"],["十二轨回收","每穿透一名敌军返还0.04秒装填，每发最多0.24秒。"],["万路雷庭","每发首次命中向其他各路最近敌军链出45%伤害电流。"]]
});

const ULT_TRAITS = {
  pawn:["地裂斩","挥剑劈地，前方2格出现裂痕，每格敌军受到500伤害。"],shieldPawn:["不动壁垒","回满生命并获得厚重能量护甲。"],spearPawn:["天降五矛","连续投出5支重矛，每支造成强化伤害。"],
  rook:["十五连炮","1.5秒内连发15枚炮弹。"],twinRook:["双膛风暴","1.5秒内连发30枚炮弹。"],iceRook:["冰棱连炮","1.5秒内连发15枚冰弹，大冰棱概率遵循当前阶位。"],flameRook:["烈焰连炮","1.5秒内连发15枚1.5倍普通弹伤害的单体火弹。"],poisonRook:["巨毒碾路","推出沿地面滚动的巨大毒球，沿途每名敌军受到1500伤害。"],electricRook:["雷轨连炮","1.5秒内连发15枚无限穿透的电能弹。"],
  king:["王室宝库","立刻获得大量能量并完全恢复生命。"],royalKing:["黄金盛典","获得巨量能量并治疗全体友军。"],shieldKing:["万盾朝宗","全体友军获得护甲，并立即获得300能量。"],knight:["贯阵冲锋","沿本行冲锋并重创前方最多5名敌军。"],stormKnight:["万雷天牢","对场上所有敌军依次降下雷击。"],frostKnight:["极寒奔袭","冰影冲过全场五路，造成伤害并冻结全部敌军。"],bishop:["裁决斜线","两条斜线同时爆发，重创路径上的敌军。"],twinBishop:["双象裁决","强化的交叉斜光清扫全部对角线。"],iceBishop:["冰晶圣裁","冻结四条斜线上的全部敌军并生成霜甲。"],flameBishop:["赤日圣裁","两轮火焰斜线焚烧敌军并熔化全场冰面。"],poisonBishop:["万蛊星盘","全场敌军染上强化剧毒，且8秒内无法回复。"],queen:["三路连炮","向本路及相邻两路同时倾泻普通车弹。"],twinQueen:["双冠齐射","两位后向三路倾泻30轮双发炮弹。"],iceQueen:["极寒王令","连续三路倾泻15轮冰弹，大冰棱概率遵循当前阶位。"],flameQueen:["焚城王令","连续三路倾泻15轮1.5倍普通弹伤害的单体火弹。"],poisonQueen:["万蛊王令","连续三路倾泻15轮毒弹，全面封锁回复。"],electricQueen:["雷霆王令","连续三路倾泻15轮无限穿透电能弹。"],prismQueen:["三路虹裁","三路棱镜光束高速连射并贯穿战场。"],
  berserkerPawn:["猩红旋风","旋转双刃重创周围敌军，并按命中数量恢复生命。"],bombardRook:["天火覆盖","锁定全场最多8名敌军降下重炮，爆炸波及其周围目标。"],warKing:["全军总攻","立即获得150能量，全军补充护甲并立刻发动下一轮攻击。"],guardianKnight:["圣裁奔袭","连续冲击全场敌军，造成伤害并使其停顿。"],lightBishop:["普照黎明","大幅治疗全体友军、补充护甲，并以圣光灼击全部敌军。"],shadowQueen:["无光终局","引爆全场暗印；未被标记的敌军也会被刻下一层暗印。"],superRook:["四十五度弹幕","以5层齐射铺满45度扇形，1.5秒内发射60枚普通车弹。"],superQueen:["三路天幕","以连续三路为基准展开三组45度扇形，5层齐射共发射180枚普通后弹。"],superIceRook:["极寒扇幕","45度扇形铺满60枚超级冰弹。"],superFlameRook:["炼狱扇幕","45度扇形铺满60枚超级火弹。"],superPoisonRook:["万菌扇幕","45度扇形铺满60枚超级毒弹。"],superElectricRook:["万雷扇幕","45度扇形铺满60枚无限穿透电能弹。"],superIceQueen:["永冬天幕","三路展开180枚超级冰弹。"],superFlameQueen:["赤日天幕","三路展开180枚超级火弹。"],superPoisonQueen:["万蛊天幕","三路展开180枚超级毒弹。"],superElectricQueen:["雷霆天幕","三路展开180枚无限穿透电能弹。"]
};

// 正式战斗区保持5×9；四周各加一圈仅用于进出场与弹道展示的准备行/列。
const BOARD_RULES = {rows:5,cols:9,prep:1,viewRows:7,viewCols:11,leftFailCenter:-.8};
const RANK_RULES = {scatter:0.28,echoEvery:3,split:0.4,vulnerableSeconds:3,vulnerableMultiplier:1.2,kingHeal:100,royalHeal:150,kingArmor:200,royalArmor:300};
const ICE_SHARD_RULES = {rank3Chance:.25,rank4Chance:.5,cellFreezeChance:.3,freezeSeconds:1.5,slowSeconds:3.5,rank2Bonus:.5};
// 车的五阶专属超装填：命中判定后，本发普通车弹改为 4 连射。
const ROOK_OVERLOAD = {chance:.2,shots:4,interval:.08};
const ABILITY_SPECS = {
  pawn:{kind:"slam",frontCells:2,damage:500},shieldPawn:{kind:"fortress",armor:2000,fullHeal:true},spearPawn:{kind:"rapid",shots:5,interval:.2,damage:350,projectile:"spearVolley"},
  rook:{kind:"rapid",shots:15,interval:.1,damageMin:90,damageMax:120,projectile:"rook"},twinRook:{kind:"rapid",shots:30,interval:.05,damageMin:80,damageMax:120,projectile:"twinRook"},iceRook:{kind:"rapid",shots:15,interval:.1,damage:75,projectile:"iceRook",element:"ice"},flameRook:{kind:"rapid",shots:15,interval:.1,damageMin:135,damageMax:180,projectile:"flameRook",element:"flame"},poisonRook:{kind:"roller",damage:1500,projectile:"giantPoison"},electricRook:{kind:"rapid",shots:15,interval:.1,damage:70,projectile:"electricRook",element:"electric",pierce:true},
  king:{kind:"support",energy:500,fullHeal:true},royalKing:{kind:"support",energy:800,healAll:500},shieldKing:{kind:"support",energy:300,armorAll:450},knight:{kind:"charge",damage:600,maxTargets:5},stormKnight:{kind:"all",damage:600},frostKnight:{kind:"all",damage:420,freezeSeconds:4},bishop:{kind:"diagonal",damage:900},twinBishop:{kind:"diagonal",damage:1100},iceBishop:{kind:"diagonal",damage:650,freezeSeconds:5},flameBishop:{kind:"diagonal",damage:720,burnSeconds:6,burnDps:55},poisonBishop:{kind:"all",damage:180,poisonSeconds:10,poisonDps:65},queen:{kind:"tripleRapid",shots:15,interval:.1,damageMin:90,damageMax:120,projectile:"rook",lanes:3},twinQueen:{kind:"tripleRapid",shots:30,interval:.05,damageMin:70,damageMax:120,projectile:"rook",lanes:3},iceQueen:{kind:"tripleRapid",shots:15,interval:.1,damage:70,projectile:"iceRook",element:"ice",lanes:3},flameQueen:{kind:"tripleRapid",shots:15,interval:.1,damageMin:135,damageMax:180,projectile:"flameRook",element:"flame",lanes:3},poisonQueen:{kind:"tripleRapid",shots:15,interval:.1,damage:55,projectile:"poisonRook",element:"poison",poisonSeconds:8,poisonDps:25,lanes:3},electricQueen:{kind:"tripleRapid",shots:15,interval:.1,damage:65,projectile:"electricRook",element:"electric",pierce:true,lanes:3},prismQueen:{kind:"piercingRapid",shots:15,interval:.1,damage:50,lanes:3,pierce:true},
  berserkerPawn:{kind:"whirl",damage:650,radius:3,healPerHit:120},bombardRook:{kind:"bombard",damage:500,maxTargets:8,splash:.5},warKing:{kind:"command",energy:150,armorAll:300},guardianKnight:{kind:"all",damage:520,freezeSeconds:2.5},lightBishop:{kind:"radiance",damage:400,healAll:650,armorAll:200},shadowQueen:{kind:"all",damage:700,markAll:true},superRook:{kind:"fan",shots:60,perLane:60,rings:5,shotsPerRing:12,ringInterval:.3,duration:1.5,flightSeconds:1.5,damageMin:90,damageMax:120,projectile:"rook",fanDegrees:45,lanes:1},superQueen:{kind:"fan",shots:180,perLane:60,rings:5,shotsPerRing:12,ringInterval:.3,duration:1.5,flightSeconds:1.5,damageMin:90,damageMax:120,projectile:"rook",fanDegrees:45,lanes:3},
  superIceRook:{kind:"fan",shots:60,perLane:60,rings:5,shotsPerRing:12,ringInterval:.3,duration:1.5,flightSeconds:1.5,damageMin:60,damageMax:80,projectile:"iceRook",element:"ice",fanDegrees:45,lanes:1},superFlameRook:{kind:"fan",shots:60,perLane:60,rings:5,shotsPerRing:12,ringInterval:.3,duration:1.5,flightSeconds:1.5,damageMin:135,damageMax:180,projectile:"flameRook",element:"flame",fanDegrees:45,lanes:1},superPoisonRook:{kind:"fan",shots:60,perLane:60,rings:5,shotsPerRing:12,ringInterval:.3,duration:1.5,flightSeconds:1.5,damageMin:45,damageMax:65,projectile:"poisonRook",element:"poison",poisonSeconds:8,poisonDps:35,fanDegrees:45,lanes:1},superElectricRook:{kind:"fan",shots:60,perLane:60,rings:5,shotsPerRing:12,ringInterval:.3,duration:1.5,flightSeconds:1.5,damageMin:55,damageMax:75,projectile:"electricRook",element:"electric",pierce:true,fanDegrees:45,lanes:1},
  superIceQueen:{kind:"fan",shots:180,perLane:60,rings:5,shotsPerRing:12,ringInterval:.3,duration:1.5,flightSeconds:1.5,damageMin:60,damageMax:80,projectile:"iceRook",element:"ice",fanDegrees:45,lanes:3},superFlameQueen:{kind:"fan",shots:180,perLane:60,rings:5,shotsPerRing:12,ringInterval:.3,duration:1.5,flightSeconds:1.5,damageMin:135,damageMax:180,projectile:"flameRook",element:"flame",fanDegrees:45,lanes:3},superPoisonQueen:{kind:"fan",shots:180,perLane:60,rings:5,shotsPerRing:12,ringInterval:.3,duration:1.5,flightSeconds:1.5,damageMin:45,damageMax:65,projectile:"poisonRook",element:"poison",poisonSeconds:8,poisonDps:35,fanDegrees:45,lanes:3},superElectricQueen:{kind:"fan",shots:180,perLane:60,rings:5,shotsPerRing:12,ringInterval:.3,duration:1.5,flightSeconds:1.5,damageMin:55,damageMax:75,projectile:"electricRook",element:"electric",pierce:true,fanDegrees:45,lanes:3}
};

const ENEMIES = {
  soldier: { name: "兵卒", char: "兵", hp: 800, speed: .18, damage: 100, rate: 1.5, intel: "最常见的前锋。生命提高到800，成群出现时会快速挤垮单点防线。", stats:[50,30,20] },
  cannon: { name: "隔子炮", char: "炮", hp: 1100, speed: .13, damage: 150, rate: 2.1, cannon: true, intel: "拥有1100生命，以第一枚棋子为炮架，越过它轰击后方第二枚棋子，炮弹固定造成150伤害。", stats:[60,60,20] },
  horse: { name: "赤马", char: "馬", hp: 1300, speed: .24, damage: 150, rate: 1.4, intel: "生命提高到1300，移动迅速，首次接敌时会向前跳过一个棋位。", stats:[65,45,55] },
  chariot: { name: "诡道铁车", char: "車", hp: 3200, speed: .095, damage: 240, rate: 1.8, teleport: true, intel: "拥有3200生命，每隔5秒保持横向位置不变，随机换入另一条路线。", stats:[95,70,35] },
  guard: { name: "玄士", char: "士", hp: 1800, speed: .12, damage: 90, rate: 1.7, shield: .35, intel: "拥有1800生命，并为附近敌军提供减伤结界。优先消灭它。", stats:[80,30,25] },
  elephant: { name: "八卦相", char: "相", hp: 2800, speed: .105, damage: 120, rate: 1.8, summoner: true, intel: "拥有2800生命。脚下展开八卦阵，每隔10秒在附近召来一枚兵、炮或马；八卦迷阵从第2波起保证登场。", stats:[90,45,20] },
  digger: { name:"掘阵卒", char:"掘", hp:2200, speed:.155, damage:99999, rate:1.4, shoveler:true, flatImmune:true, intel:"举起玄铁铲，完全无视车系与后的平射；接触后直接铲飞我方棋子。用兵近战、马跃击或象弧击破解。", stats:[82,100,34] },
  jester: { name:"镜戏丑", char:"镜", hp:2400, speed:.13, damage:130, rate:1.7, reflector:true, intel:"每5秒展开1.5秒镜幕。镜幕期间远程攻击不会造成伤害，反而会把75%的伤害弹回攻击者。", stats:[84,72,27] },
  shieldGiant: { name:"盾山将", char:"盾", hp:14000, speed:.12, damage:300, rate:1.6, leavesShield:true, beanDrop:1, large:true, intel:"重甲近卫。移动速度已提高一倍；死亡时留下6500生命的盾碑，并有50%概率掉落1枚能量豆。", stats:[100,86,20] },
  iceChariot: { name:"霜辙车", char:"冰", hp:6500, speed:.085, damage:240, rate:1.8, iceTrail:true, intel:"所经棋格会永久结冰。本局中冰格无法再部署棋子，必须提前完成阵型。", stats:[98,70,18] },
  general: { name: "镇国大将", char: "将", hp: 32000, speed: .104, damage: 99999, rate: 1.25, giant: true, intel: "生命提高到32000，体形是普通敌棋的两倍，移动速度已提高一倍。接触我方棋子便直接将其砸扁。", stats:[100,100,16] },
  snake: { name: "紫蛇", char: "蛇", hp: 65000, speed: .13, damage: 360, rate: 1.2, boss: true, regen: 100, intel: "生命提高到65000，移动速度提高一倍。若连续1秒没有受到攻击，之后每秒回复100生命。", stats:[100,100,80] }
};

ENEMIES.iceChariot.beanDrop=1;
ENEMIES.general.beanDrop=2;
ENEMIES.snake.beanDrop=3;
Object.values(ENEMIES).filter(enemy=>enemy.beanDrop).forEach(enemy=>enemy.beanChance=.5);
ENEMIES.iceChariot.intel+=' 被击破时有50%概率掉落1枚能量豆。';
ENEMIES.general.intel+=' 被击破时有50%概率掉落2枚能量豆。';
ENEMIES.snake.intel+=' 被击破时有50%概率掉落3枚能量豆。';

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
  { id:"survival", icon:"六", label:"ENDURANCE", title:"六波坚守", text:"从75能量起步，敌军会逐波增强。撑过全部六波即可获胜。", objective:"目标 · 撑过 6 波", waves:6, energy:75 },
  { id:"rush", icon:"∞", label:"TIME ATTACK", title:"百二十秒", text:"从75能量起步，在120秒内击杀尽可能多的敌人。时间结束后按击杀数结算成绩。", objective:"目标 · 120秒内挑战最高击杀", duration:120, scoreAttack:true, energy:75 },
  { id:"protect", icon:"守", label:"ROYAL GUARD", title:"守护王棋", text:"从75能量起步，保护中央后排王棋并击退五波。", objective:"目标 · 保护特殊王棋", waves:5, protect:true, energy:75 },
  { id:"armored", icon:"甲", label:"ARMORED SIEGE", title:"重甲围城", text:"玄士、铁车、盾山将和镇国大将轮番压境，击破重甲可收集更多能量豆。", objective:"目标 · 击退 5 波重甲军", waves:5, theme:"armored", energy:75 },
  { id:"frozen", icon:"冰", label:"FROZEN BOARD", title:"冰封棋盘", text:"霜辙车会持续冻结部署格。必须抢先完成阵型，并在棋盘封死前守住五波。", objective:"目标 · 冰面封锁下守住 5 波", waves:5, theme:"frozen", energy:75 },
  { id:"trick", icon:"乱", label:"CHAOS FORMATION", title:"镜铲乱阵", text:"换线铁车、掘阵卒、镜戏丑与八卦相混编进攻，考验六枚棋子的克制搭配。", objective:"目标 · 破解 5 波诡阵", waves:5, theme:"trick", energy:75 },
  { id:"goldenArmy", icon:"万", label:"FUN · GOLDEN ARMY", title:"万金重甲阵", text:"开局获得5000能量、棋子无部署冷却。布阵完成后一次放出100名盾山将与镇国大将。", objective:"趣味 · 一次击退 100 名重甲", waves:1, theme:"giantFun", energy:5000, noCooldown:true, setupPhase:true, funBatch:100, fun:true },
  { id:"infiniteGiants", icon:"∞", label:"FUN · INFINITE", title:"无限巨人阵", text:"无限能量、棋子无部署冷却。自由铺满棋盘后，一次迎战100名盾山将和镇国大将。", objective:"趣味 · 无限能量大战百名巨人", waves:1, theme:"giantFun", infiniteEnergy:true, noCooldown:true, setupPhase:true, funBatch:100, fun:true },
  { id:"beanCarnival", icon:"豆", label:"FUN · BEAN CARNIVAL", title:"能量豆狂欢", text:"开局3000能量、3枚能量豆且部署无冷却。完成阵型后一次轰击100名重甲混编军。", objective:"趣味 · 满豆清扫 100 名重甲", waves:1, theme:"beanFun", energy:3000, startingBeans:3, noCooldown:true, setupPhase:true, funBatch:100, fun:true },
  { id:"snakePit", icon:"蛇", label:"FUN · INFINITE ULT", title:"万蛇窟", text:"自由布阵后，所有棋子无视能量豆数量持续释放大招，迎战100–1000条紫蛇。", objective:"趣味 · 可选蛇潮数量 · 无限大招", waves:1, theme:"snakePit", infiniteEnergy:true, noCooldown:true, setupPhase:true, snakePit:true, fun:true }
];

const DIFFICULTIES = {
  novice:{name:"新兵",label:"RECRUIT",desc:"敌军生命与攻击降低，数量较少。",hp:.8,speed:.9,damage:.8,count:.82,spawnInterval:1.18},
  standard:{name:"标准",label:"STANDARD",desc:"按基础参数进行完整对战。",hp:1,speed:1,damage:1,count:1,spawnInterval:1},
  elite:{name:"精英",label:"ELITE",desc:"敌军更硬、更快，波次数量提高。",hp:1.35,speed:1.08,damage:1.2,count:1.2,spawnInterval:.88},
  nightmare:{name:"噩梦",label:"NIGHTMARE",desc:"高耐久、高压迫，敌潮几乎不留空隙。",hp:1.75,speed:1.16,damage:1.45,count:1.4,spawnInterval:.74}
};

const BATTLE_BUFFS = {
  reserve:{name:"王冠储备",label:"RESERVE",icon:"能",desc:"开局额外获得100能量。",energy:100},
  power:{name:"锋刃军令",label:"POWER",icon:"攻",desc:"我方所有伤害提高15%。",damage:1.15},
  haste:{name:"疾行号角",label:"HASTE",icon:"速",desc:"所有攻击棋的攻击频率提高20%。",attackSpeed:1.2},
  logistics:{name:"急行部署",label:"LOGISTICS",icon:"备",desc:"所有棋子的部署冷却缩短35%。",cooldown:.65},
  bean:{name:"豆仓启封",label:"ENERGY BEAN",icon:"豆",desc:"开局直接获得1枚能量豆。",beans:1}
};

const defaults = { storyUnlocked:1, archiveUnlocked:1, lastLoadout:["pawn","rook","king"], ranks:Object.fromEntries(Object.keys(UNITS).map(type=>[type,1])), mastery:Object.fromEntries(Object.keys(UNITS).map(type=>[type,0])), unlockProgress:{iceSculptures:0,meltedIce:0,shieldDamage:0}, specialUnlocked:{} };
