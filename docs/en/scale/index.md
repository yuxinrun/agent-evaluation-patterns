---
title: 15 · Evaluation at scale
description: Async queues with rate limiting, tiered judging, result caching and sample reuse, hot and cold storage, plus budget guardrails and circuit breakers.
outline: [2, 3]
---

# 15 · Evaluation at scale

For the previous chapters the dataset was 300 cases and a coffee break covered the run.

Now assume: **30,000 regression cases, daily, plus three more runs before every release (multi-model comparison).** That is 120,000 agent calls a day before a single judge call. The bill stops being funny.

This chapter solves three problems: **finish the run, afford the run, keep the run stable.**

<Diagram id="scale-arch" />

## 01 Queues, rate limits and backoff {#queue}

### Why "just add threads" fails

The naive answer is `ThreadPoolExecutor(max_workers=200)`. Within three minutes it gives you three incidents:

| Incident | Cause |
| --- | --- |
| 429 avalanche | 200 threads hitting the same key at once |
| Memory blowup | 200 results loaded into memory simultaneously |
| No resume | The process dies and everything restarts from zero |

The correct shape is **producer + queue + bounded worker pool**.

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
        """Token bucket: at most `rate` calls per second, globally."""
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
                    return await self._one(job)          # retry after backoff
                self.done[job.case_id] = {"status": "infra_error", "reason": "rate_limit"}
            except Exception as e:
                self.done[job.case_id] = {"status": "infra_error", "reason": str(e)}

    async def run(self, jobs: list[Job]) -> dict:
        await asyncio.gather(*(self._one(j) for j in jobs))
        return self.done
```

### Three parameters you must choose deliberately

```text
Concurrency     = min(provider RPM limit × 0.7, local cores × 4)
Per-call timeout = P99 latency × 2 (not a vibes-based 30s)
Max retries     = 5, always with jitter (simultaneous retries are a second avalanche)
```

### Resume: table stakes for long runs

```python
def load_done(results_path: str) -> set[str]:
    """Before running, check which cases already have results and skip them."""
    done = set()
    for line in open(results_path, encoding="utf-8"):
        row = json.loads(line)
        if row.get("status") == "scored":
            done.add(row["id"])
    return done

# usage: on a rerun, only process what is unfinished
pending = [c for c in cases if c["id"] not in load_done("evals/results/cases.jsonl")]
```

**Without resume, a three-hour run that dies at 2h50 will make you want a new keyboard.**

::: tip Translation for humans
Rate limiting and backoff are **the morning subway crush**. Everyone rushes the doors at once (unlimited concurrency) and nobody gets in; boarding in an orderly line (token bucket) is actually faster.
Retries need jitter because when the train is late and everyone rebooks onto the same next train, that one is late too.
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://docs.langchain.com/langsmith/evaluation-approaches" target="_blank" rel="noreferrer">LangSmith · Running large evaluations</a>
  <a href="https://www.promptfoo.dev/docs/configuration/expected-outputs/model-graded/llm-rubric/" target="_blank" rel="noreferrer">Promptfoo · Concurrency control</a>
</div>

## 02 Tiered judging {#tiered}

30,000 cases, every one sent to the most expensive judge, lands roughly here:

```text
30,000 × $0.004 = $120 per run
Daily plus three pre-release runs = $480 per day = $14,400 per month
```

Nobody funds that. The answer is not "test less", it is **tier the judges**.

<Diagram id="tier-judge" />

### The four tiers

```text
Tier 0: code checks (free)
   catches 70%-85% of samples and decides them outright

Tier 1: cheap judge (gpt-5-mini class, $0.0004/call)
   handles the remaining 15%-30%
   returns PASS/FAIL plus confidence

Tier 2: strong judge (gpt-5 class, $0.004/call)
   only low-confidence samples from tier 1, usually 5%-8% of the total

Tier 3: humans
   only what the strong judge still cannot settle, usually 0.5%-1%
```

### Do the maths

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
        "vs_flat": round(total / (n_total * c_strong), 3),   # versus all-strong judging
    }

print(tiered_cost(30_000))
# {'judged': 7500, 'strong': 525, 'cost_usd': 5.1, 'vs_flat': 0.043}
```

**Cost drops to 4.3% of the flat approach.** And note: quality barely moves, because the demoted samples are obvious failures that code checks already flagged and the cheap judge agrees with instantly.

### What deserves escalation

```python
def route_to_strong(verdict: dict, case: dict) -> bool:
    """Only these cases are worth 10× the money."""
    return any([
        verdict["confidence"] == "low",              # the judge is unsure
        "edge" in case.get("tags", []),              # boundary cases
        case.get("priority") == "high",              # high-value scenarios
        verdict.get("score") != verdict.get("prev_score"),  # verdict flipped since last run
    ])
```

