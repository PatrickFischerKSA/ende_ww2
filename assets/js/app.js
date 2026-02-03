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

  function makeFeedback({charCount, minChars}){
    const min = minChars || 0;
    const remaining = Math.max(0, min - charCount);
    const ratio = min > 0 ? charCount / min : 1;

    if(charCount === 0){
      return {cls:"bad", msg:`Noch keine Antwort. Starten Sie mit 2–3 Sätzen (Kontext → Verlauf → Folgen).`};
    }
    if(charCount < Math.min(40, min * 0.35)){
      return {cls:"bad", msg:`Sehr kurz. Schreiben Sie zuerst die Kernaussage und nennen Sie 1 Ursache + 1 Folge.`};
    }
    if(charCount < min){
      return {cls:"warn", msg:`Noch zu kurz. Es fehlen ca. ${remaining} Zeichen bis zur Mindestlänge.`};
    }
    if(ratio < 1.2){
      return {cls:"warn", msg:`Mindestlänge erreicht, aber knapp. Ergänzen Sie Details (Akteure, Ort/Zeit, Begriff).`};
    }
    if(ratio < 1.6){
      return {cls:"good", msg:`Solide Länge. Prüfen Sie Struktur: Kontext → Verlauf → Folgen → Deutung.`};
    }
    if(ratio < 2.2){
      return {cls:"good", msg:`Sehr gut ausgeführt. Falls möglich, fügen Sie ein Beispiel/Beleg hinzu.`};
    }
    return {cls:"good", msg:`Ausführlich und klar. Prüfen Sie nur noch auf Präzision und roten Faden.`};
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

      const charCount = normalize(answer).length;
      const fb = makeFeedback({charCount, minChars: (q.minChars || 0)});

      card.innerHTML = `
        <div class="qhead">
          <div>
            <h3>${q.title}</h3>
            <div class="small">${q.prompt}</div>
          </div>
          <div class="smallmono">min. ${q.minChars || 0} Zeichen</div>
        </div>

        <textarea aria-label="${q.title} Antwort" placeholder="Antwort schreiben …">${escapeHtml(answer)}</textarea>

        <div class="feedback ${fb.cls}" role="status">
          ${escapeHtml(fb.msg)}
          ${entry.lastSaved ? `<div class="footer-note">Zuletzt gespeichert: <span class="smallmono">${escapeHtml(entry.lastSaved)}</span></div>` : ""}
        </div>

        <details>
          <summary>Modelllösung anzeigen</summary>
          <div class="model">${escapeHtml(q.model)}</div>
        </details>
      `;

      const ta = $("textarea", card);
      const fbBox = $(".feedback", card);
      const update = () => {
        const s = loadState();
        const txt = ta.value || "";
        const charNow = normalize(txt).length;
        const fbb = makeFeedback({charCount: charNow, minChars: (q.minChars || 0)});

        // save
        s[q.id] = {answer: txt, lastSaved: new Date().toLocaleString()};
        saveState(s);

        // update feedback class + message
        fbBox.classList.remove("good","warn","bad");
        fbBox.classList.add(fbb.cls);
        fbBox.innerHTML = `${escapeHtml(fbb.msg)}<div class="footer-note">Zuletzt gespeichert: <span class="smallmono">${escapeHtml(s[q.id].lastSaved)}</span></div>`;

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
