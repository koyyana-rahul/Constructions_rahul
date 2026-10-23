import {
  LuLayoutDashboard,
  LuHardHat,
  LuUser,
  LuBuilding2,
  LuCalendarDays,
  LuClipboardList,
  LuClipboardCheck,
  LuWallet,
  LuCalendarCheck,
  LuFileBarChart,
  LuSettings,
  LuFolderKanban,
  LuPackage,
  LuTruck,
  LuReceipt,
  LuWrench,
  LuShieldAlert,
  LuFileText,
  LuHistory,
} from "react-icons/lu";

/**
 * Single declarative source for role navigation.
 * Paths must match the routes in `App.jsx` exactly - nothing is renamed.
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
        label: "Projects & Field",
        items: [
          { label: "Projects", to: "/admin-dashboard/projects", icon: LuFolderKanban },
          { label: "Task Board", to: "/admin-dashboard/tasks", icon: LuClipboardCheck },
          { label: "Daily Reports", to: "/admin-dashboard/daily-reports", icon: LuFileBarChart },
          { label: "Inventory", to: "/admin-dashboard/inventory", icon: LuPackage },
          { label: "Equipment", to: "/admin-dashboard/equipment", icon: LuWrench },
          { label: "Safety", to: "/admin-dashboard/safety", icon: LuShieldAlert },
          { label: "Documents", to: "/admin-dashboard/documents", icon: LuFileText },
        ],
      },
      {
        label: "Commercial",
        items: [
          { label: "Vendors", to: "/admin-dashboard/vendors", icon: LuTruck },
          { label: "Expenses", to: "/admin-dashboard/expenses", icon: LuReceipt },
          { label: "Invoices", to: "/admin-dashboard/invoices", icon: LuWallet },
        ],
      },
      {
        label: "Workforce",
        items: [
          { label: "Employees", to: "/admin-dashboard/employees", icon: LuHardHat },
          { label: "Clients", to: "/admin-dashboard/clients", icon: LuUser },
          { label: "Construction Sites", to: "/admin-dashboard/departments", icon: LuBuilding2 },
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
        label: "Insights",
        items: [
          { label: "Reports", to: "/admin-dashboard/reports", icon: LuFileBarChart },
          { label: "Audit Trail", to: "/admin-dashboard/audit", icon: LuHistory },
          { label: "Organization", to: "/admin-dashboard/organization", icon: LuBuilding2 },
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
        label: "Site Operations",
        items: [
          { label: "Projects", to: "/employee-dashboard/projects", icon: LuFolderKanban },
          { label: "My Tasks", to: "/employee-dashboard/tasks", icon: LuClipboardCheck },
          { label: "Daily Reports", to: "/employee-dashboard/daily-reports", icon: LuFileBarChart },
          { label: "Inventory", to: "/employee-dashboard/inventory", icon: LuPackage },
          { label: "Equipment", to: "/employee-dashboard/equipment", icon: LuWrench },
          { label: "Safety", to: "/employee-dashboard/safety", icon: LuShieldAlert },
          { label: "Documents", to: "/employee-dashboard/documents", icon: LuFileText },
        ],
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
          { label: "My Reports", to: "/employee-dashboard/reports", icon: LuFileBarChart },
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
        label: "My Project",
        items: [
          { label: "Projects", to: "/client-dashboard/projects", icon: LuFolderKanban },
          { label: "Daily Reports", to: "/client-dashboard/daily-reports", icon: LuFileBarChart },
          { label: "Invoices", to: "/client-dashboard/invoices", icon: LuReceipt },
          { label: "Documents", to: "/client-dashboard/documents", icon: LuFileText },
          { label: "Reports", to: "/client-dashboard/reports", icon: LuFileBarChart },
        ],
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
