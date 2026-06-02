/* ==========================================================================
   VISIQC DYNAMIC DOM RENDERING LAYER
   ========================================================================== */

(function () {
  // Establish namespace
  window.VisiQC = window.VisiQC || {};

  // Renders Client dropdowns in sidebar and project modal
  function renderClientsDropdown(clients, activeClientId) {
    const clientSelect = document.getElementById('clientSelector');
    const modalClientSelect = document.getElementById('newProjClient');
    
    if (clientSelect) {
      clientSelect.innerHTML = clients.map(c => 
        `<option value="${c.id}" ${c.id === activeClientId ? 'selected' : ''}>${escapeHtmlOnly(c.name)}</option>`
      ).join('');
    }
    
    if (modalClientSelect) {
      modalClientSelect.innerHTML = clients.map(c => 
        `<option value="${c.id}" ${c.id === activeClientId ? 'selected' : ''}>${escapeHtmlOnly(c.name)}</option>`
      ).join('');
    }
  }

  // Renders Project dropdowns in sidebar
  function renderProjectsDropdown(projects, activeProjectId) {
    const projectSelect = document.getElementById('projectSelector');
    if (!projectSelect) return;
    
    if (projects.length === 0) {
      projectSelect.innerHTML = '<option value="" disabled selected>No projects created</option>';
      return;
    }
    
    projectSelect.innerHTML = projects.map(p => 
      `<option value="${p.id}" ${p.id === activeProjectId ? 'selected' : ''}>${escapeHtmlOnly(p.name)}</option>`
    ).join('');
  }

  // Renders the list of design thinking reference cards in the sidebar
  function renderDesignThinkingList(project) {
    const refContainer = document.getElementById('referencesList');
    if (!refContainer) return;
    
    if (!project || project.id === 'default_project' || !project.references || project.references.length === 0) {
      refContainer.innerHTML = `
        <div class="no-references-state">
          <p>No project reference boards</p>
        </div>
      `;
      // Update description text if applicable
      const descEl = document.getElementById('projectDescText');
      if (descEl) descEl.textContent = 'General console for running quick ad audits.';
      return;
    }
    
    // Update description text
    const descEl = document.getElementById('projectDescText');
    if (descEl) descEl.textContent = project.description || 'No description provided.';
    
    refContainer.innerHTML = project.references.map(ref => {
      const hasUrl = ref.url && ref.url.trim().length > 0;
      let urlStr = ref.url ? ref.url.trim() : '';
      // Prefix http:// if missing
      if (hasUrl && !urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
        urlStr = 'https://' + urlStr;
      }
      
      return `
        <div class="reference-card">
          <h5>${escapeHtmlOnly(ref.title)}</h5>
          <p>${escapeHtmlOnly(ref.note || '')}</p>
          ${hasUrl ? `
            <a href="${escapeHtmlOnly(urlStr)}" target="_blank" rel="noopener" class="reference-link">
              <span class="material-symbols-outlined">link</span>
              View reference
            </a>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  // Renders history items filtered by project
  function renderHistory(history, activeHistoryId, onLoadHistory, onDeleteHistory) {
    const historyList = document.getElementById('historyList');
    if (!historyList) return;
    
    if (history.length === 0) {
      historyList.innerHTML = `
        <div class="no-history-state">
          <p>No designs evaluated yet</p>
        </div>
      `;
      return;
    }

    historyList.innerHTML = '';
    
    history.forEach(item => {
      const card = document.createElement('div');
      card.className = `history-item ${activeHistoryId === item.id ? 'active' : ''}`;
      card.dataset.id = item.id;
      
      let badgeClass = 'score-badge-yellow';
      if (item.score >= 8.5) badgeClass = 'score-badge-green';
      if (item.score < 6.0) badgeClass = 'score-badge-red';

      card.innerHTML = `
        <div class="hist-thumb" style="background-image: url('${item.thumbnail}')"></div>
        <div class="hist-details">
          <h4 class="hist-title">${escapeHtmlOnly(item.title)}</h4>
          <div class="hist-meta">
            <span>${item.timestamp}</span>
            <span class="meta-dot"></span>
            <span>${item.platform.replace(' (1:1)', '').replace(' (9:16)', '').replace(' Image Ad', '')}</span>
          </div>
        </div>
        <div class="hist-score ${badgeClass}">${item.score.toFixed(1)}</div>
        <button class="delete-hist-btn" title="Delete from history">
          <span class="material-symbols-outlined" style="font-size:16px;">delete</span>
        </button>
      `;

      // Event click mapping
      card.addEventListener('click', (e) => {
        if (e.target.closest('.delete-hist-btn')) return;
        onLoadHistory(item);
      });

      card.querySelector('.delete-hist-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        onDeleteHistory(item.id);
      });

      historyList.appendChild(card);
    });
  }

  // Visual Inspection Report details accordion render
  function displayCritiqueReport(report, modelName, formatName) {
    const qcScoreBadge = document.getElementById('qcScoreBadge');
    const gradeTitle = document.getElementById('gradeTitle');
    const gradeDesc = document.getElementById('gradeDesc');
    const scoreProgress = document.getElementById('scoreProgress');
    const scoreVal = document.getElementById('scoreVal');
    const critiqueDetails = document.getElementById('critiqueDetails');
    
    document.getElementById('reportModelBadge').textContent = modelName;
    document.getElementById('reportFormatBadge').textContent = formatName;
    
    qcScoreBadge.textContent = `SCORE: ${report.score.toFixed(1)}/10`;
    if (report.score >= 8.5) {
      qcScoreBadge.className = 'badge score-badge-green';
      gradeTitle.textContent = "Production Ready";
      gradeDesc.textContent = "Excellent design execution. Minor or no elements need refining.";
    } else if (report.score >= 6.0) {
      qcScoreBadge.className = 'badge score-badge-yellow';
      gradeTitle.textContent = "Polish Needed";
      gradeDesc.textContent = "Good foundation, but needs key adjustments before delivery.";
    } else {
      qcScoreBadge.className = 'badge score-badge-red';
      gradeTitle.textContent = "Needs Redesign";
      gradeDesc.textContent = "Multiple critical issues found. Revise core visual structure.";
    }

    // Radial loader progress animation
    const circumference = 314.16; // 2 * PI * r(50)
    const offset = circumference - (report.score / 10) * circumference;
    scoreProgress.style.strokeDashoffset = offset;
    
    if (report.score >= 8.5) {
      scoreProgress.style.stroke = 'var(--color-success)';
    } else if (report.score >= 6.0) {
      scoreProgress.style.stroke = 'var(--color-warning)';
    } else {
      scoreProgress.style.stroke = 'var(--color-danger)';
    }

    animateScoreCounter(report.score, scoreVal);

    // Render accordions list
    critiqueDetails.innerHTML = '';
    
    report.sections.forEach(sec => {
      const accordion = document.createElement('div');
      accordion.className = `report-accordion ${sec.key}`;
      
      const isCritical = sec.key === 'critical' && hasRealContent(sec.content);
      const isImprovements = sec.key === 'improvements';
      
      if (isCritical || isImprovements) {
        accordion.classList.add('open');
      }

      const formattedHTML = formatSectionContent(sec.content, sec.key);

      accordion.innerHTML = `
        <div class="accordion-header">
          <div class="accordion-title-group">
            <span class="material-symbols-outlined accordion-icon">${sec.icon}</span>
            <h4>${sec.title}</h4>
          </div>
          <span class="material-symbols-outlined accordion-arrow">expand_more</span>
        </div>
        <div class="accordion-content">
          <div class="accordion-content-inner">
            ${formattedHTML}
          </div>
        </div>
      `;

      accordion.querySelector('.accordion-header').addEventListener('click', () => {
        accordion.classList.toggle('open');
      });

      critiqueDetails.appendChild(accordion);
    });
  }

  // Copy auditing text results render
  function displayTextReport(report, modelName, toneName) {
    document.getElementById('textReportModelBadge').textContent = modelName;
    document.getElementById('textReportToneBadge').textContent = toneName;
    document.getElementById('polishedTextOutput').textContent = report.polished;
    document.getElementById('grammarIssuesList').innerHTML = formatTextBullets(report.grammar, 'critical');
    document.getElementById('toneAnalysisList').innerHTML = formatTextBullets(report.critique, 'typography');
  }

  // --- RENDERING HELPERS ---
  function animateScoreCounter(targetScore, valElement) {
    let current = 0;
    const duration = 1200;
    const startTime = performance.now();
    
    function update(time) {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = progress * (2 - progress);
      const val = easeProgress * targetScore;
      
      valElement.textContent = val.toFixed(1);
      
      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        valElement.textContent = targetScore.toFixed(1);
      }
    }
    requestAnimationFrame(update);
  }

  function hasRealContent(content) {
    if (!content) return false;
    const val = content.toLowerCase();
    return !(val.includes("no issues") || val.includes("none") || val.trim() === "n/a" || val.trim() === "-");
  }

  function formatSectionContent(content, key) {
    if (!hasRealContent(content)) {
      return `
        <div class="clean-check-state">
          <span class="material-symbols-outlined">check_circle</span>
          <span>Compliant. No issues detected here.</span>
        </div>
      `;
    }

    const lines = content.split('\n');
    let html = '<ul class="critique-bullets">';
    let addedItems = 0;

    lines.forEach(line => {
      let cleanLine = line.trim();
      if (cleanLine.startsWith('-') || cleanLine.startsWith('*') || cleanLine.startsWith('+')) {
        cleanLine = cleanLine.substring(1).trim();
      }
      if (cleanLine) {
        html += `<li>${formatMarkdownInline(cleanLine)}</li>`;
        addedItems++;
      }
    });

    html += '</ul>';
    return addedItems > 0 ? html : `<div class="clean-check-state"><span class="material-symbols-outlined">check_circle</span><span>Compliant.</span></div>`;
  }

  function formatTextBullets(content, key) {
    if (!content || content.toLowerCase().includes("none") || content.toLowerCase().includes("no issues") || content.trim() === "-" || content.trim() === "") {
      return `
        <div class="clean-check-state">
          <span class="material-symbols-outlined">check_circle</span>
          <span>Compliant. No issues detected.</span>
        </div>
      `;
    }
    
    const lines = content.split('\n');
    let html = '<ul class="critique-bullets">';
    let count = 0;
    
    lines.forEach(line => {
      let clean = line.trim();
      if (clean.startsWith('-') || clean.startsWith('*') || clean.startsWith('+')) {
        clean = clean.substring(1).trim();
      }
      if (clean) {
        html += `<li>${formatMarkdownInline(clean)}</li>`;
        count++;
      }
    });
    
    html += '</ul>';
    return count > 0 ? html : `<div class="clean-check-state"><span class="material-symbols-outlined">check_circle</span><span>Compliant.</span></div>`;
  }

  function formatMarkdownInline(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>");
  }

  function escapeHtmlOnly(text) {
    if (!text) return '';
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function renderAssignmentsQueue(assignments, clients, actions) {
    const listContainer = document.getElementById('assignmentsCardsList');
    const countLabel = document.getElementById('assignmentsCountLabel');
    if (!listContainer) return;

    if (countLabel) {
      const activeCount = assignments.filter(a => a.status !== 'completed').length;
      countLabel.textContent = `${activeCount} ACTIVE | ${assignments.length} TOTAL`;
    }

    if (assignments.length === 0) {
      listContainer.innerHTML = `
        <div class="no-assignments-state">
          <span class="material-symbols-outlined">assignment_late</span>
          <h5>No active assignments</h5>
          <p>Requirements published by Suvrata, Alka, or Durgesh will appear in this list sorted by priority.</p>
        </div>
      `;
      return;
    }

    // Sort assignments: priority weight (high=3, medium=2, low=1) descending, then by createdAt descending
    const sorted = [...assignments].sort((a, b) => {
      const pWeight = { high: 3, medium: 2, low: 1 };
      const weightA = pWeight[a.priority] || 0;
      const weightB = pWeight[b.priority] || 0;
      if (weightB !== weightA) {
        return weightB - weightA;
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    listContainer.innerHTML = '';

    sorted.forEach(item => {
      const card = document.createElement('div');
      card.className = `assignment-card priority-${item.priority}`;
      card.dataset.id = item.id;

      const client = clients.find(c => c.id === item.clientId);
      const clientName = client ? client.name : 'General Brand';
      
      const statusLabel = item.status === 'in_progress' ? 'In Progress' : (item.status === 'completed' ? 'Completed' : 'Pending');
      const statusBadgeClass = item.status === 'in_progress' ? 'status-badge-progress' : (item.status === 'completed' ? 'status-badge-completed' : 'status-badge-pending');

      let refHTML = '';
      if (item.refImage) {
        refHTML = `
          <div class="assignment-card-ref">
            <img src="${item.refImage}" alt="Reference thumbnail">
            <span title="${escapeHtmlOnly(item.refImageName || 'image.png')}">Ref: ${escapeHtmlOnly(item.refImageName || 'image.png')}</span>
          </div>
        `;
      }

      card.innerHTML = `
        <div class="assignment-card-header">
          <div class="assignment-card-title-group">
            <h5 class="assignment-card-title">${escapeHtmlOnly(item.title)}</h5>
            <div class="assignment-card-meta">
              <span class="badge" style="background: rgba(79, 70, 229, 0.05); color: var(--accent-purple); font-weight: 700;">${escapeHtmlOnly(clientName)}</span>
              <span class="badge">By: ${escapeHtmlOnly(item.requester)}</span>
              <span class="status-badge ${statusBadgeClass}">${statusLabel}</span>
            </div>
          </div>
          <button class="btn-card-delete" title="Delete requirement">
            <span class="material-symbols-outlined" style="font-size: 16px;">delete</span>
          </button>
        </div>
        <p class="assignment-card-desc">${escapeHtmlOnly(item.description)}</p>
        ${refHTML}
        <div class="assignment-card-footer">
          <div class="assignment-status-wrapper">
            <span style="font-size: 9.5px; text-transform: uppercase; font-weight: 700; color: var(--text-muted);">Status:</span>
            <select class="req-status-select">
              <option value="pending" ${item.status === 'pending' ? 'selected' : ''}>Pending</option>
              <option value="in_progress" ${item.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
              <option value="completed" ${item.status === 'completed' ? 'selected' : ''}>Completed</option>
            </select>
          </div>
          <div class="assignment-action-btns">
            <button class="btn-card-action btn-visual-link">
              <span class="material-symbols-outlined" style="font-size: 13px;">analytics</span>
              Audit
            </button>
            <button class="btn-card-action btn-creator-link">
              <span class="material-symbols-outlined" style="font-size: 13px;">draw</span>
              Create
            </button>
          </div>
        </div>
      `;

      // Attach Listeners
      card.querySelector('.btn-card-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm("Are you sure you want to delete this assignment?")) {
          actions.onDelete(item.id);
        }
      });

      card.querySelector('.req-status-select').addEventListener('change', (e) => {
        actions.onStatusChange(item.id, e.target.value);
      });

      card.querySelector('.btn-visual-link').addEventListener('click', () => {
        actions.onAuditLink(item);
      });

      card.querySelector('.btn-creator-link').addEventListener('click', () => {
        actions.onCreatorLink(item);
      });

      listContainer.appendChild(card);
    });
  }

  function renderAssignmentsFormDropdowns(clients) {
    const filterSelect = document.getElementById('filterReqClient');
    const formSelect = document.getElementById('reqClientSelect');
    
    if (formSelect) {
      formSelect.innerHTML = clients.map(c => 
        `<option value="${c.id}">${escapeHtmlOnly(c.name)}</option>`
      ).join('');
    }

    if (filterSelect) {
      const options = clients.map(c => 
        `<option value="${c.id}">${escapeHtmlOnly(c.name)}</option>`
      );
      filterSelect.innerHTML = '<option value="all">All Clients</option>' + options.join('');
    }
  }

  // --- ACCESSORS ---
  window.VisiQC.Render = {
    renderClientsDropdown,
    renderProjectsDropdown,
    renderDesignThinkingList,
    renderHistory,
    displayCritiqueReport,
    displayTextReport,
    escapeHtmlOnly,
    renderAssignmentsQueue,
    renderAssignmentsFormDropdowns
  };

})();
