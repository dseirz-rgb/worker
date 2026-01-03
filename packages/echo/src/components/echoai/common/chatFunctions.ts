/**
 * 对话功能工具
 * 处理对话消息和文件上传
 */

// ============================================
// 类型定义
// ============================================

export interface AttachedFileText {
  name: string;
  content: string;
}

export interface Context {
  compiled: string;
  file: string;
  heading?: string;
}

export interface OnlineContext {
  [key: string]: {
    organic?: Array<{
      title: string;
      link: string;
      snippet: string;
    }>;
    knowledgeGraph?: {
      title: string;
      description: string;
    };
    answerBox?: {
      answer: string;
      snippet: string;
    };
    webpages?: string;
  };
}

export interface CodeContext {
  [key: string]: {
    code: string;
    results?: {
      output_files?: Array<{
        filename: string;
        b64_data: string;
      }>;
      stdout?: string;
      stderr?: string;
    };
  };
}

export interface RawReferenceData {
  context?: Context[];
  onlineContext?: OnlineContext;
  codeContext?: CodeContext;
}

export interface MessageMetadata {
  conversationId: string;
  turnId: string;
}

export interface GeneratedAssetsData {
  images: string[];
  mermaidjsDiagram: string;
  files: AttachedFileText[];
}

export interface ResponseWithIntent {
  intentType: string;
  response: string;
  inferredQueries?: string[];
}

export interface StreamMessage {
  rawResponse: string;
  trainOfThought: string[];
  context?: Context[];
  onlineContext?: OnlineContext;
  codeContext?: CodeContext;
  completed: boolean;
  turnId?: string;
  intentType?: string;
  inferredQueries?: string[];
  generatedImages?: string[];
  generatedMermaidjsDiagram?: string;
  generatedFiles?: AttachedFileText[];
}

interface MessageChunk {
  type: string;
  data: string | object;
}

// ============================================
// 消息处理函数
// ============================================

/**
 * 将消息块转换为 JSON 格式
 */
export function convertMessageChunkToJson(chunk: string): MessageChunk {
  // 移除 SSE 前缀
  let content = chunk;
  if (content.startsWith('data: ')) {
    content = content.slice(6);
  }
  
  // 跳过空行和 [DONE] 标记
  if (!content.trim() || content.trim() === '[DONE]') {
    return {
      type: 'message',
      data: '',
    };
  }
  
  if (content.startsWith('{') && content.endsWith('}')) {
    try {
      const jsonChunk = JSON.parse(content);
      if (!jsonChunk.type) {
        // 如果有 response 字段，提取它
        if (jsonChunk.response !== undefined) {
          return {
            type: 'message',
            data: jsonChunk.response,
          };
        }
        return {
          type: 'message',
          data: jsonChunk,
        };
      }
      return jsonChunk;
    } catch {
      return {
        type: 'message',
        data: chunk,
      };
    }
  } else if (content.length > 0) {
    return {
      type: 'message',
      data: content,
    };
  } else {
    return {
      type: 'message',
      data: '',
    };
  }
}

/**
 * 处理 JSON 响应
 */
function handleJsonResponse(chunkData: unknown): ResponseWithIntent {
  const jsonData = chunkData as Record<string, unknown>;
  
  if (jsonData.image || jsonData.detail) {
    return handleImageResponse(chunkData, true);
  } else if (jsonData.response) {
    return {
      response: jsonData.response as string,
      intentType: '',
      inferredQueries: [],
    };
  } else {
    throw new Error('Invalid JSON response');
  }
}

/**
 * 处理图片响应
 */
export function handleImageResponse(imageJson: unknown, _liveStream: boolean): ResponseWithIntent {
  const json = imageJson as Record<string, unknown>;
  let rawResponse = '';

  if (json.image) {
    rawResponse = json.image as string;
  }

  const responseWithIntent: ResponseWithIntent = {
    intentType: json.intentType as string || '',
    response: rawResponse,
    inferredQueries: json.inferredQueries as string[] || [],
  };

  if (json.detail) {
    rawResponse += json.detail as string;
  }

  return responseWithIntent;
}

