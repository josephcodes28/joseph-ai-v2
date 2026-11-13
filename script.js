
"use strict";

/* ==========================================
   JOSEPH AI V2
   MAIN FRONTEND CONTROLLER
   ========================================== */

const JosephAI = {
  version: "2.0",

  storage: {
    websites: "JOSEPH_V2_WEBSITE_PROJECTS",
    content: "JOSEPH_V2_CONTENT_HISTORY",
    activity: "JOSEPH_V2_ACTIVITY",
    brain: "JOSEPH_CONVERSATION_V2"
  },

  websiteFiles: {
    html: "",
    css: "",
    js: ""
  },

  currentWebsiteProject: null,
  currentCodeTab: "html",
  currentContent: "",
  lastContentRequest: null
};

/* ==========================================
   GENERAL HELPERS
   ========================================== */

function $(selector) {
  return document.querySelector(selector);
}

function $all(selector) {
  return Array.from(document.querySelectorAll(selector));
}

function getStorage(key, fallback = []) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    console.error("Storage reading error:", error);
    return fallback;
  }
}

function setStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error("Storage saving error:", error);
    showToast("Could not save. Your browser storage may be full.", "error");
    return false;
  }
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function showToast(message, type = "") {
  const container = $("#toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3500);
}

function setFeedback(selector, message, type = "") {
  const element = $(selector);
  if (!element) return;

  element.textContent = message;
  element.className = "form-feedback";

  if (type) {
    element.classList.add(type);
  }
}

function setButtonLoading(button, loading, loadingText = "Please wait...") {
  if (!button) return;

  if (loading) {
    if (!button.dataset.originalContent) {
      button.dataset.originalContent = button.innerHTML;
    }

    button.disabled = true;
    button.textContent = loadingText;
  } else {
    button.disabled = false;

    if (button.dataset.originalContent) {
      button.innerHTML = button.dataset.originalContent;
      delete button.dataset.originalContent;
    }
  }
}

async function copyText(text) {
  if (!text) {
    showToast("There is nothing to copy.", "error");
    return false;
  }

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();

      const copied = document.execCommand("copy");
      textarea.remove();

      if (!copied) throw new Error("Copy failed");
    }

    showToast("Copied successfully.", "success");
    return true;
  } catch (error) {
    console.error(error);
    showToast("Copy failed. Please try again.", "error");
    return false;
  }
}

