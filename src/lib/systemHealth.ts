export const analyzeSystemHealth = (issues: { severity?: string }[]) => {

  if (!issues || issues.length === 0) {
    return {
      score: 100,
      status: "healthy",
      message: "No issues detected"
    };
  }

  const high = issues.filter(i => i.severity === "high").length;
  const medium = issues.filter(i => i.severity === "medium").length;
  const low = issues.filter(i => i.severity === "low").length;

  const score = Math.max(
    0,
    100 - (high * 20 + medium * 10 + low * 2)
  );

  let status = "healthy";

  if (score < 50) status = "critical";
  else if (score < 80) status = "warning";

  return {
    score,
    status,
    breakdown: { high, medium, low }
  };
};
