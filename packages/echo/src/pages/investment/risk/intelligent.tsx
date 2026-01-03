/**
 * 投资模块 - 智能风控页面
 * AI 驱动的情绪检测与风险预警
 */

import { observer } from 'mobx-react-lite';
import { Link } from 'react-router-dom';
import { Card, CardBody, CardHeader, Button, Chip, Progress } from '@heroui/react';
import { Icon } from '@iconify/react';
import { GradientBackground } from '@/components/Common/GradientBackground';

const IntelligentRiskPage = observer(() => {
  return (
    <GradientBackground className="h-full overflow-auto">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center gap-3">
          <Link to="/investment/risk">
            <Button isIconOnly variant="light" size="sm">
              <Icon icon="mdi:arrow-left" className="text-xl" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Icon icon="mdi:brain" className="text-secondary" />
              智能风控
            </h1>
            <p className="text-foreground/60 mt-1">AI 驱动的情绪检测与风险预警</p>
          </div>
        </div>

        {/* 情绪检测 */}
        <Card className="bg-content1/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Icon icon="mdi:emoticon-outline" className="text-xl text-warning" />
              <h2 className="font-semibold">交易情绪检测</h2>
            </div>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-success/10 border border-success/30">
                <p className="text-sm text-foreground/60">贪婪指数</p>
                <p className="text-2xl font-bold text-success">32</p>
                <Progress value={32} color="success" size="sm" className="mt-2" />
              </div>
              <div className="p-4 rounded-lg bg-warning/10 border border-warning/30">
                <p className="text-sm text-foreground/60">FOMO 风险</p>
                <p className="text-2xl font-bold text-warning">中等</p>
                <Progress value={55} color="warning" size="sm" className="mt-2" />
              </div>
              <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">
                <p className="text-sm text-foreground/60">决策质量</p>
                <p className="text-2xl font-bold text-primary">良好</p>
                <Progress value={78} color="primary" size="sm" className="mt-2" />
              </div>
            </div>
          </CardBody>
        </Card>

        {/* AI 风险预警 */}
        <Card className="bg-content1/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Icon icon="mdi:alert-circle" className="text-xl text-danger" />
              <h2 className="font-semibold">AI 风险预警</h2>
            </div>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 flex items-center gap-3">
                <Icon icon="mdi:alert" className="text-xl text-warning" />
                <div className="flex-1">
                  <p className="font-medium">持仓集中度偏高</p>
                  <p className="text-sm text-foreground/60">单一标的权重超过 15%，建议分散投资</p>
                </div>
                <Chip color="warning" size="sm">中风险</Chip>
              </div>
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 flex items-center gap-3">
                <Icon icon="mdi:information" className="text-xl text-primary" />
                <div className="flex-1">
                  <p className="font-medium">市场波动率上升</p>
                  <p className="text-sm text-foreground/60">VIX 指数上涨，建议降低杠杆</p>
                </div>
                <Chip color="primary" size="sm">提示</Chip>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* 功能开发中 */}
        <Card className="bg-secondary/5 border border-secondary/20">
          <CardBody className="p-6 text-center">
            <Icon icon="mdi:robot" className="text-5xl text-secondary/50 mb-3 mx-auto" />
            <p className="text-foreground/60">更多 AI 风控功能正在开发中...</p>
          </CardBody>
        </Card>
      </div>
    </GradientBackground>
  );
});

export default IntelligentRiskPage;
