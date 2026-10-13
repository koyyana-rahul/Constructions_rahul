import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LuMenu, LuLogOut, LuChevronDown, LuSettings } from "react-icons/lu";
import { useAuth } from "../../context/AuthContext";
import Avatar from "../ui/Avatar";

const ROLE_LABELS = {
  admin: "Administrator",
  employee: "Site Employee",
  client: "Client",
};

const Topbar = ({ onOpenMobileNav, user }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-4 border-b border-concrete-200 bg-white/95 px-4 backdrop-blur sm:px-6">
      <button
        type="button"
        onClick={onOpenMobileNav}
        aria-label="Open navigation"
        className="-ml-1 rounded-md p-2 text-concrete-500 transition-colors hover:bg-concrete-100 hover:text-navy-900 lg:hidden"
      >
        <LuMenu className="h-5 w-5" aria-hidden="true" />
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-xs font-semibold uppercase tracking-wider text-concrete-500">
          {ROLE_LABELS[user?.role] || "Portal"}
        </p>
        <p className="truncate font-display text-base font-semibold uppercase tracking-wide text-navy-900">
          Welcome back, {user?.name}
        </p>
      </div>

      <div className="relative shrink-0" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="flex items-center gap-2 rounded-md border border-transparent p-1 pr-2 transition-colors hover:border-concrete-200 hover:bg-concrete-50"
        >
          <Avatar name={user?.name} size="md" />
          <span className="hidden max-w-[10rem] truncate font-display text-sm font-medium text-navy-800 sm:block">
            {user?.name}
          </span>
          <LuChevronDown
            className={`h-4 w-4 shrink-0 text-concrete-400 transition-transform duration-150 ${
              menuOpen ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          />
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 mt-2 w-56 animate-scale-in overflow-hidden rounded-lg border border-concrete-200 bg-white shadow-popover"
          >
            <div className="border-b border-concrete-200 px-4 py-3">
              <p className="truncate font-display text-sm font-semibold text-navy-900">
                {user?.name}
              </p>
              <p className="truncate text-xs text-concrete-500">{user?.email}</p>
            </div>
            <Link
              role="menuitem"
              to={`/${user?.role === "admin" ? "admin" : user?.role}-dashboard/setting`}
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-navy-800 transition-colors hover:bg-concrete-50"
            >
              <LuSettings className="h-4 w-4 text-concrete-400" aria-hidden="true" />
              Settings
            </Link>
            <button
              role="menuitem"
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2.5 border-t border-concrete-200 px-4 py-2.5 text-left text-sm text-danger-600 transition-colors hover:bg-danger-50"
            >
              <LuLogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Topbar;