/**
 * 处理消息块
 */
export function processMessageChunk(
  rawChunk: string,
  currentMessage: StreamMessage,
  context: Context[] = [],
  onlineContext: OnlineContext = {},
  codeContext: CodeContext = {},
): { context: Context[]; onlineContext: OnlineContext; codeContext: CodeContext } {
  const chunk = convertMessageChunkToJson(rawChunk);

  if (!currentMessage || !chunk || !chunk.type) {
    return { context, onlineContext, codeContext };
  }

  if (chunk.type === 'status') {
    const statusMessage = chunk.data as string;
    currentMessage.trainOfThought.push(statusMessage);
  } else if (chunk.type === 'thought') {
    const thoughtChunk = chunk.data as string;
    const lastThoughtIndex = currentMessage.trainOfThought.length - 1;
    const previousThought = lastThoughtIndex >= 0 
      ? currentMessage.trainOfThought[lastThoughtIndex] 
      : '';
    
    if (previousThought.startsWith('**Thinking:** ')) {
      currentMessage.trainOfThought[lastThoughtIndex] += thoughtChunk;
    } else {
      currentMessage.trainOfThought.push(`**Thinking:** ${thoughtChunk}`);
    }
  } else if (chunk.type === 'references') {
    const references = chunk.data as RawReferenceData;
    if (references.context) context = references.context;
    if (references.onlineContext) onlineContext = references.onlineContext;
    if (references.codeContext) codeContext = references.codeContext;
    return { context, onlineContext, codeContext };
  } else if (chunk.type === 'metadata') {
    const messageMetadata = chunk.data as MessageMetadata;
    currentMessage.turnId = messageMetadata.turnId;
  } else if (chunk.type === 'generated_assets') {
    const generatedAssets = chunk.data as GeneratedAssetsData;
    if (generatedAssets.images) {
      currentMessage.generatedImages = generatedAssets.images;
    }
    if (generatedAssets.mermaidjsDiagram) {
      currentMessage.generatedMermaidjsDiagram = generatedAssets.mermaidjsDiagram;
    }
    if (generatedAssets.files) {
      currentMessage.generatedFiles = generatedAssets.files;
    }
  } else if (chunk.type === 'message') {
    const chunkData = chunk.data;
    
    if (chunkData !== null && typeof chunkData === 'object') {
      const responseWithIntent = handleJsonResponse(chunkData);
      if (responseWithIntent.intentType === 'excalidraw') {
        currentMessage.rawResponse = responseWithIntent.response;
      } else {
        currentMessage.rawResponse += responseWithIntent.response;
      }
      currentMessage.intentType = responseWithIntent.intentType;
      currentMessage.inferredQueries = responseWithIntent.inferredQueries;
    } else if (
      typeof chunkData === 'string' &&
      chunkData.trim()?.startsWith('{') &&
      chunkData.trim()?.endsWith('}')
    ) {
      try {
        const jsonData = JSON.parse(chunkData.trim());
        const responseWithIntent = handleJsonResponse(jsonData);
        currentMessage.rawResponse += responseWithIntent.response;
        currentMessage.intentType = responseWithIntent.intentType;
        currentMessage.inferredQueries = responseWithIntent.inferredQueries;
      } catch {
        currentMessage.rawResponse += JSON.stringify(chunkData);
      }
    } else {
      currentMessage.rawResponse += chunkData;
    }
  } else if (chunk.type === 'end_response') {
    if (codeContext) currentMessage.codeContext = codeContext;
    if (onlineContext) currentMessage.onlineContext = onlineContext;
    if (context) currentMessage.context = context;
    currentMessage.completed = true;
  }
  
  return { context, onlineContext, codeContext };
}

/**
 * 渲染代码生成的图片
 */
