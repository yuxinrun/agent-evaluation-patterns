---
title: 06 · Regression pipelines and CI gates
description: The commit-to-block pipeline, baseline deltas, tiered execution, failure reports, rate limits and retries, plus a complete GitHub Actions template.
outline: [2, 3]
---

# 06 · Regression pipelines and CI gates

The first five chapters solved “how to evaluate”. This one solves “how to make evaluation actually stop a bad version”.

A blunt truth: **if evaluation does not run automatically in the pipeline, it will be abandoned within three months.** Anything that relies on people remembering to run it is the first thing cut when a deadline appears.

## 01 The full pipeline {#pipeline}

The whole picture first.

<Diagram id="ci-pipeline" />

Six stages, each with a consequence for skipping it:

| Stage | What happens | Skip it and |
| --- | --- | --- |
| Trigger | Commit, PR or schedule | It becomes manual, which means it is forgotten |
| Prepare | Boot the version under test, load data, ready the sandbox | Environments diverge and results stop being comparable |
| Execute | Run the tier that matches the trigger | Either too slow for anyone to wait, or too small to detect anything |
| Grade | Code checks, judges, aggregation | You get raw logs nobody can read |
| Compare | Metric-by-metric diff against baseline | You still do not know if it improved |
| Decide | Pass, warn, block, plus a report | Evaluation becomes “glance and close” |

### One prerequisite people forget

**The version under test must boot reproducibly.** That means:

```text
1. Prompts, tool schemas and model versions are all in version control
2. Pin the model version (gpt-5-2026-01-15, not gpt-5)
3. Lock dependencies and env vars (lockfile, image tag)
4. All downstream services mocked or sandboxed
```

Point two is the one that bites. People write `model="gpt-5"`, the vendor upgrades something, the score drops six points overnight, and the team spends two weeks hunting a bug that does not exist.

::: tip Translation for humans
A pipeline is the **pre-flight checklist**. Not “we trust the captain to check”, but “every item needs a signature in the process, or the plane does not leave”.
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://promptfoo.dev/docs/integrations/github-action/" target="_blank" rel="noreferrer">Promptfoo · GitHub Action</a>
  <a href="https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents" target="_blank" rel="noreferrer">Anthropic · Demystifying evals for AI agents</a>
</div>

## 02 Baselines and regressions {#baseline}

A baseline is the anchor of the whole system. Without one, every number is an orphan.

<Diagram id="baseline-delta" />

### Choosing a baseline

| Baseline type | Definition | Use when |
| --- | --- | --- |
| **Last green on main** | The last run on main that passed every gate | Recommended default |
| **Released version** | What is running in production | “Prod vs candidate” comparisons |
| **Historical best** | The best version ever recorded (use carefully) | Push periods |

`main@last-green` is recommended because it is both trustworthy and fresh.

### Three quantities you must separate

```text
Absolute delta:  value_now - value_baseline                   (how much)
Relative delta:  (value_now - value_baseline) / value_baseline (how much, in percent)
Significance:    is the difference larger than noise           (is it real)
```

The first two are arithmetic. The third is the point — and skipping it is why gates turn permanently red.

```python
import statistics

def is_regression(scores_now: list[float], scores_base: list[float],
                  max_drop: float = 0.02, alpha: float = 0.05) -> dict:
    """Mean drop past the threshold, and larger than the noise band."""
    m_now, m_base = statistics.mean(scores_now), statistics.mean(scores_base)
    sd_now = statistics.pstdev(scores_now) or 1e-6
    sd_base = statistics.pstdev(scores_base) or 1e-6
    se = (sd_now ** 2 / len(scores_now) + sd_base ** 2 / len(scores_base)) ** 0.5
    ci = 1.96 * se                     # 95% confidence
    delta = m_now - m_base
    return {
        "delta": round(delta, 4),
        "ci": round(ci, 4),
        "regressed": delta < -max_drop,
        "significant": abs(delta) > ci,   # bigger than noise
        "noise": abs(delta) <= ci,
    }
```

::: warning Is “-0.4pt” a regression or noise
Losing 0.4 percentage points across 300 cases is usually inside the noise band. If your gate fires on that, it will be switched off within two weeks.
**Calibrate against the noise band first, then set the threshold.**
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://docs.langchain.com/langsmith/evaluation-approaches" target="_blank" rel="noreferrer">LangSmith · Baselines and experiments</a>
  <a href="https://www.braintrust.dev/docs/evaluation-quickstart" target="_blank" rel="noreferrer">Braintrust · Comparing experiments</a>
</div>

## 03 Tiered execution {#tiers}

Cramming every case into every commit means developers wait forty minutes and then skip the check permanently.

<Diagram id="tiered-ci" />

### Three tiers

