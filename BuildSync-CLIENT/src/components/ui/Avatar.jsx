import { LuHardHat } from "react-icons/lu";

/** Fallback initials avatar. `src` renders the uploaded profile image when present. */
const Avatar = ({ src, name = "", size = "md", className = "" }) => {
  const sizes = {
    sm: "h-8 w-8 text-[10px]",
    md: "h-10 w-10 text-xs",
    lg: "h-14 w-14 text-sm",
    xl: "h-24 w-24 text-xl",
  };

  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  if (src) {
    return (
      <img
        src={src}
        alt={name ? `${name}'s profile photo` : "Profile photo"}
        loading="lazy"
        decoding="async"
        className={`shrink-0 rounded-full border border-concrete-200 bg-concrete-100 object-cover ${sizes[size]} ${className}`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full bg-navy-100 font-display font-semibold uppercase tracking-wide text-navy-700 ${sizes[size]} ${className}`}
    >
      {initials || <LuHardHat className="h-1/2 w-1/2" />}
    </span>
  );
};

export default Avatar;