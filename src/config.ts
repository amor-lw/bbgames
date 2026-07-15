export type SkillSlot = "attack" | "u" | "i" | "o";
export type HeroArchetype = "heavy" | "assassin" | "polearm" | "spellblade";
export type SkillForm = "slash" | "cleave" | "smash" | "guard" | "stab" | "thrust" | "arrow" | "orb" | "chain" | "vortex" | "starfall" | "flame" | "clock";

export interface SkillConfig {
  id: string;
  name: string;
  slot: SkillSlot;
  form: SkillForm;
  description: string;
  manaCost: number;
  cooldownMs: number;
  damage: number;
  range: number;
  radius: number;
  knockback: number;
  interrupt: boolean;
  dashDistance?: number;
  durationMs?: number;
  effectKey: "cloud" | "moon" | "star" | "wind" | "seal" | "void";
}

export interface HeroVisual {
  archetype: HeroArchetype;
  primary: number;
  secondary: number;
  accent: number;
  dark: number;
  weapon: "sword" | "axe" | "shield" | "hammer" | "dagger" | "rapier" | "bow" | "chain" | "hidden" | "lance" | "spear" | "halberd" | "glaive" | "magic-sword" | "flame-blade" | "void-blade" | "time-sword";
  aura: "gold" | "blood" | "stone" | "frost" | "moon" | "wind" | "crimson" | "mist" | "holy" | "nether" | "storm" | "dawn" | "star" | "flame" | "void" | "time";
}

export interface HeroConfig {
  id: string;
  name: string;
  title: string;
  portraitGlyph: string;
  maxHp: number;
  maxMana: number;
  speed: number;
  dashSpeed: number;
  manaOnHit: number;
  visual: HeroVisual;
  skills: SkillConfig[];
}

export interface EnemyConfig {
  id: string;
  name: string;
  hp: number;
  damage: number;
  speed: number;
  radius: number;
  tint: number;
  family: "beast" | "spirit" | "armor" | "elite" | "construct" | "void" | "storm" | "holy";
  elite?: boolean;
}

export interface BossPhaseConfig {
  id: "normal" | "enraged";
  name: string;
  threshold: number;
  speed: number;
  damageMultiplier: number;
  attackIntervalMs: number;
  skillPool: Array<"cleave" | "quake" | "seek" | "channel">;
}

export interface LevelWave {
  label: string;
  enemies: Array<{ enemyId: string; count: number }>;
}

export interface LevelConfig {
  id: string;
  name: string;
  subtitle: string;
  theme: "castle" | "desert" | "frost" | "fortress" | "mist" | "void" | "storm" | "sanctum";
  palette: {
    skyTop: number;
    skyBottom: number;
    ground: number;
    line: number;
    glow: number;
    accent: number;
  };
  unlocks?: string;
  waves: LevelWave[];
  bossId: string;
}

type HeroSeed = Omit<HeroConfig, "skills"> & {
  dashName: string;
  sweepName: string;
  ultimateName: string;
  effectKey: SkillConfig["effectKey"];
};

