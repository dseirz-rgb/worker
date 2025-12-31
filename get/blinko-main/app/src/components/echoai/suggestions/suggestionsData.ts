/**
 * EchoAI 建议数据
 * 从 Khoj 源码移植，定义对话建议类型和内容
 */

import { getIconFromIconName } from '../common/iconUtils';
import { ChatInputFocus } from '../chatInputArea/chatInputArea';

// 建议类型枚举
export enum SuggestionType {
  Paint = 'Paint',
  Travel = 'Travel',
  Health = 'Health',
  Learning = 'Learning',
  Math = 'Mathematics',
  Language = 'Language',
  PopCulture = 'Pop Culture',
  Food = 'Food',
  Interviewing = 'Interviewing',
  Home = 'Home',
  Fun = 'Fun',
  Code = 'Code',
  Finance = 'Finance',
  Document = 'Document',
  Image = 'Image',
}

// 第一步建议接口
export interface StepOneSuggestion {
  type: SuggestionType;
  color: string;
  actionTagline: string;
  focus: ChatInputFocus;
  intent: string;
}

// 第二步建议接口
export interface StepTwoSuggestion {
  prompt: string;
}

// 建议类型到颜色的映射
const suggestionToColorMap: { [key in SuggestionType]?: string } = {
  [SuggestionType.Paint]: 'indigo',
  [SuggestionType.Travel]: 'yellow',
  [SuggestionType.Health]: 'teal',
  [SuggestionType.Learning]: 'purple',
  [SuggestionType.Language]: 'blue',
  [SuggestionType.PopCulture]: 'red',
  [SuggestionType.Food]: 'yellow',
  [SuggestionType.Interviewing]: 'orange',
  [SuggestionType.Home]: 'green',
  [SuggestionType.Fun]: 'fuchsia',
  [SuggestionType.Code]: 'teal',
  [SuggestionType.Finance]: 'green',
  [SuggestionType.Math]: 'blue',
  [SuggestionType.Image]: 'red',
  [SuggestionType.Document]: 'orange',
};

const DEFAULT_COLOR = 'orange';

/**
 * 将建议类型转换为图标
 */
export function convertSuggestionTitleToIconClass(title: string, color: string) {
  const iconMap: Record<string, string> = {
    [SuggestionType.Paint]: 'Palette',
    [SuggestionType.PopCulture]: 'Confetti',
    [SuggestionType.Travel]: 'Jeep',
    [SuggestionType.Learning]: 'Book',
    [SuggestionType.Health]: 'Asclepius',
    [SuggestionType.Fun]: 'Island',
    [SuggestionType.Home]: 'House',
    [SuggestionType.Language]: 'Translate',
    [SuggestionType.Code]: 'Code',
    [SuggestionType.Food]: 'BowlFood',
    [SuggestionType.Interviewing]: 'Lectern',
    [SuggestionType.Finance]: 'Wallet',
    [SuggestionType.Math]: 'MathOperations',
    [SuggestionType.Image]: 'Image',
    [SuggestionType.Document]: 'File',
  };

  const iconName = iconMap[title] || 'Lightbulb';
  return getIconFromIconName(iconName, color, 'w-6', 'h-6');
}

// 第一步建议列表
export const stepOneSuggestions: StepOneSuggestion[] = [
  {
    type: SuggestionType.Document,
    actionTagline: '分析文档',
    color: suggestionToColorMap[SuggestionType.Document] || DEFAULT_COLOR,
    focus: ChatInputFocus.FILE,
    intent: '阅读这份文档并解释',
  },
  {
    type: SuggestionType.Code,
    actionTagline: '编写代码',
    color: suggestionToColorMap[SuggestionType.Code] || DEFAULT_COLOR,
    focus: ChatInputFocus.MESSAGE,
    intent: '编写一个程序',
  },
  {
    type: SuggestionType.Learning,
    actionTagline: '解释概念',
    color: suggestionToColorMap[SuggestionType.Learning] || DEFAULT_COLOR,
    focus: ChatInputFocus.MESSAGE,
    intent: '我想理解一个概念',
  },
  {
    type: SuggestionType.Paint,
    actionTagline: '创建图片',
    color: suggestionToColorMap[SuggestionType.Paint] || DEFAULT_COLOR,
    focus: ChatInputFocus.MESSAGE,
    intent: '画一幅',
  },
  {
    type: SuggestionType.Language,
    actionTagline: '翻译文本',
    color: suggestionToColorMap[SuggestionType.Language] || DEFAULT_COLOR,
    focus: ChatInputFocus.MESSAGE,
    intent: '翻译这段文字',
  },
  {
    type: SuggestionType.Finance,
    actionTagline: '解释金融',
    color: suggestionToColorMap[SuggestionType.Finance] || DEFAULT_COLOR,
    focus: ChatInputFocus.MESSAGE,
    intent: '帮我建立金融思维模型',
  },
  {
    type: SuggestionType.Math,
    actionTagline: '解释数学',
    color: suggestionToColorMap[SuggestionType.Math] || DEFAULT_COLOR,
    focus: ChatInputFocus.MESSAGE,
    intent: '帮我理解背后的数学原理',
  },
  {
    type: SuggestionType.Image,
    actionTagline: '分析图片',
    color: suggestionToColorMap[SuggestionType.Image] || DEFAULT_COLOR,
    focus: ChatInputFocus.FILE,
    intent: '解释这张图片的含义',
  },
  {
    type: SuggestionType.Health,
    actionTagline: '改善健康',
    color: suggestionToColorMap[SuggestionType.Health] || DEFAULT_COLOR,
    focus: ChatInputFocus.MESSAGE,
    intent: '帮我改善健康',
  },
];

