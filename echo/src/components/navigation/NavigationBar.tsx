import { NavItemComponent } from "./NavGroupSection";
import { NAV_ITEMS } from "@/config/navigation";

export function NavigationBar() {
  return (
    <nav className="hidden sm:flex flex-col bg-background border-r h-screen w-28 flex-shrink-0">
      <div className="flex-1 overflow-y-auto py-3 px-1">
        <div className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => (
            <NavItemComponent key={item.id} item={item} />
          ))}
        </div>
      </div>
    </nav>
  );
}
