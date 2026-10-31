import type { DiagramSpec } from './index'

/** 00 开篇 */
export const c00: Record<string, DiagramSpec> = {
  'eval-gap': {
    kind: 'flow',
    caption: {
      zh: '改一版提示词、换一个模型，团队只能靠「感觉好像好一点」做决策——这就是没有评测的日常。',
      en: 'Change a prompt, swap a model, and the team decides on "feels a bit better". That is life without evals.',
    },
    zh: {
      dir: 'h',
      nodes: [
        { t: '改 Prompt', s: '或换模型、加工具', tone: 'accent' },
        { t: '本地试 5 条', s: '「看起来更聪明了」', tone: 'blue' },
        { t: '上线', s: '全量用户', tone: 'coral' },
        { t: '一周后', s: '投诉变多，但说不清哪坏了', tone: 'muted' },
        { t: '回滚', s: '连回滚都不敢，怕更糟', tone: 'coral' },
      ],
      edges: ['凭感觉', '凭感觉', '没有度量', '没有证据'],
    },
    en: {
      dir: 'h',
      nodes: [
        { t: 'Tweak prompt', s: 'or model, or tools', tone: 'accent' },
        { t: 'Try 5 cases', s: '"looks smarter"', tone: 'blue' },
        { t: 'Ship', s: 'all users', tone: 'coral' },
        { t: 'A week later', s: 'more complaints, no clue why', tone: 'muted' },
        { t: 'Rollback?', s: 'afraid it gets worse', tone: 'coral' },
      ],
      edges: ['gut feel', 'gut feel', 'no measurement', 'no evidence'],
    },
  },
  'llm-vs-agent': {
    kind: 'compare',
    caption: {
      zh: '普通 LLM 评测看「答案对不对」，Agent 评测还要看「这一路上它做了什么」。',
      en: 'LLM evals check the answer. Agent evals also check the road taken to get there.',
    },
    zh: {
      left: {
        title: '普通 LLM 评测',
        sub: '一问一答，单步',
        points: [
          '输入：一句 prompt',
          '输出：一段文本',
          '判定：对不对、像不像、有没有害',
          '成本：一次调用判一次',
          '失败模式：答歪了',
        ],
      },
      right: {
        title: 'Agent 评测',
        sub: '多轮决策，带工具与状态',
        points: [
          '输入：目标 + 环境 + 工具集',
          '输出：答案 + 一整条轨迹',
          '判定：结果对、路径合理、副作用干净',
          '成本：一条轨迹几十次调用',
          '失败模式：走弯路、乱调工具、悄悄改数据',
        ],
      },
      axis: '同样叫「评测」，要判的东西差了整整一层',
    },
    en: {
      left: {
        title: 'LLM evals',
        sub: 'One question, one answer',
        points: [
          'Input: a prompt',
          'Output: some text',
          'Judge: correct, similar, safe',
          'Cost: one call per case',
          'Failure: a wrong answer',
        ],
      },
      right: {
        title: 'Agent evals',
        sub: 'Multi-step decisions with tools and state',
        points: [
          'Input: goal, environment, toolset',
          'Output: answer plus a whole trajectory',
          'Judge: right result, sane path, clean side effects',
          'Cost: dozens of calls per case',
          'Failure: detours, wrong tools, silent writes',
        ],
      },
      axis: 'Same word, one layer more to judge',
    },
  },
  'eval-loop': {
    kind: 'lifecycle',
    caption: {
      zh: '评测不是一次性考试，而是一条环：观测抓现场 → 采样成样本 → 打分 → 修复 → 回归。',
      en: 'Evaluation is a loop, not an exam: observe, sample, score, fix, regress.',
    },
    zh: {
      states: [
        { t: '生产流量', s: '真实请求与 Trace', tone: 'muted' },
        { t: '采样入库', s: '失败与高分样本', tone: 'blue' },
        { t: '自动打分', s: '代码校验 + 裁判', tone: 'accent' },
        { t: '定位修复', s: 'Prompt / 工具 / 模型', tone: 'lime' },
        { t: '回归验证', s: '基线对比，不许退化', tone: 'coral' },
      ],
      note: '环上没有「结束」这一步：每次修复都要回到数据集，成为新的防线。',
    },
    en: {
      states: [
        { t: 'Production traffic', s: 'real requests and traces', tone: 'muted' },
        { t: 'Sampled into sets', s: 'failures and great runs', tone: 'blue' },
        { t: 'Auto-graded', s: 'code checks plus judges', tone: 'accent' },
        { t: 'Fix', s: 'prompt, tools, model', tone: 'lime' },
        { t: 'Regress', s: 'baseline must not drop', tone: 'coral' },
      ],
      note: 'There is no exit: every fix becomes a new line of defence in the dataset.',
    },
  },
  'eval-stack': {
    kind: 'layers',
    caption: {
      zh: '七块拼图：网关管流量，调度管循环，观测管看清，评测管判定，记忆管记住，通信管协作，工具管执行。',
      en: 'Seven pieces: gateway moves traffic, orchestration runs the loop, observability makes it visible, evaluation judges it.',
    },
    zh: {
      layers: [
        { t: '入口层：llm-gateway-patterns', items: ['路由、限流、成本、审计', '为评测提供模型侧数据'], tone: 'muted' },
        { t: '调度层：better-agent', items: ['Agent 循环、工具选择、上下文预算', '评测跑批的入口'], tone: 'accent' },
        { t: '观测层：agent-observability-patterns', items: ['Trace、日志、指标、根因', '评测样本的原料仓'], tone: 'blue' },
        { t: '评测层：agent-evaluation-patterns', items: ['数据集、裁判、轨迹判定', '门禁、回归、A/B'], tone: 'lime' },
        { t: '能力层：memory / a2a / mcp', items: ['记忆读写、跨 Agent 委派、工具执行', '各自的专项评测'], tone: 'coral' },
      ],
    },
    en: {
      layers: [
        { t: 'Edge: llm-gateway-patterns', items: ['Routing, limits, cost, audit', 'Model-side data for evals'], tone: 'muted' },
        { t: 'Orchestration: better-agent', items: ['Agent loop, tool choice, context budget', 'Entry point for eval runs'], tone: 'accent' },
        { t: 'Observability: agent-observability-patterns', items: ['Traces, logs, metrics, root cause', 'The raw material for eval sets'], tone: 'blue' },
        { t: 'Evaluation: agent-evaluation-patterns', items: ['Datasets, judges, trajectory verdicts', 'Gates, regressions, A/B'], tone: 'lime' },
        { t: 'Capabilities: memory / a2a / mcp', items: ['Memory IO, cross-agent delegation, tools', 'Each with its own eval suite'], tone: 'coral' },
      ],
    },
  },
}
