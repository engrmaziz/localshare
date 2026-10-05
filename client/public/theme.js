try {
  var stored = localStorage.getItem("localshare.theme") || "system";
  var dark =
    stored === "dark" ||
    (stored === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#0d1014" : "#f3efe6");
} catch (e) {
  /* ignore */
}
