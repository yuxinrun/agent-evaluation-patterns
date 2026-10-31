import type { DiagramSpec } from './index'

/** 04 四大评测器 */
export const c04: Record<string, DiagramSpec> = {
  'grader-map': {
    kind: 'hub',
    caption: {
      zh: '同一个评测任务，可以四把尺子量：代码、裁判、两两对比、人工。选错尺子，量出来的是幻觉。',
      en: 'One task, four rulers: code, judge, pairwise, human. Pick wrong and you measure fiction.',
    },
    zh: {
      center: '一条评测样本',
      nodes: ['代码断言', 'LLM 裁判', '两两对比', '人工评审'],
      mode: 'star',
      note: '先用代码把硬规则锁死，再让裁判只负责「好不好」这类主观题。',
    },
    en: {
      center: 'One eval case',
      nodes: ['Code asserts', 'LLM judge', 'Pairwise', 'Human review'],
      mode: 'star',
      note: 'Lock hard rules with code, then let judges handle only the subjective questions.',
    },
  },
  'judge-flow': {
    kind: 'sequence',
    caption: {
      zh: '一次 LLM 裁判调用：喂 rubric + 样本 + 证据要求，拿回结构化判定，而不是一段散文。',
      en: 'One judge call: rubric, case and evidence requirements in; a structured verdict out — not an essay.',
    },
    zh: {
      actors: ['评测框架', '裁判模型', '校验器', '结果库'],
      steps: [
        { from: 1, to: 2, t: '发送 rubric + 输入 + 实际输出' },
        { from: 2, to: 1, t: '返回 JSON：逐条 PASS/FAIL + 证据' },
        { from: 1, to: 3, t: '校验结构与证据是否可核对' },
        { from: 3, to: 1, t: '不合格 → 重试或降级为人工', dashed: true },
        { from: 1, to: 4, t: '写入分数、理由、模型版本' },
      ],
    },
    en: {
      actors: ['Harness', 'Judge model', 'Validator', 'Results store'],
      steps: [
        { from: 1, to: 2, t: 'Send rubric, input, actual output' },
        { from: 2, to: 1, t: 'Return JSON: PASS/FAIL per item plus quotes' },
        { from: 1, to: 3, t: 'Validate shape and checkable evidence' },
        { from: 3, to: 1, t: 'Invalid → retry or fall back to human', dashed: true },
        { from: 1, to: 4, t: 'Persist score, reason, model version' },
      ],
    },
  },
  'pairwise-flow': {
    kind: 'sequence',
    caption: {
      zh: '两两对比：同一个输入分别喂给 A、B，裁判只知道「回答一 / 回答二」，不知道谁是谁。',
      en: 'Pairwise: run both variants on the same input, and hide which answer came from which version.',
    },
    zh: {
      actors: ['评测框架', '版本 A', '版本 B', '裁判'],
      steps: [
        { from: 1, to: 2, t: '同一条输入跑 A' },
        { from: 1, to: 3, t: '同一条输入跑 B' },
        { from: 1, to: 4, t: '匿名乱序后交给裁判', dashed: true },
        { from: 4, to: 1, t: '返回 A 胜 / B 胜 / 平局 + 理由' },
      ],
    },
    en: {
      actors: ['Harness', 'Variant A', 'Variant B', 'Judge'],
      steps: [
        { from: 1, to: 2, t: 'Run A on the same input' },
        { from: 1, to: 3, t: 'Run B on the same input' },
        { from: 1, to: 4, t: 'Shuffle and strip identities', dashed: true },
        { from: 4, to: 1, t: 'Return A wins, B wins or tie, plus why' },
      ],
    },
  },
  'hybrid-stack': {
    kind: 'layers',
    caption: {
      zh: '混合评测的配比：代码守住底线，裁判评主观质量，人工只留给裁判和代码都吵不清的样本。',
      en: 'Hybrid blend: code guards the floor, judges score quality, humans only see what both disagree on.',
    },
    zh: {
      layers: [
        { t: '第一层：代码硬校验', items: ['JSON schema、数值范围、工具入参', '覆盖 100% 样本，成本≈0'], tone: 'accent' },
        { t: '第二层：LLM 裁判', items: ['事实性、语气、完整性', '只判代码判不了的部分'], tone: 'blue' },
        { t: '第三层：人工抽检', items: ['2%~5% 抽样 + 全部争议样本', '用来校准裁判，而不是日常打标'], tone: 'lime' },
        { t: '第四层：线上信号', items: ['用户否定、人工修正、退款申诉', '最贵也最真实的标签'], tone: 'coral' },
      ],
      note: '四层的目的不是叠加分数，而是互相校验：任何一层说「不对」，都值得看一眼。',
    },
    en: {
      layers: [
        { t: 'Code checks', items: ['JSON schema, ranges, tool args', 'Runs on 100% of cases, cost ≈ 0'], tone: 'accent' },
        { t: 'LLM judges', items: ['Factuality, tone, completeness', 'Only what code cannot see'], tone: 'blue' },
        { t: 'Human spot checks', items: ['2-5% sample plus every disagreement', 'Calibrates judges, not daily labelling'], tone: 'lime' },
        { t: 'Online signals', items: ['Thumbs down, corrections, refunds', 'Expensive, but the truest labels'], tone: 'coral' },
      ],
      note: 'The goal is not to add scores up, but to cross-check: any layer saying "off" deserves a look.',
    },
  },
}
