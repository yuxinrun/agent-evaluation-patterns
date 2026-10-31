---
title: 02 · 评测指标体系与看板样例
description: 结果、轨迹、成本、体验四层指标的定义与算法，指标看板设计，以及 SLO 质量门禁的红线设置。
outline: [2, 3]
---

# 02 · 评测指标体系与看板样例

指标这件事有一个残酷的真相：**你测什么，团队就会优化什么。**

如果你只测「回答长度」，团队就会把答案写长；如果你只测「用户满意度」，团队就会学会说漂亮话。指标设计错了，比没有指标更危险——因为它会给你一种「我在科学管理」的错觉。

这一章把指标分成四层，每一层都给出：定义、计算公式、健康区间、以及「这个指标会被怎么骗」。

## 01 任务结果指标 {#outcome}

结果指标回答一句话：**任务完成了吗？完成得对吗？**

<Diagram id="metric-tiers" />

### 五个必看的结果指标

| 指标 | 定义 | 公式 | 健康区间（参考） |
| --- | --- | --- | --- |
| 任务完成率 | 用户目标被达成的比例 | 通过用例 / 总用例 | > 85% |
| 拒绝率 | 本应处理却拒绝的比例 | 误拒数 / 应处理数 | < 5% |
| 幻觉率 | 输出了无依据事实的比例 | 含无依据陈述的用例 / 总用例 | < 2% |
| 事实保真率 | 关键事实与知识源一致的比例 | 一致事实数 / 抽取事实数 | > 97% |
| 合规通过率 | 满足硬性规则（免责、隐私、话术）的比例 | 通过数 / 检查数 | 100%（红线） |

### 为什么「拒绝率」必须单独看

因为**完成率和拒绝率是一对跷跷板**。你把提示词改得更「敢答」，完成率会上升，幻觉率也会上升；你加一句「不确定就拒答」，幻觉率下降，误拒率上升。

只盯一个，团队一定会把另一个搞崩。这就是第 00 章第三个翻车故事里发生的事：拒答率从 18% 掉到 1%，同期编造率从 3% 涨到 21%。

::: warning 结果指标的三个陷阱
1. **用最终答案代表全过程**：答案对了但工具调错十次，用户体验依然糟糕。
2. **只统计「成功样本」**：报错、超时、被中断的会话被排除在分母外，指标瞬间变好看。
3. **指标定义模糊**：「完成」是用户说完成了，还是 Agent 说完成了？必须写死在数据集里。
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents" target="_blank" rel="noreferrer">Anthropic · Demystifying evals for AI agents</a>
  <a href="https://deepeval.com/docs/metrics-introduction" target="_blank" rel="noreferrer">DeepEval · Metrics introduction</a>
</div>

## 02 过程轨迹指标 {#trajectory}

如果结果指标是「考试成绩」，过程指标就是「解题步骤」。Agent 的绝大多数事故，藏在过程里。

<Diagram id="kpi-board" />

### 六个过程指标

| 指标 | 定义 | 怎么算 | 异常信号 |
| --- | --- | --- | --- |
| 工具调用正确率 | 调用的是否是该调的工具 | 命中期望工具的 Trace / 总 Trace | < 90% 说明工具描述或规划有问题 |
| 工具冗余次数 | 同一次任务里重复/无效调用 | 无效调用数 / Trace | 平均 > 1 就要排查 |
| 规划合理性 | 步骤顺序是否讲得通 | 代码规则 + 裁判评分 | 出现「先写后查」类顺序 |
| 弯路率 | 出现明显回退、重试、放弃的比例 | 含回退的 Trace / 总 Trace | > 15% 说明上下文或工具返回有问题 |
| 平均轮次 | 完成任务需要多少步 | 总步数 / Trace 数 | 突然上升 = 退化信号 |
| 循环率 | 陷入重复模式的比例 | 触发循环检测的 Trace / 总 Trace | 任何非零都值得看 |

### 「弯路」的判定要写死，不要靠感觉

```python
def count_detour(trace) -> int:
    """弯路计数：重复工具+相似入参、回退到已访问页面、连续无工具输出。"""
    detours = 0
    seen_calls = []
    for run in trace.runs:
        if run.kind != "tool":
            continue
        key = (run.tool, json.dumps(run.args, sort_keys=True)[:120])
        if key in seen_calls:
            detours += 1          # 完全重复调用
        elif any(r.tool == run.tool and similar(r.args, a) for r, a in seen_calls):
            detours += 1          # 相似调用
        seen_calls.append((run, run.args))
    return detours
```

