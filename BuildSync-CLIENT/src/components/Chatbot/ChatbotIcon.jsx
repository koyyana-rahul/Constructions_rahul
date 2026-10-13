import { LuHardHat } from "react-icons/lu";

/** Bot avatar mark, matching the app's construction branding. */
const ChatbotIcon = ({ size = "h-8 w-8" }) => (
  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent-600">
    <LuHardHat className={`${size} text-white`} aria-hidden="true" />
  </span>
);

export default ChatbotIcon;