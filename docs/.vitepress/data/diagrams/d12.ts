import type { DiagramSpec } from './index'

/** 12 线上评测 */
export const c12: Record<string, DiagramSpec> = {
  'online-eval': {
    kind: 'sequence',
    caption: {
      zh: '线上评测的旁路设计：用户请求照常返回，采样与打分全部异步，绝不把延迟加给用户。',
      en: 'Online eval runs as a sidecar: users get answers immediately, sampling and grading happen async.',
    },
    zh: {
      actors: ['用户请求', 'Agent 服务', '采样队列', '评测服务'],
      steps: [
        { from: 1, to: 2, t: '正常请求（同步）' },
        { from: 2, to: 1, t: '正常应答（同步）' },
        { from: 2, to: 3, t: '旁路：写入 Trace 与采样标记', dashed: true },
        { from: 3, to: 4, t: '异步消费，跑代码断言 + 裁判' },
        { from: 4, to: 3, t: '分数写回，触发告警或入库', dashed: true },
      ],
    },
    en: {
      actors: ['User request', 'Agent service', 'Sample queue', 'Eval service'],
      steps: [
        { from: 1, to: 2, t: 'Normal request (sync)' },
        { from: 2, to: 1, t: 'Normal response (sync)' },
        { from: 2, to: 3, t: 'Sidecar: trace plus sample flag', dashed: true },
        { from: 3, to: 4, t: 'Consume async: code asserts and judges' },
        { from: 4, to: 3, t: 'Write scores, alert or store', dashed: true },
      ],
    },
  },
  capture: {
    kind: 'lifecycle',
    caption: {
      zh: '失败案例的生命周期：线上炸了 → 自动捕获 → 人工确认 → 进回归集 → 再也不许复现。',
      en: 'A failure lifecycle: it breaks, gets captured, is confirmed, joins the regression set, and must never return.',
    },
    zh: {
      states: [
        { t: '线上失败', s: '报错 / 否定 / 人工修正', tone: 'coral' },
        { t: '自动捕获', s: '保存 Trace + 元数据', tone: 'blue' },
        { t: '人工确认', s: '是不是真问题、归到哪类', tone: 'lime' },
        { t: '写成用例', s: '加期望结果与判分器', tone: 'accent' },
        { t: '永久回归', s: '每次 PR 都跑', tone: 'muted' },
      ],
      note: '从捕获到入库超过 48 小时，这条故障基本就会被忘掉。',
    },
    en: {
      states: [
        { t: 'Failure in prod', s: 'error, thumbs down, correction', tone: 'coral' },
        { t: 'Captured', s: 'trace plus metadata saved', tone: 'blue' },
        { t: 'Confirmed', s: 'real issue, which category', tone: 'lime' },
        { t: 'Written as a case', s: 'expected result and grader', tone: 'accent' },
        { t: 'Permanent regression', s: 'runs on every PR', tone: 'muted' },
      ],
      note: 'If capture to dataset takes more than 48 hours, the incident is already forgotten.',
    },
  },
  'closed-loop': {
    kind: 'lifecycle',
    caption: {
      zh: '评测闭环的四步：发现 → 修复 → 验证 → 固化。少任何一步，同样的问题都会再来一遍。',
      en: 'The loop has four steps: find, fix, verify, freeze. Skip one and the same bug returns.',
    },
    zh: {
      states: [
        { t: '发现', s: '指标劣化 / 抽样失败', tone: 'coral' },
        { t: '修复', s: '改 Prompt / 工具 / 模型', tone: 'blue' },
        { t: '验证', s: '回归集 + 相关失败样本', tone: 'accent' },
        { t: '固化', s: '写进数据集与 SLO', tone: 'lime' },
      ],
      note: '「验证」和「固化」之间最容易偷懒，也是团队水平的分水岭。',
    },
    en: {
      states: [
        { t: 'Find', s: 'metric drop or sampled failure', tone: 'coral' },
        { t: 'Fix', s: 'prompt, tools, model', tone: 'blue' },
        { t: 'Verify', s: 'regression set and the failing case', tone: 'accent' },
        { t: 'Freeze', s: 'into datasets and SLOs', tone: 'lime' },
      ],
      note: 'Teams cut corners between verify and freeze. That gap is the difference between levels.',
    },
  },
}
