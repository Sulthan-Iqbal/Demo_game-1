import cors from "cors";
import express from "express";

const PORT = process.env.PORT || 5500;
export const MESSAGE_PATH = "/message";

export function launchApi() {
  // Setup HTTP api
  const api = express(); 
  api.use(express.json());
  api.use(cors({ origin: "*" }));

  // Corrected: Use `api` instead of `app` when creating the server
  api.listen(PORT, () => console.log(`express is up on port ${PORT}`))
  return api;
}
