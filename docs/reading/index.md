---
title: 参考来源与延伸阅读
description: Anthropic、OpenAI、LangChain / LangSmith 官方评测资料，开源评测平台文档，关键论文与中文社区实践，附对应章节索引。
outline: [2, 3]
---

# 参考来源与延伸阅读

这本手册的写法是「先讲懂、再讲全」。想深挖某一块，按下面的顺序读最省时间。每一章的正文小节也都带了 `【来源】` 行，点开即跳原文。

::: warning 链接会变
官方文档经常改版、合并、迁移。下面优先给**稳定的文章页与文档根路径**；失效时用站内搜索搜关键词（例如 `trajectory eval`、`llm-rubric`、`agent evals`）比记 URL 更可靠。
:::

## 01 官方第一手资料 {#official}

### Anthropic / Claude

| 资料 | 讲什么 | 对应章节 |
| --- | --- | --- |
| [Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) | Agent 评测的完整工程视角：为什么需要轨迹级评分、怎么建数据集、怎么渐进扩量 | [00](/intro/)、[03](/datasets/)、[05](/trajectory/) |
| [Writing effective tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents) | 工具描述、入参与返回怎么设计才「可评测」 | [08](/component-evals/#mcp) |
| [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) | 工作流 vs Agent，以及「别过度设计」的工程判断 | [16](/ecosystem/#better-agent) |
| [Anthropic Engineering](https://www.anthropic.com/engineering) | 工程博客总入口，评测与上下文工程文章都在这里 | [01](/concepts/) |
| [Anthropic Research](https://www.anthropic.com/research) | 安全评测、红队与模型行为研究 | [11](/safety/) |

**读法建议**：先读 Demystifying evals 那一篇。你会发现本手册反复强调的「评分器优先用代码断言」「pass@k / pass^k」「轨迹比答案更重要」，都不是我们的发明，而是官方的工程取向。

### OpenAI

| 资料 | 讲什么 | 对应章节 |
| --- | --- | --- |
| [Agent evals 指南](https://developers.openai.com/api/docs/guides/agent-evals) | 怎么给 Agent 定义任务、轨迹与评分器 | [01](/concepts/)、[05](/trajectory/) |
| [Evals 指南](https://developers.openai.com/api/docs/guides/evals) | 数据集、评分器、运行与结果管理 | [03](/datasets/)、[09](/platforms/) |
| [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) | 官方 Agent 框架：Runner、工具、护栏、Tracing | [14](/demos/#langsmith) |
| [OpenAI Platform Docs](https://platform.openai.com/docs/) | 模型能力、结构化输出、工具调用的官方说明 | [04](/evaluators/#code) |

**关键差异点**：Anthropic 的写法更偏「工程方法论 + 逐步扩量」，OpenAI 的文档更偏「产品化的数据集与评分器 API」。两者互补：一个教你怎么想，一个给你现成的零件。

### LangChain / LangSmith

| 资料 | 讲什么 | 对应章节 |
| --- | --- | --- |
| [Agent Evaluation 概念](https://docs.langchain.com/langsmith/evaluation-approaches) | 评测的几种方式：终态、轨迹、单步 | [01](/concepts/#graders) |
| [Trajectory evaluations](https://docs.langchain.com/langsmith/trajectory-evals) | 轨迹匹配、严格顺序 vs 任意顺序、子集匹配 | [05](/trajectory/#match) |
| [Evaluate complex agents](https://docs.langchain.com/langsmith/evaluate-complex-agent) | 多轮、长链路 Agent 的评测组织方式 | [05](/trajectory/#reasonable) |
| [LangSmith 文档](https://docs.langchain.com/langsmith/home) | 数据集、实验、标注队列的完整文档 | [09](/platforms/#langsmith) |

## 02 开源评测平台与库 {#opensource}

| 项目 | 它解决的问题 | 值得抄的地方 |
| --- | --- | --- |
| [Promptfoo](https://www.promptfoo.dev/docs/configuration/expected-outputs/model-graded/llm-rubric/) | 声明式配置的批量评测与 CI 对比 | `llm-rubric` 断言写法、矩阵对比报告 |
| [Promptfoo · LLM-as-a-judge 指南](https://promptfoo.dev/docs/guides/llm-as-a-judge/) | 裁判 Prompt 怎么写才稳 | 评分维度拆分与 few-shot 校准 |
| [Promptfoo · GitHub Action](https://promptfoo.dev/docs/integrations/github-action/) | 把评测挂到 PR 上 | 失败即阻断的 yml 骨架 |
| [DeepEval](https://deepeval.com/docs/metrics-introduction) | Python 单测风格的评测库 | `assert_test()` 的写法、指标可组合 |
| [OpenEvals](https://github.com/langchain-ai/openevals) | LangChain 官方的开源评判器集合 | 评判器接口抽象、`create_llm_as_judge` |
| [Braintrust](https://www.braintrust.dev/docs/evaluation-quickstart) | 实验管理与评分（SaaS + 自托管） | 实验对比视图与数据集版本 |
| [Arize Phoenix](https://arize.com/docs/phoenix) | 开源可观测 + 评测 | OTel 原生链路、Span 级评分 |
| [Langfuse](https://langfuse.com/docs/evaluation/overview) | 观测 + 评测一体，自托管友好 | Trace → Dataset → Evaluator 的流转 |
| [Langfuse · LLM-as-a-judge](https://langfuse.com/docs/evaluation/evaluation-methods/llm-as-a-judge) | 线上抽样打分的产品化实现 | 采样器与异步评分队列 |
| [MLflow · Scorers](https://mlflow.org/docs/latest/genai/eval-monitor/scorers/) | 评判器与人工校准闭环 | 裁判与人工标注的一致性度量 |

::: tip 读开源代码的正确姿势
不要读「全流程」，读**三个函数**：`evaluate()` 怎么遍历数据集、`grade()` 怎么产出结构化结果、`report()` 怎么算基线差值。看完这三个，你对它的评测模型就懂了。
:::

## 03 关键论文与基准 {#papers}

| 论文 / 基准 | 一句话价值 | 对应章节 |
| --- | --- | --- |
| *Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena*（[arXiv:2306.05685](https://arxiv.org/abs/2306.05685)） | LLM 裁判的系统性研究：位置偏见、冗长偏见、自我偏好 | [10](/judge/#bias) |
| *τ-bench*（[arXiv:2406.12045](https://arxiv.org/abs/2406.12045)） | 真实业务场景下的工具-智能体-用户多轮评测 | [05](/trajectory/)、[07](/experiments/#significance) |
| *WebArena*（[arXiv:2307.13854](https://arxiv.org/abs/2307.13854)） | 端到端网页任务评测环境，强调「状态可校验」 | [11](/safety/#redteam) |
| *AgentBench*（[arXiv:2308.03688](https://arxiv.org/abs/2308.03688)） | 多环境 Agent 能力基准，暴露「单轮分数虚高」 | [02](/metrics/#outcome) |
| *SWE-bench*（[arXiv:2310.06770](https://arxiv.org/abs/2310.06770)） | 真实仓库改代码的可验证评测范式（跑测试即判分） | [04](/evaluators/#code) |
| *Chatbot Arena*（[arXiv:2403.04132](https://arxiv.org/abs/2403.04132)） | 两两对比 + Elo/Bradley-Terry 的规模化实践 | [04](/evaluators/#pairwise) |
| *HELM*（[arXiv:2211.09110](https://arxiv.org/abs/2211.09110)） | 「多指标、多场景」评测框架的经典范式 | [02](/metrics/#dashboard) |

::: warning 论文看结论，别照抄实现
论文的实验设定通常很干净（固定环境、固定数据集），生产环境的噪声多得多。**先看它的评测方法和失败案例，再看它的算法**——后者往往不可移植，前者通常可以。
:::

## 04 中文社区实战 {#chinese}

国内社区的价值在于「真实的翻车现场」：限流打爆、成本失控、数据集和业务脱节，这些在官方文档里往往只有一句话。

| 来源 | 适合看什么 | 对应章节 |
| --- | --- | --- |
| [InfoQ · AI 专题](https://www.infoq.cn/topic/AI) | 大厂 Agent 平台的评测体系设计与复盘 | [12](/production/) |
| [掘金 · AI 标签](https://juejin.cn/tag/AI) | 一线开发者的评测踩坑与代码片段 | [13](/pitfalls/) |
| [腾讯云开发者社区](https://cloud.tencent.com/developer) | 工程落地实践、性能与成本优化 | [15](/scale/) |
| [华为云开发者社区](https://developer.huaweicloud.com/) | 企业级评测平台与合规要求 | [11](/safety/) |

## 05 按角色的阅读路线 {#paths}

### 零基础 / 产品同学

```text
00 开篇 → 01 概念（只看图） → 02 指标 → 04 评测器（只看选型表） → 13 踩坑
```

目标：能判断「这个版本到底能不能上」，能和工程师对齐语言。

### 应用开发者

```text
01 概念 → 03 数据集 → 04 评测器 → 05 轨迹 → 06 CI 门禁 → 14 Demo
```

目标：两周内做出能阻断发布的评测流水线，并且知道成本花在哪。

### 后端 / 平台工程师

```text
03 数据集 → 06 门禁 → 09 平台 → 12 线上评测 → 15 规模化 → 10 裁判校准
```

目标：把评测做成服务，扛住多租户、并发与成本压力。

### 架构师

```text
00 开篇 → 02 指标 → 07 实验 → 08 组件联动 → 12 线上 → 16 生态
```

目标：画出完整的评测链路图，定清楚门禁红线与数据流向。

## 06 与本手册的关系 {#relation}

```text
官方文档  → 定义「能力边界」：能评什么、怎么评才被认可
工程博客  → 提供「取舍经验」：官方踩过的坑
开源实现  → 给出「参考实现」：能跑起来的代码
论文      → 说明「为什么有效」：机制与统计显著性
本手册    → 把这些拼成「可上线的一条路」：模式 + 代码 + 避坑
```

::: tip 一句话
**官方文档告诉你有什么零件，本手册告诉你这些零件怎么装成一条能拦车的产线。**
:::

## 相关站点 {#ecosystem}

- [better-agent](https://yuxinrun.github.io/better-agent/)：单 Agent 的循环、工具、上下文与评测
- [agent-observability-patterns](https://yuxinrun.github.io/agent-observability-patterns/)：Trace、指标与线上排障
- [a2a-patterns](https://yuxinrun.github.io/a2a-patterns/)：多 Agent 的发现、委派与协作
- [mcp-patterns](https://yuxinrun.github.io/mcp-patterns/)：工具调用的标准化与权限
- [agent-memory-patterns](https://yuxinrun.github.io/agent-memory-patterns/)：记忆的分层、检索与遗忘
- [llm-gateway-patterns](https://yuxinrun.github.io/llm-gateway-patterns/)：模型调用的路由、限流、成本与审计
- 本手册仓库：[github.com/yuxinrun/agent-evaluation-patterns](https://github.com/yuxinrun/agent-evaluation-patterns)

回到：[阅读指南](/start/) · [章节地图](/)
