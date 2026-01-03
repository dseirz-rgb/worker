/**
 * 投资模块 - 组件展示页面
 * 组件库展示（开发用）
 */

import { observer } from 'mobx-react-lite';
import { Link } from 'react-router-dom';
import { Card, CardBody, CardHeader, Button, Chip, Input, Progress, Switch } from '@heroui/react';
import { Icon } from '@iconify/react';
import { GradientBackground } from '@/components/Common/GradientBackground';

const ComponentShowcasePage = observer(() => {
  return (
    <GradientBackground className="h-full overflow-auto">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/investment">
            <Button isIconOnly variant="light" size="sm">
              <Icon icon="mdi:arrow-left" className="text-xl" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Icon icon="mdi:palette" className="text-primary" />
              组件展示
            </h1>
            <p className="text-foreground/60 mt-1">HeroUI 组件库展示</p>
          </div>
        </div>

        {/* Buttons */}
        <Card className="bg-content1/50 backdrop-blur-sm">
          <CardHeader><h2 className="font-semibold">Buttons</h2></CardHeader>
          <CardBody>
            <div className="flex flex-wrap gap-3">
              <Button color="primary">Primary</Button>
              <Button color="secondary">Secondary</Button>
              <Button color="success">Success</Button>
              <Button color="warning">Warning</Button>
              <Button color="danger">Danger</Button>
              <Button variant="flat">Flat</Button>
              <Button variant="bordered">Bordered</Button>
              <Button variant="light">Light</Button>
              <Button variant="ghost">Ghost</Button>
            </div>
          </CardBody>
        </Card>

        {/* Chips */}
        <Card className="bg-content1/50 backdrop-blur-sm">
          <CardHeader><h2 className="font-semibold">Chips</h2></CardHeader>
          <CardBody>
            <div className="flex flex-wrap gap-3">
              <Chip color="primary">Primary</Chip>
              <Chip color="secondary">Secondary</Chip>
              <Chip color="success">Success</Chip>
              <Chip color="warning">Warning</Chip>
              <Chip color="danger">Danger</Chip>
              <Chip variant="flat" color="primary">Flat</Chip>
              <Chip variant="bordered" color="primary">Bordered</Chip>
            </div>
          </CardBody>
        </Card>

        {/* Inputs */}
        <Card className="bg-content1/50 backdrop-blur-sm">
          <CardHeader><h2 className="font-semibold">Inputs</h2></CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label="Default" placeholder="Enter text..." />
              <Input label="With Icon" placeholder="Search..." startContent={<Icon icon="mdi:magnify" />} />
              <Input label="Disabled" placeholder="Disabled" isDisabled />
            </div>
          </CardBody>
        </Card>

        {/* Progress */}
        <Card className="bg-content1/50 backdrop-blur-sm">
          <CardHeader><h2 className="font-semibold">Progress</h2></CardHeader>
          <CardBody>
            <div className="space-y-4">
              <Progress value={30} color="primary" label="Primary" />
              <Progress value={50} color="success" label="Success" />
              <Progress value={70} color="warning" label="Warning" />
              <Progress value={90} color="danger" label="Danger" />
            </div>
          </CardBody>
        </Card>

        {/* Switch */}
        <Card className="bg-content1/50 backdrop-blur-sm">
          <CardHeader><h2 className="font-semibold">Switch</h2></CardHeader>
          <CardBody>
            <div className="flex flex-wrap gap-6">
              <Switch defaultSelected>Default</Switch>
              <Switch defaultSelected color="success">Success</Switch>
              <Switch defaultSelected color="warning">Warning</Switch>
              <Switch defaultSelected color="danger">Danger</Switch>
            </div>
          </CardBody>
        </Card>
      </div>
    </GradientBackground>
  );
});

export default ComponentShowcasePage;
