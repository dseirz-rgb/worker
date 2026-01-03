/**
 * EchoAI 引用面板组件
 * 从 Khoj 源码移植，适配 HeroUI 组件库
 * 
 * 显示对话消息的引用来源：笔记、网页、代码
 */

import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  CardBody,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ScrollShadow,
} from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import markdownIt from 'markdown-it';
import DOMPurify from 'dompurify';
import { getIconFromFilename } from '../common/iconUtils';
import type { Context, OnlineContext, CodeContext } from '../chatMessage';

// ============================================
// Markdown 配置
// ============================================

const md = new markdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

// ============================================
// 类型定义
// ============================================

export interface NotesReferenceData {
  title: string;
  content: string;
}

export interface OnlineReferenceData {
  title: string;
  description: string;
  link: string;
}

export interface CodeReferenceData {
  code: string;
  output: string;
  outputFiles: Array<{
    filename: string;
    b64_data: string;
  }>;
  error: string;
}

export interface ReferencePanelProps {
  notesReferenceCardData: NotesReferenceData[];
  onlineReferenceCardData: OnlineReferenceData[];
  codeReferenceCardData: CodeReferenceData[];
  isMobileWidth: boolean;
}

// ============================================
// 工具函数
// ============================================

/**
 * 从上下文数据构建引用数据
 */
export function constructAllReferences(
  contextData: Context[] | undefined,
  onlineData: OnlineContext | undefined,
  codeContext: CodeContext | undefined,
) {
  const onlineReferences: OnlineReferenceData[] = [];
  const contextReferences: NotesReferenceData[] = [];
  const codeReferences: CodeReferenceData[] = [];

  // 处理代码上下文
  if (codeContext) {
    for (const [_key, value] of Object.entries(codeContext)) {
      if (!value.results) continue;
      codeReferences.push({
        code: value.code,
        output: value.results.std_out || '',
        outputFiles: value.results.output_files || [],
        error: value.results.std_err || '',
      });
    }
  }

  // 处理在线上下文
  if (onlineData) {
    for (const [_key, value] of Object.entries(onlineData)) {
      // 答案框
      if (value.answerBox) {
        onlineReferences.push({
          title: value.answerBox.title,
          description: value.answerBox.answer,
          link: value.answerBox.source,
        });
      }
      
      // 知识图谱
      if (value.knowledgeGraph) {
        onlineReferences.push({
          title: value.knowledgeGraph.title,
          description: value.knowledgeGraph.description,
          link: value.knowledgeGraph.descriptionLink,
        });
      }

      // 网页结果
      if (value.webpages) {
        if (Array.isArray(value.webpages)) {
          value.webpages.forEach((webPage) => {
            onlineReferences.push({
              title: webPage.query || webPage.title || '',
              description: webPage.snippet,
              link: webPage.link,
            });
          });
        }
      }

      // 有机搜索结果
      if (value.organic) {
        value.organic.forEach((organicContext) => {
          onlineReferences.push({
            title: organicContext.title,
            description: organicContext.snippet,
            link: organicContext.link,
          });
        });
      }
    }
  }

  // 处理笔记上下文
  if (contextData) {
    contextData.forEach((context) => {
      if (!context.compiled && context.compiled !== '') {
        const raw = context as unknown;
        const fileContent = typeof raw === 'string' ? raw : raw == null ? '' : String(raw);
        const lines = fileContent.split('\n');
        const title = lines[0] && lines[0].trim() ? lines[0] : '(无标题)';
        const content = lines.slice(1).join('\n');
        contextReferences.push({ title, content });
      } else {
        contextReferences.push({
          title: context.file,
          content: context.compiled,
        });
      }
    });
  }

  return {
    notesReferenceCardData: contextReferences,
    onlineReferenceCardData: onlineReferences,
    codeReferenceCardData: codeReferences,
  };
}

// ============================================
// 子组件
// ============================================

/**
 * 简单图标组件
 */
