/**
 * Khoj 图标工具
 * 从 Khoj 源码移植，用于 Agent 和斜杠命令的图标显示
 * 
 * 注意：使用 Iconify 替代 Phosphor Icons
 */

import React from 'react';
import { Icon } from '@/components/Common/Iconify/icons';
import { convertColorToTextClass } from './colorUtils';

// 图标映射表 - 使用 Iconify 图标
const iconMap: Record<string, string> = {
  Lightbulb: 'mdi:lightbulb-outline',
  Robot: 'mdi:robot-outline',
  Aperture: 'mdi:aperture',
  GraduationCap: 'mdi:school-outline',
  Jeep: 'mdi:car-outline',
  Island: 'mdi:island',
  MathOperations: 'mdi:calculator-variant-outline',
  Asclepius: 'mdi:medical-bag',
  Couch: 'mdi:sofa-outline',
  Code: 'mdi:code-tags',
  Atom: 'mdi:atom',
  ClockCounterClockwise: 'mdi:history',
  Globe: 'mdi:earth',
  Palette: 'mdi:palette-outline',
  Book: 'mdi:book-outline',
  Confetti: 'mdi:party-popper',
  House: 'mdi:home-outline',
  Translate: 'mdi:translate',
  BowlFood: 'mdi:food-outline',
  Lectern: 'mdi:presentation',
  Wallet: 'mdi:wallet-outline',
  PencilLine: 'mdi:pencil-outline',
  Chalkboard: 'mdi:chalkboard',
  Cigarette: 'mdi:smoking',
  CraneTower: 'mdi:crane',
  Heart: 'mdi:heart-outline',
  Leaf: 'mdi:leaf',
  NewspaperClipping: 'mdi:newspaper-variant-outline',
  OrangeSlice: 'mdi:fruit-citrus',
  SmileyMelting: 'mdi:emoticon-outline',
  YinYang: 'mdi:yin-yang',
  SneakerMove: 'mdi:shoe-sneaker',
  Student: 'mdi:account-school-outline',
  Oven: 'mdi:stove',
  Gavel: 'mdi:gavel',
  Broadcast: 'mdi:broadcast',
  Image: 'mdi:image-outline',
  File: 'mdi:file-outline',
};

// 斜杠命令图标映射
const slashCommandIcons: Record<string, string> = {
  summarize: 'mdi:map-marker-outline',
  help: 'mdi:help-circle-outline',
  automation: 'mdi:robot-outline',
  webpage: 'mdi:web',
  notes: 'mdi:notebook-outline',
  image: 'mdi:image-outline',
  default: 'mdi:keyboard-return',
  diagram: 'mdi:shape-outline',
  general: 'mdi:chat-outline',
  online: 'mdi:earth',
  text: 'mdi:pencil-outline',
  code: 'mdi:code-tags',
  research: 'mdi:microscope',
};

// 文件类型图标映射
const fileTypeIcons: Record<string, string> = {
  org: 'mdi:file-document-outline',
  md: 'mdi:language-markdown',
  markdown: 'mdi:language-markdown',
  pdf: 'mdi:file-pdf-box',
  doc: 'mdi:file-word-outline',
  docx: 'mdi:file-word-outline',
  csv: 'mdi:file-delimited-outline',
  json: 'mdi:code-json',
  txt: 'mdi:file-document-outline',
  py: 'mdi:language-python',
  jpg: 'mdi:file-image-outline',
  jpeg: 'mdi:file-image-outline',
  png: 'mdi:file-image-outline',
  webp: 'mdi:file-image-outline',
};

/**
 * 获取斜杠命令的图标
 */
export function getIconForSlashCommand(command: string, customClassName: string | null = null) {
  const className = customClassName ?? 'h-4 w-4';
  
  for (const [key, iconName] of Object.entries(slashCommandIcons)) {
    if (command.includes(key)) {
      return <Icon icon={iconName} className={className} />;
    }
  }
  
  return <Icon icon="mdi:arrow-right" className={className} />;
}

/**
 * 根据图标名称获取图标组件
 */
export function getIconFromIconName(
  iconName: string,
  color: string = 'gray',
  width: string = 'w-6',
  height: string = 'h-6',
) {
  const iconKey = iconMap[iconName];
  if (!iconKey) return null;
  
  const colorName = color.toLowerCase();
  const colorClass = convertColorToTextClass(colorName);
  
  return (
    <Icon 
      icon={iconKey} 
      className={`${width} ${height} ${colorClass} mr-2`} 
    />
  );
}

/**
 * 根据文件名获取文件类型图标
 */
export function getIconFromFilename(
  filename: string,
  className: string = 'w-6 h-6 text-muted-foreground inline-flex mr-1',
) {
  const extension = filename.split('.').pop()?.toLowerCase();
  const iconName = extension ? fileTypeIcons[extension] : undefined;
  
  return (
    <Icon 
      icon={iconName || 'mdi:file-outline'} 
      className={className} 
    />
  );
}

/**
 * 获取所有可用的图标名称
 */
export function getAvailableIcons() {
  return Object.keys(iconMap);
}

export { iconMap, slashCommandIcons, fileTypeIcons };
