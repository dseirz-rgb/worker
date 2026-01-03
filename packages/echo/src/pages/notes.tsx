import { observer } from 'mobx-react-lite';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Tabs, Tab } from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import { BlinkoEditor } from '@/components/BlinkoEditor';
import { BlinkoCard } from '@/components/BlinkoCard';
import { ScrollArea } from '@/components/Common/ScrollArea';
import { RootStore } from '@/store';
import { BlinkoStore } from '@/store/blinkoStore';
import { useEffect } from 'react';

// 笔记页面 - 整合闪念、笔记、待办三种视图
const NotesPage = observer(() => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const blinkoStore = RootStore.Get(BlinkoStore);
  
  // 获取当前 tab，默认为 blinko（闪念）
  const currentTab = searchParams.get('tab') || 'blinko';

  // Tab 配置
  const tabs = [
    { key: 'blinko', label: t('blinko'), icon: 'basil:lightning-outline' },
    { key: 'notes', label: t('notes'), icon: 'hugeicons:note' },
    { key: 'todo', label: t('todo'), icon: 'solar:bill-check-linear' },
  ];

  // 切换 tab
  const handleTabChange = (key: string) => {
    setSearchParams({ tab: key });
  };

  // 根据 tab 设置 store 的 path
  useEffect(() => {
    if (currentTab === 'blinko') {
      blinkoStore.noteListFilterConfig.type = 0; // 闪念
    } else if (currentTab === 'notes') {
      blinkoStore.noteListFilterConfig.type = 1; // 笔记
    } else if (currentTab === 'todo') {
      blinkoStore.noteListFilterConfig.type = 2; // 待办
    }
    blinkoStore.noteList.resetAndCall({});
  }, [currentTab]);

  return (
    <div className="flex flex-col h-full w-full">
      {/* Tab 切换 */}
      <div className="flex-shrink-0 px-4 pt-4 pb-2 border-b border-divider">
        <Tabs 
          selectedKey={currentTab}
          onSelectionChange={(key) => handleTabChange(key as string)}
          variant="underlined"
          classNames={{
            tabList: "gap-6",
            cursor: "bg-primary",
            tab: "px-0 h-10",
            tabContent: "group-data-[selected=true]:text-primary"
          }}
        >
          {tabs.map((tab) => (
            <Tab
              key={tab.key}
              title={
                <div className="flex items-center gap-2">
                  <Icon icon={tab.icon} width="18" height="18" />
                  <span>{tab.label}</span>
                </div>
              }
            />
          ))}
        </Tabs>
      </div>

      {/* 编辑器 */}
      <div className="flex-shrink-0 px-4 py-4">
        <BlinkoEditor 
          key={currentTab}
          mode="create"
        />
      </div>

      {/* 笔记列表 */}
      <ScrollArea className="flex-1 px-4">
        <div className="space-y-4 pb-20">
          {blinkoStore.noteList.value?.map((note) => (
            <BlinkoCard key={note.id} blinkoItem={note} />
          ))}
          
          {blinkoStore.noteList.value?.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-foreground/50">
              <Icon icon="mdi:note-outline" width="48" height="48" className="mb-4 opacity-50" />
              <p>{t('no-data-here-well-then-time-to-write-a-note')}</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
});

export default NotesPage;
