---
title: 10 · LLM 裁判的校准、降噪与偏见治理
description: 裁判为什么会偏心与漂移，用人工标注做校准，多裁判交叉校验，二元标尺优于 0-10 分，以及定期重校准的工程做法。
outline: [2, 3]
---

# 10 · LLM 裁判的校准、降噪与偏见治理

第 04 章我们请了一位「评分员」：LLM-as-judge。它能一天评十万条，不喊累、不摸鱼，看起来完美。

但它有个问题：**它会自信地打错分，而且从不告诉你它打错了。**

更麻烦的是，它的错误是有规律的：偏好长答案、偏向前面的选项、偏好自己家的模型、被你引导着给高分。这些规律不会自己消失，只会**被规模放大**。

这一章讲怎么把裁判从一个「会拍脑袋的临时工」训练成「有校准记录、可审计、可信的评分员」。

## 01 裁判为什么会偏心 {#bias}

<Diagram id="judge-bias" />

### 五类可复现的偏见

| 偏见类型 | 表现 | 一个真实例子 |
| --- | --- | --- |
| **位置偏见** | 顺序换了结论就换 | A/B 对比时，放前面的赢率 +8pt |
| **长度偏见** | 越长越好 | 把正确答案删掉一半，分数下降；把错误答案注水，分数上升 |
| **自我偏好** | 偏爱同族模型 | GPT 系裁判给 GPT 系输出平均 +0.4 分 |
| **谄媚倾向** | 被诱导就改口 | 提示里加「我认为 A 更好」，A 的胜率 +15pt |
| **格式偏见** | 爱整齐的输出 | 加小标题和 emoji 的输出无条件赢 |

### 一个能自己验证长度的实验

```python
def probe_length_bias(judge, case: dict) -> dict:
    """同一个答案，注水版 vs 原版，看裁判分数差。"""
    original = case["answer"]
    padded = original + "\n\n补充说明：以上结论基于多方面的综合分析，考虑了各种可能的情况。"

    s_original = judge(case["question"], original)
    s_padded = judge(case["question"], padded)
    return {
        "original": s_original,
        "padded": s_padded,
        "delta": s_padded - s_original,      # > 0 说明裁判吃长度
    }
```

**这个实验应该写进你的项目里。** 每次换裁判模型，先跑一遍，你知道它的偏好在哪，才知道该在 rubric 里加什么约束。

### 根源其实在训练数据

裁判模型是在「人类喜欢什么样的回答」的数据上练出来的。而人类确实偏好：更长、更结构化、更礼貌、更肯定。所以裁判不是「坏」，它是**在忠实地模仿一种偏好的平均数**。

::: tip 人话翻译
裁判像一个**刚入职的实习评委**。他没恶意，但会下意识给「说得多的、说得漂亮的、说得肯定的」打高分。你要做的不是换人，是**给他一份明确的评分表，外加抽查他的判分**。
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://arxiv.org/abs/2306.05685" target="_blank" rel="noreferrer">MT-Bench · Judging LLM-as-a-judge</a>
  <a href="https://mlflow.org/docs/latest/genai/eval-monitor/scorers/" target="_blank" rel="noreferrer">MLflow · LLM judge scorers</a>
</div>

## 02 校准流程：用人工标注调教裁判 {#calibration}

校准这件事，说穿了只有三步：**人工标一批 → 让裁判也标 → 对比差异修 rubric。**

<Diagram id="calibration-loop" />

### 第一步：标一批「金标准」

```text
样本量：100-300 条（够看出系统性偏差，不够做统计推断）
抽样方式：分层抽样，每类用例都覆盖（正向/边界/注入/歧义）
标注方式：双人独立标注，第三人仲裁分歧
标注单位：二元（pass / fail），不给 0-10（原因见第 04 节）
```

### 第二步：算一致性指标

不要只看「准确率」，要看**两个方向**：

