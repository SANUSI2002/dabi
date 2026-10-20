import type { ReactElement } from 'react';
import type { AiRequest } from './AiWorkspace.jsx';
export default function AiDocumentsPanel(props: {
  call: (path: string, options?: Parameters<AiRequest>[1]) => Promise<unknown>;
  config: { documents?: boolean; documentConsentVersion?: string } | null;
  uploadDocument?: (file: File) => Promise<unknown>;
  onUse: (source: unknown) => void;
  onBack: () => void;
}): ReactElement;
