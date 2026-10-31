---
title: 01 · 基础概念：Agent 评测底层框架
description: Run / Trace / Thread 三层评测对象、四类评测器、黄金数据集、评分标尺 Rubric 与评测节奏。
outline: [2, 3]
---

# 01 · 基础概念：Agent 评测底层框架

学任何工具之前，先想清楚一个问题：**你到底在评什么？**

这个问题答不对，后面所有努力都会跑偏。最常见的跑偏是：拿「一句话问答」的评测方法，去评一个会调七八个工具、跑十几轮的 Agent，然后得出一个漂亮但毫无意义的分数。

这一章把评测的底层框架拆成五块：对象、评测器、数据集、标尺、节奏。

## 01 三层评测对象：Run / Trace / Thread {#objects}

先讲类比。你去医院体检，报告上有三类数据：

- **单项指标**：血压 128/82，一项检查的结果；
- **一次体检**：抽血、B 超、心电图，一次完整流程；
- **连续档案**：过去三年每年一次，能看出趋势。

Agent 评测也是这样三层：

<Diagram id="eval-objects" />

| 层级 | 是什么 | 对应医院 | 典型用途 | 粒度 |
| --- | --- | --- | --- | --- |
| **Run** | 一次模型调用 / 一次工具调用 | 单项检查 | 单步质量：这一步想对了吗、参数填对了吗 | 毫秒级 |
| **Trace** | 一次完整任务的全部步骤 | 一次体检 | Agent 评测的主战场：结果 + 路径 + 副作用 | 秒到分钟级 |
| **Thread** | 同一用户的多轮会话 | 连续档案 | 记忆、上下文延续、多轮目标漂移 | 天到周级 |

### 为什么必须区分三层

因为**不同的坏，坏在不同层**。

```text
单步 Run 都对，但 Trace 整体错  →  规划问题：方向选错了，每一步都走得很好
Trace 都对，但 Thread 出问题    →  记忆问题：第二三轮把上一轮的前提忘了
Trace 结果对，但某个 Run 很糟  →  运气问题：这一步瞎蒙对了，下次就错
```

如果你只建一个「Trace 总分」，这三种情况会混在一起，你永远不知道该去改提示词、改工具，还是改记忆。

### 工程上的落地方式

一条推荐的数据结构（简化版）：

```python
from dataclasses import dataclass, field

@dataclass
class Run:
    step: int
    kind: str                 # "llm" | "tool" | "human"
    input: dict
    output: dict
    latency_ms: int
    tokens: dict = field(default_factory=dict)

@dataclass
class Trace:
    trace_id: str
    thread_id: str
    goal: str                 # 用户原始意图
    runs: list[Run]
    final_answer: str
    status: str               # "success" | "failed" | "aborted"

@dataclass
class Thread:
    thread_id: str
    user_id: str
    traces: list[Trace]
```

::: tip 人话翻译
Run 是**一步棋**，Trace 是**一整盘棋**，Thread 是**一个赛季**。你要评价棋手，只盯着某一步说「这步下得好」是没有意义的——得看这盘棋赢没赢、有没有犯规、有没有把棋盘掀了。
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://docs.langchain.com/langsmith/evaluation-approaches" target="_blank" rel="noreferrer">LangSmith · Evaluation approaches</a>
  <a href="https://developers.openai.com/api/docs/guides/agent-evals" target="_blank" rel="noreferrer">OpenAI · Agent evals</a>
</div>

## 02 四类评测器 {#graders}

有了对象，接下来要选「谁来判」。这里有一个反直觉的结论：**能用代码判的，绝不要用 LLM 判。**

<Diagram id="grader-kinds" />

| 类型 | 怎么判 | 成本 | 稳定性 | 适合判什么 |
| --- | --- | --- | --- | --- |
| **代码确定性校验** | JSON Schema、正则、数值断言、工具入参比对 | ≈ 0 | 100% 可复现 | 格式、字段、数值、工具名、调用次数 |
| **LLM-as-judge** | 让模型按 Rubric 打分 | 中 | 有波动，需校准 | 语气、忠实度、是否有帮助、是否答非所问 |
| **两两对比 Pairwise** | 两个答案摆一起，裁判选更好的 | 中 | 比绝对打分稳 | 版本对比、方案对比 |
| **人工评审** | 人看、人打分 | 高 | 高（但有个体差异） | 校准裁判、上线前抽检、主观质量 |

