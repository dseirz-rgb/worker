import { observer } from 'mobx-react-lite';
import { Textarea } from '@heroui/react';
import { CollapsibleCard } from '../../Common/CollapsibleCard';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { RootStore } from '@/store';
import { BlinkoStore } from '@/store/blinkoStore';
import { PromiseCall } from '@/store/standard/PromiseState';
import { api } from '@/lib/trpc';

export const GlobalPromptSection = observer(() => {
  const { t } = useTranslation();
  const blinko = RootStore.Get(BlinkoStore);
  const [globalPrompt, setGlobalPrompt] = useState('');

  useEffect(() => {
    blinko.config.call();
  }, []);

  useEffect(() => {
    setGlobalPrompt(blinko.config.value?.globalPrompt || '');
  }, [blinko.config.value?.globalPrompt]);

  const handlePromptChange = (value: string) => {
    setGlobalPrompt(value);
  };

  const handlePromptBlur = () => {
    PromiseCall(
      api.config.update.mutate({
        key: 'globalPrompt',
        value: globalPrompt,
      }),
      { autoAlert: false }
    );
  };

  return (
    <CollapsibleCard icon="hugeicons:message-01" title={t('global-prompt-configuration')}>
      <div className="space-y-4">
        <div className="flex flex-col gap-2">
          <div className="font-medium">{t('global-prompt')}</div>
        </div>

        <Textarea
          radius="lg"
          minRows={4}
          maxRows={8}
          value={globalPrompt}
          onChange={(e) => handlePromptChange(e.target.value)}
          onBlur={handlePromptBlur}
          placeholder={t('global-prompt-placeholder', `你是一个多功能的 AI 助手，可以：
1. 回答问题和解释概念
2. 提供建议和分析
3. 帮助规划和整理想法

始终使用用户的语言回复。
保持友好和专业的对话风格。`)}
          className="w-full"
        />
      </div>
    </CollapsibleCard>
  );
});