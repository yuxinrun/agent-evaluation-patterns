import type { DiagramSpec } from './index'

/** 01 基础概念 */
export const c01: Record<string, DiagramSpec> = {
  'eval-objects': {
    kind: 'layers',
    caption: {
      zh: '三层评测对象：Run 管单步，Trace 管一次任务，Thread 管一段多轮会话。粒度越粗，越接近用户体验。',
      en: 'Three objects: Run is one step, Trace is one task, Thread is a multi-turn conversation.',
    },
    zh: {
      layers: [
        { t: '单步 Run', items: ['一次模型调用或一次工具调用', '判：参数对不对、输出合不合 schema'], tone: 'blue' },
        { t: '单次任务 Trace', items: ['一个用户目标触发的完整轨迹', '判：办成了没、路径合理不、副作用干净不'], tone: 'accent' },
        { t: '多轮会话 Thread', items: ['跨轮次、跨天的一串 Trace', '判：记得住不、前后一致不、越聊越跑偏不'], tone: 'lime' },
      ],
      note: '先统一「你说的评测是哪一层」，80% 的评测争议就此消失。',
    },
    en: {
      layers: [
        { t: 'Single run', items: ['One model call or one tool call', 'Judge: right args, valid schema'], tone: 'blue' },
        { t: 'Task trace', items: ['Full trajectory for one user goal', 'Judge: done or not, sane path, clean effects'], tone: 'accent' },
        { t: 'Conversation thread', items: ['Traces across turns and days', 'Judge: remembers, stays consistent, no drift'], tone: 'lime' },
      ],
      note: 'Agree on which layer you mean; 80% of eval arguments disappear.',
    },
  },
  'grader-kinds': {
    kind: 'matrix',
    caption: {
      zh: '四类评测器各有代价：代码最稳最便宜，裁判最灵活最贵，人工最准最慢，两两对比最抗波动。',
      en: 'Four graders, four trade-offs: code is cheap and stable, judges are flexible and pricey, humans are accurate and slow, pairwise is noise-resistant.',
    },
    zh: {
      head: ['评测器', '判什么', '单条成本', '最大风险'],
      rows: [
        ['代码校验', '结构、数值、状态、工具入参', '≈0', '只能判硬规则，判不了「好不好」'],
        ['LLM 裁判', '语义质量、事实性、语气', '¥0.01~0.2', '偏心、漂移、自己也会幻觉'],
        ['人工评审', '细微体验、专业判断', '¥1~20', '慢、贵、标注员之间不一致'],
        ['两两对比', 'A 和 B 谁更好', '¥0.02~0.4', '只能排序，给不出绝对分'],
      ],
      highlight: [1],
    },
    en: {
      head: ['Grader', 'Judges', 'Cost per case', 'Biggest risk'],
      rows: [
        ['Code check', 'Structure, numbers, state, tool args', '≈0', 'Only hard rules, not "quality"'],
        ['LLM judge', 'Semantics, factuality, tone', '$0.002~0.03', 'Bias, drift, its own hallucinations'],
        ['Human', 'Subtle UX, domain judgement', '$0.15~3', 'Slow, costly, rater disagreement'],
        ['Pairwise', 'Which of A or B is better', '$0.003~0.06', 'Ranks only, no absolute score'],
      ],
      highlight: [1],
    },
  },
  'golden-dataset': {
    kind: 'sequence',
    caption: {
      zh: '黄金数据集的诞生：从真实会话里挑样本，人工定标准答案，再固化成可重复跑的用例。',
      en: 'How a golden set is born: pick real sessions, define the answer by hand, freeze it into repeatable cases.',
    },
    zh: {
      actors: ['生产 Trace', '工程师', '领域专家', '数据集仓库'],
      steps: [
        { from: 1, to: 2, t: '抽样：失败 + 高价值 + 边界' },
        { from: 2, to: 3, t: '请专家写标准答案与判分点' },
        { from: 3, to: 2, t: '裁决分歧，形成 rubric' },
        { from: 2, to: 4, t: '入库：版本号 + 标签 + 判分器' },
        { from: 4, to: 1, t: '回放线上新流量，补充缺口', dashed: true },
      ],
    },
    en: {
      actors: ['Prod traces', 'Engineer', 'Domain expert', 'Dataset repo'],
      steps: [
        { from: 1, to: 2, t: 'Sample failures, high-value, edge cases' },
        { from: 2, to: 3, t: 'Experts write answers and checkpoints' },
        { from: 3, to: 2, t: 'Resolve disagreements into a rubric' },
        { from: 2, to: 4, t: 'Store with version, tags, graders' },
        { from: 4, to: 1, t: 'Replay new traffic to fill gaps', dashed: true },
      ],
    },
  },
  'rubric-shape': {
    kind: 'compare',
    caption: {
      zh: '模糊的 0-10 分让裁判自由发挥；可复现的二元判定让裁判只能回答「过 / 不过」。',
      en: 'A vague 0-10 scale invites improvisation. A reproducible binary rubric forces pass or fail.',
    },
    zh: {
      left: {
        title: '坏标尺',
        sub: '"请给这个回答打分（0-10）"',
        points: [
          '同一答案两次跑出 7 分和 9 分',
          '没人说得清 7 分和 8 分的界线',
          '版本之间差 0.3 分，无法判断好坏',
          '裁判偏好长答案，篇幅越长分越高',
        ],
      },
      right: {
        title: '好评尺',
        sub: '逐条 pass/fail，并写清证据',
        points: [
          '结论必须是 PASS 或 FAIL',
          '每条都有可核对的定义与反例',
          '要求引用原文片段作为证据',
          '整体通过率 = 通过条数 / 总条数',
        ],
      },
      axis: '标尺越模糊，你测的越是裁判的心情',
    },
    en: {
      left: {
        title: 'Bad rubric',
        sub: '"Rate this answer 0-10"',
        points: [
          'Same answer scores 7 then 9',
          'Nobody can define the 7 vs 8 line',
          'A 0.3 delta cannot be interpreted',
          'Longer answers score higher, always',
        ],
      },
      right: {
        title: 'Good rubric',
        sub: 'Itemised pass/fail with evidence',
        points: [
          'Verdicts must be PASS or FAIL',
          'Each item has a definition and a counter-example',
          'The judge must quote evidence from the text',
          'Score = passed items / total items',
        ],
      },
      axis: 'The vaguer the rubric, the more you measure the judge mood',
    },
  },
}
