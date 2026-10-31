---
title: 16 · Ecosystem wiring and next steps
description: How evaluation plugs into orchestration, observability, messaging, tools, memory and gateways, the cross-component contract, and a 90-day rollout plan.
outline: [2, 3]
---

# 16 · Ecosystem wiring and next steps

By now you know how to build a dataset, write graders, run regressions, wire CI and evaluate in production.

In a real system, evaluation is not a standalone project. It is **the quality bus of the whole agent ecosystem**: every link feeds it signals, and every change takes a release slip from it.

<Diagram id="eco-stack" />

### Where evaluation sits, in one sentence each

```text
llm-gateway-patterns          picks the model        → evaluation says which model is actually better
better-agent (orchestration)  runs the loop          → evaluation says whether the loop is worth it
mcp-patterns                  defines capabilities   → evaluation says whether the tool descriptions are clear
agent-memory-patterns         holds what it knows    → evaluation says whether it misremembers or leaks
a2a-patterns                  decides who delegates   → evaluation says whether handoffs lose information
agent-observability-patterns  makes it visible        → evaluation consumes its traces as raw material
```

**Evaluation is the only component that cuts across all the others**, which is exactly why it deserved its own book.

## 01 better-agent: wiring evals into the loop {#better-agent}

An orchestration framework decides how the loop runs. Evaluation needs two hook points: **label the sample on the way in, return the result on the way out.**

### Hook one: mark every run as evaluable

```python
from contextlib import contextmanager

@contextmanager
def eval_scope(case_id: str | None = None, dataset_ver: str | None = None):
    """Open a scope around the agent loop and inject eval context into the trace."""
    span = tracer.start_span("agent.run")
    span.set_attribute("eval.case_id", case_id or "")
    span.set_attribute("eval.dataset_version", dataset_ver or "")
    span.set_attribute("eval.mode", "eval" if case_id else "production")
    try:
        yield span
    finally:
        span.end()
```

With `eval.mode` you can instantly separate "this trace came from a suite" from "this trace came from a customer", and stop polluting production metrics.

### Hook two: expose the loop's intermediate state

Chapter 05 evaluates trajectories, which requires the framework to **hand over its middle states**:

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
    """The canonical form for evaluation: serialisable and diffable."""
    return {
        "n_steps": len(steps),
        "tools": [s.tool for s in steps if s.tool],
        "redundant_calls": count_redundant(steps),
        "tokens": sum(s.tokens for s in steps),
        "steps": [asdict(s) for s in steps],
    }
```

::: tip A design judgement
If your framework **cannot export intermediate steps**, your agent is a black box from the eval point of view: you can grade the outcome but never the process.
**That is the single most important question when choosing a framework, more important than raw speed.**
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://github.com/yuxinrun/better-agent" target="_blank" rel="noreferrer">better-agent · orchestration</a>
  <a href="https://www.anthropic.com/engineering/building-effective-agents" target="_blank" rel="noreferrer">Anthropic · Building effective agents</a>
</div>

## 02 a2a-patterns: cross-agent evaluation {#a2a}

The hard part of multi-agent evaluation is that **nobody owns the failure.** Every agent insists it did its job.

### The three-layer acceptance model

| Layer | What is graded | Graded by |
| --- | --- | --- |
| Unit | One agent's task completion | Trace score for that agent |
| Handoff | Completeness and semantic fidelity of the delegation message | Structural plus semantic checks |
| End to end | Whether the user's goal was met | Final result + total cost + total latency |

### Validating the handoff contract

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

### One heuristic worth remembering

```text
When the end-to-end run fails, look at the handoff layer before the unit layer.
Statistically, more than 60% of multi-agent incidents come from lost handoff information,
not from a single agent being weak.
```

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://yuxinrun.github.io/a2a-patterns/" target="_blank" rel="noreferrer">a2a-patterns · Agent to agent</a>
  <a href="https://www.anthropic.com/engineering/building-effective-agents" target="_blank" rel="noreferrer">Anthropic · Effective agents</a>
</div>

## 03 mcp-patterns: tool and skill evaluation {#mcp}

Tools have four evaluation dimensions, and every one belongs in the pipeline (chapter 08 goes deeper):

| Dimension | How | Passing line (rule of thumb) |
| --- | --- | --- |
| Discoverability | Task → first-choice hit rate | > 90% |
| Argument correctness | Schema plus semantic checks | > 98% |
| Output stability | Structural consistency across calls | > 95% |
| Permission boundary | Allow-list check | 100% |

### A/B testing tool descriptions

Tool description edits are the most overlooked form of "prompt change", yet they directly drive tool selection:

```python
def ab_tool_description(cases, tools_v1, tools_v2, agent) -> dict:
    """Same tasks, two description sets, compare first-choice hit rate."""
    def hit_rate(tools):
        hits = sum(agent.first_choice(c["input"], tools) == c["expect_tool"]
                   for c in cases)
        return hits / len(cases)

    r1, r2 = hit_rate(tools_v1), hit_rate(tools_v2)
    return {"v1": round(r1, 3), "v2": round(r2, 3), "delta": round(r2 - r1, 3),
            "ship": r2 > r1 + 0.03}
