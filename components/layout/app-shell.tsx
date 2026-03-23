"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/header";
import { apiFetch } from "@/lib/api-client";
import { UserSettingsProvider } from "@/components/providers/user-settings-provider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { setTheme } = useTheme();
  const setThemeRef = useRef(setTheme);
  setThemeRef.current = setTheme;

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [timeFormat, setTimeFormat] = useState<"12h" | "24h">("12h");

  useEffect(() => {
    apiFetch("/api/user/settings")
      .then((res) => res.json())
      .then((data) => {
        const settings = data.data ?? {};
        if (settings.sidebar_state === "collapsed") setSidebarOpen(false);
        if (settings.theme) setThemeRef.current(settings.theme);
        if (settings.time_format === "24h") setTimeFormat("24h");
      })
      .catch(() => {})
      .finally(() => setSettingsLoaded(true));
  }, []);

  const handleOpenChange = (open: boolean) => {
    setSidebarOpen(open);
    apiFetch("/api/user/settings", {
      method: "PATCH",
      body: JSON.stringify({
        settings: { sidebar_state: open ? "open" : "collapsed" },
      }),
      silent: true,
    }).catch(() => {});
  };

  if (!settingsLoaded) return null;

  return (
    <TooltipProvider>
      <UserSettingsProvider initialTimeFormat={timeFormat}>
        <SidebarProvider open={sidebarOpen} onOpenChange={handleOpenChange}>
          <AppSidebar />
          <SidebarInset className="flex flex-col min-h-0">
            <AppHeader />
            <div className="flex-1 overflow-auto">
              <div className="p-6 pb-4">{children}</div>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </UserSettingsProvider>
    </TooltipProvider>
  );
}
