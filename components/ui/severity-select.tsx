"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const SEVERITY_CLASSES: Record<string, string> = {
  low:    "bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-600",
  medium: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700",
  high:   "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700",
  urgent: "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700",
};

const FALLBACK = "bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-600";

interface SeveritySelectProps {
  value: string;
  onValueChange: (value: string) => void;
  severities: { value: string; label: string }[];
  className?: string;
}

export function SeveritySelect({ value, onValueChange, severities, className }: SeveritySelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={cn(SEVERITY_CLASSES[value] ?? FALLBACK, className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {severities.map((s) => (
          <SelectItem key={s.value} value={s.value}>
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