这段代码有个关键设计：**判定逻辑必须可复现**。同一份 Trace，今天算出 2 次弯路，下个月还是 2 次。任何「让模型自己说它绕没绕路」的做法，都会让这个指标失去趋势价值。

::: tip 人话翻译
结果指标告诉你**有没有到目的地**，过程指标告诉你**是不是绕了半个城市**。打车软件两个都显示，你的评测也该两个都有。
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://docs.langchain.com/langsmith/trajectory-evals" target="_blank" rel="noreferrer">LangSmith · Trajectory evaluations</a>
  <a href="https://developers.openai.com/api/docs/guides/agent-evals" target="_blank" rel="noreferrer">OpenAI · Agent evals</a>
</div>

## 03 成本与效率指标 {#cost}

Agent 的钱是「按步计费」的。一条 Trace 里 15 次模型调用、8 次工具调用，成本是单轮问答的二十倍。

| 指标 | 定义 | 为什么重要 |
| --- | --- | --- |
| 平均轮次 | 每 Trace 的模型+工具步数 | 直接决定成本和延迟 |
| Token 消耗 | 输入 / 输出 / 缓存命中分别统计 | 缓存命中率低说明提示词结构有问题 |
| TTFT | 首 Token 延迟 | 体验的第一感觉 |
| P95 耗时 | 95 分位端到端耗时 | 平均值会骗人，长尾才是投诉来源 |
| 重试次数 | 因超时/限流/格式错误重试的次数 | 高重试 = 稳定性问题 + 成本翻倍 |
| 单任务成本 | 每 Trace 的模型+工具花费 | 决定商业模式能不能成立 |

### 一个真实的成本拆解

```text
单次会话（平均 4.2 轮）：
  规划模型调用    4 次 × 1.8k 输入 + 0.3k 输出   ≈ $0.021
  工具调用        3.1 次 × (平均 1.2k 返回)      ≈ $0.004（含工具侧模型）
  裁判（抽样 5%） 0.05 × $0.008                  ≈ $0.0004
  ────────────────────────────────────────────────────────
  合计 ≈ $0.025 / 会话     月 10 万会话 ≈ $2,500
```

看到这张表你会立刻明白一件事：**优化轮次比优化提示词字数省钱得多**。轮次从 4.2 降到 3.5，成本直接降 17%，还顺带把 P95 拉低。

::: warning 成本指标最常见的误用
把「每千次成本」当唯一指标。有些优化会让单次成本上升，但完成率大幅提升，**总成本反而下降**（因为用户不用重问三遍）。永远看「每完成任务成本」，而不是「每次调用成本」。
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://docs.langchain.com/langsmith/evaluation-approaches" target="_blank" rel="noreferrer">LangSmith · Evaluation approaches</a>
  <a href="https://langfuse.com/docs/evaluation/overview" target="_blank" rel="noreferrer">Langfuse · Evaluation overview</a>
</div>

## 04 体验指标 {#experience}

前三层指标都是「机器说的」，体验指标是「人说的」。它们最贵、最慢，但也最接近真相。

| 指标 | 定义 | 采集方式 | 健康区间 |
| --- | --- | --- | --- |
| 人工修正率 | 用户手动改了 Agent 的输出 | 前端埋点（编辑、重写） | < 12% |
| 用户否定率 | 点了踩 / 明确说「不对」 | 反馈按钮、语义识别 | < 6% |
| 中途取消率 | 任务没完成就退出 | 会话事件 | < 10% |
| 重复提问率 | 同一意图在短时间内重复 | 意图聚类 | < 8% |
| 转人工率 | 升级到人的比例 | 工单/转接事件 | 视业务而定 |

### 一个反直觉的发现

「人工修正率」往往比「满意度评分」更可信。原因很简单：**打分是廉价的表态，修改是付出了劳动的投票**。

用户点「满意」可能只是懒得点别的；但用户把你的回答从头改到尾，那是真实的不满。

