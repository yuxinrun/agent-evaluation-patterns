---
title: 12 · 生产环境线上评测
description: 线上抽样旁路架构、失败案例自动捕获、指标劣化告警联动、发现到回归的评测闭环，以及一套可落地的线上评测参考架构。
outline: [2, 3]
---

# 12 · 生产环境线上评测

离线评测有一个无法回避的局限：**你测的是你想到的场景。**

而真实用户会问出你做梦都想不出来的问题。所以离线 99 分的 Agent，上线后依然可能被一句古怪的方言问倒。

线上评测就是补上这一块：**用真实流量测真实版本，同时不拖慢主业务。**

## 01 线上抽样评测 {#sampling}

<Diagram id="online-eval" />

### 核心设计：旁路，不是主路

```text
用户请求
  └─ 主链路（同步，必须快）→ 直接返回用户
       └─ 旁路投递（异步，可延迟）→ 队列
            └─ 评测 Worker（按采样率消费）
                 └─ 结果落库 → 看板 / 告警 / 数据集
```

三条铁律：

| 铁律 | 原因 |
| --- | --- |
| **主链路不等待评测** | 一旦同步，评测的延迟和故障就是业务故障 |
| **评测失败不影响业务** | Worker 挂了，用户不该感知 |
| **采样率可动态调整** | 出问题时要能一键从 2% 提到 20% |

### 采样率怎么定

```text
常规监控        1% - 5%     足够看出趋势，成本可控
新版本灰度      10% - 20%   需要更快发现问题
事故排查        50% - 100%  临时拉高，几小时后回落
高价值会话      100%        涉及金额/合规的会话，全量评
```

一个常见的成本估算公式：

```python
def monthly_judge_cost(qps: float, sample_rate: float, cost_per_eval: float) -> float:
    """粗略估算线上评测的月度裁判成本。"""
    per_month = qps * 0.3 * 0.7 * 3_600 * 24 * 30   # 按 30% 时间有流量、峰值 70% 折算
    return round(per_month * sample_rate * cost_per_eval, 2)

# 20 QPS、2% 采样、每次 $0.0004
print(monthly_judge_cost(20, 0.02, 0.0004))   # ≈ 9.1（美元/月）
```

**线上评测没那么贵。** 贵的往往是把不该评的样本也送去评。

### Worker 的最小实现

```python
import asyncio, json

async def eval_worker(queue, judge, repo, sem: asyncio.Semaphore):
    while True:
        trace = await queue.get()
        async with sem:                       # 全局限流，保护裁判 API
            try:
                checks = run_code_checks(trace)          # 免费的先跑
                if all(c["pass"] for c in checks):
                    verdict = {"verdict": "PASS", "source": "code", "checks": checks}
                else:
                    verdict = await judge(trace)         # 只在有疑点时调用裁判
                await repo.save_eval(trace["trace_id"], verdict)
            except Exception as e:
                await repo.save_eval_error(trace["trace_id"], str(e))
            finally:
                queue.task_done()
```

注意那个 `if all(c["pass"])`：**代码校验通过就不调裁判**，这一步通常能省掉 60%-80% 的裁判调用。

::: tip 人话翻译
线上评测像**餐厅的卫生抽查**。检查员不是站在厨师身后盯着做菜（那会拖慢出餐），而是**事后把样品带走化验**。厨房照常运转，化验结果照样能要命。
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://langfuse.com/docs/evaluation/overview" target="_blank" rel="noreferrer">Langfuse · Online evaluation</a>
  <a href="https://docs.langchain.com/langsmith/evaluation-approaches" target="_blank" rel="noreferrer">LangSmith · Online evaluation</a>
</div>

## 02 失败案例自动捕获 {#capture}

线上评测最值钱的产出不是分数，是**样本**。

<Diagram id="capture" />

### 五个必采信号

| 信号 | 含义 | 采样优先级 |
| --- | --- | --- |
| `status = error` | 明确报错 | 最高 |
| 用户否定（点踩 / 重问） | 隐性不满意 | 最高 |
| 转人工 / 投诉 | 业务级失败 | 最高 |
| 轮次异常（> P90） | 原地打转、反复试探 | 高 |
| 耗时异常（> 2× P95） | 性能或死循环 | 中 |
| 随机健康样本 | 防止数据集变悲观 | 固定 2% |

### 从「捕获」到「入库」的四步

```text
1. 捕获   监听信号，把 trace_id 投进捕获队列
2. 补齐   从观测系统拉完整 trace（含全部 span）
3. 脱敏   替换 PII，保留结构与实体一致性
4. 定标   补上「期望结果」——这一步必须有人参与
```

第四步是人工瓶颈，也是最容易被跳过的一步。**没有期望值的样本，只能当「现象记录」，不能进回归集。**

### 半自动定标的做法

