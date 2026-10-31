---
title: 05 · 轨迹评测：Agent 独有的战场
description: 轨迹解剖、顺序匹配、任意顺序与子集匹配、合理性判定、循环检测、工具副作用回滚，以及轨迹分数的实现。
outline: [2, 3]
---

# 05 · 轨迹评测：Agent 独有的战场

如果一个 Agent 最终答案完全正确，但过程中调用了 12 次无关工具、把用户地址改成了别人的、还差点删除一条订单记录——它算成功吗？

在普通 LLM 评测里，这个问题不存在，因为没有「过程」。
在 Agent 评测里，这是**每天都会遇到的问题**。

这一章讲的就是「怎么看过程」。

## 01 一条轨迹长什么样 {#anatomy}

先建立画面感。用户说：「帮我查一下 A1024 这个订单什么时候到，如果超时就申请赔付。」

<Diagram id="trace-anatomy" />

这条 Trace 展开后大概是这样：

```json
{
  "trace_id": "tr_7c1d9a",
  "goal": "查询 A1024 物流，超时则申请赔付",
  "runs": [
    { "step": 1, "kind": "llm",  "note": "规划：先查订单，再查物流，判断是否超时" },
    { "step": 2, "kind": "tool", "tool": "get_order",       "args": { "order_id": "A1024" } },
    { "step": 3, "kind": "tool", "tool": "get_logistics",   "args": { "order_id": "A1024" } },
    { "step": 4, "kind": "llm",  "note": "承诺 48h，已过 72h，超时成立" },
    { "step": 5, "kind": "tool", "tool": "apply_compensation", "args": { "order_id": "A1024", "reason": "delay" } },
    { "step": 6, "kind": "llm",  "note": "生成最终回复" }
  ],
  "final_answer": "您的订单已超时 24 小时，已为您提交赔付申请…"
}
```

### 轨迹里到底有哪些信息可评

| 维度 | 具体内容 | 谁擅长判 |
| --- | --- | --- |
| 工具选择 | 调了哪些工具、漏了哪个、多调了哪个 | 代码 |
| 工具参数 | 入参是否正确、是否编造了 order_id | 代码 |
| 调用顺序 | 是否「先赔付后核实」这类危险顺序 | 代码 |
| 调用次数 | 冗余、重复、循环 | 代码 |
| 中间推理 | 每一步的判断是否合理 | 裁判 |
| 状态变更 | 数据库/外部系统发生了什么变化 | 代码（快照比对） |
| 终止原因 | 正常结束、达到上限、主动放弃 | 代码 |

::: tip 人话翻译
最终答案只是**外卖有没有送到**。轨迹是**骑手有没有绕路、有没有闯红灯、有没有把别人的餐也拿走了**。
用户投诉时，90% 的投诉不是「没送到」，而是「这一路上发生了什么」。
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents" target="_blank" rel="noreferrer">Anthropic · Demystifying evals for AI agents</a>
  <a href="https://docs.langchain.com/langsmith/trajectory-evals" target="_blank" rel="noreferrer">LangSmith · Trajectory evaluations</a>
</div>

## 02 轨迹匹配评测 {#match}

最直接的方式：**把期望的工具序列写下来，跟实际序列比。**

适合固定流程的 Agent，比如「查订单 → 查物流 → 判断超时 → 申请赔付」这类业务规则明确、路径稳定的场景。

<Diagram id="traj-match" />

### 四种匹配强度

| 模式 | 规则 | 严格度 | 适用 |
| --- | --- | --- | --- |
| **完全匹配** | 序列完全一致 | 最严 | 强合规流程（退款、审批） |
| **顺序匹配（子序列）** | 期望序列按序出现即可，中间允许别的调用 | 中 | 大多数业务流程 |
| **任意顺序匹配** | 期望集合全部出现，顺序不限 | 宽松 | 信息收集类任务 |
| **子集匹配** | 只要出现指定关键步骤 | 最宽松 | 只关心「有没有做某件事」 |

### 为什么默认选「顺序匹配」

完全匹配太脆：Agent 中间多调一次 `get_user_profile` 就判定失败，而这次调用完全合理。
任意顺序太松：它允许「先赔付、后核实」这种危险顺序。

**子序列匹配是甜点区**：既保证关键步骤的顺序正确，又允许合理的额外探索。

