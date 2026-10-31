import type { DiagramSpec } from './index'

/** 16 生态收官 */
export const c16: Record<string, DiagramSpec> = {
  'eco-stack': {
    kind: 'layers',
    caption: {
      zh: '七站全景：每一层都有自己的评测切口，但指标、Trace 格式与基线必须共用一套。',
      en: 'The seven-site map: each layer has its own eval angle, but metrics, trace format and baselines must be shared.',
    },
    zh: {
      layers: [
        { t: '网关：llm-gateway-patterns', items: ['路由准确率、降级成功率', '成本与限流下的质量'], tone: 'muted' },
        { t: '观测：agent-observability-patterns', items: ['Trace 结构、采样策略', '根因标签 → 样本标签'], tone: 'blue' },
        { t: '调度：better-agent', items: ['任务完成率、轮次、工具选择', 'CI 门禁的主战场'], tone: 'accent' },
        { t: '能力：memory / a2a / mcp', items: ['记忆召回、协作交接、工具契约', '各自的专项评测集'], tone: 'lime' },
        { t: '评测：本站', items: ['数据集、裁判、轨迹、门禁', '给上面四层提供统一尺子'], tone: 'coral' },
      ],
    },
    en: {
      layers: [
        { t: 'Gateway: llm-gateway-patterns', items: ['Routing accuracy, fallback success', 'Quality under cost and limits'], tone: 'muted' },
        { t: 'Observability: agent-observability-patterns', items: ['Trace shape, sampling', 'Root-cause tags become case tags'], tone: 'blue' },
        { t: 'Orchestration: better-agent', items: ['Task success, turns, tool choice', 'Where CI gates live'], tone: 'accent' },
        { t: 'Capabilities: memory / a2a / mcp', items: ['Recall, handoff, tool contracts', 'One suite each'], tone: 'lime' },
        { t: 'Evaluation: this site', items: ['Datasets, judges, trajectories, gates', 'One ruler for the four layers above'], tone: 'coral' },
      ],
    },
  },
  roadmap: {
    kind: 'lifecycle',
    caption: {
      zh: '90 天落地路线：第 1 周先有 20 条用例，第 1 个月进 CI，第 2 个月接线上抽样，第 3 个月上 A/B 与门禁。',
      en: 'A 90-day rollout: 20 cases in week one, CI in month one, online sampling in month two, A/B and gates in month three.',
    },
    zh: {
      states: [
        { t: '第 1 周', s: '20 条用例 + 代码断言', tone: 'blue' },
        { t: '第 2~4 周', s: '接 CI，PR 自动跑冒烟集', tone: 'accent' },
        { t: '第 2 个月', s: '线上抽样 + 失败捕获', tone: 'lime' },
        { t: '第 3 个月', s: 'A/B 实验 + SLO 门禁', tone: 'coral' },
        { t: '之后', s: '每季度重校准裁判', tone: 'muted' },
      ],
      note: '最忌讳的顺序：先搭平台，再想测什么。',
    },
    en: {
      states: [
        { t: 'Week 1', s: '20 cases plus code asserts', tone: 'blue' },
        { t: 'Weeks 2-4', s: 'CI runs smoke on every PR', tone: 'accent' },
        { t: 'Month 2', s: 'Online sampling and failure capture', tone: 'lime' },
        { t: 'Month 3', s: 'A/B experiments and SLO gates', tone: 'coral' },
        { t: 'After', s: 'Recalibrate judges quarterly', tone: 'muted' },
      ],
      note: 'The worst order: build the platform, then decide what to measure.',
    },
  },
  contract: {
    kind: 'sequence',
    caption: {
      zh: '跨组件评测契约：无论上层是谁，评测服务只认一套输入输出，这样各站才能共用一套基线。',
      en: 'The cross-component contract: whatever the caller, the eval service accepts one shape, so baselines are shared.',
    },
    zh: {
      actors: ['调用方', '评测网关', '评测执行', '基线库'],
      steps: [
        { from: 1, to: 2, t: '提交：用例 + 轨迹 + 元数据' },
        { from: 2, to: 3, t: '按场景路由到评测套件' },
        { from: 3, to: 2, t: '返回：逐条分 + 原因 + 版本' },
        { from: 2, to: 4, t: '写入基线（仅在发布时）', dashed: true },
        { from: 4, to: 1, t: '查询历史与趋势', dashed: true },
      ],
    },
    en: {
      actors: ['Caller', 'Eval gateway', 'Eval runner', 'Baseline store'],
      steps: [
        { from: 1, to: 2, t: 'Submit: case, trajectory, metadata' },
        { from: 2, to: 3, t: 'Route to the right suite by scenario' },
        { from: 3, to: 2, t: 'Return scores, reasons, versions' },
        { from: 2, to: 4, t: 'Write baseline (release only)', dashed: true },
        { from: 4, to: 1, t: 'Query history and trends', dashed: true },
      ],
    },
  },
}
