/**
 * 全站目录中枢：侧边栏、面包屑、首页章节地图、上下章导航都由这里生成。
 * Site catalog: single source of truth for sidebars, breadcrumbs, chapter map.
 */

export interface CatalogSection {
  /** 锚点 id，中英文页面共用 */
  id: string
  zh: string
  en: string
}

export interface CatalogItem {
  num: string
  slug: string
  zhTitle: string
  enTitle: string
  zhLead: string
  enLead: string
  zhTag: string
  enTag: string
  sections: CatalogSection[]
}

export const catalog: CatalogItem[] = [
  {
    num: '00',
    slug: 'intro',
    zhTitle: '开篇：为什么 Agent 评测是质检车间',
    enTitle: 'Opening: the QA floor for agents',
    zhLead: '普通 LLM 评测和 Agent 评测差在哪、不评测会怎么翻车、四大目标与观测链路。',
    enLead: 'How agent evals differ from LLM evals, what happens without them, and four goals plus the observability link.',
    zhTag: '零基础友好',
    enTag: 'Beginner friendly',
    sections: [
      { id: 'pain', zh: '没有评测，上线就是赌运气', en: 'Shipping without evals is gambling' },
      { id: 'difference', zh: '普通 LLM 评测 vs Agent 评测', en: 'LLM evals vs agent evals' },
      { id: 'disasters', zh: '三个真实翻车现场', en: 'Three real failure stories' },
      { id: 'goals', zh: 'Agent 评测四大目标', en: 'The four goals of agent evals' },
      { id: 'loop', zh: '观测抓 Trace，评测给 Trace 打分', en: 'Observability traces, evals score them' },
      { id: 'scope', zh: '本手册覆盖范围与生态位置', en: 'Scope and where this book sits' },
    ],
  },
  {
    num: '01',
    slug: 'concepts',
    zhTitle: '基础概念：Agent 评测底层框架',
    enTitle: 'Core concepts of agent evaluation',
    zhLead: '三层评测对象、四类评测器、黄金数据集、评分标尺与评测节奏。',
    enLead: 'Three evaluation objects, four grader types, golden datasets, rubrics and cadence.',
    zhTag: '地基',
    enTag: 'Foundations',
    sections: [
      { id: 'objects', zh: '三层评测对象：Run / Trace / Thread', en: 'Run, Trace, Thread' },
      { id: 'graders', zh: '四类评测器', en: 'The four grader types' },
      { id: 'golden', zh: '黄金数据集：评测的地基', en: 'Golden datasets' },
      { id: 'rubric', zh: '评分标尺 Rubric 怎么写', en: 'Writing a rubric' },
      { id: 'cadence', zh: '评测周期：开发到线上', en: 'Eval cadence end to end' },
    ],
  },
  {
    num: '02',
    slug: 'metrics',
    zhTitle: '评测指标体系与看板样例',
    enTitle: 'Metrics and dashboards',
    zhLead: '结果、过程、成本、体验四层指标，看板设计与 SLO 质量门禁红线。',
    enLead: 'Outcome, trajectory, cost and experience metrics, plus dashboards and SLO gates.',
    zhTag: '看得懂',
    enTag: 'Readable',
    sections: [
      { id: 'outcome', zh: '任务结果指标', en: 'Outcome metrics' },
      { id: 'trajectory', zh: '过程轨迹指标', en: 'Trajectory metrics' },
      { id: 'cost', zh: '成本与效率指标', en: 'Cost and efficiency' },
      { id: 'experience', zh: '体验指标', en: 'Experience metrics' },
      { id: 'dashboard', zh: '指标分层看板设计', en: 'Dashboard design' },
      { id: 'slo', zh: 'SLO 质量门禁红线', en: 'SLO release gates' },
    ],
  },
  {
    num: '03',
    slug: 'datasets',
    zhTitle: '数据集工程：最容易被忽略的地基',
    enTitle: 'Dataset engineering',
    zhLead: '用例分类、数据来源、冒烟/回归/长尾分层、版本管理与五个反模式。',
    enLead: 'Case taxonomy, sources, smoke/regression/long-tail tiers, versioning and anti-patterns.',
    zhTag: '落地核心',
    enTag: 'Core practice',
    sections: [
      { id: 'taxonomy', zh: '测试用例五分类', en: 'Five kinds of test cases' },
      { id: 'sources', zh: '数据集从哪来', en: 'Where datasets come from' },
      { id: 'tiers', zh: '冒烟集 / 回归集 / 长尾集', en: 'Smoke, regression, long-tail' },
      { id: 'management', zh: '版本、标签、去重、脱敏', en: 'Versioning, tags, dedupe, masking' },
      { id: 'antipatterns', zh: '数据集反模式', en: 'Dataset anti-patterns' },
    ],
  },
  {
    num: '04',
    slug: 'evaluators',
    zhTitle: '四大评测器核心 Pattern',
    enTitle: 'The four grader patterns',
    zhLead: '代码校验、LLM 裁判、两两对比、人工评审，以及混合评测的配比。',
    enLead: 'Code checks, LLM judges, pairwise comparison, human review, and hybrid blends.',
    zhTag: '本书重点',
    enTag: 'Core patterns',
    sections: [
      { id: 'code', zh: '代码确定性校验模式', en: 'Deterministic code checks' },
      { id: 'judge', zh: 'LLM-as-judge 裁判模式', en: 'The LLM-as-judge pattern' },
      { id: 'pairwise', zh: '两两对比 Pairwise 模式', en: 'Pairwise comparison' },
      { id: 'human', zh: '人工评审与 Kappa 一致性', en: 'Human review and kappa' },
      { id: 'hybrid', zh: '混合评测模式', en: 'Hybrid grading' },
      { id: 'selection', zh: '评测器选型决策表', en: 'Grader selection table' },
    ],
  },
  {
    num: '05',
    slug: 'trajectory',
    zhTitle: '轨迹评测：Agent 独有的战场',
    enTitle: 'Trajectory evaluation',
    zhLead: '轨迹解剖、顺序匹配、合理性判定、循环检测与副作用回滚。',
    enLead: 'Anatomy, order matching, reasonableness, loop detection, side-effect rollback.',
    zhTag: 'Agent 专属',
    enTag: 'Agent-only',
    sections: [
      { id: 'anatomy', zh: '一条轨迹长什么样', en: 'Anatomy of a trajectory' },
      { id: 'match', zh: '轨迹匹配评测', en: 'Order matching' },
      { id: 'reasonable', zh: '轨迹合理性评测', en: 'Reasonableness grading' },
      { id: 'loop', zh: '循环与原地打转检测', en: 'Loop detection' },
      { id: 'sideeffect', zh: '工具副作用校验', en: 'Side-effect verification' },
      { id: 'scoring', zh: '轨迹评分实现', en: 'Implementing trajectory scores' },
    ],
  },
  {
    num: '06',
    slug: 'ci',
    zhTitle: '自动化回归流水线与 CI 门禁',
    enTitle: 'Regression pipelines and CI gates',
    zhLead: '提交到阻断的完整链路、基线劣化计算、分级执行、失败报告与限流。',
    enLead: 'Commit-to-block pipeline, baseline deltas, tiered runs, failure reports and throttling.',
    zhTag: '拿来就用',
    enTag: 'Copy-ready',
    sections: [
      { id: 'pipeline', zh: '流水线完整链路', en: 'The full pipeline' },
      { id: 'baseline', zh: '基线版本与劣化计算', en: 'Baselines and regressions' },
      { id: 'tiers', zh: '分级执行策略', en: 'Tiered execution' },
      { id: 'report', zh: '失败报告长什么样', en: 'Failure reports' },
      { id: 'throttle', zh: '限流、重试、并发控制', en: 'Rate limits, retries, concurrency' },
      { id: 'github', zh: 'GitHub Action 模板', en: 'A GitHub Action template' },
    ],
  },
  {
    num: '07',
    slug: 'experiments',
    zhTitle: 'A/B 实验与版本对比评测',
    enTitle: 'A/B experiments and version comparison',
    zhLead: '单变量对照、对比报表、显著性判断、灰度评测与实验沉淀。',
    enLead: 'Single-variable design, comparison reports, significance, canary evals and archiving.',
    zhTag: '对比实验',
    enTag: 'Experiments',
    sections: [
      { id: 'design', zh: '对照实验的单变量原则', en: 'One variable at a time' },
      { id: 'report', zh: '指标对比报表', en: 'Comparison reports' },
      { id: 'significance', zh: '显著性判断：真变好还是噪声', en: 'Real gains vs noise' },
      { id: 'canary', zh: '线上灰度评测', en: 'Canary evaluation' },
      { id: 'archive', zh: '实验沉淀与新基线', en: 'Archiving and new baselines' },
    ],
  },
  {
    num: '08',
    slug: 'component-evals',
    zhTitle: '生态组件联动评测',
    enTitle: 'Evaluating with ecosystem components',
    zhLead: '观测 Trace 驱动样本、跨 Agent 协作、MCP 工具、记忆模块与网关评测。',
    enLead: 'Trace-driven samples, cross-agent tasks, MCP tools, memory modules and gateways.',
    zhTag: '生态联动',
    enTag: 'Ecosystem',
    sections: [
      { id: 'observability', zh: '观测 Trace 驱动评测', en: 'Trace-driven evals' },
      { id: 'a2a', zh: '跨 Agent 协作评测', en: 'Cross-agent evaluation' },
      { id: 'mcp', zh: 'MCP 工具评测', en: 'MCP tool evaluation' },
      { id: 'memory', zh: '记忆模块评测', en: 'Memory module evaluation' },
      { id: 'gateway', zh: '网关路由与降级评测', en: 'Gateway routing and fallback' },
      { id: 'contract', zh: '跨组件评测契约', en: 'The cross-component contract' },
    ],
  },
  {
    num: '09',
    slug: 'platforms',
    zhTitle: '开源评测平台与库选型',
    enTitle: 'Platform and library selection',
    zhLead: 'LangSmith、Langfuse、Promptfoo、DeepEval、Braintrust、OpenEvals、Phoenix 对照。',
    enLead: 'LangSmith, Langfuse, Promptfoo, DeepEval, Braintrust, OpenEvals, Phoenix compared.',
    zhTag: '选型',
    enTag: 'Selection',
    sections: [
      { id: 'langsmith', zh: 'LangSmith：轨迹与评测一体', en: 'LangSmith: traces plus evals' },
      { id: 'langfuse', zh: 'Langfuse：自托管友好', en: 'Langfuse: self-host friendly' },
      { id: 'promptfoo', zh: 'Promptfoo：轻量 CI 评测', en: 'Promptfoo: lightweight CI' },
      { id: 'deepeval', zh: 'DeepEval：轻量 Python 库', en: 'DeepEval: a Python library' },
      { id: 'others', zh: 'Braintrust / OpenEvals / Phoenix', en: 'Braintrust, OpenEvals, Phoenix' },
      { id: 'selection', zh: '选型对照与最小生产组合', en: 'Selection table and minimal stack' },
    ],
  },
  {
    num: '10',
    slug: 'judge',
    zhTitle: 'LLM 裁判校准与降噪',
    enTitle: 'Calibrating and de-noising LLM judges',
    zhLead: '偏心与漂移的根源、人工标注校准、多裁判交叉、二元标尺与定期重校准。',
    enLead: 'Why judges drift, calibration on human labels, cross-checking, binary rubrics, recalibration.',
    zhTag: '高频大坑',
    enTag: 'High-frequency trap',
    sections: [
      { id: 'bias', zh: '裁判为什么会偏心', en: 'Why judges are biased' },
      { id: 'calibration', zh: '校准流程：用人工标注调教裁判', en: 'Calibration with human labels' },
      { id: 'crosscheck', zh: '多裁判交叉校验', en: 'Multi-judge cross-checks' },
      { id: 'scale', zh: '二元标尺优于 0-10 分', en: 'Binary over 0-10' },
      { id: 'drift', zh: '裁判漂移与重校准', en: 'Judge drift and recalibration' },
    ],
  },
  {
    num: '11',
    slug: 'safety',
    zhTitle: '安全、隐私与合规评测',
    enTitle: 'Safety, privacy and compliance evals',
    zhLead: '注入越狱、越权工具、PII 泄露、评测数据脱敏与多租户隔离。',
    enLead: 'Injection, over-privileged tools, PII leaks, masked eval data and tenant isolation.',
    zhTag: '红线',
    enTag: 'Red lines',
    sections: [
      { id: 'injection', zh: '越狱与提示注入评测集', en: 'Injection and jailbreak suites' },
      { id: 'pii', zh: 'PII 隐私泄露评测', en: 'PII leak checks' },
      { id: 'data', zh: '评测数据脱敏与裁判边界', en: 'Masked data, judge boundaries' },
      { id: 'isolation', zh: '日志留存与多租户隔离', en: 'Log retention and tenancy' },
      { id: 'redteam', zh: '红队评测流水线', en: 'A red-team eval pipeline' },
    ],
  },
  {
    num: '12',
    slug: 'production',
    zhTitle: '生产环境线上评测',
    enTitle: 'Online evaluation in production',
    zhLead: '线上抽样、失败自动捕获、告警联动与「发现→修复→回归」闭环。',
    enLead: 'Sampling, failure capture, alerting, and the find-fix-regress loop.',
    zhTag: '线上',
    enTag: 'Online',
    sections: [
      { id: 'sampling', zh: '线上抽样评测', en: 'Online sampling' },
      { id: 'capture', zh: '失败案例自动捕获', en: 'Automatic failure capture' },
      { id: 'alert', zh: '告警联动', en: 'Alerting' },
      { id: 'closedloop', zh: '评测闭环', en: 'The closed loop' },
      { id: 'infra', zh: '线上评测架构', en: 'Reference architecture' },
    ],
  },
  {
    num: '13',
    slug: 'pitfalls',
    zhTitle: '高频踩坑血泪清单',
    enTitle: 'The production pitfall catalog',
    zhLead: '分布脱节、只靠裁判、只看答案、没有基线、限流失真、成本爆炸、副作用未清理。',
    enLead: 'Distribution drift, judge-only grading, output-only checks, missing baselines, throttling, cost, side effects.',
    zhTag: '血泪经验',
    enTag: 'Scars included',
    sections: [
      { id: 'distribution', zh: '评测集与真实分布脱节', en: 'Eval sets that miss reality' },
      { id: 'judge-only', zh: '只信裁判，没有硬校验', en: 'Judge-only grading' },
      { id: 'output-only', zh: '只看最终答案', en: 'Output-only scoring' },
      { id: 'no-baseline', zh: '没有基线，好坏全靠感觉', en: 'No baseline, no direction' },
      { id: 'throttle', zh: '并发太高，结果失真', en: 'Throttled runs, skewed numbers' },
      { id: 'cost', zh: '评测成本爆炸', en: 'Runaway eval cost' },
      { id: 'sideeffect', zh: '副作用没有回滚', en: 'Unrolled side effects' },
    ],
  },
  {
    num: '14',
    slug: 'demos',
    zhTitle: '可直接运行的实战 Demo',
    enTitle: 'Runnable demos',
    zhLead: '最简脚本、LangSmith 接入、Promptfoo 配置、CI 模板、A/B 脚本、Trace 转样本、看板。',
    enLead: 'Minimal script, LangSmith wiring, Promptfoo config, CI template, A/B, trace-to-sample, dashboard.',
    zhTag: '可复制',
    enTag: 'Copy-ready',
    sections: [
      { id: 'minimal', zh: 'Python 最简评测脚本', en: 'A minimal Python eval' },
      { id: 'langsmith', zh: 'LangGraph + LangSmith 评测', en: 'LangGraph with LangSmith' },
      { id: 'promptfoo', zh: 'Promptfoo 批量评测配置', en: 'Promptfoo batch config' },
      { id: 'ci', zh: 'GitHub Action 回归模板', en: 'GitHub Action template' },
      { id: 'pairwise', zh: 'A/B 两两对比脚本', en: 'A/B pairwise script' },
      { id: 'otel', zh: 'OTel Trace 自动转样本', en: 'OTel traces to samples' },
      { id: 'dashboard', zh: '评测结果看板可视化', en: 'A small results dashboard' },
    ],
  },
  {
    num: '15',
    slug: 'scale',
    zhTitle: '大规模集群与高并发评测',
    enTitle: 'Evaluation at scale',
    zhLead: '异步队列、分层裁判、缓存复用、冷热分离与预算熔断。',
    enLead: 'Async queues, tiered judges, caching, hot/cold storage and budget fuses.',
    zhTag: '规模化',
    enTag: 'At scale',
    sections: [
      { id: 'queue', zh: '异步队列与限流退避', en: 'Queues and backoff' },
      { id: 'tiered', zh: '分层裁判策略', en: 'Tiered judging' },
      { id: 'cache', zh: '缓存与样本复用', en: 'Caching and reuse' },
      { id: 'storage', zh: '冷热数据分离', en: 'Hot and cold storage' },
      { id: 'budget', zh: '预算管控与熔断', en: 'Budgets and circuit breakers' },
    ],
  },
  {
    num: '16',
    slug: 'ecosystem',
    zhTitle: '完整生态联动与下一步',
    enTitle: 'Ecosystem wiring and next steps',
    zhLead: '评测如何接入调度、观测、通信、工具、记忆与网关，以及落地路线图。',
    enLead: 'How evals plug into orchestration, observability, messaging, tools, memory and gateways.',
    zhTag: '收官',
    enTag: 'Wrap-up',
    sections: [
      { id: 'better-agent', zh: 'better-agent：调度框架接入评测', en: 'better-agent: wiring evals into the loop' },
      { id: 'a2a', zh: 'a2a-patterns：跨智能体协作评测', en: 'a2a-patterns: cross-agent evaluation' },
      { id: 'mcp', zh: 'mcp-patterns：MCP 技能评测', en: 'mcp-patterns: tool and skill evals' },
      { id: 'memory', zh: 'agent-memory-patterns：记忆评测', en: 'agent-memory-patterns: memory evals' },
      { id: 'observability', zh: 'agent-observability-patterns：观测驱动评测', en: 'observability: traces drive evals' },
      { id: 'gateway', zh: 'llm-gateway-patterns：网关多模型评测', en: 'gateway: multi-model comparison' },
      { id: 'roadmap', zh: '落地路线图与检查清单', en: 'Roadmap and checklist' },
    ],
  },
]

export const chapterPath = (item: CatalogItem, lang: 'zh' | 'en') =>
  `${lang === 'en' ? '/en' : ''}/${item.slug}/`

export const findChapter = (slug: string) => catalog.find((c) => c.slug === slug)

/** 上一章 / 下一章，供自定义导航与首页使用 */
export const neighbors = (slug: string) => {
  const i = catalog.findIndex((c) => c.slug === slug)
  return {
    prev: i > 0 ? catalog[i - 1] : undefined,
    next: i >= 0 && i < catalog.length - 1 ? catalog[i + 1] : undefined,
  }
}
