
"use strict";

(() => {
  const pageTitles = {
    dashboard: "Dashboard",
    brain: "Joseph Brain",
    website: "Website Builder",
    content: "Content Studio",
    jobs: "Remote Work",
    visual: "Visual Assistant",
    memory: "Memory",
    settings: "Settings"
  };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  const sidebar = $("#sidebar");
  const menuButton = $("#menuButton");
  const brainForm = $("#brainForm");
  const brainInput = $("#brainInput");
  const chatMessages = $("#chatMessages");
  const sendButton = $("#sendBrainButton");
  const brainFeedback = $("#brainFeedback");
  const brainStatus = $("#brainStatus");
  const connectionPill = $("#connectionPill");

  let requestActive = false;
  const conversation = [];

  function openPage(page) {
    if (!pageTitles[page]) return;

    $$(".page").forEach((element) => {
      element.classList.toggle("active", element.id === `page-${page}`);
    });

    $$(".nav-link").forEach((button) => {
      const active = button.dataset.page === page;
      button.classList.toggle("active", active);

      if (active) {
        button.setAttribute("aria-current", "page");
      } else {
        button.removeAttribute("aria-current");
      }
    });

    $("#pageTitle").textContent = pageTitles[page];
    sidebar.classList.remove("open");
    menuButton.setAttribute("aria-expanded", "false");

    if (window.location.hash !== `#${page}`) {
      history.replaceState(null, "", `#${page}`);
    }
  }

  function addMessage(role, text) {
    const wrapper = document.createElement("div");
    wrapper.className = `message ${role === "user" ? "user-message" : "assistant-message"}`;

    if (role !== "user") {
      const avatar = document.createElement("span");
      avatar.className = "message-avatar";
      avatar.textContent = "J";
      wrapper.appendChild(avatar);
    }

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";

    const title = document.createElement("strong");
    title.textContent = role === "user" ? "You" : "Joseph AI";

    const paragraph = document.createElement("p");
    paragraph.textContent = text;

    bubble.append(title, paragraph);
    wrapper.appendChild(bubble);
    chatMessages.appendChild(wrapper);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    return wrapper;
  }

  function showConnectionError(message) {
    brainFeedback.textContent = message;
    brainStatus.textContent = "Request unsuccessful";
    connectionPill.textContent = "CHECK CONNECTION";
  }

  function extractAnswer(data) {
    if (!data || typeof data !== "object") return "";

    // Accept a direct answer if the backend provides one.
    if (typeof data.answer === "string" && data.answer.trim()) {
      return data.answer.trim();
    }

    if (typeof data.reply === "string" && data.reply.trim()) {
      return data.reply.trim();
    }

    // Joseph Brain's planner API returns a structured result.
    const result = data.result;

    if (result && typeof result === "object") {
      for (const key of ["answer", "response", "message", "summary", "reasoning"]) {
        if (typeof result[key] === "string" && result[key].trim()) {
          return result[key].trim();
        }
      }

      // A planner may return actions rather than a user-facing answer.
      // Do not pretend that planning actions were executed.
      if (Array.isArray(result.actions) && result.actions.length > 0) {
        return "Joseph Brain returned a plan, but this version does not yet execute planner actions. We need to connect and verify the appropriate tool workflow before claiming the task is complete.";
      }
    }

    return "";
  }

  async function sendBrainMessage(message) {
    const cleanMessage = message.trim();
    if (!cleanMessage || requestActive) return;

    requestActive = true;
    sendButton.disabled = true;
    brainInput.disabled = true;
    brainFeedback.textContent = "";
    brainStatus.textContent = "Sending request…";
    connectionPill.textContent = "REQUEST IN PROGRESS";

    addMessage("user", cleanMessage);
    conversation.push({ role: "user", content: cleanMessage });

    const waitingMessage = addMessage("assistant", "Contacting the Joseph Brain API…");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: cleanMessage,
          conversation: conversation.slice(-12)
        })
      });

      let data;

      try {
        data = await response.json();
      } catch {
        throw new Error(
          response.ok
            ? "The server returned a response that was not valid JSON."
            : `The server returned HTTP ${response.status}.`
        );
      }

      if (!response.ok || data.success === false) {
        throw new Error(
          typeof data.error === "string" && data.error.trim()
            ? data.error
            : `The Brain API request failed (HTTP ${response.status}).`
        );
      }

      const answer = extractAnswer(data);

      if (!answer) {
        waitingMessage.remove();
        addMessage(
          "assistant",
          "The API responded, but it did not return a readable answer in the format this interface supports. We need to align the frontend with the actual Brain API response before treating this as a successful conversation."
        );
        brainStatus.textContent = "Response format needs checking";
        connectionPill.textContent = "CHECK RESPONSE";
        return;
      }

      waitingMessage.remove();
      addMessage("assistant", answer);
      conversation.push({ role: "assistant", content: answer });
      brainStatus.textContent = "API response received";
      connectionPill.textContent = "API RESPONDED";
    } catch (error) {
      waitingMessage.remove();

      const message =
        error instanceof TypeError
          ? "Could not reach /api/chat. The V2 backend may not be deployed yet, or the network connection may have failed."
          : error.message || "An unexpected error occurred.";

      addMessage("assistant", `Request failed: ${message}`);
      showConnectionError(message);
    } finally {
      requestActive = false;
      sendButton.disabled = false;
      brainInput.disabled = false;
      brainInput.focus();
    }
  }

  $$(".nav-link").forEach((button) => {
    button.addEventListener("click", () => openPage(button.dataset.page));
  });

  $$("[data-open-page]").forEach((button) => {
    button.addEventListener("click", () => openPage(button.dataset.openPage));
  });

  menuButton.addEventListener("click", () => {
    const isOpen = sidebar.classList.toggle("open");
    menuButton.setAttribute("aria-expanded", String(isOpen));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      sidebar.classList.remove("open");
      menuButton.setAttribute("aria-expanded", "false");
    }
  });

  brainForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = brainInput.value.trim();

    if (!message) {
      brainFeedback.textContent = "Please enter a message first.";
      return;
    }

    brainInput.value = "";
    await sendBrainMessage(message);
  });

  window.addEventListener("hashchange", () => {
    const page = window.location.hash.slice(1);
    if (pageTitles[page]) openPage(page);
  });

  const initialPage = window.location.hash.slice(1);
  openPage(pageTitles[initialPage] ? initialPage : "dashboard");

  console.info("Joseph AI V2 interface initialized.");
})();
  
