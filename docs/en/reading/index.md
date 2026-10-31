---
title: Sources and further reading
description: Official Anthropic, OpenAI and LangChain / LangSmith evaluation material, open-source eval platforms, key papers and practitioner write-ups, mapped to chapters.
outline: [2, 3]
---

# Sources and further reading

This book explains first, then goes deep. To dig into one area, read in the order below. Every section in the chapters also carries a `【Source】` line that opens the original page.

::: warning Links move
Official docs get reorganised and migrated. Prefer the stable article URLs and doc roots below; when something 404s, searching the site for a keyword (`trajectory eval`, `llm-rubric`, `agent evals`) beats memorising URLs.
:::

## 01 First-party material {#official}

### Anthropic / Claude

| Resource | What it covers | Chapters |
| --- | --- | --- |
| [Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) | The full engineering view: trajectory-level grading, dataset construction, scaling gradually | [00](/en/intro/), [03](/en/datasets/), [05](/en/trajectory/) |
| [Writing effective tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents) | Designing tool names, inputs and outputs so they can be evaluated | [08](/en/component-evals/#mcp) |
| [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) | Workflows vs agents, and the discipline of not over-engineering | [16](/en/ecosystem/#better-agent) |
| [Anthropic Engineering](https://www.anthropic.com/engineering) | The blog index: evals and context engineering live here | [01](/en/concepts/) |
| [Anthropic Research](https://www.anthropic.com/research) | Safety evaluation, red teaming and model behaviour | [11](/en/safety/) |

**How to read it**: start with Demystifying evals. The ideas this book keeps repeating — prefer code assertions over judges, measure pass@k and pass^k, grade the trajectory not just the answer — come straight from that piece.

### OpenAI

| Resource | What it covers | Chapters |
| --- | --- | --- |
| [Agent evals guide](https://developers.openai.com/api/docs/guides/agent-evals) | Defining tasks, traces and graders for agents | [01](/en/concepts/), [05](/en/trajectory/) |
| [Evals guide](https://developers.openai.com/api/docs/guides/evals) | Datasets, graders, runs and result management | [03](/en/datasets/), [09](/en/platforms/) |
| [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) | Runner, tools, guardrails and tracing | [14](/en/demos/#langsmith) |
| [OpenAI Platform Docs](https://platform.openai.com/docs/) | Model capabilities, structured outputs, tool calling | [04](/en/evaluators/#code) |

**The useful contrast**: Anthropic writes methodology and rollout discipline; OpenAI documents productised datasets and graders. One teaches you how to think, the other hands you parts.

### LangChain / LangSmith

| Resource | What it covers | Chapters |
| --- | --- | --- |
| [Agent Evaluation concepts](https://docs.langchain.com/langsmith/evaluation-approaches) | Final response, trajectory and single-step approaches | [01](/en/concepts/#graders) |
| [Trajectory evaluations](https://docs.langchain.com/langsmith/trajectory-evals) | Exact, in-order, any-order and subset matching | [05](/en/trajectory/#match) |
| [Evaluate complex agents](https://docs.langchain.com/langsmith/evaluate-complex-agent) | Organising evals for multi-turn, long-horizon agents | [05](/en/trajectory/#reasonable) |
| [LangSmith docs](https://docs.langchain.com/langsmith/home) | Datasets, experiments and annotation queues | [09](/en/platforms/#langsmith) |

## 02 Open-source platforms and libraries {#opensource}

| Project | What it solves | What to steal |
| --- | --- | --- |
| [Promptfoo](https://www.promptfoo.dev/docs/configuration/expected-outputs/model-graded/llm-rubric/) | Declarative batch evals with CI diffs | The `llm-rubric` assertion format and the matrix report |
| [Promptfoo · LLM-as-a-judge guide](https://promptfoo.dev/docs/guides/llm-as-a-judge/) | Writing judge prompts that hold up | Splitting rubric dimensions, few-shot calibration |
| [Promptfoo · GitHub Action](https://promptfoo.dev/docs/integrations/github-action/) | Hooking evals onto pull requests | The block-on-failure workflow skeleton |
| [DeepEval](https://deepeval.com/docs/metrics-introduction) | pytest-style evaluation for Python | `assert_test()` ergonomics, composable metrics |
| [OpenEvals](https://github.com/langchain-ai/openevals) | LangChain's open grader collection | Grader interface abstraction, `create_llm_as_judge` |
| [Braintrust](https://www.braintrust.dev/docs/evaluation-quickstart) | Experiment management and scoring | Side-by-side experiment views, dataset versions |
| [Arize Phoenix](https://arize.com/docs/phoenix) | Open-source observability plus evals | OTel-native traces, span-level scores |
| [Langfuse](https://langfuse.com/docs/evaluation/overview) | Observability and evals, self-host friendly | The Trace → Dataset → Evaluator flow |
| [Langfuse · LLM-as-a-judge](https://langfuse.com/docs/evaluation/evaluation-methods/llm-as-a-judge) | Online sampled scoring as a product | Samplers and the async scoring queue |
| [MLflow · Scorers](https://mlflow.org/docs/latest/genai/eval-monitor/scorers/) | Judge plus human calibration loop | Measuring judge agreement with humans |

::: tip How to read an eval codebase
Do not read all of it. Read **three functions**: how `evaluate()` walks the dataset, how `grade()` produces a structured result, and how `report()` computes baseline deltas. That is the whole evaluation model.
:::

## 03 Key papers and benchmarks {#papers}

| Paper / benchmark | Why it matters | Chapters |
| --- | --- | --- |
| *Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena* ([arXiv:2306.05685](https://arxiv.org/abs/2306.05685)) | The canonical study of position, verbosity and self-preference bias | [10](/en/judge/#bias) |
| *τ-bench* ([arXiv:2406.12045](https://arxiv.org/abs/2406.12045)) | Tool-agent-user interaction in realistic business domains | [05](/en/trajectory/), [07](/en/experiments/#significance) |
| *WebArena* ([arXiv:2307.13854](https://arxiv.org/abs/2307.13854)) | End-to-end web tasks where final state is checkable | [11](/en/safety/#redteam) |
| *AgentBench* ([arXiv:2308.03688](https://arxiv.org/abs/2308.03688)) | Multi-environment agent benchmark, exposes inflated single-turn scores | [02](/en/metrics/#outcome) |
| *SWE-bench* ([arXiv:2310.06770](https://arxiv.org/abs/2310.06770)) | Verifiable grading by running the tests | [04](/en/evaluators/#code) |
| *Chatbot Arena* ([arXiv:2403.04132](https://arxiv.org/abs/2403.04132)) | Pairwise comparison with Elo / Bradley-Terry at scale | [04](/en/evaluators/#pairwise) |
| *HELM* ([arXiv:2211.09110](https://arxiv.org/abs/2211.09110)) | The multi-metric, multi-scenario evaluation blueprint | [02](/en/metrics/#dashboard) |

::: warning Read the conclusions, not the implementation
Papers run in clean rooms: fixed environment, fixed dataset. Production is noisier. **Read the evaluation method and the failure cases first, the algorithm second** — the method usually transfers, the implementation often does not.
:::

## 04 Practitioner write-ups {#chinese}

Community posts are where the real scars live: rate limits blown, budgets torched, eval sets drifting away from users. Official docs mention these in one sentence at most.

| Source | What to read it for | Chapters |
| --- | --- | --- |
| [InfoQ · AI](https://www.infoq.cn/topic/AI) | How large platforms design and review eval systems | [12](/en/production/) |
| [Juejin · AI](https://juejin.cn/tag/AI) | Line-level pitfalls and code snippets from practitioners | [13](/en/pitfalls/) |
| [Tencent Cloud Developer](https://cloud.tencent.com/developer) | Engineering practice, performance and cost control | [15](/en/scale/) |
| [Huawei Cloud Developer](https://developer.huaweicloud.com/) | Enterprise eval platforms and compliance requirements | [11](/en/safety/) |

## 05 Reading routes by role {#paths}

### Beginner / product

```text
00 → 01 (diagrams only) → 02 metrics → 04 (selection table only) → 13 pitfalls
```

Goal: judge whether a release is shippable, and speak the same language as your engineers.

### Application developer

```text
01 → 03 datasets → 04 graders → 05 trajectories → 06 CI gates → 14 demos
```

Goal: a release-blocking eval pipeline within two weeks, with the cost profile understood.

### Backend / platform engineer

```text
03 → 06 gates → 09 platforms → 12 online evals → 15 scale → 10 judge calibration
```

Goal: evaluation as a service that survives tenants, concurrency and budget pressure.

### Architect

```text
00 → 02 metrics → 07 experiments → 08 component evals → 12 online → 16 ecosystem
```

Goal: a complete eval topology with hard gates and clear data flow.

## 06 How this book relates {#relation}

```text
Official docs  → capability boundaries: what can be graded, and how it is recognised
Engineering blogs → trade-off experience: the pitfalls the vendors already hit
Open source    → reference implementations you can actually run
Papers         → why it works: mechanisms and statistical significance
This book      → assembles all of it into one shippable path
```

::: tip One line
**Official docs give you the parts. This book shows how to bolt them into a line that stops bad releases.**
:::

## Related sites {#ecosystem}

- [better-agent](https://yuxinrun.github.io/better-agent/) — loops, tools, context and evals for a single agent
- [agent-observability-patterns](https://yuxinrun.github.io/agent-observability-patterns/) — traces, metrics and production debugging
- [a2a-patterns](https://yuxinrun.github.io/a2a-patterns/) — discovery, delegation and collaboration between agents
- [mcp-patterns](https://yuxinrun.github.io/mcp-patterns/) — standardised tool calling and permissions
- [agent-memory-patterns](https://yuxinrun.github.io/agent-memory-patterns/) — tiered memory, retrieval and forgetting
- [llm-gateway-patterns](https://yuxinrun.github.io/llm-gateway-patterns/) — routing, rate limits, cost and audit
- This repo: [github.com/yuxinrun/agent-evaluation-patterns](https://github.com/yuxinrun/agent-evaluation-patterns)

Back to: [How to read](/en/start/) · [Home](/en/)
