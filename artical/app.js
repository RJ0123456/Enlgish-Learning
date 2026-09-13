const chapters = CHAPTERS;
let currentIndex = 0;
let fontScale = 1;
let mediaRecorder;
let audioChunks = [];
let recordingInterval;
let recordingSeconds = 0;
let translationVisible = false;

const el = (id) => document.getElementById(id);
const chapterList = el("chapterList");
const articleContent = el("articleContent");
const wordList = el("wordList");

const COMMON_WORD_MEANINGS = {
  a: "一个；一（不定冠词）",
  an: "一个；一（用于元音前）",
  and: "和；并且",
  are: "是（be动词复数）",
  as: "作为；像；当...时",
  at: "在；于",
  be: "是；存在",
  but: "但是；而是",
  by: "通过；在...旁边",
  can: "能够；可以",
  do: "做；进行",
  for: "为了；对于",
  from: "来自；从",
  had: "有（have过去式）",
  has: "有（have第三人称单数）",
  have: "有；拥有",
  he: "他",
  her: "她的；她",
  his: "他的",
  i: "我",
  if: "如果",
  in: "在...里；在...期间",
  into: "进入；到...里面",
  is: "是（be动词单数）",
  it: "它；这件事",
  its: "它的",
  of: "...的；关于",
  on: "在...上；关于",
  or: "或者",
  our: "我们的",
  she: "她",
  that: "那个；那；引导从句",
  the: "这/那（定冠词）",
  their: "他们的；她们的；它们的",
  them: "他们；她们；它们",
  there: "那里；存在",
  they: "他们；她们；它们",
  this: "这个；这",
  to: "到；向；不定式符号",
  was: "是（be动词过去式单数）",
  we: "我们",
  were: "是（be动词过去式复数）",
  what: "什么；所...的事物",
  when: "当...时候；什么时候",
  where: "哪里；在...的地方",
  which: "哪一个；哪一些",
  who: "谁",
  will: "将；会",
  with: "和；带有；用",
  you: "你；你们",
  your: "你的；你们的"
};

const EXTRA_LEARNER_WORDS = {
  better: "更好的",
  change: "改变；变化",
  idea: "想法；主意",
  mind: "头脑；思维",
  quiet: "安静的；平静的",
  remember: "记得；回想",
  slow: "缓慢的；放慢",
  useful: "有用的；有益的",
  walk: "走路；步行",
  world: "世界"
};

const IRREGULAR_LEMMAS = {
  went: "go",
  gone: "go",
  done: "do",
  did: "do",
  seen: "see",
  saw: "see",
  taken: "take",
  took: "take",
  made: "make",
  thought: "think",
  brought: "bring",
  bought: "buy",
  felt: "feel",
  found: "find",
  kept: "keep",
  left: "leave",
  known: "know",
  knew: "know",
  written: "write",
  wrote: "write",
  children: "child",
  people: "person",
  mice: "mouse",
  teeth: "tooth",
  feet: "foot"
};

const GLOBAL_MEANING_INDEX = buildGlobalMeaningIndex(chapters);

