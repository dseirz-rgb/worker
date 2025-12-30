# Implementation Plan: OpenBB Integration

## Overview

部署 OpenBB FastAPI 服务作为统一数据获取层，并创建 TypeScript 客户端供前端调用。采用 Python + FastAPI + Redis 技术栈。

## Tasks

- [x] 1. 项目初始化
  - [x] 1.1 创建 OpenBB 服务目录结构
    - 创建 `openbb-service/` 目录
    - 创建 `requirements.txt` 包含 openbb, fastapi, uvicorn, redis, python-dotenv
    - 创建 `.env.example` 模板文件
    - _Requirements: 1.1, 1.7_
  - [x] 1.2 配置 Python 虚拟环境
    - 创建 `openbb-service/README.md` 包含安装说明
    - 配置 pyproject.toml 或 setup.py
    - _Requirements: 1.1_

- [x] 2. 实现核心服务
  - [x] 2.1 创建 FastAPI 主应用
    - 创建 `openbb-service/main.py`
    - 配置 CORS、日志、错误处理
    - 实现 `/health` 和 `/docs` 端点
    - _Requirements: 1.1, 1.5, 9.1_
  - [x] 2.2 实现 Quote Normalizer
    - 创建 `openbb-service/normalizer.py`
    - 实现 LiveQuote 数据类
    - 实现 FMP、Polygon、Yahoo 数据标准化方法
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 3.6_
  - [x]* 2.3 编写报价标准化属性测试
    - **Property 6: 报价标准化**
    - 测试不同数据源格式转换为统一 LiveQuote
    - **Validates: Requirements 3.1, 3.4, 3.5**
  - [x] 2.4 实现 Provider Router
    - 创建 `openbb-service/router.py`
    - 实现数据源优先级配置
    - 实现按市场选择数据源逻辑
    - _Requirements: 2.1, 2.6_
  - [x]* 2.5 编写数据源优先级属性测试
    - **Property 5: 数据源优先级**
    - 测试按优先级选择数据源，跳过不健康数据源
    - **Validates: Requirements 2.1, 2.6**

- [x] 3. Checkpoint - 核心模块完成
  - 确保所有测试通过，如有问题请询问用户

- [x] 4. 实现健康监控
  - [x] 4.1 创建 Health Monitor
    - 创建 `openbb-service/health.py`
    - 实现 ProviderMetrics 数据类
    - 实现请求记录和指标计算
    - _Requirements: 9.2, 9.3_
  - [x]* 4.2 编写健康指标计算属性测试
    - **Property 4: 健康状态追踪**
    - 测试成功率和延迟计算，连续失败标记不健康
    - **Validates: Requirements 2.3, 9.2, 9.3**
  - [x] 4.3 实现故障转移逻辑
    - 在 Provider Router 中集成 Health Monitor
    - 实现连续失败 3 次标记不健康
    - 实现 5 分钟后自动恢复检测
    - _Requirements: 2.2, 2.3, 2.4_
  - [x]* 4.4 编写故障转移属性测试
    - **Property 2: 数据源故障转移**
    - 测试主数据源失败后自动切换
    - **Validates: Requirements 2.2, 2.3**

- [x] 5. 实现缓存层
  - [x] 5.1 创建 Cache Layer
    - 创建 `openbb-service/cache.py`
    - 实现 Redis 连接和基本操作
    - 实现不同数据类型的 TTL 配置
    - _Requirements: 4.1, 4.2, 4.3_
  - [x]* 5.2 编写缓存一致性属性测试
    - **Property 3: 缓存一致性**
    - 测试缓存命中返回相同数据，过期后重新获取
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
  - [x] 5.3 实现缓存清除功能
    - 实现按 ticker 清除缓存
    - 实现缓存命中率统计
    - _Requirements: 4.5, 4.6_

- [x] 6. Checkpoint - 服务层完成
  - 确保所有测试通过，如有问题请询问用户

