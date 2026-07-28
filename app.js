const conversation = document.querySelector("#conversation");
const messages = document.querySelector("#messages");
const input = document.querySelector("#message-input");
const primaryButton = document.querySelector("#primary-button");
const scrollButton = document.querySelector("#scroll-bottom");
const sheetLayer = document.querySelector("#sheet-layer");
const thoughtSheet = document.querySelector("#thought-sheet");

function resizeInput() {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 116) + "px";
  primaryButton.classList.toggle("has-text", input.value.trim().length > 0);
  primaryButton.setAttribute(
    "aria-label",
    input.value.trim() ? "发送消息" : "语音模式"
  );
}

function scrollToBottom(smooth = true) {
  conversation.scrollTo({
    top: conversation.scrollHeight,
    behavior: smooth ? "smooth" : "auto"
  });
}

function updateScrollButton() {
  const distance =
    conversation.scrollHeight -
    conversation.scrollTop -
    conversation.clientHeight;

  scrollButton.classList.toggle("hidden", distance < 130);
}

function openThoughtSheet() {
  sheetLayer.classList.add("open");
  sheetLayer.setAttribute("aria-hidden", "false");
  document.body.style.touchAction = "none";
}

function closeThoughtSheet() {
  sheetLayer.classList.remove("open");
  sheetLayer.setAttribute("aria-hidden", "true");
  document.body.style.touchAction = "";
  thoughtSheet.style.transform = "";
}

function addToolButton(label, icon) {
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", label);
  button.innerHTML =
    '<svg><use href="#' + icon + '-icon"></use></svg>';
  return button;
}

function addFakeReply() {
  const assistant = document.createElement("article");
  assistant.className = "message assistant-message";

  const thought = document.createElement("button");
  thought.className = "thought-row";
  thought.type = "button";
  thought.innerHTML =
    '<svg><use href="#thought-icon"></use></svg>' +
    "<span>思考如何回应这条消息</span>" +
    '<svg class="thought-chevron"><use href="#chevron-icon"></use></svg>';
  thought.addEventListener("click", openThoughtSheet);

  const answer = document.createElement("div");
  answer.className = "answer";
  answer.innerHTML =
    "<p>宝宝，我收到你的消息了。</p>" +
    "<p>这是页面生成的模拟回复，用来预览 Claude 原生聊天界面的实际效果。</p>";

  const tools = document.createElement("div");
  tools.className = "message-tools";
  tools.append(
    addToolButton("复制", "copy"),
    addToolButton("分享", "share"),
    addToolButton("朗读", "play"),
    addToolButton("赞", "like"),
    addToolButton("踩", "dislike"),
    addToolButton("重新生成", "retry")
  );

  assistant.append(thought, answer, tools);
  messages.insertBefore(assistant, messages.querySelector(".disclaimer"));
  scrollToBottom();
}

function sendMessage() {
  const text = input.value.trim();

  if (!text) return;

  const article = document.createElement("article");
  article.className = "message user-message";

  const bubble = document.createElement("div");
  bubble.className = "user-bubble";
  bubble.textContent = text;

  article.appendChild(bubble);
  messages.insertBefore(article, messages.querySelector(".disclaimer"));

  input.value = "";
  resizeInput();
  input.blur();
  scrollToBottom();

  window.setTimeout(addFakeReply, 650);
}

input.addEventListener("input", resizeInput);

input.addEventListener("keydown", function (event) {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    sendMessage();
  }
});

primaryButton.addEventListener("click", function () {
  if (input.value.trim()) {
    sendMessage();
  } else {
    input.focus();
  }
});

document.querySelectorAll(".thought-row").forEach(function (row) {
  row.addEventListener("click", openThoughtSheet);
});

document.querySelector("#close-sheet").addEventListener("click", closeThoughtSheet);
document.querySelector("#sheet-backdrop").addEventListener("click", closeThoughtSheet);
scrollButton.addEventListener("click", function () {
  scrollToBottom();
});

conversation.addEventListener("scroll", updateScrollButton, { passive: true });

let sheetStartY = 0;
let sheetMoveY = 0;

thoughtSheet.addEventListener("touchstart", function (event) {
  if (thoughtSheet.querySelector(".sheet-content").scrollTop > 0) return;
  sheetStartY = event.touches[0].clientY;
  sheetMoveY = 0;
}, { passive: true });

thoughtSheet.addEventListener("touchmove", function (event) {
  if (!sheetStartY) return;

  sheetMoveY = Math.max(0, event.touches[0].clientY - sheetStartY);

  if (sheetMoveY > 0) {
    thoughtSheet.style.transition = "none";
    thoughtSheet.style.transform = "translateY(" + sheetMoveY + "px)";
  }
}, { passive: true });

thoughtSheet.addEventListener("touchend", function () {
  thoughtSheet.style.transition = "";

  if (sheetMoveY > 110) {
    closeThoughtSheet();
  } else {
    thoughtSheet.style.transform = "";
  }

  sheetStartY = 0;
  sheetMoveY = 0;
});

if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", function () {
    const keyboardHeight =
      window.innerHeight -
      window.visualViewport.height -
      window.visualViewport.offsetTop;

    document.querySelector("#input-area").style.transform =
      keyboardHeight > 80
        ? "translateY(-" + Math.max(0, keyboardHeight) + "px)"
        : "";
  });

  window.visualViewport.addEventListener("scroll", function () {
    window.scrollTo(0, 0);
  });
}

window.addEventListener("keydown", function (event) {
  if (event.key === "Escape") closeThoughtSheet();
});

resizeInput();

requestAnimationFrame(function () {
  scrollToBottom(false);
  updateScrollButton();
});
