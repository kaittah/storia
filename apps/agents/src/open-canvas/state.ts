import { BaseMessage, BaseMessageLike } from "@langchain/core/messages";
import {
  ProgrammingLanguageOptions,
  ReadingLevelOptions,
  CodeHighlight,
  ArtifactV3,
  TextHighlight,
  SearchResult,
  ArtifactLengthOptions,
} from "@storia/shared/types";
import {
  Annotation,
} from "@langchain/langgraph";
import { OC_SUMMARIZED_MESSAGE_KEY } from "@storia/shared/constants";

export type Messages =
  | Array<BaseMessage | BaseMessageLike>
  | BaseMessage
  | BaseMessageLike;

function isSummaryMessage(msg: unknown): boolean {
  if (typeof msg !== "object" || Array.isArray(msg) || !msg) return false;

  if (!("additional_kwargs" in msg) && !("kwargs" in msg)) return false;

  if (
    "additional_kwargs" in msg &&
    (msg.additional_kwargs as Record<string, any>)?.[
      OC_SUMMARIZED_MESSAGE_KEY
    ] === true
  ) {
    return true;
  }

  if (
    "kwargs" in msg &&
    (msg.kwargs as Record<string, any>)?.additional_kwargs?.[
      OC_SUMMARIZED_MESSAGE_KEY
    ] === true
  ) {
    return true;
  }

  return false;
}

export interface OpenCanvasGraphProposedChanges {
  currentText: string;
  proposedText: string;
  metadata?: Record<string, any>;
}

export type OpenCanvasGraphReturnType = Partial<typeof OpenCanvasGraphAnnotation.State> & {
  next?: string;
  format?: boolean;
  copyedit?: boolean;
  language?: boolean;
  artifactLength?: ArtifactLengthOptions;
  readingLevel?: ReadingLevelOptions;
  highlightedCode?: CodeHighlight;
  highlightedText?: TextHighlight;
  regenerateWithEmojis?: boolean;
  addComments?: boolean;
  addLogs?: boolean;
  portLanguage?: ProgrammingLanguageOptions;
  fixBugs?: boolean;
  proposedChanges?: OpenCanvasGraphProposedChanges;
  approvalResult?: boolean;
};

export const OpenCanvasGraphAnnotation = {
  State: {
    /**
     * The full list of messages in the conversation.
     */
    _messages: Annotation<BaseMessage[]>({
      reducer: (state, update) => {
        const latestMsg = Array.isArray(update)
          ? update[update.length - 1]
          : update;

        if (isSummaryMessage(latestMsg)) {
          // The state list has been updated by a summary message. Clear the existing state messages.
          return [];
        }

        return [...state, ...(Array.isArray(update) ? update : [update])];
      },
      default: () => [],
    }),
    
    /**
     * Accessor for _messages
     */
    messages: Annotation<BaseMessage[]>({
      reducer: (state, update) => [...state, ...(Array.isArray(update) ? update : [update])],
      default: () => [],
    }),
    
    /**
     * Highlighted code for transforming.
     */
    highlightedCode: Annotation<CodeHighlight | undefined>(),
    
    /**
     * Highlighted text for transforming.
     */
    highlightedText: Annotation<TextHighlight | undefined>(),
    
    /**
     * Current artifact contents.
     */
    artifact: Annotation<ArtifactV3 | undefined>(),
    
    /**
     * Whether to format the text.
     */
    format: Annotation<boolean | undefined>(),
    
    /**
     * Whether to copyedit the text.
     */
    copyedit: Annotation<boolean | undefined>(),
    
    /**
     * The next node to route to. Only used for the first routing node/conditional edge.
     */
    next: Annotation<string | undefined>(),
    
    /**
     * The language to translate the artifact to.
     */
    language: Annotation<boolean | undefined>(),
    
    /**
     * The reading level to adjust the artifact to.
     */
    readingLevel: Annotation<ReadingLevelOptions | undefined>(),
    
    /**
     * Whether or not to add comments to the code artifact.
     */
    addComments: Annotation<boolean | undefined>(),
    
    /**
     * Whether or not to add logs to the code artifact.
     */
    addLogs: Annotation<boolean | undefined>(),
    
    /**
     * The programming language to port the code artifact to.
     */
    portLanguage: Annotation<ProgrammingLanguageOptions | undefined>(),
    
    /**
     * Whether or not to fix bugs in the code artifact.
     */
    fixBugs: Annotation<boolean | undefined>(),
    
    /**
     * The ID of the custom quick action to use.
     */
    customQuickActionId: Annotation<string | undefined>(),
    
    /**
     * Whether or not to search the web for additional context.
     */
    webSearchEnabled: Annotation<boolean | undefined>(),
    
    /**
     * The search results to include in context.
     */
    webSearchResults: Annotation<SearchResult[] | undefined>(),
    
    /**
     * Proposed changes for human approval
     */
    proposedChanges: Annotation<OpenCanvasGraphProposedChanges | undefined>(),
    
    /**
     * Result of human approval (true = approved, false = rejected)
     */
    approvalResult: Annotation<boolean | undefined>(),
    
    /**
     * Flag for workflow operations
     */
    isWorkflowOperation: Annotation<boolean | undefined>(),
  }
};
