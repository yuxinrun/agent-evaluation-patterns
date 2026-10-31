import type { DiagramSpec } from './index'

/** 13 踩坑清单 */
export const c13: Record<string, DiagramSpec> = {
  'pitfall-map': {
    kind: 'matrix',
    caption: {
      zh: '七个坑，七种症状。对照最后一列直接改，不用从第一章读起。',
      en: 'Seven traps, seven symptoms. Use the last column to fix it without reading from chapter one.',
    },
    zh: {
      head: ['坑', '症状', '根因', '最省的修法'],
      rows: [
        ['分布脱节', '离线 99，上线被投诉', '用例是工程师写的理想问法', '从 Trace 抽真实输入'],
        ['只信裁判', '分数好看，事故照样出', '没有硬规则兜底', '加 schema / 数值 / 状态断言'],
        ['只看答案', '答案对但乱调工具', '没采轨迹', '记录并判定工具序列'],
        ['没基线', '改完不知道好坏', '只有一次快照', '每次发布写回基线'],
        ['限流失真', '批量报错被当成能力下降', '并发超过配额', '令牌桶 + 退避 + 重试'],
        ['成本爆炸', '一份报告烧掉一天预算', '重复调用强裁判', '缓存 + 分层裁判'],
        ['副作用未清理', '测试数据污染生产', '直接连真库跑', '沙箱 + 回滚 + 快照'],
      ],
      highlight: [3, 6],
    },
    en: {
      head: ['Trap', 'Symptom', 'Root cause', 'Cheapest fix'],
      rows: [
        ['Distribution gap', '99 offline, complaints online', 'Cases written by engineers', 'Sample real trace inputs'],
        ['Judge only', 'Great scores, real incidents', 'No hard rules', 'Schema, numeric and state asserts'],
        ['Output only', 'Right answer, wrong tools', 'No trajectory captured', 'Record and grade tool sequences'],
        ['No baseline', 'Cannot tell better from worse', 'One snapshot only', 'Write baselines on release'],
        ['Throttled runs', '429s read as quality drop', 'Concurrency above quota', 'Token bucket, backoff, retries'],
        ['Cost blowup', 'One report burns a day of budget', 'Repeated strong-judge calls', 'Cache plus tiered judging'],
        ['Dirty side effects', 'Test data pollutes prod', 'Running against the real DB', 'Sandbox, rollback, snapshots'],
      ],
      highlight: [3, 6],
    },
  },
  'score-illusion': {
    kind: 'compare',
    caption: {
      zh: '两个「92 分」可能完全不是一回事：一个来自 100 条真实样本，另一个来自 5 条复制粘贴。',
      en: 'Two 92s are rarely the same 92: one from 100 real cases, the other from 5 copy-pasted ones.',
    },
    zh: {
      left: {
        title: '看起来很美',
        sub: '92.0% 通过率',
        points: [
          '样本 20 条，其中 15 条是同一模板',
          '判分只看有没有出现关键词',
          '失败样本被「重跑一次」消掉',
          '没有任何对照组',
        ],
      },
      right: {
        title: '值得相信',
        sub: '92.0% 通过率',
        points: [
          '样本 300 条，覆盖五类用例',
          '硬规则 + 裁判 + 人工抽检三方一致',
          '失败样本全部保留并归档原因',
          '与上个稳定版本对比，有置信区间',
        ],
      },
      axis: '数字一样，可信度可以差十倍',
    },
    en: {
      left: {
        title: 'Looks great',
        sub: '92.0% pass rate',
        points: [
          '20 cases, 15 from one template',
          'Graded by keyword presence only',
          'Failures vanish on a re-run',
          'No control group at all',
        ],
      },
      right: {
        title: 'Earns trust',
        sub: '92.0% pass rate',
        points: [
          '300 cases across five categories',
          'Hard rules, judge and human sample agree',
          'Every failure kept with a root cause',
          'Compared to last stable, with intervals',
        ],
      },
      axis: 'Same number, tenfold difference in trust',
    },
  },
}
