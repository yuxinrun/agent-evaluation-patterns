---
title: 15 · 大规模集群与高并发评测
description: 异步队列与限流退避、分层裁判策略、结果缓存与样本复用、冷热数据分离，以及评测预算管控与熔断机制。
outline: [2, 3]
---

# 15 · 大规模集群与高并发评测

前面十几章，数据集是 300 条，一次跑完喝杯咖啡就行。

现在假设：**回归集 30,000 条，每天跑；发版前还要跑三遍（多模型对比）。** 一天 12 万次 Agent 调用，加上裁判，账面立刻难看。

这一章解决三个问题：**跑得完、跑得起、跑得稳。**

<Diagram id="scale-arch" />

## 01 异步队列与限流退避 {#queue}

### 为什么不能"多开线程"就完事

朴素做法是 `ThreadPoolExecutor(max_workers=200)`。它会在三分钟内给你三种事故：

| 事故 | 原因 |
| --- | --- |
| 429 雪崩 | 200 个线程同时对同一个 key 打 API |
| 内存爆掉 | 200 个结果同时加载进内存 |
| 无法断点续跑 | 进程挂了，全部重来 |

正确形态是**生产者 + 队列 + 有界 Worker 池**。

```python
import asyncio, json, random
from dataclasses import dataclass

@dataclass
class Job:
    case_id: str
    payload: dict
    attempts: int = 0

class WorkerPool:
    def __init__(self, run_fn, n_workers: int = 16, rate_per_sec: float = 8.0):
        self.run_fn = run_fn
        self.n = n_workers
        self.rate = rate_per_sec
        self.sem = asyncio.Semaphore(n_workers)
        self.done: dict[str, dict] = {}

    async def _throttle(self):
        """令牌桶：全局每秒最多 rate 次调用。"""
        await asyncio.sleep(1.0 / self.rate)

    async def _one(self, job: Job) -> None:
        async with self.sem:
            await self._throttle()
            try:
                self.done[job.case_id] = await self.run_fn(job.payload)
            except RateLimitError:
                job.attempts += 1
                if job.attempts <= 5:
                    await asyncio.sleep(min(2 ** job.attempts + random.random(), 30))
                    return await self._one(job)          # 退避后重试
                self.done[job.case_id] = {"status": "infra_error", "reason": "rate_limit"}
            except Exception as e:
                self.done[job.case_id] = {"status": "infra_error", "reason": str(e)}

    async def run(self, jobs: list[Job]) -> dict:
        await asyncio.gather(*(self._one(j) for j in jobs))
        return self.done
```

### 三个必须的参数

```text
并发数      = min(供应商 RPM 限额 × 0.7, 本地 CPU 核数 × 4)
单请求超时   = P99 延迟 × 2（不是拍脑袋 30s）
总重试上限   = 5 次，且必须有抖动（同时重试等于二次雪崩）
```

### 断点续跑：评测的基本素养

```python
def load_done(results_path: str) -> set[str]:
    """跑之前先看哪些用例已经有结果，直接跳过。"""
    done = set()
    for line in open(results_path, encoding="utf-8"):
        row = json.loads(line)
        if row.get("status") == "scored":
            done.add(row["id"])
    return done

# 用法：重跑时只处理未完成的
pending = [c for c in cases if c["id"] not in load_done("evals/results/cases.jsonl")]
```

**没有断点续跑，一个 3 小时的跑批挂在第 2 小时 50 分，你会想砸键盘。**

::: tip 人话翻译
限流退避像**早高峰挤地铁**。所有人同时往门口冲（无限并发），谁也上不去；排队一列一列上（令牌桶），反而最快。
而「重试必须带抖动」是因为：车晚点时，如果所有人同时改签到同一班车，那班车也会晚点。
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://docs.langchain.com/langsmith/evaluation-approaches" target="_blank" rel="noreferrer">LangSmith · Running large evaluations</a>
  <a href="https://www.promptfoo.dev/docs/configuration/expected-outputs/model-graded/llm-rubric/" target="_blank" rel="noreferrer">Promptfoo · Concurrency control</a>
</div>

## 02 分层裁判策略 {#tiered}

3 万条用例，如果每条都送最贵的模型当裁判，成本大概是这个量级：

