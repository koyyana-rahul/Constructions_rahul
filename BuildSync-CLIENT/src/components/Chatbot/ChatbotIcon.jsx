import { BrandSymbol } from "../brand/Logo";

/**
 * Benny's avatar.
 *
 * Uses the Builtra symbol rather than a generic bot glyph, so the assistant
 * is visually part of the product instead of a bolted-on widget.
 */
const ChatbotIcon = ({ size = "h-8 w-8", className = "" }) => (
  <span
    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent-600 ${className}`}
  >
    <BrandSymbol className={`${size} text-white`} variant="solid" />
  </span>
);

export default ChatbotIcon;