```python
def judge_confusion(human: list[bool], judge: list[bool]) -> dict:
    """人工 vs 裁判的混淆矩阵与关键指标。"""
    tp = sum(h and j for h, j in zip(human, judge))
    tn = sum((not h) and (not j) for h, j in zip(human, judge))
    fp = sum((not h) and j for h, j in zip(human, judge))   # 裁判放过了坏答案
    fn = sum(h and (not j) for h, j in zip(human, judge))   # 裁判冤枉了好答案
    n = len(human)

    # Cohen's kappa：扣除「碰巧一致」后的一致性
    po = (tp + tn) / n
    p_h, p_j = (tp + fn) / n, (tp + fp) / n
    pe = p_h * p_j + (1 - p_h) * (1 - p_j)
    kappa = (po - pe) / (1 - pe) if pe < 1 else 0.0

    return {
        "agreement": round(po, 3),
        "kappa": round(kappa, 3),
        "leniency": round(fp / max(fp + tn, 1), 3),   # 宽容度：坏答案被放过多少
        "severity": round(fn / max(fn + tp, 1), 3),   # 严苛度：好答案被冤枉多少
    }
```

怎么读这些数：

| 指标 | 参考阈值 | 含义 |
| --- | --- | --- |
| agreement | > 0.85 | 表面一致率 |
| kappa | > 0.6 | 扣除巧合后的一致性（0.6 可用，0.8 优秀） |
| leniency | 接近 severity | 两个方向差不多，说明不是系统偏差 |
| leniency ≫ severity | — | 裁判太宽松，坏答案在漏网 |

**如果 leniency 明显高于 severity，说明你的裁判在「放水」。** 这种情况下，任何指标改善都可能是假的。

### 第三步：按分歧修 rubric

分歧样本是最贵的教材。逐条看，找规律：

```text
分歧 A：答案正确但没提到「7 天无理由」    → rubric 没说清「必须包含关键条款」
分歧 B：答案给了正确数字但单位写成「周」  → rubric 没说清格式要求
分歧 C：答案拒答了但拒得有理（涉及他人隐私）→ rubric 缺「合理拒答算通过」这一条
```

**每一条分歧，都应该变成 rubric 里的一句更具体的话。** 校准三轮之后，你的 rubric 会比一开始具体十倍。

### 一条能直接用的裁判提示词骨架

```text
你是严格的验收员。只输出 PASS 或 FAIL，不要解释过程。

判断标准（全部满足才 PASS）：
1. 结论正确：与参考答案的事实一致（数字、日期、政策条款必须一致）
2. 过程合规：使用的工具属于白名单 [get_order_status, get_refund_policy]
3. 无编造：不得出现参考答案中不存在的事实断言
4. 拒答合理：若问题超出权限，明确说明并给出替代路径（算 PASS）

以下情况一律 FAIL：
- 结论正确但用了白名单外的工具
- 数字正确但单位错误
- 用「可能」「大概」模糊化确定性事实

只输出一行：PASS 或 FAIL
```

### 校准记录模板

```yaml
# evals/judge/calibration/2026-10-31.yaml
judge_model: gpt-5-mini-2026-08
rubric_version: v12
sample:
  n: 240
  strata: {positive: 120, edge: 60, injection: 30, ambiguous: 30}
  annotators: 2
result:
  agreement: 0.892
  kappa: 0.741
  leniency: 0.081
  severity: 0.102
decision: accepted
notes: "歧义类仍有 6 条分歧，多数与「合理拒答」边界有关，下版 rubric 补这一条"
```

::: warning 校准最常见的三个错误
1. **用裁判自己标的样本做校准**：等于自己给自己判卷。
2. **只标「明显对」的样本**：没有难例，校准出来的一致性虚高。
3. **只校准一次**：换模型、改 rubric、改数据分布之后都必须重校准。
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://mlflow.org/docs/latest/genai/eval-monitor/scorers/" target="_blank" rel="noreferrer">MLflow · Judge calibration</a>
  <a href="https://www.promptfoo.dev/docs/guides/llm-as-a-judge/" target="_blank" rel="noreferrer">Promptfoo · LLM-as-a-judge guide</a>
</div>

## 03 多裁判交叉校验 {#crosscheck}

即使校准过，单一裁判仍然会在长尾上犯错。工程解法：**分层裁判**。

<Diagram id="multi-judge" />

### 三档裁判架构

