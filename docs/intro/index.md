---
title: 00 · 开篇：为什么 Agent 评测是质检车间
description: 普通 LLM 评测和 Agent 评测的根本差别、不评测会踩的三个坑、四大目标，以及评测与可观测性如何打通。
outline: [2, 3]
---

# 00 · 开篇：为什么 Agent 评测是质检车间

你一定见过这样的场景：周三下午，某位同事在群里说「我把提示词优化了一下，感觉聪明多了」，于是大家把新版本推上了线。周五下午，客服群里开始出现「它怎么又问我要一遍订单号」，而你打开后台，看到的只有一堆看不懂的日志。

这不是团队不努力，这是**没有质检车间**。

工厂不敢在没有任何检测的情况下把零件装箱发货，但今天的 AI 团队，天天在干这件事。

## 01 没有评测，上线就是赌运气 {#pain}

先讲一个生活类比。

你家楼下有个面馆，老板有一天觉得「盐少放一点更健康」，于是改了配方。他没有让任何人先尝一口，直接全店上新。第二天：

- 三分之一的老客说「今天没味儿」；
- 一位没说话，再也没来；
- 老板自己想尝，但今天的汤已经被倒掉了。

问题不是「改配方」，而是**改了之后没有任何东西告诉你，它变好还是变差**。老板凭的是「我觉得健康」，客户凭的是「我觉得不好吃」，两边的证据都是感觉，谁也没法说服谁。

Agent 团队每天在处理同样的局面，只不过赌注更大。

<Diagram id="eval-gap" />

这个过程里最要命的一句是「说不清哪坏了」。当你连「哪里变差」都说不清时：

| 你想做的事 | 没有评测时 | 有评测后 |
| --- | --- | --- |
| 判断新版提示词好不好 | 拉三个人各试五条，投票 | 同一数据集跑 300 条，成功率 82.1% → 91.4% |
| 换模型敢不敢换 | 只敢在边缘功能上试 | 关键指标不掉，成本降 40%，直接换 |
| 出问题怎么定位 | 翻日志、猜、改代码试试 | 打开失败 Trace，看第 3 步工具入参错了 |
| 能不能回滚 | 不敢，怕回滚更糟 | 基线指标在这，回滚即验证 |
| 给老板汇报 | 「体验更好了」 | 「任务完成率 +9.3pt，误调用 -62%，成本 +0.4 分/次」 |

::: tip 人话翻译
**评测就是把「我觉得好了」换成「数据说好了」。** 它不保证你的 Agent 一定聪明，但它能保证：每一次「变好」，都有证据；每一次「变差」，都能被抓到。
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents" target="_blank" rel="noreferrer">Anthropic · Demystifying evals for AI agents</a>
</div>

## 02 普通 LLM 评测 vs Agent 评测 {#difference}

这是全书最重要的一张对照图。很多人以为「Agent 评测 = 把模型评测再来一遍」，结果做完发现：分挺高，线上照样翻车。

<Diagram id="llm-vs-agent" />

差别到底在哪？展开讲：

**第一层：评测对象变了。** 普通 LLM 的输入是一段文本，输出是一段文本。Agent 的输入是一个**目标 + 环境 + 工具集**，输出是**一个答案 + 一整条轨迹**。轨迹里可能包含十几次模型调用、五次工具调用、两次自我纠正。

**第二层：失败模式变了。** LLM 答错就是答错；Agent 有三种更隐蔽的失败：

| 失败类型 | 长什么样 | 最终答案看得出来吗 |
| --- | --- | --- |
| 结果错 | 答案就是不对 | 看得出来 |
| 过程错 | 答案对了，但调了 6 次无关工具、差点写脏数据 | **看不出来** |
| 副作用错 | 答案对了，但顺手把用户地址改了 | **看不出来，且很贵** |

**第三层：成本结构变了。** 一次 LLM 评测 = 一次调用 + 一次打分。一次 Agent 评测 = 几十次调用 + 一次轨迹打分 + 可能的环境重置。跑 1000 条用例，账单差两个数量级。

**第四层：可复现性变了。** LLM 评测的输入是静态的；Agent 会**改变环境**（写数据库、发消息、建工单），第二次跑同一个用例时，初始状态已经不是原来的了。所以 Agent 评测必须先解决「环境快照与回滚」，这是第 05 章的重点。

