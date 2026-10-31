---
title: 06 · 自动化回归流水线与 CI 门禁
description: 从提交到阻断的完整链路、基线劣化计算、分级执行策略、失败报告、限流重试并发控制，以及可直接复制的 GitHub Action 模板。
outline: [2, 3]
---

# 06 · 自动化回归流水线与 CI 门禁

前面五章解决了「怎么评」。这一章解决「怎么让评测真的挡住坏版本」。

一个残酷的事实：**如果评测不在流水线里自动跑，它就一定会在三个月内荒废。** 靠人记得跑的东西，在工期紧张时第一个被砍。

## 01 流水线完整链路 {#pipeline}

先看全貌。

<Diagram id="ci-pipeline" />

六个环节，每个环节都有「不做会怎样」：

| 环节 | 做什么 | 不做的后果 |
| --- | --- | --- |
| 触发 | 代码提交 / PR / 定时 | 靠人手动跑，必然忘 |
| 准备 | 拉起被测版本 + 准备数据与沙箱 | 环境不一致，结果不可比 |
| 执行 | 按分级策略跑对应数据集 | 要么太慢没人等，要么太少没测出东西 |
| 打分 | 代码校验 + 裁判 + 汇总 | 只出原始日志，没人能看懂 |
| 比对 | 与基线版本逐指标对比 | 不知道是变好还是变差 |
| 决策 | 通过 / 告警 / 阻断 + 出报告 | 评测变成「看一眼就关」 |

### 一个容易忽略的前置条件

**被测版本必须可复现地启动。** 这意味着：

```text
1. 提示词、工具 schema、模型版本，全部纳入版本控制
2. 模型版本必须写死（gpt-5-2026-01-15，不是 gpt-5）
3. 环境变量与依赖锁定（lockfile / 镜像 tag）
4. 下游全部 mock 或沙箱
```

第 2 条是最容易被忽略的。很多人写 `model="gpt-5"`，结果某天供应商升级了模型，评测分数突然掉了 6 个点，团队花了两周排查自己代码——其实什么都没改。

::: tip 人话翻译
流水线就像**飞机起飞前的检查流程**。不是「相信机长会检查」，而是「每项都有人在流程上必须签字，不签不起飞」。
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://promptfoo.dev/docs/integrations/github-action/" target="_blank" rel="noreferrer">Promptfoo · GitHub Action</a>
  <a href="https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents" target="_blank" rel="noreferrer">Anthropic · Demystifying evals for AI agents</a>
</div>

## 02 基线版本与劣化计算 {#baseline}

「基线」是评测体系的锚点。没有基线，所有分数都是孤立的数字。

<Diagram id="baseline-delta" />

### 基线怎么定

| 基线类型 | 定义 | 适用 |
| --- | --- | --- |
| **主分支最新绿** | 上一次在 main 上全部门禁通过的运行 | 默认推荐 |
| **发版版本** | 当前线上运行的版本 | 用于「线上 vs 待发」对比 |
| **历史最佳** | 有史以来最好的版本（谨慎使用） | 攻坚阶段 |

推荐 `main@last-green`：它同时具备「可信」和「新鲜」两个属性。

### 劣化计算：三个必须区分的量

```text
绝对劣化：   value_now - value_baseline                 （差了多少）
相对劣化：   (value_now - value_baseline) / value_baseline  （差了多少百分比）
显著性：     这个差异是否超过噪声                        （是不是真的差）
```

前两个好算，第三个是重点——也是最容易被跳过、导致门禁天天误报的原因。

```python
import statistics

def is_regression(scores_now: list[float], scores_base: list[float],
                  max_drop: float = 0.02, alpha: float = 0.05) -> dict:
    """均值劣化超过阈值，且差异显著（近似：置信区间不重叠）。"""
    m_now, m_base = statistics.mean(scores_now), statistics.mean(scores_base)
    sd_now = statistics.pstdev(scores_now) or 1e-6
    sd_base = statistics.pstdev(scores_base) or 1e-6
    se = (sd_now ** 2 / len(scores_now) + sd_base ** 2 / len(scores_base)) ** 0.5
    ci = 1.96 * se                     # 95% 置信区间
    delta = m_now - m_base
    return {
        "delta": round(delta, 4),
        "ci": round(ci, 4),
        "regressed": delta < -max_drop,
        "significant": abs(delta) > ci,   # 差异大于噪声
        "noise": abs(delta) <= ci,
    }
```

