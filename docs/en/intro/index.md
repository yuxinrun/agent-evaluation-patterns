---
title: "00 · Opening: the QA floor for agents"
description: How agent evals differ from LLM evals, the three failure stories that follow without them, the four goals, and how evaluation connects to observability.
outline: [2, 3]
---

# 00 · Opening: the QA floor for agents

You have seen this. Wednesday afternoon someone says in the channel “I tuned the prompt, feels much smarter”, so it ships. Friday afternoon support starts asking “why does it keep asking for my order number again?” — and you open the logs and find nothing you can read.

That is not a lazy team. That is a factory with no inspection line.

No factory ships parts without a test bench. Yet most AI teams ship agents exactly that way, every week.

## 01 Shipping without evals is gambling {#pain}

An analogy first.

The noodle shop downstairs changes its recipe — less salt, “healthier”. The owner tries nothing, ships it to the whole shop. By next day:

- a third of the regulars say it tastes of nothing;
- one says nothing and never comes back;
- the owner wants to taste it herself, but today's pot is already in the bin.

The problem is not the recipe change. The problem is that **nothing told her whether it got better or worse**. She has “feels healthier”; the customers have “feels bland”. Both are opinions. Nobody can settle it.

Agent teams live in that same shop every day, with higher stakes.

<Diagram id="eval-gap" />

The worst line in that loop is “no clue why”. When you cannot say where it regressed:

| What you want to do | Without evals | With evals |
| --- | --- | --- |
| Judge a new prompt | Three people try five cases each and vote | Run 300 cases: success 82.1% → 91.4% |
| Switch models | Only dare to try it on a side feature | Key metrics hold, cost drops 40%, switch today |
| Debug an incident | Grep logs, guess, poke the code | Open the failing trace: step 3 had bad tool args |
| Roll back | Afraid it gets worse | The baseline is right there; rollback is measured |
| Report upward | “The experience feels better” | “Task success +9.3pt, wrong tool calls −62%, cost +0.4¢/run” |

::: tip Translation for humans
**Evaluation replaces “I think it got better” with “the data says it got better”.** It will not make your agent smarter. It guarantees that every improvement has evidence and every regression gets caught.
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents" target="_blank" rel="noreferrer">Anthropic · Demystifying evals for AI agents</a>
</div>

## 02 LLM evals vs agent evals {#difference}

This is the most important comparison in the book. Many teams assume “agent evals = run the model evals again”, then wonder why the score is 4.6/5 while production keeps burning.

<Diagram id="llm-vs-agent" />

Where it actually differs:

**One: the object changes.** An LLM eval takes text and returns text. An agent eval takes a **goal, an environment and a toolset**, and returns **an answer plus a whole trajectory** — a dozen model calls, five tool calls, two self-corrections.

**Two: the failure modes change.** A wrong answer is just wrong. Agents fail in three sneakier ways:

| Failure type | What it looks like | Visible in the final answer? |
| --- | --- | --- |
| Wrong outcome | The answer is simply wrong | Yes |
| Wrong process | Right answer, but six irrelevant tool calls and a near-miss write | **No** |
| Wrong side effect | Right answer, but it silently changed the user's address | **No, and expensive** |

**Three: the cost structure changes.** One LLM eval = one call plus one grading call. One agent eval = dozens of calls, a trajectory grade, and possibly an environment reset. A thousand cases differ by two orders of magnitude on the bill.

**Four: reproducibility changes.** LLM inputs are static. Agents **mutate the environment** — writing rows, sending messages, opening tickets. Run the same case twice and the initial state is already different. That is why agent evaluation starts with snapshot and rollback, covered in chapter 05.

::: warning The most common misjudgement
“I had an LLM grade the final answers, average 4.6/5, looks great.” This is what nearly every team does first, and it is the first entry in the chapter 13 pitfall list: **grading only the final answer is handing a trophy to a car that hit the guardrail but crossed the finish line.**
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://docs.langchain.com/langsmith/evaluation-approaches" target="_blank" rel="noreferrer">LangSmith · Evaluation approaches</a>
  <a href="https://developers.openai.com/api/docs/guides/agent-evals" target="_blank" rel="noreferrer">OpenAI · Agent evals</a>
</div>

## 03 Three real failure stories {#disasters}

All three are anonymised, but the structure is real — you will meet the same shapes.

### Story one: silent hallucination, only on the long tail

A support agent answers return and refund policy. The team tested 50 “standard questions”, all green. Two weeks later a screenshot lands in the channel: the agent confidently promises “90-day no-questions returns”.

The real policy is 7 days. The model “reasonably inferred” a number from training data.

Why did the suite miss it? Every case asked *how* to return something. None asked *how many days*. **Hallucination often needs “missing knowledge plus a follow-up detail question”, and the test set happened to contain no such pair.**

The fix is not one prompt sentence:

1. Make policy facts their own case family (chapter 03 taxonomy);
2. Use a **code grader** asserting every number in the answer comes from retrieved policy text (chapter 04);
3. Add a hard system rule: if no policy snippet was retrieved, emit no numeric terms at all.

