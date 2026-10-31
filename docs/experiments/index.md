---
title: 07 · A/B 实验与版本对比评测
description: 单变量对照原则、指标对比报表、显著性与噪声判断、线上灰度评测，以及实验沉淀为新基线的方法。
outline: [2, 3]
---

# 07 · A/B 实验与版本对比评测

「我觉得 A 版本更自然。」
「我觉得 B 版本更准。」

然后会议开了 40 分钟，谁也说服不了谁，最后按职级高的那个人的感觉定了。

这一章要解决的就是这件事：**把「我觉得」变成「数据说」。**

## 01 对照实验的单变量原则 {#design}

### 一句话原则

**一次只改一个变量。**

<Diagram id="ab-design" />

看起来是常识，但违反它的团队多到惊人。典型对话：

```text
「新版本好了很多！」
「你改了什么？」
「换了模型、重写了提示词、还加了两个工具。」
「……那到底是哪个起作用？」
「反正整体变好了。」
```

这个实验的结论是：**你什么也没学到。** 下次还要再赌一次。

### 必须隔离的六个变量

| 变量 | 例子 | 隔离方式 |
| --- | --- | --- |
| 模型 | gpt-5 → gpt-5-mini | 只换模型，提示词与工具不动 |
| 提示词 | 系统提示、few-shot 示例 | 只改提示词，模型与工具不动 |
| 工具集 | 新增 `get_refund_policy` | 只加工具，模型与提示不动 |
| 工具描述 | 改一个参数说明 | 只改描述 |
| 参数 | temperature、max_tokens | 只改参数 |
| 上下文策略 | 历史轮数、摘要方式 | 只改策略 |

### 对照实验的最小设计

```text
对照组 A：当前线上版本（baseline）
实验组 B：只改一个变量
数据集：同一份（同一版本！）
评分器：同一套（同一版本！）
运行条件：同一并发、同一模型版本、同一时间窗
判定：预先写好的判据（不许看完结果再定标准）
```

最后一条最重要，学术上叫**预注册（pre-registration）**。人天生会为已看到的结果找解释，所以判据必须在跑之前写下来。

::: tip 人话翻译
做实验像**验药**：试验组吃药、对照组吃糖片，其他条件完全一样。如果试验组还偷偷多睡了两个小时，那这药到底有没有效就永远说不清。
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://docs.langchain.com/langsmith/evaluation-approaches" target="_blank" rel="noreferrer">LangSmith · Experiments</a>
  <a href="https://www.braintrust.dev/docs/evaluation-quickstart" target="_blank" rel="noreferrer">Braintrust · Experiment design</a>
</div>

## 02 指标对比报表 {#report}

实验跑完，你要的不是「A 好还是 B 好」这一句话，而是**一张能看出「好在哪、坏在哪」的表**。

<Diagram id="ab-report" />

### 标准对比表

| 指标 | A（基线） | B（实验） | 变化 | 显著性 | 结论 |
| --- | --- | --- | --- | --- | --- |
| 任务完成率 | 88.2% | 92.1% | +3.9pt | ✅ p<0.01 | B 更好 |
| 幻觉率 | 1.2% | 1.9% | +0.7pt | ✅ p<0.05 | B 更差 |
| 工具正确率 | 90.1% | 89.4% | -0.7pt | ⚪ 不显著 | 无差异 |
| 平均轮次 | 4.4 | 3.8 | -0.6 | ✅ p<0.01 | B 更省 |
| P95 耗时 | 10.2s | 9.1s | -1.1s | ✅ p<0.05 | B 更快 |
| 每任务成本 | $0.028 | $0.022 | -21% | ✅ p<0.01 | B 更省 |
| 人工修正率 | 8.9% | 11.4% | +2.5pt | ✅ p<0.05 | B 更差 ⚠️ |

看这张表的方式：

1. **先看有没有红线被破**（幻觉率、人工修正率都变差了）；
2. 再看收益（完成率 + 成本 + 延迟都改善）；
3. 最后做取舍（用一点幻觉率换完成率提升，业务能不能接受？）。

**结论往往不是「B 更好」，而是「B 在场景 X 更好，在场景 Y 更差」。** 这才是实验的价值。

### 改变「平均值」骗人的问题

平均值会掩盖分布。同一个 +3.9pt 的提升，可能是：

- 全面提升（每种用例都好一点）；
- 局部暴涨（一类用例从 40% → 95%，其他小幅下降）。

所以报表里要看**分片**：