function makeSkills(seed: HeroSeed): SkillConfig[] {
  const heavy = seed.visual.archetype === "heavy";
  const assassin = seed.visual.archetype === "assassin";
  const polearm = seed.visual.archetype === "polearm";
  const auraMods: Record<HeroVisual["aura"], { power: number; reach: number; cooldown: number; radius: number; dash: number }> = {
    gold: { power: 1.08, reach: 1.03, cooldown: 1.04, radius: 1.02, dash: 0.95 },
    blood: { power: 1.15, reach: 0.96, cooldown: 1.08, radius: 1.05, dash: 0.92 },
    stone: { power: 1.04, reach: 0.94, cooldown: 1.1, radius: 1.14, dash: 0.86 },
    frost: { power: 1.02, reach: 1, cooldown: 1.05, radius: 1.18, dash: 0.9 },
    moon: { power: 0.98, reach: 1.08, cooldown: 0.9, radius: 0.96, dash: 1.16 },
    wind: { power: 0.95, reach: 1.06, cooldown: 0.84, radius: 0.94, dash: 1.22 },
    crimson: { power: 1.08, reach: 1.12, cooldown: 0.96, radius: 1.02, dash: 1.05 },
    mist: { power: 0.96, reach: 1.02, cooldown: 0.86, radius: 0.92, dash: 1.25 },
    holy: { power: 1.06, reach: 1.15, cooldown: 1, radius: 1, dash: 1.02 },
    nether: { power: 1.04, reach: 1.18, cooldown: 1.02, radius: 0.98, dash: 0.98 },
    storm: { power: 1.1, reach: 1.1, cooldown: 0.94, radius: 1.04, dash: 1.08 },
    dawn: { power: 1.02, reach: 1.16, cooldown: 0.98, radius: 1.08, dash: 1 },
    star: { power: 1.06, reach: 1.08, cooldown: 0.98, radius: 1.08, dash: 1 },
    flame: { power: 1.14, reach: 1, cooldown: 1.03, radius: 1.1, dash: 1.02 },
    void: { power: 1.03, reach: 1.18, cooldown: 0.92, radius: 0.95, dash: 1.15 },
    time: { power: 1, reach: 1.1, cooldown: 0.88, radius: 1, dash: 1.08 }
  };
  const mod = auraMods[seed.visual.aura];
  const round = (value: number) => Math.round(value);
  const basicForm: SkillForm =
    seed.visual.weapon === "bow" ? "arrow" :
      seed.visual.weapon === "chain" ? "chain" :
        seed.visual.weapon === "shield" ? "guard" :
          seed.visual.weapon === "hammer" ? "smash" :
            seed.visual.weapon === "axe" || seed.visual.weapon === "halberd" || seed.visual.weapon === "glaive" ? "cleave" :
              seed.visual.weapon === "lance" || seed.visual.weapon === "spear" || seed.visual.weapon === "rapier" ? "thrust" :
                seed.visual.weapon === "magic-sword" ? "orb" :
                  seed.visual.weapon === "flame-blade" ? "flame" :
                    seed.visual.weapon === "void-blade" ? "vortex" :
                      seed.visual.weapon === "time-sword" ? "clock" : "slash";
  const uForm: SkillForm =
    seed.visual.aura === "stone" ? "guard" :
      seed.visual.aura === "blood" || seed.visual.aura === "frost" ? "smash" :
        seed.visual.aura === "crimson" ? "chain" :
          seed.visual.aura === "star" ? "starfall" :
            seed.visual.aura === "flame" ? "flame" :
              seed.visual.aura === "void" || seed.visual.aura === "nether" ? "vortex" :
                seed.visual.weapon === "bow" ? "arrow" : basicForm;
  const iForm: SkillForm =
    seed.visual.weapon === "bow" ? "arrow" :
      seed.visual.weapon === "chain" ? "chain" :
        seed.visual.aura === "star" ? "starfall" :
          seed.visual.aura === "flame" ? "flame" :
            seed.visual.aura === "void" || seed.visual.aura === "nether" ? "vortex" :
              seed.visual.aura === "time" ? "clock" :
                polearm ? "thrust" : heavy ? "cleave" : "slash";
  const oForm: SkillForm =
    seed.visual.aura === "star" ? "starfall" :
      seed.visual.aura === "flame" ? "flame" :
        seed.visual.aura === "void" || seed.visual.aura === "nether" ? "vortex" :
          seed.visual.aura === "time" ? "clock" :
            seed.visual.aura === "crimson" ? "chain" :
              seed.visual.aura === "stone" ? "guard" :
                seed.visual.weapon === "bow" ? "arrow" : "smash";
  const skills: SkillConfig[] = [
    {
      id: "basic",
      name: heavy ? "沉锋三斩" : assassin ? "流影三击" : polearm ? "纵锋三连" : "流云三斩",
      slot: "attack",
      form: basicForm,
      description: basicForm === "arrow" ? "连射像素箭矢，直线穿透回蓝。" : basicForm === "orb" ? "释放星术法球，命中后爆成星屑。" : basicForm === "chain" ? "锁链普攻，远距离抽击并留下印记。" : "三段普攻，回蓝并留下像素剑气。",
      manaCost: 0,
      cooldownMs: round((heavy ? 310 : assassin ? 220 : 260) * mod.cooldown),
      damage: round((heavy ? 28 : assassin ? 19 : 23) * mod.power),
      range: round((heavy ? 88 : 82) * mod.reach),
      radius: round((heavy ? 42 : 36) * mod.radius),
      knockback: round((heavy ? 125 : 90) * (heavy ? 1.08 : 1)),
      interrupt: false,
      effectKey: seed.effectKey
    },
    {
      id: "dash",
      name: seed.dashName,
      slot: "u",
      form: uForm,
      description: "踏空掠行，穿刺路径敌人。",
      manaCost: 18,
      cooldownMs: round((assassin ? 3600 : 4300) * mod.cooldown),
      damage: round((assassin ? 42 : 38) * mod.power),
      range: round(150 * mod.reach),
      radius: round(46 * mod.radius),
      knockback: round(165 * (heavy ? 1.16 : 1)),
      interrupt: false,
      dashDistance: round((assassin ? 215 : polearm ? 195 : 180) * mod.dash),
      effectKey: seed.effectKey
    },
    {
      id: "sweep",
      name: seed.sweepName,
      slot: "i",
      form: iForm,
      description: "大范围剑气铺开，清理群敌。",
      manaCost: 26,
      cooldownMs: round(5600 * mod.cooldown),
      damage: round((heavy ? 62 : 54) * mod.power),
      range: round((polearm ? 155 : 130) * mod.reach),
      radius: round((polearm ? 108 : 96) * mod.radius),
      knockback: round((heavy ? 240 : 210) * (polearm ? 1.08 : 1)),
      interrupt: false,
      effectKey: seed.effectKey === "wind" ? "moon" : seed.effectKey
    },
    {
      id: "ultimate",
      name: seed.ultimateName,
      slot: "o",
      form: oForm,
      description: "专属大范围必杀，可打断BOSS蓄力。",
      manaCost: 80,
      cooldownMs: round(28000 * mod.cooldown),
      damage: round(155 * mod.power),
      range: round(260 * mod.reach),
      radius: round(178 * mod.radius),
      knockback: round(320 * (heavy ? 1.12 : assassin ? 0.92 : 1)),
      interrupt: true,
      durationMs: 900,
      effectKey: seed.effectKey
    }
  ];
  const u = skills[1];
  const i = skills[2];
  const o = skills[3];
  const groundedAuras: HeroVisual["aura"][] = ["blood", "stone", "frost", "crimson", "nether", "star", "flame", "time"];
  if (groundedAuras.includes(seed.visual.aura)) {
    delete u.dashDistance;
    u.range = round((seed.visual.aura === "crimson" ? 190 : seed.visual.aura === "star" ? 230 : 92) * mod.reach);
    u.radius = round((seed.visual.aura === "stone" || seed.visual.aura === "frost" ? 120 : 78) * mod.radius);
    u.damage = round((seed.visual.aura === "stone" ? 22 : 46) * mod.power);
  }
  if (seed.visual.aura === "stone") u.description = "立盾筑阵，短暂护体并震开周围敌人。";
  if (seed.visual.aura === "blood") u.description = "原地旋斧饮血，命中后回流生命。";
  if (seed.visual.aura === "frost") u.description = "巨锤砸地，制造霜裂并迟滞敌群。";
  if (seed.visual.aura === "crimson") u.description = "锁链远缚，把敌人打上持续削弱印记。";
  if (seed.visual.aura === "nether" || seed.visual.aura === "void") u.description = "展开裂隙牵引，把敌人拖向虚空中心。";
  if (seed.visual.aura === "star") u.description = "抬剑引星，落下多枚星轨像素陨光。";
  if (seed.visual.aura === "flame") i.description = "火浪连续铺开，造成多段燃烧压制。";
  if (seed.visual.aura === "time") {
    u.description = "展开时隙，使区域内敌人短暂迟缓。";
    o.description = "时轮复写，必杀后再次回响一次伤害。";
  }
  if (seed.visual.aura === "wind") {
    u.form = "arrow";
    i.form = "arrow";
    o.form = "arrow";
    u.cooldownMs = round(2500 * mod.cooldown);
    i.range = round(220 * mod.reach);
    i.radius = round(62 * mod.radius);
    i.description = "长线风切，偏直线高速穿透。";
  }
  if (seed.visual.aura === "holy" || seed.visual.aura === "dawn") {
    o.interrupt = true;
    o.knockback = round(o.knockback * 1.22);
  }
  return skills;
}