### Story two: tool thrash, $800 in one day

A data-analysis agent with a SQL tool. A user asks something vague, and the agent starts exploring: query, dislike the result, re-query, dislike, re-query… 47 SQL calls in one session, 39 of them full table scans.

Nobody had ever tracked “average tool calls per trace”, so this surfaced on the invoice.

Fixes: add **process metrics** (tool calls per trace, repeat-call rate — chapter 02); add **loop detection** (same tool with similar args three times, abort — chapter 05); add a **budget gate** (per-session token and call caps with graceful degradation).

### Story three: better every week, until it collapsed

An internal knowledge assistant iterated prompts weekly, each round “clearly better”. Three months later new hires said it answered confidently but nonsensically. The changelog showed: iteration 4 deleted “say you don't know when unsure” (to make it “braver”), iteration 7 swapped to a smaller model (to save money). Together: **refusal rate 18% → 1%, fabrication 3% → 21%**.

Nobody noticed, because **no version was ever tested end to end, and no two versions were ever compared**.

Fixes: run the same regression set against a baseline every change (chapter 06); include “does it refuse when it should” as a metric (chapter 02); change one variable at a time (chapter 07).

::: warning What the three stories share
None of them is “the model is bad”. All of them are **no measurement**. Every incident cost far more than building the eval suite would have.
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents" target="_blank" rel="noreferrer">Anthropic · Demystifying evals for AI agents</a>
  <a href="https://juejin.cn/tag/AI" target="_blank" rel="noreferrer">Juejin · agent eval post-mortems</a>
</div>

## 04 The four goals of agent evals {#goals}

Evaluation is not “having a score”. It answers four different questions. Knowing which one you are answering decides how big the system should be.

| Goal | Question it answers | Typical means | Frequency |
| --- | --- | --- | --- |
| Regression defence | Did my change break something that worked? | Fixed regression set, baseline diff, CI gate | Every commit |
| Release acceptance | Can this version ship? | Smoke set, threshold gates, human spot checks | Every release |
| Experiment | Which of A and B is better? | Single-variable A/B with significance | When in doubt |
| Incident capture | How does this outage become a defence? | Failing traces into the dataset with tags | Every incident |

### Regression defence: cheapest, highest return

The best value in the entire field, and the most skipped. You do not need 5,000 cases. **Thirty cases covering your core paths will stop most silly regressions.**

### Release acceptance: set hard lines

Not every metric must be perfect, but some must never be crossed: task success not below 80%, PII leakage exactly 0, wrong-tool rate under 5%. That is the SLO gate in chapter 02.

### Experiments: stop voting by taste

When one engineer says “A sounds more natural” and another says “B is more accurate”, do not vote. Run a single-variable comparison. Chapter 07 gives the design and the significance test.

### Incident capture: turn outages into assets

Every production incident should become a permanent case. The bar is simple: **the same failure twice is your fault.**

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://docs.langchain.com/langsmith/evaluation-approaches" target="_blank" rel="noreferrer">LangSmith · Evaluation approaches</a>
  <a href="https://promptfoo.dev/docs/guides/llm-as-a-judge/" target="_blank" rel="noreferrer">Promptfoo · LLM-as-a-judge</a>
</div>

## 05 Observability traces, evals score them {#loop}

This is where this book parts ways with “here is a static dataset” tutorials: **your eval data should grow out of production traffic, not only out of human imagination.**

<Diagram id="eval-loop" />

Five segments, five different engineering problems:

| Stage | Key question | Engineering move | Chapters |
| --- | --- | --- | --- |
| Production traffic | Do we keep a replayable record? | OTel spans, trace IDs through every hop, inputs persisted | 08, 12 |
| Sampling | Which traces deserve to become cases? | Failure, thumbs-down, high-score and stratified sampling | 03, 12 |
| Auto-grading | What is graded, by whom? | Code assertions first, judges as backstop | 04 |
| Fix | Prompt, tool or model? | Cluster failures, see which span they concentrate in | 05, 13 |
| Regress | Did the fix break something else? | Baseline diff, gates, significance | 06, 07 |

**The division of labour in one line:**

```text
Observability  →  what happened: steps taken, tools called, money spent
Evaluation     →  whether that counts as good: right result, sane path, clean side effects
```

Without observability, evals run on hand-written samples and never catch up with real failures.
Without evaluation, observability is a very professional-looking log nobody can grade.

::: tip Translation for humans
Observability is the **dashcam**; evaluation is the **traffic officer assigning fault**. A perfect recording with no ruling means the crash happened for nothing.
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents" target="_blank" rel="noreferrer">Anthropic · Demystifying evals for AI agents</a>
  <a href="https://langfuse.com/docs/evaluation/overview" target="_blank" rel="noreferrer">Langfuse · Evaluation overview</a>
  <a href="https://arize.com/docs/phoenix" target="_blank" rel="noreferrer">Arize Phoenix · OTel-native evals</a>