- [x] 7. 实现 API 端点
  - [x] 7.1 实现实时报价端点
    - 创建 `/api/v1/equity/price/quote` 端点
    - 集成 Provider Router 和 Cache Layer
    - 返回标准化的 LiveQuote
    - _Requirements: 1.3, 3.2_
  - [x]* 7.2 编写 LiveQuote 结构完整性属性测试
    - **Property 1: LiveQuote 结构完整性**
    - 测试返回数据包含所有必需字段
    - **Validates: Requirements 3.2**
  - [x] 7.3 实现历史价格端点
    - 创建 `/api/v1/equity/price/historical` 端点
    - 支持 start_date, end_date 参数
    - 返回 OHLCV 数据
    - _Requirements: 1.4, 5.1, 5.2, 5.3_
  - [x] 7.4 实现基本面数据端点
    - 创建 `/api/v1/equity/fundamental/overview` 端点
    - 返回公司概况和估值指标
    - _Requirements: 6.1, 6.2, 6.3_
  - [x] 7.5 实现宏观经济数据端点
    - 创建 `/api/v1/economy/gdp` 端点
    - 创建 `/api/v1/economy/cpi` 端点
    - _Requirements: 7.1, 7.2_
  - [x] 7.6 实现监控指标端点
    - 创建 `/metrics` 端点
    - 返回所有数据源的健康指标
    - _Requirements: 9.4_

- [x] 8. 实现 TypeScript 客户端
  - [x] 8.1 创建 OpenBB Client
    - 创建 `client/src/services/openbbClient.ts`
    - 实现 LiveQuote 和 HistoricalBar 类型定义
    - 实现 getQuote, getQuotes, getHistorical 方法
    - _Requirements: 8.1, 8.3, 8.4_
  - [x] 8.2 实现重试和超时逻辑
    - 实现指数退避重试
    - 实现请求超时处理
    - _Requirements: 8.2_
  - [x]* 8.3 编写重试机制属性测试
    - **Property 8: 重试机制**
    - 测试失败后按配置次数重试
    - **Validates: Requirements 8.2**
  - [x] 8.4 实现健康检查方法
    - 实现 getHealth 方法
    - 实现 getMetrics 方法
    - _Requirements: 9.1, 9.4_

- [x] 9. Checkpoint - API 层完成
  - 确保所有测试通过，如有问题请询问用户

- [ ] 10. 集成到现有系统
  - [x] 10.1 更新 marketData.ts
    - 导入 openbbClient
    - 在 fetchStockData 中优先使用 OpenBB
    - 保留长桥和腾讯作为特定数据源
    - _Requirements: 8.5_
  - [x] 10.2 添加环境变量配置
    - 在 `.env` 中添加 VITE_OPENBB_API_URL
    - 在 `.env.example` 中添加示例
    - _Requirements: 1.7_
  - [x] 10.3 更新 Docker/部署配置
    - 创建 `openbb-service/Dockerfile`
    - 更新 docker-compose.yml 添加 openbb 服务
    - _Requirements: 1.1, 1.6_

- [x] 11. API 密钥安全
  - [x] 11.1 实现密钥加载和验证
    - 从环境变量加载 API 密钥
    - 启动时验证必需密钥
    - _Requirements: 10.1, 10.4_
  - [x]* 11.2 编写密钥安全属性测试
    - **Property 7: API 密钥安全**
    - 测试日志和错误响应不包含密钥
    - **Validates: Requirements 10.3**

- [x] 12. Final Checkpoint - 全部完成
  - 确保所有测试通过
  - 验证端到端流程：前端调用 → OpenBB 服务 → 数据源 → 返回数据
  - 如有问题请询问用户

## Notes

- 任务标记 `*` 为可选测试任务，可跳过以加快 MVP 开发
- OpenBB 服务需要 Python 3.9+ 环境
- Redis 用于缓存，可选（无 Redis 时降级为内存缓存）
- 长桥 API 和腾讯财经 API 保留在 marketData.ts 中，不迁移到 OpenBB 服务

## 文件结构

```
openbb-service/
├── main.py              # FastAPI 主应用
├── router.py            # Provider Router
├── normalizer.py        # Quote Normalizer
├── health.py            # Health Monitor
├── cache.py             # Cache Layer
├── requirements.txt     # Python 依赖
├── .env.example         # 环境变量模板
├── Dockerfile           # Docker 配置
└── tests/
    ├── test_normalizer.py
    ├── test_router.py
    ├── test_health.py
    └── test_cache.py

client/src/services/
└── openbbClient.ts      # TypeScript 客户端
```

