/**
 * 截图服务 - Echo on Blinko 扩展
 * 提供屏幕截图功能的 TypeScript 绑定
 */

import { invoke } from '@tauri-apps/api/core';

/** 截图区域 */
export interface ScreenRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 截图结果 */
export interface ScreenshotResult {
  /** Base64 编码的 PNG 图片 */
  imageBase64: string;
  /** 截图区域 */
  region: ScreenRegion;
}

/** 屏幕信息 */
export interface ScreenInfo {
  id: number;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleFactor: number;
  isPrimary: boolean;
}

/**
 * 获取所有屏幕信息
 */
export async function getScreens(): Promise<ScreenInfo[]> {
  return invoke<ScreenInfo[]>('get_screens');
}

/**
 * 截取指定屏幕的全屏截图
 * @param screenId 屏幕 ID，默认为主屏幕
 */
export async function captureScreen(screenId?: number): Promise<ScreenshotResult> {
  return invoke<ScreenshotResult>('capture_screen', { screenId });
}

/**
 * 截取指定区域的截图
 * @param region 截图区域
 */
export async function captureScreenRegion(region: ScreenRegion): Promise<ScreenshotResult> {
  return invoke<ScreenshotResult>('capture_screen_region', { region });
}

/**
 * 将 base64 图片转换为 Blob
 */
export function base64ToBlob(base64: string, mimeType = 'image/png'): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

/**
 * 将 base64 图片转换为 Data URL
 */
export function base64ToDataUrl(base64: string, mimeType = 'image/png'): string {
  return `data:${mimeType};base64,${base64}`;
}
