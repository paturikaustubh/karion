"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const STATUS_CLASSES: Record<string, string> = {
  todo: "bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-600",
  "in-progress":
    "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700",
  blocked:
    "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700",
  completed:
    "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700",
};

const FALLBACK =
  "bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-600";

interface StatusSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  statuses: { value: string; label: string }[];
  className?: string;
}

export function StatusSelect({
  value,
  onValueChange,
  statuses,
  className,
}: StatusSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        className={cn(STATUS_CLASSES[value] ?? FALLBACK, className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {statuses.map((s) => (
          <SelectItem key={s.value} value={s.value}>
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