const heroSeeds: HeroSeed[] = [
  { id: "golden-greatsword", name: "鎏金重剑骑士", title: "重剑藏逍遥，圣殿金辉化作长河剑气", portraitGlyph: "金", maxHp: 760, maxMana: 105, speed: 218, dashSpeed: 650, manaOnHit: 10, visual: { archetype: "heavy", primary: 0xd9a441, secondary: 0x38455e, accent: 0xffe6a3, dark: 0x1a2130, weapon: "sword", aura: "gold" }, dashName: "鎏金掠影", sweepName: "圣河横澜", ultimateName: "金冕裁天", effectKey: "star" },
  { id: "iron-axe", name: "幽铁战斧狂战士", title: "旋斧如回风落叶，狂暴中仍有洒脱章法", portraitGlyph: "斧", maxHp: 790, maxMana: 95, speed: 225, dashSpeed: 645, manaOnHit: 11, visual: { archetype: "heavy", primary: 0x6b2730, secondary: 0x2f333b, accent: 0xff6655, dark: 0x15171b, weapon: "axe", aura: "blood" }, dashName: "血霞踏斩", sweepName: "回风裂阵", ultimateName: "幽铁断岳", effectKey: "seal" },
  { id: "stone-warden", name: "磐石盾卫领主", title: "守如山岳，反击时盾刃齐出，稳而不僵", portraitGlyph: "盾", maxHp: 860, maxMana: 100, speed: 205, dashSpeed: 610, manaOnHit: 10, visual: { archetype: "heavy", primary: 0x8c8572, secondary: 0x334047, accent: 0xcabf9d, dark: 0x20251f, weapon: "shield", aura: "stone" }, dashName: "山纹踏阵", sweepName: "磐锋横澜", ultimateName: "万壑归盾", effectKey: "cloud" },
  { id: "frost-hammer", name: "寒霜巨锤战士", title: "重击凝霜成画，踏雪腾转清冷飘逸", portraitGlyph: "霜", maxHp: 810, maxMana: 110, speed: 212, dashSpeed: 630, manaOnHit: 10, visual: { archetype: "heavy", primary: 0x82c9e7, secondary: 0x34445c, accent: 0xe9fbff, dark: 0x17202e, weapon: "hammer", aura: "frost" }, dashName: "踏雪掠影", sweepName: "霜澜碎阵", ultimateName: "寒山坠月", effectKey: "moon" },
  { id: "moon-daggers", name: "月影双刺刺客", title: "月下掠影，背刺如月影偷锋，进退无痕", portraitGlyph: "月", maxHp: 560, maxMana: 130, speed: 292, dashSpeed: 780, manaOnHit: 8, visual: { archetype: "assassin", primary: 0xbec7ff, secondary: 0x242943, accent: 0xf1f5ff, dark: 0x101423, weapon: "dagger", aura: "moon" }, dashName: "月影瞬身", sweepName: "弦月清场", ultimateName: "孤月封喉", effectKey: "moon" },
  { id: "wind-rapier", name: "风翼弓游侠", title: "御风开弓，箭路如云线穿城", portraitGlyph: "弓", maxHp: 600, maxMana: 128, speed: 305, dashSpeed: 800, manaOnHit: 8, visual: { archetype: "assassin", primary: 0x72e0c2, secondary: 0x263e4c, accent: 0xd8fff4, dark: 0x10231e, weapon: "bow", aura: "wind" }, dashName: "风步定弦", sweepName: "千羽齐射", ultimateName: "风翼箭雨", effectKey: "wind" },
  { id: "crimson-chain", name: "猩红锁链猎手", title: "锁链挥洒如软剑，凌空缠绕诡雅灵动", portraitGlyph: "链", maxHp: 640, maxMana: 120, speed: 270, dashSpeed: 720, manaOnHit: 9, visual: { archetype: "assassin", primary: 0xc93b4d, secondary: 0x2b1b24, accent: 0xff9aa4, dark: 0x160b10, weapon: "chain", aura: "crimson" }, dashName: "赤链穿梭", sweepName: "游蛇横澜", ultimateName: "猩红缚月", effectKey: "seal" },
  { id: "mist-blade", name: "雾隐瞬杀者", title: "雾里藏锋，现身即是一剑封喉", portraitGlyph: "雾", maxHp: 570, maxMana: 136, speed: 300, dashSpeed: 820, manaOnHit: 8, visual: { archetype: "assassin", primary: 0x9bb4c3, secondary: 0x1c2532, accent: 0xe6f7ff, dark: 0x0d1218, weapon: "hidden", aura: "mist" }, dashName: "雾隐瞬步", sweepName: "烟霞封锋", ultimateName: "无声一线", effectKey: "void" },
  { id: "holy-lance", name: "圣辉枪骑士", title: "长枪如龙，域外枪仙般利落超然", portraitGlyph: "枪", maxHp: 700, maxMana: 112, speed: 245, dashSpeed: 700, manaOnHit: 9, visual: { archetype: "polearm", primary: 0xf0d16f, secondary: 0x36405a, accent: 0xffffd0, dark: 0x151b2a, weapon: "lance", aura: "holy" }, dashName: "圣枪掠阵", sweepName: "辉龙横扫", ultimateName: "星落圣枪", effectKey: "star" },
  { id: "nether-spear", name: "幽冥长枪督军", title: "冥气如墨，点刺似笔走龙蛇", portraitGlyph: "冥", maxHp: 690, maxMana: 118, speed: 238, dashSpeed: 690, manaOnHit: 9, visual: { archetype: "polearm", primary: 0x6d5b9e, secondary: 0x202033, accent: 0xc7b9ff, dark: 0x0e0e18, weapon: "spear", aura: "nether" }, dashName: "冥枪踏影", sweepName: "墨锋横澜", ultimateName: "幽冥点龙", effectKey: "void" },
  { id: "storm-halberd", name: "雷霆戟战将", title: "雷戟破空如惊鸿，刚劲又洒脱", portraitGlyph: "雷", maxHp: 720, maxMana: 110, speed: 240, dashSpeed: 705, manaOnHit: 9, visual: { archetype: "polearm", primary: 0x7bc7ff, secondary: 0x26324a, accent: 0xfff36c, dark: 0x111827, weapon: "halberd", aura: "storm" }, dashName: "雷戟破空", sweepName: "电弧横澜", ultimateName: "九霄雷裁", effectKey: "wind" },
  { id: "dawn-glaive", name: "破晓长戈统帅", title: "戈锋扫处驱散阴霾，正气飘然", portraitGlyph: "晓", maxHp: 735, maxMana: 112, speed: 232, dashSpeed: 690, manaOnHit: 9, visual: { archetype: "polearm", primary: 0xf2b05e, secondary: 0x33485a, accent: 0xffefd0, dark: 0x201915, weapon: "glaive", aura: "dawn" }, dashName: "破晓进军", sweepName: "晨辉横澜", ultimateName: "长戈开天", effectKey: "star" },
  { id: "starblade", name: "星轨魔剑师", title: "以星力铸剑气，腾身漫步星域", portraitGlyph: "星", maxHp: 660, maxMana: 120, speed: 245, dashSpeed: 700, manaOnHit: 9, visual: { archetype: "spellblade", primary: 0x75c7ff, secondary: 0x26314f, accent: 0xffe48a, dark: 0x101525, weapon: "magic-sword", aura: "star" }, dashName: "星轨掠影", sweepName: "群星横澜", ultimateName: "星垂裁夜", effectKey: "star" },
  { id: "flame-spellsword", name: "炽焰咒剑士", title: "纵跃火浪之上，热烈不羁的火中剑仙", portraitGlyph: "焰", maxHp: 650, maxMana: 122, speed: 248, dashSpeed: 710, manaOnHit: 9, visual: { archetype: "spellblade", primary: 0xff7448, secondary: 0x3b2022, accent: 0xffd070, dark: 0x1d0d0b, weapon: "flame-blade", aura: "flame" }, dashName: "焰浪掠影", sweepName: "赤焰横澜", ultimateName: "火莲裁夜", effectKey: "seal" },
  { id: "void-blade", name: "虚空幻刃师", title: "错位斩击虚实难辨，超脱凡尘", portraitGlyph: "虚", maxHp: 620, maxMana: 135, speed: 265, dashSpeed: 760, manaOnHit: 8, visual: { archetype: "spellblade", primary: 0xa77cff, secondary: 0x1c1732, accent: 0xf1dcff, dark: 0x0d0a17, weapon: "void-blade", aura: "void" }, dashName: "虚空错步", sweepName: "幻刃横澜", ultimateName: "裂隙无归", effectKey: "void" },
  { id: "time-sword", name: "时序圣剑士", title: "慢斩光阴、回溯身形，格调超然", portraitGlyph: "时", maxHp: 675, maxMana: 132, speed: 248, dashSpeed: 725, manaOnHit: 9, visual: { archetype: "spellblade", primary: 0xe7d8a0, secondary: 0x2b3345, accent: 0xaee7ff, dark: 0x131720, weapon: "time-sword", aura: "time" }, dashName: "时隙掠影", sweepName: "光阴横澜", ultimateName: "时轮圣裁", effectKey: "cloud" }
];

