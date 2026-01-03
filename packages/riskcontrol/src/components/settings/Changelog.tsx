
import React from 'react';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { changelogData } from '../../data/changelog';

export function Changelog() {
  return (
    <div className="h-full flex flex-col">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-text-primary">更新日志</h3>
        <p className="text-sm text-text-muted">查看系统的更新历史和新功能</p>
      </div>
      
      <ScrollArea className="flex-1 pr-4 -mr-4 h-[400px]">
        <div className="space-y-6 relative border-l border-border/50 ml-2 pl-6 pb-2">
          {changelogData.map((item, index) => (
            <div key={index} className="relative">
              {/* Timeline dot */}
              <div className="absolute -left-[29px] top-1.5 w-3 h-3 rounded-full bg-accent-cyan/20 border-2 border-accent-cyan shadow-[0_0_0_4px_rgba(0,0,0,0.2)]" />
              
              <div className="flex items-center gap-3 mb-2">
                <span className="text-sm font-mono text-text-muted">{item.date}</span>
                <Badge variant="secondary" className="text-xs py-0 h-5">{item.version}</Badge>
              </div>
              
              <h4 className="text-base font-medium text-text-primary mb-2">{item.title}</h4>
              
              <ul className="space-y-2">
                {item.changes.map((change, i) => (
                  <li key={i} className="text-sm text-text-secondary leading-relaxed pl-2 relative">
                    <span className="absolute left-0 top-2 w-1 h-1 rounded-full bg-text-muted/50" />
                    {change}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
