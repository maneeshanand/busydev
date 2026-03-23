import { useCallback, useRef } from "react";
import "./ResizeHandle.css";

interface ResizeHandleProps {
  onResize: (deltaX: number) => void;
  onResizeEnd: () => void;
  side: "left" | "right";
}

export function ResizeHandle({ onResize, onResizeEnd, side }: ResizeHandleProps) {
  const startXRef = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startXRef.current = e.clientX;

      const handleMouseMove = (e: MouseEvent) => {
        const delta = e.clientX - startXRef.current;
        startXRef.current = e.clientX;
        onResize(delta);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        onResizeEnd();
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [onResize, onResizeEnd]
  );

  return (
    <div
      className={`resize-handle resize-handle-${side}`}
      onMouseDown={handleMouseDown}
    />
  );
}
