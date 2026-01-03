#!/usr/bin/env npx tsx
/**
 * 环境变量验证脚本
 * 
 * 用法:
 *   npx tsx scripts/check-env.ts          # 检查所有变量
 *   npx tsx scripts/check-env.ts --echo   # 仅检查 Echo 模块
 *   npx tsx scripts/check-env.ts --rc     # 仅检查 RiskControl 模块
 *   npx tsx scripts/check-env.ts --strict # 严格模式（可选变量也必须存在）
 * 
 * 退出码:
 *   0 - 所有必需变量都已配置
 *   1 - 缺少必需变量
 */

import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// 环境变量定义
// =============================================================================

interface EnvVar {
  name: string;
  description: string;
  required: boolean;
  module: 'shared' | 'echo' | 'riskcontrol';
  example?: string;
}

// 共享配置（两个模块都需要）
const SHARED_VARS: EnvVar[] = [
  {
    name: 'SUPABASE_URL',
    description: 'Supabase 项目 URL（统一认证源）',
    required: true,
    module: 'shared',
    example: 'https://your-project.supabase.co',
  },
  {
    name: 'SUPABASE_ANON_KEY',
    description: 'Supabase 匿名密钥',
    required: true,
    module: 'shared',
  },
  {
    name: 'SUPABASE_SERVICE_KEY',
    description: 'Supabase 服务密钥（服务端使用）',
    required: false,
    module: 'shared',
  },
  {
    name: 'GEMINI_API_KEY',
    description: 'Gemini API 密钥（AI 功能）',
    required: true,
    module: 'shared',
  },
  {
    name: 'GEMINI_MODEL',
    description: 'Gemini 模型名称',
    required: false,
    module: 'shared',
    example: 'gemini-2.5-flash-preview-05-20',
  },
  {
    name: 'LIVEKIT_URL',
    description: 'LiveKit 服务器 URL（语音功能）',
    required: true,
    module: 'shared',
    example: 'wss://your-livekit-server.livekit.cloud',
  },
  {
    name: 'LIVEKIT_API_KEY',
    description: 'LiveKit API 密钥',
    required: true,
    module: 'shared',
  },
  {
    name: 'LIVEKIT_API_SECRET',
    description: 'LiveKit API 密钥',
    required: true,
    module: 'shared',
  },
  {
    name: 'VITE_LIVEKIT_URL',
    description: 'LiveKit 前端 URL',
    required: true,
    module: 'shared',
  },
  {
    name: 'NEXTAUTH_SECRET',
    description: 'NextAuth 会话密钥',
    required: false,
    module: 'shared',
  },
];

// Echo 模块专用配置
const ECHO_VARS: EnvVar[] = [
  {
    name: 'POSTGRES_PASSWORD',
    description: 'Echo PostgreSQL 数据库密码',
    required: true,
    module: 'echo',
  },
  {
    name: 'DATABASE_URL',
    description: 'Echo 数据库连接字符串',
    required: false,
    module: 'echo',
    example: 'postgresql://postgres:password@localhost:5432/echo',
  },
  {
    name: 'GROQ_API_KEY',
    description: 'Groq API 密钥（Janitor AI 文件整理）',
    required: false,
    module: 'echo',
  },
  {
    name: 'INBOX_PATH',
    description: 'Janitor 监控的待整理文件目录',
    required: false,
    module: 'echo',
    example: './inbox',
  },
  {
    name: 'OLLAMA_HOST',
    description: 'Ollama 本地服务地址',
    required: false,
    module: 'echo',
    example: 'http://localhost:11434',
  },
  {
    name: 'ENABLE_OAUTH',
    description: '是否启用 OAuth2 第三方登录',
    required: false,
    module: 'echo',
    example: 'false',
  },
  {
    name: 'ENABLE_2FA',
    description: '是否启用二次验证',
    required: false,
    module: 'echo',
    example: 'false',
  },
];

