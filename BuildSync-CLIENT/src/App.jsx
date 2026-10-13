import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Activate from "./pages/Activate";
import ForgotPassword from "./pages/ForgotPassword";
import AppShell from "./components/layout/AppShell";
import PrivateRoutes from "./utils/PrivateRoutes";
import AdminSummary from "./components/dashboard/AdminSummary";
import DepartmentList from "./components/department/DepartmentList";
import AddDepartment from "./components/department/AddDepartment";
import EditDepartment from "./components/department/EditDepartment";
import EmployeeList from "./components/employee/List";
import AddEmployee from "./components/employee/Add";
import EmployeeView from "./components/employee/View";
import EmployeeAttendance from "./components/employee/Attendance";
import EditEmployee from "./components/employee/Edit";
import ClientList from "./components/client/List";
import ClientView from "./components/client/View";
import AddClient from "./components/client/Add";
import EditClient from "./components/client/Edit";
import AddSalary from "./components/salary/Add";
import ViewSalary from "./components/salary/View";
import EmployeeSummary from "./components/EmployeeDashboard/Summary";
import ClientSummary from "./components/ClientDashboard/Summary";
import LeaveTable from "./components/leave/Table";
import LeaveDetail from "./components/leave/Detail";
import LeaveList from "./components/leave/List";
import AddLeave from "./components/leave/Add";
import WorkTable from "./components/workReq/Table";
import WorkDetail from "./components/workReq/Detail";
import WorkList from "./components/workReq/List";
import AddWork from "./components/workReq/Add";
import Attendance from "./components/attendance/Attendance";
import AttendanceReport from "./components/attendance/AttendanceReport";
import AdminSettings from "./components/EmployeeDashboard/Setting";
import ClientSettings from "./components/ClientDashboard/Setting";

function App() {
  return (
    <BrowserRouter>
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
          element={
            <PrivateRoutes allowed={["admin"]} />
          }
        >
          <Route element={<AppShell />}>
            <Route index element={<AdminSummary />} />
            <Route path="departments" element={<DepartmentList />} />
            <Route path="add-department" element={<AddDepartment />} />
            <Route path="department/:id" element={<EditDepartment />} />
            <Route path="employees" element={<EmployeeList />} />
            <Route path="add-employee" element={<AddEmployee />} />
            <Route path="employees/:id" element={<EmployeeView />} />
            <Route path="employees/edit/:id" element={<EditEmployee />} />
            <Route path="employees/salary/:id" element={<ViewSalary />} />
            <Route path="clients" element={<ClientList />} />
            <Route path="add-client" element={<AddClient />} />
            <Route path="clients/edit/:id" element={<EditClient />} />
            <Route path="clients/:id" element={<ClientView />} />
            <Route path="salary/add" element={<AddSalary />} />
            <Route path="leaves" element={<LeaveTable />} />
            <Route path="leaves/:id" element={<LeaveDetail />} />
            <Route path="work" element={<WorkTable />} />
            <Route path="work/:id" element={<WorkDetail />} />
            <Route path="employees/leaves/:id" element={<LeaveList />} />
            <Route path="employees/attendance/:id" element={<EmployeeAttendance />} />
            <Route path="setting" element={<AdminSettings />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="attendance-report" element={<AttendanceReport />} />
          </Route>
        </Route>

        {/* Employee */}
        <Route
          path="/employee-dashboard"
          element={
            <PrivateRoutes allowed={["admin", "employee"]} />
          }
        >
          <Route element={<AppShell />}>
            <Route index element={<EmployeeSummary />} />
            <Route path="profile/:id" element={<EmployeeView />} />
            <Route path="leaves/:id" element={<LeaveList />} />
            <Route path="add-leave" element={<AddLeave />} />
            <Route path="salary/:id" element={<ViewSalary />} />
            <Route path="setting" element={<AdminSettings />} />
          </Route>
        </Route>

        {/* Client */}
        <Route
          path="/client-dashboard"
          element={
            <PrivateRoutes allowed={["admin", "client"]} />
          }
        >
          <Route element={<AppShell />}>
            <Route index element={<ClientSummary />} />
            <Route path="profile/:id" element={<ClientView />} />
            <Route path="setting" element={<ClientSettings />} />
            <Route path="work/:id" element={<WorkList />} />
            <Route path="add-work" element={<AddWork />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;