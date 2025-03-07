import { Client } from "@langchain/langgraph-sdk";

export const createClient = () => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "https://storia-cdd2862137c25b7dbbd31df228a10388.us.langgraph.app";
  return new Client({
    apiUrl,
    apiKey: process.env.LANGCHAIN_API_KEY || "",
  });
};
