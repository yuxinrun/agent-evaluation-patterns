import type { DiagramSpec } from './index'

/** 11 安全合规评测 */
export const c11: Record<string, DiagramSpec> = {
  'attack-surface': {
    kind: 'hub',
    caption: {
      zh: 'Agent 的攻击面比聊天机器人宽得多：它还会读文档、调工具、写数据库、转发消息。',
      en: 'An agent\'s attack surface is far wider than a chatbot: it reads documents, calls tools, writes rows, forwards messages.',
    },
    zh: {
      center: 'Agent',
      nodes: ['用户输入', '检索文档', '工具返回', '记忆内容', '其他 Agent', '模型输出'],
      mode: 'star',
      note: '每一根线都是注入通道：只要内容会被读进上下文，就可能是攻击者写的。',
    },
    en: {
      center: 'Agent',
      nodes: ['User input', 'Retrieved docs', 'Tool output', 'Memory', 'Other agents', 'Model output'],
      mode: 'star',
      note: 'Every line is an injection channel: anything that reaches context can be attacker-written.',
    },
  },
  redteam: {
    kind: 'flow',
    caption: {
      zh: '红队评测流水线：生成攻击样本 → 在沙箱里跑 → 判是否越界 → 变成永久回归用例。',
      en: 'Red-team pipeline: generate attacks, run in a sandbox, judge boundary violations, keep them as permanent regressions.',
    },
    zh: {
      dir: 'h',
      nodes: [
        { t: '攻击样本库', s: '注入 / 越狱 / 越权', tone: 'coral' },
        { t: '沙箱执行', s: '假工具、假数据库', tone: 'blue' },
        { t: '判定', s: '代码：有没有真调用', tone: 'accent' },
        { t: '分级', s: 'P0 泄露 / P1 违规 / P2 语气', tone: 'lime' },
        { t: '入库回归', s: '每次 PR 都跑', tone: 'muted' },
      ],
      edges: ['喂入', '隔离', '判', '定级'],
    },
    en: {
      dir: 'h',
      nodes: [
        { t: 'Attack library', s: 'injection, jailbreak, abuse', tone: 'coral' },
        { t: 'Sandbox run', s: 'fake tools, fake DB', tone: 'blue' },
        { t: 'Detect', s: 'code: was it really called', tone: 'accent' },
        { t: 'Severity', s: 'P0 leak / P1 abuse / P2 tone', tone: 'lime' },
        { t: 'Become regression', s: 'runs on every PR', tone: 'muted' },
      ],
      edges: ['feed', 'isolate', 'detect', 'rate'],
    },
  },
  'pii-gate': {
    kind: 'compare',
    caption: {
      zh: 'PII 检查要分清「该出现」和「不该出现」：订单页显示手机号是业务需要，摘要里泄露就是事故。',
      en: 'PII checks must separate "expected" from "leaked": showing a phone number on an order page is business, leaking it in a summary is an incident.',
    },
    zh: {
      left: {
        title: '可接受',
        sub: '业务必需且已授权',
        points: [
          '用户查询自己的订单，回显后四位',
          '客服场景经授权的完整号码',
          '日志里存哈希后的标识',
          '脱敏后的评测样本',
        ],
      },
      right: {
        title: '不可接受',
        sub: '任何形式的越界',
        points: [
          '摘要里出现完整身份证号',
          '把 A 用户的手机号写给 B',
          '把 PII 原样送给裁判模型',
          '评测报告里明文存原始数据',
        ],
      },
      axis: '真不真的问题，用正则解决；该不该的问题，用策略解决',
    },
    en: {
      left: {
        title: 'Acceptable',
        sub: 'Necessary and authorised',
        points: [
          'User checks their own order, last four digits',
          'Agent with consent sees the full number',
          'Hashed identifiers in logs',
          'Masked eval samples',
        ],
      },
      right: {
        title: 'Never acceptable',
        sub: 'Any form of overreach',
        points: [
          'Full ID number in a summary',
          'User A\'s phone number shown to B',
          'Raw PII sent to a judge model',
          'Plaintext originals in eval reports',
        ],
      },
      axis: 'Regex answers "is it PII"; policy answers "may it appear"',
    },
  },
}
