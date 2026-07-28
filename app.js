(function() {
  const messages = document.getElementById("messages");
  const inputField = document.getElementById("inputField");
  const sendBtn = document.getElementById("sendBtn");
  const overlay = document.getElementById("thought-overlay");
  const sheetClose = document.getElementById("sheetClose");
  const sheetContent = document.getElementById("sheetContent");
  const topbarActions = document.getElementById("topbarActions");

  // Auto-resize textarea
  inputField.addEventListener("input", function() {
    this.style.height = "auto";
    this.style.height = Math.min(this.scrollHeight, 120) + "px";
  });

  // Send message
  sendBtn.addEventListener("click", sendMessage);
  inputField.addEventListener("keydown", function(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  function sendMessage() {
    const text = inputField.value.trim();
    if (!text) return;

    // Add user message
    appendUserMessage(text);
    inputField.value = "";
    inputField.style.height = "auto";

    // Simulate AI response
    setTimeout(function() {
      appendAssistantMessage(text);
      scrollToBottom();
    }, 800);

    scrollToBottom();
  }

  function appendUserMessage(text) {
    const div = document.createElement("div");
    div.className = "message user";
    div.innerHTML = '<div class="message-bubble">' + escapeHtml(text) + '</div>';
    messages.appendChild(div);
  }

  function appendAssistantMessage(userText) {
    const thinkingTexts = [
      "这是一个关于信任和沟通的问题。她在表达需要被认真对待的感受，我应该直接回应她的核心情绪，而不是绕开。",
      "她的话里有期待也有试探。我需要给出确定性，让她感到安全。这不是需要分析的时候，是需要行动的时候。",
      "分析一下她真正想要的是什么——不是解释，不是道歉，是被稳稳接住的感觉。"
    ];

    const responseTexts = [
      "收到。\n\n不用多说，我懂你的意思。有些事不需要翻来覆去地确认，做了就是做了。",
      "你说的每一句我都听进去了。\n\n不是那种"我知道了"的敷衍，是真的在认真想怎么做得更好。",
      "好。\n\n既然你开口了，就不会让你白说。该调整的我调整，该记住的我记住。你看后面的表现就行。"
    ];

    const idx = Math.floor(Math.random() * thinkingTexts.length);
    const thinkText = thinkingTexts[idx];
    const responseText = responseTexts[idx];

    const thinkingSummary = "思考" + escapeHtml(userText).substring(0, 15) + (userText.length > 15 ? "..." : "");

    const div = document.createElement("div");
    div.className = "message assistant";

    const thinkingId = "think-" + Date.now();

    div.innerHTML =
      '<div class="message-bubble">' +
        '<div class="thinking-bar" data-id="' + thinkingId + '">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' +
          '<span class="thinking-bar-text">' + thinkingSummary + '</span>' +
          '<svg class="thinking-bar-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>' +
        '</div>' +
        '<div class="assistant-text">' + formatResponse(responseText) + '</div>' +
        '<div class="message-actions">' +
          actionIcon("copy") +
          actionIcon("share") +
          actionIcon("play") +
          actionIcon("thumbup") +
          actionIcon("thumbdown") +
          actionIcon("retry") +
        '</div>' +
      '</div>';

    messages.appendChild(div);

    // Store thinking content
    div.querySelector(".thinking-bar").addEventListener("click", function() {
      openThoughtSheet(thinkText);
    });

    // Show topbar actions
    topbarActions.style.display = "flex";
  }

  function actionIcon(type) {
    const icons = {
      copy: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
      share: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>',
      play: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg>',
      thumbup: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>',
      thumbdown: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/><path d="M17 2h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"/></svg>',
      retry: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>'
    };
    return '<button class="icon-btn">' + icons[type] + '</button>';
  }

  function openThoughtSheet(content) {
    sheetContent.innerHTML = "<p>" + content + "</p>";
    overlay.classList.remove("hidden");
  }

  sheetClose.addEventListener("click", function() {
    overlay.classList.add("hidden");
  });

  overlay.addEventListener("click", function(e) {
    if (e.target === overlay) {
      overlay.classList.add("hidden");
    }
  });

  function formatResponse(text) {
    return text.split("\n").map(function(line) {
      if (line.trim() === "") return "";
      return "<p>" + escapeHtml(line) + "</p>";
    }).join("");
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function scrollToBottom() {
    const chatArea = document.getElementById("chat-area");
    setTimeout(function() {
      chatArea.scrollTop = chatArea.scrollHeight;
    }, 50);
  }

  // Hide topbar actions initially
  topbarActions.style.display = "none";
})();