const featuredHeroIds = new Set([
  "golden-greatsword",
  "iron-axe",
  "stone-warden",
  "moon-daggers",
  "wind-rapier",
  "crimson-chain",
  "holy-lance",
  "starblade"
]);

export const heroes: HeroConfig[] = heroSeeds
  .filter((seed) => featuredHeroIds.has(seed.id))
  .map((seed) => ({ ...seed, skills: makeSkills(seed) }));

export const starbladeHero: HeroConfig = heroes.find((hero) => hero.id === "starblade") ?? heroes[0];

export function getHeroById(id: string): HeroConfig {
  return heroes.find((hero) => hero.id === id) ?? starbladeHero;
}

export const heroRoster = heroes.map((hero) => hero.name);

export const enemies: Record<string, EnemyConfig> = {
  imp: { id: "imp", name: "暮爪魔仆", hp: 68, damage: 14, speed: 108, radius: 18, tint: 0x8c4f37, family: "beast" },
  duskArcher: { id: "duskArcher", name: "暮庭弩魔", hp: 72, damage: 18, speed: 120, radius: 17, tint: 0xb86a3d, family: "beast" },
  wraith: { id: "wraith", name: "雾影怨灵", hp: 56, damage: 13, speed: 148, radius: 16, tint: 0x7f92aa, family: "spirit" },
  bellHaunt: { id: "bellHaunt", name: "丧钟幽影", hp: 92, damage: 21, speed: 134, radius: 18, tint: 0xb7c4d9, family: "spirit" },
  knight: { id: "knight", name: "锈甲禁卫", hp: 122, damage: 20, speed: 86, radius: 22, tint: 0x9f8b68, family: "armor" },
  elite: { id: "elite", name: "落霞守门将", hp: 280, damage: 29, speed: 98, radius: 29, tint: 0xd7a64c, family: "elite", elite: true },
  fogling: { id: "fogling", name: "雾魇游魂", hp: 82, damage: 17, speed: 164, radius: 17, tint: 0x89b6c8, family: "spirit" },
  cloudMaw: { id: "cloudMaw", name: "云口吞灵", hp: 120, damage: 24, speed: 128, radius: 21, tint: 0xc0d7dd, family: "spirit" },
  cliffStalker: { id: "cliffStalker", name: "峭壁影猎", hp: 96, damage: 19, speed: 142, radius: 19, tint: 0x5f7f86, family: "beast" },
  mistSentinel: { id: "mistSentinel", name: "雾峰石卫", hp: 180, damage: 26, speed: 82, radius: 25, tint: 0x9bb4c3, family: "construct" },
  mistElite: { id: "mistElite", name: "雾峰门将", hp: 390, damage: 36, speed: 104, radius: 31, tint: 0xdff7ff, family: "elite", elite: true },
  sandFiend: { id: "sandFiend", name: "赤沙裂兽", hp: 118, damage: 23, speed: 138, radius: 20, tint: 0xd9783d, family: "beast" },
  glassScorpion: { id: "glassScorpion", name: "琉砂蝎", hp: 138, damage: 29, speed: 150, radius: 19, tint: 0xffb36a, family: "beast" },
  emberWitch: { id: "emberWitch", name: "余烬咒灵", hp: 102, damage: 25, speed: 116, radius: 18, tint: 0xff8a4a, family: "spirit" },
  duneGuard: { id: "duneGuard", name: "荒原戟卫", hp: 210, damage: 31, speed: 88, radius: 25, tint: 0xb56d42, family: "armor" },
  emberElite: { id: "emberElite", name: "赤沙守门将", hp: 470, damage: 43, speed: 98, radius: 32, tint: 0xffc06a, family: "elite", elite: true },
  frostHusk: { id: "frostHusk", name: "霜壳亡兵", hp: 145, damage: 27, speed: 105, radius: 21, tint: 0x82c9e7, family: "armor" },
  iceWisp: { id: "iceWisp", name: "冰焰浮灵", hp: 104, damage: 28, speed: 166, radius: 17, tint: 0xe9fbff, family: "spirit" },
  frostBat: { id: "frostBat", name: "霜翼尖啸者", hp: 112, damage: 30, speed: 184, radius: 18, tint: 0xb6ecff, family: "beast" },
  glacierBrute: { id: "glacierBrute", name: "冰岩巨仆", hp: 270, damage: 39, speed: 74, radius: 29, tint: 0x7ebde6, family: "construct" },
  frostElite: { id: "frostElite", name: "寒牢典狱", hp: 560, damage: 51, speed: 92, radius: 34, tint: 0xcdf7ff, family: "elite", elite: true },
  gearCrawler: { id: "gearCrawler", name: "齿轮爬虫", hp: 135, damage: 30, speed: 158, radius: 18, tint: 0xa0745c, family: "construct" },
  rivetSpider: { id: "rivetSpider", name: "铆钉机蛛", hp: 165, damage: 35, speed: 150, radius: 20, tint: 0xc18b66, family: "construct" },
  ironGunner: { id: "ironGunner", name: "幽铁铳卫", hp: 210, damage: 36, speed: 96, radius: 23, tint: 0x9f8b68, family: "armor" },
  furnaceKnight: { id: "furnaceKnight", name: "熔炉重骑", hp: 330, damage: 48, speed: 82, radius: 31, tint: 0xffa45f, family: "armor" },
  ironElite: { id: "ironElite", name: "黑铁执政官", hp: 680, damage: 61, speed: 86, radius: 36, tint: 0xffc18a, family: "elite", elite: true },
  voidLeech: { id: "voidLeech", name: "裂隙噬影", hp: 160, damage: 38, speed: 172, radius: 18, tint: 0xa77cff, family: "void" },
  prismEye: { id: "prismEye", name: "棱镜独眼", hp: 190, damage: 48, speed: 136, radius: 20, tint: 0xd8bdff, family: "void" },
  mirrorAcolyte: { id: "mirrorAcolyte", name: "镜面侍祭", hp: 230, damage: 44, speed: 124, radius: 22, tint: 0xf1dcff, family: "void" },
  abyssGuard: { id: "abyssGuard", name: "深渊圣卫", hp: 390, damage: 58, speed: 90, radius: 31, tint: 0x8f6bff, family: "void" },
  voidElite: { id: "voidElite", name: "虚空主祭", hp: 820, damage: 73, speed: 96, radius: 36, tint: 0xd8bdff, family: "elite", elite: true },
  sparkHound: { id: "sparkHound", name: "雷火猎犬", hp: 190, damage: 45, speed: 188, radius: 20, tint: 0x7bc7ff, family: "storm" },
  coilImp: { id: "coilImp", name: "线圈雷仆", hp: 175, damage: 50, speed: 168, radius: 19, tint: 0xfff36c, family: "storm" },
  thunderMage: { id: "thunderMage", name: "雷云术士", hp: 270, damage: 54, speed: 128, radius: 23, tint: 0xfff36c, family: "storm" },
  stormDragoon: { id: "stormDragoon", name: "风暴龙骑", hp: 470, damage: 69, speed: 104, radius: 33, tint: 0x4db3ff, family: "storm" },
  stormElite: { id: "stormElite", name: "雷门战将", hp: 980, damage: 88, speed: 108, radius: 39, tint: 0xd7f2ff, family: "elite", elite: true },
  saintShard: { id: "saintShard", name: "圣辉碎像", hp: 230, damage: 56, speed: 142, radius: 22, tint: 0xf0d16f, family: "holy" },
  censerSpirit: { id: "censerSpirit", name: "圣炉香灵", hp: 260, damage: 64, speed: 132, radius: 22, tint: 0xfff2a8, family: "holy" },
  oathKnight: { id: "oathKnight", name: "誓约圣骑", hp: 520, damage: 78, speed: 98, radius: 34, tint: 0xffffd0, family: "holy" },
  starSeraph: { id: "starSeraph", name: "星尘炽天使", hp: 390, damage: 82, speed: 152, radius: 28, tint: 0xe3bf6a, family: "holy" },
  saintElite: { id: "saintElite", name: "圣裁近卫", hp: 1180, damage: 104, speed: 116, radius: 42, tint: 0xfff2a8, family: "elite", elite: true }
};

