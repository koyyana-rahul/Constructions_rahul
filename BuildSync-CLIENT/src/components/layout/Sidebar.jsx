import { NavLink } from "react-router-dom";
import { LuChevronsLeft, LuX } from "react-icons/lu";
import { BrandMark, BrandWordmark } from "../brand/Logo";

const linkClasses = ({ isActive }) =>
  `group relative flex items-center gap-3 rounded-md px-3 py-2.5 font-display text-sm font-medium uppercase tracking-wide transition-colors duration-150 ${
    isActive
      ? "bg-navy-800 text-white"
      : "text-navy-200 hover:bg-navy-800/60 hover:text-white"
  }`;

/**
 * Collapsible + off-canvas sidebar.
 * Desktop: fixed rail that collapses to icons.
 * Mobile: hidden behind a hamburger, slides in as an overlay drawer.
 */
const Sidebar = ({
  sections,
  home,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}) => {
  const width = collapsed ? "lg:w-20" : "lg:w-72";

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 animate-fade-in bg-navy-950/60 backdrop-blur-[2px] lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Main navigation"
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-navy-950 bg-navy-900 transition-[width,transform] duration-200 ease-out-expo ${width} ${
          mobileOpen ? "translate-x-0 animate-slide-in-left" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Brand */}
        <div
          className={`flex h-16 shrink-0 items-center border-b border-navy-800 ${
            collapsed ? "lg:justify-center lg:px-0" : "gap-3 px-5"
          } px-5`}
        >
          <BrandMark className="h-9 w-9" />
          <div className={`min-w-0 ${collapsed ? "lg:hidden" : ""}`}>
            <BrandWordmark className="text-lg" variant="onDark" />
            <p className="mt-0.5 truncate font-display text-2xs uppercase tracking-[0.18em] text-navy-300">
              Construction Ops
            </p>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation"
            className="ml-auto rounded p-1.5 text-navy-300 transition-colors hover:bg-navy-800 hover:text-white lg:hidden"
          >
            <LuX className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Links - scrollable so short viewports never clip the last item */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
          {sections.map((section) => (
            <div key={section.label} className="mb-5 last:mb-0">
              <p
                className={`mb-1.5 px-3 font-display text-2xs font-semibold uppercase tracking-[0.16em] text-navy-400 ${
                  collapsed ? "lg:hidden" : ""
                }`}
              >
                {section.label}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === home}
                      onClick={onCloseMobile}
                      title={collapsed ? item.label : undefined}
                      className={linkClasses}
                    >
                      {({ isActive }) => (
                        <>
                          <span
                            className={`absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-accent-500 transition-opacity ${
                              isActive ? "opacity-100" : "opacity-0"
                            }`}
                            aria-hidden="true"
                          />
                          <item.icon
                            className="h-[18px] w-[18px] shrink-0"
                            aria-hidden="true"
                          />
                          <span className={collapsed ? "lg:hidden" : ""}>{item.label}</span>
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Collapse control (desktop only) */}
        <div className="hidden shrink-0 border-t border-navy-800 p-3 lg:block">
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            aria-expanded={!collapsed}
            className={`flex w-full items-center gap-3 rounded-md px-3 py-2 font-display text-xs font-semibold uppercase tracking-wider text-navy-300 transition-colors hover:bg-navy-800 hover:text-white ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <LuChevronsLeft
              className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
                collapsed ? "rotate-180" : ""
              }`}
              aria-hidden="true"
            />
            <span className={collapsed ? "lg:hidden" : ""}>Collapse</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;