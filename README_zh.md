<div align="center">

# pi-ghwebhook

**适用于 Pi coding agent 的通用 GitHub Webhook 事件总线与自动唤醒驱动**

[![npm version](https://img.shields.io/npm/v/pi-ghwebhook?logo=npm&logoColor=white)](https://www.npmjs.com/package/pi-ghwebhook)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22.19.0-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Pi Package](https://img.shields.io/badge/pi--package-extension-black)](https://github.com/earendil-works/pi)
[![GitHub License](https://img.shields.io/github/license/xifan2333/pi-ghwebhook?logo=github&logoColor=white)](LICENSE)

[English](README.md) | 简体中文

</div>

## 概述

pi-ghwebhook 旨在彻底消除提交代码或创建 Pull Request 后的人工轮询与终端反复切换。通过在进程内运行回环 HTTP 服务并托管 GitHub CLI 的 `gh webhook forward` 反向长连接隧道，它可以实时接收 GitHub Webhook 事件，依据声明式守卫规则进行快速匹配过滤，并通过 `pi.sendUserMessage()` 主动唤醒 Pi Agent 进入闭环处置。

## 核心架构特性

- 上游协议 1:1 对齐：直接匹配 GitHub 官方线缆事件（`<event>` 或 `<event>.<action>`），天然支持所有 100+ 种 GitHub Webhook 事件。
- 声明式灵活过滤：将状态与结论判断（`branch`、`conclusion`、`workflow`、`state`、`senders`、`isBot`、`match`）全部下沉至配置规则中，拒绝代码硬编码伪语义。
- 零公网暴露：依托 `gh webhook forward --events=*` 反向隧道，无需公网服务器、固定 IP 或内网穿透工具。
- 动态端口分配：监听 `127.0.0.1:0`，由操作系统内核分配空闲端口，杜绝多终端或多会话并发运行时的端口冲突。
- 表驱动分发：基于哈希表实现 O(1) 路由分发，执行严格的复杂度门禁（CCN <= 15, CogC <= 15）。
- 工作区自感知：在 `session_start` 生命周期探测 `.pi/ghwebhook.json`，无配置时静默休眠，零资源占用。
- 幂等清理保障：深度绑定 `session_shutdown` 与进程退出钩子，确保子进程与本地服务干净释放，不留孤儿进程。

## 安装

安装到 Pi coding agent：

```bash
pi install npm:pi-ghwebhook
```

或直接通过 GitHub 仓库安装：

```bash
pi install git:github.com/xifan2333/pi-ghwebhook
```

在当前会话中即时测试：

```bash
pi -e /path/to/pi-ghwebhook
```

## 配置契约 (`.pi/ghwebhook.json`)

在需要启用事件驱动的仓库根目录下创建 `.pi/ghwebhook.json`（或 `.agents/ghwebhook.json`）：

```json
{
  "version": 1,
  "enabled": true,
  "repo": "auto",
  "subscriptions": [
    {
      "event": "workflow_run.completed",
      "filters": {
        "branch": "@current",
        "workflow": "CI",
        "conclusion": "failure"
      },
      "action": {
        "deliverAs": "followUp",
        "prompt": "分支 {{ branch }} 的 CI 运行失败。\n\n运行链接: {{ run_url }}\n提交哈希: {{ head_sha }}\n\n请查看失败日志并给出修复方案。"
      }
    },
    {
      "event": "workflow_run.completed",
      "filters": {
        "branch": "@current",
        "conclusion": "success"
      },
      "action": {
        "deliverAs": "followUp",
        "prompt": "分支 {{ branch }} 的远程 CI 已全部通过。\n\n运行链接: {{ run_url }}\n\n请检查 PR 状态并确认是否准备合入。"
      }
    },
    {
      "event": "pull_request_review.submitted",
      "filters": {
        "branch": "@current",
        "isBot": true,
        "senders": ["coderabbitai[bot]", "greptile[bot]"]
      },
      "action": {
        "deliverAs": "steer",
        "prompt": "收到来自 {{ sender }} 的评审意见：\n\n评审状态: {{ review_state }}\n详情内容:\n{{ review_body }}\n\n请批判性评估上述审查意见：修复真实问题，驳回误报。"
      }
    },
    {
      "event": "issues.opened",
      "action": {
        "prompt": "收到新 Issue #{{ issue_number }}: {{ issue_title }}\n\n{{ issue_body }}"
      }
    },
    {
      "event": "push",
      "filters": {
        "branch": "main"
      },
      "action": {
        "prompt": "main 分支收到新推送: {{ head_sha }} - {{ commit_message }}"
      }
    }
  ]
}
```

### 顶层配置字段

| 字段            | 类型      | 默认值      | 说明                                                                                        |
| --------------- | --------- | ----------- | ------------------------------------------------------------------------------------------- |
| `version`       | `1`       | `1`         | 契约版本号（必须为 1）。                                                                    |
| `enabled`       | `boolean` | `true`      | 是否在当前工作区启用该扩展。                                                                |
| `repo`          | `string`  | `"auto"`    | 目标 GitHub 仓库名（`owner/repo`）。为 `"auto"` 时自动从 `git remote get-url origin` 提取。 |
| `secret`        | `string`  | `undefined` | 可选的 Webhook HMAC SHA-256 鉴权密钥。                                                      |
| `subscriptions` | `Array`   | `[]`        | 声明式事件订阅规则列表。                                                                    |

### 订阅规则字段

- `event`: 上游 GitHub Webhook 事件名称（如 `workflow_run.completed`、`pull_request.opened`、`push`、`issues.labeled`）。
- `topic`: `event` 字段的可选别名。
- `filters`: 声明式过滤守卫。
- `action`: 唤醒动作负载，包含 `prompt` 模板和可选的 `deliverAs`（`"steer"` 或 `"followUp"`）。

### 过滤守卫 (Filters)

- `branch`: 目标分支名称，或特殊符号 `@current`（动态解析为本地当前分支）。
- `conclusion`: 工作流运行结论（`success`、`failure`、`cancelled`、`skipped` 等）。
- `workflow`: 工作流名称（如 `CI`）。
- `state`: 评审状态（`approved`、`changes_requested`、`commented`）或 PR 状态。
- `senders`: 允许的发送者登录名数组（如 `["coderabbitai[bot]"]`）。
- `isBot`: 布尔标志，匹配机器人（`true`）或人类（`false`）发送者。
- `match`: 任意键值映射表，使用点路径语法匹配负载深层字段（如 `{"review.state": "changes_requested"}`）。

### 模板插值变量

- `{{ branch }}`: 分支名称
- `{{ head_sha }}`: 触发提交哈希
- `{{ commit_message }}`: 提交日志
- `{{ repo }}` / `{{ repo_url }}`: 仓库名及网页链接
- `{{ run_id }}` / `{{ run_url }}` / `{{ workflow }}` / `{{ conclusion }}`: 工作流运行元数据
- `{{ pr_number }}` / `{{ pr_title }}` / `{{ pr_url }}`: PR 详情
- `{{ issue_number }}` / `{{ issue_title }}` / `{{ issue_url }}` / `{{ issue_body }}`: Issue 详情
- `{{ sender }}` / `{{ sender_type }}`: 触发人或机器人
- `{{ review_state }}` / `{{ review_body }}` / `{{ review_url }}`: 评审详情
- `{{ comment_body }}` / `{{ comment_url }}`: 评论详情
- `{{ action }}`: 负载操作动作名

## 开发与质量门禁

```bash
mise run check         # 执行全量质量检查（tsc, oxlint, prettier, lizard, jscpd, typos）
mise run check:plan    # 预览执行计划
mise run check:changed # 增量检查暂存区及修改文件 (< 50ms)
mise run fix           # 自动格式化并修复问题
mise run test          # 运行测试套件
```

## 许可证

[MIT](LICENSE) © 2026 xifan
