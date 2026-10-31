import type { DiagramSpec } from './index'

/** 06 CI 流水线 */
export const c06: Record<string, DiagramSpec> = {
  'ci-pipeline': {
    kind: 'flow',
    caption: {
      zh: '从提交到阻断：跑样本 → 打分 → 对比基线 → 判定 → 出报告，全程不需要人守着。',
      en: 'Commit to block: run cases, grade, diff the baseline, decide, report — with nobody watching.',
    },
    zh: {
      dir: 'h',
      nodes: [
        { t: 'PR 提交', s: '代码 / Prompt 变更', tone: 'muted' },
        { t: '跑评测集', s: '冒烟集优先', tone: 'blue' },
        { t: '自动打分', s: '代码 + 裁判', tone: 'accent' },
        { t: '对比基线', s: '计算劣化幅度', tone: 'lime' },
        { t: '阻断 / 放行', s: '写回 PR 评论', tone: 'coral' },
      ],
      edges: ['触发', '并发受控', '结构化结果', '阈值判定'],
    },
    en: {
      dir: 'h',
      nodes: [
        { t: 'PR opens', s: 'code or prompt change', tone: 'muted' },
        { t: 'Run suites', s: 'smoke first', tone: 'blue' },
        { t: 'Grade', s: 'code plus judges', tone: 'accent' },
        { t: 'Diff baseline', s: 'compute regression', tone: 'lime' },
        { t: 'Block or ship', s: 'comment on the PR', tone: 'coral' },
      ],
      edges: ['trigger', 'bounded concurrency', 'structured', 'thresholds'],
    },
  },
  'baseline-delta': {
    kind: 'matrix',
    caption: {
      zh: '基线不是「上次的分数」，而是「上一个稳定版本的分数」。比的对象错了，结论就全错。',
      en: 'A baseline is not "last run", it is "last stable release". Compare against the wrong thing and every conclusion is wrong.',
    },
    zh: {
      head: ['指标', '稳定版', '本次', '变化', '判定'],
      rows: [
        ['任务完成率', '92.1%', '91.4%', '-0.7pt', '在噪声内'],
        ['工具误调用率', '2.6%', '0.8%', '-1.8pt', '显著改善'],
        ['平均轮次', '5.1', '4.2', '-0.9', '改善'],
        ['P95 耗时', '9.8s', '12.4s', '+2.6s', '超预算'],
        ['单任务成本', '¥0.18', '¥0.21', '+16%', '需审批'],
      ],
      highlight: [1, 3],
    },
    en: {
      head: ['Metric', 'Stable', 'Now', 'Delta', 'Verdict'],
      rows: [
        ['Task success', '92.1%', '91.4%', '-0.7pt', 'within noise'],
        ['Wrong tools', '2.6%', '0.8%', '-1.8pt', 'clear win'],
        ['Avg turns', '5.1', '4.2', '-0.9', 'better'],
        ['P95 latency', '9.8s', '12.4s', '+2.6s', 'over budget'],
        ['Cost per task', '$0.025', '$0.029', '+16%', 'needs sign-off'],
      ],
      highlight: [1, 3],
    },
  },
  'tiered-ci': {
    kind: 'layers',
    caption: {
      zh: '三级执行：本地几百毫秒，PR 几分钟，发版前几十分钟。每一级只跑该跑的量。',
      en: 'Three tiers: local in milliseconds, PR in minutes, pre-release in tens of minutes. Each runs only what it must.',
    },
    zh: {
      layers: [
        { t: '本地 / 保存时', items: ['10~20 条金句级用例', '纯代码断言，不打模型', '几秒出结果'], tone: 'accent' },
        { t: 'PR / 合并前', items: ['冒烟集 30~80 条', '代码 + 轻量裁判', '3~8 分钟'], tone: 'blue' },
        { t: '夜间 / 发版前', items: ['回归集 + 长尾集', '全量裁判 + 人工抽检', '30~120 分钟'], tone: 'coral' },
      ],
      note: '分级的意义：让「必须等」的环节足够短，让「慢而全」的环节留在夜里。',
    },
    en: {
      layers: [
        { t: 'Local / on save', items: ['10-20 canonical cases', 'Code asserts only, no model calls', 'Seconds'], tone: 'accent' },
        { t: 'PR / pre-merge', items: ['Smoke set, 30-80 cases', 'Code plus light judges', '3-8 minutes'], tone: 'blue' },
        { t: 'Nightly / pre-release', items: ['Regression and long-tail', 'Full judges plus human sample', '30-120 minutes'], tone: 'coral' },
      ],
      note: 'The point of tiers: keep the blocking step short, push the slow-and-wide step to the night.',
    },
  },
}