| Trigger | What runs | Target time | On failure |
| --- | --- | --- | --- |
| PR opened or updated | Smoke set, 30 cases | ≤ 3 min | Block merge |
| Merged to main | Regression set, 300 cases | ≤ 20 min | Block release, notify owners |
| Pre-release / nightly | Long tail, full plus human spot check | ≤ 3 h | Block release, full report |

### Smart selection saves most of the time

Not every commit needs every relevant case. Select by what changed:

```python
def select_suites(changed_files: list[str]) -> list[str]:
    """Pick dataset slices from the changed paths."""
    suites = {"smoke"}                              # smoke always runs
    if any("tools/" in f for f in changed_files):
        suites.add("trajectory")                    # tool changes → trajectory cases
    if any(f.endswith(".prompt") or "prompts/" in f for f in changed_files):
        suites.add("faithfulness")                  # prompt changes → faithfulness
    if any("policies/" in f or "rules/" in f for f in changed_files):
        suites.add("policy")                        # business rules → policy cases
    if all(f.endswith(".md") for f in changed_files):
        suites = {"smoke"}                          # docs-only → smoke only
    return sorted(suites)
```

Note the last rule: **documentation-only changes run smoke only**. It looks trivial, but it is what keeps the gate alive — nobody tolerates a twenty-minute wait for a typo fix.

::: warning The tiering anti-pattern
“Run everything every time, machine time is free.” Machine time is free; **developer waiting time is not**. Past ten minutes, skipping becomes the team's silent agreement.
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://promptfoo.dev/docs/integrations/github-action/" target="_blank" rel="noreferrer">Promptfoo · CI strategies</a>
  <a href="https://docs.langchain.com/langsmith/evaluation-approaches" target="_blank" rel="noreferrer">LangSmith · Evaluation approaches</a>
</div>

## 04 Failure reports {#report}

The moment a gate fails is when the team's trust in the system peaks or collapses.

- A useful report makes people depend on it;
- A useless report teaches people to “just re-run”.

### Five things every report needs

```text
1. Verdict       which gate failed and by how much (-3.2pt)
2. Failure list  exactly which cases failed (ID plus one-line reason)
3. Evidence      a trace link per failure you can click into
4. Judge notes   for judge verdicts, the reason and evidence
5. Baseline diff metric-by-metric table plus trend
```

### A real report

```markdown
## Eval gate failed: task_success_regression

| Metric | Now | Baseline main@a1b2c3 | Delta |
| --- | --- | --- | --- |
| Task success | 88.9% | 92.1% | **-3.2pt** ❌ |
| Hallucination | 1.6% | 1.4% | +0.2pt |
| Tool correctness | 91.4% | 88.7% | +2.7pt ✅ |

### Failing cases (12 total, first 5 shown)

| Case | Kind | Reason | Trace |
| --- | --- | --- | --- |
| refund-edge-014 | edge | Never called get_refund_policy, invented 30 days | [tr_7c1d9a] |
| refund-edge-015 | edge | Same as above | [tr_8d2e1b] |
| refund-pos-003 | positive | Answer omitted the “opened box” condition | [tr_9f4c2d] |
| inj-002 | injection | Executed an export-all-orders instruction | [tr_a1b2c3] ⚠️ high risk |
| amb-007 | ambiguous | Refunded without clarifying | [tr_b4d5e6] |

### Attribution hint
- 9 of 12 failures share one cause: `get_refund_policy` never called
- Check whether the tool description changed in this PR (tools/policy.py:41)
```

That attribution line is the most valuable thing in the report: **it compresses twelve failures into one actionable hypothesis.**

::: tip Translation for humans
A good failure report is the **“what this abnormal result probably means” section of a health check**: not just “your glucose is high”, but “possibly last night's hotpot; re-test in three days”.
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://langfuse.com/docs/evaluation/overview" target="_blank" rel="noreferrer">Langfuse · Evaluation reports</a>
  <a href="https://www.braintrust.dev/docs/evaluation-quickstart" target="_blank" rel="noreferrer">Braintrust · Experiment diffs</a>
</div>

## 05 Rate limits, retries, concurrency {#throttle}

This section is about not turning an eval run into an incident.

Agent evaluation multiplies API traffic instantly: 300 cases × 6 steps = 1,800 model calls. Uncontrolled, you get:

- TPM/RPM limits hit, mass failures, distorted metrics;
- Vendor risk controls tripped, account throttled;
- Your own production service degraded by shared quota.

### Three controls you need

```python
import asyncio, random

class RateLimiter:
    """Token bucket plus concurrency cap plus exponential backoff."""

    def __init__(self, max_concurrency: int = 4, rpm: int = 600):
        self.sem = asyncio.Semaphore(max_concurrency)
        self.min_interval = 60 / rpm
        self._last = 0.0

    async def run(self, coro_factory, max_retries: int = 4):
        async with self.sem:
            now = asyncio.get_event_loop().time()
            wait = self.min_interval - (now - self._last)
            if wait > 0:
                await asyncio.sleep(wait)
            self._last = asyncio.get_event_loop().time()

            for attempt in range(max_retries):
                try:
                    return await coro_factory()
                except (RateLimitError, TimeoutError):
                    backoff = (2 ** attempt) + random.random()
                    await asyncio.sleep(backoff)
            raise RuntimeError("exceeded retries")
```

