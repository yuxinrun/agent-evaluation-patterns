---
title: 04 · 四大评测器核心 Pattern
description: 代码确定性校验、LLM-as-judge、两两对比 Pairwise、人工评审与 Kappa 一致性，以及混合评测的配比与选型决策表。
outline: [2, 3]
---

# 04 · 四大评测器核心 Pattern

这是全书最重要的一章。

前面三章讲了「评什么」。这一章讲「怎么判」——**同样的数据、同样的 Agent，判定方式不同，结论可能完全相反。**

先给结论，再讲细节：

```text
能用代码判的，绝不用模型判
能用二元的，绝不用 0-10 分
能两两对比的，不要做绝对打分
人工评审不是「兜底」，是用来校准机器的
```

<Diagram id="grader-map" />

## 01 代码确定性校验模式 {#code}

### 核心思想

**把「什么算对」写死在代码里。** 满足条件返回 PASS，不满足返回 FAIL，没有任何解释空间。

它的三个特性决定了它应该是第一道防线：

| 特性 | 含义 | 实际收益 |
| --- | --- | --- |
| 零成本 | 不调用任何模型 | 跑 1000 条几乎不花钱 |
| 100% 可复现 | 同输入同输出 | CI 门禁不会随机红 |
| 毫秒级 | 纯本地计算 | 冒烟集 1 分钟内跑完 |

### 四种常见写法

**写法一：JSON Schema 校验**

```python
from jsonschema import validate, ValidationError

ORDER_SCHEMA = {
    "type": "object",
    "required": ["order_id", "status", "items"],
    "properties": {
        "order_id": {"type": "string", "pattern": "^A\\d{4,}$"},
        "status": {"enum": ["pending", "shipped", "delivered", "refunded"]},
        "items": {"type": "array", "minItems": 1},
    },
    "additionalProperties": False,
}

def check_schema(output: dict) -> dict:
    try:
        validate(instance=output, schema=ORDER_SCHEMA)
        return {"name": "schema", "pass": True}
    except ValidationError as e:
        return {"name": "schema", "pass": False, "note": e.message}
```

**写法二：数值与事实断言**

```python
def check_no_forbidden_numbers(answer: str, forbidden: list[str]) -> dict:
    hits = [f for f in forbidden if f in answer]
    return {"name": "no_forbidden_numbers", "pass": not hits, "note": f"hits={hits}"}

def check_numbers_supported(answer: str, policy_text: str) -> dict:
    """回答里出现的每个数字，都必须能在政策原文中找到。"""
    numbers = set(re.findall(r"\d+(?:\.\d+)?", answer))
    missing = [n for n in numbers if n not in policy_text]
    return {"name": "numbers_supported", "pass": not missing, "note": f"unsupported={missing}"}
```

**写法三：工具入参校验**

```python
def check_tool_args(trace, tool: str, required: dict) -> dict:
    """不仅看调没调，还看参数对不对。"""
    for run in trace.runs:
        if run.get("kind") != "tool" or run.get("tool") != tool:
            continue
        args = run.get("args", {})
        bad = [k for k, v in required.items() if args.get(k) != v]
        if not bad:
            return {"name": f"args:{tool}", "pass": True}
        return {"name": f"args:{tool}", "pass": False, "note": f"mismatch={bad} args={args}"}
    return {"name": f"args:{tool}", "pass": False, "note": "tool not called"}
```

**写法四：状态与副作用断言**

```python
def check_final_state(db_snapshot: dict, expected: dict) -> dict:
    """评测跑完后比对数据库状态，抓「答案对了但数据被改坏」。"""
    diffs = {k: (expected[k], db_snapshot.get(k)) for k in expected
             if db_snapshot.get(k) != expected[k]}
    return {"name": "final_state", "pass": not diffs, "note": str(diffs)}
```

::: warning 代码校验不是「低级校验」
很多人以为代码校验只能查格式。实际上 **Agent 评测里最值钱的断言几乎都是代码校验**：工具选对了没、入参对不对、调了几次、有没有写脏数据、有没有泄露 PII。
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents" target="_blank" rel="noreferrer">Anthropic · Demystifying evals for AI agents</a>
  <a href="https://deepeval.com/docs/metrics-introduction" target="_blank" rel="noreferrer">DeepEval · Deterministic metrics</a>
</div>

## 02 LLM-as-judge 裁判模式 {#judge}

代码只能判「结构」，判不了「意思」。这时候需要裁判模型。

<Diagram id="judge-flow" />

### 原理：把「评审标准」变成一段可执行的提示词

```text
输入：用例 + Agent 输出（+ 轨迹）
裁判：一个模型 + 一份 Rubric
输出：结构化结果 {verdict, reason, evidence}
```

