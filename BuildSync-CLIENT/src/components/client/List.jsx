import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LuUserCog, LuPlus } from "react-icons/lu";
import PageHeader from "../ui/PageHeader";
import Button from "../ui/Button";
import { Card } from "../ui/Card";
import Toolbar from "../ui/Toolbar";
import ResponsiveList, { MobileCard } from "../ui/ResponsiveList";
import { StatusBadge } from "../ui/Badge";
import Avatar from "../ui/Avatar";
import { Alert } from "../ui/Feedback";
import { useGetClientsQuery } from "../../services/api/endpoints/clientsApi";
import { getErrorMessage, assetUrl } from "../../lib/api";
import { clientColumns, ClientButtons } from "../../utils/ClientsHelper";

const ClientList = () => {
  const [search, setSearch] = useState("");

  const { data, error, isLoading, isFetching, refetch } = useGetClientsQuery({ limit: 100 });

  const clients = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = (data ?? []).map((client, index) => ({
      _id: client._id,
      sno: index + 1,
      name: client.userId?.name,
      email: client.userId?.email,
      phone: client.phone,
      entityType: client.entityType,
      companyName: client.companyName,
      isActivated: client.userId?.isActivated !== false,
      userIdRef: client.userId?._id,
      profileImage: assetUrl(client.userId?.profileImage),
    }));

    if (!term) return list;
    return list.filter((client) =>
      `${client.name || ""} ${client.email || ""} ${client.phone || ""} ${
        client.companyName || ""
      }`
        .toLowerCase()
        .includes(term)
    );
  }, [data, search]);

  return (
    <>
      <PageHeader
        title="Clients"
        description="Organisations and individuals you contract with, and their request history."
        breadcrumbs={[{ label: "Admin", to: "/admin-dashboard" }, { label: "Clients" }]}
        actions={
          <>
            {isFetching && !isLoading && (
              <span className="hidden text-xs text-concrete-400 sm:inline">Syncing…</span>
            )}
            <Link to="/admin-dashboard/add-client" className="w-full sm:w-auto">
              <Button variant="accent" className="w-full sm:w-auto">
                <LuPlus className="h-4 w-4" aria-hidden="true" />
                Invite Client
              </Button>
            </Link>
          </>
        }
      />

      {error && clients.length > 0 && (
        <Alert variant="warning" className="mb-4 sm:mb-5">
          Showing the last known list. {getErrorMessage(error, "Live data is unavailable.")}
        </Alert>
      )}

      <Card className="overflow-hidden">
        <Toolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by name, email, phone or organisation"
          searchLabel="Search clients"
          actions={
            <p className="font-display text-xs font-semibold uppercase tracking-wider text-concrete-500">
              {clients.length} {clients.length === 1 ? "client" : "clients"}
            </p>
          }
        />

        <ResponsiveList
          columns={clientColumns}
          data={clients}
          loading={isLoading}
          error={error && clients.length === 0 ? getErrorMessage(error, null) : null}
          onRetry={refetch}
          searchActive={Boolean(search.trim())}
          emptyIcon={LuUserCog}
          emptyTitle={search.trim() ? "No clients match your search" : "No clients yet"}
          emptyDescription={
            search.trim()
              ? "Try a different name, email or organisation."
              : "Invite a client so they can raise work requests with you."
          }
          emptyAction={
            search.trim() ? (
              <Button variant="outline" size="sm" onClick={() => setSearch("")}>
                Clear search
              </Button>
            ) : (
              <Link to="/admin-dashboard/add-client">
                <Button variant="accent" size="sm">
                  <LuPlus className="h-4 w-4" aria-hidden="true" />
                  Invite Client
                </Button>
              </Link>
            )
          }
          mobileCard={(client) => (
            <MobileCard
              title={
                <span className="flex items-center gap-2">
                  <Avatar src={client.profileImage} name={client.name} size="sm" />
                  <span className="min-w-0 truncate">{client.name || "Unnamed client"}</span>
                </span>
              }
              subtitle={
                <>
                  <span className="break-all">{client.email}</span>
                  {client.phone ? ` · ${client.phone}` : ""}
                </>
              }
              status={
                client.isActivated ? (
                  <StatusBadge status="active">Activated</StatusBadge>
                ) : (
                  <StatusBadge status="pending">Awaiting setup</StatusBadge>
                )
              }
              meta={
                <>
                  <span>{client.companyName || "—"}</span>
                  <StatusBadge status={client.entityType} />
                </>
              }
              actions={
                <ClientButtons
                  Id={client._id}
                  name={client.name}
                  userIdRef={client.userIdRef}
                  isActivated={client.isActivated}
                />
              }
            />
          )}
        />
      </Card>
    </>
  );
};

export default ClientList;