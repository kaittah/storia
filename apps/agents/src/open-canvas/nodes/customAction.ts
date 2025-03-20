import { BaseMessage } from "@langchain/core/messages";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import {
  getArtifactContent,
} from "@storia/shared/utils/artifacts";
import {
  ArtifactMarkdownContent,
  CustomQuickAction,
  ArtifactMarkdown,
} from "@storia/shared/types";
import {
  ensureStoreInConfig,
  getModelFromConfig,
} from "../../utils.js";
import {
  CUSTOM_QUICK_ACTION_ARTIFACT_CONTENT_PROMPT,
  CUSTOM_QUICK_ACTION_ARTIFACT_PROMPT_PREFIX,
  CUSTOM_QUICK_ACTION_CONVERSATION_CONTEXT,
} from "@storia/shared/prompts/quick-actions";
import {
  OpenCanvasGraphAnnotation,
  OpenCanvasGraphReturnType,
} from "../state.js";

const formatMessages = (messages: BaseMessage[]): string =>
  messages
    .map(
      (msg) =>
        `<${msg.getType()}>\n${msg.content as string}\n</${msg.getType()}>`
    )
    .join("\n");

export const customAction = async (
  state: typeof OpenCanvasGraphAnnotation.State,
  config: LangGraphRunnableConfig
): Promise<OpenCanvasGraphReturnType> => {
  if (!state.customQuickActionId) {
    throw new Error("No custom quick action ID found.");
  }

  const smallModel = await getModelFromConfig(config, {
    temperature: 0.5,
  });

  const store = ensureStoreInConfig(config);
  const assistantId = config.configurable?.assistant_id;
  const userId = config.configurable?.supabase_user_id;
  if (!assistantId) {
    throw new Error("`assistant_id` not found in configurable");
  }
  if (!userId) {
    throw new Error("`user.id` not found in configurable");
  }
  const customActionsNamespace = ["custom_actions", userId];
  const actionsKey = "actions";

  const [customActionsItem] = await Promise.all([
    store.get(customActionsNamespace, actionsKey),
  ]);
  if (!customActionsItem?.value) {
    throw new Error("No custom actions found.");
  }
  const customQuickAction = customActionsItem.value[
    state.customQuickActionId
  ] as CustomQuickAction | undefined;
  if (!customQuickAction) {
    throw new Error(
      `No custom quick action found from ID ${state.customQuickActionId}`
    );
  }

  const currentArtifactContent = state.artifact
    ? getArtifactContent(state.artifact)
    : undefined;

  let formattedPrompt = `<custom-instructions>\n${customQuickAction.prompt}\n</custom-instructions>`;

  if (customQuickAction.includePrefix) {
    formattedPrompt = `${CUSTOM_QUICK_ACTION_ARTIFACT_PROMPT_PREFIX}\n\n${formattedPrompt}`;
  }

  if (customQuickAction.includeRecentHistory) {
    const formattedConversationHistory =
      CUSTOM_QUICK_ACTION_CONVERSATION_CONTEXT.replace(
        "{conversation}",
        formatMessages(state._messages.slice(-5))
      );
    formattedPrompt += `\n\n${formattedConversationHistory}`;
  }

  const artifactContent = currentArtifactContent?.fullMarkdown || "No artifacts generated yet.";
  formattedPrompt += `\n\n${CUSTOM_QUICK_ACTION_ARTIFACT_CONTENT_PROMPT.replace("{artifactContent}", artifactContent || "No artifacts generated yet.")}`;

  const newArtifactValues = await smallModel.invoke([
    { role: "user", content: formattedPrompt },
  ]);

  if (!currentArtifactContent) {
    console.error("No current artifact content found.");
    return {};
  }

  const newArtifactContent: ArtifactMarkdownContent = {
    ...currentArtifactContent,
    index: state.artifact.contents.length + 1,
    fullMarkdown: newArtifactValues.content as string
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
