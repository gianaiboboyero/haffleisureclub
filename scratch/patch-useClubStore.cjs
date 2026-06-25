const fs = require("fs");
const file = "apps/web/src/store/useClubStore.ts";
let content = fs.readFileSync(file, "utf8");

// Patch initial state
content = content.replace(
  "  courts: [],",
  `  courts: seedCourts.map((court, index) => {
    const number = court.number ?? index + 1;
    return {
      ...court,
      number,
      priority: number,
      reservable: court.reservable ?? true,
      status: "Available" as const
    };
  }),`
);

// Patch refreshSharedState localCourts
content = content.replace(
  `        : serverAuthoritativeLiveState()
          ? []
          : await db.courts.toArray();`,
  `        : serverAuthoritativeLiveState()
          ? seedCourts.map((court, index) => {
              const number = court.number ?? index + 1;
              return {
                ...court,
                number,
                priority: number,
                reservable: court.reservable ?? true,
                status: "Available" as const
              };
            })
          : await db.courts.toArray();`
);

fs.writeFileSync(file, content);
