import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPassRate(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function complexityColor(complexity: string): string {
  const c = complexity.toLowerCase();
  if (c.includes("n^2") || c.includes("n²") || c.includes("2^n") || c.includes("n!"))
    return "text-red-400";
  if (c.includes("n log") || c.includes("nlogn"))
    return "text-amber-400";
  if (c.includes("(n)") || c === "o(n)")
    return "text-cyan-400";
  if (c.includes("log") || c.includes("(1)"))
    return "text-green-400";
  return "text-slate-400";
}

export function complexityBadgeVariant(
  complexity: string
): "badge-red" | "badge-amber" | "badge-cyan" | "badge-green" | "badge-purple" {
  const c = complexity.toLowerCase();
  if (c.includes("n^2") || c.includes("n²") || c.includes("2^n") || c.includes("n!"))
    return "badge-red";
  if (c.includes("n log") || c.includes("nlogn"))
    return "badge-amber";
  if (c.includes("(n)"))
    return "badge-cyan";
  if (c.includes("log") || c.includes("(1)"))
    return "badge-green";
  return "badge-purple";
}

export const DEFAULT_CODE = `def solution(nums: list[int], target: int) -> list[int]:
    """
    Two Sum – find indices of two numbers that add to target.
    Current implementation: O(N²) brute force.
    """
    n = len(nums)
    for i in range(n):
        for j in range(i + 1, n):
            if nums[i] + nums[j] == target:
                return [i, j]
    return []
`;

export const DEFAULT_PROBLEM = `Given an array of integers nums and an integer target, 
return indices of the two numbers such that they add up to target.
You may assume that each input would have exactly one solution, 
and you may not use the same element twice.`;
