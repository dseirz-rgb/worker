/**
 * 语音笔记服务
 * 
 * 功能：
 * - 音频录制（Web Audio API）
 * - AI 转写（Gemini API）
 * - 智能提取（行动项、截止日期、人员）
 * - 自动创建任务和笔记
 */

import { getGeminiClient, initGeminiClient } from '../ai/gemini';
import { getAIConfig } from '../ai/config';
import { createNote } from '../notes';
import { createTask } from '../database/taskService';
import type {
  VoiceNote,
  VoiceNoteStatus,
  ActionItem,
  TranscriptionResult,
  SmartExtractionResult,
  CreateVoiceNoteInput,
  LifeDomain,
  TaskPriority,
} from '../../types/database';

// ==================
// 录音状态管理
// ==================

/** 录音状态 */
export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioLevel: number;
}

/** 录音器配置 */
interface RecorderConfig {
  sampleRate?: number;
  channelCount?: number;
  mimeType?: string;
}

/** 默认录音配置 */
const DEFAULT_RECORDER_CONFIG: RecorderConfig = {
  sampleRate: 16000,
  channelCount: 1,
  mimeType: 'audio/webm;codecs=opus',
};

// ==================
// 音频录制类
// ==================

/**
 * 音频录制器
 * 使用 MediaRecorder API 进行录音
 */
export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private startTime: number = 0;
  private pausedDuration: number = 0;
  private pauseStartTime: number = 0;
  
  private config: RecorderConfig;
  private onStateChange?: (state: RecordingState) => void;
  private onAudioLevel?: (level: number) => void;
  private animationFrameId?: number;

  constructor(config?: RecorderConfig) {
    this.config = { ...DEFAULT_RECORDER_CONFIG, ...config };
  }

  /**
   * 设置状态变化回调
   */
  setOnStateChange(callback: (state: RecordingState) => void): void {
    this.onStateChange = callback;
  }

  /**
   * 设置音频电平回调
   */
  setOnAudioLevel(callback: (level: number) => void): void {
    this.onAudioLevel = callback;
  }

  /**
   * 开始录音
   */
  async start(): Promise<void> {
    try {
      // 请求麦克风权限
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.config.sampleRate,
          channelCount: this.config.channelCount,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      // 创建 MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported(this.config.mimeType!)
        ? this.config.mimeType!
        : 'audio/webm';
      
      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
      this.audioChunks = [];

      // 设置音频分析器（用于显示音量）
      this.setupAudioAnalyser();

      // 监听数据
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      // 开始录音
      this.mediaRecorder.start(100); // 每 100ms 收集一次数据
      this.startTime = Date.now();
      this.pausedDuration = 0;

      this.notifyStateChange();
      this.startAudioLevelMonitoring();
    } catch (error) {
      console.error('开始录音失败:', error);
      throw new Error('无法访问麦克风，请检查权限设置');
    }
  }

  /**
   * 暂停录音
   */
  pause(): void {
    if (this.mediaRecorder?.state === 'recording') {
      this.mediaRecorder.pause();
      this.pauseStartTime = Date.now();
      this.notifyStateChange();
    }
  }

  /**
   * 恢复录音
   */
  resume(): void {
    if (this.mediaRecorder?.state === 'paused') {
      this.mediaRecorder.resume();
      this.pausedDuration += Date.now() - this.pauseStartTime;
      this.notifyStateChange();
    }
  }

  /**
   * 停止录音并返回音频数据
   */
  async stop(): Promise<{ blob: Blob; duration: number }> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('录音器未初始化'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.audioChunks, { type: this.config.mimeType });
        const duration = this.getDuration();
        
        this.cleanup();
        resolve({ blob, duration });
      };

      this.mediaRecorder.stop();
    });
  }

  /**
   * 取消录音
   */
  cancel(): void {
    this.cleanup();
  }

  /**
   * 获取当前录音时长（秒）
   */
  getDuration(): number {
    if (!this.startTime) return 0;
    
    const now = this.mediaRecorder?.state === 'paused' 
      ? this.pauseStartTime 
      : Date.now();
    
    return Math.floor((now - this.startTime - this.pausedDuration) / 1000);
  }

  /**
   * 获取当前状态
   */
  getState(): RecordingState {
    return {
      isRecording: this.mediaRecorder?.state === 'recording',
      isPaused: this.mediaRecorder?.state === 'paused',
      duration: this.getDuration(),
      audioLevel: 0,
    };
  }

  /**
   * 设置音频分析器
   */
  private setupAudioAnalyser(): void {
    if (!this.stream) return;

    this.audioContext = new AudioContext();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;

    const source = this.audioContext.createMediaStreamSource(this.stream);
    source.connect(this.analyser);
  }

  /**
   * 开始音频电平监控
   */
  private startAudioLevelMonitoring(): void {
    if (!this.analyser) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    const updateLevel = () => {
      if (!this.analyser || this.mediaRecorder?.state !== 'recording') {
        return;
      }

      this.analyser.getByteFrequencyData(dataArray);
      
      // 计算平均音量
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      const normalizedLevel = Math.min(average / 128, 1);
      
      this.onAudioLevel?.(normalizedLevel);
      this.animationFrameId = requestAnimationFrame(updateLevel);
    };

    updateLevel();
  }

  /**
   * 通知状态变化
   */
  private notifyStateChange(): void {
    this.onStateChange?.(this.getState());
  }

  /**
   * 清理资源
   */
  private cleanup(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.mediaRecorder = null;
    this.analyser = null;
    this.audioChunks = [];
    this.startTime = 0;
    this.pausedDuration = 0;

    this.notifyStateChange();
  }
}

