import type { DiagramSpec } from './index'

/** 15 规模化评测 */
export const c15: Record<string, DiagramSpec> = {
  'scale-arch': {
    kind: 'layers',
    caption: {
      zh: '大规模评测的五层：调度队列扛并发，执行集群跑 Agent，裁判池控成本，存储分层，最后统一出报告。',
      en: 'Five layers at scale: a queue for concurrency, workers for agents, a judge pool for cost, tiered storage, one report.',
    },
    zh: {
      layers: [
        { t: '调度层', items: ['任务分片、优先级、失败重投', '令牌桶控制 QPS'], tone: 'muted' },
        { t: '执行层', items: ['无状态 Worker，可水平扩容', '每条用例独立沙箱'], tone: 'blue' },
        { t: '判分层', items: ['廉价裁判全量 + 强裁判抽审', '结果缓存，key = 输入哈希'], tone: 'accent' },
        { t: '存储层', items: ['热：近 7 天明细', '冷：聚合指标 + 失败样本'], tone: 'lime' },
        { t: '报告层', items: ['按版本 / 场景聚合', '差异对比与趋势'], tone: 'coral' },
      ],
    },
    en: {
      layers: [
        { t: 'Scheduling', items: ['Sharding, priority, requeue', 'Token bucket for QPS'], tone: 'muted' },
        { t: 'Execution', items: ['Stateless workers, horizontal scale', 'One sandbox per case'], tone: 'blue' },
        { t: 'Judging', items: ['Cheap judge everywhere, strong on samples', 'Cache keyed by input hash'], tone: 'accent' },
        { t: 'Storage', items: ['Hot: 7 days of detail', 'Cold: aggregates and failures'], tone: 'lime' },
        { t: 'Reporting', items: ['Aggregated per version and scenario', 'Deltas and trends'], tone: 'coral' },
      ],
    },
  },
  'tier-judge': {
    kind: 'flow',
    caption: {
      zh: '分层裁判省钱的办法：90% 的样本廉价模型就能判，只有拿不准的 10% 才值得上强模型。',
      en: 'Tiered judging saves money: a cheap model handles 90%, and only the uncertain 10% deserves the strong one.',
    },
    zh: {
      dir: 'h',
      nodes: [
        { t: '全部样本', s: '1000 条', tone: 'muted' },
        { t: '规则预筛', s: '30% 直接判定', tone: 'blue' },
        { t: '廉价裁判', s: '60% 高置信判定', tone: 'accent' },
        { t: '强裁判', s: '10% 争议样本', tone: 'lime' },
        { t: '人工', s: '< 1%', tone: 'coral' },
      ],
      edges: ['', '省 30%', '省 60%', '省 90%'],
    },
    en: {
      dir: 'h',
      nodes: [
        { t: 'All cases', s: '1000', tone: 'muted' },
        { t: 'Rule pre-filter', s: '30% decided', tone: 'blue' },
        { t: 'Cheap judge', s: '60% high confidence', tone: 'accent' },
        { t: 'Strong judge', s: '10% disputes', tone: 'lime' },
        { t: 'Human', s: '< 1%', tone: 'coral' },
      ],
      edges: ['', 'saves 30%', 'saves 60%', 'saves 90%'],
    },
  },
  'budget-fuse': {
    kind: 'lifecycle',
    caption: {
      zh: '预算熔断：跑批前预估，跑到一半对账，超支分级降档，绝不让一次评测烧掉一个月额度。',
      en: 'A budget fuse: estimate before, reconcile mid-run, degrade in stages, never let one run eat a month of quota.',
    },
    zh: {
      states: [
        { t: '预估', s: '用例数 × 单条成本', tone: 'blue' },
        { t: '运行中', s: '每 100 条对账一次', tone: 'accent' },
        { t: '预警', s: '达 70% 预算 → 降档', tone: 'coral' },
        { t: '熔断', s: '达 100% → 停止并出部分报告', tone: 'muted' },
      ],
      note: '宁可拿到「80% 样本的报告」，也不要拿到「一张账单」。',
    },
    en: {
      states: [
        { t: 'Estimate', s: 'cases × cost per case', tone: 'blue' },
        { t: 'Running', s: 'reconcile every 100 cases', tone: 'accent' },
        { t: 'Warn', s: '70% of budget → downgrade', tone: 'coral' },
        { t: 'Fuse', s: '100% → stop with partial report', tone: 'muted' },
      ],
      note: 'A report on 80% of cases beats an invoice.',
    },
  },
}
