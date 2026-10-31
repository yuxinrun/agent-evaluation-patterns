---
title: 07 · A/B experiments and version comparison
description: One variable at a time, comparison reports with slices, significance versus noise, canary evaluation in production, and archiving experiments into new baselines.
outline: [2, 3]
---

# 07 · A/B experiments and version comparison

“I think A sounds more natural.”
“I think B is more accurate.”

Then the meeting runs forty minutes, nobody convinces anybody, and whoever is most senior decides by feel.

This chapter replaces that meeting: **from “I think” to “the data says”.**

## 01 One variable at a time {#design}

### The single rule

**Change one variable per experiment.**

<Diagram id="ab-design" />

It sounds obvious. The number of teams that violate it is astonishing:

```text
"The new version is so much better!"
"What did you change?"
"Swapped the model, rewrote the prompt, and added two tools."
"So which one helped?"
"It's better overall."
```

The conclusion of that experiment is: **you learned nothing.** Next time you gamble again.

### Six variables to isolate

| Variable | Example | How to isolate |
| --- | --- | --- |
| Model | gpt-5 → gpt-5-mini | Swap only the model; prompt and tools fixed |
| Prompt | System prompt, few-shot examples | Change only the prompt |
| Toolset | Add `get_refund_policy` | Add only the tool |
| Tool description | Clarify one argument | Change only the description |
| Parameters | temperature, max_tokens | Change only parameters |
| Context strategy | History window, summary method | Change only the strategy |

### A minimal design

```text
Control A:   the current production version (baseline)
Treatment B: exactly one variable changed
Dataset:     identical (and identical version!)
Graders:     identical (and identical version!)
Conditions:  same concurrency, same model version, same time window
Criteria:    written down BEFORE the run (no post-hoc standards)
```

The last line is what researchers call **pre-registration**. Humans are excellent at inventing explanations for results they have already seen, so the criteria must exist first.

::: tip Translation for humans
An experiment is **a drug trial**: treatment group gets the pill, control group gets the sugar pill, everything else identical. If the treatment group also secretly slept two extra hours, you will never know whether the pill worked.
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://docs.langchain.com/langsmith/evaluation-approaches" target="_blank" rel="noreferrer">LangSmith · Experiments</a>
  <a href="https://www.braintrust.dev/docs/evaluation-quickstart" target="_blank" rel="noreferrer">Braintrust · Experiment design</a>
</div>

## 02 Comparison reports {#report}

After the run you do not want one sentence saying “A or B”, you want **a table that shows where it got better and where it got worse**.

<Diagram id="ab-report" />

### The standard table

| Metric | A (control) | B (treatment) | Delta | Significance | Verdict |
| --- | --- | --- | --- | --- | --- |
| Task success | 88.2% | 92.1% | +3.9pt | ✅ p<0.01 | B better |
| Hallucination | 1.2% | 1.9% | +0.7pt | ✅ p<0.05 | B worse |
| Tool correctness | 90.1% | 89.4% | -0.7pt | ⚪ not significant | no difference |
| Mean turns | 4.4 | 3.8 | -0.6 | ✅ p<0.01 | B cheaper |
| P95 latency | 10.2s | 9.1s | -1.1s | ✅ p<0.05 | B faster |
| Cost per task | $0.028 | $0.022 | -21% | ✅ p<0.01 | B cheaper |
| Correction rate | 8.9% | 11.4% | +2.5pt | ✅ p<0.05 | B worse ⚠️ |

How to read it:

1. **Red lines first** — both hallucination and correction rate got worse;
2. Then the gains — success, cost and latency all improved;
3. Then the trade-off — how much hallucination is worth how much success, for this business?

**The conclusion is rarely “B is better”; it is “B is better in scenario X and worse in scenario Y”.** That is the value.

### Averages hide distributions

The same +3.9pt could be:

- Broad improvement (a little better everywhere);
- A spike (one family 40% → 95%, everything else slightly down).

So reports need **slices**:

```python
def sliced_delta(runs_a: list[dict], runs_b: list[dict], key: str) -> list[dict]:
    """Compare by tag slice to expose what the average hides."""
    def agg(runs):
        buckets: dict[str, list[bool]] = {}
        for r in runs:
            for tag in r.get("tags", []):
                buckets.setdefault(tag, []).append(r["pass"])
        return {k: sum(v) / len(v) for k, v in buckets.items()}

    a, b = agg(runs_a), agg(runs_b)
    return [
        {"slice": k, "A": round(a.get(k, 0), 3), "B": round(b.get(k, 0), 3),
         "delta": round(b.get(k, 0) - a.get(k, 0), 3)}
        for k in sorted(set(a) | set(b))
    ]
```

Output might look like:

```text
slice             A      B      delta
kind:positive     0.94   0.96   +0.02
kind:edge         0.71   0.88   +0.17     ← the gain lives here
kind:injection    0.98   0.98    0.00
kind:ambiguous    0.62   0.58   -0.04     ← but ambiguity regressed
```

There it is: **half the +3.9pt comes from edge cases, and it was bought with ambiguity.** Only slices reveal that.

::: warning Three report mistakes
1. Reporting only the total, never slices.
2. Reporting deltas without significance (noise dressed as conclusions).
3. Omitting sample size (+5pt on 30 cases is not +5pt on 3,000).
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://www.braintrust.dev/docs/evaluation-quickstart" target="_blank" rel="noreferrer">Braintrust · Comparing experiments</a>
  <a href="https://docs.langchain.com/langsmith/evaluation-approaches" target="_blank" rel="noreferrer">LangSmith · Experiments</a>
</div>

## 03 Real gains vs noise {#significance}

The most technical and most botched section of the book.

<Diagram id="canary" />

### Why significance is mandatory

Suppose two versions score 88.2% and 92.1%. The second looks better. But:

- With only 30 cases, 3.9pt could be one lucky guess;
- If the grader itself wobbles ±2pt, the gap is entirely inside the noise.

**A comparison without significance is a coin flip deciding your architecture.**

### A method that is good enough and readable

You do not need the full derivation. A two-proportion Z test gets you there:

```python
import math

def two_proportion_test(p1: float, n1: int, p2: float, n2: int) -> dict:
    """Z test for two proportions; returns two-tailed p value and noise band."""
    p_pool = (p1 * n1 + p2 * n2) / (n1 + n2)
    se = math.sqrt(p_pool * (1 - p_pool) * (1 / n1 + 1 / n2))
    if se == 0:
        return {"p_value": 1.0, "significant": False, "se": 0.0}
    z = abs(p2 - p1) / se
    p_value = math.erfc(z / math.sqrt(2))
    return {
        "delta": round(p2 - p1, 4),
        "z": round(z, 3),
        "p_value": round(p_value, 4),
        "significant": p_value < 0.05,
        "min_detectable": round(1.96 * se, 4),   # smallest detectable gap at 95%
    }

print(two_proportion_test(0.882, 300, 0.921, 300))
# {'delta': 0.039, 'z': 1.63, 'p_value': 0.103, 'significant': False, 'min_detectable': 0.047}
```

Look at that result: **+3.9pt on 300 cases is not significant** (p≈0.10). You cannot claim B is better.

That is not bad news; it is extremely useful news: either add samples, or admit the effect is below what you can measure.

### How many samples do you need

Work it out before running, and save yourself a lot of wasted effort:

| Smallest effect you want to detect | Approximate samples per arm |
| --- | --- |
| 10pt | ~150 |
| 5pt | ~600 |
| 3pt | ~1,600 |
| 1pt | ~14,000 |

(Baseline success ≈ 90%, 95% confidence, 80% power)

::: tip Translation for humans
This is **weighing yourself**. To know you lost 0.1 kg, you need a scale accurate to 0.05 kg. The bathroom scale with ±0.5 kg error will never answer that question.
**Want a gate that catches 1pt regressions? You need tens of thousands of cases. Otherwise widen the threshold.**
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://arxiv.org/abs/2403.04132" target="_blank" rel="noreferrer">Chatbot Arena · significance and Elo</a>
  <a href="https://arxiv.org/abs/2306.05685" target="_blank" rel="noreferrer">MT-Bench · judge reliability</a>
</div>

## 04 Canary evaluation {#canary}

Offline evaluation has one fatal limit: **you test the scenarios you thought of.**