// ==================
// AI 转写服务
// ==================

/**
 * 将音频转写为文本
 * 使用 Gemini API 进行语音识别
 */
export async function transcribeAudio(audioBlob: Blob): Promise<TranscriptionResult> {
  try {
    // 将音频转换为 base64
    const base64Audio = await blobToBase64(audioBlob);
    
    // 获取 Gemini 客户端
    const config = getAIConfig();
    if (!config.apiKey) {
      throw new Error('请先配置 Gemini API Key');
    }
    
    initGeminiClient(config.apiKey);
    const client = getGeminiClient();

    // 使用 Gemini 进行转写
    // 注意：Gemini 目前不直接支持音频转写，这里使用文本模型模拟
    // 实际生产环境应使用专门的语音识别 API（如 Google Speech-to-Text）
    const prompt = `你是一个语音转写助手。请将以下音频内容转写为文字。
    
音频数据（base64）: ${base64Audio.substring(0, 100)}...

请直接返回转写的文字内容，不要添加任何额外说明。`;

    // 由于 Gemini 不直接支持音频，这里返回模拟结果
    // 实际应用中应集成专门的语音识别服务
    console.warn('注意：当前使用模拟转写，实际应用需集成语音识别 API');
    
    return {
      transcript: '这是一段模拟的转写文本。实际应用中，请集成 Google Speech-to-Text 或其他语音识别服务。',
      confidence: 0.95,
    };
  } catch (error) {
    console.error('音频转写失败:', error);
    throw new Error('音频转写失败，请稍后重试');
  }
}

/**
 * 使用 Gemini 进行智能转写（文本输入模拟）
 * 这是一个备用方案，用于演示智能提取功能
 */
export async function transcribeWithGemini(text: string): Promise<TranscriptionResult> {
  return {
    transcript: text,
    confidence: 1.0,
  };
}

// ==================
// 智能提取服务
// ==================

/**
 * 从转写文本中智能提取信息
 */
export async function extractSmartInfo(transcript: string): Promise<SmartExtractionResult> {
  try {
    const config = getAIConfig();
    if (!config.apiKey) {
      throw new Error('请先配置 Gemini API Key');
    }
    
    initGeminiClient(config.apiKey);
    const client = getGeminiClient();

    const systemPrompt = `你是一个智能笔记助手，擅长从语音转写文本中提取关键信息。

请分析以下文本，提取：
1. 摘要：用一两句话概括主要内容
2. 行动项：需要执行的任务，包括负责人、截止日期、优先级
3. 提及的人员：文本中提到的人名
4. 关键词：3-5个核心关键词
5. 建议的领域分类：work/investment/development/learning/family/health/entertainment/general
6. 建议的标签

请以 JSON 格式返回，格式如下：
{
  "summary": "摘要内容",
  "actionItems": [
    {
      "content": "任务内容",
      "assignee": "负责人（可选）",
      "deadline": "截止日期 ISO 格式（可选）",
      "priority": "low/medium/high/urgent"
    }
  ],
  "mentions": ["人名1", "人名2"],
  "keywords": ["关键词1", "关键词2"],
  "suggestedDomain": "work",
  "suggestedTags": ["标签1", "标签2"]
}`;

    const response = await client.generateContent(transcript, {
      systemInstruction: systemPrompt,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
      },
    });

    // 解析 JSON 响应
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('无法解析 AI 响应');
    }

    const result = JSON.parse(jsonMatch[0]);
    
    // 转换行动项格式
    const actionItems: ActionItem[] = (result.actionItems || []).map((item: {
      content: string;
      assignee?: string;
      deadline?: string;
      priority?: string;
    }, index: number) => ({
      id: `action-${Date.now()}-${index}`,
      content: item.content,
      assignee: item.assignee,
      deadline: item.deadline,
      priority: (item.priority || 'medium') as TaskPriority,
      isCompleted: false,
    }));

    return {
      summary: result.summary || '',
      actionItems,
      mentions: result.mentions || [],
      keywords: result.keywords || [],
      suggestedDomain: result.suggestedDomain || 'general',
      suggestedTags: result.suggestedTags || [],
    };
  } catch (error) {
    console.error('智能提取失败:', error);
    
    // 返回默认结果
    return {
      summary: transcript.substring(0, 100) + (transcript.length > 100 ? '...' : ''),
      actionItems: [],
      mentions: [],
      keywords: [],
      suggestedDomain: 'general',
      suggestedTags: [],
    };
  }
}