::: warning 最常见的误判
「我把最终答案用 LLM 打了个分，平均 4.6/5，很不错。」——这几乎是所有团队第一次做评测时的样子，也是第 13 章踩坑清单的第一条：**只评最终答案，等于给一辆撞了护栏但停在终点的车发奖杯。**
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://docs.langchain.com/langsmith/evaluation-approaches" target="_blank" rel="noreferrer">LangSmith · Evaluation approaches</a>
  <a href="https://developers.openai.com/api/docs/guides/agent-evals" target="_blank" rel="noreferrer">OpenAI · Agent evals</a>
</div>

## 03 三个真实翻车现场 {#disasters}

下面三个场景都做过脱敏，但结构完全真实——你大概率会在自己的项目里遇到同一类。

### 场景一：偷偷幻觉，只在长尾出现

一个电商客服 Agent，负责回答退换货政策。团队用 50 条「标准问题」测过，全过。上线两周后，一条投诉截图发到群里：Agent 信誓旦旦地说「我们支持 90 天无理由退货」。

真实政策是 7 天。Agent 从训练数据里「合理推测」了一个数字。

为什么标准用例抓不到？因为测试用例里问的都是「怎么退货」，没人问「多少天」。**幻觉的触发条件往往是「知识缺失 + 用户追问细节」这个组合，而你的测试集里恰好没有这个组合。**

修法不是改一句提示词，而是：
1. 把「政策类事实题」列成专门的用例族（第 03 章的分类法）；
2. 用**代码校验器**断言回答里出现的数字必须来自知识库检索结果（第 04 章）；
3. 在系统提示里加一条硬规则：未检索到政策条款时，不许输出任何时效数字。

### 场景二：工具乱调用，一天烧掉 800 美元

一个数据分析 Agent，接了 SQL 查询工具。某天一个用户问了个模糊问题，Agent 开始「自我探索」：查一次、发现不对、换个条件再查、再发现不对……单次会话调了 47 次 SQL，其中 39 次是全表扫描。

因为没人统计过「平均工具调用次数」这个指标，所以这件事是在账单出来时被发现的。

修法：
1. 增加**过程指标**：每 Trace 工具调用次数、重复调用率（第 02 章）；
2. 加**循环检测**：同一工具 + 相似入参出现 3 次即中断（第 05 章）；
3. 加**预算门禁**：单会话 token / 调用上限，超限降级。

### 场景三：版本越改越好，直到彻底崩了

一个内部知识库助手，团队每周迭代一次提示词，每次都觉得「这次更好」。三个月后新员工试用，反馈「它经常答得驴头不对马嘴」。翻记录才发现：第 4 次迭代时把「不确定就说不知道」这句约束删掉了（为了让它「更敢答」），第 7 次迭代换了更小的模型（为了省钱），两件事叠加，**拒答率从 18% 掉到 1%，编造率从 3% 涨到 21%**。

没有人发现，因为**没有任何一个版本被完整测过，也没有任何一次对比**。

修法：
1. 每次改动跑同一份回归集，跟基线比（第 06 章）；
2. 指标里必须有「该拒答时是否拒答」（第 02 章）；
3. 每次改动只改一个变量，否则你永远不知道是谁的锅（第 07 章）。

::: warning 三个故事的共同点
不是「模型不行」，而是**没有度量**。三次翻车的成本，都远高于搭一套评测的成本。
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents" target="_blank" rel="noreferrer">Anthropic · Demystifying evals for AI agents</a>
  <a href="https://juejin.cn/tag/AI" target="_blank" rel="noreferrer">掘金 · Agent 评测踩坑合集</a>
</div>

## 04 Agent 评测四大目标 {#goals}

评测不是「为了有个分数」，它要解决四类具体问题。搞清楚你当下要解决哪一类，才知道该建多大的体系。

| 目标 | 回答什么问题 | 典型手段 | 频率 |
| --- | --- | --- | --- |
| 回归防护 | 我这次改动有没有把老功能弄坏？ | 固定回归集 + 基线对比 + CI 门禁 | 每次提交 |
| 质量验收 | 这个版本能不能上？ | 冒烟集 + 关键指标阈值 + 人工抽检 | 每次发版 |
| 对比实验 | 方案 A 和方案 B 谁更好？ | 单变量 A/B + 显著性判断 | 有争议时 |
| 故障沉淀 | 这次线上事故怎么变成防线？ | 失败 Trace 入库 + 打标 + 加用例 | 每次事故 |

