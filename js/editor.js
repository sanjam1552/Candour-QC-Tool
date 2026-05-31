/* ==========================================================================
   AI IMAGE CREATOR ENGINE
   ========================================================================== */

(function () {
  // Establish namespace
  window.VisiQC = window.VisiQC || {};

  const State = window.VisiQC.State;

  // --- AI IMAGE CREATOR STATE ---
  let creatorImage = null;
  let creatorMimeType = "image/png";
  let creatorName = "generated_creative.png";

  // --- INITIALIZATION BOOTSTRAP ---
  function initStudio() {
    bindCreatorEvents();
  }

  // --- AI IMAGE CREATOR BINDERS ---
  function bindCreatorEvents() {
    const tabCreator = document.getElementById('tabCreator');
    const btnGenerateAsset = document.getElementById('btnGenerateAsset');
    const promptTextarea = document.getElementById('creatorPromptText');
    const creatorStatus = document.getElementById('creatorStatusText');
    
    const creatorFormatSelect = document.getElementById('creatorTargetFormat');
    const creatorCanvas = document.getElementById('creatorCanvas');
    const btnExportCreator = document.getElementById('btnExportCreatorDesign');
    const btnSetCreatorAsActive = document.getElementById('btnSetCreatorAsActive');

    if (tabCreator) {
      tabCreator.addEventListener('click', () => {
        // Auto-populate prompt suggestions if empty
        if (promptTextarea && !promptTextarea.value.trim()) {
          promptTextarea.value = getAutoPromptText();
        }
        loadCreatorCanvasPreset();
      });
    }

    if (creatorFormatSelect) {
      creatorFormatSelect.addEventListener('change', loadCreatorCanvasPreset);
    }

    // Generate action
    if (btnGenerateAsset) {
      btnGenerateAsset.addEventListener('click', async () => {
        const prompt = promptTextarea.value.trim();
        if (!prompt) {
          alert("Please describe the creative you want the AI to generate.");
          return;
        }

        btnGenerateAsset.setAttribute('disabled', 'true');
        creatorStatus.textContent = "AI engine synthesizing image natively (5-10s)...";
        creatorStatus.className = "studio-status";
        creatorStatus.classList.remove('hidden');

        try {
          const seed = Math.floor(Math.random() * 1000000);
          const encodedPrompt = encodeURIComponent(prompt);
          const [width, height] = creatorFormatSelect.value.split('x').map(Number);
          
          const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true&private=true`;

          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            creatorImage = img;
            creatorName = `ai_${Date.now()}.png`;
            creatorStatus.textContent = "Success! Asset loaded onto canvas.";
            creatorStatus.className = "studio-status success";
            
            drawCreatorCanvas();
            btnGenerateAsset.removeAttribute('disabled');
            setTimeout(() => creatorStatus.classList.add('hidden'), 3500);
          };
          img.onerror = () => {
            throw new Error("Unable to retrieve image buffer from Pollinations network.");
          };
          img.src = imageUrl;
        } catch (err) {
          console.error(err);
          creatorStatus.textContent = `Error: ${err.message}`;
          creatorStatus.className = "studio-status error";
          btnGenerateAsset.removeAttribute('disabled');
        }
      });
    }

    // Set Active Creative
    if (btnSetCreatorAsActive) {
      btnSetCreatorAsActive.addEventListener('click', () => {
        if (!creatorImage) {
          alert("Please generate an image first.");
          return;
        }

        const dataUrl = creatorCanvas.toDataURL(creatorMimeType, 0.95);
        commitToVisualAuditWorkspace(dataUrl, `creator_${creatorName}`, creatorMimeType, creatorCanvas.width, creatorCanvas.height);
        
        // Auto switch back to visual audit tab
        const tabVisual = document.getElementById('tabVisual');
        if (tabVisual) tabVisual.click();
      });
    }

    // Export Design
    if (btnExportCreator) {
      btnExportCreator.addEventListener('click', () => {
        if (!creatorImage) {
          alert("No creative to export.");
          return;
        }
        triggerDownload(creatorCanvas, `VisiQC_creator_${creatorName}`, creatorMimeType);
      });
    }
  }

  function loadCreatorCanvasPreset() {
    const canvas = document.getElementById('creatorCanvas');
    const formatSelect = document.getElementById('creatorTargetFormat');
    const dimsLabel = document.getElementById('creatorCanvasDims');
    if (!canvas || !formatSelect) return;

    const [width, height] = formatSelect.value.split('x').map(Number);
    canvas.width = width;
    canvas.height = height;

    if (dimsLabel) dimsLabel.textContent = `${width} x ${height} px`;
    drawCreatorCanvas();
  }

  function drawCreatorCanvas() {
    const canvas = document.getElementById('creatorCanvas');
    const hud = document.getElementById('creatorHUD');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!creatorImage) {
      canvas.classList.add('is-empty');
      if (hud) hud.classList.remove('hidden');
    } else {
      canvas.classList.remove('is-empty');
      if (hud) hud.classList.add('hidden');
      ctx.drawImage(creatorImage, 0, 0, canvas.width, canvas.height);
    }
  }

  // --- HELPERS ---
  function getAutoPromptText() {
    const activeClientId = State.state.activeClientId;
    const client = State.getClient(activeClientId);
    const activeProjectId = State.state.activeProjectId;
    const project = State.getProject(activeProjectId);
    
    let parts = [];
    
    // Core design base description
    if (project && project.id !== 'default_project') {
      parts.push(`An elegant creative layout designs for project "${project.name}" - ${project.description || ''}`);
      if (project.references && project.references.length > 0) {
        const refs = project.references.map(r => r.title).join(", ");
        parts.push(`Inspired by concepts: ${refs}`);
      }
    } else {
      parts.push("A premium corporate marketing banner design with modern layouts, high resolution 8k");
    }

    // Inject client details
    if (client && client.id !== 'default_client') {
      parts.push(`representing brand "${client.name}" matching guidelines: ${client.guidelines || ''}`);
      if (client.colors && client.colors.length > 0) {
        const hexes = client.colors.map(c => c.hex).join(", ");
        parts.push(`strictly using brand color scheme palettes: ${hexes}`);
      }
      if (client.fonts && client.fonts.length > 0) {
        const families = client.fonts.map(f => f.family).join(", ");
        parts.push(`matching branding typography: ${families}`);
      }
      if (client.ctaRules) {
        parts.push(`incorporating visual CTA hook: ${client.ctaRules}`);
      }
    }

    return parts.join(". ").substring(0, 240); // cap size limit
  }

  function commitToVisualAuditWorkspace(dataUrl, name, mimeType, width, height) {
    const dropZone = document.getElementById('dropZone');
    const uploadPlaceholder = document.getElementById('uploadPlaceholder');
    const previewContainer = document.getElementById('previewContainer');
    const previewImg = document.getElementById('previewImage');
    const imgNameLabel = document.getElementById('imgName');
    const imgDimensionsLabel = document.getElementById('imgDimensions');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const resetBtn = document.getElementById('resetBtn');

    State.state.currentImageBase64 = dataUrl;
    State.state.currentImageMimeType = mimeType;
    State.state.currentImageName = name;

    if (previewImg) previewImg.src = dataUrl;
    if (imgNameLabel) imgNameLabel.textContent = name;
    if (imgDimensionsLabel) imgDimensionsLabel.textContent = `${width} x ${height} px`;
    
    if (uploadPlaceholder) uploadPlaceholder.classList.add('hidden');
    if (previewContainer) previewContainer.classList.remove('hidden');
    if (analyzeBtn) analyzeBtn.removeAttribute('disabled');
    if (resetBtn) resetBtn.removeAttribute('disabled');
  }

  function triggerDownload(canvasElement, filename, mimeType) {
    const dataUrl = canvasElement.toDataURL(mimeType, 0.95);
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // --- ACCESSORS ---
  window.VisiQC.Editor = {
    initStudio,
    loadCreatorCanvasPreset
  };

})();