```python
def sliced_delta(runs_a: list[dict], runs_b: list[dict], key: str) -> list[dict]:
    """按标签切片对比，暴露「平均值掩盖的差异」。"""
    def agg(runs):
        buckets: dict[str, list[bool]] = {}
        for r in runs:
            for tag in r.get("tags", []):
                buckets.setdefault(tag, []).append(r["pass"])
        return {k: sum(v) / len(v) for k, v in buckets.items()}

    a, b = agg(runs_a), agg(runs_b)
    return [
        {"slice": k, "A": round(a.get(k, 0), 3), "B": round(b.get(k, 0), 3),
         "delta": round(b.get(k, 0) - a.get(k, 0), 3)}
        for k in sorted(set(a) | set(b))
    ]
```

输出可能长这样：

```text
slice             A      B      delta
kind:positive     0.94   0.96   +0.02
kind:edge         0.71   0.88   +0.17     ← 提升主要来自这里
kind:injection    0.98   0.98    0.00
kind:ambiguous    0.62   0.58   -0.04     ← 但歧义场景退化了
```

看到了吗？**整体 +3.9pt 里，有一半是边界改善，同时还牺牲了歧义场景。** 这类洞察只有分片才能看出来。

::: warning 报表最常见的三个错误
1. 只报总分，不报分片。
2. 只报变化量，不报显著性（把噪声当结论）。
3. 不报样本量（30 条用例上的 +5pt 和 3000 条上的 +5pt 完全不是一回事）。
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://www.braintrust.dev/docs/evaluation-quickstart" target="_blank" rel="noreferrer">Braintrust · Comparing experiments</a>
  <a href="https://docs.langchain.com/langsmith/evaluation-approaches" target="_blank" rel="noreferrer">LangSmith · Experiments</a>
</div>

## 03 显著性判断：真变好还是噪声 {#significance}

这是本章技术含量最高的一节，也是最容易做错的一节。

<Diagram id="canary" />

### 为什么必须做显著性

假设两个版本的完成率分别是 88.2% 和 92.1%，看起来 92.1% 更好。但：

- 如果样本量只有 30 条，这 3.9pt 可能只是「多蒙对了一条」；
- 如果评分器本身有 ±2pt 的波动，这个差距完全在噪声里。

**没有显著性判断的对比实验，等于用抛硬币的结果决定架构。**

### 一个够用且好懂的做法

不需要真的去做 t 检验的完整推导，用**置信区间是否重叠**判断就够：

```python
import math, statistics

def two_proportion_test(p1: float, n1: int, p2: float, n2: int) -> dict:
    """两比例差异的 Z 检验，返回 p 值（双尾）与置信区间。"""
    p_pool = (p1 * n1 + p2 * n2) / (n1 + n2)
    se = math.sqrt(p_pool * (1 - p_pool) * (1 / n1 + 1 / n2))
    if se == 0:
        return {"p_value": 1.0, "significant": False, "se": 0.0}
    z = abs(p2 - p1) / se
    # 正态近似下的双尾 p 值
    p_value = math.erfc(z / math.sqrt(2))
    return {
        "delta": round(p2 - p1, 4),
        "z": round(z, 3),
        "p_value": round(p_value, 4),
        "significant": p_value < 0.05,
        "min_detectable": round(1.96 * se, 4),   # 95% 下能测出的最小差异
    }

print(two_proportion_test(0.882, 300, 0.921, 300))
# {'delta': 0.039, 'z': 1.63, 'p_value': 0.103, 'significant': False, 'min_detectable': 0.047}
```

请注意这个结果：**+3.9pt 在 300 条样本上并不显著**（p≈0.10）。也就是说，你没法声称 B 更好。

这不是坏消息，这是**极有价值的信息**：要么继续加样本，要么承认「这次改动的影响小于我们能测出的范围」。

### 需要多少样本

在跑实验前先算清楚，可以省掉大量无效工作：

| 想检测的最小差异 | 每组所需样本（近似） |
| --- | --- |
| 10pt | ~150 |
| 5pt | ~600 |
| 3pt | ~1,600 |
| 1pt | ~14,000 |

（基线成功率约 90%，95% 置信度、80% 功效）

::: tip 人话翻译
这就像**称体重**。你要知道「这周瘦了 0.1 公斤」，就得用精密到 0.05kg 的秤；家里那台误差 0.5kg 的秤，永远给不出这个答案。
**想让门禁抓住 1pt 的退化，你的数据集就得有上万条。做不到，就把阈值定宽一点。**
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://arxiv.org/abs/2403.04132" target="_blank" rel="noreferrer">Chatbot Arena · significance and Elo</a>
  <a href="https://arxiv.org/abs/2306.05685" target="_blank" rel="noreferrer">MT-Bench · judge reliability</a>
</div>

## 04 线上灰度评测 {#canary}

离线评测再充分，也有一个致命局限：**你测的是你想到的场景。**

灰度评测解决的是：用真实流量检验真实版本，同时把风险控制在可承受范围。

