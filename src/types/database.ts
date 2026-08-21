export type DatabaseCallback<Result = void> = (
  error: Error | null,
  result?: Result,
) => void;