export const bossPhases: BossPhaseConfig[] = [
  {
    id: "normal",
    name: "圣裁骑士 常态",
    threshold: 1,
    speed: 92,
    damageMultiplier: 1,
    attackIntervalMs: 1900,
    skillPool: ["cleave", "quake", "channel"]
  },
  {
    id: "enraged",
    name: "圣裁骑士 狂暴",
    threshold: 0.48,
    speed: 122,
    damageMultiplier: 1.35,
    attackIntervalMs: 1250,
    skillPool: ["cleave", "quake", "seek", "channel"]
  }
];

const sunsetWaves: LevelWave[] = [
  { label: "第一波 | 暮爪涌入", enemies: [{ enemyId: "imp", count: 4 }] },
  { label: "第二波 | 雾影绕庭", enemies: [{ enemyId: "wraith", count: 4 }, { enemyId: "duskArcher", count: 3 }] },
  { label: "第三波 | 锈甲列阵", enemies: [{ enemyId: "knight", count: 3 }, { enemyId: "bellHaunt", count: 3 }] },
  { label: "精英 | 门将拦路", enemies: [{ enemyId: "elite", count: 1 }, { enemyId: "knight", count: 2 }] }
];

export const levels: LevelConfig[] = [
  {
    id: "sunset-court",
    name: "落霞古堡外庭",
    subtitle: "孤月悬在破碎城垛上，风从旧战旗间穿过。",
    theme: "castle",
    palette: { skyTop: 0x0a0d15, skyBottom: 0x2b2020, ground: 0x151b25, line: 0xd7bd76, glow: 0xf5e6ac, accent: 0xc99438 },
    unlocks: "mist-peak",
    bossId: "verdict-knight",
    waves: sunsetWaves
  },
  {
    id: "mist-peak",
    name: "雾绕险峰",
    subtitle: "古堡断桥之后，云雾缠住悬崖和残破石阶。",
    theme: "mist",
    palette: { skyTop: 0x0b1218, skyBottom: 0x20313a, ground: 0x132126, line: 0x9bb4c3, glow: 0xdff7ff, accent: 0x7fb6c8 },
    unlocks: "ember-desert",
    bossId: "mist-warden",
    waves: [
      { label: "第一波 | 雾魇游魂", enemies: [{ enemyId: "fogling", count: 5 }] },
      { label: "第二波 | 峭壁影猎", enemies: [{ enemyId: "cliffStalker", count: 4 }, { enemyId: "cloudMaw", count: 3 }] },
      { label: "第三波 | 雾峰石卫", enemies: [{ enemyId: "mistSentinel", count: 3 }, { enemyId: "cliffStalker", count: 3 }] },
      { label: "精英 | 雾峰门将", enemies: [{ enemyId: "mistElite", count: 1 }, { enemyId: "fogling", count: 4 }] }
    ]
  },
  {
    id: "ember-desert",
    name: "落霞荒原",
    subtitle: "赤沙吞没旧王道，远处残阳像熔金一样沉下。",
    theme: "desert",
    palette: { skyTop: 0x241319, skyBottom: 0x6c3821, ground: 0x3b261a, line: 0xf2a65e, glow: 0xffd08a, accent: 0xd9783d },
    unlocks: "frost-keep",
    bossId: "ember-colossus",
    waves: [
      { label: "第一波 | 赤沙裂兽", enemies: [{ enemyId: "sandFiend", count: 6 }] },
      { label: "第二波 | 余烬咒灵", enemies: [{ enemyId: "emberWitch", count: 4 }, { enemyId: "glassScorpion", count: 4 }] },
      { label: "第三波 | 荒原戟卫", enemies: [{ enemyId: "duneGuard", count: 4 }, { enemyId: "emberWitch", count: 3 }] },
      { label: "精英 | 赤沙守门将", enemies: [{ enemyId: "emberElite", count: 1 }, { enemyId: "duneGuard", count: 2 }] }
    ]
  },
  {
    id: "frost-keep",
    name: "寒霜边堡",
    subtitle: "冰原尽头的边堡仍燃着蓝火，雪光照亮铁门。",
    theme: "frost",
    palette: { skyTop: 0x09131f, skyBottom: 0x19304a, ground: 0x102033, line: 0x82c9e7, glow: 0xe9fbff, accent: 0x7ebde6 },
    unlocks: "iron-fortress",
    bossId: "frost-jailer",
    waves: [
      { label: "第一波 | 冰焰浮灵", enemies: [{ enemyId: "iceWisp", count: 4 }, { enemyId: "frostBat", count: 3 }] },
      { label: "第二波 | 霜壳亡兵", enemies: [{ enemyId: "frostHusk", count: 5 }, { enemyId: "iceWisp", count: 4 }] },
      { label: "第三波 | 冰岩巨仆", enemies: [{ enemyId: "glacierBrute", count: 3 }, { enemyId: "frostHusk", count: 4 }] },
      { label: "精英 | 寒牢典狱", enemies: [{ enemyId: "frostElite", count: 1 }, { enemyId: "iceWisp", count: 5 }] }
    ]
  },
  {
    id: "iron-fortress",
    name: "幽铁要塞",
    subtitle: "巨型齿轮和黑铁栈桥轰鸣，火星沿城墙坠落。",
    theme: "fortress",
    palette: { skyTop: 0x0b0d12, skyBottom: 0x292226, ground: 0x17191d, line: 0x9f8b68, glow: 0xffa45f, accent: 0xb56d42 },
    unlocks: "void-chapel",
    bossId: "iron-exarch",
    waves: [
      { label: "第一波 | 齿轮爬虫", enemies: [{ enemyId: "gearCrawler", count: 8 }] },
      { label: "第二波 | 幽铁铳卫", enemies: [{ enemyId: "ironGunner", count: 5 }, { enemyId: "rivetSpider", count: 5 }] },
      { label: "第三波 | 熔炉重骑", enemies: [{ enemyId: "furnaceKnight", count: 4 }, { enemyId: "ironGunner", count: 3 }] },
      { label: "精英 | 黑铁执政官", enemies: [{ enemyId: "ironElite", count: 1 }, { enemyId: "furnaceKnight", count: 2 }] }
    ]
  },
  {
    id: "void-chapel",
    name: "虚空礼拜堂",
    subtitle: "裂隙悬在尖拱穹顶间，圣像的影子被拉成碎片。",
    theme: "void",
    palette: { skyTop: 0x090713, skyBottom: 0x241a44, ground: 0x11101c, line: 0xa77cff, glow: 0xf1dcff, accent: 0x8f6bff },
    unlocks: "thunder-gate",
    bossId: "void-prelate",
    waves: [
      { label: "第一波 | 裂隙噬影", enemies: [{ enemyId: "voidLeech", count: 8 }] },
      { label: "第二波 | 镜面侍祭", enemies: [{ enemyId: "mirrorAcolyte", count: 5 }, { enemyId: "prismEye", count: 5 }] },
      { label: "第三波 | 深渊圣卫", enemies: [{ enemyId: "abyssGuard", count: 4 }, { enemyId: "mirrorAcolyte", count: 4 }] },
      { label: "精英 | 虚空主祭", enemies: [{ enemyId: "voidElite", count: 1 }, { enemyId: "abyssGuard", count: 2 }] }
    ]
  },
  {
    id: "thunder-gate",
    name: "雷云关隘",
    subtitle: "高墙插入雷云，电光像长鞭一样抽过旗阵。",
    theme: "storm",
    palette: { skyTop: 0x07101a, skyBottom: 0x172946, ground: 0x101722, line: 0x7bc7ff, glow: 0xfff36c, accent: 0x4db3ff },
    unlocks: "saint-sanctum",
    bossId: "storm-general",
    waves: [
      { label: "第一波 | 雷火猎犬", enemies: [{ enemyId: "sparkHound", count: 9 }] },
      { label: "第二波 | 雷云术士", enemies: [{ enemyId: "thunderMage", count: 6 }, { enemyId: "coilImp", count: 5 }] },
      { label: "第三波 | 风暴龙骑", enemies: [{ enemyId: "stormDragoon", count: 4 }, { enemyId: "thunderMage", count: 4 }] },
      { label: "精英 | 雷门战将", enemies: [{ enemyId: "stormElite", count: 1 }, { enemyId: "stormDragoon", count: 2 }] }
    ]
  },
  {
    id: "saint-sanctum",
    name: "圣裁王座",
    subtitle: "王座厅铺满星尘与断剑，最终审判在圣光下醒来。",
    theme: "sanctum",
    palette: { skyTop: 0x111018, skyBottom: 0x3a2e47, ground: 0x181520, line: 0xf0d16f, glow: 0xffffd0, accent: 0xe3bf6a },
    bossId: "saint-verdict",
    waves: [
      { label: "第一波 | 圣辉碎像", enemies: [{ enemyId: "saintShard", count: 10 }] },
      { label: "第二波 | 誓约圣骑", enemies: [{ enemyId: "oathKnight", count: 5 }, { enemyId: "censerSpirit", count: 6 }] },
      { label: "第三波 | 星尘炽天使", enemies: [{ enemyId: "starSeraph", count: 5 }, { enemyId: "oathKnight", count: 4 }] },
      { label: "精英 | 圣裁近卫", enemies: [{ enemyId: "saintElite", count: 2 }, { enemyId: "starSeraph", count: 3 }] }
    ]
  }
];

export const levelOne: LevelConfig = levels[0];

export function getLevelById(id: string): LevelConfig {
  return levels.find((level) => level.id === id) ?? levelOne;
}