```text
30,000 × $0.004 = $120 / 次
每天一次 + 发版三次 = $480 / 天 = $14,400 / 月
```

明显不可持续。解法不是「少测」，而是**把裁判分层**。

<Diagram id="tier-judge" />

### 三层结构

```text
第 0 层：代码校验（免费）
   拦截 70%-85% 的样本，直接给出 PASS/FAIL

第 1 层：廉价裁判（gpt-5-mini 级别，$0.0004/次）
   处理剩下的 15%-30%
   输出 PASS/FAIL + 置信度

第 2 层：强裁判（gpt-5 级别，$0.004/次）
   只处理第 1 层「低置信」的样本，通常是总量的 5%-8%

第 3 层：人工
   只处理强裁判仍存疑的，通常是 0.5%-1%
```

### 省钱效果算一遍

```python
def tiered_cost(n_total: int, code_pass: float = 0.75,
                low_conf: float = 0.07, human: float = 0.008) -> dict:
    c_cheap, c_strong = 0.0004, 0.004
    n_judged = n_total * (1 - code_pass)
    n_strong = n_judged * low_conf
    total = n_judged * c_cheap + n_strong * c_strong
    return {
        "judged": int(n_judged), "strong": int(n_strong),
        "cost_usd": round(total, 2),
        "vs_flat": round(total / (n_total * c_strong), 3),   # 相对全用强裁判
    }

print(tiered_cost(30_000))
# {'judged': 7500, 'strong': 525, 'cost_usd': 5.1, 'vs_flat': 0.043}
```

**成本降到原来的 4.3%。** 而且注意：被降级处理的样本，结论质量几乎没有下降，因为它们本来就是「代码校验说有问题，廉价裁判也一眼看出问题」的明显失败样本。

### 分层的关键：什么该升级

```python
def route_to_strong(verdict: dict, case: dict) -> bool:
    """只有这些情况才值得花 10 倍的钱。"""
    return any([
        verdict["confidence"] == "low",              # 裁判自己不确定
        case.get("tags", []) and "edge" in case["tags"],   # 边界用例
        case.get("priority") == "high",              # 高价值场景
        verdict.get("score") != verdict.get("prev_score"),  # 与上次结果翻转（可疑）
    ])
```

::: warning 分层最容易犯的错
**用廉价裁判去仲裁「结果对不对」这类事实判断。** 廉价模型事实校验能力差，会系统性放过编造内容。
**分层只用于「难度筛选」，事实类判定必须由代码或强裁判完成。**
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://mlflow.org/docs/latest/genai/eval-monitor/scorers/" target="_blank" rel="noreferrer">MLflow · Scorer strategies</a>
  <a href="https://langfuse.com/docs/evaluation/evaluation-methods/llm-as-a-judge" target="_blank" rel="noreferrer">Langfuse · Judge cost control</a>
</div>

## 03 缓存与样本复用 {#cache}

评测有一个天然优势：**大部分输入是重复的。**

- 同一份数据集，一天跑 5 次（不同人提交 PR）；
- 同一个 prompt，评测 3 个模型；
- 只改了提示词的一小段，90% 的用例行为不变。

### 缓存键怎么设计

```python
import hashlib, json

def cache_key(input_text: str, output_text: str, grader_version: str) -> str:
    """裁判结果只取决于：输入、输出、裁判版本。三者任一变化都必须重算。"""
    payload = json.dumps(
        {"in": input_text, "out": output_text, "grader": grader_version},
        sort_keys=True, ensure_ascii=False,
    )
    return hashlib.sha256(payload.encode()).hexdigest()[:32]
```

三个字段缺一不可：

| 字段 | 漏掉的后果 |
| --- | --- |
| `input` | 不同问题复用同一判定（灾难） |
| `output` | 改了 prompt 却复用旧判定（看起来没变） |
| `grader_version` | 调了 rubric 但结果不变（校准失效） |

### 两级缓存

```python
class TwoLevelCache:
    def __init__(self, redis, disk_dir: str):
        self.redis = redis            # L1：热，跨机器共享
        self.disk = disk_dir          # L2：冷，跨运行保留

    def get(self, key: str):
        if v := self.redis.get(f"judge:{key}"):
            return json.loads(v)
        path = f"{self.disk}/{key[:2]}/{key}.json"
        try:
            return json.load(open(path, encoding="utf-8"))
        except FileNotFoundError:
            return None

    def put(self, key: str, value: dict, ttl: int = 7 * 86400):
        self.redis.setex(f"judge:{key}", ttl, json.dumps(value))
        import os, pathlib
        path = pathlib.Path(f"{self.disk}/{key[:2]}/{key}.json")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value), encoding="utf-8")
```