function SimpleIcon({ type, link }: { type: string; link?: string }) {
  let iconName = 'mdi:file-document-outline';
  let favicon = '';

  if (type === 'code') {
    iconName = 'mdi:code-tags';
  } else if (type === 'online' && link) {
    try {
      const domain = new URL(link).hostname;
      favicon = `https://www.google.com/s2/favicons?domain=${domain}`;
    } catch {
      iconName = 'mdi:web';
    }
  } else if (type === 'notes') {
    iconName = 'mdi:note-outline';
  }

  if (favicon) {
    return <img src={favicon} alt="" className="w-4 h-4 rounded" />;
  }

  return <Icon icon={iconName} className="w-4 h-4 text-default-400" />;
}

/**
 * 笔记引用卡片
 */
function NotesReferenceCard({ 
  title, 
  content, 
  showFullContent 
}: NotesReferenceData & { showFullContent: boolean }) {
  const [isHovering, setIsHovering] = useState(false);
  
  // 提取文件扩展名
  const extension = title.split('.').pop()?.toLowerCase() || '';
  const hierarchicalExtensions = ['org', 'md', 'markdown'];
  
  // 清理内容
  const cleanContent = hierarchicalExtensions.includes(extension)
    ? content.split('\n').slice(1).join('\n')
    : content;
  
  const snippet = showFullContent
    ? DOMPurify.sanitize(md.render(cleanContent))
    : DOMPurify.sanitize(cleanContent);
  
  const fileName = title.split('/').pop() || title;
  const fileIcon = getIconFromFilename(title, 'w-4 h-4 text-default-400 flex-shrink-0');

  if (!showFullContent) {
    return (
      <Popover 
        isOpen={isHovering} 
        onOpenChange={setIsHovering}
        placement="top"
      >
        <PopoverTrigger>
          <div
            className="cursor-pointer"
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
          >
            <SimpleIcon type="notes" />
          </div>
        </PopoverTrigger>
        <PopoverContent className="max-w-[400px]">
          <Card className="border-none shadow-none">
            <CardBody className="p-3">
              <div className="flex items-center gap-2 mb-2">
                {fileIcon}
                <span className="text-sm text-default-500 truncate">{title}</span>
              </div>
              <p 
                className="text-sm line-clamp-5"
                dangerouslySetInnerHTML={{ __html: snippet }}
              />
            </CardBody>
          </Card>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Card className="bg-default-100 border-none">
      <CardBody className="p-3">
        <div className="flex items-center gap-2 mb-2">
          {fileIcon}
          <span className="text-sm text-default-500">{showFullContent ? title : fileName}</span>
        </div>
        <div 
          className="text-sm prose prose-sm dark:prose-invert max-w-none overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: snippet }}
        />
      </CardBody>
    </Card>
  );
}

/**
 * 在线引用卡片
 */
function OnlineReferenceCard({ 
  title, 
  description, 
  link, 
  showFullContent 
}: OnlineReferenceData & { showFullContent: boolean }) {
  const [isHovering, setIsHovering] = useState(false);

  if (!link || link.split(' ').length > 1) return null;

  let favicon = 'https://www.google.com/s2/favicons?domain=globe';
  let domain = 'unknown';
  
  try {
    domain = new URL(link).hostname;
    favicon = `https://www.google.com/s2/favicons?domain=${domain}`;
  } catch {
    return null;
  }

  if (!showFullContent) {
    return (
      <Popover 
        isOpen={isHovering} 
        onOpenChange={setIsHovering}
        placement="top"
      >
        <PopoverTrigger>
          <div
            className="cursor-pointer"
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
          >
            <SimpleIcon type="online" link={link} />
          </div>
        </PopoverTrigger>
        <PopoverContent className="max-w-[400px]">
          <Card className="border-none shadow-none">
            <CardBody className="p-3">
              <a href={link} target="_blank" rel="noreferrer" className="no-underline">
                <div className="flex items-center gap-2 mb-2">
                  <img src={favicon} alt="" className="w-4 h-4" />
                  <span className="text-xs text-default-400">{domain}</span>
                </div>
                <h4 className="text-sm font-medium line-clamp-2 mb-1">{title}</h4>
                <p className="text-sm text-default-500 line-clamp-5">{description}</p>
              </a>
            </CardBody>
          </Card>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Card className="bg-default-100 border-none">
      <CardBody className="p-3">
        <a href={link} target="_blank" rel="noreferrer" className="no-underline block">
          <div className="flex items-center gap-2 mb-2">
            <img src={favicon} alt="" className="w-4 h-4" />
            <span className="text-xs text-default-400">{domain}</span>
          </div>
          <h4 className="text-sm font-medium mb-1">{title}</h4>
          <p className="text-sm text-default-500">{description}</p>
        </a>
      </CardBody>
    </Card>
  );
}

/**
 * 代码引用卡片
 */
function CodeReferenceCard({ 
  code, 
  output, 
  outputFiles, 
  error, 
  showFullContent 
}: CodeReferenceData & { showFullContent: boolean }) {
  const [isHovering, setIsHovering] = useState(false);
  const [downloadHover, setDownloadHover] = useState<string | null>(null);

  const sanitizedCode = DOMPurify.sanitize(code);
  const fileIcon = getIconFromFilename('.py', 'w-4 h-4 text-default-400 flex-shrink-0');

  // 下载文件
  const handleDownload = (file: { filename: string; b64_data: string }) => {
    let mimeType = 'text/plain';
    let byteString = file.b64_data;
    
    if (file.filename.match(/\.(png|jpg|jpeg|webp)$/)) {
      mimeType = `image/${file.filename.split('.').pop()}`;
      byteString = atob(file.b64_data);
    } else if (file.filename.endsWith('.json')) {
      mimeType = 'application/json';
    } else if (file.filename.endsWith('.csv')) {
      mimeType = 'text/csv';
    }

    const arrayBuffer = new ArrayBuffer(byteString.length);
    const bytes = new Uint8Array(arrayBuffer);
    for (let i = 0; i < byteString.length; i++) {
      bytes[i] = byteString.charCodeAt(i);
    }

    const blob = new Blob([arrayBuffer], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 渲染输出文件
  const renderOutputFiles = (files: typeof outputFiles, isPopover: boolean) => {
    if (!files?.length) return null;
    
    return (
      <div className={isPopover || showFullContent ? 'border-t border-default-200 mt-2 pt-2' : ''}>
        {files.slice(0, showFullContent ? undefined : 1).map((file, index) => (
          <div key={`${file.filename}-${index}`}>
            <div className="flex items-center gap-2">
              <span className={`text-sm text-default-500 font-medium ${showFullContent ? '' : 'truncate'}`}>
                {file.filename}
              </span>
              {!isPopover && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    handleDownload(file);
                  }}
                  onMouseEnter={() => setDownloadHover(file.filename)}
                  onMouseLeave={() => setDownloadHover(null)}
                  title={`下载: ${file.filename}`}
                  className="p-1 hover:bg-default-200 rounded"
                >
                  <Icon 
                    icon={downloadHover === file.filename ? 'mdi:download' : 'mdi:download-outline'} 
                    className="w-4 h-4"
                  />
                </button>
              )}
            </div>
            {file.filename.match(/\.(txt|org|md|csv|json)$/) ? (
              <pre className={`text-xs mt-1 p-2 bg-default-50 rounded overflow-x-auto ${showFullContent ? '' : 'line-clamp-2'}`}>
                {file.b64_data}
              </pre>
            ) : file.filename.match(/\.(png|jpg|jpeg|webp)$/) ? (
              <img
                src={`data:image/${file.filename.split('.').pop()};base64,${file.b64_data}`}
                alt={file.filename}
                className="mt-1 max-h-32 rounded"
              />
            ) : null}
          </div>
        ))}
      </div>
    );
  };

  if (!showFullContent) {
    return (
      <Popover 
        isOpen={isHovering} 
        onOpenChange={setIsHovering}
        placement="top"
      >
        <PopoverTrigger>
          <div
            className="cursor-pointer"
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
          >
            <SimpleIcon type="code" />
          </div>
        </PopoverTrigger>
        <PopoverContent className="max-w-[400px]">
          <Card className="border-none shadow-none">
            <CardBody className="p-3">
              <div className="flex items-center gap-2 mb-2">
                {fileIcon}
                <span className="text-sm text-default-500">
                  代码 {outputFiles?.length > 0 ? '产物' : ''}
                </span>
              </div>
              {outputFiles?.length > 0 ? (
                renderOutputFiles(outputFiles.slice(0, 1), true)
              ) : (
                <pre className="text-xs overflow-hidden line-clamp-10">{sanitizedCode}</pre>
              )}
            </CardBody>
          </Card>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Card className="bg-default-100 border-none">
      <CardBody className="p-3">
        <div className="flex items-center gap-2 mb-2">
          {fileIcon}
          <span className="text-sm text-default-500">
            代码 {outputFiles?.length > 0 ? '产物' : ''}
          </span>
        </div>
        <pre className="text-xs pb-2 overflow-x-auto">{sanitizedCode}</pre>
        {outputFiles?.length > 0 && renderOutputFiles(outputFiles, false)}
        {error && (
          <div className="mt-2 p-2 bg-danger-50 rounded text-danger text-xs">
            {error}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ============================================
// 主组件
// ============================================

/**
 * 引用面板预览区域
 */
export function TeaserReferencesSection(props: ReferencePanelProps) {
  const numReferences =
    props.notesReferenceCardData.length +
    props.codeReferenceCardData.length +
    props.onlineReferenceCardData.length;

  if (numReferences === 0) return null;

  return (
    <div className="pt-0 px-4 pb-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-default-400">{numReferences} 个来源</span>
        <div className="flex items-center gap-1">
          <ReferencePanel {...props} />
        </div>
      </div>
    </div>
  );
}

/**
 * 引用面板主组件
 */
export default function ReferencePanel(props: ReferencePanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [numTeaserSlots, setNumTeaserSlots] = useState(3);

  useEffect(() => {
    setNumTeaserSlots(props.isMobileWidth ? 3 : 5);
  }, [props.isMobileWidth]);

  if (!props.notesReferenceCardData && !props.onlineReferenceCardData && !props.codeReferenceCardData) {
    return null;
  }

  // 计算预览显示的数据
  const codeDataToShow = props.codeReferenceCardData.slice(0, numTeaserSlots);
  const notesDataToShow = props.notesReferenceCardData.slice(
    0,
    numTeaserSlots - codeDataToShow.length,
  );
  const onlineDataToShow =
    notesDataToShow.length + codeDataToShow.length < numTeaserSlots
      ? props.onlineReferenceCardData
          .filter((online) => online.link)
          .slice(0, numTeaserSlots - codeDataToShow.length - notesDataToShow.length)
      : [];

  return (
    <>
      {/* 预览图标触发器 */}
      <Button
        variant="light"
        size="sm"
        className="gap-1 px-2 min-w-0"
        onPress={() => setIsOpen(true)}
      >
        <div className="flex items-center gap-1">
          {codeDataToShow.map((code, index) => (
            <CodeReferenceCard
              key={`code-${index}`}
              showFullContent={false}
              {...code}
            />
          ))}
          {notesDataToShow.map((note, index) => (
            <NotesReferenceCard
              key={`note-${note.title}-${index}`}
              showFullContent={false}
              {...note}
            />
          ))}
          {onlineDataToShow.map((online, index) => (
            <OnlineReferenceCard
              key={`online-${online.title}-${index}`}
              showFullContent={false}
              {...online}
            />
          ))}
          <Icon icon="mdi:arrow-right" className="w-4 h-4 text-default-400" />
        </div>
      </Button>

      {/* 引用详情 Modal */}
      <Modal 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)}
        size="2xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <span>引用来源</span>
            <span className="text-sm font-normal text-default-400">
              查看此回复的所有引用来源
            </span>
          </ModalHeader>
          <ModalBody className="pb-6">
            <ScrollShadow className="max-h-[60vh]">
              <div className="flex flex-col gap-3">
                {props.codeReferenceCardData.map((code, index) => (
                  <CodeReferenceCard
                    key={`code-full-${index}`}
                    showFullContent={true}
                    {...code}
                  />
                ))}
                {props.notesReferenceCardData.map((note, index) => (
                  <NotesReferenceCard
                    key={`note-full-${note.title}-${index}`}
                    showFullContent={true}
                    {...note}
                  />
                ))}
                {props.onlineReferenceCardData.map((online, index) => (
                  <OnlineReferenceCard
                    key={`online-full-${online.title}-${index}`}
                    showFullContent={true}
                    {...online}
                  />
                ))}
              </div>
            </ScrollShadow>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
