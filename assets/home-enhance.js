(() => {
  if (window.location.pathname !== '/courtmatch-analytics/' && window.location.pathname !== '/courtmatch-analytics') return;
  const boot = () => {
    const hero = document.querySelector('.lab-hero');
    if (!hero || hero.querySelector('.lab-hero-visual')) return Boolean(hero);
    const panel = hero.querySelector('.lab-command-panel');
    const visual = document.createElement('div');
    visual.className = 'lab-hero-visual lens-radar';
    visual.setAttribute('aria-label', '互动对位数据视图');
    visual.innerHTML = '<div class="lab-hero-visual-grid"></div><div class="lab-hero-orbit lab-hero-orbit-a"></div><div class="lab-hero-orbit lab-hero-orbit-b"></div><div class="lab-hero-crosshair"><i></i><b></b><span>POSSESSION<br>MAP</span></div><div class="lab-hero-visual-meta"><span>LIVE SAMPLE</span><strong>145,411</strong><small>DIRECT MATCHUP RECORDS</small></div><div class="lab-visual-tabs" role="tablist" aria-label="视觉模式"><button type="button" role="tab" aria-selected="true" class="is-active" data-lens="radar">RADAR</button><button type="button" role="tab" aria-selected="false" data-lens="flow">FLOW</button><button type="button" role="tab" aria-selected="false" data-lens="sample">SAMPLE</button></div><span class="lab-visual-corner">MOVE TO SCAN</span>';
    hero.insertBefore(visual, panel || null);
    visual.addEventListener('pointermove', (event) => {
      const rect = visual.getBoundingClientRect();
      visual.style.setProperty('--pointer-x', (((event.clientX - rect.left) / rect.width - .5) * 2).toFixed(3));
      visual.style.setProperty('--pointer-y', (((event.clientY - rect.top) / rect.height - .5) * 2).toFixed(3));
    });
    visual.addEventListener('pointerleave', () => { visual.style.setProperty('--pointer-x', '0'); visual.style.setProperty('--pointer-y', '0'); });
    visual.querySelectorAll('[data-lens]').forEach((button) => button.addEventListener('click', () => {
      const mode = button.getAttribute('data-lens');
      visual.className = `lab-hero-visual lens-${mode}`;
      visual.querySelectorAll('[data-lens]').forEach((item) => { item.classList.toggle('is-active', item === button); item.setAttribute('aria-selected', String(item === button)); });
      const label = visual.querySelector('.lab-hero-visual-meta span');
      if (label) label.textContent = mode === 'flow' ? 'FLOW VECTOR' : mode === 'sample' ? 'DATA PULSE' : 'LIVE SAMPLE';
    }));
    const workspace = document.querySelector('.lab-workspace');
    if (workspace && !workspace.id) workspace.id = 'lab-workspace';
    if (workspace && !hero.nextElementSibling?.classList.contains('lab-scroll-cue')) {
      const cue = document.createElement('a'); cue.className = 'lab-scroll-cue'; cue.href = '#lab-workspace'; cue.innerHTML = '<span>向下进入分析工作台</span><i aria-hidden="true"></i>'; hero.after(cue);
    }
    return true;
  };
  if (!boot()) new MutationObserver(() => { if (boot()) document.querySelectorAll('body > .lab-enhance-observer').forEach((node) => node.remove()); }).observe(document.body, { childList: true, subtree: true });
})();
