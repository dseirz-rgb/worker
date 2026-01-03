/**
 * 投资模块 - 语音通话页面
 * 语音助手界面
 */

import { observer } from 'mobx-react-lite';
import { Link } from 'react-router-dom';
import { Card, CardBody, Button, Chip } from '@heroui/react';
import { Icon } from '@iconify/react';
import { GradientBackground } from '@/components/Common/GradientBackground';

const VoiceCallPage = observer(() => {
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
              <Icon icon="mdi:microphone" className="text-success" />
              语音通话
            </h1>
            <p className="text-foreground/60 mt-1">AI 语音助手</p>
          </div>
        </div>

        <Card className="bg-content1/50 backdrop-blur-sm">
          <CardBody className="p-8 text-center">
            <div className="w-24 h-24 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
              <Icon icon="mdi:phone" className="text-5xl text-success" />
            </div>
            <h3 className="text-xl font-semibold mb-2">语音助手</h3>
            <p className="text-foreground/60 mb-4">
              通过语音与 AI 投资顾问交流
            </p>
            <Button color="success" size="lg" startContent={<Icon icon="mdi:phone" />}>
              开始通话
            </Button>
            <p className="text-xs text-foreground/50 mt-4">
              需要麦克风权限
            </p>
          </CardBody>
        </Card>
      </div>
    </GradientBackground>
  );
});

export default VoiceCallPage;
