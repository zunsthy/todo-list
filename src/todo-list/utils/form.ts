export const formValue = (formData: FormData, name: string): string => {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
};