::: warning The mistake that ruins tiering
**Using a cheap judge to arbitrate factual correctness.** Cheap models are weak fact checkers and systematically let fabricated content through.
**Tiering is for difficulty triage only. Factual verdicts belong to code or a strong judge.**
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://mlflow.org/docs/latest/genai/eval-monitor/scorers/" target="_blank" rel="noreferrer">MLflow · Scorer strategies</a>
  <a href="https://langfuse.com/docs/evaluation/evaluation-methods/llm-as-a-judge" target="_blank" rel="noreferrer">Langfuse · Judge cost control</a>
</div>

## 03 Caching and sample reuse {#cache}

Evaluation has a structural advantage: **most inputs repeat.**

- The same dataset runs five times a day (five people open PRs);
- The same prompt is evaluated on three models;
- One paragraph of the prompt changed, and 90% of case behaviour is identical.

### Designing the cache key

```python
import hashlib, json

def cache_key(input_text: str, output_text: str, grader_version: str) -> str:
    """A verdict depends on input, output and grader version. Change any one, recompute."""
    payload = json.dumps(
        {"in": input_text, "out": output_text, "grader": grader_version},
        sort_keys=True, ensure_ascii=False,
    )
    return hashlib.sha256(payload.encode()).hexdigest()[:32]
```

All three fields are mandatory:

| Field | If you omit it |
| --- | --- |
| `input` | Different questions reuse the same verdict (catastrophic) |
| `output` | The prompt changed but old verdicts are reused (looks unchanged) |
| `grader_version` | The rubric changed but results do not (calibration defeated) |

### Two levels of cache

```python
class TwoLevelCache:
    def __init__(self, redis, disk_dir: str):
        self.redis = redis            # L1: hot, shared across machines
        self.disk = disk_dir          # L2: cold, survives across runs

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
        import pathlib
        path = pathlib.Path(f"{self.disk}/{key[:2]}/{key}.json")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value), encoding="utf-8")
```

Realistic hit rates:

```text
Repeated runs on one branch (iteration)   60% - 85%
Scheduled daily regression                35% - 55%
Pre-release multi-model comparison        20% - 30% (different outputs, cache misses)
```

### The heavier hammer: only run affected cases

If you can compute which cases a change touches, you can run only those.

```python
def affected_cases(change: dict, cases: list[dict]) -> list[dict]:
    """Narrow by change type. Conservative: when unsure, run everything."""
    kind = change["kind"]
    if kind == "prompt_section" and change.get("scope") == "refund_only":
        return [c for c in cases if "refund" in c["tags"]]
    if kind == "tool_description":
        return [c for c in cases if change["tool"] in c.get("tools_used", [])]
    return cases      # model upgrades and retrieval changes: full run
```

But be careful: **getting the scope wrong means a missed regression.** So run a full pass at least weekly to prove the narrowing did not hide anything.

::: tip Translation for humans
A cache is **a teacher marking the same question**. Two students submit identical answers (same input, same output), so the second reuses the first comment.
But if the question changed (input) or the marking guide changed (rubric version), you must mark it again.
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://www.braintrust.dev/docs/evaluation-quickstart" target="_blank" rel="noreferrer">Braintrust · Caching scorers</a>
  <a href="https://docs.langchain.com/langsmith/evaluation-approaches" target="_blank" rel="noreferrer">LangSmith · Caching in experiments</a>
</div>

## 04 Hot and cold storage {#storage}

30,000 cases × 100 runs = 3 million result rows. Put them in one table and your query goes from 200ms to 20s.

### The data tiers

| Tier | Content | Storage | Retention |
| --- | --- | --- | --- |
| **Hot** | Last 7 days of runs, drillable | Postgres / time-series | 7 days |
| **Warm** | Last 12 months of aggregates (slice pass rates, cost) | Rollup tables | 12 months |
| **Cold** | Historical detail (evidence, raw output) | Object storage (Parquet/JSONL) | Long term |
| **Archive** | Baselines, human labels, incident links | Git plus object storage | Forever |

### The rollup table

```sql
-- Aggregate once; every trend query afterwards hits this small table
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

With it, "pass rate over the last 30 days" is a millisecond query instead of a scan over 3 million rows.

### The cold format

```text
s3://eval-archive/2026/10/31/run-7f3a/cases.parquet
  ├─ columnar: reading only failures touches 3 columns
  ├─ partitioned by (date, run_id) for range pulls
  └─ every file records grader_ver so verdicts can be explained later
