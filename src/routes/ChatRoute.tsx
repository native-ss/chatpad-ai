import {
  Box,
  Button,
  Card,
  Container,
  Flex,
  Group,
  MediaQuery,
  Select,
  SimpleGrid,
  Skeleton,
  Text,
  Stack,
  Textarea,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useLiveQuery } from "dexie-react-hooks";
import { nanoid } from "nanoid";
import { KeyboardEvent, useState, type ChangeEvent, useEffect } from "react";
import { AiOutlineSend } from "react-icons/ai";
import { MessageItem } from "../components/MessageItem";
import { db } from "../db";
import { useChatId } from "../hooks/useChatId";
import { config } from "../utils/config";
import { trimWithEllipsis, createChatCompletion } from "../utils/openai";
import { ChatCompletionRequestMessage, Configuration, OpenAIApi } from "openai";

export function ChatRoute() {
  const chatId = useChatId();
  const apiKey = useLiveQuery(async () => {
    return (await db.settings.where({ id: "general" }).first())?.openAiApiKey;
  });
  const messages = useLiveQuery(() => {
    if (!chatId) return [];
    return db.messages.where("chatId").equals(chatId).sortBy("createdAt");
  }, [chatId]);
  const userMessages =
    messages
      ?.filter((message) => message.role === "user")
      .map((message) => message.content) || [];
  const [userMsgIndex, setUserMsgIndex] = useState(0);
  const [content, setContent] = useState("");
  const [contentDraft, setContentDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const chat = useLiveQuery(async () => {
    if (!chatId) return null;
    return db.chats.get(chatId);
  }, [chatId]);

  const [writingCharacter, setWritingCharacter] = useState<string | null>(null);
  const [writingTone, setWritingTone] = useState<string | null>(null);
  const [writingStyle, setWritingStyle] = useState<string | null>(null);
  const [writingFormat, setWritingFormat] = useState<string | null>(null);

  const getSystemMessage = () => {
    const message: string[] = [];
    if (writingCharacter) message.push(`You are ${writingCharacter}.`);
    if (writingTone) message.push(`Respond in ${writingTone} tone.`);
    if (writingStyle) message.push(`Respond in ${writingStyle} style.`);
    if (writingFormat) message.push(writingFormat);
    if (message.length === 0)
      message.push(
        "You are ChatGPT, a large language model trained by OpenAI."
      );
    return message.join(" ");
  };

  const settings = useLiveQuery(async () => {
    return db.settings.where({ id: "general" }).first();
  });
  const [model, setModel] = useState(config.defaultModel);
  useEffect(() => {
    if (settings?.openAiModel) {
      setModel(settings.openAiModel);
    }
  });

  const submit = async () => {
    if (submitting) return;

    if (!chatId) {
      notifications.show({
        title: "Error",
        color: "red",
        message: "chatId is not defined. Please create a chat to get started.",
      });
      return;
    }

    if (!apiKey) {
      notifications.show({
        title: "Error",
        color: "red",
        message: "OpenAI API Key is not defined. Please set your API Key",
      });
      return;
    }

    try {
      setSubmitting(true);

      await db.messages.add({
        id: nanoid(),
        chatId,
        content,
        role: "user",
        createdAt: new Date(),
      });
      setContent("");

      const messageId = nanoid();
      await db.messages.add({
        id: messageId,
        chatId,
        content: "",
        role: "assistant",
        createdAt: new Date(),
      });

      let userInputForAI: ChatCompletionRequestMessage[] = [
        {
          role: "system",
          content: "You are ChatGPT, a large language model trained by OpenAI.", //TODO dave set the system prompt here!
        },
        { role: "user", content: content },
      ];

      await createChatCompletion(apiKey, userInputForAI, async (response) => {
        console.log("dave_log Stream received:", response);
        await db.messages.where({ id: messageId }).modify((message) => {
          message.content += response;
        });
      });

      setSubmitting(false);

      if (chat?.description === "New Chat") {
        const messages = await db.messages
          .where({ chatId })
          .sortBy("createdAt");

        const firstMessage = messages.length > 0 ? messages[0] : null;
        const firstMessageContent = firstMessage?.content ?? "New Chat";
        console.log("dave_log firstMessageContent:", firstMessageContent);

        // Grab the first message and create the Chat title from it!
        const chatDescription = trimWithEllipsis(firstMessageContent, 50);

        await db.chats.where({ id: chatId }).modify((chat) => {
          chat.description = chatDescription;
        });
      }
    } catch (error: any) {
      if (error.toJSON().message === "Network Error") {
        notifications.show({
          title: "Error",
          color: "red",
          message: "No internet connection.",
        });
      }
      const message = error.response?.data?.error?.message;
      if (message) {
        notifications.show({
          title: "Error",
          color: "red",
          message,
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onUserMsgToggle = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const { selectionStart, selectionEnd } = event.currentTarget;
    if (
      !["ArrowUp", "ArrowDown"].includes(event.code) ||
      selectionStart !== selectionEnd ||
      (event.code === "ArrowUp" && selectionStart !== 0) ||
      (event.code === "ArrowDown" &&
        selectionStart !== event.currentTarget.value.length)
    ) {
      // do nothing
      return;
    }
    event.preventDefault();

    const newMsgIndex = userMsgIndex + (event.code === "ArrowUp" ? 1 : -1);
    const allMessages = [contentDraft, ...Array.from(userMessages).reverse()];

    if (newMsgIndex < 0 || newMsgIndex >= allMessages.length) {
      // index out of range, do nothing
      return;
    }
    setContent(allMessages.at(newMsgIndex) || "");
    setUserMsgIndex(newMsgIndex);
  };

  const onContentChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const { value } = event.currentTarget;
    setContent(value);
    setContentDraft(value);
    setUserMsgIndex(0);
  };

  if (!chatId) return null;

  return (
    <>
      <Container pt="xl" pb={100}>
        <Stack spacing="xs">
          {messages?.map((message) => (
            <MessageItem key={message.id} message={message} />
          ))}
        </Stack>
        {submitting && (
          <Card withBorder mt="xs">
            <Skeleton height={8} radius="xl" />
            <Skeleton height={8} mt={6} radius="xl" />
            <Skeleton height={8} mt={6} radius="xl" />
            <Skeleton height={8} mt={6} radius="xl" />
            <Skeleton height={8} mt={6} width="70%" radius="xl" />
          </Card>
        )}
      </Container>
      <Box
        py="lg"
        sx={(theme) => ({
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          [`@media (min-width: ${theme.breakpoints.md})`]: {
            left: 300,
          },
          backgroundColor:
            theme.colorScheme === "dark"
              ? theme.colors.dark[9]
              : theme.colors.gray[0],
        })}
      >
        {messages?.length === 0 && (
          <Group position="center" my={40}>
            <Text size="md">{model}</Text>
          </Group>
        )}
        <Container>
          {messages?.length === 0 && (
            <SimpleGrid
              mb="sm"
              spacing="xs"
              breakpoints={[
                { minWidth: "sm", cols: 4 },
                { maxWidth: "sm", cols: 2 },
              ]}
            >
              <Select
                value={writingCharacter}
                onChange={setWritingCharacter}
                data={config.writingCharacters}
                placeholder="Character"
                variant="filled"
                searchable
                clearable
                sx={{ flex: 1 }}
              />
              <Select
                value={writingTone}
                onChange={setWritingTone}
                data={config.writingTones}
                placeholder="Tone"
                variant="filled"
                searchable
                clearable
                sx={{ flex: 1 }}
              />
              <Select
                value={writingStyle}
                onChange={setWritingStyle}
                data={config.writingStyles}
                placeholder="Style"
                variant="filled"
                searchable
                clearable
                sx={{ flex: 1 }}
              />
              <Select
                value={writingFormat}
                onChange={setWritingFormat}
                data={config.writingFormats}
                placeholder="Format"
                variant="filled"
                searchable
                clearable
                sx={{ flex: 1 }}
              />
            </SimpleGrid>
          )}
          <Flex gap="sm">
            <Textarea
              key={chatId}
              sx={{ flex: 1 }}
              placeholder="Your message here..."
              autosize
              autoFocus
              disabled={submitting}
              minRows={1}
              maxRows={5}
              value={content}
              onChange={onContentChange}
              onKeyDown={async (event) => {
                if (event.code === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submit();
                  setUserMsgIndex(0);
                }
                if (event.code === "ArrowUp") {
                  onUserMsgToggle(event);
                }
                if (event.code === "ArrowDown") {
                  onUserMsgToggle(event);
                }
              }}
            />
            <MediaQuery largerThan="sm" styles={{ display: "none" }}>
              <Button
                h="auto"
                onClick={() => {
                  submit();
                }}
              >
                <AiOutlineSend />
              </Button>
            </MediaQuery>
          </Flex>
        </Container>
      </Box>
    </>
  );
}
