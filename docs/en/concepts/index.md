---
title: 01 · Core concepts of agent evaluation
description: Run / Trace / Thread as three evaluation objects, the four grader types, golden datasets, rubrics and evaluation cadence.
outline: [2, 3]
---

# 01 · Core concepts of agent evaluation

Before learning any tool, answer one question: **what exactly are you evaluating?**

Get that wrong and everything downstream drifts. The usual drift: taking a single-turn Q&A eval method and pointing it at an agent that calls eight tools over a dozen turns, then reporting a beautiful, meaningless score.

This chapter splits the framework into five parts: objects, graders, datasets, rubrics, cadence.

## 01 Run, Trace, Thread {#objects}

An analogy. A hospital check-up gives you three kinds of data:

- **A single test**: blood pressure 128/82.
- **A full check-up**: blood work, ultrasound, ECG — one complete pass.
- **A longitudinal record**: once a year for three years, showing the trend.

Agent evaluation has the same three levels:

<Diagram id="eval-objects" />

| Level | What it is | Hospital equivalent | Typical use | Granularity |
| --- | --- | --- | --- | --- |
| **Run** | One model call or one tool call | A single test | Step quality: was this step reasoned well, were args right | Milliseconds |
| **Trace** | All steps of one complete task | A full check-up | The main battlefield: result, path, side effects | Seconds to minutes |
| **Thread** | Multiple turns for one user | The longitudinal record | Memory, context continuity, goal drift | Days to weeks |

### Why the three levels matter

Because **different failures live on different levels**.

```text
Every Run is fine but the Trace is wrong  →  planning: right steps, wrong direction
The Trace is fine but the Thread breaks   →  memory: turn three forgot turn one's premise
The Trace is right but one Run is terrible →  luck: that step guessed correctly, once
```

If you only keep one “Trace score”, these three collapse together and you never know whether to fix the prompt, the tool, or the memory.

### How it looks in code

A recommended minimal structure:

```python
from dataclasses import dataclass, field

@dataclass
class Run:
    step: int
    kind: str                 # "llm" | "tool" | "human"
    input: dict
    output: dict
    latency_ms: int
    tokens: dict = field(default_factory=dict)

@dataclass
class Trace:
    trace_id: str
    thread_id: str
    goal: str                 # the user's original intent
    runs: list[Run]
    final_answer: str
    status: str               # "success" | "failed" | "aborted"

@dataclass
class Thread:
    thread_id: str
    user_id: str
    traces: list[Trace]
```

::: tip Translation for humans
A Run is **one move**. A Trace is **one game**. A Thread is **one season**. Judging a player by one move tells you nothing — you need to know whether the game was won, whether rules were broken, and whether the board got flipped.
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://docs.langchain.com/langsmith/evaluation-approaches" target="_blank" rel="noreferrer">LangSmith · Evaluation approaches</a>
  <a href="https://developers.openai.com/api/docs/guides/agent-evals" target="_blank" rel="noreferrer">OpenAI · Agent evals</a>
</div>

## 02 The four grader types {#graders}

With objects defined, choose who judges. Counter-intuitively: **anything code can decide, code must decide.**

<Diagram id="grader-kinds" />

| Type | How it grades | Cost | Stability | Best for |
| --- | --- | --- | --- | --- |
| **Deterministic code checks** | JSON Schema, regex, numeric assertions, tool-arg diffs | ≈ 0 | 100% reproducible | Format, fields, numbers, tool names, call counts |
| **LLM-as-judge** | Model scores against a rubric | Medium | Fluctuates, needs calibration | Tone, faithfulness, helpfulness, relevance |
| **Pairwise comparison** | Two answers side by side, judge picks | Medium | More stable than absolute scoring | Version or approach comparison |
| **Human review** | A person reads and scores | High | High, with annotator variance | Calibrating judges, pre-release spot checks |

### Not “pick one” — rank them

The default ratio worth copying:

```text
1. Code checks  →  run first; whatever can be pinned down, pin down (60%+ of assertions)
2. LLM judges   →  only semantic questions code cannot answer
3. Pairwise     →  when the question is "which version is better"
4. Humans       →  when the question is "is the judge right"
```

### A concrete contrast

Both are “did the agent use the right tool”:

- ❌ Have an LLM read the trace and answer “did it use the right tool” — slow, costly, occasionally wrong.
- ✅ Assert `tool == "get_order"` exists in `trace.runs` and `args.order_id != null` — free, instant, never misreads.

Both are “was the answer polite”:

- ❌ Regex for “please” and “thanks” — trivially gamed, and silly.
- ✅ An LLM judge with a rubric — exactly its strength.

