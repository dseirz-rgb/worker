/**
 * 投资模块 - 风险设置页面
 * 阈值配置与通知设置
 */

import { observer } from 'mobx-react-lite';
import { Link } from 'react-router-dom';
import { Card, CardBody, CardHeader, Button, Input, Switch, Divider } from '@heroui/react';
import { Icon } from '@iconify/react';
import { GradientBackground } from '@/components/Common/GradientBackground';

const RiskSettingsPage = observer(() => {
  return (
    <GradientBackground className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center gap-3">
          <Link to="/investment/risk">
            <Button isIconOnly variant="light" size="sm">
              <Icon icon="mdi:arrow-left" className="text-xl" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Icon icon="mdi:tune" className="text-primary" />
              风险设置
            </h1>
            <p className="text-foreground/60 mt-1">阈值配置与通知设置</p>
          </div>
        </div>

        {/* 杠杆阈值 */}
        <Card className="bg-content1/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Icon icon="mdi:scale-balance" className="text-xl text-primary" />
              <h2 className="font-semibold">杠杆阈值</h2>
            </div>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="警告阈值"
                type="number"
                defaultValue="1.5"
                step="0.1"
                endContent={<span className="text-foreground/50">x</span>}
              />
              <Input
                label="危险阈值"
                type="number"
                defaultValue="2.0"
                step="0.1"
                endContent={<span className="text-foreground/50">x</span>}
              />
              <Input
                label="回撤期阈值"
                type="number"
                defaultValue="1.2"
                step="0.1"
                endContent={<span className="text-foreground/50">x</span>}
              />
            </div>
          </CardBody>
        </Card>

        {/* 回撤阈值 */}
        <Card className="bg-content1/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Icon icon="mdi:trending-down" className="text-xl text-warning" />
              <h2 className="font-semibold">回撤阈值</h2>
            </div>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="月度回撤警告"
                type="number"
                defaultValue="10"
                endContent={<span className="text-foreground/50">%</span>}
              />
              <Input
                label="月度回撤危险"
                type="number"
                defaultValue="15"
                endContent={<span className="text-foreground/50">%</span>}
              />
              <Input
                label="移动止盈"
                type="number"
                defaultValue="5"
                endContent={<span className="text-foreground/50">%</span>}
              />
            </div>
          </CardBody>
        </Card>

        {/* 连败阈值 */}
        <Card className="bg-content1/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Icon icon="mdi:calendar-alert" className="text-xl text-danger" />
              <h2 className="font-semibold">连败阈值</h2>
            </div>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="连败警告"
                type="number"
                defaultValue="3"
                endContent={<span className="text-foreground/50">天</span>}
              />
              <Input
                label="连败危险"
                type="number"
                defaultValue="5"
                endContent={<span className="text-foreground/50">天</span>}
              />
            </div>
          </CardBody>
        </Card>

        {/* 通知设置 */}
        <Card className="bg-content1/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Icon icon="mdi:bell" className="text-xl text-secondary" />
              <h2 className="font-semibold">通知设置</h2>
            </div>
          </CardHeader>
          <CardBody>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">邮件通知</p>
                  <p className="text-sm text-foreground/60">风险警报时发送邮件</p>
                </div>
                <Switch defaultSelected />
              </div>
              <Divider />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">推送通知</p>
                  <p className="text-sm text-foreground/60">移动端推送通知</p>
                </div>
                <Switch defaultSelected />
              </div>
              <Divider />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">声音提醒</p>
                  <p className="text-sm text-foreground/60">危险警报时播放声音</p>
                </div>
                <Switch />
              </div>
            </div>
          </CardBody>
        </Card>

        {/* 保存按钮 */}
        <div className="flex justify-end gap-3">
          <Button variant="flat">重置默认</Button>
          <Button color="primary" startContent={<Icon icon="mdi:content-save" />}>
            保存设置
          </Button>
        </div>
      </div>
    </GradientBackground>
  );
});

export default RiskSettingsPage;
