/* ==========================================================================
   SENIOR APPROVAL CHAT INTERACTIVE LOGIC
   ========================================================================== */

(function () {
  window.VisiQC = window.VisiQC || {};
  const State = window.VisiQC.State;

  // Initial Contacts and messages data
  const ChatState = {
    isOpen: false,
    activeContact: "suvrata",
    currentAttachment: null, // { type: 'image' | 'text', data: string, label: string }
    
    // Messages list for each senior
    messages: {
      suvrata: [
        { sender: "incoming", text: "Hey! Let me know when the copy for the EV campaign is ready.", time: "10:12 AM" }
      ],
      alka: [
        { sender: "incoming", text: "Hi, need the Minecraft ad creative reviewed. Alka needs to sign off on the logo placement.", time: "09:34 AM" }
      ],
      durgesh: [
        { sender: "incoming", text: "Please run the visual audit and send the report once the alignment is corrected.", time: "Yesterday" }
      ]
    },
    
    // Predefined approvals responses for each senior based on attachment type
    approvals: {
      suvrata: {
        text: "I've reviewed the copy and layout details. Looks extremely strong! Approved for the campaign.",
        image: "The balance and grid hierarchy on this creative are spot on. Visual layout approved!"
      },
      alka: {
        text: "Great job! The copy reads perfectly now. Sign-off approved.",
        image: "Logo placement and readability are great. Approved on my end, upload to drive!"
      },
      durgesh: {
        text: "This looks perfect. Go ahead and schedule it.",
        image: "Approved. The visual alignment and contrast scores look excellent."
      }
    }
  };

  // Run on DOM load
  document.addEventListener('DOMContentLoaded', () => {
    initChat();
  });

  function initChat() {
    bindUIEvents();
    renderMessages();
    checkWorkspaceSatisfaction();
    
    // Periodically inspect workspace to toggle panel buttons disabled state
    setInterval(checkWorkspaceSatisfaction, 1000);
  }

  // Poll workspace inputs to see if "Send to Senior" buttons should be enabled
  function checkWorkspaceSatisfaction() {
    // 1. Visual Audit
    const btnSendVisualToSenior = document.getElementById('btnSendVisualToSenior');
    if (btnSendVisualToSenior) {
      if (State && State.state && State.state.currentImageBase64) {
        btnSendVisualToSenior.removeAttribute('disabled');
      } else {
        btnSendVisualToSenior.setAttribute('disabled', 'true');
      }
    }

    // 2. Copy Editor
    const btnSendCopyToSenior = document.getElementById('btnSendCopyToSenior');
    if (btnSendCopyToSenior) {
      const rawText = document.getElementById('rawTextInput');
      const polishedText = document.getElementById('polishedTextOutput');
      const hasText = (rawText && rawText.value.trim().length > 0) || (polishedText && polishedText.textContent.trim().length > 0);
      if (hasText) {
        btnSendCopyToSenior.removeAttribute('disabled');
      } else {
        btnSendCopyToSenior.setAttribute('disabled', 'true');
      }
    }

    // 3. AI Creator
    const btnSendCreatorToSenior = document.getElementById('btnSendCreatorToSenior');
    if (btnSendCreatorToSenior) {
      const creatorCanvas = document.getElementById('creatorCanvas');
      const hasCreatorImg = creatorCanvas && !creatorCanvas.classList.contains('is-empty');
      if (hasCreatorImg) {
        btnSendCreatorToSenior.removeAttribute('disabled');
      } else {
        btnSendCreatorToSenior.setAttribute('disabled', 'true');
      }
    }
  }

  function bindUIEvents() {
    const floatingChatBtn = document.getElementById('floatingChatBtn');
    const chatDrawer = document.getElementById('chatDrawer');
    const closeChatBtn = document.getElementById('closeChatBtn');
    const chatSendBtn = document.getElementById('chatSendBtn');
    const chatMessageInput = document.getElementById('chatMessageInput');
    const contactTabs = document.querySelectorAll('.contact-tab');
    const btnRemoveAttachment = document.getElementById('btnRemoveAttachment');

    // Drawer Toggles
    if (floatingChatBtn && chatDrawer) {
      floatingChatBtn.addEventListener('click', () => {
        chatDrawer.classList.toggle('open');
        ChatState.isOpen = chatDrawer.classList.contains('open');
        
        // Hide notification badge when opened
        const badge = document.getElementById('chatBadge');
        if (badge) badge.style.display = 'none';

        if (ChatState.isOpen) {
          scrollChatToBottom();
          chatMessageInput.focus();
        }
      });
    }

    if (closeChatBtn && chatDrawer) {
      closeChatBtn.addEventListener('click', () => {
        chatDrawer.classList.remove('open');
        ChatState.isOpen = false;
      });
    }

    // Switch active contact tab
    contactTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const nextContact = tab.getAttribute('data-contact');
        if (nextContact === ChatState.activeContact) return;

        contactTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        ChatState.previousContact = ChatState.activeContact;
        ChatState.activeContact = nextContact;
        
        // Dynamically update the message text name reference
        if (chatMessageInput) {
          const prevName = capitalize(ChatState.previousContact);
          const newName = capitalize(ChatState.activeContact);
          let currentText = chatMessageInput.value;
          if (currentText) {
            const regex = new RegExp(`\\b${prevName}\\b`, 'gi');
            chatMessageInput.value = currentText.replace(regex, newName);
          }
          
          // Contextual auto-fill placeholder update
          chatMessageInput.placeholder = `Message ${newName}...`;
          
          // Resize input text box
          autoResizeTextarea();
        }

        renderMessages();
      });
    });

    // Remove Attachment Preview
    if (btnRemoveAttachment) {
      btnRemoveAttachment.addEventListener('click', () => {
        ChatState.currentAttachment = null;
        updateAttachmentPreviewDOM();
      });
    }

    // Send message via button
    if (chatSendBtn) {
      chatSendBtn.addEventListener('click', handleUserSendMessage);
    }

    // Send message via Enter key (Shift+Enter for new line)
    if (chatMessageInput) {
      chatMessageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleUserSendMessage();
        }
      });
      chatMessageInput.addEventListener('input', autoResizeTextarea);
      chatMessageInput.addEventListener('change', autoResizeTextarea);
    }

    // File upload attachment binder
    const chatAttachFileBtn = document.getElementById('chatAttachFileBtn');
    const chatFileInput = document.getElementById('chatFileInput');

    if (chatAttachFileBtn && chatFileInput) {
      chatAttachFileBtn.addEventListener('click', () => {
        chatFileInput.click();
      });

      chatFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          const file = e.target.files[0];
          if (!file.type.startsWith('image/')) {
            alert("Please select an image file.");
            return;
          }

          const reader = new FileReader();
          reader.onload = (event) => {
            ChatState.currentAttachment = {
              type: 'image',
              data: event.target.result,
              label: file.name
            };
            updateAttachmentPreviewDOM();
            
            // Auto fill text to indicate image is attached
            if (chatMessageInput && !chatMessageInput.value.trim()) {
              chatMessageInput.value = `Hi ${capitalize(ChatState.activeContact)}, please review this design creative!`;
            }
          };
          reader.readAsDataURL(file);
        }
      });
    }

    // Bind "Send to Senior" buttons from various panel sections
    // 1. Visual Audit tab button
    const btnSendVisualToSenior = document.getElementById('btnSendVisualToSenior');
    if (btnSendVisualToSenior) {
      btnSendVisualToSenior.addEventListener('click', () => {
        if (State && State.state && State.state.currentImageBase64) {
          ChatState.currentAttachment = {
            type: 'image',
            data: State.state.currentImageBase64,
            label: State.state.currentImageName || 'Visual creative'
          };
          openDrawerWithAttachment(`Hi ${capitalize(ChatState.activeContact)}, I've run the Visual Audit on this layout. Ready for approval!`);
        }
      });
    }

    // 2. Copy Editor tab button
    const btnSendCopyToSenior = document.getElementById('btnSendCopyToSenior');
    if (btnSendCopyToSenior) {
      btnSendCopyToSenior.addEventListener('click', () => {
        const rawText = document.getElementById('rawTextInput');
        const polishedText = document.getElementById('polishedTextOutput');
        let textToSend = '';
        
        if (polishedText && polishedText.textContent.trim().length > 0 && polishedText.textContent !== "Polished text will appear here...") {
          textToSend = polishedText.textContent.trim();
        } else if (rawText) {
          textToSend = rawText.value.trim();
        }

        if (textToSend) {
          ChatState.currentAttachment = {
            type: 'text',
            data: textToSend,
            label: 'Polished copy draft'
          };
          openDrawerWithAttachment(`Hi ${capitalize(ChatState.activeContact)}, here is the latest polished ad copy for review.`);
        }
      });
    }

    // 3. AI Creator tab button
    const btnSendCreatorToSenior = document.getElementById('btnSendCreatorToSenior');
    if (btnSendCreatorToSenior) {
      btnSendCreatorToSenior.addEventListener('click', () => {
        const creatorCanvas = document.getElementById('creatorCanvas');
        if (creatorCanvas && !creatorCanvas.classList.contains('is-empty')) {
          const dataUrl = creatorCanvas.toDataURL("image/png");
          ChatState.currentAttachment = {
            type: 'image',
            data: dataUrl,
            label: 'AI Synthesized Creative'
          };
          openDrawerWithAttachment(`Hi ${capitalize(ChatState.activeContact)}, check out this generated design concept. Ready for your sign-off!`);
        }
      });
    }
  }

  // Open drawer, attach and prefill text
  function openDrawerWithAttachment(defaultMessage) {
    const chatDrawer = document.getElementById('chatDrawer');
    const chatMessageInput = document.getElementById('chatMessageInput');
    
    if (chatDrawer) {
      chatDrawer.classList.add('open');
      ChatState.isOpen = true;
    }
    
    updateAttachmentPreviewDOM();
    
    if (chatMessageInput) {
      chatMessageInput.value = defaultMessage;
      chatMessageInput.focus();
      autoResizeTextarea();
    }
    
    scrollChatToBottom();
  }

  // Update attachment preview display in input section
  function updateAttachmentPreviewDOM() {
    const container = document.getElementById('chatAttachmentPreview');
    const body = document.getElementById('attachmentBody');
    if (!container || !body) return;

    if (ChatState.currentAttachment) {
      container.classList.remove('hidden');
      body.innerHTML = '';

      if (ChatState.currentAttachment.type === 'image') {
        const img = document.createElement('img');
        img.src = ChatState.currentAttachment.data;
        img.className = 'attachment-preview-img';
        body.appendChild(img);
      } else {
        const div = document.createElement('div');
        div.className = 'attachment-preview-text';
        div.textContent = ChatState.currentAttachment.data;
        body.appendChild(div);
      }
    } else {
      container.classList.add('hidden');
      body.innerHTML = '';
    }
  }

  // Handle message sending by user
  function handleUserSendMessage() {
    const chatMessageInput = document.getElementById('chatMessageInput');
    if (!chatMessageInput) return;

    const text = chatMessageInput.value.trim();
    if (!text && !ChatState.currentAttachment) return; // nothing to send

    const time = new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    const message = {
      sender: "outgoing",
      text: text,
      time: time
    };

    if (ChatState.currentAttachment) {
      message.attachment = {
        type: ChatState.currentAttachment.type,
        data: ChatState.currentAttachment.data,
        label: ChatState.currentAttachment.label
      };
    }

    // Add to message log
    ChatState.messages[ChatState.isOpen ? ChatState.activeContact : 'suvrata'].push(message);
    
    // Clear Input
    chatMessageInput.value = '';
    const chatFileInput = document.getElementById('chatFileInput');
    if (chatFileInput) chatFileInput.value = '';
    
    autoResizeTextarea();
    
    const attachmentSent = ChatState.currentAttachment;
    ChatState.currentAttachment = null;
    updateAttachmentPreviewDOM();
    
    renderMessages();
    scrollChatToBottom();

    // Trigger mock response from Senior
    if (attachmentSent || text.toLowerCase().includes('approve') || text.toLowerCase().includes('review') || text.toLowerCase().includes('check')) {
      triggerMockSeniorResponse(ChatState.activeContact, attachmentSent);
    }
  }

  // Simulate typing & mock reply
  function triggerMockSeniorResponse(contact, attachmentObj) {
    const chatLog = document.getElementById('chatLog');
    if (!chatLog) return;

    // Show Typing Indicator
    setTimeout(() => {
      const indicator = document.createElement('div');
      indicator.className = 'typing-indicator';
      indicator.id = 'typingIndicator';
      
      const capitalizedName = capitalize(contact);
      indicator.innerHTML = `
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span>${capitalizedName} is typing...</span>
      `;
      chatLog.appendChild(indicator);
      scrollChatToBottom();

      // Trigger Response after 2.2 seconds
      setTimeout(() => {
        // Remove typing indicator
        const indEl = document.getElementById('typingIndicator');
        if (indEl) indEl.remove();

        // Get reply text based on attachment context
        let replyText = "";
        const defaultApprovals = ChatState.approvals[contact];
        if (attachmentObj) {
          replyText = attachmentObj.type === 'image' ? defaultApprovals.image : defaultApprovals.text;
        } else {
          replyText = `Thanks for the update. Let me review and I'll let you know!`;
        }

        const replyTime = new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        const replyMessage = {
          sender: "incoming",
          text: replyText,
          time: replyTime
        };

        // Push reply to state
        ChatState.messages[contact].push(replyMessage);
        
        // Re-render
        renderMessages();
        scrollChatToBottom();

        // Trigger Notification Toast if chat drawer is closed or if user is on another contact
        if (!ChatState.isOpen || ChatState.activeContact !== contact) {
          triggerNotificationBadge(contact, replyText);
        } else {
          // Play mock chime notification or show a micro toast
          showHolographicToast(capitalize(contact), replyText);
        }
      }, 2000);
    }, 1000);
  }

  // Show notification badge on FAB
  function triggerNotificationBadge(contact, text) {
    const badge = document.getElementById('chatBadge');
    if (badge) {
      badge.textContent = '1';
      badge.style.display = 'flex';
      badge.classList.add('pulse');
    }
    showHolographicToast(capitalize(contact), text);
  }

  // Render a visual floating toast
  function showHolographicToast(sender, text) {
    // Check if a toast is already shown, remove it
    const existing = document.querySelector('.chat-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'chat-toast';
    toast.innerHTML = `
      <div class="toast-header">
        <span class="material-symbols-outlined">forum</span>
        <span>Approved Chat from ${sender}</span>
      </div>
      <div class="toast-body">${text}</div>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 50);
    
    // Auto remove
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, 4500);
  }

  // Render message log
  function renderMessages() {
    const chatLog = document.getElementById('chatLog');
    if (!chatLog) return;

    chatLog.innerHTML = '';
    const activeMessages = ChatState.messages[ChatState.activeContact];

    activeMessages.forEach(msg => {
      const bubble = document.createElement('div');
      bubble.className = `message-bubble ${msg.sender}`;
      
      let attachmentHTML = '';
      if (msg.attachment) {
        if (msg.attachment.type === 'image') {
          attachmentHTML = `
            <div class="chat-message-attachment">
              <img src="${msg.attachment.data}" class="attachment-thumbnail-img" alt="${msg.attachment.label}">
            </div>
          `;
        } else {
          attachmentHTML = `
            <div class="chat-message-attachment">
              <div class="attachment-text-snippet">${escapeHtml(msg.attachment.data)}</div>
            </div>
          `;
        }
      }

      bubble.innerHTML = `
        <div class="message-text">${msg.text}</div>
        ${attachmentHTML}
        <span class="message-meta">${msg.time}</span>
      `;
      chatLog.appendChild(bubble);
    });

    scrollChatToBottom();
  }

  // Helper scroll
  function scrollChatToBottom() {
    const chatLog = document.getElementById('chatLog');
    if (chatLog) {
      chatLog.scrollTop = chatLog.scrollHeight;
    }
  }

  // Helpers
  function autoResizeTextarea() {
    const chatMessageInput = document.getElementById('chatMessageInput');
    if (!chatMessageInput) return;
    chatMessageInput.style.height = 'auto';
    const newHeight = Math.min(Math.max(chatMessageInput.scrollHeight, 38), 100);
    chatMessageInput.style.height = newHeight + 'px';
  }

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
  }
})();