### 四类的正确用法不是「选一个」，而是「排优先级」

推荐的默认配比：

```text
1. 代码校验   →  先跑，能定死的都在这一层定死（应覆盖 60% 以上的断言）
2. LLM 裁判   →  只判代码判不了的语义问题
3. Pairwise   →  当你要回答「哪个版本更好」时用
4. 人工       →  当你要回答「裁判准不准」时用
```

### 一个具体的对照

同样是「Agent 是否用了正确的工具」：

- ❌ 让 LLM 裁判读一遍轨迹，回答「它用的工具对吗」——贵、慢、偶尔看错；
- ✅ 直接断言 `trace.runs` 里存在 `tool=="get_order"` 且 `args.order_id != null`——免费、瞬时、不会看错。

同样是「回答是否礼貌」：

- ❌ 写正则匹配「请」「谢谢」——会被绕过，也很蠢；
- ✅ 用 LLM 裁判按 Rubric 判——这才是它擅长的。

::: warning 最贵的错误
把「能不能用代码判」的问题交给 LLM 判。这不只是贵，更糟的是**不稳定**：同一个输入跑两次，结论可能不同，于是你的 CI 门禁开始随机失败，团队很快就学会「重跑一次就好」——门禁就此失效。
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://promptfoo.dev/docs/guides/llm-as-a-judge/" target="_blank" rel="noreferrer">Promptfoo · LLM-as-a-judge</a>
  <a href="https://deepeval.com/docs/metrics-introduction" target="_blank" rel="noreferrer">DeepEval · Metrics introduction</a>
</div>

## 03 黄金数据集：评测的地基 {#golden}

评测跑分再漂亮，如果数据集是假的，一切归零。

「黄金数据集」= 一批**经过人工确认、有明确期望结果、覆盖真实场景**的测试用例。它是你所有评测工作的地基，也是团队里最值钱的一份资产。

<Diagram id="golden-dataset" />

### 一条黄金用例长什么样

最小可用字段（别再加了，先跑起来）：

```json
{
  "id": "refund-policy-014",
  "input": "我上周买的耳机，拆封了还能退吗？",
  "context": { "user_tier": "gold", "order_id": "A1024", "channel": "app" },
  "expected": {
    "must_call_tools": ["get_order", "get_refund_policy"],
    "must_contain": ["7 天", "拆封"],
    "must_not_contain": ["30 天", "90 天"],
    "final_state": { "refund_status": "eligible" }
  },
  "tags": ["policy", "edge:opened", "channel:app"],
  "source": "prod-trace:tr_7c1d9a",
  "created_at": "2026-10-12"
}
```

四个关键字段值得单独说：

| 字段 | 为什么必须有 | 没有会怎样 |
| --- | --- | --- |
| `expected.must_call_tools` | 让「过程」可判 | 只能看答案，乱调工具也过关 |
| `expected.must_not_contain` | 反向断言，抓幻觉 | 只能证明「说对了」，不能证明「没说错」 |
| `expected.final_state` | 抓副作用 | 答案对了但数据被改坏，发现不了 |
| `source` | 可追溯、可审计 | 半年后没人知道这条用例为什么存在，也不敢删 |

### 数据集不是「写完就完」

健康的数据集是**活的**：每次线上事故往里加一条，每次产品改规则就更新一批，每个季度清一次过期用例。

一个真实的比例参考（中型团队）：

```text
手工编写       30%   ——  覆盖核心业务规则
线上 Trace 挖掘 45%   ——  覆盖真实分布与长尾
历史故障沉淀    20%   ——  每条事故至少一条用例
用户投诉转化     5%   ——  最贵但最值得
```

::: tip 人话翻译
数据集就是**考卷**。你用「1+1=2」当考卷，学生当然都考 100 分。问题不在于学生，而在于考卷。
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents" target="_blank" rel="noreferrer">Anthropic · Demystifying evals for AI agents</a>
  <a href="https://docs.langchain.com/langsmith/home" target="_blank" rel="noreferrer">LangSmith · Datasets</a>
