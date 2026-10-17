export interface Item {
  id: string;
  type: "folder" | "quiz" | "file" | "other"; // include all possible
  name: string;
  description?: string;
  size?: number;
  generation_status?: "never_generated" | "queued" | "pending" | "success" | "failed" | null;
  [key: string]: any;
}