```

**Treat tool descriptions like code. Every edit goes through the gate.** This is the most commonly skipped step in the MCP era.

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://yuxinrun.github.io/mcp-patterns/" target="_blank" rel="noreferrer">mcp-patterns · Tools and permissions</a>
  <a href="https://www.anthropic.com/engineering/writing-tools-for-agents" target="_blank" rel="noreferrer">Anthropic · Writing effective tools for agents</a>
</div>

## 04 agent-memory-patterns: memory evaluation {#memory}

Memory evaluation has a difficulty nothing else has: **it is inherently temporal.**

### Five families, all about time

```text
Immediate recall   a preference stated in-session is used on the next turn
Short-term carry   still used 1-3 turns later
Long-term recall   new session, same user, still used days later
Conflict update    the user changed their mind, the old memory must expire
TTL cleanup        expired memories must never resurface
```

### Crosstalk detection: a safety red line

```python
def crosstalk_check(answer: str, foreign_facts: list[str]) -> dict:
    """Another user's memory must never appear in this user's answer."""
    leaked = [f for f in foreign_facts if f in answer]
    return {"name": "no_crosstalk", "pass": not leaked, "note": f"leaked={leaked}"}
```

This one must pass **100%** of the time. Unlike everything else, it has no acceptable failure rate.

### Constructing memory cases

```text
1. Build multi-tenant scenarios with fake users, each holding 3-5 unique preferences
2. Cross-ask: in user A's session, ask about user B's preferences
3. Conflicting writes: "prefers long answers" then "prefers short answers", see which wins
4. Time travel: use a controllable clock to simulate "30 days later"
```

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://yuxinrun.github.io/agent-memory-patterns/" target="_blank" rel="noreferrer">agent-memory-patterns · Memory tiers and retrieval</a>
  <a href="https://arxiv.org/abs/2410.10813" target="_blank" rel="noreferrer">LongMemEval · long-term memory benchmark</a>
</div>

## 05 agent-observability-patterns: traces drive evals {#observability}

This is the most important engineering principle in the book, and the only one with no substitute:

> **Eval samples must grow out of your observability system, not out of an engineer's imagination.**

### The six-stage chain

```text
1. Collect   OTel spans covering models, tools, retrieval, memory, gateways
2. Assemble  spans sharing a trace_id become one full trajectory
3. Select    failures / thumbs down / timeouts / random healthy samples
4. Mask      replace PII, preserve structure and entity linkage
5. Label     humans attach expectations (not optional)
6. Feed back into the dataset, join regressions and gates
```

### Span attributes you must emit

| Attribute | Purpose |
| --- | --- |
| `gen_ai.request.model` | Model version (pin it, never an alias) |
| `tool.name` / `tool.args_hash` | Tool choice and duplicate detection |
| `retrieval.doc_ids` | Faithfulness ground truth |
| `memory.op` / `memory.key` | Memory read/write grading |
| `eval.mode` | Separate eval traffic from real traffic |

::: warning The most common integration failure
Observability is in place. Evaluation is in place. They **do not share a trace_id**.
Result: the eval report cannot jump to the scene, the observability panel cannot show verdicts, and the two systems talk past each other.
**Decide on day one that trace_id is the only join key between them.**
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://yuxinrun.github.io/agent-observability-patterns/" target="_blank" rel="noreferrer">agent-observability-patterns · Tracing</a>
  <a href="https://opentelemetry.io/docs/concepts/signals/traces/" target="_blank" rel="noreferrer">OpenTelemetry · Traces</a>
</div>

## 06 llm-gateway-patterns: multi-model comparison {#gateway}

The gateway decides which model sees each sentence. Whether that decision is right is a question only evaluation can answer.

### Three tests, three decisions

| Test | Decision it supports |
| --- | --- |
| Routing correctness | Can the cheap model take this class of request |
| Fallback quality | When the primary is down, how much worse is the experience |
| Consistency | How far apart are two models on the same question, can answers be mixed |

### Offline validation of routing policy

```python
def validate_routing(cases: list[dict], router, judge) -> dict:
    """Not just routing hits, but whether cheap-tier quality is good enough."""
    rows = []
    for c in cases:
        tier = router.tier(c["input"])
        answer = router.call(tier, c["input"])
        quality = judge(c["input"], answer)           # binary PASS/FAIL
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