function downloadText(filename, content, type = "text/plain") {
  if (!content) {
    showToast("There is no file to download.", "error");
    return;
  }

  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function createId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function recordActivity(title, category) {
  const activities = getStorage(JosephAI.storage.activity);

  activities.unshift({
    id: createId(),
    title,
    category,
    date: new Date().toISOString()
  });

  setStorage(JosephAI.storage.activity, activities.slice(0, 30));

  renderActivity();
}

function formatDate(dateValue) {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleString();
}

/* ==========================================
   NAVIGATION
   ========================================== */

function navigateTo(pageName, updateHistory = true) {
  const page = $(`#page-${pageName}`);

  if (!page) {
    console.warn("Page not found:", pageName);
    return;
  }

  $all(".page-section").forEach(section => {
    section.classList.remove("active");
  });

  page.classList.add("active");

  $all(".nav-link").forEach(link => {
    link.classList.toggle(
      "active",
      link.dataset.page === pageName
    );
  });

  const activeLink = $(`.nav-link[data-page="${pageName}"]`);
  const title = activeLink
    ? activeLink.querySelector("span:nth-child(2)")?.textContent
    : pageName;

  $("#topbarTitle").textContent = title || "Joseph AI";

  closeSidebar();

  if (updateHistory) {
    history.pushState({ page: pageName }, "", `#${pageName}`);
  }

  if (pageName === "projects") {
    renderAllProjects();
  }

  if (pageName === "history") {
    renderActivity("#fullActivityList");
  }
}

function initializeNavigation() {
  $all("[data-page]").forEach(button => {
    button.addEventListener("click", () => {
      navigateTo(button.dataset.page);
    });
  });

  $all("[data-open-page]").forEach(button => {
    button.addEventListener("click", () => {
      navigateTo(button.dataset.openPage);
    });
  });

  const initialPage = location.hash.replace("#", "");

  if (initialPage && $(`#page-${initialPage}`)) {
    navigateTo(initialPage, false);
  } else {
    navigateTo("dashboard", false);
  }

  window.addEventListener("popstate", () => {
    const page = location.hash.replace("#", "") || "dashboard";

    if ($(`#page-${page}`)) {
      navigateTo(page, false);
    } else {
      navigateTo("dashboard", false);
    }
  });
}

/* ==========================================
   MOBILE SIDEBAR
   ========================================== */

function openSidebar() {
  $("#sidebar")?.classList.add("open");
  $("#sidebarOverlay")?.classList.add("show");
}

function closeSidebar() {
  $("#sidebar")?.classList.remove("open");
  $("#sidebarOverlay")?.classList.remove("show");
}

function initializeSidebar() {
  $("#menuToggle")?.addEventListener("click", openSidebar);
  $("#closeSidebar")?.addEventListener("click", closeSidebar);
  $("#sidebarOverlay")?.addEventListener("click", closeSidebar);
}

/* ==========================================
   API HELPER
   ========================================== */

async function postAPI(endpoint, data, timeout = 120000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(data),
      signal: controller.signal
    });

    const raw = await response.text();

    let result;

    try {
      result = JSON.parse(raw);
    } catch {
      throw new Error(
        response.ok
          ? "The server returned an invalid response."
          : `Server error (${response.status}).`
      );
    }

    if (!response.ok || result.success === false) {
      throw new Error(
        result.error ||
        result.message ||
        `Request failed (${response.status}).`
      );
    }

    return result;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("The request took too long. Please try again.");
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/* ==========================================
   JOSEPH BRAIN
   ========================================== */

function renderBrainMessage(message, sender = "assistant") {
  const container = $("#chatMessages");
  if (!container) return;

  const item = document.createElement("div");

  if (sender === "user") {
    item.className = "user-message";
    item.textContent = message;
  } else {
    item.className = "assistant-message message";

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = "J";

    const body = document.createElement("div");
    body.className = "message-body";

    const heading = document.createElement("strong");
    heading.textContent = "Joseph Brain";

    const paragraph = document.createElement("p");
    paragraph.textContent = message;

    body.append(heading, paragraph);
    item.append(avatar, body);
  }

  container.appendChild(item);
  container.scrollTop = container.scrollHeight;
}

function saveBrainHistory(message, sender) {
  const historyItems = getStorage(JosephAI.storage.brain, []);

  historyItems.push({
    message,
    sender,
    date: new Date().toISOString()
  });

  setStorage(
    JosephAI.storage.brain,
    historyItems.slice(-60)
  );
}

function loadBrainHistory() {
  const messages = getStorage(JosephAI.storage.brain, []);
  const container = $("#chatMessages");

  if (!container || !messages.length) return;

  container.innerHTML = "";

  messages.forEach(item => {
    renderBrainMessage(item.message, item.sender);
  });
}

