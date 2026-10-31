import type { DiagramSpec } from './index'

/** 08 生态组件联动评测 */
export const c08: Record<string, DiagramSpec> = {
  'obs-to-eval': {
    kind: 'sequence',
    caption: {
      zh: '可观测与评测的接口：观测系统负责「记录发生了什么」，评测系统负责「这算不算好」。',
      en: 'The observability-eval seam: observability records what happened, evaluation decides whether it was good.',
    },
    zh: {
      actors: ['Agent 运行时', '观测平台', '采样器', '评测服务'],
      steps: [
        { from: 1, to: 2, t: '上报 Trace：span、工具调用、耗时' },
        { from: 2, to: 3, t: '按规则筛选：报错 / 否定 / 长尾' },
        { from: 3, to: 4, t: '转成评测样本（输入 + 轨迹 + 结果）' },
        { from: 4, to: 3, t: '回写分数与标签', dashed: true },
        { from: 3, to: 2, t: '看板联动：分数挂到原始 Trace 上', dashed: true },
      ],
    },
    en: {
      actors: ['Agent runtime', 'Observability', 'Sampler', 'Eval service'],
      steps: [
        { from: 1, to: 2, t: 'Emit traces: spans, tool calls, latency' },
        { from: 2, to: 3, t: 'Filter by rule: errors, thumbs down, long tail' },
        { from: 3, to: 4, t: 'Convert to a case: input, trajectory, output' },
        { from: 4, to: 3, t: 'Write scores and tags back', dashed: true },
        { from: 3, to: 2, t: 'Attach scores to the original trace', dashed: true },
      ],
    },
  },
  'multi-agent-eval': {
    kind: 'hub',
    caption: {
      zh: '多 Agent 评测：除了每个 Agent 自己的分数，还要看「交接有没有丢信息」「任务有没有被重复做」。',
      en: 'Multi-agent evals add two questions: did the handoff lose context, and did two agents do the same work twice?',
    },
    zh: {
      center: '协作任务',
      nodes: ['委派正确性', '上下文交接', '重复劳动', '冲突决策', '汇总质量', '整体时延'],
      mode: 'star',
      note: '单 Agent 都是 90 分，协作任务却失败——问题几乎总在交接处。',
    },
    en: {
      center: 'Collaborative task',
      nodes: ['Delegation', 'Context handoff', 'Duplicate work', 'Conflicting decisions', 'Merge quality', 'End-to-end latency'],
      mode: 'star',
      note: 'Every agent scores 90 and the joint task still fails. The bug is nearly always at the handoff.',
    },
  },
  'mcp-eval': {
    kind: 'matrix',
    caption: {
      zh: 'MCP 工具的评测维度：不只是「能不能调用」，还有稳定性、输出质量、权限与错误处理。',
      en: 'MCP eval dimensions: not just "can it be called", but stability, output quality, permissions and error handling.',
    },
    zh: {
      head: ['维度', '测什么', '失败后果', '判分方式'],
      rows: [
        ['可发现性', '工具描述能否被正确选中', 'Agent 不知道有这个能力', '意图→工具命中率'],
        ['入参正确性', '参数类型、必填、边界', '400 报错、脏数据', 'Schema 断言'],
        ['输出质量', '返回结构、完备性、时效', 'Agent 基于坏数据决策', '裁判 + 硬校验'],
        ['稳定性', '超时、限流、重试成功率', '任务连锁失败', '压测 + 成功率'],
        ['权限边界', '越权读取、危险写操作', '数据泄露、误操作', '红队用例，必须 100% 拦截'],
      ],
      highlight: [4],
    },
    en: {
      head: ['Dimension', 'What to test', 'Failure impact', 'How to grade'],
      rows: [
        ['Discoverability', 'Does the agent pick the right tool', 'Capability never used', 'Intent-to-tool hit rate'],
        ['Arguments', 'Types, required fields, bounds', '400s and dirty data', 'Schema asserts'],
        ['Output quality', 'Shape, completeness, freshness', 'Decisions on bad data', 'Judge plus hard checks'],
        ['Stability', 'Timeouts, throttling, retries', 'Cascading task failure', 'Load test and success rate'],
        ['Permissions', 'Over-reads, dangerous writes', 'Leaks and accidents', 'Red-team suite, 100% blocked'],
      ],
      highlight: [4],
    },
  },
  'memory-eval': {
    kind: 'matrix',
    caption: {
      zh: '记忆评测四问：写对了吗、召回准吗、该忘的忘了吗、多租户之间串不串。',
      en: 'Four memory questions: was it written correctly, recalled accurately, forgotten when due, and kept in its tenant.',
    },
    zh: {
      head: ['维度', '测试用例形态', '典型失败', '判分方式'],
      rows: [
        ['写入正确性', '对话中说到偏好/事实', '把玩笑写成偏好', '断言记忆条目的字段'],
        ['召回准确性', '隔多轮后追问', '答非所问、拿错人', '期望事实是否出现在答案'],
        ['遗忘与过期', 'TTL 到期后追问', '三年前偏好还在生效', '断言不再命中'],
        ['隔离与串话', '多用户交替提问', 'A 用户看到 B 的信息', '交叉验证，必须 0 串话'],
        ['更新与冲突', '用户改口', '新旧事实并存', '断言以最新为准'],
      ],
      highlight: [3],
    },
    en: {
      head: ['Dimension', 'Case shape', 'Classic failure', 'How to grade'],
      rows: [
        ['Write accuracy', 'Preference stated mid-chat', 'A joke stored as a preference', 'Assert memory fields'],
        ['Recall accuracy', 'Ask again many turns later', 'Wrong answer, wrong person', 'Expected fact appears'],
        ['Forgetting', 'Ask after TTL expiry', 'A 3-year-old preference still fires', 'Assert no hit'],
        ['Isolation', 'Two users interleaved', 'A sees B\'s data', 'Cross-check, zero crosstalk'],
        ['Updates', 'User changes their mind', 'Old and new facts coexist', 'Latest wins'],
      ],
      highlight: [3],
    },
  },
  'gateway-eval': {
    kind: 'compare',
    caption: {
      zh: '网关层评测两件事：路由选得对不对，降级之后还能不能干活。',
      en: 'Two gateway questions: did routing pick the right model, and does the system still work after a fallback.',
    },
    zh: {
      left: {
        title: '路由评测',
        sub: '同一个请求，应该走哪个模型',
        points: [
          '简单问题走便宜模型，复杂走强模型',
          '判：路由决策是否符合策略',
          '判：分流后质量是否达标',
          '指标：路由准确率、成本节省率',
        ],
      },
      right: {
        title: '降级评测',
        sub: '主模型不可用时的表现',
        points: [
          '注入 429 / 超时 / 5xx 故障',
          '判：是否按预期降级而非报错',
          '判：降级后答案质量下降多少',
          '指标：降级成功率、质量损失分',
        ],
      },
      axis: '网关不改 Agent 逻辑，但会改 Agent 的命运',
    },
    en: {
      left: {
        title: 'Routing evals',
        sub: 'Which model should serve this request',
        points: [
          'Cheap model for easy, strong for hard',
          'Judge: does the choice match policy',
          'Judge: quality after routing',
          'Metrics: routing accuracy, cost saved',
        ],
      },
      right: {
        title: 'Fallback evals',
        sub: 'Behaviour when the primary is down',
        points: [
          'Inject 429s, timeouts, 5xx',
          'Judge: graceful fallback, not an error',
          'Judge: how much quality is lost',
          'Metrics: fallback success, quality loss',
        ],
      },
      axis: 'The gateway never changes agent logic, only its fate',
    },
  },
}
