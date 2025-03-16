import { LangGraphRunnableConfig } from "@langchain/langgraph";
import {
  OpenCanvasGraphAnnotation,
  OpenCanvasGraphReturnType,
} from "../state.js";
import { HumanMessage } from "@langchain/core/messages";

/**
 * A node that processes the result of human approval
 * In a real implementation, this would be called after UI interaction
 */
export const humanApprover = async (
  state: OpenCanvasGraphReturnType
): Promise<OpenCanvasGraphReturnType> => {
  // const proposedChanges = state.proposedChanges;
  // if (!proposedChanges) {
  //   throw new Error("No proposed changes to approve");
  // }

  const approvalResult = state.approvalResult;
  
  // Check if we have an approval result
  if (approvalResult === undefined) {
    throw new Error("No approval result available");
  }
  
  // Return appropriate state based on approval
  return {
    next: approvalResult ? "applyApprovedChanges" : "rejectChanges",
    messages: [
      new HumanMessage({
        content: approvalResult ? "✅ Changes approved" : "❌ Changes rejected"
      })
    ]
  };
}; 