function initializeBrain() {
  const form = $("#brainForm");
  const input = $("#brainInput");
  const button = $("#sendBrainButton");

  if (!form || !input || !button) return;

  loadBrainHistory();

  form.addEventListener("submit", async event => {
    event.preventDefault();

    const message = input.value.trim();

    if (!message) return;

    renderBrainMessage(message, "user");
    saveBrainHistory(message, "user");

    input.value = "";
    input.style.height = "auto";

    button.disabled = true;
    button.querySelector("span:first-child").textContent = "Thinking...";

    $("#brainStatus").textContent = "Thinking...";
    $("#brainFeedback").textContent = "Joseph Brain is processing your request.";

    try {
      const result = await postAPI("/api/chat", {
        message
      });

      const answer =
        result.answer ||
        result.reply ||
        result.result ||
        result.response ||
        result.message;

      if (typeof answer !== "string" || !answer.trim()) {
        throw new Error("Joseph Brain returned an empty answer.");
      }

      renderBrainMessage(answer, "assistant");
      saveBrainHistory(answer, "assistant");

      $("#brainStatus").textContent = "Ready to assist";
      $("#brainFeedback").textContent = "Response received.";
      $("#connectionText").textContent = "Brain connected";
      $(".connection-dot").style.background = "var(--green)";
    } catch (error) {
      renderBrainMessage(
        "I couldn't complete that request. " + error.message,
        "assistant"
      );

      $("#brainStatus").textContent = "Connection issue";
      $("#brainFeedback").textContent = "Please check your connection and try again.";
      $("#connectionText").textContent = "Connection issue";
      $(".connection-dot").style.background = "var(--danger)";
    } finally {
      button.disabled = false;
      button.querySelector("span:first-child").textContent = "Send";
    }
  });

  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 130) + "px";
  });

  $("#clearBrainChat")?.addEventListener("click", () => {
    if (!confirm("Start a new chat? This clears the saved conversation on this device.")) {
      return;
    }

    $("#chatMessages").innerHTML = "";
    localStorage.removeItem(JosephAI.storage.brain);

    renderBrainMessage(
      "Hello! I'm Joseph Brain. What would you like us to work on today?"
    );

    $("#brainStatus").textContent = "Ready to assist";
    showToast("New conversation started.", "success");
  });
}

/* ==========================================
   WEBSITE BUILDER
   ========================================== */

function getWebsiteBrief() {
  return {
    projectName: $("#websiteProjectName").value.trim(),
    businessType: $("#websiteBusinessType").value,
    style: $("#websiteStyle").value,
    description: $("#websiteDescription").value.trim(),
    features: $("#websiteFeatures").value.trim(),
    palette: $("#websitePalette").value,
    size: $("#websiteSize").value,
    extraInstructions: $("#websiteExtra").value.trim()
  };
}

function validateWebsiteFiles(files) {
  return (
    files &&
    typeof files.html === "string" &&
    typeof files.css === "string" &&
    typeof files.js === "string" &&
    files.html.trim() &&
    files.css.trim() &&
    files.js.trim()
  );
}

function buildPreviewDocument(html, css, js) {
  const safeCSS = String(css).replace(/<\/style/gi, "<\\/style");
  const safeJS = String(js).replace(/<\/script/gi, "<\\/script");

  let documentHTML = String(html);

  const styleTag = `<style>${safeCSS}</style>`;
  const scriptTag = `<script>${safeJS}<\/script>`;

  if (/<\/head>/i.test(documentHTML)) {
    documentHTML = documentHTML.replace(
      /<\/head>/i,
      `${styleTag}</head>`
    );
  } else {
    documentHTML = styleTag + documentHTML;
  }

  if (/<\/body>/i.test(documentHTML)) {
    documentHTML = documentHTML.replace(
      /<\/body>/i,
      `${scriptTag}</body>`
    );
  } else {
    documentHTML += scriptTag;
  }

  return documentHTML;
}

function showWebsitePreview(files) {
  const iframe = $("#websitePreview");
  const placeholder = $("#previewPlaceholder");

  if (!iframe || !placeholder) return;

  iframe.srcdoc = buildPreviewDocument(
    files.html,
    files.css,
    files.js
  );

  iframe.hidden = false;
  placeholder.hidden = true;
}

function renderWebsiteCode(tab = "html") {
  const code = $("#websiteCodeOutput");
  if (!code) return;

  JosephAI.currentCodeTab = tab;

  code.textContent = JosephAI.websiteFiles[tab] || "No file generated yet.";

  $all("[data-code-tab]").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.codeTab === tab
    );
  });
}

function setWebsiteFiles(files) {
  JosephAI.websiteFiles = {
    html: files.html,
    css: files.css,
    js: files.js
  };

  renderWebsiteCode(JosephAI.currentCodeTab);

  $("#websiteFileStatus").textContent = "3 files ready";
  showWebsitePreview(JosephAI.websiteFiles);
}

