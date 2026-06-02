/* ==========================================================================
   VISIQC INTERFACE EVENT BINDERS & VIEW CONTROLLERS
   ========================================================================== */

(function () {
  // Establish namespace
  window.VisiQC = window.VisiQC || {};

  const State = window.VisiQC.State;
  const Api = window.VisiQC.Api;
  const Render = window.VisiQC.Render;

  let activeNeuralScanner = null;
  let assignmentRefImageBase64 = null;
  let assignmentRefImageName = '';

  // --- AI NEURAL SCANNER CANVAS ANIMATION ENGINE ---
  class NeuralScanner {
    constructor(canvasId, overlayId) {
      this.canvas = document.getElementById(canvasId);
      this.overlay = document.getElementById(overlayId);
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext('2d');
      this.animationFrameId = null;
      this.nodes = [];
      this.numNodes = 30;
      this.gazeTargets = [];
      this.numGazeTargets = 3;
      this.sweepY = 0;
      this.time = 0;
      
      this.resize = this.resize.bind(this);
      window.addEventListener('resize', this.resize);
      this.resize();
    }

    resize() {
      if (!this.canvas || !this.overlay) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = this.overlay.getBoundingClientRect();
      this.canvas.width = rect.width * dpr;
      this.canvas.height = rect.height * dpr;
      this.canvas.style.width = rect.width + 'px';
      this.canvas.style.height = rect.height + 'px';
      this.ctx.scale(dpr, dpr);
      this.width = rect.width;
      this.height = rect.height;
      this.initNodes();
    }

    initNodes() {
      this.nodes = [];
      for (let i = 0; i < this.numNodes; i++) {
        this.nodes.push({
          x: Math.random() * this.width,
          y: Math.random() * this.height,
          vx: (Math.random() - 0.5) * 0.7,
          vy: (Math.random() - 0.5) * 0.7,
          radius: Math.random() * 2 + 1,
          pulsePhase: Math.random() * Math.PI * 2,
          pulseSpeed: 0.02 + Math.random() * 0.03,
          brightness: 0.2 + Math.random() * 0.8,
          color: i % 3 === 0 ? 'rgba(0, 243, 255, ' : (i % 3 === 1 ? 'rgba(234, 88, 12, ' : 'rgba(124, 58, 237, ')
        });
      }

      this.gazeTargets = [];
      const labels = ["OCR_DETECT", "GRID_COMPLIANCE", "PALETTE_CHECK", "CTA_ISOLATOR", "BAL_INTEGRITY"];
      for (let i = 0; i < this.numGazeTargets; i++) {
        this.gazeTargets.push({
          x: Math.random() * this.width,
          y: Math.random() * this.height,
          tx: Math.random() * this.width,
          ty: Math.random() * this.height,
          speed: 0.008 + Math.random() * 0.012,
          size: 14 + Math.random() * 12,
          label: labels[i % labels.length]
        });
      }
    }

    start() {
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
      }
      this.resize();
      this.initNodes();
      this.time = 0;
      this.tick();
    }

    stop() {
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
      window.removeEventListener('resize', this.resize);
      if (this.ctx) {
        this.ctx.clearRect(0, 0, this.width, this.height);
      }
    }

    tick() {
      this.update();
      this.draw();
      this.animationFrameId = requestAnimationFrame(() => this.tick());
    }

    update() {
      this.time += 1;
      
      const sweepPhase = (this.time * 0.026) % (Math.PI * 2);
      const offset = 80;
      this.sweepY = ((Math.sin(sweepPhase - Math.PI / 2) + 1) / 2) * (this.height + offset) - offset / 2;

      // Update nodes
      for (let node of this.nodes) {
        node.x += node.vx;
        node.y += node.vy;
        node.pulsePhase += node.pulseSpeed;

        if (node.x < 0 || node.x > this.width) node.vx *= -1;
        if (node.y < 0 || node.y > this.height) node.vy *= -1;
      }

      // Update gaze targets
      for (let target of this.gazeTargets) {
        target.x += (target.tx - target.x) * target.speed;
        target.y += (target.ty - target.y) * target.speed;

        const dist = Math.hypot(target.tx - target.x, target.ty - target.y);
        if (dist < 15) {
          target.tx = Math.random() * this.width;
          target.ty = Math.random() * this.height;
          target.speed = 0.008 + Math.random() * 0.012;
        }
      }
    }

    draw() {
      if (!this.ctx) return;
      this.ctx.clearRect(0, 0, this.width, this.height);

      // 1. Draw neural mesh connection lines
      this.ctx.lineWidth = 0.5;
      for (let i = 0; i < this.nodes.length; i++) {
        const nodeA = this.nodes[i];
        for (let j = i + 1; j < this.nodes.length; j++) {
          const nodeB = this.nodes[j];
          const dist = Math.hypot(nodeA.x - nodeB.x, nodeA.y - nodeB.y);

          if (dist < 100) {
            const alpha = (1 - dist / 100) * 0.12;
            this.ctx.strokeStyle = nodeA.color + alpha + ')';
            this.ctx.beginPath();
            this.ctx.moveTo(nodeA.x, nodeA.y);
            this.ctx.lineTo(nodeB.x, nodeB.y);
            this.ctx.stroke();

            // Trace packet dots occasionally
            if ((this.time + i * 7) % 180 < 40) {
              const progress = ((this.time + i * 7) % 180) / 40;
              const px = nodeA.x + (nodeB.x - nodeA.x) * progress;
              const py = nodeA.y + (nodeB.y - nodeA.y) * progress;
              this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
              this.ctx.beginPath();
              this.ctx.arc(px, py, 1.2, 0, Math.PI * 2);
              this.ctx.fill();
            }
          }
        }
      }

      // 2. Draw nodes
      for (let node of this.nodes) {
        const sizePulse = Math.sin(node.pulsePhase) * 1.2;
        const r = Math.max(0.5, node.radius + sizePulse);
        const alpha = node.brightness * (0.3 + Math.sin(node.pulsePhase) * 0.15);

        this.ctx.fillStyle = node.color + alpha + ')';
        this.ctx.beginPath();
        this.ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.strokeStyle = node.color + (alpha * 0.2) + ')';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(node.x, node.y, r * 2.2, 0, Math.PI * 2);
        this.ctx.stroke();
      }

      // 3. Central core
      const coreX = this.width / 2;
      const coreY = this.height / 2;
      const corePulse = 18 + Math.sin(this.time * 0.035) * 3;

      this.ctx.strokeStyle = 'rgba(124, 58, 237, 0.12)';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.arc(coreX, coreY, corePulse * 1.8, 0, Math.PI * 2);
      this.ctx.stroke();

      const radGrad = this.ctx.createRadialGradient(coreX, coreY, 2, coreX, coreY, corePulse);
      radGrad.addColorStop(0, 'rgba(0, 243, 255, 0.75)');
      radGrad.addColorStop(0.3, 'rgba(124, 58, 237, 0.45)');
      radGrad.addColorStop(0.7, 'rgba(234, 88, 12, 0.18)');
      radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      this.ctx.fillStyle = radGrad;
      this.ctx.beginPath();
      this.ctx.arc(coreX, coreY, corePulse, 0, Math.PI * 2);
      this.ctx.fill();

      // 4. Draw Wander Gaze focal reticles
      this.ctx.font = "8px 'Fira Code', monospace";
      for (let i = 0; i < this.gazeTargets.length; i++) {
        const target = this.gazeTargets[i];
        const colorHex = i === 0 ? 'rgba(0, 243, 255, ' : (i === 1 ? 'rgba(234, 88, 12, ' : 'rgba(124, 58, 237, ');
        const mainColor = i === 0 ? '#00f3ff' : (i === 1 ? '#ea580c' : '#7c3aed');

        // Radar line
        const rPulse = target.size + Math.sin(this.time * 0.04 + i) * 2.5;
        this.ctx.strokeStyle = colorHex + '0.35)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(target.x, target.y, rPulse, 0, Math.PI * 2);
        this.ctx.stroke();

        this.ctx.setLineDash([2, 3]);
        this.ctx.beginPath();
        this.ctx.arc(target.x, target.y, Math.max(2, rPulse - 4), 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        // Center dot
        this.ctx.fillStyle = mainColor;
        this.ctx.beginPath();
        this.ctx.arc(target.x, target.y, 2, 0, Math.PI * 2);
        this.ctx.fill();

        // Corners
        const offset = 6;
        const cornerLen = 4;
        this.ctx.strokeStyle = mainColor;
        this.ctx.lineWidth = 1;
        
        // Top left
        this.ctx.beginPath();
        this.ctx.moveTo(target.x - offset, target.y - offset + cornerLen);
        this.ctx.lineTo(target.x - offset, target.y - offset);
        this.ctx.lineTo(target.x - offset + cornerLen, target.y - offset);
        this.ctx.stroke();
        // Top right
        this.ctx.beginPath();
        this.ctx.moveTo(target.x + offset - cornerLen, target.y - offset);
        this.ctx.lineTo(target.x + offset, target.y - offset);
        this.ctx.lineTo(target.x + offset, target.y - offset + cornerLen);
        this.ctx.stroke();
        // Bottom left
        this.ctx.beginPath();
        this.ctx.moveTo(target.x - offset, target.y + offset - cornerLen);
        this.ctx.lineTo(target.x - offset, target.y + offset);
        this.ctx.lineTo(target.x - offset + cornerLen, target.y + offset);
        this.ctx.stroke();
        // Bottom right
        this.ctx.beginPath();
        this.ctx.moveTo(target.x + offset - cornerLen, target.y + offset);
        this.ctx.lineTo(target.x + offset, target.y + offset);
        this.ctx.lineTo(target.x + offset, target.y + offset - cornerLen);
        this.ctx.stroke();

        // Gaze line from core
        this.ctx.strokeStyle = colorHex + '0.06)';
        this.ctx.lineWidth = 1.2;
        this.ctx.beginPath();
        this.ctx.moveTo(coreX, coreY);
        this.ctx.lineTo(target.x, target.y);
        this.ctx.stroke();

        // Info text labels
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        this.ctx.fillText(`[${target.label}]`, target.x + offset + 4, target.y - 4);
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        const calcVal = Math.round(75 + Math.sin(this.time * 0.015 + i) * 24);
        this.ctx.fillText(`X:${Math.round((target.x/this.width)*100)}% Y:${Math.round((target.y/this.height)*100)}%`, target.x + offset + 4, target.y + 4);
        this.ctx.fillText(`VAL:${calcVal}%`, target.x + offset + 4, target.y + 12);
      }

      // 5. Sweep laser line details
      if (this.sweepY >= 0 && this.sweepY <= this.height) {
        const sweepGrad = this.ctx.createLinearGradient(0, this.sweepY, this.width, this.sweepY);
        sweepGrad.addColorStop(0, 'rgba(234, 88, 12, 0.05)');
        sweepGrad.addColorStop(0.15, 'rgba(0, 243, 255, 0.25)');
        sweepGrad.addColorStop(0.5, '#ff4500');
        sweepGrad.addColorStop(0.85, 'rgba(0, 243, 255, 0.25)');
        sweepGrad.addColorStop(1, 'rgba(234, 88, 12, 0.05)');

        this.ctx.strokeStyle = sweepGrad;
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.sweepY);
        this.ctx.lineTo(this.width, this.sweepY);
        this.ctx.stroke();

        // Oscilloscope waveform trace
        this.ctx.strokeStyle = 'rgba(255, 69, 0, 0.7)';
        this.ctx.lineWidth = 0.8;
        this.ctx.beginPath();
        for (let x = 0; x < this.width; x += 4) {
          const distToCenter = Math.abs(x - this.width / 2);
          const weight = Math.max(0, 1 - distToCenter / (this.width * 0.45));
          const wave = Math.sin(x * 0.07 + this.time * 0.12) * 5.5 * weight;
          if (x === 0) {
            this.ctx.moveTo(x, this.sweepY + wave);
          } else {
            this.ctx.lineTo(x, this.sweepY + wave);
          }
        }
        this.ctx.stroke();

        // Telemetry details along sweep
        this.ctx.fillStyle = '#ff4500';
        this.ctx.fillText(`SWEEP_SCAN // POS_Y: ${Math.round(this.sweepY)}px`, 12, this.sweepY - 6);
        this.ctx.fillStyle = 'rgba(0, 243, 255, 0.7)';
        const percent = Math.min(100, Math.round((this.sweepY / this.height) * 100));
        this.ctx.fillText(`ENGINE_INSPECTION_LOAD: ${Math.round(38 + Math.sin(this.time * 0.012) * 18)}% // COREL: ${percent}%`, this.width - 230, this.sweepY - 6);

        // Nodes sparks
        for (let node of this.nodes) {
          if (Math.abs(node.y - this.sweepY) < 14) {
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
            this.ctx.lineWidth = 0.5;
            this.ctx.beginPath();
            this.ctx.moveTo(node.x, node.y);
            this.ctx.lineTo(node.x, this.sweepY);
            this.ctx.stroke();

            this.ctx.fillStyle = '#ffffff';
            this.ctx.beginPath();
            this.ctx.arc(node.x, this.sweepY, 1.5, 0, Math.PI * 2);
            this.ctx.fill();
          }
        }
      }
    }
  }

  // --- CORE UI CONTROLLER ---
  function initUi() {
    initMouseInteractions();
    bindSettingsModal();
    bindWorkspaceSelectors();
    bindClientModal();
    bindProjectModal();
    bindVisualAuditPanel();
    bindCopyEditorPanel();
    bindB2BResearchPanel();
    bindAssignmentsPanel();
    bindExports();
    
    // Perform initial workspace render
    reloadWorkspace();
  }

  // --- WORKSPACE RELOAD COORDINATOR ---
  function reloadWorkspace() {
    const clients = State.getClients();
    const activeClientId = State.state.activeClientId;
    
    // Render clients dropdowns
    Render.renderClientsDropdown(clients, activeClientId);
    Render.renderAssignmentsFormDropdowns(clients);
    
    // Get projects for active client
    const projects = State.getProjects(activeClientId);
    const activeProjectId = State.state.activeProjectId;
    
    // Render projects dropdown
    Render.renderProjectsDropdown(projects, activeProjectId);
    
    // Render Active Project Details (description + design thinking)
    const activeProjObj = State.getProject(activeProjectId);
    Render.renderDesignThinkingList(activeProjObj);
    
    // Render filtered history
    const history = State.getFilteredHistory();
    Render.renderHistory(
      history, 
      State.state.activeHistoryId, 
      loadHistoryItem, 
      deleteHistoryItem
    );
    
    // Hide/Show delete workspace actions based on active defaults
    const btnDelClient = document.getElementById('btnDeleteClient');
    const btnDelProj = document.getElementById('btnDeleteProject');
    if (btnDelClient) {
      btnDelClient.style.display = (activeClientId === 'default_client') ? 'none' : 'inline-flex';
    }
    if (btnDelProj) {
      btnDelProj.style.display = (activeProjectId === 'default_project') ? 'none' : 'inline-flex';
    }
    
    // Refresh assignments queue
    refreshAssignmentsList();

    // Reset panels visual states on client/project swap
    resetVisualState();
  }

  // Reload project-level data only
  function reloadProjectWorkspace() {
    const activeProjectId = State.state.activeProjectId;
    const activeProjObj = State.getProject(activeProjectId);
    Render.renderDesignThinkingList(activeProjObj);
    
    const history = State.getFilteredHistory();
    Render.renderHistory(
      history, 
      State.state.activeHistoryId, 
      loadHistoryItem, 
      deleteHistoryItem
    );
    
    // Hide/Show delete project button based on default selector context
    const btnDelProj = document.getElementById('btnDeleteProject');
    if (btnDelProj) {
      btnDelProj.style.display = (activeProjectId === 'default_project') ? 'none' : 'inline-flex';
    }
    
    resetVisualState();
  }

  function resetVisualState() {
    const elements = getDomElements();
    
    // Clear preview image base64 if not loaded from history
    State.state.currentImageBase64 = null;
    State.state.currentImageMimeType = null;
    State.state.currentImageName = '';
    
    if (elements.fileInput) elements.fileInput.value = '';
    if (elements.previewImage) elements.previewImage.src = '';
    if (elements.imgDimensions) elements.imgDimensions.textContent = '0 x 0 px';
    
    if (elements.previewContainer) elements.previewContainer.classList.add('hidden');
    if (elements.uploadPlaceholder) elements.uploadPlaceholder.classList.remove('hidden');
    if (elements.analyzeBtn) elements.analyzeBtn.setAttribute('disabled', 'true');
    if (elements.resetBtn) elements.resetBtn.setAttribute('disabled', 'true');
    
    if (elements.stateResults) elements.stateResults.classList.add('hidden');
    if (elements.stateAnalyzing) elements.stateAnalyzing.classList.add('hidden');
    if (elements.stateReady) elements.stateReady.classList.remove('hidden');
    if (elements.qcScoreBadge) {
      elements.qcScoreBadge.textContent = 'READY';
      elements.qcScoreBadge.className = 'badge';
    }
    
    State.state.activeHistoryId = null;
    window.currentRawCritique = "";
    if (activeNeuralScanner) activeNeuralScanner.stop();
  }

  // --- MOUSE SPOTLIGHT GLOW GLIDER ---
  function initMouseInteractions() {
    const spotlight = document.getElementById('bg-spotlight');
    const gridGlowSpotlight = document.getElementById('grid-glow-spotlight');
    
    let targetX = window.innerWidth / 2, targetY = window.innerHeight / 2;
    let currentSpotlightX = targetX, currentSpotlightY = targetY;
    
    document.addEventListener('mousemove', (e) => {
      targetX = e.clientX;
      targetY = e.clientY;
      
      const shiftX = (e.clientX / window.innerWidth - 0.5) * -24;
      const shiftY = (e.clientY / window.innerHeight - 0.5) * -24;
      
      document.body.style.setProperty('--bg-shift-x', `${shiftX}px`);
      document.body.style.setProperty('--bg-shift-y', `${shiftY}px`);
    });
    
    const updateSpotlights = () => {
      currentSpotlightX += (targetX - currentSpotlightX) * 0.08;
      currentSpotlightY += (targetY - currentSpotlightY) * 0.08;
      
      if (spotlight) {
        spotlight.style.transform = `translate3d(${currentSpotlightX}px, ${currentSpotlightY}px, 0px) translate(-50%, -50%)`;
      }
      if (gridGlowSpotlight) {
        gridGlowSpotlight.style.transform = `translate3d(${currentSpotlightX + 40 - 250}px, ${currentSpotlightY + 40 - 250}px, 0px)`;
      }
      
      requestAnimationFrame(updateSpotlights);
    };
    updateSpotlights();
    
    // Handle glare dynamic tracking coords
    document.addEventListener('mousemove', (e) => {
      const card = e.target.closest('.report-summary-card, .report-accordion, .history-item, .reference-card');
      if (card) {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
      }
      
      const topBar = e.target.closest('.top-bar');
      if (topBar) {
        const rect = topBar.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        topBar.style.setProperty('--top-bar-mouse-x', `${x}px`);
        topBar.style.setProperty('--top-bar-mouse-y', `${y}px`);
      }
    });
  }

  // --- SETTINGS CONFIG MODAL ---
  function bindSettingsModal() {
    const el = getDomElements();
    
    el.connectionTypeSelect.addEventListener('change', (e) => {
      const mode = e.target.value;
      if (mode === 'gemini') {
        el.geminiOptionsGroup.classList.remove('hidden');
        el.ollamaOptionsGroup.classList.add('hidden');
      } else {
        el.geminiOptionsGroup.classList.add('hidden');
        el.ollamaOptionsGroup.classList.remove('hidden');
      }
    });

    el.settingsBtn.addEventListener('click', () => {
      el.connectionTypeSelect.value = State.state.connectionType;
      el.apiKeyInput.value = State.state.apiKey;
      el.ollamaModelInput.value = State.state.ollamaModel;
      el.customInstructions.value = State.state.customInstructions;
      el.connectionTestStatus.textContent = '';
      el.connectionTestStatus.className = 'test-status-label';
      
      if (State.state.connectionType === 'gemini') {
        el.geminiOptionsGroup.classList.remove('hidden');
        el.ollamaOptionsGroup.classList.add('hidden');
      } else {
        el.geminiOptionsGroup.classList.add('hidden');
        el.ollamaOptionsGroup.classList.remove('hidden');
      }
      
      el.settingsModal.classList.remove('hidden');
    });

    const closeSettings = () => el.settingsModal.classList.add('hidden');
    el.closeSettingsBtn.addEventListener('click', closeSettings);
    el.cancelSettingsBtn.addEventListener('click', closeSettings);

    el.saveSettingsBtn.addEventListener('click', () => {
      const mode = el.connectionTypeSelect.value;
      const key = el.apiKeyInput.value.trim();
      const model = el.ollamaModelInput.value.trim() || 'llava';
      const inst = el.customInstructions.value.trim();
      
      State.state.connectionType = mode;
      State.state.apiKey = key;
      State.state.ollamaModel = model;
      State.state.customInstructions = inst;
      
      localStorage.setItem('visiqc_connection_type', mode);
      localStorage.setItem('visiqc_api_key', key);
      localStorage.setItem('visiqc_ollama_model', model);
      localStorage.setItem('visiqc_custom_instructions', inst);
      
      if (mode === 'gemini') {
        el.modelSelector.removeAttribute('disabled');
        updateStatusIndicator(!!key, key ? "Engine active (Gemini Cloud)." : "Engine inactive. Key required.");
      } else {
        el.modelSelector.setAttribute('disabled', 'true');
        updateStatusIndicator(true, `Engine active (Local Ollama: ${model}).`);
      }
      
      closeSettings();
    });

    el.toggleApiKeyVisible.addEventListener('click', () => {
      if (el.apiKeyInput.type === 'password') {
        el.apiKeyInput.type = 'text';
        el.keyVisIcon.textContent = 'visibility_off';
      } else {
        el.apiKeyInput.type = 'password';
        el.keyVisIcon.textContent = 'visibility';
      }
    });

    el.testConnectionBtn.addEventListener('click', async () => {
      const mode = el.connectionTypeSelect.value;
      showTestStatus("Connecting...", "loading");
      
      if (mode === 'gemini') {
        const testKey = el.apiKeyInput.value.trim();
        if (!testKey) {
          showTestStatus("Please enter a key first", "error");
          return;
        }
        
        try {
          const selectedModel = el.modelSelector.value;
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${testKey}`;
          const response = await Api.fetchWithRetry(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: "Confirm connection in 3 words." }] }] })
          });
          
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          showTestStatus("Connection success!", "success");
        } catch (err) {
          showTestStatus(`Failed: ${err.message}`, "error");
        }
      } else {
        const testModel = el.ollamaModelInput.value.trim() || 'llava';
        try {
          const response = await fetch("http://localhost:11434/api/tags");
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const data = await response.json();
          if (data.models && data.models.some(m => m.name.toLowerCase().startsWith(testModel.toLowerCase()))) {
            showTestStatus(`Success! '${testModel}' is ready.`, "success");
          } else {
            showTestStatus(`Ollama runs, but '${testModel}' is not downloaded.`, "error");
          }
        } catch (err) {
          showTestStatus(`Failed: Ollama daemon offline (${err.message})`, "error");
        }
      }
    });

    function showTestStatus(msg, type) {
      el.connectionTestStatus.textContent = msg;
      el.connectionTestStatus.className = `test-status-label ${type}`;
    }
  }

  function updateStatusIndicator(isActive, text) {
    const dot = document.getElementById('apiStatusDot');
    const label = document.getElementById('apiStatusText');
    if (dot) dot.className = isActive ? 'pulse-dot active' : 'pulse-dot warning';
    if (label) label.textContent = text;
  }

  // --- CLIENT & PROJECT SWITCHERS ---
  function bindWorkspaceSelectors() {
    const clientSelect = document.getElementById('clientSelector');
    const projectSelect = document.getElementById('projectSelector');
    const btnDeleteClient = document.getElementById('btnDeleteClient');
    const btnDeleteProject = document.getElementById('btnDeleteProject');
    
    if (clientSelect) {
      clientSelect.addEventListener('change', (e) => {
        State.state.activeClientId = e.target.value;
        
        // Grab first project of new client
        const projects = State.getProjects(e.target.value);
        State.state.activeProjectId = projects.length > 0 ? projects[0].id : 'default_project';
        
        State.saveActiveState();
        reloadWorkspace();
      });
    }
    
    if (projectSelect) {
      projectSelect.addEventListener('change', (e) => {
        State.state.activeProjectId = e.target.value;
        State.saveActiveState();
        reloadProjectWorkspace();
      });
    }

    // Brand deletion event hook
    if (btnDeleteClient) {
      btnDeleteClient.addEventListener('click', () => {
        const activeClientId = State.state.activeClientId;
        if (activeClientId === 'default_client') return;
        
        const clientObj = State.getClient(activeClientId);
        const clientName = clientObj ? clientObj.name : 'this brand';
        
        const confirmed = confirm(`Are you sure you want to delete Brand Workspace "${clientName}"?\n\nWARNING: This will permanently delete all associated campaign projects, design reference boards, and visual audit histories!`);
        if (confirmed) {
          State.deleteClient(activeClientId);
          reloadWorkspace();
        }
      });
    }

    // Project deletion event hook
    if (btnDeleteProject) {
      btnDeleteProject.addEventListener('click', () => {
        const activeProjectId = State.state.activeProjectId;
        if (activeProjectId === 'default_project') return;
        
        const projectObj = State.getProject(activeProjectId);
        const projectName = projectObj ? projectObj.name : 'this project';
        
        const confirmed = confirm(`Are you sure you want to delete Campaign Project "${projectName}"?\n\nWARNING: This will permanently delete all its design reference boards and visual audit histories!`);
        if (confirmed) {
          State.deleteProject(activeProjectId);
          reloadWorkspace();
        }
      });
    }
  }

  // --- CLIENT MODAL SETUP & LIST ROW ADDERS ---
  function bindClientModal() {
    const btnOpen = document.getElementById('btnOpenClientModal');
    const modal = document.getElementById('clientModal');
    const btnClose = document.getElementById('btnCloseClientModal');
    const btnCancel = document.getElementById('btnCancelClientModal');
    const btnSave = document.getElementById('btnSaveClient');
    
    // Add Row Handlers
    const btnAddColor = document.getElementById('btnAddColorRow');
    const btnAddFont = document.getElementById('btnAddFontRow');
    const colorsList = document.getElementById('modalColorsList');
    const fontsList = document.getElementById('modalFontsList');

    if (btnOpen) {
      btnOpen.addEventListener('click', () => {
        // Reset form inputs
        document.getElementById('clientNameInput').value = '';
        document.getElementById('clientGuidelinesInput').value = '';
        document.getElementById('clientLogoRulesInput').value = '';
        document.getElementById('clientCtaRulesInput').value = '';
        colorsList.innerHTML = '';
        fontsList.innerHTML = '';
        
        modal.classList.remove('hidden');
      });
    }

    const closeClientModal = () => modal.classList.add('hidden');
    if (btnClose) btnClose.addEventListener('click', closeClientModal);
    if (btnCancel) btnCancel.addEventListener('click', closeClientModal);

    // Color list row generator
    if (btnAddColor) {
      btnAddColor.addEventListener('click', () => {
        const row = document.createElement('div');
        row.className = 'form-list-row';
        row.innerHTML = `
          <input type="color" class="color-hex-picker" value="#1b2acf" style="width: 42px; height: 32px; padding: 2px; flex-shrink: 0;">
          <input type="text" class="color-name-input" placeholder="e.g. Primary Blue" style="flex-grow: 1;">
          <button type="button" class="btn-remove-row">
            <span class="material-symbols-outlined">delete</span>
          </button>
        `;
        row.querySelector('.btn-remove-row').addEventListener('click', () => row.remove());
        colorsList.appendChild(row);
      });
    }

    // Font list row generator
    if (btnAddFont) {
      btnAddFont.addEventListener('click', () => {
        const row = document.createElement('div');
        row.className = 'form-list-row';
        row.innerHTML = `
          <input type="text" class="font-family-input" placeholder="e.g. Poppins" style="flex-grow: 1;">
          <input type="text" class="font-usage-input" placeholder="e.g. Headings" style="flex-grow: 1;">
          <button type="button" class="btn-remove-row">
            <span class="material-symbols-outlined">delete</span>
          </button>
        `;
        row.querySelector('.btn-remove-row').addEventListener('click', () => row.remove());
        fontsList.appendChild(row);
      });
    }

    if (btnSave) {
      btnSave.addEventListener('click', () => {
        const name = document.getElementById('clientNameInput').value.trim();
        if (!name) {
          alert('Client name is required.');
          return;
        }

        const guidelines = document.getElementById('clientGuidelinesInput').value.trim();
        const logoRules = document.getElementById('clientLogoRulesInput').value.trim();
        const ctaRules = document.getElementById('clientCtaRulesInput').value.trim();
        
        // Grab dynamic lists
        const colors = [];
        colorsList.querySelectorAll('.form-list-row').forEach(row => {
          const hex = row.querySelector('.color-hex-picker').value;
          const label = row.querySelector('.color-name-input').value.trim() || 'Accent Color';
          colors.push({ hex: hex, name: label });
        });

        const fonts = [];
        fontsList.querySelectorAll('.form-list-row').forEach(row => {
          const family = row.querySelector('.font-family-input').value.trim();
          const usage = row.querySelector('.font-usage-input').value.trim() || 'Body Text';
          if (family) {
            fonts.push({ family: family, usage: usage });
          }
        });

        // Insert new client details into DB
        const newClientId = 'client_' + Date.now();
        State.addClient({
          id: newClientId,
          name: name,
          guidelines: guidelines,
          colors: colors,
          fonts: fonts,
          logoRules: logoRules,
          ctaRules: ctaRules
        });

        State.state.activeClientId = newClientId;
        
        // Automatically seed one empty project for this client so selection runs cleanly
        const projectSeedId = 'project_' + Date.now();
        State.addProject({
          id: projectSeedId,
          clientId: newClientId,
          name: 'First Campaign',
          description: `Core campaign assets and creative deliverables for ${name}.`,
          targetPlatform: 'auto',
          references: []
        });

        State.state.activeProjectId = projectSeedId;
        State.saveActiveState();

        reloadWorkspace();
        closeClientModal();
      });
    }
  }

  // --- PROJECT MODAL SETUP ---
  function bindProjectModal() {
    const btnOpen = document.getElementById('btnOpenProjectModal');
    const modal = document.getElementById('projectModal');
    const btnClose = document.getElementById('btnCloseProjectModal');
    const btnCancel = document.getElementById('btnCancelProjectModal');
    const btnSave = document.getElementById('btnSaveProject');
    
    const btnAddRef = document.getElementById('btnAddRefRow');
    const refsList = document.getElementById('modalRefsList');

    if (btnOpen) {
      btnOpen.addEventListener('click', () => {
        document.getElementById('newProjName').value = '';
        document.getElementById('newProjDesc').value = '';
        document.getElementById('newProjPlatform').value = 'auto';
        refsList.innerHTML = '';
        
        modal.classList.remove('hidden');
      });
    }

    const closeProjectModal = () => modal.classList.add('hidden');
    if (btnClose) btnClose.addEventListener('click', closeProjectModal);
    if (btnCancel) btnCancel.addEventListener('click', closeProjectModal);

    // References list item adder
    if (btnAddRef) {
      btnAddRef.addEventListener('click', () => {
        const row = document.createElement('div');
        row.className = 'form-list-row';
        row.innerHTML = `
          <input type="text" class="ref-title-input" placeholder="Inspiration Title" style="width: 30%;">
          <input type="text" class="ref-note-input" placeholder="Concept description/notes" style="width: 45%;">
          <input type="text" class="ref-url-input" placeholder="URL Link" style="width: 20%;">
          <button type="button" class="btn-remove-row">
            <span class="material-symbols-outlined">delete</span>
          </button>
        `;
        row.querySelector('.btn-remove-row').addEventListener('click', () => row.remove());
        refsList.appendChild(row);
      });
    }

    if (btnSave) {
      btnSave.addEventListener('click', () => {
        const name = document.getElementById('newProjName').value.trim();
        if (!name) {
          alert('Project name is required.');
          return;
        }

        const clientId = document.getElementById('newProjClient').value;
        const description = document.getElementById('newProjDesc').value.trim();
        const platform = document.getElementById('newProjPlatform').value;
        
        const references = [];
        refsList.querySelectorAll('.form-list-row').forEach(row => {
          const title = row.querySelector('.ref-title-input').value.trim();
          const note = row.querySelector('.ref-note-input').value.trim();
          const url = row.querySelector('.ref-url-input').value.trim();
          if (title) {
            references.push({ title: title, note: note, url: url });
          }
        });

        const newProjectId = 'project_' + Date.now();
        State.addProject({
          id: newProjectId,
          clientId: clientId,
          name: name,
          description: description,
          targetPlatform: platform,
          references: references
        });

        // Switch to client and project newly created
        State.state.activeClientId = clientId;
        State.state.activeProjectId = newProjectId;
        State.saveActiveState();

        reloadWorkspace();
        closeProjectModal();
      });
    }
  }

  // --- VISUAL AUDIT AUDITING PANEL CONTROLLER ---
  function bindVisualAuditPanel() {
    const el = getDomElements();

    el.dropZone.addEventListener('click', (e) => {
      if (e.target.closest('#removeImgBtn') || e.target.closest('.preview-info-bar')) return;
      if (!State.state.currentImageBase64 || e.target.closest('#browseBtn')) {
        el.fileInput.click();
      }
    });

    el.fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleImageSelection(e.target.files[0]);
      }
    });

    // Prevent drag/drops defaults globally
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      window.addEventListener(eventName, (e) => e.preventDefault(), false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      el.dropZone.addEventListener(eventName, () => el.dropZone.classList.add('drag-over'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      el.dropZone.addEventListener(eventName, () => el.dropZone.classList.remove('drag-over'), false);
    });

    el.dropZone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      if (dt.files.length > 0) handleImageSelection(dt.files[0]);
    });

    el.removeImgBtn.addEventListener('click', resetVisualUpload);

    el.resetBtn.addEventListener('click', () => {
      resetVisualUpload();
      el.stateResults.classList.add('hidden');
      el.stateAnalyzing.classList.add('hidden');
      el.stateReady.classList.remove('hidden');
      el.qcScoreBadge.textContent = 'READY';
      el.qcScoreBadge.className = 'badge';
      
      const activeCard = document.querySelector('.history-item.active');
      if (activeCard) activeCard.classList.remove('active');
      State.state.activeHistoryId = null;
      
      if (activeNeuralScanner) activeNeuralScanner.stop();
      el.resetBtn.setAttribute('disabled', 'true');
    });

    el.analyzeBtn.addEventListener('click', runVisualAuditPipeline);

    // Persistent listener to display correct image dimensions (handles scaling/history loads safely)
    el.previewImage.onload = () => {
      if (State.state.activeHistoryId) {
        const activeItem = State.state.history.find(h => h.id === State.state.activeHistoryId);
        if (activeItem && activeItem.width && activeItem.height) {
          el.imgDimensions.textContent = `${activeItem.width} x ${activeItem.height} px`;
          return;
        }
      }
      const w = el.previewImage.naturalWidth || el.previewImage.width || 0;
      const h = el.previewImage.naturalHeight || el.previewImage.height || 0;
      if (w > 0 && h > 0) {
        el.imgDimensions.textContent = `${w} x ${h} px`;
      }
    };
  }

  function handleImageSelection(file) {
    if (!file.type.startsWith('image/')) {
      alert("Invalid format. Please select an image file.");
      return;
    }

    const el = getDomElements();
    State.state.currentImageName = file.name;
    el.imgName.textContent = file.name;

    const reader = new FileReader();
    reader.onload = (e) => {
      State.state.currentImageBase64 = e.target.result;
      State.state.currentImageMimeType = file.type;
      
      el.previewImage.src = e.target.result;

      el.uploadPlaceholder.classList.add('hidden');
      el.previewContainer.classList.remove('hidden');
      el.analyzeBtn.removeAttribute('disabled');
      el.resetBtn.removeAttribute('disabled');
      
      const activeItem = document.querySelector('.history-item.active');
      if (activeItem) activeItem.classList.remove('active');
      State.state.activeHistoryId = null;
    };
    reader.readAsDataURL(file);
  }

  function resetVisualUpload() {
    const el = getDomElements();
    State.state.currentImageBase64 = null;
    State.state.currentImageMimeType = null;
    State.state.currentImageName = '';
    
    el.fileInput.value = '';
    el.previewImage.src = '';
    el.imgDimensions.textContent = '0 x 0 px';
    
    el.previewContainer.classList.add('hidden');
    el.uploadPlaceholder.classList.remove('hidden');
    
    el.analyzeBtn.setAttribute('disabled', 'true');
    if (!State.state.activeHistoryId) {
      el.resetBtn.setAttribute('disabled', 'true');
    }
  }

  // Main visual execution pipeline
  async function runVisualAuditPipeline() {
    const el = getDomElements();
    if (State.state.isAnalyzing || !State.state.currentImageBase64) return;
    
    if (State.state.connectionType === 'gemini' && !State.state.apiKey) {
      alert("A Google Gemini API key is required. Click 'Configure Engine' below to configure it.");
      el.settingsBtn.click();
      return;
    }

    State.state.isAnalyzing = true;
    document.body.classList.add('analyzing-active');
    el.analyzeBtn.setAttribute('disabled', 'true');
    el.resetBtn.setAttribute('disabled', 'true');
    el.removeImgBtn.classList.add('hidden');
    
    el.stateReady.classList.add('hidden');
    el.stateResults.classList.add('hidden');
    el.stateAnalyzing.classList.remove('hidden');
    el.qcScoreBadge.textContent = 'SCANNING';
    el.qcScoreBadge.className = 'badge warning';
    
    el.dropZone.classList.add('scanning');
    el.liveTicker.classList.remove('hidden');

    if (!activeNeuralScanner) {
      activeNeuralScanner = new NeuralScanner('aiNeuralCanvas', 'aiScannerOverlay');
    }
    activeNeuralScanner.start();

    el.terminalLogs.innerHTML = '';
    const logs = [
      { text: "Initializing creative inspection layer...", type: "info", time: 100 },
      { text: "Reading visual payload dimensions...", type: "info", time: 400 },
      { text: `Target layout: ${el.platformSelector.options[el.platformSelector.selectedIndex].text}`, type: "muted", time: 700 },
      { text: "Encoding base64 imagery payload...", type: "info", time: 900 },
      { text: State.state.connectionType === 'gemini' ? "Pinging Gemini visual engine cluster..." : `Connecting to local Ollama [${State.state.ollamaModel}]...`, type: "warning", time: 1300 },
      { text: "Simulating eye-tracking gaze vectors...", type: "info", time: 1700 },
      { text: "Checking layout balance & grid lines...", type: "info", time: 2200 },
      { text: "Extracting color metrics & contrast gradients...", type: "info", time: 2700 },
      { text: "Performing lexical and syntactic verification on copy...", type: "info", time: 3100 },
      { text: "Constructing multi-agent critique feedback parameters...", type: "info", time: 3600 }
    ];

    const tickers = [
      "Analyzing layout hierarchy...",
      "Searching for misalignment...",
      "Analyzing contrast accessibility...",
      "Checking margins & padding...",
      "Verifying grammar and text spelling...",
      "Reading logo placement vectors...",
      "Reviewing visual flow hierarchy..."
    ];

    logs.forEach(log => {
      setTimeout(() => appendVisualTerminalLog(log.text, log.type), log.time);
    });

    let tickerInterval = setInterval(() => {
      const randomTicker = tickers[Math.floor(Math.random() * tickers.length)];
      el.tickerText.textContent = randomTicker;
    }, 800);

    // Live breathing AI holographic scanner dynamic generator
    const detectionsContainer = document.getElementById('aiDetectionsContainer');
    const reticlesContainer = document.getElementById('aiReticlesContainer');
    
    if (detectionsContainer) detectionsContainer.innerHTML = '';
    if (reticlesContainer) reticlesContainer.innerHTML = '';

    const detectionTemplates = [
      { label: "TEXT DETECTED", class: "text-type", w: 45, h: 10 },
      { label: "TEXT READABILITY CHECK", class: "text-type", w: 35, h: 8 },
      { label: "LOGO DETECTED", class: "brand-type", w: 18, h: 12 },
      { label: "CTA BLOCK FOUND", class: "brand-type", w: 40, h: 14 },
      { label: "ALIGNMENT EXTRAPOLATION", class: "critical-type", w: 25, h: 25 },
      { label: "CONTRAST MARGIN CHECK", class: "text-type", w: 50, h: 15 },
      { label: "COMPOSITION ANCHOR POINT", class: "brand-type", w: 30, h: 20 }
    ];

    let scanElementsInterval = setInterval(() => {
      if (!State.state.isAnalyzing) {
        clearInterval(scanElementsInterval);
        return;
      }
      
      // Spawn Bounding Box
      if (detectionsContainer) {
        const template = detectionTemplates[Math.floor(Math.random() * detectionTemplates.length)];
        const box = document.createElement('div');
        box.className = `ai-detect-box ${template.class}`;
        const left = Math.floor(Math.random() * (100 - template.w - 10)) + 5;
        const top = Math.floor(Math.random() * (100 - template.h - 10)) + 5;
        
        box.style.left = `${left}%`;
        box.style.top = `${top}%`;
        box.style.width = `${template.w}%`;
        box.style.height = `${template.h}%`;
        box.innerHTML = `<span class="ai-detect-label">${template.label}</span>`;
        
        detectionsContainer.appendChild(box);
        setTimeout(() => box.remove(), 1500);
      }
      
      // Spawn Target Reticle
      if (reticlesContainer) {
        const reticle = document.createElement('div');
        reticle.className = 'ai-reticle';
        const left = Math.floor(Math.random() * 80) + 10;
        const top = Math.floor(Math.random() * 80) + 10;
        
        reticle.style.left = `${left}%`;
        reticle.style.top = `${top}%`;
        
        reticlesContainer.appendChild(reticle);
        setTimeout(() => reticle.remove(), 1200);
      }
    }, 600);

    let rawResult = "";
    try {
      const platform = el.platformSelector.value;
      const clientObj = State.getClient(State.state.activeClientId);
      const projectObj = State.getProject(State.state.activeProjectId);
      
      const prompt = Api.buildInspectionPrompt(platform, clientObj, projectObj, State.state.customInstructions);
      const base64Data = State.state.currentImageBase64.split(',')[1];
      const mimeType = State.state.currentImageMimeType;

      if (State.state.connectionType === 'gemini') {
        const selectedModel = el.modelSelector.value;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${State.state.apiKey}`;
        const payload = {
          contents: [
            {
              parts: [
                { text: prompt },
                { inlineData: { mimeType: mimeType, data: base64Data } }
              ]
            }
          ],
          generationConfig: { temperature: 0.15 }
        };

        const response = await Api.fetchWithRetry(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error(`API error ${response.status}`);
        const data = await response.json();
        rawResult = data.candidates[0].content.parts[0].text;
      } else {
        // Ollama request
        const url = "http://localhost:11434/api/generate";
        const payload = {
          model: State.state.ollamaModel,
          prompt: prompt,
          images: [base64Data],
          stream: false
        };
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(`Ollama returned status ${response.status}`);
        const data = await response.json();
        rawResult = data.response;
      }
    } catch (err) {
      console.error(err);
      appendVisualTerminalLog(`[FATAL ERROR] API connection crashed: ${err.message}`, "danger");
      clearInterval(tickerInterval);
      clearInterval(scanElementsInterval);
      if (activeNeuralScanner) activeNeuralScanner.stop();
      
      setTimeout(() => {
        alert(`Analysis Engine Failed:\n${err.message}`);
        State.state.isAnalyzing = false;
        document.body.classList.remove('analyzing-active');
        el.dropZone.classList.remove('scanning');
        el.liveTicker.classList.add('hidden');
        el.stateAnalyzing.classList.add('hidden');
        el.stateReady.classList.remove('hidden');
        el.qcScoreBadge.textContent = 'ERROR';
        el.qcScoreBadge.className = 'badge score-badge-red';
        el.analyzeBtn.removeAttribute('disabled');
        el.resetBtn.removeAttribute('disabled');
        el.removeImgBtn.classList.remove('hidden');
      }, 1500);
      return;
    }

    // Wait for the minimum animation loop (4 seconds)
    setTimeout(() => {
      clearInterval(tickerInterval);
      clearInterval(scanElementsInterval);
      if (activeNeuralScanner) activeNeuralScanner.stop();
      appendVisualTerminalLog("Data received. Processing visual critique metrics...", "success");
      
      setTimeout(async () => {
        el.dropZone.classList.remove('scanning');
        el.liveTicker.classList.add('hidden');
        el.removeImgBtn.classList.remove('hidden');

        window.currentRawCritique = rawResult;
        const parsedReport = parseCritiqueReport(rawResult);
        const reportModelName = State.state.connectionType === 'gemini' 
          ? el.modelSelector.options[el.modelSelector.selectedIndex].text 
          : `Ollama (${State.state.ollamaModel})`;
        const reportFormatName = el.platformSelector.options[el.platformSelector.selectedIndex].text;
        
        Render.displayCritiqueReport(parsedReport, reportModelName, reportFormatName);
        
        // Cache visual thumbnail and medium-sized preview for log files list (to prevent localStorage quota issues)
        const thumbnail = await createThumbnail(el.previewImage);
        const mediumPreview = await createMediumPreview(el.previewImage);
        const newHistId = Date.now();
        State.addHistory({
          id: newHistId,
          title: State.state.currentImageName,
          thumbnail: thumbnail,
          image: mediumPreview,
          width: el.previewImage.naturalWidth || el.previewImage.width || 0,
          height: el.previewImage.naturalHeight || el.previewImage.height || 0,
          score: parsedReport.score,
          model: reportModelName,
          platform: reportFormatName,
          rawResponse: rawResult,
          timestamp: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        });

        // Set active item selection
        State.state.activeHistoryId = newHistId;

        // Re-render project history
        const filteredHistory = State.getFilteredHistory();
        Render.renderHistory(
          filteredHistory, 
          State.state.activeHistoryId, 
          loadHistoryItem, 
          deleteHistoryItem
        );

        el.stateAnalyzing.classList.add('hidden');
        el.stateResults.classList.remove('hidden');
        el.analyzeBtn.removeAttribute('disabled');
        el.resetBtn.removeAttribute('disabled');
        State.state.isAnalyzing = false;
        document.body.classList.remove('analyzing-active');
      }, 800);
    }, 4000);
  }

  function appendVisualTerminalLog(text, type) {
    const container = document.getElementById('terminalLogs');
    if (!container) return;
    const line = document.createElement('div');
    line.className = `log-line text-${type}`;
    line.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
    container.appendChild(line);
    container.scrollTop = container.scrollHeight;
  }

  // --- COPYWRITING SUITE PANEL CONTROLLER ---
  function bindCopyEditorPanel() {
    const tabVisual = document.getElementById('tabVisual');
    const tabText = document.getElementById('tabText');
    const visualTabContent = document.getElementById('visualTabContent');
    const textTabContent = document.getElementById('textTabContent');
    const rawTextInput = document.getElementById('rawTextInput');
    const textCounters = document.getElementById('textCounters');
    const btnAnalyzeText = document.getElementById('btnAnalyzeText');
    const btnResetText = document.getElementById('btnResetText');
    const btnClearText = document.getElementById('btnClearText');
    
    const generatorPromptInput = document.getElementById('generatorPromptInput');
    const btnGenerateText = document.getElementById('btnGenerateText');
    const btnCopyPolishedCopy = document.getElementById('btnCopyPolishedCopy');

    // Tab buttons
    const tabCreator = document.getElementById('tabCreator');
    const creatorTabContent = document.getElementById('creatorTabContent');
    const tabResearch = document.getElementById('tabResearch');
    const researchTabContent = document.getElementById('researchTabContent');
    const panelRight = document.querySelector('.panel-right');
    const rightReportGroup = document.querySelector('.right-report-group');
    const workspaceGrid = document.querySelector('.workspace-grid');
    const workspaceHeaderRow = document.querySelector('.workspace-header-row');

    const tabAssignments = document.getElementById('tabAssignments');
    const assignmentsTabContent = document.getElementById('assignmentsTabContent');

    tabVisual.addEventListener('click', () => {
      tabVisual.classList.add('active');
      if (tabCreator) tabCreator.classList.remove('active');
      if (tabResearch) tabResearch.classList.remove('active');
      if (tabAssignments) tabAssignments.classList.remove('active');
      tabText.classList.remove('active');
      visualTabContent.classList.remove('hidden');
      if (creatorTabContent) creatorTabContent.classList.add('hidden');
      if (researchTabContent) researchTabContent.classList.add('hidden');
      if (assignmentsTabContent) assignmentsTabContent.classList.add('hidden');
      textTabContent.classList.add('hidden');

      // Restore 2-column layout
      if (workspaceGrid) workspaceGrid.classList.remove('full-width');
      if (workspaceHeaderRow) workspaceHeaderRow.classList.remove('full-width');
      if (panelRight) panelRight.classList.remove('hidden');
      if (rightReportGroup) rightReportGroup.classList.remove('hidden');
    });

    if (tabCreator) {
      tabCreator.addEventListener('click', () => {
        tabCreator.classList.add('active');
        tabVisual.classList.remove('active');
        tabText.classList.remove('active');
        if (tabResearch) tabResearch.classList.remove('active');
        if (tabAssignments) tabAssignments.classList.remove('active');
        if (creatorTabContent) creatorTabContent.classList.remove('hidden');
        visualTabContent.classList.add('hidden');
        if (researchTabContent) researchTabContent.classList.add('hidden');
        if (assignmentsTabContent) assignmentsTabContent.classList.add('hidden');
        textTabContent.classList.add('hidden');
        
        // Auto-load creator canvas layout preset when displaying creator tab
        if (window.VisiQC.Editor && window.VisiQC.Editor.loadCreatorCanvasPreset) {
          window.VisiQC.Editor.loadCreatorCanvasPreset();
        }

        // Hide right panel and set full width
        if (workspaceGrid) workspaceGrid.classList.add('full-width');
        if (workspaceHeaderRow) workspaceHeaderRow.classList.add('full-width');
        if (panelRight) panelRight.classList.add('hidden');
        if (rightReportGroup) rightReportGroup.classList.add('hidden');
      });
    }

    tabText.addEventListener('click', () => {
      tabText.classList.add('active');
      tabVisual.classList.remove('active');
      if (tabCreator) tabCreator.classList.remove('active');
      if (tabResearch) tabResearch.classList.remove('active');
      if (tabAssignments) tabAssignments.classList.remove('active');
      textTabContent.classList.remove('hidden');
      visualTabContent.classList.add('hidden');
      if (creatorTabContent) creatorTabContent.classList.add('hidden');
      if (researchTabContent) researchTabContent.classList.add('hidden');
      if (assignmentsTabContent) assignmentsTabContent.classList.add('hidden');

      // Restore 2-column layout
      if (workspaceGrid) workspaceGrid.classList.remove('full-width');
      if (workspaceHeaderRow) workspaceHeaderRow.classList.remove('full-width');
      if (panelRight) panelRight.classList.remove('hidden');
      if (rightReportGroup) rightReportGroup.classList.remove('hidden');
    });

    if (tabResearch) {
      tabResearch.addEventListener('click', () => {
        tabResearch.classList.add('active');
        tabVisual.classList.remove('active');
        tabText.classList.remove('active');
        if (tabCreator) tabCreator.classList.remove('active');
        if (tabAssignments) tabAssignments.classList.remove('active');
        if (researchTabContent) researchTabContent.classList.remove('hidden');
        visualTabContent.classList.add('hidden');
        textTabContent.classList.add('hidden');
        if (creatorTabContent) creatorTabContent.classList.add('hidden');
        if (assignmentsTabContent) assignmentsTabContent.classList.add('hidden');

        // Hide right panel and set full width for research dashboard
        if (workspaceGrid) workspaceGrid.classList.add('full-width');
        if (workspaceHeaderRow) workspaceHeaderRow.classList.add('full-width');
        if (panelRight) panelRight.classList.add('hidden');
        if (rightReportGroup) rightReportGroup.classList.add('hidden');
      });
    }

    // Tone selections
    let selectedTone = 'professional';
    const toneButtons = document.querySelectorAll('.tone-btn');
    toneButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        toneButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedTone = btn.dataset.tone;
      });
    });

    // Word counters
    rawTextInput.addEventListener('input', () => {
      const val = rawTextInput.value.trim();
      const charCount = val.length;
      const wordCount = val ? val.split(/\s+/).filter(Boolean).length : 0;
      
      textCounters.textContent = `${wordCount} words | ${charCount} characters`;
      
      if (charCount > 0) {
        btnAnalyzeText.removeAttribute('disabled');
        btnResetText.removeAttribute('disabled');
      } else {
        btnAnalyzeText.setAttribute('disabled', 'true');
        btnResetText.setAttribute('disabled', 'true');
      }
    });

    // Reset copywriting workspace
    const resetText = () => {
      rawTextInput.value = '';
      textCounters.textContent = '0 words | 0 characters';
      btnAnalyzeText.setAttribute('disabled', 'true');
      btnResetText.setAttribute('disabled', 'true');
      
      const resultsText = document.getElementById('stateTextResults');
      resultsText.style.display = 'none';
      resultsText.classList.add('hidden');
      
      const el = getDomElements();
      el.stateResults.classList.add('hidden');
      el.stateReady.classList.remove('hidden');
      el.qcScoreBadge.textContent = 'READY';
      el.qcScoreBadge.className = 'badge';
    };
    btnClearText.addEventListener('click', resetText);
    btnResetText.addEventListener('click', resetText);

    // AI Generate text prompt triggers
    btnGenerateText.addEventListener('click', async () => {
      const prompt = generatorPromptInput.value.trim();
      if (!prompt) {
        alert("Please enter a generation prompt first.");
        return;
      }

      if (State.state.connectionType === 'gemini' && !State.state.apiKey) {
        alert("A Google Gemini API key is required. Click 'Configure Engine' below to configure it.");
        document.getElementById('settingsBtn').click();
        return;
      }

      const originalBtnHTML = btnGenerateText.innerHTML;
      btnGenerateText.setAttribute('disabled', 'true');
      btnGenerateText.textContent = 'Generating...';

      const systemPrompt = `You are a professional copywriter. Write high-quality copy based on the request: "${prompt}". Only output the text/copy itself. Do not include introductory sentences, quotes around the copy, header titles, explanations, or footnotes. Just output the clean text directly.`;

      try {
        let generatedText = "";
        if (State.state.connectionType === 'gemini') {
          const selectedModel = document.getElementById('modelSelector').value;
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${State.state.apiKey}`;
          const response = await Api.fetchWithRetry(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }], generationConfig: { temperature: 0.7 } })
          });
          if (!response.ok) throw new Error(`API error ${response.status}`);
          const data = await response.json();
          generatedText = data.candidates[0].content.parts[0].text;
        } else {
          // Ollama
          const response = await fetch("http://localhost:11434/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: State.state.ollamaModel, prompt: systemPrompt, stream: false })
          });
          if (!response.ok) throw new Error(`Ollama error ${response.status}`);
          const data = await response.json();
          generatedText = data.response;
        }

        rawTextInput.value = generatedText.trim();
        rawTextInput.dispatchEvent(new Event('input'));
      } catch (err) {
        console.error(err);
        alert(`Generation failed: ${err.message}`);
      } finally {
        btnGenerateText.removeAttribute('disabled');
        btnGenerateText.innerHTML = originalBtnHTML;
      }
    });

    // Copy polished copy
    btnCopyPolishedCopy.addEventListener('click', () => {
      const text = document.getElementById('polishedTextOutput').textContent.trim();
      if (!text || text === "Polished text will appear here...") return;
      navigator.clipboard.writeText(text).then(() => {
        const originalText = btnCopyPolishedCopy.innerHTML;
        btnCopyPolishedCopy.innerHTML = `<span class="material-symbols-outlined">done</span> Copied!`;
        setTimeout(() => btnCopyPolishedCopy.innerHTML = originalText, 2000);
      });
    });

    // Run text analysis audit
    btnAnalyzeText.addEventListener('click', async () => {
      const sourceText = rawTextInput.value.trim();
      if (!sourceText || State.state.isAnalyzing) return;

      if (State.state.connectionType === 'gemini' && !State.state.apiKey) {
        alert("A Google Gemini API key is required. Click 'Configure Engine' below to configure it.");
        document.getElementById('settingsBtn').click();
        return;
      }

      const el = getDomElements();
      State.state.isAnalyzing = true;
      document.body.classList.add('analyzing-active');
      btnAnalyzeText.setAttribute('disabled', 'true');
      btnResetText.setAttribute('disabled', 'true');
      
      el.stateReady.classList.add('hidden');
      el.stateResults.classList.add('hidden');
      
      const resultsText = document.getElementById('stateTextResults');
      resultsText.style.display = 'none';
      resultsText.classList.add('hidden');
      
      el.stateAnalyzing.classList.remove('hidden');
      el.qcScoreBadge.textContent = 'AUDITING';
      el.qcScoreBadge.className = 'badge warning';
      
      el.terminalLogs.classList.add('hidden');
      const terminalText = document.getElementById('terminalLogsText');
      terminalText.classList.remove('hidden');
      terminalText.innerHTML = '';
      
      const logs = [
        { text: "Initializing copy audit subsystem...", type: "info", time: 100 },
        { text: `Reading text payload (${sourceText.length} characters)...`, type: "info", time: 400 },
        { text: `Selected target tone directive: ${selectedTone.toUpperCase()}`, type: "muted", time: 700 },
        { text: "Tokenizing sentences and parts-of-speech...", type: "info", time: 900 },
        { text: State.state.connectionType === 'gemini' ? "Connecting to Gemini Language Engine..." : "Connecting to local Ollama daemon...", type: "warning", time: 1300 },
        { text: "Analyzing grammar syntaxes & tense consistency...", type: "info", time: 1800 },
        { text: "Checking punctuation flows and clauses...", type: "info", time: 2300 },
        { text: "Scrutinizing reading levels & word weights...", type: "info", time: 2800 },
        { text: "Formatting polished copy recommendations...", type: "info", time: 3300 }
      ];

      logs.forEach(log => {
        setTimeout(() => {
          const line = document.createElement('div');
          line.className = `log-line text-${log.type}`;
          line.textContent = `[${new Date().toLocaleTimeString()}] ${log.text}`;
          terminalText.appendChild(line);
          terminalText.scrollTop = terminalText.scrollHeight;
        }, log.time);
      });

      let rawResult = "";
      try {
        const toneDesc = getToneDescriptor(selectedTone);
        const clientObj = State.getClient(State.state.activeClientId);
        const projectObj = State.getProject(State.state.activeProjectId);
        
        const prompt = Api.buildTextInspectionPrompt(sourceText, toneDesc, clientObj, projectObj, State.state.customInstructions);

        if (State.state.connectionType === 'gemini') {
          const selectedModel = el.modelSelector.value;
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${State.state.apiKey}`;
          const response = await Api.fetchWithRetry(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2 } })
          });
          if (!response.ok) throw new Error(`API returned HTTP ${response.status}`);
          const data = await response.json();
          rawResult = data.candidates[0].content.parts[0].text;
        } else {
          // Ollama request
          const response = await fetch("http://localhost:11434/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: State.state.ollamaModel, prompt: prompt, stream: false })
          });
          if (!response.ok) throw new Error(`Ollama returned status ${response.status}`);
          const data = await response.json();
          rawResult = data.response;
        }
      } catch (err) {
        console.error(err);
        const line = document.createElement('div');
        line.className = 'log-line text-danger';
        line.textContent = `[FATAL] Copy audit crashed: ${err.message}`;
        terminalText.appendChild(line);
        
        setTimeout(() => {
          alert(`Text Analysis Failed:\n${err.message}`);
          State.state.isAnalyzing = false;
          document.body.classList.remove('analyzing-active');
          el.stateAnalyzing.classList.add('hidden');
          el.stateReady.classList.remove('hidden');
          el.qcScoreBadge.textContent = 'ERROR';
          el.qcScoreBadge.className = 'badge score-badge-red';
          btnAnalyzeText.removeAttribute('disabled');
          btnResetText.removeAttribute('disabled');
        }, 1500);
        return;
      }

      // Display results after simulated audit timing
      setTimeout(() => {
        const parsedReport = parseTextCritiqueReport(rawResult);
        const engineModelName = State.state.connectionType === 'gemini' 
          ? el.modelSelector.options[el.modelSelector.selectedIndex].text 
          : `Ollama (${State.state.ollamaModel})`;
        
        Render.displayTextReport(parsedReport, engineModelName, selectedTone.toUpperCase());
        
        el.stateAnalyzing.classList.add('hidden');
        resultsText.style.display = 'block';
        resultsText.classList.remove('hidden');
        
        el.qcScoreBadge.textContent = 'POLISHED';
        el.qcScoreBadge.className = 'badge score-badge-green';
        
        btnAnalyzeText.removeAttribute('disabled');
        btnResetText.removeAttribute('disabled');
        State.state.isAnalyzing = false;
        document.body.classList.remove('analyzing-active');
      }, 3800);
    });
  }

  function getToneDescriptor(key) {
    const tones = {
      professional: "Professional, authoritative, formal, and corporate. Suitable for B2B channels, professional slides, or serious branding copy.",
      friendly: "Friendly, informal, conversational, warm, and approachable. Suitable for B2C social posts, community chats, or casual ads.",
      persuasive: "Persuasive, marketing-oriented, compelling, and sales-focused. Emphasizes value propositions, benefits, hooks, and strong Calls to Action.",
      bold: "Bold, energetic, punchy, disruptive, and direct. Short sentences, high visual impact, bold claims, and high energy.",
      simple: "Simple, concise, clear, and easy to read. Strips away wordiness, fluff, corporate jargon, and matches high readability guidelines.",
      empathetic: "Empathetic, understanding, warm, supportive, and human-centric. Focuses on the user's pain points and offers caring, helpful solutions."
    };
    return tones[key] || tones.professional;
  }

  // --- B2B TRENDS RESEARCH SUITE PANEL ---
  function bindB2BResearchPanel() {
    const btnRunResearch = document.getElementById('btnRunResearch');
    const researchTopicInput = document.getElementById('researchTopicInput');
    const researchIndustrySelect = document.getElementById('researchIndustrySelect');
    const researchCustomIndustry = document.getElementById('researchCustomIndustry');
    const customIndustryContainer = document.getElementById('customIndustryContainer');
    
    const researchLoadingState = document.getElementById('researchLoadingState');
    const researchResultsDashboard = document.getElementById('researchResultsDashboard');
    const researchTerminalLogs = document.getElementById('researchTerminalLogs');
    const reportTopicTitle = document.getElementById('reportTopicTitle');
    const reportTimestamp = document.getElementById('reportTimestamp');
    const researchModelBadge = document.getElementById('researchModelBadge');

    // LinkedIn Elements
    const researchLinkedInTraction = document.getElementById('researchLinkedInTraction');
    const researchLinkedInFormulas = document.getElementById('researchLinkedInFormulas');
    const researchLinkedInKeywords = document.getElementById('researchLinkedInKeywords');
    const researchLinkedInPlan = document.getElementById('researchLinkedInPlan');

    // Meta Elements
    const researchMetaTraction = document.getElementById('researchMetaTraction');
    const researchMetaFormulas = document.getElementById('researchMetaFormulas');
    const researchMetaKeywords = document.getElementById('researchMetaKeywords');
    const researchMetaPlan = document.getElementById('researchMetaPlan');

    // X Elements
    const researchXTraction = document.getElementById('researchXTraction');
    const researchXFormulas = document.getElementById('researchXFormulas');
    const researchXKeywords = document.getElementById('researchXKeywords');
    const researchXPlan = document.getElementById('researchXPlan');

    // Print Elements
    const researchPrintTraction = document.getElementById('researchPrintTraction');
    const researchPrintFormulas = document.getElementById('researchPrintFormulas');
    const researchPrintKeywords = document.getElementById('researchPrintKeywords');
    const researchPrintPlan = document.getElementById('researchPrintPlan');

    if (!btnRunResearch || !researchTopicInput) return;

    // Toggle custom industry input visibility
    if (researchIndustrySelect) {
      researchIndustrySelect.addEventListener('change', () => {
        if (researchIndustrySelect.value === 'other') {
          customIndustryContainer.classList.remove('hidden');
        } else {
          customIndustryContainer.classList.add('hidden');
          if (researchCustomIndustry) researchCustomIndustry.value = '';
        }
      });
    }

    // Toggle results channel tabs
    const channelTabs = document.querySelectorAll('.channel-tab');
    const researchGrids = document.querySelectorAll('.research-grid');
    channelTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const channel = tab.getAttribute('data-channel');
        
        // Mark tab active
        channelTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Show corresponding grid
        researchGrids.forEach(grid => {
          grid.classList.add('hidden');
        });
                let targetGridId = `grid${channel.charAt(0).toUpperCase() + channel.slice(1)}`;
        if (channel === 'linkedin') targetGridId = 'gridLinkedIn';
        const targetGrid = document.getElementById(targetGridId);
        if (targetGrid) {
          targetGrid.classList.remove('hidden');
        }
      });
    });

    btnRunResearch.addEventListener('click', async () => {
      const topic = researchTopicInput.value.trim();
      if (!topic) {
        alert("Please enter a research topic first.");
        return;
      }

      let industry = researchIndustrySelect ? researchIndustrySelect.value : '';
      if (industry === 'other') {
        industry = researchCustomIndustry ? researchCustomIndustry.value.trim() : '';
        if (!industry) {
          alert("Please specify your custom industry.");
          return;
        }
      }

      if (!industry) {
        alert("Please select or specify a target industry.");
        return;
      }

      // 1. Loading state setup
      researchResultsDashboard.classList.add('hidden');
      researchLoadingState.classList.remove('hidden');
      btnRunResearch.setAttribute('disabled', 'true');
      researchTerminalLogs.innerHTML = '';
      
      const el = getDomElements();
      el.qcScoreBadge.textContent = 'RESEARCHING';
      el.qcScoreBadge.className = 'badge warning';

      // 2. Animated terminal logger
      const logs = [
        `[RESEARCH-ENGINE] Initializing cross-channel search pipeline for topic: "${topic}"...`,
        `[RESEARCH-ENGINE] Industry Sector Context: ${industry}`,
        `[RESEARCH-ENGINE] Activating Google Search Grounding tool...`,
        `[RESEARCH-ENGINE] Fetching live web search grounding context...`,
        `[RESEARCH-ENGINE] Analyzing LinkedIn B2B engagement trends for the current week...`,
        `[RESEARCH-ENGINE] Crawling Meta FB/IG visual ad layouts and copy angles...`,
        `[RESEARCH-ENGINE] Fetching real-time industry discussions on X (Twitter)...`,
        `[RESEARCH-ENGINE] Extracting physical publication concepts & print ad blueprints...`,
        `[RESEARCH-ENGINE] Synthesizing channel-specific keywords and interest tags...`,
        `[RESEARCH-ENGINE] Formulating actionable multi-channel strategic recommendations...`,
        `[RESEARCH-ENGINE] Analysis complete. Building Cross-Channel Intelligence report...`
      ];

      let logIndex = 0;
      const logInterval = setInterval(() => {
        if (logIndex < logs.length) {
          const logLine = document.createElement('div');
          logLine.className = 'log-line';
          logLine.style.marginBottom = '6px';
          if (logIndex % 2 === 0) logLine.style.color = '#38bdf8';
          else if (logIndex === logs.length - 1) logLine.style.color = '#4ade80';
          logLine.textContent = `> ${logs[logIndex]}`;
          researchTerminalLogs.appendChild(logLine);
          researchTerminalLogs.scrollTop = researchTerminalLogs.scrollHeight;
          logIndex++;
        } else {
          clearInterval(logInterval);
        }
      }, 300);

      // 3. Make the API Call to Gemini
      try {
        const apiKey = State.state.apiKey;
        if (!apiKey) {
          throw new Error("Missing API Key. Please open 'Configure Engine' and enter a valid Gemini API Key.");
        }

        const selectedModel = el.modelSelector.value;
        const prompt = Api.buildB2BResearchPrompt(topic, industry);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;

        const requestBody = {
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ googleSearch: {} }],
          generationConfig: {
            temperature: 0.3
          }
        };

        const response = await Api.fetchWithRetry(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          const errMsg = errData.error?.message || `HTTP status ${response.status}`;
          throw new Error(`Gemini API Error: ${errMsg}`);
        }

        const result = await response.json();
        const rawResponseText = result.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!rawResponseText) {
          throw new Error("Received empty or invalid response from Gemini API.");
        }

        // 4. Parse response parts based on markers
        const parsedReport = parseResearchReport(rawResponseText);

        // 5. Render results
        reportTopicTitle.textContent = `${topic} (${industry})`;
        reportTimestamp.textContent = `Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`;
        researchModelBadge.textContent = selectedModel;

        // Render LinkedIn Grid
        researchLinkedInTraction.innerHTML = formatMarkdownToHTML(parsedReport.linkedin.traction || "No traction topics found.");
        researchLinkedInFormulas.innerHTML = formatPostFormulasToHTML(parsedReport.linkedin.formulas || "No formulas found.");
        researchLinkedInKeywords.innerHTML = formatKeywordsToHTML(parsedReport.linkedin.keywords || "No keywords found.");
        researchLinkedInPlan.innerHTML = formatMarkdownToHTML(parsedReport.linkedin.plan || "No action recommendations found.");

        // Render Meta Grid
        researchMetaTraction.innerHTML = formatMarkdownToHTML(parsedReport.meta.traction || "No traction topics found.");
        researchMetaFormulas.innerHTML = formatPostFormulasToHTML(parsedReport.meta.formulas || "No formulas found.");
        researchMetaKeywords.innerHTML = formatKeywordsToHTML(parsedReport.meta.keywords || "No keywords found.");
        researchMetaPlan.innerHTML = formatMarkdownToHTML(parsedReport.meta.plan || "No action recommendations found.");

        // Render X Grid
        researchXTraction.innerHTML = formatMarkdownToHTML(parsedReport.x.traction || "No traction topics found.");
        researchXFormulas.innerHTML = formatPostFormulasToHTML(parsedReport.x.formulas || "No formulas found.");
        researchXKeywords.innerHTML = formatKeywordsToHTML(parsedReport.x.keywords || "No keywords found.");
        researchXPlan.innerHTML = formatMarkdownToHTML(parsedReport.x.plan || "No action recommendations found.");

        // Render Print Grid
        researchPrintTraction.innerHTML = formatMarkdownToHTML(parsedReport.print.traction || "No traction topics found.");
        researchPrintFormulas.innerHTML = formatPostFormulasToHTML(parsedReport.print.formulas || "No formulas found.");
        researchPrintKeywords.innerHTML = formatKeywordsToHTML(parsedReport.print.keywords || "No keywords found.");
        researchPrintPlan.innerHTML = formatMarkdownToHTML(parsedReport.print.plan || "No action recommendations found.");

        // Reset sub-tabs to LinkedIn
        channelTabs.forEach(t => t.classList.remove('active'));
        const defaultTab = document.querySelector('.channel-tab[data-channel="linkedin"]');
        if (defaultTab) defaultTab.classList.add('active');
        
        researchGrids.forEach(grid => grid.classList.add('hidden'));
        const defaultGrid = document.getElementById('gridLinkedIn');
        if (defaultGrid) defaultGrid.classList.remove('hidden');

        // 6. Transition state
        researchLoadingState.classList.add('hidden');
        researchResultsDashboard.classList.remove('hidden');
        el.qcScoreBadge.textContent = 'COMPLETED';
        el.qcScoreBadge.className = 'badge score-badge-green';

      } catch (error) {
        console.error("Research Tool Failure:", error);
        clearInterval(logInterval);
        
        const errLine = document.createElement('div');
        errLine.className = 'log-line';
        errLine.style.color = '#ef4444';
        errLine.style.fontWeight = 'bold';
        errLine.style.marginTop = '10px';
        errLine.textContent = `> [FATAL ERROR] ${error.message}`;
        researchTerminalLogs.appendChild(errLine);
        
        el.qcScoreBadge.textContent = 'ERROR';
        el.qcScoreBadge.className = 'badge score-badge-red';
      } finally {
        btnRunResearch.removeAttribute('disabled');
      }
    });
  }

  function parseResearchReport(text) {
    const markers = {
      linkedin_traction: '[LINKEDIN_TRACTION]',
      linkedin_formulas: '[LINKEDIN_FORMULAS]',
      linkedin_keywords: '[LINKEDIN_KEYWORDS]',
      linkedin_plan: '[LINKEDIN_PLAN]',
      
      meta_traction: '[META_TRACTION]',
      meta_formulas: '[META_FORMULAS]',
      meta_keywords: '[META_KEYWORDS]',
      meta_plan: '[META_PLAN]',
      
      x_traction: '[X_TRACTION]',
      x_formulas: '[X_FORMULAS]',
      x_keywords: '[X_KEYWORDS]',
      x_plan: '[X_PLAN]',
      
      print_traction: '[PRINT_TRACTION]',
      print_formulas: '[PRINT_FORMULAS]',
      print_keywords: '[PRINT_KEYWORDS]',
      print_plan: '[PRINT_PLAN]'
    };
    
    const getBlock = (marker, nextMarker) => {
      const startIdx = text.indexOf(marker);
      if (startIdx === -1) return '';
      const start = startIdx + marker.length;
      const end = nextMarker ? text.indexOf(nextMarker) : text.length;
      return text.substring(start, end === -1 ? text.length : end).trim();
    };

    return {
      linkedin: {
        traction: getBlock(markers.linkedin_traction, markers.linkedin_formulas),
        formulas: getBlock(markers.linkedin_formulas, markers.linkedin_keywords),
        keywords: getBlock(markers.linkedin_keywords, markers.linkedin_plan),
        plan: getBlock(markers.linkedin_plan, markers.meta_traction)
      },
      meta: {
        traction: getBlock(markers.meta_traction, markers.meta_formulas),
        formulas: getBlock(markers.meta_formulas, markers.meta_keywords),
        keywords: getBlock(markers.meta_keywords, markers.meta_plan),
        plan: getBlock(markers.meta_plan, markers.x_traction)
      },
      x: {
        traction: getBlock(markers.x_traction, markers.x_formulas),
        formulas: getBlock(markers.x_formulas, markers.x_keywords),
        keywords: getBlock(markers.x_keywords, markers.x_plan),
        plan: getBlock(markers.x_plan, markers.print_traction)
      },
      print: {
        traction: getBlock(markers.print_traction, markers.print_formulas),
        formulas: getBlock(markers.print_formulas, markers.print_keywords),
        keywords: getBlock(markers.print_keywords, markers.print_plan),
        plan: getBlock(markers.print_plan, null)
      }
    };
  }

  function formatMarkdownToHTML(mdText) {
    if (!mdText) return '';
    const lines = mdText.split('\n');
    let html = '<ul style="margin: 0; padding: 0 0 0 4px; display: flex; flex-direction: column; gap: 8px;">';
    
    lines.forEach(line => {
      let cleanLine = line.trim();
      if (cleanLine.startsWith('-') || cleanLine.startsWith('*')) {
        cleanLine = cleanLine.substring(1).trim();
      }
      
      cleanLine = cleanLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      cleanLine = cleanLine.replace(/\*(.*?)\*/g, '<em>$1</em>');
      
      if (cleanLine) {
        html += `<li style="margin-bottom: 4px; line-height: 1.5;">${cleanLine}</li>`;
      }
    });
    
    html += '</ul>';
    return html;
  }

  function formatKeywordsToHTML(keywordText) {
    if (!keywordText) return '';
    let cleanText = keywordText.replace(/[-\*\#]/g, '').trim();
    const parts = cleanText.split(/[\n,;]+/);
    let html = '<div style="margin-top: 4px; display: flex; flex-wrap: wrap;">';
    parts.forEach(part => {
      let kw = part.trim();
      if (kw) {
        html += `<span class="keyword-tag">${kw}</span>`;
      }
    });
    html += '</div>';
    return html;
  }

  function formatPostFormulasToHTML(formulaText) {
    if (!formulaText) return '';
    
    const lines = formulaText.split(/\r?\n/);
    let html = '<div style="display: flex; flex-direction: column; gap: 12px; margin-top: 4px;">';
    
    let currentBlueprintLines = [];
    let inBlueprint = false;
    
    const flushBlueprint = () => {
      if (currentBlueprintLines.length > 0) {
        const code = currentBlueprintLines.join('\n').trim();
        html += `<div class="post-formula-box">${code}</div>`;
        currentBlueprintLines = [];
      }
      inBlueprint = false;
    };

    const coreAngleRegex = /^(?:[-*•\s\d\.]*\s*)?\*?\*?(?:the\s+)?(?:core angle|visual focal point)/i;
    const hookRegex = /^(?:[-*•\s\d\.]*\s*)?\*?\*?(?:hook example|headline hook|main headline hook|hook)\*?\*?:/i;
    const blueprintRegex = /^(?:[-*•\s\d\.]*\s*)?\*?\*?(?:text blueprint|copy\/visual blueprint|body copy & offline cta blueprint|body copy|blueprint)\*?\*?:/i;
    
    lines.forEach(line => {
      const cleanLine = line.trim();
      if (!cleanLine) {
        if (inBlueprint) {
          currentBlueprintLines.push('');
        }
        return;
      }
      
      const isCoreAngle = coreAngleRegex.test(cleanLine);
      const isHook = hookRegex.test(cleanLine);
      const isBlueprintHeader = blueprintRegex.test(cleanLine);
      
      if (isCoreAngle) {
        flushBlueprint();
        let content = cleanLine;
        content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html += `<div style="font-weight: 700; color: var(--text-primary); margin-top: 6px; font-size: 13px;">${content}</div>`;
      } else if (isHook) {
        flushBlueprint();
        let content = cleanLine;
        // Clean up leading list/bullet markers
        content = content.replace(/^[-*•\s\d\.]+\s*/, '');
        content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html += `<div style="font-style: italic; background: rgba(124, 58, 237, 0.05); padding: 8px 12px; border-left: 3px solid var(--accent-purple); border-radius: 3px; margin: 4px 0; color: var(--text-primary);">${content}</div>`;
      } else if (isBlueprintHeader) {
        flushBlueprint();
        inBlueprint = true;
        html += `<div style="font-weight: 600; font-size: 11px; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 2px; margin-top: 4px;">Blueprint</div>`;
        
        // Check if there is trailing content on the same line
        const match = cleanLine.match(/^(?:[-*•\s\d\.]*\s*)?\*?\*?(?:text blueprint|copy\/visual blueprint|body copy & offline cta blueprint|body copy|blueprint)\*?\*?:?\s*(.*)/i);
        if (match && match[1]) {
          currentBlueprintLines.push(match[1].trim());
        }
      } else {
        if (inBlueprint) {
          currentBlueprintLines.push(cleanLine);
        } else {
          let content = cleanLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
          html += `<div style="line-height: 1.5; margin-bottom: 2px;">${content}</div>`;
        }
      }
    });
    
    flushBlueprint();
    html += '</div>';
    return html;
  }

  // --- CREATIVE ASSIGNMENTS & REQUIREMENTS BINDERS ---
  function compressRefImage(file, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 500;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        callback(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function handleAssignmentRefFile(file) {
    if (!file.type.startsWith('image/')) {
      alert("Only image files are supported as creative references.");
      return;
    }

    const reqRefPlaceholder = document.getElementById('reqRefPlaceholder');
    const reqRefPreviewContainer = document.getElementById('reqRefPreviewContainer');
    const reqRefPreviewImg = document.getElementById('reqRefPreviewImg');
    const reqRefFileName = document.getElementById('reqRefFileName');

    compressRefImage(file, (base64) => {
      assignmentRefImageBase64 = base64;
      assignmentRefImageName = file.name;

      if (reqRefPreviewImg) reqRefPreviewImg.src = base64;
      if (reqRefFileName) reqRefFileName.textContent = file.name;

      if (reqRefPlaceholder) reqRefPlaceholder.classList.add('hidden');
      if (reqRefPreviewContainer) reqRefPreviewContainer.classList.remove('hidden');
    });
  }

  function clearAssignmentRefFile() {
    assignmentRefImageBase64 = null;
    assignmentRefImageName = '';
    const reqRefFileInput = document.getElementById('reqRefFileInput');
    if (reqRefFileInput) reqRefFileInput.value = '';

    const reqRefPlaceholder = document.getElementById('reqRefPlaceholder');
    const reqRefPreviewContainer = document.getElementById('reqRefPreviewContainer');
    const reqRefPreviewImg = document.getElementById('reqRefPreviewImg');

    if (reqRefPreviewImg) reqRefPreviewImg.src = '';
    if (reqRefPlaceholder) reqRefPlaceholder.classList.remove('hidden');
    if (reqRefPreviewContainer) reqRefPreviewContainer.classList.add('hidden');
  }

  function refreshAssignmentsList() {
    const assignments = State.getAssignments();
    const clients = State.getClients();

    const filterReqClient = document.getElementById('filterReqClient');
    const filterReqRequester = document.getElementById('filterReqRequester');
    const filterReqStatus = document.getElementById('filterReqStatus');

    const clientFilter = filterReqClient ? filterReqClient.value : 'all';
    const requesterFilter = filterReqRequester ? filterReqRequester.value : 'all';
    const statusFilter = filterReqStatus ? filterReqStatus.value : 'all';

    const filtered = assignments.filter(item => {
      const matchClient = clientFilter === 'all' || item.clientId === clientFilter;
      const matchRequester = requesterFilter === 'all' || item.requester === requesterFilter;
      const matchStatus = statusFilter === 'all' || item.status === statusFilter;
      return matchClient && matchRequester && matchStatus;
    });

    Render.renderAssignmentsQueue(filtered, clients, {
      onDelete: (id) => {
        State.deleteAssignment(id);
        refreshAssignmentsList();
      },
      onStatusChange: (id, status) => {
        State.updateAssignmentStatus(id, status);
        refreshAssignmentsList();
      },
      onAuditLink: (item) => {
        // Deep link to Visual Audit!
        // 1. Switch client & reload workspace
        State.state.activeClientId = item.clientId;
        State.saveActiveState();
        reloadWorkspace();
        
        // 2. Select client dropdown in sidebar
        const clientSelector = document.getElementById('clientSelector');
        if (clientSelector) {
          clientSelector.value = item.clientId;
        }

        // 3. Setup target format if detected
        const platformSelector = document.getElementById('platformSelector');
        if (platformSelector) {
          if (item.title.toLowerCase().includes('reel') || item.title.toLowerCase().includes('story')) {
            platformSelector.value = 'instagram_story';
          } else if (item.title.toLowerCase().includes('post') || item.title.toLowerCase().includes('square')) {
            platformSelector.value = 'instagram_post';
          } else if (item.title.toLowerCase().includes('linkedin')) {
            platformSelector.value = 'linkedin_creative';
          } else {
            platformSelector.value = 'auto';
          }
        }

        // 4. Preload reference image in Visual Audit panel if present
        if (item.refImage) {
          State.state.currentImageBase64 = item.refImage;
          State.state.currentImageMimeType = 'image/jpeg';
          State.state.currentImageName = item.refImageName || 'assignment_reference.jpg';
          
          const previewImage = document.getElementById('previewImage');
          const previewContainer = document.getElementById('previewContainer');
          const uploadPlaceholder = document.getElementById('uploadPlaceholder');
          const analyzeBtn = document.getElementById('analyzeBtn');
          const resetBtn = document.getElementById('resetBtn');
          const imgName = document.getElementById('imgName');
          
          if (previewImage) previewImage.src = item.refImage;
          if (imgName) imgName.textContent = item.refImageName || 'assignment_reference.jpg';
          if (uploadPlaceholder) uploadPlaceholder.classList.add('hidden');
          if (previewContainer) previewContainer.classList.remove('hidden');
          if (analyzeBtn) analyzeBtn.removeAttribute('disabled');
          if (resetBtn) resetBtn.removeAttribute('disabled');
        }

        // 5. Trigger tab toggle
        const tabVisual = document.getElementById('tabVisual');
        if (tabVisual) tabVisual.click();
      },
      onCreatorLink: (item) => {
        // Deep link to AI Creator!
        // 1. Switch client
        State.state.activeClientId = item.clientId;
        State.saveActiveState();
        reloadWorkspace();
        
        const clientSelector = document.getElementById('clientSelector');
        if (clientSelector) {
          clientSelector.value = item.clientId;
        }

        // 2. Pre-fill AI prompt box
        const creatorPromptText = document.getElementById('creatorPromptText');
        if (creatorPromptText) {
          creatorPromptText.value = `A professional visual advertisement: ${item.title}.\nContext: ${item.description}`;
        }

        // 3. Set creator format matching the title if possible
        const creatorTargetFormat = document.getElementById('creatorTargetFormat');
        if (creatorTargetFormat) {
          if (item.title.toLowerCase().includes('reel') || item.title.toLowerCase().includes('story')) {
            creatorTargetFormat.value = '1080x1920';
          } else if (item.title.toLowerCase().includes('post') || item.title.toLowerCase().includes('square')) {
            creatorTargetFormat.value = '1080x1080';
          } else if (item.title.toLowerCase().includes('linkedin')) {
            creatorTargetFormat.value = '1200x630';
          }
        }

        // 4. Switch tab
        const tabCreator = document.getElementById('tabCreator');
        if (tabCreator) tabCreator.click();
      }
    });
  }

  function bindAssignmentsPanel() {
    const tabAssignments = document.getElementById('tabAssignments');
    const assignmentsTabContent = document.getElementById('assignmentsTabContent');
    const visualTabContent = document.getElementById('visualTabContent');
    const creatorTabContent = document.getElementById('creatorTabContent');
    const textTabContent = document.getElementById('textTabContent');
    const researchTabContent = document.getElementById('researchTabContent');

    const workspaceGrid = document.querySelector('.workspace-grid');
    const workspaceHeaderRow = document.querySelector('.workspace-header-row');
    const panelRight = document.querySelector('.panel-right');
    const rightReportGroup = document.querySelector('.right-report-group');

    if (!tabAssignments) return;

    tabAssignments.addEventListener('click', () => {
      // Toggle active states
      document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
      tabAssignments.classList.add('active');

      // Hide all content areas and show assignments
      visualTabContent.classList.add('hidden');
      if (creatorTabContent) creatorTabContent.classList.add('hidden');
      if (textTabContent) textTabContent.classList.add('hidden');
      if (researchTabContent) researchTabContent.classList.add('hidden');
      assignmentsTabContent.classList.remove('hidden');

      // Set to full width layout (like research and creator)
      if (workspaceGrid) workspaceGrid.classList.add('full-width');
      if (workspaceHeaderRow) workspaceHeaderRow.classList.add('full-width');
      if (panelRight) panelRight.classList.add('hidden');
      if (rightReportGroup) rightReportGroup.classList.add('hidden');

      // Refresh assignments dropdowns & list
      const clients = State.getClients();
      Render.renderAssignmentsFormDropdowns(clients);
      refreshAssignmentsList();
    });

    // Handle reference image selection
    const reqRefDropZone = document.getElementById('reqRefDropZone');
    const reqRefFileInput = document.getElementById('reqRefFileInput');
    const reqRefPlaceholder = document.getElementById('reqRefPlaceholder');
    const reqRefPreviewContainer = document.getElementById('reqRefPreviewContainer');
    const reqRefPreviewImg = document.getElementById('reqRefPreviewImg');
    const reqRefFileName = document.getElementById('reqRefFileName');
    const btnRemoveReqRef = document.getElementById('btnRemoveReqRef');

    if (reqRefDropZone && reqRefFileInput) {
      reqRefDropZone.addEventListener('click', (e) => {
        if (e.target.closest('#btnRemoveReqRef')) return;
        reqRefFileInput.click();
      });

      reqRefFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          handleAssignmentRefFile(e.target.files[0]);
        }
      });

      // Drag and Drop listeners
      reqRefDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        reqRefDropZone.style.borderColor = 'var(--accent-purple)';
        reqRefDropZone.style.background = 'rgba(79, 70, 229, 0.05)';
      });

      reqRefDropZone.addEventListener('dragleave', () => {
        reqRefDropZone.style.borderColor = 'var(--border-color)';
        reqRefDropZone.style.background = 'rgba(255,255,255,0.3)';
      });

      reqRefDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        reqRefDropZone.style.borderColor = 'var(--border-color)';
        reqRefDropZone.style.background = 'rgba(255,255,255,0.3)';
        if (e.dataTransfer.files.length > 0) {
          handleAssignmentRefFile(e.dataTransfer.files[0]);
        }
      });
    }

    if (btnRemoveReqRef) {
      btnRemoveReqRef.addEventListener('click', (e) => {
        e.stopPropagation();
        clearAssignmentRefFile();
      });
    }

    // Submit form handler
    const assignmentForm = document.getElementById('assignmentForm');
    if (assignmentForm) {
      assignmentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const clientId = document.getElementById('reqClientSelect').value;
        const title = document.getElementById('reqTitleInput').value.trim();
        const requester = document.getElementById('reqRequesterSelect').value;
        const priority = document.getElementById('reqPrioritySelect').value;
        const description = document.getElementById('reqDescInput').value.trim();

        if (!title || !description) {
          alert("Please fill in all required fields.");
          return;
        }

        const newAssignment = {
          id: 'asg_' + Date.now(),
          clientId,
          title,
          requester,
          priority,
          description,
          refImage: assignmentRefImageBase64,
          refImageName: assignmentRefImageName,
          status: 'pending',
          createdAt: new Date().toISOString(),
          completedAt: null
        };

        State.addAssignment(newAssignment);
        
        // Reset form
        assignmentForm.reset();
        clearAssignmentRefFile();
        
        // Re-render
        refreshAssignmentsList();
      });
    }

    // Filter Listeners
    const filterReqClient = document.getElementById('filterReqClient');
    const filterReqRequester = document.getElementById('filterReqRequester');
    const filterReqStatus = document.getElementById('filterReqStatus');

    [filterReqClient, filterReqRequester, filterReqStatus].forEach(filter => {
      if (filter) {
        filter.addEventListener('change', refreshAssignmentsList);
      }
    });
  }

  // --- REPORT EXPORTS ---
  function bindExports() {
    const el = getDomElements();
    
    el.btnCopyReport.addEventListener('click', () => {
      const activeReport = getActiveReportText();
      if (!activeReport) return;
      navigator.clipboard.writeText(activeReport).then(() => {
        const origHTML = el.btnCopyReport.innerHTML;
        el.btnCopyReport.innerHTML = `<span class="material-symbols-outlined">done</span> Copied!`;
        setTimeout(() => el.btnCopyReport.innerHTML = origHTML, 2000);
      });
    });

    el.btnDownloadReport.addEventListener('click', () => {
      const activeReport = getActiveReportText();
      if (!activeReport) return;
      const blob = new Blob([activeReport], { type: 'text/markdown;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `visiqc_report_${State.state.currentImageName.split('.')[0] || 'report'}.md`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });

    el.btnPrintReport.addEventListener('click', () => window.print());
  }

  function getActiveReportText() {
    if (State.state.activeHistoryId) {
      const historyItems = State.getFilteredHistory();
      const item = historyItems.find(h => h.id === State.state.activeHistoryId);
      if (item) return item.rawResponse;
    }
    return window.currentRawCritique || "";
  }

  // --- CRITIQUE HISTORY LOADERS/DELETERS ---
  function loadHistoryItem(item) {
    const el = getDomElements();
    State.state.activeHistoryId = item.id;
    
    // Toggle active classes on elements
    document.querySelectorAll('.history-item').forEach(card => {
      card.classList.toggle('active', parseInt(card.dataset.id) === item.id);
    });

    // Populate visual previews (falling back to thumbnail for legacy items)
    State.state.currentImageBase64 = item.image || item.thumbnail;
    State.state.currentImageName = item.title;
    el.imgName.textContent = item.title;
    el.previewImage.src = item.image || item.thumbnail;
    el.imgDimensions.textContent = item.width && item.height 
      ? `${item.width} x ${item.height} px` 
      : "Cached History Report";
    
    el.uploadPlaceholder.classList.add('hidden');
    el.previewContainer.classList.remove('hidden');
    el.analyzeBtn.setAttribute('disabled', 'true');
    el.resetBtn.removeAttribute('disabled');

    // Render critique details
    window.currentRawCritique = item.rawResponse;
    const parsed = parseCritiqueReport(item.rawResponse);
    Render.displayCritiqueReport(parsed, item.model, item.platform);
    
    el.stateReady.classList.add('hidden');
    el.stateAnalyzing.classList.add('hidden');
    el.stateResults.classList.remove('hidden');
  }

  function deleteHistoryItem(id) {
    State.deleteHistory(id);
    if (State.state.activeHistoryId === id) {
      State.state.activeHistoryId = null;
      resetVisualUpload();
      const el = getDomElements();
      el.stateResults.classList.add('hidden');
      el.stateReady.classList.remove('hidden');
      el.qcScoreBadge.textContent = 'READY';
      el.qcScoreBadge.className = 'badge';
    }
    
    const filteredHistory = State.getFilteredHistory();
    Render.renderHistory(
      filteredHistory, 
      State.state.activeHistoryId, 
      loadHistoryItem, 
      deleteHistoryItem
    );
  }

  // Generate tiny history visual thumbnails
  function createThumbnail(imgElement) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const maxDim = 120;
      let width = imgElement.naturalWidth || imgElement.width || 120;
      let height = imgElement.naturalHeight || imgElement.height || 120;

      if (width > height) {
        if (width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(imgElement, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    });
  }

  // Generate a compressed preview image (max 800px) to save space in localStorage
  function createMediumPreview(imgElement) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const maxDim = 800;
      let width = imgElement.naturalWidth || imgElement.width || 800;
      let height = imgElement.naturalHeight || imgElement.height || 800;

      if (width > height) {
        if (width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(imgElement, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.75));
    });
  }

  // --- PARSERS & TEXT REGEX WRAPPERS ---
  function parseCritiqueReport(text) {
    const config = [
      { key: 'critical', name: ["1. Critical Violations", "1. Critical Issues"], title: "Critical Violations (Must Fix)", icon: "error" },
      { key: 'visual', name: ["2. Visual Design & Spacing", "2. Alignment & Spacing"], title: "Visual Design & Layout", icon: "palette" },
      { key: 'visual', name: ["3. Typography & Hierarchy", "3. Typography"], title: "Typography & Hierarchy", icon: "format_size" },
      { key: 'visual', name: ["4. Color & Contrast"], title: "Color & Contrast", icon: "palette" },
      { key: 'branding', name: ["5. Branding Consistency"], title: "Branding Consistency", icon: "campaign" },
      { key: 'platform', name: ["6. Platform & Export Checks"], title: "Platform & Export Checks", icon: "aspect_ratio" },
      { key: 'visual', name: ["7. Composition & Visual Hierarchy", "7. Composition & Flow"], title: "Composition & Flow", icon: "space_dashboard" },
      { key: 'copy', name: ["3. Copy & Messaging", "8. Copy & Messaging"], title: "Copy & Messaging", icon: "rate_review" },
      { key: 'improvements', name: ["4. Suggested Action Plan", "9. Suggested Improvements"], title: "Actionable Fix Checklist", icon: "task_alt" }
    ];

    const report = { sections: [], score: 7.0 };
    const indices = [];

    config.forEach(c => {
      const idxObj = findHeaderIndex(text, c.name);
      if (idxObj) {
        indices.push({ key: c.key, name: c.name, title: c.title, icon: c.icon, idx: idxObj });
      }
    });
    
    // Add Score marker
    const scoreIdx = findHeaderIndex(text, ["5. Overall QC Score", "10. Overall QC Score"]);
    if (scoreIdx) {
      indices.push({ key: 'score', name: "Overall Score", title: "Score", icon: "percent", idx: scoreIdx });
    }

    // Sort matched indices by their index in the text to allow extracting slices correctly
    indices.sort((a, b) => a.idx.index - b.idx.index);

    for (let i = 0; i < indices.length - 1; i++) {
      const cur = indices[i];
      const next = indices[i+1];
      const content = extractSlice(text, cur.idx, next.idx);
      
      report.sections.push({
        key: cur.key,
        title: cur.title,
        icon: cur.icon,
        content: content
      });
    }

    const lastIdx = indices[indices.length - 1];
    if (lastIdx && lastIdx.key === 'score' && lastIdx.idx) {
      const slice = text.substring(lastIdx.idx.index + lastIdx.idx.patternLength).trim();
      report.score = parseNumericScore(slice);
    } else if (lastIdx && lastIdx.idx) {
      const scoreMarkerIdx = findHeaderIndex(text, ["5. Overall QC Score", "10. Overall QC Score"]);
      if (scoreMarkerIdx) {
        const slice = text.substring(scoreMarkerIdx.index + scoreMarkerIdx.patternLength).trim();
        report.score = parseNumericScore(slice);
      }
    }

    return report;
  }

  function parseTextCritiqueReport(text) {
    const headers = [
      "### 1. Polished Copy",
      "### 3. Grammar & Punctuation Changes",
      "### 4. Tone, Pacing & Hook Critique"
    ];
    
    const slices = {};
    const indices = [];
    
    headers.forEach(h => {
      const cleanName = h.replace("### ", "");
      const patterns = [
        `### ${cleanName}`,
        `## ${cleanName}`,
        `# ${cleanName}`,
        `**${cleanName}**`,
        `*${cleanName}*`,
        cleanName
      ];
      
      let found = false;
      for (const pattern of patterns) {
        const idx = text.toLowerCase().indexOf(pattern.toLowerCase());
        if (idx !== -1) {
          indices.push({ header: h, index: idx, len: pattern.length });
          found = true;
          break;
        }
      }
      if (!found) indices.push({ header: h, index: -1, len: 0 });
    });
    
    for (let i = 0; i < indices.length; i++) {
      const cur = indices[i];
      const next = indices[i+1];
      if (cur.index === -1) continue;
      
      const start = cur.index + cur.len;
      const end = next && next.index !== -1 ? next.index : text.length;
      slices[cur.header] = text.substring(start, end).trim();
    }
    
    return {
      polished: slices["### 1. Polished Copy"] || text,
      grammar: slices["### 3. Grammar & Punctuation Changes"] || "No major grammatical issues flagged.",
      critique: slices["### 4. Tone, Pacing & Hook Critique"] || "Copy polished to match selected tone target."
    };
  }

  function findHeaderIndex(text, headerName) {
    const names = Array.isArray(headerName) ? headerName : [headerName];
    for (const name of names) {
      const patterns = [
        `### ${name}`,
        `## ${name}`,
        `# ${name}`,
        `**${name}**`,
        `*${name}*`,
        name
      ];
      for (const pattern of patterns) {
        const idx = text.toLowerCase().indexOf(pattern.toLowerCase());
        if (idx !== -1) return { index: idx, patternLength: pattern.length };
      }
    }
    return null;
  }

  function extractSlice(text, currentIdx, nextIdx) {
    if (!currentIdx) return "";
    const start = currentIdx.index + currentIdx.patternLength;
    const end = nextIdx ? nextIdx.index : text.length;
    return text.substring(start, end).trim();
  }

  function parseNumericScore(scoreText) {
    const regex = /(\b[0-9](\.[0-9])?)\s*\/\s*10/;
    const match = scoreText.match(regex);
    if (match) return parseFloat(match[1]);
    
    const fallbackMatch = scoreText.match(/\b([0-9](\.[0-9])?|10)\b/);
    if (fallbackMatch) return parseFloat(fallbackMatch[1]);
    return 7.0;
  }

  // --- RETRIEVE CACHED ELEMENT DOM GRABS ---
  function getDomElements() {
    return {
      settingsBtn: document.getElementById('settingsBtn'),
      settingsModal: document.getElementById('settingsModal'),
      closeSettingsBtn: document.getElementById('closeSettingsBtn'),
      cancelSettingsBtn: document.getElementById('cancelSettingsBtn'),
      saveSettingsBtn: document.getElementById('saveSettingsBtn'),
      connectionTypeSelect: document.getElementById('connectionTypeSelect'),
      geminiOptionsGroup: document.getElementById('geminiOptionsGroup'),
      ollamaOptionsGroup: document.getElementById('ollamaOptionsGroup'),
      apiKeyInput: document.getElementById('apiKeyInput'),
      ollamaModelInput: document.getElementById('ollamaModelInput'),
      toggleApiKeyVisible: document.getElementById('toggleApiKeyVisible'),
      keyVisIcon: document.getElementById('keyVisIcon'),
      testConnectionBtn: document.getElementById('testConnectionBtn'),
      connectionTestStatus: document.getElementById('connectionTestStatus'),
      customInstructions: document.getElementById('customInstructions'),
      
      apiStatusDot: document.getElementById('apiStatusDot'),
      apiStatusText: document.getElementById('apiStatusText'),
      platformSelector: document.getElementById('platformSelector'),
      modelSelector: document.getElementById('modelSelector'),
      
      dropZone: document.getElementById('dropZone'),
      fileInput: document.getElementById('fileInput'),
      browseBtn: document.getElementById('browseBtn'),
      previewContainer: document.getElementById('previewContainer'),
      uploadPlaceholder: document.getElementById('uploadPlaceholder'),
      previewImage: document.getElementById('previewImage'),
      removeImgBtn: document.getElementById('removeImgBtn'),
      imgName: document.getElementById('imgName'),
      imgDimensions: document.getElementById('imgDimensions'),
      aiScannerOverlay: document.getElementById('aiScannerOverlay'),
      liveTicker: document.getElementById('liveTicker'),
      tickerText: document.getElementById('tickerText'),
      
      analyzeBtn: document.getElementById('analyzeBtn'),
      resetBtn: document.getElementById('resetBtn'),
      
      historyList: document.getElementById('historyList'),
      
      stateReady: document.getElementById('stateReady'),
      stateAnalyzing: document.getElementById('stateAnalyzing'),
      stateResults: document.getElementById('stateResults'),
      qcScoreBadge: document.getElementById('qcScoreBadge'),
      terminalLogs: document.getElementById('terminalLogs'),
      
      scoreProgress: document.getElementById('scoreProgress'),
      scoreVal: document.getElementById('scoreVal'),
      gradeTitle: document.getElementById('gradeTitle'),
      gradeDesc: document.getElementById('gradeDesc'),
      reportModelBadge: document.getElementById('reportModelBadge'),
      reportFormatBadge: document.getElementById('reportFormatBadge'),
      critiqueDetails: document.getElementById('critiqueDetails'),
      
      btnCopyReport: document.getElementById('btnCopyReport'),
      btnDownloadReport: document.getElementById('btnDownloadReport'),
      btnPrintReport: document.getElementById('btnPrintReport')
    };
  }

  // --- ACCESSORS ---
  window.VisiQC.Ui = {
    initUi,
    reloadWorkspace
  };

})();