### 灰度评测的四个设计点

| 设计点 | 做法 | 注意 |
| --- | --- | --- |
| 分流 | 按用户 ID 哈希，稳定分桶 | 同一用户始终进同一桶，否则体验跳变 |
| 比例 | 1% → 5% → 20% → 50% | 每级观察至少一个业务周期 |
| 观测 | 同一套指标并行统计两组 | 必须按桶打标签，否则无法对比 |
| 回滚 | 指标触发阈值自动降级 | 回滚必须比发布更快 |

```python
import hashlib

def bucket(user_id: str, salt: str = "exp-2026-10") -> int:
    """稳定分桶：同一用户永远落在同一个桶。"""
    h = hashlib.sha256(f"{salt}:{user_id}".encode()).hexdigest()
    return int(h[:8], 16) % 100

def assign(user_id: str, canary_pct: int = 5) -> str:
    return "canary" if bucket(user_id) < canary_pct else "control"
```

### 灰度期的三组数据要同时看

```text
1. 业务指标   完成率、转人工率、投诉率      ← 决定要不要继续放量
2. 技术指标   错误率、P95、成本             ← 决定要不要立刻回滚
3. 评测指标   抽样裁判打分                  ← 决定要不要把这个版本定为新基线
```

第三组是最容易被忘的：**灰度期间产生的真实 Trace 是黄金评测样本**。把其中失败的、用户否定的抽出来，直接进数据集。

::: danger 灰度的两个致命错误
1. **分流不稳定**：同一个用户一会儿新版本一会儿旧版本，体验跳变，投诉暴涨。
2. **没有自动回滚**：发现问题靠人肉盯盘，等有人发现时已经全量了。
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://langfuse.com/docs/evaluation/overview" target="_blank" rel="noreferrer">Langfuse · Online evaluation</a>
  <a href="https://www.infoq.cn/topic/AI" target="_blank" rel="noreferrer">InfoQ · 灰度发布与效果评估</a>
</div>

## 05 实验沉淀与新基线 {#archive}

实验做完只写进群聊，就等于没做。这一节讲怎么把实验变成组织资产。

### 三件事必须落盘

| 产物 | 内容 | 存哪 |
| --- | --- | --- |
| 实验记录 | 假设、变量、数据集版本、结果、结论 | 实验库（或 PR 描述） |
| 失败策略归档 | 试过但不work的方案 + 为什么 | 团队文档（避免重复踩坑） |
| 新基线 | 胜出的版本 + 它的完整指标快照 | 基线文件（第 06 章） |

### 实验记录模板

```yaml
# experiments/2026-10-exp-007.yaml
id: exp-007
hypothesis: "拆封条件写进系统提示后，边界用例完成率提升 ≥ 8pt"
changed_variable: prompt.system.refund_condition
control: main@a1b2c3
treatment: feat/refund-condition@d4e5f6
dataset: regression@v14            # 两边必须同版本
graders: graders@v9                # 两边必须同版本
n_per_arm: 300
result:
  task_success: { control: 0.882, treatment: 0.921, p_value: 0.103, significant: false }
  edge_slice:   { control: 0.710, treatment: 0.880, delta: +0.170 }
  ambiguous:    { control: 0.620, treatment: 0.580, delta: -0.040 }
decision: adopt_partial           # 采纳提示词改动，但补一条歧义澄清规则
follow_up: exp-008
```

### 「失败实验」比成功实验更值钱

一个失败的实验告诉你三件事：

1. 这个方向不行（省下别人两周时间）；
2. 你的评测体系能测出「不行」（说明体系可信）；
3. 失败的假设往往指向真正的瓶颈。

所以归档失败实验时，**一定要写「为什么失败」**，而不是只写「效果不好」。

::: tip 人话翻译
实验记录就像**菜谱笔记**。「少放一勺盐更好吃」记下来，「加了香菜全家不吃」也要记下来。只记成功的那本笔记，会让你反复做同一道没人吃的菜。
:::

### 新基线的三条纪律

```text
1. 只有当实验在「完整回归集」上通过，才能成为新基线
2. 新基线必须保存完整快照（每个用例的结果，不只是汇总）
3. 旧基线保留至少两个版本，方便回溯「这次退化是从哪一版开始的」
```

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://docs.langchain.com/langsmith/evaluation-approaches" target="_blank" rel="noreferrer">LangSmith · Experiments and baselines</a>
  <a href="https://www.braintrust.dev/docs/evaluation-quickstart" target="_blank" rel="noreferrer">Braintrust · Experiment tracking</a>
</div>

---

下一章把评测接到生态里：观测、记忆、MCP 工具、跨 Agent 协作、模型网关，各自怎么评。