::: warning 「-0.4pt」到底是退化还是噪声
300 条用例上掉 0.4 个百分点，通常在噪声范围内。如果你的门禁对 0.4pt 也报警，两周内一定会被关掉。
**先用噪声带宽（置信区间）做一次校准，再定阈值。**
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://docs.langchain.com/langsmith/evaluation-approaches" target="_blank" rel="noreferrer">LangSmith · Baselines and experiments</a>
  <a href="https://www.braintrust.dev/docs/evaluation-quickstart" target="_blank" rel="noreferrer">Braintrust · Comparing experiments</a>
</div>

## 03 分级执行策略 {#tiers}

把所有用例塞进每次提交，结果是开发者等 40 分钟，然后把检查跳过。

<Diagram id="tiered-ci" />

### 三级策略

| 触发时机 | 跑什么 | 目标时长 | 失败处理 |
| --- | --- | --- | --- |
| PR 打开 / 更新 | 冒烟集 30 条 | ≤ 3 分钟 | 阻断合并 |
| 合并到 main | 回归集 300 条 | ≤ 20 分钟 | 阻断发布，通知 owner |
| 发版前 / 每晚 | 长尾集全量 + 人工抽检 | ≤ 3 小时 | 禁止发布，生成完整报告 |

### 加上「智能触发」能省一大半

不是每次提交都需要跑全部相关用例。按改动范围选择：

```python
def select_suites(changed_files: list[str]) -> list[str]:
    """按改动文件选择要跑的数据集切片。"""
    suites = {"smoke"}                              # 冒烟总是跑
    if any("tools/" in f for f in changed_files):
        suites.add("trajectory")                    # 工具改动 → 轨迹用例
    if any(f.endswith(".prompt") or "prompts/" in f for f in changed_files):
        suites.add("faithfulness")                  # 提示词改动 → 忠实度
    if any("policies/" in f or "rules/" in f for f in changed_files):
        suites.add("policy")                        # 业务规则改动 → 政策用例
    if any(f.endswith(".md") for f in changed_files):
        suites = {"smoke"}                          # 纯文档改动 → 只跑冒烟
    return sorted(suites)
```

注意最后一条：**纯文档改动只跑冒烟**。这一条看起来微不足道，但它是让团队愿意保留门禁的关键——没有人愿意为了改一个错别字等 20 分钟。

::: warning 分级策略的反模式
「每次都跑全量，反正机器时间不要钱」——机器时间不要钱，**开发者的等待时间要钱**。CI 超过 10 分钟，跳过就会成为团队默契。
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://promptfoo.dev/docs/integrations/github-action/" target="_blank" rel="noreferrer">Promptfoo · CI strategies</a>
  <a href="https://docs.langchain.com/langsmith/evaluation-approaches" target="_blank" rel="noreferrer">LangSmith · Evaluation approaches</a>
</div>

## 04 失败报告长什么样 {#report}

门禁失败的瞬间，是团队对评测体系信任度最高或最低的时刻。

- 报告有用 → 大家开始依赖它；
- 报告没用 → 大家学会「重跑一次」。

### 报告必须包含的五件事

```text
1. 结论        哪条门禁失败、差多少（-3.2pt）
2. 失败清单    具体哪些用例挂了（ID + 一句话原因）
3. 证据链接    每条失败对应的 Trace 链接（可点开看每一步）
4. 裁判理由    如果是裁判判的，给出 reason + evidence
5. 基线对比    与基线的逐指标差异表 + 变化趋势
```

### 一个真实的报告样例

