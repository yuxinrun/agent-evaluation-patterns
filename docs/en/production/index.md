---
title: 12 · Online evaluation in production
description: Shadow sampling architecture, automatic failure capture, alerting with evidence, the find-fix-regress loop, and a reference architecture for online evals.
outline: [2, 3]
---

# 12 · Online evaluation in production

Offline evaluation has one limitation you cannot design around: **you test the scenarios you thought of.**

Real users ask questions you could not invent on your best day. That is why an agent scoring 99 offline still gets flattened by one odd dialect question in production.

Online evaluation closes that gap: **test the real version with real traffic, without slowing the product down.**

## 01 Online sampling {#sampling}

<Diagram id="online-eval" />

### Core design: a bypass, never the main path

```text
User request
  └─ Main path (synchronous, must be fast) → answer the user
       └─ Bypass enqueue (asynchronous, can be late) → queue
            └─ Eval worker (consumes at the sample rate)
                 └─ Results → dashboards / alerts / datasets
```

Three iron laws:

| Law | Reason |
| --- | --- |
| **The main path never waits for evaluation** | Sync it once, and eval latency plus eval outages become product outages |
| **Eval failure never affects the product** | A dead worker should be invisible to users |
| **The sample rate is adjustable at runtime** | During an incident you need 2% → 20% in one click |

### Choosing the sample rate

```text
Routine monitoring     1% - 5%     enough for trends, cheap
New version canary     10% - 20%   need faster detection
Incident investigation 50% - 100%  temporarily, drop back after hours
High-value sessions    100%       money or compliance involved: evaluate all
```

A rough cost formula:

```python
def monthly_judge_cost(qps: float, sample_rate: float, cost_per_eval: float) -> float:
    """Rough monthly cost of online judge calls."""
    per_month = qps * 0.3 * 0.7 * 3_600 * 24 * 30   # assume traffic 30% of the time at 70% of peak
    return round(per_month * sample_rate * cost_per_eval, 2)

# 20 QPS, 2% sampling, $0.0004 per eval
print(monthly_judge_cost(20, 0.02, 0.0004))   # ≈ 9.1 USD/month
```

**Online evaluation is not expensive.** What is expensive is judging samples that never needed a judge.

### A minimal worker

```python
import asyncio, json

async def eval_worker(queue, judge, repo, sem: asyncio.Semaphore):
    while True:
        trace = await queue.get()
        async with sem:                       # global throttle protects the judge API
            try:
                checks = run_code_checks(trace)          # free checks first
                if all(c["pass"] for c in checks):
                    verdict = {"verdict": "PASS", "source": "code", "checks": checks}
                else:
                    verdict = await judge(trace)         # call the judge only on doubt
                await repo.save_eval(trace["trace_id"], verdict)
            except Exception as e:
                await repo.save_eval_error(trace["trace_id"], str(e))
            finally:
                queue.task_done()
```

Note the `if all(c["pass"])` branch: **when code checks pass, the judge is never called.** That usually removes 60%-80% of judge calls.

::: tip Translation for humans
Online evaluation is **a restaurant health inspection**. The inspector does not stand behind the chef (that slows the kitchen). The kitchen runs normally and **samples are taken away and tested afterwards** — and the results can still shut the place down.
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://langfuse.com/docs/evaluation/overview" target="_blank" rel="noreferrer">Langfuse · Online evaluation</a>
  <a href="https://docs.langchain.com/langsmith/evaluation-approaches" target="_blank" rel="noreferrer">LangSmith · Online evaluation</a>
</div>

## 02 Automatic failure capture {#capture}

The most valuable output of online evaluation is not the score. It is **the samples**.

<Diagram id="capture" />

### Five signals worth capturing

| Signal | Meaning | Priority |
| --- | --- | --- |
| `status = error` | Explicit failure | Highest |
| Negative feedback (thumbs down, re-ask) | Implicit dissatisfaction | Highest |
| Human escalation / complaint | Business-level failure | Highest |
| Turn count above P90 | Looping, flailing | High |
| Latency above 2× P95 | Performance or infinite loop | Medium |
| Random healthy sample | Keeps the dataset from turning pessimistic | Fixed 2% |

### Four steps from capture to dataset

```text
1. Capture   watch signals, enqueue the trace_id
2. Hydrate   pull the full trace (all spans) from observability
3. Mask      replace PII, preserve structure and entity linkage
4. Label     attach the expected outcome — this one needs a human
```

Step four is the human bottleneck and the first thing teams skip. **A sample without an expectation is an anecdote, not a regression case.**

