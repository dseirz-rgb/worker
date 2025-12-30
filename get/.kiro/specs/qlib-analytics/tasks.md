# Implementation Plan: Qlib Analytics

## Overview

基于微软 Qlib 框架构建量化分析服务，提供波动率预测、回撤概率估算、市场状态分类等 AI 驱动的风险分析能力。采用 Python + FastAPI + Qlib + MLflow 技术栈。

### 前置依赖

- **openbb-integration** spec 必须先完成，提供历史数据获取能力

## Tasks

- [x] 1. 项目初始化
  - [x] 1.1 创建 qlib-service 目录结构
    - 创建 `qlib-service/` 目录
    - 创建 `requirements.txt` 包含 qlib, fastapi, uvicorn, mlflow, pandas, numpy, scikit-learn
    - 创建 `pyproject.toml` 配置
    - _Requirements: 7.1_
  - [x] 1.2 配置 Qlib 环境
    - 初始化 Qlib 数据目录
    - 配置数据提供者（使用 OpenBB 作为数据源）
    - _Requirements: 8.1_
  - [x] 1.3 创建 FastAPI 应用骨架
    - 创建 `qlib_service/main.py`
    - 配置 CORS、日志、健康检查端点
    - _Requirements: 7.1_

- [x] 2. 数据库表结构创建
  - [x] 2.1 创建 qlib_predictions 表
    - 创建 Supabase 迁移文件
    - 存储预测历史记录
    - _Requirements: 9.3_
  - [x] 2.2 创建 qlib_model_registry 表
    - 存储模型版本和性能指标
    - _Requirements: 5.3_
  - [x] 2.3 创建 qlib_market_regimes 表
    - 存储市场状态历史
    - _Requirements: 3.5_

- [x] 3. Feature Store 实现
  - [x] 3.1 创建 FeatureStore 类
    - 创建 `qlib_service/features/store.py`
    - 实现特征定义（价格、波动率、技术指标）
    - _Requirements: 6.1, 6.2_
  - [x] 3.2 实现 OpenBB 数据获取
    - 通过 OpenBB API 获取历史行情
    - 实现数据缓存和增量更新
    - _Requirements: 8.1, 8.4_
  - [x] 3.3 实现特征计算
    - 实现 return_1d/5d/20d 收益率特征
    - 实现 volatility_5d/20d 波动率特征
    - 实现 RSI、MA 等技术指标特征
    - _Requirements: 6.2, 6.3_
  - [ ]* 3.4 编写特征完整性属性测试
    - **Property 5: 特征完整性**
    - **Validates: Requirements 6.1, 6.3**

- [x] 4. Checkpoint - 数据层完成
  - 确保特征计算正确，如有问题请询问用户

- [x] 5. 波动率预测模型
  - [x] 5.1 创建 VolatilityPredictor 类
    - 创建 `qlib_service/models/volatility.py`
    - 实现 GARCH 模型组件
    - 实现 LSTM 模型组件
    - _Requirements: 1.2_
  - [x] 5.2 实现预测方法
    - 实现 predict() 方法，支持 1/3/5 天预测
    - 实现置信区间计算
    - _Requirements: 1.1, 1.3_
  - [ ]* 5.3 编写波动率预测范围属性测试
    - **Property 1: 波动率预测范围**
    - **Validates: Requirements 1.1, 1.3**
  - [x] 5.4 实现模型训练
    - 实现 train() 方法
    - 实现模型保存和加载
    - _Requirements: 5.1_
  - [x] 5.5 创建波动率预测 API
    - 实现 POST /api/v1/predict/volatility 端点
    - _Requirements: 7.1, 7.4_

- [x] 6. 回撤概率估算模型
  - [x] 6.1 创建 DrawdownEstimator 类
    - 创建 `qlib_service/models/drawdown.py`
    - 实现蒙特卡洛模拟
    - _Requirements: 2.2_
  - [x] 6.2 实现估算方法
    - 实现 estimate() 方法，支持 5/10/20 天、5%/10%/15% 阈值
    - 实现条件概率计算
    - _Requirements: 2.1, 2.4_
  - [ ]* 6.3 编写回撤概率范围属性测试
    - **Property 2: 回撤概率范围**
    - **Validates: Requirements 2.1**
  - [x] 6.4 创建回撤概率 API
    - 实现 POST /api/v1/predict/drawdown 端点
    - _Requirements: 7.1_

