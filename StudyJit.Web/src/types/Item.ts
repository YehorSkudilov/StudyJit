export interface Item {
  id: string;
  type: "folder" | "quiz" | "file" | "other"; // include all possible
  name: string;
  description?: string;
  size?: number;
  generation_status?: "pending" | "success" | "failed" | null;
  [key: string]: any;
}
