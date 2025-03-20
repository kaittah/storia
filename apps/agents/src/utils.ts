import { v4 as uuidv4 } from "uuid";
import {
  CustomModelConfig,
  ArtifactMarkdownContent,
  ContextDocument,
  SearchResult,
} from "@storia/shared/types";
import { BaseStore, LangGraphRunnableConfig } from "@langchain/langgraph";
import { initChatModel } from "langchain/chat_models/universal";
import pdfParse from "pdf-parse";
import {
  AIMessage,
  BaseMessage,
  MessageContent,
  MessageContentComplex,
  MessageFieldWithRole,
} from "@langchain/core/messages";
import {
  CONTEXT_DOCUMENTS_NAMESPACE,
  OC_WEB_SEARCH_RESULTS_MESSAGE_KEY,
} from "@storia/shared/constants";
import {
  TEMPERATURE_EXCLUDED_MODELS,
  LANGCHAIN_USER_ONLY_MODELS,
} from "@storia/shared/models";
import { createClient, Session, User } from "@supabase/supabase-js";

export const ensureStoreInConfig = (
  config: LangGraphRunnableConfig
): BaseStore => {
  if (!config.store) {
    throw new Error("`store` not found in config");
  }
  return config.store;
};

export const formatArtifactContent = (
  content: ArtifactMarkdownContent,
  shortenContent?: boolean
): string => {
  let artifactContent: string;
    artifactContent = shortenContent
      ? content.fullMarkdown?.slice(0, 500)
      : content.fullMarkdown;
  return `Title: ${content.title}\nArtifact type: ${content.type}\nContent: ${artifactContent}`;
};

export const formatArtifactContentWithTemplate = (
  template: string,
  content: ArtifactMarkdownContent,
  shortenContent?: boolean
): string => {
  return template.replace(
    "{artifact}",
    formatArtifactContent(content, shortenContent)
  );
};

export const getModelConfig = (
  config: LangGraphRunnableConfig,
  extra?: {
    isToolCalling?: boolean;
  }
): {
  modelName: string;
  modelProvider: string;
  modelConfig?: CustomModelConfig;
  azureConfig?: {
    azureOpenAIApiKey: string;
    azureOpenAIApiInstanceName: string;
    azureOpenAIApiDeploymentName: string;
    azureOpenAIApiVersion: string;
    azureOpenAIBasePath?: string;
  };
  apiKey?: string;
  baseUrl?: string;
} => {
  const customModelName = config.configurable?.customModelName as string;
  if (!customModelName) throw new Error("Model name is missing in config.");

  const modelConfig = config.configurable?.modelConfig as CustomModelConfig;

  if (customModelName.startsWith("azure/")) {
    let actualModelName = customModelName.replace("azure/", "");
    if (extra?.isToolCalling && actualModelName.includes("o1")) {
      // Fallback to 4o model for tool calling since o1 does not support tools.
      actualModelName = "gpt-4o";
    }
    return {
      modelName: actualModelName,
      modelProvider: "azure_openai",
      azureConfig: {
        azureOpenAIApiKey: process.env._AZURE_OPENAI_API_KEY || "",
        azureOpenAIApiInstanceName:
          process.env._AZURE_OPENAI_API_INSTANCE_NAME || "",
        azureOpenAIApiDeploymentName:
          process.env._AZURE_OPENAI_API_DEPLOYMENT_NAME || "",
        azureOpenAIApiVersion:
          process.env._AZURE_OPENAI_API_VERSION || "2024-08-01-preview",
        azureOpenAIBasePath: process.env._AZURE_OPENAI_API_BASE_PATH,
      },
    };
  }

  const providerConfig = {
    modelName: customModelName,
    modelConfig,
  };

  if (
    customModelName.includes("gpt-") ||
    customModelName.includes("o1") ||
    customModelName.includes("o3")
  ) {
    let actualModelName = providerConfig.modelName;
    if (extra?.isToolCalling && actualModelName.includes("o1")) {
      // Fallback to 4o model for tool calling since o1 does not support tools.
      actualModelName = "gpt-4o";
    }
    return {
      ...providerConfig,
      modelName: actualModelName,
      modelProvider: "openai",
      apiKey: process.env.OPENAI_API_KEY,
    };
  }

  if (customModelName.includes("claude-")) {
    return {
      ...providerConfig,
      modelProvider: "anthropic",
      apiKey: process.env.ANTHROPIC_API_KEY,
    };
  }

  if (customModelName.includes("fireworks/")) {
    let actualModelName = providerConfig.modelName;
    if (
      extra?.isToolCalling &&
      actualModelName !== "accounts/fireworks/models/llama-v3p3-70b-instruct"
    ) {
      actualModelName = "accounts/fireworks/models/llama-v3p3-70b-instruct";
    }
    return {
      ...providerConfig,
      modelName: actualModelName,
      modelProvider: "fireworks",
      apiKey: process.env.FIREWORKS_API_KEY,
    };
  }

  if (customModelName.startsWith("groq/")) {
    const actualModelName = customModelName.replace("groq/", "");
    return {
      modelName: actualModelName,
      modelProvider: "groq",
      apiKey: process.env.GROQ_API_KEY,
    };
  }

  if (customModelName.includes("gemini-")) {
    let actualModelName = providerConfig.modelName;
    if (extra?.isToolCalling && actualModelName.includes("thinking")) {
      // Gemini thinking does not support tools.
      actualModelName = "gemini-2.0-flash-exp";
    }
    return {
      ...providerConfig,
      modelName: actualModelName,
      modelProvider: "google-genai",
      apiKey: process.env.GOOGLE_API_KEY,
    };
  }

  if (customModelName.includes("gemini-")) {
    let actualModelName = providerConfig.modelName;
    if (extra?.isToolCalling && actualModelName.includes("thinking")) {
      // Gemini thinking does not support tools.
      actualModelName = "gemini-2.0-flash-exp";
    }
    return {
      ...providerConfig,
      modelName: actualModelName,
      modelProvider: "google-genai",
      apiKey: process.env.GOOGLE_API_KEY,
    };
  }

  if (customModelName.startsWith("ollama-")) {
    return {
      modelName: customModelName.replace("ollama-", ""),
      modelProvider: "ollama",
      baseUrl:
        process.env.OLLAMA_API_URL || "http://host.docker.internal:11434",
    };
  }

  throw new Error("Unknown model provider");
};

