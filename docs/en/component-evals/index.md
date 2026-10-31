---
title: 08 · Evaluating the ecosystem components
description: Trace-driven samples, cross-agent collaboration evals, MCP tool evals, memory evals, gateway routing and fallback evals, plus the cross-component evaluation contract.
outline: [2, 3]
---

# 08 · Evaluating the ecosystem components

A real agent system is not "one model plus one loop". It is seven pieces bolted together:

A gateway that routes traffic, a runtime that runs the loop, observability that makes it visible, memory that remembers, messaging that lets agents cooperate, tools that do the work, and evaluation that decides whether any of it was good.

This chapter covers **how each piece gets graded**, and the contracts between them.

## 01 Traces drive the eval set {#observability}

This is the single most important engineering practice in the book: **eval samples should grow out of your observability system.**

<Diagram id="obs-to-eval" />

### The full pipeline from trace to sample

```text
Agent runtime
  └─ OTel span (model call, tool call, retrieval, memory I/O)
       └─ Trace assembly (the span tree sharing one trace_id)
            └─ Sampler (failures / negative feedback / latency outliers / random)
                 └─ Masker (strip PII, keep structure)
                      └─ Sample builder (add expectations, human review)
                           └─ Dataset (versioned, joins the regression set)
```

The point is that **every step is traceable**: any test case can be traced back to the production trace that produced it.

### Writing the sampler

```python
def should_sample(trace: dict, rng) -> str | None:
    """Return the reason to sample, or None to skip."""
    if trace["status"] == "failed":
        return "failure"
    if trace.get("feedback") == "thumbs_down":
        return "negative_feedback"
    if trace["latency_ms"] > trace.get("p95_baseline", 10_000) * 2:
        return "latency_outlier"
    if trace.get("turns", 0) > trace.get("p90_turns", 6):
        return "too_many_turns"
    if rng.random() < 0.02:
        return "random_healthy"        # sample good ones too, or the set turns pessimistic
    return None
```

Note that last branch. **Sampling only failures makes your dataset pessimistic**: when the agent genuinely improves, your suite cannot see it. Keep a healthy share of good traffic.

### Attributes every span must carry

| Attribute | Purpose |
| --- | --- |
| `trace_id` / `span_id` | Link the chain together |
| `gen_ai.request.model` | Model version (pin the exact string) |
| `tool.name` / `tool.args_hash` | Tool choice and duplicate-call detection |
| `retrieval.doc_ids` | Ground truth for faithfulness checks |
| `memory.op` / `memory.key` | Memory read/write grading |
| `eval.dataset_version` | Tie the run to a dataset version |

::: tip Translation for humans
Observability is the **dashcam**; evaluation is the **accident archive**. The dashcam recorded it, but if nobody files it, the same crash happens again next quarter.
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://arize.com/docs/phoenix" target="_blank" rel="noreferrer">Arize Phoenix · OTel-native traces</a>
  <a href="https://langfuse.com/docs/evaluation/overview" target="_blank" rel="noreferrer">Langfuse · Trace to dataset</a>
  <a href="https://yuxinrun.github.io/agent-observability-patterns/" target="_blank" rel="noreferrer">agent-observability-patterns</a>
</div>

## 02 Cross-agent collaboration evals {#a2a}

The hard part of multi-agent systems: **you cannot grade just one agent.**

<Diagram id="multi-agent-eval" />

### Three layers of grading

| Layer | Question | What is graded |
| --- | --- | --- |
| Single agent | Did it do its own job | Trace-level score for that agent |
| Delegation boundary | Was the task split right, was the handoff complete | Structure and content of handoff messages |
| End to end | Was the user's goal met | Final result + total latency + total cost |

### Grading delegation quality

Most multi-agent incidents are not "one agent is dumb". They are **information lost at the handoff**.

```python
REQUIRED_HANDOFF = {"task_id", "goal", "constraints", "deadline", "return_format"}

def check_handoff(msg: dict) -> dict:
    missing = [k for k in REQUIRED_HANDOFF if not msg.get(k)]
    vague = [k for k in ("goal", "constraints")
             if msg.get(k) and len(str(msg[k])) < 10]
    return {
        "name": "handoff",
        "pass": not missing and not vague,
        "note": f"missing={missing} vague={vague}",
    }
```

This check catches the most common failure: "the user wants a refund, and you hand off to the refund agent with nothing but an order_id".

### Weighting the end-to-end score

Multi-agent scoring must weight total cost and total latency harder than single-agent scoring, because every extra hop multiplies both.

