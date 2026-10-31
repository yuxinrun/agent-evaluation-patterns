---
title: 02 · Metrics and dashboards
description: Outcome, trajectory, cost and experience metrics with definitions and formulas, dashboard design, and how to set SLO release gates.
outline: [2, 3]
---

# 02 · Metrics and dashboards

There is a brutal truth about metrics: **you get exactly what you measure.**

Measure answer length and the team writes longer answers. Measure satisfaction and the team learns flattery. A badly designed metric is worse than none, because it makes you feel scientific while you optimise the wrong thing.

This chapter splits metrics into four layers. For each: definition, formula, healthy range, and how the metric gets gamed.

## 01 Outcome metrics {#outcome}

Outcome metrics answer one question: **did the task get done, and done right?**

<Diagram id="metric-tiers" />

### Five you should always have

| Metric | Definition | Formula | Healthy range (reference) |
| --- | --- | --- | --- |
| Task success rate | Share of cases where the goal was met | passed / total | > 85% |
| Refusal rate | Share of valid requests wrongly refused | false refusals / valid requests | < 5% |
| Hallucination rate | Share of outputs with unsupported facts | cases with invented claims / total | < 2% |
| Factual fidelity | Share of key facts consistent with sources | consistent facts / extracted facts | > 97% |
| Compliance pass rate | Share meeting hard rules (disclaimers, privacy, scripts) | passed checks / checks | 100% (red line) |

### Why refusal rate deserves its own metric

Because **success and refusal sit on a seesaw**. Make the prompt braver and success rises with hallucination. Add “say you don't know” and hallucination falls as false refusals rise.

Watch one and the team will break the other. That is exactly what happened in story three of chapter 00: refusals fell from 18% to 1% while fabrication rose from 3% to 21%.

::: warning Three traps in outcome metrics
1. **Letting the final answer stand in for the whole process**: right answer, ten wrong tool calls, terrible experience.
2. **Counting only successful samples**: timeouts, errors and aborted sessions dropped from the denominator make numbers look great.
3. **Fuzzy definitions**: did “done” mean the user said so or the agent said so? Pin it down inside the dataset.
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents" target="_blank" rel="noreferrer">Anthropic · Demystifying evals for AI agents</a>
  <a href="https://deepeval.com/docs/metrics-introduction" target="_blank" rel="noreferrer">DeepEval · Metrics introduction</a>
</div>

## 02 Trajectory metrics {#trajectory}

If outcome metrics are the exam score, trajectory metrics are the working. Most agent incidents hide in the working.

<Diagram id="kpi-board" />

### Six process metrics

| Metric | Definition | How to compute | Alarm signal |
| --- | --- | --- | --- |
| Tool correctness | Did it call the tool it should have | traces hitting expected tool / total | < 90% means bad tool docs or planning |
| Redundant tool calls | Repeated or useless calls in one task | useless calls / trace | mean > 1 deserves a look |
| Plan reasonableness | Does the step order make sense | code rules plus judge | “write before read” style orders |
| Detour rate | Visible backtracking, retries, giving up | traces with backtracking / total | > 15% means context or tool returns are bad |
| Mean turns | Steps needed per task | total steps / traces | A sudden rise is regression |
| Loop rate | Share stuck in repetition | traces tripping loop detection / total | Any non-zero is worth reading |

### Pin down “detour” in code, not in vibes

```python
def count_detour(trace) -> int:
    """Detour count: repeated tool with similar args, revisits, tool-free output runs."""
    detours = 0
    seen_calls = []
    for run in trace.runs:
        if run.kind != "tool":
            continue
        key = (run.tool, json.dumps(run.args, sort_keys=True)[:120])
        if key in seen_calls:
            detours += 1          # exact repeat
        elif any(r.tool == run.tool and similar(r.args, a) for r, a in seen_calls):
            detours += 1          # near repeat
        seen_calls.append((run, run.args))
    return detours
```

The critical design choice: **grading logic must be reproducible**. Same trace today, same count next month. Anything that asks a model “do you think it took a detour” destroys the metric's trend value.

::: tip Translation for humans
Outcome tells you **whether you arrived**; trajectory tells you **whether you drove half the city first**. Ride-hailing apps show both. Your evals should too.
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://docs.langchain.com/langsmith/trajectory-evals" target="_blank" rel="noreferrer">LangSmith · Trajectory evaluations</a>
  <a href="https://developers.openai.com/api/docs/guides/agent-evals" target="_blank" rel="noreferrer">OpenAI · Agent evals</a>
</div>

## 03 Cost and efficiency {#cost}

Agents bill per step. A trace with fifteen model calls and eight tool calls costs roughly twenty times a single-turn Q&A.

| Metric | Definition | Why it matters |
| --- | --- | --- |
| Mean turns | Model plus tool steps per trace | Drives both cost and latency |
| Token usage | Input, output and cache hits separately | Low cache hit rate means bad prompt structure |
| TTFT | Time to first token | The first impression |
| P95 latency | 95th percentile end to end | Averages lie; the tail generates complaints |
| Retries | Retries from timeouts, rate limits, bad format | High retries = instability plus double cost |
| Cost per task | Model plus tool spend per trace | Decides whether the business model works |

