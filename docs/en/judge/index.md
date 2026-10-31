---
title: 10 · Calibrating, de-noising and governing LLM judges
description: Why judges are biased and drift, calibrating against human labels, cross-checking with multiple judges, binary rubrics over 0-10 scores, and scheduled recalibration.
outline: [2, 3]
---

# 10 · Calibrating, de-noising and governing LLM judges

In chapter 04 we hired a grader: LLM-as-judge. It scores a hundred thousand items a day, never tires, never slacks off. Perfect.

Except for one thing: **it grades confidently and wrongly, and never mentions it.**

Worse, its errors are systematic: longer answers win, the first option wins, its own model family wins, and a leading hint wins. Those patterns do not fade with scale. They **amplify**.

This chapter turns the judge from a temp who improvises into a rater with calibration records, auditability, and trust.

## 01 Why judges are biased {#bias}

<Diagram id="judge-bias" />

### Five reproducible biases

| Bias | Symptom | A real example |
| --- | --- | --- |
| **Position** | Swap the order, swap the verdict | In A/B, the first slot wins +8pt |
| **Verbosity** | Longer is better | Trimming a correct answer lowers its score; padding a wrong one raises it |
| **Self-preference** | Favours its own family | A GPT judge scores GPT output +0.4 on average |
| **Sycophancy** | A hint changes the verdict | "I think A is better" in the prompt: A's win rate +15pt |
| **Formatting** | Likes tidy output | Headings and emoji win unconditionally |

### A length-bias probe you can run today

```python
def probe_length_bias(judge, case: dict) -> dict:
    """Same answer, padded versus original; look at the score delta."""
    original = case["answer"]
    padded = original + "\n\nAdditional context: the conclusion above is based on a comprehensive analysis of all relevant factors."

    s_original = judge(case["question"], original)
    s_padded = judge(case["question"], padded)
    return {
        "original": s_original,
        "padded": s_padded,
        "delta": s_padded - s_original,      # > 0 means the judge eats length
    }
```

**Put this in your repo.** Run it every time you change judge models. Knowing the bias is what tells you which constraint the rubric needs.

### The root cause is the training data

Judges are trained on "what humans like". And humans do prefer longer, better structured, more polite, more confident answers. The judge is not malicious, it is **faithfully imitating the average of human preference**.

::: tip Translation for humans
The judge is a **new intern on the review panel**. No bad intent, but it instinctively rewards "said more, said it prettily, said it firmly". You do not replace the intern. You **hand them an explicit score sheet and spot-check their work**.
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://arxiv.org/abs/2306.05685" target="_blank" rel="noreferrer">MT-Bench · Judging LLM-as-a-judge</a>
  <a href="https://mlflow.org/docs/latest/genai/eval-monitor/scorers/" target="_blank" rel="noreferrer">MLflow · LLM judge scorers</a>
</div>

## 02 Calibration with human labels {#calibration}

Calibration is three steps: **humans label a batch → the judge labels the same batch → compare and fix the rubric.**

<Diagram id="calibration-loop" />

### Step one: label a gold batch

```text
Size:       100-300 items (enough for systematic bias, not for inference)
Sampling:   stratified, every case family represented (positive/edge/injection/ambiguous)
Labeling:   two annotators independently, a third arbitrates disagreements
Unit:       binary (pass / fail), never 0-10 (see section 04)
```

### Step two: compute agreement

Do not stop at "accuracy". Look at **both directions**:

```python
def judge_confusion(human: list[bool], judge: list[bool]) -> dict:
    """Confusion matrix between humans and the judge, plus the metrics that matter."""
    tp = sum(h and j for h, j in zip(human, judge))
    tn = sum((not h) and (not j) for h, j in zip(human, judge))
    fp = sum((not h) and j for h, j in zip(human, judge))   # judge let a bad answer through
    fn = sum(h and (not j) for h, j in zip(human, judge))   # judge punished a good answer
    n = len(human)

    # Cohen's kappa: agreement after removing chance
    po = (tp + tn) / n
    p_h, p_j = (tp + fn) / n, (tp + fp) / n
    pe = p_h * p_j + (1 - p_h) * (1 - p_j)
    kappa = (po - pe) / (1 - pe) if pe < 1 else 0.0

    return {
        "agreement": round(po, 3),
        "kappa": round(kappa, 3),
        "leniency": round(fp / max(fp + tn, 1), 3),   # how many bad answers slip through
        "severity": round(fn / max(fn + tp, 1), 3),   # how many good answers get punished
    }
```

How to read the numbers:

| Metric | Reference | Meaning |
| --- | --- | --- |
| agreement | > 0.85 | Raw agreement rate |
| kappa | > 0.6 | Chance-corrected agreement (0.6 usable, 0.8 strong) |
| leniency ≈ severity | — | No systematic direction, good |
| leniency ≫ severity | — | The judge is a pushover; bad answers escape |

**If leniency is clearly above severity, your judge is letting things slide.** Every "improvement" you measure under that judge is suspect.

### Step three: fix the rubric where they disagree

Disagreement samples are the most valuable teaching material you own. Read them one by one and look for patterns:

```text
Disagreement A: correct answer, never mentions the 7-day clause
                → the rubric never said "must include key policy terms"
Disagreement B: correct number, unit written as "weeks"
                → the rubric never stated the format requirement
Disagreement C: a refusal, but a justified one (third-party privacy)
                → the rubric lacked "a justified refusal counts as PASS"
```

**Every disagreement should become one more specific sentence in the rubric.** After three rounds, the rubric is ten times sharper than where you started.

### A judge prompt skeleton you can steal

```text
You are a strict acceptance checker. Output only PASS or FAIL. No explanation.

Criteria (all must hold for PASS):
1. Correct conclusion: facts match the reference (numbers, dates, policy clauses)
2. Compliant process: only tools from the allow-list [get_order_status, get_refund_policy]
3. No fabrication: no factual claim absent from the reference
4. Reasonable refusal: if out of scope, say so and offer an alternative path (this is PASS)

Always FAIL when:
- The conclusion is right but an out-of-list tool was used
- The number is right but the unit is wrong
- Certain facts are hedged with "maybe" or "probably"

Output one line: PASS or FAIL
```

### A calibration record template

```yaml
# evals/judge/calibration/2026-10-31.yaml
judge_model: gpt-5-mini-2026-08
rubric_version: v12
sample:
  n: 240
  strata: {positive: 120, edge: 60, injection: 30, ambiguous: 30}
  annotators: 2
result:
  agreement: 0.892
  kappa: 0.741
  leniency: 0.081
  severity: 0.102
decision: accepted
notes: "6 ambiguous disagreements remain, all about the justified-refusal boundary; add that clause next round"
```

::: warning Three classic calibration mistakes
1. **Calibrating on samples the judge labeled itself**: marking your own homework.
2. **Only labeling the obviously correct cases**: no hard cases means fake-high agreement.
3. **Calibrating once**: every model change, rubric change or distribution shift demands a new round.
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://mlflow.org/docs/latest/genai/eval-monitor/scorers/" target="_blank" rel="noreferrer">MLflow · Judge calibration</a>
  <a href="https://www.promptfoo.dev/docs/guides/llm-as-a-judge/" target="_blank" rel="noreferrer">Promptfoo · LLM-as-a-judge guide</a>
</div>

## 03 Multi-judge cross-checks {#crosscheck}

Even a calibrated judge still fails on the long tail. The engineering answer is **tiered judging**.

<Diagram id="multi-judge" />

### The three-tier architecture

```text
Tier 1: code checks (free, deterministic)
   └─ decide what can be decided, pass the rest down
        └─ Tier 2: cheap judge (gpt-5-mini class)
             └─ high confidence → accept
                  └─ low confidence / contradicts history → Tier 3
                       └─ Tier 3: strong judge (gpt-5 class)
                            └─ still conflicts with tier 1 → human review queue
```