export function optionallyGetSystemPromptFromConfig(
  config: LangGraphRunnableConfig
): string | undefined {
  return config.configurable?.systemPrompt as string | undefined;
}

async function getUserFromConfig(
  config: LangGraphRunnableConfig
): Promise<User | undefined> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE
  ) {
    return undefined;
  }

  const accessToken = (
    config.configurable?.supabase_session as Session | undefined
  )?.access_token;
  if (!accessToken) {
    return undefined;
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE
  );

  const authRes = await supabase.auth.getUser(accessToken);
  return authRes.data.user || undefined;
}

export function isUsingO1MiniModel(config: LangGraphRunnableConfig) {
  const { modelName } = getModelConfig(config);
  return modelName.includes("o1-mini");
}

export async function getModelFromConfig(
  config: LangGraphRunnableConfig,
  extra?: {
    temperature?: number;
    maxTokens?: number;
    isToolCalling?: boolean;
  }
): Promise<ReturnType<typeof initChatModel>> {
  const {
    modelName,
    modelProvider,
    azureConfig,
    apiKey,
    baseUrl,
    modelConfig,
  } = getModelConfig(config, {
    isToolCalling: extra?.isToolCalling,
  });
  const { temperature = 0.5, maxTokens } = {
    temperature: modelConfig?.temperatureRange.current,
    maxTokens: modelConfig?.maxTokens.current,
    ...extra,
  };

  const isLangChainUserModel = LANGCHAIN_USER_ONLY_MODELS.some(
    (m) => m === modelName
  );
  if (isLangChainUserModel) {
    const user = await getUserFromConfig(config);
    if (!user) {
      throw new Error(
        "Unauthorized. Can not use LangChain only models without a user."
      );
    }
    if (!user.email?.endsWith("@langchain.dev")) {
      throw new Error(
        "Unauthorized. Can not use LangChain only models without a user with a @langchain.dev email."
      );
    }
  }

  const includeStandardParams = !TEMPERATURE_EXCLUDED_MODELS.some(
    (m) => m === modelName
  );

  return await initChatModel(modelName, {
    modelProvider,
    // Certain models (e.g., OpenAI o1) do not support passing the temperature param.
    ...(includeStandardParams
      ? { maxTokens, temperature }
      : {
          max_completion_tokens: maxTokens,
          // streaming: false,
          // disableStreaming: true,
        }),
    ...(baseUrl ? { baseUrl } : {}),
    ...(apiKey ? { apiKey } : {}),
    ...(azureConfig != null
      ? {
          azureOpenAIApiKey: azureConfig.azureOpenAIApiKey,
          azureOpenAIApiInstanceName: azureConfig.azureOpenAIApiInstanceName,
          azureOpenAIApiDeploymentName:
            azureConfig.azureOpenAIApiDeploymentName,
          azureOpenAIApiVersion: azureConfig.azureOpenAIApiVersion,
          azureOpenAIBasePath: azureConfig.azureOpenAIBasePath,
        }
      : {}),
  });
}

const cleanBase64 = (base64String: string): string => {
  return base64String.replace(/^data:.*?;base64,/, "");
};

export async function convertPDFToText(base64PDF: string) {
  try {
    // Clean the base64 input first
    const cleanedBase64 = cleanBase64(base64PDF);

    // Convert cleaned base64 to buffer
    const pdfBuffer = Buffer.from(cleanedBase64, "base64");

    // Parse PDF
    const data = await pdfParse(pdfBuffer);

    // Get text content
    return data.text;
  } catch (error) {
    console.error("Error converting PDF to text:", error);
    throw error;
  }
}

