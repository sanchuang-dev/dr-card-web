# 卡博士 APP UI 工程工作方式

## 项目定位

`dr-card-web`（原仓库 `dr-card-ui`）的本文件记录卡博士移动 APP 高保真 UI 阶段的工程工作方式，正式 H5 的现行工程规则优先遵循 `AGENTS.md`。

目标不是搭建完整业务系统，而是：

- 还原 Mockplus 原型
- 沉淀 Com Design 移动组件
- 快速输出高质量视觉稿
- 保证后续可持续开发

## 技术基线

- React + TypeScript
- Vite
- Tailwind CSS
- React Router
- Lucide React
- Playwright（交互验收）

## 核心工作原则

### 原型驱动

以已确认 Mockplus 原型作为页面实现依据。

遇到：

- 历史设计资料
- 原型缺失
- 多方案冲突

必须记录差异并讨论，不允许智能体自行替换产品设计。

### 组件驱动

页面不是组件堆积场。

开发顺序：

Com Design Core
→ Mobile Extension
→ Card Domain Component
→ Page Composition

禁止页面内部复制已有组件。

### Token 驱动

视觉必须通过 Token 管理。

结构：

Primitive
→ Semantic
→ Component

页面禁止直接定义品牌颜色。

### 设计与工程分离

设计原则描述：

`docs/design/design-principles.md`

施工规范描述：

`docs/workflow/engineering-workflow.md`

Penpot 迁移、AI 派卡、长图/状态画板组织与验收方法：

[`docs/workflow/penpot-migration-workflow.md`](./penpot-migration-workflow.md)

三者共同约束项目。

## 开发流程

1. 阅读原型和设计说明
2. 判断是否存在历史设计冲突
3. 确认页面范围
4. 检查已有组件
5. 开发组件或页面
6. TypeScript 检查
7. Build 验证
8. Playwright 验收关键流程

## 验收策略

优先验证真实用户路径：

- 页面进入
- 页面切换
- 核心操作流程
- 关键视觉状态

不追求无意义的大量测试覆盖。

## 提交规范

一个任务保持一个清晰提交范围。

提交说明：

- 完成内容
- 影响范围
- 验证方式
- 是否需要产品/设计确认

## 禁止事项

- 未确认直接采用历史设计
- 引入新的颜色体系
- 页面复制组件代码
- 为测试牺牲原型开发速度
