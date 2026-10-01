// Nexora AI Study Companion Client

(function () {
  const page = document.body;
  const chatForm = document.querySelector("#chat-form");
  const chatInput = document.querySelector("#chat-input");
  const chatMessages = document.querySelector("#chat-messages-container");
  const chatUrl = page.dataset.chatUrl || "/chat";

  const fileInput = document.querySelector("#chat-file-input");
  const attachBtn = document.querySelector("#attach-file-btn");
  const cameraBtn = document.querySelector("#camera-btn");
  const cameraNativeInput = document.querySelector("#camera-native-input");
  const attachmentPreview = document.querySelector("#attachment-preview");
  const attachmentThumb = document.querySelector("#attachment-thumb");
  const attachmentIcon = document.querySelector("#attachment-icon");
  const attachmentName = document.querySelector("#attachment-name");
  const attachmentSize = document.querySelector("#attachment-size");
  const removeAttachmentBtn = document.querySelector("#remove-attachment-btn");

  const cameraModal = document.querySelector("#camera-modal");
  const closeCameraModalBtn = document.querySelector("#close-camera-modal-btn");
  const cameraVideo = document.querySelector("#camera-video");
  const cameraCanvas = document.querySelector("#camera-canvas");
  const cameraFallback = document.querySelector("#camera-fallback");
  const cameraFallbackInput = document.querySelector("#camera-fallback-input");
  const capturePhotoBtn = document.querySelector("#capture-photo-btn");

  const navProgressBtn = document.querySelector("#nav-progress-btn");
  const contextBar = document.querySelector("#active-context-bar");
  const contextTopicName = document.querySelector("#context-topic-name");
  const contextSubjectName = document.querySelector("#context-subject-name");
  const clearContextBtn = document.querySelector("#clear-context-btn");

  const statTopicsCount = document.querySelector("#stat-topics-count");
  const statQueriesCount = document.querySelector("#stat-queries-count");

  const progressModal = document.querySelector("#progress-modal");
  const closeModalBtn = document.querySelector("#close-modal-btn");
  const modalCurrentTopic = document.querySelector("#modal-current-topic");
  const modalCurrentSubject = document.querySelector("#modal-current-subject");
  const modalTopicsList = document.querySelector("#modal-topics-list");

  // State
  let conversationHistory = [];
  let currentTopic = "";
  let currentSubject = "";
  let queriesCount = 0;
  let topicsSet = new Set();
  let pendingFile = null;
  let activeImagePreviewUrl = null;
  let cameraStream = null;

  // Personalization & Learning Analytics State
  let quizStats = {
    totalQuizzes: 0,
    totalQuestions: 0,
    totalCorrect: 0,
  };
  let weakConceptsSet = new Set();
  let strongTopicsSet = new Set();
  let quizHistory = [];

  // Lightweight Markdown to HTML renderer with Source Identification
  function formatMarkdown(text) {
    if (!text) return "";
    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Code blocks ```lang ... ```
    html = html.replace(/```([\w]*)\n([\s\S]*?)```/g, function (_, lang, code) {
      return `<pre class="code-block"><code class="language-${lang}">${code.trim()}</code></pre>`;
    });

    // Inline code `...`
    html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

    // 5. Source Identification Badges: 📘 "From Your Study Material", ✨ "AI Generated", 💡 "AI Example"
    html = html.replace(
      /(?:📘\s*)?\[\s*(?:From Your Study Material|From supplied material)\s*\]/gi,
      '<span class="source-badge badge-source-material"><span class="badge-icon">📘</span> From Your Study Material</span>'
    );
    html = html.replace(
      /(?:✨\s*)?\[\s*(?:AI Generated|AI-generated)\s*\]/gi,
      '<span class="source-badge badge-source-ai"><span class="badge-icon">✨</span> AI Generated</span>'
    );
    html = html.replace(
      /(?:💡\s*)?\[\s*(?:AI Example|AI-generated example)\s*\]/gi,
      '<span class="source-badge badge-source-example"><span class="badge-icon">💡</span> AI Example</span>'
    );
    html = html.replace(
      /📘\s*(?:From Your Study Material|From supplied material):?/gi,
      '<span class="source-badge badge-source-material"><span class="badge-icon">📘</span> From Your Study Material</span> '
    );
    html = html.replace(
      /✨\s*AI Generated:?/gi,
      '<span class="source-badge badge-source-ai"><span class="badge-icon">✨</span> AI Generated</span> '
    );
    html = html.replace(
      /💡\s*AI Example:?/gi,
      '<span class="source-badge badge-source-example"><span class="badge-icon">💡</span> AI Example</span> '
    );

    // Headings ###
    html = html.replace(/^### (.*$)/gim, '<h3 class="msg-h3">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="msg-h2">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 class="msg-h1">$1</h1>');

    // Bold **text**
    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

    // Italic *text*
    html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");

    // Blockquotes > text
    html = html.replace(/^\> (.*$)/gim, '<blockquote class="msg-quote">$1</blockquote>');

    // Unordered lists (- or *)
    html = html.replace(/^\s*[-*]\s+(.*)$/gim, '<li class="msg-li">$1</li>');
    html = html.replace(/(<li class="msg-li">.*<\/li>)/gms, '<ul class="msg-ul">$1</ul>');

    // Numbered lists
    html = html.replace(/^\s*(\d+)\.\s+(.*)$/gim, '<li class="msg-num-li"><span class="list-num">$1.</span> $2</li>');
    html = html.replace(/(<li class="msg-num-li">.*<\/li>)/gms, '<ol class="msg-ol">$1</ol>');

    // Paragraphs for double line breaks
    let paragraphs = html.split(/\n\s*\n/);
    return paragraphs
      .map((p) => {
        p = p.trim();
        if (!p) return "";
        if (p.startsWith("<h") || p.startsWith("<ul") || p.startsWith("<ol") || p.startsWith("<pre") || p.startsWith("<blockquote")) {
          return p;
        }
        return `<p>${p.replace(/\n/g, "<br>")}</p>`;
      })
      .join("");
  }

  function scrollToBottom() {
    if (chatMessages) {
      setTimeout(() => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }, 50);
    }
  }

  function updateContextUI(topic, subject) {
    if (topic && topic !== "General Studies") {
      currentTopic = topic;
      topicsSet.add(topic);
      if (contextBar && contextTopicName) {
        contextTopicName.textContent = topic;
        if (contextSubjectName) {
          contextSubjectName.textContent = subject ? `(${subject})` : "";
        }
        contextBar.hidden = false;
        contextBar.style.display = "flex";
      }
    }
    if (subject) {
      currentSubject = subject;
    }
    if (statTopicsCount) {
      statTopicsCount.textContent = topicsSet.size;
    }
    if (statQueriesCount) {
      statQueriesCount.textContent = queriesCount;
    }
  }

  function stageAttachment(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("File size exceeds 5 MB. Please select a smaller file (PNG, JPG, WEBP, PDF, TXT).");
      return;
    }
    pendingFile = file;

    if (activeImagePreviewUrl) {
      URL.revokeObjectURL(activeImagePreviewUrl);
      activeImagePreviewUrl = null;
    }

    if (attachmentName) attachmentName.textContent = file.name;
    if (attachmentSize) attachmentSize.textContent = `(${(file.size / 1024).toFixed(0)} KB)`;

    const isImage = file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name);
    if (isImage && attachmentThumb) {
      activeImagePreviewUrl = URL.createObjectURL(file);
      attachmentThumb.src = activeImagePreviewUrl;
      attachmentThumb.hidden = false;
      attachmentThumb.style.display = "block";
      if (attachmentIcon) attachmentIcon.style.display = "none";
    } else {
      if (attachmentThumb) {
        attachmentThumb.hidden = true;
        attachmentThumb.style.display = "none";
        attachmentThumb.src = "";
      }
      if (attachmentIcon) attachmentIcon.style.display = "inline";
    }

    if (attachmentPreview) {
      attachmentPreview.hidden = false;
      attachmentPreview.style.display = "inline-flex";
    }
    if (chatInput) chatInput.focus();
  }

  function clearStagedAttachment() {
    pendingFile = null;
    if (activeImagePreviewUrl) {
      URL.revokeObjectURL(activeImagePreviewUrl);
      activeImagePreviewUrl = null;
    }
    if (fileInput) fileInput.value = "";
    if (cameraNativeInput) cameraNativeInput.value = "";
    if (cameraFallbackInput) cameraFallbackInput.value = "";
    if (attachmentPreview) {
      attachmentPreview.hidden = true;
      attachmentPreview.style.display = "none";
    }
    if (attachmentThumb) {
      attachmentThumb.hidden = true;
      attachmentThumb.style.display = "none";
      attachmentThumb.src = "";
    }
    if (attachmentIcon) attachmentIcon.style.display = "inline";
    if (attachmentName) attachmentName.textContent = "";
    if (attachmentSize) attachmentSize.textContent = "";
  }

  function appendUserMessage(text, fileName = "", imagePreviewUrl = "") {
    const bubble = document.createElement("article");
    bubble.className = "chat-bubble user-bubble";
    const header = document.createElement("div");
    header.className = "bubble-header";
    header.innerHTML = '<span class="bubble-author">You</span><span class="bubble-time">Just now</span>';

    const body = document.createElement("div");
    body.className = "bubble-body";

    if (imagePreviewUrl) {
      const imgWrap = document.createElement("div");
      imgWrap.className = "attached-image-container";
      imgWrap.innerHTML = `<img src="${imagePreviewUrl}" alt="Attached image preview" class="attached-image-preview">`;
      body.appendChild(imgWrap);
    } else if (fileName) {
      const fileBadge = document.createElement("div");
      fileBadge.className = "attached-file-badge";
      fileBadge.innerHTML = `<span>📎 ${fileName}</span>`;
      body.appendChild(fileBadge);
    }

    if (text) {
      const p = document.createElement("p");
      p.textContent = text;
      body.appendChild(p);
    }

    const content = document.createElement("div");
    content.className = "bubble-content";
    content.appendChild(header);
    content.appendChild(body);

    bubble.appendChild(content);
    chatMessages.appendChild(bubble);
    scrollToBottom();
  }

  function appendTypingIndicator() {
    const bubble = document.createElement("article");
    bubble.className = "chat-bubble ai-bubble typing-bubble";
    bubble.id = "active-typing-indicator";

    const avatar = document.createElement("div");
    avatar.className = "bubble-avatar";
    avatar.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><path d="M12 2L13.8 7.2L19 9L13.8 10.8L12 16L10.2 10.8L5 9L10.2 7.2L12 2Z" fill="#6366f1"/></svg>';

    const content = document.createElement("div");
    content.className = "bubble-content";
    content.innerHTML = `
      <div class="bubble-header">
        <span class="bubble-author">Nexora</span>
        <span class="bubble-time">Thinking...</span>
      </div>
      <div class="bubble-body">
        <div class="typing-dots">
          <span></span><span></span><span></span>
        </div>
      </div>
    `;

    bubble.appendChild(avatar);
    bubble.appendChild(content);
    chatMessages.appendChild(bubble);
    scrollToBottom();
    return bubble;
  }

  function appendAIMessage(data) {
    const indicator = document.querySelector("#active-typing-indicator");
    if (indicator) indicator.remove();

    const bubble = document.createElement("article");
    bubble.className = "chat-bubble ai-bubble";

    const avatar = document.createElement("div");
    avatar.className = "bubble-avatar";
    avatar.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><path d="M12 2L13.8 7.2L19 9L13.8 10.8L12 16L10.2 10.8L5 9L10.2 7.2L12 2Z" fill="#6366f1"/></svg>';

    const content = document.createElement("div");
    content.className = "bubble-content";

    const header = document.createElement("div");
    header.className = "bubble-header";
    header.innerHTML = '<span class="bubble-author">Nexora</span><span class="bubble-time">Just now</span>';

    const body = document.createElement("div");
    body.className = "bubble-body markdown-rendered";
    body.innerHTML = formatMarkdown(data.reply);

    content.appendChild(header);
    content.appendChild(body);

    // Suggested Follow-up Actions
    if (Array.isArray(data.suggested_actions) && data.suggested_actions.length > 0) {
      const actionsWrapper = document.createElement("div");
      actionsWrapper.className = "bubble-actions";
      const actionLabel = document.createElement("span");
      actionLabel.className = "bubble-actions-label";
      actionLabel.textContent = "Suggested follow-ups:";
      actionsWrapper.appendChild(actionLabel);

      const actionPills = document.createElement("div");
      actionPills.className = "action-pills-list";

      data.suggested_actions.forEach((act) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "action-pill-btn";
        btn.textContent = act;
        btn.addEventListener("click", () => {
          submitQuery(act);
        });
        actionPills.appendChild(btn);
      });

      actionsWrapper.appendChild(actionPills);
      content.appendChild(actionsWrapper);
    }

    // 4. REGENERATE SECTION TOOLBAR
    attachSectionRegenToolbar(content, body, data);

    // 2. TEACH ME BASED ON MY MISTAKES: Automatic Mistake Remediation
    if (data && Array.isArray(data.remediations) && data.remediations.length > 0) {
      renderMistakeRemediation(data.remediations, content);
    }

    // 6. SMART SAVE PROMPT
    // "Would you like to save this learning package?"
    // [ 💾 Save ] [ Not Now ]
    if (data && data.reply) {
      const saveCard = document.createElement("div");
      saveCard.className = "smart-save-card";
      saveCard.innerHTML = `
        <div class="smart-save-header">
          <span class="smart-save-icon">💡</span>
          <span class="smart-save-text">Would you like to save this learning package?</span>
        </div>
        <div class="smart-save-actions">
          <button type="button" class="btn-save-learning" title="Save this learning package to your dashboard">
            <span>💾</span> Save
          </button>
          <button type="button" class="btn-dismiss-save" title="Keep only in this session">
            Not Now
          </button>
        </div>
      `;

      const saveBtn = saveCard.querySelector(".btn-save-learning");
      const dismissBtn = saveCard.querySelector(".btn-dismiss-save");

      saveBtn.addEventListener("click", async () => {
        saveBtn.disabled = true;
        saveBtn.innerHTML = "<span>⏳</span> Saving...";
        try {
          const res = await fetch("/api/saved-packages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              topic: data.active_topic || currentTopic || "General Studies",
              subject: data.active_subject || currentSubject || "General",
              reply: data.reply,
            }),
          });
          const resData = await res.json();
          if (!res.ok) throw new Error(resData.error || "Save failed");

          saveCard.innerHTML = `
            <div class="smart-save-saved">
              <span>✅</span>
              <span>Saved to My Learning!</span>
              <a href="/my-learning" class="saved-view-link">View in My Learning →</a>
            </div>
          `;
        } catch (err) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = "<span>💾</span> Save";
          alert("Could not save to My Learning: " + err.message);
        }
      });

      dismissBtn.addEventListener("click", () => {
        saveCard.style.opacity = "0";
        saveCard.style.transition = "opacity 0.2s ease";
        setTimeout(() => saveCard.remove(), 200);
      });

      content.appendChild(saveCard);
    }

    bubble.appendChild(avatar);
    bubble.appendChild(content);
    chatMessages.appendChild(bubble);
    scrollToBottom();
  }

  // ============================================================
  // 4. Section Regeneration Toolbar Helper
  // ============================================================
  function attachSectionRegenToolbar(contentElement, bodyElement, data) {
    const toolbar = document.createElement("div");
    toolbar.className = "section-regen-toolbar";
    toolbar.innerHTML = `
      <div class="regen-toolbar-title">
        <span>🔄</span>
        <span>Regenerate only this section:</span>
      </div>
      <div class="regen-buttons-group">
        <button type="button" class="btn-regen-chip" data-section="explanation">📖 Explanation</button>
        <button type="button" class="btn-regen-chip" data-section="concepts">🔑 Concepts</button>
        <button type="button" class="btn-regen-chip" data-section="examples">💡 Examples</button>
        <button type="button" class="btn-regen-chip" data-section="practice">🎯 Questions</button>
        <button type="button" class="btn-regen-chip" data-section="flashcards">🗂️ Flashcards</button>
        <button type="button" class="btn-regen-chip" data-section="revision">⏱️ Revision Plan</button>
      </div>
    `;

    toolbar.querySelectorAll(".btn-regen-chip").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const sectionKey = btn.dataset.section;
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = "<span>⏳</span> Updating...";

        try {
          const res = await fetch("/api/regenerate-section", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              section: sectionKey,
              topic: data.active_topic || currentTopic || "General Studies",
              subject: data.active_subject || currentSubject || "General",
            }),
          });
          const resData = await res.json();
          if (!res.ok) throw new Error(resData.error || "Regeneration failed");

          let newContentHtml = "";
          if (Array.isArray(resData.content)) {
            if (sectionKey === "flashcards") {
              newContentHtml = resData.content.map(c => `
                <div class="flashcard">
                  <p class="flashcard-question"><strong>Q:</strong> ${c.question || ""}</p>
                  <p class="flashcard-answer"><strong>A:</strong> ${c.answer || ""}</p>
                </div>
              `).join("");
            } else {
              newContentHtml = "<ul>" + resData.content.map(item => `<li>${item}</li>`).join("") + "</ul>";
            }
          } else {
            newContentHtml = formatMarkdown(resData.content || "");
          }

          // Search for corresponding section heading in bodyElement
          const headings = Array.from(bodyElement.querySelectorAll("h1, h2, h3"));
          let targetHeading = headings.find(h => {
            const t = h.textContent.toLowerCase();
            return t.includes(sectionKey) ||
              (sectionKey === "explanation" && (t.includes("learn") || t.includes("explain"))) ||
              (sectionKey === "practice" && t.includes("question")) ||
              (sectionKey === "revision" && t.includes("plan"));
          });

          if (targetHeading) {
            let curr = targetHeading.nextElementSibling;
            while (curr && !curr.tagName.startsWith("H") && !curr.classList.contains("section-highlight-updated")) {
              const next = curr.nextElementSibling;
              curr.remove();
              curr = next;
            }
            const wrapper = document.createElement("div");
            wrapper.className = "section-highlight-updated";
            wrapper.innerHTML = newContentHtml;
            targetHeading.insertAdjacentElement("afterend", wrapper);
          } else {
            const block = document.createElement("div");
            block.className = "section-highlight-updated";
            block.style.marginTop = "12px";
            block.style.padding = "10px 14px";
            block.style.borderRadius = "10px";
            block.style.background = "#f8fafc";
            block.style.border = "1px solid #e2e8f0";
            block.innerHTML = `<h4>🔄 Regenerated ${btn.textContent.trim()}</h4>` + newContentHtml;
            bodyElement.appendChild(block);
          }

          btn.innerHTML = "<span>✓</span> Updated!";
          setTimeout(() => {
            btn.innerHTML = originalText;
            btn.disabled = false;
          }, 2000);
        } catch (err) {
          btn.innerHTML = originalText;
          btn.disabled = false;
          alert("Could not regenerate section: " + err.message);
        }
      });
    });

    contentElement.appendChild(toolbar);
  }

  // ============================================================
  // 2. Teach Me Based on My Mistakes: Mistake -> Explanation -> Example -> Similar question -> Re-test
  // ============================================================
  function renderMistakeRemediation(remediations, container) {
    if (!remediations || remediations.length === 0) return;

    const box = document.createElement("div");
    box.className = "mistake-remediation-box";
    box.innerHTML = `
      <div class="remediation-box-header">
        <h4 class="remediation-box-title">
          <span>🧠</span>
          <span>Teach Me Based on My Mistakes</span>
        </h4>
        <span class="remediation-tag">Personalized Review</span>
      </div>
      <p style="margin: 0; font-size: 12.5px; color: #7c2d12;">
        Nexora automatically analyzed your mistakes and created this targeted remediation:
      </p>
    `;

    remediations.forEach((item) => {
      if (item.concept) {
        weakConceptsSet.add(item.concept);
      }

      const card = document.createElement("div");
      card.className = "remediation-item-card";

      const choicesHtml = (item.choices || []).map((ch, cIdx) => `
        <button type="button" class="btn-retest-choice" data-choice-idx="${cIdx}">${String.fromCharCode(65 + cIdx)}. ${ch}</button>
      `).join("");

      card.innerHTML = `
        <h5 class="remediation-concept-name">Targeted Concept: ${item.concept || "Key Principle"}</h5>
        <div class="remediation-step-row">
          <span class="step-label-pill step-mistake-pill">❌ The Mistake</span>
          <div>${item.mistake || "Identified misconception in quiz answers."}</div>
        </div>
        <div class="remediation-step-row">
          <span class="step-label-pill step-explain-pill">💡 Simple Explanation</span>
          <div>${item.explanation || "Core concept explanation."}</div>
        </div>
        <div class="remediation-step-row">
          <span class="step-label-pill step-example-pill">🌍 Real-World Example</span>
          <div>${item.example || "Everyday intuitive analogy."}</div>
        </div>
        <div class="retest-card">
          <div class="retest-header">
            <span>🔁 Re-test: Similar Question</span>
          </div>
          <p class="retest-question-text">${item.similar_question || "Test your understanding:"}</p>
          <div class="retest-choices-list">
            ${choicesHtml}
          </div>
          <div class="retest-feedback-wrap" hidden style="display: none;"></div>
        </div>
      `;

      const choiceButtons = card.querySelectorAll(".btn-retest-choice");
      const feedbackWrap = card.querySelector(".retest-feedback-wrap");
      choiceButtons.forEach((cBtn) => {
        cBtn.addEventListener("click", () => {
          const selectedIdx = parseInt(cBtn.dataset.choiceIdx, 10);
          const correctIdx = item.correct_answer !== undefined ? item.correct_answer : 0;
          choiceButtons.forEach(b => {
            b.disabled = true;
            const bIdx = parseInt(b.dataset.choiceIdx, 10);
            if (bIdx === correctIdx) {
              b.classList.add("chosen-correct");
            } else if (b === cBtn) {
              b.classList.add("chosen-incorrect");
            }
          });

          feedbackWrap.hidden = false;
          feedbackWrap.style.display = "block";
          if (selectedIdx === correctIdx) {
            feedbackWrap.innerHTML = `
              <div class="retest-feedback-box feedback-success">
                <span>✅</span>
                <span>Correct! You mastered this concept. ${item.retest_explanation || ""}</span>
              </div>
            `;
            if (item.concept) {
              weakConceptsSet.delete(item.concept);
              strongTopicsSet.add(item.concept);
            }
          } else {
            feedbackWrap.innerHTML = `
              <div class="retest-feedback-box feedback-error">
                <span>❌</span>
                <span>Review: ${item.retest_explanation || "The correct choice was " + String.fromCharCode(65 + correctIdx) + "."}</span>
              </div>
            `;
          }
        });
      });

      box.appendChild(card);
    });

    container.appendChild(box);
    scrollToBottom();
  }

  // ============================================================
  // Interactive Quiz Runner in Chat
  // ============================================================
  async function startInteractiveQuiz(topicName, customSubject) {
    const topic = topicName || currentTopic || "General Studies";
    appendUserMessage(`📝 Take quick quiz on ${topic}`);
    appendTypingIndicator();

    try {
      const res = await fetch("/api/quiz/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic,
          subject: customSubject || currentSubject || "General",
        }),
      });
      const data = await res.json();
      const indicator = document.querySelector("#active-typing-indicator");
      if (indicator) indicator.remove();

      if (!res.ok || !data.questions) {
        throw new Error(data.error || "Could not generate quiz questions.");
      }

      const questions = data.questions;

      const bubble = document.createElement("article");
      bubble.className = "chat-bubble ai-bubble";
      const avatar = document.createElement("div");
      avatar.className = "bubble-avatar";
      avatar.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><path d="M12 2L13.8 7.2L19 9L13.8 10.8L12 16L10.2 10.8L5 9L10.2 7.2L12 2Z" fill="#6366f1"/></svg>';

      const content = document.createElement("div");
      content.className = "bubble-content";

      const header = document.createElement("div");
      header.className = "bubble-header";
      header.innerHTML = '<span class="bubble-author">Nexora</span><span class="bubble-time">Just now</span>';

      const quizContainer = document.createElement("div");
      quizContainer.className = "interactive-quiz-container";
      quizContainer.innerHTML = `
        <div class="quiz-container-header">
          <div class="quiz-title-badge">
            <span class="quiz-icon-circle">📝</span>
            <div>
              <h4 class="quiz-title-text">Quick Quiz: ${topic}</h4>
              <span style="font-size: 11.5px; color: #64748b;">5 multiple-choice questions</span>
            </div>
          </div>
          <span class="pill-label">Active Recall</span>
        </div>
        <div class="quiz-questions-form"></div>
        <button type="button" class="btn-submit-quiz-answers">Submit Answers</button>
      `;

      const formWrap = quizContainer.querySelector(".quiz-questions-form");
      const submitBtn = quizContainer.querySelector(".btn-submit-quiz-answers");

      questions.forEach((q, qIdx) => {
        const itemBlock = document.createElement("div");
        itemBlock.className = "quiz-item-block";
        itemBlock.innerHTML = `
          <p class="quiz-item-q">${qIdx + 1}. ${q.question}</p>
          <div class="quiz-choices-wrap">
            ${(q.choices || []).map((ch, cIdx) => `
              <label class="quiz-choice-row">
                <input type="radio" name="q_${qIdx}" value="${cIdx}">
                <span>${String.fromCharCode(65 + cIdx)}. ${ch}</span>
              </label>
            `).join("")}
          </div>
        `;
        formWrap.appendChild(itemBlock);
      });

      // Submit Quiz Answers
      submitBtn.addEventListener("click", async () => {
        const submittedAnswers = [];
        for (let i = 0; i < questions.length; i++) {
          const selected = formWrap.querySelector(`input[name="q_${i}"]:checked`);
          submittedAnswers.push(selected ? parseInt(selected.value, 10) : null);
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = "<span>⏳</span> Evaluating & analyzing mistakes...";

        try {
          const evalRes = await fetch("/api/quiz/evaluate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              quiz: questions,
              answers: submittedAnswers,
              topic: topic,
            }),
          });
          const evalData = await evalRes.json();
          if (!evalRes.ok) throw new Error(evalData.error || "Evaluation failed");

          // Update stats
          quizStats.totalQuizzes++;
          quizStats.totalQuestions += questions.length;
          quizStats.totalCorrect += evalData.score;
          quizHistory.push({
            topic: topic,
            score: evalData.score,
            total: evalData.total,
            date: new Date().toISOString(),
          });

          if (evalData.score >= 4) {
            strongTopicsSet.add(topic);
          } else {
            weakConceptsSet.add(topic);
          }

          submitBtn.remove();

          // Render Score Banner
          const scorePercent = Math.round((evalData.score / evalData.total) * 100);
          const scoreBanner = document.createElement("div");
          scoreBanner.className = "quiz-score-banner";
          scoreBanner.innerHTML = `
            <div>
              <span class="quiz-score-text">Quiz Score: ${evalData.score} / ${evalData.total} (${scorePercent}%)</span>
              <p style="margin: 3px 0 0; font-size: 12px; color: #166534;">
                ${scorePercent >= 80 ? "🌟 Excellent understanding of " + topic + "!" : "Keep going! Review the targeted mistake explanations below."}
              </p>
            </div>
            <span style="font-size: 24px;">${scorePercent >= 80 ? "🎯" : "📖"}</span>
          `;
          quizContainer.appendChild(scoreBanner);

          // Automatic Mistake Remediation
          if (evalData.remediations && evalData.remediations.length > 0) {
            renderMistakeRemediation(evalData.remediations, content);
          }

          // Smart Save Prompt
          const saveCard = document.createElement("div");
          saveCard.className = "smart-save-card";
          saveCard.innerHTML = `
            <div class="smart-save-header">
              <span class="smart-save-icon">💡</span>
              <span class="smart-save-text">Would you like to save this learning package?</span>
            </div>
            <div class="smart-save-actions">
              <button type="button" class="btn-save-learning"><span>💾</span> Save</button>
              <button type="button" class="btn-dismiss-save">Not Now</button>
            </div>
          `;
          const saveBtn = saveCard.querySelector(".btn-save-learning");
          const dismissBtn = saveCard.querySelector(".btn-dismiss-save");

          saveBtn.addEventListener("click", async () => {
            saveBtn.disabled = true;
            saveBtn.innerHTML = "<span>⏳</span> Saving...";
            try {
              const sRes = await fetch("/api/saved-packages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  topic: topic,
                  subject: currentSubject || "General",
                  reply: `### Quiz & Answers on ${topic}\n\nScore: ${evalData.score}/${evalData.total} (${scorePercent}%)\n\n` +
                    questions.map((q, i) => `${i+1}. ${q.question}\nCorrect: ${q.choices[q.answer]}`).join("\n\n"),
                  content_type: "Quiz & Questions",
                }),
              });
              if (sRes.ok) {
                saveCard.innerHTML = `<div class="smart-save-saved"><span>✅</span><span>Saved to My Learning!</span><a href="/my-learning" class="saved-view-link">View in My Learning →</a></div>`;
              }
            } catch (e) {
              saveBtn.disabled = false;
              saveBtn.innerHTML = "<span>💾</span> Save";
            }
          });

          dismissBtn.addEventListener("click", () => saveCard.remove());
          content.appendChild(saveCard);

          scrollToBottom();
        } catch (evalErr) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = "Submit Answers";
          alert("Could not evaluate quiz: " + evalErr.message);
        }
      });

      content.appendChild(header);
      content.appendChild(quizContainer);
      bubble.appendChild(avatar);
      bubble.appendChild(content);
      chatMessages.appendChild(bubble);
      scrollToBottom();
    } catch (err) {
      appendErrorMessage("Could not generate quiz: " + err.message);
    }
  }

  // ============================================================
  // 7. Quick Revision Session Helper (5m, 10m, 20m)
  // ============================================================
  async function startQuickRevisionSession(duration, topicName) {
    const topic = topicName || currentTopic || "General Studies";
    const minutes = duration === "5m" ? "5-minute" : (duration === "20m" ? "20-minute" : "10-minute");

    appendUserMessage(`⏱️ Start ${minutes} quick revision on ${topic}`);
    appendTypingIndicator();

    try {
      const res = await fetch("/api/quick-revision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic,
          duration: duration,
          weak_areas: Array.from(weakConceptsSet),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Quick revision generation failed.");

      let markdownReply = data.revision_content || `### ⏱️ ${minutes} Quick Revision: ${topic}\n\n✨ [AI Generated] Focused high-impact review on core principles.`;

      if (Array.isArray(data.flashcards) && data.flashcards.length > 0) {
        markdownReply += "\n\n### 🗂️ Active Recall Flashcards\n" + data.flashcards.map(f => `* **Q: ${f.question}** — ${f.answer}`).join("\n");
      }

      if (Array.isArray(data.quick_quiz) && data.quick_quiz.length > 0) {
        markdownReply += "\n\n### 🎯 Quick Checkpoint\n" + data.quick_quiz.map((q, idx) => `* **Q${idx+1}:** ${q.question}\n  * Explanation: ${q.explanation}`).join("\n");
      }

      appendAIMessage({
        reply: markdownReply,
        active_topic: topic,
        active_subject: currentSubject || "General",
        suggested_actions: [
          `Test me on ${topic} with a 5-question quiz`,
          `Explain ${topic} with real-world examples`,
          `Generate complete learning package for ${topic}`,
        ],
      });
    } catch (err) {
      appendErrorMessage("Could not load quick revision: " + err.message);
    }
  }

  function appendErrorMessage(message) {
    const indicator = document.querySelector("#active-typing-indicator");
    if (indicator) indicator.remove();

    const bubble = document.createElement("article");
    bubble.className = "chat-bubble ai-bubble error-bubble";

    const avatar = document.createElement("div");
    avatar.className = "bubble-avatar";
    avatar.innerHTML = '<span style="font-size:16px;">⚠️</span>';

    const content = document.createElement("div");
    content.className = "bubble-content";
    content.innerHTML = `
      <div class="bubble-header"><span class="bubble-author">Nexora</span></div>
      <div class="bubble-body"><p class="chat-error-text">${message}</p></div>
    `;

    bubble.appendChild(avatar);
    bubble.appendChild(content);
    chatMessages.appendChild(bubble);
    scrollToBottom();
  }

  // Camera Management
  async function openCamera() {
    if (cameraModal) {
      try {
        cameraModal.showModal();
      } catch (e) {
        cameraModal.style.display = "block";
      }
    }
    if (cameraFallback) {
      cameraFallback.hidden = true;
      cameraFallback.style.display = "none";
    }
    if (cameraVideo) {
      cameraVideo.style.display = "block";
    }

    let stream = null;
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
        });
      } catch (err1) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        } catch (err2) {
          console.warn("Direct webcam stream failed:", err2);
          stream = null;
        }
      }
    }

    if (stream && cameraVideo) {
      cameraStream = stream;
      cameraVideo.srcObject = stream;
      try {
        await cameraVideo.play();
      } catch (e) {
        console.warn("video play error:", e);
      }
    } else {
      // Fallback: camera stream unavailable (desktop without webcam, permission blocked, etc.)
      if (cameraVideo) cameraVideo.style.display = "none";
      if (cameraFallback) {
        cameraFallback.hidden = false;
        cameraFallback.style.display = "flex";
      }
      // Also automatically trigger native camera input so user gets camera dialog immediately
      if (cameraNativeInput) {
        cameraNativeInput.click();
      }
    }
  }

  function closeCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      cameraStream = null;
    }
    if (cameraVideo) {
      cameraVideo.srcObject = null;
    }
    if (cameraModal && cameraModal.open) {
      cameraModal.close();
    }
  }

  function capturePhotoFromCamera() {
    if (!cameraVideo || !cameraCanvas) return;
    const width = cameraVideo.videoWidth || 640;
    const height = cameraVideo.videoHeight || 480;
    cameraCanvas.width = width;
    cameraCanvas.height = height;

    const ctx = cameraCanvas.getContext("2d");
    ctx.drawImage(cameraVideo, 0, 0, width, height);

    cameraCanvas.toBlob(
      (blob) => {
        if (blob) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
          const file = new File([blob], `camera_photo_${timestamp}.jpg`, { type: "image/jpeg" });
          stageAttachment(file);
        }
        closeCamera();
      },
      "image/jpeg",
      0.92
    );
  }

  // Submit Query to /chat
  async function submitQuery(messageText) {
    if (!messageText && !pendingFile) return;

    const fileToUpload = pendingFile;
    const fileName = fileToUpload ? fileToUpload.name : "";
    const isImage = fileToUpload && (fileToUpload.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp)$/i.test(fileName));
    const imagePreviewUrl = isImage ? URL.createObjectURL(fileToUpload) : "";

    clearStagedAttachment();

    appendUserMessage(messageText || (isImage ? "Analyze this attached image" : "Review attached material"), fileName, imagePreviewUrl);
    if (chatInput) {
      chatInput.value = "";
      chatInput.style.height = "auto";
    }

    appendTypingIndicator();
    queriesCount++;

    try {
      let response;
      if (fileToUpload) {
        const formData = new FormData();
        formData.append("message", messageText || "Analyze this attached study material and explain key concepts, solve questions, or provide notes.");
        formData.append("study_material", fileToUpload);
        formData.append("context_topic", currentTopic);
        formData.append("history", JSON.stringify(conversationHistory.slice(-6)));
        response = await fetch(chatUrl, {
          method: "POST",
          body: formData,
        });
      } else {
        response = await fetch(chatUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: messageText,
            context_topic: currentTopic,
            history: conversationHistory.slice(-6),
          }),
        });
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not generate response from Nexora.");
      }

      conversationHistory.push({ role: "user", text: messageText || "Attached visual/document material" });
      conversationHistory.push({ role: "model", text: data.reply });

      updateContextUI(data.active_topic, data.active_subject);
      appendAIMessage(data);
    } catch (err) {
      appendErrorMessage(err.message || "An unexpected error occurred. Please try again.");
    }
  }

  // Handle Chat Form Submission
  if (chatForm && chatInput) {
    chatForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      submitQuery(text);
    });

    chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const text = chatInput.value.trim();
        submitQuery(text);
      }
    });

    chatInput.addEventListener("input", () => {
      chatInput.style.height = "auto";
      chatInput.style.height = Math.min(chatInput.scrollHeight, 160) + "px";
    });
  }

  // File Attachment Handling
  if (attachBtn && fileInput) {
    attachBtn.addEventListener("click", () => {
      fileInput.click();
    });

    fileInput.addEventListener("change", () => {
      if (fileInput.files && fileInput.files[0]) {
        stageAttachment(fileInput.files[0]);
      }
    });
  }

  // Camera Button & Modal Handling
  if (cameraBtn) {
    cameraBtn.addEventListener("click", () => {
      openCamera();
    });
  }

  if (cameraNativeInput) {
    cameraNativeInput.addEventListener("change", () => {
      if (cameraNativeInput.files && cameraNativeInput.files[0]) {
        stageAttachment(cameraNativeInput.files[0]);
        closeCamera();
      }
    });
  }

  if (capturePhotoBtn) {
    capturePhotoBtn.addEventListener("click", () => {
      capturePhotoFromCamera();
    });
  }

  if (closeCameraModalBtn) {
    closeCameraModalBtn.addEventListener("click", () => {
      closeCamera();
    });
  }

  if (cameraModal) {
    cameraModal.addEventListener("click", (e) => {
      if (e.target === cameraModal) {
        closeCamera();
      }
    });
  }

  if (cameraFallbackInput) {
    cameraFallbackInput.addEventListener("change", () => {
      if (cameraFallbackInput.files && cameraFallbackInput.files[0]) {
        stageAttachment(cameraFallbackInput.files[0]);
        closeCamera();
      }
    });
  }

  // Direct Clipboard Image Paste (Ctrl+V)
  window.addEventListener("paste", (e) => {
    const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf("image") !== -1) {
        const file = item.getAsFile();
        if (file) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
          const extension = item.type.split("/")[1] || "png";
          const namedFile = new File([file], `pasted_image_${timestamp}.${extension}`, { type: file.type });
          stageAttachment(namedFile);
          break;
        }
      }
    }
  });

  if (removeAttachmentBtn) {
    removeAttachmentBtn.addEventListener("click", () => {
      clearStagedAttachment();
    });
  }

  // Clear Context
  if (clearContextBtn) {
    clearContextBtn.addEventListener("click", () => {
      currentTopic = "";
      currentSubject = "";
      if (contextBar) {
        contextBar.hidden = true;
        contextBar.style.display = "none";
      }
      if (chatInput) {
        chatInput.placeholder = "Enter a topic, syllabus, or upload study material — Nexora will create a personalized learning plan.";
        chatInput.focus();
      }
    });
  }

  // Suggestion Chips
  document.querySelectorAll(".suggestion-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const basePrompt = btn.dataset.prompt;
      if (basePrompt.includes("learning package")) {
        if (currentTopic) {
          submitQuery(`Generate a complete personalized learning package for ${currentTopic} including simple structured explanation, important concepts, real-world examples, practice questions, flashcards, and short revision plan.`);
        } else {
          if (chatInput) {
            chatInput.value = "Generate a complete personalized learning package for ";
            chatInput.focus();
          }
        }
      } else if (basePrompt.includes("5-minute quick revision") || basePrompt.includes("5m Quick Revision")) {
        startQuickRevisionSession("5m", currentTopic);
      } else if (basePrompt.includes("AI Study Path")) {
        openProgressModal();
      } else if (currentTopic) {
        if (basePrompt.includes("real-life")) {
          submitQuery(`Explain ${currentTopic} using relatable real-life examples and everyday analogies so it is easy to understand.`);
        } else if (basePrompt.includes("Explain a topic")) {
          submitQuery(`Explain ${currentTopic} in simple terms with examples.`);
        } else if (basePrompt.includes("quiz")) {
          startInteractiveQuiz(currentTopic, currentSubject);
        } else if (basePrompt.includes("revision notes")) {
          submitQuery(`Make concise revision notes and key takeaways for ${currentTopic}.`);
        } else if (basePrompt.includes("practice questions")) {
          submitQuery(`Give me practice questions on ${currentTopic} with step-by-step solutions.`);
        } else if (basePrompt.includes("news")) {
          submitQuery(`Give me today's important technology and academic news related to ${currentSubject || currentTopic}.`);
        } else {
          submitQuery(`${basePrompt} for ${currentTopic}`);
        }
      } else {
        if (chatInput) {
          if (basePrompt.includes("real-life")) {
            chatInput.value = "Explain this topic with real-life examples: ";
          } else {
            chatInput.value = basePrompt + ": ";
          }
          chatInput.focus();
          chatInput.setSelectionRange(chatInput.value.length, chatInput.value.length);
        }
      }
    });
  });

  // Study Tools Right-Side Panel Click Handlers
  document.querySelectorAll(".tool-tile").forEach((tile) => {
    tile.addEventListener("click", () => {
      const tool = tile.dataset.tool;
      switch (tool) {
        case "package":
          if (currentTopic) {
            submitQuery(`Generate a complete personalized learning package for ${currentTopic} including: 1. Simple structured explanation, 2. Important concepts, 3. Real-world examples, 4. Practice questions, 5. Flashcards, 6. Short revision plan.`);
          } else {
            if (chatInput) {
              chatInput.value = "Generate a complete personalized learning package for ";
              chatInput.focus();
            }
          }
          break;

        case "quick-revision":
          startQuickRevisionSession("10m", currentTopic);
          break;

        case "study-path":
          openProgressModal();
          break;

        case "quiz":
          startInteractiveQuiz(currentTopic, currentSubject);
          break;

        case "personalize":
          if (currentTopic) {
            submitQuery(`I want to personalize my learning for ${currentTopic}. Please ask or configure my academic level, target exam goal, and daily study time, then build a personalized learning plan tailored to my pace and weak areas.`);
          } else {
            submitQuery("I want to personalize my learning. Please help me set my academic level, exam goal, and daily study time to create a personalized study plan.");
          }
          break;

        case "news":
          if (currentTopic) {
            submitQuery(`What are today's important technology, engineering, or academic news and breakthroughs related to ${currentSubject || currentTopic} useful for students?`);
          } else {
            submitQuery("What are today's most important technology, science, and academic news useful for students?");
          }
          break;

        case "notes":
          if (currentTopic) {
            submitQuery(`Turn ${currentTopic} into structured, concise smart notes with key definitions, formulas, and high-yield summary points.`);
          } else {
            if (chatInput) {
              chatInput.value = "Create smart revision notes for ";
              chatInput.focus();
            }
          }
          break;

        case "flashcards":
          if (currentTopic) {
            submitQuery(`Create 5 active-recall flashcards (Question & Answer pairs) on ${currentTopic}.`);
          } else {
            if (chatInput) {
              chatInput.value = "Create flashcards for ";
              chatInput.focus();
            }
          }
          break;

        case "practice":
          if (currentTopic) {
            submitQuery(`Generate 4 level-appropriate practice questions and problem exercises for ${currentTopic} with hints and solutions.`);
          } else {
            if (chatInput) {
              chatInput.value = "Generate practice questions for ";
              chatInput.focus();
            }
          }
          break;

        case "timetable":
          if (currentTopic) {
            submitQuery(`Create a detailed, actionable daily study and revision timetable for ${currentTopic} (${currentSubject || "studies"}). Include structured morning/evening blocks, active recall periods, and Pomodoro intervals.`);
          } else {
            submitQuery("Create a comprehensive, balanced daily study and revision timetable template for a student, featuring morning and evening study blocks, active recall sessions, and Pomodoro intervals.");
          }
          break;

        case "progress":
          openProgressModal();
          break;
      }
    });
  });

  // ============================================================
  // 3 & 8. AI Study Path & Progress Analytics in Modal
  // ============================================================
  function openProgressModal() {
    if (!progressModal) return;

    if (modalCurrentTopic) modalCurrentTopic.textContent = currentTopic || "None yet";
    if (modalCurrentSubject) modalCurrentSubject.textContent = currentSubject || "Not identified";

    // 1. Calculate Topic Mastery
    const totalAttempted = quizStats.totalQuestions;
    const totalCorrect = quizStats.totalCorrect;
    const accuracy = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;
    const topicCount = topicsSet.size;

    let masteryScore = 0;
    if (totalAttempted > 0) {
      masteryScore = Math.min(100, Math.round(accuracy * 0.7 + Math.min(30, topicCount * 10)));
    } else if (topicCount > 0) {
      masteryScore = Math.min(60, topicCount * 15);
    }

    const masteryBar = document.querySelector("#modal-mastery-bar");
    const masteryText = document.querySelector("#modal-mastery-text");
    if (masteryBar) masteryBar.style.width = masteryScore + "%";
    if (masteryText) masteryText.textContent = masteryScore + "%";

    const quizzesCount = document.querySelector("#modal-quizzes-count");
    const questionsCount = document.querySelector("#modal-questions-count");
    const accuracyRate = document.querySelector("#modal-accuracy-rate");
    if (quizzesCount) quizzesCount.textContent = quizStats.totalQuizzes;
    if (questionsCount) questionsCount.textContent = totalAttempted;
    if (accuracyRate) accuracyRate.textContent = totalAttempted > 0 ? accuracy + "%" : "--%";

    // 2. Render Topics Covered
    if (modalTopicsList) {
      modalTopicsList.innerHTML = "";
      if (topicsSet.size === 0) {
        modalTopicsList.innerHTML = '<li class="empty-history">Start chatting to track topics here.</li>';
      } else {
        topicsSet.forEach((t) => {
          const li = document.createElement("li");
          li.className = "history-item";
          li.textContent = t;
          modalTopicsList.appendChild(li);
        });
      }
    }

    // 3. Populate AI Study Path
    const strongList = document.querySelector("#modal-strong-topics");
    const improvingList = document.querySelector("#modal-improving-topics");
    const weakList = document.querySelector("#modal-weak-topics");
    const nextTopicName = document.querySelector("#modal-next-topic-name");
    const nextTopicReason = document.querySelector("#modal-next-topic-reason");
    const studyNextBtn = document.querySelector("#modal-study-next-btn");

    fetch("/api/study-path", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        covered_topics: Array.from(topicsSet),
        quiz_history: quizHistory,
        weak_concepts: Array.from(weakConceptsSet),
      }),
    })
      .then((r) => r.json())
      .then((pathData) => {
        if (strongList) {
          strongList.innerHTML = "";
          const strongs = pathData.strong_topics && pathData.strong_topics.length > 0 ? pathData.strong_topics : Array.from(strongTopicsSet);
          if (strongs.length === 0) {
            strongList.innerHTML = '<li class="path-empty-item">Take quizzes to identify strong topics.</li>';
          } else {
            strongs.forEach((t) => {
              const li = document.createElement("li");
              li.className = "path-topic-item";
              li.textContent = t;
              strongList.appendChild(li);
            });
          }
        }

        if (improvingList) {
          improvingList.innerHTML = "";
          const improvings = pathData.improving_topics && pathData.improving_topics.length > 0 ? pathData.improving_topics : Array.from(topicsSet).filter((t) => !strongTopicsSet.has(t) && !weakConceptsSet.has(t));
          if (improvings.length === 0) {
            improvingList.innerHTML = '<li class="path-empty-item">Explore concepts to track improvement.</li>';
          } else {
            improvings.forEach((t) => {
              const li = document.createElement("li");
              li.className = "path-topic-item";
              li.textContent = t;
              improvingList.appendChild(li);
            });
          }
        }

        if (weakList) {
          weakList.innerHTML = "";
          const weaks = pathData.weak_topics && pathData.weak_topics.length > 0 ? pathData.weak_topics : Array.from(weakConceptsSet);
          if (weaks.length === 0) {
            weakList.innerHTML = '<li class="path-empty-item">No weak areas identified yet. Great job!</li>';
          } else {
            weaks.forEach((t) => {
              const li = document.createElement("li");
              li.className = "path-topic-item";
              li.textContent = t;
              weakList.appendChild(li);
            });
          }
        }

        const targetNext = pathData.recommended_next_topic || (currentTopic ? "Advanced " + currentTopic : "Core Fundamentals");
        if (nextTopicName) {
          nextTopicName.textContent = targetNext;
        }
        if (nextTopicReason) {
          nextTopicReason.textContent = pathData.next_topic_reason || "Recommended based on your study history and mastery.";
        }

        if (studyNextBtn) {
          studyNextBtn.onclick = () => {
            progressModal.close();
            submitQuery(`Generate a complete personalized learning package for ${targetNext} including explanation, important concepts, real-world examples, practice questions, flashcards, and short revision plan.`);
          };
        }
      })
      .catch(() => {
        if (nextTopicName) nextTopicName.textContent = currentTopic ? "Advanced " + currentTopic : "Core Fundamentals";
      });

    progressModal.showModal();
  }

  // Main Navigation Progress button
  if (navProgressBtn) {
    navProgressBtn.addEventListener("click", () => {
      openProgressModal();
    });
  }

  if (closeModalBtn && progressModal) {
    closeModalBtn.addEventListener("click", () => {
      progressModal.close();
    });
    progressModal.addEventListener("click", (e) => {
      if (e.target === progressModal) {
        progressModal.close();
      }
    });
  }

  // ============================================================
  // Backward compatibility with result.html (study package view)
  // ============================================================
  function renderSectionContent(container, section, content) {
    container.replaceChildren();
    if (section === "flashcards") {
      content.forEach((item) => {
        const card = document.createElement("div");
        card.className = "flashcard";
        const q = document.createElement("p");
        q.className = "flashcard-question";
        q.textContent = item.question;
        const a = document.createElement("p");
        a.className = "flashcard-answer";
        a.textContent = item.answer;
        card.append(q, a);
        container.append(card);
      });
      return;
    }
    const list = document.createElement("ul");
    content.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      list.append(li);
    });
    container.append(list);
  }

  document.querySelectorAll(".regenerate-button, .simplify-button").forEach((button) => {
    button.addEventListener("click", async () => {
      const section = button.dataset.section;
      const card = document.querySelector(`[data-section="${section}"].learning-card`);
      if (!card) return;
      const content = card.querySelector(".section-content");
      const original = button.innerHTML;
      button.disabled = true;
      button.innerHTML = '<span aria-hidden="true">…</span> Updating';
      try {
        const response = await fetch(page.dataset.sectionUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ section, simpler: button.classList.contains("simplify-button") }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not update this section.");
        renderSectionContent(content, section, data.content);
      } catch (error) {
        content.prepend(document.createElement("p"));
      } finally {
        button.disabled = false;
        button.innerHTML = original;
      }
    });
  });

  // Result.html Quiz Runner with Automatic Mistake Remediation
  const startQuizBtn = document.querySelector("#start-quiz");
  const quizPanel = document.querySelector("#quiz-panel");
  const weakTopicsPanel = document.querySelector("#weak-topics");

  if (startQuizBtn && quizPanel) {
    startQuizBtn.addEventListener("click", async () => {
      startQuizBtn.disabled = true;
      startQuizBtn.innerHTML = "<span>⏳</span> Preparing Quiz...";
      try {
        const res = await fetch(page.dataset.quizUrl || "/quiz", { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load quiz.");

        quizPanel.hidden = false;
        quizPanel.style.display = "block";
        quizPanel.scrollIntoView({ behavior: "smooth" });

        const questions = data.questions || [];
        quizPanel.innerHTML = `
          <div class="panel-header" style="margin-bottom: 14px;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: #1e1b4b;">Recall Practice Quiz</h3>
            <p style="margin: 4px 0 0; font-size: 12.5px; color: #64748b;">5 questions grounded in your study material</p>
          </div>
          <form id="result-quiz-form" class="quiz-form">
            ${questions.map((q, idx) => `
              <div class="quiz-question-block" style="margin-bottom: 16px;">
                <p style="margin: 0 0 6px; font-weight: 700; font-size: 13.5px;">${idx + 1}. ${q.question}</p>
                <div style="display: flex; flex-direction: column; gap: 6px;">
                  ${(q.choices || []).map((ch, cIdx) => `
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 6px 10px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 13px;">
                      <input type="radio" name="res_q_${idx}" value="${cIdx}">
                      <span>${String.fromCharCode(65 + cIdx)}. ${ch}</span>
                    </label>
                  `).join("")}
                </div>
              </div>
            `).join("")}
            <button type="submit" class="button button-dark" style="margin-top: 10px;">Submit Quiz Answers</button>
          </form>
        `;

        const quizForm = quizPanel.querySelector("#result-quiz-form");
        quizForm.addEventListener("submit", async (e) => {
          e.preventDefault();
          const answers = [];
          for (let i = 0; i < questions.length; i++) {
            const checked = quizForm.querySelector(`input[name="res_q_${i}"]:checked`);
            answers.push(checked ? parseInt(checked.value, 10) : null);
          }

          const subBtn = quizForm.querySelector("button[type='submit']");
          subBtn.disabled = true;
          subBtn.textContent = "Analyzing answers & identifying mistakes...";

          try {
            const submitRes = await fetch(page.dataset.submitUrl || "/quiz/submit", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ answers }),
            });
            const resultData = await submitRes.json();
            if (!submitRes.ok) throw new Error(resultData.error || "Evaluation failed");

            quizPanel.innerHTML = `
              <div class="quiz-score-banner" style="margin-bottom: 16px;">
                <div>
                  <span class="quiz-score-text">Score: ${resultData.score} / ${resultData.total}</span>
                  <p style="margin: 4px 0 0; font-size: 13px; color: #166534;">
                    ${resultData.score >= 4 ? "Great mastery on this topic!" : "Review the targeted mistake remediations below."}
                  </p>
                </div>
              </div>
            `;

            // Update weak topics panel
            if (weakTopicsPanel && resultData.weak_topics) {
              weakTopicsPanel.innerHTML = `
                <div class="weak-heading"><span>◎</span><div><p class="section-kicker">TOPICS TO REVIEW</p><h2>Your Weak Topics</h2></div></div>
                <ul style="padding-left: 20px; margin-top: 8px;">
                  ${resultData.weak_topics.map(t => `<li style="margin-bottom: 4px; font-weight: 600; color: #b91c1c;">${t}</li>`).join("")}
                </ul>
              `;
            }

            // Automatic Mistake Remediation
            if (resultData.remediations && resultData.remediations.length > 0) {
              renderMistakeRemediation(resultData.remediations, quizPanel);
            }
          } catch (err) {
            subBtn.disabled = false;
            subBtn.textContent = "Submit Quiz Answers";
            alert("Could not submit quiz: " + err.message);
          }
        });
      } catch (err) {
        startQuizBtn.disabled = false;
        startQuizBtn.innerHTML = "<span>Take Quiz</span><span class='button-arrow'>↗</span>";
        alert("Quiz error: " + err.message);
      }
    });
  }

  // ============================================================
  // My Learning Dashboard Page Controller
  // ============================================================
  function initMyLearningPage() {
    const savedGrid = document.querySelector("#saved-packages-grid");
    if (!savedGrid) return;

    const countIndicator = document.querySelector("#saved-count-indicator");
    const emptyState = document.querySelector("#empty-saved-state");
    const searchInput = document.querySelector("#learning-search-input");
    const clearSearchBtn = document.querySelector("#clear-search-btn");
    const filterPills = document.querySelectorAll(".filter-pill");

    const viewerModal = document.querySelector("#package-viewer-modal");
    const viewerTitle = document.querySelector("#viewer-title");
    const viewerMeta = document.querySelector("#viewer-meta");
    const viewerContent = document.querySelector("#viewer-content");
    const viewerCopyBtn = document.querySelector("#viewer-copy-btn");
    const closeViewerBtn = document.querySelector("#close-viewer-btn");
    const viewerCloseFooterBtn = document.querySelector("#viewer-close-footer-btn");

    let allPackages = [];
    let activeFilter = "all";
    let searchQuery = "";

    async function loadPackages() {
      try {
        const res = await fetch("/api/saved-packages");
        const data = await res.json();
        allPackages = data.packages || [];
        render();
      } catch (err) {
        if (countIndicator) countIndicator.textContent = "Error loading saved packages.";
      }
    }

    function render() {
      let filtered = allPackages.filter((pkg) => {
        // Category Filter
        if (activeFilter === "notes" && !pkg.content_type.toLowerCase().includes("note")) return false;
        if (activeFilter === "quiz" && !pkg.content_type.toLowerCase().includes("quiz") && !pkg.content_type.toLowerCase().includes("question")) return false;
        if (activeFilter === "timetable" && !pkg.content_type.toLowerCase().includes("timetable") && !pkg.content_type.toLowerCase().includes("schedule")) return false;
        if (activeFilter === "flashcards" && !pkg.content_type.toLowerCase().includes("flashcard")) return false;

        // Search Filter
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const matches =
            (pkg.title && pkg.title.toLowerCase().includes(q)) ||
            (pkg.topic && pkg.topic.toLowerCase().includes(q)) ||
            (pkg.content_type && pkg.content_type.toLowerCase().includes(q)) ||
            (pkg.reply && pkg.reply.toLowerCase().includes(q));
          if (!matches) return false;
        }
        return true;
      });

      if (countIndicator) {
        countIndicator.textContent = `${filtered.length} Saved Package${filtered.length === 1 ? "" : "s"}`;
      }

      savedGrid.innerHTML = "";
      if (filtered.length === 0) {
        if (emptyState) {
          emptyState.hidden = false;
          emptyState.style.display = "flex";
        }
        return;
      }

      if (emptyState) {
        emptyState.hidden = true;
        emptyState.style.display = "none";
      }

      filtered.forEach((pkg) => {
        const card = document.createElement("article");
        card.className = "saved-package-card";

        // Clean snippet without markdown symbols
        const cleanSnippet = pkg.reply
          .replace(/#+\s+/g, "")
          .replace(/[*_`>]/g, "")
          .trim();

        card.innerHTML = `
          <div class="package-card-header">
            <span class="package-topic-pill">${pkg.topic || "General"}</span>
            <span class="package-type-pill">${pkg.content_type || "Study Guide"}</span>
            <span class="package-date">🕒 ${pkg.date || ""}</span>
          </div>
          <h3 class="package-title">${pkg.title || "Study Package"}</h3>
          <p class="package-snippet">${cleanSnippet.slice(0, 160)}${cleanSnippet.length > 160 ? "…" : ""}</p>
          <div class="package-actions">
            <button type="button" class="btn-open-package" data-id="${pkg.id}">
              <span>👁️</span> Open Package
            </button>
            <button type="button" class="btn-delete-package" data-id="${pkg.id}" title="Delete package">
              <span>🗑️</span> Delete
            </button>
          </div>
        `;

        // Wire Open Package
        const openBtn = card.querySelector(".btn-open-package");
        openBtn.addEventListener("click", () => {
          if (viewerTitle) viewerTitle.textContent = pkg.title;
          if (viewerMeta) viewerMeta.textContent = `${pkg.topic} • ${pkg.content_type} • ${pkg.date}`;
          if (viewerContent) viewerContent.innerHTML = formatMarkdown(pkg.reply);
          if (viewerCopyBtn) {
            viewerCopyBtn.dataset.raw = pkg.reply;
            viewerCopyBtn.textContent = "📋 Copy";
          }
          if (viewerModal) viewerModal.showModal();
        });

        // Wire Delete Package
        const deleteBtn = card.querySelector(".btn-delete-package");
        deleteBtn.addEventListener("click", async () => {
          if (!confirm(`Are you sure you want to delete "${pkg.title}"?`)) return;
          try {
            const res = await fetch(`/api/saved-packages/${pkg.id}`, { method: "DELETE" });
            if (res.ok) {
              allPackages = allPackages.filter((p) => p.id !== pkg.id);
              render();
            } else {
              alert("Could not delete package.");
            }
          } catch (err) {
            alert("Delete failed: " + err.message);
          }
        });

        savedGrid.appendChild(card);
      });
    }

    // Search events
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        searchQuery = searchInput.value.trim();
        if (clearSearchBtn) {
          clearSearchBtn.hidden = !searchQuery;
        }
        render();
      });
    }

    if (clearSearchBtn) {
      clearSearchBtn.addEventListener("click", () => {
        if (searchInput) searchInput.value = "";
        searchQuery = "";
        clearSearchBtn.hidden = true;
        render();
      });
    }

    // Filter pill events
    filterPills.forEach((pill) => {
      pill.addEventListener("click", () => {
        filterPills.forEach((p) => p.classList.remove("active"));
        pill.classList.add("active");
        activeFilter = pill.dataset.filter;
        render();
      });
    });

    // Viewer modal close
    if (closeViewerBtn && viewerModal) {
      closeViewerBtn.addEventListener("click", () => viewerModal.close());
    }
    if (viewerCloseFooterBtn && viewerModal) {
      viewerCloseFooterBtn.addEventListener("click", () => viewerModal.close());
    }
    if (viewerModal) {
      viewerModal.addEventListener("click", (e) => {
        if (e.target === viewerModal) viewerModal.close();
      });
    }

    // Viewer copy button
    if (viewerCopyBtn) {
      viewerCopyBtn.addEventListener("click", async () => {
        const text = viewerCopyBtn.dataset.raw || "";
        if (!text) return;
        try {
          await navigator.clipboard.writeText(text);
          viewerCopyBtn.textContent = "✅ Copied!";
          setTimeout(() => {
            viewerCopyBtn.textContent = "📋 Copy";
          }, 2000);
        } catch (e) {
          alert("Could not copy automatically. Please select text and press Ctrl+C.");
        }
      });
    }

    loadPackages();
  }

  // Initialize My Learning page if currently visiting /my-learning
  initMyLearningPage();

  // ============================================================
  // Study History Page Controller
  // ============================================================
  function initHistoryPage() {
    const historyGrid = document.querySelector("#history-items-grid");
    if (!historyGrid) return;

    const countIndicator = document.querySelector("#history-count-indicator");
    const emptyState = document.querySelector("#empty-history-state");
    const searchInput = document.querySelector("#history-search-input");
    const clearSearchBtn = document.querySelector("#clear-history-search-btn");
    const filterPills = document.querySelectorAll(".filter-pill");
    const clearAllBtn = document.querySelector("#clear-all-history-btn");

    const viewerModal = document.querySelector("#history-viewer-modal");
    const viewerTitle = document.querySelector("#history-viewer-title");
    const viewerMeta = document.querySelector("#history-viewer-meta");
    const viewerQuery = document.querySelector("#history-viewer-query");
    const promptBox = document.querySelector("#history-viewer-prompt-box");
    const viewerContent = document.querySelector("#history-viewer-content");
    const viewerCopyBtn = document.querySelector("#history-viewer-copy-btn");
    const closeViewerBtn = document.querySelector("#close-history-viewer-btn");
    const viewerCloseFooterBtn = document.querySelector("#history-viewer-close-footer-btn");
    const viewerContinueChatBtn = document.querySelector("#history-viewer-continue-chat-btn");

    let allHistory = [];
    let activeFilter = "all";
    let searchQuery = "";

    async function loadHistory() {
      try {
        const res = await fetch("/api/history");
        const data = await res.json();
        allHistory = data.history || [];
        render();
      } catch (err) {
        if (countIndicator) countIndicator.textContent = "Error loading study history.";
      }
    }

    function render() {
      let filtered = allHistory.filter((item) => {
        const typeLower = (item.entry_type || "").toLowerCase();
        if (activeFilter === "queries" && !typeLower.includes("query") && !typeLower.includes("chat")) return false;
        if (activeFilter === "packages" && !typeLower.includes("package") && !typeLower.includes("guide") && !typeLower.includes("study")) return false;
        if (activeFilter === "quizzes" && !typeLower.includes("quiz") && !typeLower.includes("question")) return false;
        if (activeFilter === "revisions" && !typeLower.includes("revision") && !typeLower.includes("notes")) return false;
        if (activeFilter === "timetables" && !typeLower.includes("timetable") && !typeLower.includes("schedule")) return false;

        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const matches =
            (item.title && item.title.toLowerCase().includes(q)) ||
            (item.topic && item.topic.toLowerCase().includes(q)) ||
            (item.query && item.query.toLowerCase().includes(q)) ||
            (item.reply && item.reply.toLowerCase().includes(q));
          if (!matches) return false;
        }
        return true;
      });

      if (countIndicator) {
        countIndicator.textContent = `${filtered.length} History Entr${filtered.length === 1 ? "y" : "ies"}`;
      }

      historyGrid.innerHTML = "";
      if (filtered.length === 0) {
        if (emptyState) {
          emptyState.hidden = false;
          emptyState.style.display = "flex";
        }
        return;
      }

      if (emptyState) {
        emptyState.hidden = true;
        emptyState.style.display = "none";
      }

      filtered.forEach((item) => {
        const card = document.createElement("article");
        card.className = "history-card";

        const cleanSnippet = (item.reply || "")
          .replace(/#+\s+/g, "")
          .replace(/[*_`>]/g, "")
          .trim();

        const tLower = (item.entry_type || "").toLowerCase();
        let typeBadgeClass = "badge-blue";
        let typeIcon = "💬";
        if (tLower.includes("package")) { typeBadgeClass = "badge-indigo"; typeIcon = "📚"; }
        else if (tLower.includes("quiz")) { typeBadgeClass = "badge-purple"; typeIcon = "📝"; }
        else if (tLower.includes("revision")) { typeBadgeClass = "badge-amber"; typeIcon = "⏱️"; }
        else if (tLower.includes("timetable")) { typeBadgeClass = "badge-teal"; typeIcon = "📅"; }

        card.innerHTML = `
          <div class="history-card-header">
            <span class="package-topic-pill">${item.topic || "General"}</span>
            <span class="history-type-pill ${typeBadgeClass}">${typeIcon} ${item.entry_type || "Study Query"}</span>
            <span class="package-date">🕒 ${item.date || ""}</span>
          </div>
          ${item.query ? `<div class="history-query-preview"><strong>Q:</strong> "${item.query.slice(0, 140)}${item.query.length > 140 ? "…" : ""}"</div>` : ""}
          <h3 class="package-title">${item.title || "Study Session"}</h3>
          <p class="package-snippet">${cleanSnippet.slice(0, 160)}${cleanSnippet.length > 160 ? "…" : ""}</p>
          <div class="package-actions">
            <button type="button" class="btn-open-package btn-open-history" data-id="${item.id}">
              <span>👁️</span> View Response
            </button>
            <a href="/?topic=${encodeURIComponent(item.topic || '')}" class="btn-continue-chat" title="Continue topic in chat">
              <span>💬</span> In Chat
            </a>
            <button type="button" class="btn-delete-package btn-delete-history" data-id="${item.id}" title="Delete entry">
              <span>🗑️</span>
            </button>
          </div>
        `;

        const openBtn = card.querySelector(".btn-open-history");
        openBtn.addEventListener("click", () => {
          if (viewerTitle) viewerTitle.textContent = item.title;
          if (viewerMeta) viewerMeta.textContent = `${item.topic} • ${item.entry_type} • ${item.date}`;
          if (viewerQuery && promptBox) {
            if (item.query) {
              viewerQuery.textContent = item.query;
              promptBox.hidden = false;
              promptBox.style.display = "block";
            } else {
              promptBox.hidden = true;
              promptBox.style.display = "none";
            }
          }
          if (viewerContent) viewerContent.innerHTML = formatMarkdown(item.reply);
          if (viewerCopyBtn) {
            viewerCopyBtn.dataset.raw = item.reply;
            viewerCopyBtn.textContent = "📋 Copy";
          }
          if (viewerContinueChatBtn) {
            viewerContinueChatBtn.href = `/?topic=${encodeURIComponent(item.topic || '')}`;
          }
          if (viewerModal) viewerModal.showModal();
        });

        const deleteBtn = card.querySelector(".btn-delete-history");
        deleteBtn.addEventListener("click", async () => {
          if (!confirm(`Delete this history entry?`)) return;
          try {
            const res = await fetch(`/api/history/${item.id}`, { method: "DELETE" });
            if (res.ok) {
              allHistory = allHistory.filter((h) => h.id !== item.id);
              render();
            } else {
              alert("Could not delete entry.");
            }
          } catch (err) {
            alert("Delete failed: " + err.message);
          }
        });

        historyGrid.appendChild(card);
      });
    }

    if (searchInput) {
      searchInput.addEventListener("input", () => {
        searchQuery = searchInput.value.trim();
        if (clearSearchBtn) {
          clearSearchBtn.hidden = !searchQuery;
        }
        render();
      });
    }

    if (clearSearchBtn) {
      clearSearchBtn.addEventListener("click", () => {
        if (searchInput) searchInput.value = "";
        searchQuery = "";
        clearSearchBtn.hidden = true;
        render();
      });
    }

    filterPills.forEach((pill) => {
      pill.addEventListener("click", () => {
        filterPills.forEach((p) => p.classList.remove("active"));
        pill.classList.add("active");
        activeFilter = pill.dataset.filter;
        render();
      });
    });

    if (clearAllBtn) {
      clearAllBtn.addEventListener("click", async () => {
        if (!confirm("Are you sure you want to clear your entire study history? This cannot be undone.")) return;
        try {
          const res = await fetch("/api/history", { method: "DELETE" });
          if (res.ok) {
            allHistory = [];
            render();
          } else {
            alert("Could not clear history.");
          }
        } catch (err) {
          alert("Clear failed: " + err.message);
        }
      });
    }

    if (closeViewerBtn && viewerModal) {
      closeViewerBtn.addEventListener("click", () => viewerModal.close());
    }
    if (viewerCloseFooterBtn && viewerModal) {
      viewerCloseFooterBtn.addEventListener("click", () => viewerModal.close());
    }
    if (viewerModal) {
      viewerModal.addEventListener("click", (e) => {
        if (e.target === viewerModal) viewerModal.close();
      });
    }

    if (viewerCopyBtn) {
      viewerCopyBtn.addEventListener("click", async () => {
        const text = viewerCopyBtn.dataset.raw || "";
        if (!text) return;
        try {
          await navigator.clipboard.writeText(text);
          viewerCopyBtn.textContent = "✅ Copied!";
          setTimeout(() => {
            viewerCopyBtn.textContent = "📋 Copy";
          }, 2000);
        } catch (e) {
          alert("Could not copy text automatically.");
        }
      });
    }

    loadHistory();
  }

  // Initialize History page if currently visiting /history
  initHistoryPage();
})();