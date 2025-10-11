import { dropTables } from "./src/migrations.ts";
import db from "./src/db.ts";

await dropTables(db);
