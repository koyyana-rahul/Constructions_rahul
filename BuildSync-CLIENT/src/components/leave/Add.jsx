import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LuCalendarPlus, LuCalendarDays } from "react-icons/lu";
import FormPage from "../ui/FormPage";
import { Input, Select, Textarea } from "../ui/Form";
import { useAddLeaveMutation } from "../../services/api/endpoints/leavesApi";
import { getErrorMessage } from "../../lib/api";
import { useCurrentUser } from "../../features/auth/useSession";

const LEAVE_TYPES = ["Sick Leave", "Casual Leave", "Annual Leave"];

const AddLeave = () => {
  const user = useCurrentUser();
  const navigate = useNavigate();

  const [leave, setLeave] = useState({
    leaveType: "",
    startDate: "",
    endDate: "",
    reason: "",
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);

  // Invalidates Leaves + Dashboard, so the history list, the employee
  // dashboard tiles and the admin queue all update from the server response.
  const [createLeave, { isLoading: submitting }] = useAddLeaveMutation();

  const handleChange = (event) => {
    const {name, value} = event.target;
    setLeave((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
    setError(null);
  };

  const validate = () => {
    const next = {};
    if (!leave.leaveType) next.leaveType = "Select a leave type";
    if (!leave.startDate) next.startDate = "Start date is required";
    if (!leave.endDate) next.endDate = "End date is required";
    if (leave.startDate && leave.endDate && leave.endDate < leave.startDate)
      next.endDate = "End date must be on or after the start date";
    if (!leave.reason.trim()) next.reason = "Please give a reason for your request";
    else if (leave.reason.trim().length < 10)
      next.reason = "Please provide a little more detail (at least 10 characters)";

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    setError(null);
    try {
      await createLeave({ ...leave, userId: user?._id }).unwrap();
      navigate(`/employee-dashboard/leaves/${user?._id}`);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to submit your leave request."));
    }
  };

  const dayCount =
    leave.startDate && leave.endDate && leave.endDate >= leave.startDate
      ? Math.round((new Date(leave.endDate) - new Date(leave.startDate)) / 86400000) || 0
      : null;

  return (
    <FormPage
      title="Apply for Leave"
      description="Submit a leave request for your site manager to review."
      breadcrumbs={[
        { label: "My Dashboard", to: "/employee-dashboard" },
        { label: "Leave Requests", to: `/employee-dashboard/leaves/${user?._id}` },
      ]}
      backTo={`/employee-dashboard/leaves/${user?._id}`}
      submitLabel="Submit request"
      submitting={submitting}
      error={error}
      onSubmit={handleSubmit}
      onCancel={() => navigate(`/employee-dashboard/leaves/${user?._id}`)}
      footerExtra={
        <p className="mr-auto text-xs text-concrete-500">
          Requests are reviewed by your administrator.
        </p>
      }
    >
      <div className="sm:col-span-2">
        <Select
          label="Leave type"
          name="leaveType"
          value={leave.leaveType}
          onChange={handleChange}
          error={errors.leaveType}
          required
          icon={<LuCalendarDays className="h-4 w-4" />}
        >
          <option value="">Select a leave type</option>
          {LEAVE_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </Select>
      </div>

      <Input
        label="From date"
        name="startDate"
        type="date"
        value={leave.startDate}
        onChange={handleChange}
        error={errors.startDate}
        required
        icon={<LuCalendarPlus className="h-4 w-4" />}
      />
      <Input
        label="To date"
        name="endDate"
        type="date"
        value={leave.endDate}
        min={leave.startDate || undefined}
        onChange={handleChange}
        error={errors.endDate}
        required
        hint={dayCount !== null ? `Duration: ${dayCount} day(s)` : undefined}
        icon={<LuCalendarPlus className="h-4 w-4" />}
      />

      <div className="sm:col-span-2">
        <Textarea
          label="Reason"
          name="reason"
          rows={4}
          placeholder="Explain briefly why you need this leave"
          value={leave.reason}
          onChange={handleChange}
          error={errors.reason}
          required
          hint="Your site manager sees this note when reviewing the request."
        />
      </div>
    </FormPage>
  );
};

export default AddLeave;