</div>

## 04 评分标尺 Rubric 怎么写 {#rubric}

有了数据集，还得有「打分标准」。Rubric 写不好，裁判再强也白搭。

<Diagram id="rubric-shape" />

### 三条硬规则

**规则一：能用二元就别用 0-10。**

```text
❌ 请给这个回答打 0-10 分。
✅ 这个回答是否包含至少一个未经检索证实的数字？
   - PASS：所有数字都能在检索结果中找到出处
   - FAIL：出现了检索结果中不存在的数字
```

原因：0-10 分里，「7 分」和「8 分」的差别在人类标注者之间都说不清，模型更说不清。而 PASS/FAIL 是可复现的。

**规则二：一个维度只问一件事。**

```text
❌ 请评价回答的质量（是否准确、有帮助、语气好）
✅ 维度 A：事实准确性 —— 是否与检索内容一致
✅ 维度 B：任务完成度 —— 是否回答了用户的实际问题
✅ 维度 C：安全性 —— 是否泄露了不该说的信息
```

**规则三：给出「不合格」的具体样子。**

Rubric 里最有用的往往不是「什么算好」，而是「什么算坏」。因为裁判倾向于宽容，给它一个明确的坏例子，它才敢判 FAIL。

### 一个可复制的 Rubric 模板

```text
你是客服回复质量评审员。你只判一件事：回答是否忠实于给定的政策条款。

【输入】
用户问题：{{question}}
检索到的政策条款：{{context}}
Agent 回答：{{answer}}

【判定】
PASS —— 满足全部条件：
  1) 回答中所有关于时效、金额、条件的陈述，都能在政策条款中找到原文依据；
  2) 没有引入条款之外的政策细节；
  3) 若条款未覆盖该问题，回答明确表示「需要人工确认」。

FAIL —— 出现任意一条：
  1) 出现条款中没有的数字（天数、金额、比例）；
  2) 把「部分情况适用」说成「一律适用」；
  3) 在条款缺失时编造一个答案。

【输出】
只输出 JSON：{"verdict": "PASS" | "FAIL", "evidence": "引用条款中的原文或指出编造处"}
```

注意最后一句：**强制输出结构化 JSON + evidence**。这是让裁判「可审计」的关键——没有 evidence 的 FAIL，你没法判断是模型错了还是裁判错了。

::: warning 常见的 Rubric 事故
写了 800 字的 Rubric，包含 12 条判定标准，裁判每次只遵守前 3 条。**Rubric 越长，遵守率越低。** 一个评测器一件事，宁可拆成三个评测器。
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://mlflow.org/docs/latest/genai/eval-monitor/scorers/" target="_blank" rel="noreferrer">MLflow · Scorers and judge calibration</a>
  <a href="https://promptfoo.dev/docs/configuration/expected-outputs/model-graded/llm-rubric/" target="_blank" rel="noreferrer">Promptfoo · llm-rubric</a>
</div>

## 05 评测周期：开发到线上 {#cadence}

最后一个概念：**评测不是一次性动作，而是一个有节奏的循环。** 不同阶段跑不同的集、看不同的指标。

| 阶段 | 跑什么 | 什么时候 | 阻断条件 | 时长预算 |
| --- | --- | --- | --- | --- |
| 开发自测 | 冒烟集（20-30 条） | 每次改代码 | 不阻断，但本地报红 | < 1 分钟 |
| 提交门禁 | 冒烟集 + 关键断言 | 每次 PR / commit | 核心用例失败即阻断 | 3-5 分钟 |
| 合并前 | 回归集（200-500 条） | 合并到主干前 | 任一指标劣化超阈值即阻断 | 15-30 分钟 |
| 发版前 | 全量集 + 人工抽检 | 每周 / 每版本 | 红线指标不达标禁止发布 | 1-2 小时 |
| 线上 | 抽样（1%-5% 流量） | 持续 | 指标异常触发告警 | 常驻 |
| 定期复盘 | 全量 + 新采样本 | 每月 | 更新基线、清理过期用例 | 半天 |

