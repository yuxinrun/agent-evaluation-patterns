---
title: 13 · The production pitfall catalog
description: Eval sets that miss the real distribution, judge-only grading, output-only scoring, missing baselines, throttled runs, runaway cost, unrolled side effects — seven incidents and their fixes.
outline: [2, 3]
---

# 13 · The production pitfall catalog

The previous twelve chapters covered what to build. This one covers **how other people already crashed**.

These seven share a trait: **none of them is a hard technical problem, they are all blind spots.** Each comes with symptom → root cause → fix, so you can read this as a health check.

<Diagram id="pitfall-map" />

## 01 The eval set does not match reality {#distribution}

### Symptom

```text
Offline pass rate 99.2%
Two weeks in production, 40+ complaints
You sample 20 complaints: 19 have no similar case in your dataset
```

### Root cause

The dataset is "user questions as imagined by engineers". Real users have three traits engineers do not imagine:

| Reality | Your dataset |
| --- | --- |
| Very short, messy, typo-ridden input | One tidy grammatical sentence |
| Requirements change across turns | One question, one answer |
| Emotion, and baggage from earlier failures | Neutral, objective phrasing |

### Fix

```text
1. More than 50% of the dataset must come from real traces (chapters 08, 12)
2. Monthly check: input length distribution, dataset versus production
3. Track an "uncovered rate": prod issues with no similar sample in the dataset
```

A check you can run right now:

```python
def coverage_gap(prod_lengths: list[int], dataset_lengths: list[int]) -> dict:
    """Quantiles of input length in prod versus in the dataset; a wide gap means drift."""
    import statistics
    p = lambda xs, q: statistics.quantiles(xs, n=100)[q - 1]
    return {
        "prod_p10_p90": (p(prod_lengths, 10), p(prod_lengths, 90)),
        "data_p10_p90": (p(dataset_lengths, 10), p(dataset_lengths, 90)),
        "verdict": "gap" if p(prod_lengths, 10) * 3 < p(dataset_lengths, 10) else "ok",
    }
```

::: warning The sneakiest form of drift
Every dataset case is "**clear in one shot**". Real users often need three turns to explain what they want.
**If your dataset has no multi-turn cases, your multi-turn behaviour is effectively untested.**
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents" target="_blank" rel="noreferrer">Anthropic · Demystifying evals for AI agents</a>
  <a href="https://langfuse.com/docs/evaluation/overview" target="_blank" rel="noreferrer">Langfuse · Production data to datasets</a>
</div>

## 02 Judge-only grading {#judge-only}

### Symptom

```text
The judge reports 8.7 out of 10 on average
You spot-check 30 cases: 5 with wrong order ids, 3 calling nonexistent tools, 2 inventing policy
The scores assigned to those bad answers: 8.5, 8.8, 8.6
```

### Root cause

A judge is "**semantic similarity, deluxe edition**", not a fact checker. It has almost no resistance to structurally plausible nonsense.

<Diagram id="score-illusion" />

### Fix: hard rules always run first