```python
from collections import deque

def match_in_order(actual: list[str], expected: list[str]) -> dict:
    """expected 是否为 actual 的子序列（保持相对顺序）。"""
    queue = deque(expected)
    for name in actual:
        if queue and name == queue[0]:
            queue.popleft()
    return {
        "pass": not queue,
        "missing": list(queue),
        "actual_len": len(actual),
        "expected_len": len(expected),
    }

# 用法
actual   = ["get_user_profile", "get_order", "get_logistics", "apply_compensation"]
expected = ["get_order", "get_logistics", "apply_compensation"]
print(match_in_order(actual, expected))   # pass=True，多一次 profile 也接受
```

### 什么时候必须用「完全匹配」

只有当**顺序本身是合规要求**时。比如：

- 退款必须先查订单归属，再执行退款；
- 删除数据前必须先做备份调用；
- 转人工之前必须先尝试自助方案。

这类场景建议在用例里显式标注 `strict_order: true`，而不是靠全局规则。

::: warning 轨迹匹配的最大坑
把「我自己想到的标准路径」当成唯一正确路径。真实 Agent 常有更短的路径（比如直接从缓存命中），完全匹配会把它判成失败——**你会惩罚一个更优的解**。
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://docs.langchain.com/langsmith/trajectory-evals" target="_blank" rel="noreferrer">LangSmith · Trajectory match modes</a>
  <a href="https://developers.openai.com/api/docs/guides/agent-evals" target="_blank" rel="noreferrer">OpenAI · Agent evals</a>
</div>

## 03 轨迹合理性评测 {#reasonable}

固定匹配只适合路径明确的场景。开放式任务（「帮我分析下这个月的销售」）没有唯一正确路径，这时候要判的是**「这条路讲不讲得通」**。

### 三个层次的合理性

| 层次 | 问题 | 判定方式 |
| --- | --- | --- |
| 逻辑合理 | 每一步是否由前一步的结果自然引出 | 裁判 + 规则 |
| 效率合理 | 有没有明显更短的路 | 与基线路径对比 |
| 风险合理 | 有没有在信息不足时执行高风险操作 | 规则（代码） |

### 用裁判判合理性

```text
你是 Agent 轨迹评审员。你判一件事：这条轨迹的决策是否合理。

[任务] {{goal}}
[可用工具] {{tools}}
[轨迹]
{{trajectory}}

[判定]
PASS —— 同时满足：
  1) 每一步调用都能由「当前已知信息」推导出来，不需要假设；
  2) 没有在关键信息缺失时执行写操作（退款/删除/发送）；
  3) 若任务需要澄清，轨迹中包含一次澄清动作。

FAIL —— 出现任意一条：
  1) 出现无法解释的跳步（例如没查订单就执行赔付）；
  2) 在信息缺失时直接执行不可逆操作；
  3) 反复调用同一工具且入参几乎不变。

输出 JSON：{"verdict": "...", "first_bad_step": <int|null>, "reason": "..."}
```

`first_bad_step` 这个字段非常重要：**它把「整条轨迹不合理」这种没用的结论，变成「第 4 步开始跑偏」这种可行动的信息。**

### 合理性 vs 效率，分开算

```python
def trajectory_score(trace, expected_steps: int) -> dict:
    steps = len(trace.runs)
    return {
        "path_ok": None,                                  # 由裁判填
        "efficiency": round(min(1.0, expected_steps / max(steps, 1)), 3),
        "redundancy": 1 - len({(r.get("tool"), str(r.get("args"))) for r in trace.runs}) / max(steps, 1),
    }
```

::: tip 人话翻译
「轨迹合理性」像**司机面试**。你不是要求他一字不差地走某条路，而是问：他为什么走这条路？说得通吗？有没有为了省事闯了红灯？
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://docs.langchain.com/langsmith/evaluate-complex-agent" target="_blank" rel="noreferrer">LangSmith · Evaluating complex agents</a>
  <a href="https://arxiv.org/abs/2406.12045" target="_blank" rel="noreferrer">τ-bench · tool-agent-user interaction</a>
</div>

## 04 循环与原地打转检测 {#loop}

这是最容易被忽略、也最容易烧钱的一类坏轨迹。

<Diagram id="loop-detect" />

### 三种典型的循环

