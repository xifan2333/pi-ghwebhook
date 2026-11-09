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

pi-ghwebhook 旨在彻底消除提交代码或创建 Pull Request 后的人工轮询与终端反复切换。通过在进程内运行回环 HTTP 服务并托管 GitHub CLI 的 `gh webhook forward` 反向长连接隧道，它可以实时接收 GitHub Webhook 事件，依据 GitHub Actions Workflow 官方规范解析规则，并通过 `pi.sendUserMessage()` 主动唤醒 Pi Agent 进入闭环处置。

## 核心架构特性

- 100% 对齐 GitHub Actions Workflow 官方规范：完全采用官方标准的 `on` 触发器与 `jobs` 任务语法，零中间层生造概念。
- JSON Schema 智能提示：提供官方 Schema（`$schema`），在 VS Code、Cursor 等现代编辑器中编写即享全字段类型补全与静态校验。
- 零公网暴露：依托 `gh webhook forward --events=*` 反向隧道，无需公网服务器、固定 IP 或内网穿透工具。
- 动态端口分配：监听 `127.0.0.1:0`，由操作系统内核动态分配空闲端口，杜绝多终端或多会话并发运行时的端口冲突。
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

在仓库根目录下创建 `.pi/ghwebhook.json`。配置 `$schema` 即可享受现代 IDE 的实时悬浮提示与自动补全：

```json
{
  "$schema": "https://raw.githubusercontent.com/xifan2333/pi-ghwebhook/main/schemas/ghwebhook.schema.json",
  "name": "CI & Review Automation",
  "on": {
    "workflow_run": {
      "workflows": ["CI"],
      "types": ["completed"],
      "branches": ["@current"]
    },
    "pull_request_review": {
      "types": ["submitted"],
      "branches": ["@current"]
    },
    "issues": {
      "types": ["opened"]
    },
    "push": {
      "branches": ["main"]
    }
  },
  "jobs": {
    "ci-failure": {
      "if": "github.event.workflow_run.conclusion == 'failure'",
      "prompt": "分支 {{ branch }} 的 CI 运行失败。\n\n运行链接: {{ run_url }}\n提交哈希: {{ head_sha }}\n\n请使用 `gh run view {{ run_id }} --log-failed` 查看失败日志并进行修复。",
      "deliverAs": "followUp"
    },
    "ci-success": {
      "if": "github.event.workflow_run.conclusion == 'success'",
      "prompt": "分支 {{ branch }} 的远程 CI 已全部通过。\n\n运行链接: {{ run_url }}\n\n请检查 PR 状态并确认是否准备合入。",
      "deliverAs": "followUp"
    },
    "review-bot": {
      "if": "github.event.review.user.type == 'Bot'",
      "prompt": "收到来自 {{ sender }} 的审查意见：\n\n状态: {{ review_state }}\n详情:\n{{ review_body }}\n\n请批判性评估上述审查意见：修复真实问题，驳回误报。",
      "deliverAs": "steer"
    },
    "new-issue": {
      "prompt": "收到新 Issue #{{ issue_number }}: {{ issue_title }}\n\n{{ issue_body }}"
    },
    "push-main": {
      "prompt": "main 分支收到新代码推送: {{ head_sha }} - {{ commit_message }}"
    }
  }
}
```

### 字段说明

- `name`: 可选的工作流名称。
- `repo`: GitHub 仓库名（`owner/repo`）。默认为 `"auto"`（自动从 `git remote get-url origin` 提取）。
- `secret`: 可选的 Webhook HMAC SHA-256 鉴权密钥。
- `on`: GitHub Actions 事件触发器配置：
  - `<event_name>`: 官方事件名称（如 `workflow_run`, `pull_request`, `push`, `issues`）。
  - `types`: 官方活动类型过滤 `payload.action`（如 `["completed"]`, `["opened"]`）。
  - `branches`: 分支过滤，支持 `@current` 动态分支与 glob（如 `["@current", "main", "feat/*"]`）。
  - `workflows`: 工作流过滤（如 `["CI"]`）。
- `jobs`: 触发时执行的任务字典：
  - `if`: 表达式条件（如 `github.event.workflow_run.conclusion == 'failure'`）。
  - `prompt`: 传给 Pi Agent 的提示词内容模板。
  - `deliverAs`: Pi 消息投递模式：`"followUp"`（默认排队执行）或 `"steer"`（实时插话打断）。

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