function getChapterWords(chapter) {
  return chapter.words.map(item => ({ ...item, isPreset: true }));
}
function normalizeWord(word) {
  return String(word || "").toLowerCase().trim();
}
function buildGlobalMeaningIndex(chapterList) {
  const index = Object.create(null);
  chapterList.forEach(chapter => {
    (chapter.words || []).forEach(item => {
      const key = normalizeWord(item.word);
      if (key && item.meaning && !index[key]) index[key] = item.meaning;
    });
  });
  Object.entries(COMMON_WORD_MEANINGS).forEach(([word, meaning]) => {
    if (!index[word]) index[word] = meaning;
  });
  Object.entries(EXTRA_LEARNER_WORDS).forEach(([word, meaning]) => {
    if (!index[word]) index[word] = meaning;
  });
  return index;
}
function meaningFromIndex(word) {
  return GLOBAL_MEANING_INDEX[normalizeWord(word)] || "";
}
function buildWordCandidates(word) {
  const normalized = normalizeWord(word);
  if (!normalized) return [];
  const candidates = new Set([normalized]);
  if (IRREGULAR_LEMMAS[normalized]) candidates.add(IRREGULAR_LEMMAS[normalized]);
  if (normalized.endsWith("'s")) candidates.add(normalized.slice(0, -2));
  if (normalized.endsWith("ies") && normalized.length > 3) candidates.add(`${normalized.slice(0, -3)}y`);
  if (normalized.endsWith("ing") && normalized.length > 4) {
    const stem = normalized.slice(0, -3);
    candidates.add(stem);
    candidates.add(`${stem}e`);
    if (/([bcdfghjklmnpqrstvwxyz])\1$/.test(stem)) candidates.add(stem.slice(0, -1));
  }
  if (normalized.endsWith("ed") && normalized.length > 3) {
    const stem = normalized.slice(0, -2);
    candidates.add(stem);
    candidates.add(`${stem}e`);
    if (/([bcdfghjklmnpqrstvwxyz])\1$/.test(stem)) candidates.add(stem.slice(0, -1));
  }
  if (normalized.endsWith("es") && normalized.length > 3) {
    candidates.add(normalized.slice(0, -2));
    if (/(ches|shes|xes|zes|ses)$/.test(normalized)) candidates.add(normalized.slice(0, -2));
  }
  if (normalized.endsWith("s") && normalized.length > 2 && !normalized.endsWith("ss")) candidates.add(normalized.slice(0, -1));
  if (normalized.endsWith("ly") && normalized.length > 4) candidates.add(normalized.slice(0, -2));
  return [...candidates];
}
function shortContext(text, maxLength = 34) {
  const compact = String(text || "").replace(/\s+/g, " ").trim();
  if (!compact) return "";
  return compact.length > maxLength ? `${compact.slice(0, maxLength)}…` : compact;
}
function resolveMeaning(word, chapter, paragraphIndex) {
  const normalized = normalizeWord(word);
  const savedMatch = getSavedWords(chapter).find(item => normalizeWord(item.word) === normalized && item.meaning && item.meaning.trim());
  if (savedMatch) return savedMatch.meaning;
  const direct = meaningFromIndex(normalized);
  if (direct) return direct;
  for (const candidate of buildWordCandidates(normalized)) {
    const match = meaningFromIndex(candidate);
    if (match) return candidate === normalized ? match : `${match}（原形：${candidate}）`;
  }
  if (typeof paragraphIndex === "number") {
    const context = shortContext((chapter.paragraphsZh || [])[paragraphIndex]);
    if (context) return `本句中可理解为：${context}`;
  }
  return `暂未收录「${word}」的固定词义，可双击加入生词表并结合上下文记忆。`;
}
function categoryMeta(chapter) { return CATEGORY_META[chapter.category] || { zh: chapter.category, en: chapter.category }; }
function estimateReadTime(chapter) {
  const count = chapter.paragraphs.join(" ").split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(count / 200))} min read`;
}
function renderFilters() {
  const filterRow = el("filterRow");
  Object.entries(CATEGORY_META).forEach(([key, meta]) => {
    const button = document.createElement("button");
    button.className = "filter";
    button.dataset.filter = key;
    button.textContent = meta.zh;
    filterRow.appendChild(button);
  });
}
function renderChapters() {
  const search = el("searchInput").value.toLowerCase().trim();
  const filter = document.querySelector(".filter.active").dataset.filter;
  chapterList.innerHTML = "";
  chapters.filter(chapter => (filter === "all" || chapter.category === filter) && (`${chapter.title} ${categoryMeta(chapter).zh}`.toLowerCase().includes(search))).forEach((chapter) => {
    const index = chapters.indexOf(chapter);
    const button = document.createElement("button");
    button.className = `chapter-item ${index === currentIndex ? "active" : ""}`;
    button.innerHTML = `<span class="chapter-num">${String(chapter.id).padStart(3, "0")}</span><span><span class="chapter-title">${chapter.title}</span><span class="chapter-topic">${categoryMeta(chapter).zh}</span></span>`;
    button.addEventListener("click", () => { currentIndex = index; renderArticle(); renderChapters(); window.scrollTo({ top: 0, behavior: "smooth" }); });
    chapterList.appendChild(button);
  });
}
function tokenise(text, selectedWords = [], paragraphIndex = 0) {
  return text.split(/(\s+|[,.!?;:])/).map(part => {
    const clean = part.toLowerCase().replace(/[^a-z'-]/g, "");
    if (!clean || !/^[a-z'-]+$/i.test(part)) return part;
    const isSelected = selectedWords.some(item => item.word === clean);
    return `<span class="word ${isSelected ? "selected" : ""}" data-word="${clean}" data-para="${paragraphIndex}">${part}</span>`;
  }).join("");
}
function renderArticle() {
  const chapter = chapters[currentIndex];
  const saved = getSavedWords(chapter);
  const meta = categoryMeta(chapter);
  stopListening();
  hideWordBubble();
  translationVisible = false;
  el("translateButton").classList.remove("active");
  el("chapterNumber").textContent = String(chapter.id).padStart(3, "0");
  el("chapterCategory").textContent = meta.en.toUpperCase();
  el("readTime").textContent = estimateReadTime(chapter);
  el("progressCurrent").textContent = String(chapter.id).padStart(3, "0");
  const paragraphsZh = chapter.paragraphsZh || [];
  const bodyBlocks = chapter.paragraphs.map((p, i) => `<div class="para-block"><p class="para-en">${tokenise(p, saved, i)}</p>${paragraphsZh[i] ? `<p class="para-zh">${paragraphsZh[i]}</p>` : ""}</div>`).join("");
  articleContent.innerHTML = `<p class="article-kicker">${meta.en} / Chapter ${String(chapter.id).padStart(3, "0")}</p><h2>${chapter.title}</h2><p class="article-deck">${chapter.deck}</p><div class="article-body">${bodyBlocks}</div>`;
  articleContent.querySelectorAll(".word").forEach(word => {
    word.addEventListener("click", () => showWordBubble(word, word.dataset.word, findMeaning(word.dataset.word, chapter, Number(word.dataset.para))));
    word.addEventListener("dblclick", () => { addWord(word.dataset.word, chapter, Number(word.dataset.para)); hideWordBubble(); });
  });
  renderWords();
}
function getSavedWords(chapter) { return chapter._words || (chapter._words = getChapterWords(chapter)); }
function addWord(word, chapter, paragraphIndex) {
  const source = chapter.paragraphs.join(" ").split(/\s+/).find(item => item.toLowerCase().replace(/[^a-z'-]/g, "") === word) || word;
  chapter._words = getSavedWords(chapter);
  const normalized = normalizeWord(word);
  if (!chapter._words.some(item => normalizeWord(item.word) === normalized)) { chapter._words.push({ word: normalized, meaning: resolveMeaning(normalized, chapter, paragraphIndex), source }); showToast(`已加入「${normalized}」`); renderArticle(); }
}
function findMeaning(word, chapter, paragraphIndex) {
  return resolveMeaning(word, chapter, paragraphIndex);
}
function showWordBubble(anchor, word, meaning) {
  const bubble = el("wordBubble");
  el("wordBubbleWord").textContent = word;
  el("wordBubbleMeaning").textContent = meaning;
  bubble.dataset.word = word;
  bubble.hidden = false;
  const anchorRect = anchor.getBoundingClientRect();
  const bubbleWidth = bubble.offsetWidth || 230;
  const bubbleHeight = bubble.offsetHeight || 90;
  let left = Math.min(Math.max(anchorRect.left, 12), window.innerWidth - bubbleWidth - 12);
  let top = anchorRect.bottom + 10;
  if (top + bubbleHeight > window.innerHeight - 12) top = anchorRect.top - bubbleHeight - 10;
  bubble.style.left = `${left}px`;
  bubble.style.top = `${Math.max(top, 12)}px`;
}
function hideWordBubble() {
  const bubble = el("wordBubble");
  bubble.hidden = true;
  delete bubble.dataset.word;
}
function renderWords() {
  const words = getSavedWords(chapters[currentIndex]);
  el("wordCount").textContent = `${words.length} words`;
  wordList.innerHTML = words.length ? words.map((item, index) => `<div class="word-card"><button class="remove-word" data-remove="${index}" title="删除生词" aria-label="删除生词">×</button><strong class="word-term" data-say="${item.word}" role="button" tabindex="0">${item.word}</strong><p>${item.meaning}</p></div>`).join("") : `<div class="empty-words">还没有生词。<br />双击文章中的单词试试看。</div>`;
  wordList.querySelectorAll("[data-remove]").forEach(button => button.addEventListener("click", () => { getSavedWords(chapters[currentIndex]).splice(Number(button.dataset.remove), 1); renderArticle(); showToast("已从本篇生词表删除"); }));
  wordList.querySelectorAll(".word-term").forEach(term => term.addEventListener("click", () => speak(term.dataset.say)));
}
let cachedVoices = [];
function refreshVoices() { cachedVoices = "speechSynthesis" in window ? window.speechSynthesis.getVoices() : []; }
if ("speechSynthesis" in window) { refreshVoices(); window.speechSynthesis.onvoiceschanged = refreshVoices; }
function pickBestVoice() {
  const enVoices = cachedVoices.filter(voice => voice.lang && voice.lang.toLowerCase().startsWith("en"));
  const preferredPatterns = [/natural/i, /neural/i, /online/i, /google us english/i, /samantha/i, /aria/i];
  for (const pattern of preferredPatterns) {
    const match = enVoices.find(voice => pattern.test(voice.name));
    if (match) return match;
  }
  return enVoices.find(voice => voice.lang.toLowerCase() === "en-us") || enVoices[0] || null;
}
function speak(text) {
  if (!("speechSynthesis" in window)) return showToast("当前浏览器不支持朗读");
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = pickBestVoice();
  if (voice) utterance.voice = voice;
  utterance.lang = "en-US"; utterance.rate = .88;
  window.speechSynthesis.speak(utterance);
}
function toggleTranslation() {
  translationVisible = !translationVisible;
  const body = articleContent.querySelector(".article-body");
  if (body) body.classList.toggle("show-translation", translationVisible);
  el("translateButton").classList.toggle("active", translationVisible);
}
function toggleListen() {
  const button = el("listenButton");
  if (button.classList.contains("playing")) { stopListening(); return; }
  const chapter = chapters[currentIndex];
  const audio = el("articleAudio");
  audio.onerror = () => {
    stopListening();
    showToast(`第${chapter.id}篇音频文件加载失败`);
  };
  audio.onended = stopListening;
  audio.src = `audio/${String(chapter.id).padStart(3, "0")}.wav`;
  button.classList.add("playing");
  button.textContent = "停止播放";
  button.title = "停止播放";
  button.setAttribute("aria-label", "停止播放");
  audio.play().catch(() => {
    stopListening();
    showToast("音频播放失败，请检查音频文件");
  });
}
function stopListening() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  const audio = el("articleAudio");
  audio.onerror = null;
  audio.pause();
  const button = el("listenButton");
  button.classList.remove("playing");
  button.textContent = "播放文章";
  button.title = "播放文章";
  button.setAttribute("aria-label", "播放文章");
}
function showToast(message) { const toast = el("toast"); toast.textContent = message; toast.classList.add("show"); clearTimeout(showToast.timeout); showToast.timeout = setTimeout(() => toast.classList.remove("show"), 2200); }
async function toggleRecording() {
  if (mediaRecorder?.state === "recording") { mediaRecorder.stop(); return; }
  if (!navigator.mediaDevices?.getUserMedia) return showToast("当前浏览器不支持录音");
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = []; mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = event => audioChunks.push(event.data);
    mediaRecorder.onstop = () => { const blob = new Blob(audioChunks, { type: "audio/webm" }); el("recordingPlayer").src = URL.createObjectURL(blob); el("recordingPlayer").hidden = false; stream.getTracks().forEach(track => track.stop()); stopRecordingUI(); showToast("录音完成，可以试听"); };
    mediaRecorder.start(); recordingSeconds = 0; recordingInterval = setInterval(() => { recordingSeconds++; el("recordingTime").textContent = formatTime(recordingSeconds); }, 1000); el("recordButton").innerHTML = `<span class="record-symbol">■</span> 结束录音`; el("recordingStatus").textContent = "正在录音"; el("micDot").classList.add("recording");
  } catch { showToast("没有获得麦克风权限"); }
}
function stopRecordingUI() { clearInterval(recordingInterval); el("recordButton").innerHTML = `<span class="record-symbol">●</span> 开始录音`; el("recordingStatus").textContent = "录下你的声音"; el("micDot").classList.remove("recording"); }
function formatTime(seconds) { return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`; }