| 类型 | 长什么样 | 根因 |
| --- | --- | --- |
| **精确循环** | 同样的工具 + 同样的入参，重复 3 次以上 | 工具返回被误读 / 上下文丢帧 |
| **近似循环** | 同一工具，入参每次微调（订单号换一下） | 搜索策略失效 |
| **震荡循环** | A→B→A→B 反复横跳 | 规划与执行冲突，或两个子目标互相打架 |

### 检测算法

```python
from collections import Counter

def detect_loop(trace, window: int = 6, threshold: int = 3) -> dict:
    """滑动窗口内的重复检测：完全相同 / 工具级重复 / ABAB 震荡。"""
    calls = [(r.get("tool"), json.dumps(r.get("args", {}), sort_keys=True))
             for r in trace.runs if r.get("kind") == "tool"]

    exact = Counter(calls)
    worst = max(exact.values(), default=0)

    # 工具级重复（忽略参数）
    tool_seq = [c[0] for c in calls]
    tool_repeat = max(Counter(tool_seq).values(), default=0)

    # ABAB 震荡
    oscillation = any(
        tool_seq[i] == tool_seq[i + 2] and tool_seq[i + 1] == tool_seq[i + 3]
        and tool_seq[i] != tool_seq[i + 1]
        for i in range(len(tool_seq) - 3)
    )

    return {
        "pass": worst < threshold and not oscillation,
        "max_exact_repeat": worst,
        "max_tool_repeat": tool_repeat,
        "oscillation": oscillation,
        "calls": len(calls),
    }
```

### 线上要做的不是「检测」，是「熔断」

检测只在评测时有用。线上真正救命的是**运行时熔断**：

```python
class LoopBreaker:
    """同一工具 + 相似入参超过 N 次，直接中断并降级。"""

    def __init__(self, threshold: int = 3):
        self.threshold = threshold
        self.seen: Counter = Counter()

    def check(self, tool: str, args: dict) -> str:
        key = f"{tool}:{hash(json.dumps(args, sort_keys=True)) % 10**8}"
        self.seen[key] += 1
        if self.seen[key] >= self.threshold:
            return "abort"          # 中断，转人工或返回已知信息
        if self.seen[key] == self.threshold - 1:
            return "warn"           # 提醒模型换策略
        return "ok"
```

::: warning 循环检测的两个误判
1. **正常重试被误杀**：网络抖动导致的相同调用是合理重试，应带指数退避、且计入重试指标而非循环指标。
2. **阈值太松**：设成 10 次才熔断，那时已经烧掉半小时和几美元。
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents" target="_blank" rel="noreferrer">Anthropic · Demystifying evals for AI agents</a>
  <a href="https://arize.com/docs/phoenix" target="_blank" rel="noreferrer">Arize Phoenix · Trace analysis</a>
</div>

## 05 工具副作用校验 {#sideeffect}

写操作类 Agent（退款、发消息、改地址、建工单）有一个普通 LLM 完全不存在的问题：**评测本身会改变世界**。

<Diagram id="side-effect" />

### 三个必须解决的问题

| 问题 | 后果 | 解决 |
| --- | --- | --- |
| 状态污染 | 第二次跑用例时初始状态已变，结果不可比 | 每次运行前重置快照 |
| 副作用外泄 | 评测给真实用户发了消息 / 退了真钱 | 沙箱环境 + 假下游 |
| 副作用不可见 | 答案对但数据被改坏，没人发现 | 跑完后比对状态快照 |

### 沙箱 + 快照 + 校验，三件套

```python
import contextlib

@contextlib.contextmanager
def sandboxed(eval_env):
    """进入评测沙箱：快照 → 执行 → 校验 → 回滚。"""
    snapshot = eval_env.snapshot()
    try:
        yield eval_env
    finally:
        diff = eval_env.diff_against(snapshot)
        eval_env.restore(snapshot)
        sandboxed.last_side_effects = diff     # 供断言使用

def check_side_effects(allowed: list[str]) -> dict:
    """只允许声明的副作用发生；其他一律 FAIL。"""
    actual = sandboxed.last_side_effects or {}
    unexpected = {k: v for k, v in actual.items() if k not in allowed}
    return {"name": "side_effects", "pass": not unexpected,
            "note": f"unexpected={list(unexpected)}"}
```

### 副作用也要有「正向断言」

