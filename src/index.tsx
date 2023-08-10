import {
  List,
  Detail,
  ActionPanel,
  Action,
  getSelectedText,
  showToast,
  Icon,
  Toast,
  getPreferenceValues,
} from "@raycast/api";
import { useCallback, useEffect, useState } from "react";
import got from "got";
import prompts from "./prompts";

interface Conversation {
  role: string;
  content: string;
}

interface Prompt {
  act: string;
  prompt: string;
}

export default function Command() {
  const [answer, setAnswer] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [isInit, setIsInit] = useState(false);
  const [conversationId, setConversationId] = useState("");
  const [conversation, setConversation] = useState<Conversation[]>([]);
  const [promptList, setPromptList] = useState<Prompt[]>([]);
  const [isTip, setIsTip] = useState(false);
  const [tip, setTip] = useState("");

  const preferences = getPreferenceValues<Preferences>();

  const uuid = () => {
    return `xxxxxxxx-xxxx-4xxx-yxxx-${Date.now().toString(16)}`.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0,
        v = c == "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  const message_id = () => {
    const random_bytes = (Math.floor(Math.random() * 1338377565) + 2956589730).toString(2);
    const unix = Math.floor(Date.now() / 1000).toString(2);

    return BigInt(`0b${unix}${random_bytes}`).toString();
  };

  const fetchAnswer = useCallback(async () => {
    const content = searchText.replace(/^\s+|\s+$/, "");
    if (!content) return;
    setIsLoading(true);
    showToast({ title: "查询中", style: Toast.Style.Animated });
    try {
      setConversation((prev) => {
        prev.push({
          role: "user",
          content,
        });
        return prev.slice();
      });
      const url = preferences.url || "https://ai.sotype.com";
      const { model } = preferences;
      const { body } = await got.post(`${url}/backend-api/v2/conversation`, {
        json: {
          conversation_id: conversationId,
          action: "_ask",
          model,
          jailbreak: "default",
          meta: {
            id: message_id(),
            content: {
              conversation: conversation.length > 1 ? conversation : [],
              internet_access: false,
              content_type: "text",
              parts: [
                {
                  content,
                  role: "user",
                },
              ],
            },
          },
        },
      });
      setAnswer(body);
      setConversation((prev) => {
        prev.push({
          role: "assistant",
          content: body,
        });
        return prev.slice();
      });
      showToast({ title: "done" });
    } catch (error) {
      showToast({ title: "fail", style: Toast.Style.Failure });
    }
    setIsLoading(false);
  }, [searchText]);

  useEffect(() => {
    setConversationId(uuid());
    (async () => {
      try {
        const selectedText = await getSelectedText();
        setSearchText(selectedText);
        setIsInit(true);
      } catch (error) {
        setIsInit(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (isInit) {
      fetchAnswer();
    }
  }, [isInit]);

  useEffect(() => {
    if (searchText === "/") {
      setIsTip(true);
      setSearchText("");
    }
  }, [searchText]);

  useEffect(() => {
    if (isTip) {
      const filterList = prompts.filter((item) => {
        return (
          item.act.toLocaleLowerCase().indexOf(searchText.toLocaleLowerCase()) > -1 ||
          item.prompt.toLocaleLowerCase().indexOf(searchText.toLocaleLowerCase()) > -1
        );
      });
      setPromptList(filterList);
    }
  }, [isTip, searchText]);

  return answer ? (
    <Detail
      markdown={answer}
      actions={
        <ActionPanel>
          <Action
            title="Confirm"
            onAction={() => {
              setSearchText("");
              setAnswer("");
            }}
          />
        </ActionPanel>
      }
    />
  ) : (
    <List
      isLoading={isLoading}
      searchText={searchText}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="请输入..."
    >
      {promptList.length > 0 ? (
        promptList.map((item) => (
          <List.Item
            key={item.act}
            title={item.act}
            subtitle={item.prompt}
            actions={
              <ActionPanel>
                <Action
                  title="Confirm"
                  onAction={() => {
                    setConversation((prev) => {
                      prev.push({
                        role: "user",
                        content: item.prompt,
                      });
                      prev.push({
                        role: "assistant",
                        content: "",
                      });
                      return prev.slice();
                    });
                    setTip(item.prompt);
                    setSearchText("");
                    setIsTip(false);
                    setPromptList([]);
                  }}
                />
              </ActionPanel>
            }
          />
        ))
      ) : (
        <List.EmptyView
          icon={Icon.SpeechBubbleActive}
          title="您好, 有什么可以帮助您?"
          description={tip}
          actions={
            <ActionPanel>
              <Action
                title="Confirm"
                onAction={() => {
                  fetchAnswer();
                }}
              />
            </ActionPanel>
          }
        />
      )}
    </List>
  );
}
