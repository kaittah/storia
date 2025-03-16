import { Dispatch, SetStateAction, useEffect, useRef, useState, useCallback, useMemo } from "react";
import { ArtifactV3, ArtifactMarkdownV3 } from "@storia/shared/types";
import "@blocknote/core/fonts/inter.css";
import {
  getDefaultReactSlashMenuItems,
  SuggestionMenuController,
  useCreateBlockNote,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import "@blocknote/shadcn/style.css";
import { isArtifactMarkdownContent } from "@storia/shared/utils/artifacts";
import { CopyText } from "./components/CopyText";
import { getArtifactContent } from "@storia/shared/utils/artifacts";
import { useGraphContext } from "@/contexts/GraphContext";
import React from "react";
import { TooltipIconButton } from "../ui/assistant-ui/tooltip-icon-button";
import { CheckCircle, ChevronDown, ChevronUp, Eye, EyeOff, X } from "lucide-react";
import { motion } from "framer-motion";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";
import { debounce } from "lodash";

const cleanText = (text: string) => {
  return text.replace(/\\\n/g, "\n");
};

/**
 * More advanced markdown block splitter that preserves markdown structure
 */
const splitIntoBlocks = (markdown: string): string[] => {
  // Split by headings or multiple newlines (common paragraph separators)
  const parts = markdown.split(/(^#{1,6}\s.*$|^\n{2,})/gm);
  
  // Recombine the parts into logical blocks
  const blocks: string[] = [];
  let currentBlock = '';
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    
    // If it's a heading or paragraph separator
    if (part.match(/^#{1,6}\s.*$/m) || part.match(/^\n{2,}$/m)) {
      // Save the previous block if it exists
      if (currentBlock.trim()) {
        blocks.push(currentBlock.trim());
      }
      
      // Start a new block with this heading
      if (part.match(/^#{1,6}\s.*$/m)) {
        currentBlock = part;
      } else {
        currentBlock = '';
      }
    } else {
      // Append to the current block
      currentBlock += part;
    }
  }
  
  // Don't forget the last block
  if (currentBlock.trim()) {
    blocks.push(currentBlock.trim());
  }
  
  return blocks.filter(b => b.trim().length > 0);
};

/**
 * Compares two sets of markdown blocks and returns a mapping of changes
 */
const findDifferentBlocks = (original: string[], edited: string[]): Map<number, {original: string, edited: string}> => {
  const diffMap = new Map<number, {original: string, edited: string}>();
  
  // Map for detecting similar blocks that might have moved
  // Using the first 50 chars as a rough identifier
  const originalBlocksMap = new Map<string, number>();
  original.forEach((block, index) => {
    const key = block.slice(0, Math.min(50, block.length));
    originalBlocksMap.set(key, index);
  });
  
  // First, try to match blocks based on position and similarity
  for (let i = 0; i < edited.length; i++) {
    const editedBlock = edited[i];
    
    // Get corresponding original block by position
    const originalBlock = i < original.length ? original[i] : '';
    
    if (originalBlock !== editedBlock) {
      // Check if this is a new block or a moved block
      const keyPrefix = editedBlock.slice(0, Math.min(50, editedBlock.length));
      const possibleOriginalIndex = originalBlocksMap.get(keyPrefix);
      
      if (possibleOriginalIndex !== undefined && possibleOriginalIndex !== i) {
        // Block may have moved or been modified
        diffMap.set(i, {
          original: original[possibleOriginalIndex],
          edited: editedBlock
        });
      } else {
        // New block or modified block
        diffMap.set(i, {
          original: originalBlock,
          edited: editedBlock
        });
      }
    }
  }
  
  // Find deleted blocks
  for (let i = 0; i < original.length; i++) {
    const originalBlock = original[i];
    const isDeletedBlock = edited.length <= i || 
      (diffMap.get(i)?.edited !== edited[i] && !edited.includes(originalBlock));
    
    if (isDeletedBlock && !diffMap.has(i)) {
      diffMap.set(i, {
        original: originalBlock,
        edited: ''
      });
    }
  }
  
  return diffMap;
};

// Helper to get a simplified summary of changes
const getChangeSummary = (original: string, edited: string): string => {
  if (!original && edited) return "Added new content";
  if (original && !edited) return "Removed content";
  
  const lengthDiff = edited.length - original.length;
  if (lengthDiff > 0) return `Added ${lengthDiff} characters`;
  if (lengthDiff < 0) return `Removed ${Math.abs(lengthDiff)} characters`;
  
  return "Modified content";
};

function ViewRawText({
  isRawView,
  setIsRawView,
}: {
  isRawView: boolean;
  setIsRawView: Dispatch<SetStateAction<boolean>>;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <TooltipIconButton
        tooltip={`View ${isRawView ? "rendered" : "raw"} markdown`}
        variant="outline"
        delayDuration={400}
        onClick={() => setIsRawView((p) => !p)}
      >
        {isRawView ? (
          <EyeOff className="w-5 h-5 text-gray-600" />
        ) : (
          <Eye className="w-5 h-5 text-gray-600" />
        )}
      </TooltipIconButton>
    </motion.div>
  );
}

export interface TextRendererProps {
  isEditing: boolean;
  isHovering: boolean;
  isInputVisible: boolean;
}

export function TextRendererComponent(props: TextRendererProps) {
  // Create editor with a proper initial content structure
  const editor = useCreateBlockNote({
    initialContent: [{
      id: "1",
      type: "paragraph",
      props: {},
      content: [{ type: "text", text: "", styles: {} }]
    }]
  });
  
  const { graphData } = useGraphContext();
  const {
    artifact,
    isStreaming,
    updateRenderedArtifactRequired,
    firstTokenReceived,
    setArtifact,
    setSelectedBlocks,
    setUpdateRenderedArtifactRequired,
  } = graphData;

  const [rawMarkdown, setRawMarkdown] = useState("");
  const [isRawView, setIsRawView] = useState(false);
  const [manuallyUpdatingArtifact, setManuallyUpdatingArtifact] = useState(false);
  const isComposition = useRef(false);
  
  // New state for tracking edited blocks
  const [editedBlocks, setEditedBlocks] = useState<Map<number, {original: string, edited: string}>>(new Map());
  const [showDiffView, setShowDiffView] = useState(true);
  
  // Track if we're currently showing differences from an operation
  const [hasEditingOperation, setHasEditingOperation] = useState(false);
  
  // Track expanded diff blocks
  const [expandedDiffs, setExpandedDiffs] = useState<Set<number>>(new Set());
  
  // Previous artifact ref to detect changes
  const prevArtifactRef = useRef<typeof artifact>();
  
  // Reference to original and current blocks
  const [originalBlocks, setOriginalBlocks] = useState<string[]>([]);
  const [currentBlocks, setCurrentBlocks] = useState<string[]>([]);
  
  // Add this at the top with other refs
  const lastBlockSignatureRef = useRef<string>();
  
  // Toggle a diff block's expanded state
  const toggleDiffExpand = (blockIndex: number) => {
    setExpandedDiffs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(blockIndex)) {
        newSet.delete(blockIndex);
      } else {
        newSet.add(blockIndex);
      }
      return newSet;
    });
  };
  
  // For debugging - log when artifact changes
  useEffect(() => {
    if (!artifact) return;
    
    console.log("Artifact updated:", {
      currentIndex: artifact.currentIndex,
      contentsLength: artifact.contents.length,
      hasEditingOperation: (artifact as any).isEditOperation
    });
    
    // Flag from GraphContext that explicitly marks this as an edit operation
    if ((artifact as any).isEditOperation) {
      setHasEditingOperation(true);
    }
  }, [artifact]);

  // Check for artifact versions and detect edits
  useEffect(() => {
    const updateContent = async () => {
      if (!artifact) return;
      
      const currentArtifactContent = getArtifactContent(artifact);
      if (!isArtifactMarkdownContent(currentArtifactContent)) return;
      
      const content = cleanText(currentArtifactContent.fullMarkdown);
      setRawMarkdown(content);
      
      try {
        if (editor) {
          // Convert markdown to blocks using BlockNote's API
          const blocks = await editor.tryParseMarkdownToBlocks(content);
          
          // Then replace the blocks in the editor
          if (blocks && blocks.length > 0) {
            editor.replaceBlocks(editor.document, blocks);
          }
        }
      } catch (error) {
        console.error("Error updating editor content:", error);
      }
      
      // Check for edits if this is from an edit operation
      if ((artifact as any).isEditOperation && artifact.contents.length > 1) {
        const currentContent = currentArtifactContent.fullMarkdown;
        const previousContent = artifact.contents
          .filter(c => c.index < artifact.currentIndex)
          .pop();
        
        if (previousContent && isArtifactMarkdownContent(previousContent)) {
          const originalBlocks = splitIntoBlocks(previousContent.fullMarkdown);
          const editedBlocks = splitIntoBlocks(currentContent);
          
          setOriginalBlocks(originalBlocks);
          setCurrentBlocks(editedBlocks);
          
          const diffs = findDifferentBlocks(originalBlocks, editedBlocks);
          
          setEditedBlocks(diffs);
          setHasEditingOperation(true);
          
          // Auto-expand first few diffs
          const newExpandedDiffs = new Set<number>();
          Array.from(diffs.keys())
            .slice(0, 3)
            .forEach(index => newExpandedDiffs.add(index));
          setExpandedDiffs(newExpandedDiffs);
        }
      }
    };
    
    updateContent();
  }, [artifact]);
  
  // Accept a single change
  const acceptChange = (blockIndex: number) => {
    if (!artifact) return;
    
    const content = getArtifactContent(artifact);
    if (!isArtifactMarkdownContent(content)) return;
    
    // Get the edited block
    const { edited } = editedBlocks.get(blockIndex) || { edited: '' };
    
    // Create updated blocks with this edit applied
    const newBlocks = [...currentBlocks];
    newBlocks[blockIndex] = edited;
    
    // Join blocks back together
    const newMarkdown = newBlocks.join('\n\n');
    
    // Update the artifact
    setArtifact({
      ...artifact,
      contents: artifact.contents.map(c => {
        if (c.index === artifact.currentIndex && isArtifactMarkdownContent(c)) {
          return {
            ...c,
            fullMarkdown: newMarkdown,
          };
        }
        return c;
      }),
    });
    
    // Remove this edit from pending edits
    const newEditedBlocks = new Map(editedBlocks);
    newEditedBlocks.delete(blockIndex);
    setEditedBlocks(newEditedBlocks);
    
    // If no more edits, clear editing operation flag
    if (newEditedBlocks.size === 0) {
      setHasEditingOperation(false);
    }
  };
  
  // Reject a single change
  const rejectChange = (blockIndex: number) => {
    // Remove this edit from pending edits
    const newEditedBlocks = new Map(editedBlocks);
    newEditedBlocks.delete(blockIndex);
    setEditedBlocks(newEditedBlocks);
    
    // If no more edits, clear editing operation flag
    if (newEditedBlocks.size === 0) {
      setHasEditingOperation(false);
    }
  };
  
  // Accept all changes
  const acceptAllChanges = () => {
    if (!artifact) return;
    
    const content = getArtifactContent(artifact);
    if (!isArtifactMarkdownContent(content)) return;
    
    // Create updated blocks with all edits applied
    const newBlocks = [...currentBlocks];
    
    // Convert Map entries to array before iterating
    Array.from(editedBlocks.entries()).forEach(([blockIndex, { edited }]) => {
      newBlocks[blockIndex] = edited;
    });
    
    // Join blocks back together
    const newMarkdown = newBlocks.join('\n\n');
    
    // Update the artifact
    setArtifact({
      ...artifact,
      contents: artifact.contents.map(c => {
        if (c.index === artifact.currentIndex && isArtifactMarkdownContent(c)) {
          return {
            ...c,
            fullMarkdown: newMarkdown,
          };
        }
        return c;
      }),
    });
    
    // Clear all pending edits
    setEditedBlocks(new Map());
    setHasEditingOperation(false);
  };
  
  // Reject all changes
  const rejectAllChanges = () => {
    setEditedBlocks(new Map());
    setHasEditingOperation(false);
  };

  // Fix the onChange handler type
  const onChange = useCallback(
    (value: any) => {
      if (isComposition.current) return;
      if (!editor) return;

      try {
        const markdownString = editor.blocksToMarkdownLossy(editor.document);
        setRawMarkdown(markdownString);
        setArtifact((prev: ArtifactV3 | undefined) => {
          if (!prev) return prev;
          return {
            ...prev,
            contents: prev.contents.map((c) => {
              if (c.index === prev.currentIndex && c.type === "text") {
                return {
                  ...c,
                  fullMarkdown: markdownString,
                } as ArtifactMarkdownV3;
              }
              return c;
            }),
          } as ArtifactV3;
        });
      } catch (error) {
        console.error("Error in onChange handler:", error);
      }
    },
    [editor, setArtifact]
  );

  // Wrap the debounced version separately
  const debouncedOnChange = useMemo(
    () => debounce(onChange, 300),
    [onChange]
  );

  // Fix the updateContent function
  useEffect(() => {
    const updateContent = async () => {
      if (!artifact) return;
      
      if (prevArtifactRef.current === artifact) {
        return;
      }
      
      const currentContent = getArtifactContent(artifact);
      if (!isArtifactMarkdownContent(currentContent)) return;
      
      const content = currentContent.fullMarkdown;
      if (rawMarkdown === content) {
        return;
      }
      
      if (editor && content) {
        try {
          const safeContent = content.length > 100000 
            ? content.substring(0, 100000) + "... (content truncated for performance)"
            : content;
            
          const blocks = await editor.tryParseMarkdownToBlocks(safeContent);
          
          const blockSignature = JSON.stringify(blocks).substring(0, 100);
          if (lastBlockSignatureRef.current !== blockSignature) {
            editor.replaceBlocks(editor.document, blocks);
            lastBlockSignatureRef.current = blockSignature;
          }
        } catch (error) {
          console.error("Error updating editor content:", error);
        }
      }
      
      prevArtifactRef.current = artifact;
    };
    
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => {
        updateContent().catch(console.error);
      });
    } else {
      setTimeout(() => {
        updateContent().catch(console.error);
      }, 0);
    }
  }, [artifact, editor, rawMarkdown]);

  // 3. Add cleanup functions for any subscriptions
  useEffect(() => {
    return () => {
      // Clean up any event listeners or subscriptions
      if (editor) {
        // If there are any editor-specific cleanup methods
      }
    };
  }, [editor]);

  // Render the diff view with the edited blocks
  const renderDiffView = () => {
    if (!showDiffView || editedBlocks.size === 0 || !hasEditingOperation) return null;
    
    // Sort the diff keys to show them in document order
    const sortedDiffKeys = Array.from(editedBlocks.keys()).sort((a, b) => a - b);
    
    return (
      <div className="px-4 sm:px-6">
        {sortedDiffKeys.map(blockIndex => {
          const {original, edited} = editedBlocks.get(blockIndex) || {original: '', edited: ''};
          const isExpanded = expandedDiffs.has(blockIndex);
          const changeSummary = getChangeSummary(original, edited);
          
          return (
            <div 
              key={`diff-${blockIndex}`} 
              className="relative border-l-2 border-blue-400 pl-3 py-2 my-2 text-sm"
            >
              <div 
                className="flex items-center justify-between cursor-pointer hover:bg-gray-50 p-1 rounded"
                onClick={() => toggleDiffExpand(blockIndex)}
              >
                <div className="flex items-center space-x-2">
                  <span className="text-blue-500 font-medium text-xs px-1.5 py-0.5 bg-blue-50 rounded">
                    AI Edit {blockIndex + 1}
                  </span>
                  <span className="text-gray-600 text-xs">{changeSummary}</span>
                </div>
                <div className="flex space-x-1">
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  )}
                </div>
              </div>
              
              {isExpanded && (
                <div className="mt-2">
                  {/* Show the edit inline */}
                  <div className="bg-blue-50 p-2 rounded">
                    <div className="whitespace-pre-wrap text-sm">{edited || '(Content removed)'}</div>
                  </div>
                  
                  {/* Action buttons */}
                  <div className="flex justify-end mt-2 space-x-2">
                    <Button 
                      onClick={() => rejectChange(blockIndex)}
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs text-red-600 border-red-300 hover:bg-red-50"
                    >
                      <X className="w-3 h-3 mr-1" />
                      Reject
                    </Button>
                    <Button 
                      onClick={() => acceptChange(blockIndex)}
                      size="sm"
                      variant="outline" 
                      className="h-7 px-2 text-xs text-green-600 border-green-300 hover:bg-green-50"
                    >
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Accept
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        
        {editedBlocks.size > 1 && (
          <div className="flex justify-end mt-4 mb-2 space-x-2">
            <Button 
              onClick={rejectAllChanges}
              size="sm"
              variant="outline"
              className="text-xs text-red-600 border-red-300 hover:bg-red-50"
            >
              <X className="w-3 h-3 mr-1" />
              Reject All
            </Button>
            <Button 
              onClick={acceptAllChanges}
              size="sm"
              variant="outline"
              className="text-xs text-green-600 border-green-300 hover:bg-green-50"
            >
              <CheckCircle className="w-3 h-3 mr-1" />
              Accept All
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full h-full mt-2 flex flex-col border-t-[1px] border-gray-200 overflow-y-auto py-5 relative">
      {props.isHovering && artifact && (
        <div className="absolute flex gap-2 top-2 right-4 z-10">
          <CopyText currentArtifactContent={getArtifactContent(artifact)} />
          <ViewRawText isRawView={isRawView} setIsRawView={setIsRawView} />
        </div>
      )}
      {isRawView ? (
        <Textarea
          className="whitespace-pre-wrap font-mono text-sm px-[54px] border-0 shadow-none h-full outline-none ring-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0"
          value={rawMarkdown}
          onChange={debouncedOnChange}
        />
      ) : (
        <>
          <style jsx global>{`
            .pulse-text .bn-block-group {
              animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
            }

            @keyframes pulse {
              0%,
              100% {
                opacity: 1;
              }
              50% {
                opacity: 0.3;
              }
            }
          `}</style>
          <div className="flex flex-col w-full">
            <BlockNoteView
              theme="light"
              formattingToolbar={false}
              slashMenu={false}
              onCompositionStartCapture={() => (isComposition.current = true)}
              onCompositionEndCapture={() => (isComposition.current = false)}
              onChange={debouncedOnChange}
              editable={
                !isStreaming || props.isEditing || !manuallyUpdatingArtifact
              }
              editor={editor}
              className={cn(
                isStreaming && !firstTokenReceived ? "pulse-text" : "",
                "custom-blocknote-theme"
              )}
            >
              <SuggestionMenuController
                getItems={async () =>
                  getDefaultReactSlashMenuItems(editor).filter(
                    (z) => z.group !== "Media"
                  )
                }
                triggerCharacter={"/"}
              />
            </BlockNoteView>
            
            {hasEditingOperation && editedBlocks.size > 0 && (
              <div className="mt-2 text-xs text-blue-600 font-medium px-4 sm:px-6">
                {editedBlocks.size} AI edit{editedBlocks.size > 1 ? 's' : ''} available
              </div>
            )}
            
            {renderDiffView()}
          </div>
        </>
      )}
    </div>
  );
}

export const TextRenderer = React.memo(TextRendererComponent);
