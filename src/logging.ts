import { AsyncLocalStorage } from "node:async_hooks";
import { configure, getConsoleSink, getLogger } from "@logtape/logtape";

await configure({
  sinks: {
    console: getConsoleSink(),
  },
  filters: {},
  loggers: [
    { category: "microblog", lowestLevel: "debug", sinks: ["console"] },
    { category: "fedify", lowestLevel: "info", sinks: ["console"] },
    {
      category: ["logtape", "meta"],
      lowestLevel: "warning",
      sinks: ["console"],
    },
  ],
  contextLocalStorage: new AsyncLocalStorage(),
});

export const logger = getLogger("microblog");
