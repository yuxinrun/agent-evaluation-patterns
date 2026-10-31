---
title: 04 · The four grader patterns
description: Deterministic code checks, LLM-as-judge, pairwise comparison, human review with kappa, hybrid grading ratios, and a selection table you can paste into your docs.
outline: [2, 3]
---

# 04 · The four grader patterns

This is the most important chapter in the book.

The previous three chapters covered **what to evaluate**. This one covers **how to judge** — and with the same data and the same agent, a different grading method can produce the opposite conclusion.

The conclusion first, the detail after:

```text
If code can decide, never ask a model
If binary works, never use a 0-10 score
If you can compare, do not score absolutely
Humans are not a fallback, they are the calibration rig
```

<Diagram id="grader-map" />

## 01 Deterministic code checks {#code}

### The idea

**Write “what counts as correct” into code.** Return PASS or FAIL, with no room for interpretation.

Three properties make it the first line of defence:

| Property | Meaning | Payoff |
| --- | --- | --- |
| Zero cost | No model call | 1,000 cases cost essentially nothing |
| Reproducible | Same input, same output | CI gates never flake |
| Millisecond latency | Pure local computation | Smoke set finishes in a minute |

### Four common shapes

**Shape one: JSON Schema**

```python
from jsonschema import validate, ValidationError

ORDER_SCHEMA = {
    "type": "object",
    "required": ["order_id", "status", "items"],
    "properties": {
        "order_id": {"type": "string", "pattern": "^A\\d{4,}$"},
        "status": {"enum": ["pending", "shipped", "delivered", "refunded"]},
        "items": {"type": "array", "minItems": 1},
    },
    "additionalProperties": False,
}

def check_schema(output: dict) -> dict:
    try:
        validate(instance=output, schema=ORDER_SCHEMA)
        return {"name": "schema", "pass": True}
    except ValidationError as e:
        return {"name": "schema", "pass": False, "note": e.message}
```

**Shape two: numeric and factual assertions**

```python
def check_no_forbidden_numbers(answer: str, forbidden: list[str]) -> dict:
    hits = [f for f in forbidden if f in answer]
    return {"name": "no_forbidden_numbers", "pass": not hits, "note": f"hits={hits}"}

def check_numbers_supported(answer: str, policy_text: str) -> dict:
    """Every number in the answer must exist in the policy text."""
    numbers = set(re.findall(r"\d+(?:\.\d+)?", answer))
    missing = [n for n in numbers if n not in policy_text]
    return {"name": "numbers_supported", "pass": not missing, "note": f"unsupported={missing}"}
```

**Shape three: tool argument assertions**

```python
def check_tool_args(trace, tool: str, required: dict) -> dict:
    """Not just 'did it call' but 'did it pass the right arguments'."""
    for run in trace.runs:
        if run.get("kind") != "tool" or run.get("tool") != tool:
            continue
        args = run.get("args", {})
        bad = [k for k, v in required.items() if args.get(k) != v]
        if not bad:
            return {"name": f"args:{tool}", "pass": True}
        return {"name": f"args:{tool}", "pass": False, "note": f"mismatch={bad} args={args}"}
    return {"name": f"args:{tool}", "pass": False, "note": "tool not called"}
```

**Shape four: state and side-effect assertions**

```python
def check_final_state(db_snapshot: dict, expected: dict) -> dict:
    """Compare database state after the run; catches right-answer-wrong-writes."""
    diffs = {k: (expected[k], db_snapshot.get(k)) for k in expected
             if db_snapshot.get(k) != expected[k]}
    return {"name": "final_state", "pass": not diffs, "note": str(diffs)}
```

::: warning Code checks are not “the shallow ones”
People assume code checks only cover formatting. In agent evaluation, **the most valuable assertions are almost all code checks**: right tool, right args, how many calls, any dirty writes, any PII leaked.
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents" target="_blank" rel="noreferrer">Anthropic · Demystifying evals for AI agents</a>
  <a href="https://deepeval.com/docs/metrics-introduction" target="_blank" rel="noreferrer">DeepEval · Deterministic metrics</a>
</div>

## 02 The LLM-as-judge pattern {#judge}

Code can judge structure, not meaning. For meaning you need a judge model.

<Diagram id="judge-flow" />

### How it works: turn the rubric into an executable prompt