// RiskControl 模块专用配置
const RISKCONTROL_VARS: EnvVar[] = [
  {
    name: 'VITE_SUPABASE_URL',
    description: 'RiskControl Supabase URL（独立数据库）',
    required: true,
    module: 'riskcontrol',
    example: 'https://xxx.supabase.co',
  },
  {
    name: 'VITE_SUPABASE_ANON_KEY',
    description: 'RiskControl Supabase 匿名密钥',
    required: true,
    module: 'riskcontrol',
  },
  {
    name: 'IBKR_TOKEN',
    description: 'IBKR Flex Query Token（持仓同步）',
    required: false,
    module: 'riskcontrol',
  },
  {
    name: 'IBKR_QUERY_ID',
    description: 'IBKR Flex Query ID',
    required: false,
    module: 'riskcontrol',
  },
  {
    name: 'RESEND_API_KEY',
    description: 'Resend 邮件服务 API 密钥',
    required: false,
    module: 'riskcontrol',
  },
  {
    name: 'RISK_EMAIL_TO',
    description: '风险报告接收邮箱',
    required: false,
    module: 'riskcontrol',
    example: 'your_email@example.com',
  },
  {
    name: 'VITE_CORS_PROXY_URL',
    description: 'CORS 代理 URL（Cloudflare Workers）',
    required: false,
    module: 'riskcontrol',
  },
  {
    name: 'VITE_OPENBB_API_URL',
    description: 'OpenBB 数据服务 URL',
    required: false,
    module: 'riskcontrol',
    example: 'http://localhost:6900',
  },
  {
    name: 'VITE_QLIB_API_URL',
    description: 'Qlib 分析服务 URL',
    required: false,
    module: 'riskcontrol',
    example: 'http://localhost:6901',
  },
  {
    name: 'VITE_USE_MOCK_QLIB',
    description: '是否使用 Qlib 模拟数据',
    required: false,
    module: 'riskcontrol',
    example: 'true',
  },
  {
    name: 'VITE_VOICE_SERVICE_URL',
    description: 'Voice Service URL',
    required: false,
    module: 'riskcontrol',
    example: 'http://localhost:8080',
  },
  {
    name: 'LIGHTRAG_SERVICE_URL',
    description: 'LightRAG 服务 URL',
    required: false,
    module: 'riskcontrol',
  },
  {
    name: 'LIGHTRAG_LLM_MODEL',
    description: 'LightRAG LLM 模型',
    required: false,
    module: 'riskcontrol',
    example: 'gemini-2.0-flash',
  },
  {
    name: 'LIGHTRAG_EMBEDDING_MODEL',
    description: 'LightRAG Embedding 模型',
    required: false,
    module: 'riskcontrol',
    example: 'models/text-embedding-004',
  },
  {
    name: 'QUANT_SERVICE_URL',
    description: 'Quant Service URL',
    required: false,
    module: 'riskcontrol',
  },
  {
    name: 'VITE_USE_MULTI_AGENT',
    description: '是否启用多 Agent 系统',
    required: false,
    module: 'riskcontrol',
    example: 'true',
  },
  {
    name: 'VITE_ORCHESTRATION_MODE',
    description: 'Agent 编排模式',
    required: false,
    module: 'riskcontrol',
    example: 'sequential',
  },
  {
    name: 'VITE_SERPER_API_KEY',
    description: 'Serper API 密钥（新闻搜索）',
    required: false,
    module: 'riskcontrol',
  },
  {
    name: 'VITE_JINA_API_KEY',
    description: 'Jina API 密钥（网页内容提取）',
    required: false,
    module: 'riskcontrol',
  },
  {
    name: 'VITE_SEC_API_KEY',
    description: 'SEC API 密钥（SEC 文件查询）',
    required: false,
    module: 'riskcontrol',
  },
  {
    name: 'VITE_ALERT_DRAWDOWN_THRESHOLD',
    description: '回撤警报阈值（百分比）',
    required: false,
    module: 'riskcontrol',
    example: '15',
  },
  {
    name: 'VITE_ALERT_LEVERAGE_THRESHOLD',
    description: '杠杆警报阈值（倍数）',
    required: false,
    module: 'riskcontrol',
    example: '2.5',
  },
  {
    name: 'VITE_ALERT_SENTIMENT_THRESHOLD',
    description: '负面情绪警报阈值',
    required: false,
    module: 'riskcontrol',
    example: '-0.5',
  },
  {
    name: 'VITE_EXTENDED_THINKING_ENABLED',
    description: '是否启用扩展思考模式',
    required: false,
    module: 'riskcontrol',
    example: 'true',
  },
  {
    name: 'VITE_EXTENDED_THINKING_BUDGET_TOKENS',
    description: '扩展思考 Token 预算',
    required: false,
    module: 'riskcontrol',
    example: '1024',
  },
  {
    name: 'VITE_AGENT_MEMORY_ENABLED',
    description: '是否启用 Agent 长期记忆',
    required: false,
    module: 'riskcontrol',
    example: 'true',
  },
  {
    name: 'VITE_AGENT_MEMORY_MAX_ENTRIES',
    description: '最大记忆条目数',
    required: false,
    module: 'riskcontrol',
    example: '100',
  },
];

// =============================================================================
// 工具函数
// =============================================================================

/**
 * 解析 .env 文件
 */
function parseEnvFile(filePath: string): Map<string, string> {
  const envMap = new Map<string, string>();
  
  if (!fs.existsSync(filePath)) {
    return envMap;
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    // 跳过空行和注释
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      // 移除引号
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      envMap.set(key, value);
    }
  }
  
  return envMap;
}

/**
 * 检查环境变量是否有效（非空且非占位符）
 */
function isValidValue(value: string | undefined): boolean {
  if (!value) return false;
  
  const placeholders = [
    'your_',
    'xxx',
    'your-',
    'placeholder',
    'change_me',
    'TODO',
  ];
  
  const lowerValue = value.toLowerCase();
  return !placeholders.some(p => lowerValue.includes(p));
}

/**
 * 打印彩色输出
 */
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