function saveWebsiteProject(brief, files) {
  const projects = getStorage(JosephAI.storage.websites);

  const project = {
    id: createId(),
    name: brief.projectName,
    businessType: brief.businessType,
    brief,
    files,
    createdAt: new Date().toISOString()
  };

  projects.unshift(project);

  const saved = projects.slice(0, 15);

  if (setStorage(JosephAI.storage.websites, saved)) {
    JosephAI.currentWebsiteProject = project;
    renderSavedWebsites();
    recordActivity(project.name, "Website");
  }
}

async function generateWebsite(event) {
  event.preventDefault();

  const brief = getWebsiteBrief();
  const button = $("#generateWebsiteButton");

  if (!brief.projectName || !brief.businessType || !brief.description) {
    setFeedback(
      "#websiteFeedback",
      "Please complete the project name, business type and description.",
      "error"
    );
    return;
  }

  setButtonLoading(button, true, "Generating website...");

  setFeedback(
    "#websiteFeedback",
    "Joseph AI is creating your website. This may take a little time."
  );

  $("#websiteFileStatus").textContent = "Generating...";

  try {
    const result = await postAPI(
      "/api/website",
      {
        action: "generate",
        brief
      },
      120000
    );

    const files = result.files || result;

    if (!validateWebsiteFiles(files)) {
      throw new Error("The server did not return all three website files.");
    }

    setWebsiteFiles(files);
    saveWebsiteProject(brief, files);

    setFeedback(
      "#websiteFeedback",
      "Your website files have been generated successfully.",
      "success"
    );

    showToast("Website generated successfully.", "success");
  } catch (error) {
    console.error("Website generation error:", error);

    $("#websiteFileStatus").textContent = "Generation failed";

    setFeedback(
      "#websiteFeedback",
      error.message || "Website generation failed.",
      "error"
    );

    showToast(error.message, "error");
  } finally {
    setButtonLoading(button, false);
  }
}

function renderSavedWebsites() {
  const projects = getStorage(JosephAI.storage.websites);
  const container = $("#savedWebsiteProjects");

  if (!container) return;

  $("#websiteSavedCount").textContent = `${projects.length} projects`;

  if (!projects.length) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">▤</span>
        <p>Your saved website projects will appear here.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = projects.map(project => `
    <div class="saved-project-item">
      <div class="project-item-icon">▣</div>
      <div class="project-item-info">
        <strong>${escapeHTML(project.name)}</strong>
        <span>${escapeHTML(project.businessType || "Website")} · ${escapeHTML(formatDate(project.createdAt))}</span>
      </div>
      <div class="item-actions">
        <button type="button" data-load-website="${escapeHTML(project.id)}">Open</button>
        <button type="button" data-delete-website="${escapeHTML(project.id)}">Delete</button>
      </div>
    </div>
  `).join("");
}

function loadWebsiteProject(id) {
  const projects = getStorage(JosephAI.storage.websites);
  const project = projects.find(item => item.id === id);

  if (!project || !validateWebsiteFiles(project.files)) {
    showToast("This project could not be opened.", "error");
    return;
  }

  JosephAI.currentWebsiteProject = project;

  $("#websiteProjectName").value = project.brief.projectName || project.name || "";
  $("#websiteBusinessType").value = project.brief.businessType || "";
  $("#websiteStyle").value = project.brief.style || "Modern premium";
  $("#websiteDescription").value = project.brief.description || "";
  $("#websiteFeatures").value = project.brief.features || "";
  $("#websitePalette").value = project.brief.palette || "Black and gold";
  $("#websiteSize").value = project.brief.size || "Multi-page style single-page website";
  $("#websiteExtra").value = project.brief.extraInstructions || "";

  setWebsiteFiles(project.files);
  navigateTo("website-builder");

  showToast("Website project opened.", "success");
}

function deleteWebsiteProject(id) {
  if (!confirm("Delete this saved website project?")) return;

  const projects = getStorage(JosephAI.storage.websites)
    .filter(project => project.id !== id);

  setStorage(JosephAI.storage.websites, projects);
  renderSavedWebsites();
  renderAllProjects();

  showToast("Website project deleted.", "success");
}