它之所以有效，是因为**「判断」比「生成」容易**。让模型从零写一个正确答案很难，让它判断「这个答案有没有违背政策」相对容易。

### 裁判模型怎么选

| 场景 | 选型建议 | 理由 |
| --- | --- | --- |
| 高频、粗筛 | 小模型 / 便宜模型 | 单价低，用于过滤掉 80% 明显通过的 |
| 终审、争议样本 | 强模型 | 判错代价高，值得花钱 |
| 涉及安全/合规 | 强模型 + 规则复核 | 不允许单点判断 |
| 裁判自己也要被评 | 用另一家的模型 | 避免同源自偏好 |

::: tip 人话翻译
裁判模型就像**阅卷老师**：平时小测可以让助教批（便宜快），高考必须资深老师批（贵但准），而且最高考的卷子最好别由出题人自己批。
:::

### 一个生产可用的裁判实现

```python
import json

JUDGE_PROMPT = """You are a strict support-reply reviewer. Judge exactly one thing:
is the answer faithful to the retrieved policy?

[Question]
{question}

[Retrieved policy]
{context}

[Agent answer]
{answer}

Rules:
- PASS only if every claim about timing, money or conditions is supported by the policy text,
  and no policy detail outside the text is introduced.
- FAIL if any number or condition is absent from the policy, or a partial rule is stated as absolute.
- If the policy does not cover the question, the answer must say a human will confirm.

Return JSON only:
{{"verdict": "PASS" | "FAIL", "reason": "<one sentence>", "evidence": "<quote from policy or the invented part>"}}
"""

def llm_judge(client, case: dict, answer: str, context: str) -> dict:
    resp = client.chat.completions.create(
        model="gpt-5-mini",                     # cheap tier for high volume
        temperature=0,                          # determinism first
        response_format={"type": "json_object"},
        messages=[{"role": "user", "content": JUDGE_PROMPT.format(
            question=case["input"], context=context, answer=answer)}],
    )
    data = json.loads(resp.choices[0].message.content)
    return {
        "name": "faithfulness",
        "pass": data["verdict"] == "PASS",
        "note": f'{data["reason"]} | {data["evidence"]}',
        "cost": resp.usage.total_tokens,
    }
```

四个关键设计点，缺一个就会出问题：

| 设计点 | 为什么 |
| --- | --- |
| `temperature=0` | 降低随机波动，让 CI 可复现 |
| 结构化输出 JSON | 便于程序消费，也便于统计裁判自身的失败率 |
| 强制 `evidence` | 让人能复核「裁判是不是看错了」 |
| 单维度 | 一次只判一件事，遵守率最高 |

### 裁判 Prompt 的三段式模板

```text
【角色 + 唯一任务】  你是 X 评审员，只判 Y 这一件事
【输入】            用例、上下文、Agent 输出
【判定规则】        PASS 的充分条件、FAIL 的充分条件（写具体的坏例子）
【输出格式】        JSON：verdict / reason / evidence
```

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://promptfoo.dev/docs/guides/llm-as-a-judge/" target="_blank" rel="noreferrer">Promptfoo · LLM-as-a-judge guide</a>
  <a href="https://langfuse.com/docs/evaluation/evaluation-methods/llm-as-a-judge" target="_blank" rel="noreferrer">Langfuse · LLM-as-a-judge</a>
  <a href="https://github.com/langchain-ai/openevals" target="_blank" rel="noreferrer">OpenEvals · create_llm_as_judge</a>
</div>

## 03 两两对比 Pairwise 模式 {#pairwise}

### 为什么 Pairwise 比绝对打分稳

绝对打分有个致命问题：**分数没有绝对坐标系**。同一份回答，早上批给 7 分，下午可能给 6 分；换成另一个模型，整体分数会平移 1 分。于是「A 版 7.2，B 版 7.5」这种结论完全不可信。

Pairwise 换了个问法：**不问「这有多好」，只问「两个里哪个更好」**。人对相对判断的稳定性远高于绝对判断。

<Diagram id="pairwise-flow" />

### 三个必须处理的偏见

| 偏见 | 表现 | 处理方式 |
| --- | --- | --- |
| **位置偏见** | 裁判偏爱第一个（或最后一个）答案 | 交换 A/B 位置各跑一次，只取一致的结论；不一致记为平局 |
| **长度偏见** | 更长的答案更容易被判更好 | 在 Rubric 里明确「详细不等于更好」，或对长度做归一化 |
| **自我偏好** | 裁判偏爱自己家模型生成的答案 | 用第三方模型做裁判，或双裁判交叉 |