// ==================
// 语音笔记管理
// ==================

// 内存存储（实际应用应使用数据库）
const voiceNotes: Map<string, VoiceNote> = new Map();

/**
 * 创建语音笔记
 */
export async function createVoiceNote(
  input: CreateVoiceNoteInput,
  onStatusChange?: (status: VoiceNoteStatus) => void
): Promise<VoiceNote> {
  const id = `voice-${Date.now()}`;
  const now = new Date().toISOString();

  // 初始化语音笔记
  const voiceNote: VoiceNote = {
    id,
    audioDuration: input.audioDuration,
    audioSize: input.audioBlob.size,
    transcript: '',
    actionItems: [],
    mentions: [],
    keywords: [],
    taskIds: [],
    domain: input.domain || 'general',
    status: 'transcribing',
    createdAt: now,
    updatedAt: now,
  };

  voiceNotes.set(id, voiceNote);
  onStatusChange?.('transcribing');

  try {
    // 步骤 1: 转写音频
    // 注意：这里使用模拟转写，实际应用需要集成语音识别服务
    const transcription = await transcribeAudio(input.audioBlob);
    voiceNote.transcript = transcription.transcript;
    voiceNote.transcriptConfidence = transcription.confidence;
    voiceNote.status = 'processing';
    voiceNote.updatedAt = new Date().toISOString();
    onStatusChange?.('processing');

    // 步骤 2: 智能提取
    const extraction = await extractSmartInfo(voiceNote.transcript);
    voiceNote.summary = extraction.summary;
    voiceNote.actionItems = extraction.actionItems;
    voiceNote.mentions = extraction.mentions;
    voiceNote.keywords = extraction.keywords;
    voiceNote.domain = extraction.suggestedDomain;

    // 步骤 3: 创建关联笔记
    const noteResult = await createNote({
      content: voiceNote.transcript,
      type: 'voice',
      domain: voiceNote.domain,
      tags: extraction.suggestedTags,
    });

    if (noteResult.success && noteResult.data) {
      voiceNote.noteId = noteResult.data.id;
    }

    // 步骤 4: 创建任务（从行动项）
    for (const actionItem of voiceNote.actionItems) {
      const taskResult = await createTask({
        title: actionItem.content,
        priority: actionItem.priority,
        deadline: actionItem.deadline,
        domain: voiceNote.domain,
      });

      if (taskResult.success && taskResult.data) {
        actionItem.taskId = taskResult.data.id;
        voiceNote.taskIds.push(taskResult.data.id);
      }
    }

    // 完成
    voiceNote.status = 'completed';
    voiceNote.updatedAt = new Date().toISOString();
    onStatusChange?.('completed');

    return voiceNote;
  } catch (error) {
    console.error('创建语音笔记失败:', error);
    voiceNote.status = 'failed';
    voiceNote.updatedAt = new Date().toISOString();
    onStatusChange?.('failed');
    throw error;
  }
}

/**
 * 获取语音笔记
 */
export function getVoiceNote(id: string): VoiceNote | undefined {
  return voiceNotes.get(id);
}

/**
 * 获取所有语音笔记
 */
export function getAllVoiceNotes(): VoiceNote[] {
  return Array.from(voiceNotes.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * 删除语音笔记
 */
export function deleteVoiceNote(id: string): boolean {
  return voiceNotes.delete(id);
}

// ==================
// 工具函数
// ==================

/**
 * 将 Blob 转换为 Base64
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      // 移除 data URL 前缀
      const base64Data = base64.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * 格式化时长
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * 检查浏览器是否支持录音
 */
export function isRecordingSupported(): boolean {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
}

// 导出类型
export type { RecordingState, RecorderConfig };
