import { useRef, useState } from "react";
import { LuArrowUp } from "react-icons/lu";

const ChatForm = ({ chatHistory, setChatHistory, generateBotResponse }) => {
  const inputRef = useRef(null);
  const [sending, setSending] = useState(false);

  const handleFormSubmit = (event) => {
    event.preventDefault();
    const userMessage = inputRef.current.value.trim();
    if (!userMessage || sending) return;

    inputRef.current.value = "";
    setSending(true);

    const nextHistory = [...chatHistory, { role: "user", text: userMessage }];
    setChatHistory(nextHistory);

    setTimeout(() => {
      setChatHistory((history) => [
        ...history,
        { role: "model", text: "Thinking..." },
      ]);
      generateBotResponse([
        ...nextHistory,
        {
          role: "user",
          text: `Using the details provided above, please address this query: ${userMessage}`,
        },
      ]);
      setSending(false);
    }, 600);
  };

  return (
    <form
      onSubmit={handleFormSubmit}
      className="flex items-center gap-2 border-t border-concrete-200 bg-white px-3 py-3"
    >
      <input
        ref={inputRef}
        placeholder="Ask about BuildSync…"
        aria-label="Message"
        disabled={sending}
        className="min-w-0 flex-1 rounded-md border border-concrete-300 px-3 py-2 text-sm text-navy-900 placeholder:text-concrete-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-400 disabled:bg-concrete-100"
      />
      <button
        type="submit"
        disabled={sending}
        aria-label="Send message"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-600 text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:bg-concrete-300"
      >
        <LuArrowUp className="h-4 w-4" aria-hidden="true" />
      </button>
    </form>
  );
};

export default ChatForm;
