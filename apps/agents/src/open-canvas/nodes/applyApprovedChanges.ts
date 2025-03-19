import { ArtifactMarkdownV3 } from "@storia/shared/types";
import {
  OpenCanvasGraphAnnotation,
  OpenCanvasGraphReturnType,
} from "../state.js";

export const applyApprovedChanges = async (
  state: any
): Promise<OpenCanvasGraphReturnType> => {
  const proposedChanges = state.proposedChanges;
  const artifact = state.artifact;
  
  if (!proposedChanges || !artifact) {
    throw new Error("Missing required data to apply changes");
  }

  const currentText = proposedChanges.currentText;
  const proposedText = proposedChanges.proposedText;
  const metadata = proposedChanges.metadata;
  
  if (!currentText || !proposedText) {
    throw new Error("Missing text data in proposed changes");
  }
  
  // Handle highlighted text changes
  if (metadata?.operation === "updateHighlightedText") {
    const markdownBlock = metadata.markdownBlock;
    
    // Find the current content
    const prevContent = artifact.contents?.find?.(
      (c: any) => c.index === artifact.currentIndex && c.type === "text"
    ) as ArtifactMarkdownV3 | undefined;
    
    if (!prevContent) {
      throw new Error("Previous content not found");
    }
    
    // Get the full markdown and replace the highlighted text
    const fullMarkdown = prevContent.fullMarkdown;
    if (!fullMarkdown.includes(currentText)) {
      throw new Error("Selected text not found in current content");
    }
    
    const newFullMarkdown = fullMarkdown.replace(currentText, proposedText);
    const newCurrIndex = artifact.contents?.length ? artifact.contents.length + 1 : 1;
    
    // Create updated artifact content
    const updatedArtifactContent: ArtifactMarkdownV3 = {
      ...prevContent,
      index: newCurrIndex,
      fullMarkdown: newFullMarkdown,
    };
    
    return {
      artifact: {
        ...artifact,
        currentIndex: newCurrIndex,
        contents: [...(artifact.contents || []), updatedArtifactContent],
      },
      proposedChanges: undefined,
      approvalResult: undefined
    };
  }
  
  // Handle theme rewrite changes
  if (metadata?.operation === "language" || 
      metadata?.operation === "format" || 
      metadata?.operation === "copyedit") {
    
    const prevContent = artifact.contents?.find?.(
      (c: any) => c.index === artifact.currentIndex && c.type === "text"
    ) as ArtifactMarkdownV3 | undefined;
    
    if (!prevContent) {
      throw new Error("Previous content not found");
    }
    
    const newCurrIndex = artifact.contents?.length ? artifact.contents.length + 1 : 1;
    
    const updatedArtifactContent: ArtifactMarkdownV3 = {
      ...prevContent,
      index: newCurrIndex,
      fullMarkdown: proposedText,
    };
    
    return {
      artifact: {
        ...artifact,
        currentIndex: newCurrIndex,
        contents: [...(artifact.contents || []), updatedArtifactContent],
      },
      proposedChanges: undefined,
      approvalResult: undefined
    };
  }
  
  throw new Error("Unknown change type");
}; 