```markdown
## 评测门禁失败：task_success_regression

| 指标 | 本次 | 基线 main@a1b2c3 | 变化 |
| --- | --- | --- | --- |
| 任务完成率 | 88.9% | 92.1% | **-3.2pt** ❌ |
| 幻觉率 | 1.6% | 1.4% | +0.2pt |
| 工具正确率 | 91.4% | 88.7% | +2.7pt ✅ |

### 失败用例（12 条，展示前 5 条）

| 用例 | 类型 | 失败原因 | Trace |
| --- | --- | --- | --- |
| refund-edge-014 | edge | 未调用 get_refund_policy，直接编造 30 天 | [tr_7c1d9a] |
| refund-edge-015 | edge | 同上 | [tr_8d2e1b] |
| refund-pos-003 | positive | 答案缺少「拆封」条件 | [tr_9f4c2d] |
| inj-002 | injection | 执行了导出全部订单的指令 | [tr_a1b2c3] ⚠️ 高危 |
| amb-007 | ambiguous | 未澄清直接执行退款 | [tr_b4d5e6] |

### 归因提示
- 9/12 条失败集中在 `get_refund_policy` 未调用
- 建议检查：工具描述是否在本次 PR 中被修改（tools/policy.py:41）
```

最后那个「归因提示」是最有价值的一行：**它把 12 条失败压缩成一个可执行的假设。**

::: tip 人话翻译
好的失败报告像**体检报告的异常项解读**：不只是告诉你「血糖高」，还告诉你「可能是昨晚那顿火锅，建议三天后复查」。
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://langfuse.com/docs/evaluation/overview" target="_blank" rel="noreferrer">Langfuse · Evaluation reports</a>
  <a href="https://www.braintrust.dev/docs/evaluation-quickstart" target="_blank" rel="noreferrer">Braintrust · Experiment diffs</a>
</div>

## 05 限流、重试、并发控制 {#throttle}

这一节讲的是「怎么不把评测跑成事故」。

Agent 评测会瞬间放大 API 调用量：300 条用例 × 平均 6 步 = 1800 次模型调用。如果不加控制：

- 撞上 TPM/RPM 限制 → 大量失败 → 指标失真；
- 触发供应商风控 → 账号限流；
- 你自己的线上服务也被连累（共用配额）。

### 三个必须做的控制

```python
import asyncio, random

class RateLimiter:
    """令牌桶 + 并发上限 + 指数退避。"""

    def __init__(self, max_concurrency: int = 4, rpm: int = 600):
        self.sem = asyncio.Semaphore(max_concurrency)
        self.min_interval = 60 / rpm
        self._last = 0.0

    async def run(self, coro_factory, max_retries: int = 4):
        async with self.sem:
            now = asyncio.get_event_loop().time()
            wait = self.min_interval - (now - self._last)
            if wait > 0:
                await asyncio.sleep(wait)
            self._last = asyncio.get_event_loop().time()

            for attempt in range(max_retries):
                try:
                    return await coro_factory()
                except (RateLimitError, TimeoutError):
                    backoff = (2 ** attempt) + random.random()
                    await asyncio.sleep(backoff)
            raise RuntimeError("exceeded retries")
```

三个参数的经验值：

| 参数 | 建议起点 | 调整依据 |
| --- | --- | --- |
| 并发数 | 3-5 | 从 3 开始，观察 429 率，低于 1% 再往上加 |
| RPM | 供应商限额的 60% | 留出余量给线上流量 |
| 最大重试 | 4 次 | 再多说明配额根本不够 |

### 失败要区分「测量失败」和「真实失败」

这是最容易搞错的一点：

```python
TRANSIENT = {429, 500, 502, 503, 504}

def classify_failure(exc) -> str:
    if getattr(exc, "status", None) in TRANSIENT:
        return "infra"      # 基础设施问题，不计入模型质量
    return "quality"        # 真实的能力问题
```

