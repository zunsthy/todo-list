export type DatabaseCallback<Result = void> = (
  error: Error | null,
  result?: Result,
) => void;

export interface LegacyTodoItem {
  id: string;
  name?: string;
  type?: string;
  pid?: string;
  date?: string;
  category?: string;
  series?: string;
}