function initializeWebsiteBuilder() {
  $("#websiteForm")?.addEventListener("submit", generateWebsite);

  $all("[data-code-tab]").forEach(button => {
    button.addEventListener("click", () => {
      renderWebsiteCode(button.dataset.codeTab);
    });
  });

  $("#desktopPreviewButton")?.addEventListener("click", () => {
    $("#previewStage")?.classList.remove("mobile-preview");
    $("#desktopPreviewButton")?.classList.add("active");
    $("#mobilePreviewButton")?.classList.remove("active");
  });

  $("#mobilePreviewButton")?.addEventListener("click", () => {
    $("#previewStage")?.classList.add("mobile-preview");
    $("#mobilePreviewButton")?.classList.add("active");
    $("#desktopPreviewButton")?.classList.remove("active");
  });

  $("#copyWebsiteFile")?.addEventListener("click", () => {
    copyText(JosephAI.websiteFiles[JosephAI.currentCodeTab]);
  });

  $("#downloadWebsiteFile")?.addEventListener("click", () => {
    const tab = JosephAI.currentCodeTab;
    const extensions = {
      html: "html",
      css: "css",
      js: "js"
    };

    const name = `website.${extensions[tab]}`;
    downloadText(name, JosephAI.websiteFiles[tab]);
  });

  $("#downloadAllWebsiteFiles")?.addEventListener("click", () => {
    const files = JosephAI.websiteFiles;

    if (!validateWebsiteFiles(files)) {
      showToast("Generate a website before downloading.", "error");
      return;
    }

    downloadText("index.html", files.html, "text/html");
    setTimeout(() => {
      downloadText("style.css", files.css, "text/css");
    }, 300);

    setTimeout(() => {
      downloadText("script.js", files.js, "text/javascript");
    }, 600);

    showToast("Your three website files are being downloaded.", "success");
  });

  $("#savedWebsiteProjects")?.addEventListener("click", event => {
    const openButton = event.target.closest("[data-load-website]");
    const deleteButton = event.target.closest("[data-delete-website]");

    if (openButton) {
      loadWebsiteProject(openButton.dataset.loadWebsite);
    }

    if (deleteButton) {
      deleteWebsiteProject(deleteButton.dataset.deleteWebsite);
    }
  });

  renderSavedWebsites();
}

/* ==========================================
   CONTENT CREATOR
   ========================================== */

function getContentBrief() {
  return {
    contentType: $("#contentType").value,
    platform: $("#contentPlatform").value,
    tone: $("#contentTone").value,
    subject: $("#contentSubject").value.trim(),
    audience: $("#contentAudience").value.trim(),
    goal: $("#contentGoal").value,
    length: $("#contentLength").value,
    extraInstructions: $("#contentExtra").value.trim()
  };
}

function displayGeneratedContent(content) {
  JosephAI.currentContent = content;

  $("#contentPlaceholder").hidden = true;
  $("#contentOutput").hidden = false;

  $("#generatedContentText").textContent = content;
  $("#contentResultStatus").textContent = "Content ready";
  $("#contentResultStatus").classList.add("ready");

  $("#copyGeneratedContent").disabled = false;
  $("#downloadGeneratedContent").disabled = false;
  $("#regenerateContent").disabled = false;
}

function saveContentHistory(brief, content) {
  const historyItems = getStorage(JosephAI.storage.content);

  historyItems.unshift({
    id: createId(),
    type: brief.contentType,
    subject: brief.subject,
    brief,
    content,
    createdAt: new Date().toISOString()
  });

  setStorage(
    JosephAI.storage.content,
    historyItems.slice(0, 20)
  );

  renderContentHistory();
  recordActivity(brief.contentType, "Content");
}

