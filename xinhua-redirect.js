(() => {
  const params = new URLSearchParams(window.location.search);
  const char = String(params.get("char") || "").trim();
  const targetParams = new URLSearchParams();
  targetParams.set("dict", "1");
  if (char) {
    targetParams.set("char", char);
  }
  const targetUrl = `./overview.html?${targetParams.toString()}`;
  const fallback = document.getElementById("fallbackLink");
  if (fallback) {
    fallback.href = targetUrl;
  }
  window.location.replace(targetUrl);
})();
