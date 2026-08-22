export const formValue = (formData: FormData, name: string): string => {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
};

export const formListValue = (formData: FormData, name: string): string[] =>
  formValue(formData, name)
    .split(/[,，;；\n]/)
    .map((value) => value.trim())
    .filter(Boolean);
