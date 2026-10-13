import {
  LuLayoutDashboard,
  LuHardHat,
  LuUser,
  LuBuilding2,
  LuCalendarDays,
  LuClipboardList,
  LuWallet,
  LuCalendarCheck,
  LuFileBarChart,
  LuSettings,
} from "react-icons/lu";

/**
 * Single declarative source for role navigation.
 * Replaces three near-identical hardcoded sidebar components.
 * Paths match the existing routes exactly - nothing is renamed.
 */
const ROLE_NAV = {
  admin: {
    home: "/admin-dashboard",
    sections: [
      {
        label: "Overview",
        items: [{ label: "Dashboard", to: "/admin-dashboard", icon: LuLayoutDashboard }],
      },
      {
        label: "Workforce",
        items: [
          { label: "Employees", to: "/admin-dashboard/employees", icon: LuHardHat },
          { label: "Clients", to: "/admin-dashboard/clients", icon: LuUser },
          { label: "Construction Sites", to: "/admin-dashboard/departments", icon: LuBuilding2 },
        ],
      },
      {
        label: "Operations",
        items: [
          { label: "Leave Requests", to: "/admin-dashboard/leaves", icon: LuCalendarDays },
          { label: "Work Requests", to: "/admin-dashboard/work", icon: LuClipboardList },
          { label: "Salary", to: "/admin-dashboard/salary/add", icon: LuWallet },
          { label: "Attendance", to: "/admin-dashboard/attendance", icon: LuCalendarCheck },
          {
            label: "Attendance Report",
            to: "/admin-dashboard/attendance-report",
            icon: LuFileBarChart,
          },
        ],
      },
      {
        label: "Account",
        items: [{ label: "Settings", to: "/admin-dashboard/setting", icon: LuSettings }],
      },
    ],
  },

  employee: {
    home: "/employee-dashboard",
    sections: (userId) => [
      {
        label: "Overview",
        items: [{ label: "Dashboard", to: "/employee-dashboard", icon: LuLayoutDashboard }],
      },
      {
        label: "My Work",
        items: [
          {
            label: "My Profile",
            to: `/employee-dashboard/profile/${userId}`,
            icon: LuUser,
          },
          {
            label: "Leave Requests",
            to: `/employee-dashboard/leaves/${userId}`,
            icon: LuCalendarDays,
          },
          {
            label: "Salary Slips",
            to: `/employee-dashboard/salary/${userId}`,
            icon: LuWallet,
          },
        ],
      },
      {
        label: "Account",
        items: [{ label: "Settings", to: "/employee-dashboard/setting", icon: LuSettings }],
      },
    ],
  },

  client: {
    home: "/client-dashboard",
    sections: (userId) => [
      {
        label: "Overview",
        items: [{ label: "Dashboard", to: "/client-dashboard", icon: LuLayoutDashboard }],
      },
      {
        label: "My Account",
        items: [
          { label: "My Profile", to: `/client-dashboard/profile/${userId}`, icon: LuUser },
          {
            label: "Work Requests",
            to: `/client-dashboard/work/${userId}`,
            icon: LuClipboardList,
          },
        ],
      },
      {
        label: "Account",
        items: [{ label: "Settings", to: "/client-dashboard/setting", icon: LuSettings }],
      },
    ],
  },
};

/** Resolves sections for a role, calling the builder form for id-dependent ones. */
export const getNavSections = (role, userId) => {
  const config = ROLE_NAV[role];
  if (!config) return { home: "/", sections: [] };
  return {
    home: config.home,
    sections: typeof config.sections === "function" ? config.sections(userId) : config.sections,
  };
};

export default ROLE_NAV;