### Semi-automatic labelling

```python
def draft_expectation(trace: dict, fix_reference: dict | None) -> dict:
    """Hand the labeller a draft instead of a blank page."""
    return {
        "input": trace["input"],
        "actual": trace["output"],
        "expected_tools": [s["tool.name"] for s in trace["spans"] if s["kind"] == "tool"],
        "suspected_issue": classify_issue(trace),      # rule or judge pre-classification
        "candidate_expectation": fix_reference or "",  # correct output from the fixed build
        "needs_human": True,
    }
```

**Using the post-fix output as the expectation** is the cheapest trick available: fix the bug, run the verification script, and its output becomes the ground truth.

### Capture SLAs

```text
Production failure → labelling queue      ≤ 48 hours
Queued → labelled and in the regression set ≤ 2 weeks
Unlabelled for 2 weeks → reminder, then cleanup (or the queue rots)
```

::: warning A counter-intuitive truth
**The bottleneck in failure capture is process, not technology.** Most teams have the pipeline working on day one, and then the labelling queue sits at 800 unread items.
The fix is not a better pipeline. It is **a standing one-hour weekly labelling meeting**.
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://langfuse.com/docs/evaluation/overview" target="_blank" rel="noreferrer">Langfuse · Trace to dataset</a>
  <a href="https://www.infoq.cn/topic/AI" target="_blank" rel="noreferrer">InfoQ · Agent evaluation in production</a>
</div>

## 03 Alerting {#alert}

The most common way online evaluation dies: metrics degraded and nobody noticed.

### Three alert tiers

| Tier | Trigger | Channel | Response |
| --- | --- | --- | --- |
| **P0 red line** | Safety metric breach, error rate > 5% | Phone / channel at-all | Within 15 minutes |
| **P1 degradation** | Success -3pt vs baseline, P95 +30% | Channel message plus ticket | Same business day |
| **P2 trend** | Slow decline over 3 days | Weekly report | Next iteration |

### An alert must carry evidence

An alert without evidence is a message saying "something broke, go dig". So the payload must include:

```python
def build_alert(report: dict) -> dict:
    return {
        "title": f"[P1] task success degraded {report['delta']:+.1f}pt",
        "window": "last 6 hours vs the previous 24-hour baseline",
        "metrics": {
            "success_rate": {"now": report["now"], "baseline": report["baseline"]},
            "p95_latency_ms": report["p95"],
        },
        "evidence": {
            "failing_cases": report["failing_case_ids"][:10],
            "trace_links": report["trace_urls"][:10],        # one click to the scene
            "judge_comments": report["top_reasons"][:5],     # clustered failure reasons
        },
        "suspected_scope": report.get("affected_slices", []),  # which slices are hit
        "runbook": "https://your-wiki/eval-alerts#success-rate",
    }
```

**`trace_links` is the soul of it.** The first thing a responder wants is the scene. If they have to search for the trace_id themselves, the alert gets ignored.

### Degradation detection must resist noise

```python
def is_degraded(now: float, baseline: float, n_now: int, n_base: int,
                min_delta: float = 0.03, z: float = 2.0) -> dict:
    """Require both magnitude and significance so noise is not an incident."""
    delta = now - baseline
    se = ((now * (1 - now) / n_now) + (baseline * (1 - baseline) / n_base)) ** 0.5
    z_score = delta / se if se else 0.0
    return {
        "delta": round(delta, 4),
        "z": round(z_score, 2),
        "alert": delta < -min_delta and z_score < -z,
    }
```

Fire only when both hold: **it fell far enough and it is not noise.** Drop either condition and you either get paged daily or you miss the real incident.

::: tip Translation for humans
Alert design is **a health check report**. "You are somewhat unhealthy" is worthless. A useful report says "LDL is up 0.8, here is the reference range, here is last week's value, here is which clinic to book".
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://arize.com/docs/phoenix" target="_blank" rel="noreferrer">Arize Phoenix · Monitoring and alerts</a>
  <a href="https://yuxinrun.github.io/agent-observability-patterns/" target="_blank" rel="noreferrer">agent-observability-patterns · Alerting</a>
</div>

## 04 The closed loop {#closedloop}

<Diagram id="closed-loop" />

### Five links in the chain

```text
Detect (production signal)
  → Attribute (trace + judge comments, find the broken layer)
    → Fix (prompt / tool / retrieval)
      → Verify (that case plus the full regression set)
        → Persist (case into the dataset, metrics into the baseline)
          → back to Detect
```

The chain breaks most often **between fix and verify**: the bug is patched, but nobody adds a regression case for it.