export async function createContextDocumentMessagesAnthropic(
  documents: ContextDocument[],
  options?: { nativeSupport: boolean }
) {
  const messagesPromises = documents.map(async (doc) => {
    if (doc.type === "application/pdf" && options?.nativeSupport) {
      return {
        type: "document",
        source: {
          type: "base64",
          media_type: doc.type,
          data: cleanBase64(doc.data),
        },
      };
    }

    let text = "";
    if (doc.type === "application/pdf" && !options?.nativeSupport) {
      text = await convertPDFToText(doc.data);
    } else if (doc.type.startsWith("text/")) {
      text = atob(cleanBase64(doc.data));
    } else if (doc.type === "text") {
      text = doc.data;
    }

    return {
      type: "text",
      text,
    };
  });

  return await Promise.all(messagesPromises);
}

export function createContextDocumentMessagesGemini(
  documents: ContextDocument[]
) {
  return documents.map((doc) => {
    if (doc.type === "application/pdf") {
      return {
        type: doc.type,
        data: cleanBase64(doc.data),
      };
    } else if (doc.type.startsWith("text/")) {
      return {
        type: "text",
        text: atob(cleanBase64(doc.data)),
      };
    } else if (doc.type === "text") {
      return {
        type: "text",
        text: doc.data,
      };
    }
    throw new Error("Unsupported document type: " + doc.type);
  });
}

export async function createContextDocumentMessagesOpenAI(
  documents: ContextDocument[]
) {
  const messagesPromises = documents.map(async (doc) => {
    let text = "";

    if (doc.type === "application/pdf") {
      text = await convertPDFToText(doc.data);
    } else if (doc.type.startsWith("text/")) {
      text = atob(cleanBase64(doc.data));
    } else if (doc.type === "text") {
      text = doc.data;
    }

    return {
      type: "text",
      text,
    };
  });

  return await Promise.all(messagesPromises);
}

async function getContextDocuments(
  config: LangGraphRunnableConfig
): Promise<ContextDocument[]> {
  const store = config.store;
  const assistantId = config.configurable?.assistant_id;
  if (!store || !assistantId) {
    return [];
  }

  const result = await store.get(CONTEXT_DOCUMENTS_NAMESPACE, assistantId);
  return result?.value?.documents || [];
}

export async function createContextDocumentMessages(
  config: LangGraphRunnableConfig,
  contextDocuments?: ContextDocument[]
): Promise<MessageFieldWithRole[]> {
  const { modelProvider, modelName } = getModelConfig(config);
  const documents: ContextDocument[] = contextDocuments || [];

  if (!documents.length && config) {
    const docs = await getContextDocuments(config);
    documents.push(...docs);
  }

  if (!documents.length) {
    return [];
  }

  let contextDocumentMessages: Record<string, any>[] = [];
  if (modelProvider === "openai") {
    contextDocumentMessages =
      await createContextDocumentMessagesOpenAI(documents);
  } else if (modelProvider === "anthropic") {
    const nativeSupport = modelName.includes("3-5-sonnet");
    contextDocumentMessages = await createContextDocumentMessagesAnthropic(
      documents,
      {
        nativeSupport,
      }
    );
  } else if (modelProvider === "google-genai") {
    contextDocumentMessages = createContextDocumentMessagesGemini(documents);
  }

  if (!contextDocumentMessages.length) return [];

  let contextMessages: Array<{
    role: "user";
    content: MessageContentComplex[];
  }> = [];
  if (contextDocumentMessages?.length) {
    contextMessages = [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Use the file(s) and/or text below as context when generating your response.",
          },
          ...contextDocumentMessages,
        ],
      },
    ];
  }

  return contextMessages;
}

export function formatMessages(messages: BaseMessage[]): string {
  return messages
    .map((msg, idx) => {
      const msgType =
        "_getType" in msg
          ? msg._getType()
          : "type" in msg
            ? (msg as Record<string, any>)?.type
            : "unknown";
      const messageContent =
        typeof msg.content === "string"
          ? msg.content
          : msg.content
              .flatMap((c) => ("text" in c ? (c.text as string) : []))
              .join("\n");
      return `<${msgType} index="${idx}">\n${messageContent}\n</${msgType}>`;
    })
    .join("\n");
}

export function createAIMessageFromWebResults(
  webResults: SearchResult[]
): AIMessage {
  const webResultsStr = webResults
    .map(
      (r, index) =>
        `<search-result
      index="${index}"
      publishedDate="${r.metadata?.publishedDate || "Unknown"}"
      author="${r.metadata?.author || "Unknown"}"
    >
      [${r.metadata?.title || "Unknown title"}](${r.metadata?.url || "Unknown URL"})
      ${r.pageContent}
    </search-result>`
    )
    .join("\n\n");

  const content = `Here is some additional context I found from searching the web. This may be useful:\n\n${webResultsStr}`;

  return new AIMessage({
    content,
    id: `web-search-results-${uuidv4()}`,
    additional_kwargs: {
      [OC_WEB_SEARCH_RESULTS_MESSAGE_KEY]: true,
      webSearchResults: webResults,
      webSearchStatus: "done",
    },
  });
}

export function getStringFromContent(content: MessageContent): string {
  if (typeof content === "string") {
    return content;
  }
  return content
    .flatMap((c) => ("text" in c ? (c.text as string) : []))
    .join("\n");
}