**`cheap_quality` is the number that matters.** If the cheap model only scores 72%, your routing threshold is too loose and the savings will be repaid in complaints.

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://yuxinrun.github.io/llm-gateway-patterns/" target="_blank" rel="noreferrer">llm-gateway-patterns · Routing and fallback</a>
  <a href="https://docs.langchain.com/langsmith/evaluation-approaches" target="_blank" rel="noreferrer">LangSmith · Evaluation approaches</a>
</div>

## 07 Roadmap and checklist {#roadmap}

<Diagram id="roadmap" />

### The 90-day rollout

| Phase | Weeks | Goal | Deliverable |
| --- | --- | --- | --- |
| **1** | 1-2 | A script that runs | 30 smoke cases, code checks, one judge |
| **2** | 3-4 | CI blocks regressions | GitHub Action, baseline file, gate script |
| **3** | 5-6 | Trajectory evals live | Tool sequence checks, loop detection, side-effect sandbox |
| **4** | 7-8 | Samples come from production | Trace sampler, masking, labelling workflow |
| **5** | 9-10 | Judges are trustworthy | 200 human labels, calibration, anchor set |
| **6** | 11-12 | Online evaluation | Bypass sampling, alerts, closed-loop tracking |

### The gate for each phase

```text
Phase 1: a new teammate can go from "edit prompt" to "see results" in 30 minutes
Phase 2: every PR shows exactly which cases regressed
Phase 3: you can answer "how many extra tool calls did this change cost"
Phase 4: more than 50% of the dataset comes from real traces
Phase 5: judge-versus-human kappa above 0.6
Phase 6: a production degradation is detected automatically within an hour
```

### A 12-point final checklist

| # | Check |
| --- | --- |
| 1 | Smoke / regression / full execution tiers exist |
| 2 | Every case has at least one hard code check |
| 3 | Tool call sequences are recorded and graded |
| 4 | A diffable baseline file exists, with two historical versions |
| 5 | CI gates have red-line thresholds and consider significance |
| 6 | The judge was calibrated on human labels, with kappa recorded |
| 7 | An anchor set runs drift detection daily |
| 8 | Write operations are mocked or rollback-able in the eval environment |
| 9 | Production traces convert into samples automatically |
| 10 | Failure capture has an SLA and the queue does not rot |
| 11 | Alerts carry links to failing traces |
| 12 | Eval spend has a budget breaker |

**Twelve out of twelve and your harness can support an agent product at a million requests a day.** Eight to eleven is "shippable but still stepping on rakes". Below eight, fix the foundation before you scale.

### Three things not to do

::: warning The three most common rollout detours
1. **Chasing 1,000 cases on day one**: thirty good cases beat a thousand filler cases.
2. **Building a platform first**: get the loop working with Promptfoo or Langfuse, learn the pain, then build.
3. **Grading 20 metrics on day one**: start with three (success, tool correctness, P95) and add once they are stable.
:::

## Closing: the book in one sentence

If you remember one line, remember this one:

> **An agent without evaluation is not "of uncertain quality". It is a system whose behaviour you simply do not know.**

The entire point of evaluation is to turn "I think" into "the data says", "it seemed fine last time" into "we are 1.2pt below baseline and the drop is all in edge cases", and "production broke" into "the anchor set raised the alarm three days ago".

### The rest of the ecosystem

<Eco />

The six sibling projects each own one concern. Together they form an agent system that can face production. Evaluation is the **acceptance net that runs through all of them**, and the only basis you have for answering "is this system actually any good".

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents" target="_blank" rel="noreferrer">Anthropic · Demystifying evals for AI agents</a>
  <a href="https://docs.langchain.com/langsmith/evaluation-approaches" target="_blank" rel="noreferrer">LangSmith · Evaluation approaches</a>
  <a href="https://developers.openai.com/api/docs/guides/agent-evals" target="_blank" rel="noreferrer">OpenAI · Agent evals</a>
</div>

---

That is all seventeen chapters.

Now it is your turn: **write those thirty smoke cases.** No budget, no approval, no platform selection required — just one afternoon.

Those thirty cases are what will turn every future "I think it got better" into a sentence that can be checked.
