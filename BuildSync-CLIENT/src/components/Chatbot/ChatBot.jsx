import { useEffect, useRef, useState } from "react";
import { LuMessageSquare, LuX, LuRefreshCw, LuChevronDown, LuSparkles } from "react-icons/lu";
import ChatbotIcon from "./ChatbotIcon";
import ChatForm from "./ChatForm";
import ChatMessage from "./ChatMessage";
import { useAskAssistantMutation } from "../../services/api/endpoints/platformApi";
import { getErrorMessage } from "../../lib/api";
import { useCurrentUser } from "../../features/auth/useSession";

const SUGGESTIONS = {
  admin: [
    "How are my projects performing?",
    "What is outstanding from clients?",
    "Which materials are low on stock?",
    "What needs my approval today?",
  ],
  employee: [
    "What are my tasks for today?",
    "Which of my tasks are overdue?",
    "Is any material low on my site?",
    "What is my attendance status today?",
  ],
  client: [
    "How is my project progressing?",
    "What do I owe on my invoices?",
    "What work is coming up?",
    "Show recent site reports",
  ],
};

const greetingFor = (name) => {
  const firstName = String(name || "").trim().split(" ")[0];
  return firstName
    ? `Hi ${firstName} — I'm Benny, your Builtra assistant.`
    : "Hi — I'm Benny, your Builtra assistant.";
};

const Chatbot = () => {
  const user = useCurrentUser();
  const chatBodyRef = useRef(null);
  const [showChatbot, setShowChatbot] = useState(false);
  const [askAssistant, { isLoading: sending }] = useAskAssistantMutation();
  const [suggestions, setSuggestions] = useState(
    () => SUGGESTIONS[user?.role] || SUGGESTIONS.employee
  );
  const [messages, setMessages] = useState(() => [
    {
      role: "model",
      text: `${greetingFor(user?.name)}\nI answer from your live Builtra data, scoped to your role. Ask me about projects, tasks, invoices, stock, safety, attendance or site reports.`,
    },
  ]);

  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTo({
        top: chatBodyRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, sending, showChatbot]);

  const sendMessage = async (text) => {
    const message = String(text || "").trim();
    if (!message || sending) return;

    setMessages((current) => [...current, { role: "user", text: message }]);
    try {
      const response = await askAssistant({ message }).unwrap();
      setMessages((current) => [
        ...current,
        { role: "model", text: response.reply || "I could not find an answer for that." },
      ]);
      if (response.suggestions?.length) setSuggestions(response.suggestions);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "model",
          text: getErrorMessage(
            error,
            "I could not reach the assistant. Check that the API is running and try again."
          ),
          isError: true,
        },
      ]);
    }
  };

  const reset = () => {
    setMessages([
      {
        role: "model",
        text: `${greetingFor(user?.name)}\nHow can I help you today?`,
      },
    ]);
    setSuggestions(SUGGESTIONS[user?.role] || SUGGESTIONS.employee);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setShowChatbot((previous) => !previous)}
        aria-label={showChatbot ? "Close support assistant" : "Open support assistant"}
        aria-expanded={showChatbot}
        className="fixed bottom-5 right-5 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent-600 text-white shadow-popover transition-all duration-200 ease-out-expo hover:bg-accent-700 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
      >
        {showChatbot ? (
          <LuX className="h-5 w-5" aria-hidden="true" />
        ) : (
          <LuMessageSquare className="h-5 w-5" aria-hidden="true" />
        )}
      </button>

      <div
        className={`fixed bottom-20 right-4 z-40 flex w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-lg border border-concrete-200 bg-concrete-50 shadow-popover transition-all duration-200 ease-out-expo sm:right-5 ${
          showChatbot
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none translate-y-3 opacity-0"
        }`}
        role="dialog"
        aria-label="Benny, the Builtra assistant"
        aria-hidden={!showChatbot}
      >
        <div className="flex items-center justify-between border-b border-navy-800 bg-navy-900 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <ChatbotIcon />
            <div>
              <p className="font-display text-sm font-semibold uppercase tracking-wide text-white">
                Benny
              </p>
              <p className="inline-flex items-center gap-1 font-display text-2xs uppercase tracking-wider text-navy-300">
                <LuSparkles className="h-3 w-3" aria-hidden="true" />
                Live operations data
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={reset}
              aria-label="Start a new conversation"
              className="rounded p-1.5 text-navy-300 transition-colors hover:bg-navy-800 hover:text-white"
            >
              <LuRefreshCw className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setShowChatbot(false)}
              aria-label="Minimise assistant"
              className="rounded p-1.5 text-navy-300 transition-colors hover:bg-navy-800 hover:text-white"
            >
              <LuChevronDown className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div
          ref={chatBodyRef}
          className="flex max-h-[24rem] min-h-[16rem] flex-col gap-3 overflow-y-auto bg-concrete-50 p-4"
        >
          {messages.map((message, index) => (
            <ChatMessage key={`${message.role}-${index}`} chat={message} />
          ))}
          {sending && (
            <div className="flex items-start gap-2.5">
              <ChatbotIcon />
              <p className="rounded-lg rounded-tl-sm border border-concrete-200 bg-white px-3.5 py-2.5 text-sm text-concrete-500">
                Checking your live records…
              </p>
            </div>
          )}
          {!sending && suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pl-9">
              {suggestions.slice(0, 4).map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => sendMessage(suggestion)}
                  className="rounded-full border border-concrete-300 bg-white px-2.5 py-1 text-left text-xs text-navy-700 transition-colors hover:border-accent-400 hover:bg-accent-50 hover:text-accent-800"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>

        <ChatForm onSend={sendMessage} sending={sending} />
      </div>
    </>
  );
};

export default Chatbot;