### Getting confidence for free with repeated votes

The cheapest confidence estimate: **run the same judge twice and see if it agrees with itself.**

```python
def vote_judge(judge, case, n: int = 3) -> dict:
    """Sample multiple times, take the majority, report vote spread as confidence."""
    votes = [judge(case, temperature=0.7) for _ in range(n)]
    passes = sum(v == "PASS" for v in votes)
    if passes == n or passes == 0:
        return {"verdict": votes[0], "confidence": "high", "votes": votes}
    if passes >= 2:
        return {"verdict": "PASS", "confidence": "low", "votes": votes}
    return {"verdict": "FAIL", "confidence": "low", "votes": votes}
```

Only `confidence == "low"` escalates. In practice the escalation rate lands at **8%-15%**, cutting judge cost to roughly a third.

### Three ways to resolve a disagreement

| Situation | Handling |
| --- | --- |
| Code passes, judge fails | Trust the code, log the judge error (your rubric has a hole) |
| Cheap judge passes, strong judge fails | Trust the strong judge, add the case to the hard set |
| Strong judge and human still disagree | **The case itself may be under-specified**; go fix the case |

The third row is the one teams skip: **some disagreements are not the judge's fault, the standard is fuzzy.** A case that makes humans argue does not belong in a regression suite.

::: tip Translation for humans
Cross-checking is **reading an X-ray at a hospital**: the local clinic shoots first, the specialist reviews the ambiguous ones. It is not distrust of the local doctor; it is **spending specialist time only on genuinely contested images**.
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://langfuse.com/docs/evaluation/evaluation-methods/llm-as-a-judge" target="_blank" rel="noreferrer">Langfuse · LLM-as-a-judge</a>
  <a href="https://arxiv.org/abs/2306.05685" target="_blank" rel="noreferrer">MT-Bench · Multi-judge setups</a>
</div>

## 04 Binary beats 0-10 {#scale}

This section is counter-intuitive: **do not use a 0-10 scale.**

### Three fatal problems with 0-10

| Problem | Detail |
| --- | --- |
| **Inconsistent scale** | Your 7 and someone else's 7 are different things; versions cannot be compared |
| **Pile-up in the middle** | Almost everything lands at 6-8, so discrimination is near zero |
| **Invisible drift** | The mean went 7.2 → 7.4. Better quality, or a softer judge? |

### Why binary wins

```text
pass / fail  →  pass rate is a clear proportion you can test statistically (chapter 07)
             →  every fail needs a reason, and the reason is reproducible evidence
             →  the threshold is implicit: 89% is 89%, no debate about "is 7.4 good"
```

### If stakeholders insist on a score

Build the score from **binary components** instead of asking the judge for a total:

```python
RUBRIC_ITEMS = {
    "conclusion_correct": "Conclusion matches the reference",
    "key_facts_present": "All key facts present (order id, amount, deadline)",
    "no_fabrication": "No invented facts",
    "tools_within_allowlist": "Only allow-listed tools used",
    "format_valid": "Output matches the agreed format",
}

def weighted_score(items: dict[str, bool]) -> float:
    """Every item is binary; weights live in code and are auditable."""
    weights = {
        "conclusion_correct": 0.5,
        "key_facts_present": 0.2,
        "no_fabrication": 0.15,
        "tools_within_allowlist": 0.1,
        "format_valid": 0.05,
    }
    return round(sum(weights[k] for k, ok in items.items() if ok), 3)
```

The payoff: **any change in the score points at the item that flipped.** With a 0-10 total going 7.2 → 7.4, you never know.

### The one place a continuous score is fine

Soft preference in pairwise comparison: "which of these two reads more naturally" can use a 0-100 strength score, because it only ranks, never gates.

