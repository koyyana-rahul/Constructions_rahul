import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { getNavSections } from "./navConfig";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { useCurrentUser } from "../../features/auth/useSession";
import {
  mobileNavClosed,
  mobileNavOpened,
  selectMobileNavOpen,
  selectSidebarCollapsed,
  sidebarToggled,
} from "../../features/ui/uiSlice";

/**
 * Shared authenticated shell for all three dashboards.
 *
 * Replaces three duplicated dashboard page components that all hardcoded
 * `ml-64` + `h-screen`, which left no mobile layout at all.
 *
 * Sidebar state lives in the `ui` slice rather than local component state:
 * it has to survive the shell remounting between dashboards, and the collapse
 * preference is already persisted to localStorage.
 */
const AppShell = () => {
  const user = useCurrentUser();
  const dispatch = useAppDispatch();
  const collapsed = useAppSelector(selectSidebarCollapsed);
  const mobileOpen = useAppSelector(selectMobileNavOpen);

  // Lock body scroll while the mobile drawer is open, and let Escape close it.
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event) => {
      if (event.key === "Escape") dispatch(mobileNavClosed());
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen, dispatch]);

  // A fresh route should never leave the drawer covering the new page.
  useEffect(() => () => dispatch(mobileNavClosed()), [dispatch]);

  const { home, sections } = getNavSections(user?.role, user?._id);

  return (
    <div className="min-h-screen bg-concrete-100">
      <Sidebar
        sections={sections}
        home={home}
        collapsed={collapsed}
        onToggleCollapse={() => dispatch(sidebarToggled())}
        mobileOpen={mobileOpen}
        onCloseMobile={() => dispatch(mobileNavClosed())}
      />

      {/* Padding tracks the sidebar so there is no unconditional ml-64 on
          mobile, where the sidebar is an overlay instead. */}
      <div
        className={`flex min-h-screen flex-col transition-[padding] duration-200 ease-out-expo ${
          collapsed ? "lg:pl-20" : "lg:pl-72"
        }`}
      >
        <Topbar onOpenMobileNav={() => dispatch(mobileNavOpened())} />
        <main id="main-content" className="flex-1 px-4 py-5 sm:px-6 sm:py-6">
          <div className="mx-auto w-full max-w-[1600px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppShell;