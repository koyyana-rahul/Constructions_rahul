import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { PageLoader } from "./components/ui/Feedback";
import AppShell from "./components/layout/AppShell";
import PrivateRoutes from "./utils/PrivateRoutes";

/*
 * Route-level code splitting.
 *
 * The admin, employee and client portals are used by different people and share
 * almost nothing beyond the design system, so each page is fetched only when
 * its route is entered. This keeps the initial bundle to the shell plus the
 * login screen instead of the whole ERP.
 */
const Login = lazy(() => import("./pages/Login"));
const Activate = lazy(() => import("./pages/Activate"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));

const AdminSummary = lazy(() => import("./components/dashboard/AdminSummary"));
const DepartmentList = lazy(() => import("./components/department/DepartmentList"));
const AddDepartment = lazy(() => import("./components/department/AddDepartment"));
const EditDepartment = lazy(() => import("./components/department/EditDepartment"));
const EmployeeList = lazy(() => import("./components/employee/List"));
const AddEmployee = lazy(() => import("./components/employee/Add"));
const EmployeeView = lazy(() => import("./components/employee/View"));
const EmployeeAttendance = lazy(() => import("./components/employee/Attendance"));
const EditEmployee = lazy(() => import("./components/employee/Edit"));
const ClientList = lazy(() => import("./components/client/List"));
const ClientView = lazy(() => import("./components/client/View"));
const AddClient = lazy(() => import("./components/client/Add"));
const EditClient = lazy(() => import("./components/client/Edit"));
const AddSalary = lazy(() => import("./components/salary/Add"));
const ViewSalary = lazy(() => import("./components/salary/View"));
const EmployeeSummary = lazy(() => import("./components/EmployeeDashboard/Summary"));
const ClientSummary = lazy(() => import("./components/ClientDashboard/Summary"));
const LeaveTable = lazy(() => import("./components/leave/Table"));
const LeaveDetail = lazy(() => import("./components/leave/Detail"));
const LeaveList = lazy(() => import("./components/leave/List"));
const AddLeave = lazy(() => import("./components/leave/Add"));
const WorkTable = lazy(() => import("./components/workReq/Table"));
const WorkDetail = lazy(() => import("./components/workReq/Detail"));
const WorkList = lazy(() => import("./components/workReq/List"));
const AddWork = lazy(() => import("./components/workReq/Add"));
const Attendance = lazy(() => import("./components/attendance/Attendance"));
const AttendanceReport = lazy(() => import("./components/attendance/AttendanceReport"));
const ChangePassword = lazy(() => import("./components/EmployeeDashboard/Setting"));

function App() {
  return (
    <BrowserRouter>
      {/* Keyboard users can jump straight past the navigation. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-navy-900 focus:px-4 focus:py-2 focus:font-display focus:text-sm focus:text-white"
      >
        Skip to content
      </a>

      <Suspense fallback={<PageLoader label="Loading" />}>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Public */}
          <Route path="/login" element={<Login />} />
          {/* Public self-registration is removed. Clients are invited by an
              administrator and activate their own account at /activate. */}
          <Route path="/activate" element={<Activate />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* Administrator */}
          <Route
            path="/admin-dashboard"
            element={<PrivateRoutes allowed={["admin"]} />}
          >
            <Route element={<AppShell />}>
              <Route index element={<AdminSummary />} />
              <Route path="departments" element={<DepartmentList />} />
              <Route path="add-department" element={<AddDepartment />} />
              <Route path="department/:id" element={<EditDepartment />} />
              <Route path="employees" element={<EmployeeList />} />
              <Route path="add-employee" element={<AddEmployee />} />
              <Route path="employees/salary/:id" element={<ViewSalary />} />
              <Route path="employees/leaves/:id" element={<LeaveList />} />
              <Route path="employees/attendance/:id" element={<EmployeeAttendance />} />
              <Route path="employees/edit/:id" element={<EditEmployee />} />
              <Route path="employees/:id" element={<EmployeeView />} />
              <Route path="clients" element={<ClientList />} />
              <Route path="add-client" element={<AddClient />} />
              <Route path="clients/edit/:id" element={<EditClient />} />
              <Route path="clients/:id" element={<ClientView />} />
              <Route path="salary/add" element={<AddSalary />} />
              <Route path="leaves" element={<LeaveTable />} />
              <Route path="leaves/:id" element={<LeaveDetail />} />
              <Route path="work" element={<WorkTable />} />
              <Route path="work/:id" element={<WorkDetail />} />
              <Route path="setting" element={<ChangePassword />} />
              <Route path="attendance" element={<Attendance />} />
              <Route path="attendance-report" element={<AttendanceReport />} />
            </Route>
          </Route>

          {/* Employee */}
          <Route
            path="/employee-dashboard"
            element={<PrivateRoutes allowed={["admin", "employee"]} />}
          >
            <Route element={<AppShell />}>
              <Route index element={<EmployeeSummary />} />
              <Route path="profile/:id" element={<EmployeeView />} />
              <Route path="leaves/:id" element={<LeaveList />} />
              <Route path="add-leave" element={<AddLeave />} />
              <Route path="salary/:id" element={<ViewSalary />} />
              <Route path="setting" element={<ChangePassword />} />
            </Route>
          </Route>

          {/* Client */}
          <Route
            path="/client-dashboard"
            element={<PrivateRoutes allowed={["admin", "client"]} />}
          >
            <Route element={<AppShell />}>
              <Route index element={<ClientSummary />} />
              <Route path="profile/:id" element={<ClientView />} />
              <Route path="setting" element={<ChangePassword />} />
              <Route path="work/:id" element={<WorkList />} />
              <Route path="add-work" element={<AddWork />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;