### A real cost breakdown

```text
One session (4.2 turns average):
  planner calls   4 × 1.8k in + 0.3k out   ≈ $0.021
  tool calls      3.1 × (1.2k returned avg) ≈ $0.004
  judge (5% sample) 0.05 × $0.008           ≈ $0.0004
  ───────────────────────────────────────────────────────
  total ≈ $0.025 / session    100k sessions/month ≈ $2,500
```

The table makes one thing obvious: **cutting turns saves far more than trimming prompt words**. Going from 4.2 to 3.5 turns cuts cost 17% and pulls P95 down with it.

::: warning The most common cost mistake
Using “cost per thousand calls” as the only number. Some optimisations raise per-call cost while greatly improving success, so **total cost per completed task falls** (users stop asking three times). Always track cost per successful task, never per call.
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://docs.langchain.com/langsmith/evaluation-approaches" target="_blank" rel="noreferrer">LangSmith · Evaluation approaches</a>
  <a href="https://langfuse.com/docs/evaluation/overview" target="_blank" rel="noreferrer">Langfuse · Evaluation overview</a>
</div>

## 04 Experience metrics {#experience}

The first three layers are what machines say. This layer is what humans do. It is the most expensive, the slowest, and the closest to the truth.

| Metric | Definition | How to collect | Healthy range |
| --- | --- | --- | --- |
| Manual correction rate | User edits the agent's output | Front-end events (edit, rewrite) | < 12% |
| Negative feedback rate | Thumbs down or explicit “wrong” | Feedback widget, intent detection | < 6% |
| Abandonment rate | Session exits before completion | Session events | < 10% |
| Repeat-question rate | Same intent asked again soon | Intent clustering | < 8% |
| Escalation rate | Handed to a human | Ticket or transfer events | Business dependent |

### A counter-intuitive finding

Manual correction rate is usually more trustworthy than a satisfaction score. The reason is simple: **rating is a cheap statement, editing is labour spent as a vote.**

A thumbs-up may just mean the user could not be bothered to do anything else. A user rewriting your answer end to end is real dissatisfaction.

```python
# Weighted experience score: the more effort a signal costs, the heavier it is
SIGNAL_WEIGHTS = {
    "explicit_edit": 3.0,      # user edited the content
    "regenerate":    2.0,      # asked for another take
    "thumbs_down":   1.5,      # negative feedback
    "abandon":       2.0,      # left mid-task
    "thumbs_up":    -1.0,      # weak positive
}

def experience_score(events: list[dict]) -> float:
    """Return -1..1, negative meaning net negative."""
    total = sum(SIGNAL_WEIGHTS.get(e["type"], 0) for e in events)
    return round(max(-1.0, min(1.0, -total / 10)), 3)
```

::: tip Translation for humans
“4.6 satisfaction” is the “please leave five stars” sign at the restaurant door — people who got a free dessert rate it high.
“This dish came back three times” is what the kitchen should actually watch.
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://langfuse.com/docs/evaluation/overview" target="_blank" rel="noreferrer">Langfuse · Evaluation overview</a>
  <a href="https://www.infoq.cn/topic/AI" target="_blank" rel="noreferrer">InfoQ · production eval post-mortems</a>
</div>

## 05 Dashboard design {#dashboard}

Too many metrics become noise. A dashboard is not “show everything”; it is **letting one person know within thirty seconds whether to worry**.

<Diagram id="slo-gate" />

### Three-layer structure

| Layer | What is shown | Refresh | Audience |
| --- | --- | --- | --- |
| L1 Overview | Four to six north-star metrics with red/amber/green | Daily | Leadership, product, on-call |
| L2 Failure breakdown | Failures clustered by type, scenario, tool | After every run | Developers |
| L3 Version diff | Per-metric delta with significance | Every release | Owners |

### The L1 board

<div class="a-board">
  <div class="a-board__card">
    <div class="a-board__k">Task success</div>
    <div class="a-board__v">92.1<small>%</small></div>
    <div class="a-board__d is-good">▲ 1.8pt vs baseline</div>
    <div class="a-board__bar"><span style="--w: 92%"></span></div>
  </div>
  <div class="a-board__card">
    <div class="a-board__k">Hallucination</div>
    <div class="a-board__v">1.4<small>%</small></div>
    <div class="a-board__d is-good">▼ 0.6pt</div>
    <div class="a-board__bar"><span style="--w: 14%"></span></div>
  </div>
  <div class="a-board__card">
    <div class="a-board__k">Tool correctness</div>
    <div class="a-board__v">88.7<small>%</small></div>
    <div class="a-board__d is-bad">▼ 4.2pt watch</div>
    <div class="a-board__bar is-bad"><span style="--w: 89%"></span></div>
  </div>
  <div class="a-board__card">
    <div class="a-board__k">P95 latency</div>
    <div class="a-board__v">9.8<small>s</small></div>
    <div class="a-board__d">± 0.3s</div>
    <div class="a-board__bar"><span style="--w: 65%"></span></div>
  </div>
  <div class="a-board__card">
    <div class="a-board__k">Cost / task</div>
    <div class="a-board__v">$0.025</div>
    <div class="a-board__d is-good">▼ 0.003</div>
    <div class="a-board__bar"><span style="--w: 40%"></span></div>
  </div>
  <div class="a-board__card">
    <div class="a-board__k">Correction rate</div>
    <div class="a-board__v">9.1<small>%</small></div>
    <div class="a-board__d">flat</div>
    <div class="a-board__bar"><span style="--w: 30%"></span></div>
  </div>
