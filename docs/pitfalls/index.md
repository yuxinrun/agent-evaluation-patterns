---
title: 13 · 高频踩坑血泪清单
description: 评测集脱离真实分布、只信裁判、只看最终答案、没有基线、并发失真、成本爆炸、副作用未回滚——七个生产事故的成因与修法。
outline: [2, 3]
---

# 13 · 高频踩坑血泪清单

前面十二章讲「该怎么做」。这一章讲「**别人已经怎么翻过车**」。

这七个坑有个共同特点：**它们都不是技术难题，而是认知盲区。** 每一个都配了「症状 → 根因 → 修法」，你可以当体检表用。

<Diagram id="pitfall-map" />

## 01 评测集和真实用户分布脱节 {#distribution}

### 症状

```text
离线通过率 99.2%
上线两周，用户投诉 40+ 条
抽查 20 条投诉，19 条在你数据集里根本没有类似用例
```

### 根因

数据集是「工程师想象的用户问题」。真实用户的行为有三个工程师想不到的特点：

| 真实特点 | 数据集里的样子 |
| --- | --- |
| 输入极短、极乱、有错别字 | 一句工整完整的话 |
| 一次会话反复改需求 | 一问一答就结束 |
| 带着情绪、带着历史上的坏经验 | 中性客观的提问 |

### 修法

```text
1. 数据集里 50% 以上必须来自真实 Trace（第 08、12 章）
2. 每月对比「数据集输入长度分布」与「线上输入长度分布」
3. 建立「未覆盖率」指标：线上问题在数据集中找不到相似样本的比例
```

一个可以立刻跑的检查：

```python
def coverage_gap(prod_lengths: list[int], dataset_lengths: list[int]) -> dict:
    """线上输入长度的分位数 vs 数据集的分位数，差距大就是脱节信号。"""
    import statistics
    p = lambda xs, q: statistics.quantiles(xs, n=100)[q - 1]
    return {
        "prod_p10_p90": (p(prod_lengths, 10), p(prod_lengths, 90)),
        "data_p10_p90": (p(dataset_lengths, 10), p(dataset_lengths, 90)),
        "verdict": "gap" if p(prod_lengths, 10) * 3 < p(dataset_lengths, 10) else "ok",
    }
```

::: warning 最隐蔽的一种脱节
数据集里全是「**一次就能问清楚**」的问题。而真实用户经常分三轮才说清楚自己要什么。
**如果你的数据集没有多轮用例，你的 Agent 在多轮场景上等于没测。**
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents" target="_blank" rel="noreferrer">Anthropic · Demystifying evals for AI agents</a>
  <a href="https://langfuse.com/docs/evaluation/overview" target="_blank" rel="noreferrer">Langfuse · Production data to datasets</a>
</div>

## 02 只信裁判，没有代码硬校验 {#judge-only}

### 症状

```text
裁判说平均 8.7 分（满分 10）
抽查 30 条：5 条把订单号写错了，3 条调用了不存在的工具，2 条编了不存在的政策
给这些坏答案打的分：8.5、8.8、8.6
```

### 根因

裁判是「**语义相似度的高级版**」，不是「事实校验器」。它对「结构上像对的答案」几乎没有抵抗力。

<Diagram id="score-illusion" />

### 修法：硬规则永远先跑

```python
def hard_checks(trace: dict, case: dict) -> list[dict]:
    """这些检查零成本、零幻觉，没有任何理由不做。"""
    out = trace["output"]
    calls = [s["tool.name"] for s in trace["spans"] if s["kind"] == "tool"]
    return [
        {"name": "order_id_present",
         "pass": case.get("order_id", "") in out},
        {"name": "tools_subset",
         "pass": set(calls) <= set(case["allowed_tools"])},
        {"name": "no_unknown_policy",
         "pass": not any(k in out for k in case.get("forbidden_claims", []))},
        {"name": "json_schema",
         "pass": validate_schema(trace.get("structured_output"), case.get("schema"))},
    ]
```

### 一条硬规则顶一百条裁判

| 检查项 | 裁判能做 | 代码能做 |
| --- | --- | --- |
| 数字是否一致 | 常常看错 | 精确 |
| 订单号是否存在 | 无法验证 | 精确 |
| 工具是否越权 | 经常漏 | 精确 |
| 语气是否得体 | ✅ 强项 | 做不了 |
| 是否编造政策条款 | 一般 | 用白名单精确 |

