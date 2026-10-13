import ChatbotIcon from "./ChatbotIcon";

const ChatMessage = ({ chat }) => {
  if (chat.hideInChat) return null;

  const isBot = chat.role === "model";

  return (
    <div className={`flex items-start gap-2.5 ${isBot ? "" : "justify-end"}`}>
      {isBot && <ChatbotIcon />}
      <div className="max-w-[85%]">
        <p
          role={chat.isError ? "alert" : undefined}
          className={`whitespace-pre-line rounded-lg px-3.5 py-2.5 text-sm leading-relaxed ${
            chat.isError
              ? "border border-danger-500/30 bg-danger-50 text-danger-700"
              : isBot
              ? "rounded-tl-sm border border-concrete-200 bg-white text-navy-800"
              : "rounded-tr-sm bg-navy-900 text-white"
          }`}
        >
          {chat.text}
        </p>
      </div>
    </div>
  );
};

export default ChatMessage;