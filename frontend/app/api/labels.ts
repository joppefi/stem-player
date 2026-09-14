// Hand-written -- codegen (scripts/generate-api-hooks.mjs) only emits hooks
// for GET endpoints, so these mutations aren't generated. Same
// error-handling shape as routes/home.tsx's submit(): parse `detail` from a
// non-OK JSON body, throw.

import type { components } from "./types";

export type Label = components["schemas"]["Label"];
export type LabelCreate = components["schemas"]["LabelCreate"];

async function parseErrorDetail(response: Response): Promise<string> {
  const body = await response.json().catch(() => null);
  return body?.detail ?? `Request failed (${response.status})`;
}

export async function createLabel(
  songId: string,
  data: LabelCreate,
): Promise<Label> {
  const response = await fetch(`/api/songs/${songId}/labels`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(await parseErrorDetail(response));
  return response.json();
}

export async function updateLabel(
  songId: string,
  labelId: string,
  data: LabelCreate,
): Promise<Label> {
  const response = await fetch(`/api/songs/${songId}/labels/${labelId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(await parseErrorDetail(response));
  return response.json();
}

export async function deleteLabel(
  songId: string,
  labelId: string,
): Promise<void> {
  const response = await fetch(`/api/songs/${songId}/labels/${labelId}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error(await parseErrorDetail(response));
}
