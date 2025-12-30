import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { NavItem } from "@/types/navigation";

interface NavItemComponentProps {
  item: NavItem;
}

// 带子菜单的导航项
function NavItemWithChildren({ item }: NavItemComponentProps) {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(true);

  const Icon = item.icon;
  const hasActiveChild = item.children?.some(c => c.path === location);

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1.5 w-full px-2 py-1.5 rounded-md transition-all text-sm font-medium",
          "hover:bg-accent",
          hasActiveChild && "bg-accent/50 text-primary"
        )}
      >
        <Icon className={cn(
          "h-4 w-4 flex-shrink-0",
          hasActiveChild ? "text-primary" : "text-muted-foreground"
        )} />
        <span className={cn(
          "flex-1 text-left truncate",
          hasActiveChild ? "text-primary" : "text-foreground/80"
        )}>
          {item.label}
        </span>
        {isOpen ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
        )}
      </button>
      {isOpen && (
        <div className="flex flex-col gap-0.5 mt-0.5 ml-4 pl-2 border-l border-border/40">
          {item.children?.map(child => {
            const ChildIcon = child.icon;
            const isActive = location === child.path;
            return (
              <Link key={child.path} href={child.path}>
                <button
                  className={cn(
                    "flex items-center gap-1.5 w-full px-2 py-1 rounded-md transition-all text-[11px]",
                    "hover:bg-accent",
                    isActive && "bg-accent/50 text-primary"
                  )}
                >
                  <ChildIcon className={cn(
                    "h-3 w-3 flex-shrink-0",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )} />
                  <span className={cn(
                    "truncate",
                    isActive ? "text-primary" : "text-foreground/60"
                  )}>
                    {child.label}
                  </span>
                </button>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// 普通导航项
function NavItemSimple({ item }: NavItemComponentProps) {
  const [location] = useLocation();
  const isActive = location === item.path;
  const Icon = item.icon;
  const isLarge = item.size === 'large';

  return (
    <Link href={item.path!}>
      <button
        className={cn(
          "flex items-center gap-1.5 w-full px-2 py-1.5 rounded-md transition-all text-sm font-medium",
          "hover:bg-accent",
          isActive && "bg-accent/50 text-primary"
        )}
      >
        <Icon className={cn(
          isLarge ? "h-5 w-5" : "h-4 w-4",
          "flex-shrink-0",
          isActive ? "text-primary" : "text-muted-foreground"
        )} />
        <span className={cn(
          "truncate",
          isActive ? "text-primary" : "text-foreground/80"
        )}>
          {item.label}
        </span>
      </button>
    </Link>
  );
}

export function NavItemComponent({ item }: NavItemComponentProps) {
  if (item.children && item.children.length > 0) {
    return <NavItemWithChildren item={item} />;
  }
  return <NavItemSimple item={item} />;
}
