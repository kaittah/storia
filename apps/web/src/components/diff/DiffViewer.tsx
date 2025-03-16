import { useEffect, useState } from "react";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer";
import { cn } from "@/lib/utils";

export interface DiffProps {
  oldText: string;
  newText: string;
  splitView?: boolean;
  className?: string;
}

export const DiffViewer = ({
  oldText,
  newText,
  splitView = false,
  className,
}: DiffProps) => {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  if (!mounted) return null;

  return (
    <div className={cn("font-mono text-sm", className)}>
      <ReactDiffViewer
        oldValue={oldText}
        newValue={newText}
        splitView={splitView}
        compareMethod={DiffMethod.WORDS}
        useDarkTheme={true}
        styles={{
          contentText: {
            fontSize: "14px",
            lineHeight: "1.5",
          },
        }}
      />
    </div>
  );
}

export { DiffViewer as Diff }; 