### The incident tracking table

| Field | Purpose |
| --- | --- |
| `incident_id` | Unique id through the whole flow |
| `first_seen_at` | When it started (how long it hid) |
| `root_cause_layer` | Model / prompt / tool / retrieval / memory / gateway |
| `fix_pr` | The code or config change |
| `regression_case_id` | The case id added to the dataset |
| `verified_at` | When regression confirmed the fix |

```sql
-- Weekly check: incidents fixed but never turned into a regression case
SELECT incident_id, root_cause_layer, fix_pr
FROM incidents
WHERE fixed_at IS NOT NULL
  AND regression_case_id IS NULL
  AND fixed_at < now() - interval '14 days';
```

**This query should always return zero rows.** If it does not, your loop has a hole.

### The three "never" rules

```text
Never close an incident without a regression case   a fix without a case is not a fix
Never edit a prompt without attribution             you do not know the broken layer, so you are guessing
Never declare done without numbers                  before/after metrics or you do not know it improved
```

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://docs.langchain.com/langsmith/evaluation-approaches" target="_blank" rel="noreferrer">LangSmith · Evaluation lifecycle</a>
  <a href="https://langfuse.com/docs/evaluation/overview" target="_blank" rel="noreferrer">Langfuse · Evaluation loop</a>
</div>

## 05 A reference architecture {#infra}

Assemble the four previous sections and you get something you can build from.

### Component list

| Component | Responsibility | Common choice |
| --- | --- | --- |
| Signal collection | Collect trace_ids and business signals from the main path | OTel Collector / SDK hook |
| Queue | Buffer, decouple, retry | Kafka / Redis Stream / SQS |
| Eval worker | Run code checks and judges | Stateless containers, horizontal scale |
| Rate limiter | Protect the judge API | Token bucket plus global semaphore |
| Result store | Verdicts, evidence, metrics | Postgres plus object storage |
| Aggregation | Slice stats, deltas, trends | Time-series DB or scheduled rollups |
| Alerting | Threshold plus significance | Your existing alert platform |
| Dataset feedback | Captured sample → label → dataset | Dedicated service or a Git workflow |

### The capacity numbers that matter

<div class="a-board">
  <div class="a-board__card">
    <div class="a-board__k">Routine sample rate</div>
    <div class="a-board__v">2<small>%</small></div>
    <div class="a-board__d">visible trends, controlled cost</div>
    <div class="a-board__bar"><span style="--w:20%"></span></div>
  </div>
  <div class="a-board__card">
    <div class="a-board__k">Code-check catch rate</div>
    <div class="a-board__v">72<small>%</small></div>
    <div class="a-board__d is-good">▲ judge calls avoided</div>
    <div class="a-board__bar"><span style="--w:72%"></span></div>
  </div>
  <div class="a-board__card">
    <div class="a-board__k">Alert false positives</div>
    <div class="a-board__v">&lt;8<small>%</small></div>
    <div class="a-board__d">after significance checks</div>
    <div class="a-board__bar"><span style="--w:8%"></span></div>
  </div>
  <div class="a-board__card">
    <div class="a-board__k">Capture to label</div>
    <div class="a-board__v">14<small>days</small></div>
    <div class="a-board__d is-bad">▼ target is 7</div>
    <div class="a-board__bar is-bad"><span style="--w:70%"></span></div>
  </div>
</div>

### Three deployment traps

::: danger Three fatal online-eval deployment mistakes
1. **Sharing the product's database connection pool**: evaluation eats the pool and the product goes down first.
2. **No global concurrency cap**: during a canary ramp both traffic and eval volume double, and the judge API returns 429.
3. **No kill switch**: the judge vendor has an outage, workers retry forever, the queue explodes. There must be a one-click stop.
:::

### The minimum viable version

Do not build the whole diagram. Version one needs only:

```text
1. A sampler (errors + thumbs down + 2% random)
2. A worker (code checks plus a binary judge)
3. One table (trace_id, verdict, reason, created_at)
4. One daily rollup job (success rate versus yesterday)
5. One person (half an hour a week reading failing samples)
```

**Item five is the most important.** Without that person, items one to four are just noise you generate for yourself.

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://langfuse.com/docs/evaluation/overview" target="_blank" rel="noreferrer">Langfuse · Evaluation architecture</a>
  <a href="https://arize.com/docs/phoenix" target="_blank" rel="noreferrer">Arize Phoenix · Production monitoring</a>
</div>

---

Next chapter is the incident review room of this book: the seven most common production traps, dug up one by one so you can count how many you have stepped in.