```

::: warning A real performance incident
One team kept 3 million case rows in the same Postgres instance as their product tables. Eval queries saturated the connection pool and **product API P99 went from 300ms to 8s**.
Eval data needs its own instance or database. **There is no good reason for evaluation and production to share a resource pool.**
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://langfuse.com/docs/evaluation/overview" target="_blank" rel="noreferrer">Langfuse · Data retention</a>
  <a href="https://arize.com/docs/phoenix" target="_blank" rel="noreferrer">Arize Phoenix · Storage and retention</a>
</div>

## 05 Budgets and circuit breakers {#budget}

The last safety net: **when everything else goes wrong, the money must stop.**

<Diagram id="budget-fuse" />

### Three circuit breaker levels

```python
class EvalBudget:
    def __init__(self, run_cap: float, day_cap: float, month_cap: float):
        self.caps = {"run": run_cap, "day": day_cap, "month": month_cap}
        self.spent = {"run": 0.0, "day": 0.0, "month": 0.0}

    def charge(self, usd: float) -> None:
        for k in ("run", "day", "month"):
            self.spent[k] += usd
            if self.spent[k] > self.caps[k]:
                raise BudgetExceeded(
                    f"{k} budget exceeded: ${self.spent[k]:.2f} > ${self.caps[k]:.2f}"
                )
```

Each level guards a different class of incident:

| Level | Guards against | Suggested value |
| --- | --- | --- |
| **run** | One script looping, a retry storm | 3× normal single-run cost |
| **day** | Someone re-triggering CI repeatedly | 2× daily consumption |
| **month** | Silent price rises, base-rate creep | 90% of budget |

### Three breaker behaviours

```text
Soft (80% of budget)   downgrade: strong judge → cheap judge, log an alert
Hard (100% of budget)  stop calling judges; unscored samples marked "incomplete", excluded from stats
Emergency (runaway)    stop immediately plus a phone alert (e.g. one day's budget spent in 10 minutes)
```

### Runaway detection

Cost explosions rarely creep; a bug does it in minutes:

```python
def runaway_check(spent_last_10min: float, daily_cap: float) -> bool:
    """At the current rate, how many days of budget per day?"""
    projected = spent_last_10min * 144        # 10 minutes → a day
    return projected > daily_cap * 1.5
```

**One line of code that catches most cost incidents.**

### A monthly cost board

<div class="a-board">
  <div class="a-board__card">
    <div class="a-board__k">Case volume</div>
    <div class="a-board__v">30k</div>
    <div class="a-board__d">full regression set</div>
    <div class="a-board__bar"><span style="--w:80%"></span></div>
  </div>
  <div class="a-board__card">
    <div class="a-board__k">Cost per run, tiered</div>
    <div class="a-board__v">$5.1</div>
    <div class="a-board__d is-good">▼ -96% versus all-strong</div>
    <div class="a-board__bar"><span style="--w:12%"></span></div>
  </div>
  <div class="a-board__card">
    <div class="a-board__k">Cache hit rate</div>
    <div class="a-board__v">48<small>%</small></div>
    <div class="a-board__d is-good">▲ half the money, unspent</div>
    <div class="a-board__bar"><span style="--w:48%"></span></div>
  </div>
  <div class="a-board__card">
    <div class="a-board__k">Monthly spend</div>
    <div class="a-board__v">$118</div>
    <div class="a-board__d">inside a $300 budget</div>
    <div class="a-board__bar"><span style="--w:39%"></span></div>
  </div>
</div>

### A capacity formula

```text
monthly_cost ≈ runs_per_day × n_cases × (1 - code_catch) × (1 - cache_hit)
                × [cheap_price × (1 - escalate) + strong_price × escalate]
                × 30
```

Plug in: `3 × 30,000 × 0.25 × 0.52 × (0.0004 × 0.93 + 0.004 × 0.07) × 30 ≈ $130`

**Do this arithmetic before deciding you cannot afford the full run.** Most teams discover the full run was always affordable, and they were just afraid to compute it.

::: danger Four rules for large-scale evaluation
1. **No runs longer than an hour without resume.**
2. **No CI-triggered runs without a budget breaker.**
3. **No 30,000-case runs all sent to the strong judge.**
4. **No reusing historical verdicts without a versioned cache key.**
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://www.braintrust.dev/docs/evaluation-quickstart" target="_blank" rel="noreferrer">Braintrust · Cost tracking</a>
  <a href="https://mlflow.org/docs/latest/genai/eval-monitor/scorers/" target="_blank" rel="noreferrer">MLflow · Scorer cost</a>
</div>

---

The last chapter closes the book: **evaluation is not a tool, it is the quality bus of the whole agent ecosystem.**
