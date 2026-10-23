import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  LuDownload,
  LuEye,
  LuEyeOff,
  LuFile,
  LuFileText,
  LuFolderOpen,
  LuUpload,
  LuSearch,
  LuTrash2,
} from "react-icons/lu";
import PageHeader from "../../components/ui/PageHeader";
import { Card, CardBody } from "../../components/ui/Card";
import StatCard from "../../components/ui/StatCard";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { Alert, EmptyState } from "../../components/ui/Feedback";
import { FilterChips } from "../../components/ui/Toolbar";
import { Input, Select, Textarea, Checkbox } from "../../components/ui/Form";
import Modal from "../../components/ui/Modal";
import ConfirmDialog, { useConfirm } from "../../components/ui/ConfirmDialog";
import { downloadAuthenticated } from "../../lib/download";
import { getErrorMessage } from "../../lib/api";
import { useCurrentUser } from "../../features/auth/useSession";
import {
  useDeleteDocumentMutation,
  useGetDocumentsQuery,
  useUpdateDocumentMutation,
  useUploadDocumentMutation,
} from "../../services/api/endpoints/fieldApi";
import {
  formatDate,
  projectName,
  useOperationReference,
} from "../../components/operations/shared";

const CATEGORIES = ["Drawing", "Contract", "Permit", "Report", "Specification", "Certificate", "Photo", "Other"];

const CATEGORY_FILTERS = [
  { value: "", label: "All" },
  ...CATEGORIES.map((category) => ({ value: category, label: category })),
];

const emptyForm = () => ({
  project: "",
  site: "",
  category: "Other",
  name: "",
  notes: "",
  isClientVisible: true,
});

const readableSize = (bytes) => {
  const value = Number(bytes) || 0;
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  if (value >= 1024) return `${Math.round(value / 1024)} KB`;
  return `${value} B`;
};