```python
def pairwise_judge(client, question, answer_a, answer_b, rubric) -> dict:
    """位置交换双跑，只有方向一致才算有效票。"""
    def ask(first, second):
        resp = client.chat.completions.create(
            model="gpt-5",
            temperature=0,
            response_format={"type": "json_object"},
            messages=[{"role": "user", "content": f"""Compare two answers to the same question.
Question: {question}
Answer X: {first}
Answer Y: {second}
Rubric: {rubric}
Return JSON: {{"winner": "X" | "Y" | "TIE", "reason": "..."}}"""}],
        )
        data = json.loads(resp.choices[0].message.content)
        return data["winner"]

    first = ask(answer_a, answer_b)     # A 在前
    second = ask(answer_b, answer_a)    # B 在前

    if first == "TIE" or second == "TIE":
        return {"winner": "TIE", "valid": True}
    # 位置交换后结论应当反转
    mapped = {"X": "A", "Y": "B"}[first]
    mapped_rev = {"X": "B", "Y": "A"}[second]
    return {"winner": mapped if mapped == mapped_rev else "TIE",
            "valid": mapped == mapped_rev}
```

注意 `valid` 字段：**位置不一致的比例本身就是数据**。如果 40% 的样本位置一换就翻转，说明这两个版本差距太小，或者裁判太不稳定——两种结论都比「A 略好」有意义。

::: warning Pairwise 不能替代绝对门禁
Pairwise 只能回答「谁更好」，不能回答「够不够好」。你可以用 Pairwise 决定「上不上新版本」，但仍然需要绝对阈值守住底线（第 02 章的 SLO 门禁）。
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://arxiv.org/abs/2306.05685" target="_blank" rel="noreferrer">MT-Bench / Chatbot Arena · Judging LLM-as-a-Judge</a>
  <a href="https://arxiv.org/abs/2403.04132" target="_blank" rel="noreferrer">Chatbot Arena · pairwise at scale</a>
</div>

## 04 人工评审与 Kappa 一致性 {#human}

人工评审有两个用途，很多人只用了第一个：

1. **直接判分**（上线前抽检、高风险样本）；
2. **校准机器**（给裁判模型做「标准答案」）。

第二个用途才是它的战略价值。

### 抽样看板怎么设计

| 设计点 | 建议 |
| --- | --- |
| 每批样本量 | 30-50 条（人一次能认真看完的上限） |
| 呈现内容 | 问题 + 上下文 + 轨迹摘要 + 最终答案 |
| 评分方式 | 二元（PASS/FAIL）+ 失败类型标签 + 一句话理由 |
| 盲评 | 不告诉标注者这是哪个版本，避免先入为主 |
| 双标注 | 至少 10% 的样本由两个人独立标注 |

### Kappa 一致性：判断「标注是否可信」

两个人标的结论一致率高，不代表可靠——有可能他们都在乱标，只是碰巧一致。Cohen's Kappa 扣除了「随机一致」的部分：

```python
def cohen_kappa(a: list[int], b: list[int]) -> float:
    """二元标注的 Cohen's Kappa。"""
    assert len(a) == len(b) and len(a) > 0
    n = len(a)
    p_observed = sum(x == y for x, y in zip(a, b)) / n
    p_a1 = sum(a) / n
    p_b1 = sum(b) / n
    p_expected = p_a1 * p_b1 + (1 - p_a1) * (1 - p_b1)
    if p_expected == 1:
        return 1.0
    return round((p_observed - p_expected) / (1 - p_expected), 3)
```

怎么解读：

| Kappa | 含义 | 该怎么办 |
| --- | --- | --- |
| > 0.8 | 高度一致 | 标注标准可用，可作为裁判校准集 |
| 0.6-0.8 | 基本一致 | 检查歧义样本，补充 Rubric 例子 |
| 0.4-0.6 | 中等 | Rubric 有问题，或样本本身有歧义 |
| < 0.4 | 差 | 停止投入，先把「什么算对」讨论清楚 |

::: tip 人话翻译
Kappa 是**两个裁判的默契程度**。如果两个人对同一批题只有 55% 一致，那就别拿这批题去考机器——你自己都没标准。
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://mlflow.org/docs/latest/genai/eval-monitor/scorers/" target="_blank" rel="noreferrer">MLflow · Judge calibration with humans</a>
  <a href="https://docs.langchain.com/langsmith/home" target="_blank" rel="noreferrer">LangSmith · Annotation queues</a>
</div>

## 05 混合评测模式 {#hybrid}

真实生产里没有「只用一种评测器」的系统。正确姿势是**分层组合**：

<Diagram id="hybrid-stack" />

### 三层配比

