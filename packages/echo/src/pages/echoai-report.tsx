/**
 * EchoAI 日报页面
 * 显示日报和建议系统 - v3.2 新增
 */

import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { Tabs, Tab } from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import { DailyReport } from '@/components/echoai/DailyReport';
import { SuggestionList } from '@/components/echoai/suggestions/SuggestionList';

const EchoAIReportPage = observer(() => {
  const [activeTab, setActiveTab] = useState<'report' | 'suggestions'>('report');

  return (
    <div className="h-full flex flex-col p-4 md:p-6 max-w-4xl mx-auto">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Icon icon="mdi:file-document-outline" className="w-7 h-7 text-primary" />
          日报与建议
        </h1>
        <p className="text-sm text-foreground/60 mt-1">
          查看每日总结和个性化建议
        </p>
      </div>

      {/* Tab 切换 */}
      <Tabs
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(key as 'report' | 'suggestions')}
        variant="underlined"
        classNames={{
          tabList: 'gap-4 mb-4',
          tab: 'px-0',
        }}
      >
        <Tab
          key="report"
          title={
            <div className="flex items-center gap-2">
              <Icon icon="mdi:calendar-today" className="w-4 h-4" />
              <span>每日报告</span>
            </div>
          }
        />
        <Tab
          key="suggestions"
          title={
            <div className="flex items-center gap-2">
              <Icon icon="mdi:lightbulb-on-outline" className="w-4 h-4" />
              <span>智能建议</span>
            </div>
          }
        />
      </Tabs>

      {/* 内容区域 */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'report' ? <DailyReport /> : <SuggestionList />}
      </div>
    </div>
  );
});

export default EchoAIReportPage;
