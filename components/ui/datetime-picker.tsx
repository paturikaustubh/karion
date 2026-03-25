// components/ui/datetime-picker.tsx
"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarBlank } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateTimePickerProps {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function DateTimePicker({
  value,
  onChange,
  disabled,
  placeholder = "Pick date & time",
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [hour, setHour] = React.useState(
    value ? String(value.getHours()).padStart(2, "0") : "00"
  );
  const [minute, setMinute] = React.useState(
    value ? String(value.getMinutes()).padStart(2, "0") : "00"
  );

  // Sync local HH/MM when value changes externally
  React.useEffect(() => {
    if (value) {
      setHour(String(value.getHours()).padStart(2, "0"));
      setMinute(String(value.getMinutes()).padStart(2, "0"));
    }
  }, [value]);

  function applyTime(base: Date, h: number, m: number): Date {
    const d = new Date(base);
    d.setHours(h, m, 0, 0);
    return d;
  }

  function handleDateSelect(date: Date | undefined) {
    if (!date) { onChange(undefined); return; }
    const h = Math.min(23, Math.max(0, parseInt(hour, 10) || 0));
    const m = Math.min(59, Math.max(0, parseInt(minute, 10) || 0));
    onChange(applyTime(date, h, m));
  }

  function commitTime() {
    if (!value) return;
    const h = Math.min(23, Math.max(0, parseInt(hour, 10) || 0));
    const m = Math.min(59, Math.max(0, parseInt(minute, 10) || 0));
    setHour(String(h).padStart(2, "0"));
    setMinute(String(m).padStart(2, "0"));
    onChange(applyTime(value, h, m));
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground"
          )}
        >
          <CalendarBlank className="mr-2 h-4 w-4 shrink-0" />
          {value ? format(value, "d MMM yyyy, h:mm a") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={handleDateSelect}
          initialFocus
        />
        <div className="border-t p-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground w-10 shrink-0">Time</Label>
            <div className="flex items-center gap-1">
              <Input
                className="h-8 w-14 text-center text-sm tabular-nums"
                value={hour}
                maxLength={2}
                placeholder="HH"
                onChange={(e) => setHour(e.target.value.replace(/\D/g, ""))}
                onBlur={commitTime}
              />
              <span className="text-sm text-muted-foreground select-none">:</span>
              <Input
                className="h-8 w-14 text-center text-sm tabular-nums"
                value={minute}
                maxLength={2}
                placeholder="MM"
                onChange={(e) => setMinute(e.target.value.replace(/\D/g, ""))}
                onBlur={commitTime}
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
