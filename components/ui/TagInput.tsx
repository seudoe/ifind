"use client";

import { useState, KeyboardEvent } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  className?: string;
  suggestions?: string[];
}

export function TagInput({
  tags,
  onChange,
  placeholder = "Type and press Enter",
  label,
  error,
  className,
  suggestions = [],
}: TagInputProps) {
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filtered = suggestions.filter(
    (s) =>
      s.toLowerCase().includes(input.toLowerCase()) &&
      !tags.includes(s)
  );

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput("");
    setShowSuggestions(false);
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label className="text-xs font-medium text-[var(--text-2)]">{label}</label>
      )}
      <div
        className={cn(
          "min-h-[38px] w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5",
          "flex flex-wrap gap-1.5 items-center transition-colors duration-[var(--transition)]",
          "focus-within:ring-2 focus-within:ring-[var(--primary)] focus-within:border-[var(--primary)]",
          error && "border-[var(--danger)]"
        )}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-[var(--primary-bg)] px-2.5 py-0.5 text-xs font-medium text-[var(--primary-dk)]"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="hover:text-[var(--primary)] transition-colors"
              aria-label={`Remove ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <div className="relative flex-1 min-w-[100px]">
          <input
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setShowSuggestions(true);
            }}
            onKeyDown={handleKeyDown}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onFocus={() => input && setShowSuggestions(true)}
            placeholder={tags.length === 0 ? placeholder : ""}
            className="w-full text-xs outline-none bg-transparent text-[var(--text)] placeholder:text-[var(--text-3)]"
          />
          {showSuggestions && filtered.length > 0 && (
            <div className="absolute top-full left-0 z-20 mt-1 w-48 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] shadow-lg py-1">
              {filtered.slice(0, 5).map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onMouseDown={() => addTag(suggestion)}
                  className="w-full text-left px-3 py-1.5 text-xs text-[var(--text)] hover:bg-[var(--surface-2)]"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