```python
def draft_expectation(trace: dict, fix_reference: dict | None) -> dict:
    """给人工标注员一份草稿，而不是一张白纸。"""
    return {
        "input": trace["input"],
        "actual": trace["output"],
        "expected_tools": [s["tool.name"] for s in trace["spans"] if s["kind"] == "tool"],
        "suspected_issue": classify_issue(trace),      # 规则或 LLM 初判
        "candidate_expectation": fix_reference or "",  # 修复后版本的正确输出
        "needs_human": True,
    }
```

**用「修复后的正确输出」作为期望值**是最省力的办法：bug 修完，验证脚本跑一遍，输出直接当标准答案。

### 捕获的 SLA

```text
线上失败 → 进入待标注队列     ≤ 48 小时
待标注 → 完成定标进回归集     ≤ 2 周
超过 2 周未定标 → 自动提醒 + 定期清理（否则队列会烂掉）
```

::: warning 一个反直觉的真相
**失败捕获的瓶颈不是技术，是流程。** 大多数团队的捕获管道第一天就通了，然后待标注队列堆了 800 条没人看。
解决方案不是优化管道，是**把定标变成每周固定的一小时例会**。
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://langfuse.com/docs/evaluation/overview" target="_blank" rel="noreferrer">Langfuse · Trace to dataset</a>
  <a href="https://www.infoq.cn/topic/AI" target="_blank" rel="noreferrer">InfoQ · Agent 生产评测实践</a>
</div>

## 03 告警联动 {#alert}

指标劣化了，但没人知道——这是线上评测最常见的死法。

### 告警的三层设计

| 层级 | 触发条件 | 通知方式 | 响应要求 |
| --- | --- | --- | --- |
| **P0 红线** | 安全指标破线、错误率 > 5% | 电话 / 群 @所有人 | 15 分钟内响应 |
| **P1 劣化** | 完成率环比 -3pt、P95 +30% | 群消息 + 工单 | 1 个工作日内 |
| **P2 趋势** | 连续 3 天缓慢下降 | 周报 | 下次迭代处理 |

### 告警必须自带证据

一条没有证据的告警，等于一条「出事了，自己查」的消息。所以告警体里必须包含：

```python
def build_alert(report: dict) -> dict:
    return {
        "title": f"[P1] 任务完成率劣化 {report['delta']:+.1f}pt",
        "window": "过去 6 小时 vs 前 24 小时基线",
        "metrics": {
            "success_rate": {"now": report["now"], "baseline": report["baseline"]},
            "p95_latency_ms": report["p95"],
        },
        "evidence": {
            "failing_cases": report["failing_case_ids"][:10],
            "trace_links": report["trace_urls"][:10],        # 直接点开看现场
            "judge_comments": report["top_reasons"][:5],     # 失败原因聚类
        },
        "suspected_scope": report.get("affected_slices", []),  # 哪些场景受影响
        "runbook": "https://your-wiki/eval-alerts#success-rate",
    }
```

**`trace_links` 是灵魂。** 收到告警的人第一件事就是想看现场，如果还要自己去搜 trace_id，这条告警大概率会被忽略。

### 劣化判定要抗噪

```python
def is_degraded(now: float, baseline: float, n_now: int, n_base: int,
                min_delta: float = 0.03, z: float = 2.0) -> dict:
    """同时看幅度和显著性，避免把噪声当事故。"""
    delta = now - baseline
    se = ((now * (1 - now) / n_now) + (baseline * (1 - baseline) / n_base)) ** 0.5
    z_score = delta / se if se else 0.0
    return {
        "delta": round(delta, 4),
        "z": round(z_score, 2),
        "alert": delta < -min_delta and z_score < -z,
    }
```

两个条件同时满足才告警：**跌得够多，且不是噪声。** 少了任何一个，你要么天天被吵，要么真事故漏报。

::: tip 人话翻译
告警设计像**体检报告**。只说「你不太健康」的体检没有价值；有用的报告是「血脂高了 0.8，参考范围在这里，上周的对比在这里，建议挂哪个科」。
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://arize.com/docs/phoenix" target="_blank" rel="noreferrer">Arize Phoenix · Monitoring and alerts</a>
  <a href="https://yuxinrun.github.io/agent-observability-patterns/" target="_blank" rel="noreferrer">agent-observability-patterns · 告警设计</a>
</div>

## 04 评测闭环 {#closedloop}

<Diagram id="closed-loop" />

### 闭环的五个环节

```text
发现（线上信号）
  → 归因（Trace + 裁判评语，定位到哪一层坏了）
    → 修复（改 prompt / 改工具 / 改检索）
      → 回归验证（该用例 + 全量回归集）
        → 固化（用例进数据集，指标进基线）
          → 回到「发现」
```

闭环断裂最常发生在**第三步到第四步之间**：问题修了，但没有人为「这条用例」补一条回归。

### 闭环追踪表

