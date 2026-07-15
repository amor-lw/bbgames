# 下一任 Agent 接手计划

这份文档用于快速接手《幻域圣裁》Web 原型。目标不是重写项目，而是在现有 Phaser 垂直切片上继续增强可玩性、表现和稳定性。

## 当前状态

项目已经是一个可运行的 Phaser 3 + TypeScript + Vite 原型：

- 已提交到 GitHub：`git@github.com:amor-lw/bbgames.git`
- 当前分支：`main`
- 本地启动：`pnpm run dev --port 5173`
- 构建：`pnpm run build`

主要文件：

- `src/config.ts`：配置驱动内容
- `src/main.ts`：游戏主体
- `README.md`：启动和结构说明

## 已完成的大功能

- 主线模式和无尽模式
- 8 位精选英雄
- 每位英雄不同普攻/技能形态
- 技能冷却 HUD 固定在地图下方
- 多房间主线地图，清怪开门
- 8 个主题关卡，每关专属敌人池
- 无尽模式积分和伪排行榜
- 剧情开场文本
- 像素角色、怪物、地图、技能特效
- 普攻/技能按面朝方向释放

## 优先级最高的下一步

1. 真正的房间碰撞

当前房间是视觉上的异形边界，物理范围仍接近矩形。下一步应增加障碍物碰撞：

- 为每个房间生成墙体、坑洞、柱子
- 使用 `staticGroup` 或 Arcade physics body
- 确保怪物和玩家都不能穿过障碍

2. 技能手感继续差异化

现在有 `SkillForm`，但还有共用逻辑。建议继续拆：

- 弓箭：增加蓄力、散射、穿透衰减
- 锁链：命中后拉近或定身
- 盾卫：格挡窗口、反击
- 法球：慢速飞行、碰撞爆炸
- 星坠：延迟预警后落点爆发
- 枪骑：突刺距离和命中停顿

入口：

```text
src/config.ts     SkillForm / makeSkills()
src/main.ts       applyFormSkill()
```

3. 动画系统

当前动画是程序化压缩、残影和缩放。下一步可以做简单帧动画：

- `idle`
- `walk`
- `attack`
- `cast`
- `hit`
- `death`

可以先继续用程序化 texture，也可以引入 spritesheet。

4. 敌人 AI 分层

当前小怪基本追踪玩家。建议加入行为类型：

- 近战追击
- 远程射击
- 冲锋
- 召唤
- 环绕游走
- 自爆
- 护盾兵

推荐给 `EnemyConfig` 增加：

```ts
behavior: "chase" | "ranged" | "charger" | "summoner" | "orbit" | "bomber" | "guard";
```

然后在 `updateEnemies()` 分支处理。

5. BOSS 机制

当前 BOSS 共用技能池。建议按关卡拆 BOSS：

- 每个 bossId 对应独立技能池
- 增加场地机制
- 狂暴阶段改变地形或召唤精英
- 技能前摇和红区提示更清晰

入口：

```text
src/config.ts     bossPhases / levels[].bossId
src/main.ts       updateBoss() / bossAttack()
```

## 中期打磨

- 增加音效：攻击、受击、开门、BOSS 转阶段、胜败
- 增加暂停菜单
- 增加按键说明页
- 移动端适配
- UI 字号和布局适配窄屏
- 更完整的图鉴和成就
- 无尽模式本地最高分存档

## 已知问题

- 程序化像素图形仍偏占位，美术风格还不够统一。
- 无尽排行榜是假数据，没有网络排名。
- 地图异形边界只是视觉，不是严格碰撞。
- 敌人没有死亡动画，只是爆裂消失。
- 技能冷却栏在非常窄的浏览器窗口下可能需要进一步缩放。

## 开发建议

- 优先保持 `pnpm run build` 通过。
- 每次大改后用浏览器打开 `http://127.0.0.1:5173/` 验证主菜单、选角页、进入第一关。
- 不要提交 `node_modules/`、`dist/`、`.pnpm-store/`。
- 如果继续加配置字段，优先在 `src/config.ts` 类型里明确声明，避免战斗逻辑里用隐式字符串。

## 推荐下一次提交主题

```text
Add room collision and enemy behavior types
```

建议包含：

- `EnemyConfig.behavior`
- 第一关 2-3 种敌人行为
- 房间静态障碍碰撞
- 构建验证