```python
# 体验信号的加权打分：越费力的行为，权重越高
SIGNAL_WEIGHTS = {
    "explicit_edit": 3.0,      # 用户改了内容
    "regenerate":    2.0,      # 点了重新生成
    "thumbs_down":   1.5,      # 点了踩
    "abandon":       2.0,      # 中途退出
    "thumbs_up":    -1.0,      # 点了赞（弱正信号）
}

def experience_score(events: list[dict]) -> float:
    """返回 -1 ~ 1 的体验分，负数表示净负面。"""
    total = sum(SIGNAL_WEIGHTS.get(e["type"], 0) for e in events)
    return round(max(-1.0, min(1.0, -total / 10)), 3)
```

::: tip 人话翻译
「满意度 4.6 分」就像餐厅门口的「请给五星好评」——拿了赠品的人也会给。
「这道菜被退回来三次」才是厨房真正该看的数据。
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://langfuse.com/docs/evaluation/overview" target="_blank" rel="noreferrer">Langfuse · Evaluation overview</a>
  <a href="https://www.infoq.cn/topic/AI" target="_blank" rel="noreferrer">InfoQ · AI 专题（生产评测复盘）</a>
</div>

## 05 指标分层看板设计 {#dashboard}

指标多了会变成噪音。看板的价值不在于「显示全部」，而在于**让一个人在 30 秒内知道要不要紧张**。

<Diagram id="slo-gate" />

### 三层看板结构

| 层级 | 看什么 | 更新频率 | 观众 |
| --- | --- | --- | --- |
| L1 总览大盘 | 4-6 个北极星指标 + 红黄绿状态 | 每天 | 老板、产品、值班 |
| L2 失败分类 | 失败按类型/场景/工具聚类 | 每次评测后 | 开发者 |
| L3 版本对比 | 两个版本的逐指标差异 + 显著性 | 每次发版 | 负责人 |

### L1 大盘长这样

<div class="a-board">
  <div class="a-board__card">
    <div class="a-board__k">任务完成率</div>
    <div class="a-board__v">92.1<small>%</small></div>
    <div class="a-board__d is-good">▲ 1.8pt vs baseline</div>
    <div class="a-board__bar"><span style="--w: 92%"></span></div>
  </div>
  <div class="a-board__card">
    <div class="a-board__k">幻觉率</div>
    <div class="a-board__v">1.4<small>%</small></div>
    <div class="a-board__d is-good">▼ 0.6pt</div>
    <div class="a-board__bar"><span style="--w: 14%"></span></div>
  </div>
  <div class="a-board__card">
    <div class="a-board__k">工具正确率</div>
    <div class="a-board__v">88.7<small>%</small></div>
    <div class="a-board__d is-bad">▼ 4.2pt 需关注</div>
    <div class="a-board__bar is-bad"><span style="--w: 89%"></span></div>
  </div>
  <div class="a-board__card">
    <div class="a-board__k">P95 耗时</div>
    <div class="a-board__v">9.8<small>s</small></div>
    <div class="a-board__d">± 0.3s</div>
    <div class="a-board__bar"><span style="--w: 65%"></span></div>
  </div>
  <div class="a-board__card">
    <div class="a-board__k">每任务成本</div>
    <div class="a-board__v">$0.025</div>
    <div class="a-board__d is-good">▼ 0.003</div>
    <div class="a-board__bar"><span style="--w: 40%"></span></div>
  </div>
  <div class="a-board__card">
    <div class="a-board__k">人工修正率</div>
    <div class="a-board__v">9.1<small>%</small></div>
    <div class="a-board__d">持平</div>
    <div class="a-board__bar"><span style="--w: 30%"></span></div>
  </div>
</div>

<p class="a-note">示例数据；<code>is-good</code> / <code>is-bad</code> 只影响颜色，红色不代表阻断，真正的阻断看 SLO 门禁。</p>

### L2 失败分类怎么看

不要列「失败用例清单」——那有三千条，没人看。按维度聚合：

| 失败类型 | 数量 | 占比 | 集中在哪 | 最近变化 |
| --- | --- | --- | --- | --- |
| 工具入参错误 | 41 | 46% | `search_orders` 缺 `date_from` | 新版新增 |
| 幻觉（政策时效） | 18 | 20% | 退款类问题 | 持平 |
| 多轮上下文丢失 | 14 | 16% | 第 3 轮之后 | 恶化 5pt |
| 超时中断 | 9 | 10% | 长上下文 | 持平 |
| 该拒答未拒答 | 7 | 8% | 越权请求 | 好转 |