```text
Input:  case + agent output (+ trajectory)
Judge:  a model plus a rubric
Output: structured result {verdict, reason, evidence}
```

It works because **judging is easier than generating**. Writing a correct answer from scratch is hard; deciding whether an answer violates policy is comparatively easy.

### Choosing the judge model

| Scenario | Suggestion | Why |
| --- | --- | --- |
| High volume, first pass | Small / cheap model | Low unit price, filters 80% of obvious passes |
| Final verdict, disputed samples | Strong model | Wrong verdicts are expensive, worth paying for |
| Safety and compliance | Strong model plus rule re-check | Never a single point of judgement |
| Judging the judge | A different vendor's model | Avoids self-preference |

::: tip Translation for humans
A judge model is a **grader**. Weekly quizzes can be marked by a teaching assistant (cheap and fast); the final exam needs a senior teacher (expensive, accurate). And ideally the person marking the final exam is not the person who wrote it.
:::

### A judge implementation worth running in production

```python
import json

JUDGE_PROMPT = """You are a strict support-reply reviewer. Judge exactly one thing:
is the answer faithful to the retrieved policy?

[Question]
{question}

[Retrieved policy]
{context}

[Agent answer]
{answer}

Rules:
- PASS only if every claim about timing, money or conditions is supported by the policy text,
  and no policy detail outside the text is introduced.
- FAIL if any number or condition is absent from the policy, or a partial rule is stated as absolute.
- If the policy does not cover the question, the answer must say a human will confirm.

Return JSON only:
{{"verdict": "PASS" | "FAIL", "reason": "<one sentence>", "evidence": "<quote from policy or the invented part>"}}
"""

def llm_judge(client, case: dict, answer: str, context: str) -> dict:
    resp = client.chat.completions.create(
        model="gpt-5-mini",                     # cheap tier for high volume
        temperature=0,                          # determinism first
        response_format={"type": "json_object"},
        messages=[{"role": "user", "content": JUDGE_PROMPT.format(
            question=case["input"], context=context, answer=answer)}],
    )
    data = json.loads(resp.choices[0].message.content)
    return {
        "name": "faithfulness",
        "pass": data["verdict"] == "PASS",
        "note": f'{data["reason"]} | {data["evidence"]}',
        "cost": resp.usage.total_tokens,
    }
```

Four design choices, each one load-bearing:

| Choice | Why |
| --- | --- |
| `temperature=0` | Reduces variance so CI stays reproducible |
| Structured JSON output | Machine-consumable, and lets you measure judge failure rate |
| Mandatory `evidence` | A human can check whether the judge misread |
| One dimension | Highest compliance; judges obey short rubrics |

### The three-part judge prompt template

```text
[Role + single task]   You are an X reviewer. Judge only Y.
[Inputs]               case, context, agent output
[Rules]                sufficient conditions for PASS, and concrete FAIL examples
[Output]               JSON: verdict / reason / evidence
```

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://promptfoo.dev/docs/guides/llm-as-a-judge/" target="_blank" rel="noreferrer">Promptfoo · LLM-as-a-judge guide</a>
  <a href="https://langfuse.com/docs/evaluation/evaluation-methods/llm-as-a-judge" target="_blank" rel="noreferrer">Langfuse · LLM-as-a-judge</a>
  <a href="https://github.com/langchain-ai/openevals" target="_blank" rel="noreferrer">OpenEvals · create_llm_as_judge</a>
</div>

## 03 Pairwise comparison {#pairwise}

### Why pairwise is more stable than absolute scoring

Absolute scoring has a fatal flaw: **scores have no absolute coordinate system**. The same answer gets 7 in the morning and 6 in the afternoon; a different model shifts the whole scale by a point. So “A scores 7.2, B scores 7.5” is not a trustworthy sentence.

Pairwise changes the question: **not “how good is this” but “which of these two is better”**. Humans are far more stable on relative judgements than absolute ones.

<Diagram id="pairwise-flow" />

### Three biases you must handle

| Bias | Symptom | Handling |
| --- | --- | --- |
| **Position bias** | Judge prefers the first (or last) answer | Run both orders; keep only consistent verdicts; disagreement counts as a tie |
| **Length bias** | Longer answers win | State “detail is not correctness” in the rubric, or normalise for length |
| **Self-preference** | Judge favours its own family's output | Use a third-party judge, or two judges |