### 回归防护：最便宜、收益最高

这是性价比最高的一件事，也是最容易被跳过的一件事。你不需要 5000 条用例，**30 条覆盖核心链路的回归集，就能拦掉 80% 的低级退化**。

### 质量验收：给发布定红线

不是所有指标都要完美，但必须有几条红线不许碰。比如：任务完成率不得低于 80%，PII 泄露率必须为 0，工具误调用率不得超过 5%。这就是第 02 章的 SLO 门禁。

### 对比实验：避免「两个都觉得好」

当团队里有人说「A 方案更自然」，有人说「B 方案更准」时，不要投票，去做单变量对比。第 07 章会给完整的实验设计与显著性判断方法。

### 故障沉淀：把事故变成资产

每一次线上事故，都应该变成一条永久用例。判断标准很简单：**同样的问题，第二次发生就是你的错。**

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://docs.langchain.com/langsmith/evaluation-approaches" target="_blank" rel="noreferrer">LangSmith · Evaluation approaches</a>
  <a href="https://promptfoo.dev/docs/guides/llm-as-a-judge/" target="_blank" rel="noreferrer">Promptfoo · LLM-as-a-judge</a>
</div>

## 05 观测抓 Trace，评测给 Trace 打分 {#loop}

这是本手册和「只讲离线数据集」的评测教程最大的分歧点：**评测的数据不该全靠人编，应该从线上真实流量里长出来。**

<Diagram id="eval-loop" />

把这条环拆成五段，每段的工程要点都不一样：

| 阶段 | 关键问题 | 工程手段 | 对应章节 |
| --- | --- | --- | --- |
| 生产流量 | 有没有留下可复盘的现场？ | OpenTelemetry Span、Trace ID 贯穿、模型与工具入参落盘 | 第 08、12 章 |
| 采样入库 | 哪些 Trace 值得变成样本？ | 失败采样 + 用户否定采样 + 高分采样 + 分层抽样 | 第 03、12 章 |
| 自动打分 | 打什么分、谁来打？ | 代码断言优先，LLM 裁判兜底 | 第 04 章 |
| 定位修复 | 是提示词、工具还是模型的问题？ | 按失败类型聚类，看失败集中在哪个 Span | 第 05、13 章 |
| 回归验证 | 修复有没有引入新问题？ | 基线对比 + 门禁 + 显著性 | 第 06、07 章 |

**观测与评测的分工，一句话说清：**

```text
可观测性  →  负责「发生了什么」：这次任务走了哪几步、调了什么工具、花了多少钱
评测      →  负责「这算不算好」：结果对不对、路径合不合理、副作用干不干净
```

没有观测，评测只能靠人编样本，永远追不上真实的坏 Case。
没有评测，观测就只是一堆「看起来很专业」的日志，没人能判断好坏。

::: tip 人话翻译
观测是**行车记录仪**，评测是**交警判责**。记录仪拍得再清楚，如果没人判责，事故还是白发生了。
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents" target="_blank" rel="noreferrer">Anthropic · Demystifying evals for AI agents</a>
  <a href="https://langfuse.com/docs/evaluation/overview" target="_blank" rel="noreferrer">Langfuse · Evaluation overview</a>
  <a href="https://arize.com/docs/phoenix" target="_blank" rel="noreferrer">Arize Phoenix · OTel-native evals</a>
</div>

## 06 本手册覆盖范围与生态位置 {#scope}

### 覆盖范围

这本手册从「什么是评测」讲到「怎么扛住每天十万条评测任务」。17 章的结构是：

```text
基础层   00 开篇 → 01 概念 → 02 指标
地基      03 数据集
核心      04 四大评测器 → 05 轨迹评测
工程化    06 CI 门禁 → 07 A/B 实验
联动      08 生态组件 → 09 平台选型
治理      10 裁判校准 → 11 安全合规
生产      12 线上评测 → 13 踩坑 → 14 Demo
规模化    15 高并发 → 16 生态闭环
```

### 本手册不覆盖什么

说清楚边界，比吹得更大更有用：

