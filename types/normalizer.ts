
export type IntegrationSource = 'github' | 'notion' | 'calendar';
export type ItemType = 'issue' | 'pr' | 'task' | 'document' | 'event';
export type ItemStatus =
  | 'open'
  | 'closed'
  | 'blocked'
  | 'pending_approval'
  | 'scheduled';

export interface NormalizedItem {
  id: string;                  
  source: IntegrationSource;
  type: ItemType;
  title: string;
  status: ItemStatus;
  updatedAt: string;           
  url?: string;
  assignees: string[];         
  metadata: {
    labels?: string[];          
    isCritical?: boolean;       
    startTime?: string;        
    endTime?: string;           
    parentProject?: string;     
  };
}

export interface UnifiedWorkspaceContext {
  timestamp: string;            // When this snapshot was taken
  items: NormalizedItem[];
}