`infra` 类失败必须**重跑**或**从分母里剔除**。把它们算成模型失败，你的指标会在高峰期莫名其妙掉 15 个点——那不是模型变差，是你被限流了。

::: danger 最隐蔽的失真来源
评测和线上抢同一份配额。评测跑批时把线上打慢了，用户超时增加，同时评测结果也因为 429 而失真。**评测流量必须使用独立配额或独立 API key。**
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://promptfoo.dev/docs/integrations/github-action/" target="_blank" rel="noreferrer">Promptfoo · Rate limiting</a>
  <a href="https://arxiv.org/abs/2406.12045" target="_blank" rel="noreferrer">τ-bench · retries and pass^k</a>
</div>

## 06 GitHub Action 模板 {#github}

最后给一份可以直接抄进仓库的模板。

### 目录结构约定

```text
repo/
├─ evals/
│  ├─ datasets/
│  │  ├─ smoke.yaml
│  │  ├─ regression.yaml
│  │  └─ longtail.yaml
│  ├─ graders/
│  │  ├─ code_checks.py
│  │  └─ judge.py
│  ├─ baselines/
│  │  └─ main-last-green.json
│  └─ run.py
└─ .github/workflows/eval.yml
```

### 完整工作流

```yaml
name: Agent eval gate

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
  schedule:
    - cron: "0 18 * * *"        # 每晚长尾集

concurrency:
  group: eval-${{ github.ref }}
  cancel-in-progress: true       # 新提交自动取消旧运行

jobs:
  smoke:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: pip install -r evals/requirements.txt
      - name: Run smoke set
        env:
          OPENAI_API_KEY: ${{ secrets.EVAL_OPENAI_KEY }}
          LANGSMITH_API_KEY: ${{ secrets.LANGSMITH_KEY }}
        run: python evals/run.py --suite smoke --out smoke.json --fail-under 1.0
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: smoke-report
          path: smoke.json

  regression:
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    timeout-minutes: 40
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: pip install -r evals/requirements.txt
      - name: Run regression set against baseline
        env:
          OPENAI_API_KEY: ${{ secrets.EVAL_OPENAI_KEY }}
        run: |
          python evals/run.py --suite regression --out now.json
          python evals/compare.py \
            --now now.json \
            --baseline evals/baselines/main-last-green.json \
            --gate evals/eval-gate.yml \
            --report report.md
      - name: Comment on commit
        if: failure()
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const body = fs.readFileSync('report.md', 'utf8').slice(0, 60000);
            await github.rest.repos.createCommitComment({
              ...context.repo, commit_sha: context.sha, body
            });
      - uses: actions/upload-artifact@v4
        if: always()
        with: { name: regression-report, path: "report.md" }

  promote-baseline:
    needs: [regression]
    if: success() && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cp now.json evals/baselines/main-last-green.json
      - run: |
          git config user.name "eval-bot"
          git config user.email "eval-bot@users.noreply.github.com"
          git add evals/baselines/main-last-green.json
          git commit -m "chore(eval): promote baseline" || true
          git push
```

### 三个关键细节

| 细节 | 为什么 |
| --- | --- |
| `cancel-in-progress: true` | 连续推送时不必等旧任务跑完，省时间省钱 |
| `timeout-minutes` | 防止评测卡死消耗额度 |
| `promote-baseline` 只在 success 时跑 | 基线一旦被坏版本污染，后面所有对比都失效 |

::: warning 别把密钥写进日志
`run:` 步骤里如果直接 `echo` 密钥变量（如 `secrets.X`），密钥会进日志。用 `env:` 注入，且评测脚本不要打印请求头。
:::

<div class="a-src">
  <span class="a-src__tag">来源</span>
  <a href="https://promptfoo.dev/docs/integrations/github-action/" target="_blank" rel="noreferrer">Promptfoo · GitHub Action reference</a>
  <a href="https://docs.github.com/en/actions" target="_blank" rel="noreferrer">GitHub Actions documentation</a>
</div>

---

下一章讲怎么用评测做实验：A/B 对比、显著性判断与灰度评测。
