import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { getNavSections } from "./navConfig";
import { useAuth } from "../../context/AuthContext";

const COLLAPSE_KEY = "buildsync:sidebar-collapsed";

/**
 * Shared authenticated shell for all three dashboards.
 * Replaces three duplicated dashboard page components that all hardcoded
 * `ml-64` + `h-screen`, which left no mobile layout at all.
 */
const AppShell = () => {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  // Lock body scroll while the mobile drawer is open, and let Escape close it.
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen]);

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, String(next));
      } catch {
        /* storage unavailable - collapse state is not persisted */
      }
      return next;
    });
  };

  const { home, sections } = getNavSections(user?.role, user?._id);

  return (
    <div className="min-h-screen bg-concrete-100">
      <Sidebar
        sections={sections}
        home={home}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Margin tracks the sidebar so no unconditional ml-64 on mobile. */}
      <div
        className={`flex min-h-screen flex-col transition-[padding] duration-200 ease-out-expo ${
          collapsed ? "lg:pl-20" : "lg:pl-72"
        }`}
      >
        <Topbar user={user} onOpenMobileNav={() => setMobileOpen(true)} />
        <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6">
          <div className="mx-auto w-full max-w-[1600px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppShell;