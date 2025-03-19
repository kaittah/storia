import {
  createContextDocumentMessages,
  getModelConfig,
  getModelFromConfig,
  isUsingO1MiniModel,
} from "../../utils.js";
import { HumanMessage } from "@langchain/core/messages";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { ArtifactMarkdownV3 } from "@storia/shared/types";
import {
  OpenCanvasGraphReturnType,
} from "../state.js";
import { NodeInterrupt } from "@langchain/langgraph";

const PROMPT = `You are an expert AI writing assistant, tasked with rewriting some text a user has selected. The selected text is nested inside a larger 'block'. You should always respond with ONLY the updated text block in accordance with the user's request.
You should always respond with the full markdown text block, as it will simply replace the existing block in the artifact.
The blocks will be joined later on, so you do not need to worry about the formatting of the blocks, only make sure you keep the formatting and structure of the block you are updating.

# Selected text
{highlightedText}

# Text block
{textBlocks}

# Additional information
{info}

# User request
{request}

Only reply with the updated text, no explanations.`;

/**
 * Update the highlighted text in the artifact based on the user's request.
 */
export const updateHighlightedText = async (
  state: any,
  config: LangGraphRunnableConfig
): Promise<OpenCanvasGraphReturnType> => {
  // Direct property access instead of function calls
  const artifact = state.artifact;
  const highlightedText = state.highlightedText;
  const approvalResult = state.approvalResult;
  
  // If this is after approval
  if (approvalResult !== undefined) {
    // If the changes were approved, apply them
    if (approvalResult) {
      const proposedChanges = state.proposedChanges;
      if (!proposedChanges || !artifact) {
        throw new Error("Missing required data to apply changes");
      }
      // Get the content we need to update
      const prevContent = artifact.contents?.find?.(
        (c: any) => c.index === artifact.currentIndex && c.type === "text"
      ) as ArtifactMarkdownV3 | undefined;
      
      if (!prevContent) {
        throw new Error("Previous content not found");
      }
      
      // Apply changes to create new content
      const currentText = proposedChanges.currentText;
      const proposedText = proposedChanges.proposedText;
      
      if (!currentText || !proposedText) {
        throw new Error("Missing text data");
      }
      
      const fullMarkdown = prevContent.fullMarkdown;
      if (!fullMarkdown.includes(currentText)) {
        throw new Error("Selected text not found in current content");
      }
      const newFullMarkdown = fullMarkdown.replace(currentText, proposedText);
      const newCurrIndex = artifact.contents ? artifact.contents.length + 1 : 1;
      
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
    
    // If changes were rejected, clear state and return
    return {
      proposedChanges: undefined,
      approvalResult: undefined
    };
  }
  
  // Only proceed if we have required data
  if (!highlightedText || !artifact) {
    throw new Error("Highlighted text or artifact not provided");
  }
  
  // Extract data from TextHighlight
  const selectedText = highlightedText.selectedText;
  const markdownBlock = highlightedText.markdownBlock;
  
  if (!selectedText || !markdownBlock) {
    throw new Error("Invalid highlight data");
  }
  
  try {
    // Set up the model
    const modelConfig = getModelConfig(config);
    const model = await getModelFromConfig(modelConfig);
    const isO1MiniModel = isUsingO1MiniModel(config);
    
    // Get context from messages and recent user message
    const messagesArray = state.messages || [];
    const recentUserMessage = messagesArray.length > 0 
      ? messagesArray[messagesArray.length - 1] 
      : new HumanMessage("Update the text");
    
    // Format the prompt
    const formattedPrompt = PROMPT
      .replace("{highlightedText}", selectedText)
      .replace("{textBlocks}", markdownBlock)
      .replace("{info}", "")
      .replace("{request}", typeof recentUserMessage.content === 'string' 
        ? recentUserMessage.content 
        : "Update the text");
    
    // Process with the model
    const contextMessages = await createContextDocumentMessages(config);
    const response = await model.invoke([
      {
        role: isO1MiniModel ? "user" : "system",
        content: formattedPrompt,
      },
      ...contextMessages,
      recentUserMessage,
    ]);
    
    const responseContent = typeof response.content === 'string' 
      ? response.content 
      : "";
    
    // Interrupt with proposed changes
    throw new NodeInterrupt("Please review changes", {
      proposedChanges: {
        currentText: markdownBlock,
        proposedText: responseContent,
        metadata: {
          operation: "updateHighlightedText",
          selectedText,
          markdownBlock,
        }
      }
    });
  } catch (error) {
    if (error instanceof NodeInterrupt) {
      throw error;
    }
    // Handle other errors
    console.error("Error in updateHighlightedText:", error);
    throw new Error(`Failed to update text: ${error instanceof Error ? error.message : String(error)}`);
  }
};
