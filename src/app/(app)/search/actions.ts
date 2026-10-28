"use server";
import { searchEverything, type SearchGroup } from "@/lib/data/search";

// Called as the person types in the top bar; the short list for the dropdown.
export async function quickSearch(q: string): Promise<SearchGroup[]> {
  return searchEverything(q, 5);
}
