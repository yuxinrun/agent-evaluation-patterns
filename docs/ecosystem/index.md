---
title: 16 · 完整生态联动与下一步
description: 评测如何接入调度、观测、通信、工具、记忆与网关，六个兄弟项目的接入方式、跨组件评测契约，以及 90 天落地路线图。
outline: [2, 3]
---

# 16 · 完整生态联动与下一步

读到这里，你已经知道怎么建数据集、写评测器、跑回归、接 CI、做线上评测。

但真实系统里，评测不是一个孤立的项目。它是**整个 Agent 生态的质量总线**：每条链路都往里送信号，每个改动都要从它这里取放行条。

<Diagram id="eco-stack" />

### 一句话说清评测在生态里的位置

```text
llm-gateway-patterns        决定「用哪个模型」   → 评测告诉它哪个模型真的更好
better-agent（调度框架）     决定「怎么跑循环」   → 评测告诉它这个循环值不值
mcp-patterns                决定「能做什么」     → 评测告诉它工具描述写得清不清楚
agent-memory-patterns       决定「记得什么」     → 评测告诉它有没有记错、串话
a2a-patterns                决定「谁来协作」     → 评测告诉它交接信息丢没丢
agent-observability-patterns 决定「看得见什么」   → 评测用它产的 Trace 当原料
```

**评测是唯一横向贯穿所有的组件**，这也解释了为什么它值得单独成册。

## 01 better-agent：调度框架如何接入评测 {#better-agent}

调度框架管的是「循环怎么跑」。评测要在这里埋两个点：**入口的样本标注，出口的结果回传。**

### 接入点一：给每次运行打上「可评测」标记

```python
from contextlib import contextmanager

@contextmanager
def eval_scope(case_id: str | None = None, dataset_ver: str | None = None):
    """在 Agent 循环最外层开一个 scope，把评测上下文注入 trace。"""
    span = tracer.start_span("agent.run")
    span.set_attribute("eval.case_id", case_id or "")
    span.set_attribute("eval.dataset_version", dataset_ver or "")
    span.set_attribute("eval.mode", "eval" if case_id else "production")
    try:
        yield span
    finally:
        span.end()
```

有了 `eval.mode`，你就能一眼分辨「这条 Trace 是评测跑出来的还是真实用户」，避免污染线上指标。

### 接入点二：把循环的中间状态暴露出来

评测第 05 章讲轨迹，前提是**框架愿意把中间状态交出来**：

```python
@dataclass
class LoopStep:
    index: int
    thought: str | None
    tool: str | None
    args: dict | None
    observation: str | None
    tokens: int

def export_steps(steps: list[LoopStep]) -> dict:
    """给评测用的标准形态：一个可序列化、可 diff 的列表。"""
    return {
        "n_steps": len(steps),
        "tools": [s.tool for s in steps if s.tool],
        "redundant_calls": count_redundant(steps),
        "tokens": sum(s.tokens for s in steps),
        "steps": [asdict(s) for s in steps],
    }
```

::: tip 一个设计判断
如果你的调度框架**无法导出中间步骤**，那你的 Agent 在评测维度上是黑盒，只能评结果，不能评过程。
**这是框架选型时最该问的一个问题，比性能更重要。**
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://github.com/yuxinrun/better-agent" target="_blank" rel="noreferrer">better-agent · 调度框架</a>
  <a href="https://www.anthropic.com/engineering/building-effective-agents" target="_blank" rel="noreferrer">Anthropic · Building effective agents</a>
</div>

## 02 a2a-patterns：跨智能体协作评测 {#a2a}

多 Agent 系统的评测，难在「**没有单一负责人**」。每个 Agent 都说自己没错。

### 三层验收模型

| 层 | 评什么 | 判定方 |
| --- | --- | --- |
| 单元层 | 单个 Agent 的任务完成度 | 该 Agent 的 Trace 评分 |
| 交接层 | 委派消息的完整性、语义一致性 | 结构校验 + 语义校验 |
| 端到端 | 用户目标是否达成 | 最终结果 + 总成本 + 总时延 |

### 交接契约的校验

