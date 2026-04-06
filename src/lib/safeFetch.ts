const originalFetch = window.fetch.bind(window);

window.fetch = (...args: Parameters<typeof fetch>): Promise<Response> => {
  const url = args[0];

  if (typeof url === "string" && url.startsWith("http")) {
    throw new Error("🚫 External fetch blocked");
  }

  return originalFetch(...args);
};

export { originalFetch };
