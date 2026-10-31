/**
 * 生态矩阵：七个站点互相导流，首页、侧边栏与章节页尾共用。
 * Ecosystem matrix shared by the home page, sidebar and chapter footers.
 */

export interface EcoItem {
  key:
    | 'better-agent'
    | 'a2a-patterns'
    | 'agent-memory-patterns'
    | 'mcp-patterns'
    | 'llm-gateway-patterns'
    | 'agent-observability-patterns'
    | 'agent-evaluation-patterns'
  name: string
  url: string
  glyph: string
  zhRole: string
  enRole: string
  zhDesc: string
  enDesc: string
  current?: boolean
}

export const ecosystem: EcoItem[] = [
  {
    key: 'better-agent',
    name: 'better-agent',
    url: 'https://yuxinrun.github.io/better-agent/',
    glyph: 'BA',
    zhRole: 'Agent 调度核心',
    enRole: 'Agent orchestration core',
    zhDesc: '单智能体怎么造：循环、工具、上下文、评测与上线。',
    enDesc: 'How to build one great agent: loop, tools, context, evals, shipping.',
  },
  {
    key: 'agent-observability-patterns',
    name: 'agent-observability-patterns',
    url: 'https://yuxinrun.github.io/agent-observability-patterns/',
    glyph: 'OBS',
    zhRole: 'Agent 可观测',
    enRole: 'Agent observability',
    zhDesc: 'Agent 怎么被看清：Trace、指标、日志、根因与告警。',
    enDesc: 'How agents get seen: traces, metrics, logs, root cause, alerts.',
  },
  {
    key: 'agent-evaluation-patterns',
    name: 'agent-evaluation-patterns',
    url: 'https://yuxinrun.github.io/agent-evaluation-patterns/',
    glyph: 'EVAL',
    zhRole: 'Agent 评测工程',
    enRole: 'Agent evaluation engineering',
    zhDesc: 'Agent 怎么被判定好坏：数据集、裁判、轨迹、门禁与回归。',
    enDesc: 'How agents get judged: datasets, graders, trajectories, gates, regressions.',
    current: true,
  },
  {
    key: 'agent-memory-patterns',
    name: 'agent-memory-patterns',
    url: 'https://yuxinrun.github.io/agent-memory-patterns/',
    glyph: 'MEM',
    zhRole: 'Agent 记忆工程',
    enRole: 'Agent memory engineering',
    zhDesc: 'Agent 怎么记住事：分层记忆、检索、压缩、遗忘与隔离。',
    enDesc: 'How agents remember: tiers, retrieval, compression, forgetting, isolation.',
  },
  {
    key: 'a2a-patterns',
    name: 'a2a-patterns',
    url: 'https://yuxinrun.github.io/a2a-patterns/',
    glyph: 'A2A',
    zhRole: 'Agent 横向通信',
    enRole: 'Agent-to-agent messaging',
    zhDesc: '多个 Agent 怎么互相说话：发现、委派、任务、流式、安全。',
    enDesc: 'How agents talk to each other: discovery, delegation, tasks, streams, safety.',
  },
  {
    key: 'mcp-patterns',
    name: 'mcp-patterns',
    url: 'https://yuxinrun.github.io/mcp-patterns/',
    glyph: 'MCP',
    zhRole: 'Agent 工具调用',
    enRole: 'Tool calling',
    zhDesc: 'Agent 怎么用工具：Server、资源、提示、权限与工程化。',
    enDesc: 'How agents use tools: servers, resources, prompts, permissions.',
  },
  {
    key: 'llm-gateway-patterns',
    name: 'llm-gateway-patterns',
    url: 'https://yuxinrun.github.io/llm-gateway-patterns/',
    glyph: 'GW',
    zhRole: '模型流量网关',
    enRole: 'Model traffic gateway',
    zhDesc: '模型怎么被安全地调用：路由、限流、成本、审计与灰度。',
    enDesc: 'How models get called safely: routing, rate limits, cost, audit, rollouts.',
  },
]

export const siteMeta = {
  nameZh: 'Agent 评测手册',
  nameEn: 'Agent Evaluation Patterns',
  sloganZh: '不是 Agent 变差了，是你根本没量过。',
  sloganEn: 'Your agent did not get worse. You just never measured it.',
  taglineZh:
    '面向工程师与架构师的 Agent 评测工程手册：数据集怎么建、裁判怎么调、轨迹怎么判、门禁怎么卡，全部可落地。',
  taglineEn:
    'An engineering field guide to agent evaluation: datasets, judges, trajectories, release gates — all shippable.',
  author: '鱼心',
  authorEn: 'Yuxin',
  authorUrl: 'https://yuxin.run',
  repo: 'https://github.com/yuxinrun/agent-evaluation-patterns',
  license: 'MIT',
}
