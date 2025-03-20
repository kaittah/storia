import {
  getArtifactContent,
} from "@storia/shared/utils/artifacts";
import {
  ArtifactMarkdownContent,
} from "@storia/shared/types";
import {
  OPTIONALLY_UPDATE_META_PROMPT,
  UPDATE_ENTIRE_ARTIFACT_PROMPT,
} from "../../prompts.js";
import { OpenCanvasGraphAnnotation } from "../../state.js";
import { z } from "zod";
import { OPTIONALLY_UPDATE_ARTIFACT_META_SCHEMA } from "./schemas.js";

export const validateState = (
  state: typeof OpenCanvasGraphAnnotation.State
) => {
  const currentArtifactContent = state.artifact
    ? getArtifactContent(state.artifact)
    : undefined;
  if (!currentArtifactContent) {
    throw new Error("No artifact found");
  }

  const recentHumanMessage = state._messages.findLast(
    (message) => message.getType() === "human"
  );
  if (!recentHumanMessage) {
    throw new Error("No recent human message found");
  }

  return { currentArtifactContent, recentHumanMessage };
};

const buildMetaPrompt = (
  artifactMetaToolCall: z.infer<typeof OPTIONALLY_UPDATE_ARTIFACT_META_SCHEMA>
) => {
  const titleSection =
    artifactMetaToolCall?.title && artifactMetaToolCall?.type !== "code"
      ? `And its title is (do NOT include this in your response):\n${artifactMetaToolCall.title}`
      : "";

  return OPTIONALLY_UPDATE_META_PROMPT.replace(
    "{artifactType}",
    artifactMetaToolCall?.type
  ).replace("{artifactTitle}", titleSection);
};

interface BuildPromptArgs {
  artifactContent: string;
  isNewType: boolean;
  artifactMetaToolCall: z.infer<typeof OPTIONALLY_UPDATE_ARTIFACT_META_SCHEMA>;
}

export const buildPrompt = ({
  artifactContent,
  isNewType,
  artifactMetaToolCall,
}: BuildPromptArgs) => {
  const metaPrompt = isNewType ? buildMetaPrompt(artifactMetaToolCall) : "";

  return UPDATE_ENTIRE_ARTIFACT_PROMPT.replace(
    "{artifactContent}",
    artifactContent
  )
    .replace("{updateMetaPrompt}", metaPrompt);
};

interface CreateNewArtifactContentArgs {
  artifactType: string;
  state: typeof OpenCanvasGraphAnnotation.State;
  currentArtifactContent: ArtifactMarkdownContent;
  artifactMetaToolCall: z.infer<typeof OPTIONALLY_UPDATE_ARTIFACT_META_SCHEMA>;
  newContent: string;
}

// const getLanguage = (
//   artifactMetaToolCall: z.infer<typeof OPTIONALLY_UPDATE_ARTIFACT_META_SCHEMA>,
//   currentArtifactContent: ArtifactMarkdownContent // Replace 'any' with proper type
// ) =>
//   artifactMetaToolCall?.language ||
//   (isArtifactCodeContent(currentArtifactContent)
//     ? currentArtifactContent.language
//     : "other");

export const createNewArtifactContent = ({
  // artifactType,
  state,
  currentArtifactContent,
  artifactMetaToolCall,
  newContent,
}: CreateNewArtifactContentArgs): ArtifactMarkdownContent => {
  const baseContent = {
    index: state.artifact.contents.length + 1,
    title: artifactMetaToolCall?.title || currentArtifactContent.title,
  };

  return {
    ...baseContent,
    type: "text",
    fullMarkdown: newContent,
  };
};
