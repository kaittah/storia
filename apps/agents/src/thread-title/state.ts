import { Annotation, MessagesAnnotation } from "@langchain/langgraph";
import { ArtifactMarkdown } from "@storia/shared/types";

export const TitleGenerationAnnotation = Annotation.Root({
  /**
   * The chat history to generate a title for
   */
  ...MessagesAnnotation.spec,
  /**
   * The artifact that was generated/updated (if any)
   */
  artifact: Annotation<ArtifactMarkdown | undefined>,
});

export type TitleGenerationReturnType = Partial<
  typeof TitleGenerationAnnotation.State
>;