**结论：能量化的都用代码，只剩「得体 / 合理 / 自然」才交给裁判。**

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://www.promptfoo.dev/docs/guides/llm-as-a-judge/" target="_blank" rel="noreferrer">Promptfoo · LLM-as-a-judge guide</a>
  <a href="https://mlflow.org/docs/latest/genai/eval-monitor/scorers/" target="_blank" rel="noreferrer">MLflow · Scorers</a>
</div>

## 03 只评估最终答案，忽略轨迹 {#output-only}

### 症状

```text
最终答案完全正确
但过程：调用了 11 次工具（应该 3 次），其中 4 次是同一个查询重复执行
成本涨了 3.2 倍，P95 从 6s 涨到 19s
```

### 根因

这是**普通 LLM 评测思维**的惯性：有 input 有 output，比对一下就好了。

但 Agent 的价值和风险都在过程里：工具选择、参数、顺序、是否绕路、是否重复。

### 修法：三层都要评

```text
第一层 结果  最终答案对不对（普通评测也能做）
第二层 轨迹  工具序列是否合理、有无冗余、有无绕路（Agent 独有）
第三层 状态  副作用是否正确、数据是否一致（写操作 Agent 必须）
```

第二章和第五章讲的具体指标在这里复用：

| 指标 | 抓什么样的坑 |
| --- | --- |
| 工具调用正确率 | 选错工具 |
| 冗余调用次数 | 重复查询、原地打转 |
| 规划合理性 | 走了不该走的弯路 |
| 副作用校验 | 改了不该改的数据 |

::: danger 一个真实事故
某退款 Agent 的最终回答 100% 正确：「已为您办理退款」。
但它**调用了两次退款接口**，第二次失败并触发了人工工单系统，一天生成 400 张无效工单。
只看最终答案，这个 Agent 完美无缺。
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://docs.langchain.com/langsmith/trajectory-evals" target="_blank" rel="noreferrer">LangSmith · Trajectory evals</a>
  <a href="https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents" target="_blank" rel="noreferrer">Anthropic · Demystifying evals</a>
</div>

## 04 没有基线，好坏全靠感觉 {#no-baseline}

### 症状

```text
「这次改完感觉好多了！」
「哪好了？」
「就是……回答更自然了。」
（两周后）「怎么感觉又变差了？」
```

### 根因

没有基线，你无法回答三个最基本的问题：

```text
1. 现在比上周好还是差？
2. 这个改动带来了多少变化？
3. 这次退化是从哪一版开始的？
```

<Diagram id="pitfall-map" />

### 修法：基线是一份文件，不是一段记忆

```json
// baselines/main@2026-10-30.json
{
  "commit": "a1b2c3d",
  "dataset": "regression@v14",
  "graders": "graders@v9",
  "metrics": {
    "task_success": 0.882,
    "hallucination_rate": 0.012,
    "tool_correctness": 0.901,
    "avg_turns": 4.4,
    "p95_latency_ms": 10200,
    "cost_per_task": 0.028
  },
  "cases": { "refund-001": "PASS", "refund-014": "FAIL" }
}
```

三条纪律：

```text
1. 基线必须存「每条用例的结果」，不只是汇总（才能做 diff）
2. 基线只在「全量回归通过」时更新
3. 保留最近两个基线版本（定位退化从哪开始）
```

### 一个立刻能用的 diff 命令

```python
def diff_against_baseline(run: dict, baseline: dict) -> dict:
    """列表级 diff：哪些用例从 PASS 变 FAIL，哪些相反。"""
    cur, base = run["cases"], baseline["cases"]
    newly_failing = [k for k, v in cur.items() if v == "FAIL" and base.get(k) == "PASS"]
    newly_passing = [k for k, v in cur.items() if v == "PASS" and base.get(k) == "FAIL"]
    return {
        "regressions": newly_failing,
        "fixes": newly_passing,
        "block": len(newly_failing) > 0 and not run.get("allow_regressions"),
    }
```

**`regressions` 这个列表是代码评审里最该被贴出来的东西。**

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://docs.langchain.com/langsmith/evaluation-approaches" target="_blank" rel="noreferrer">LangSmith · Baselines</a>
  <a href="https://www.braintrust.dev/docs/evaluation-quickstart" target="_blank" rel="noreferrer">Braintrust · Experiment comparison</a>
</div>

## 05 并发太高，结果失真 {#throttle}

### 症状

