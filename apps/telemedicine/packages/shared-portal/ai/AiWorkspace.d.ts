import type { ReactElement } from 'react';
export type AiRequest = (path: string, options?: { method?: string; body?: unknown; signal?: AbortSignal }) => Promise<{ status: string; data?: unknown }>;
export default function AiWorkspace(props: { request: AiRequest; accountName?: string; homeHref?: string; embedded?: boolean; uploadDocument?: (file: File) => Promise<unknown> }): ReactElement;
