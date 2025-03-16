import { END, Send, START, StateGraph } from "@langchain/langgraph";
import { generatePath } from "./nodes/generate-path/index.js";
import { rewriteArtifactTheme } from "./nodes/rewriteArtifactTheme.js";
import { updateHighlightedText } from "./nodes/updateHighlightedText.js";
import { OpenCanvasGraphAnnotation } from "./state.js";


const routeNode = (state: typeof OpenCanvasGraphAnnotation.State) => {
  if (!state.next) {
    throw new Error("'next' state field not set.");
  }

  return new Send(state.next, {
    ...state,
  });
};

const builder = new StateGraph(OpenCanvasGraphAnnotation)
  // Start node & edge
  .addNode("generatePath", generatePath)
  .addEdge(START, "generatePath")
  // Nodes
  // .addNode("replyToGeneralInput", replyToGeneralInput)
  // .addNode("rewriteArtifact", rewriteArtifact)
  .addNode("rewriteArtifactTheme", rewriteArtifactTheme)
  //.addNode("rewriteCodeArtifactTheme", rewriteCodeArtifactTheme)
  // .addNode("updateArtifact", updateArtifact)
  .addNode("updateHighlightedText", updateHighlightedText)
  // .addNode("generateArtifact", generateArtifact)
  // .addNode("customAction", customAction)
  // .addNode("generateFollowup", generateFollowup)
  // .addNode("cleanState", cleanState)
  // .addNode("generateTitle", generateTitleNode)
  // .addNode("summarizer", summarizer)
  // .addNode("webSearch", webSearchGraph)
  // .addNode("routePostWebSearch", routePostWebSearch)
  // Initial router
  .addConditionalEdges("generatePath", routeNode, [
    // "updateArtifact",
    "rewriteArtifactTheme",
    // "rewriteCodeArtifactTheme",
    // "replyToGeneralInput",
    // "generateArtifact",
    // "rewriteArtifact",
    // "customAction",
    "updateHighlightedText",
    // "webSearch",
  ])
  // Edges
  // .addEdge("generateArtifact", "generateFollowup")
  // .addEdge("updateArtifact", "generateFollowup")
  // .addEdge("updateHighlightedText", "generateFollowup")
  // .addEdge("rewriteArtifact", "generateFollowup")
  // .addEdge("rewriteArtifactTheme", "generateFollowup")
  // .addEdge("rewriteCodeArtifactTheme", "generateFollowup")
  // .addEdge("customAction", "generateFollowup")
  // .addEdge("webSearch", "routePostWebSearch")
  // End edges
  // .addEdge("replyToGeneralInput", "cleanState")
  // .addConditionalEdges("cleanState", conditionallyGenerateTitle, [
  //   END,
  //   "generateTitle",
  //   "summarizer",
  // ])
  // .addEdge("generateTitle", END)
  // .addEdge("summarizer", END);
  .addEdge("rewriteArtifactTheme", END)
  .addEdge("updateHighlightedText", END);

export const graph = builder.compile().withConfig({ runName: "open_canvas" });
