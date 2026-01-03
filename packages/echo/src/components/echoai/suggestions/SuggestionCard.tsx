/**
 * EchoAI 建议卡片组件
 * 从 Khoj 源码移植，用于首页和空对话页面显示建议
 */

import { Card, CardBody } from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import { convertSuggestionTitleToIconClass } from './suggestionsData';

// ============================================
// 类型定义
// ============================================

interface StepOneSuggestionCardProps {
  title: string;
  body: string;
  color: string;
}

interface StepOneSuggestionRevertCardProps extends StepOneSuggestionCardProps {
  onClick: () => void;
}

interface StepTwoSuggestionCardProps {
  prompt: string;
}

// ============================================
// 组件
// ============================================

/**
 * 第一步建议卡片 - 显示建议类型和简短描述
 */
export function StepOneSuggestionCard({ title, body, color }: StepOneSuggestionCardProps) {
  return (
    <Card
      isPressable
      className="w-full h-fit cursor-pointer hover:scale-[1.02] transition-transform"
      shadow="sm"
    >
      <CardBody className="p-3 flex flex-row items-start gap-2">
        {convertSuggestionTitleToIconClass(title, color.toLowerCase())}
        <p className="text-sm text-foreground/80 line-clamp-2 break-words">
          {body}
        </p>
      </CardBody>
    </Card>
  );
}

/**
 * 第二步建议卡片 - 显示具体的提示词
 */
export function StepTwoSuggestionCard({ prompt }: StepTwoSuggestionCardProps) {
  return (
    <Card
      isPressable
      className="w-full h-fit cursor-pointer hover:scale-[1.02] transition-transform animate-fade-in"
      shadow="sm"
    >
      <CardBody className="p-3 flex flex-row items-center gap-2">
        <Icon 
          icon="mdi:magic-staff" 
          className="w-4 h-4 text-foreground/40 flex-shrink-0" 
        />
        <p className="text-sm text-foreground line-clamp-2 break-words">
          {prompt}
        </p>
      </CardBody>
    </Card>
  );
}

/**
 * 第一步建议回退卡片 - 显示已选择的建议，可点击取消
 */
export function StepOneSuggestionRevertCard({ 
  title, 
  body, 
  color, 
  onClick 
}: StepOneSuggestionRevertCardProps) {
  return (
    <Card
      isPressable
      className="w-fit h-fit cursor-pointer mx-auto my-2 animate-fade-in border-opacity-50 shadow-none"
      shadow="none"
      onPress={onClick}
    >
      <CardBody className="p-2 flex flex-row items-center justify-center gap-2">
        {convertSuggestionTitleToIconClass(title, color.toLowerCase())}
        <p className="text-sm text-foreground/80 text-center">
          {body}
        </p>
        <Icon 
          icon="mdi:close-circle" 
          className="w-5 h-5 text-foreground/50" 
        />
      </CardBody>
    </Card>
  );
}

export default StepOneSuggestionCard;