// 第二步建议映射
export const stepTwoSuggestion: { [key: string]: StepTwoSuggestion[] } = {
  [SuggestionType.Paint]: [
    { prompt: '画一幅日落的图片，但它是由彩色玻璃瓷砖组成的。' },
    { prompt: '画一幅未来城市的景观，有飞行汽车。' },
    { prompt: '画一幅霓虹灯街景，雨中有倒影。' },
    { prompt: '画一幅有独特发型的人物肖像。' },
    { prompt: '画一幅森林景观，有隐藏的瀑布。' },
  ],
  [SuggestionType.Health]: [
    { prompt: '解释如何改善我的姿势。' },
    { prompt: '告诉我饮食如何影响我的胰岛素水平。' },
    { prompt: '为忙碌的工作周推荐健康的备餐想法。' },
    { prompt: '推荐改善柔韧性的好运动。' },
    { prompt: '解释植物性饮食的好处。' },
  ],
  [SuggestionType.Learning]: [
    { prompt: '/research 查找 Alpha Fold 的工作原理并解释给我。' },
    { prompt: '解释广义相对论的关键方程。' },
    { prompt: '用简单的术语解释"机器学习"的概念。' },
    { prompt: '斯多葛主义的关键原则是什么？' },
    { prompt: '/research 过去5年AI突破的原因是什么。' },
  ],
  [SuggestionType.Language]: [
    { prompt: '将以下文本翻译成西班牙语："你好，你好吗？"' },
    { prompt: '告诉我如何用阿拉伯语问候某人。' },
    { prompt: '解释西班牙语中"ser"和"estar"的区别。' },
    { prompt: '将以下文本翻译成法语："最近的地铁站在哪里？"' },
    { prompt: '将以下文本翻译成日语："我正在学习日语。"' },
  ],
  [SuggestionType.Code]: [
    { prompt: '教我如何用 Python 编写一个简单的"Hello World"程序。' },
    { prompt: '使用原生 HTML、CSS 和 JavaScript 编写一个显示项目列表的单页应用。' },
    { prompt: '用简单的编码示例解释递归的概念。' },
    { prompt: '使用 React 创建一个简单的计算器应用。' },
    { prompt: '编写一个函数，接受一个数字数组并返回所有数字的总和。' },
  ],
  [SuggestionType.Finance]: [
    { prompt: '创建一个图表来解释复利的概念及其在长期储蓄中的重要性。' },
    { prompt: '概述不同类型的退休账户（如401(k)、IRA、Roth IRA）。' },
    { prompt: '解释分散投资的概念及其在投资中的重要性。' },
    { prompt: '为想要存钱度假的人创建一个预算计划。' },
    { prompt: '解释股票和债券的区别。' },
  ],
  [SuggestionType.Math]: [
    { prompt: '创建一系列问题，帮助学生发现基本经济学原理。' },
    { prompt: '开发一个动手实验，向中学生演示密度的概念。' },
    { prompt: '解释导数的概念及其在现实生活中的应用。' },
    { prompt: '创建一个教学计划来教学生勾股定理。' },
    { prompt: '解释微积分中极限的概念及其在数学中的重要性。' },
  ],
  [SuggestionType.Image]: [
    { prompt: '解释这张照片中发生了什么' },
    { prompt: '告诉我如何改进这个 UI 设计' },
    { prompt: '解释这幅历史画作的意义' },
    { prompt: '你能解释这个物理图表吗？' },
    { prompt: '给我解释这个表情包' },
  ],
  [SuggestionType.Document]: [
    { prompt: '总结这份文档中的关键概念。' },
    { prompt: '提供关于这份文档主题的详细解释。' },
    { prompt: '创建这份文档中信息的可视化表示。' },
    { prompt: '找出这份文档中的主要论点。' },
    { prompt: '解释这份文档与其他学科的相关性。' },
  ],
};

/**
 * 获取第二步建议
 */
export function getStepTwoSuggestions(type: string): StepTwoSuggestion[] {
  return stepTwoSuggestion[type] || [];
}