```python
CONTRACT = {
    "task_id": str, "goal": str, "constraints": list,
    "deadline": str | None, "return_format": str,
}

def validate_handoff(msg: dict) -> dict:
    missing = [k for k in CONTRACT if k not in msg]
    wrong_type = [k for k, t in CONTRACT.items()
                  if k in msg and not isinstance(msg[k], t)]
    return {
        "name": "handoff_contract",
        "pass": not missing and not wrong_type,
        "note": f"missing={missing} wrong_type={wrong_type}",
    }
```

### 一条经验规则

```text
端到端失败时，先看交接层，再看单元层。
统计上，多 Agent 事故里 60% 以上源于交接信息丢失，而不是单个 Agent 能力不足。
```

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://yuxinrun.github.io/a2a-patterns/" target="_blank" rel="noreferrer">a2a-patterns · 跨 Agent 协作</a>
  <a href="https://www.anthropic.com/engineering/building-effective-agents" target="_blank" rel="noreferrer">Anthropic · Effective agents</a>
</div>

## 03 mcp-patterns：MCP 技能与工具评测 {#mcp}

工具评测有四个维度，每个维度都能做成流水线的一部分（第 08 章展开过）：

| 维度 | 测法 | 通过线（经验值） |
| --- | --- | --- |
| 可发现性 | 任务 → 首选工具命中率 | > 90% |
| 参数正确性 | Schema + 语义校验 | > 98% |
| 输出稳定性 | 多次调用结构一致性 | > 95% |
| 权限边界 | 允许清单校验 | 100% |

### 工具描述的 A/B 测试

工具描述改动是最容易被忽略的「prompt 改动」，但它直接影响工具选择：

```python
def ab_tool_description(cases, tools_v1, tools_v2, agent) -> dict:
    """同一批任务，两版工具描述，比首选命中率。"""
    def hit_rate(tools):
        hits = sum(agent.first_choice(c["input"], tools) == c["expect_tool"]
                   for c in cases)
        return hits / len(cases)

    r1, r2 = hit_rate(tools_v1), hit_rate(tools_v2)
    return {"v1": round(r1, 3), "v2": round(r2, 3), "delta": round(r2 - r1, 3),
            "ship": r2 > r1 + 0.03}
```

**把工具描述当代码管理，改动必须过评测门禁。** 这是 MCP 时代最容易被跳过的一步。

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://yuxinrun.github.io/mcp-patterns/" target="_blank" rel="noreferrer">mcp-patterns · 工具与权限</a>
  <a href="https://www.anthropic.com/engineering/writing-tools-for-agents" target="_blank" rel="noreferrer">Anthropic · Writing effective tools for agents</a>
</div>

## 04 agent-memory-patterns：记忆模块评测 {#memory}

记忆的评测有一个别人没有的难点：**它天然带时间维度。**

### 五类用例，全部围绕时间

```text
即时召回    同一会话内说一句偏好 → 下一轮用到
短期跨越    隔 1-3 轮仍能用到
长期召回    换 session、同 user，隔数天仍能用到
冲突更新    用户改主意 → 旧记忆必须失效
过期清理    TTL 到期 → 不得再出现
```

### 串话检测：安全级红线

```python
def crosstalk_check(answer: str, foreign_facts: list[str]) -> dict:
    """别的用户的记忆绝不能出现在这个用户的回答里。"""
    leaked = [f for f in foreign_facts if f in answer]
    return {"name": "no_crosstalk", "pass": not leaked, "note": f"leaked={leaked}"}
```

这条必须是 **100% 通过**，和其他指标不同，它没有「可接受失败率」。

### 记忆评测的样本构造技巧

```text
1. 用「假用户」造多租户场景，每个假用户有 3-5 条独特偏好
2. 交叉提问：A 用户的会话里问 B 用户的偏好
3. 冲突写入：先写「喜欢长回答」，再写「喜欢短回答」，看哪条生效
4. 时间跳跃：用可控时钟模拟「30 天后」
```

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://yuxinrun.github.io/agent-memory-patterns/" target="_blank" rel="noreferrer">agent-memory-patterns · 记忆分层与检索</a>
  <a href="https://arxiv.org/abs/2410.10813" target="_blank" rel="noreferrer">LongMemEval · 长期记忆基准</a>
