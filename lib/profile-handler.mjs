const PROFILE_FIELDS = Object.freeze({
  name: { maxLength: 120, nullable: false },
  email: { maxLength: 254, nullable: false },
  diseases: { maxLength: 2000, nullable: true },
  allergies: { maxLength: 2000, nullable: true },
});

function defaultProfile(userId) {
  return {
    userId,
    name: "Guest User",
    email: "guest@example.com",
    diseases: "",
    allergies: "",
  };
}

function validateProfile(body) {
  const data = {};

  for (const [field, value] of Object.entries(body)) {
    // Older clients may send their ID, but it never becomes update data.
    if (field === "userId") continue;

    if (!Object.hasOwn(PROFILE_FIELDS, field)) {
      return { error: "Unsupported profile field" };
    }

    const { maxLength, nullable } = PROFILE_FIELDS[field];
    if (nullable && value === null) {
      data[field] = null;
      continue;
    }

    if (typeof value !== "string" || value.length > maxLength) {
      return { error: `Invalid ${field}` };
    }

    const normalized = value.trim();
    if (!nullable && !normalized) {
      return { error: `Invalid ${field}` };
    }

    if (field === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      return { error: "Invalid email" };
    }

    data[field] = normalized;
  }

  if (Object.keys(data).length === 0) {
    return { error: "Provide at least one profile field" };
  }

  return { data };
}

// Dependencies are injected so authorization and validation can be tested
// without connecting to Clerk or the production database.
export function createProfileHandler({
  getAuth,
  profiles,
  returnDefaultProfile = false,
  logger = console,
}) {
  return async function handler(req, res) {
    if (req.method !== "GET" && req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ error: "Method not allowed" });
    }

    try {
      const auth = await getAuth(req);
      const userId = auth?.userId;

      if (typeof userId !== "string" || !userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const bodyIsObject =
        req.body !== null &&
        typeof req.body === "object" &&
        !Array.isArray(req.body);

      if (req.method === "POST" && !bodyIsObject) {
        return res.status(400).json({ error: "Expected a profile object" });
      }

      // Check both locations rather than letting one supplied ID mask another.
      for (const source of [req.query, bodyIsObject ? req.body : null]) {
        if (
          source &&
          Object.hasOwn(source, "userId") &&
          source.userId !== userId
        ) {
          return res.status(403).json({ error: "Forbidden" });
        }
      }

      if (req.method === "GET") {
        const profile = await profiles.findUnique({ where: { userId } });
        return res
          .status(200)
          .json(profile || (returnDefaultProfile ? defaultProfile(userId) : null));
      }

      const { data, error } = validateProfile(req.body);
      if (error) {
        return res.status(400).json({ error });
      }

      const profile = await profiles.upsert({
        where: { userId },
        update: data,
        create: { ...defaultProfile(userId), ...data },
      });

      return res.status(200).json(profile);
    } catch {
      // Do not return provider errors or log personal profile values.
      logger.error("Profile request failed");
      return res.status(500).json({ error: "Internal server error" });
    }
  };
}