async function generateContent() {
  const brief = getContentBrief();
  const button = $("#generateContentButton");

  if (!brief.contentType || !brief.subject) {
    setFeedback(
      "#contentFeedback",
      "Please choose a content type and describe your topic.",
      "error"
    );
    return;
  }

  setButtonLoading(button, true, "Creating content...");

  setFeedback(
    "#contentFeedback",
    "Joseph AI is preparing your content..."
  );

  $("#contentResultStatus").textContent = "Generating...";
  $("#contentResultStatus").classList.remove("ready");

  try {
    const result = await postAPI(
      "/api/content",
      {
        action: "generate",
        brief
      },
      120000
    );

    const content =
      result.content ||
      result.text ||
      result.output ||
      result.result;

    if (typeof content !== "string" || !content.trim()) {
      throw new Error("The server returned an empty content result.");
    }

    displayGeneratedContent(content);
    saveContentHistory(brief, content);

    JosephAI.lastContentRequest = brief;

    setFeedback(
      "#contentFeedback",
      "Your content has been created successfully.",
      "success"
    );

    showToast("Content generated successfully.", "success");
  } catch (error) {
    console.error("Content generation error:", error);

    $("#contentResultStatus").textContent = "Generation failed";

    setFeedback(
      "#contentFeedback",
      error.message || "Content generation failed.",
      "error"
    );

    showToast(error.message, "error");
  } finally {
    setButtonLoading(button, false);
  }
}

function regenerateContent() {
  if (!JosephAI.lastContentRequest) {
    showToast("Generate some content first.", "error");
    return;
  }

  $("#contentType").value = JosephAI.lastContentRequest.contentType;
  $("#contentPlatform").value = JosephAI.lastContentRequest.platform;
  $("#contentTone").value = JosephAI.lastContentRequest.tone;
  $("#contentSubject").value = JosephAI.lastContentRequest.subject;
  $("#contentAudience").value = JosephAI.lastContentRequest.audience;
  $("#contentGoal").value = JosephAI.lastContentRequest.goal;
  $("#contentLength").value = JosephAI.lastContentRequest.length;
  $("#contentExtra").value = JosephAI.lastContentRequest.extraInstructions;

  $("#contentForm").requestSubmit();
}

function renderContentHistory() {
  const items = getStorage(JosephAI.storage.content);
  const container = $("#contentHistoryList");

  if (!container) return;

  $("#contentSavedCount").textContent = `${items.length} items`;

  if (!items.length) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">✎</span>
        <p>Your generated content history will appear here.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = items.map(item => `
    <div class="content-history-item">
      <div class="project-item-icon">✎</div>
      <div class="content-history-info">
        <strong>${escapeHTML(item.type)}</strong>
        <span>${escapeHTML(item.subject)} · ${escapeHTML(formatDate(item.createdAt))}</span>
      </div>
      <div class="item-actions">
        <button type="button" data-open-content="${escapeHTML(item.id)}">Open</button>
        <button type="button" data-delete-content="${escapeHTML(item.id)}">Delete</button>
      </div>
    </div>
  `).join("");
}

function openContentHistory(id) {
  const items = getStorage(JosephAI.storage.content);
  const item = items.find(entry => entry.id === id);

  if (!item) return;

  displayGeneratedContent(item.content);
  JosephAI.lastContentRequest = item.brief;

  navigateTo("content-creator");
  showToast("Saved content opened.", "success");
}

function deleteContentHistory(id) {
  if (!confirm("Delete this saved content?")) return;

  const items = getStorage(JosephAI.storage.content)
    .filter(item => item.id !== id);

  setStorage(JosephAI.storage.content, items);
  renderContentHistory();
  renderAllProjects();

  showToast("Content deleted.", "success");
}

function initializeContentCreator() {
  $("#contentForm")?.addEventListener("submit", event => {
    event.preventDefault();
    generateContent();
  });

  $("#copyGeneratedContent")?.addEventListener("click", () => {
    copyText(JosephAI.currentContent);
  });

  $("#downloadGeneratedContent")?.addEventListener("click", () => {
    if (!JosephAI.currentContent) return;

    downloadText(
      "joseph-ai-content.txt",
      JosephAI.currentContent
    );
  });

  $("#regenerateContent")?.addEventListener("click", regenerateContent);

  $("#contentHistoryList")?.addEventListener("click", event => {
    const openButton = event.target.closest("[data-open-content]");
    const deleteButton = event.target.closest("[data-delete-content]");

    if (openButton) {
      openContentHistory(openButton.dataset.openContent);
    }

    if (deleteButton) {
      deleteContentHistory(deleteButton.dataset.deleteContent);
    }
  });

  renderContentHistory();
}
