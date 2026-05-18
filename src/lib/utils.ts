import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const NARIMANOV_CENTER: [number, number] = [49.86, 40.407];
export const NARIMANOV_BOUNDS: [[number, number], [number, number]] = [
  [49.83, 40.39],
  [49.89, 40.425],
];
