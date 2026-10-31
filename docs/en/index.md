---
layout: home
title: Agent Evaluation Patterns
titleTemplate: A field guide to AI agent evaluation engineering

hero:
  name: Agent Evaluation Patterns
  text: Your agent did not get worse. You just never measured it.
  tagline: From golden datasets to trajectory scoring, from LLM judge calibration to CI quality gates. Seventeen chapters, 40+ hand-drawn diagrams, and evals you can actually run.
  image:
    light: /hero-light.svg
    dark: /hero-dark.svg
    alt: An evaluation dashboard scoring an agent trajectory
  actions:
    - theme: brand
      text: Start at chapter 00
      link: /en/intro/
    - theme: alt
      text: The four grader patterns
      link: /en/evaluators/
    - theme: alt
      text: Copy a demo
      link: /en/demos/

features:
  - title: Plain language first
    details: Every section opens with a translation for humans and an analogy, then gets precise with schemas, thresholds and code.
  - title: Seventeen chapters, no gaps
    details: From “did that prompt change help or hurt?” all the way to a multi-tenant eval cluster under load.
  - title: 40+ hand-drawn diagrams
    details: Layer stacks, flows, sequences, lifecycles and selection matrices, all SVG/CSS, crisp in both themes.
  - title: Minimal implementations that run
    details: Code graders, LLM judges, trajectory matching, CI gates, A/B comparisons and trace-to-sample pipelines you can copy.
  - title: Aligned with official practice
    details: Anthropic’s eval engineering guidance, OpenAI Agents SDK evals, and LangChain / LangSmith trajectory evaluation.
  - title: Observability wired into evals
    details: Production traces become evaluation samples automatically, closing the loop from incident to regression test.
---

<div class="a-home">

<section class="a-section">
  <div class="a-section__head">
    <div>
      <div class="a-eyebrow">Ecosystem</div>
      <h2 class="a-section__title">Seven pieces, one enterprise AI stack</h2>
      <p class="a-section__lead">Orchestration, observability, evaluation, memory, messaging, tools, gateway. Without evaluation the other six are tuned by vibes.</p>
    </div>
  </div>
  <Eco />
</section>

<section class="a-section">
  <div class="a-section__head">
    <div>
      <div class="a-eyebrow">Chapters</div>
      <h2 class="a-section__title">Seventeen chapters: from vibes to numbers</h2>
      <p class="a-section__lead">Read in order, or jump straight to 03, 04, 05 and 06 if you are on fire.</p>
    </div>
    <a class="a-section__more" href="/agent-evaluation-patterns/en/start/">How to read →</a>
  </div>
  <ChapterMap />
</section>

<section class="a-section">
  <div class="a-section__head">
    <div>
      <div class="a-eyebrow">Reading paths</div>
      <h2 class="a-section__title">Three paths. Pick one.</h2>
      <p class="a-section__lead">Same book, three readings. Do not grind through it — solve the problem in front of you.</p>
    </div>
  </div>
  <div class="a-paths">
    <div class="a-path">
      <div class="a-path__k">Beginner / PM</div>
      <div class="a-path__t">Build intuition first</div>
      <div class="a-path__d">No code required: what agent evals actually measure, which numbers matter, and how to judge a release.</div>
      <div class="a-path__steps">
        <a class="a-path__step" href="/agent-evaluation-patterns/en/intro/">00 Opening</a>
        <a class="a-path__step" href="/agent-evaluation-patterns/en/concepts/">01 Concepts</a>
        <a class="a-path__step" href="/agent-evaluation-patterns/en/metrics/">02 Metrics</a>
        <a class="a-path__step" href="/agent-evaluation-patterns/en/pitfalls/">13 Pitfalls</a>
      </div>
    </div>
    <div class="a-path">
      <div class="a-path__k">Developer</div>
      <div class="a-path__t">Run it, then go deeper</div>
      <div class="a-path__d">Stand up your first eval pipeline from a demo, then backfill datasets, graders and trajectory scores.</div>
      <div class="a-path__steps">
        <a class="a-path__step" href="/agent-evaluation-patterns/en/demos/">14 Demos</a>
        <a class="a-path__step" href="/agent-evaluation-patterns/en/datasets/">03 Datasets</a>
        <a class="a-path__step" href="/agent-evaluation-patterns/en/evaluators/">04 Graders</a>
        <a class="a-path__step" href="/agent-evaluation-patterns/en/ci/">06 CI gates</a>
      </div>
    </div>
    <div class="a-path">
      <div class="a-path__k">Architect</div>
      <div class="a-path__t">Set boundaries first</div>
      <div class="a-path__d">Platform choice, online sampling, cost and compliance: fit evals into the release process you already have.</div>
      <div class="a-path__steps">
        <a class="a-path__step" href="/agent-evaluation-patterns/en/platforms/">09 Platforms</a>
        <a class="a-path__step" href="/agent-evaluation-patterns/en/production/">12 Online evals</a>
        <a class="a-path__step" href="/agent-evaluation-patterns/en/scale/">15 At scale</a>
        <a class="a-path__step" href="/agent-evaluation-patterns/en/ecosystem/">16 Ecosystem</a>
      </div>
    </div>
  </div>
</section>

<section class="a-section">
  <div class="a-section__head">
    <div>
      <div class="a-eyebrow">Mental model</div>
      <h2 class="a-section__title">One eval result in 14 lines</h2>
      <p class="a-section__lead">Forget the framework names: a trustworthy result answers five questions — which trace, who judged, on what grounds, how sure, and better or worse than last release.</p>
    </div>
  </div>

```json
{
  "run_id": "eval_2026_10_31_02",
  "trace_id": "tr_7c1d9a",
  "dataset": "regression@v14",
  "case_id": "refund-policy-ambiguity-03",
  "grader": "code:tool_args + judge:gpt-5:support",
  "verdict": "pass",
  "scores": { "task_success": 1, "tool_correct": 1, "hallucination": 0 },
  "rationale": "Called get_refund_policy with order_id; invented no SLA terms",
  "baseline_delta": { "task_success": "+0.4pt", "p95_latency": "-0.3s" },
  "cost_usd": 0.024
}
```

  <p class="a-section__lead">Drop <code>trace_id</code> and you cannot find the failing step; drop <code>dataset</code> and you cannot tell a new bug from an old one; drop <code>rationale</code> and nobody trusts the score; drop <code>baseline_delta</code> and you are back to shipping on vibes.</p>
</section>

</div>

<div class="a-home-footer">
  <div class="a-home">
    <footer class="a-footer">
      <AuthorBrand />
      <div class="a-footer__row">
        <div>© 2026 鱼心 · Yuxin · MIT ｜ Maintained alongside better-agent, a2a-patterns, mcp-patterns, llm-gateway-patterns, agent-memory-patterns and agent-observability-patterns</div>
        <div class="a-footer__links">
          <a href="https://yuxin.run" target="_blank" rel="noreferrer">Author</a>
          <a href="https://github.com/yuxinrun/agent-evaluation-patterns" target="_blank" rel="noreferrer">GitHub</a>
          <a href="/agent-evaluation-patterns/en/reading/">Sources</a>
          <a class="a-footer__lang" href="/agent-evaluation-patterns/">中文</a>
        </div>
      </div>
    </footer>
  </div>
</div>
