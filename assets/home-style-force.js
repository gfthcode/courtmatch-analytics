(() => {
  const apply = () => {
    const root = document.querySelector('.lab-home');
    if (!root) return;
    root.querySelectorAll('.lab-command-panel,.lab-metrics,.lab-leaders,.lab-impact,.lab-update,.lab-method,.lab-matchup-card').forEach((node) => {
      node.style.setProperty('background', 'rgba(16,25,39,.92)', 'important');
      node.style.setProperty('background-image', 'none', 'important');
      node.style.setProperty('color', '#f4f7fb', 'important');
    });
    root.querySelector('.lab-command-panel')?.style.setProperty('background', 'rgba(16,25,39,.96)', 'important');
    root.querySelector('.lab-command-panel input')?.style.setProperty('background', '#0c1421', 'important');
    root.querySelector('.lab-hero-subtitle')?.style.setProperty('color', '#f4f7fb', 'important');
    root.querySelector('.lab-hero-description')?.style.setProperty('color', '#9eacc0', 'important');
  };
  apply();
  new MutationObserver(apply).observe(document.documentElement, { childList: true, subtree: true });
  [200, 800, 1800].forEach((delay) => setTimeout(apply, delay));
})();
