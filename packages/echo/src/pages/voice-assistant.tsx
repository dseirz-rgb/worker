/**
 * 语音助手独立页面
 * 提供完整的实时语音对话体验
 */
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { VoiceAssistant } from '@/components/VoiceAssistant';
import { Icon } from '@/components/Common/Iconify/icons';
import { Button } from '@heroui/react';
import { useNavigate } from 'react-router-dom';

const VoiceAssistantPage = observer(() => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-full w-full bg-background">
      {/* 页面头部 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-divider">
        <div className="flex items-center gap-3">
          <Button
            isIconOnly
            variant="light"
            onPress={() => navigate(-1)}
            className="text-foreground/70 hover:text-foreground"
          >
            <Icon icon="mdi:arrow-left" width="24" height="24" />
          </Button>
          <div className="flex items-center gap-2">
            <Icon icon="mdi:microphone" width="24" height="24" className="text-primary" />
            <h1 className="text-xl font-semibold">{t('voice-assistant')}</h1>
          </div>
        </div>
        
        {/* 可选：添加设置按钮 */}
        <Button
          isIconOnly
          variant="light"
          className="text-foreground/70 hover:text-foreground"
        >
          <Icon icon="mdi:cog" width="20" height="20" />
        </Button>
      </div>

      {/* 语音助手主体 */}
      <div className="flex-1 flex items-center justify-center p-6">
        <VoiceAssistant />
      </div>
    </div>
  );
});

export default VoiceAssistantPage;
