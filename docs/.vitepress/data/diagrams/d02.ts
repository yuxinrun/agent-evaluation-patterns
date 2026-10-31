import type { DiagramSpec } from './index'

/** 02 指标体系 */
export const c02: Record<string, DiagramSpec> = {
  'metric-tiers': {
    kind: 'layers',
    caption: {
      zh: '四层指标：结果回答「办成没有」，轨迹回答「怎么干的」，成本回答「值不值」，体验回答「用户还想用吗」。',
      en: 'Four tiers: outcome asks "did it work", trajectory asks "how", cost asks "worth it", experience asks "would they use it again".',
    },
    zh: {
      layers: [
        { t: '结果层', items: ['任务完成率、幻觉率、事实保真率、合规通过率'], tone: 'accent' },
        { t: '轨迹层', items: ['工具选择正确率、冗余调用、规划合理性、绕路步数'], tone: 'blue' },
        { t: '成本层', items: ['平均轮次、Token 消耗、TTFT、P95 耗时、重试次数'], tone: 'lime' },
        { t: '体验层', items: ['人工修正率、用户否定率、中途取消率、重复提问率'], tone: 'coral' },
      ],
      note: '上线门禁看结果层，内部优化看轨迹层，老板看成本层，业务看体验层。',
    },
    en: {
      layers: [
        { t: 'Outcome', items: ['Task success, hallucination rate, factuality, compliance'], tone: 'accent' },
        { t: 'Trajectory', items: ['Tool choice accuracy, redundant calls, plan sanity, detour steps'], tone: 'blue' },
        { t: 'Cost', items: ['Turns, tokens, TTFT, P95 latency, retries'], tone: 'lime' },
        { t: 'Experience', items: ['Correction rate, thumbs-down rate, abandonment, repeat asks'], tone: 'coral' },
      ],
      note: 'Gates watch outcome, engineers watch trajectory, finance watches cost, the business watches experience.',
    },
  },
  'kpi-board': {
    kind: 'matrix',
    caption: {
      zh: '一块能开会用的看板：每行一个指标，同时给出当前值、基线、变化和红黄绿灯。',
      en: 'A dashboard you can hold a meeting with: current value, baseline, delta, and a traffic light.',
    },
    zh: {
      head: ['指标', '本周', '基线', '变化', '状态'],
      rows: [
        ['任务完成率', '91.4%', '92.1%', '-0.7pt', '黄'],
        ['幻觉率', '2.3%', '1.9%', '+0.4pt', '黄'],
        ['工具误调用率', '0.8%', '2.6%', '-1.8pt', '绿'],
        ['平均轮次', '4.2', '5.1', '-0.9', '绿'],
        ['P95 耗时', '12.4s', '9.8s', '+2.6s', '红'],
        ['单任务成本', '¥0.21', '¥0.18', '+16%', '红'],
      ],
      highlight: [4, 5],
    },
    en: {
      head: ['Metric', 'This week', 'Baseline', 'Delta', 'Status'],
      rows: [
        ['Task success', '91.4%', '92.1%', '-0.7pt', 'amber'],
        ['Hallucination', '2.3%', '1.9%', '+0.4pt', 'amber'],
        ['Wrong tool calls', '0.8%', '2.6%', '-1.8pt', 'green'],
        ['Avg turns', '4.2', '5.1', '-0.9', 'green'],
        ['P95 latency', '12.4s', '9.8s', '+2.6s', 'red'],
        ['Cost per task', '$0.029', '$0.025', '+16%', 'red'],
      ],
      highlight: [4, 5],
    },
  },
  'slo-gate': {
    kind: 'flow',
    caption: {
      zh: '门禁不是「跑完就发」，而是先过硬红线，再看是否相对基线退化，最后才轮到人拍板。',
      en: 'A gate is not "tests finished". Hard red lines first, then baseline deltas, then a human decides.',
    },
    zh: {
      dir: 'h',
      nodes: [
        { t: '跑评测集', s: '回归集 + 安全集', tone: 'blue' },
        { t: '硬红线', s: '注入成功=0，PII 泄露=0', tone: 'coral' },
        { t: '基线对比', s: '完成率不许跌 > 2pt', tone: 'accent' },
        { t: '人工复核', s: '红黄灯 + 失败样本', tone: 'lime' },
        { t: '放行 / 阻断', s: '自动写回基线', tone: 'muted' },
      ],
      edges: ['先筛', '再比', '看证据', '留痕'],
    },
    en: {
      dir: 'h',
      nodes: [
        { t: 'Run suites', s: 'regression + safety', tone: 'blue' },
        { t: 'Hard red lines', s: 'zero injections, zero leaks', tone: 'coral' },
        { t: 'Baseline diff', s: 'no >2pt success drop', tone: 'accent' },
        { t: 'Human review', s: 'flags plus failing traces', tone: 'lime' },
        { t: 'Ship or block', s: 'baseline auto-updated', tone: 'muted' },
      ],
      edges: ['filter', 'compare', 'evidence', 'audit'],
    },
  },
}
