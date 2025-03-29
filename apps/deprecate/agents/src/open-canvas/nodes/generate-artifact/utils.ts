import { NEW_ARTIFACT_PROMPT } from "../../prompts.js";
import {
  ArtifactMarkdownContent,
} from "@storia/shared/types";
import { z } from "zod";
import { ARTIFACT_TOOL_SCHEMA } from "./schemas.js";

export const formatNewArtifactPrompt = (
  modelName: string
): string => {
  return NEW_ARTIFACT_PROMPT.replace(
    "{disableChainOfThought}",
    modelName.includes("claude")
      ? "\n\nIMPORTANT: Do NOT preform chain of thought beforehand. Instead, go STRAIGHT to generating the tool response. This is VERY important."
      : ""
  );
};

export const createArtifactContent = (
  toolCall: z.infer<typeof ARTIFACT_TOOL_SCHEMA>
): ArtifactMarkdownContent => {
  // const artifactType = toolCall?.type;

  return {
    index: 1,
    type: "text",
    title: toolCall?.title,
    fullMarkdown: toolCall?.artifact,
  };
};
