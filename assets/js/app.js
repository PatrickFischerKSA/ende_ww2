/*
  Ende des Zweiten Weltkriegs – interaktive Lerneinheit
  Features:
  - Fragenbank aus assets/data/questions.js
  - Sofort-Feedback via Keyword-Check + Mindestlänge
  - Autosave (localStorage)
  - Fortschritt (bearbeitet/30)
  - Export: JSON, TXT, "PDF" via Druckdialog (print view)
*/

(function(){
  const STORAGE_KEY = "ende_ww2_answers_v1";
  const META_KEY = "ende_ww2_meta_v1";
  const $ = (sel, root=document) => root.querySelector(sel);

  function nowISO(){
    const d = new Date();
    return d.toISOString();
  }

  function loadState(){
    try{
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    }catch(e){
      return {};
    }
  }
  function saveState(state){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
  function loadMeta(){
    try{
      return JSON.parse(localStorage.getItem(META_KEY) || "{}");
    }catch(e){
      return {};
    }
  }
  function saveMeta(meta){
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  }

  function normalize(s){
    return (s || "")
      .toLowerCase()
      .replace(/[ä]/g,"ae").replace(/[ö]/g,"oe").replace(/[ü]/g,"ue")
      .replace(/[ß]/g,"ss")
      .replace(/[^a-z0-9\s\-]/g," ")
      .replace(/\s+/g," ")
      .trim();
  }

  function keywordHits(text, keywords){
    const t = normalize(text);
    const hits = [];
    for(const kw of (keywords || [])){
      const n = normalize(kw);
      if(!n) continue;
      // allow partial match for multiword
      if(t.includes(n)) hits.push(kw);
    }
    return hits;
  }

  function makeFeedback({textLenOk, hitsCount, totalKws}){
    // Simple rubric: length + at least ~40% keywords (cap at 5 requirement to avoid punishing)
    const requiredHits = Math.min( Math.max(2, Math.ceil(totalKws * 0.4)), 5 );
    if(!textLenOk){
      return {cls:"warn", msg:`Noch zu kurz. Formulieren Sie etwas ausführlicher (mindestens die verlangte Länge).`};
    }
    if(totalKws === 0){
      return {cls:"good", msg:`Gespeichert. Prüfen Sie: Haben Sie Kontext, Verlauf und Folgen klar strukturiert?`};
    }
    if(hitsCount >= requiredHits){
      return {cls:"good", msg:`Gute Basis: zentrale Begriffe sind enthalten. Ergänzen Sie – falls möglich – noch 1–2 präzise Beispiele/Belege.`};
    }
    if(hitsCount >= 1){
      return {cls:"warn", msg:`Teilweise passend. Ergänzen Sie zentrale Fachbegriffe (Hinweise unten) und präzisieren Sie Ursachen/Folgen.`};
    }
    return {cls:"bad", msg:`Sehr allgemein. Versuchen Sie, konkrete Fachbegriffe + 2–3 klare Aussagen (Ursache → Verlauf → Folge) einzubauen.`};
  }

  function progressFromState(state){
    let done = 0;
    for(const q of window.QUESTION_BANK){
      const a = (state[q.id]?.answer || "").trim();
      if(a.length > 0) done += 1;
    }
    return {done, total: window.QUESTION_BANK.length};
  }

  function downloadFile(filename, content, mime="text/plain;charset=utf-8"){
    const blob = new Blob([content], {type:mime});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 4000);
  }

  function buildExportObject(){
    const state = loadState();
    const meta = loadMeta();
    const out = {
      title: "Lerneinheit: Ende des Zweiten Weltkriegs",
      exported_at: nowISO(),
      student: meta.student || "",
      class: meta.className || "",
      answers: []
    };
    for(const q of window.QUESTION_BANK){
      const entry = state[q.id] || {};
      out.answers.push({
        id: q.id,
        question: q.prompt,
        answer: entry.answer || "",
        last_saved: entry.lastSaved || null
      });
    }
    return out;
  }

  function exportTXT(){
    const obj = buildExportObject();
    const lines = [];
    lines.push(obj.title);
    lines.push(`Name: ${obj.student}`);
    lines.push(`Klasse: ${obj.class}`);
    lines.push(`Export: ${obj.exported_at}`);
    lines.push("");
    for(const a of obj.answers){
      lines.push(`Frage ${a.id}: ${a.question}`);
      lines.push("");
      lines.push((a.answer || "").trim() ? a.answer.trim() : "[keine Antwort]");
      lines.push("\n" + "-".repeat(72) + "\n");
    }
    const safeName = (obj.student || "Schueler").replace(/[^\w\-]+/g,"_");
    downloadFile(`Ende_WW2_Antworten_${safeName}.txt`, lines.join("\n"));
  }

  function exportJSON(){
    const obj = buildExportObject();
    const safeName = (obj.student || "Schueler").replace(/[^\w\-]+/g,"_");
    downloadFile(`Ende_WW2_Antworten_${safeName}.json`, JSON.stringify(obj, null, 2), "application/json;charset=utf-8");
  }

  function resetAll(){
    if(!confirm("Wirklich alles löschen? (Alle Antworten + Name/Klasse)")) return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(META_KEY);
    location.reload();
  }

  function render(){
    const state = loadState();
    const meta = loadMeta();

    // meta inputs
    const nameEl = $("#studentName");
    const classEl = $("#studentClass");
    nameEl.value = meta.student || "";
    classEl.value = meta.className || "";

    nameEl.addEventListener("input", ()=>{
      const m = loadMeta();
      m.student = nameEl.value;
      saveMeta(m);
    });
    classEl.addEventListener("input", ()=>{
      const m = loadMeta();
      m.className = classEl.value;
      saveMeta(m);
    });

    const list = $("#questionList");
    list.innerHTML = "";

    for(const q of window.QUESTION_BANK){
      const card = document.createElement("div");
      card.className = "section qcard";
      card.id = `q${q.id}`;

      const entry = state[q.id] || {};
      const answer = entry.answer || "";

      const hits = keywordHits(answer, q.keywords);
      const textLenOk = normalize(answer).length >= (q.minChars || 0);
      const fb = makeFeedback({textLenOk, hitsCount: hits.length, totalKws: (q.keywords || []).length});

      card.innerHTML = `
        <div class="qhead">
          <div>
            <h3>${q.title}</h3>
            <div class="small">${q.prompt}</div>
          </div>
          <div class="smallmono">min. ${q.minChars || 0} Zeichen</div>
        </div>

        <textarea aria-label="${q.title} Antwort" placeholder="Antwort schreiben …">${escapeHtml(answer)}</textarea>

        ${q.keywords?.length ? `
          <div class="kws" aria-label="Hinweisbegriffe">
            ${q.keywords.map(kw => `<span class="kw ${hits.includes(kw) ? "ok":""}">${escapeHtml(kw)}</span>`).join("")}
          </div>
        ` : ""}

        <div class="feedback ${fb.cls}" role="status">
          ${escapeHtml(fb.msg)}
          ${entry.lastSaved ? `<div class="footer-note">Zuletzt gespeichert: <span class="smallmono">${escapeHtml(entry.lastSaved)}</span></div>` : ""}
        </div>

        <details>
          <summary>Modelllösung anzeigen</summary>
          <div class="model">${escapeHtml(q.model)}</div>
        </details>

        <div class="footer-note">Tipp: Strukturieren Sie mit <span class="smallmono">Kontext → Verlauf → Folgen → Deutung</span>. Speichern erfolgt automatisch.</div>
      `;

      const ta = $("textarea", card);
      const fbBox = $(".feedback", card);
      const kwBox = $(".kws", card);

      const update = () => {
        const s = loadState();
        const txt = ta.value || "";
        const hitNow = keywordHits(txt, q.keywords);
        const lenOk = normalize(txt).length >= (q.minChars || 0);
        const fbb = makeFeedback({textLenOk: lenOk, hitsCount: hitNow.length, totalKws: (q.keywords||[]).length});

        // save
        s[q.id] = {answer: txt, lastSaved: new Date().toLocaleString()};
        saveState(s);

        // update feedback class + message
        fbBox.classList.remove("good","warn","bad");
        fbBox.classList.add(fbb.cls);
        fbBox.innerHTML = `${escapeHtml(fbb.msg)}<div class="footer-note">Zuletzt gespeichert: <span class="smallmono">${escapeHtml(s[q.id].lastSaved)}</span></div>`;

        // update keyword pills
        if(kwBox){
          kwBox.innerHTML = q.keywords.map(kw => `<span class="kw ${hitNow.includes(kw) ? "ok":""}">${escapeHtml(kw)}</span>`).join("");
        }

        updateProgressUI();
      };

      // Debounce typing to avoid too frequent storage writes
      let t = null;
      ta.addEventListener("input", ()=>{
        if(t) clearTimeout(t);
        t = setTimeout(update, 240);
      });

      list.appendChild(card);
    }

    // buttons
    $("#btnExportJSON").addEventListener("click", exportJSON);
    $("#btnExportTXT").addEventListener("click", exportTXT);
    $("#btnPrint").addEventListener("click", ()=>window.print());
    $("#btnReset").addEventListener("click", resetAll);

    updateProgressUI();
  }

  function updateProgressUI(){
    const state = loadState();
    const {done, total} = progressFromState(state);
    const pct = total ? Math.round((done/total)*100) : 0;
    $("#progressText").textContent = `${done}/${total} bearbeitet (${pct}%)`;
    $("#progressFill").style.width = `${pct}%`;
  }

  function escapeHtml(str){
    return (str ?? "").toString()
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  // init
  document.addEventListener("DOMContentLoaded", ()=>{
    if(!window.QUESTION_BANK){
      console.error("QUESTION_BANK missing. Check assets/data/questions.js");
      return;
    }
    render();
  });

})();
