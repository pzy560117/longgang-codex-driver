import { defineConfig } from "orval";

export default defineConfig({
  ticketApi: {
    input: "./contracts/openapi.yaml",
    output: {
      target: "./packages/api-client/generated/ticket-api.ts",
      schemas: "./packages/api-client/generated/model",
      client: "react-query",
      mock: true,
      mode: "split",
      override: {
        mutator: {
          path: "./packages/api-client/http-client.ts",
          name: "httpClient",
        },
      },
    },
  },
});