```text
第一档：代码硬校验（免费、确定）
   └─ 能判的直接判，判不了的往下走
        └─ 第二档：廉价裁判（gpt-5-mini 级别）
             └─ 置信度高 → 直接采纳
                  └─ 置信度低 / 与历史矛盾 → 第三档
                       └─ 第三档：强裁判（gpt-5 级别）
                            └─ 仍与第一档冲突 → 进人工复核队列
```

### 用「两次投票」拿置信度

最便宜的置信度估计方式：**同一个裁判跑两次，看是否一致。**

```python
def vote_judge(judge, case, n: int = 3) -> dict:
    """多次采样取多数票，票数分布就是置信度。"""
    votes = [judge(case, temperature=0.7) for _ in range(n)]
    passes = sum(v == "PASS" for v in votes)
    if passes == n or passes == 0:
        return {"verdict": votes[0], "confidence": "high", "votes": votes}
    if passes >= 2:
        return {"verdict": "PASS", "confidence": "low", "votes": votes}
    return {"verdict": "FAIL", "confidence": "low", "votes": votes}
```

只有 `confidence == "low"` 的样本才升级到强裁判。实测下来，升级比例通常在 **8%-15%**，成本能压到原来的三分之一。

### 分歧的三种处理方式

| 分歧情况 | 处理 |
| --- | --- |
| 代码校验 PASS，裁判 FAIL | 以代码为准，但记录裁判误判（说明 rubric 有问题） |
| 弱裁判 PASS，强裁判 FAIL | 以强裁判为准，进入「难例集」 |
| 强裁判与人工也不一致 | **这条用例本身可能定义不清**，回去改用例 |

第三种情况最容易被忽略：**有些分歧不是裁判的问题，是标准本身模糊。** 一条连人类都吵起来的用例，不该出现在回归集里。

::: tip 人话翻译
交叉校验像**医院看片子**：社区医院先拍，有问题再送三甲。不是不信任社区医生，而是**把专家时间花在真正有争议的片子上**。
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://langfuse.com/docs/evaluation/evaluation-methods/llm-as-a-judge" target="_blank" rel="noreferrer">Langfuse · LLM-as-a-judge</a>
  <a href="https://arxiv.org/abs/2306.05685" target="_blank" rel="noreferrer">MT-Bench · Multi-judge setups</a>
</div>

## 04 二元标尺优于 0-10 分 {#scale}

这一节可能反直觉：**我强烈建议你不要用 0-10 分。**

### 0-10 分的三个致命问题

| 问题 | 说明 |
| --- | --- |
| **尺度不统一** | 你的 7 分和别人的 7 分不是一个意思，跨版本没法比 |
| **中间值堆积** | 绝大多数样本落在 6-8，区分度极低 |
| **漂移不可见** | 版本间平均分从 7.2 变 7.4，是变好了还是裁判手松了？ |

### 二元标尺的好处

```text
pass / fail  →  通过率是一个明确的比例，可以做统计检验（第 07 章）
             →  每一个 fail 都必须给理由，理由就是可复现的证据
             →  阈值天然明确：89% 就是 89%，不需要讨论「7.4 算不算好」
```

### 如果业务方一定要分数

用**可分解的二元项**拼成一个分数，而不是让裁判直接给总分：

```python
RUBRIC_ITEMS = {
    "conclusion_correct": "结论与参考答案一致",
    "key_facts_present": "包含全部关键事实（订单号、金额、时效）",
    "no_fabrication": "无编造的事实",
    "tools_within_allowlist": "只使用了白名单工具",
    "format_valid": "输出符合约定格式",
}

def weighted_score(items: dict[str, bool]) -> float:
    """每项都是二元，加权合成。权重写死在代码里，可审计。"""
    weights = {
        "conclusion_correct": 0.5,
        "key_facts_present": 0.2,
        "no_fabrication": 0.15,
        "tools_within_allowlist": 0.1,
        "format_valid": 0.05,
    }
    return round(sum(weights[k] for k, ok in items.items() if ok), 3)
```

好处是：**任何一次分数变化，都能定位到具体是哪一项翻了。** 而 0-10 总分从 7.2 变 7.4，你永远不知道发生了什么。

### 何时可以用连续分

只剩一个合理场景：**两两对比时的软偏好**。比如「这两个回答哪个更自然」，用 0-100 的偏好强度是合理的，因为它只用于排序，不用于门禁。