```text
评测脚本开了 200 并发
结果：错误率 18%，通过率比平时低 12pt
你以为是模型退化了，其实是自己把 API 打爆了
```

### 根因

大规模并发会触发四种失真：

| 失真 | 表现 |
| --- | --- |
| 429 限流 | 请求被拒，被当成「模型失败」 |
| 超时 | 长回答被截断，被判为「不完整」 |
| 降级路由 | 网关自动切到小模型，你在评一个你没打算评的模型 |
| 上下文错乱 | 部分供应商在高并发下返回质量下降（真实存在） |

### 修法：把「失败」和「被限流」分开

```python
import asyncio, random

async def call_with_backoff(fn, *args, max_retries: int = 6, **kwargs):
    """指数退避 + 抖动，且区分可重试错误与真实失败。"""
    for attempt in range(max_retries):
        try:
            return await fn(*args, **kwargs)
        except RateLimitError as e:
            wait = min(2 ** attempt + random.random(), 30)
            await asyncio.sleep(wait)
        except TransientError:
            await asyncio.sleep(1 + random.random())
    raise EvalInfraError("retries exhausted")   # 绝不能记成「模型答错」
```

### 关键：被限流的样本必须从统计中剔除

```python
def usable(results: list[dict]) -> list[dict]:
    """只统计「真的跑完并拿到判定」的样本。"""
    return [r for r in results if r["status"] == "scored"]

# 通过率 = 通过数 / 有效样本数，而不是 / 总请求数
success_rate = sum(r["pass"] for r in usable(results)) / max(len(usable(results)), 1)
```

::: warning 一个非常容易犯的错
把「限流失败」记成「模型回答错误」，然后得出「新版本变差了」的结论。
**评测跑批结束后，第一件事是看有多少样本是因基础设施原因失败的。超过 1% 就不要相信这次结果。**
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://www.promptfoo.dev/docs/configuration/expected-outputs/model-graded/llm-rubric/" target="_blank" rel="noreferrer">Promptfoo · Concurrency and retries</a>
  <a href="https://docs.langchain.com/langsmith/evaluation-approaches" target="_blank" rel="noreferrer">LangSmith · Rate limits</a>
</div>

## 06 评测成本爆炸 {#cost}

### 症状

```text
第一个月评测账单：$42
第三个月：$1,180
财务来问：这个「评测」是什么业务？
```

### 根因

成本爆炸通常来自四个「无意识重复」：

| 行为 | 成本倍数 |
| --- | --- |
| 每次跑全量（不用冒烟集） | ×20 |
| 每个样本送 3 个裁判投票 | ×3 |
| 代码能判的也送裁判 | ×2.5 |
| 同一份输入重复评（没缓存） | ×1.5-4 |

乘起来就是 **几十倍**。

### 修法：四道阀门

```text
阀门 1  分级执行     提交跑 30 条冒烟，合并跑 300 条回归，发版跑全量
阀门 2  代码优先     硬校验通过就不再调裁判
阀门 3  结果缓存     相同 (input_hash, grader_version) 直接复用
阀门 4  预算熔断     单次评测超过阈值立刻停，并告警
```

```python
class BudgetGuard:
    def __init__(self, max_usd: float):
        self.max_usd = max_usd
        self.spent = 0.0

    def charge(self, usd: float) -> None:
        self.spent += usd
        if self.spent > self.max_usd:
            raise BudgetExceeded(f"spent ${self.spent:.2f} > budget ${self.max_usd:.2f}")
```

### 一份成本看板

<div class="a-board">
  <div class="a-board__card">
    <div class="a-board__k">冒烟集单次</div>
    <div class="a-board__v">$0.04</div>
    <div class="a-board__d is-good">▼ 每次提交都跑得起</div>
    <div class="a-board__bar"><span style="--w:12%"></span></div>
  </div>
  <div class="a-board__card">
    <div class="a-board__k">回归集单次</div>
    <div class="a-board__v">$0.38</div>
    <div class="a-board__d">每日一次</div>
    <div class="a-board__bar"><span style="--w:34%"></span></div>
  </div>
  <div class="a-board__card">
    <div class="a-board__k">全量 + 双裁判</div>
    <div class="a-board__v">$2.60</div>
    <div class="a-board__d is-bad">▲ 只在发版前跑</div>
    <div class="a-board__bar is-bad"><span style="--w:86%"></span></div>
  </div>
  <div class="a-board__card">
    <div class="a-board__k">缓存命中率</div>
    <div class="a-board__v">61<small>%</small></div>
    <div class="a-board__d is-good">▲ 直接省下的钱</div>
    <div class="a-board__bar"><span style="--w:61%"></span></div>
  </div>