```python
def pairwise_judge(client, question, answer_a, answer_b, rubric) -> dict:
    """Swap positions; only consistent directions count as a vote."""
    def ask(first, second):
        resp = client.chat.completions.create(
            model="gpt-5",
            temperature=0,
            response_format={"type": "json_object"},
            messages=[{"role": "user", "content": f"""Compare two answers to the same question.
Question: {question}
Answer X: {first}
Answer Y: {second}
Rubric: {rubric}
Return JSON: {{"winner": "X" | "Y" | "TIE", "reason": "..."}}"""}],
        )
        data = json.loads(resp.choices[0].message.content)
        return data["winner"]

    first = ask(answer_a, answer_b)     # A first
    second = ask(answer_b, answer_a)    # B first

    if first == "TIE" or second == "TIE":
        return {"winner": "TIE", "valid": True}
    mapped = {"X": "A", "Y": "B"}[first]
    mapped_rev = {"X": "B", "Y": "A"}[second]
    return {"winner": mapped if mapped == mapped_rev else "TIE",
            "valid": mapped == mapped_rev}
```

Note the `valid` field: **the disagreement rate is itself data**. If 40% of samples flip when you swap positions, either the versions are indistinguishable or the judge is unstable — both conclusions are more useful than “A is slightly better”.

::: warning Pairwise cannot replace an absolute gate
Pairwise answers “which is better”, never “is it good enough”. Use it to decide whether to ship a new version, but keep absolute thresholds to protect the floor (chapter 02).
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://arxiv.org/abs/2306.05685" target="_blank" rel="noreferrer">MT-Bench / Chatbot Arena · Judging LLM-as-a-Judge</a>
  <a href="https://arxiv.org/abs/2403.04132" target="_blank" rel="noreferrer">Chatbot Arena · pairwise at scale</a>
</div>

## 04 Human review and kappa {#human}

Human review has two uses, and most teams only use the first:

1. **Direct grading** — pre-release spot checks, high-risk samples.
2. **Calibrating the machine** — producing ground truth for judges.

The second is the strategic one.

### Designing the annotation board

| Design point | Suggestion |
| --- | --- |
| Batch size | 30-50 samples (the most a human reads carefully in one sitting) |
| What is shown | Question, context, trajectory summary, final answer |
| Scoring | Binary PASS/FAIL plus a failure-type tag plus one line of reasoning |
| Blind | Hide which version produced it, to avoid anchoring |
| Double annotation | At least 10% of samples labelled independently by two people |

### Kappa: is the labelling trustworthy?

High raw agreement does not mean reliable — two people could both be guessing and happen to agree. Cohen's kappa removes the chance agreement:

```python
def cohen_kappa(a: list[int], b: list[int]) -> float:
    """Cohen's kappa for binary labels."""
    assert len(a) == len(b) and len(a) > 0
    n = len(a)
    p_observed = sum(x == y for x, y in zip(a, b)) / n
    p_a1 = sum(a) / n
    p_b1 = sum(b) / n
    p_expected = p_a1 * p_b1 + (1 - p_a1) * (1 - p_b1)
    if p_expected == 1:
        return 1.0
    return round((p_observed - p_expected) / (1 - p_expected), 3)
```

How to read it:

| Kappa | Meaning | What to do |
| --- | --- | --- |
| > 0.8 | Strong agreement | Usable as a calibration set for judges |
| 0.6-0.8 | Moderate | Inspect ambiguous samples, add rubric examples |
| 0.4-0.6 | Weak | The rubric or the samples are ambiguous |
| < 0.4 | Poor | Stop and settle “what counts as correct” first |

::: tip Translation for humans
Kappa is **how much two markers agree after discounting luck**. If two humans only agree 55% of the time, do not use those labels to grade a machine — you have no standard yourself.
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://mlflow.org/docs/latest/genai/eval-monitor/scorers/" target="_blank" rel="noreferrer">MLflow · Judge calibration with humans</a>
  <a href="https://docs.langchain.com/langsmith/home" target="_blank" rel="noreferrer">LangSmith · Annotation queues</a>
</div>

## 05 Hybrid grading {#hybrid}

No production system uses one grader. The correct shape is **layered composition**:

<Diagram id="hybrid-stack" />

