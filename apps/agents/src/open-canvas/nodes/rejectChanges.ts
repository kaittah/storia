import {
  OpenCanvasGraphAnnotation,
  OpenCanvasGraphReturnType,
} from "../state.js";

export const rejectChanges = async (
  state: typeof OpenCanvasGraphAnnotation.State
): Promise<OpenCanvasGraphReturnType> => {
  // Simply clear the approval state without modifying the artifact
  return {
    proposedChanges: undefined,
    approvalResult: undefined
  };
}; 