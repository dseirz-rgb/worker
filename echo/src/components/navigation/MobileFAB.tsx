import { useState } from "react";
import { Plus, X, Camera, Mic, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";

interface FABAction {
  id: string;
  label: string;
  icon: typeof Camera;
  onClick: () => void;
}

const FAB_ACTIONS: FABAction[] = [
  { id: 'screenshot', label: '截图', icon: Camera, onClick: () => console.log('截图') },
  { id: 'voice', label: '语音', icon: Mic, onClick: () => console.log('语音会议') },
  { id: 'note', label: '速记', icon: PenLine, onClick: () => console.log('快速笔记') },
];

export function MobileFAB() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed right-4 bottom-20 z-40 sm:hidden">
      {/* 展开的操作按钮 */}
      {isOpen && (
        <div className="flex flex-col gap-3 mb-3 animate-in fade-in slide-in-from-bottom-2">
          {FAB_ACTIONS.map((action, index) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => {
                  action.onClick();
                  setIsOpen(false);
                }}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-full",
                  "bg-secondary text-secondary-foreground shadow-lg",
                  "hover:bg-secondary/80 transition-colors"
                )}
                style={{
                  animationDelay: `${index * 50}ms`,
                }}
              >
                <Icon className="h-4 w-4" />
                <span className="text-sm">{action.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* 主 FAB 按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-all",
          "bg-primary text-primary-foreground",
          "hover:bg-primary/90 active:scale-95",
          isOpen && "rotate-45"
        )}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </button>
    </div>
  );
}
