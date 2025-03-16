import { v4 as uuidv4 } from "uuid";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import {
  extractThinkingAndResponseTokens,
  isThinkingModel,
} from "@storia/shared/utils/thinking";
import {
  isArtifactMarkdownContent,
  getArtifactContent,
} from "@storia/shared/utils/artifacts";
import {
  ArtifactV3,
  ArtifactV4,
  ArticleContent,
  ArtifactMarkdownV4,
} from "@storia/shared/types";
import {
  getModelConfig,
  getModelFromConfig,
} from "../../utils.js";
import {
  COPYEDIT_ARTIFACT_PROMPT,
  CHANGE_ARTIFACT_LANGUAGE_PROMPT,
  CHANGE_ARTIFACT_FORMAT,
} from "../prompts.js";
import {
  OpenCanvasGraphAnnotation,
  OpenCanvasGraphReturnType,
} from "../state.js";
import { AIMessage } from "@langchain/core/messages";

export const rewriteArtifactTheme = async (
  state: typeof OpenCanvasGraphAnnotation.State,
  config: LangGraphRunnableConfig
): Promise<OpenCanvasGraphReturnType> => {
  const { modelName } = getModelConfig(config);
  const smallModel = await getModelFromConfig(config);

  const assistantId = config.configurable?.assistant_id;
  if (!assistantId) {
    throw new Error("`assistant_id` not found in configurable");
  }

  // Check if we have a V4 artifact (with articles)
  const isV4Artifact = state.artifact && 
    'contents' in state.artifact && 
    state.artifact.contents.length > 0 && 
    'articles' in state.artifact.contents[0];

  if (isV4Artifact) {
    // Handle V4 artifact with multiple articles
    const artifactV4 = state.artifact as unknown as ArtifactV4;
    const currentContent = artifactV4.contents[artifactV4.currentIndex - 1] as ArtifactMarkdownV4;
    
    // Create a new array of articles with processed content
    const processedArticles: ArticleContent[] = [];
    
    // Process each article one by one
    for (const article of currentContent.articles) {
      let formattedPrompt = "";
      if (state.language) {
        formattedPrompt = CHANGE_ARTIFACT_LANGUAGE_PROMPT.replace("{artifactContent}", article.fullMarkdown);
      } else if (state.format) {
        formattedPrompt = CHANGE_ARTIFACT_FORMAT.replace("{artifactContent}", article.fullMarkdown);
      } else if (state.copyedit) {
        formattedPrompt = COPYEDIT_ARTIFACT_PROMPT.replace(
          "{artifactContent}",
          article.fullMarkdown
        );
      } else {
        throw new Error("No theme selected");
      }

      const newArticleContent = await smallModel.invoke([
        { role: "user", content: formattedPrompt },
      ]);

      let thinkingMessage: AIMessage | undefined;
      let articleContentText = newArticleContent.content as string;

      if (isThinkingModel(modelName)) {
        const { thinking, response } =
          extractThinkingAndResponseTokens(articleContentText);
        thinkingMessage = new AIMessage({
          id: `thinking-${uuidv4()}`,
          content: thinking,
        });
        articleContentText = response;
      }

      // Add the processed article to our array
      processedArticles.push({
        ...article,
        fullMarkdown: articleContentText
      });
    }

    // Create a new artifact version with the processed articles
    const newArtifactContent: ArtifactMarkdownV4 = {
      ...currentContent,
      articles: processedArticles
    };

    const newArtifact: ArtifactV4 = {
      ...artifactV4,
      currentIndex: artifactV4.contents.length + 1,
      contents: [
        ...artifactV4.contents,
        newArtifactContent
      ],
    };

    return {
      artifact: newArtifact as unknown as ArtifactV3,
      messages: [],
      _messages: [],
    };
  } else {
    // Original V3 artifact handling
    const currentArtifactContent = state.artifact
      ? getArtifactContent(state.artifact)
      : undefined;
    if (!currentArtifactContent) {
      throw new Error("No artifact found");
    }
    if (!isArtifactMarkdownContent(currentArtifactContent)) {
      throw new Error("Current artifact content is not markdown");
    }

    let formattedPrompt = "";
    if (state.language) {
      formattedPrompt = CHANGE_ARTIFACT_LANGUAGE_PROMPT.replace("{artifactContent}", currentArtifactContent.fullMarkdown);
    } else if (state.format) {
      formattedPrompt = CHANGE_ARTIFACT_FORMAT.replace("{artifactContent}", currentArtifactContent.fullMarkdown);
    } else if (state.copyedit) {
      formattedPrompt = COPYEDIT_ARTIFACT_PROMPT.replace(
        "{artifactContent}",
        currentArtifactContent.fullMarkdown
      );
    } else {
      throw new Error("No theme selected");
    }

    const newArtifactValues = await smallModel.invoke([
      { role: "user", content: formattedPrompt },
    ]);

    let thinkingMessage: AIMessage | undefined;
    let artifactContentText = newArtifactValues.content as string;

    if (isThinkingModel(modelName)) {
      const { thinking, response } =
        extractThinkingAndResponseTokens(artifactContentText);
      thinkingMessage = new AIMessage({
        id: `thinking-${uuidv4()}`,
        content: thinking,
      });
      artifactContentText = response;
    }

    const newArtifact: ArtifactV3 = {
      ...state.artifact,
      currentIndex: state.artifact.contents.length + 1,
      contents: [
        ...state.artifact.contents,
        {
          ...currentArtifactContent,
          index: state.artifact.contents.length + 1,
          fullMarkdown: artifactContentText,
        },
      ],
    };

    return {
      artifact: newArtifact,
      messages: [...(thinkingMessage ? [thinkingMessage] : [])],
      _messages: [...(thinkingMessage ? [thinkingMessage] : [])],
    };
  }
};