function printHeader(text: string): void {
  console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.cyan}${text}${colors.reset}`);
  console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);
}

function printSection(text: string): void {
  console.log(`\n${colors.blue}--- ${text} ---${colors.reset}\n`);
}

function printSuccess(text: string): void {
  console.log(`${colors.green}✓${colors.reset} ${text}`);
}

function printWarning(text: string): void {
  console.log(`${colors.yellow}⚠${colors.reset} ${text}`);
}

function printError(text: string): void {
  console.log(`${colors.red}✗${colors.reset} ${text}`);
}

function printInfo(text: string): void {
  console.log(`${colors.dim}  ${text}${colors.reset}`);
}

// =============================================================================
// 主逻辑
// =============================================================================

function main(): void {
  const args = process.argv.slice(2);
  const checkEchoOnly = args.includes('--echo');
  const checkRcOnly = args.includes('--rc');
  const strictMode = args.includes('--strict');
  const helpMode = args.includes('--help') || args.includes('-h');
  
  if (helpMode) {
    console.log(`
环境变量验证脚本

用法:
  npx tsx scripts/check-env.ts [选项]

选项:
  --echo    仅检查 Echo 模块的环境变量
  --rc      仅检查 RiskControl 模块的环境变量
  --strict  严格模式（可选变量也必须存在）
  --help    显示帮助信息

示例:
  npx tsx scripts/check-env.ts          # 检查所有变量
  npx tsx scripts/check-env.ts --echo   # 仅检查 Echo 模块
  npx tsx scripts/check-env.ts --strict # 严格模式
`);
    process.exit(0);
  }
  
  printHeader('环境变量检查');
  
  // 查找 .env 文件
  const envPath = path.resolve(process.cwd(), '.env');
  const envExamplePath = path.resolve(process.cwd(), '.env.example');
  
  if (!fs.existsSync(envPath)) {
    printError(`.env 文件不存在！`);
    printInfo(`请复制 .env.example 为 .env 并填写配置：`);
    printInfo(`  cp .env.example .env`);
    process.exit(1);
  }
  
  const envVars = parseEnvFile(envPath);
  
  // 确定要检查的变量
  let varsToCheck: EnvVar[] = [];
  
  if (checkEchoOnly) {
    varsToCheck = [...SHARED_VARS, ...ECHO_VARS];
    console.log(`检查模式: Echo 模块`);
  } else if (checkRcOnly) {
    varsToCheck = [...SHARED_VARS, ...RISKCONTROL_VARS];
    console.log(`检查模式: RiskControl 模块`);
  } else {
    varsToCheck = [...SHARED_VARS, ...ECHO_VARS, ...RISKCONTROL_VARS];
    console.log(`检查模式: 全部模块`);
  }
  
  if (strictMode) {
    console.log(`严格模式: 已启用`);
  }
  
  // 统计
  let missingRequired = 0;
  let missingOptional = 0;
  let configured = 0;
  let placeholder = 0;
  
  // 按模块分组检查
  const modules = ['shared', 'echo', 'riskcontrol'] as const;
  const moduleNames = {
    shared: '共享配置',
    echo: 'Echo 模块',
    riskcontrol: 'RiskControl 模块',
  };
  
  for (const module of modules) {
    const moduleVars = varsToCheck.filter(v => v.module === module);
    if (moduleVars.length === 0) continue;
    
    printSection(moduleNames[module]);
    
    for (const varDef of moduleVars) {
      const value = envVars.get(varDef.name);
      const hasValue = value !== undefined && value !== '';
      const isValid = isValidValue(value);
      
      if (!hasValue) {
        if (varDef.required || strictMode) {
          printError(`${varDef.name} - ${varDef.description}`);
          if (varDef.example) {
            printInfo(`示例: ${varDef.example}`);
          }
          if (varDef.required) {
            missingRequired++;
          } else {
            missingOptional++;
          }
        } else {
          printWarning(`${varDef.name} - ${varDef.description} (可选)`);
          missingOptional++;
        }
      } else if (!isValid) {
        printWarning(`${varDef.name} - 使用了占位符值`);
        printInfo(`当前值: ${value}`);
        if (varDef.required) {
          placeholder++;
        }
      } else {
        printSuccess(`${varDef.name}`);
        configured++;
      }
    }
  }
  
  // 打印总结
  printHeader('检查结果');
  
  console.log(`已配置: ${colors.green}${configured}${colors.reset}`);
  console.log(`占位符: ${colors.yellow}${placeholder}${colors.reset}`);
  console.log(`缺少必需: ${colors.red}${missingRequired}${colors.reset}`);
  console.log(`缺少可选: ${colors.dim}${missingOptional}${colors.reset}`);
  
  if (missingRequired > 0 || placeholder > 0) {
    console.log(`\n${colors.red}❌ 环境变量配置不完整${colors.reset}`);
    console.log(`\n请参考 .env.example 文件完成配置。`);
    process.exit(1);
  } else {
    console.log(`\n${colors.green}✅ 所有必需的环境变量已配置${colors.reset}`);
    process.exit(0);
  }
}

main();