| 层 | 谁判 | 判什么 | 覆盖比例 | 单条成本 |
| --- | --- | --- | --- | --- |
| L1 硬校验 | 代码 | 格式、工具、数值、状态、PII | 全量 100% | ≈ 0 |
| L2 语义裁判 | 廉价模型 | 忠实度、相关性、语气 | 全量或高抽样 | 低 |
| L3 深度复核 | 强模型 / 人 | 争议样本、高风险样本 | 5%-10% | 高 |

**执行顺序很重要**：L1 先跑，L1 挂掉的样本不再进入 L2。这一个小优化通常能省掉 20%-40% 的裁判成本。

```python
def grade_hybrid(case, trace, l1_checks, judge_fn, escalate_fn=None) -> dict:
    results = [c(trace) for c in l1_checks]
    if any(not r["pass"] for r in results):
        return {"verdict": "FAIL", "stage": "L1", "details": results}

    judged = judge_fn(case, trace)
    results.append(judged)
    if not judged["pass"] and escalate_fn:
        results.append(escalate_fn(case, trace))   # 只有争议样本进 L3

    ok = all(r["pass"] for r in results)
    return {"verdict": "PASS" if ok else "FAIL", "stage": "L2", "details": results}
```

### 一个真实配比案例

```text
样本量 3000 条
L1 代码校验     3000 条 × $0        = $0
  → 挂掉 420 条（14%），直接判 FAIL，不进 L2
L2 便宜裁判     2580 条 × $0.002     = $5.16
  → 判 FAIL 310 条
L3 强模型复核   310 条 × $0.02       = $6.20
  → 推翻 62 条（20% 的争议样本被判错了）
人工抽检        60 条（争议样本 10%）
总成本 ≈ $11.4 / 3000 条
```

对比「全部用强模型裁判」：3000 × $0.02 = $60。**混合同样精度，成本降到五分之一。**

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://promptfoo.dev/docs/guides/llm-as-a-judge/" target="_blank" rel="noreferrer">Promptfoo · Layered judging</a>
  <a href="https://deepeval.com/docs/metrics-introduction" target="_blank" rel="noreferrer">DeepEval · Composable metrics</a>
</div>

## 06 评测器选型决策表 {#selection}

最后给一张可以直接贴进团队文档的决策表。

### 按「要判什么」选

| 要判的东西 | 首选 | 备选 | 不要用 |
| --- | --- | --- | --- |
| 输出符合 JSON Schema | 代码 | — | LLM 裁判 |
| 工具选对了没 | 代码 | — | LLM 裁判 |
| 工具入参对不对 | 代码 | — | LLM 裁判 |
| 调了几次工具 | 代码 | — | LLM 裁判 |
| 有没有写出脏数据 | 代码（状态快照） | — | LLM 裁判 |
| 有没有泄露 PII | 代码（正则 + 校验位） | 强模型复核 | 只用裁判 |
| 数字是否有依据 | 代码（数字抽取比对） | 裁判辅助 | 只看答案 |
| 回答是否忠实于上下文 | 裁判 | 人工抽检 | 看关键词 |
| 语气是否合适 | 裁判 | 人工 | 代码 |
| 是否答非所问 | 裁判 | — | 代码 |
| A 版和 B 版谁更好 | Pairwise | 裁判 + 人工 | 绝对打分 |
| 该拒答时拒答了吗 | 代码（策略标签） | 裁判 | 只看完成率 |

### 按团队阶段选

| 团队阶段 | 推荐组合 | 理由 |
| --- | --- | --- |
| 刚起步（0-1 个月） | 只做代码校验 + 30 条冒烟集 | 最快见效，零成本 |
| 有回归需求（1-3 个月） | 代码校验 + 廉价裁判 + 基线对比 | 能进 CI 阻断 |
| 要评估主观质量 | 加 Pairwise + 人工校准 | 解决「哪个更好」 |
| 平台化 | 三层混合 + 分层裁判 + 抽检 | 成本与精度平衡 |

::: warning 选型时最容易犯的三个错
1. **全部用裁判**：贵、慢、不稳定，CI 天天红。
2. **全部用代码**：只能测格式，测不出「答得对不对」。
3. **跳过人工**：裁判没人校准，跑半年都不知道准不准。
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://docs.langchain.com/langsmith/evaluation-approaches" target="_blank" rel="noreferrer">LangSmith · Evaluation approaches</a>
  <a href="https://www.braintrust.dev/docs/evaluation-quickstart" target="_blank" rel="noreferrer">Braintrust · Scorer selection</a>
  <a href="https://promptfoo.dev/docs/configuration/expected-outputs/model-graded/llm-rubric/" target="_blank" rel="noreferrer">Promptfoo · Assertion types</a>
</div>

---

下一章是 Agent 评测真正的主场：轨迹评测。它决定了你的评测体系是「评 LLM」还是「评 Agent」。
