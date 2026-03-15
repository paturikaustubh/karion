"use client";

import { usePathname } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/tasks": "Tasks",
  "/reports": "Reports",
  "/analytics": "Analytics",
};

export function AppHeader() {
  const pathname = usePathname();

  const getTitle = () => {
    if (pageTitles[pathname]) return pageTitles[pathname];
    if (pathname.startsWith("/tasks/")) return "Task Detail";
    if (pathname.startsWith("/reports/")) return "Report";
    return "Karion";
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 !h-4" />
      <h1 className="text-sm font-semibold">{getTitle()}</h1>
    </header>
  );
}
