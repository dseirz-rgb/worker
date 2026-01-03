/**
 * Janitor 页面 - AI 文件整理工具
 * 独立的文件整理操作界面
 */

import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { JanitorPanel } from '@/components/Janitor/JanitorPanel';
import { JanitorHistory } from '@/components/Janitor/JanitorHistory';
import { GradientBackground } from '@/components/Common/GradientBackground';

const JanitorPage = observer(() => {
  const { t } = useTranslation();

  return (
    <GradientBackground className="h-full overflow-auto">
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        {/* 页面标题 */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{t('janitor.title') || 'AI 文件整理'}</h1>
          <p className="text-foreground/60 mt-1">
            {t('janitor.description') || '使用 AI 自动分类和重命名文件'}
          </p>
        </div>

        {/* 双栏布局 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左侧：整理面板 */}
          <JanitorPanel />
          
          {/* 右侧：历史记录 */}
          <JanitorHistory />
        </div>
      </div>
    </GradientBackground>
  );
});

export default JanitorPage;
