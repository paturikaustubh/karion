"use client";

import { createContext, useContext, useState } from "react";

interface UserSettingsContextValue {
  timeFormat: "12h" | "24h";
  setTimeFormat: (f: "12h" | "24h") => void;
}

const UserSettingsContext = createContext<UserSettingsContextValue>({
  timeFormat: "12h",
  setTimeFormat: () => {},
});

export function useUserSettings() {
  return useContext(UserSettingsContext);
}

export function UserSettingsProvider({
  children,
  initialTimeFormat,
}: {
  children: React.ReactNode;
  initialTimeFormat: "12h" | "24h";
}) {
  const [timeFormat, setTimeFormat] = useState<"12h" | "24h">(initialTimeFormat);

  return (
    <UserSettingsContext.Provider value={{ timeFormat, setTimeFormat }}>
      {children}
    </UserSettingsContext.Provider>
  );
}
