import { api } from "./api";

/**
 * Downloads an authenticated binary resource.
 *
 * Private documents and receipts are only served by authorised routes, so a
 * plain anchor cannot be used: the session cookie must travel with the
 * request. Axios fetches the blob, then a temporary object URL triggers the
 * browser's save dialog.
 */
const saveBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || "download";
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser a tick to start the download before releasing the blob.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const downloadAuthenticated = async (url, fallbackName = "download") => {
  const response = await api.get(url, { responseType: "blob" });
  const disposition = response.headers?.["content-disposition"] || "";
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  const filename = match ? decodeURIComponent(match[1]) : fallbackName;
  saveBlob(response.data, filename);
};

/** Downloads an exported CSV from the reports/expense/invoice endpoints. */
export const downloadExport = (url, fallbackName) =>
  downloadAuthenticated(url, fallbackName);
