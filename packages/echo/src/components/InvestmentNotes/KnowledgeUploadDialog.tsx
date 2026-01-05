/**
 * 知识库上传对话框
 * 
 * 支持上传 TXT/MD 文件到知识库
 * 自动切片并生成向量嵌入
 */

import { useState, useRef, useCallback } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Progress,
  Spinner,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { toast } from 'sonner';
import { getDatabaseClient } from '@echoai/shared/database';

interface KnowledgeUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * 文本切片
 */
function chunkText(text: string, chunkSize = 1000, overlap = 100): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start += chunkSize - overlap;
  }
  return chunks;
}

/**
 * 批量获取嵌入向量
 */
async function getEmbeddings(
  texts: string[],
  onProgress: (current: number, total: number) => void
): Promise<number[][]> {
  const batchSize = 5;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const instances = batch.map(t => ({ content: t, task_type: 'RETRIEVAL_DOCUMENT' }));

    const response = await fetch('/api/embedding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instances }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Embedding API 失败 (${response.status}): ${errText}`);
    }

    const data = await response.json();
    if (data.predictions) {
      data.predictions.forEach((p: { embeddings: { values: number[] } }) => {
        allEmbeddings.push(p.embeddings.values);
      });
    }

    onProgress(Math.min(i + batchSize, texts.length), texts.length);
  }

  return allEmbeddings;
}

export function KnowledgeUploadDialog({
  isOpen,
  onClose,
  onSuccess,
}: KnowledgeUploadDialogProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, stage: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const client = getDatabaseClient()?.riskcontrol;
    if (!client) {
      toast.error('数据库未连接');
      return;
    }

    setIsUploading(true);
    setProgress({ current: 0, total: 0, stage: '读取文件...' });

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split('.').pop()?.toLowerCase();

        if (!['txt', 'md'].includes(ext || '')) {
          toast.warning(`跳过不支持的文件: ${file.name}`);
          continue;
        }

        // 读取文件
        const text = await file.text();
        setProgress({ current: 0, total: 0, stage: `切片: ${file.name}` });

        // 切片
        const chunks = chunkText(text);
        setProgress({ current: 0, total: chunks.length, stage: `向量化: ${file.name}` });

        // 生成嵌入
        const embeddings = await getEmbeddings(chunks, (current, total) => {
          setProgress({ current, total, stage: `向量化: ${file.name}` });
        });

        setProgress({ current: 0, total: 0, stage: `保存: ${file.name}` });

        // 保存到数据库
        const rows = chunks.map((chunk, idx) => ({
          title: `${file.name.replace(/\.(txt|md)$/, '')} (Part ${idx + 1})`,
          content: chunk,
          embedding: embeddings[idx],
          source_type: 'uploaded_file',
          metadata: { original_filename: file.name },
          user_id: 1,
        }));

        const { error } = await client.from('documents').insert(rows);
        if (error) throw new Error(`保存失败: ${error.message}`);
      }

      toast.success('上传成功！');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('上传失败: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsUploading(false);
      setProgress({ current: 0, total: 0, stage: '' });
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [onClose, onSuccess]);

  const handleClick = useCallback(() => {
    if (!isUploading) {
      fileInputRef.current?.click();
    }
  }, [isUploading]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <Icon icon="mdi:upload" className="text-primary" />
          上传知识库文档
        </ModalHeader>

        <ModalBody>
          {/* 上传区域 */}
          <div
            className={`
              border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer
              ${isUploading 
                ? 'border-primary/50 bg-primary/5' 
                : 'border-divider hover:border-primary/50 hover:bg-content2/50'
              }
            `}
            onClick={handleClick}
          >
            {isUploading ? (
              <div className="space-y-4">
                <Spinner size="lg" color="primary" />
                <p className="text-sm text-foreground/70">{progress.stage}</p>
                {progress.total > 0 && (
                  <Progress
                    value={(progress.current / progress.total) * 100}
                    className="max-w-xs mx-auto"
                    color="primary"
                  />
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-center gap-3">
                  <Icon icon="mdi:file-document-outline" className="text-4xl text-foreground/40" />
                  <Icon icon="mdi:language-markdown" className="text-4xl text-foreground/40" />
                </div>
                <p className="font-medium">点击选择文件</p>
                <p className="text-sm text-foreground/50">支持 .txt, .md 格式</p>
                <p className="text-xs text-primary">文件将自动切片并生成向量嵌入</p>
              </div>
            )}

            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".txt,.md"
              multiple
              onChange={handleFileSelect}
              disabled={isUploading}
            />
          </div>

          <p className="text-xs text-foreground/50 mt-4">
            提示：上传的文档将用于 AI 问答的知识检索。建议上传投资书籍、研报等文档。
          </p>
        </ModalBody>

        <ModalFooter>
          <Button variant="flat" onPress={onClose} isDisabled={isUploading}>
            关闭
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export default KnowledgeUploadDialog;