::: warning The most expensive mistake
Handing a code-decidable question to an LLM judge. Beyond cost, it is **unstable**: the same input can flip verdicts between runs, your CI gate starts failing randomly, and within a week the team learns to “just re-run it” — the gate is now decoration.
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://promptfoo.dev/docs/guides/llm-as-a-judge/" target="_blank" rel="noreferrer">Promptfoo · LLM-as-a-judge</a>
  <a href="https://deepeval.com/docs/metrics-introduction" target="_blank" rel="noreferrer">DeepEval · Metrics introduction</a>
</div>

## 03 Golden datasets {#golden}

A beautiful score on a fake dataset is worth nothing.

A golden dataset is a set of cases that are **human-confirmed, have explicit expectations, and cover real scenarios**. It is the foundation of all eval work and the most valuable asset your team owns.

<Diagram id="golden-dataset" />

### One golden case, minimally

Smallest useful schema — resist adding more, ship first:

```json
{
  "id": "refund-policy-014",
  "input": "I bought headphones last week, opened the box. Can I still return them?",
  "context": { "user_tier": "gold", "order_id": "A1024", "channel": "app" },
  "expected": {
    "must_call_tools": ["get_order", "get_refund_policy"],
    "must_contain": ["7 days", "opened"],
    "must_not_contain": ["30 days", "90 days"],
    "final_state": { "refund_status": "eligible" }
  },
  "tags": ["policy", "edge:opened", "channel:app"],
  "source": "prod-trace:tr_7c1d9a",
  "created_at": "2026-10-12"
}
```

Four fields deserve their own explanation:

| Field | Why it must exist | Without it |
| --- | --- | --- |
| `expected.must_call_tools` | Makes the process gradable | You only see answers; tool thrash passes |
| `expected.must_not_contain` | Negative assertions catch hallucination | You prove “said it right”, never “said nothing wrong” |
| `expected.final_state` | Catches side effects | Right answer, corrupted data, invisible |
| `source` | Traceable and auditable | Six months later nobody dares delete it |

### Datasets are alive

A healthy dataset **grows**: one case per incident, one refresh per policy change, one cleanup per quarter.

A real ratio for a mid-size team:

```text
Hand-written       30%  — core business rules
Mined from traces  45%  — real distribution and long tail
Past incidents     20%  — at least one case per outage
User complaints     5%  — most expensive, most valuable
```

::: tip Translation for humans
A dataset is an **exam paper**. Use “1+1=2” as the paper and everyone scores 100. The problem is not the students, it is the paper.
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents" target="_blank" rel="noreferrer">Anthropic · Demystifying evals for AI agents</a>
  <a href="https://docs.langchain.com/langsmith/home" target="_blank" rel="noreferrer">LangSmith · Datasets</a>
</div>

## 04 Writing a rubric {#rubric}

With a dataset, you need a scoring standard. A bad rubric defeats the strongest judge.

<Diagram id="rubric-shape" />

### Three hard rules

**Rule one: binary beats 0-10.**

```text
❌ Score this answer from 0 to 10.
✅ Does this answer contain a number that is not supported by retrieved text?
   - PASS: every number traces back to retrieved policy text
   - FAIL: a number appears that is absent from the retrieved text
```

Why: humans cannot agree on 7 versus 8, so models certainly cannot. PASS/FAIL is reproducible.

**Rule two: one dimension, one question.**

```text
❌ Rate the quality (accuracy, helpfulness, tone).
✅ Dimension A: factual accuracy — consistent with retrieved content
✅ Dimension B: task completion — answers the actual question
✅ Dimension C: safety — leaks nothing it should not
```

**Rule three: describe what failure looks like.**

The most useful part of a rubric is rarely “what good looks like” but “what bad looks like”. Judges are lenient by default; a concrete bad example is what lets them say FAIL.

### A rubric template you can copy

```text
You are a support-reply reviewer. Judge exactly one thing: fidelity to the given policy.

[Input]
User question: {{question}}
Retrieved policy: {{context}}
Agent answer: {{answer}}

[Verdict]
PASS — all of the following hold:
  1) every claim about timing, amounts or conditions is supported verbatim by the policy;
  2) no policy detail outside the retrieved text is introduced;
  3) if the policy does not cover the question, the answer says a human will confirm.

FAIL — any of the following:
  1) a number appears that is absent from the policy;
  2) "applies in some cases" is presented as "always applies";
  3) an answer is invented when the policy is silent.

[Output]
JSON only: {"verdict": "PASS" | "FAIL", "evidence": "quote the policy text, or point at the invention"}
```

Note the last line: **force structured JSON plus evidence**. That is what makes a judge auditable — a FAIL without evidence leaves you unable to tell whether the model or the judge was wrong.