</div>

<p class="a-note">Sample data; <code>is-good</code> / <code>is-bad</code> only affect colour. Red does not block — the SLO gates block.</p>

### Reading the L2 breakdown

Do not list failing cases — there are three thousand and nobody reads them. Aggregate:

| Failure type | Count | Share | Where it clusters | Recent trend |
| --- | --- | --- | --- | --- |
| Tool arg errors | 41 | 46% | `search_orders` missing `date_from` | new in this version |
| Hallucinated policy timing | 18 | 20% | refund questions | flat |
| Lost context after turn 3 | 14 | 16% | multi-turn | worse by 5pt |
| Timeout aborts | 9 | 10% | long context | flat |
| Failed to refuse | 7 | 8% | over-privileged requests | improving |

The table tells you what to fix first. Forty-one tool-arg errors can often be solved by fixing one schema and one example — the best return available.

::: tip Translation for humans
A dashboard should be the **summary page of a health report**: “blood pressure high, everything else normal”, not sixty raw numbers shoved at you.
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://arize.com/docs/phoenix" target="_blank" rel="noreferrer">Arize Phoenix · Evals and dashboards</a>
  <a href="https://www.braintrust.dev/docs/evaluation-quickstart" target="_blank" rel="noreferrer">Braintrust · Experiment comparison</a>
</div>

## 06 SLO release gates {#slo}

Everything above observes. The gate enforces. Its only job: **stop a bad version before it reaches users**.

### Three kinds of red line

| Type | Example | Action |
| --- | --- | --- |
| **Hard red line** (never crossed) | PII leaks > 0, unauthorised writes > 0 | Block immediately, human review |
| **Soft red line** (regression vs baseline) | Success 2pt below baseline | Block, require an explanation |
| **Observation line** (trend anomaly) | Mean turns up 20% | Alert, do not block |

### A gate config you can copy

```yaml
# eval-gate.yml
version: 1
baseline: "main@last-green"

gates:
  - id: task_success
    metric: outcome.task_success_rate
    rule: absolute
    min: 0.85
    severity: block

  - id: task_success_regression
    metric: outcome.task_success_rate
    rule: delta_vs_baseline
    max_drop: 0.02          # 2pt of noise tolerated, beyond that blocks
    severity: block

  - id: hallucination
    metric: outcome.hallucination_rate
    rule: absolute
    max: 0.02
    severity: block

  - id: pii_leak
    metric: safety.pii_leak_count
    rule: absolute
    max: 0
    severity: block

  - id: tool_correct
    metric: trajectory.tool_correct_rate
    rule: absolute
    min: 0.90
    severity: warn

  - id: avg_turns
    metric: cost.avg_turns
    rule: delta_vs_baseline
    max_drop: -0.20         # warn on a 20% increase
    severity: warn
```

### Three design rules

**Rule one: few red lines.** Teams that start with fifteen demote all of them to warnings within two weeks. **Three to five** is the sustainable ceiling.

**Rule two: separate absolute thresholds from baseline deltas.** Absolute protects the floor, delta protects against regression. You need both, for different reasons.

**Rule three: a block must carry evidence.** The failure report has to include the failing case IDs, trace links, judge rationale and the baseline diff. Otherwise the first reaction is “just re-run it”.

```python
def check_gates(result: dict, baseline: dict, gates: list[dict]) -> tuple[bool, list[dict]]:
    failures = []
    for gate in gates:
        value = dig(result, gate["metric"])
        if gate["rule"] == "absolute":
            ok = (value >= gate.get("min", -1e9)) and (value <= gate.get("max", 1e9))
        else:  # delta_vs_baseline
            base = dig(baseline, gate["metric"])
            drop = base - value
            ok = drop <= gate.get("max_drop", 0)
        if not ok:
            failures.append({"gate": gate["id"], "value": value, "severity": gate["severity"]})

    blocked = any(f["severity"] == "block" for f in failures)
    return (not blocked), failures
```

::: warning The two ways gates die
1. **Threshold guessed**: week one sets an impossible bar, it goes red for three days, someone flips it to `warn`, and it never goes red again.
2. **Block with no evidence**: “success rate too low” with no failing case shown, so developers re-run until green.
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://promptfoo.dev/docs/integrations/github-action/" target="_blank" rel="noreferrer">Promptfoo · GitHub Action</a>
  <a href="https://docs.langchain.com/langsmith/evaluation-approaches" target="_blank" rel="noreferrer">LangSmith · Evaluation approaches</a>
</div>

---

Next chapter covers the most skipped piece, and the one that decides whether the whole system lives: building the dataset.
