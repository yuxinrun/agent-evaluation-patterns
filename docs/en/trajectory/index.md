---
title: 05 · Trajectory evaluation
description: Anatomy of a trajectory, order and subset matching, reasonableness grading, loop detection, side-effect rollback, and a complete trajectory scorer.
outline: [2, 3]
---

# 05 · Trajectory evaluation

Suppose an agent produces a perfectly correct final answer, but along the way it made twelve irrelevant tool calls, changed the user's address to someone else's, and nearly deleted an order row. Did it succeed?

In LLM evaluation that question does not exist, because there is no “along the way”.
In agent evaluation it shows up **every single day**.

This chapter is about reading the road, not just the destination.

## 01 Anatomy of a trajectory {#anatomy}

First, a picture. The user says: “Check when order A1024 arrives, and if it is late, file a compensation claim.”

<Diagram id="trace-anatomy" />

The trace unpacks roughly like this:

```json
{
  "trace_id": "tr_7c1d9a",
  "goal": "Check A1024 logistics, claim compensation if late",
  "runs": [
    { "step": 1, "kind": "llm",  "note": "Plan: fetch order, fetch logistics, decide lateness" },
    { "step": 2, "kind": "tool", "tool": "get_order",       "args": { "order_id": "A1024" } },
    { "step": 3, "kind": "tool", "tool": "get_logistics",   "args": { "order_id": "A1024" } },
    { "step": 4, "kind": "llm",  "note": "Promised 48h, 72h elapsed, late confirmed" },
    { "step": 5, "kind": "tool", "tool": "apply_compensation", "args": { "order_id": "A1024", "reason": "delay" } },
    { "step": 6, "kind": "llm",  "note": "Compose the final reply" }
  ],
  "final_answer": "Your order is 24 hours late; the compensation request has been filed…"
}
```

### What is gradable inside a trace

| Dimension | Content | Best grader |
| --- | --- | --- |
| Tool choice | Which tools called, which missed, which extra | Code |
| Tool arguments | Were args right, was an id invented | Code |
| Order | Dangerous orders like “refund before verify” | Code |
| Call count | Redundancy, repetition, loops | Code |
| Intermediate reasoning | Is each step's judgement sound | Judge |
| State changes | What changed in the database or external systems | Code (snapshot diff) |
| Termination | Normal end, hit a limit, gave up | Code |

::: tip Translation for humans
The final answer is only **whether the food arrived**. The trajectory is **whether the rider took a detour, ran a red light, or carried off someone else's bag**.
Ninety percent of complaints are not “it never arrived”, they are “look at what happened on the way”.
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents" target="_blank" rel="noreferrer">Anthropic · Demystifying evals for AI agents</a>
  <a href="https://docs.langchain.com/langsmith/trajectory-evals" target="_blank" rel="noreferrer">LangSmith · Trajectory evaluations</a>
</div>

## 02 Order matching {#match}

The most direct method: **write down the expected tool sequence and compare it with the actual one.**

It fits agents with stable, rule-driven paths — order lookup, logistics lookup, lateness decision, compensation.

<Diagram id="traj-match" />

### Four matching strengths

| Mode | Rule | Strictness | Use when |
| --- | --- | --- | --- |
| **Exact** | Sequences identical | Strictest | Regulated flows (refunds, approvals) |
| **In order (subsequence)** | Expected steps appear in order, extras allowed | Medium | Most business flows |
| **Any order** | All expected steps appear, order free | Loose | Information-gathering tasks |
| **Subset** | Specific key steps present | Loosest | Only “did it do X” |

### Why in-order is the default

Exact matching is brittle: one extra `get_user_profile` call, entirely reasonable, fails the case.
Any-order is too loose: it permits “refund first, verify later”.

**Subsequence matching is the sweet spot**: it protects the order of critical steps while tolerating sensible exploration.

```python
from collections import deque

def match_in_order(actual: list[str], expected: list[str]) -> dict:
    """Is expected a subsequence of actual (relative order preserved)?"""
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

# usage
actual   = ["get_user_profile", "get_order", "get_logistics", "apply_compensation"]
expected = ["get_order", "get_logistics", "apply_compensation"]
print(match_in_order(actual, expected))   # pass=True, the extra profile call is fine
```

### When exact matching is mandatory

Only when **the order is itself a compliance requirement**:

- Verify order ownership before issuing a refund;
- Take a backup call before deleting data;
- Attempt self-service before escalating to a human.

Mark these cases with `strict_order: true` per case rather than applying a global rule.