</div>

## 06 Scope and where this book sits {#scope}

### What is covered

Seventeen chapters, from “what is evaluation” to “100k eval runs a day”:

```text
Foundations   00 opening → 01 concepts → 02 metrics
Ground work   03 datasets
Core          04 four graders → 05 trajectory evals
Engineering   06 CI gates → 07 A/B experiments
Integration   08 component evals → 09 platform choice
Governance    10 judge calibration → 11 safety
Production    12 online evals → 13 pitfalls → 14 demos
Scale         15 high concurrency → 16 ecosystem
```

### What is not covered

Being clear about the boundary beats overselling:

- **No model training.** Evaluation is not fine-tuning; no SFT or DPO here.
- **No agent construction.** That is [better-agent](https://yuxinrun.github.io/better-agent/).
- **No observability platform build-out.** That is [agent-observability-patterns](https://yuxinrun.github.io/agent-observability-patterns/); we consume its data.
- **No vendor lock-in.** Every demo has an equivalent elsewhere.

### Where it sits in the ecosystem

<Diagram id="eval-stack" />

The seven pieces:

| Repo | Responsibility | Relationship to evals |
| --- | --- | --- |
| [better-agent](https://yuxinrun.github.io/better-agent/) | Single-agent loop, tools, context | The system under test, and the batch entry point |
| [agent-observability-patterns](https://yuxinrun.github.io/agent-observability-patterns/) | Traces, metrics, debugging | Raw material for eval sets |
| **agent-evaluation-patterns** | Datasets, graders, trajectory verdicts, gates | This book |
| [agent-memory-patterns](https://yuxinrun.github.io/agent-memory-patterns/) | Tiered memory and retrieval | Memory correctness needs its own suite |
| [a2a-patterns](https://yuxinrun.github.io/a2a-patterns/) | Cross-agent collaboration | Multi-agent tasks need end-to-end acceptance |
| [mcp-patterns](https://yuxinrun.github.io/mcp-patterns/) | Tool standardisation and permissions | Tool output stability is measurable |
| [llm-gateway-patterns](https://yuxinrun.github.io/llm-gateway-patterns/) | Routing, limits, cost, audit | Source data for multi-model comparison |

### A minimal eval you can run in 30 seconds

Here is the skeleton, so you can feel what eval code looks like. Every later chapter bolts a part onto it.

```python
# minimal_eval.py — no framework, just dataset → run → grade → summarise
import json
from dataclasses import dataclass

@dataclass
class Case:
    id: str
    question: str
    must_call: str          # expected tool name
    must_contain: list[str] # facts that must appear in the answer

DATASET = [
    Case("refund-01", "Can I return the headphones I bought?", "get_order", ["7 days"]),
    Case("refund-02", "Can I still return after 7 days?", "get_refund_policy", ["not supported", "contact support"]),
]

def run_agent(question: str) -> dict:
    """Placeholder: swap in your agent, returning answer plus tool calls."""
    return {
        "answer": "Yes, returns are free within 7 days.",
        "tool_calls": [{"name": "get_order", "args": {"order_id": "A1024"}}],
    }

def grade(case: Case, output: dict) -> dict:
    """Code checks first: cheap, stable, explainable."""
    called = [c["name"] for c in output["tool_calls"]]
    return {
        "tool_ok": case.must_call in called,
        "facts_ok": all(k in output["answer"] for k in case.must_contain),
        "turns": len(called),
    }

rows = []
for case in DATASET:
    out = run_agent(case.question)
    rows.append({"id": case.id, **grade(case, out)})

passed = sum(r["tool_ok"] and r["facts_ok"] for r in rows)
print(json.dumps({
    "total": len(rows),
    "passed": passed,
    "success_rate": round(passed / len(rows), 3),
}, indent=2))
```

Output:

```text
{
  "total": 2,
  "passed": 2,
  "success_rate": 1.0
}
```

Unglamorous, but it already contains everything: **dataset, system under test, grading logic, summary metric**. The remaining sixteen chapters are engineering each step.

### Chapter checklist

- [ ] “Three colleagues tried it and liked it” is feedback, not measurement.
- [ ] Do not build a platform first. Get thirty runnable cases.
- [ ] Do not grade only the final answer; the trajectory is where incidents live.
- [ ] Do not change versions without a baseline, or you will never know your direction.
- [ ] Do not build evaluation and observability as two systems. They share one trace.

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents" target="_blank" rel="noreferrer">Anthropic · Demystifying evals for AI agents</a>
  <a href="https://openai.github.io/openai-agents-python/" target="_blank" rel="noreferrer">OpenAI Agents SDK</a>
  <a href="https://docs.langchain.com/langsmith/trajectory-evals" target="_blank" rel="noreferrer">LangSmith · Trajectory evals</a>
</div>

---

Next chapter starts from the mental model underneath everything: how many layers does one agent task actually have?