renderFilters();
el("wordBubbleAudio").addEventListener("click", () => { const word = el("wordBubble").dataset.word; if (word) speak(word); });
document.addEventListener("click", event => { const bubble = el("wordBubble"); if (bubble.hidden || bubble.contains(event.target) || event.target.classList.contains("word")) return; hideWordBubble(); });
document.addEventListener("keydown", event => { if (event.key === "Escape") hideWordBubble(); });
window.addEventListener("scroll", () => hideWordBubble(), true);
el("filterRow").addEventListener("click", event => { if (!event.target.matches(".filter")) return; document.querySelectorAll(".filter").forEach(button => button.classList.remove("active")); event.target.classList.add("active"); renderChapters(); });
el("searchInput").addEventListener("input", renderChapters);
el("listenButton").addEventListener("click", toggleListen);
el("translateButton").addEventListener("click", toggleTranslation);
el("copyButton").addEventListener("click", async () => { const chapter = chapters[currentIndex]; try { await navigator.clipboard.writeText(`${chapter.title}\n\n${chapter.paragraphs.join("\n\n")}`); showToast("全文已复制"); } catch { showToast("复制失败，请手动选择文字"); } });
el("prevButton").addEventListener("click", () => { currentIndex = (currentIndex - 1 + chapters.length) % chapters.length; renderArticle(); renderChapters(); });
el("nextButton").addEventListener("click", () => { currentIndex = (currentIndex + 1) % chapters.length; renderArticle(); renderChapters(); });
el("fontDown").addEventListener("click", () => { fontScale = Math.max(.9, fontScale - .05); document.documentElement.style.setProperty("font-size", `${fontScale}rem`); el("fontSizeLabel").textContent = `${Math.round(fontScale * 100)}%`; });
el("fontUp").addEventListener("click", () => { fontScale = Math.min(1.15, fontScale + .05); document.documentElement.style.setProperty("font-size", `${fontScale}rem`); el("fontSizeLabel").textContent = `${Math.round(fontScale * 100)}%`; });
el("recordButton").addEventListener("click", toggleRecording);
el("deleteRecordButton").addEventListener("click", () => { el("recordingPlayer").removeAttribute("src"); el("recordingPlayer").hidden = true; stopRecordingUI(); el("recordingTime").textContent = "00:00"; recordingSeconds = 0; showToast("录音已删除"); });
renderArticle(); renderChapters();
