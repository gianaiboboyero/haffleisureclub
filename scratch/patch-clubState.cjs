const fs = require("fs");
const file = "apps/web/src/lib/supabase/clubState.ts";
let content = fs.readFileSync(file, "utf8");

content = content.replace(
  `      courts: [],`,
  `      courts: [
        { id: "court-1", name: "Court 1", number: 1, status: "Available", priority: 1, reservable: true },
        { id: "court-2", name: "Court 2", number: 2, status: "Available", priority: 2, reservable: true },
        { id: "court-3", name: "Court 3", number: 3, status: "Available", priority: 3, reservable: true }
      ],`
);

fs.writeFileSync(file, content);
