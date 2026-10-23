import { useState } from "react";
import { LuArrowUp } from "react-icons/lu";

const ChatForm = ({ onSend, sending = false }) => {
  const [message, setMessage] = useState("");

  const handleFormSubmit = (event) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || sending) return;
    setMessage("");
    onSend(trimmed);
  };

  return (
    <form
      onSubmit={handleFormSubmit}
      className="flex items-center gap-2 border-t border-concrete-200 bg-white px-3 py-3"
    >
      <input
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Ask Benny about your operations…"
        aria-label="Message"
        maxLength={1000}
        disabled={sending}
        className="min-w-0 flex-1 rounded-md border border-concrete-300 px-3 py-2 text-sm text-navy-900 placeholder:text-concrete-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-400 disabled:bg-concrete-100"
      />
      <button
        type="submit"
        disabled={sending || !message.trim()}
        aria-label="Send message"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-600 text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:bg-concrete-300"
      >
        <LuArrowUp className="h-4 w-4" aria-hidden="true" />
      </button>
    </form>
  );
};

export default ChatForm;
