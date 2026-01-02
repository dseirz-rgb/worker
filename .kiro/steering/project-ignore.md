---
inclusion: always
priority: high
---

# 项目忽略规则

## 不需要关注的目录

以下目录在大多数任务中不需要加载：

- `node_modules/` - 依赖包，除非调试依赖问题
- `.git/` - Git 内部文件
- `tiktoken_cache/` - 缓存文件
- `get/blinko-main/` - 下载的第三方源码
- `get/khoj-main/` - 下载的第三方源码
- `.pids/` - 进程 ID 文件
- `未命名文件夹/` - 空目录

## 不需要关注的文件类型

- `.DS_Store` - macOS 系统文件
- `*.zip` - 压缩包
- `*.log` - 日志文件（除非调试）
- `*.lock` - 锁文件

## 核心关注区域

当前项目的核心代码在：
- `src/` - 源代码
- `echo/` - Echo AI 相关
- `scripts/` - 脚本工具
- `.kiro/` - Kiro 配置

## 配置文件

需要关注的配置：
- `.env.example` - 环境变量模板
- `docker-compose.yml` - Docker 配置
- `package.json` - 项目依赖（如果存在）