export function renderCodeGenImageInline(message: string, codeContext: CodeContext) {
  if (!codeContext) return message;

  Object.values(codeContext).forEach((contextData) => {
    contextData.results?.output_files?.forEach((file) => {
      const regex = new RegExp(`!?\\[.*?\\]\\(.*${file.filename}\\)`, 'g');
      if (file.filename.match(/\.(png|jpg|jpeg)$/i)) {
        const replacement = `![${file.filename}](data:image/${file.filename.split('.').pop()};base64,${file.b64_data})`;
        message = message.replace(regex, replacement);
      } else if (file.filename.match(/\.(txt|org|md|csv|json)$/i)) {
        const replacement = `![${file.filename}](data:text/plain;base64,${file.b64_data})`;
        message = message.replace(regex, replacement);
      }
    });
  });

  return message;
}

// ============================================
// API 调用函数
// ============================================

/**
 * 创建新对话 ID
 * 使用本地生成的 UUID，不再依赖外部服务
 */
export function createNewConversation(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 打包文件用于上传
 */
export async function packageFilesForUpload(files: FileList): Promise<FormData> {
  const formData = new FormData();

  const fileReadPromises = Array.from(files).map((file) => {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = function (event) {
        if (event.target === null) {
          reject(new Error('FileReader target is null'));
          return;
        }

        const fileContents = event.target.result;
        let fileType = file.type;
        const fileName = file.name;
        
        if (fileType === '') {
          const fileExtension = fileName.split('.').pop()?.toLowerCase();
          switch (fileExtension) {
            case 'org':
              fileType = 'text/org';
              break;
            case 'md':
              fileType = 'text/markdown';
              break;
            case 'txt':
            case 'tsx':
            case 'ipynb':
              fileType = 'text/plain';
              break;
            case 'html':
              fileType = 'text/html';
              break;
            case 'pdf':
              fileType = 'application/pdf';
              break;
            case 'docx':
              fileType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
              break;
            default:
              console.warn(`File type not supported: ${fileName}`);
              resolve();
              return;
          }
        }

        if (fileContents === null) {
          console.warn(`Could not read file: ${fileName}`);
          reject(new Error('File contents is null'));
          return;
        }

        const fileObj = new Blob([fileContents], { type: fileType });
        formData.append('files', fileObj, file.name);
        resolve();
      };
      
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  });

  await Promise.all(fileReadPromises);
  return formData;
}

/**
 * 上传文件（本地处理，不再依赖外部服务）
 * 注意：文件上传功能已迁移到 Paperless 集成
 */
export function uploadDataForIndexing(
  files: FileList,
  setWarning: (warning: string) => void,
  setUploading: (uploading: boolean) => void,
  setError: (error: string) => void,
  setUploadedFiles?: (files: string[]) => void,
) {
  const allowedExtensions = [
    'text/org',
    'text/markdown',
    'text/plain',
    'text/html',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  const allowedFileEndings = ['org', 'md', 'txt', 'html', 'pdf', 'docx'];
  const badFiles: string[] = [];
  const goodFiles: File[] = [];
  const uploadedFiles: string[] = [];

  for (const file of files) {
    const fileEnding = file.name.split('.').pop()?.toLowerCase();
    if (!file || !file.name || !fileEnding) {
      if (file) badFiles.push(file.name);
    } else if (
      !allowedExtensions.includes(file.type) &&
      !allowedFileEndings.includes(fileEnding)
    ) {
      badFiles.push(file.name);
    } else {
      goodFiles.push(file);
    }
  }

  if (goodFiles.length === 0) {
    setWarning('No supported files found');
    return;
  }

  if (badFiles.length > 0) {
    setWarning('The following files are not supported:\n' + badFiles.join('\n'));
  }

  setUploading(true);

  // 模拟上传成功（实际文件处理由 Paperless 或其他服务处理）
  setTimeout(() => {
    for (const file of goodFiles) {
      uploadedFiles.push(file.name);
    }
    if (setUploadedFiles) setUploadedFiles(uploadedFiles);
    setUploading(false);
  }, 500);
}
