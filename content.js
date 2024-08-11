const b = require("blessed"),
  fs = require("fs"),
  path = require("path"),
  m = require("gray-matter"),
  ax = require("axios"),
  chokidar = require("chokidar"),
  diff = require("diff");

const d =
    "/Users/ejfox/Library/Mobile Documents/iCloud~md~obsidian/Documents/ejfox/drafts",
  s = b.screen({ smartCSR: true }),
  main = b.box({ parent: s, top: 0, left: 0, width: "100%", height: "100%" }),
  title = b.text({
    parent: main,
    top: 0,
    left: "center",
    content: "Draft Assistant",
  }),
  status = b.text({ parent: main, bottom: 0, left: 0, right: 0, height: 1 }),
  draftList = b.list({
    parent: main,
    top: 2,
    left: 0,
    width: "100%",
    height: "100%-3",
    keys: true,
    vi: true,
    mouse: true,
    items: [],
    style: { selected: { inverse: true } },
  }),
  content = b.box({
    parent: main,
    top: 2,
    left: 0,
    width: "100%",
    height: "100%-3",
    hidden: true,
    content: "",
    scrollable: true,
    alwaysScroll: true,
    keys: true,
    vi: true,
    mouse: true,
    wrap: true,
    tags: true,
  });

const gdi = (f) => {
    try {
      const c = fs.readFileSync(path.join(d, f), "utf-8"),
        { data, content: body } = m(c);
      return {
        f,
        dek: data.dek || "No dek",
        mt: fs.statSync(path.join(d, f)).mtime,
        content: body,
        wc: body.split(/\s+/).length,
        hc: body.split("\n").filter((l) => l.startsWith("#")).length,
        ...data,
      };
    } catch (e) {
      return null;
    }
  },
  ft = (t) =>
    t
      .replace(/\*\*(.*?)\*\*/g, "{bold}$1{/bold}")
      .replace(/\*(.*?)\*/g, "{italic}$1{/italic}")
      .replace(/`(.*?)`/g, "{underline}$1{/underline}")
      .replace(/^# (.*$)/gm, "{bold}$1{/bold}")
      .replace(/^## (.*$)/gm, "{bold}$1{/bold}")
      .replace(/^### (.*$)/gm, "{bold}$1{/bold}");

let dDrafts = [],
  cDraft,
  cPath,
  cSteps,
  cStepIndex,
  vInd = "|";

const uVI = () => {
    vInd = ["|", "/", "-", "\\"][(["|", "/", "-", "\\"].indexOf(vInd) + 1) % 4];
    uStatus();
  },
  uStatus = () => {
    status.setContent(
      `${vInd} ${
        cDraft ? `${cDraft.f} (${cDraft.wc} words)` : "No draft"
      } | ↑↓/jk:Nav | Enter:Select | z:Zoom | q:Quit`
    );
    s.render();
  },
  ld = () => {
    try {
      const a = fs
        .readdirSync(d)
        .filter((f) => f.endsWith(".md") && !f.startsWith("!"))
        .map(gdi)
        .filter((d) => d !== null)
        .sort((a, b) => b.mt - a.mt);
      dDrafts = [
        ...a.slice(0, 3),
        ...a
          .slice(3)
          .sort(() => 0.5 - Math.random())
          .slice(0, 2),
        ...a.slice(3),
      ];
      draftList.setItems(
        dDrafts.map(
          (d, i) =>
            `${i < 3 ? "▶" : i < 5 ? "?" : "✧"} ${d.f} - ${d.dek} (${
              d.wc
            } words, ${d.hc} headers)`
        )
      );
      draftList.select(0);
      draftList.focus();
      draftList.show();
      content.hide();
      uStatus();
    } catch (e) {
      status.setContent(`Error: ${e.message}`);
    }
  },
  gt = async (d) => {
    content.setContent("Analyzing...");
    draftList.hide();
    content.show();
    content.focus();
    s.render();
    try {
      const r = await ax.post(
        "http://localhost:1234/v1/chat/completions",
        {
          model: "lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF",
          messages: [{ role: "user", content: `Analyze:\n\n${d.content}` }],
          stream: true,
        },
        { responseType: "stream" }
      );
      let o = "";
      r.data.on("data", (c) => {
        c.toString()
          .split("\n")
          .filter((l) => l.trim() !== "")
          .forEach((l) => {
            if (l.startsWith("data: "))
              try {
                o += JSON.parse(l.slice(6)).choices[0].delta.content || "";
                content.setContent(ft(o));
                s.render();
              } catch (e) {}
          });
      });
      r.data.on("end", uStatus);
    } catch (e) {
      content.setContent(`Error: ${e.message}`);
    }
    s.render();
  },
  gSteps = async (d, p) => {
    content.setContent("Generating...");
    s.render();
    try {
      const r = await ax.post(
        "http://localhost:1234/v1/chat/completions",
        {
          model: "lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF",
          messages: [
            {
              role: "user",
              content: `Draft:\n\n${d.content}\n\nPath: ${p}\n\nSteps:`,
            },
          ],
          stream: true,
        },
        { responseType: "stream" }
      );
      let o = "";
      r.data.on("data", (c) => {
        c.toString()
          .split("\n")
          .filter((l) => l.trim() !== "")
          .forEach((l) => {
            if (l.startsWith("data: "))
              try {
                o += JSON.parse(l.slice(6)).choices[0].delta.content || "";
                content.setContent(ft(o));
                s.render();
              } catch (e) {}
          });
      });
      r.data.on("end", uStatus);
    } catch (e) {
      content.setContent(`Error: ${e.message}`);
    }
    s.render();
  },
  gGuidance = async (d, s) => {
    content.setContent("Fetching...");
    s.render();
    try {
      const r = await ax.post(
        "http://localhost:1234/v1/chat/completions",
        {
          model: "lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF",
          messages: [
            {
              role: "user",
              content: `Draft:\n\n${d.content}\n\nStep: ${s}\n\nGuidance:`,
            },
          ],
          stream: true,
        },
        { responseType: "stream" }
      );
      let o = "";
      r.data.on("data", (c) => {
        c.toString()
          .split("\n")
          .filter((l) => l.trim() !== "")
          .forEach((l) => {
            if (l.startsWith("data: "))
              try {
                o += JSON.parse(l.slice(6)).choices[0].delta.content || "";
                content.setContent(ft(o));
                s.render();
              } catch (e) {}
          });
      });
      r.data.on("end", uStatus);
    } catch (e) {
      content.setContent(`Error: ${e.message}`);
    }
    s.render();
  },
  aDiff = async (f, o, n) => {
    const c = diff.diffLines(o, n),
      t = c
        .map((p) => (p.added ? "+" : p.removed ? "-" : " ") + p.value.trim())
        .join("\n"),
      x = cPath ? `Path: ${cPath}\nStep: ${cSteps[cStepIndex]}` : "No path";
    try {
      const r = await ax.post(
        "http://localhost:1234/v1/chat/completions",
        {
          model: "lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF",
          messages: [
            {
              role: "user",
              content: `Context:\n${x}\n\nDiff:\n${t}\n\n1. Summary\n2. Relation to path/quality\n3. Suggestion`,
            },
          ],
          stream: true,
        },
        { responseType: "stream" }
      );
      let o = "";
      r.data.on("data", (c) => {
        c.toString()
          .split("\n")
          .filter((l) => l.trim() !== "")
          .forEach((l) => {
            if (l.startsWith("data: "))
              try {
                o += JSON.parse(l.slice(6)).choices[0].delta.content || "";
                sDiffModal(path.basename(f), o);
              } catch (e) {}
          });
      });
      r.data.on("end", uStatus);
    } catch (e) {
      sDiffModal(path.basename(f), `Error: ${e.message}`);
    }
  },
  sDiffModal = (f, c) => {
    const m = b.box({
        parent: s,
        top: "center",
        left: "center",
        width: "80%",
        height: "80%",
        content: ft(`Diff: ${f}\n\n${c}`),
        border: { type: "line" },
        style: { border: { fg: "white" } },
        scrollable: true,
        keys: true,
        vi: true,
        alwaysScroll: true,
      }),
      ds = b.button({
        parent: m,
        bottom: 0,
        left: "center",
        content: "Dismiss",
        style: { bg: "blue", focus: { bg: "red" } },
        height: 1,
        width: 10,
        clickable: true,
      });
    ds.on("press", () => {
      m.destroy();
      s.render();
    });
    s.key(["escape"], () => {
      m.destroy();
      s.render();
    });
    m.focus();
    s.render();
  };

setInterval(uVI, 250);
ld();

chokidar
  .watch(d, { ignored: /(^|[\/\\])\../, persistent: true })
  .on("add", ld)
  .on("change", (p) => {
    const o = cDraft && cDraft.f === path.basename(p) ? cDraft.content : "",
      n = fs.readFileSync(p, "utf-8");
    aDiff(p, o, n);
    ld();
  })
  .on("unlink", ld);

draftList.on("select", (_, i) => {
  cDraft = dDrafts[i];
  gt(cDraft);
});

s.key(["escape", "q"], () => process.exit(0));
s.key(["b"], () => {
  if (cSteps) {
    cSteps = null;
    cStepIndex = null;
    gt(cDraft);
  } else if (cPath) {
    cPath = null;
    gt(cDraft);
  } else {
    cDraft = null;
    cPath = null;
    cSteps = null;
    cStepIndex = null;
    content.hide();
    draftList.show();
    draftList.focus();
  }
  uStatus();
});
s.key(["1", "2", "3"], (_, k) => {
  if (content.visible && !cPath) {
    const p = content
      .getContent()
      .split("\n")
      .filter((l) => l.match(/^\d+\./));
    cPath = p[parseInt(k) - 1];
    gSteps(cDraft, cPath);
  }
});
s.key(["n"], () => {
  if (content.visible && cPath) {
    if (!cSteps) {
      cSteps = content
        .getContent()
        .split("\n")
        .filter((l) => l.match(/^\d+\./));
      cStepIndex = 0;
    } else {
      cStepIndex = (cStepIndex + 1) % cSteps.length;
    }
    gGuidance(cDraft, cSteps[cStepIndex]);
    uStatus();
  }
});
s.key(["z"], () => {
  if (draftList.visible) {
    const d = dDrafts[draftList.selected];
    if (d) {
      const m = Object.entries(d)
        .filter(([k]) => !["f", "content", "mt"].includes(k))
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n");
      content.setContent(m);
      draftList.hide();
      content.show();
      uStatus();
    }
  }
});
s.key(["j"], () => {
  draftList.down(1);
  s.render();
});
s.key(["k"], () => {
  draftList.up(1);
  s.render();
});

s.render();
