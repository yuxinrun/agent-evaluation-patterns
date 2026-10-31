import type { DiagramSpec } from './index'

/** 10 裁判校准 */
export const c10: Record<string, DiagramSpec> = {
  'judge-bias': {
    kind: 'matrix',
    caption: {
      zh: '裁判的五种偏心：偏爱长答案、偏爱排在前面的、偏爱自己家的模型、怕给差评、以及随版本漂移。',
      en: 'Five judge biases: verbosity, position, self-preference, leniency and version drift.',
    },
    zh: {
      head: ['偏心类型', '表现', '怎么发现', '怎么缓解'],
      rows: [
        ['长度偏好', '越长分越高，废话也加分', '按长度分组看均分', 'rubric 要求「简洁」并单独判冗余'],
        ['位置偏好', '总选第一个 / 第二个', '交换 A/B 位置重跑', '双向对比，取一致结果'],
        ['自我偏好', '偏爱同家族模型输出', '跨家族裁判对照', '用不同家族裁判交叉'],
        ['宽松偏好', '几乎不给 FAIL', '混入已知坏样本', '加锚点样本，强制二元判定'],
        ['版本漂移', '模型升级后分数整体上移', '固定金标集复测', '锁定版本 + 定期重校准'],
      ],
      highlight: [1],
    },
    en: {
      head: ['Bias', 'Symptom', 'How to detect', 'How to mitigate'],
      rows: [
        ['Verbosity', 'Longer scores higher, fluff included', 'Group scores by length', 'Rubric demands brevity, grade redundancy'],
        ['Position', 'Always picks the first or second', 'Swap A/B and rerun', 'Two-way comparison, keep agreement'],
        ['Self-preference', 'Favours its own model family', 'Cross-family judge check', 'Use judges from other families'],
        ['Leniency', 'Almost never says FAIL', 'Seed known-bad cases', 'Anchor cases, force binary verdicts'],
        ['Drift', 'Everything rises after a model upgrade', 'Re-run a frozen gold set', 'Pin versions, recalibrate regularly'],
      ],
      highlight: [1],
    },
  },
  'calibration-loop': {
    kind: 'flow',
    caption: {
      zh: '裁判校准闭环：人工标一批 → 跑裁判 → 算一致性 → 改 rubric → 再跑，直到和人对得上。',
      en: 'Calibration loop: label by hand, run the judge, measure agreement, fix the rubric, repeat until it matches humans.',
    },
    zh: {
      dir: 'h',
      nodes: [
        { t: '人工标注 100 条', s: '两人独立标，算 Kappa', tone: 'muted' },
        { t: '跑裁判', s: '同批样本，同 rubric', tone: 'blue' },
        { t: '算一致性', s: '与人工的吻合率', tone: 'accent' },
        { t: '看分歧', s: '逐条读裁判理由', tone: 'lime' },
        { t: '改 rubric', s: '补定义、加反例', tone: 'coral' },
      ],
      edges: ['同一批', '对齐', '目标 ≥ 85%', '迭代'],
    },
    en: {
      dir: 'h',
      nodes: [
        { t: 'Label 100 cases', s: 'two raters, compute kappa', tone: 'muted' },
        { t: 'Run the judge', s: 'same cases, same rubric', tone: 'blue' },
        { t: 'Measure agreement', s: 'match rate with humans', tone: 'accent' },
        { t: 'Read disagreements', s: 'case by case, with reasons', tone: 'lime' },
        { t: 'Fix the rubric', s: 'definitions and counter-examples', tone: 'coral' },
      ],
      edges: ['same set', 'align', 'target 85%+', 'iterate'],
    },
  },
  'multi-judge': {
    kind: 'sequence',
    caption: {
      zh: '多裁判分诊：便宜模型跑全量初审，强模型只审争议，人只看两边不一致的少数。',
      en: 'Judge triage: a cheap model screens everything, a strong one reviews conflicts, humans see only the remaining few.',
    },
    zh: {
      actors: ['评测框架', '廉价裁判', '强裁判', '人工'],
      steps: [
        { from: 1, to: 2, t: '全量初审（成本 1x）' },
        { from: 2, to: 1, t: '给出 PASS / FAIL / 不确定' },
        { from: 1, to: 3, t: '只把「不确定 + 抽查 5%」送去终审' },
        { from: 3, to: 4, t: '与初审冲突的样本 → 人工裁决' },
        { from: 4, to: 1, t: '结论回写，成为校准数据', dashed: true },
      ],
    },
    en: {
      actors: ['Harness', 'Cheap judge', 'Strong judge', 'Human'],
      steps: [
        { from: 1, to: 2, t: 'Screen everything (1x cost)' },
        { from: 2, to: 1, t: 'PASS, FAIL or unsure' },
        { from: 1, to: 3, t: 'Send unsure plus a 5% sample for review' },
        { from: 3, to: 4, t: 'Conflicts go to a human arbiter' },
        { from: 4, to: 1, t: 'Verdicts feed the calibration set', dashed: true },
      ],
    },
  },
}
