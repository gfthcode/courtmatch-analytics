(() => {
  const apply = () => {
    const root = document.querySelector('.lab-home');
    if (!root) return;
    root.querySelectorAll('.lab-command-panel,.lab-metrics,.lab-leaders,.lab-impact,.lab-update,.lab-method,.lab-matchup-card').forEach((node) => {
      node.style.setProperty('background', '#fbf9f4', 'important');
      node.style.setProperty('background-image', 'none', 'important');
      node.style.setProperty('color', '#1d252b', 'important');
    });
    root.querySelector('.lab-command-panel')?.style.setProperty('background', '#fbf9f4', 'important');
    root.querySelector('.lab-command-panel input')?.style.setProperty('background', '#fffdf8', 'important');
    root.querySelector('.lab-hero-subtitle')?.style.setProperty('color', '#1d252b', 'important');
    root.querySelector('.lab-hero-description')?.style.setProperty('color', '#68747c', 'important');
    document.body.style.setProperty('background', '#f3efe6', 'important');
    document.body.style.setProperty('color', '#1d252b', 'important');
    document.querySelector('.site-header')?.style.setProperty('background', '#f3efe6', 'important');
    document.querySelector('.site-header')?.style.setProperty('color', '#1d252b', 'important');
    document.querySelector('.data-strip')?.style.setProperty('background', '#fbf9f4', 'important');
    document.querySelector('.data-strip')?.style.setProperty('color', '#68747c', 'important');
    document.querySelector('.site-footer')?.style.setProperty('background', '#f3efe6', 'important');
    document.querySelector('.site-footer')?.style.setProperty('color', '#68747c', 'important');
  };
  apply();
  new MutationObserver(apply).observe(document.documentElement, { childList: true, subtree: true });
  [200, 800, 1800].forEach((delay) => setTimeout(apply, delay));
})();

