import type { DiagramSpec } from './index'

/** 07 A/B 实验 */
export const c07: Record<string, DiagramSpec> = {
  'ab-design': {
    kind: 'compare',
    caption: {
      zh: '一次只动一个变量：同时改 Prompt、模型和温度，赢了也不知道是谁的功劳。',
      en: 'One variable at a time. Change prompt, model and temperature together and you learn nothing from a win.',
    },
    zh: {
      left: {
        title: '混乱实验',
        sub: '三处一起改',
        points: [
          'Prompt 改了，模型也换了',
          '温度从 0.2 调到 0.7',
          '评测集顺手补了 20 条',
          '结果变好，但无法归因',
        ],
      },
      right: {
        title: '干净实验',
        sub: '单一变量',
        points: [
          '只改 Prompt，模型与温度冻结',
          '评测集版本锁定，不许中途改',
          'A/B 各跑同一批样本',
          '结论可以写进决策记录',
        ],
      },
      axis: '不能归因的对比，只是两次随机的合影',
    },
    en: {
      left: {
        title: 'Messy experiment',
        sub: 'Three changes at once',
        points: [
          'Prompt changed, model swapped',
          'Temperature 0.2 to 0.7',
          'Added 20 cases mid-flight',
          'Scores went up, cause unknown',
        ],
      },
      right: {
        title: 'Clean experiment',
        sub: 'One variable',
        points: [
          'Prompt only; model and temperature frozen',
          'Dataset version locked',
          'A and B on identical cases',
          'Conclusion can be written down',
        ],
      },
      axis: 'An unattributable comparison is two random photos',
    },
  },
  'ab-report': {
    kind: 'matrix',
    caption: {
      zh: '版本对比报表：横向是版本，纵向是指标，最后一列写「是否值得上」。',
      en: 'Version comparison: versions across, metrics down, and a final column saying whether it ships.',
    },
    zh: {
      head: ['指标', 'v1.2 基线', 'v1.3 Prompt', 'v1.4 换模型', '结论'],
      rows: [
        ['任务完成率', '92.1%', '94.0%', '95.2%', 'v1.4 最优'],
        ['幻觉率', '1.9%', '1.2%', '2.6%', 'v1.3 最稳'],
        ['平均轮次', '5.1', '3.8', '4.6', 'v1.3 省轮次'],
        ['P95 耗时', '9.8s', '9.1s', '6.2s', 'v1.4 最快'],
        ['单任务成本', '¥0.18', '¥0.17', '¥0.31', 'v1.4 变贵'],
        ['综合建议', '—', '可上线', '只在慢查询场景灰度', '分场景发布'],
      ],
      highlight: [5],
    },
    en: {
      head: ['Metric', 'v1.2 base', 'v1.3 prompt', 'v1.4 model', 'Verdict'],
      rows: [
        ['Task success', '92.1%', '94.0%', '95.2%', 'v1.4 best'],
        ['Hallucination', '1.9%', '1.2%', '2.6%', 'v1.3 safest'],
        ['Avg turns', '5.1', '3.8', '4.6', 'v1.3 leanest'],
        ['P95 latency', '9.8s', '9.1s', '6.2s', 'v1.4 fastest'],
        ['Cost per task', '$0.025', '$0.024', '$0.043', 'v1.4 pricier'],
        ['Recommendation', '—', 'ship', 'canary on slow queries', 'ship per scenario'],
      ],
      highlight: [5],
    },
  },
  canary: {
    kind: 'flow',
    caption: {
      zh: '灰度评测：线上切 5% 流量给新版本，同一条链路里既测业务指标，也测评测分数。',
      en: 'Canary: send 5% of traffic to the new version and collect both business metrics and eval scores in one path.',
    },
    zh: {
      dir: 'h',
      nodes: [
        { t: '入口分流', s: '5% → vNext', tone: 'muted' },
        { t: '同步抽样', s: '10% 请求进评测队列', tone: 'blue' },
        { t: '异步打分', s: '不阻塞用户', tone: 'accent' },
        { t: '自动对比', s: 'vNext vs 稳定版', tone: 'lime' },
        { t: '扩量 / 回滚', s: '按指标与分数决定', tone: 'coral' },
      ],
      edges: ['分流', '旁路', '离线', '判定'],
    },
    en: {
      dir: 'h',
      nodes: [
        { t: 'Split traffic', s: '5% to vNext', tone: 'muted' },
        { t: 'Sample', s: '10% into eval queue', tone: 'blue' },
        { t: 'Async grade', s: 'never blocks users', tone: 'accent' },
        { t: 'Auto compare', s: 'vNext vs stable', tone: 'lime' },
        { t: 'Ramp or roll back', s: 'metrics plus scores', tone: 'coral' },
      ],
      edges: ['split', 'sidecar', 'offline', 'decide'],
    },
  },
}
