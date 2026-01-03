/**
 * 投资模块 - 动态笔记页面
 * 投资笔记与标签管理
 */

import { observer } from 'mobx-react-lite';
import { Link } from 'react-router-dom';
import { Card, CardBody, Button, Chip } from '@heroui/react';
import { Icon } from '@iconify/react';
import { GradientBackground } from '@/components/Common/GradientBackground';

const DynamicNotesPage = observer(() => {
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
              <Icon icon="mdi:note-text" className="text-warning" />
              动态笔记
            </h1>
            <p className="text-foreground/60 mt-1">投资笔记与标签管理</p>
          </div>
        </div>

        <Card className="bg-content1/50 backdrop-blur-sm">
          <CardBody className="p-8 text-center">
            <Icon icon="mdi:notebook" className="text-6xl text-warning/50 mb-4 mx-auto" />
            <h3 className="text-xl font-semibold mb-2">动态笔记</h3>
            <p className="text-foreground/60 mb-4">
              记录您的投资思考与交易笔记
            </p>
            <Chip color="warning" variant="flat">功能开发中</Chip>
          </CardBody>
        </Card>
      </div>
    </GradientBackground>
  );
});

export default DynamicNotesPage;
