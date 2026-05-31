/* ==========================================================================
   VISIQC STATE MANAGEMENT DATABASE LAYER
   ========================================================================== */

(function () {
  // Establish namespace
  window.VisiQC = window.VisiQC || {};

  const DB_KEY = 'visiqc_database_v2';
  const STATE_KEY = 'visiqc_active_state_v2';

  // Seed default data
  const defaultClient = {
    id: 'default_client',
    name: 'General Client',
    guidelines: 'No specific client guidelines. Perform standard creative visual audit checks.',
    colors: [],
    fonts: [],
    logoRules: '',
    ctaRules: ''
  };

  const defaultProject = {
    id: 'default_project',
    clientId: 'default_client',
    name: 'General Console',
    description: 'General workspace project for standard design and copy checking.',
    targetPlatform: 'auto',
    references: [
      {
        title: 'Design Thinking: Simplicity',
        note: 'Keep focus on the user task. Reduce decorative visual clutter.',
        url: 'https://vimeo.com'
      }
    ]
  };

  // Internal state memory
  const state = {
    clients: [],
    projects: [],
    history: [],
    activeClientId: 'default_client',
    activeProjectId: 'default_project',
    connectionType: localStorage.getItem('visiqc_connection_type') || 'gemini',
    apiKey: localStorage.getItem('visiqc_api_key') || '',
    ollamaModel: localStorage.getItem('visiqc_ollama_model') || 'llava',
    customInstructions: localStorage.getItem('visiqc_custom_instructions') || '',
    isAnalyzing: false,
    currentImageBase64: null,
    currentImageMimeType: null,
    currentImageName: ''
  };

  // --- INITIALIZATION ---
  function initDb() {
    // Load database
    const dbRaw = localStorage.getItem(DB_KEY);
    if (dbRaw) {
      try {
        const parsed = JSON.parse(dbRaw);
        state.clients = parsed.clients || [];
        state.projects = parsed.projects || [];
        state.history = parsed.history || [];
      } catch (e) {
        console.error('Failed to parse database, resetting...', e);
      }
    }

    // Seed defaults if empty
    if (state.clients.length === 0) {
      state.clients.push(defaultClient);
    }
    // Check if default client exists, if not, add it
    if (!state.clients.find(c => c.id === 'default_client')) {
      state.clients.unshift(defaultClient);
    }

    if (state.projects.length === 0) {
      state.projects.push(defaultProject);
    }
    // Check if default project exists, if not, add it
    if (!state.projects.find(p => p.id === 'default_project')) {
      state.projects.unshift(defaultProject);
    }

    // Load active state selector selections
    const stateRaw = localStorage.getItem(STATE_KEY);
    if (stateRaw) {
      try {
        const parsedState = JSON.parse(stateRaw);
        state.activeClientId = parsedState.activeClientId || 'default_client';
        state.activeProjectId = parsedState.activeProjectId || 'default_project';
      } catch (e) {
        console.error('Failed to parse active state, resetting...', e);
      }
    }

    // Verify active selections still exist in tables
    if (!state.clients.find(c => c.id === state.activeClientId)) {
      state.activeClientId = 'default_client';
    }
    if (!state.projects.find(p => p.id === state.activeProjectId)) {
      // Set to first project matching active client
      const clientProjects = state.projects.filter(p => p.clientId === state.activeClientId);
      state.activeProjectId = clientProjects.length > 0 ? clientProjects[0].id : 'default_project';
    }

    saveDb();
    saveActiveState();

    // Migrate old history to default project if applicable
    const oldHistory = localStorage.getItem('visiqc_history');
    if (oldHistory) {
      try {
        const parsedOldHist = JSON.parse(oldHistory);
        if (parsedOldHist && parsedOldHist.length > 0) {
          parsedOldHist.forEach(item => {
            // Check if already in new database history table
            if (!state.history.find(h => h.id === item.id)) {
              // Attach to default project/client
              item.clientId = 'default_client';
              item.projectId = 'default_project';
              state.history.push(item);
            }
          });
          saveDb();
          localStorage.removeItem('visiqc_history'); // clean up
        }
      } catch (e) {
        console.error('Failed migrating old history', e);
      }
    }
  }

  function saveDb() {
    const db = {
      clients: state.clients,
      projects: state.projects,
      history: state.history
    };
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  }

  function saveActiveState() {
    const active = {
      activeClientId: state.activeClientId,
      activeProjectId: state.activeProjectId
    };
    localStorage.setItem(STATE_KEY, JSON.stringify(active));
  }

  // --- ACTIONS ---
  function getClients() {
    return state.clients;
  }

  function getClient(id) {
    return state.clients.find(c => c.id === id);
  }

  function addClient(client) {
    state.clients.push(client);
    saveDb();
  }

  function deleteClient(id) {
    if (id === 'default_client') return; // Cannot delete general client
    
    state.clients = state.clients.filter(c => c.id !== id);
    // Delete client's projects and history
    const projectsToDelete = state.projects.filter(p => p.clientId === id);
    const projectIds = projectsToDelete.map(p => p.id);
    
    state.projects = state.projects.filter(p => p.clientId !== id);
    state.history = state.history.filter(h => h.clientId !== id);
    
    if (state.activeClientId === id) {
      state.activeClientId = 'default_client';
      state.activeProjectId = 'default_project';
    }
    
    saveDb();
    saveActiveState();
  }

  function getProjects(clientId) {
    return state.projects.filter(p => p.clientId === clientId);
  }

  function getProject(id) {
    return state.projects.find(p => p.id === id);
  }

  function addProject(project) {
    state.projects.push(project);
    saveDb();
  }

  function deleteProject(id) {
    if (id === 'default_project') return; // Cannot delete general project
    
    state.projects = state.projects.filter(p => p.id !== id);
    state.history = state.history.filter(h => h.projectId !== id);
    
    if (state.activeProjectId === id) {
      const clientProjects = state.projects.filter(p => p.clientId === state.activeClientId);
      state.activeProjectId = clientProjects.length > 0 ? clientProjects[0].id : 'default_project';
    }
    
    saveDb();
    saveActiveState();
  }

  function getFilteredHistory() {
    return state.history.filter(h => h.clientId === state.activeClientId && h.projectId === state.activeProjectId);
  }

  function addHistory(item) {
    // Inject active context
    item.clientId = state.activeClientId;
    item.projectId = state.activeProjectId;
    
    state.history.unshift(item);
    // Keep max 24 items in history
    if (state.history.length > 30) {
      state.history.pop();
    }
    saveDb();
  }

  function deleteHistory(id) {
    state.history = state.history.filter(h => h.id !== id);
    saveDb();
  }

  // --- ACCESSORS ---
  window.VisiQC.State = {
    state,
    initDb,
    saveDb,
    saveActiveState,
    
    getClients,
    getClient,
    addClient,
    deleteClient,
    
    getProjects,
    getProject,
    addProject,
    deleteProject,
    
    getFilteredHistory,
    addHistory,
    deleteHistory
  };

})();