```text
end_to_end = 0.5 × goal achieved
           + 0.2 × delegation sanity (no redundant hops)
           + 0.2 × cost efficiency (versus single-agent baseline)
           + 0.1 × latency
```

::: warning The classic multi-agent trap
Every agent passes its own unit test, and the end-to-end run fails. The usual cause: **the interface contract was never tested.** A says "handled", B reads it as "cancelled", both are green.
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://www.anthropic.com/engineering/building-effective-agents" target="_blank" rel="noreferrer">Anthropic · Building effective agents</a>
  <a href="https://yuxinrun.github.io/a2a-patterns/" target="_blank" rel="noreferrer">a2a-patterns · Agent to agent</a>
</div>

## 03 MCP tool evals {#mcp}

Tools are the agent's hands. A disobedient hand ruins the smartest brain.

<Diagram id="mcp-eval" />

### Four dimensions

| Dimension | Question | How to decide |
| --- | --- | --- |
| **Discoverability** | Can the model tell which tool to use | Task → first-choice hit rate |
| **Argument correctness** | Are the arguments valid and complete | Schema check plus semantic check |
| **Output stability** | Same input, same structure | Call repeatedly, compare shapes |
| **Permission boundary** | Any over-privileged calls | Allow-list check |

### Tool descriptions are testable too

Few teams know that a tool description can be measured. The method is simple:

```python
def tool_selection_accuracy(cases: list[dict], agent) -> float:
    """Give a batch of 'which tool should I use' cases; check the first choice."""
    hits = 0
    for case in cases:
        chosen = agent.first_tool_choice(case["input"], case["available_tools"])
        hits += chosen == case["expected_tool"]
    return hits / len(cases)
```

If first-choice accuracy is 62%, the model is rarely the problem. **The names and descriptions are mush** — typically `search` and `query` living side by side.

### Quantifying output stability

```python
def output_stability(tool, args: dict, n: int = 5) -> dict:
    """Call n times with the same args; measure Jaccard similarity of key shapes."""
    shapes = [set(flatten_keys(tool.call(args))) for _ in range(n)]
    base = shapes[0]
    sims = [len(base & s) / len(base | s) for s in shapes[1:]]
    return {"stable": min(sims) > 0.95, "min_similarity": round(min(sims), 3)}
```

::: warning Three red lines for MCP tool evals
1. **Unstable output shape**: `{"data": [...]}` today, `[...]` tomorrow. The agent breaks instantly.
2. **Silent errors**: returning an empty array instead of an error code teaches the agent "no data" and it keeps inventing.
3. **Permission creep**: the tool can read every order and the agent merely "happens" not to. That is not security, that is luck.
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://www.anthropic.com/engineering/writing-tools-for-agents" target="_blank" rel="noreferrer">Anthropic · Writing effective tools for agents</a>
  <a href="https://yuxinrun.github.io/mcp-patterns/" target="_blank" rel="noreferrer">mcp-patterns · Tools and permissions</a>
</div>

## 04 Memory evals {#memory}

Memory is the master of looking right. Ask "what do I like" and the agent answers "you like concise replies" — plausible, warm, and wrong, because that preference was a one-off comment three years ago.

<Diagram id="memory-eval" />

### Four measurable dimensions

| Dimension | Question | Case design |
| --- | --- | --- |
| **Write correctness** | Did it remember what it should | State a preference, ask next turn |
| **Recall accuracy** | Can it retrieve what it needs | Cross-session question needing 2-3 memories |
| **Forgetting** | Did it drop what it must | User says "stop using honorifics", check it is gone |
| **No crosstalk** | Did someone else's memory leak in | Multi-tenant / multi-user crossover cases |

### Crosstalk matters most

Because it is a **security incident**, not a quality nit.

```python
def check_no_crosstalk(answer: str, other_users_facts: list[str]) -> dict:
    leaks = [f for f in other_users_facts if f in answer]
    return {"name": "no_crosstalk", "pass": not leaks, "note": f"leaked={leaks}"}
```

### The time dimension

Memory is inherently temporal, so cases must span time:

```text
1. Immediate recall     within the same session, just-said facts
2. Short-term carry     still usable 1-3 turns later
3. Long-term recall     days later (simulate: new session_id, same user_id)
4. Conflict update      user changed their mind, the old memory must expire
5. TTL cleanup          expired memories must never resurface
```