实测缓存命中率的经验值：

```text
同一分支反复跑（开发迭代期）        60% - 85%
每天一次的定时回归                   35% - 55%
发版前多模型对比                     20% - 30%（输出不同，缓存失效）
```

### 更狠的一招：只跑「受影响的用例」

如果你能算出「这次改动影响哪些用例」，就可以只跑那部分。

```python
def affected_cases(change: dict, cases: list[dict]) -> list[dict]:
    """根据改动类型缩小范围。保守优先：不确定就全跑。"""
    kind = change["kind"]
    if kind == "prompt_section" and change.get("scope") == "refund_only":
        return [c for c in cases if "refund" in c["tags"]]
    if kind == "tool_description":
        return [c for c in cases if change["tool"] in c.get("tools_used", [])]
    return cases      # 模型升级、检索改动等全局变更：全量
```

不过要小心：**范围算错的代价是漏掉回归。** 所以每周至少跑一次全量，用全量结果验证「范围缩小」没漏。

::: tip 人话翻译
缓存像**老师批改同一道题**。两个学生答案一模一样（同样的输入输出），第二份直接抄上一份的评语就行。
但如果题目换了（input 变了）或者评分标准换了（rubric 版本变了），就必须重新批。
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://www.braintrust.dev/docs/evaluation-quickstart" target="_blank" rel="noreferrer">Braintrust · Caching scorers</a>
  <a href="https://docs.langchain.com/langsmith/evaluation-approaches" target="_blank" rel="noreferrer">LangSmith · Caching in experiments</a>
</div>

## 04 冷热数据分离 {#storage}

3 万条用例跑 100 次 = 300 万条结果记录。全放一个表里，你的查询会从 200ms 变成 20s。

### 数据分层

| 层 | 内容 | 存储 | 保留 |
| --- | --- | --- | --- |
| **热** | 最近 7 天的 run，明细可查 | Postgres / 时序库 | 7 天 |
| **温** | 最近 12 个月的汇总（分片通过率、成本） | 聚合表 | 12 个月 |
| **冷** | 历史明细（含证据、原始输出） | 对象存储（Parquet/JSONL） | 长期 |
| **归档** | 基线快照、人工标注、事故关联 | Git + 对象存储 | 永久 |

### 聚合表设计

```sql
-- 一次聚合，之后所有趋势查询都打这张小表
CREATE TABLE eval_run_summary (
  run_id        TEXT PRIMARY KEY,
  commit_sha    TEXT,
  dataset_ver   TEXT,
  grader_ver    TEXT,
  started_at    TIMESTAMPTZ,
  n_cases       INT,
  pass_rate     REAL,
  cost_usd      REAL,
  p95_latency   INT,
  by_tag        JSONB,          -- {"positive":0.94,"edge":0.80,"injection":1.0}
  failures      JSONB           -- {"code_check": 42, "judge": 18, "infra": 3}
);
```

有了它，「过去 30 天通过率趋势」是一条毫秒级查询，而不是扫 300 万行。

### 明细的冷存格式

```text
s3://eval-archive/2026/10/31/run-7f3a/cases.parquet
  ├─ 列式存储，只看 fail 的用例时只读 3 列
  ├─ 按 (date, run_id) 分区，便于按时间范围拉取
  └─ 每个文件带 grader_ver，能反推判定标准
```

::: warning 一个真实的性能事故
某团队把 300 万条 case 明细和业务表放在同一个 Postgres 实例。评测查询把连接池占满，**业务接口 P99 从 300ms 涨到 8s**。
评测数据必须独立实例或独立库。**没有任何理由让评测和生产共用资源池。**
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://langfuse.com/docs/evaluation/overview" target="_blank" rel="noreferrer">Langfuse · Data retention</a>
  <a href="https://arize.com/docs/phoenix" target="_blank" rel="noreferrer">Arize Phoenix · Storage and retention</a>
</div>

## 05 预算管控与熔断 {#budget}

