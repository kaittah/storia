from typing import Dict, Any
from langchain_core.messages import BaseMessage
from langchain_core.runnables import RunnableConfig
from agents.src.open_canvas.state import OpenCanvasGraphState
from agents.src.utils import (
    format_artifact_content_with_template,
    get_model_from_config,
    is_using_o1_mini_model,
    create_context_document_messages
)
from agents.src.open_canvas.prompts import CURRENT_ARTIFACT_PROMPT, NO_ARTIFACT_PROMPT

async def reply_to_general_input(
    state: OpenCanvasGraphState,
    config: RunnableConfig
) -> Dict[str, Any]:
    small_model = await get_model_from_config(config)
    
    prompt_template = """You are an AI assistant tasked with responding to the users question.
    
The user has generated artifacts in the past. Use the following artifacts as context when responding to the users question.

{current_artifact_prompt}"""

    current_artifact_content = None
    if state.artifact and state.artifact.contents:
        current_artifact_content = state.artifact.contents[-1]

    assistant_id = config.get("configurable", {}).get("assistant_id")
    if not assistant_id:
        raise ValueError("`assistant_id` not found in configurable")
    
    current_artifact_prompt = NO_ARTIFACT_PROMPT
    if current_artifact_content:
        current_artifact_prompt = format_artifact_content_with_template(
            CURRENT_ARTIFACT_PROMPT,
            current_artifact_content
        )

    formatted_prompt = prompt_template.format(
        current_artifact_prompt=current_artifact_prompt
    )

    context_docs = await create_context_document_messages(config)
    is_o1_mini = is_using_o1_mini_model(config)
    
    response = await small_model.invoke([
        {"role": "user" if is_o1_mini else "system", "content": formatted_prompt},
        *context_docs,
        *state._messages
    ])

    return {
        "messages": [response],
        "_messages": [response]
    } 