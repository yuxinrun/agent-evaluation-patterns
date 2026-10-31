---
title: 08 · 生态组件联动评测
description: 观测 Trace 驱动样本、跨 Agent 协作评测、MCP 工具评测、记忆模块评测、网关路由与降级评测，以及跨组件评测契约。
outline: [2, 3]
---

# 08 · 生态组件联动评测

一个真实的 Agent 系统不是「一个模型 + 一个循环」，而是七块拼图拧在一起：

网关管流量、调度管循环、观测管看清、记忆管记住、通信管协作、工具管执行、评测管判定。

这一章讲**每一块拼图各自要被怎么评**，以及它们之间的评测契约。

## 01 观测 Trace 驱动评测 {#observability}

这是整本书最重要的一条工程实践：**评测样本应该从观测系统里长出来。**

<Diagram id="obs-to-eval" />

### 从 Trace 到样本的完整管道

```text
Agent 运行时
  └─ OTel Span（模型调用、工具调用、检索、记忆读写）
       └─ Trace 聚合（同一 trace_id 的 Span 树）
            └─ 采样器（失败 / 否定 / 异常耗时 / 随机）
                 └─ 脱敏器（PII 清理，保结构）
                      └─ 样本生成器（补期望值，人审）
                           └─ 数据集（版本化，进回归集）
```

关键点在于**每一步都可追溯**：一条用例能反向定位到最初那条线上 Trace。

### 采样器怎么写

```python
def should_sample(trace: dict, rng) -> str | None:
    """返回采样原因，None 表示不采。"""
    if trace["status"] == "failed":
        return "failure"
    if trace.get("feedback") == "thumbs_down":
        return "negative_feedback"
    if trace["latency_ms"] > trace.get("p95_baseline", 10_000) * 2:
        return "latency_outlier"
    if trace.get("turns", 0) > trace.get("p90_turns", 6):
        return "too_many_turns"
    if rng.random() < 0.02:
        return "random_healthy"        # 也要采好的，用来防「只测坏 case」
    return None
```

注意最后那条 `random_healthy`：**只采失败样本会让数据集变得过于悲观**，Agent 真的变好了你也测不出来。健康样本要占一定比例。

### Span 上必须打哪些标签

| 标签 | 用途 |
| --- | --- |
| `trace_id` / `span_id` | 链路串联 |
| `gen_ai.request.model` | 模型版本（写死版本号） |
| `tool.name` / `tool.args_hash` | 工具选择与重复检测 |
| `retrieval.doc_ids` | 忠实效度判定的依据 |
| `memory.op` / `memory.key` | 记忆读写评测 |
| `eval.dataset_version` | 关联到具体评测版本 |

::: tip 人话翻译
观测系统是**行车记录仪**，评测是**事故档案库**。记录仪拍到了，但没人整理成档案，下次同样的事故还会再发生一遍。
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://arize.com/docs/phoenix" target="_blank" rel="noreferrer">Arize Phoenix · OTel-native traces</a>
  <a href="https://langfuse.com/docs/evaluation/overview" target="_blank" rel="noreferrer">Langfuse · Trace to dataset</a>
  <a href="https://yuxinrun.github.io/agent-observability-patterns/" target="_blank" rel="noreferrer">agent-observability-patterns</a>
</div>

## 02 跨 Agent 协作评测 {#a2a}

多 Agent 系统的评测难点在于：**你没法只评一个 Agent。**

<Diagram id="multi-agent-eval" />

### 三层评测点

| 层级 | 问题 | 判什么 |
| --- | --- | --- |
| 单个 Agent | 它自己的任务做对了吗 | 该 Agent 的 Trace 级评分 |
| 委派边界 | 任务拆得对吗、交接信息完整吗 | 交接消息的结构与内容 |
| 端到端 | 用户目标达成吗 | 最终结果 + 总耗时 + 总成本 |

### 委派质量怎么评

多 Agent 事故里，一大半不是「某个 Agent 笨」，而是**交接时信息丢了**。

```python
REQUIRED_HANDOFF = {"task_id", "goal", "constraints", "deadline", "return_format"}

def check_handoff(msg: dict) -> dict:
    missing = [k for k in REQUIRED_HANDOFF if not msg.get(k)]
    vague = [k for k in ("goal", "constraints")
             if msg.get(k) and len(str(msg[k])) < 10]
    return {
        "name": "handoff",
        "pass": not missing and not vague,
        "note": f"missing={missing} vague={vague}",
    }
```

这条校验抓的是最常见的失败：「用户想要退款，你转给退款 Agent 时只说了一个 order_id」。

### 端到端评分的权重

多 Agent 的端到端评分要比单 Agent 更强调「总成本」和「总时长」，因为委派链每多一跳，成本与延迟就乘一次。