| 字段 | 作用 |
| --- | --- |
| `incident_id` | 唯一标识，贯穿全流程 |
| `first_seen_at` | 首次出现时间（判断潜伏多久） |
| `root_cause_layer` | 模型 / 提示 / 工具 / 检索 / 记忆 / 网关 |
| `fix_pr` | 修复的代码或配置变更 |
| `regression_case_id` | 补进数据集的用例 id |
| `verified_at` | 回归通过的时间 |

```sql
-- 用来每周检查：哪些事故修了但没补回归
SELECT incident_id, root_cause_layer, fix_pr
FROM incidents
WHERE fixed_at IS NOT NULL
  AND regression_case_id IS NULL
  AND fixed_at < now() - interval '14 days';
```

**这个查询的结果应该永远是 0 行。** 不是 0，就说明你的闭环有洞。

### 闭环的「三不」原则

```text
不修完就关单     没有回归用例的修复，等于没修
不归因就改提示   不知道坏在哪一层，改提示只是碰运气
不量化不收工     修复后必须有前后指标对比，否则不知道真的好了
```

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://docs.langchain.com/langsmith/evaluation-approaches" target="_blank" rel="noreferrer">LangSmith · Evaluation lifecycle</a>
  <a href="https://langfuse.com/docs/evaluation/overview" target="_blank" rel="noreferrer">Langfuse · Evaluation loop</a>
</div>

## 05 线上评测参考架构 {#infra}

把前面四节拼起来，得到一套可以照着搭的架构。

### 组件清单

| 组件 | 职责 | 常见选择 |
| --- | --- | --- |
| 信号采集 | 从主链路收集 trace_id 与业务信号 | OTel Collector / SDK hook |
| 消息队列 | 削峰、解耦、重试 | Kafka / Redis Stream / SQS |
| 评测 Worker | 跑代码校验与裁判 | 无状态容器，水平扩展 |
| 限流器 | 保护裁判 API | 令牌桶 + 全局信号量 |
| 结果存储 | 判定、证据、指标 | Postgres + 对象存储 |
| 指标聚合 | 分片统计、环比、趋势 | 时序库或定时聚合表 |
| 告警 | 阈值 + 显著性 | 现有告警平台 |
| 数据集回流 | 捕获样本 → 人工定标 → 入库 | 独立服务或 Git 工作流 |

### 关键容量参数

<div class="a-board">
  <div class="a-board__card">
    <div class="a-board__k">常规采样率</div>
    <div class="a-board__v">2<small>%</small></div>
    <div class="a-board__d">趋势可辨，成本可控</div>
    <div class="a-board__bar"><span style="--w:20%"></span></div>
  </div>
  <div class="a-board__card">
    <div class="a-board__k">代码校验拦截率</div>
    <div class="a-board__v">72<small>%</small></div>
    <div class="a-board__d is-good">▲ 免去裁判调用</div>
    <div class="a-board__bar"><span style="--w:72%"></span></div>
  </div>
  <div class="a-board__card">
    <div class="a-board__k">告警误报率</div>
    <div class="a-board__v">&lt;8<small>%</small></div>
    <div class="a-board__d">加显著性判定之后</div>
    <div class="a-board__bar"><span style="--w:8%"></span></div>
  </div>
  <div class="a-board__card">
    <div class="a-board__k">捕获到定标</div>
    <div class="a-board__v">14<small>天</small></div>
    <div class="a-board__d is-bad">▼ 目标是 7 天</div>
    <div class="a-board__bar is-bad"><span style="--w:70%"></span></div>
  </div>
</div>

### 三个部署陷阱

::: danger 线上评测的三个致命部署错误
1. **和主业务共用数据库连接池**：评测把连接吃光，业务先挂。
2. **没有全局并发上限**：灰度放量时，评测量和业务量同时翻倍，裁判 API 直接 429。
3. **没有降级开关**：裁判供应商故障，评测 Worker 无限重试，队列爆掉。必须有一键关停。
:::

### 最小可用版本（MVP）

不用一次做全套。第一版只要这些：

```text
1. 一个采样器（错误 + 点踩 + 2% 随机）
2. 一个 Worker（代码校验 + 二元裁判）
3. 一张表（trace_id, verdict, reason, created_at）
4. 一条每日汇总任务（通过率环比）
5. 一个人（每周固定半小时看失败样本）
```

**第 5 条最重要。** 没有那个人，前四条都只是给自己制造噪音。

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://langfuse.com/docs/evaluation/overview" target="_blank" rel="noreferrer">Langfuse · Evaluation architecture</a>
  <a href="https://arize.com/docs/phoenix" target="_blank" rel="noreferrer">Arize Phoenix · Production monitoring</a>
</div>

---

下一章是全书的「事故复盘室」：把生产里最常见的七个坑，一个一个挖出来看你踩过几个。
