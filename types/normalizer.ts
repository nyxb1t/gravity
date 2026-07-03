/**
 * @file types/normalizer.ts
 * @deprecated This file has been removed. All types have been merged into the
 * canonical `types/index.ts`. Import directly from `@/types` instead.
 *
 * Migration guide:
 *   - `NormalizedItem`         → use `WorkspaceItem` from `@/types` for raw
 *                                integration data, or `NormalizedItem` from
 *                                `@/types` for pipeline-processed items.
 *   - `UnifiedWorkspaceContext` → import from `@/types`
 */

export type { UnifiedWorkspaceContext } from './index';