::: warning The biggest trajectory-matching trap
Treating “the path I imagined” as the only correct path. Real agents often find a shorter route (a cache hit, for example) and exact matching calls it a failure — **you end up punishing the better solution**.
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://docs.langchain.com/langsmith/trajectory-evals" target="_blank" rel="noreferrer">LangSmith · Trajectory match modes</a>
  <a href="https://developers.openai.com/api/docs/guides/agent-evals" target="_blank" rel="noreferrer">OpenAI · Agent evals</a>
</div>

## 03 Reasonableness grading {#reasonable}

Fixed matching only works when the path is known. Open-ended tasks (“analyse this month's sales”) have no single correct path, so you grade **whether the path makes sense**.

### Three levels of reasonableness

| Level | Question | How to judge |
| --- | --- | --- |
| Logical | Does each step follow from the previous result | Judge plus rules |
| Efficient | Is there an obviously shorter route | Compare against baseline paths |
| Safe | Any high-risk action taken with missing information | Rules (code) |

### Judging reasonableness with a model

```text
You are an agent trajectory reviewer. Judge one thing: are the decisions reasonable?

[Goal] {{goal}}
[Available tools] {{tools}}
[Trajectory]
{{trajectory}}

[Verdict]
PASS — all of these hold:
  1) every call follows from the information available at that point;
  2) no write action (refund/delete/send) is taken while key facts are missing;
  3) if the task needs clarification, the trajectory contains exactly one clarification.

FAIL — any of these:
  1) an unexplained jump (e.g. compensation before order lookup);
  2) an irreversible action taken with missing information;
  3) the same tool called repeatedly with near-identical arguments.

Return JSON: {"verdict": "...", "first_bad_step": <int|null>, "reason": "..."}
```

`first_bad_step` is the important field: **it turns “the trajectory is unreasonable”, which is useless, into “it went off the rails at step 4”, which is actionable.**

### Score reasonableness and efficiency separately

```python
def trajectory_score(trace, expected_steps: int) -> dict:
    steps = len(trace.runs)
    return {
        "path_ok": None,                                  # filled by the judge
        "efficiency": round(min(1.0, expected_steps / max(steps, 1)), 3),
        "redundancy": 1 - len({(r.get("tool"), str(r.get("args"))) for r in trace.runs}) / max(steps, 1),
    }
```

::: tip Translation for humans
Reasonableness grading is **interviewing a driver**. You do not require the exact route; you ask why this route, does it hold up, and did they run a red light to save time.
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://docs.langchain.com/langsmith/evaluate-complex-agent" target="_blank" rel="noreferrer">LangSmith · Evaluating complex agents</a>
  <a href="https://arxiv.org/abs/2406.12045" target="_blank" rel="noreferrer">τ-bench · tool-agent-user interaction</a>
</div>

## 04 Loop detection {#loop}

The most overlooked and most expensive bad trajectory.

<Diagram id="loop-detect" />

### Three loop shapes

| Type | What it looks like | Root cause |
| --- | --- | --- |
| **Exact loop** | Same tool, same args, three or more times | Misread tool output, lost context frame |
| **Near loop** | Same tool, slightly different args each time | Search strategy failed |
| **Oscillation** | A→B→A→B | Planning and execution fighting, or two subgoals in conflict |

### The detection algorithm

```python
from collections import Counter

def detect_loop(trace, window: int = 6, threshold: int = 3) -> dict:
    """Repeat detection: exact, tool-level, and ABAB oscillation."""
    calls = [(r.get("tool"), json.dumps(r.get("args", {}), sort_keys=True))
             for r in trace.runs if r.get("kind") == "tool"]

    exact = Counter(calls)
    worst = max(exact.values(), default=0)

    tool_seq = [c[0] for c in calls]
    tool_repeat = max(Counter(tool_seq).values(), default=0)

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

### What saves you in production is a breaker, not a detector

Detection helps in evaluation. What saves money in production is **runtime interruption**:

```python
class LoopBreaker:
    """Interrupt and degrade when the same tool with similar args exceeds N calls."""

    def __init__(self, threshold: int = 3):
        self.threshold = threshold
        self.seen: Counter = Counter()

    def check(self, tool: str, args: dict) -> str:
        key = f"{tool}:{hash(json.dumps(args, sort_keys=True)) % 10**8}"
        self.seen[key] += 1
        if self.seen[key] >= self.threshold:
            return "abort"          # stop, hand off or return what is known
        if self.seen[key] == self.threshold - 1:
            return "warn"           # nudge the model to change strategy
        return "ok"
```

::: warning Two ways loop detection misfires
1. **Killing legitimate retries**: identical calls caused by network flakiness are retries. Count them as retries with backoff, not as loops.
2. **Thresholds set too loose**: aborting at ten repeats means you already burned half an hour and several dollars.
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents" target="_blank" rel="noreferrer">Anthropic · Demystifying evals for AI agents</a>
  <a href="https://arize.com/docs/phoenix" target="_blank" rel="noreferrer">Arize Phoenix · Trace analysis</a>
</div>

## 05 Side-effect verification {#sideeffect}

Write-capable agents — refunds, messages, address changes, tickets — have a problem LLM evals never face: **the evaluation changes the world**.

<Diagram id="side-effect" />

### Three problems to solve

| Problem | Consequence | Solution |
| --- | --- | --- |
| State pollution | The second run starts from a different state, results incomparable | Reset the snapshot before every run |
| Leaked side effects | Evaluation messages real users, refunds real money | Sandbox plus fake downstream |
| Invisible side effects | Right answer, corrupted data, nobody notices | Compare state snapshots afterwards |

### Sandbox, snapshot, verify

```python
import contextlib

@contextlib.contextmanager
def sandboxed(eval_env):
    """Snapshot → run → check → restore."""
    snapshot = eval_env.snapshot()
    try:
        yield eval_env
    finally:
        diff = eval_env.diff_against(snapshot)
        eval_env.restore(snapshot)
        sandboxed.last_side_effects = diff     # available for assertions

def check_side_effects(allowed: list[str]) -> dict:
    """Only declared side effects may occur; anything else fails."""
    actual = sandboxed.last_side_effects or {}
    unexpected = {k: v for k, v in actual.items() if k not in allowed}
    return {"name": "side_effects", "pass": not unexpected,
            "note": f"unexpected={list(unexpected)}"}
```

### You also need positive assertions

Checking “no unexpected side effects” is not enough. Check that the expected effects happened:

```python
def check_refund_created(env) -> dict:
    refunds = env.query("SELECT * FROM refunds WHERE order_id = %s", ("A1024",))
    return {
        "name": "refund_created",
        "pass": len(refunds) == 1 and refunds[0]["amount"] == 199.00,
        "note": f"rows={len(refunds)}",
    }
```

Both matter:

- Without the negative check you miss dirty writes;
- Without the positive check you miss “said it refunded, never did” — the worst failure of all.

::: danger The most expensive eval incident
Running the “delete account” case against an environment wired to real downstream services. This is not a joke; it has happened.
**Any evaluation with write operations must run in a sandbox with mocked downstream by default.**
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://docs.langchain.com/langsmith/trajectory-evals" target="_blank" rel="noreferrer">LangSmith · Trajectory and state evaluation</a>
  <a href="https://arxiv.org/abs/2307.13854" target="_blank" rel="noreferrer">WebArena · verifiable final states</a>
</div>

## 06 Implementing trajectory scores {#scoring}

Assemble the parts into a grader you can actually ship.

### A complete scorer

```python
from dataclasses import dataclass

@dataclass
class TrajectoryScore:
    result_ok: bool            # final outcome correct
    path_ok: bool              # critical step order correct
    no_loop: bool              # no spinning
    side_effects_ok: bool      # effects match expectations
    efficiency: float          # 0-1, relative to expected steps
    first_bad_step: int | None # earliest failure location

    @property
    def verdict(self) -> str:
        return "PASS" if all([self.result_ok, self.path_ok, self.no_loop,
                              self.side_effects_ok]) else "FAIL"

    @property
    def score(self) -> float:
        """Weighted total: outcome dominates, then path and side effects."""
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

### How to use each number

| Purpose | Use | Note |
| --- | --- | --- |
| Gate | `verdict` | PASS/FAIL only, never the weighted score |
| Version trend | `score` | Weighted totals are for charts |
| Debugging | `first_bad_step` | Jump straight to the problem |
| Dataset health | Per-dimension pass rate | See which dimension is systematically low |

::: warning The weighted-score trap
A weighted total is great for trend charts and **terrible as a gate**. The difference between 0.78 and 0.81 means nothing, and it tempts teams to optimise the heaviest weight instead of fixing the bug.
Gate on `verdict`, align with humans on `verdict`, and keep `score` for internal trends.
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://docs.langchain.com/langsmith/trajectory-evals" target="_blank" rel="noreferrer">LangSmith · Trajectory evaluations</a>
  <a href="https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents" target="_blank" rel="noreferrer">Anthropic · Demystifying evals for AI agents</a>
</div>

---

Next chapter moves all of this into the pipeline: keeping bad versions out of main.
