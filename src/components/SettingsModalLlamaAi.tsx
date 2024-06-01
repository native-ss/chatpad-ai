import { Flex, Modal, TextInput, Select, Stack } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useLiveQuery } from "dexie-react-hooks";
import { cloneElement, ReactElement, useEffect, useState } from "react";
import { db } from "../db";
import { config } from "../utils/config";

export function SettingsModalLlamaAi({ children }: { children: ReactElement }) {
  const [opened, { open, close }] = useDisclosure(false);

  const [value, setValue] = useState("");
  const [model, setModel] = useState(config.defaultModel);

  const settings = useLiveQuery(async () => {
    return db.settings.where({ id: "general" }).first();
  });

  useEffect(() => {
    if (settings?.openAiApiKey) {
      setValue(settings.openAiApiKey);
    }
    if (settings?.openAiModel) {
      setModel(settings.openAiModel);
    }
  }, [settings]);

  return (
    <>
      {cloneElement(children, { onClick: open })}
      <Modal opened={opened} onClose={close} title="Settings" size="lg">
        <Stack>
          <Flex gap="xs" align="end">
            <TextInput
              label="Llama Server URL"
              placeholder={value}
              sx={{ flex: 1 }}
              value={value}
              formNoValidate
              readOnly
            />
          </Flex>
          <Select
            label="LLM Model"
            value={model}
            withinPortal
            data={config.availableModels}
          />
        </Stack>
      </Modal>
    </>
  );
}

/**
 *                   await db.settings.update("general", {
                    openAiModel: model ?? undefined,
                  });
 */
