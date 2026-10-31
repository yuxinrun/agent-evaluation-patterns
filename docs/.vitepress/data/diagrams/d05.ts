import type { DiagramSpec } from './index'

/** 05 轨迹评测 */
export const c05: Record<string, DiagramSpec> = {
  'trace-anatomy': {
    kind: 'flow',
    caption: {
      zh: '一条轨迹：思考 → 选工具 → 传参数 → 拿结果 → 再思考，直到给出答案。评测要读完整条链。',
      en: 'A trajectory: think, pick a tool, pass arguments, read the result, think again — until an answer appears.',
    },
    zh: {
      dir: 'v',
      nodes: [
        { t: '用户目标', s: '查订单为什么没退款', tone: 'muted' },
        { t: '规划 think', s: '先查订单，再查支付流水', tone: 'blue' },
        { t: '工具调用 get_order', s: '{"order_id":"A1024"}', tone: 'accent' },
        { t: '工具返回', s: '状态 paid，退款未发起', tone: 'lime' },
        { t: '工具调用 get_refund', s: '查退款单是否存在', tone: 'accent' },
        { t: '最终回答', s: '退款未提交，需要重新发起', tone: 'coral' },
      ],
      edges: ['', '决策', '结果', '决策', '结果'],
    },
    en: {
      dir: 'v',
      nodes: [
        { t: 'User goal', s: 'Why is my refund missing?' },
        { t: 'Plan', s: 'Check order, then payment log', tone: 'blue' },
        { t: 'Call get_order', s: '{"order_id":"A1024"}', tone: 'accent' },
        { t: 'Result', s: 'paid, refund never created', tone: 'lime' },
        { t: 'Call get_refund', s: 'does a refund exist at all?', tone: 'accent' },
        { t: 'Final answer', s: 'Refund was never submitted', tone: 'coral' },
      ],
      edges: ['', 'decision', 'result', 'decision', 'result'],
    },
  },
  'traj-match': {
    kind: 'matrix',
    caption: {
      zh: '三种轨迹匹配口径：严格顺序适合固定流程，集合匹配容忍并行，子序列匹配只看关键步骤有没有出现。',
      en: 'Three matching modes: strict order for fixed flows, set matching for parallel work, subsequence for "did the key steps happen".',
    },
    zh: {
      head: ['口径', '判定规则', '适合', '误判风险'],
      rows: [
        ['严格顺序', '工具序列完全一致', '合规流程、财务操作', '合理优化被判错'],
        ['集合匹配', '必需工具都出现，顺序不限', '信息检索类任务', '漏判冗余调用'],
        ['子序列匹配', '关键步骤按序出现即可', '开放型 Agent', '过松，掩盖绕路'],
        ['加权匹配', '每步有权重，按覆盖计分', '大多数生产场景', '权重需要维护'],
      ],
      highlight: [2],
    },
    en: {
      head: ['Mode', 'Rule', 'Fits', 'False-negative risk'],
      rows: [
        ['Strict order', 'Exact tool sequence', 'Compliance, finance ops', 'A smarter shortcut fails'],
        ['Set match', 'All required tools, any order', 'Retrieval tasks', 'Misses redundant calls'],
        ['Subsequence', 'Key steps appear in order', 'Open-ended agents', 'Too loose, hides detours'],
        ['Weighted', 'Per-step weights, coverage score', 'Most production cases', 'Weights need upkeep'],
      ],
      highlight: [2],
    },
  },
  'loop-detect': {
    kind: 'lifecycle',
    caption: {
      zh: '循环检测的本质是识别「同样的状态再来一次」：同工具 + 同参数 + 同结果，就是原地打转。',
      en: 'Loop detection is about the same state arriving twice: same tool, same args, same result means you are stuck.',
    },
    zh: {
      states: [
        { t: '正常推进', s: '每步产生新信息', tone: 'lime' },
        { t: '重试', s: '同工具同参数，第 2 次', tone: 'blue' },
        { t: '疑似循环', s: '第 3 次仍无新信息', tone: 'coral' },
        { t: '触发熔断', s: '强制总结或转人工', tone: 'muted' },
      ],
      note: '评测里要统计「无效步数」：它不改变结果，只消耗预算和耐心。',
    },
    en: {
      states: [
        { t: 'Progressing', s: 'each step adds information', tone: 'lime' },
        { t: 'Retry', s: 'same tool, same args, 2nd time', tone: 'blue' },
        { t: 'Suspected loop', s: '3rd time, still nothing new', tone: 'coral' },
        { t: 'Circuit break', s: 'force summary or hand off', tone: 'muted' },
      ],
      note: 'Track wasted steps: they change nothing but burn budget and patience.',
    },
  },
  'side-effect': {
    kind: 'sequence',
    caption: {
      zh: '副作用校验：评测跑在沙箱里，跑完必须回滚，否则第二天你的测试数据就成了生产脏数据。',
      en: 'Side-effect checks: run in a sandbox and roll back, or your test data becomes tomorrow\'s production mess.',
    },
    zh: {
      actors: ['评测任务', '沙箱环境', '副作用校验', '清理'],
      steps: [
        { from: 1, to: 2, t: '执行写操作：下单 / 发消息' },
        { from: 2, to: 3, t: '快照：订单、库存、消息队列' },
        { from: 3, to: 1, t: '断言：变更是否符合预期' },
        { from: 1, to: 4, t: '逆操作回滚', dashed: true },
        { from: 4, to: 3, t: '复核：数据已归零', dashed: true },
      ],
    },
    en: {
      actors: ['Eval run', 'Sandbox', 'Effect checker', 'Cleanup'],
      steps: [
        { from: 1, to: 2, t: 'Perform writes: order, message' },
        { from: 2, to: 3, t: 'Snapshot orders, stock, queues' },
        { from: 3, to: 1, t: 'Assert the change was intended' },
        { from: 1, to: 4, t: 'Inverse operation rollback', dashed: true },
        { from: 4, to: 3, t: 'Verify everything is zeroed', dashed: true },
      ],
    },
  },
}