```text
端到端得分 = 0.5 × 目标达成
           + 0.2 × 委派链合理性（有无多余跳转）
           + 0.2 × 成本效率（相对单 Agent 基线）
           + 0.1 × 时延
```

::: warning 多 Agent 评测的经典陷阱
每个 Agent 的单元测试都通过，端到端却失败。原因通常是：**接口契约没测**。A 说「已处理」，B 以为「已取消」，双方都算通过。
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://www.anthropic.com/engineering/building-effective-agents" target="_blank" rel="noreferrer">Anthropic · Building effective agents</a>
  <a href="https://yuxinrun.github.io/a2a-patterns/" target="_blank" rel="noreferrer">a2a-patterns · 跨 Agent 协作</a>
</div>

## 03 MCP 工具评测 {#mcp}

工具是 Agent 的手。手不听话，脑子再聪明也没用。

<Diagram id="mcp-eval" />

### 四个评测维度

| 维度 | 问题 | 判定方式 |
| --- | --- | --- |
| **可发现性** | 模型能不能看懂该用哪个工具 | 任务 → 首选工具命中率 |
| **参数正确性** | 入参是否合法、是否缺必填 | Schema 校验 + 语义校验 |
| **输出稳定性** | 同样入参是否稳定返回同结构 | 多次调用比对结构 |
| **权限边界** | 有没有越权调用 | 允许清单校验 |

### 工具描述也要被评测

很多人不知道「工具描述」是可以量化评测的。方法很简单：

```python
def tool_selection_accuracy(cases: list[dict], agent) -> float:
    """给一批「该用哪个工具」的用例，看模型首选是否命中。"""
    hits = 0
    for case in cases:
        chosen = agent.first_tool_choice(case["input"], case["available_tools"])
        hits += chosen == case["expected_tool"]
    return hits / len(cases)
```

如果你的工具首选命中率只有 62%，那大概率不是模型的问题，而是**工具名和描述写得含糊**（比如同时存在 `search` 和 `query`）。

### 输出稳定性的量化

```python
def output_stability(tool, args: dict, n: int = 5) -> dict:
    """同一入参调用 n 次，看返回结构的 Jaccard 相似度。"""
    shapes = [set(flatten_keys(tool.call(args))) for _ in range(n)]
    base = shapes[0]
    sims = [len(base & s) / len(base | s) for s in shapes[1:]]
    return {"stable": min(sims) > 0.95, "min_similarity": round(min(sims), 3)}
```

::: warning MCP 工具评测的三条红线
1. **返回结构不稳定**：今天返回 `{"data": [...]}`，明天返回 `[...]`，Agent 立刻崩。
2. **错误不显式**：没有返回错误码而是返回空数组，Agent 会当成「没有数据」继续编。
3. **权限越界**：工具本身允许读取全部订单，Agent 只是「碰巧」没越权，这不是安全。
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://www.anthropic.com/engineering/writing-tools-for-agents" target="_blank" rel="noreferrer">Anthropic · Writing effective tools for agents</a>
  <a href="https://yuxinrun.github.io/mcp-patterns/" target="_blank" rel="noreferrer">mcp-patterns · 工具与权限</a>
</div>

## 04 记忆模块评测 {#memory}

记忆最容易「看起来对了」：用户问一句「我喜欢什么」，Agent 答「您喜欢简洁的回答」，听起来很棒——但如果这个偏好是三年前的一次性偏好，那就是错的。

<Diagram id="memory-eval" />

### 四个可测维度

| 维度 | 问题 | 用例设计 |
| --- | --- | --- |
| **写入正确** | 该记的记住了吗 | 会话里说一句偏好，下一轮问 |
| **召回准确** | 需要的能想起来吗 | 跨会话复合问题（需要 2-3 条记忆） |
| **遗忘正确** | 该忘的忘了吗 | 用户说「以后别用敬语」，看是否失效 |
| **不串话** | 别人的记忆串进来了吗 | 多租户/多用户交叉用例 |

### 串话检测最重要

因为它是**安全事故级**的问题。

```python
def check_no_crosstalk(answer: str, other_users_facts: list[str]) -> dict:
    leaks = [f for f in other_users_facts if f in answer]
    return {"name": "no_crosstalk", "pass": not leaks, "note": f"leaked={leaks}"}
```

### 记忆评测的时间维度

记忆天然带时间属性，所以用例必须包含：

```text
1. 即时召回    同会话内，刚说的能不能用上
2. 短期跨越    隔 1-3 轮后还能用上
3. 长期召回    隔数天（模拟：换 session_id，同一 user_id）
4. 冲突更新    用户改主意了，旧记忆要失效
5. 过期清理    带 TTL 的记忆到期后不得再出现
```

