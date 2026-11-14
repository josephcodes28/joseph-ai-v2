
"use strict";

/* =========================================================
   JOSEPH AI V2
   MAIN FRONTEND CONTROLLER
   File: script.js

   Frontend features:
   - Navigation and responsive sidebar
   - AI conversations and local history
   - File and image attachments
   - Browser speech recognition and speech synthesis
   - Research, website, app, game and content workflows
   - Website preview, code tabs and downloads
   - Local projects, memory and settings
   - Remote work and Autopilot interface
   - Export and local data management

   Backend endpoints are connected separately.
   ========================================================= */

const JosephAI = (() => {
  "use strict";

  const CONFIG = {
    api: {
      chat: "/api/chat",
      website: "/api/website",
      content: "/api/content",
      jobs: "/api/jobs",
      image: "/api/image",
      video: "/api/video",
      app: "/api/app",
      game: "/api/game"
    },

    storage: {
      conversations: "JOSEPH_V2_CONVERSATIONS",
      activeConversation: "JOSEPH_V2_ACTIVE_CONVERSATION",
      projects: "JOSEPH_V2_PROJECTS",
      websites: "JOSEPH_V2_WEBSITES",
      content: "JOSEPH_V2_CONTENT",
      activity: "JOSEPH_V2_ACTIVITY",
      memory: "JOSEPH_V2_MEMORY",
      settings: "JOSEPH_V2_SETTINGS",
      applications: "JOSEPH_V2_APPLICATIONS",
      attachments: "JOSEPH_V2_ATTACHMENTS"
    },

    maxAttachmentSize: 8 * 1024 * 1024,
    maxAttachments: 5,
    requestTimeout: 90000
  };

  const state = {
    currentPage: "brain",
    activeConversationId: null,
    conversations: [],
    messages: [],
    attachments: [],
    websites: [],
    projects: [],
    contentHistory: [],
    activity: [],
    memory: [],
    applications: [],
    currentWebsite: null,
    currentContent: "",
    currentImage: null,
    currentApp: null,
    currentGame: null,
    currentVideo: null,
    currentCodeTab: "html",
    lastContentRequest: null,
    lastJobResults: [],
    recognition: null,
    isListening: false,
    isSending: false,
    speechEnabled: false,
    speechLanguage: "en-US",
    compactMode: false
  };

  const pageNames = {
    brain: "Joseph Brain",
    research: "Research & Search",
    voice: "Voice Conversation",
    "image-studio": "Image Studio",
    "video-studio": "Video Studio",
    "website-builder": "Website Builder",
    "app-builder": "App Builder",
    "game-builder": "Game Builder",
    "content-studio": "Content Studio",
    "remote-work": "Remote Work",
    autopilot: "Autopilot",
    projects: "My Projects",
    history: "History",
    memory: "Memory",
    settings: "Settings"
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) =>
    Array.from(root.querySelectorAll(selector));

  const byId = id => document.getElementById(id);

  function makeId() {
    return (
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 9)
    );
  }

  function safeRead(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      console.warn("Could not read local data:", key, error);
      return fallback;
    }
  }

  function safeWrite(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error("Could not save local data:", error);
      showToast(
        "Storage is full or unavailable. Some data could not be saved.",
        "error"
      );
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

  function formatDate(value) {
    const date = new Date(value || Date.now());

    return date.toLocaleString([], {
      dateStyle: "medium",
      timeStyle: "short"
    });
  }

  function showToast(message, type = "success") {
    const container = byId("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    window.setTimeout(() => {
      toast.classList.add("toast-visible");
    }, 10);

    window.setTimeout(() => {
      toast.remove();
    }, 4000);
  }

  function setStatus(id, message) {
    const element = byId(id);
    if (element) element.textContent = message;
  }

  function setFeedback(id, message) {
    const element = byId(id);
    if (element) element.textContent = message;
  }

  function setButtonLoading(button, loading, loadingText) {
    if (!button) return;

    if (loading) {
      button.dataset.originalText = button.textContent;
      button.disabled = true;
      if (loadingText) button.textContent = loadingText;
    } else {
      button.disabled = false;
      if (button.dataset.originalText) {
        button.textContent = button.dataset.originalText;
        delete button.dataset.originalText;
      }
    }
  }

  function setGlobalLoading(
    visible,
    title = "Joseph AI is working...",
    description = "Please wait."
  ) {
    const overlay = byId("loadingOverlay");
    if (!overlay) return;

    overlay.hidden = !visible;

    const titleElement = byId("loadingTitle");
    const descriptionElement = byId("loadingDescription");

    if (titleElement) titleElement.textContent = title;
    if (descriptionElement) {
      descriptionElement.textContent = description;
    }
  }

  async function requestJSON(url, options = {}) {
    const controller = new AbortController();

    const timeout = window.setTimeout(
      () => controller.abort(),
      options.timeout || CONFIG.requestTimeout
    );

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          ...(options.body instanceof FormData
            ? {}
            : { "Content-Type": "application/json" }),
          ...(options.headers || {})
        }
      });

      const text = await response.text();
      let data = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { text };
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
          data.message ||
          `Server returned error ${response.status}`
        );
      }

      return data;
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error(
          "The request took too long. Please try again."
        );
      }

      if (error instanceof TypeError) {
        throw new Error(
          "Could not connect to the service. Check your internet connection and backend deployment."
        );
      }

      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function downloadFile(filename, content, type = "text/plain") {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function downloadJSON(filename, data) {
    downloadFile(
      filename,
      JSON.stringify(data, null, 2),
      "application/json"
    );
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(
        new Error(`Could not read ${file.name}`)
      );

      reader.readAsDataURL(file);
    });
  }

  function recordActivity(title, type = "activity") {
    state.activity.unshift({
      id: makeId(),
      title,
      type,
      createdAt: new Date().toISOString()
    });

    state.activity = state.activity.slice(0, 100);

    safeWrite(CONFIG.storage.activity, state.activity);
    renderActivityHistory();
  }

  /* =======================================================
     INITIAL DATA
     ======================================================= */

  function loadData() {
    state.conversations = safeRead(
      CONFIG.storage.conversations,
      []
    );

    state.activeConversationId = safeRead(
      CONFIG.storage.activeConversation,
      null
    );

    state.projects = safeRead(CONFIG.storage.projects, []);
    state.websites = safeRead(CONFIG.storage.websites, []);
    state.contentHistory = safeRead(CONFIG.storage.content, []);
    state.activity = safeRead(CONFIG.storage.activity, []);
    state.memory = safeRead(CONFIG.storage.memory, []);
    state.applications = safeRead(CONFIG.storage.applications, []);

    const settings = safeRead(CONFIG.storage.settings, {});

    applySettings(settings);

    if (
      state.activeConversationId &&
      state.conversations.some(
        item => item.id === state.activeConversationId
      )
    ) {
      const conversation = state.conversations.find(
        item => item.id === state.activeConversationId
      );

      state.messages = conversation.messages || [];
      renderMessages();
    } else {
      createConversation(false);
    }

    renderAll();
  }

  function saveConversations() {
    safeWrite(CONFIG.storage.conversations, state.conversations);
    safeWrite(
      CONFIG.storage.activeConversation,
      state.activeConversationId
    );
  }

  function saveProjects() {
    safeWrite(CONFIG.storage.projects, state.projects);
    renderProjects();
  }

  function saveWebsites() {
    safeWrite(CONFIG.storage.websites, state.websites);
    renderWebsiteProjects();
    renderProjects();
  }

  function renderAll() {
    renderMessages();
    renderHistory();
    renderActivityHistory();
    renderMemory();
    renderWebsiteProjects();
    renderContentHistory();
    renderApplications();
    renderProjects();
    renderAutopilotStats();
  }

  /* =======================================================
     NAVIGATION
     ======================================================= */

  function openPage(page) {
    if (!pageNames[page]) return;

    state.currentPage = page;

    $$(".page-section").forEach(section => {
      section.classList.toggle(
        "active",
        section.dataset.pageSection === page
      );
    });

    $$(".nav-item").forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.page === page
      );
    });

    const title = byId("currentPageName");
    if (title) title.textContent = pageNames[page];

    closeSidebar();

    if (page === "history") renderHistory();
    if (page === "projects") renderProjects();
    if (page === "memory") renderMemory();
    if (page === "autopilot") renderAutopilotStats();

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openSidebar() {
    byId("sidebar")?.classList.add("sidebar-open");
    byId("sidebarOverlay")?.classList.add("active");
  }

  function closeSidebar() {
    byId("sidebar")?.classList.remove("sidebar-open");
    byId("sidebarOverlay")?.classList.remove("active");
  }

  function setupNavigation() {
    $$("[data-page]").forEach(button => {
      button.addEventListener("click", () => {
        openPage(button.dataset.page);
      });
    });

    $$("[data-open-page]").forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault();
        openPage(button.dataset.openPage);
      });
    });

    byId("menuToggle")?.addEventListener("click", openSidebar);
    byId("closeSidebar")?.addEventListener("click", closeSidebar);
    byId("sidebarOverlay")?.addEventListener("click", closeSidebar);

    byId("newChatButton")?.addEventListener("click", () => {
      createConversation();
      openPage("brain");
    });

    byId("clearBrainChat")?.addEventListener("click", () => {
      createConversation();
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") closeSidebar();
    });
  }

  /* =======================================================
     CONVERSATIONS AND BRAIN
     ======================================================= */

  function createConversation(showMessage = true) {
    const conversation = {
      id: makeId(),
      title: "New conversation",
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    state.conversations.unshift(conversation);
    state.activeConversationId = conversation.id;
    state.messages = [];

    saveConversations();
    renderMessages();
    renderHistory();

    if (showMessage) {
      showToast("New conversation started.");
    }
  }

  function getActiveConversation() {
    return state.conversations.find(
      item => item.id === state.activeConversationId
    );
  }

  function saveActiveConversation() {
    const conversation = getActiveConversation();
    if (!conversation) return;

    conversation.messages = state.messages;
    conversation.updatedAt = new Date().toISOString();

    const firstUserMessage = state.messages.find(
      message => message.role === "user"
    );

    if (firstUserMessage) {
      conversation.title =
        firstUserMessage.content.slice(0, 55) ||
        "New conversation";
    }

    saveConversations();
    renderHistory();
  }

  function renderMessages() {
    const container = byId("chatMessages");
    if (!container) return;

    if (!state.messages.length) {
      container.innerHTML = `
        <div class="welcome-screen" id="brainWelcome">
          <div class="welcome-symbol">✦</div>
          <h2>What can I help you with today?</h2>
          <p>Ask me anything. Let's think, build, learn and make progress together.</p>

          <div class="suggestion-grid">
            <button class="suggestion-card" data-prompt="Help me plan and build a professional website for a customer." type="button">
              <span class="suggestion-icon">⌘</span>
              <strong>Build a website</strong>
              <small>Create a professional website for a client.</small>
            </button>

            <button class="suggestion-card" data-prompt="Give me real online work opportunities I can apply for from Nigeria." type="button">
              <span class="suggestion-icon">↗</span>
              <strong>Find online work</strong>
              <small>Discover real opportunities and next steps.</small>
            </button>

            <button class="suggestion-card" data-prompt="Help me create an app and explain how to publish it." type="button">
              <span class="suggestion-icon">▣</span>
              <strong>Create an app</strong>
              <small>Plan and develop a real application.</small>
            </button>

            <button class="suggestion-card" data-prompt="Give me a creative business idea and explain how I can start." type="button">
              <span class="suggestion-icon">✧</span>
              <strong>Explore an idea</strong>
              <small>Get practical ideas and guidance.</small>
            </button>
          </div>
        </div>
      `;

      bindSuggestionButtons();
      return;
    }

    container.innerHTML = "";

    state.messages.forEach(message => {
      const wrapper = document.createElement("article");
      wrapper.className = `chat-message ${message.role === "user" ? "user-message" : "assistant-message"}`;

      const avatar = document.createElement("div");
      avatar.className = "message-avatar";
      avatar.textContent = message.role === "user" ? "J" : "✦";

      const content = document.createElement("div");
      content.className = "message-content";

      const label = document.createElement("div");
      label.className = "message-author";
      label.textContent = message.role === "user" ? "You" : "Joseph AI";

      const body = document.createElement("div");
      body.className = "message-text";
      body.textContent = message.content || "";

      content.append(label, body);

      if (message.attachments?.length) {
        const files = document.createElement("div");
        files.className = "message-attachments";

        message.attachments.forEach(file => {
          const item = document.createElement("span");
          item.className = "message-attachment";
          item.textContent = file.name;
          files.appendChild(item);
        });

        content.appendChild(files);
      }

      if (message.role === "assistant" && message.content) {
        const actions = document.createElement("div");
        actions.className = "message-actions";

        const copy = document.createElement("button");
        copy.type = "button";
        copy.className = "text-button";
        copy.textContent = "Copy";
        copy.addEventListener("click", () => {
          copyText(message.content);
        });

        const speak = document.createElement("button");
        speak.type = "button";
        speak.className = "text-button";
        speak.textContent = "Read aloud";
        speak.addEventListener("click", () => {
          speakText(message.content);
        });

        actions.append(copy, speak);
        content.appendChild(actions);
      }

      wrapper.append(avatar, content);
      container.appendChild(wrapper);
    });

    container.scrollTop = container.scrollHeight;
  }

  function bindSuggestionButtons() {
    $$("[data-prompt]").forEach(button => {
      button.addEventListener("click", () => {
        const input = byId("brainInput");
        if (!input) return;

        input.value = button.dataset.prompt;
        input.focus();
        autoResizeTextarea(input);
      });
    });
  }

  function addMessage(role, content, attachments = []) {
    state.messages.push({
      id: makeId(),
      role,
      content,
      attachments: attachments.map(file => ({
        name: file.name,
        type: file.type
      })),
      createdAt: new Date().toISOString()
    });

    saveActiveConversation();
    renderMessages();
  }

  function autoResizeTextarea(textarea) {
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height =
      Math.min(textarea.scrollHeight, 220) + "px";
  }

  function getConversationForAPI() {
    return state.messages
      .slice(-20)
      .map(message => ({
        role: message.role,
        content: message.content
      }));
  }

  async function sendBrainMessage(message) {
    if (state.isSending) return;

    const text = String(message || "").trim();

    if (!text && !state.attachments.length) {
      showToast("Write a message or attach a file first.", "warning");
      return;
    }

    const attachments = [...state.attachments];

    state.isSending = true;

    const sendButton = byId("sendBrainButton");
    if (sendButton) sendButton.disabled = true;

    addMessage(
      "user",
      text || "Please examine the attached file.",
      attachments
    );

    state.attachments = [];
    renderAttachments();

    const input = byId("brainInput");
    if (input) {
      input.value = "";
      autoResizeTextarea(input);
    }

    setGlobalLoading(
      true,
      "Joseph AI is thinking...",
      "Preparing your response."
    );

    setStatus("connectionText", "Working");

    try {
      const encodedAttachments = [];

      for (const file of attachments) {
        encodedAttachments.push({
          name: file.name,
          type: file.type,
          data: await readFileAsDataURL(file)
        });
      }

      const data = await requestJSON(CONFIG.api.chat, {
        method: "POST",
        body: JSON.stringify({
          message: text,
          conversation: getConversationForAPI(),
          attachments: encodedAttachments,
          settings: {
            webSearch: getSettings().webSearch !== false,
            model: getSettings().defaultModel || "auto"
          }
        })
      });

      const reply =
        data.reply ||
        data.response ||
        data.message ||
        data.text;

      if (!reply || typeof reply !== "string") {
        throw new Error(
          "The AI service returned no readable response."
        );
      }

      addMessage("assistant", reply);
      recordActivity("Conversation response received", "chat");

      if (getSettings().speakResponses) {
        speakText(reply);
      }

      setStatus("connectionText", "Ready");
    } catch (error) {
      addMessage(
        "assistant",
        `I couldn't complete that request. ${error.message}\n\nPlease check that the chat backend is deployed and configured.`
      );

      setStatus("connectionText", "Connection issue");
      showToast(error.message, "error");
    } finally {
      state.isSending = false;
      if (sendButton) sendButton.disabled = false;

      setGlobalLoading(false);
    }
  }

  function setupBrain() {
    byId("brainForm")?.addEventListener("submit", event => {
      event.preventDefault();
      sendBrainMessage(byId("brainInput")?.value || "");
    });

    const input = byId("brainInput");

    input?.addEventListener("input", () => {
      autoResizeTextarea(input);
    });

    input?.addEventListener("keydown", event => {
      if (
        event.key === "Enter" &&
        !event.shiftKey &&
        !event.isComposing
      ) {
        event.preventDefault();
        byId("brainForm")?.requestSubmit();
      }
    });

    byId("attachFileButton")?.addEventListener("click", () => {
      byId("brainFileInput")?.click();
    });

    byId("brainImageButton")?.addEventListener("click", () => {
      byId("brainImageInput")?.click();
    });

    byId("brainFileInput")?.addEventListener("change", event => {
      addAttachments(event.target.files);
      event.target.value = "";
    });

    byId("brainImageInput")?.addEventListener("change", event => {
      addAttachments(event.target.files);
      event.target.value = "";
    });

    byId("clearAttachments")?.addEventListener("click", () => {
      state.attachments = [];
      renderAttachments();
    });

    byId("stopSpeakingButton")?.addEventListener("click", stopSpeaking);

    bindSuggestionButtons();
  }

  /* =======================================================
     ATTACHMENTS
     ======================================================= */

  function addAttachments(fileList) {
    const files = Array.from(fileList || []);

    if (!files.length) return;

    for (const file of files) {
      if (state.attachments.length >= CONFIG.maxAttachments) {
        showToast(
          `You can attach up to ${CONFIG.maxAttachments} files at a time.`,
          "warning"
        );
        break;
      }

      if (file.size > CONFIG.maxAttachmentSize) {
        showToast(
          `${file.name} is too large. Maximum size is 8 MB per file.`,
          "warning"
        );
        continue;
      }

      const alreadyAdded = state.attachments.some(
        item =>
          item.name === file.name &&
          item.size === file.size
      );

      if (!alreadyAdded) state.attachments.push(file);
    }

    renderAttachments();
  }

  function renderAttachments() {
    const preview = byId("attachmentPreview");
    const list = byId("attachmentList");

    if (!preview || !list) return;

    list.innerHTML = "";

    if (!state.attachments.length) {
      preview.hidden = true;
      return;
    }

    preview.hidden = false;

    state.attachments.forEach(file => {
      const item = document.createElement("div");
      item.className = "attachment-item";

      const name = document.createElement("span");
      name.textContent = file.name;

      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `Remove ${file.name}`);

      remove.addEventListener("click", () => {
        state.attachments = state.attachments.filter(
          item => item !== file
        );
        renderAttachments();
      });

      item.append(name, remove);
      list.appendChild(item);
    });
  }

  
  /* =======================================================
     COPY AND SPEECH
     ======================================================= */

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(String(text || ""));
      showToast("Copied to clipboard.");
    } catch {
      const temporary = document.createElement("textarea");
      temporary.value = String(text || "");
      document.body.appendChild(temporary);
      temporary.select();

      try {
        document.execCommand("copy");
        showToast("Copied to clipboard.");
      } catch {
        showToast("Could not copy this text.", "error");
      }

      temporary.remove();
    }
  }

  function speakText(text) {
    if (!("speechSynthesis" in window)) {
      showToast(
        "Speech playback is not supported by this browser.",
        "warning"
      );
      return;
    }

    stopSpeaking();

    const utterance = new SpeechSynthesisUtterance(
      String(text || "")
    );

    utterance.lang = state.speechLanguage;
    utterance.rate = 1;
    utterance.pitch = 1;

    utterance.onstart = () => {
      const button = byId("stopSpeakingButton");
      if (button) button.hidden = false;
    };

    utterance.onend = () => {
      const button = byId("stopSpeakingButton");
      if (button) button.hidden = true;
    };

    utterance.onerror = () => {
      const button = byId("stopSpeakingButton");
      if (button) button.hidden = true;
    };

    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    const button = byId("stopSpeakingButton");
    if (button) button.hidden = true;
  }

  /* =======================================================
     VOICE CONVERSATION
     ======================================================= */

  function setVoiceState(title, description, status) {
    setStatus("voiceStateTitle", title);
    setStatus("voiceStateDescription", description);
    setStatus("voiceStatus", status);
  }

  function appendVoiceTranscript(label, text) {
    const container = byId("voiceTranscript");
    if (!container) return;

    if (container.querySelector(".muted-text")) {
      container.innerHTML = "";
    }

    const line = document.createElement("p");
    line.textContent = `${label}: ${text}`;

    container.appendChild(line);
    container.scrollTop = container.scrollHeight;
  }

  function startVoiceRecognition() {
    const Recognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!Recognition) {
      showToast(
        "Voice recognition is not supported in this browser. Try a supported browser or type your message.",
        "warning"
      );

      setVoiceState(
        "Voice not available",
        "Your browser does not support speech recognition.",
        "Unavailable"
      );

      return;
    }

    if (state.recognition) {
      try {
        state.recognition.stop();
      } catch {}
    }

    const recognition = new Recognition();

    recognition.lang =
      byId("voiceLanguage")?.value || "en-US";

    recognition.continuous = false;
    recognition.interimResults = true;

    state.recognition = recognition;
    state.isListening = true;

    setVoiceState(
      "I'm listening...",
      "Speak clearly. Your words will appear in the transcript.",
      "Listening"
    );

    byId("voiceOrb")?.classList.add("listening");

    recognition.onresult = event => {
      let finalText = "";
      let interimText = "";

      for (
        let index = event.resultIndex;
        index < event.results.length;
        index++
      ) {
        const result = event.results[index];

        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }

      if (interimText) {
        setVoiceState(
          "I'm listening...",
          interimText,
          "Listening"
        );
      }

      if (finalText.trim()) {
        appendVoiceTranscript("You", finalText.trim());

        setVoiceState(
          "Processing your message...",
          "Joseph AI is preparing a response.",
          "Processing"
        );

        sendVoiceMessage(finalText.trim());
      }
    };

    recognition.onerror = event => {
      state.isListening = false;
      byId("voiceOrb")?.classList.remove("listening");

      setVoiceState(
        "Voice problem",
        `Speech recognition error: ${event.error}`,
        "Error"
      );
    };

    recognition.onend = () => {
      state.isListening = false;
      byId("voiceOrb")?.classList.remove("listening");

      if (byId("voiceStatus")?.textContent === "Listening") {
        setVoiceState(
          "Ready to speak",
          "Press the microphone to start again.",
          "Ready"
        );
      }
    };

    try {
      recognition.start();
    } catch (error) {
      state.isListening = false;
      showToast("Could not start the microphone.", "error");
    }
  }

  function stopVoiceRecognition() {
    if (state.recognition) {
      try {
        state.recognition.stop();
      } catch {}
    }

    state.isListening = false;
    byId("voiceOrb")?.classList.remove("listening");

    setVoiceState(
      "Voice stopped",
      "Press Start speaking when you are ready.",
      "Stopped"
    );
  }

  async function sendVoiceMessage(text) {
    appendVoiceTranscript("You", text);

    await sendBrainMessage(text);

    const lastAssistantMessage = [...state.messages]
      .reverse()
      .find(message => message.role === "assistant");

    if (lastAssistantMessage) {
      appendVoiceTranscript(
        "Joseph AI",
        lastAssistantMessage.content
      );

      const autoSpeak = byId("voiceAutoSpeak")?.checked;

      if (autoSpeak) {
        speakText(lastAssistantMessage.content);
      }

      setVoiceState(
        "Response ready",
        "You can continue speaking whenever you are ready.",
        "Ready"
      );
    }
  }

  function setupVoice() {
    byId("voiceStartButton")?.addEventListener(
      "click",
      startVoiceRecognition
    );

    byId("voiceStopButton")?.addEventListener(
      "click",
      stopVoiceRecognition
    );

    byId("brainVoiceButton")?.addEventListener("click", () => {
      openPage("voice");
      startVoiceRecognition();
    });

    byId("voiceLanguage")?.addEventListener("change", event => {
      state.speechLanguage = event.target.value;
    });
  }

  /* =======================================================
     RESEARCH
    
