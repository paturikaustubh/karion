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
  AlarmCheck,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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

/** Convert UTC "HH:mm" to local HH and MM numbers */
function utcHHmmToLocal(utcHHmm: string): { h: number; m: number } {
  const [uh, um] = utcHHmm.split(":").map(Number);
  const d = new Date();
  d.setUTCHours(uh, um, 0, 0);
  return { h: d.getHours(), m: d.getMinutes() };
}

/** Convert local HH + MM numbers to UTC "HH:mm" string */
function localHMtoUTC(h: number, m: number): string {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

function UserAvatar() {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const {
    timeFormat,
    setTimeFormat,
    checkInTime,
    setCheckInTime,
    checkInDialogOpen,
    setCheckInDialogOpen,
  } = useUserSettings();
  const [mounted, setMounted] = useState(false);
  const [localH, setLocalH] = useState("09");
  const [localM, setLocalM] = useState("00");

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

  function handleCheckInOpenChange(open: boolean) {
    if (open) {
      const { h, m } = utcHHmmToLocal(checkInTime);
      setLocalH(String(h).padStart(2, "0"));
      setLocalM(String(m).padStart(2, "0"));
    }
    setCheckInDialogOpen(open);
  }

  async function handleCheckInSave() {
    const h = Math.min(23, Math.max(0, parseInt(localH, 10) || 0));
    const m = Math.min(59, Math.max(0, parseInt(localM, 10) || 0));
    const utc = localHMtoUTC(h, m);
    setCheckInTime(utc);
    setCheckInDialogOpen(false);
    await apiFetch("/api/user/settings", {
      method: "PATCH",
      body: JSON.stringify({ settings: { check_in_time: utc } }),
      silent: true,
    }).catch(() => {});
  }

  return (
    <>
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
            <DropdownMenuItem onClick={() => handleCheckInOpenChange(true)}>
              <AlarmCheck className="size-4" />
              <span>
                Check-in:{" "}
                {(() => {
                  const { h, m } = utcHHmmToLocal(checkInTime);
                  const d = new Date();
                  d.setHours(h, m, 0, 0);
                  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
                })()}
              </span>
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

      <Dialog open={checkInDialogOpen} onOpenChange={handleCheckInOpenChange}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Check-in Time</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This is when your workday starts. Used to set default report windows.
          </p>
          <div className="flex items-center gap-2 py-2">
            <Label className="w-10 text-xs text-muted-foreground shrink-0">Time</Label>
            <div className="flex items-center gap-1">
              <Input
                className="h-9 w-16 text-center tabular-nums"
                value={localH}
                maxLength={2}
                placeholder="HH"
                onChange={(e) => setLocalH(e.target.value.replace(/\D/g, ""))}
                onBlur={() => {
                  const h = Math.min(23, Math.max(0, parseInt(localH, 10) || 0));
                  setLocalH(String(h).padStart(2, "0"));
                }}
              />
              <span className="text-sm text-muted-foreground select-none">:</span>
              <Input
                className="h-9 w-16 text-center tabular-nums"
                value={localM}
                maxLength={2}
                placeholder="MM"
                onChange={(e) => setLocalM(e.target.value.replace(/\D/g, ""))}
                onBlur={() => {
                  const m = Math.min(59, Math.max(0, parseInt(localM, 10) || 0));
                  setLocalM(String(m).padStart(2, "0"));
                }}
              />
            </div>
            <span className="text-xs text-muted-foreground">(local time)</span>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCheckInDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCheckInSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
