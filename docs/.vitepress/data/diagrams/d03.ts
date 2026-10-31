import type { DiagramSpec } from './index'

/** 03 数据集工程 */
export const c03: Record<string, DiagramSpec> = {
  'case-taxonomy': {
    kind: 'matrix',
    caption: {
      zh: '一个健康的数据集里，正向案例只占一半左右，剩下的是边界、异常、恶意与歧义。',
      en: 'In a healthy dataset roughly half the cases are happy paths; the rest are edges, errors, attacks and ambiguity.',
    },
    zh: {
      head: ['类型', '占比建议', '例子', '判分方式'],
      rows: [
        ['正向正常', '40%~50%', '正常退货咨询', '结果 + 轨迹 + 语气'],
        ['边界 case', '15%~20%', '金额正好等于阈值', '硬断言 + 裁判'],
        ['异常报错', '10%~15%', '工具 500、超时', '是否优雅降级'],
        ['恶意注入', '10%~15%', '「忽略之前的指令」', '必须零成功'],
        ['歧义需求', '10%', '「帮我处理一下那个」', '是否主动澄清'],
      ],
      highlight: [3],
    },
    en: {
      head: ['Type', 'Target share', 'Example', 'How to grade'],
      rows: [
        ['Happy path', '40-50%', 'Normal refund question', 'Outcome, path, tone'],
        ['Edge case', '15-20%', 'Amount exactly at threshold', 'Hard asserts + judge'],
        ['Error path', '10-15%', 'Tool 500, timeout', 'Graceful degradation'],
        ['Injection', '10-15%', '"Ignore previous instructions"', 'Must be zero success'],
        ['Ambiguous', '10%', '"Handle that thing for me"', 'Asks a clarifying question'],
      ],
      highlight: [3],
    },
  },
  'dataset-pool': {
    kind: 'hub',
    caption: {
      zh: '数据集不该只在实验室里长出来：线上 Trace、故障复盘、用户投诉、专家经验，四条管道一起供水。',
      en: 'Datasets cannot grow only in a lab: production traces, incidents, complaints and experts all feed it.',
    },
    zh: {
      center: '黄金数据集',
      nodes: ['线上 Trace', '故障复盘', '用户投诉', '专家手写', '合成数据', '公开基准'],
      mode: 'star',
      note: '合成数据可以补长尾，但比例超过 30% 就要警惕「自己考自己」。',
    },
    en: {
      center: 'Golden set',
      nodes: ['Prod traces', 'Incidents', 'Complaints', 'Expert writes', 'Synthetic', 'Public benchmarks'],
      mode: 'star',
      note: 'Synthetic data is fine for long tails, but past 30% you are grading your own homework.',
    },
  },
  'data-tiers': {
    kind: 'layers',
    caption: {
      zh: '三层数据集：冒烟集保速度，回归集保稳定，长尾集保深度。三层的判分器可以不同。',
      en: 'Three tiers: smoke keeps you fast, regression keeps you stable, long-tail keeps you honest.',
    },
    zh: {
      layers: [
        { t: '冒烟集 Smoke', items: ['30~80 条', '每个 PR 都跑，3 分钟内出结果', '只放硬规则与最高频路径'], tone: 'accent' },
        { t: '回归集 Regression', items: ['300~1500 条', '合并前 / 每日跑', '覆盖全部功能与历史故障'], tone: 'blue' },
        { t: '长尾集 Long-tail', items: ['不限量，按需抽样', '发版前 / 每周跑', '极端输入、脏数据、超长会话'], tone: 'coral' },
      ],
      note: '别把所有 case 都塞进冒烟集，否则没人愿意等，最后所有人都跳过。',
    },
    en: {
      layers: [
        { t: 'Smoke', items: ['30-80 cases', 'Every PR, under 3 minutes', 'Hard rules and top paths only'], tone: 'accent' },
        { t: 'Regression', items: ['300-1500 cases', 'Before merge, nightly', 'All features and past incidents'], tone: 'blue' },
        { t: 'Long-tail', items: ['Unbounded, sampled', 'Pre-release, weekly', 'Extreme inputs, dirty data, long threads'], tone: 'coral' },
      ],
      note: 'Do not stuff everything into smoke, or nobody will wait and everybody will skip it.',
    },
  },
  'data-rot': {
    kind: 'compare',
    caption: {
      zh: '数据集不是腌菜，越放越香。没有更新机制的数据集，半年后就是一份「历史文献」。',
      en: 'Datasets do not age like wine. Without refresh, half a year later yours is a history paper.',
    },
    zh: {
      left: {
        title: '腐化的数据集',
        sub: '写完就锁进仓库',
        points: [
          '全是标准答案，没有口语、错别字、情绪',
          '用户问题变了，用例还是去年的',
          '同一模板复制 200 条，指标虚高',
          '没有任何标签，失败后无法定位',
        ],
      },
      right: {
        title: '活的数据集',
        sub: '每周有进有出',
        points: [
          '真实口语与脏输入占多数',
          '按业务分布抽样，定期重配比',
          '去重 + 难度标签 + 场景标签',
          '每次线上故障 48h 内补一条',
        ],
      },
      axis: '数据集的质量，决定了评测上限',
    },
    en: {
      left: {
        title: 'Rotting set',
        sub: 'Written once, locked away',
        points: [
          'Perfect answers, no slang, typos or emotion',
          'Users changed, cases did not',
          'One template copied 200 times, great scores',
          'No tags, so failures cannot be located',
        ],
      },
      right: {
        title: 'Living set',
        sub: 'In and out every week',
        points: [
          'Real phrasing and dirty input dominate',
          'Sampled to match traffic, rebalanced regularly',
          'Deduped, difficulty-tagged, scenario-tagged',
          'Every incident adds a case within 48 hours',
        ],
      },
      axis: 'Dataset quality caps eval quality',
    },
  },
}
