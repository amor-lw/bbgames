import Phaser from "phaser";
import "./styles.css";
import { bossPhases, enemies, EnemyConfig, getHeroById, getLevelById, heroes, HeroConfig, LevelConfig, levelOne, levels, SkillConfig, starbladeHero } from "./config";

const SAVE_KEY = "phantom-verdict-save-v2";
const WIDTH = 1280;
const HEIGHT = 720;
const ROOM_WIDTH = 1280;
const ROOM_HEIGHT = 720;
const WORLD_HEIGHT = 1120;
let selectedHeroId = starbladeHero.id;
let selectedLevelId = levelOne.id;
let selectedMode: "story" | "endless" = "story";

type SaveData = {
  unlockedLevels: string[];
  bestClearMs?: number;
  achievements: string[];
  settings: {
    screenShake: boolean;
  };
};

type RoomState = "locked" | "active" | "cleared";

type ActorKind = "minion" | "boss";

type EnemyActor = Phaser.Physics.Arcade.Image & {
  actorKind: ActorKind;
  enemyId: string;
  family?: EnemyConfig["family"];
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  lastHitAt: number;
  markedUntil: number;
  isBoss?: boolean;
  phaseIndex?: number;
  channeling?: boolean;
  nextAttackAt?: number;
  bossTitle?: string;
  baseScale?: number;
  nameLabel?: Phaser.GameObjects.Text;
  hpBar?: Phaser.GameObjects.Graphics;
};

type SkillImpactOptions = {
  damageBoost?: number;
  knockbackBoost?: number;
  interrupt?: boolean;
  sourceId?: string;
};

type FloatingLabel = Phaser.GameObjects.Text & { expiresAt: number; velocityY: number };

function loadSave(): SaveData {
  const fallback: SaveData = {
    unlockedLevels: [levelOne.id],
    achievements: [],
    settings: { screenShake: true }
  };

  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function writeSave(save: SaveData) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}

