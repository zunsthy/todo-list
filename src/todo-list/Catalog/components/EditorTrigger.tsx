import { useEffect, useRef, useState, type PointerEvent } from "react";
import type {
  EditorTriggerDrag,
  EditorTriggerPosition,
  EditorTriggerProps,
} from "../../../types/catalog.js";

const storageKey = "todo-list:editor-trigger-position";

const loadPosition = (): EditorTriggerPosition | null => {
  try {
    const value: unknown = JSON.parse(
      window.localStorage.getItem(storageKey) ?? "null",
    );
    if (
      typeof value === "object" &&
      value !== null &&
      "x" in value &&
      "y" in value &&
      typeof value.x === "number" &&
      typeof value.y === "number" &&
      Number.isFinite(value.x) &&
      Number.isFinite(value.y)
    ) {
      return { x: value.x, y: value.y };
    }
  } catch {
    // Ignore a malformed saved position and use the CSS default.
  }
  return null;
};

const fitInViewport = (
  position: EditorTriggerPosition,
  button: HTMLButtonElement,
): EditorTriggerPosition => ({
  x: Math.min(
    Math.max(0, position.x),
    Math.max(0, window.innerWidth - button.offsetWidth),
  ),
  y: Math.min(
    Math.max(0, position.y),
    Math.max(0, window.innerHeight - button.offsetHeight),
  ),
});

const savePosition = (position: EditorTriggerPosition): void => {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(position));
  } catch {
    // Dragging still works when storage is unavailable.
  }
};

export const EditorTrigger = ({ onOpen }: EditorTriggerProps) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<EditorTriggerDrag | null>(null);
  const ignoreClickRef = useRef(false);
  const [position, setPosition] = useState<EditorTriggerPosition | null>(
    loadPosition,
  );
  const positionRef = useRef(position);

  const moveTo = (next: EditorTriggerPosition): void => {
    positionRef.current = next;
    setPosition(next);
  };

  useEffect(() => {
    const handleResize = (): void => {
      const button = buttonRef.current;
      const current = positionRef.current;
      if (!button || !current) return;
      const next = fitInViewport(current, button);
      moveTo(next);
      savePosition(next);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>): void => {
    if (event.button !== 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - bounds.left,
      offsetY: event.clientY - bounds.top,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>): void => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.moved ||=
      Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) >= 4;
    if (!drag.moved) return;

    event.preventDefault();
    moveTo(
      fitInViewport(
        {
          x: event.clientX - drag.offsetX,
          y: event.clientY - drag.offsetY,
        },
        event.currentTarget,
      ),
    );
  };

  const handlePointerEnd = (
    event: PointerEvent<HTMLButtonElement>,
    suppressClick = true,
  ): void => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    ignoreClickRef.current = suppressClick && drag.moved;
    if (drag.moved && positionRef.current) savePosition(positionRef.current);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  };

  return (
    <button
      aria-haspopup="dialog"
      className="editor-trigger"
      onClick={() => {
        if (ignoreClickRef.current) {
          ignoreClickRef.current = false;
          return;
        }
        onOpen();
      }}
      onPointerCancel={(event) => handlePointerEnd(event, false)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      ref={buttonRef}
      style={
        position
          ? { left: position.x, right: "auto", top: position.y }
          : undefined
      }
      title="拖拽移动，单击打开"
      type="button"
    >
      数据管理
    </button>
  );
};