这张表能直接告诉你「先修哪个」。41 条工具入参错误，改一下工具 schema 和示例即可，投入产出比最高。

::: tip 人话翻译
看板要像**体检报告的结论页**：先告诉你「血压偏高、其他正常」，而不是一上来甩给你 60 项原始数值。
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://arize.com/docs/phoenix" target="_blank" rel="noreferrer">Arize Phoenix · Evals and dashboards</a>
  <a href="https://www.braintrust.dev/docs/evaluation-quickstart" target="_blank" rel="noreferrer">Braintrust · Experiment comparison</a>
</div>

## 06 SLO 质量门禁红线 {#slo}

前面所有指标都是「观察」，SLO 门禁是「执法」。它的唯一作用是：**在坏版本到达用户之前拦住它**。

### 三类红线

| 类型 | 例子 | 处理方式 |
| --- | --- | --- |
| **硬红线**（任何情况不许破） | PII 泄露 > 0、越权写入 > 0 | 立即阻断，人工复审 |
| **软红线**（相对基线退化） | 任务完成率比基线低 2pt 以上 | 阻断，需说明原因 |
| **观察线**（趋势异常） | 平均轮次上涨 20% | 告警，不阻断 |

### 一份可直接用的门禁配置

```yaml
# eval-gate.yml
version: 1
baseline: "main@last-green"

gates:
  - id: task_success
    metric: outcome.task_success_rate
    rule: absolute
    min: 0.85
    severity: block

  - id: task_success_regression
    metric: outcome.task_success_rate
    rule: delta_vs_baseline
    max_drop: 0.02          # 允许 2pt 波动，超过即阻断
    severity: block

  - id: hallucination
    metric: outcome.hallucination_rate
    rule: absolute
    max: 0.02
    severity: block

  - id: pii_leak
    metric: safety.pii_leak_count
    rule: absolute
    max: 0
    severity: block

  - id: tool_correct
    metric: trajectory.tool_correct_rate
    rule: absolute
    min: 0.90
    severity: warn

  - id: avg_turns
    metric: cost.avg_turns
    rule: delta_vs_baseline
    max_drop: -0.20         # 上涨 20% 以上告警
    severity: warn
```

### 门禁的三条设计原则

**原则一：红线要少。** 一开始就设 15 条红线的团队，两周内会全部降级成警告。**3-5 条**是可持续的上限。

**原则二：区分「绝对阈值」和「相对基线」。** 绝对阈值保证底线，相对基线保证不退化。两者都要有，但用途不同。

**原则三：阻断必须带证据。** 门禁失败时，报告里要直接给出：失败的用例 ID、Trace 链接、裁判理由、与基线的差异。否则开发者第一反应是「重跑一次」。

```python
def check_gates(result: dict, baseline: dict, gates: list[dict]) -> tuple[bool, list[dict]]:
    failures = []
    for gate in gates:
        value = dig(result, gate["metric"])
        if gate["rule"] == "absolute":
            ok = (value >= gate.get("min", -1e9)) and (value <= gate.get("max", 1e9))
        else:  # delta_vs_baseline
            base = dig(baseline, gate["metric"])
            drop = base - value
            ok = drop <= gate.get("max_drop", 0)
        if not ok:
            failures.append({"gate": gate["id"], "value": value, "severity": gate["severity"]})

    blocked = any(f["severity"] == "block" for f in failures)
    return (not blocked), failures
```

::: warning 门禁最容易被废掉的两种方式
1. **阈值拍脑袋**：第一周设了个不可能达到的阈值，红了三天，有人把它改成 `warn`，从此再没红过。
2. **无证据阻断**：只报「完成率不达标」，开发者看不到哪条用例挂了，只能重跑碰运气。
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://promptfoo.dev/docs/integrations/github-action/" target="_blank" rel="noreferrer">Promptfoo · GitHub Action</a>
  <a href="https://docs.langchain.com/langsmith/evaluation-approaches" target="_blank" rel="noreferrer">LangSmith · Evaluation approaches</a>
</div>

---

下一章讲最容易被忽略、却决定整套体系生死的一环：数据集到底怎么建。