::: tip 人话翻译
评记忆像**检查一个助理的记事本**。不只是「记了没有」，还要看：记错人没有、过期的划掉了没有、老板改主意后有没有更新。
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://yuxinrun.github.io/agent-memory-patterns/" target="_blank" rel="noreferrer">agent-memory-patterns · 记忆分层与检索</a>
  <a href="https://arxiv.org/abs/2410.10813" target="_blank" rel="noreferrer">LongMemEval · long-term memory benchmark</a>
</div>

## 05 网关路由与降级评测 {#gateway}

网关决定「这句话送到哪个模型」。这件事以前是运维细节，现在是**质量变量**。

<Diagram id="gateway-eval" />

### 三类评测

| 类型 | 问题 | 判定 |
| --- | --- | --- |
| **路由正确性** | 简单问题有没有走便宜模型 | 按难度分层的命中率 |
| **降级质量** | 主模型挂了，降级模型能不能兜住 | 同一数据集两模型对比 |
| **一致性** | 同一问题在两个模型上答案差异多大 | 语义相似度 + 关键事实比对 |

### 路由评测的样本设计

```python
ROUTING_CASES = [
    {"input": "现在几点", "expect_tier": "cheap"},
    {"input": "帮我把这段话改写得正式些", "expect_tier": "cheap"},
    {"input": "分析这份财报的风险点", "expect_tier": "strong"},
    {"input": "这段代码为什么死锁", "expect_tier": "strong"},
]

def routing_accuracy(cases, router) -> dict:
    hits = sum(router.tier(c["input"]) == c["expect_tier"] for c in cases)
    return {"accuracy": round(hits / len(cases), 3), "n": len(cases)}
```

### 降级评测：必须有基线

降级最危险的不是「变慢」，而是**悄悄变差**。所以降级路径必须有一套自己的评测集：

```text
正常路径基线：gpt-5       任务完成率 92.1%
降级路径验证：gpt-5-mini  任务完成率 84.3%   ← 可接受，但必须知道
            并明确「哪些功能在降级时应该关闭」
```

::: danger 降级评测最容易被忽略的一点
降级往往同时改变了**行为风格**（更简短、更容易拒答）。如果你的产品依赖某种固定话术，降级会静默破坏它。**把「话术一致性」也加进降级评测集。**
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://yuxinrun.github.io/llm-gateway-patterns/" target="_blank" rel="noreferrer">llm-gateway-patterns · 路由与降级</a>
  <a href="https://docs.langchain.com/langsmith/evaluation-approaches" target="_blank" rel="noreferrer">LangSmith · Evaluation approaches</a>
</div>

## 06 跨组件评测契约 {#contract}

最后讲一件很少被写下来、但决定多组件系统能否整体可信的事：**评测契约**。

<Diagram id="contract" />

### 契约是什么

每个组件对外承诺三件事：

```text
1. 我提供什么（能力与接口）
2. 我保证什么（质量下限与稳定性）
3. 我提供什么评测数据（供上层评测消费）
```

举个例子：

| 组件 | 承诺 | 提供的评测数据 |
| --- | --- | --- |
| llm-gateway | 同一请求在两个模型上返回结构一致 | 每次调用的模型、耗时、成本 |
| mcp 工具 | 错误必须显式返回错误码 | 工具调用入参与返回 |
| memory | 跨租户不得串话（红线） | 记忆读写 span |
| 观测 | 提供完整 trace 树 | trace_id 关联的全部 span |
| 评测 | 提供判定结果与证据 | 判定 + 原因 + 证据链接 |

### 契约校验脚本

```python
CONTRACTS = {
    "gateway": ["model", "latency_ms", "cost_usd", "status"],
    "tool": ["name", "args", "ok", "error_code"],
    "memory": ["op", "key", "tenant_id", "hit"],
}

def check_span_contract(span: dict) -> dict:
    kind = span.get("component")
    required = CONTRACTS.get(kind)
    if not required:
        return {"pass": True, "note": "unknown component, skipped"}
    missing = [k for k in required if span.get(k) in (None, "")]
    return {"name": f"contract:{kind}", "pass": not missing, "note": f"missing={missing}"}
```

这个脚本的价值在于：**它把「组件之间约定」变成了可自动检查的断言**。任何一方改了字段名，评测流水线会立刻红，而不是等到线上出事故。

::: warning 契约最容易被破坏的方式
「顺手给返回加个字段」「顺手把 `error_code` 改成 `code`」。这种改动在组件自己的测试里全绿，在集成评测里全红。
**契约变更是破坏性变更，必须走评测流水线。**
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://arize.com/docs/phoenix" target="_blank" rel="noreferrer">Arize Phoenix · Span contracts</a>
  <a href="https://www.anthropic.com/engineering/writing-tools-for-agents" target="_blank" rel="noreferrer">Anthropic · Writing effective tools for agents</a>
</div>

---

下一章做一件很实际的事：把市面上七个主流评测平台摆在一起，告诉你什么时候选哪个。
