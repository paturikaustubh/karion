"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
  House,
  ListChecks,
  FileText,
  ChartBar,
  Timer,
  Sun,
  Moon,
  SignOut,
  Clock,
} from "@phosphor-icons/react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/components/providers/auth-provider";
import { useUserSettings } from "@/components/providers/user-settings-provider";
import { apiFetch } from "@/lib/api-client";

const navItems = [
  { title: "Dashboard", href: "/dashboard", icon: House },
  { title: "Tasks", href: "/tasks", icon: ListChecks },
  { title: "Reports", href: "/reports", icon: FileText },
  { title: "Analytics", href: "/analytics", icon: ChartBar },
];

function getInitials(fullName: string): string {
  const words = fullName.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function UserAvatar() {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { timeFormat, setTimeFormat } = useUserSettings();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const initials = user?.fullName ? getInitials(user.fullName) : "?";
  const isDark = mounted && theme === "dark";

  async function handleSignOut() {
    await signOut();
  }

  async function handleThemeToggle() {
    const newTheme = isDark ? "light" : "dark";
    setTheme(newTheme);
    apiFetch("/api/user/settings", {
      method: "PATCH",
      body: JSON.stringify({ settings: { theme: newTheme } }),
      silent: true,
    }).catch(() => {});
  }

  function handleTimeFormatToggle() {
    const newFmt = timeFormat === "12h" ? "24h" : "12h";
    setTimeFormat(newFmt);
    apiFetch("/api/user/settings", {
      method: "PATCH",
      body: JSON.stringify({ settings: { time_format: newFmt } }),
      silent: true,
    }).catch(() => {});
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          size="lg"
          className="group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:overflow-visible"
          tooltip={user?.fullName ?? "Account"}
        >
          <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold select-none">
            {initials}
          </div>
          <div className="flex flex-col gap-0.5 leading-none overflow-hidden">
            <span className="font-medium text-sm truncate">{user?.fullName ?? "—"}</span>
            <span className="text-xs text-muted-foreground truncate">{user?.username ? `@${user.username}` : ""}</span>
          </div>
        </SidebarMenuButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent side="right" align="end" className="w-48 mb-1">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          {user?.email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={handleThemeToggle}>
            {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {isDark ? "Light mode" : "Dark mode"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleTimeFormatToggle}>
            <Clock className="size-4" />
            {timeFormat === "12h" ? "Switch to 24hr" : "Switch to 12hr"}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
            <SignOut className="size-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="border-b border-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              className="group-data-[collapsible=icon]:!p-0"
            >
              <Link href="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Timer weight="bold" className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold text-sm">Karion</span>
                  <span className="text-xs text-muted-foreground">
                    Productivity
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href);

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                      <Link href={item.href}>
                        <item.icon weight={isActive ? "fill" : "regular"} />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <UserAvatar />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