</div>

## 05 agent-observability-patterns：观测驱动评测 {#observability}

这是全书最重要的一条工程原则，也是唯一一条**没有替代方案**的原则：

> **评测样本必须从观测系统里长出来，而不是从工程师的脑子里想出来。**

### 完整链路的六个环节

```text
1. 采集   OTel span 覆盖模型、工具、检索、记忆、网关
2. 汇聚   同一 trace_id 的 span 组装成完整轨迹
3. 筛选   失败 / 点踩 / 超时 / 随机健康样本
4. 脱敏   PII 替换，保留结构与实体一致性
5. 定标   人工补期望值（这一步不能省）
6. 回流   进数据集，参与回归与门禁
```

### 必须打上的 span 属性

| 属性 | 用途 |
| --- | --- |
| `gen_ai.request.model` | 模型版本（写死，不要写别名） |
| `tool.name` / `tool.args_hash` | 工具选择与重复检测 |
| `retrieval.doc_ids` | 忠实效度判定 |
| `memory.op` / `memory.key` | 记忆读写评测 |
| `eval.mode` | 区分评测流量与真实流量 |

::: warning 一个最常见的集成失败
观测系统上了，评测也上了，但两边**没有共享 trace_id**。
结果：评测报告里点不进现场，观测面板里看不到判定。两套系统各说各话。
**集成第一天就要确定：trace_id 是连接两边的唯一主键。**
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://yuxinrun.github.io/agent-observability-patterns/" target="_blank" rel="noreferrer">agent-observability-patterns · 观测与追溯</a>
  <a href="https://opentelemetry.io/docs/concepts/signals/traces/" target="_blank" rel="noreferrer">OpenTelemetry · Traces</a>
</div>

## 06 llm-gateway-patterns：网关多模型评测 {#gateway}

网关决定「这句话送到哪个模型」。这个决定的质量，只能靠评测回答。

### 三类评测，对应三类决策

| 评测 | 支撑的决策 |
| --- | --- |
| 路由正确性 | 廉价模型能不能接住这类请求 |
| 降级质量 | 主模型挂了，用户体验掉多少 |
| 一致性 | 同一问题两个模型答案差异多大，能否混用 |

### 路由策略的离线验证

```python
def validate_routing(cases: list[dict], router, judge) -> dict:
    """不只看路由命中，还要看「路由到廉价模型后质量是否够」。"""
    rows = []
    for c in cases:
        tier = router.tier(c["input"])
        answer = router.call(tier, c["input"])
        quality = judge(c["input"], answer)           # 二元 PASS/FAIL
        rows.append({"id": c["id"], "tier": tier, "pass": quality["pass"],
                     "cost": router.cost(tier, c["input"])})

    cheap = [r for r in rows if r["tier"] == "cheap"]
    return {
        "routing_hit": round(sum(r["tier"] == c["expect_tier"]
                                 for r, c in zip(rows, cases)) / len(cases), 3),
        "cheap_quality": round(sum(r["pass"] for r in cheap) / max(len(cheap), 1), 3),
        "avg_cost": round(sum(r["cost"] for r in rows) / len(rows), 5),
    }
```

**关键指标是 `cheap_quality`。** 如果廉价模型的质量只有 72%，那你的路由阈值定得太松了，省下的钱会用投诉还回去。

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://yuxinrun.github.io/llm-gateway-patterns/" target="_blank" rel="noreferrer">llm-gateway-patterns · 路由与降级</a>
  <a href="https://docs.langchain.com/langsmith/evaluation-approaches" target="_blank" rel="noreferrer">LangSmith · Evaluation approaches</a>
</div>

## 07 落地路线图与检查清单 {#roadmap}

<Diagram id="roadmap" />

### 90 天路线图

