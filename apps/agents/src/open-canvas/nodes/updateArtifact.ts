import { LangGraphRunnableConfig } from "@langchain/langgraph";
import {
  getArtifactContent,
} from "@storia/shared/utils/artifacts";
import {
  ArtifactMarkdown,
  ArtifactMarkdownContent,
} from "@storia/shared/types";
import {
  createContextDocumentMessages,
  getModelConfig,
  getModelFromConfig,
  isUsingO1MiniModel,
} from "../../utils.js";
import { UPDATE_HIGHLIGHTED_ARTIFACT_PROMPT } from "../prompts.js";
import {
  OpenCanvasGraphAnnotation,
  OpenCanvasGraphReturnType,
} from "../state.js";

/**
 * Update an existing artifact based on the user's query.
 */
export const updateArtifact = async (
  state: typeof OpenCanvasGraphAnnotation.State,
  config: LangGraphRunnableConfig
): Promise<OpenCanvasGraphReturnType> => {
  // why does it seem like this is only for code artifacts?
  const { modelProvider, modelName } = getModelConfig(config);
  let smallModel: Awaited<ReturnType<typeof getModelFromConfig>>;
  if (modelProvider.includes("openai") || modelName.includes("3-5-sonnet")) {
    // Custom model is intelligent enough for updating artifacts
    smallModel = await getModelFromConfig(config, {
      temperature: 0,
    });
  } else {
    // Custom model is not intelligent enough for updating artifacts
    smallModel = await getModelFromConfig(
      {
        ...config,
        configurable: {
          customModelName: "gpt-4o",
        },
      },
      {
        temperature: 0,
      }
    );
  }

  const assistantId = config.configurable?.assistant_id;
  if (!assistantId) {
    throw new Error("`assistant_id` not found in configurable");
  }
  const currentArtifactContent = state.artifact
    ? getArtifactContent(state.artifact)
    : undefined;
  if (!currentArtifactContent) {
    throw new Error("No artifact found");
  }

  if (!state.highlightedText) {
    throw new Error(
      "Can not partially regenerate an artifact without a highlight"
    );
  }

  // Highlighted text is present, so we need to update the highlighted text.
  const start = Math.max(0, state.highlightedText?.startCharIndex || 0 - 500);
  const end = Math.min(
    currentArtifactContent.fullMarkdown.length,
    (state.highlightedText?.endCharIndex || 0) + 500
  );

  const beforeHighlight = currentArtifactContent.fullMarkdown.slice(
    start,
    state.highlightedText?.startCharIndex
  ) as string;
  const highlightedText = currentArtifactContent.fullMarkdown.slice(
    state.highlightedText?.startCharIndex || 0,
    state.highlightedText?.endCharIndex || 0
  ) as string;
  const afterHighlight = currentArtifactContent.fullMarkdown.slice(
    state.highlightedText?.endCharIndex || 0,
    end
  ) as string;

  const formattedPrompt = UPDATE_HIGHLIGHTED_ARTIFACT_PROMPT.replace(
    "{highlightedText}",
    highlightedText
  )
    .replace("{beforeHighlight}", beforeHighlight)
    .replace("{afterHighlight}", afterHighlight)

  const recentHumanMessage = state._messages.findLast(
    (message) => message.getType() === "human"
  );
  if (!recentHumanMessage) {
    throw new Error("No recent human message found");
  }

  const contextDocumentMessages = await createContextDocumentMessages(config);
  const isO1MiniModel = isUsingO1MiniModel(config);
  const updatedArtifact = await smallModel.invoke([
    { role: isO1MiniModel ? "user" : "system", content: formattedPrompt },
    ...contextDocumentMessages,
    recentHumanMessage,
  ]);

  const entireTextBefore = currentArtifactContent.fullMarkdown.slice(
    0,
    state.highlightedText?.startCharIndex || 0
  );
  const entireTextAfter = currentArtifactContent.fullMarkdown.slice(
    state.highlightedText?.endCharIndex || 0
  );
  const entireUpdatedContent = `${entireTextBefore}${updatedArtifact.content}${entireTextAfter}`;

  const newArtifactContent: ArtifactMarkdownContent = {
    ...currentArtifactContent,
    index: state.artifact.contents.length + 1,
    fullMarkdown: entireUpdatedContent,
  };

  const newArtifact: ArtifactMarkdown = {
    ...state.artifact,
    currentIndex: state.artifact.contents.length + 1,
    contents: [...state.artifact.contents, newArtifactContent],
  };

  return {
    artifact: newArtifact,
  };
};