```python
def hard_checks(trace: dict, case: dict) -> list[dict]:
    """Zero cost, zero hallucination. There is no excuse to skip these."""
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

### One hard rule beats a hundred judge calls

| Check | Judge | Code |
| --- | --- | --- |
| Numbers match | often wrong | exact |
| Order id exists | cannot verify | exact |
| Tool privilege respected | frequently missed | exact |
| Tone is appropriate | ✅ strong | impossible |
| Policy clause invented | mediocre | exact with an allow-list |

**Conclusion: everything quantifiable goes to code. Only "appropriate / reasonable / natural" belongs to the judge.**

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://www.promptfoo.dev/docs/guides/llm-as-a-judge/" target="_blank" rel="noreferrer">Promptfoo · LLM-as-a-judge guide</a>
  <a href="https://mlflow.org/docs/latest/genai/eval-monitor/scorers/" target="_blank" rel="noreferrer">MLflow · Scorers</a>
</div>

## 03 Output-only scoring {#output-only}

### Symptom

```text
The final answer is perfectly correct
The process: 11 tool calls (3 expected), 4 of them the same query repeated
Cost up 3.2×, P95 from 6s to 19s
```

### Root cause

This is **plain-LLM thinking** carried over: you have an input and an output, so compare them.

An agent's value and risk live in the process: tool choice, arguments, order, detours, duplicates.

### Fix: grade all three layers

```text
Layer 1 Outcome   Is the final answer right (plain LLM evals can do this)
Layer 2 Trace     Is the tool sequence sane, redundant, wandering (agent-only)
Layer 3 State     Are side effects correct, is data consistent (mandatory for write agents)
```

Metrics from chapters 02 and 05 apply directly:

| Metric | Trap it catches |
| --- | --- |
| Tool correctness | Wrong tool chosen |
| Redundant call count | Duplicate queries, spinning in place |
| Plan quality | Taking a detour nobody asked for |
| Side-effect check | Modifying data it should not |

::: danger A real incident
A refund agent's final answer was correct 100% of the time: "your refund has been processed".
But it **called the refund API twice**; the second call failed and opened a human ticket, generating 400 junk tickets in a day.
Judged only on the final answer, this agent looks flawless.
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://docs.langchain.com/langsmith/trajectory-evals" target="_blank" rel="noreferrer">LangSmith · Trajectory evals</a>
  <a href="https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents" target="_blank" rel="noreferrer">Anthropic · Demystifying evals</a>
</div>

## 04 No baseline, no direction {#no-baseline}

### Symptom

```text
"This version feels much better!"
"Better how?"
"It just… reads more naturally?"
(two weeks later) "Does it feel worse now?"
```

### Root cause

Without a baseline you cannot answer the three most basic questions:

```text
1. Is it better or worse than last week?
2. How much did this change move?
3. Which version introduced the regression?
```

<Diagram id="pitfall-map" />

### Fix: a baseline is a file, not a memory

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

Three rules:

```text
1. Store per-case verdicts, not just aggregates (diff needs them)
2. Only update the baseline when the full regression passes
3. Keep the last two baselines (to locate when a regression started)
```

### A diff you can use today

```python
def diff_against_baseline(run: dict, baseline: dict) -> dict:
    """Case-level diff: what flipped to fail, what flipped to pass."""
    cur, base = run["cases"], baseline["cases"]
    newly_failing = [k for k, v in cur.items() if v == "FAIL" and base.get(k) == "PASS"]
    newly_passing = [k for k, v in cur.items() if v == "PASS" and base.get(k) == "FAIL"]
    return {
        "regressions": newly_failing,
        "fixes": newly_passing,
        "block": len(newly_failing) > 0 and not run.get("allow_regressions"),
    }
```

**That `regressions` list is the single most useful thing to paste into a pull request.**

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://docs.langchain.com/langsmith/evaluation-approaches" target="_blank" rel="noreferrer">LangSmith · Baselines</a>
  <a href="https://www.braintrust.dev/docs/evaluation-quickstart" target="_blank" rel="noreferrer">Braintrust · Experiment comparison</a>
</div>

## 05 Throttled runs, skewed numbers {#throttle}

### Symptom

```text
The eval script runs at 200 concurrency
Result: 18% error rate, pass rate 12pt below usual
You conclude the model regressed. Actually you DDoSed your own API.
```

### Root cause

Heavy concurrency distorts results in four ways:

| Distortion | Symptom |
| --- | --- |
| 429 throttling | Requests rejected, recorded as "model failure" |
| Timeouts | Long answers truncated, graded "incomplete" |
| Degraded routing | The gateway silently falls back to a small model you never meant to test |
| Context chaos | Some providers genuinely return worse output at high concurrency |

### Fix: separate "failed" from "throttled"

```python
import asyncio, random

async def call_with_backoff(fn, *args, max_retries: int = 6, **kwargs):
    """Exponential backoff with jitter; distinguish retryable from real failure."""
    for attempt in range(max_retries):
        try:
            return await fn(*args, **kwargs)
        except RateLimitError as e:
            wait = min(2 ** attempt + random.random(), 30)
            await asyncio.sleep(wait)
        except TransientError:
            await asyncio.sleep(1 + random.random())
    raise EvalInfraError("retries exhausted")   # never record this as a wrong answer
```

### The key move: exclude throttled samples from statistics

```python
def usable(results: list[dict]) -> list[dict]:
    """Only count samples that actually completed and were scored."""
    return [r for r in results if r["status"] == "scored"]

# pass rate = passes / usable samples, not passes / total requests
success_rate = sum(r["pass"] for r in usable(results)) / max(len(usable(results)), 1)
```

::: warning An extremely common mistake
Recording a throttle failure as "the model answered wrong", then concluding "the new version regressed".
**After every run, the first thing to check is how many samples failed for infrastructure reasons. Above 1%, distrust the whole run.**
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://www.promptfoo.dev/docs/configuration/expected-outputs/model-graded/llm-rubric/" target="_blank" rel="noreferrer">Promptfoo · Concurrency and retries</a>
  <a href="https://docs.langchain.com/langsmith/evaluation-approaches" target="_blank" rel="noreferrer">LangSmith · Rate limits</a>
</div>

## 06 Runaway eval cost {#cost}

### Symptom

```text
Month one: $42 of eval spend
Month three: $1,180
Finance asks: what business is "eval"?
```

### Root cause

Cost explosions come from four kinds of unconscious repetition:

| Behaviour | Cost multiplier |
| --- | --- |
| Running the full set on every commit (no smoke tier) | ×20 |
| Three judge votes per sample, always | ×3 |
| Sending code-checkable cases to a judge | ×2.5 |
| Re-evaluating identical inputs (no cache) | ×1.5-4 |

Multiply them and you get **tens of times**.

### Fix: four valves

```text
Valve 1  Tiered runs    smoke 30 on commit, regression 300 on merge, full on release
Valve 2  Code first     no judge call once hard checks pass
Valve 3  Cache          reuse by (input_hash, grader_version)
Valve 4  Budget fuse    stop and alert once a run exceeds its cap
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

