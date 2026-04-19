"use client";

import { Maximize2, Minus, Plus } from "lucide-react";

export function ZoomControls({
  onZoomIn,
  onZoomOut,
  onReset,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}) {
  return (
    <div className="absolute bottom-3 right-3 z-20 flex flex-col gap-1 rounded-full border border-border/70 bg-surface/80 p-1 backdrop-blur-md shadow-sm">
      <IconButton label="Zoom in" onClick={onZoomIn}>
        <Plus className="h-3.5 w-3.5" strokeWidth={2} />
      </IconButton>
      <IconButton label="Zoom out" onClick={onZoomOut}>
        <Minus className="h-3.5 w-3.5" strokeWidth={2} />
      </IconButton>
      <IconButton label="Reset view" onClick={onReset}>
        <Maximize2 className="h-3 w-3" strokeWidth={2} />
      </IconButton>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-foreground/5 hover:text-text"
    >
      {children}
    </button>
  );
}
