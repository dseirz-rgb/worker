/**
 * 移动端底部导航栏
 */

import { useState } from "react";
import { Link, useLocation } from "wouter";
import { MoreHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, MOBILE_NAV_PATHS } from "@/config/navigation";
import type { NavItem } from "@/types/navigation";

// 获取所有扁平化的导航项
function getAllFlatItems(): NavItem[] {
  const items: NavItem[] = [];
  for (const item of NAV_ITEMS) {
    if (item.path) {
      items.push(item);
    }
    if (item.children) {
      for (const child of item.children) {
        items.push({
          ...child,
          id: child.path,
        } as NavItem);
      }
    }
  }
  return items;
}

// 获取移动端主要导航项
function getMobileNavItems(): NavItem[] {
  const allItems = getAllFlatItems();
  return allItems.filter(item => item.path && MOBILE_NAV_PATHS.includes(item.path));
}

// 获取更多菜单中的导航项
function getMoreNavItems(): NavItem[] {
  const allItems = getAllFlatItems();
  return allItems.filter(item => item.path && !MOBILE_NAV_PATHS.includes(item.path));
}

export function MobileNavBar() {
  const [location] = useLocation();
  const [showMore, setShowMore] = useState(false);
  
  const mainItems = getMobileNavItems();
  const moreItems = getMoreNavItems();

  return (
    <>
      {/* 更多菜单弹出层 */}
      {showMore && (
        <div className="fixed inset-0 z-40 sm:hidden">
          {/* 背景遮罩 */}
          <div 
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowMore(false)}
          />
          
          {/* 菜单内容 */}
          <div className="absolute bottom-14 left-0 right-0 bg-background border-t rounded-t-xl p-4 animate-in slide-in-from-bottom">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium">更多功能</span>
              <button
                onClick={() => setShowMore(false)}
                className="p-1 rounded-lg hover:bg-accent"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="grid grid-cols-4 gap-4">
              {moreItems.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.path;
                
                return (
                  <Link key={item.path} href={item.path!}>
                    <button
                      onClick={() => setShowMore(false)}
                      className={cn(
                        "flex flex-col items-center gap-1 p-2 rounded-lg transition-colors",
                        "hover:bg-accent",
                        isActive && "text-primary bg-accent"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-xs">{item.label}</span>
                    </button>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 底部导航栏 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background border-t z-50 sm:hidden">
        <div className="flex items-center justify-around h-14">
          {mainItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;
            
            return (
              <Link key={item.path} href={item.path!}>
                <button
                  className={cn(
                    "flex flex-col items-center justify-center p-2 rounded-lg transition-colors",
                    "hover:bg-accent",
                    isActive && "text-primary"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs mt-1">{item.label}</span>
                </button>
              </Link>
            );
          })}
          
          {/* 更多按钮 */}
          <button
            onClick={() => setShowMore(true)}
            className={cn(
              "flex flex-col items-center justify-center p-2 rounded-lg transition-colors",
              "hover:bg-accent",
              showMore && "text-primary"
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="text-xs mt-1">更多</span>
          </button>
        </div>
      </nav>
    </>
  );
}
