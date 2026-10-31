import type { DiagramSpec } from './index'

/** 09 平台选型 */
export const c09: Record<string, DiagramSpec> = {
  'platform-matrix': {
    kind: 'matrix',
    caption: {
      zh: '选平台先看三件事：能不能自托管、能不能进 CI、轨迹数据好不好用。功能列表都能背，这三条决定生死。',
      en: 'Three questions decide the platform: can you self-host it, can it run in CI, and are trajectories usable.',
    },
    zh: {
      head: ['平台', '定位', '自托管', '最适合'],
      rows: [
        ['LangSmith', '轨迹 + 评测一体化', '企业版', 'LangChain / LangGraph 团队'],
        ['Langfuse', '开源观测 + 评测', '开源可自建', '重视数据主权的团队'],
        ['Promptfoo', 'CLI 批量评测 + 红队', '本地运行', 'CI 门禁、Prompt 对比'],
        ['DeepEval', 'Python 评测库', '纯库，无需服务', '嵌入单测与脚本'],
        ['Braintrust', '评测 + 实验管理', '企业版', '重实验与协作的团队'],
        ['OpenEvals', '现成裁判函数', '纯库', '快速接 LangChain 生态'],
        ['Phoenix', '开源观测 + 评测', '开源可自建', '需要 OpenTelemetry 链路'],
      ],
      highlight: [2],
    },
    en: {
      head: ['Platform', 'Positioning', 'Self-host', 'Best for'],
      rows: [
        ['LangSmith', 'Traces plus evals', 'Enterprise', 'LangChain / LangGraph teams'],
        ['Langfuse', 'Open-source observability and evals', 'Yes', 'Teams that need data sovereignty'],
        ['Promptfoo', 'CLI batch evals and red teaming', 'Runs locally', 'CI gates, prompt comparison'],
        ['DeepEval', 'Python eval library', 'Library only', 'Unit tests and scripts'],
        ['Braintrust', 'Evals and experiment tracking', 'Enterprise', 'Experiment-heavy teams'],
        ['OpenEvals', 'Ready-made judges', 'Library only', 'Fast LangChain integration'],
        ['Phoenix', 'Open-source observability and evals', 'Yes', 'OpenTelemetry-native stacks'],
      ],
      highlight: [2],
    },
  },
  'minimal-stack': {
    kind: 'layers',
    caption: {
      zh: '最小生产组合：不用一次上平台，先让「数据集 + 代码断言 + 一个裁判 + CI」跑起来。',
      en: 'The minimal viable stack: do not buy a platform first; get datasets, code asserts, one judge and CI working.',
    },
    zh: {
      layers: [
        { t: '数据层', items: ['JSONL 存用例，Git 管版本', '字段：input / expected / tags'], tone: 'muted' },
        { t: '执行层', items: ['一个 CLI 脚本跑批', '并发 4~8，失败重试 3 次'], tone: 'blue' },
        { t: '判分层', items: ['代码断言 + 一个裁判 Prompt', '结果写回 JSONL'], tone: 'accent' },
        { t: '门禁层', items: ['GitHub Action 比基线', '低于阈值直接 fail'], tone: 'lime' },
        { t: '观测层', items: ['跑批结果进表格 / 看板', '失败样本带 Trace 链接'], tone: 'coral' },
      ],
      note: '这五层加起来不到 300 行代码，但已经能挡住 80% 的退化。',
    },
    en: {
      layers: [
        { t: 'Data', items: ['JSONL cases in Git', 'Fields: input, expected, tags'], tone: 'muted' },
        { t: 'Runner', items: ['One CLI script', 'Concurrency 4-8, retries 3'], tone: 'blue' },
        { t: 'Graders', items: ['Code asserts plus one judge prompt', 'Results written back to JSONL'], tone: 'accent' },
        { t: 'Gate', items: ['GitHub Action diffs baseline', 'Fail below threshold'], tone: 'lime' },
        { t: 'Visibility', items: ['Results into a table or dashboard', 'Failing cases link to traces'], tone: 'coral' },
      ],
      note: 'Under 300 lines in total, and it already blocks 80% of regressions.',
    },
  },
}
