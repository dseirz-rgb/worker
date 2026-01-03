/**
 * 数据处理流程说明组件
 * 可视化展示 Echo 系统的数据处理流程
 */

import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Icon } from '@/components/Common/Iconify/icons';
import { 
  Card, 
  CardBody, 
  CardHeader,
  Divider,
  Button,
  Tooltip,
  Spinner,
} from '@heroui/react';
import { api } from '@/lib/trpc';
import { useNavigate } from 'react-router-dom';

// 服务状态类型
interface ServiceStatus {
  name: string;
  status: 'online' | 'offline' | 'checking';
  label: string;
  configPath?: string;
}

// 流程阶段类型
interface FlowStage {
  id: string;
  icon: string;
  iconColor: string;
  bgColor: string;
  title: string;
  description: string;
  serviceName?: string;
  configLink?: string;
  configLabel?: string;
}

// 组件属性
interface DataFlowGuideProps {
  onNavigate?: (tabKey: string) => void;
}

export const DataFlowGuide = observer(({ onNavigate }: DataFlowGuideProps) => {
  const navigate = useNavigate();
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: 'janitor', status: 'checking', label: 'Janitor AI' },
  ]);

  // 检查服务状态
  const checkServices = async () => {
    const newServices: ServiceStatus[] = [
      { name: 'janitor', status: 'checking', label: 'Janitor AI' },
    ];
    
    // 检查 Janitor
    try {
      const janitorResult = await api.janitor.testConnection.mutate({
        baseUrl: '',
      });
      newServices[0] = {
        ...newServices[0],
        status: janitorResult.success ? 'online' : 'offline',
      };
    } catch {
      newServices[0] = { ...newServices[0], status: 'offline' };
    }

    setServices(newServices);
  };

  useEffect(() => {
    checkServices();
    const interval = setInterval(checkServices, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 获取服务状态
  const getServiceStatus = (serviceName: string): ServiceStatus | undefined => {
    return services.find(s => s.name === serviceName);
  };

  // 流程阶段定义
  const flowStages: FlowStage[] = [
    {
      id: 'inbox',
      icon: 'solar:inbox-bold-duotone',
      iconColor: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      title: '📥 Inbox 文件夹',
      description: '用户配置的收件箱目录，存放待处理的文件',
      configLink: '#janitor-setting',
      configLabel: '配置 Inbox 路径',
    },
    {
      id: 'janitor',
      icon: 'solar:magic-stick-3-bold-duotone',
      iconColor: 'text-warning',
      bgColor: 'bg-warning/10',
      title: '🤖 Janitor AI 分类',
      description: '使用 AI 自动分析文件内容，智能分类和重命名',
      serviceName: 'janitor',
      configLink: '#janitor-setting',
      configLabel: '配置 Janitor',
    },
    {
      id: 'organized',
      icon: 'solar:folder-with-files-bold-duotone',
      iconColor: 'text-green-500',
      bgColor: 'bg-green-500/10',
      title: '📂 有序文件夹',
      description: '按分类整理后的文件目录结构',
      configLink: '#janitor-setting',
      configLabel: '查看分类规则',
    },
    {
      id: 'postgres',
      icon: 'solar:database-bold-duotone',
      iconColor: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      title: '🗄️ PostgreSQL 数据库',
      description: '使用 PostgreSQL FTS 进行全文搜索索引',
      configLink: '#paperless-setting',
      configLabel: '配置数据库',
    },
    {
      id: 'search',
      icon: 'solar:magnifer-bold-duotone',
      iconColor: 'text-cyan-500',
      bgColor: 'bg-cyan-500/10',
      title: '🔍 全文搜索',
      description: '基于 PostgreSQL pg_trgm 的快速文本检索',
      configLink: '/files',
      configLabel: '前往文件管理',
    },
  ];

  // 渲染状态指示器
  const renderStatusIndicator = (serviceName?: string) => {
    if (!serviceName) return null;
    
    const service = getServiceStatus(serviceName);
    if (!service) return null;

    if (service.status === 'checking') {
      return <Spinner size="sm" className="w-3 h-3" />;
    }

    return (
      <Tooltip content={service.status === 'online' ? '服务运行中' : '服务离线'}>
        <span className={`w-2.5 h-2.5 rounded-full ${
          service.status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'
        }`} />
      </Tooltip>
    );
  };

  // 渲染流程箭头
  const renderArrow = () => (
    <div className="flex justify-center py-2">
      <div className="flex flex-col items-center text-foreground/30">
        <Icon icon="solar:arrow-down-linear" className="w-5 h-5" />
      </div>
    </div>
  );

  // 渲染单个流程阶段
  const renderStage = (stage: FlowStage, index: number) => (
    <div key={stage.id} className="relative">
      <div className={`
        p-4 rounded-xl border border-default-200 
        hover:border-primary/50 hover:shadow-md
        transition-all duration-200
        ${stage.bgColor}
      `}>
        <div className="flex items-start gap-4">
          {/* 图标 */}
          <div className={`
            w-12 h-12 rounded-xl flex items-center justify-center
            bg-background shadow-sm
          `}>
            <Icon icon={stage.icon} className={`w-6 h-6 ${stage.iconColor}`} />
          </div>
          
          {/* 内容 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-foreground">{stage.title}</h4>
              {renderStatusIndicator(stage.serviceName)}
            </div>
            <p className="text-sm text-foreground/60 mb-2">
              {stage.description}
            </p>
            {stage.configLink && (
              <Button
                size="sm"
                variant="flat"
                className="h-7 text-xs"
                startContent={<Icon icon="solar:settings-linear" className="w-3 h-3" />}
                onPress={() => {
                  if (stage.configLink?.startsWith('#')) {
                    // 使用 onNavigate 回调切换到对应的设置 tab
                    const tabKey = stage.configLink.replace('#', '').replace('-setting', '');
                    if (onNavigate) {
                      onNavigate(tabKey);
                    }
                  } else if (stage.configLink?.startsWith('/')) {
                    // 跳转到对应页面
                    navigate(stage.configLink);
                  }
                }}
              >
                {stage.configLabel}
              </Button>
            )}
          </div>

          {/* 步骤编号 */}
          <div className="w-6 h-6 rounded-full bg-default-100 flex items-center justify-center text-xs font-medium text-foreground/50">
            {index + 1}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <Card className="p-2">
      <CardHeader className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
          <Icon icon="solar:routing-2-bold-duotone" className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold">数据处理流程</h3>
          <p className="text-sm text-foreground/60">
            了解 Echo 系统如何处理和索引您的文件
          </p>
        </div>
        <Button
          size="sm"
          variant="flat"
          isIconOnly
          onPress={() => {
            setServices(services.map(s => ({ ...s, status: 'checking' as const })));
            checkServices();
          }}
        >
          <Icon icon="solar:refresh-linear" className="w-4 h-4" />
        </Button>
      </CardHeader>
      
      <Divider />
      
      <CardBody className="space-y-2">
        {/* 服务状态概览 */}
        <div className="flex items-center gap-4 p-3 rounded-lg bg-default-50 mb-4">
          <span className="text-sm font-medium text-foreground/70">服务状态:</span>
          {services.map(service => (
            <div key={service.name} className="flex items-center gap-2">
              {service.status === 'checking' ? (
                <Spinner size="sm" className="w-3 h-3" />
              ) : (
                <span className={`w-2 h-2 rounded-full ${
                  service.status === 'online' ? 'bg-green-500' : 'bg-red-500'
                }`} />
              )}
              <span className="text-sm text-foreground/60">{service.label}</span>
            </div>
          ))}
        </div>

        {/* 流程图 */}
        <div className="space-y-1">
          {flowStages.map((stage, index) => (
            <React.Fragment key={stage.id}>
              {renderStage(stage, index)}
              {index < flowStages.length - 1 && renderArrow()}
            </React.Fragment>
          ))}
        </div>

        {/* 说明信息 */}
        <div className="mt-6 p-4 rounded-lg bg-gradient-to-r from-blue-500/5 to-purple-500/5 border border-default-200">
          <h4 className="font-medium flex items-center gap-2 mb-3">
            <Icon icon="solar:lightbulb-bolt-linear" className="w-4 h-4 text-warning" />
            工作原理
          </h4>
          <div className="text-sm text-foreground/70 space-y-2">
            <p>
              <strong className="text-foreground">1. 文件收集：</strong>
              将文件放入 Inbox 文件夹，系统会自动检测新文件
            </p>
            <p>
              <strong className="text-foreground">2. AI 分类：</strong>
              Janitor 使用 AI 分析文件内容，自动分类到合适的目录并重命名
            </p>
            <p>
              <strong className="text-foreground">3. 内容索引：</strong>
              PostgreSQL 提取文件内容，建立全文搜索索引
            </p>
            <p>
              <strong className="text-foreground">4. 快速搜索：</strong>
              基于 pg_trgm 的全文搜索，快速找到相关文件
            </p>
          </div>
        </div>

        {/* 快速操作 */}
        <div className="flex flex-wrap gap-2 pt-4">
          <Button
            size="sm"
            variant="flat"
            color="warning"
            startContent={<Icon icon="solar:magic-stick-3-linear" className="w-4 h-4" />}
            onPress={() => navigate('/files')}
          >
            开始整理文件
          </Button>
          <Button
            size="sm"
            variant="flat"
            startContent={<Icon icon="solar:magnifer-linear" className="w-4 h-4" />}
            onPress={() => navigate('/files')}
          >
            搜索文件
          </Button>
          <Button
            size="sm"
            variant="light"
            startContent={<Icon icon="solar:document-text-linear" className="w-4 h-4" />}
            onPress={() => window.open('https://github.com/user/echo-docs', '_blank')}
          >
            查看文档
          </Button>
        </div>
      </CardBody>
    </Card>
  );
});
