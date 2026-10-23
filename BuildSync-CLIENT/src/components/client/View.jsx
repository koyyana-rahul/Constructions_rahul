import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { LuPencil, LuMail, LuPhone, LuBuilding2, LuBriefcase, LuCalendar } from "react-icons/lu";
import PageHeader from "../ui/PageHeader";
import Button from "../ui/Button";
import { Card, CardHeader, CardBody } from "../ui/Card";
import DetailList, { DetailField } from "../ui/DetailList";
import Avatar from "../ui/Avatar";
import { StatusBadge } from "../ui/Badge";
import { Alert, PageLoader, EmptyState, PermissionDenied } from "../ui/Feedback";
import { useGetClientQuery } from "../../services/api/endpoints/clientsApi";
import { useGetWorkRequestsQuery } from "../../services/api/endpoints/workRequestsApi";
import { formatDate } from "../../utils/tableUtils";
import { getErrorMessage, isPermissionError, assetUrl } from "../../lib/api";
import { useCurrentUser } from "../../features/auth/useSession";

/**
 * Client profile. Shared by the admin route and the client's own
 * `/client-dashboard/profile/:id` route.
 *
 * The API scopes `GET /client/:id` to the owner, so the `id` in the URL is a
 * locator, not proof of identity - a client opening someone else's id gets a
 * 403 from the server, rendered as PermissionDenied rather than a blank page.
 */
const ClientView = () => {
  const { id } = useParams();
  const user = useCurrentUser();

  const {
    data: client,
    error,
    isLoading: loading,
  } = useGetClientQuery(id, { skip: !id });

  // The route id is the Client record id on the admin route and the User id on
  // the self-service route, so this comparison is the "am I looking at myself?"
  // test rather than an authorization check.
  const isSelf = user?.role === "client" && (user?._id === id || client?.userId?._id === id);

  // Work requests are supplementary context; the server already scopes this
  // list to the caller, so a client only receives their own requests and no
  // browser-side filtering is needed for them.
  const { data: allRequests = [] } = useGetWorkRequestsQuery(
    { limit: 100 },
    { skip: user?.role !== "admin" && !isSelf }
  );

  const requests = useMemo(() => {
    if (isSelf) return allRequests;
    if (user?.role !== "admin") return [];
    const owner = client?.userId?._id ?? client?._id ?? id;
    return allRequests.filter((request) => request.clientId?._id === owner);
  }, [allRequests, client, id, isSelf, user?.role]);

  if (loading) return <PageLoader label="Loading client profile" />;

  if (!client) {
    if (isPermissionError(error)) {
      return (
        <>
          <PageHeader title="Client Profile" />
          <Card>
            <PermissionDenied description={getErrorMessage(error, null)} />
          </Card>
        </>
      );
    }
    return (
      <>
        <PageHeader title="Client Profile" />
        <Alert variant="error">{error ? getErrorMessage(error, null) : "Client record not found."}</Alert>
      </>
    );
  }

  const { userId = {} } = client;
  const avatar = assetUrl(userId.profileImage);

  const approved = requests.filter((r) => r.status === "Approved").length;
  const pending = requests.filter((r) => r.status === "Pending").length;

  return (
    <>
      <PageHeader
        title={userId.name || "Client"}
        description={
          client.companyName
            ? `${client.companyName} · ${client.entityType === "legal" ? "Legal entity" : "Natural person"}`
            : undefined
        }
        breadcrumbs={[
          ...(isSelf
            ? [{ label: "Client Dashboard", to: "/client-dashboard" }]
            : [
                { label: "Admin", to: "/admin-dashboard" },
                { label: "Clients", to: "/admin-dashboard/clients" },
              ]),
          { label: "Profile" },
        ]}
        actions={
          isSelf ? (
            <Link to="/client-dashboard/setting">
              <Button variant="outline" size="sm">
                Change Password
              </Button>
            </Link>
          ) : (
            <Link to={`/admin-dashboard/clients/edit/${client._id}`}>
              <Button variant="accent" size="sm">
                <LuPencil className="h-4 w-4" aria-hidden="true" />
                Edit
              </Button>
            </Link>
          )
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardBody className="flex flex-col items-center text-center">
            <Avatar src={avatar} name={userId.name} size="xl" />
            <h2 className="mt-4 font-display text-lg font-semibold uppercase tracking-wide text-navy-900">
              {userId.name}
            </h2>
            {client.companyName && (
              <p className="mt-0.5 text-sm text-concrete-600">{client.companyName}</p>
            )}
            <div className="mt-3">
              <StatusBadge status={client.entityType} />
            </div>

            <div className="mt-5 w-full space-y-2.5 border-t border-concrete-100 pt-5 text-left">
              {userId.email && (
                <p className="flex items-center gap-2 break-all text-sm text-concrete-600">
                  <LuMail className="h-4 w-4 shrink-0 text-concrete-400" aria-hidden="true" />
                  {userId.email}
                </p>
              )}
              <p className="flex items-center gap-2 text-sm text-concrete-600">
                <LuPhone className="h-4 w-4 shrink-0 text-concrete-400" aria-hidden="true" />
                {client.phone || userId.phone || "—"}
              </p>
              <p className="flex items-center gap-2 text-sm text-concrete-600">
                <LuBriefcase className="h-4 w-4 shrink-0 text-concrete-400" aria-hidden="true" />
                {requests.length} work request{requests.length === 1 ? "" : "s"} raised
              </p>
            </div>
          </CardBody>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Contact Details" />
            <CardBody>
              <DetailList>
                <DetailField label="Contact name" value={userId.name} />
                <DetailField label="Email address" value={userId.email} />
                <DetailField label="Phone number" value={client.phone || userId.phone} />
                <DetailField
                  label="Entity type"
                  value={client.entityType === "legal" ? "Legal entity" : "Natural person"}
                />
                <DetailField label="Organisation" value={client.companyName} />
                <DetailField
                  label="Client since"
                  value={client.createdAt ? formatDate(client.createdAt) : null}
                />
              </DetailList>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Work Request History"
              actions={
                isSelf ? (
                  <Link to={`/client-dashboard/work/${user?._id}`}>
                    <Button variant="outline" size="sm">
                      View all
                    </Button>
                  </Link>
                ) : null
              }
            />
            <CardBody>
              {requests.length === 0 ? (
                <EmptyState
                  icon={LuCalendar}
                  title="No work requests"
                  description="Work requests raised by this client will appear here."
                />
              ) : (
                <>
                  <div className="mb-4 flex flex-wrap gap-3">
                    <StatusBadge status={`${requests.length} total`} tone="navy" />
                    <StatusBadge status={`${approved} approved`} tone="success" />
                    <StatusBadge status={`${pending} pending`} tone="warning" />
                  </div>
                  <ul className="divide-y divide-concrete-100">
                    {requests.slice(0, 5).map((request) => (
                      <li
                        key={request._id}
                        className="flex flex-wrap items-center justify-between gap-3 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-display text-sm font-medium text-navy-800">
                            {request.name}
                          </p>
                          <p className="truncate text-xs text-concrete-500">
                            {request.description || "Work request"}
                            {request.startDate
                              ? ` · ${new Date(request.startDate).toLocaleDateString()}`
                              : ""}
                          </p>
                        </div>
                        <StatusBadge status={request.status} />
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {!isSelf && (
        <p className="mt-5 flex items-center gap-2 text-xs text-concrete-500">
          <LuBuilding2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Work requests for this client are managed from the admin workspace.
        </p>
      )}
    </>
  );
};

export default ClientView;