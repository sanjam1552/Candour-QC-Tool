/* ==========================================================================
   VISIQC MAIN APPLICATION INITIALIZER (BOOTSTRAPPER)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Database
  window.VisiQC.State.initDb();
  
  // Bind Interface elements and render initial states
  window.VisiQC.Ui.initUi();
  
  // Initialize Studio Canvas Editor
  window.VisiQC.Editor.initStudio();
  
  console.log("VisiQC Workspace Console successfully initialized.");
});
