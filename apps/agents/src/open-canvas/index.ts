import { StateGraph} from "@langchain/langgraph";
import { rewriteArtifactTheme } from "./nodes/rewriteArtifactTheme.js";
import { updateHighlightedText } from "./nodes/updateHighlightedText.js";
import { humanApprover } from "./nodes/humanApprover.js";
import { applyApprovedChanges } from "./nodes/applyApprovedChanges.js";
import { rejectChanges } from "./nodes/rejectChanges.js";
import { OpenCanvasGraphReturnType } from "./state.js";

/**
 * Define allowed node keys.
 */
type NodeKey =
  | "__start__"
  | "__end__"
  | "dummyStartNode"
  | "rewriteArtifactTheme"
  | "updateHighlightedText"
  | "humanApprover"
  | "applyApprovedChanges"
  | "rejectChanges";

async function dummyStartNode(state: OpenCanvasGraphReturnType): Promise<OpenCanvasGraphReturnType> {
  return state;
}

function apply_or_reject_changes(state: OpenCanvasGraphReturnType): Exclude<NodeKey, "__start__" | "__end__"> {
  const next = state.next;
  if (!next || next === "applyApprovedChanges") return "applyApprovedChanges";
  return "rejectChanges";
}

function routeAfterStart(state: OpenCanvasGraphReturnType): Exclude<NodeKey, "__start__" | "__end__"> {
  const { highlightedText, language, format, copyedit } = state;
  
  if (highlightedText) {
    return "updateHighlightedText";
  }
  if (language || format || copyedit) {
    return "rewriteArtifactTheme";
  }
  
  return "updateHighlightedText";
}

const builder = new StateGraph<NodeKey, OpenCanvasGraphReturnType>({
  channels: {},
});

// Add all nodes
builder.addNode("dummyStartNode", dummyStartNode);
builder.addNode("rewriteArtifactTheme", rewriteArtifactTheme);
builder.addNode("updateHighlightedText", updateHighlightedText);
builder.addNode("humanApprover", humanApprover);
builder.addNode("applyApprovedChanges", applyApprovedChanges);
builder.addNode("rejectChanges", rejectChanges);

// Define the graph flow connections
builder.addEdge("__start__", "dummyStartNode");
builder.addConditionalEdges("dummyStartNode", routeAfterStart, {
  "rewriteArtifactTheme": "rewriteArtifactTheme",
  "updateHighlightedText": "updateHighlightedText",
});

builder.addEdge("rewriteArtifactTheme", "humanApprover");
builder.addEdge("updateHighlightedText", "humanApprover");

// Connect processing nodes to human approval
builder.addConditionalEdges("humanApprover", apply_or_reject_changes,
  {
    "applyApprovedChanges": "applyApprovedChanges",
    "rejectChanges": "rejectChanges",
  }
);

// Connect final nodes to end
builder.addEdge("applyApprovedChanges", "__end__");
builder.addEdge("rejectChanges", "__end__");

// Finally, compile the graph.
export const graph = builder.compile();

// Define which nodes can be interrupted for human interaction
graph.interruptBefore = ["humanApprover"];
