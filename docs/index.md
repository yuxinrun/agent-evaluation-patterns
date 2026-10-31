---
layout: home
title: Agent 评测手册
titleTemplate: AI Agent 评估工程模式完全手册

hero:
  name: Agent 评测手册
  text: 不是 Agent 变差了，是你根本没量过。
  tagline: 从黄金数据集到轨迹评分，从 LLM 裁判校准到 CI 质量门禁。17 章体系、40+ 张手绘图解、可直接跑起来的评测 Demo，把 Agent 评估讲透。
  image:
    light: /hero-light.svg
    dark: /hero-dark.svg
    alt: 评测看板正在给一段 Agent 轨迹打分
  actions:
    - theme: brand
      text: 从第 00 章开始
      link: /intro/
    - theme: alt
      text: 先看四大评测器
      link: /evaluators/
    - theme: alt
      text: 复制一个 Demo
      link: /demos/

features:
  - title: 先讲人话，再上讲义
    details: 每节都有「人话翻译」和生活类比，小白能读懂；紧接着给出字段、阈值与代码，工程师能直接用。
  - title: 17 章，没有知识断层
    details: 从「改个 prompt 到底变好还是变差」一路到「多租户高并发评测集群」，中间不缺任何一块拼图。
  - title: 40+ 张手绘图解
    details: 分层图、流程图、时序图、生命周期、选型矩阵，全部手写 SVG/CSS，明暗主题都清晰。
  - title: 能跑起来的最小实现
    details: 代码校验器、LLM 裁判、轨迹匹配、CI 门禁、A/B 对比、Trace 转样本，代码可直接复制运行。
  - title: 对齐官方评测规范
    details: 严格对照 Anthropic 的 eval 工程实践、OpenAI Agents SDK 评估、LangChain / LangSmith 轨迹评测。
  - title: 观测与评测打通
    details: 线上 Trace 自动流转成评测样本，形成「观测发现问题 → 评测验证修复」的完整闭环。
---

<div class="a-home">

<section class="a-section">
  <div class="a-section__head">
    <div>
      <div class="a-eyebrow">Ecosystem</div>
      <h2 class="a-section__title">七块拼图，一套企业 AI 技术栈</h2>
      <p class="a-section__lead">调度、观测、评测、记忆、通信、工具、网关——少了评测这一块，其余六块都只能靠感觉调。</p>
    </div>
  </div>
  <Eco />
</section>

<section class="a-section">
  <div class="a-section__head">
    <div>
      <div class="a-eyebrow">Chapters</div>
      <h2 class="a-section__title">17 章目录：从「凭感觉」到「有数据」</h2>
      <p class="a-section__lead">建议按顺序读；正在救火的，直接跳到第 03、04、05、06 章。</p>
    </div>
    <a class="a-section__more" href="/agent-evaluation-patterns/start/">阅读指南 →</a>
  </div>
  <ChapterMap />
</section>

<section class="a-section">
  <div class="a-section__head">
    <div>
      <div class="a-eyebrow">Reading paths</div>
      <h2 class="a-section__title">三条路径，选一条走</h2>
      <p class="a-section__lead">同一本书，三种读法。别从头啃到尾，先解决你手上的问题。</p>
    </div>
  </div>
  <div class="a-paths">
    <div class="a-path">
      <div class="a-path__k">小白 / 产品</div>
      <div class="a-path__t">先建立直觉</div>
      <div class="a-path__d">不写代码也能读完：知道 Agent 评测到底在测什么、看哪些数、怎么判断好坏。</div>
      <div class="a-path__steps">
        <a class="a-path__step" href="/agent-evaluation-patterns/intro/">00 开篇</a>
        <a class="a-path__step" href="/agent-evaluation-patterns/concepts/">01 概念</a>
        <a class="a-path__step" href="/agent-evaluation-patterns/metrics/">02 指标</a>
        <a class="a-path__step" href="/agent-evaluation-patterns/pitfalls/">13 踩坑</a>
      </div>
    </div>
    <div class="a-path">
      <div class="a-path__k">开发者</div>
      <div class="a-path__t">先跑通再深挖</div>
      <div class="a-path__d">照着 Demo 搭出第一条评测流水线，再回头补数据集、评测器与轨迹评分。</div>
      <div class="a-path__steps">
        <a class="a-path__step" href="/agent-evaluation-patterns/demos/">14 Demo</a>
        <a class="a-path__step" href="/agent-evaluation-patterns/datasets/">03 数据集</a>
        <a class="a-path__step" href="/agent-evaluation-patterns/evaluators/">04 评测器</a>
        <a class="a-path__step" href="/agent-evaluation-patterns/ci/">06 CI 门禁</a>
      </div>
    </div>
    <div class="a-path">
      <div class="a-path__k">架构师</div>
      <div class="a-path__t">先定边界再落地</div>
      <div class="a-path__d">关注平台选型、线上抽样、成本与合规，把评测接进现有发布体系。</div>
      <div class="a-path__steps">
        <a class="a-path__step" href="/agent-evaluation-patterns/platforms/">09 选型</a>
        <a class="a-path__step" href="/agent-evaluation-patterns/production/">12 线上评测</a>
        <a class="a-path__step" href="/agent-evaluation-patterns/scale/">15 规模化</a>
        <a class="a-path__step" href="/agent-evaluation-patterns/ecosystem/">16 生态</a>
      </div>
    </div>
  </div>
</section>

<section class="a-section">
  <div class="a-section__head">
    <div>
      <div class="a-eyebrow">Mental model</div>
      <h2 class="a-section__title">先用 14 行看懂一条评测结果</h2>
      <p class="a-section__lead">抛开框架名词，一条可信的评测结果只需要回答五件事：测的哪条轨迹、谁给的判定、凭什么、多大把握、比上个版本好还是差。</p>
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
  "rationale": "命中 get_refund_policy 且入参含 order_id，未编造时效条款",
  "baseline_delta": { "task_success": "+0.4pt", "p95_latency": "-0.3s" },
  "cost_usd": 0.024
}
```

  <p class="a-section__lead">少了 <code>trace_id</code> 就不知道错在哪一步，少了 <code>dataset</code> 就分不清是新问题还是老问题，少了 <code>rationale</code> 就没人敢信这个分数，少了 <code>baseline_delta</code> 就只能继续凭感觉发版。</p>
</section>

</div>

<div class="a-home-footer">
  <div class="a-home">
    <footer class="a-footer">
      <AuthorBrand />
      <div class="a-footer__row">
        <div>© 2026 鱼心 · Yuxin · MIT ｜ 与 better-agent、a2a-patterns、mcp-patterns、llm-gateway-patterns、agent-memory-patterns、agent-observability-patterns 共同维护</div>
        <div class="a-footer__links">
          <a href="https://yuxin.run" target="_blank" rel="noreferrer">作者主页</a>
          <a href="https://github.com/yuxinrun/agent-evaluation-patterns" target="_blank" rel="noreferrer">GitHub</a>
          <a href="/agent-evaluation-patterns/reading/">参考来源</a>
          <a class="a-footer__lang" href="/agent-evaluation-patterns/en/">English</a>
        </div>
      </div>
    </footer>
  </div>
</div>