Starting values:

| Parameter | Start at | Tune by |
| --- | --- | --- |
| Concurrency | 3-5 | Watch the 429 rate; raise only below 1% |
| RPM | 60% of the vendor limit | Keep headroom for production traffic |
| Max retries | 4 | More than that means the quota is insufficient |

### Separate measurement failures from real failures

The most commonly botched distinction:

```python
TRANSIENT = {429, 500, 502, 503, 504}

def classify_failure(exc) -> str:
    if getattr(exc, "status", None) in TRANSIENT:
        return "infra"      # infrastructure problem, not model quality
    return "quality"        # a genuine capability problem
```

`infra` failures must be retried or excluded from the denominator. Counting them as model failures makes your metrics drop 15 points during peak hours — the model did not get worse; you got throttled.

::: danger The most insidious distortion
Evaluation shares quota with production. The eval run slows production, user timeouts rise, and eval results are simultaneously distorted by 429s. **Evaluation traffic needs its own quota or its own API key.**
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://promptfoo.dev/docs/integrations/github-action/" target="_blank" rel="noreferrer">Promptfoo · Rate limiting</a>
  <a href="https://arxiv.org/abs/2406.12045" target="_blank" rel="noreferrer">τ-bench · retries and pass^k</a>
</div>

## 06 A GitHub Action template {#github}

A template you can paste straight into your repo.

### Directory layout

```text
repo/
├─ evals/
│  ├─ datasets/
│  │  ├─ smoke.yaml
│  │  ├─ regression.yaml
│  │  └─ longtail.yaml
│  ├─ graders/
│  │  ├─ code_checks.py
│  │  └─ judge.py
│  ├─ baselines/
│  │  └─ main-last-green.json
│  └─ run.py
└─ .github/workflows/eval.yml
```

### The workflow

```yaml
name: Agent eval gate

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
  schedule:
    - cron: "0 18 * * *"        # nightly long tail

concurrency:
  group: eval-${{ github.ref }}
  cancel-in-progress: true       # new commits cancel stale runs

jobs:
  smoke:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: pip install -r evals/requirements.txt
      - name: Run smoke set
        env:
          OPENAI_API_KEY: ${{ secrets.EVAL_OPENAI_KEY }}
          LANGSMITH_API_KEY: ${{ secrets.LANGSMITH_KEY }}
        run: python evals/run.py --suite smoke --out smoke.json --fail-under 1.0
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: smoke-report
          path: smoke.json

  regression:
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    timeout-minutes: 40
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: pip install -r evals/requirements.txt
      - name: Run regression set against baseline
        env:
          OPENAI_API_KEY: ${{ secrets.EVAL_OPENAI_KEY }}
        run: |
          python evals/run.py --suite regression --out now.json
          python evals/compare.py \
            --now now.json \
            --baseline evals/baselines/main-last-green.json \
            --gate evals/eval-gate.yml \
            --report report.md
      - name: Comment on commit
        if: failure()
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const body = fs.readFileSync('report.md', 'utf8').slice(0, 60000);
            await github.rest.repos.createCommitComment({
              ...context.repo, commit_sha: context.sha, body
            });
      - uses: actions/upload-artifact@v4
        if: always()
        with: { name: regression-report, path: "report.md" }

  promote-baseline:
    needs: [regression]
    if: success() && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cp now.json evals/baselines/main-last-green.json
      - run: |
          git config user.name "eval-bot"
          git config user.email "eval-bot@users.noreply.github.com"
          git add evals/baselines/main-last-green.json
          git commit -m "chore(eval): promote baseline" || true
          git push
```

### Three details that matter

| Detail | Why |
| --- | --- |
| `cancel-in-progress: true` | Consecutive pushes do not queue behind stale runs — saves time and money |
| `timeout-minutes` | Stops a hung run from burning quota |
| `promote-baseline` only on success | Once a bad version pollutes the baseline, every later comparison is invalid |

::: warning Never let secrets into logs
An `echo ${{ secrets.X }}` inside `run:` leaks the key into the log. Inject via `env:`, and never print request headers from the eval script.
:::

<div class="a-src">
  <span class="a-src__tag">Source</span>
  <a href="https://promptfoo.dev/docs/integrations/github-action/" target="_blank" rel="noreferrer">Promptfoo · GitHub Action reference</a>
  <a href="https://docs.github.com/en/actions" target="_blank" rel="noreferrer">GitHub Actions documentation</a>
</div>

---

Next chapter uses evaluation as an experiment rig: A/B comparison, significance, and canary evaluation.
