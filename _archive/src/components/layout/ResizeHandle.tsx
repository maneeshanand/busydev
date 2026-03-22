import { Separator } from "react-resizable-panels";
import "./ResizeHandle.css";

interface ResizeHandleProps {
  orientation?: "horizontal" | "vertical";
}

export function ResizeHandle({ orientation = "horizontal" }: ResizeHandleProps) {
  return (
    <Separator className={`resize-handle resize-handle--${orientation}`}>
      <div className="resize-handle__indicator" />
    </Separator>
  );
}