Canary evaluation tests a real version on real traffic while keeping the blast radius acceptable.

### Four design points

| Point | Practice | Watch out |
| --- | --- | --- |
| Assignment | Hash user id, stable bucketing | Same user must stay in one bucket; otherwise experience flips |
| Ramp | 1% → 5% → 20% → 50% | Observe at least one business cycle per step |
| Observation | Same metrics for both arms in parallel | Tag by bucket, or you cannot compare |
| Rollback | Threshold triggers automatic revert | Rollback must be faster than release |

```python
import hashlib

def bucket(user_id: str, salt: str = "exp-2026-10") -> int:
    """Stable bucketing: same user always lands in the same bucket."""
    h = hashlib.sha256(f"{salt}:{user_id}".encode()).hexdigest()
    return int(h[:8], 16) % 100

def assign(user_id: str, canary_pct: int = 5) -> str:
    return "canary" if bucket(user_id) < canary_pct else "control"
```

### Three datasets to watch during a canary

```text
1. Business   success, escalation, complaints   → decide whether to ramp up
2. Technical  error rate, P95, cost             → decide whether to roll back now
3. Eval       sampled judge scores              → decide whether to promote the baseline
```

The third is the one people forget: **traces generated during a canary are premium eval samples.** Pull the failures and thumbs-downs straight into the dataset.

::: danger Two fatal canary mistakes
1. **Unstable assignment**: a user flips between versions, experience jumps, complaints spike.
2. **No automatic rollback**: someone has to notice manually, and by then it is 100%.
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://langfuse.com/docs/evaluation/overview" target="_blank" rel="noreferrer">Langfuse · Online evaluation</a>
  <a href="https://www.infoq.cn/topic/AI" target="_blank" rel="noreferrer">InfoQ · canary releases and effect measurement</a>
</div>

## 05 Archiving and new baselines {#archive}

An experiment that ends in a chat message never happened. This section turns it into an organisational asset.

### Three artefacts

| Artefact | Content | Where |
| --- | --- | --- |
| Experiment record | Hypothesis, variable, dataset version, result, decision | Experiment store or PR description |
| Rejected approaches | What did not work and why | Team docs (prevents repeat work) |
| New baseline | The winning version plus full metric snapshot | Baseline file (chapter 06) |

### A record template

```yaml
# experiments/2026-10-exp-007.yaml
id: exp-007
hypothesis: "Putting the opened-box condition in the system prompt lifts edge success by ≥8pt"
changed_variable: prompt.system.refund_condition
control: main@a1b2c3
treatment: feat/refund-condition@d4e5f6
dataset: regression@v14            # identical across arms
graders: graders@v9                # identical across arms
n_per_arm: 300
result:
  task_success: { control: 0.882, treatment: 0.921, p_value: 0.103, significant: false }
  edge_slice:   { control: 0.710, treatment: 0.880, delta: +0.170 }
  ambiguous:    { control: 0.620, treatment: 0.580, delta: -0.040 }
decision: adopt_partial           # keep the prompt change, add a clarification rule
follow_up: exp-008
```

### Failed experiments are worth more

A failed experiment tells you three things:

1. That direction is dead (saves someone else two weeks);
2. Your eval system can detect “not working” — which means it is trustworthy;
3. Failed hypotheses usually point at the real bottleneck.

So when archiving a failure, **write why it failed**, not “results were not good”.

::: tip Translation for humans
Experiment records are **recipe notes**. “One less spoon of salt is better” goes in.”Nobody in the family eats cilantro” goes in too. A notebook with only successes makes you cook the same rejected dish forever.
:::

### Three rules for a new baseline

```text
1. A version becomes the baseline only after passing the full regression set
2. The baseline stores a complete snapshot (per-case results, not just aggregates)
3. Keep the previous two baselines so you can trace when a regression started
```

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://docs.langchain.com/langsmith/evaluation-approaches" target="_blank" rel="noreferrer">LangSmith · Experiments and baselines</a>
  <a href="https://www.braintrust.dev/docs/evaluation-quickstart" target="_blank" rel="noreferrer">Braintrust · Experiment tracking</a>
</div>

---

Next chapter wires evaluation into the ecosystem: observability, memory, MCP tools, cross-agent collaboration, and the model gateway.