只检查「没有意外的副作用」不够，还要检查「该发生的副作用发生了」：

```python
def check_refund_created(env) -> dict:
    refunds = env.query("SELECT * FROM refunds WHERE order_id = %s", ("A1024",))
    return {
        "name": "refund_created",
        "pass": len(refunds) == 1 and refunds[0]["amount"] == 199.00,
        "note": f"rows={len(refunds)}",
    }
```

两者缺一不可：
- 少了「不该发生的」，会漏掉乱写数据；
- 少了「该发生的」，会漏掉「说退款了但没退」这种最严重的问题。

::: danger 最贵的评测事故
在一个连着真实下游的环境里跑「删除账号」用例。这不是段子，是真实发生过的。
**任何写操作的评测，必须在沙箱里跑，且默认下游是 mock。**
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://docs.langchain.com/langsmith/trajectory-evals" target="_blank" rel="noreferrer">LangSmith · Trajectory and state evaluation</a>
  <a href="https://arxiv.org/abs/2307.13854" target="_blank" rel="noreferrer">WebArena · verifiable final states</a>
</div>

## 06 轨迹评分实现 {#scoring}

最后把所有零件组装成一个可用的轨迹评分器。

### 一个完整的评分器

```python
from dataclasses import dataclass

@dataclass
class TrajectoryScore:
    result_ok: bool            # 最终结果对不对
    path_ok: bool              # 关键步骤顺序对不对
    no_loop: bool              # 有没有打转
    side_effects_ok: bool      # 副作用是否符合预期
    efficiency: float          # 0-1，相对期望步数
    first_bad_step: int | None # 最早出错的位置

    @property
    def verdict(self) -> str:
        return "PASS" if all([self.result_ok, self.path_ok, self.no_loop,
                              self.side_effects_ok]) else "FAIL"

    @property
    def score(self) -> float:
        """加权总分：结果最重，其次是路径与副作用。"""
        weights = {"result": 0.5, "path": 0.2, "loop": 0.15,
                   "side": 0.1, "eff": 0.05}
        return round(
            weights["result"] * self.result_ok
            + weights["path"] * self.path_ok
            + weights["loop"] * self.no_loop
            + weights["side"] * self.side_effects_ok
            + weights["eff"] * self.efficiency, 3)

def score_trajectory(case, trace, judge) -> TrajectoryScore:
    result = judge.final_answer_ok(case, trace)
    path = match_in_order(tool_names(trace), case.expect.must_call)
    loop = detect_loop(trace)
    side = check_side_effects(case.expect.allowed_side_effects)

    bad_steps = []
    if not result["pass"]:
        bad_steps.append(trace.runs[-1].step)
    if not path["pass"]:
        bad_steps.append(find_first_step(trace, path["missing"]))
    if not loop["pass"]:
        bad_steps.append(loop.get("first_repeat_step"))

    return TrajectoryScore(
        result_ok=result["pass"],
        path_ok=path["pass"],
        no_loop=loop["pass"],
        side_effects_ok=side["pass"],
        efficiency=round(min(1.0, len(case.expect.must_call) / max(len(tool_names(trace)), 1)), 3),
        first_bad_step=min([s for s in bad_steps if s], default=None),
    )
```

### 分数该怎么用

| 用途 | 看哪个 | 说明 |
| --- | --- | --- |
| 门禁 | `verdict` | 只看 PASS/FAIL，不看加权分 |
| 版本对比 | `score` | 加权分适合看趋势 |
| 排障 | `first_bad_step` | 直接跳到问题步骤 |
| 数据集健康 | 各子项通过率 | 看哪个维度系统性偏低 |

::: warning 加权分的陷阱
加权总分很适合做趋势图，但**不要用它做门禁**。0.78 分和 0.81 分的差别在加权体系里没有意义，还会诱使团队去优化「权重高的那一项」而不修真正的 bug。
门禁用 `verdict`，人对齐用 `verdict`，只有内部趋势看 `score`。
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://docs.langchain.com/langsmith/trajectory-evals" target="_blank" rel="noreferrer">LangSmith · Trajectory evaluations</a>
  <a href="https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents" target="_blank" rel="noreferrer">Anthropic · Demystifying evals for AI agents</a>
</div>

---

下一章把这些评测搬进流水线：让坏版本进不了主干。
