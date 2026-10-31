import type { DiagramSpec } from './index'

/** 14 实战 Demo */
export const c14: Record<string, DiagramSpec> = {
  'demo-map': {
    kind: 'hub',
    caption: {
      zh: '七个 Demo 覆盖一条完整链条：从「跑一条用例」到「CI 自动阻断」，每个都能单独复制使用。',
      en: 'Seven demos cover the whole chain: from "run one case" to "CI blocks the merge". Each is copy-paste ready.',
    },
    zh: {
      center: '评测工具箱',
      nodes: ['最简脚本', 'LangSmith', 'Promptfoo', 'GitHub Action', 'A/B 对比', 'Trace 转样本', '看板'],
      mode: 'star',
      note: '建议顺序：先跑最简脚本，再把它塞进 CI，最后补 A/B 与看板。',
    },
    en: {
      center: 'Eval toolbox',
      nodes: ['Minimal script', 'LangSmith', 'Promptfoo', 'GitHub Action', 'A/B compare', 'Trace to case', 'Dashboard'],
      mode: 'star',
      note: 'Suggested order: minimal script, then CI, then A/B and dashboards.',
    },
  },
  'otel-pipeline': {
    kind: 'flow',
    caption: {
      zh: '从 OpenTelemetry Trace 到评测样本：解析 span → 还原输入输出 → 脱敏 → 生成用例 → 入库。',
      en: 'From an OpenTelemetry trace to an eval case: parse spans, rebuild input and output, mask, generate, store.',
    },
    zh: {
      dir: 'h',
      nodes: [
        { t: 'OTel Trace', s: 'JSON / OTLP', tone: 'muted' },
        { t: '解析 span', s: '找根 span 与工具 span', tone: 'blue' },
        { t: '还原输入输出', s: '首条用户消息 + 末条回答', tone: 'accent' },
        { t: '脱敏与打标', s: 'PII 掩码、场景标签', tone: 'lime' },
        { t: '写入数据集', s: 'JSONL + 版本号', tone: 'coral' },
      ],
      edges: ['导出', '结构化', '清洗', '沉淀'],
    },
    en: {
      dir: 'h',
      nodes: [
        { t: 'OTel trace', s: 'JSON / OTLP', tone: 'muted' },
        { t: 'Parse spans', s: 'root and tool spans', tone: 'blue' },
        { t: 'Rebuild IO', s: 'first user msg, last answer', tone: 'accent' },
        { t: 'Mask and tag', s: 'PII masking, scenario tags', tone: 'lime' },
        { t: 'Store as cases', s: 'JSONL with a version', tone: 'coral' },
      ],
      edges: ['export', 'structure', 'clean', 'freeze'],
    },
  },
}