- [x] 7. 市场状态分类模型
  - [x] 7.1 创建 MarketRegimeClassifier 类
    - 创建 `qlib_service/models/regime.py`
    - 实现隐马尔可夫模型 (HMM)
    - _Requirements: 3.1_
  - [x] 7.2 实现分类方法
    - 实现 classify() 方法，返回 bull/bear/sideways/high_volatility
    - 实现状态转换概率计算
    - _Requirements: 3.1, 3.3_
  - [ ]* 7.3 编写市场状态互斥属性测试
    - **Property 3: 市场状态互斥**
    - **Validates: Requirements 3.1, 3.3**
  - [x] 7.4 实现多市场支持
    - 支持美股、港股、A股独立分类
    - _Requirements: 3.4_
  - [x] 7.5 创建市场状态 API
    - 实现 GET /api/v1/market/regime 端点
    - _Requirements: 7.1_

- [x] 8. Checkpoint - 模型层完成
  - 确保所有模型可用，如有问题请询问用户

- [x] 9. 模型训练管理
  - [x] 9.1 创建 TrainingManager 类
    - 创建 `qlib_service/training/manager.py`
    - 集成 MLflow 追踪
    - _Requirements: 5.3_
  - [x] 9.2 实现定时训练
    - 波动率模型每周训练
    - 市场状态模型每月训练
    - _Requirements: 5.1, 5.2_
  - [x] 9.3 实现模型版本管理
    - 保存模型版本和性能指标
    - 实现自动部署逻辑
    - _Requirements: 5.3, 5.4, 5.5_
  - [ ]* 9.4 编写模型版本追踪属性测试
    - **Property 4: 模型版本追踪**
    - **Validates: Requirements 5.3, 7.4**

- [x] 10. 回测引擎
  - [x] 10.1 创建 BacktestEngine 类
    - 创建 `qlib_service/backtest/engine.py`
    - 基于 Qlib 回测框架
    - _Requirements: 4.1_
  - [x] 10.2 实现回测指标计算
    - 计算收益率、最大回撤、夏普比率、胜率
    - 考虑交易成本和滑点
    - _Requirements: 4.2, 4.4_
  - [x] 10.3 创建回测 API
    - 实现 POST /api/v1/backtest 端点
    - _Requirements: 4.1_

- [x] 11. 模型监控
  - [x] 11.1 实现预测准确率监控
    - 记录预测值和实际值
    - 计算预测误差
    - _Requirements: 9.1_
  - [x] 11.2 实现告警机制
    - 准确率下降超过 10% 触发告警
    - 数据漂移检测
    - _Requirements: 9.2, 9.5_
  - [ ]* 11.3 编写模型性能监控属性测试
    - **Property 8: 模型性能监控**
    - **Validates: Requirements 9.2**

- [x] 12. TypeScript Client SDK
  - [x] 12.1 创建 qlibClient.ts
    - 创建 `client/src/services/qlibClient.ts`
    - 实现 predictVolatility, predictDrawdown, getMarketRegime 方法
    - _Requirements: 10.1_
  - [x] 12.2 添加类型定义
    - 定义 VolatilityPrediction, DrawdownProbability, MarketRegime 接口
    - _Requirements: 10.1_

- [x] 13. API 性能优化
  - [x] 13.1 实现预测结果缓存
    - 缓存最近的预测结果
    - 设置合理的 TTL
    - _Requirements: 7.2_
  - [ ]* 13.2 编写预测延迟属性测试
    - **Property 6: 预测延迟**
    - **Validates: Requirements 7.2**

- [x] 14. 部署配置
  - [x] 14.1 创建 Dockerfile
    - 配置 Python 环境和依赖
    - 配置 Qlib 数据目录
    - _Requirements: 7.1_
  - [x] 14.2 创建 docker-compose 配置
    - 配置服务端口 6901
    - 配置环境变量
    - _Requirements: 7.1_

- [x] 15. Final Checkpoint - 全部完成
  - 确保所有测试通过
  - 验证端到端流程：数据获取 → 特征计算 → 模型预测 → API 返回
  - 如有问题请询问用户

## Notes

- 任务标记 `*` 为可选测试任务，可跳过以加快 MVP 开发
- 模型训练需要足够的历史数据（建议至少 2 年）
- 初始模型可使用简化版本，后续迭代优化
- 回测引擎 (任务 10) 可作为 V2 功能延后实现