### Three layers

| Layer | Who judges | What | Coverage | Cost per item |
| --- | --- | --- | --- | --- |
| L1 hard checks | Code | Format, tools, numbers, state, PII | 100% | ≈ 0 |
| L2 semantic judge | Cheap model | Faithfulness, relevance, tone | All or heavily sampled | Low |
| L3 deep review | Strong model / human | Disputed and high-risk samples | 5-10% | High |

**Order matters**: run L1 first and stop L1 failures from reaching L2. This one optimisation typically cuts judge spend by 20-40%.

```python
def grade_hybrid(case, trace, l1_checks, judge_fn, escalate_fn=None) -> dict:
    results = [c(trace) for c in l1_checks]
    if any(not r["pass"] for r in results):
        return {"verdict": "FAIL", "stage": "L1", "details": results}

    judged = judge_fn(case, trace)
    results.append(judged)
    if not judged["pass"] and escalate_fn:
        results.append(escalate_fn(case, trace))   # only disputed samples reach L3

    ok = all(r["pass"] for r in results)
    return {"verdict": "PASS" if ok else "FAIL", "stage": "L2", "details": results}
```

### A real cost profile

```text
3,000 samples
L1 code checks      3,000 × $0        = $0
  → 420 fail (14%), marked FAIL, never reach L2
L2 cheap judge      2,580 × $0.002    = $5.16
  → 310 marked FAIL
L3 strong model     310 × $0.02       = $6.20
  → 62 overturned (20% of disputed samples were judged wrong)
Human spot check    60 samples (10% of disputed)
Total ≈ $11.4 for 3,000 samples
```

All-strong-model judging would cost 3,000 × $0.02 = $60. **Same accuracy, one fifth the price.**

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://promptfoo.dev/docs/guides/llm-as-a-judge/" target="_blank" rel="noreferrer">Promptfoo · Layered judging</a>
  <a href="https://deepeval.com/docs/metrics-introduction" target="_blank" rel="noreferrer">DeepEval · Composable metrics</a>
</div>

## 06 Grader selection table {#selection}

A table you can paste into your team docs.

### By what you are judging

| Question | First choice | Backup | Never |
| --- | --- | --- | --- |
| Output matches JSON Schema | Code | — | LLM judge |
| Right tool chosen | Code | — | LLM judge |
| Tool args correct | Code | — | LLM judge |
| How many tool calls | Code | — | LLM judge |
| Any dirty writes | Code (state snapshot) | — | LLM judge |
| PII leaked | Code (regex + checksum) | Strong model re-check | Judge alone |
| Numbers grounded | Code (extract and match) | Judge assist | Answer only |
| Faithful to context | Judge | Human spot check | Keyword matching |
| Tone appropriate | Judge | Human | Code |
| Answered the actual question | Judge | — | Code |
| A vs B, which is better | Pairwise | Judge plus human | Absolute scoring |
| Refused when it should | Code (policy tags) | Judge | Success rate alone |

### By team stage

| Stage | Recommended mix | Why |
| --- | --- | --- |
| Just starting (0-1 month) | Code checks plus a 30-case smoke set | Fastest payoff, zero cost |
| Regression needed (1-3 months) | Code checks + cheap judge + baseline diff | Can block in CI |
| Subjective quality matters | Add pairwise + human calibration | Answers “which is better” |
| Platform | Three-layer hybrid + tiered judges + spot checks | Balanced cost and accuracy |

::: warning Three selection mistakes
1. **All judges**: expensive, slow, unstable, CI permanently red.
2. **All code**: only format, never “is the answer right”.
3. **Skipping humans**: nobody calibrated the judge, so after six months you still do not know if it works.
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://docs.langchain.com/langsmith/evaluation-approaches" target="_blank" rel="noreferrer">LangSmith · Evaluation approaches</a>
  <a href="https://www.braintrust.dev/docs/evaluation-quickstart" target="_blank" rel="noreferrer">Braintrust · Scorer selection</a>
  <a href="https://promptfoo.dev/docs/configuration/expected-outputs/model-graded/llm-rubric/" target="_blank" rel="noreferrer">Promptfoo · Assertion types</a>
</div>

---

Next chapter is where agent evaluation truly lives: trajectories. It decides whether you are evaluating an LLM or an agent.