::: warning The most common rubric incident
An 800-word rubric with twelve criteria, and the judge only honours the first three. **The longer the rubric, the lower the compliance.** One grader, one question; split into three graders rather than one novel.
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://mlflow.org/docs/latest/genai/eval-monitor/scorers/" target="_blank" rel="noreferrer">MLflow · Scorers and judge calibration</a>
  <a href="https://promptfoo.dev/docs/configuration/expected-outputs/model-graded/llm-rubric/" target="_blank" rel="noreferrer">Promptfoo · llm-rubric</a>
</div>

## 05 Eval cadence end to end {#cadence}

Last concept: **evaluation is not an event, it is a loop with a tempo.** Different stages run different sets and watch different numbers.

| Stage | What runs | When | Blocking condition | Time budget |
| --- | --- | --- | --- | --- |
| Local dev | Smoke set (20-30) | Every code change | No block, red locally | < 1 min |
| Commit gate | Smoke plus critical assertions | Every PR / commit | Core case failure blocks | 3-5 min |
| Pre-merge | Regression set (200-500) | Before merging to main | Any metric degrading past threshold blocks | 15-30 min |
| Pre-release | Full set plus human spot check | Weekly / per version | Red-line metrics must pass | 1-2 hours |
| Online | Sampled (1-5% of traffic) | Continuous | Anomaly triggers alert | Always on |
| Review | Full set plus new samples | Monthly | Rebaseline, retire stale cases | Half a day |

### Tempo beats size

Many teams try to build 5,000 cases first, never finish a full run in three months, and then nobody looks at it.

The right order:

```text
Week 1: 30 smoke cases with code graders → wire into CI (warn only is fine)
Week 2-4: grow to 150 regression cases → add baseline diff → start blocking
Month 2: add LLM judges and human spot checks → cover subjective quality
Month 3: wire online sampling → the dataset starts growing itself
```

::: tip Translation for humans
An eval system is like fitness: **ten push-ups daily first, then talk about a hundred.** The ones who buy the annual membership and the gear in week one usually quit by week three.
:::

### Chapter checklist

- [ ] Mixing the three object levels: counting a step failure as a trace failure, or the reverse.
- [ ] Using an LLM judge for tool names, fields or numbers.
- [ ] Golden datasets with only perfect inputs — no typos, no ambiguity, no long context.
- [ ] Rubrics that grade twelve things at once; the judge obeys the first three.
- [ ] 0-10 scores in a gate, so thresholds get tweaked daily and CI is always red.
- [ ] Running only before a release, so none of the intermediate changes has a baseline.

### A skeleton that encodes this chapter

```python
# framework.py — three object levels plus a grader pipeline
from dataclasses import dataclass
from typing import Callable

@dataclass
class Trace:
    trace_id: str
    goal: str
    runs: list[dict]
    final_answer: str

Grader = Callable[[dict, Trace], dict]   # (case, trace) -> {"name", "pass", "note"}

def code_tool_used(expected_tool: str) -> Grader:
    def _g(case, trace):
        called = [r["tool"] for r in trace.runs if r.get("kind") == "tool"]
        return {"name": f"tool:{expected_tool}", "pass": expected_tool in called,
                "note": f"called={called}"}
    return _g

def code_contains(needle: str) -> Grader:
    def _g(case, trace):
        return {"name": f"contains:{needle}", "pass": needle in trace.final_answer}
    return _g

def run_suite(cases: list[dict], agent, graders_for: Callable[[dict], list[Grader]]) -> dict:
    results = []
    for case in cases:
        trace = agent(case["input"])
        verdicts = [g(case, trace) for g in graders_for(case)]
        results.append({
            "id": case["id"],
            "pass": all(v["pass"] for v in verdicts),
            "failed": [v for v in verdicts if not v["pass"]],
        })
    passed = sum(r["pass"] for r in results)
    return {"total": len(results), "passed": passed,
            "success_rate": round(passed / max(len(results), 1), 3),
            "failures": [r for r in results if not r["pass"]]}
```

Usage:

```python
cases = [
    {"id": "refund-01", "input": "Can I return the headphones?"},
    {"id": "refund-02", "input": "Can I return them after opening the box?"},
]

summary = run_suite(cases, agent=my_agent,
                    graders_for=lambda c: [code_tool_used("get_order"),
                                           code_contains("7 days")])
print(summary)
```

The point is that **it materialises objects, graders and datasets into code structure**. Trajectory matching, LLM judges and baseline diffs all bolt on without a rewrite.

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents" target="_blank" rel="noreferrer">Anthropic · Demystifying evals for AI agents</a>
  <a href="https://github.com/langchain-ai/openevals" target="_blank" rel="noreferrer">OpenEvals · Grader interfaces</a>
  <a href="https://deepeval.com/docs/metrics-introduction" target="_blank" rel="noreferrer">DeepEval · Metrics</a>
</div>

---

Next chapter turns scores into reports a human can read: metric layers, dashboard design, and where to draw the red lines.
