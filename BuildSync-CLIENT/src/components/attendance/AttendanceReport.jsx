import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LuFileBarChart, LuChevronDown, LuLoader2 } from "react-icons/lu";
import PageHeader from "../ui/PageHeader";
import Button from "../ui/Button";
import { Card, CardHeader, CardBody } from "../ui/Card";
import { StatusBadge } from "../ui/Badge";
import { Alert, EmptyState, TableSkeleton, PermissionDenied } from "../ui/Feedback";
import { api, getErrorMessage } from "../../lib/api";
import { formatDate } from "../../utils/tableUtils";

const PAGE_SIZE = 5;

const AttendanceReport = () => {
  const [report, setReport] = useState({});
  const [skip, setSkip] = useState(0);
  const [dateFilter, setDateFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [forbidden, setForbidden] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const query = new URLSearchParams({ limit: String(PAGE_SIZE), skip: String(skip) });
      if (dateFilter) query.append("date", dateFilter);

      const { data } = await api.get(`/attendance/report?${query.toString()}`);
      if (data.success) {
        setReport((prev) =>
          skip === 0 ? data.groupData || {} : { ...prev, ...(data.groupData || {}) }
        );
      }
    } catch (err) {
      setError(getErrorMessage(err, "Unable to load the attendance report."));
    } finally {
      setLoading(false);
    }
  }, [skip, dateFilter]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const dates = Object.keys(report).sort((a, b) => new Date(b) - new Date(a));
  const hasMore = dates.length >= PAGE_SIZE;

  const totalRecords = dates.reduce(
    (sum, date) => sum + (report[date]?.length || 0),
    0
  );

  return (
    <>
      <PageHeader
        title="Attendance Report"
        description="Historical daily attendance across your workforce, grouped by date."
        breadcrumbs={[
          { label: "Admin", to: "/admin-dashboard" },
          { label: "Attendance", to: "/admin-dashboard/attendance" },
          { label: "Report" },
        ]}
        actions={
          <Link to="/admin-dashboard/attendance">
            <Button variant="outline" size="sm">
              Back to marking
            </Button>
          </Link>
        }
      />

      <Card className="mb-6">
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full sm:max-w-xs">
            <label
              htmlFor="dateFilter"
              className="mb-1.5 block font-display text-xs font-semibold uppercase tracking-wider text-navy-700"
            >
              Filter by date
            </label>
            <input
              id="dateFilter"
              type="date"
              value={dateFilter}
              onChange={(event) => {
                setDateFilter(event.target.value);
                setSkip(0);
              }}
              className="w-full cursor-pointer rounded-md border border-concrete-300 bg-white px-3 py-2 text-sm text-navy-900 transition-colors hover:border-concrete-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-400"
            />
          </div>
          <div className="flex items-center gap-3">
            <p className="font-display text-xs font-semibold uppercase tracking-wider text-concrete-500">
              {totalRecords} record(s) across {dates.length} day(s)
            </p>
            {dateFilter && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDateFilter("");
                  setSkip(0);
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      <Alert variant="error" className="mb-4 sm:mb-5" onDismiss={() => setError(null)}>
        {error}
      </Alert>

      {forbidden && (
        <Card className="mb-5 border-warning-500/30">
          <PermissionDenied />
        </Card>
      )}

      {loading && dates.length === 0 ? (
        <Card>
          <TableSkeleton rows={8} />
        </Card>
      ) : dates.length === 0 ? (
        <Card>
          <EmptyState
            icon={LuFileBarChart}
            title="No attendance records"
            description={
              dateFilter
                ? `No records were found for ${formatDate(dateFilter)}.`
                : "Attendance records appear here once you start marking your workforce."
            }
            action={
              dateFilter && (
                <Button variant="outline" size="sm" onClick={() => setDateFilter("")}>
                  Clear date filter
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {dates.map((date) => (
            <Card key={date} className="overflow-hidden">
              <CardHeader
                title={formatDate(date)}
                actions={
                  <StatusBadge tone="navy">
                    {report[date]?.length || 0} employees
                  </StatusBadge>
                }
              />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[34rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-concrete-200 bg-concrete-50">
                      <th className="px-5 py-3 font-display text-xs font-semibold uppercase tracking-wider text-navy-600">
                        #
                      </th>
                      <th className="px-5 py-3 font-display text-xs font-semibold uppercase tracking-wider text-navy-600">
                        Employee ID
                      </th>
                      <th className="px-5 py-3 font-display text-xs font-semibold uppercase tracking-wider text-navy-600">
                        Name
                      </th>
                      <th className="px-5 py-3 font-display text-xs font-semibold uppercase tracking-wider text-navy-600">
                        Site
                      </th>
                      <th className="px-5 py-3 font-display text-xs font-semibold uppercase tracking-wider text-navy-600">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(report[date] || []).map((record, index) => (
                      <tr
                        key={`${record.employeeId}-${index}`}
                        className="border-b border-concrete-100 last:border-0 transition-colors hover:bg-navy-50/60"
                      >
                        <td className="px-5 py-3 font-display text-xs tabular-nums text-concrete-400">
                          {String(index + 1).padStart(2, "0")}
                        </td>
                        <td className="px-5 py-3 font-mono text-xs text-navy-700">
                          {record.employeeId}
                        </td>
                        <td className="px-5 py-3 font-display font-semibold text-navy-900">
                          {record.employeeName}
                        </td>
                        <td className="px-5 py-3 font-display text-xs font-semibold uppercase tracking-wide text-navy-700">
                          {record.departmentName}
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge status={record.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}

          {hasMore && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => setSkip((prev) => prev + PAGE_SIZE)}
                loading={loading}
              >
                {!loading && <LuChevronDown className="h-4 w-4" aria-hidden="true" />}
                Load more days
              </Button>
            </div>
          )}
        </div>
      )}

      {loading && dates.length > 0 && (
        <p className="mt-4 flex items-center justify-center gap-2 text-sm text-concrete-500">
          <LuLoader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading more days…
        </p>
      )}
    </>
  );
};

export default AttendanceReport;