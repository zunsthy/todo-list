import type { CSSProperties } from "react";

export interface Work {
  id: string;
  title: string;
  coverUrl?: string;
  aliases: string[];
  authors: string[];
  otherInfo: string;
}

export interface Publication {
  id: string;
  workId: string;
  category: string;
  timelineGroup?: string;
  title: string;
  subtitle: string;
  date: string;
  endDate?: string;
  isbn: string;
}

export interface Episode {
  id: string;
  publicationId: string;
  number: string;
  title: string;
  date: string;
}

export interface CompletionMapping {
  id: string;
  completed: boolean;
}

export interface CatalogEpisode extends Episode {
  completed: boolean;
}

export interface CatalogPublication extends Publication {
  completed: boolean;
  episodes: CatalogEpisode[];
}

export interface CatalogWork extends Work {
  completed: boolean;
  publications: CatalogPublication[];
}

export interface CatalogSnapshot {
  works: Work[];
  publications: Publication[];
  episodes: Episode[];
  completion: CompletionMapping[];
}

export interface CatalogStoreRecords {
  works: Work;
  publications: Publication;
  episodes: Episode;
  completion: CompletionMapping;
}

export type CatalogStoreName = keyof CatalogStoreRecords;
export type CatalogEntityStoreName = Exclude<CatalogStoreName, "completion">;

export type CatalogMutation = {
  [Store in CatalogStoreName]: {
    storeName: Store;
    dataList: CatalogStoreRecords[Store][];
  };
}[CatalogStoreName];

export type CatalogRecordMutation = {
  [Store in CatalogEntityStoreName]: {
    storeName: Store;
    dataList: CatalogStoreRecords[Store][];
  };
}[CatalogEntityStoreName];

export type CatalogRecordTarget = {
  [Store in CatalogEntityStoreName]: {
    storeName: Store;
    id: string;
  };
}[CatalogEntityStoreName];

export type CatalogImportData = Partial<CatalogSnapshot>;
export type CatalogImportScope = "all" | CatalogStoreName;

export interface CatalogTransferData {
  works: Work[];
  publications: Publication[];
  episodes: Episode[];
  completion?: CompletionMapping[];
}

export interface CatalogTransferDocument {
  format: "todo-list-catalog";
  version: 1;
  exportedAt: string;
  data: CatalogTransferData;
}

export interface CatalogWorkTransferPublication extends Publication {
  episodes: Episode[];
}

export interface CatalogWorkTransferWork extends Work {
  publications: CatalogWorkTransferPublication[];
}

export interface CatalogWorkTransferDocument {
  format: "todo-list-catalog-work";
  version: 1;
  exportedAt: string;
  data: {
    work: CatalogWorkTransferWork;
    completion: CompletionMapping[];
  };
}

export type CatalogExportDocument =
  CatalogTransferDocument | CatalogWorkTransferDocument;

export type SaveCatalogRecord = (
  mutation: CatalogRecordMutation,
) => Promise<void>;
export type DeleteCatalogRecord = (
  target: CatalogRecordTarget,
) => Promise<void>;
export type ImportCatalogData = (data: CatalogImportData) => Promise<void>;
export type SetCompletion = (id: string, completed: boolean) => Promise<void>;
export type EditCatalogRecord = (target: CatalogRecordTarget) => void;
export type SetEditingCatalogRecord = (
  target: CatalogRecordTarget | null,
) => void;

export interface CatalogActions {
  addRecord: SaveCatalogRecord;
  updateRecord: SaveCatalogRecord;
  deleteRecord: DeleteCatalogRecord;
  importData: ImportCatalogData;
  setCompletion: SetCompletion;
}

export interface CatalogTimelineProps {
  works: readonly CatalogWork[];
  onEdit: EditCatalogRecord;
}

export interface CatalogEditorProps {
  works: readonly CatalogWork[];
  snapshot: CatalogSnapshot;
  editing: CatalogRecordTarget | null;
  onEditingChange: SetEditingCatalogRecord;
}

export interface CatalogFormCallbacks {
  onCancel?: () => void;
  onSaved?: () => void;
}

export interface WorkFormProps extends CatalogFormCallbacks {
  work?: Work;
}

export interface PublicationFormProps extends CatalogFormCallbacks {
  workId: string;
  publication?: Publication;
}

export interface EpisodeFormProps extends CatalogFormCallbacks {
  publicationId: string;
  episode?: Episode;
}

export interface DataTransferProps {
  snapshot: CatalogSnapshot;
}

export interface EditorTriggerProps {
  onOpen: () => void;
}

export interface EditorTriggerPosition {
  x: number;
  y: number;
}

export interface EditorTriggerDrag {
  pointerId: number;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  moved: boolean;
}

export interface TimelineYear {
  year: number;
  startColumn: number;
}

export interface TimelineItem {
  key: string;
  target: CatalogRecordTarget;
  title: string;
  subtitle: string;
  date: string;
  endDate?: string;
  completed: boolean;
  completedEpisodes: number;
  episodeCount: number;
}

export interface TimelineEntry {
  items: TimelineItem[];
  startColumn: number;
  span: number;
  color: string;
}

export interface TimelineTrack {
  category: string;
  groups: TimelineGroup[];
}

export interface TimelineGroup {
  name: string;
  lanes: TimelineLane[];
}

export interface TimelineLane {
  entries: TimelineEntry[];
}

export interface WorkTimeline {
  work: CatalogWork;
  tracks: TimelineTrack[];
  undated: TimelineItem[];
}

export interface CatalogTimelineModel {
  startYear: number;
  endYear: number;
  quarterCount: number;
  years: TimelineYear[];
  works: WorkTimeline[];
}

export type TimelineStyle = CSSProperties & {
  "--quarter-count"?: number;
  "--item-color"?: string;
};