</div>

::: tip 人话翻译
评测预算像**打车**。每天通勤打车很贵，但「重要会议那天打车」完全付得起。
**关键不是省钱，是把钱花在会出事的那个时刻。**
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://www.braintrust.dev/docs/evaluation-quickstart" target="_blank" rel="noreferrer">Braintrust · Cost tracking</a>
  <a href="https://langfuse.com/docs/evaluation/overview" target="_blank" rel="noreferrer">Langfuse · Cost and usage</a>
</div>

## 07 副作用没有回滚 {#sideeffect}

### 症状

```text
评测跑完，测试环境的数据库里多了 1,842 条已退款订单
客服系统收到了 37 条真实的退款成功通知
```

### 根因

写操作类 Agent 的评测，**执行本身就是副作用**。而大多数人把它当「只读评测」来设计。

| 副作用类型 | 后果 |
| --- | --- |
| 数据库写入 | 脏数据、指标污染 |
| 发消息 / 发邮件 | 真实用户被打扰（事故） |
| 调用外部 API | 真实扣款、真实下单 |
| 创建工单 | 客服团队工作量暴增 |

### 修法：三层防护

<Diagram id="side-effect" />

```text
第一层  环境隔离   评测环境与生产完全隔离（DB、消息队列、第三方 key）
第二层  工具沙箱   写操作工具替换为 mock，只记录不执行
第三层  状态快照   必须真执行时，跑前快照 → 跑后对比 → 强制回滚
```

### 沙箱实现的最小形态

```python
class ToolSandbox:
    """评测专用：写操作只记录，不真执行。"""
    WRITE_TOOLS = {"refund_order", "send_email", "create_ticket", "update_user"}

    def __init__(self, real_tools: dict):
        self.real = real_tools
        self.calls: list[dict] = []

    def call(self, name: str, args: dict) -> dict:
        if name in self.WRITE_TOOLS:
            self.calls.append({"name": name, "args": args})
            return {"ok": True, "simulated": True, "id": f"SIM-{len(self.calls)}"}
        return self.real[name](**args)

    def assert_no_side_effects(self) -> dict:
        return {"name": "no_side_effect", "pass": True, "note": f"simulated={len(self.calls)}"}
```

### 状态断言（真正需要的那个检查）

```python
def assert_state_unchanged(before: dict, after: dict) -> dict:
    """除了白名单字段，其他状态一律不许变。"""
    changed = {k for k in before if before[k] != after.get(k)}
    allowed = {"updated_at"}
    unexpected = changed - allowed
    return {"name": "state_unchanged", "pass": not unexpected, "note": f"changed={sorted(unexpected)}"}
```

::: danger 一条必须写进 SOP 的规矩
**评测环境绝不能连生产数据库、生产消息队列、生产支付渠道。**
如果做不到隔离，那么评测就必须使用 mock，没有例外。
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://www.anthropic.com/engineering/writing-tools-for-agents" target="_blank" rel="noreferrer">Anthropic · Writing effective tools for agents</a>
  <a href="https://genai.owasp.org/llm-top-10/" target="_blank" rel="noreferrer">OWASP · Excessive agency</a>
</div>

## 附：七坑自检表 {#checklist}

按这张表给你现在的评测体系打分，**任何一项是「否」，就先修它**。

| # | 检查项 | 是 / 否 |
| --- | --- | --- |
| 1 | 数据集里超过 50% 的用例来自真实 Trace | ☐ |
| 2 | 每条用例至少有一条代码硬校验 | ☐ |
| 3 | 记录了工具调用序列，不只记录最终答案 | ☐ |
| 4 | 有一份可 diff 的基线文件 | ☐ |
| 5 | 评测跑批会区分「限流失败」与「回答错误」 | ☐ |
| 6 | 有冒烟集/回归集/全量三级执行策略 | ☐ |
| 7 | 写操作工具在评测环境中被 mock 或有快照回滚 | ☐ |

七项全过，说明你的评测体系已经超过大多数团队；过 4-6 项，及格但还脆弱；**过 3 项以下，你的分数基本不能作为决策依据。**

---

下一章不再讲道理，直接上代码：七个可以复制粘贴就跑的 Demo。