::: tip Translation for humans
Grading memory is **auditing an assistant's notebook**. Not just "did you write it down", but "did you write it on the right page, did you cross out the stale line, did you update it after the boss changed their mind".
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://yuxinrun.github.io/agent-memory-patterns/" target="_blank" rel="noreferrer">agent-memory-patterns · Memory tiers and retrieval</a>
  <a href="https://arxiv.org/abs/2410.10813" target="_blank" rel="noreferrer">LongMemEval · long-term memory benchmark</a>
</div>

## 05 Gateway routing and fallback evals {#gateway}

The gateway decides which model sees every sentence. That used to be an ops detail. Now it is a **quality variable**.

<Diagram id="gateway-eval" />

### Three kinds of tests

| Kind | Question | Decision |
| --- | --- | --- |
| **Routing correctness** | Did the easy question go to the cheap model | Hit rate per difficulty tier |
| **Fallback quality** | When the primary is down, does the backup hold | Same dataset, both models |
| **Consistency** | How far apart are the two models' answers | Semantic similarity plus key facts |

### Designing routing cases

```python
ROUTING_CASES = [
    {"input": "what time is it", "expect_tier": "cheap"},
    {"input": "rewrite this paragraph more formally", "expect_tier": "cheap"},
    {"input": "analyse the risks in this earnings report", "expect_tier": "strong"},
    {"input": "why does this code deadlock", "expect_tier": "strong"},
]

def routing_accuracy(cases, router) -> dict:
    hits = sum(router.tier(c["input"]) == c["expect_tier"] for c in cases)
    return {"accuracy": round(hits / len(cases), 3), "n": len(cases)}
```

### Fallback needs its own baseline

The dangerous part of a fallback is not "it got slower". It is **it quietly got worse**. So the fallback path needs its own suite:

```text
primary baseline:  gpt-5       task success 92.1%
fallback verified: gpt-5-mini  task success 84.3%   ← acceptable, but you must know
                   and you must name the features that should switch off
```

::: danger The most-missed fallback check
Fallbacks change **style** as well: shorter answers, more refusals. If your product depends on a fixed tone, a fallback silently breaks it. **Add tone consistency to the fallback suite.**
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://yuxinrun.github.io/llm-gateway-patterns/" target="_blank" rel="noreferrer">llm-gateway-patterns · Routing and fallback</a>
  <a href="https://docs.langchain.com/langsmith/evaluation-approaches" target="_blank" rel="noreferrer">LangSmith · Evaluation approaches</a>
</div>

## 06 The cross-component contract {#contract}

Last, something rarely written down yet decisive for whether a multi-component system is trustworthy as a whole: **the evaluation contract**.

<Diagram id="contract" />

### What a contract is

Every component promises three things:

```text
1. What I provide        capabilities and interfaces
2. What I guarantee      quality floor and stability
3. What I emit           eval-grade data for the layer above
```

For example:

| Component | Promise | Eval data it emits |
| --- | --- | --- |
| llm-gateway | Same request returns the same shape on both models | Model, latency, cost per call |
| mcp tool | Errors must be explicit codes | Tool arguments and returns |
| memory | No cross-tenant crosstalk (red line) | Memory read/write spans |
| observability | Complete trace trees | All spans sharing a trace_id |
| evaluation | Verdicts with evidence | Verdict + reason + evidence link |

### A contract check script

```python
CONTRACTS = {
    "gateway": ["model", "latency_ms", "cost_usd", "status"],
    "tool": ["name", "args", "ok", "error_code"],
    "memory": ["op", "key", "tenant_id", "hit"],
}

def check_span_contract(span: dict) -> dict:
    kind = span.get("component")
    required = CONTRACTS.get(kind)
    if not required:
        return {"pass": True, "note": "unknown component, skipped"}
    missing = [k for k in required if span.get(k) in (None, "")]
    return {"name": f"contract:{kind}", "pass": not missing, "note": f"missing={missing}"}
```

The value here: **it turns inter-component agreements into assertions a pipeline can check.** The day someone renames a field, CI goes red instead of a customer finding out.

::: warning How contracts die
"Just adding one field to the response." "Just renaming `error_code` to `code`." Green in the component's own tests, red in integration evals.
**A contract change is a breaking change and must go through the eval pipeline.**
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://arize.com/docs/phoenix" target="_blank" rel="noreferrer">Arize Phoenix · Span contracts</a>
  <a href="https://www.anthropic.com/engineering/writing-tools-for-agents" target="_blank" rel="noreferrer">Anthropic · Writing effective tools for agents</a>
</div>

---

Next chapter is refreshingly practical: line up the seven mainstream platforms side by side and tell you which one to pick when.
