"use client";

import { createContext, useContext, useState } from "react";

interface UserSettingsContextValue {
  timeFormat: "12h" | "24h";
  setTimeFormat: (f: "12h" | "24h") => void;
  checkInTime: string;
  setCheckInTime: (t: string) => void;
  checkInDialogOpen: boolean;
  setCheckInDialogOpen: (open: boolean) => void;
}

const UserSettingsContext = createContext<UserSettingsContextValue>({
  timeFormat: "12h",
  setTimeFormat: () => {},
  checkInTime: "09:00",
  setCheckInTime: () => {},
  checkInDialogOpen: false,
  setCheckInDialogOpen: () => {},
});

export function useUserSettings() {
  return useContext(UserSettingsContext);
}

export function UserSettingsProvider({
  children,
  initialTimeFormat,
  initialCheckInTime = "09:00",
}: {
  children: React.ReactNode;
  initialTimeFormat: "12h" | "24h";
  initialCheckInTime?: string;
}) {
  const [timeFormat, setTimeFormat] = useState<"12h" | "24h">(initialTimeFormat);
  const [checkInTime, setCheckInTime] = useState<string>(initialCheckInTime);
  const [checkInDialogOpen, setCheckInDialogOpen] = useState(false);

  return (
    <UserSettingsContext.Provider
      value={{ timeFormat, setTimeFormat, checkInTime, setCheckInTime, checkInDialogOpen, setCheckInDialogOpen }}
    >
      {children}
    </UserSettingsContext.Provider>
  );
}
