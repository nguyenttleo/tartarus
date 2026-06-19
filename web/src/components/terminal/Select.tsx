"use client";

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

// A fully custom, keyboard-navigable dropdown styled as a terminal pick-list.
// The menu is portaled to the document body so parent overflow never clips it.
export function Select({
  value,
  options,
  onChange,
  label,
  ariaLabel,
  className = "",
  align = "left",
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  label?: string;
  ariaLabel: string;
  className?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const baseId = useId();

  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  );
  const selected = options[selectedIndex];

  const updateMenuPosition = useCallback(() => {
    const root = rootRef.current;
    if (!root || typeof window === "undefined") return;

    const rect = root.getBoundingClientRect();
    const gutter = 8;
    const ctx = document.createElement("canvas").getContext("2d");
    if (ctx) ctx.font = getComputedStyle(root).font;
    const optionTextWidth = ctx
      ? Math.max(...options.map((opt) => ctx.measureText(opt.label).width), 0)
      : Math.max(...options.map((opt) => opt.label.length * 8.5), 0);
    const disabledMarkerWidth = options.some((opt) => opt.disabled) ? 36 : 0;
    const listChromeWidth = 24 + 12 + 8 + 18 + disabledMarkerWidth + 48;
    const measuredListWidth = listRef.current?.scrollWidth ?? 0;
    const maxWidth = window.innerWidth - gutter * 2;
    const width = Math.min(
      maxWidth,
      Math.ceil(Math.max(rect.width + 32, optionTextWidth + listChromeWidth, measuredListWidth))
    );
    let left = align === "right" ? rect.right - width : rect.left;
    left = Math.min(Math.max(gutter, left), Math.max(gutter, window.innerWidth - width - gutter));

    const belowTop = rect.bottom + 4;
    const belowSpace = window.innerHeight - belowTop - gutter;
    const aboveSpace = rect.top - gutter;
    const openAbove = belowSpace < 160 && aboveSpace > belowSpace;
    const maxHeight = Math.max(96, Math.min(256, openAbove ? aboveSpace : belowSpace));
    const top = openAbove ? Math.max(gutter, rect.top - maxHeight - 4) : belowTop;

    setMenuStyle({
      left,
      top,
      width,
      maxHeight,
    });
  }, [align, options]);

  const openMenu = () => {
    setActive(selectedIndex);
    updateMenuPosition();
    setOpen(true);
  };

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Keep the portaled menu pinned to its button while the page scrolls or resizes.
  useEffect(() => {
    if (!open) return;
    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, updateMenuPosition]);

  // Keep the active option scrolled into view.
  useEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current
      .querySelector<HTMLElement>(`[data-idx="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const commit = (idx: number) => {
    const opt = options[idx];
    if (!opt || opt.disabled) return;
    onChange(opt.value);
    setOpen(false);
  };

  const step = (dir: 1 | -1) =>
    setActive((cur) => {
      let i = cur;
      for (let n = 0; n < options.length; n++) {
        i = (i + dir + options.length) % options.length;
        if (!options[i]?.disabled) return i;
      }
      return cur;
    });

  const edge = (which: "first" | "last") => {
    const order = which === "first" ? options.map((_, i) => i) : options.map((_, i) => i).reverse();
    const found = order.find((i) => !options[i]?.disabled);
    if (found != null) setActive(found);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (open) step(1);
        else openMenu();
        break;
      case "ArrowUp":
        e.preventDefault();
        if (open) step(-1);
        else openMenu();
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (open) commit(active);
        else openMenu();
        break;
      case "Home":
        if (open) {
          e.preventDefault();
          edge("first");
        }
        break;
      case "End":
        if (open) {
          e.preventDefault();
          edge("last");
        }
        break;
      case "Escape":
        if (open) {
          e.preventDefault();
          setOpen(false);
        }
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${baseId}-list` : undefined}
        aria-label={ariaLabel}
        aria-activedescendant={open ? `${baseId}-opt-${active}` : undefined}
        // Mouse clicks have detail >= 1; keyboard-synthesized clicks (detail 0)
        // are handled in onKeyDown, so ignore them here to avoid double-toggling.
        onClick={(e) => {
          if (e.detail === 0) return;
          if (open) setOpen(false);
          else openMenu();
        }}
        onKeyDown={onKeyDown}
        className="field flex w-full items-center gap-2 px-3 py-2 text-sm"
      >
        {label && (
          <span className="font-terminal text-xs uppercase tracking-wider text-muted">{label}</span>
        )}
        <span className="truncate text-foreground">{selected?.label ?? value}</span>
        <span
          aria-hidden
          className={`ml-auto text-accent transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>

      {open &&
        menuStyle &&
        typeof document !== "undefined" &&
        createPortal(
        <ul
          ref={listRef}
          id={`${baseId}-list`}
          role="listbox"
          aria-label={ariaLabel}
          tabIndex={-1}
          style={menuStyle}
          className="pop-in fixed z-[120] overflow-x-hidden overflow-y-auto rounded-md border border-accent/45 bg-[#070b0e] py-1 font-mono text-sm shadow-[0_0_0_1px_rgba(0,0,0,0.7),0_18px_44px_-16px_rgba(70,247,164,0.4)]"
        >
          {options.map((opt, idx) => {
            const isSelected = opt.value === value;
            const isActive = idx === active;
            return (
              <li
                id={`${baseId}-opt-${idx}`}
                key={opt.value}
                data-idx={idx}
                role="option"
                aria-selected={isSelected}
                aria-disabled={opt.disabled || undefined}
                onMouseEnter={() => !opt.disabled && setActive(idx)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(idx)}
                className={`flex cursor-pointer items-center gap-2 whitespace-nowrap px-3 py-1.5 ${
                  opt.disabled
                    ? "cursor-not-allowed text-faint"
                    : isActive
                      ? "bg-accent/15 text-accent"
                      : isSelected
                        ? "text-accent"
                        : "text-foreground hover:text-accent"
                }`}
              >
                <span className="w-3 shrink-0 text-accent">
                  {isSelected ? "▸" : isActive ? "›" : ""}
                </span>
                <span className="flex-1">{opt.label}</span>
                {opt.disabled && <span className="ml-2 text-[11px] text-faint">n/a</span>}
              </li>
            );
          })}
        </ul>,
        document.body
      )}
    </div>
  );
}