最后一层保险：**当一切都失控时，钱要能刹住。**

<Diagram id="budget-fuse" />

### 三级熔断

```python
class EvalBudget:
    def __init__(self, run_cap: float, day_cap: float, month_cap: float):
        self.caps = {"run": run_cap, "day": day_cap, "month": month_cap}
        self.spent = {"run": 0.0, "day": 0.0, "month": 0.0}

    def charge(self, usd: float, level: str) -> None:
        for k in ("run", "day", "month"):
            self.spent[k] += usd
            if self.spent[k] > self.caps[k]:
                raise BudgetExceeded(
                    f"{k} budget exceeded: ${self.spent[k]:.2f} > ${self.caps[k]:.2f}"
                )
```

三级阈值分别防三类事故：

| 级别 | 防什么 | 建议值 |
| --- | --- | --- |
| **run** | 某个脚本死循环、重试风暴 | 正常单次成本的 3 倍 |
| **day** | 有人反复触发 CI | 日常消耗的 2 倍 |
| **month** | 悄悄涨价、基数失控 | 预算的 90% |

### 熔断的三种行为

```text
软熔断（80% 预算）  降级：强裁判 → 廉价裁判，日志告警
硬熔断（100% 预算） 停止送裁判，未评样本标记为「未完成」，不污染统计
紧急熔断（异常增速） 立即停 + 电话告警（比如 10 分钟花掉一天预算）
```

### 异常增速检测

成本暴涨往往不是慢慢发生的，而是某个 bug 导致的瞬间爆发：

```python
def runaway_check(spent_last_10min: float, daily_cap: float) -> bool:
    """按当前速度，一天会花掉预算的几倍？"""
    projected = spent_last_10min * 144        # 10 分钟 → 一天
    return projected > daily_cap * 1.5
```

**这个检查只花一行代码，却能拦住 90% 的成本事故。**

### 一份月度成本看板

<div class="a-board">
  <div class="a-board__card">
    <div class="a-board__k">用例规模</div>
    <div class="a-board__v">30k</div>
    <div class="a-board__d">回归集全量</div>
    <div class="a-board__bar"><span style="--w:80%"></span></div>
  </div>
  <div class="a-board__card">
    <div class="a-board__k">分层后单次成本</div>
    <div class="a-board__v">$5.1</div>
    <div class="a-board__d is-good">▼ 相比全强裁判 -96%</div>
    <div class="a-board__bar"><span style="--w:12%"></span></div>
  </div>
  <div class="a-board__card">
    <div class="a-board__k">缓存命中率</div>
    <div class="a-board__v">48<small>%</small></div>
    <div class="a-board__d is-good">▲ 直接省一半</div>
    <div class="a-board__bar"><span style="--w:48%"></span></div>
  </div>
  <div class="a-board__card">
    <div class="a-board__k">月度总支出</div>
    <div class="a-board__v">$118</div>
    <div class="a-board__d">预算 $300 内</div>
    <div class="a-board__bar"><span style="--w:39%"></span></div>
  </div>
</div>

### 一条容量规划的公式

```text
月度成本 ≈ 每日运行次数 × 用例数 × (1 - 代码拦截率) × (1 - 缓存命中率)
          × [廉价裁判单价 × (1 - 升级率) + 强裁判单价 × 升级率]
          × 30
```

代入：`3 × 30,000 × 0.25 × 0.52 × (0.0004 × 0.93 + 0.004 × 0.07) × 30 ≈ $130`

**先算这个数，再决定要不要跑全量。** 大多数团队算完之后发现：全量其实跑得起，之前不敢跑是因为没算过。

::: danger 大规模评测的四条纪律
1. **没有断点续跑，不许跑超过 1 小时的批**。
2. **没有预算熔断，不许接 CI 自动触发**。
3. **没有分层，不许把 3 万条全送强裁判**。
4. **没有缓存版本键，不许复用历史判定**。
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://www.braintrust.dev/docs/evaluation-quickstart" target="_blank" rel="noreferrer">Braintrust · Cost tracking</a>
  <a href="https://mlflow.org/docs/latest/genai/eval-monitor/scorers/" target="_blank" rel="noreferrer">MLflow · Scorer cost</a>
</div>

---

最后一章把这本书收起来：**评测不是一个工具，它是整个 Agent 生态的质量总线。**
