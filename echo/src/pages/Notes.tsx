/**
 * 笔记页面
 * 闪念笔记的主界面
 * 
 * 功能：
 * - 快速文本笔记
 * - 语音笔记录制和转写
 * - 智能提取行动项
 */

import * as React from "react";
import { NoteInput, NoteList } from "@/components/notes";
import { VoiceRecorder, VoiceNoteList } from "@/components/voice";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mic, FileText } from "lucide-react";
import {
  createNote,
  getNotes,
  deleteNote,
  searchNotes,
} from "@/services/notes";
import { getAllVoiceNotes, deleteVoiceNote } from "@/services/voice";
import type { Note, CreateNoteInput, LifeDomain, VoiceNote } from "@/types/database";

const PAGE_SIZE = 20;

export function NotesPage() {
  const [notes, setNotes] = React.useState<Note[]>([]);
  const [voiceNotes, setVoiceNotes] = React.useState<VoiceNote[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [hasMore, setHasMore] = React.useState(false);
  const [currentDomain, setCurrentDomain] = React.useState<LifeDomain | undefined>();
  const [searchKeyword, setSearchKeyword] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<"text" | "voice">("text");

  // 加载笔记
  const loadNotes = React.useCallback(async (reset = false) => {
    setIsLoading(true);
    try {
      const offset = reset ? 0 : notes.length;
      const result = await getNotes({
        domain: currentDomain,
        limit: PAGE_SIZE,
        offset,
      });

      if (result.success && result.data) {
        if (reset) {
          setNotes(result.data);
        } else {
          setNotes((prev) => [...prev, ...result.data!]);
        }
        setHasMore(result.data.length === PAGE_SIZE);
      }
    } catch (error) {
      console.error("加载笔记失败:", error);
    } finally {
      setIsLoading(false);
    }
  }, [currentDomain, notes.length]);

  // 加载语音笔记
  const loadVoiceNotes = React.useCallback(() => {
    setVoiceNotes(getAllVoiceNotes());
  }, []);

  // 初始加载
  React.useEffect(() => {
    loadNotes(true);
    loadVoiceNotes();
  }, [currentDomain]);

  // 创建笔记
  const handleCreate = async (input: CreateNoteInput) => {
    const result = await createNote(input);
    if (result.success && result.data) {
      // 添加到列表顶部
      setNotes((prev) => [result.data!, ...prev]);
    }
  };

  // 删除笔记
  const handleDelete = async (id: string) => {
    const result = await deleteNote(id);
    if (result.success) {
      setNotes((prev) => prev.filter((n) => n.id !== id));
    }
  };

  // 搜索笔记
  const handleSearch = async (keyword: string) => {
    setSearchKeyword(keyword);
    if (!keyword.trim()) {
      loadNotes(true);
      return;
    }

    setIsLoading(true);
    try {
      const result = await searchNotes(keyword);
      if (result.success && result.data) {
        setNotes(result.data);
        setHasMore(false);
      }
    } catch (error) {
      console.error("搜索笔记失败:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 筛选领域
  const handleFilterDomain = (domain: LifeDomain | undefined) => {
    setCurrentDomain(domain);
    setSearchKeyword("");
  };

  // 加载更多
  const handleLoadMore = () => {
    if (!searchKeyword) {
      loadNotes(false);
    }
  };

  // 编辑笔记（暂时只打印，后续实现编辑弹窗）
  const handleEdit = (note: Note) => {
    console.log("编辑笔记:", note);
    // TODO: 实现编辑弹窗
  };

  // 语音笔记录制完成
  const handleVoiceRecordingComplete = (voiceNote: VoiceNote) => {
    console.log("语音笔记完成:", voiceNote);
    loadVoiceNotes();
    // 如果创建了关联笔记，刷新笔记列表
    if (voiceNote.noteId) {
      loadNotes(true);
    }
  };

  // 删除语音笔记
  const handleDeleteVoiceNote = (id: string) => {
    deleteVoiceNote(id);
    loadVoiceNotes();
  };

  return (
    <div className="container max-w-4xl mx-auto py-6 px-4 space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold">闪念笔记</h1>
        <p className="text-muted-foreground">快速记录你的想法，支持文字和语音</p>
      </div>

      {/* 输入方式切换 */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "text" | "voice")}>
        <TabsList className="grid w-full grid-cols-2 max-w-xs">
          <TabsTrigger value="text" className="gap-2">
            <FileText className="h-4 w-4" />
            文字
          </TabsTrigger>
          <TabsTrigger value="voice" className="gap-2">
            <Mic className="h-4 w-4" />
            语音
          </TabsTrigger>
        </TabsList>

        <TabsContent value="text" className="mt-4">
          {/* 快速输入 */}
          <NoteInput onSubmit={handleCreate} autoFocus />
        </TabsContent>

        <TabsContent value="voice" className="mt-4">
          {/* 语音录制 */}
          <VoiceRecorder
            onRecordingComplete={handleVoiceRecordingComplete}
            defaultDomain={currentDomain || "general"}
          />
        </TabsContent>
      </Tabs>

      {/* 语音笔记列表（如果有） */}
      {voiceNotes.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Mic className="h-5 w-5" />
            语音笔记
            <span className="text-sm font-normal text-muted-foreground">
              ({voiceNotes.length})
            </span>
          </h2>
          <VoiceNoteList
            voiceNotes={voiceNotes}
            onDelete={handleDeleteVoiceNote}
          />
        </div>
      )}

      {/* 文字笔记列表 */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5" />
          文字笔记
        </h2>
        <NoteList
          notes={notes}
          isLoading={isLoading}
          hasMore={hasMore}
          onSearch={handleSearch}
          onFilterDomain={handleFilterDomain}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onLoadMore={handleLoadMore}
        />
      </div>
    </div>
  );
}

export default NotesPage;
