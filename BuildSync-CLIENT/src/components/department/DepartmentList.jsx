import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LuBuilding2, LuPlus } from "react-icons/lu";
import PageHeader from "../ui/PageHeader";
import Button from "../ui/Button";
import { Card } from "../ui/Card";
import Toolbar, { FilterChips } from "../ui/Toolbar";
import ResponsiveList, { MobileCard } from "../ui/ResponsiveList";
import { StatusBadge } from "../ui/Badge";
import { Alert } from "../ui/Feedback";
import { useQuery } from "../../hooks/useQuery";
import { api, getErrorMessage } from "../../lib/api";
import { columns, DepartmentButtons } from "../../utils/DepartmentHelper";

const DepartmentList = () => {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const { data, error, isLoading, isRefreshing, refetch } = useQuery(
    ["departments"],
    async () => {
      const { data: res } = await api.get("/department", { params: { includeArchived: true } });
      return res.success ? res.departments || [] : [];
    },
    { staleTime: 30_000, poll: 60_000 }
  );

  const departments = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = (data ?? []).map((dep, index) => ({
      _id: dep._id,
      sno: index + 1,
      dep_name: dep.dep_name,
      description: dep.description,
      isArchived: dep.isArchived === true,
    }));

    const byStatus = list.filter((dep) =>
      !status || (status === "archived" ? dep.isArchived : !dep.isArchived)
    );

    if (!term) return byStatus;
    return byStatus.filter((dep) =>
      `${dep.dep_name} ${dep.description || ""}`.toLowerCase().includes(term)
    );
  }, [data, search, status]);

  const counts = useMemo(
    () => ({
      all: (data ?? []).length,
      active: (data ?? []).filter((dep) => dep.isArchived !== true).length,
      archived: (data ?? []).filter((dep) => dep.isArchived === true).length,
    }),
    [data]
  );

  const hasFilter = Boolean(search.trim()) || Boolean(status);

  return (
    <>
      <PageHeader
        title="Construction Sites"
        description="Manage the active sites, projects and work locations in your portfolio."
        breadcrumbs={[{ label: "Admin", to: "/admin-dashboard" }, { label: "Construction Sites" }]}
        actions={
          <>
            {isRefreshing && (
              <span className="hidden text-xs text-concrete-400 sm:inline">Syncing…</span>
            )}
            <Link to="/admin-dashboard/add-department" className="w-full sm:w-auto">
              <Button variant="accent" className="w-full sm:w-auto">
                <LuPlus className="h-4 w-4" aria-hidden="true" />
                Add Site
              </Button>
            </Link>
          </>
        }
      />

      {error && departments.length > 0 && (
        <Alert variant="warning" className="mb-4 sm:mb-5">
          Showing the last known list. {getErrorMessage(error, "Live data is unavailable.")}
        </Alert>
      )}

      <Card className="overflow-hidden">
        <Toolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by site name or description"
          searchLabel="Search construction sites"
          actions={
            <p className="font-display text-xs font-semibold uppercase tracking-wider text-concrete-500">
              {departments.length} {departments.length === 1 ? "site" : "sites"}
            </p>
          }
        >
          <FilterChips
            options={[
              { label: "All", value: "", count: counts.all },
              { label: "Active", value: "active", count: counts.active },
              { label: "Archived", value: "archived", count: counts.archived },
            ]}
            value={status}
            onChange={setStatus}
            ariaLabel="Filter construction sites by status"
          />
        </Toolbar>

        <ResponsiveList
          columns={columns}
          data={departments}
          loading={isLoading}
          error={error && departments.length === 0 ? getErrorMessage(error, null) : null}
          onRetry={refetch}
          searchActive={hasFilter}
          emptyIcon={LuBuilding2}
          emptyTitle={hasFilter ? "No sites match these filters" : "No construction sites yet"}
          emptyDescription={
            hasFilter
              ? "Try a different site name, or clear the filters."
              : "Add your first construction site to start assigning employees and work."
          }
          emptyAction={
            hasFilter ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setStatus("");
                }}
              >
                Clear filters
              </Button>
            ) : (
              <Link to="/admin-dashboard/add-department">
                <Button variant="accent" size="sm">
                  <LuPlus className="h-4 w-4" aria-hidden="true" />
                  Add Site
                </Button>
              </Link>
            )
          }
          mobileCard={(dep) => (
            <MobileCard
              title={dep.dep_name}
              subtitle={dep.description || "No description"}
              status={<StatusBadge status={dep.isArchived ? "Archived" : "Active"} />}
              actions={
                <DepartmentButtons
                  Id={dep._id}
                  name={dep.dep_name}
                  isArchived={dep.isArchived}
                  onDepartmentDelete={refetch}
                />
              }
            />
          )}
        />
      </Card>
    </>
  );
};

export default DepartmentList;