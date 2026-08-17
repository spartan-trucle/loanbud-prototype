import { useLocation, useNavigate } from "react-router";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import * as Tooltip from "@radix-ui/react-tooltip";
import type { AppSidebarSection } from "../../types";
import { useAppData } from "../../contexts/AppDataContext";

interface AppSidebarProps {
  sections: AppSidebarSection[];
  collapsed: boolean;
  onToggle: () => void;
}

export function AppSidebar({
  sections,
  collapsed,
  onToggle,
}: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { taskItems } = useAppData();

  // V2 (RFC-008): live open-task badge on the Tasks nav — no notification service needed.
  const isTaskOpen = (status: string) => status !== "completed" && status !== "suspended";
  const openTaskCount =
    taskItems.filter((t) => isTaskOpen(t.status)).length;
  const dueTodayCount =
    taskItems.filter((t) => {
          if (!isTaskOpen(t.status)) return false;
          const d = new Date(t.dueDate);
          const now = new Date();
          return (
            d.getFullYear() === now.getFullYear() &&
            d.getMonth() === now.getMonth() &&
            d.getDate() === now.getDate()
          );
        }).length;
  const badgeForId = (id: string): number =>
    id === "crm" || id === "crm-tasks" ? openTaskCount : 0;

  const isActive = (route?: string) => {
    if (!route) return false;
    return (
      location.pathname === route || location.pathname.startsWith(route + "/")
    );
  };

  const hasActiveChild = (item: AppSidebarSection["items"][number]) =>
    (item.children ?? []).some(
      (child) =>
        location.pathname === child.route ||
        location.pathname.startsWith(child.route + "/")
    );

  const handleItemClick = (route?: string) => {
    if (route) navigate(route);
  };

  const renderLeafItem = (item: AppSidebarSection["items"][number]) => {
    const Icon = item.icon;
    const active = isActive(item.route);
    const btn = (
      <button
        key={item.id}
        onClick={() => handleItemClick(item.route)}
        className={`
          w-full flex items-center gap-3 rounded-lg transition-all duration-150
          ${collapsed ? "justify-center p-3" : "px-3 py-2"}
          ${
            active
              ? "bg-[#4ade80] text-white"
              : "text-white/70 hover:bg-white/10 hover:text-white"
          }
        `}
      >
        <Icon className="w-5 h-5 shrink-0" />
        {!collapsed && (
          <>
            <span className="text-sm flex-1 text-left">{item.label}</span>
            {item.externalIcon && (
              <ExternalLink className="w-3.5 h-3.5 opacity-50" />
            )}
          </>
        )}
      </button>
    );

    if (collapsed) {
      return (
        <Tooltip.Provider key={item.id} delayDuration={300}>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>{btn}</Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                side="right"
                sideOffset={12}
                className="z-[100] px-3 py-1.5 rounded bg-gray-900 text-white text-xs shadow-xl animate-in fade-in zoom-in-95 duration-200"
              >
                {item.label}
                <Tooltip.Arrow className="fill-gray-900" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      );
    }

    return btn;
  };

  const renderFlyoutItem = (item: AppSidebarSection["items"][number]) => {
    const Icon = item.icon;
    const active = hasActiveChild(item);
    const badge = badgeForId(item.id);

    const trigger = collapsed ? (
      <button
        className={`relative w-full flex justify-center p-3 rounded-lg transition-all duration-150
          ${active ? "bg-white/20 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`}
      >
        <Icon className="w-5 h-5 shrink-0" />
        {badge > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#4ade80] text-[#053f4f] text-[9px] font-bold flex items-center justify-center">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </button>
    ) : (
      <button
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150
          ${active ? "bg-white/20 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`}
      >
        <Icon className="w-5 h-5 shrink-0" />
        <span className="text-sm flex-1 text-left">{item.label}</span>
        {badge > 0 && (
          <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#4ade80] text-[#053f4f] text-[10px] font-bold flex items-center justify-center shrink-0">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
        <ChevronRight className="w-3.5 h-3.5 opacity-50 shrink-0" />
      </button>
    );

    return (
      <Tooltip.Provider key={item.id} delayDuration={100}>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>{trigger}</Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              side="right"
              sideOffset={8}
              align="start"
              className="z-[100] bg-[#053f4f] border border-white/10 rounded-lg shadow-xl py-2 min-w-[168px] animate-in fade-in zoom-in-95 duration-150"
            >
              <p className="text-white/40 text-[10px] font-semibold uppercase tracking-wider px-4 pb-1.5">
                {item.label}
              </p>
              {(item.children ?? []).map((child) => {
                const ChildIcon = child.icon;
                const childActive =
                  location.pathname === child.route ||
                  location.pathname.startsWith(child.route + "/");


                return (
                  <button
                    key={child.id}
                    onClick={() => navigate(child.route)}
                    className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors
                      ${childActive ? "text-white bg-white/15" : "text-white/70 hover:text-white hover:bg-white/10"}`}
                  >
                    {ChildIcon && <ChildIcon className="w-4 h-4 shrink-0" />}
                    <span>{child.label}</span>
                    {badgeForId(child.id) > 0 && (
                      <span className="ml-auto flex items-center gap-1.5 shrink-0">
                        {dueTodayCount > 0 && (
                          <span className="text-[9px] font-semibold text-amber-300 whitespace-nowrap">
                            {dueTodayCount} today
                          </span>
                        )}
                        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#4ade80] text-[#053f4f] text-[10px] font-bold flex items-center justify-center">
                          {openTaskCount > 99 ? "99+" : openTaskCount}
                        </span>
                      </span>
                    )}
                  </button>
                );
              })}
              <Tooltip.Arrow className="fill-[#053f4f]" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
    );
  };

  const renderItem = (item: AppSidebarSection["items"][number]) =>
    item.children?.length ? renderFlyoutItem(item) : renderLeafItem(item);

  return (
    <aside
      className="flex flex-col bg-[#053f4f] text-white shadow-xl transition-all duration-200 shrink-0"
      style={{ width: collapsed ? 64 : 220 }}
    >
      {/* Header — logo */}
      <div className="flex flex-col border-b border-white/10 shrink-0">
        <div className={`flex items-center h-14 px-3 ${collapsed ? "justify-center" : ""}`}>
          <div
            className={`flex items-center gap-2 overflow-hidden ${collapsed ? "w-full justify-center" : ""}`}
          >
            <img
              src={`${import.meta.env.BASE_URL}symbol.png`}
              alt="LoanBud"
              width={22}
              height={22}
              className="object-contain shrink-0"
            />
            {!collapsed && (
              <span className="text-white font-semibold text-base whitespace-nowrap">
                LoanBud
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3">
        {sections.map((section, si) => (
          <div key={si}>
            {si > 0 && <hr className="border-white/10 mx-2 my-2" />}
            {!collapsed && section.label && (
              <p className="text-white/40 text-[10px] font-semibold uppercase tracking-wider px-4 mb-1">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5 px-2">
              {section.items.map(renderItem)}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer — toggle */}
      <div className="border-t border-white/10 shrink-0">
        <div className={`flex items-center px-2 py-2 ${collapsed ? "justify-center" : "justify-end"}`}>
          <button
            onClick={onToggle}
            className={`p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors shrink-0
              ${collapsed ? "w-full flex justify-center" : ""}`}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