| 阶段 | 时间 | 目标 | 交付物 |
| --- | --- | --- | --- |
| **第 1 阶段** | 第 1-2 周 | 有一个能跑的评测脚本 | 30 条冒烟集 + 代码校验 + 一个裁判 |
| **第 2 阶段** | 第 3-4 周 | 接入 CI，能挡退化 | GitHub Action + 基线文件 + 门禁脚本 |
| **第 3 阶段** | 第 5-6 周 | 轨迹评测上线 | 工具序列校验 + 循环检测 + 副作用沙箱 |
| **第 4 阶段** | 第 7-8 周 | 样本从线上来 | Trace 采样器 + 脱敏 + 人工定标流程 |
| **第 5 阶段** | 第 9-10 周 | 裁判可信 | 人工标注 200 条 + 校准 + 锚点集 |
| **第 6 阶段** | 第 11-12 周 | 线上评测 | 旁路抽样 + 告警 + 闭环追踪表 |

### 每阶段的自检门槛

```text
第 1 阶段：新同学能在 30 分钟内跑通「改 prompt → 看结果」
第 2 阶段：任何 PR 都能看到「本次回归了哪几条用例」
第 3 阶段：能回答「这次改动多花了多少次工具调用」
第 4 阶段：数据集里 50% 以上来自真实 Trace
第 5 阶段：裁判与人工的 kappa > 0.6
第 6 阶段：线上劣化能在 1 小时内被自动发现
```

### 一张 12 项终检清单

| # | 检查项 |
| --- | --- |
| 1 | 有冒烟集 / 回归集 / 全量三级执行策略 |
| 2 | 每条用例至少有 1 条代码硬校验 |
| 3 | 记录并评测工具调用序列 |
| 4 | 有可 diff 的基线文件，保留两个历史版本 |
| 5 | CI 门禁有红线阈值，且考虑显著性 |
| 6 | 裁判做过人工校准，有 kappa 记录 |
| 7 | 有锚点集，每天跑漂移检测 |
| 8 | 写操作在评测环境被 mock 或可回滚 |
| 9 | 线上 Trace 能自动转成样本 |
| 10 | 失败捕获有 SLA，队列不堆积 |
| 11 | 告警自带失败 Trace 链接 |
| 12 | 评测成本有预算熔断 |

**12 项全过，你的评测体系已经可以支撑「日均百万请求」的 Agent 产品。**
过 8-11 项，属于「能上线但还会掉坑」。低于 8 项，建议先别急着扩规模。

### 三个不要做的事

::: warning 落地期最容易走偏的三件事
1. **一开始就追求 1000 条数据集**：30 条好用例比 1000 条凑数的用例有用得多。
2. **一开始就自建评测平台**：先用 Promptfoo 或 Langfuse 跑通流程，确定痛点再自建。
3. **一开始就评 20 个指标**：先盯 3 个（完成率、工具正确率、P95），跑稳了再加。
:::

## 收尾：这本书的一句话总结

如果只能记一句话，请记这句：

> **没有评测的 Agent，不是「效果不确定」，而是「你根本不知道它是什么」。**

评测的全部意义，是把「我觉得」换成「数据说」，把「上次好像还行」换成「这次比基线退了 1.2pt，卡在边界用例上」，把「线上出事了」换成「3 天前锚点集就报警了」。

### 整套生态，从这里继续

<Eco />

六个兄弟项目各管一件事，合起来才是一个能上生产的 Agent 系统。评测是那张**贯穿所有环节的验收网**，也是你判断「这套系统到底行不行」的唯一依据。

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents" target="_blank" rel="noreferrer">Anthropic · Demystifying evals for AI agents</a>
  <a href="https://docs.langchain.com/langsmith/evaluation-approaches" target="_blank" rel="noreferrer">LangSmith · Evaluation approaches</a>
  <a href="https://developers.openai.com/api/docs/guides/agent-evals" target="_blank" rel="noreferrer">OpenAI · Agent evals</a>
</div>

---

到这里，全书 17 章结束。

接下来是你的回合：**先做那 30 条冒烟集。** 它不需要预算、不需要审批、不需要平台选型，只需要一个下午。

而这 30 条，会让你之后每一次「我觉得变好了」，都变成一句能被验证的话。