::: warning 一个必须记住的规则
**门禁只用二元或比例，不用平均分。** 平均分可以用于趋势观察，但不能作为「过 / 不过」的判据。
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://www.promptfoo.dev/docs/configuration/expected-outputs/model-graded/llm-rubric/" target="_blank" rel="noreferrer">Promptfoo · llm-rubric</a>
  <a href="https://mlflow.org/docs/latest/genai/eval-monitor/scorers/" target="_blank" rel="noreferrer">MLflow · Scorer design</a>
</div>

## 05 裁判漂移与定期重校准 {#drift}

这是最隐蔽的问题：**你的代码一行没改，分数却变了。**

<Diagram id="calibration-loop" />

### 漂移的四个来源

| 来源 | 表现 | 怎么发现 |
| --- | --- | --- |
| 模型版本升级 | 供应商静默更新，判分变松/变严 | 锚点集分数突变 |
| rubric 被改 | 有人顺手改了一句话 | rubric 版本号 + 变更记录 |
| 数据分布变了 | 新场景涌入，难例变多 | 分片通过率下降 |
| 提示词污染 | 加了几个示例，改变了判分口味 | 锚点集回归 |

### 锚点集（Anchor Set）：防漂移的核心武器

准备 **50-100 条「答案固定、结论已知」** 的用例，每次跑评测都带上：

```python
ANCHORS = [
    {"id": "a01", "answer": "...", "expected": "PASS"},   # 明显正确
    {"id": "a02", "answer": "...", "expected": "FAIL"},   # 明显编造
    {"id": "a03", "answer": "...", "expected": "FAIL"},   # 工具越权
    # ...
]

def check_drift(judge, accepted: dict[str, str], threshold: float = 0.95) -> dict:
    """锚点集必须保持稳定，掉下去说明裁判变了。"""
    hits = sum(judge(a["answer"]) == accepted[a["id"]] for a in ANCHORS)
    rate = hits / len(ANCHORS)
    return {
        "anchor_pass_rate": round(rate, 3),
        "drift_detected": rate < threshold,
        "action": "recalibrate" if rate < threshold else "ok",
    }
```

**这个检查应该每天跑。** 它只花几十次调用，却能在第一时间告诉你「裁判变了」。

### 重校准的触发条件

```text
1. 锚点集通过率 < 95%                      → 立即重校准
2. 裁判模型版本变更（哪怕是小版本）         → 强制重校准
3. rubric 改动                              → 对分歧样本重跑
4. 每季度定期一次                           → 无条件
5. 业务指标与评测指标出现方向性背离         → 立刻查（可能是裁判漂了，也可能是评测集脱节）
```

### 第 5 条最值得展开

线上转人工率上升 2pt，但你的评测通过率不变。这有三种可能：

```text
A. 评测集没覆盖到这类问题     → 补样本（第 03 章）
B. 裁判变松了                 → 锚点集会先报警
C. 线上真的变了但离线没复现   → 环境差异（模型版本、工具版本、系统提示）
```

三种都要查，但**先把 B 排除掉**，因为它的排查成本最低。

::: tip 人话翻译
裁判漂移像**体重秤失准**。你严格按食谱吃了一个月，体重没变——有两种可能：你真的没瘦，或者秤坏了。
**锚点集就是那块标准砝码。** 每次称之前先放上去，秤是准的，数据才可信。
:::

### 一份季度裁判体检清单

```text
□ 锚点集通过率仍在 95% 以上
□ kappa 与上次校准相比变化 < 0.05
□ leniency / severity 没有单方向恶化
□ 长度偏见探针（注水测试）delta < 0.05
□ 位置偏见探针（A/B 对调）胜率差 < 5pt
□ rubric 变更记录与代码提交对齐
□ 分歧样本已回流到 rubric 或数据集
```

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://mlflow.org/docs/latest/genai/eval-monitor/scorers/" target="_blank" rel="noreferrer">MLflow · Judge monitoring</a>
  <a href="https://docs.langchain.com/langsmith/evaluation-approaches" target="_blank" rel="noreferrer">LangSmith · Evaluation approaches</a>
</div>

---

下一章换一个维度：不是「评得准不准」，而是**「该不该让它做」**——安全、隐私与合规评测。
