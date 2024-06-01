import { ChatCompletionRequestMessage, Configuration, OpenAIApi } from "openai";
import { db } from "../db";
import { config } from "./config";

/**
 * Usage:
 *
 * const ollamaResponseFullSentance = await createChatCompletion(
 *        apiKey,
 *        messagesDataInput,
 *       (response) => {
 *        console.log("dave_log Stream received:", response);
 *     }
 *  );
 */
export async function createChatCompletion(
  apiKey: string, //TODO dave, pass model as well.
  messages: ChatCompletionRequestMessage[], //TODO dave use this.
  onStreamReceived: (a: string) => void
) {
  console.log(`createChatCompletion for apikey ${apiKey}`);
  const settings = await db.settings.get("general");
  const model = settings?.openAiModel ?? config.defaultModel;
  const type = settings?.openAiApiType ?? config.defaultType;
  const auth = settings?.openAiApiAuth ?? config.defaultAuth;
  const base = settings?.openAiApiBase ?? config.defaultBase;

  return ollamaStreamingRequest("testDave", onStreamReceived);
}

function ollamaStreamingRequest(
  inputText: string,
  onStreamReceived: (a: string) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    let completeSentence = ""; // Variable to store the full sentence.

    ollamaApiCall(inputText, true)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.body?.getReader();
      })
      .then((reader) => {
        let partialData = "";

        // Read and process the NDJSON response
        return reader
          ?.read()
          .then(function processResult(result): Promise<void> {
            if (result.done) {
              resolve(completeSentence); // Resolve the Promise with fetched data once streaming is done
              return Promise.resolve();
            }

            partialData += new TextDecoder().decode(result.value, {
              stream: true,
            });
            const lines = partialData.split("\n");

            for (let i = 0; i < lines.length - 1; i++) {
              const json = JSON.parse(lines[i]);
              onStreamReceived(json.response);
              completeSentence += json.response; // Append each piece to form a complete sentence
            }

            partialData = lines[lines.length - 1];

            return reader.read().then(processResult);
          });
      })
      .catch((error) => {
        console.error("Fetch error:", error);
      });
  });
}

function ollamaApiCall(inputText: string, allowStreaming: boolean) {
  return fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json", // Ensures that the server knows to expect JSON
    },
    body: JSON.stringify({
      model: "llama3", // model should be already installed in ollama
      prompt: inputText,
      stream: allowStreaming, // if stream is true, the model will send one word at a time.
    }),
  });
}

/**
 * Trims the input string to a specified length and appends an ellipsis if it exceeds that length.
 * @param inputString The string to be trimmed.
 * @param maxLength The maximum length of the string before trimming.
 * @returns The trimmed string with or without an ellipsis.
 * Example usage:
 * Import this function in another file like this:
 * import { trimWithEllipsis } from './utils/openai';
 * const exampleText = "Here is a long text that might need to be trimmed if it exceeds a certain number of characters for better readability.";
 * console.log(trimWithEllipsis(exampleText, 100));
 */
export function trimWithEllipsis(
  inputString: string,
  maxLength: number
): string {
  if (inputString.length > maxLength) {
    return inputString.substring(0, maxLength) + "...";
  }
  return inputString;
}