### A cost board

<div class="a-board">
  <div class="a-board__card">
    <div class="a-board__k">Smoke run</div>
    <div class="a-board__v">$0.04</div>
    <div class="a-board__d is-good">▼ affordable on every commit</div>
    <div class="a-board__bar"><span style="--w:12%"></span></div>
  </div>
  <div class="a-board__card">
    <div class="a-board__k">Regression run</div>
    <div class="a-board__v">$0.38</div>
    <div class="a-board__d">once a day</div>
    <div class="a-board__bar"><span style="--w:34%"></span></div>
  </div>
  <div class="a-board__card">
    <div class="a-board__k">Full plus dual judges</div>
    <div class="a-board__v">$2.60</div>
    <div class="a-board__d is-bad">▲ pre-release only</div>
    <div class="a-board__bar is-bad"><span style="--w:86%"></span></div>
  </div>
  <div class="a-board__card">
    <div class="a-board__k">Cache hit rate</div>
    <div class="a-board__v">61<small>%</small></div>
    <div class="a-board__d is-good">▲ money not spent</div>
    <div class="a-board__bar"><span style="--w:61%"></span></div>
  </div>
</div>

::: tip Translation for humans
An eval budget is **a taxi habit**. Taking a cab to work every day is expensive; taking a cab on the morning of the big presentation is nothing.
**The goal is not to spend less, it is to spend it at the moment things go wrong.**
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://www.braintrust.dev/docs/evaluation-quickstart" target="_blank" rel="noreferrer">Braintrust · Cost tracking</a>
  <a href="https://langfuse.com/docs/evaluation/overview" target="_blank" rel="noreferrer">Langfuse · Cost and usage</a>
</div>

## 07 Unrolled side effects {#sideeffect}

### Symptom

```text
The eval finished
The test database now holds 1,842 refunded orders
The support system sent 37 real "refund successful" notifications
```

### Root cause

For write-capable agents, **the act of evaluating is a side effect.** Most teams design it as if it were read-only.

| Side effect | Consequence |
| --- | --- |
| Database writes | Dirty data, polluted metrics |
| Messages and emails | Real users disturbed (an incident) |
| External API calls | Real charges, real orders |
| Ticket creation | Support workload explodes |

### Fix: three layers of defence

<Diagram id="side-effect" />

```text
Layer 1  Environment isolation  eval env fully separate (DB, queues, third-party keys)
Layer 2  Tool sandbox           write tools mocked: record only, never execute
Layer 3  State snapshots        when execution is unavoidable: snapshot, diff, force rollback
```

### A minimal sandbox

```python
class ToolSandbox:
    """Eval-only: write tools record, never execute."""
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

### The state assertion you actually need

```python
def assert_state_unchanged(before: dict, after: dict) -> dict:
    """Apart from allow-listed fields, nothing may change."""
    changed = {k for k in before if before[k] != after.get(k)}
    allowed = {"updated_at"}
    unexpected = changed - allowed
    return {"name": "state_unchanged", "pass": not unexpected, "note": f"changed={sorted(unexpected)}"}
```

::: danger One rule that belongs in your SOP
**The eval environment must never point at the production database, the production queue, or the production payment channel.**
If you cannot isolate, you must mock. No exceptions.
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://www.anthropic.com/engineering/writing-tools-for-agents" target="_blank" rel="noreferrer">Anthropic · Writing effective tools for agents</a>
  <a href="https://genai.owasp.org/llm-top-10/" target="_blank" rel="noreferrer">OWASP · Excessive agency</a>
</div>

## Appendix: the seven-point self-audit {#checklist}

Score your current setup against this table. **Any "no" is the next thing to fix.**

| # | Check | Yes / No |
| --- | --- | --- |
| 1 | More than 50% of the dataset comes from real traces | ☐ |
| 2 | Every case has at least one hard code check | ☐ |
| 3 | Tool call sequences are recorded, not just final answers | ☐ |
| 4 | There is a diffable baseline file | ☐ |
| 5 | Runs distinguish "throttled" from "answered wrong" | ☐ |
| 6 | There are smoke / regression / full execution tiers | ☐ |
| 7 | Write tools are mocked or rolled back in the eval environment | ☐ |

Seven out of seven means you are ahead of most teams. Four to six is passing but brittle. **Three or fewer, and your scores should not be used to make decisions.**

---

Next chapter stops philosophising and ships code: seven demos you can copy, paste, and run.