### 节奏比规模重要

很多团队一上来就想建 5000 条数据集，结果三个月没跑完一次全量，最后没人看。

正确顺序是：

```text
第 1 周：30 条冒烟集 + 代码校验器 → 接进 CI（哪怕只警告不阻断）
第 2-4 周：扩到 150 条回归集 → 加基线对比 → 开始阻断
第 2 个月：接 LLM 裁判 + 人工抽检校准 → 覆盖主观质量
第 3 个月：接线上抽样 → 数据集开始自增长
```

::: tip 人话翻译
评测体系像健身：**先能每天做 10 个俯卧撑，再谈每天 100 个**。一上来就办年卡买装备的，通常第三周就不去了。
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://docs.langchain.com/langsmith/evaluation-approaches" target="_blank" rel="noreferrer">LangSmith · Evaluation approaches</a>
  <a href="https://langfuse.com/docs/evaluation/overview" target="_blank" rel="noreferrer">Langfuse · Evaluation overview</a>
</div>

### 本章避坑清单

- [ ] 三层对象混着评：把单步 Run 的失败算成整条 Trace 失败，或反过来。
- [ ] 用 LLM 裁判判本可以用代码判的东西（工具名、字段、数值）。
- [ ] 黄金数据集只有「完美输入」，没有错别字、没有歧义、没有超长上下文。
- [ ] Rubric 写太长，一次判十几件事，裁判只顾前几条。
- [ ] 用 0-10 分做门禁，导致阈值天天调、CI 天天红。
- [ ] 只在发版前跑一次，中间所有改动都没有基线。

### 实测骨架：把这一章落成代码

```python
# framework.py — 三层对象 + 四类评测器的最小骨架
from dataclasses import dataclass
from typing import Callable

@dataclass
class Trace:
    trace_id: str
    goal: str
    runs: list[dict]
    final_answer: str

Grader = Callable[[dict, Trace], dict]   # (case, trace) -> {"name": ..., "pass": bool, "note": ...}

def code_tool_used(expected_tool: str) -> Grader:
    def _g(case, trace):
        called = [r["tool"] for r in trace.runs if r.get("kind") == "tool"]
        return {"name": f"tool:{expected_tool}", "pass": expected_tool in called,
                "note": f"called={called}"}
    return _g

def code_contains(needle: str) -> Grader:
    def _g(case, trace):
        return {"name": f"contains:{needle}", "pass": needle in trace.final_answer}
    return _g

def run_suite(cases: list[dict], agent, graders_for: Callable[[dict], list[Grader]]) -> dict:
    results = []
    for case in cases:
        trace = agent(case["input"])
        verdicts = [g(case, trace) for g in graders_for(case)]
        results.append({
            "id": case["id"],
            "pass": all(v["pass"] for v in verdicts),
            "failed": [v for v in verdicts if not v["pass"]],
        })
    passed = sum(r["pass"] for r in results)
    return {"total": len(results), "passed": passed,
            "success_rate": round(passed / max(len(results), 1), 3),
            "failures": [r for r in results if not r["pass"]]}
```

调用方式：

```python
cases = [
    {"id": "refund-01", "input": "耳机能退吗？"},
    {"id": "refund-02", "input": "拆封了还能退吗？"},
]

summary = run_suite(cases, agent=my_agent,
                    graders_for=lambda c: [code_tool_used("get_order"),
                                           code_contains("7 天")])
print(summary)
```

这个骨架的价值在于：**它把「对象」「评测器」「数据集」三件事物化成了代码结构**。后面章节往里加轨迹匹配、LLM 裁判、基线对比，都不用重构。

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents" target="_blank" rel="noreferrer">Anthropic · Demystifying evals for AI agents</a>
  <a href="https://github.com/langchain-ai/openevals" target="_blank" rel="noreferrer">OpenEvals · Grader interfaces</a>
  <a href="https://deepeval.com/docs/metrics-introduction" target="_blank" rel="noreferrer">DeepEval · Metrics</a>
</div>

---

下一章把「分数」变成「看得懂的报表」：指标怎么分层、看板怎么设计、红线怎么定。
