/**
 * 投资模块 - 风险引擎页面
 * 风险计算与规则配置
 */

import { observer } from 'mobx-react-lite';
import { Link } from 'react-router-dom';
import { Card, CardBody, CardHeader, Button, Switch, Input } from '@heroui/react';
import { Icon } from '@iconify/react';
import { GradientBackground } from '@/components/Common/GradientBackground';

const RiskEnginePage = observer(() => {
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
              <Icon icon="mdi:cog" className="text-primary" />
              风险引擎
            </h1>
            <p className="text-foreground/60 mt-1">风险计算与规则配置</p>
          </div>
        </div>

        {/* 熔断规则 */}
        <Card className="bg-content1/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Icon icon="mdi:shield-lock" className="text-xl text-danger" />
              <h2 className="font-semibold">熔断规则</h2>
            </div>
          </CardHeader>
          <CardBody>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-content2/50">
                <div>
                  <p className="font-medium">杠杆熔断</p>
                  <p className="text-sm text-foreground/60">杠杆率超过阈值时触发</p>
                </div>
                <Switch defaultSelected color="danger" />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-content2/50">
                <div>
                  <p className="font-medium">回撤熔断</p>
                  <p className="text-sm text-foreground/60">月度回撤超过阈值时触发</p>
                </div>
                <Switch defaultSelected color="danger" />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-content2/50">
                <div>
                  <p className="font-medium">连败熔断</p>
                  <p className="text-sm text-foreground/60">连续亏损天数超过阈值时触发</p>
                </div>
                <Switch defaultSelected color="danger" />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-content2/50">
                <div>
                  <p className="font-medium">移动止盈</p>
                  <p className="text-sm text-foreground/60">从高水位回撤超过阈值时触发</p>
                </div>
                <Switch defaultSelected color="warning" />
              </div>
            </div>
          </CardBody>
        </Card>

        {/* 风险计算参数 */}
        <Card className="bg-content1/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Icon icon="mdi:calculator" className="text-xl text-secondary" />
              <h2 className="font-semibold">计算参数</h2>
            </div>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="VaR 置信度"
                type="number"
                defaultValue="95"
                endContent={<span className="text-foreground/50">%</span>}
              />
              <Input
                label="回测周期"
                type="number"
                defaultValue="252"
                endContent={<span className="text-foreground/50">天</span>}
              />
              <Input
                label="波动率窗口"
                type="number"
                defaultValue="20"
                endContent={<span className="text-foreground/50">天</span>}
              />
              <Input
                label="相关性窗口"
                type="number"
                defaultValue="60"
                endContent={<span className="text-foreground/50">天</span>}
              />
            </div>
          </CardBody>
        </Card>

        {/* 保存按钮 */}
        <div className="flex justify-end">
          <Button color="primary" startContent={<Icon icon="mdi:content-save" />}>
            保存配置
          </Button>
        </div>
      </div>
    </GradientBackground>
  );
});

export default RiskEnginePage;