function formatMs(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${mins}:${rest.toString().padStart(2, "0")}`;
}

const fakeLeaderboard = [
  ["暮星裁决者", 286420],
  ["断桥旧王", 241880],
  ["雾峰无名客", 217300],
  ["赤沙游侠", 192640],
  ["寒牢破壁人", 166510],
  ["星轨见证者", 139900]
] as const;

const levelStories: Record<string, string> = {
  "sunset-court": "落霞古堡的外庭埋着第一枚圣裁碎印。你踏过断旗与残钟，听见墙缝里有魔仆啃食誓约。若不能在黄昏前夺回碎印，整座古堡会成为通往深渊的门。",
  "mist-peak": "险峰的雾不是天气，而是死者未散的记忆。石阶上的刻痕指向一位失踪剑圣，他曾在这里封住第二枚碎印，也把自己的名字交给云海。",
  "ember-desert": "荒原赤沙下流动着熔金般的旧血。商道废墟、倒塌方尖碑和火咒灵拼出一段被抹去的王朝史：圣裁并非审判罪人，而是在筛选能承受神力的容器。",
  "frost-keep": "寒霜边堡仍燃着蓝火，所有囚室都朝向同一轮孤月。典狱长守的不是犯人，而是一个会醒来的预言：当十六名异域剑豪齐聚，王座将重新选择主人。",
  "iron-fortress": "幽铁要塞的齿轮昼夜不歇，像一颗被钉死的心。每一道铁门背后都有被改造成兵器的灵魂，它们敲击城墙，只为提醒后来者不要相信圣堂的赞歌。",
  "void-chapel": "虚空礼拜堂的圣像没有脸，裂隙把祷词切成碎片。镜面侍祭称你为归来的钥匙，因为你的武器上，正有碎印彼此认出彼此。",
  "thunder-gate": "雷云关隘是旧战争最后的天门。风暴龙骑在高墙上盘旋，雷火猎犬嗅着你的血。穿过这里，就等于向圣裁王座宣告：凡人也能拔剑问天。",
  "saint-sanctum": "王座厅铺满星尘与断剑。所有摆设、残碑、囚火、裂隙都在此汇成一个答案：圣裁不是神赐的秩序，而是被夺走的自由。最后一战，不为王冠，只为让世界重新拥有选择。"
};

function createHeroPixelTexture(scene: Phaser.Scene, hero: HeroConfig, key: string, portrait: boolean) {
  if (scene.textures.exists(key)) return;

  const g = scene.add.graphics();
  const v = hero.visual;
  const heavy = v.archetype === "heavy";
  const assassin = v.archetype === "assassin";
  const polearm = v.archetype === "polearm";
  const spellblade = v.archetype === "spellblade";
  const ox = portrait ? 0 : 8;
  const oy = portrait ? 0 : 2;

  g.fillStyle(0x05070c, 0);
  g.fillRect(0, 0, 72, 72);

  g.fillStyle(v.dark, 0.88);
  if (heavy) {
    g.fillRect(22 + ox, 30 + oy, 26, 24);
    g.fillRect(18 + ox, 38 + oy, 34, 16);
  } else if (assassin) {
    g.fillTriangle(20 + ox, 56 + oy, 34 + ox, 18 + oy, 48 + ox, 56 + oy);
    g.fillRect(25 + ox, 34 + oy, 18, 22);
  } else if (polearm) {
    g.fillRect(24 + ox, 27 + oy, 22, 29);
    g.fillTriangle(18 + ox, 56 + oy, 34 + ox, 32 + oy, 50 + ox, 56 + oy);
  } else {
    g.fillTriangle(18 + ox, 58 + oy, 34 + ox, 20 + oy, 52 + ox, 58 + oy);
    g.fillRect(26 + ox, 31 + oy, 17, 25);
  }

  g.fillStyle(v.secondary, 1);
  g.fillRect(24 + ox, 28 + oy, heavy ? 22 : 20, 22);
  g.fillStyle(v.primary, 1);
  g.fillRect(26 + ox, 18 + oy, heavy ? 18 : 16, 14);
  g.fillRect(27 + ox, 32 + oy, heavy ? 16 : 14, 18);
  g.fillStyle(v.accent, 1);
  g.fillRect(29 + ox, 20 + oy, 4, 4);
  g.fillRect(37 + ox, 20 + oy, 4, 4);
  g.fillRect(30 + ox, 31 + oy, 10, 3);

  if (heavy) {
    g.fillStyle(v.accent, 0.92);
    g.fillRect(18 + ox, 31 + oy, 8, 15);
    g.fillRect(44 + ox, 31 + oy, 8, 15);
  } else if (assassin) {
    g.fillStyle(v.accent, 0.8);
    g.fillRect(18 + ox, 36 + oy, 8, 5);
    g.fillRect(44 + ox, 36 + oy, 8, 5);
  } else if (polearm) {
    g.fillStyle(v.accent, 0.8);
    g.fillRect(21 + ox, 34 + oy, 5, 18);
    g.fillRect(44 + ox, 34 + oy, 5, 18);
  } else {
    g.fillStyle(v.accent, 0.78);
    g.fillRect(20 + ox, 43 + oy, 28, 4);
  }

  g.fillStyle(v.dark, 1);
  g.fillRect(25 + ox, 50 + oy, 7, 11);
  g.fillRect(38 + ox, 50 + oy, 7, 11);
  g.fillStyle(v.accent, 1);
  g.fillRect(24 + ox, 60 + oy, 10, 4);
  g.fillRect(36 + ox, 60 + oy, 10, 4);

  g.lineStyle(4, v.accent, 1);
  const wx = ox;
  const wy = oy;
  switch (v.weapon) {
    case "axe":
      g.lineBetween(47 + wx, 31 + wy, 61 + wx, 51 + wy);
      g.fillStyle(v.accent, 1);
      g.fillRect(55 + wx, 27 + wy, 10, 9);
      break;
    case "shield":
      g.fillStyle(v.accent, 0.95);
      g.fillRect(11 + wx, 33 + wy, 13, 20);
      g.fillStyle(v.secondary, 1);
      g.fillRect(14 + wx, 37 + wy, 7, 10);
      break;
    case "hammer":
      g.lineBetween(47 + wx, 30 + wy, 60 + wx, 50 + wy);
      g.fillStyle(v.accent, 1);
      g.fillRect(54 + wx, 22 + wy, 14, 10);
      break;
    case "dagger":
      g.lineBetween(17 + wx, 37 + wy, 7 + wx, 45 + wy);
      g.lineBetween(48 + wx, 37 + wy, 61 + wx, 45 + wy);
      break;
    case "rapier":
      g.lineStyle(2, v.accent, 1);
      g.lineBetween(45 + wx, 33 + wy, 67 + wx, 19 + wy);
      break;
    case "bow":
      g.lineStyle(3, v.accent, 1);
      g.beginPath();
      g.arc(52 + wx, 34 + wy, 18, -1.25, 1.25);
      g.strokePath();
      g.lineStyle(1, 0xffffff, 0.72);
      g.lineBetween(58 + wx, 17 + wy, 58 + wx, 51 + wy);
      g.lineStyle(2, v.accent, 0.9);
      g.lineBetween(38 + wx, 35 + wy, 68 + wx, 35 + wy);
      break;
    case "chain":
      g.lineStyle(2, v.accent, 1);
      for (let i = 0; i < 5; i += 1) g.strokeCircle(48 + wx + i * 4, 34 + wy + Math.sin(i) * 5, 3);
      break;
    case "hidden":
      g.lineStyle(2, v.accent, 0.8);
      g.lineBetween(46 + wx, 36 + wy, 58 + wx, 32 + wy);
      break;
    case "lance":
    case "spear":
    case "halberd":
    case "glaive":
      g.lineStyle(3, v.accent, 1);
      g.lineBetween(48 + wx, 50 + wy, 66 + wx, 8 + wy);
      if (v.weapon === "halberd") g.fillRect(62 + wx, 12 + wy, 8, 10);
      if (v.weapon === "glaive") g.fillTriangle(64 + wx, 6 + wy, 70 + wx, 18 + wy, 58 + wx, 18 + wy);
      break;
    default:
      g.lineBetween(45 + wx, 35 + wy, 63 + wx, 17 + wy);
      g.lineStyle(2, 0xffffff, 0.55);
      g.lineBetween(47 + wx, 35 + wy, 64 + wx, 18 + wy);
      break;
  }

  if (spellblade) {
    g.lineStyle(1, v.accent, 0.75);
    g.strokeCircle(35 + ox, 38 + oy, 21);
    g.fillStyle(v.accent, 0.85);
    g.fillRect(18 + ox, 20 + oy, 3, 3);
    g.fillRect(50 + ox, 56 + oy, 3, 3);
  }

  g.generateTexture(key, portrait ? 72 : 86, 76);
  g.destroy();
}

function createEnemyPixelTexture(scene: Phaser.Scene, enemy: EnemyConfig) {
  if (scene.textures.exists(enemy.id)) return;

  const g = scene.add.graphics();
  const c = enemy.tint;
  const dark = Phaser.Display.Color.ValueToColor(c).darken(48).color;
  const light = Phaser.Display.Color.ValueToColor(c).lighten(34).color;
  const w = enemy.elite ? 86 : enemy.family === "construct" || enemy.family === "armor" ? 70 : 58;
  const h = enemy.elite ? 82 : enemy.family === "construct" || enemy.family === "armor" ? 68 : 58;
  const cx = w / 2;

  g.fillStyle(0x05070c, 0);
  g.fillRect(0, 0, w, h);
  g.fillStyle(dark, 1);

  if (enemy.family === "spirit") {
    g.fillRect(cx - 15, 10, 30, 10);
    g.fillRect(cx - 20, 20, 40, 18);
    g.fillRect(cx - 16, 38, 12, 12);
    g.fillRect(cx + 4, 38, 12, 12);
    g.fillStyle(c, 0.9);
    g.fillRect(cx - 12, 16, 24, 20);
  } else if (enemy.family === "beast") {
    g.fillRect(cx - 20, 18, 40, 22);
    g.fillRect(cx - 14, 8, 28, 14);
    g.fillRect(cx - 27, 8, 10, 18);
    g.fillRect(cx + 17, 8, 10, 18);
    g.fillRect(cx - 24, 38, 10, 12);
    g.fillRect(cx + 14, 38, 10, 12);
    g.fillStyle(c, 1);
    g.fillRect(cx - 15, 18, 30, 20);
  } else if (enemy.family === "armor" || enemy.family === "holy") {
    g.fillRect(cx - 18, 16, 36, 34);
    g.fillRect(cx - 14, 6, 28, 18);
    g.fillRect(cx - 29, 28, 16, 24);
    g.fillStyle(c, 1);
    g.fillRect(cx - 14, 20, 28, 26);
    g.fillRect(cx + 18, 20, 8, 34);
  } else if (enemy.family === "construct") {
    g.fillRect(cx - 24, 20, 48, 32);
    g.fillRect(cx - 16, 8, 32, 16);
    g.fillRect(cx - 30, 34, 14, 18);
    g.fillRect(cx + 16, 34, 14, 18);
    g.fillStyle(c, 1);
    g.fillRect(cx - 18, 22, 36, 24);
  } else if (enemy.family === "void") {
    g.fillRect(cx - 20, 12, 40, 10);
    g.fillRect(cx - 16, 22, 32, 28);
    g.fillRect(cx - 28, 26, 10, 12);
    g.fillRect(cx + 18, 26, 10, 12);
    g.fillStyle(c, 0.92);
    g.fillRect(cx - 11, 18, 22, 28);
    g.fillStyle(0x090713, 0.9);
    g.fillRect(cx - 4, 24, 8, 16);
  } else if (enemy.family === "storm") {
    g.fillRect(cx - 18, 16, 36, 24);
    g.fillRect(cx - 10, 8, 20, 12);
    g.fillRect(cx - 26, 36, 12, 14);
    g.fillRect(cx + 14, 36, 12, 14);
    g.fillStyle(c, 1);
    g.fillRect(cx - 13, 18, 26, 18);
    g.fillStyle(light, 0.85);
    g.fillRect(cx + 12, 12, 8, 8);
    g.fillRect(cx - 20, 30, 8, 8);
  } else {
    g.fillRect(cx - 24, 16, 48, 44);
    g.fillStyle(c, 1);
    g.fillRect(cx - 18, 8, 36, 24);
    g.fillRect(cx - 28, 30, 18, 28);
    g.fillRect(cx + 12, 28, 24, 34);
  }

  g.fillStyle(light, 1);
  g.fillRect(cx - 9, enemy.family === "beast" ? 21 : 18, 5, 5);
  g.fillRect(cx + 5, enemy.family === "beast" ? 21 : 18, 5, 5);
  g.fillStyle(0xffffff, 0.55);
  g.fillRect(cx - 16, h - 18, 8, 4);
  g.fillRect(cx + 8, h - 18, 8, 4);
  if (enemy.elite) {
    g.lineStyle(4, light, 1);
    g.strokeRect(16, 6, w - 32, h - 18);
    g.fillStyle(light, 0.85);
    g.fillRect(cx - 24, 4, 48, 6);
  }

  g.generateTexture(enemy.id, w, h);
  g.destroy();
}

class MenuScene extends Phaser.Scene {
  constructor() {
    super("MenuScene");
  }

  create() {
    const save = loadSave();
    createBackdrop(this, "main");
    this.add.text(WIDTH / 2, 88, "幻域圣裁", {
      fontFamily: "serif",
      fontSize: "64px",
      color: "#f5d98a"
    }).setOrigin(0.5);
    this.add.text(WIDTH / 2, 152, "西式冷兵器与星轨剑气交织的单人闯关原型", {
      fontSize: "22px",
      color: "#cfd8e3"
    }).setOrigin(0.5);

    const items = [
      { label: "主线模式", action: () => { selectedMode = "story"; this.scene.start("SelectScene"); } },
      { label: "无尽模式", action: () => { selectedMode = "endless"; selectedLevelId = levelOne.id; this.scene.start("SelectScene"); } },
      { label: "英雄图鉴", action: () => this.showCodex() },
      { label: "关卡存档", action: () => this.showSave(save) },
      { label: "设置", action: () => this.toggleShake(save) },
      { label: "成就", action: () => this.showAchievements(save) }
    ];

    items.forEach((item, index) => {
      const y = 250 + index * 68;
      const button = this.add.rectangle(WIDTH / 2, y, 320, 48, 0x182236, 0.86)
        .setStrokeStyle(1, 0xc8a95c)
        .setInteractive({ useHandCursor: true });
      const text = this.add.text(WIDTH / 2, y, item.label, {
        fontSize: "24px",
        color: "#f6edd2"
      }).setOrigin(0.5);
      button.on("pointerover", () => button.setFillStyle(0x243657, 0.95));
      button.on("pointerout", () => button.setFillStyle(0x182236, 0.86));
      button.on("pointerdown", item.action);
      text.setInteractive({ useHandCursor: true }).on("pointerdown", item.action);
    });

    this.add.text(WIDTH / 2, HEIGHT - 62, "操作：WASD移动 | J普攻 | U/I/O施放技能", {
      fontSize: "19px",
      color: "#aab8c8"
    }).setOrigin(0.5);
    this.add.text(WIDTH - 232, 86, "无尽榜\n" + fakeLeaderboard.slice(0, 4).map((row, index) => `${index + 1}. ${row[0]} ${row[1]}`).join("\n"), {
      fontSize: "14px",
      color: "#c9d8e8",
      lineSpacing: 7,
      align: "left"
    }).setOrigin(0.5, 0);
  }

  private toast(message: string) {
    const panel = this.add.rectangle(WIDTH / 2, HEIGHT - 142, 720, 58, 0x101722, 0.92)
      .setStrokeStyle(1, 0x5ba6c8);
    const text = this.add.text(WIDTH / 2, HEIGHT - 142, message, {
      fontSize: "20px",
      color: "#eef6ff",
      align: "center"
    }).setOrigin(0.5);
    this.tweens.add({
      targets: [panel, text],
      alpha: 0,
      delay: 1900,
      duration: 400,
      onComplete: () => {
        panel.destroy();
        text.destroy();
      }
    });
  }

  private showCodex() {
    this.toast(`16位英雄已全部开放。当前选择：${getHeroById(selectedHeroId).name}`);
  }

  private showSave(save: SaveData) {
    const best = save.bestClearMs ? `最佳通关 ${formatMs(save.bestClearMs)}` : "尚未通关";
    this.toast(`已解锁关卡：${save.unlockedLevels.join("、")} | ${best}`);
  }

  private toggleShake(save: SaveData) {
    save.settings.screenShake = !save.settings.screenShake;
    writeSave(save);
    this.toast(`屏幕震动：${save.settings.screenShake ? "开启" : "关闭"}`);
  }

  private showAchievements(save: SaveData) {
    this.toast(save.achievements.length ? `成就：${save.achievements.join("、")}` : "暂无成就。击败圣裁骑士后解锁首个成就。");
  }
}

class SelectScene extends Phaser.Scene {
  constructor() {
    super("SelectScene");
  }

  create() {
    const save = loadSave();
    createBackdrop(this, "select");
    this.add.text(58, 30, "选择英雄", { fontSize: "38px", color: "#f7d98b" });
    this.add.text(60, 78, "8位精选像素英雄。每位英雄的普攻、武器、U/I/O技能机制都明显不同。", { fontSize: "18px", color: "#bdc7d7" });

    heroes.forEach((hero, index) => {
      const name = hero.name;
      const col = index % 4;
      const row = Math.floor(index / 4);
      const x = 165 + col * 235;
      const y = 172 + row * 112;
      const active = hero.id === selectedHeroId;
      const fill = active ? 0x263d5e : 0x111827;
      const border = active ? hero.visual.accent : 0x475067;
      const textureKey = `portrait-${hero.id}`;
      createHeroPixelTexture(this, hero, textureKey, true);
      const card = this.add.rectangle(x, y, 196, 78, fill, active ? 0.96 : 0.72)
        .setStrokeStyle(2, border)
        .setInteractive({ useHandCursor: true });
      const iconBack = this.add.rectangle(x - 70, y, 44, 52, 0x070b12, 0.86)
        .setStrokeStyle(1, active ? hero.visual.accent : 0x697287);
      const portrait = this.add.image(x - 70, y + 4, textureKey).setScale(1.5).setDepth(2);
      this.add.text(x - 32, y - 21, name, {
        fontSize: "17px",
        color: active ? "#fff3cc" : "#95a0b1",
        wordWrap: { width: 120 }
      });
      this.add.text(x - 32, y + 18, hero.visual.archetype === "heavy" ? "重装" : hero.visual.archetype === "assassin" ? "迅捷" : hero.visual.archetype === "polearm" ? "长柄" : "魔武", {
        fontSize: "14px",
        color: active ? "#8ce9ff" : "#738299"
      });
      card.on("pointerover", () => card.setFillStyle(0x305078, 1));
      card.on("pointerout", () => card.setFillStyle(fill, active ? 0.96 : 0.72));
      card.on("pointerdown", () => {
        selectedHeroId = hero.id;
        this.scene.restart();
      });
      portrait.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
        selectedHeroId = hero.id;
        this.scene.restart();
      });
      void iconBack;
    });

    const selected = getHeroById(selectedHeroId);
    const selectedLevel = getLevelById(selectedLevelId);
    this.add.text(64, HEIGHT - 80, `${selectedMode === "endless" ? "无尽模式" : "主线模式"} | ${selected.name} | ${selected.title}`, {
      fontSize: "21px",
      color: "#eff7ff"
    });
    this.add.text(64, HEIGHT - 46, selectedMode === "endless" ? "无尽斗技场：不断刷怪、累计积分、冲击伪排行榜" : `当前关卡：${selectedLevel.name} | ${selectedLevel.subtitle}`, {
      fontSize: "16px",
      color: "#b9c9d9"
    });

    if (selectedMode === "story") {
      levels.forEach((level, index) => {
        const x = 708 + (index % 4) * 116;
        const y = HEIGHT - 136 + Math.floor(index / 4) * 38;
        const active = level.id === selectedLevelId;
        const unlocked = save.unlockedLevels.includes(level.id);
        const chip = this.add.rectangle(x, y, 104, 28, active ? level.palette.accent : unlocked ? 0x111827 : 0x080b10, active ? 0.92 : unlocked ? 0.82 : 0.62)
          .setStrokeStyle(1, active ? level.palette.glow : unlocked ? 0x42516b : 0x252b36)
          .setInteractive({ useHandCursor: true });
        this.add.text(x, y, `${index + 1}.${unlocked ? level.name : "锁定"}`, {
          fontSize: "12px",
          color: active ? "#10131a" : unlocked ? "#c8d4e4" : "#657084",
          fontStyle: active ? "bold" : "normal"
        }).setOrigin(0.5);
        chip.on("pointerover", () => chip.setFillStyle(unlocked ? level.palette.accent : 0x151922, unlocked ? 0.9 : 0.72));
        chip.on("pointerout", () => chip.setFillStyle(active ? level.palette.accent : unlocked ? 0x111827 : 0x080b10, active ? 0.92 : unlocked ? 0.82 : 0.62));
        chip.on("pointerdown", () => {
          if (!unlocked) {
            this.add.text(x, y - 34, "先通关上一关", { fontSize: "12px", color: "#ffd58a" }).setOrigin(0.5).setDepth(10);
            return;
          }
          selectedLevelId = level.id;
          this.scene.restart();
        });
      });
    } else {
      this.add.text(718, HEIGHT - 154, "无尽模式积分榜", { fontSize: "19px", color: "#ffe3a0" });
      fakeLeaderboard.forEach((row, index) => {
        this.add.text(718, HEIGHT - 122 + index * 22, `${index + 1}. ${row[0]}  ${row[1]}`, {
          fontSize: "15px",
          color: index < 3 ? "#f7d98b" : "#c9d8e8"
        });
      });
    }

    const start = this.add.rectangle(WIDTH - 190, HEIGHT - 72, 250, 54, 0xc99438, 0.95)
      .setInteractive({ useHandCursor: true });
    this.add.text(WIDTH - 190, HEIGHT - 72, selectedMode === "endless" ? "进入无尽模式" : "进入当前关卡", {
      fontSize: "22px",
      color: "#10131a",
      fontStyle: "bold"
    }).setOrigin(0.5);
    start.on("pointerdown", () => this.scene.start("GameScene"));
  }
}

class GameScene extends Phaser.Scene {
  private hero!: HeroConfig;
  private level!: LevelConfig;
  private player!: Phaser.Physics.Arcade.Image;
  private enemies!: Phaser.Physics.Arcade.Group;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private hp = 0;
  private mana = 0;
  private facing = new Phaser.Math.Vector2(1, 0);
  private nextSkillAt = new Map<string, number>();
  private attackStep = 0;
  private attackResetAt = 0;
  private currentWave = -1;
  private currentRoom = 0;
  private roomStates: RoomState[] = [];
  private roomDoor?: Phaser.GameObjects.Rectangle;
  private endlessScore = 0;
  private endlessWave = 0;
  private waveActive = false;
  private bossSpawned = false;
  private ascendUntil = 0;
  private invulnerableUntil = 0;
  private castingUntil = 0;
  private playerLastDamagedAt = 0;
  private startedAt = 0;
  private ended = false;
  private ui!: {
    hp: Phaser.GameObjects.Graphics;
    mana: Phaser.GameObjects.Graphics;
    boss: Phaser.GameObjects.Graphics;
    title: Phaser.GameObjects.Text;
    status: Phaser.GameObjects.Text;
    mode: Phaser.GameObjects.Text;
    skillCards: Phaser.GameObjects.Graphics[];
    skills: Phaser.GameObjects.Text[];
  };
  private labels: FloatingLabel[] = [];

  constructor() {
    super("GameScene");
  }

  create() {
    this.hero = getHeroById(selectedHeroId);
    this.level = getLevelById(selectedLevelId);
    this.hp = this.hero.maxHp;
    this.mana = this.hero.maxMana;
    this.currentWave = -1;
    this.currentRoom = 0;
    this.roomDoor?.destroy();
    this.roomDoor = undefined;
    this.endlessScore = 0;
    this.endlessWave = 0;
    this.waveActive = false;
    this.bossSpawned = false;
    this.ended = false;
    this.playerLastDamagedAt = 0;
    this.nextSkillAt.clear();
    const rooms = this.getRoomCount();
    this.roomStates = Array.from({ length: rooms }, (_, index) => index === 0 ? "active" : "locked");
    this.physics.world.setBounds(0, 0, ROOM_WIDTH * rooms, WORLD_HEIGHT);
    this.cameras.main.setBounds(0, 0, ROOM_WIDTH * rooms, WORLD_HEIGHT);
    createArena(this, this.level, rooms);
    this.createTextures();

    this.enemies = this.physics.add.group();
    this.player = this.physics.add.image(210, 520, `hero-${this.hero.id}`)
      .setScale(1.08)
      .setDepth(20)
      .setCollideWorldBounds(true);
    this.centerCircleBody(this.player, 18);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setDeadzone(420, 240);

    this.physics.add.overlap(this.player, this.enemies, (_, enemy) => {
      this.handleContact(enemy as EnemyActor);
    });

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys("W,A,S,D,U,I,O,SHIFT") as Record<string, Phaser.Input.Keyboard.Key>;
    this.keys.attack = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.J);

    this.createHud();
    this.startedAt = this.time.now;
    this.invulnerableUntil = this.time.now + 1600;
    if (selectedMode === "story") this.showStoryIntro();
    this.spawnNextWave();
    this.floatText(this.player.x + 60, this.player.y - 44, "踏风入阵", "#c9f4ff");
  }

  update(time: number, delta: number) {
    if (this.ended) {
      return;
    }
    this.movePlayer(time);
    this.checkDoorTransition();
    this.updateEnemies(time, delta);
    this.handleKeyboardSkills();
    this.checkWaveState();
    this.updateHud(time);
    this.updateLabels(delta, time);
  }

  private getRoomCount() {
    return selectedMode === "endless" ? 6 : this.level.waves.length + 1;
  }

  private roomLeft(room = this.currentRoom) {
    return room * ROOM_WIDTH;
  }

  private roomRight(room = this.currentRoom) {
    return (room + 1) * ROOM_WIDTH;
  }

  private showStoryIntro() {
    const story = levelStories[this.level.id] ?? this.level.subtitle;
    const panel = this.add.rectangle(WIDTH / 2, 164, 1000, 126, 0x07101a, 0.88)
      .setScrollFactor(0)
      .setDepth(130)
      .setStrokeStyle(2, this.level.palette.glow, 0.55);
    const text = this.add.text(WIDTH / 2, 164, `第${levels.findIndex((level) => level.id === this.level.id) + 1}章：${this.level.name}\n${story}`, {
      fontSize: "20px",
      color: "#f4ecda",
      align: "center",
      wordWrap: { width: 900 },
      lineSpacing: 8
    }).setOrigin(0.5).setScrollFactor(0).setDepth(131);
    this.tweens.add({ targets: [panel, text], alpha: 0, delay: 5200, duration: 800, onComplete: () => { panel.destroy(); text.destroy(); } });
  }

  private createTextures() {
    createHeroPixelTexture(this, this.hero, `hero-${this.hero.id}`, false);

    const makeImp = () => {
      const g = this.add.graphics();
      g.fillStyle(0x351213, 1);
      g.fillTriangle(18, 14, 8, 2, 13, 20);
      g.fillTriangle(34, 14, 44, 2, 39, 20);
      g.fillStyle(0x8c2f25, 1);
      g.fillEllipse(26, 28, 34, 28);
      g.fillStyle(0xffb36a, 1);
      g.fillCircle(20, 25, 3);
      g.fillCircle(32, 25, 3);
      g.lineStyle(3, 0x2a0c0c, 1);
      g.lineBetween(12, 37, 3, 45);
      g.lineBetween(40, 37, 49, 45);
      g.generateTexture("imp", 52, 52);
      g.destroy();
    };

    const makeWraith = () => {
      const g = this.add.graphics();
      g.fillStyle(0x7f92aa, 0.9);
      g.fillEllipse(27, 22, 30, 32);
      g.fillTriangle(12, 28, 19, 51, 26, 30);
      g.fillTriangle(27, 30, 34, 51, 42, 28);
      g.fillStyle(0xdff5ff, 0.9);
      g.fillCircle(22, 21, 3);
      g.fillCircle(32, 21, 3);
      g.lineStyle(2, 0xbfd6ff, 0.55);
      g.lineBetween(12, 36, 3, 43);
      g.lineBetween(42, 36, 51, 43);
      g.generateTexture("wraith", 54, 56);
      g.destroy();
    };

    const makeKnight = () => {
      const g = this.add.graphics();
      g.fillStyle(0x2b2f3b, 1);
      g.fillRect(20, 16, 22, 28);
      g.fillStyle(0xa79673, 1);
      g.fillRoundedRect(17, 8, 28, 16, 4);
      g.fillStyle(0x745b39, 1);
      g.fillRoundedRect(11, 25, 16, 22, 3);
      g.lineStyle(4, 0xc9b88a, 1);
      g.lineBetween(42, 22, 57, 10);
      g.lineBetween(43, 24, 57, 38);
      g.generateTexture("knight", 64, 60);
      g.destroy();
    };

    const makeElite = () => {
      const g = this.add.graphics();
      g.fillStyle(0x4b2c22, 1);
      g.fillRoundedRect(24, 18, 32, 44, 5);
      g.fillStyle(0xd7a64c, 1);
      g.fillRoundedRect(20, 6, 40, 24, 6);
      g.fillStyle(0x81452d, 1);
      g.fillRoundedRect(8, 28, 22, 34, 4);
      g.lineStyle(6, 0xffd789, 1);
      g.lineBetween(56, 23, 74, 5);
      g.lineBetween(57, 27, 76, 51);
      g.lineStyle(2, 0xfff0b5, 0.7);
      g.strokeRoundedRect(20, 6, 40, 24, 6);
      g.generateTexture("elite", 84, 76);
      g.destroy();
    };

    const makeBoss = () => {
      const g = this.add.graphics();
      g.fillStyle(0x4a1820, 1);
      g.fillTriangle(34, 26, 14, 86, 54, 86);
      g.fillStyle(0xdec271, 1);
      g.fillRoundedRect(20, 12, 40, 54, 8);
      g.fillStyle(0x7c1f2a, 1);
      g.fillRoundedRect(8, 36, 26, 42, 5);
      g.lineStyle(8, 0xf5df95, 1);
      g.lineBetween(56, 26, 84, 5);
      g.lineBetween(58, 31, 89, 64);
      g.lineStyle(2, 0xfff4bc, 0.65);
      g.strokeRoundedRect(20, 12, 40, 54, 8);
      g.generateTexture("boss", 96, 96);
      g.destroy();
    };

    makeImp();
    makeWraith();
    makeKnight();
    makeElite();
    makeBoss();
    Object.values(enemies).forEach((enemy) => createEnemyPixelTexture(this, enemy));
  }

  private createHud() {
    const topPanel = this.add.graphics().setDepth(99).setScrollFactor(0);
    topPanel.fillStyle(0x080d16, 0.68);
    topPanel.fillRoundedRect(14, 12, 380, 122, 8);
    topPanel.lineStyle(1, 0xc9a55f, 0.42);
    topPanel.strokeRoundedRect(14, 12, 380, 122, 8);

    const skillPanel = this.add.graphics().setDepth(99).setScrollFactor(0);
    skillPanel.fillStyle(0x050912, 0.86);
    skillPanel.fillRoundedRect(250, HEIGHT - 104, 780, 88, 8);
    skillPanel.lineStyle(2, 0x5c7899, 0.58);
    skillPanel.strokeRoundedRect(250, HEIGHT - 104, 780, 88, 8);

    this.ui = {
      hp: this.add.graphics().setScrollFactor(0).setDepth(100),
      mana: this.add.graphics().setScrollFactor(0).setDepth(100),
      boss: this.add.graphics().setScrollFactor(0).setDepth(100),
      title: this.add.text(24, 20, `${selectedMode === "endless" ? "无尽斗技场" : this.level.name} | ${this.hero.name}`, { fontSize: "20px", color: "#ffe3a0" }).setScrollFactor(0).setDepth(101),
      status: this.add.text(24, 52, selectedMode === "endless" ? "连战不止，积分入榜。" : this.level.subtitle, { fontSize: "15px", color: "#bfccda" }).setScrollFactor(0).setDepth(101),
      mode: this.add.text(24, 136, "", { fontSize: "15px", color: "#91e8ff" }).setScrollFactor(0).setDepth(101),
      skillCards: [],
      skills: []
    };

    this.hero.skills.slice(1).forEach((skill, index) => {
      const x = 380 + index * 260;
      const frame = this.add.graphics().setDepth(100).setScrollFactor(0);
      const label = this.add.text(x, HEIGHT - 60, "", {
        fontSize: "15px",
        color: "#f7f0dd",
        align: "center",
        lineSpacing: 3,
        wordWrap: { width: 210 }
      }).setOrigin(0.5).setDepth(101);
      this.ui.skillCards.push(frame);
      this.ui.skills.push(label);
      void skill;
    });

    this.add.text(WIDTH - 228, 20, "J 普攻 | U I O 技能", {
      fontSize: "16px",
      color: "#b9c9d9"
    }).setScrollFactor(0).setDepth(101);
  }

  private movePlayer(time: number) {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const velocity = new Phaser.Math.Vector2(0, 0);
    if (this.keys.A.isDown || this.cursors.left?.isDown) velocity.x -= 1;
    if (this.keys.D.isDown || this.cursors.right?.isDown) velocity.x += 1;
    if (this.keys.W.isDown || this.cursors.up?.isDown) velocity.y -= 1;
    if (this.keys.S.isDown || this.cursors.down?.isDown) velocity.y += 1;

    if (velocity.lengthSq() > 0) {
      velocity.normalize();
      this.facing.copy(velocity);
      if (Math.abs(velocity.x) > 0.12) {
        this.player.setFlipX(velocity.x < 0);
      }
      this.player.setRotation(0);
    }

    const boosted = time < this.ascendUntil ? 1.28 : 1;
    body.setVelocity(velocity.x * this.hero.speed * boosted, velocity.y * this.hero.speed * boosted);
    const moving = velocity.lengthSq() > 0;
    const bob = moving ? Math.sin(time / 95) * 0.055 : 0;
    const castSquash = time < this.castingUntil ? 0.12 : 0;
    this.player.setScale(1.08 + castSquash, 1.08 - castSquash + bob);
    if (time < this.castingUntil) this.player.setAngle(this.facing.x * 5);
    else this.player.setAngle(0);
    const left = this.roomLeft() + 48;
    const right = this.roomStates[this.currentRoom] === "cleared" ? this.roomRight() + 110 : this.roomRight() - 54;
    this.player.x = Phaser.Math.Clamp(this.player.x, left, Math.min(right, this.getRoomCount() * ROOM_WIDTH - 48));
    this.player.y = Phaser.Math.Clamp(this.player.y, 118, WORLD_HEIGHT - 72);
  }

  private handleKeyboardSkills() {
    if (Phaser.Input.Keyboard.JustDown(this.keys.attack)) this.useSkill(this.hero.skills[0]);
    const bindings: Array<[string, number]> = [
      ["U", 1],
      ["I", 2],
      ["O", 3]
    ];
    bindings.forEach(([key, index]) => {
      if (Phaser.Input.Keyboard.JustDown(this.keys[key])) {
        this.useSkill(this.hero.skills[index]);
      }
    });
  }

  private useSkill(skill: SkillConfig) {
    const now = this.time.now;
    if (now < (this.nextSkillAt.get(skill.id) ?? 0) || this.mana < skill.manaCost) {
      this.floatText(this.player.x, this.player.y - 42, this.mana < skill.manaCost ? "魔力不足" : "冷却中", "#9fb0c8");
      return;
    }

    this.nextSkillAt.set(skill.id, now + skill.cooldownMs);
    this.mana -= skill.manaCost;
    this.castingUntil = now + (skill.id === "basic" ? 130 : 260);
    this.playCastMotion(skill);

    if (skill.id === "basic") {
      this.attackStep = now > this.attackResetAt ? 1 : (this.attackStep % 3) + 1;
      this.attackResetAt = now + 800;
    }

    if (skill.id === "ascend") {
      this.ascendUntil = now + (skill.durationMs ?? 4000);
      this.invulnerableUntil = now + 500;
    }
    if (skill.dashDistance) {
      const minX = this.roomLeft() + 52;
      const maxX = this.roomStates[this.currentRoom] === "cleared" ? this.roomRight() + 96 : this.roomRight() - 52;
      this.player.x = Phaser.Math.Clamp(this.player.x + this.facing.x * skill.dashDistance, minX, Math.min(maxX, this.getRoomCount() * ROOM_WIDTH - 52));
      this.player.y = Phaser.Math.Clamp(this.player.y + this.facing.y * skill.dashDistance, 130, WORLD_HEIGHT - 92);
      this.invulnerableUntil = now + 260;
    }

    const damageBoost = now < this.ascendUntil ? 1.32 : 1;
    const comboBoost = skill.id === "basic" ? 1 + this.attackStep * 0.12 : 1;
    const origin = new Phaser.Math.Vector2(this.player.x, this.player.y);
    const center = skill.range > 0
      ? origin.clone().add(this.facing.clone().scale(skill.range * 0.64))
      : origin;

    this.drawSkillEffect(skill, center.x, center.y);

    this.applyFormSkill(skill, center.x, center.y, damageBoost * comboBoost);
    this.applyDistinctSkillBehavior(skill, center.x, center.y, damageBoost * comboBoost);

    if (skill.id === "basic") {
      this.mana = Math.min(this.hero.maxMana, this.mana + this.hero.manaOnHit);
    }
  }

  private playCastMotion(skill: SkillConfig) {
    const g = this.add.graphics().setDepth(19);
    const reach = skill.form === "arrow" || skill.form === "orb" ? 34 : skill.form === "smash" || skill.form === "cleave" ? 46 : 38;
    const sx = this.player.x + this.facing.x * 14;
    const sy = this.player.y + this.facing.y * 14;
    g.fillStyle(this.hero.visual.accent, 0.38);
    g.fillRect(sx - 18, sy - 28, 36, 56);
    g.fillStyle(0xffffff, 0.32);
    g.fillRect(sx + this.facing.x * reach - 8, sy + this.facing.y * reach - 8, 16, 16);
    this.tweens.add({
      targets: g,
      alpha: 0,
      x: this.facing.x * 18,
      y: this.facing.y * 18,
      duration: skill.id === "basic" ? 120 : 180,
      onComplete: () => g.destroy()
    });
  }

  private applyFormSkill(skill: SkillConfig, x: number, y: number, multiplier: number) {
    if (skill.form === "arrow") {
      this.drawPixelProjectile(this.player.x, this.player.y, skill.range + 280, this.hero.visual.accent, "arrow");
      this.applySkillLine(skill, skill.range + 320, skill.id === "basic" ? 18 : 34, multiplier, { damageBoost: skill.id === "basic" ? 1 : 1.12, knockbackBoost: 0.55 });
    } else if (skill.form === "orb") {
      const endX = this.player.x + this.facing.x * (skill.range + 160);
      const endY = this.player.y + this.facing.y * (skill.range + 160);
      this.drawPixelProjectile(this.player.x, this.player.y, skill.range + 160, this.hero.visual.accent, "orb");
      this.time.delayedCall(150, () => this.applySkillArea(skill, endX, endY, skill.radius + 18, multiplier, { damageBoost: 1.05, knockbackBoost: 0.8 }));
    } else if (skill.form === "chain") {
      this.drawPixelChains(x, y, skill.radius + 38, this.hero.visual.accent);
      this.applySkillLine(skill, skill.range + 210, 42, multiplier, { damageBoost: 1, knockbackBoost: 0.18, sourceId: "seal" });
      this.pullEnemiesToward(this.player.x + this.facing.x * 130, this.player.y + this.facing.y * 130, skill.radius + 120, 420);
    } else if (skill.form === "guard") {
      this.invulnerableUntil = Math.max(this.invulnerableUntil, this.time.now + (skill.id === "basic" ? 220 : 760));
      this.drawPixelBulwark(this.player.x, this.player.y, this.hero.visual.accent);
      this.applySkillArea(skill, this.player.x, this.player.y, skill.radius + 24, multiplier, { damageBoost: 0.86, knockbackBoost: 1.8 });
    } else if (skill.form === "smash") {
      this.drawGroundCrack(x, y, skill.radius + 55, this.hero.visual.accent);
      this.applySkillArea(skill, x, y, skill.radius + 38, multiplier, { damageBoost: 1.1, knockbackBoost: 1.55 });
    } else if (skill.form === "thrust" || skill.form === "stab") {
      this.drawPierceLine(skill.range + 190, skill.form === "stab" ? 18 : 28, this.hero.visual.accent);
      this.applySkillLine(skill, skill.range + 210, skill.form === "stab" ? 18 : 28, multiplier, { damageBoost: 1.08, knockbackBoost: 0.9 });
    } else if (skill.form === "vortex") {
      this.drawPixelVortex(x, y, this.hero.visual.accent);
      this.pullEnemiesToward(x, y, skill.radius + 150, 620);
      this.applySkillArea(skill, x, y, skill.radius + 30, multiplier, { damageBoost: 0.96, knockbackBoost: 0.08 });
    } else if (skill.form === "starfall") {
      for (let i = 0; i < (skill.id === "basic" ? 2 : 5); i += 1) {
        this.time.delayedCall(i * 75, () => {
          const px = x + this.facing.x * i * 42 + Phaser.Math.Between(-30, 30);
          const py = y + this.facing.y * i * 42 + Phaser.Math.Between(-28, 28);
          this.drawPixelStarfall(px, py, this.hero.visual.accent);
          this.applySkillArea(skill, px, py, 46, multiplier, { damageBoost: 0.72, knockbackBoost: 0.5 });
        });
      }
    } else if (skill.form === "flame") {
      for (let i = 0; i < 3; i += 1) {
        const px = this.player.x + this.facing.x * (80 + i * 62);
        const py = this.player.y + this.facing.y * (80 + i * 62);
        this.drawPixelMosaic(px, py, 76 + i * 12, this.hero.visual.accent, 28, 27);
        this.time.delayedCall(i * 120, () => this.applySkillArea(skill, px, py, 78 + i * 10, multiplier, { damageBoost: 0.72, knockbackBoost: 0.65 }));
      }
    } else if (skill.form === "clock") {
      this.drawPixelClock(x, y, this.hero.visual.accent);
      this.applySkillArea(skill, x, y, skill.radius + 26, multiplier, { damageBoost: 0.95, knockbackBoost: 0.35 });
      this.time.delayedCall(320, () => this.applySkillArea(skill, x, y, skill.radius, multiplier, { damageBoost: 0.48, knockbackBoost: 0.25 }));
    } else {
      this.applySkillArea(skill, x, y, skill.radius, multiplier);
    }
  }

  private applySkillArea(skill: SkillConfig, x: number, y: number, radius: number, multiplier = 1, options: SkillImpactOptions = {}) {
    this.enemies.children.each((child) => {
      const enemy = child as EnemyActor;
      const distance = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
      if (distance <= radius + enemy.displayWidth / 2) {
        const marked = enemy.markedUntil > this.time.now ? 1.18 : 1;
        const damage = Math.floor(skill.damage * multiplier * (options.damageBoost ?? 1) * marked);
        const knockback = Math.floor(skill.knockback * (options.knockbackBoost ?? 1));
        this.damageEnemy(enemy, damage, knockback, options.interrupt ?? skill.interrupt, options.sourceId ?? skill.id);
      }
      return true;
    });
  }

  private applySkillLine(skill: SkillConfig, length: number, width: number, multiplier = 1, options: SkillImpactOptions = {}) {
    const origin = new Phaser.Math.Vector2(this.player.x, this.player.y);
    const dir = this.facing.clone().normalize();
    this.enemies.children.each((child) => {
      const enemy = child as EnemyActor;
      const target = new Phaser.Math.Vector2(enemy.x - origin.x, enemy.y - origin.y);
      const forward = target.dot(dir);
      const side = Math.abs(target.cross(dir));
      if (forward >= 0 && forward <= length && side <= width + enemy.displayWidth * 0.35) {
        const marked = enemy.markedUntil > this.time.now ? 1.18 : 1;
        const damage = Math.floor(skill.damage * multiplier * (options.damageBoost ?? 1) * marked);
        const knockback = Math.floor(skill.knockback * (options.knockbackBoost ?? 1));
        this.damageEnemy(enemy, damage, knockback, options.interrupt ?? skill.interrupt, options.sourceId ?? skill.id);
      }
      return true;
    });
  }

  private applyDistinctSkillBehavior(skill: SkillConfig, x: number, y: number, multiplier: number) {
    if (skill.id === "basic") return;

    const archetype = this.hero.visual.archetype;
    const aura = this.hero.visual.aura;

    if (archetype === "heavy") {
      if (skill.id === "dash") {
        this.drawGroundCrack(x, y, skill.radius + 54, this.hero.visual.accent);
        this.time.delayedCall(150, () => this.applySkillArea(skill, x, y, skill.radius + 38, multiplier, { damageBoost: 0.45, knockbackBoost: 1.4 }));
      } else if (skill.id === "sweep") {
        for (let i = 0; i < 3; i += 1) {
          const px = this.player.x + this.facing.x * (75 + i * 58);
          const py = this.player.y + this.facing.y * (75 + i * 58);
          this.drawGroundCrack(px, py, 54 + i * 12, this.hero.visual.accent);
          this.time.delayedCall(90 + i * 90, () => this.applySkillArea(skill, px, py, 58 + i * 10, multiplier, { damageBoost: 0.38, knockbackBoost: 1.25 }));
        }
      } else {
        for (let i = 0; i < 7; i += 1) {
          const a = this.facing.angle() - 1.2 + i * 0.4;
          const px = x + Math.cos(a) * skill.radius * 0.46;
          const py = y + Math.sin(a) * skill.radius * 0.46;
          this.drawGroundCrack(px, py, 62, this.hero.visual.accent);
          this.time.delayedCall(120 + i * 35, () => this.applySkillArea(skill, px, py, 56, multiplier, { damageBoost: 0.28, knockbackBoost: 1.5, interrupt: true }));
        }
      }
    } else if (archetype === "assassin") {
      const hits = skill.id === "ultimate" ? 5 : 3;
      for (let i = 0; i < hits; i += 1) {
        this.time.delayedCall(70 + i * 85, () => {
          const px = x + Phaser.Math.Between(-28, 28);
          const py = y + Phaser.Math.Between(-28, 28);
          this.drawAfterimageSlash(px, py, this.hero.visual.accent, i);
          this.applySkillArea(skill, px, py, skill.id === "ultimate" ? 74 : 46, multiplier, { damageBoost: skill.id === "ultimate" ? 0.32 : 0.28, knockbackBoost: 0.6 });
        });
      }
    } else if (archetype === "polearm") {
      const length = skill.id === "ultimate" ? skill.range + 120 : skill.range + 80;
      const width = skill.id === "sweep" ? 34 : 24;
      this.drawPierceLine(length, width, this.hero.visual.accent);
      this.applySkillLine(skill, length, width, multiplier, { damageBoost: skill.id === "ultimate" ? 0.65 : 0.42, knockbackBoost: 1.05, interrupt: skill.id === "ultimate" });
    } else {
      const pulses = skill.id === "ultimate" ? 4 : aura === "flame" || aura === "void" || aura === "time" ? 3 : 2;
      this.drawRuneCircle(x, y, skill.id === "ultimate" ? skill.radius : Math.max(72, skill.radius * 0.75), this.hero.visual.accent, aura);
      for (let i = 0; i < pulses; i += 1) {
        this.time.delayedCall(120 + i * 180, () => {
          this.drawRunePulse(x, y, Math.max(62, skill.radius * (0.46 + i * 0.12)), this.hero.visual.accent);
          this.applySkillArea(skill, x, y, Math.max(68, skill.radius * (0.42 + i * 0.12)), multiplier, { damageBoost: skill.id === "ultimate" ? 0.3 : 0.24, knockbackBoost: aura === "void" ? 0.25 : 0.75, interrupt: skill.id === "ultimate" });
        });
      }
    }

    this.applyAuraSkillBehavior(skill, x, y, multiplier);
  }

  private applyAuraSkillBehavior(skill: SkillConfig, x: number, y: number, multiplier: number) {
    const aura = this.hero.visual.aura;
    const color = this.hero.visual.accent;
    const minor = skill.id === "dash" ? 0.18 : skill.id === "sweep" ? 0.26 : 0.38;

    if (aura === "gold") {
      this.drawPixelJudgement(x, y, color);
      this.time.delayedCall(180, () => this.applySkillArea(skill, x, y, skill.radius * 0.72, multiplier, { damageBoost: minor, interrupt: skill.id === "ultimate" }));
    } else if (aura === "blood") {
      this.drawPixelMosaic(x, y, skill.radius, 0xff6655, 28, 27);
      this.hp = Math.min(this.hero.maxHp, this.hp + Math.floor(skill.damage * (skill.id === "ultimate" ? 0.55 : 0.24)));
      this.floatText(this.player.x, this.player.y - 58, "血霞回流", "#ff9a8a");
    } else if (aura === "stone") {
      this.invulnerableUntil = Math.max(this.invulnerableUntil, this.time.now + (skill.id === "ultimate" ? 900 : 420));
      this.drawPixelBulwark(this.player.x, this.player.y, color);
    } else if (aura === "frost") {
      this.drawPixelMosaic(x, y, skill.radius + 24, 0xe9fbff, 34, 27);
      this.enemies.children.each((child) => {
        const enemy = child as EnemyActor;
        if (Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y) < skill.radius + 70) enemy.lastHitAt = this.time.now + 820;
        return true;
      });
    } else if (aura === "moon") {
      for (let i = 0; i < 2; i += 1) {
        this.time.delayedCall(120 + i * 120, () => {
          const px = x - this.facing.y * (34 - i * 68);
          const py = y + this.facing.x * (34 - i * 68);
          this.drawAfterimageSlash(px, py, color, i + 2);
          this.applySkillArea(skill, px, py, 42, multiplier, { damageBoost: minor, knockbackBoost: 0.35 });
        });
      }
    } else if (aura === "wind") {
      this.invulnerableUntil = Math.max(this.invulnerableUntil, this.time.now + 220);
      this.drawPixelWindWake(x, y, color);
      this.applySkillLine(skill, skill.range + 135, 18, multiplier, { damageBoost: minor, knockbackBoost: 0.7 });
    } else if (aura === "crimson") {
      this.drawPixelChains(x, y, skill.radius, color);
      this.applySkillArea(skill, x, y, skill.radius + 26, multiplier, { damageBoost: 0.18, knockbackBoost: 0.2, sourceId: "seal" });
    } else if (aura === "mist") {
      this.invulnerableUntil = Math.max(this.invulnerableUntil, this.time.now + 360);
      this.drawPixelMosaic(this.player.x, this.player.y, 86, color, 32, 28);
      this.time.delayedCall(180, () => this.applySkillArea(skill, x, y, skill.radius * 0.64, multiplier, { damageBoost: minor + 0.08, knockbackBoost: 0.45 }));
    } else if (aura === "holy") {
      this.hp = Math.min(this.hero.maxHp, this.hp + Math.floor(skill.damage * 0.18));
      this.drawPixelJudgement(x + this.facing.x * 34, y + this.facing.y * 34, color);
      this.applySkillLine(skill, skill.range + 165, 30, multiplier, { damageBoost: minor, interrupt: skill.id === "ultimate" });
    } else if (aura === "nether") {
      this.drawPixelVortex(x, y, color);
      this.pullEnemiesToward(x, y, skill.radius + 100, skill.id === "ultimate" ? 560 : 360);
      this.time.delayedCall(220, () => this.applySkillArea(skill, x, y, skill.radius * 0.7, multiplier, { damageBoost: minor, knockbackBoost: 0.1 }));
    } else if (aura === "storm") {
      const bolts = skill.id === "ultimate" ? 5 : 3;
      for (let i = 0; i < bolts; i += 1) {
        this.time.delayedCall(90 + i * 120, () => {
          const px = x + Phaser.Math.Between(-skill.radius, skill.radius);
          const py = y + Phaser.Math.Between(-skill.radius / 2, skill.radius / 2);
          this.drawPixelLightning(px, py, color);
          this.applySkillArea(skill, px, py, 48, multiplier, { damageBoost: minor + 0.08, knockbackBoost: 0.9 });
        });
      }
    } else if (aura === "dawn") {
      this.drawPixelSunrise(x, y, color);
      this.hp = Math.min(this.hero.maxHp, this.hp + Math.floor(skill.damage * 0.12));
      this.applySkillArea(skill, x, y, skill.radius + 18, multiplier, { damageBoost: 0.2, knockbackBoost: 1.35 });
    } else if (aura === "star") {
      for (let i = 0; i < (skill.id === "ultimate" ? 7 : 4); i += 1) {
        this.time.delayedCall(120 + i * 80, () => {
          const px = x + Phaser.Math.Between(-skill.radius, skill.radius);
          const py = y + Phaser.Math.Between(-skill.radius / 2, skill.radius / 2);
          this.drawPixelStarfall(px, py, color);
          this.applySkillArea(skill, px, py, 44, multiplier, { damageBoost: minor, knockbackBoost: 0.65 });
        });
      }
    } else if (aura === "flame") {
      for (let i = 0; i < 3; i += 1) {
        this.time.delayedCall(160 + i * 190, () => {
          this.drawPixelMosaic(x, y, skill.radius + i * 18, 0xff7448, 36, 27);
          this.applySkillArea(skill, x, y, skill.radius * (0.55 + i * 0.12), multiplier, { damageBoost: 0.2, knockbackBoost: 0.75 });
        });
      }
    } else if (aura === "void") {
      this.drawPixelVortex(x, y, color);
      this.pullEnemiesToward(x, y, skill.radius + 130, 650);
      this.time.delayedCall(260, () => this.applySkillArea(skill, x, y, skill.radius * 0.84, multiplier, { damageBoost: minor + 0.1, knockbackBoost: 0.05 }));
    } else if (aura === "time") {
      this.drawPixelClock(x, y, color);
      this.enemies.children.each((child) => {
        const enemy = child as EnemyActor;
        if (Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y) < skill.radius + 80) enemy.lastHitAt = this.time.now + 620;
        return true;
      });
      this.time.delayedCall(420, () => {
        this.drawPixelClock(x, y, color);
        this.applySkillArea(skill, x, y, skill.radius * 0.78, multiplier, { damageBoost: minor + 0.12, knockbackBoost: 0.45 });
      });
    }
  }

  private pullEnemiesToward(x: number, y: number, radius: number, strength: number) {
    this.enemies.children.each((child) => {
      const enemy = child as EnemyActor;
      const distance = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
      if (distance < radius) {
        const dir = new Phaser.Math.Vector2(x - enemy.x, y - enemy.y).normalize();
        enemy.setVelocity(dir.x * strength, dir.y * strength);
      }
      return true;
    });
  }

  private damageEnemy(enemy: EnemyActor, amount: number, knockback: number, interrupt: boolean, sourceSkillId: string) {
    if (!enemy.active) return;
    enemy.hp -= amount;
    enemy.lastHitAt = this.time.now;
    this.floatText(enemy.x, enemy.y - enemy.displayHeight / 2 - 12, `${amount}`, enemy.isBoss ? "#ffe28a" : "#d8fbff");

    const away = new Phaser.Math.Vector2(enemy.x - this.player.x, enemy.y - this.player.y);
    if (away.lengthSq() === 0) away.set(1, 0);
    away.normalize();
    enemy.setVelocity(away.x * knockback, away.y * knockback);

    if (sourceSkillId === "seal") {
      enemy.markedUntil = Math.max(enemy.markedUntil, this.time.now + 2100);
    }

    if (interrupt && enemy.isBoss && enemy.channeling) {
      enemy.channeling = false;
      this.floatText(enemy.x, enemy.y - 76, "蓄力被破", "#94eaff");
      this.cameras.main.flash(120, 120, 210, 255, false);
    }

    if (enemy.hp <= 0) {
      this.killEnemy(enemy);
    }
  }

  private killEnemy(enemy: EnemyActor) {
    this.drawBurst(enemy.x, enemy.y, enemy.isBoss ? 0xf8d477 : 0xb8e8ff);
    enemy.nameLabel?.destroy();
    enemy.hpBar?.destroy();
    enemy.destroy();
    this.mana = Math.min(this.hero.maxMana, this.mana + 16);
    if (selectedMode === "endless") {
      this.endlessScore += enemy.isBoss ? 1800 : Math.max(25, Math.floor(enemy.maxHp / 2));
    }

    if (enemy.isBoss) {
      this.finishVictory();
    }
  }

  private handleContact(enemy: EnemyActor) {
    const now = this.time.now;
    if (now < this.invulnerableUntil || now - this.playerLastDamagedAt < 880) return;
    this.playerLastDamagedAt = now;
    enemy.lastHitAt = now;
    this.hp -= enemy.damage;
    this.floatText(this.player.x, this.player.y - 40, `-${enemy.damage}`, "#ff9a89");
    const away = new Phaser.Math.Vector2(this.player.x - enemy.x, this.player.y - enemy.y).normalize();
    this.player.setVelocity(away.x * 360, away.y * 360);
    this.invulnerableUntil = now + 620;
    this.cameras.main.shake(90, 0.004);
    if (this.hp <= 0) {
      this.finishDefeat();
    }
  }

  private updateEnemies(time: number, delta: number) {
    this.enemies.children.each((child) => {
      const enemy = child as EnemyActor;
      if (!enemy.active) return true;

      if (enemy.isBoss) {
        this.updateBoss(enemy, time);
      }

      const direction = new Phaser.Math.Vector2(this.player.x - enemy.x, this.player.y - enemy.y);
      if (direction.lengthSq() > 2) direction.normalize();
      const slow = time < enemy.lastHitAt + 180 ? 0.22 : 1;
      enemy.setVelocity(direction.x * enemy.speed * slow, direction.y * enemy.speed * slow);
      const base = enemy.baseScale ?? 1;
      const stride = enemy.family === "spirit" || enemy.family === "void" ? Math.sin(time / 180 + enemy.x * 0.01) * 0.08 : Math.sin(time / 115 + enemy.x * 0.02) * 0.05;
      enemy.setScale(base + Math.abs(stride) * 0.45, base + stride);
      if (Math.abs(direction.x) > 0.08) {
        enemy.setFlipX(direction.x < 0);
      }
      enemy.setRotation(0);
      enemy.nameLabel?.setPosition(enemy.x, enemy.y - enemy.displayHeight / 2 - 28);
      this.drawEnemyHp(enemy);
      return true;
    });
  }

  private updateBoss(boss: EnemyActor, time: number) {
    const currentPhase = bossPhases[boss.phaseIndex ?? 0];
    if ((boss.phaseIndex ?? 0) === 0 && boss.hp / boss.maxHp <= bossPhases[1].threshold) {
      const levelIndex = Math.max(0, levels.findIndex((level) => level.id === this.level.id));
      boss.phaseIndex = 1;
      boss.speed = bossPhases[1].speed + levelIndex * 5;
      boss.setTint(0xff6f4f);
      this.floatText(boss.x, boss.y - 95, "狂暴阶段", "#ffb36a");
      this.cameras.main.flash(260, 255, 92, 58, false);
      this.cameras.main.shake(260, 0.008);
    }

    if (!boss.nextAttackAt) boss.nextAttackAt = time + 900;
    if (time >= boss.nextAttackAt && !boss.channeling) {
      const phase = bossPhases[boss.phaseIndex ?? 0];
      const skill = Phaser.Utils.Array.GetRandom(phase.skillPool);
      boss.nextAttackAt = time + phase.attackIntervalMs;
      this.bossAttack(boss, skill, phase.damageMultiplier);
    }

    boss.nameLabel?.setText(`${boss.bossTitle ?? "圣裁骑士"} ${boss.phaseIndex === 1 ? "狂暴" : "常态"}`);
    void currentPhase;
  }

  private bossAttack(boss: EnemyActor, skill: "cleave" | "quake" | "seek" | "channel", damageMultiplier: number) {
    if (skill === "channel") {
      boss.channeling = true;
      this.floatText(boss.x, boss.y - 82, "蓄力审判", "#ffdf83");
      this.drawTelegraph(boss.x, boss.y, 142, 980, () => {
        if (!boss.active || !boss.channeling) return;
        boss.channeling = false;
        this.damagePlayerInRadius(boss.x, boss.y, 152, Math.floor(68 * damageMultiplier));
        this.drawBurst(boss.x, boss.y, 0xffd56a);
      });
      return;
    }

    if (skill === "cleave") {
      const center = new Phaser.Math.Vector2(boss.x, boss.y).add(new Phaser.Math.Vector2(this.player.x - boss.x, this.player.y - boss.y).normalize().scale(84));
      this.drawTelegraph(center.x, center.y, 92, 430, () => {
        this.damagePlayerInRadius(center.x, center.y, 102, Math.floor(34 * damageMultiplier));
        this.drawSkillArc(center.x, center.y, 0xffa45f);
      });
    } else if (skill === "quake") {
      this.drawTelegraph(this.player.x, this.player.y, 82, 620, (x, y) => {
        this.damagePlayerInRadius(x, y, 92, Math.floor(42 * damageMultiplier));
        this.drawBurst(x, y, 0xb97b5a);
      });
    } else {
      const target = new Phaser.Math.Vector2(this.player.x, this.player.y);
      this.time.delayedCall(360, () => {
        if (!boss.active) return;
        this.drawTelegraph(target.x, target.y, 64, 360, (x, y) => {
          this.damagePlayerInRadius(x, y, 76, Math.floor(30 * damageMultiplier));
          this.drawSkillArc(x, y, 0x9ae9ff);
        });
      });
    }
  }

  private damagePlayerInRadius(x: number, y: number, radius: number, damage: number) {
    if (this.time.now < this.invulnerableUntil) return;
    if (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) <= radius + 18) {
      const finalDamage = damage;
      this.hp -= finalDamage;
      this.floatText(this.player.x, this.player.y - 45, `-${finalDamage}`, "#ff9a89");
      this.playerLastDamagedAt = this.time.now;
      this.invulnerableUntil = this.time.now + 700;
      this.cameras.main.shake(120, 0.006);
      if (this.hp <= 0) this.finishDefeat();
    }
  }

  private drawTelegraph(x: number, y: number, radius: number, delay: number, onComplete: (x: number, y: number) => void) {
    const g = this.add.graphics().setDepth(12);
    g.lineStyle(2, 0xff5f57, 0.92);
    g.fillStyle(0xff5f57, 0.12);
    g.fillCircle(x, y, radius);
    g.strokeCircle(x, y, radius);
    this.tweens.add({
      targets: g,
      scale: 0.72,
      alpha: 0.38,
      yoyo: true,
      repeat: 1,
      duration: delay / 2,
      onComplete: () => {
        g.destroy();
        onComplete(x, y);
      }
    });
  }

  private spawnNextWave() {
    if (selectedMode === "endless") {
      this.spawnEndlessWave();
      return;
    }

    this.currentWave = this.currentRoom;
    if (this.currentWave >= this.level.waves.length) {
      this.spawnBoss();
      return;
    }

    const wave = this.level.waves[this.currentWave];
    this.waveActive = true;
    const levelIndex = Math.max(0, levels.findIndex((level) => level.id === this.level.id));
    this.ui.status.setText(`房间${this.currentRoom + 1}/${this.getRoomCount()} | ${wave.label}`);
    wave.enemies.forEach((entry) => {
      const bonus = levelIndex * 2 + this.currentRoom * 2;
      for (let i = 0; i < entry.count + bonus; i += 1) {
        const angle = Phaser.Math.FloatBetween(-1.1, 1.1);
        const distance = Phaser.Math.Between(280, 520);
        const x = Phaser.Math.Clamp(this.roomLeft() + ROOM_WIDTH * 0.5 + Math.cos(angle) * distance + Phaser.Math.Between(-220, 220), this.roomLeft() + 120, this.roomRight() - 120);
        const y = Phaser.Math.Clamp(520 + Math.sin(angle) * distance + Phaser.Math.Between(-180, 180), 160, WORLD_HEIGHT - 130);
        this.spawnEnemy(entry.enemyId, x, y);
      }
    });
  }

  private spawnEndlessWave() {
    this.endlessWave += 1;
    this.waveActive = true;
    this.currentRoom = Math.min(this.getRoomCount() - 1, (this.endlessWave - 1) % this.getRoomCount());
    this.roomStates[this.currentRoom] = "active";
    const pool = Object.keys(enemies).filter((id) => !enemies[id].elite);
    const count = 10 + this.endlessWave * 4;
    this.ui.status.setText(`无尽第${this.endlessWave}波 | 当前积分 ${this.endlessScore}`);
    for (let i = 0; i < count; i += 1) {
      const id = Phaser.Utils.Array.GetRandom(pool);
      const x = Phaser.Math.Between(this.roomLeft() + 120, this.roomRight() - 120);
      const y = Phaser.Math.Between(150, WORLD_HEIGHT - 130);
      this.spawnEnemy(id, x, y);
    }
  }

  private spawnEnemy(enemyId: string, x: number, y: number) {
    const config = enemies[enemyId];
    const actor = this.physics.add.image(x, y, enemyId) as EnemyActor;
    const levelIndex = selectedMode === "endless" ? Math.floor(this.endlessWave / 2) : Math.max(0, levels.findIndex((level) => level.id === this.level.id));
    const scale = 1 + levelIndex * 0.13 + (selectedMode === "endless" ? this.endlessWave * 0.035 : 0);
    actor.actorKind = "minion";
    actor.enemyId = enemyId;
    actor.family = config.family;
    actor.hp = Math.floor(config.hp * scale);
    actor.maxHp = actor.hp;
    actor.damage = Math.floor(config.damage * (1 + levelIndex * 0.08));
    actor.speed = config.speed + levelIndex * 3;
    actor.lastHitAt = 0;
    actor.markedUntil = 0;
    actor.setDepth(config.elite ? 18 : 16);
    actor.setCollideWorldBounds(true);
    if (config.elite) actor.setScale(1.15);
    actor.baseScale = config.elite ? 1.15 : 1;
    this.centerCircleBody(actor, config.radius);
    actor.nameLabel = this.add.text(x, y - 40, config.name, {
      fontSize: config.elite ? "16px" : "13px",
      color: config.elite ? "#ffd37a" : "#b9c4d4"
    }).setOrigin(0.5).setDepth(30);
    actor.hpBar = this.add.graphics().setDepth(31);
    this.enemies.add(actor);
  }

  private openRoomDoor(label: string) {
    this.roomDoor?.destroy();
    const doorX = this.roomRight() - 18;
    this.roomDoor = this.add.rectangle(doorX, 520, 34, 210, this.level.palette.glow, 0.58)
      .setDepth(14)
      .setStrokeStyle(3, 0xffffff, 0.66);
    this.add.text(doorX - 76, 376, label, { fontSize: "18px", color: "#fff1b8" }).setDepth(30);
    this.drawPixelMosaic(doorX, 520, 120, this.level.palette.glow, 46, 15);
    this.ui.status.setText(`${label}已开启 | 走到右侧光门进入`);
  }

  private checkDoorTransition() {
    if (selectedMode !== "story") return;
    if (this.roomStates[this.currentRoom] !== "cleared") return;
    if (this.currentRoom >= this.getRoomCount() - 1) return;
    if (this.player.x < this.roomRight() - 18) return;
    this.roomDoor?.destroy();
    this.roomDoor = undefined;
    this.currentRoom += 1;
    this.roomStates[this.currentRoom] = "active";
    this.player.x = this.roomLeft() + 150;
    this.player.y = 520;
    this.cameras.main.pan(this.player.x, this.player.y, 360, "Sine.easeInOut");
    this.time.delayedCall(260, () => this.spawnNextWave());
  }

  private spawnBoss() {
    if (this.bossSpawned) return;
    this.bossSpawned = true;
    this.waveActive = true;
    const levelIndex = Math.max(0, levels.findIndex((level) => level.id === this.level.id));
    const bossNames: Record<string, string> = {
      "verdict-knight": "圣裁骑士",
      "mist-warden": "雾峰守望者",
      "ember-colossus": "赤沙熔岩巨像",
      "frost-jailer": "寒牢典狱长",
      "iron-exarch": "幽铁执政官",
      "void-prelate": "虚空主祭",
      "storm-general": "雷门战将",
      "saint-verdict": "圣裁王座化身"
    };
    const bossName = bossNames[this.level.bossId] ?? "圣裁骑士";
    this.ui.status.setText(`BOSS房间开启 | ${bossName}降临`);
    const boss = this.physics.add.image(this.roomLeft() + ROOM_WIDTH - 250, 520, "boss") as EnemyActor;
    boss.actorKind = "boss";
    boss.enemyId = this.level.bossId;
    boss.hp = 1250 + levelIndex * 430;
    boss.maxHp = boss.hp;
    boss.damage = 36 + levelIndex * 8;
    boss.speed = bossPhases[0].speed + levelIndex * 5;
    boss.lastHitAt = 0;
    boss.markedUntil = 0;
    boss.isBoss = true;
    boss.phaseIndex = 0;
    boss.bossTitle = bossName;
    boss.setDepth(19);
    boss.setCollideWorldBounds(true);
    this.centerCircleBody(boss, 40);
    boss.nameLabel = this.add.text(boss.x, boss.y - 78, `${bossName} 常态`, {
      fontSize: "18px",
      color: "#ffe095"
    }).setOrigin(0.5).setDepth(32);
    boss.hpBar = this.add.graphics().setDepth(101);
    this.enemies.add(boss);
    this.cameras.main.shake(260, 0.006);
  }

  private centerCircleBody(actor: Phaser.Physics.Arcade.Image, radius: number) {
    actor.setCircle(radius, actor.width / 2 - radius, actor.height / 2 - radius);
  }

  private checkWaveState() {
    if (!this.waveActive) return;
    if (this.enemies.countActive(true) === 0) {
      this.waveActive = false;
      if (selectedMode === "endless") {
        this.openRoomDoor("下一波");
        this.time.delayedCall(1200, () => {
          this.endlessScore += 250 + this.endlessWave * 100;
          this.currentRoom = (this.currentRoom + 1) % this.getRoomCount();
          this.player.x = this.roomLeft() + 180;
          this.player.y = 520;
          this.spawnNextWave();
        });
      } else {
        this.roomStates[this.currentRoom] = "cleared";
        this.openRoomDoor(this.currentRoom >= this.level.waves.length ? "通往终局" : "下一房间");
      }
    }
  }

  private updateHud(time: number) {
    this.ui.hp.clear();
    this.ui.mana.clear();
    drawBar(this.ui.hp, 24, 88, 300, 18, this.hp / this.hero.maxHp, 0x253140, 0xe35f5c);
    drawBar(this.ui.mana, 24, 114, 300, 14, this.mana / this.hero.maxMana, 0x253140, 0x65ccff);
    this.ui.mode.setText(selectedMode === "endless" ? `无尽第 ${this.endlessWave} 波 | 积分 ${this.endlessScore}` : `房间 ${Math.min(this.currentRoom + 1, this.getRoomCount())}/${this.getRoomCount()} | ${this.roomStates[this.currentRoom] === "cleared" ? "门已开启" : "清场中"}`);

    if (time < this.ascendUntil) {
      this.player.setTint(0xffe28a);
    } else if (time < this.invulnerableUntil) {
      this.player.setTint(0xffffff);
    } else {
      this.player.clearTint();
    }

    this.hero.skills.slice(1).forEach((skill, index) => {
      const readyAt = this.nextSkillAt.get(skill.id) ?? 0;
      const left = Math.max(0, readyAt - time);
      const key = skill.slot.toUpperCase();
      const card = this.ui.skillCards[index];
      const x = 380 + index * 260;
      const y = HEIGHT - 98;
      const cooldownRatio = Phaser.Math.Clamp(left / skill.cooldownMs, 0, 1);
      const noMana = this.mana < skill.manaCost;
      const ready = left <= 0 && !noMana;
      const status = left > 0 ? `冷却 ${(left / 1000).toFixed(1)}s` : noMana ? `魔力不足 ${skill.manaCost}` : "就绪";
      card.clear();
      card.fillStyle(ready ? 0x162638 : 0x101724, 0.96);
      card.fillRoundedRect(x - 112, y, 224, 74, 7);
      card.lineStyle(2, ready ? this.hero.visual.accent : noMana ? 0x617087 : 0x3d526e, ready ? 0.9 : 0.56);
      card.strokeRoundedRect(x - 112, y, 224, 74, 7);
      card.fillStyle(0x03060d, 0.65);
      card.fillRect(x - 103, y + 55, 206, 8);
      card.fillStyle(left > 0 ? 0x8390a4 : noMana ? 0x4b5a70 : this.hero.visual.accent, 0.9);
      card.fillRect(x - 103, y + 55, left > 0 ? 206 * (1 - cooldownRatio) : noMana ? 42 : 206, 8);
      if (left > 0) {
        card.fillStyle(0x000000, 0.48);
        card.fillRoundedRect(x - 112, y, 224, 74 * cooldownRatio, 7);
      }
      card.fillStyle(this.hero.visual.accent, ready ? 0.95 : 0.45);
      card.fillRect(x - 104, y + 10, 30, 28);
      this.ui.skills[index].setText(`${key}  ${skill.name}\n${status}`);
      this.ui.skills[index].setColor(ready ? "#fff2cc" : noMana ? "#718198" : "#b3bdcc");
    });

    const boss = this.enemies.getChildren().find((child) => (child as EnemyActor).isBoss) as EnemyActor | undefined;
    this.ui.boss.clear();
    if (boss?.active) {
      drawBar(this.ui.boss, WIDTH / 2 - 260, 32, 520, 16, boss.hp / boss.maxHp, 0x2a1620, boss.phaseIndex === 1 ? 0xff624e : 0xf3c766);
    }
  }

  private drawEnemyHp(enemy: EnemyActor) {
    if (!enemy.hpBar || enemy.isBoss) return;
    enemy.hpBar.clear();
    drawBar(enemy.hpBar, enemy.x - 26, enemy.y - enemy.displayHeight / 2 - 14, 52, 5, enemy.hp / enemy.maxHp, 0x171d29, 0x86e4ff);
  }

  private drawSkillEffect(skill: SkillConfig, x: number, y: number) {
    const colors: Record<SkillConfig["effectKey"], number> = {
      cloud: 0xd9f3ff,
      moon: 0xc7d5ff,
      star: 0xffe48a,
      wind: 0x8de8ce,
      seal: 0xd9a0ff,
      void: 0x9d7cff
    };
    const color = skill.id === "basic" ? this.hero.visual.accent : colors[skill.effectKey] ?? this.hero.visual.accent;
    const heroGlow = this.hero.visual.accent;
    const heroPrimary = this.hero.visual.primary;
    const g = this.add.graphics().setDepth(24);
    const angle = this.facing.angle();
    this.drawPixelMosaic(x, y, skill.id === "basic" ? skill.radius + 22 : skill.radius + 38, color, skill.id === "ultimate" ? 54 : skill.id === "basic" ? 18 : 32, 26);

    if (skill.id === "basic") {
      g.lineStyle(7, heroGlow, 0.95);
      g.beginPath();
      g.arc(x, y, skill.radius, angle - 0.92, angle + 0.92);
      g.strokePath();
      g.lineStyle(2, heroPrimary, 0.65);
      g.beginPath();
      g.arc(x - this.facing.x * 12, y - this.facing.y * 12, skill.radius + 16, angle - 0.7, angle + 0.72);
      g.strokePath();
    } else if (skill.id === "dash") {
      g.lineStyle(5, color, 0.92);
      const streaks = this.hero.visual.archetype === "assassin" ? 7 : this.hero.visual.archetype === "heavy" ? 3 : 5;
      for (let i = 0; i < streaks; i += 1) {
        const side = (i - 2) * 9;
        const nx = Math.cos(angle + Math.PI / 2) * side;
        const ny = Math.sin(angle + Math.PI / 2) * side;
        g.lineBetween(
          this.player.x - this.facing.x * 130 + nx,
          this.player.y - this.facing.y * 130 + ny,
          x + this.facing.x * 58 + nx,
          y + this.facing.y * 58 + ny
        );
      }
      g.fillStyle(heroGlow, 0.16);
      g.fillEllipse(x, y, skill.radius * 2.2, skill.radius * 0.8);
      if (this.hero.visual.aura === "void" || this.hero.visual.aura === "mist" || this.hero.visual.aura === "time") {
        g.lineStyle(2, heroGlow, 0.8);
        g.strokeRect(x - 24, y - 24, 48, 48);
        g.strokeRect(this.player.x - 20, this.player.y - 20, 40, 40);
      }
    } else if (skill.id === "sweep") {
      if (this.hero.visual.archetype === "polearm") {
        g.lineStyle(7, color, 0.92);
        g.lineBetween(this.player.x - this.facing.y * 16, this.player.y + this.facing.x * 16, x + this.facing.x * skill.radius, y + this.facing.y * skill.radius);
        g.lineStyle(3, 0xffffff, 0.55);
        g.lineBetween(this.player.x + this.facing.y * 18, this.player.y - this.facing.x * 18, x + this.facing.x * (skill.radius * 0.85), y + this.facing.y * (skill.radius * 0.85));
      } else if (this.hero.visual.weapon === "chain") {
        g.lineStyle(3, color, 0.95);
        for (let i = 0; i < 11; i += 1) {
          const a = angle - 1.6 + i * 0.32;
          g.strokeCircle(x + Math.cos(a) * skill.radius * 0.65, y + Math.sin(a) * skill.radius * 0.65, 8);
        }
      } else {
        g.lineStyle(this.hero.visual.archetype === "heavy" ? 8 : 5, color, 0.9);
        for (let i = 0; i < 3; i += 1) {
          g.beginPath();
          g.arc(x, y, skill.radius - i * 24, angle - 1.55, angle + 1.55);
          g.strokePath();
        }
      }
      g.fillStyle(heroGlow, 0.09);
      g.slice(x, y, skill.radius, Phaser.Math.RadToDeg(angle - 1.5), Phaser.Math.RadToDeg(angle + 1.5), false);
      g.fillPath();
      if (this.hero.visual.archetype === "heavy") {
        g.lineStyle(2, heroGlow, 0.55);
        for (let i = 0; i < 6; i += 1) {
          const crack = angle - 1.2 + i * 0.48;
          g.lineBetween(x, y, x + Math.cos(crack) * skill.radius * 0.92, y + Math.sin(crack) * skill.radius * 0.92);
        }
      }
    } else if (skill.id === "ultimate") {
      g.fillStyle(heroGlow, 0.08);
      g.fillEllipse(x, y, skill.radius * 1.8, skill.radius * 1.25);
      g.lineStyle(5, color, 0.95);
      for (let i = 0; i < 9; i += 1) {
        const a = angle - 1.2 + i * 0.3;
        const sx = x + Math.cos(a) * skill.radius * 0.78;
        const sy = y + Math.sin(a) * skill.radius * 0.78 - 150;
        const ex = x + Math.cos(a) * skill.radius * 0.45;
        const ey = y + Math.sin(a) * skill.radius * 0.45;
        g.lineBetween(sx, sy, ex, ey);
        g.fillCircle(ex, ey, 6);
      }
      g.lineStyle(7, heroGlow, 0.9);
      g.beginPath();
      g.arc(x, y, skill.radius * 0.72, angle - 1.05, angle + 1.05);
      g.strokePath();
      g.lineStyle(2, 0xffffff, 0.5);
      g.lineBetween(this.player.x, this.player.y, x + this.facing.x * 82, y + this.facing.y * 82);
      if (this.hero.visual.aura === "storm") {
        g.lineStyle(3, 0xfff36c, 0.75);
        for (let i = 0; i < 7; i += 1) g.lineBetween(x - 120 + i * 42, y - 120, x - 150 + i * 58, y + 70);
      } else if (this.hero.visual.aura === "flame" || this.hero.visual.aura === "blood" || this.hero.visual.aura === "crimson") {
        g.fillStyle(0xff7448, 0.14);
        for (let i = 0; i < 8; i += 1) g.fillTriangle(x, y, x + Math.cos(i) * 100, y + Math.sin(i) * 70, x + Math.cos(i + 0.45) * 120, y + Math.sin(i + 0.45) * 85);
      } else if (this.hero.visual.aura === "frost") {
        g.lineStyle(2, 0xe9fbff, 0.72);
        for (let i = 0; i < 10; i += 1) g.strokeRect(x - 100 + i * 22, y - 50 + (i % 2) * 20, 18, 18);
      } else if (this.hero.visual.aura === "time") {
        g.lineStyle(3, heroGlow, 0.75);
        g.strokeCircle(x, y, skill.radius * 0.48);
        for (let i = 0; i < 12; i += 1) g.lineBetween(x, y, x + Math.cos(i * Math.PI / 6) * skill.radius * 0.48, y + Math.sin(i * Math.PI / 6) * skill.radius * 0.48);
      }
    } else {
      g.lineStyle(3, color, 0.9);
      g.strokeCircle(x, y, skill.radius);
    }

    this.tweens.add({
      targets: g,
      alpha: 0,
      scale: skill.id === "ultimate" ? 1.22 : 1.08,
      duration: skill.id === "ultimate" ? 620 : 280,
      onComplete: () => g.destroy()
    });
    if (skill.id === "ultimate") {
      this.cameras.main.flash(150, 255, 230, 160, false);
      this.cameras.main.shake(240, 0.006);
    }
  }

  private drawBurst(x: number, y: number, color: number) {
    const g = this.add.graphics().setDepth(25);
    g.fillStyle(color, 0.18);
    g.fillCircle(x, y, 46);
    g.lineStyle(3, color, 0.92);
    for (let i = 0; i < 12; i += 1) {
      const angle = (Math.PI * 2 * i) / 12;
      const inner = 14 + (i % 3) * 4;
      const outer = 44 + (i % 2) * 12;
      g.lineBetween(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner, x + Math.cos(angle) * outer, y + Math.sin(angle) * outer);
    }
    this.tweens.add({ targets: g, alpha: 0, scale: 1.5, duration: 320, onComplete: () => g.destroy() });
  }

  private drawSkillArc(x: number, y: number, color: number) {
    const g = this.add.graphics().setDepth(25);
    g.fillStyle(color, 0.1);
    g.fillEllipse(x, y, 130, 70);
    g.lineStyle(6, color, 0.86);
    g.beginPath();
    g.arc(x, y, 60, -0.4, Math.PI + 0.4);
    g.strokePath();
    g.lineStyle(2, 0xffffff, 0.45);
    g.lineBetween(x - 58, y + 4, x + 58, y - 12);
    this.tweens.add({ targets: g, alpha: 0, scale: 1.25, duration: 260, onComplete: () => g.destroy() });
  }

  private drawGroundCrack(x: number, y: number, radius: number, color: number) {
    const g = this.add.graphics().setDepth(23);
    g.fillStyle(0x000000, 0.18);
    g.fillEllipse(x, y + 8, radius * 2.1, radius * 0.72);
    g.lineStyle(4, color, 0.82);
    for (let i = 0; i < 9; i += 1) {
      const angle = this.facing.angle() - 1.4 + i * 0.35 + Phaser.Math.FloatBetween(-0.12, 0.12);
      const mid = radius * Phaser.Math.FloatBetween(0.28, 0.52);
      const end = radius * Phaser.Math.FloatBetween(0.68, 1.08);
      const sx = x + Math.cos(angle) * 10;
      const sy = y + Math.sin(angle) * 6;
      const mx = x + Math.cos(angle) * mid + Phaser.Math.Between(-8, 8);
      const my = y + Math.sin(angle) * mid + Phaser.Math.Between(-6, 6);
      const ex = x + Math.cos(angle) * end;
      const ey = y + Math.sin(angle) * end;
      g.lineBetween(sx, sy, mx, my);
      g.lineBetween(mx, my, ex, ey);
    }
    g.fillStyle(color, 0.16);
    for (let i = 0; i < 8; i += 1) {
      g.fillRect(x + Phaser.Math.Between(-radius, radius), y + Phaser.Math.Between(-radius / 3, radius / 3), Phaser.Math.Between(4, 10), Phaser.Math.Between(3, 8));
    }
    this.tweens.add({ targets: g, alpha: 0, scale: 1.18, duration: 620, onComplete: () => g.destroy() });
  }

  private drawAfterimageSlash(x: number, y: number, color: number, index: number) {
    const g = this.add.graphics().setDepth(28);
    const angle = this.facing.angle() + (index - 1) * 0.46;
    g.lineStyle(3, color, 0.9);
    g.beginPath();
    g.arc(x, y, 44 + index * 8, angle - 0.75, angle + 0.75);
    g.strokePath();
    g.lineStyle(1, 0xffffff, 0.55);
    g.lineBetween(x - Math.cos(angle) * 48, y - Math.sin(angle) * 48, x + Math.cos(angle) * 48, y + Math.sin(angle) * 48);
    g.fillStyle(color, 0.12);
    g.fillEllipse(x - this.facing.x * index * 14, y - this.facing.y * index * 14, 82, 26);
    this.tweens.add({ targets: g, alpha: 0, scale: 1.25, duration: 280, onComplete: () => g.destroy() });
  }

  private drawPierceLine(length: number, width: number, color: number) {
    const g = this.add.graphics().setDepth(27);
    const angle = this.facing.angle();
    const sx = this.player.x;
    const sy = this.player.y;
    const ex = sx + this.facing.x * length;
    const ey = sy + this.facing.y * length;
    const nx = Math.cos(angle + Math.PI / 2);
    const ny = Math.sin(angle + Math.PI / 2);
    g.fillStyle(color, 0.14);
    g.fillTriangle(sx + nx * width, sy + ny * width, sx - nx * width, sy - ny * width, ex, ey);
    g.lineStyle(7, color, 0.9);
    g.lineBetween(sx, sy, ex, ey);
    g.lineStyle(2, 0xffffff, 0.6);
    g.lineBetween(sx + nx * 12, sy + ny * 12, ex + nx * 4, ey + ny * 4);
    for (let i = 0; i < 6; i += 1) {
      const t = i / 6;
      g.fillCircle(sx + this.facing.x * length * t, sy + this.facing.y * length * t, 3 + i % 2);
    }
    this.tweens.add({ targets: g, alpha: 0, scale: 1.04, duration: 360, onComplete: () => g.destroy() });
  }

  private drawRuneCircle(x: number, y: number, radius: number, color: number, aura: string) {
    const g = this.add.graphics().setDepth(22);
    g.fillStyle(color, aura === "flame" ? 0.12 : 0.08);
    g.fillCircle(x, y, radius);
    g.lineStyle(3, color, 0.74);
    g.strokeCircle(x, y, radius);
    g.strokeCircle(x, y, radius * 0.62);
    for (let i = 0; i < 12; i += 1) {
      const a = (Math.PI * 2 * i) / 12;
      const ix = x + Math.cos(a) * radius * 0.62;
      const iy = y + Math.sin(a) * radius * 0.62;
      const ox = x + Math.cos(a) * radius;
      const oy = y + Math.sin(a) * radius;
      g.lineBetween(ix, iy, ox, oy);
      if (i % 3 === 0) g.fillRect(ox - 4, oy - 4, 8, 8);
    }
    if (aura === "void") {
      g.lineStyle(2, 0xffffff, 0.38);
      g.strokeRect(x - radius * 0.45, y - radius * 0.45, radius * 0.9, radius * 0.9);
    }
    this.tweens.add({ targets: g, alpha: 0, rotation: 0.2, scale: 1.15, duration: 900, onComplete: () => g.destroy() });
  }

  private drawRunePulse(x: number, y: number, radius: number, color: number) {
    const g = this.add.graphics().setDepth(26);
    g.lineStyle(4, color, 0.82);
    g.strokeCircle(x, y, radius);
    g.lineStyle(1, 0xffffff, 0.45);
    for (let i = 0; i < 8; i += 1) {
      const a = (Math.PI * 2 * i) / 8;
      g.lineBetween(x, y, x + Math.cos(a) * radius, y + Math.sin(a) * radius);
    }
    this.tweens.add({ targets: g, alpha: 0, scale: 1.28, duration: 320, onComplete: () => g.destroy() });
  }

  private drawPixelMosaic(x: number, y: number, radius: number, color: number, count: number, depth = 25) {
    const g = this.add.graphics().setDepth(depth);
    const base = Math.max(4, Math.floor(radius / 18));
    for (let i = 0; i < count; i += 1) {
      const a = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const d = Phaser.Math.FloatBetween(radius * 0.16, radius);
      const size = base * Phaser.Math.Between(1, 3);
      g.fillStyle(i % 4 === 0 ? 0xffffff : color, i % 4 === 0 ? 0.58 : 0.8);
      g.fillRect(
        Math.round((x + Math.cos(a) * d) / 4) * 4,
        Math.round((y + Math.sin(a) * d * 0.62) / 4) * 4,
        size,
        size
      );
    }
    this.tweens.add({ targets: g, alpha: 0, scale: 1.18, duration: 420, onComplete: () => g.destroy() });
  }

  private drawPixelProjectile(x: number, y: number, length: number, color: number, kind: "arrow" | "orb") {
    const g = this.add.graphics().setDepth(31);
    const dir = this.facing.clone().normalize();
    const nx = -dir.y;
    const ny = dir.x;
    const startX = x + dir.x * 32;
    const startY = y + dir.y * 32;
    const endX = x + dir.x * length;
    const endY = y + dir.y * length;
    if (kind === "arrow") {
      g.fillStyle(color, 0.95);
      for (let i = 0; i < 9; i += 1) {
        const px = startX + dir.x * i * 18;
        const py = startY + dir.y * i * 18;
        g.fillRect(px - 5, py - 3, 18, 6);
      }
      g.fillStyle(0xffffff, 0.75);
      g.fillRect(startX + dir.x * 150 + nx * 7, startY + dir.y * 150 + ny * 7, 14, 4);
      g.fillRect(startX + dir.x * 150 - nx * 7, startY + dir.y * 150 - ny * 7, 14, 4);
    } else {
      g.fillStyle(color, 0.9);
      for (let i = 0; i < 7; i += 1) {
        const px = startX + dir.x * i * 22;
        const py = startY + dir.y * i * 22;
        g.fillRect(px - 8 + (i % 2) * 4, py - 8, 16, 16);
      }
      g.fillStyle(0xffffff, 0.56);
      g.fillRect(endX - 18, endY - 18, 36, 36);
      g.fillRect(endX - 34, endY - 6, 68, 12);
    }
    this.tweens.add({
      targets: g,
      x: dir.x * 72,
      y: dir.y * 72,
      alpha: 0,
      duration: kind === "arrow" ? 230 : 360,
      onComplete: () => g.destroy()
    });
  }

  private drawPixelJudgement(x: number, y: number, color: number) {
    const g = this.add.graphics().setDepth(29);
    g.fillStyle(color, 0.88);
    for (let i = 0; i < 10; i += 1) {
      const px = x - 20 + i * 4;
      g.fillRect(px, y - 126 + i * 7, 8, 34);
      if (i % 2 === 0) g.fillRect(px - 8, y - 48 + i * 2, 24, 8);
    }
    g.fillStyle(0xffffff, 0.62);
    g.fillRect(x - 6, y - 112, 12, 118);
    g.fillRect(x - 34, y - 12, 68, 10);
    this.tweens.add({ targets: g, alpha: 0, y: y + 18, duration: 360, onComplete: () => g.destroy() });
  }

  private drawPixelBulwark(x: number, y: number, color: number) {
    const g = this.add.graphics().setDepth(30);
    g.fillStyle(color, 0.72);
    const blocks = [
      [-44, -34], [-24, -48], [0, -54], [24, -48], [44, -34],
      [-54, -8], [54, -8], [-42, 20], [42, 20], [-18, 36], [18, 36]
    ];
    blocks.forEach(([bx, by]) => g.fillRect(x + bx, y + by, 18, 18));
    g.fillStyle(0xffffff, 0.38);
    blocks.filter((_, i) => i % 2 === 0).forEach(([bx, by]) => g.fillRect(x + bx + 4, y + by + 4, 10, 10));
    this.tweens.add({ targets: g, alpha: 0, scale: 1.12, duration: 520, onComplete: () => g.destroy() });
  }

  private drawPixelWindWake(x: number, y: number, color: number) {
    const g = this.add.graphics().setDepth(27);
    const nx = -this.facing.y;
    const ny = this.facing.x;
    g.fillStyle(color, 0.76);
    for (let i = 0; i < 18; i += 1) {
      const along = -130 + i * 17;
      const side = (i % 5 - 2) * 13;
      g.fillRect(x + this.facing.x * along + nx * side, y + this.facing.y * along + ny * side, 22 - (i % 3) * 4, 5);
    }
    this.tweens.add({ targets: g, alpha: 0, x: x + this.facing.x * 24, y: y + this.facing.y * 24, duration: 300, onComplete: () => g.destroy() });
  }

  private drawPixelChains(x: number, y: number, radius: number, color: number) {
    const g = this.add.graphics().setDepth(28);
    g.fillStyle(color, 0.86);
    for (let i = 0; i < 18; i += 1) {
      const a = this.facing.angle() - 1.3 + i * 0.16;
      const d = radius * (0.45 + (i % 4) * 0.08);
      const px = x + Math.cos(a) * d;
      const py = y + Math.sin(a) * d;
      g.fillRect(px - 7, py - 4, 14, 8);
      if (i % 3 === 0) g.fillRect(px - 3, py - 10, 6, 20);
    }
    this.tweens.add({ targets: g, alpha: 0, scale: 1.14, duration: 460, onComplete: () => g.destroy() });
  }

  private drawPixelVortex(x: number, y: number, color: number) {
    const g = this.add.graphics().setDepth(27);
    for (let i = 0; i < 34; i += 1) {
      const a = i * 0.48;
      const d = 14 + i * 3.2;
      g.fillStyle(i % 2 === 0 ? color : 0xffffff, i % 2 === 0 ? 0.78 : 0.44);
      g.fillRect(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7, 10, 10);
    }
    g.fillStyle(0x05070c, 0.72);
    g.fillRect(x - 18, y - 18, 36, 36);
    this.tweens.add({ targets: g, alpha: 0, rotation: 0.22, scale: 1.25, duration: 560, onComplete: () => g.destroy() });
  }

  private drawPixelLightning(x: number, y: number, color: number) {
    const g = this.add.graphics().setDepth(30);
    g.fillStyle(color, 0.95);
    let px = x - 14;
    let py = y - 132;
    for (let i = 0; i < 9; i += 1) {
      const nx = px + Phaser.Math.Between(-18, 22);
      const ny = py + 18;
      g.fillRect(Math.min(px, nx), py, Math.abs(nx - px) + 8, 8);
      g.fillRect(nx, py, 8, ny - py + 8);
      px = nx;
      py = ny;
    }
    g.fillStyle(0xffffff, 0.5);
    g.fillRect(x - 26, y - 4, 52, 10);
    this.tweens.add({ targets: g, alpha: 0, duration: 260, onComplete: () => g.destroy() });
  }

  private drawPixelSunrise(x: number, y: number, color: number) {
    const g = this.add.graphics().setDepth(27);
    g.fillStyle(color, 0.78);
    for (let i = 0; i < 11; i += 1) {
      const a = this.facing.angle() - 1.0 + i * 0.2;
      g.fillRect(x + Math.cos(a) * 48, y + Math.sin(a) * 34, 14, 70 - Math.abs(5 - i) * 7);
    }
    g.fillStyle(0xffffff, 0.42);
    g.fillRect(x - 60, y + 24, 120, 8);
    this.tweens.add({ targets: g, alpha: 0, y: y - 14, duration: 420, onComplete: () => g.destroy() });
  }

  private drawPixelStarfall(x: number, y: number, color: number) {
    const g = this.add.graphics().setDepth(30);
    g.fillStyle(color, 0.95);
    g.fillRect(x - 6, y - 132, 12, 92);
    g.fillRect(x - 22, y - 52, 44, 10);
    g.fillStyle(0xffffff, 0.6);
    g.fillRect(x - 10, y - 18, 20, 20);
    g.fillRect(x - 26, y - 10, 52, 6);
    this.tweens.add({ targets: g, alpha: 0, y: y + 18, duration: 320, onComplete: () => g.destroy() });
  }

  private drawPixelClock(x: number, y: number, color: number) {
    const g = this.add.graphics().setDepth(28);
    g.fillStyle(color, 0.78);
    for (let i = 0; i < 12; i += 1) {
      const a = (Math.PI * 2 * i) / 12;
      g.fillRect(x + Math.cos(a) * 78 - 5, y + Math.sin(a) * 50 - 5, 10, 10);
      if (i % 3 === 0) g.fillRect(x + Math.cos(a) * 44 - 4, y + Math.sin(a) * 28 - 4, 8, 8);
    }
    g.fillRect(x - 4, y - 4, 8, 8);
    g.fillRect(x, y - 44, 8, 44);
    g.fillRect(x, y, 48, 8);
    this.tweens.add({ targets: g, alpha: 0, rotation: 0.35, scale: 1.12, duration: 520, onComplete: () => g.destroy() });
  }

  private floatText(x: number, y: number, text: string, color: string) {
    const label = this.add.text(x, y, text, {
      fontSize: "18px",
      color,
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(120) as FloatingLabel;
    label.expiresAt = this.time.now + 760;
    label.velocityY = -42;
    this.labels.push(label);
  }

  private updateLabels(delta: number, time: number) {
    this.labels = this.labels.filter((label) => {
      label.y += label.velocityY * (delta / 1000);
      label.alpha = Math.max(0, (label.expiresAt - time) / 760);
      if (time >= label.expiresAt) {
        label.destroy();
        return false;
      }
      return true;
    });
  }

  private finishVictory() {
    if (this.ended) return;
    this.ended = true;
    const clearMs = this.time.now - this.startedAt;
    if (selectedMode === "story") {
      const save = loadSave();
      if (this.level.unlocks && !save.unlockedLevels.includes(this.level.unlocks)) save.unlockedLevels.push(this.level.unlocks);
      if (!save.bestClearMs || clearMs < save.bestClearMs) save.bestClearMs = clearMs;
      if (!save.achievements.includes("收剑入鞘")) save.achievements.push("收剑入鞘");
      writeSave(save);
      this.showResult("通关", `收剑入鞘，拂去衣上尘。用时 ${formatMs(clearMs)}\n${this.level.unlocks ? "下一章已解锁。" : "传奇暂告一段落。"}`, "#f7d787");
    } else {
      this.showResult("无尽结算", `最终积分 ${this.endlessScore}\n暂列第 ${this.getEndlessRank()} 名`, "#f7d787");
    }
  }

  private finishDefeat() {
    if (this.ended) return;
    this.ended = true;
    this.player.setTint(0x6a6d78);
    this.showResult("败北", selectedMode === "endless" ? `无尽积分 ${this.endlessScore}\n暂列第 ${this.getEndlessRank()} 名` : "圣裁仍悬于夜色。按提示重开本关或返回选角。", "#ff9a89");
  }

  private getEndlessRank() {
    return 1 + fakeLeaderboard.filter((row) => row[1] > this.endlessScore).length;
  }

  private showResult(title: string, body: string, color: string) {
    this.physics.pause();
    const panel = this.add.rectangle(WIDTH / 2, HEIGHT / 2, 560, 230, 0x0c111b, 0.94)
      .setStrokeStyle(2, 0xe3bf6a)
      .setScrollFactor(0)
      .setDepth(200);
    const titleText = this.add.text(WIDTH / 2, HEIGHT / 2 - 72, title, {
      fontSize: "46px",
      color,
      fontFamily: "serif"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    const bodyText = this.add.text(WIDTH / 2, HEIGHT / 2 - 12, body, {
      fontSize: "20px",
      color: "#d8e1ec",
      align: "center",
      wordWrap: { width: 470 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    const restart = this.add.rectangle(WIDTH / 2 - 118, HEIGHT / 2 + 76, 180, 44, 0x2d486e, 0.98)
      .setInteractive({ useHandCursor: true })
      .setScrollFactor(0)
      .setDepth(201);
    const back = this.add.rectangle(WIDTH / 2 + 118, HEIGHT / 2 + 76, 180, 44, 0xc49740, 0.98)
      .setInteractive({ useHandCursor: true })
      .setScrollFactor(0)
      .setDepth(201);
    this.add.text(restart.x, restart.y, "重开本关", { fontSize: "19px", color: "#f3f7ff" }).setOrigin(0.5).setScrollFactor(0).setDepth(202);
    this.add.text(back.x, back.y, "返回选角", { fontSize: "19px", color: "#11151c", fontStyle: "bold" }).setOrigin(0.5).setScrollFactor(0).setDepth(202);
    restart.on("pointerdown", () => this.scene.restart());
    back.on("pointerdown", () => this.scene.start("SelectScene"));
    void panel;
    void titleText;
    void bodyText;
  }
}

function createBackdrop(scene: Phaser.Scene, variant: "main" | "select") {
  const g = scene.add.graphics();
  g.fillGradientStyle(0x0a0d15, 0x101827, 0x21171a, 0x080a10, 1);
  g.fillRect(0, 0, WIDTH, HEIGHT);
  g.fillStyle(0xf5e6ac, 0.12);
  g.fillEllipse(WIDTH - 205, 118, 260, 112);
  g.fillStyle(0x162033, 0.7);
  for (let i = 0; i < 7; i += 1) {
    const baseX = i * 220 - 60;
    g.fillRect(baseX, 472 + (i % 2) * 22, 150, 248);
    g.fillTriangle(baseX, 472 + (i % 2) * 22, baseX + 75, 384 + (i % 2) * 22, baseX + 150, 472 + (i % 2) * 22);
  }
  g.fillStyle(0x1d293d, 0.86);
  for (let i = 0; i < 9; i += 1) {
    g.fillRect(i * 166 - 20, 508 + (i % 2) * 18, 112, 212);
    g.fillTriangle(i * 166 - 20, 508 + (i % 2) * 18, i * 166 + 36, 444 + (i % 2) * 18, i * 166 + 92, 508 + (i % 2) * 18);
  }
  g.fillStyle(0x090c13, 0.45);
  g.fillRect(0, HEIGHT - 86, WIDTH, 86);
  g.lineStyle(2, 0xd7bd76, 0.35);
  for (let i = 0; i < 8; i += 1) {
    const y = variant === "main" ? 90 + i * 40 : 72 + i * 48;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= WIDTH; x += 90) {
      g.lineTo(x, y + Math.sin((x + i * 60) / 150) * 14);
    }
    g.strokePath();
  }
  g.lineStyle(1, 0x8cd8ff, 0.12);
  for (let i = 0; i < 5; i += 1) {
    const y = 170 + i * 62;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(WIDTH, y - 34 + i * 8);
    g.strokePath();
  }
  scene.add.circle(WIDTH - 160, 112, 44, 0xf5e6ac, 0.82);
  const vignette = scene.add.graphics();
  vignette.fillStyle(0x000000, 0.26);
  vignette.fillRect(0, 0, WIDTH, 44);
  vignette.fillRect(0, HEIGHT - 44, WIDTH, 44);
  vignette.fillRect(0, 0, 42, HEIGHT);
  vignette.fillRect(WIDTH - 42, 0, 42, HEIGHT);
}

function createArena(scene: Phaser.Scene, level: LevelConfig, rooms = 1) {
  const g = scene.add.graphics();
  const p = level.palette;
  const worldW = ROOM_WIDTH * rooms;
  g.fillGradientStyle(p.skyTop, 0x171f30, p.skyBottom, 0x0a0e16, 1);
  g.fillRect(0, 0, worldW, WORLD_HEIGHT);
  g.fillStyle(p.glow, 0.06);
  for (let r = 0; r < rooms; r += 1) {
    const ox = r * ROOM_WIDTH;
    g.fillEllipse(ox + ROOM_WIDTH * 0.62, WORLD_HEIGHT * 0.45, 900, 420);
  }
  g.fillStyle(0x1c2534, 1);
  g.fillRect(0, 0, worldW, 82);
  g.fillStyle(0x161b26, 1);
  g.fillRect(0, WORLD_HEIGHT - 98, worldW, 98);

  if (level.theme === "castle") {
    g.fillStyle(0xf5e6ac, 0.9);
    for (let r = 0; r < rooms; r += 1) g.fillCircle(r * ROOM_WIDTH + ROOM_WIDTH - 155, 128, 44);
    g.fillStyle(0x121a2a, 0.94);
    for (let i = 0; i < 8; i += 1) {
      const bx = 36 + i * 170;
      const top = 126 + (i % 2) * 18;
      g.fillRect(bx, top, 86, 92);
      g.fillTriangle(bx, top, bx + 43, top - 46, bx + 86, top);
      g.fillRect(bx + 12, top + 76, 18, 30);
      g.fillRect(bx + 54, top + 70, 18, 36);
    }
    g.fillStyle(0x2c1d22, 0.65);
    for (let i = 0; i < rooms * 7; i += 1) {
      const x = 150 + i * 152;
      g.fillRect(x, 206, 12, 72);
      g.fillTriangle(x + 12, 210, x + 58, 228 + (i % 2) * 8, x + 12, 246);
    }
  } else if (level.theme === "desert") {
    g.fillStyle(0xffd08a, 0.58);
    for (let r = 0; r < rooms; r += 1) g.fillCircle(r * ROOM_WIDTH + ROOM_WIDTH - 190, 138, 52);
    g.fillStyle(0x5b2d1d, 0.56);
    for (let i = 0; i < rooms * 6; i += 1) g.fillTriangle(i * 245 - 40, 250, i * 245 + 110, 145, i * 245 + 270, 250);
  } else if (level.theme === "frost") {
    g.fillStyle(0xe9fbff, 0.75);
    for (let r = 0; r < rooms; r += 1) g.fillCircle(r * ROOM_WIDTH + ROOM_WIDTH - 180, 120, 34);
    g.lineStyle(2, 0xe9fbff, 0.18);
    for (let i = 0; i < rooms * 18; i += 1) g.lineBetween(i * 80, 110, i * 80 - 90, 260);
    g.fillStyle(0x1d3550, 0.65);
    for (let i = 0; i < rooms * 7; i += 1) g.fillTriangle(i * 210 - 60, 250, i * 210 + 70, 100, i * 210 + 210, 250);
  } else if (level.theme === "void") {
    g.fillStyle(0xa77cff, 0.18);
    for (let i = 0; i < rooms * 6; i += 1) {
      const x = 180 + i * 170;
      g.fillTriangle(x, 110, x + 40, 220, x - 30, 235);
      g.lineStyle(2, 0xf1dcff, 0.3);
      g.lineBetween(x, 108, x + 26, 228);
    }
  } else if (level.theme === "storm") {
    g.lineStyle(3, 0xfff36c, 0.55);
    for (let i = 0; i < rooms * 7; i += 1) {
      const x = 110 + i * 172;
      g.lineBetween(x, 92, x + 28, 145);
      g.lineBetween(x + 28, 145, x - 10, 206);
      g.lineBetween(x - 10, 206, x + 35, 250);
    }
  } else if (level.theme === "sanctum") {
    g.fillStyle(0xf0d16f, 0.14);
    for (let r = 0; r < rooms; r += 1) g.fillRect(r * ROOM_WIDTH + ROOM_WIDTH / 2 - 150, 92, 300, 180);
    g.fillStyle(0x2b2435, 0.78);
    for (let i = 0; i < rooms * 6; i += 1) g.fillRoundedRect(110 + i * 190, 108, 44, 160, 8);
  } else {
    g.fillStyle(p.accent, 0.12);
    for (let i = 0; i < 9; i += 1) g.fillEllipse(i * 160, 170 + (i % 3) * 28, 180, 34);
  }

  g.lineStyle(1, 0x293346, 0.68);
  for (let x = -120; x < worldW + 120; x += 96) {
    g.lineBetween(x, 106, x + 210, WORLD_HEIGHT - 92);
  }
  for (let y = 140; y < WORLD_HEIGHT - 92; y += 68) {
    g.lineBetween(0, y, worldW, y + 20);
  }
  g.lineStyle(1, p.line, 0.28);
  for (let i = 0; i < 14; i += 1) {
    const y = 122 + i * 38;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= worldW; x += 84) {
      g.lineTo(x, y + Math.sin((x + i * 100) / 115) * 7);
    }
    g.strokePath();
  }
  g.fillStyle(p.ground, 0.62);
  g.fillRect(0, 598, worldW, 72);
  g.fillStyle(p.accent, 0.42);
  for (let i = 0; i < rooms * 12; i += 1) {
    g.fillRect(72 + i * 126, 603 + (i % 2) * 9, 54, 19);
  }
  for (let r = 0; r < rooms; r += 1) {
    const ox = r * ROOM_WIDTH;
    g.lineStyle(3, p.glow, 0.22);
    g.beginPath();
    g.moveTo(ox + 62, 158);
    g.lineTo(ox + 280, 118 + (r % 2) * 46);
    g.lineTo(ox + 520, 148);
    g.lineTo(ox + 765, 104 + (r % 3) * 36);
    g.lineTo(ox + ROOM_WIDTH - 76, 166);
    g.lineTo(ox + ROOM_WIDTH - 104, WORLD_HEIGHT - 158);
    g.lineTo(ox + 910, WORLD_HEIGHT - 110 - (r % 2) * 44);
    g.lineTo(ox + 620, WORLD_HEIGHT - 146);
    g.lineTo(ox + 370, WORLD_HEIGHT - 102 - (r % 3) * 28);
    g.lineTo(ox + 74, WORLD_HEIGHT - 168);
    g.closePath();
    g.strokePath();
    g.fillStyle(0x000000, 0.18);
    g.fillTriangle(ox + 92, 180, ox + 250, 120 + (r % 2) * 40, ox + 120, 330);
    g.fillTriangle(ox + ROOM_WIDTH - 90, 210, ox + ROOM_WIDTH - 260, 142, ox + ROOM_WIDTH - 122, 385);
    g.fillStyle(p.skyTop, 0.28);
    for (let k = 0; k < 3; k += 1) {
      const hx = ox + 280 + k * 265 + (r % 2) * 38;
      const hy = 725 + ((r + k) % 3) * 70;
      g.fillRect(hx, hy, 90, 22);
      g.fillRect(hx + 22, hy - 28, 42, 78);
    }
    g.fillStyle(p.accent, 0.22);
    g.fillRect(ox + ROOM_WIDTH - 38, 420, 18, 210);
    g.fillStyle(0xffffff, 0.06);
    for (let i = 0; i < 9; i += 1) {
      g.fillRect(ox + 150 + i * 112, 760 + (i % 3) * 54, 52, 18);
      g.fillRect(ox + 220 + i * 116, 318 + (i % 2) * 74, 34, 56);
    }
  }
  g.fillStyle(0x000000, 0.22);
  g.fillRect(0, 82, worldW, 22);
  g.fillRect(0, WORLD_HEIGHT - 120, worldW, 22);
  g.fillStyle(0xffffff, 0.05);
  for (let i = 0; i < rooms * 16; i += 1) {
    g.fillEllipse(80 + i * 92, 170 + (i % 5) * 82, 130, 18);
  }
}

function drawBar(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, ratio: number, bg: number, fg: number) {
  const clamped = Phaser.Math.Clamp(ratio, 0, 1);
  g.fillStyle(bg, 0.95);
  g.fillRoundedRect(x, y, w, h, 4);
  g.fillStyle(fg, 0.95);
  g.fillRoundedRect(x, y, w * clamped, h, 4);
  g.lineStyle(1, 0xf0dfac, 0.4);
  g.strokeRoundedRect(x, y, w, h, 4);
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: WIDTH,
  height: HEIGHT,
  backgroundColor: "#090b12",
  physics: {
    default: "arcade",
    arcade: {
      debug: false
    }
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [MenuScene, SelectScene, GameScene]
});