const Documents = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const user = useCurrentUser();
  const admin = user?.role === "admin";
  const client = user?.role === "client";

  const [projectFilter, setProjectFilter] = useState(searchParams.get("project") || "");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const confirm = useConfirm();

  const reference = useOperationReference({ projects: true, sites: admin });

  const { data, isLoading, error: loadError, refetch } = useGetDocumentsQuery({
    limit: 200,
    project: projectFilter || undefined,
    category: category || undefined,
  });
  const [uploadDocument, uploadState] = useUploadDocumentMutation();
  const [updateDocument, updateState] = useUpdateDocumentMutation();
  const [deleteDocument, deleteState] = useDeleteDocumentMutation();

  const saving = uploadState.isLoading || updateState.isLoading;

  const documents = useMemo(() => {
    const list = data?.documents ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return list;
    return list.filter((document) =>
      [document.name, document.originalName, document.notes, document.project?.name, document.project?.code]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [data, search]);

  useEffect(() => {
    if (!id) return;
    const match = (data?.documents ?? []).find((document) => document._id === id);
    if (match) setDetail(match);
  }, [id, data]);

  const metrics = useMemo(() => {
    const list = data?.documents ?? [];
    return {
      total: list.length,
      drawings: list.filter((document) => document.category === "Drawing").length,
      shared: list.filter((document) => document.isClientVisible).length,
      storage: list.reduce((sum, document) => sum + (document.size || 0), 0),
    };
  }, [data]);

  const openUpload = () => {
    setEditing(null);
    setForm({
      ...emptyForm(),
      project: projectFilter || (client ? reference.projects[0]?._id || "" : ""),
      site: admin && projectFilter ? "" : "",
    });
    setFile(null);
    setFormError("");
    setUploadOpen(true);
  };

  const openEdit = (document) => {
    setDetail(null);
    setEditing(document);
    setForm({
      project: document.project?._id || document.project || "",
      site: document.site?._id || document.site || "",
      category: document.category || "Other",
      name: document.name || "",
      notes: document.notes || "",
      isClientVisible: document.isClientVisible !== false,
    });
    setFormError("");
    setUploadOpen(true);
  };

  const update = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  const onSubmit = async (event) => {
    event.preventDefault();
    setFormError("");
    if (!editing && !file) {
      setFormError("Choose a file to upload.");
      return;
    }
    if (!editing && !form.project && !form.site) {
      setFormError("Attach the document to a project or a site.");
      return;
    }
    if (!editing && client && !form.project) {
      setFormError("Choose one of your projects for this document.");
      return;
    }
    try {
      if (editing) {
        await updateDocument({
          id: editing._id,
          name: form.name.trim() || editing.name,
          category: form.category,
          notes: form.notes,
          ...(admin ? { isClientVisible: form.isClientVisible } : {}),
        }).unwrap();
      } else {
        const payload = new FormData();
        payload.append("file", file);
        payload.append("name", form.name.trim());
        payload.append("category", form.category);
        payload.append("notes", form.notes);
        payload.append("project", form.project);
        payload.append("site", form.site);
        if (admin) payload.append("isClientVisible", form.isClientVisible ? "true" : "false");
        await uploadDocument(payload).unwrap();
      }
      setUploadOpen(false);
    } catch (submitError) {
      setFormError(getErrorMessage(submitError, "The document could not be saved."));
    }
  };

  const onDownload = async (document) => {
    setError("");
    try {
      await downloadAuthenticated(`/document/${document._id}/download`, document.originalName || document.name);
    } catch (downloadError) {
      setError(getErrorMessage(downloadError, "The document could not be downloaded."));
    }
  };

  const onDelete = async () => {
    try {
      await deleteDocument(confirm.target).unwrap();
      confirm.close();
      setDetail(null);
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
      confirm.close();
    }
  };

  const canManage = (document) =>
    admin || String(document.uploadedBy?._id || document.uploadedBy) === String(user?._id);

  return (
    <>
      <PageHeader
        title={client ? "Project Documents" : "Documents"}
        description={
          client
            ? "Drawings, permits and reports shared with you by your contractor."
            : "Project drawings, contracts, permits and certificates. Files are private and only opened through authenticated downloads."
        }
        actions={
          <Button variant="accent" onClick={openUpload}>
            <LuUpload className="h-4 w-4" aria-hidden="true" /> Upload Document
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 sm:mb-5">
        <StatCard icon={LuFolderOpen} label="Documents" value={metrics.total} tone="navy" />
        <StatCard icon={LuFileText} label="Drawings" value={metrics.drawings} tone="accent" />
        <StatCard icon={LuEye} label="Client visible" value={metrics.shared} tone="success" />
        <StatCard icon={LuFile} label="Stored" value={readableSize(metrics.storage)} tone="navy" />
      </div>

      {error && <div className="mb-4"><Alert variant="error" onDismiss={() => setError("")}>{error}</Alert></div>}

      <Card>
        <div className="flex flex-col gap-3 border-b border-concrete-200 px-4 py-3.5 sm:px-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-xs">
              <LuSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-concrete-400" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search documents"
                aria-label="Search documents"
                className="w-full rounded-md border border-concrete-300 bg-white py-2 pl-9 pr-3 text-sm text-navy-900 placeholder:text-concrete-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-400"
              />
            </div>
            <Select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)} aria-label="Filter by project" className="sm:!w-56">
              <option value="">All projects</option>
              {reference.projects.map((project) => (
                <option key={project._id} value={project._id}>{projectName(project)}</option>
              ))}
            </Select>
          </div>
          <FilterChips options={CATEGORY_FILTERS.slice(0, 5)} value={category} onChange={setCategory} ariaLabel="Filter documents by category" />
        </div>

        {isLoading ? (
          <CardBody><p className="py-8 text-center text-sm text-concrete-500">Loading documents…</p></CardBody>
        ) : loadError ? (
          <EmptyState title="Could not load documents" description={getErrorMessage(loadError)} action={<Button variant="outline" onClick={refetch}>Try again</Button>} />
        ) : documents.length === 0 ? (
          <EmptyState icon={LuFolderOpen} title={search || category ? "No matching documents" : "No documents yet"} description={client ? "Documents shared with you will appear here." : "Upload drawings, permits and contracts to keep them with the project."} action={<Button variant="accent" onClick={openUpload}>Upload a document</Button>} />
        ) : (
          <ul className="divide-y divide-concrete-100">
            {documents.map((document) => (
              <li key={document._id} className="flex flex-wrap items-start gap-3 px-4 py-3.5 sm:px-5">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-concrete-100 text-concrete-600">
                  <LuFile className="h-5 w-5" aria-hidden="true" />
                </span>
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setDetail(document)}>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-sm font-semibold text-navy-900">{document.name}</p>
                    <Badge tone="neutral">{document.category}</Badge>
                    {document.isClientVisible ? (
                      <span className="inline-flex items-center gap-1 text-2xs uppercase tracking-wide text-success-700"><LuEye className="h-3 w-3" /> Client visible</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-2xs uppercase tracking-wide text-concrete-500"><LuEyeOff className="h-3 w-3" /> Internal</span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-concrete-500">
                    <span>{document.project ? projectName(document.project) : document.site?.dep_name || "Unassigned"}</span>
                    <span>{formatDate(document.createdAt)}</span>
                    <span>{readableSize(document.size)}</span>
                    {document.uploadedBy?.name && <span>By {document.uploadedBy.name}</span>}
                    {document.version > 1 && <span>v{document.version}</span>}
                  </div>
                  {document.notes && <p className="mt-1 line-clamp-1 text-sm text-concrete-600">{document.notes}</p>}
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="outline" size="sm" onClick={() => onDownload(document)}>
                    <LuDownload className="h-3.5 w-3.5" aria-hidden="true" /> Download
                  </Button>
                  {canManage(document) && (
                    <Button variant="ghost" size="sm" onClick={() => openEdit(document)}>Edit</Button>
                  )}
                  {canManage(document) && (
                    <Button variant="ghost" size="icon" aria-label="Delete document" onClick={() => confirm.open(document._id)}>
                      <LuTrash2 className="h-4 w-4 text-danger-600" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Detail */}
      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.name || "Document"}
        description={detail ? `${detail.category} · ${readableSize(detail.size)}` : undefined}
        size="md"
        footer={
          detail ? (
            <>
              <Button variant="outline" onClick={() => setDetail(null)}>Close</Button>
              {canManage(detail) && <Button variant="outline" onClick={() => openEdit(detail)}>Edit metadata</Button>}
              <Button variant="accent" onClick={() => onDownload(detail)}>
                <LuDownload className="h-4 w-4" aria-hidden="true" /> Download
              </Button>
            </>
          ) : null
        }
      >
        {detail && (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-3 rounded-md bg-concrete-50 p-3 text-sm">
              <div><dt className="text-xs text-concrete-500">Project</dt><dd className="mt-1 text-navy-900">{detail.project ? projectName(detail.project) : "—"}</dd></div>
              <div><dt className="text-xs text-concrete-500">Site</dt><dd className="mt-1 text-navy-900">{detail.site?.dep_name || "—"}</dd></div>
              <div><dt className="text-xs text-concrete-500">Original file</dt><dd className="mt-1 break-all text-navy-900">{detail.originalName || detail.filename}</dd></div>
              <div><dt className="text-xs text-concrete-500">Uploaded</dt><dd className="mt-1 text-navy-900">{formatDate(detail.createdAt)}</dd></div>
              <div><dt className="text-xs text-concrete-500">Uploaded by</dt><dd className="mt-1 text-navy-900">{detail.uploadedBy?.name || "—"}</dd></div>
              <div><dt className="text-xs text-concrete-500">Client portal</dt><dd className="mt-1 text-navy-900">{detail.isClientVisible ? "Visible" : "Internal only"}</dd></div>
            </dl>
            {detail.notes && <p className="text-sm leading-relaxed text-concrete-600">{detail.notes}</p>}
          </div>
        )}
      </Modal>

      {/* Upload / edit */}
      <Modal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title={editing ? "Edit document" : "Upload document"}
        description={editing ? "File contents cannot be replaced. Upload a new version as a separate document." : "Files are stored privately and served only through authenticated downloads."}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
            <Button variant="accent" form="document-form" type="submit" loading={saving}>
              {editing ? "Save changes" : "Upload"}
            </Button>
          </>
        }
      >
        <form id="document-form" onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {formError && <div className="sm:col-span-2"><Alert variant="error">{formError}</Alert></div>}
          {!editing && (
            <div className="sm:col-span-2">
              <label htmlFor="document-file" className="mb-1.5 block font-display text-xs font-semibold uppercase tracking-wider text-navy-700">
                File
              </label>
              <input
                id="document-file"
                type="file"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                required
                className="block w-full cursor-pointer rounded-md border border-concrete-300 bg-white px-3 py-2 text-sm text-navy-900 file:mr-3 file:rounded file:border-0 file:bg-concrete-100 file:px-3 file:py-1.5 file:font-display file:text-xs file:font-semibold file:uppercase file:tracking-wide file:text-navy-800"
              />
              <p className="mt-1 text-xs text-concrete-500">PDF, Office, image, CAD or ZIP up to 25 MB.</p>
            </div>
          )}
          <div className="sm:col-span-2">
            <Input label="Document name" value={form.name} onChange={update("name")} placeholder="Defaults to the file name" />
          </div>
          <Select label="Category" value={form.category} onChange={update("category")}>
            {CATEGORIES.map((value) => <option key={value} value={value}>{value}</option>)}
          </Select>
          {!client && (
            <Select label="Project" value={form.project} onChange={update("project")} disabled={Boolean(editing)}>
              <option value="">No project</option>
              {reference.projects.map((project) => (
                <option key={project._id} value={project._id}>{project.code} · {projectName(project)}</option>
              ))}
            </Select>
          )}
          {client && (
            <Select label="Project" value={form.project} onChange={update("project")} disabled={Boolean(editing)} required>
              <option value="">Select one of your projects</option>
              {reference.projects.map((project) => (
                <option key={project._id} value={project._id}>{project.code} · {projectName(project)}</option>
              ))}
            </Select>
          )}
          {admin && (
            <>
              <Select label="Site" value={form.site} onChange={update("site")} disabled={Boolean(editing)}>
                <option value="">No site</option>
                {reference.sites.map((site) => <option key={site._id} value={site._id}>{site.dep_name}</option>)}
              </Select>
              {form.project && (
                <div className="sm:col-span-2">
                  <Checkbox
                    label="Share with the client portal"
                    checked={form.isClientVisible}
                    onChange={(event) => setForm((current) => ({ ...current, isClientVisible: event.target.checked }))}
                  />
                </div>
              )}
            </>
          )}
          <div className="sm:col-span-2">
            <Textarea label="Notes" rows={2} value={form.notes} onChange={update("notes")} />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirm.confirmOpen}
        onCancel={confirm.close}
        onConfirm={onDelete}
        title="Delete this document?"
        description="The file and its metadata are permanently removed."
        confirmLabel="Delete document"
        loading={deleteState.isLoading}
      />
    </>
  );
};

export default Documents;
