/**
 * @file types/normalizer.ts
 * @description Type definitions for the normalized workspace items and context.
 */

export interface NormalizedItem {
  id: string;
  source: 'github' | 'notion' | 'calendar' | string;
  type: 'pr' | 'issue' | 'task' | 'event' | string;
  title: string;
  status: 'open' | 'closed' | 'blocked' | 'pending_approval' | 'scheduled' | string;
  updatedAt: string;
  url: string;
  assignees: string[];
  metadata: {
    labels?: string[];
    isCritical?: boolean;
    parentProject?: string;
    startTime?: string;
    endTime?: string;
    [key: string]: any;
  };
}

export interface UnifiedWorkspaceContext {
  timestamp: string;
  items: NormalizedItem[];
}
