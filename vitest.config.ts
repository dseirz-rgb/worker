/**
 * 根目录 Vitest 配置
 * 
 * 支持运行两个模块的测试：
 * - npm run test:echo - 运行 Echo 模块测试
 * - npm run test:riskcontrol - 运行 RiskControl 模块测试
 * - npm run test - 运行所有测试
 * 
 * 配置说明：
 * - 使用 workspace 模式支持多模块
 * - fast-check 属性测试配置：30秒超时，100次迭代
 * 
 * Requirements: 41.1, 41.2, 41.3
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 使用 workspace 模式，引用各模块的配置
    workspace: [
      // Echo 前端模块
      "packages/echo/vitest.config.ts",
      // RiskControl 前端模块
      "packages/riskcontrol/vitest.config.ts",
      // 共享模块
      "packages/shared/vitest.config.ts",
      // RiskControl 原目录（兼容旧测试）
      "riskcontrol/vitest.config.ts",
    ],
    
    // 全局测试配置
    testTimeout: 30000, // 属性测试需要更长时间（30秒）
    
    // 覆盖率配置
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json"],
      exclude: [
        "node_modules/**",
        "dist/**",
        "**/test/**",
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/*.spec.ts",
        "**/*.spec.tsx",
      ],
    },
  },
});