- **不教你训练模型**：评测不是微调，我们不谈 SFT、DPO。
- **不教你写 Agent 本身**：那是 [better-agent](https://yuxinrun.github.io/better-agent/) 的事。
- **不教你搭可观测平台**：那是 [agent-observability-patterns](https://yuxinrun.github.io/agent-observability-patterns/) 的事，我们只讲怎么消费它的数据。
- **不绑定任何厂商**：所有 Demo 都能换成等价实现。

### 在生态里的位置

<Diagram id="eval-stack" />

七块拼图的分工：

| 仓库 | 它负责什么 | 和评测的关系 |
| --- | --- | --- |
| [better-agent](https://yuxinrun.github.io/better-agent/) | 单 Agent 的循环、工具与上下文 | 提供「被测对象」，也提供跑批入口 |
| [agent-observability-patterns](https://yuxinrun.github.io/agent-observability-patterns/) | Trace、指标与排障 | 提供评测样本的原料 |
| **agent-evaluation-patterns** | 数据集、裁判、轨迹判定、门禁 | 本书 |
| [agent-memory-patterns](https://yuxinrun.github.io/agent-memory-patterns/) | 记忆分层与检索 | 记忆正确性需要专项评测 |
| [a2a-patterns](https://yuxinrun.github.io/a2a-patterns/) | 跨 Agent 协作 | 多 Agent 任务要端到端验收 |
| [mcp-patterns](https://yuxinrun.github.io/mcp-patterns/) | 工具标准化与权限 | 工具输出的稳定性是可测的 |
| [llm-gateway-patterns](https://yuxinrun.github.io/llm-gateway-patterns/) | 路由、限流、成本、审计 | 多模型对比与降级评测的数据源 |

### 一个可直接运行的最小示例

先给你一个 30 秒能跑起来的「评测骨架」，让你感受一下评测代码到底长什么样。后面每一章都会在这个骨架上加零件。

```python
# minimal_eval.py — 不依赖任何框架，只演示「数据集 → 执行 → 打分 → 汇总」
import json
from dataclasses import dataclass

@dataclass
class Case:
    id: str
    question: str
    must_call: str          # 期望调用的工具名
    must_contain: list[str] # 答案中必须出现的关键事实

DATASET = [
    Case("refund-01", "我买的耳机能退吗？", "get_order", ["7 天"]),
    Case("refund-02", "超过 7 天还能退吗？", "get_refund_policy", ["不支持", "协商"]),
]

def run_agent(question: str) -> dict:
    """占位：真实项目里换成你的 Agent，返回答案与工具调用轨迹。"""
    return {
        "answer": "7 天内可以无理由退货。",
        "tool_calls": [{"name": "get_order", "args": {"order_id": "A1024"}}],
    }

def grade(case: Case, output: dict) -> dict:
    """代码校验优先：便宜、稳定、可解释。"""
    called = [c["name"] for c in output["tool_calls"]]
    return {
        "tool_ok": case.must_call in called,
        "facts_ok": all(k in output["answer"] for k in case.must_contain),
        "turns": len(called),
    }

rows = []
for case in DATASET:
    out = run_agent(case.question)
    rows.append({"id": case.id, **grade(case, out)})

passed = sum(r["tool_ok"] and r["facts_ok"] for r in rows)
print(json.dumps({
    "total": len(rows),
    "passed": passed,
    "success_rate": round(passed / len(rows), 3),
}, ensure_ascii=False, indent=2))
```

运行结果：

```text
{
  "total": 2,
  "passed": 2,
  "success_rate": 1.0
}
```

这段代码很土，但它已经包含了评测的全部要素：**数据集、被测对象、判定逻辑、汇总指标**。剩下的 16 章，就是在每一步上做工程化。

### 本章避坑清单

- [ ] 别把「几个同事试了觉得不错」当成评测，那是体验反馈，不是度量。
- [ ] 别一上来就搭大平台，先有 30 条能跑的用例。
- [ ] 别只测最终答案，Agent 的轨迹才是事故高发区。
- [ ] 别在没有任何基线的情况下改版本，否则你永远不知道自己在变好还是变差。
- [ ] 别把评测和观测做成两套系统，它们共享同一份 Trace。

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents" target="_blank" rel="noreferrer">Anthropic · Demystifying evals for AI agents</a>
  <a href="https://openai.github.io/openai-agents-python/" target="_blank" rel="noreferrer">OpenAI Agents SDK</a>
  <a href="https://docs.langchain.com/langsmith/trajectory-evals" target="_blank" rel="noreferrer">LangSmith · Trajectory evals</a>
</div>

---

下一章我们从最底层的心智模型开始：一条 Agent 任务，到底该切成几层来评？
