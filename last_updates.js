(function () {
    async function run() {
      const el = document.getElementById("datetime");
      if (!el) return;
  
      let dt;
      try {
        // Fetch deploy timestamp written at build time
        const res = await fetch("/build-info.json", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          dt = new Date(data.buildTime);
        }
      } catch (_) {}
  
      // Fallback if fetch/file not available
      if (!dt || isNaN(+dt)) dt = new Date(document.lastModified);
  
      el.textContent = dt.toLocaleString("en-GB", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZoneName: "short"
      });
    }
  
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", run);
    } else {
      run();
    }
  })();
  