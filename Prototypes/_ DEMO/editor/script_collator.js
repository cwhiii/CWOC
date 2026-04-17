(function () {
  // Find the path of this script
  const scripts = document.getElementsByTagName("script");
  let thisScriptSrc = "";
  for (let i = 0; i < scripts.length; i++) {
    if (scripts[i].src && scripts[i].src.endsWith("script_collator.js")) {
      thisScriptSrc = scripts[i].src;
      break;
    }
  }
  if (!thisScriptSrc) return;

  // Get the directory path (with trailing slash)
  const dirPath = thisScriptSrc.substring(
    0,
    thisScriptSrc.lastIndexOf("/") + 1,
  );

  let fileIndex = 1;

  function loadNext() {
    const filename = `editor${fileIndex}.js`;
    if (filename === "script_collator.js") {
      fileIndex++;
      loadNext();
      return;
    }
    const script = document.createElement("script");
    script.src = dirPath + filename;
    script.onload = function () {
      console.log(`Loaded: ${filename}`);
      fileIndex++;
      loadNext();
    };
    script.onerror = function () {
      // Stop after first missing file
    };
    document.head.appendChild(script);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadNext);
  } else {
    loadNext();
  }
})();
