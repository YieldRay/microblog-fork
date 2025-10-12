import db from "./src/db.ts";
import { dropTables } from "./src/migrations.ts";

await dropTables(db);