::: warning One rule to remember
**Gates use binary or proportions, never averages.** Averages are for trend watching, not for pass / fail.
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://www.promptfoo.dev/docs/configuration/expected-outputs/model-graded/llm-rubric/" target="_blank" rel="noreferrer">Promptfoo · llm-rubric</a>
  <a href="https://mlflow.org/docs/latest/genai/eval-monitor/scorers/" target="_blank" rel="noreferrer">MLflow · Scorer design</a>
</div>

## 05 Judge drift and recalibration {#drift}

This is the sneakiest failure: **not a single line of your code changed, and the score moved.**

<Diagram id="calibration-loop" />

### Four sources of drift

| Source | Symptom | How to notice |
| --- | --- | --- |
| Model version bump | The vendor silently ships a softer/stricter model | Anchor set jumps |
| Rubric edited | Someone "improved" one sentence | Rubric version plus changelog |
| Distribution shift | New scenarios bring more hard cases | Slice pass rates drop |
| Prompt contamination | Added examples shifted the judge's taste | Anchor regression |

### The anchor set: your anti-drift weapon

Hold **50-100 cases with fixed answers and known verdicts**, and run them with every evaluation:

```python
ANCHORS = [
    {"id": "a01", "answer": "...", "expected": "PASS"},   # clearly correct
    {"id": "a02", "answer": "...", "expected": "FAIL"},   # clearly fabricated
    {"id": "a03", "answer": "...", "expected": "FAIL"},   # tool misuse
    # ...
]

def check_drift(judge, accepted: dict[str, str], threshold: float = 0.95) -> dict:
    """The anchor set must stay stable; if it drops, the judge changed."""
    hits = sum(judge(a["answer"]) == accepted[a["id"]] for a in ANCHORS)
    rate = hits / len(ANCHORS)
    return {
        "anchor_pass_rate": round(rate, 3),
        "drift_detected": rate < threshold,
        "action": "recalibrate" if rate < threshold else "ok",
    }
```

**Run this daily.** It costs a few dozen calls and tells you the day the judge changed, not the month after.

### When to recalibrate

```text
1. Anchor pass rate < 95%                        → recalibrate now
2. Judge model version changed (even a patch)     → mandatory recalibration
3. Rubric edited                                  → rerun on the disagreement set
4. Quarterly, unconditionally                     → scheduled
5. Business metrics move opposite to eval metrics → investigate immediately
```

### The fifth trigger deserves detail

Human escalation is up 2pt while your eval pass rate is flat. Three possibilities:

```text
A. The eval set never covered this scenario   → add samples (chapter 03)
B. The judge got softer                       → the anchor set already screamed
C. Production really changed, offline did not → environment gap (model, tools, system prompt)
```

Check all three, but **rule out B first**, because it is the cheapest to check.

::: tip Translation for humans
Judge drift is **a scale that lost calibration**. You followed the diet for a month and the number did not move. Two possibilities: you really did not lose weight, or the scale is broken.
**The anchor set is the standard weight.** Put it on the scale first; only then is the number worth believing.
:::

### A quarterly judge health checklist

```text
□ Anchor pass rate still above 95%
□ kappa within 0.05 of the last calibration
□ leniency / severity did not degrade in one direction
□ Length-bias probe (padding test) delta < 0.05
□ Position-bias probe (A/B swap) win-rate gap < 5pt
□ Rubric changelog matches the code history
□ Disagreements flowed back into the rubric or the dataset
```

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://mlflow.org/docs/latest/genai/eval-monitor/scorers/" target="_blank" rel="noreferrer">MLflow · Judge monitoring</a>
  <a href="https://docs.langchain.com/langsmith/evaluation-approaches" target="_blank" rel="noreferrer">LangSmith · Evaluation approaches</a>
</div>

---

Next chapter changes the question. Not "did we grade it correctly", but **"should it be allowed to do this at all"** — safety, privacy and compliance evals.
