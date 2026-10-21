import { useEffect, useRef, useState } from "react";
import { LuMessageSquare, LuX, LuRefreshCw, LuChevronDown } from "react-icons/lu";
import ChatbotIcon from "./ChatbotIcon";
import ChatForm from "./ChatForm";
import ChatMessage from "./ChatMessage";
import { assistantIntro } from "./CompanyInfo";

const GREETING = "Hey there 👋\nHow can I help you today?";

const Chatbot = () => {
  const chatBodyRef = useRef(null);
  const [showChatbot, setShowChatbot] = useState(false);
  const [chatHistory, setChatHistory] = useState([
    { hideInChat: true, role: "model", text: assistantIntro },
  ]);

  const generateBotResponse = async (history) => {
    const updateHistory = (text, isError = false) => {
      setChatHistory((prev) => [
        ...prev.filter((msg) => msg.text !== "Thinking..."),
        { role: "model", text, isError },
      ]);
    };

    const contents = history.map(({ role, text }) => ({ role, parts: [{ text }] }));

    try {
      const response = await fetch(import.meta.env.VITE_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || "Something went wrong!");

      const apiResponseText = data.candidates[0].content.parts[0].text
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .trim();
      updateHistory(apiResponseText);
    } catch (error) {
      updateHistory(error.message, true);
    }
  };

  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTo({
        top: chatBodyRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [chatHistory]);

  return (
    <>
      {/* Launcher */}
      <button
        type="button"
        onClick={() => setShowChatbot((prev) => !prev)}
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

      {/* Panel */}
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
              <p className="font-display text-2xs uppercase tracking-wider text-navy-300">
                Builtra Assistant
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setChatHistory([])}
              aria-label="Clear conversation"
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
          className="flex max-h-[26rem] min-h-[16rem] flex-col gap-3 overflow-y-auto bg-concrete-50 p-4"
        >
          <div className="flex items-start gap-2.5">
            <ChatbotIcon />
            <p className="max-w-[85%] whitespace-pre-line rounded-lg rounded-tl-sm border border-concrete-200 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-navy-800">
              {GREETING}
            </p>
          </div>
          {chatHistory.map((chat, index) => (
            <ChatMessage key={index} chat={chat} />
          ))}
        </div>

        <ChatForm
          chatHistory={chatHistory}
          setChatHistory={setChatHistory}
          generateBotResponse={generateBotResponse}
        />
      </div>
    </>
  );
};

export default Chatbot;