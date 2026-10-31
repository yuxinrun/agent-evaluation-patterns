---
title: How to read this book
description: "How to use this agent evaluation field guide: the three-layer structure, diagram legend, three reading paths and site tips."
outline: [2, 3]
---

# How to read this book

This is not a book you read front to back — it is a manual you keep next to your editor. That said, if you have never built an eval suite, reading chapters 00 through 06 in order pays off the most.

## Three layers, one topic {#structure}

Every chapter follows the same rhythm, and you can stop at any layer:

| Layer | What you get | Who it is for |
| --- | --- | --- |
| Layer 1 · Plain language | Analogies, `::: tip` translations, everyday metaphors | Everyone, especially non-technical readers |
| Layer 2 · Mechanics | Diagrams, layer tables, field tables, sequences | Developers who need to model and build |
| Layer 3 · Engineering | Copy-ready code, thresholds, pitfall checklists | Anyone shipping to production |

::: tip Translation for humans
If “trajectory evaluation” sounds abstract, jump to the translation block first: it turns one agent task into a food-delivery run — it is not just whether the food arrived, but whether the rider took a detour, knocked on the wrong door, or walked off with the neighbour's parcel.
:::

## Diagram legend {#legend}

Every diagram here is hand-written SVG / CSS — no chart library, no blurry screenshots, crisp in both themes. Seven shapes:

- **Flow**: left to right; the small labels tell you what happened at each step.
- **Layers**: top to bottom is the abstraction stack; the lower you go, the closer to data and execution.
- **Sequence**: vertical lines are actors, horizontal arrows are messages; dashed means internal or optional.
- **Lifecycle**: states and transitions, e.g. “failure detected → queued → regression → frozen”.
- **Compare**: side by side, usually the right way versus the way that burns.
- **Hub**: one core in the middle, radiating components or scenarios.
- **Matrix**: scenario × option, or a “problem → metric → threshold” decision table.

Code blocks have a copy button on the right and line numbers on the left; long lines scroll horizontally. **No example contains a real key** — treat `sk-...` as a placeholder.

## Three reading paths {#paths}

### Beginner / product manager

Goal: build judgement, so “our eval suite scores 96” stops impressing you.

1. [Chapter 00 Opening](/en/intro/) — what agent evals actually measure.
2. [Chapter 01 Concepts](/en/concepts/) — Run / Trace / Thread and the four graders.
3. [Chapter 02 Metrics](/en/metrics/) — which numbers matter, which are vanity.
4. [Chapter 13 Pitfalls](/en/pitfalls/) — seven ways to look good and be wrong.

### Developer

Goal: ship a pipeline that can block a release within two weeks.

1. [Chapter 14 Demos](/en/demos/) — get the smallest loop running.
2. [Chapter 03 Datasets](/en/datasets/) — without a dataset, evals spin in place.
3. [Chapter 04 Graders](/en/evaluators/) — pick by scenario, do not force a fit.
4. [Chapter 06 CI gates](/en/ci/) — keep bad versions out of main.

### Architect

Goal: make evaluation a platform capability, not one script per team.

1. [Chapter 09 Platforms](/en/platforms/) — SaaS, self-hosted, or the minimal stack.
2. [Chapter 12 Online evals](/en/production/) — sampling on the side, off the critical path.
3. [Chapter 15 At scale](/en/scale/) — queues, tiered judges, budget breakers.
4. [Chapter 16 Ecosystem](/en/ecosystem/) — wiring evals into observability, gateways and orchestration.

## Site tips {#tips}

- **Search**: press `⌘K` / `Ctrl+K`. Mixed Chinese and English works, e.g. “golden dataset”, “trajectory eval”, “kappa”.
- **Language**: the toggle in the navbar keeps you on the same page; anchors are identical in both languages, so you can read side by side.
- **Theme**: light, dark, or follow the system — one click in the navbar.
- **Outline**: the right-hand “On this page” highlights as you scroll; on mobile it lives under “Menu”.
- **Navigation**: previous / next at the bottom of every page, plus ecosystem links in the footer.

## Where the content comes from {#sources}

Everything here is distilled from public material and production practice, simplified for teaching:

- **Anthropic** — Demystifying evals for AI agents, writing tools for agents, and safety evaluation guidance.
- **OpenAI** — Agents SDK tracing and evaluation, plus the Evals docs on datasets and graders.
- **LangChain / LangSmith** — Agent Evaluation concepts, trajectory evaluations, dataset and experiment management.
- **Open source** — Promptfoo (LLM-as-judge and CI), DeepEval, Braintrust, OpenEvals, Phoenix, Langfuse, MLflow judge calibration.
- **Chinese practitioner community** — InfoQ, Juejin, Tencent Cloud and Huawei Cloud agent-eval write-ups, cited at channel level.

::: warning On being “current”
Evaluation moves fast: judge models turn over every quarter and platform APIs break every six months. This book sticks to “stable mental models plus portable engineering constraints” — evaluation objects, four grader types, trajectory scoring, CI gates and judge calibration do not expire; specific fields and thresholds do, and assumptions are called out inline.
:::

## Next {#next}

Start with [Chapter 00](/en/intro/). If you just want to see code, jump to [Chapter 14](/en/demos/).
