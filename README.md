# 幻域圣裁 Web 垂直切片

像素风单人动作闯关原型，基于 Phaser 3 + TypeScript + Vite。当前版本聚焦验证“西式冷兵器与魔法基底 + 东方剑仙气韵”的核心手感：键盘操作、8 位差异化英雄、主线/无尽双模式、多房间清怪开门、双阶段 BOSS、像素技能特效与本地存档。

## 快速启动

```bash
pnpm install
pnpm run dev --port 5173
```

打开：

```text
http://127.0.0.1:5173/
```

构建检查：

```bash
pnpm run build
```

## 操作

- `WASD` / 方向键：移动，并决定面朝方向
- `J`：普攻
- `U` / `I` / `O`：三个技能

普攻和技能会按角色当前面朝方向释放。底部 HUD 会显示三个技能的冷却、就绪和魔力不足状态。

## 当前内容

- 主菜单：主线模式、无尽模式、英雄图鉴、存档、设置、成就入口
- 主线模式：初始只开放第 1 关，通关后逐关解锁
- 无尽模式：循环刷怪、累计积分、伪排行榜
- 英雄：8 位精选像素英雄，普攻和技能形态不同
- 关卡：8 个主题关卡，每关独立敌人池
- 地图：横向多房间地图，清完当前房间怪物后打开右侧光门
- BOSS：每关最后房间触发双阶段 BOSS
- 存档：浏览器 `localStorage`，key 为 `phantom-verdict-save-v2`

## 代码结构

```text
src/config.ts   角色、技能、敌人、关卡配置
src/main.ts     Phaser 场景、战斗逻辑、HUD、像素绘制
src/styles.css  页面和 canvas 像素渲染样式
```

## 重要实现点

- `makeSkills()`：根据英雄武器和 aura 生成技能配置，包含 `SkillForm`
- `applyFormSkill()`：按技能形态执行不同判定，例如箭矢、法球、锁链、护盾、震地、枪刺、旋涡、星坠
- `drawSkillEffect()` 和 `drawPixel*()`：像素技能特效绘制
- `spawnNextWave()` / `checkDoorTransition()`：主线房间推进
- `spawnEndlessWave()`：无尽模式刷怪
- `createArena()`：多房间地图背景与异形边界视觉

## 注意事项

- `node_modules/`、`dist/`、`.pnpm-store/` 已通过 `.gitignore` 排除。
- 当前美术全部是程序化像素占位图，还没有正式素材管线。
- 当前地图的不规则边界主要是视觉表现，物理碰撞仍是房间矩形范围。
- 当前排行榜是前端伪数据，没有后端。
