# Agent Evaluation Patterns · AI Agent 评估工程模式完全手册

> **不是 Agent 变差了，是你根本没量过。**
> *Your agent did not get worse. You just never measured it.*

[![Deploy to GitHub Pages](https://github.com/yuxinrun/agent-evaluation-patterns/actions/workflows/deploy.yml/badge.svg)](https://github.com/yuxinrun/agent-evaluation-patterns/actions/workflows/deploy.yml)

**在线阅读**：[中文](https://yuxinrun.github.io/agent-evaluation-patterns/) · [English](https://yuxinrun.github.io/agent-evaluation-patterns/en/)

这是一本面向工程团队的 **Agent 评测实战手册**：把「怎么系统地评测一个 AI Agent」拆成 17 章可落地的工程模式，从指标体系、数据集工程、四大评测器，到 CI 门禁、裁判校准、安全红队、线上评测、大规模并发，一路打通到生态联动。全部大白话 + 生活化类比 + 流程图 + 对比表 + 指标看板 + 可运行 Demo + 官方来源链接。

## 适合谁读

| 角色 | 你能从这里得到 |
| --- | --- |
| Agent 开发者 | 回归流水线、CI 门禁、轨迹评测的具体做法与现成脚本 |
| 质量 / 评测负责人 | 指标体系、黄金数据集、评分标尺（Rubric）的完整搭建路径 |
| 平台工程师 | LLM 裁判校准、限流重试、大规模评测集群的架构模式 |
| 技术管理者 | 评测平台选型对比、成本与预算熔断、90 天落地路线图 |

## 内容结构（00–16 共 17 章）

| 章节 | 主题 |
| --- | --- |
| 00 | 开篇：为什么 Agent 评测是质检车间 |
| 01 | 基础概念：Agent 评测底层框架 |
| 02 | 评测指标体系与看板样例 |
| 03 | 数据集工程：最容易被忽略的地基 |
| 04 | 四大评测器核心 Pattern |
| 05 | 轨迹评测：Agent 独有的战场 |
| 06 | 自动化回归流水线与 CI 门禁 |
| 07 | A/B 实验与版本对比评测 |
| 08 | 生态组件联动评测 |
| 09 | 开源评测平台与库选型 |
| 10 | LLM 裁判校准与降噪 |
| 11 | 安全、隐私与合规评测 |
| 12 | 生产环境线上评测 |
| 13 | 高频踩坑血泪清单 |
| 14 | 可直接运行的实战 Demo |
| 15 | 大规模集群与高并发评测 |
| 16 | 完整生态联动与下一步 |

## 生态矩阵

本站是「Agent 工程模式」系列丛书中的一本，与其他站点互相引用、统一阅读体验：

| 站点 | 主题 |
| --- | --- |
| [Better Agent](https://yuxinrun.github.io/better-agent/) | Agent 工程改进总纲 |
| [Agent Observability Patterns](https://yuxinrun.github.io/agent-observability-patterns/) | 观测：抓取 Trace |
| [Agent Evaluation Patterns](https://yuxinrun.github.io/agent-evaluation-patterns/)（本站） | 评测：给 Trace 打分 |
| [Agent Memory Patterns](https://yuxinrun.github.io/agent-memory-patterns/) | 记忆系统设计 |
| [A2A Patterns](https://yuxinrun.github.io/a2a-patterns/) | Agent 间协作 |
| [MCP Patterns](https://yuxinrun.github.io/mcp-patterns/) | 工具与上下文协议 |
| [LLM Gateway Patterns](https://yuxinrun.github.io/llm-gateway-patterns/) | 模型网关与路由 |

## 技术栈

- [VitePress](https://vitepress.dev/) 1.6 + Vue 3 自定义主题
- 中英双语一键切换 · 明暗主题 · 全站自适应 · 轻量动效
- 数据驱动的章节目录（`catalog.ts`）与 SVG 图解组件（`<Diagram />` 7 种版式）
- 站内搜索、面包屑、上一章/下一章、每章来源链接
- GitHub Actions 自动构建并部署到 GitHub Pages

## 本地开发

```bash
npm install
npm run dev      # 本地预览 http://localhost:5173
npm run build    # 产出 docs/.vitepress/dist
npm run preview  # 预览构建产物
```

## License

[MIT](./LICENSE) © 2026 鱼心 · yuxinrun
