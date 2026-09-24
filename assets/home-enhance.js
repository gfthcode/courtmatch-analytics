(() => {
  if (window.location.pathname !== '/courtmatch-analytics/' && window.location.pathname !== '/courtmatch-analytics') return;
  const boot = () => {
    const hero = document.querySelector('.lab-hero');
    if (!hero) return false;
    const panel = hero.querySelector('.lab-command-panel');
    let visual = hero.querySelector('.lab-hero-visual');
    if (!visual) {
      visual = document.createElement('div');
      visual.className = 'lab-hero-visual lens-radar';
      visual.setAttribute('aria-label', '互动对位数据视图');
      visual.innerHTML = '<div class="lab-hero-visual-grid"></div><div class="lab-hero-orbit lab-hero-orbit-a"></div><div class="lab-hero-orbit lab-hero-orbit-b"></div><div class="lab-hero-crosshair"><i></i><b></b><span>POSSESSION<br>MAP</span></div><div class="lab-hero-visual-meta"><span>LIVE SAMPLE</span><strong>145,411</strong><small>DIRECT MATCHUP RECORDS</small></div><div class="lab-visual-tabs" role="tablist" aria-label="视觉模式"><button type="button" role="tab" aria-selected="true" class="is-active" data-lens="radar">RADAR</button><button type="button" role="tab" aria-selected="false" data-lens="flow">FLOW</button><button type="button" role="tab" aria-selected="false" data-lens="sample">SAMPLE</button></div><span class="lab-visual-corner">MOVE TO SCAN</span>';
      hero.insertBefore(visual, panel || null);
    }
    if (!visual.dataset.enhanced) visual.addEventListener('pointermove', (event) => {
      const rect = visual.getBoundingClientRect();
      visual.style.setProperty('--pointer-x', (((event.clientX - rect.left) / rect.width - .5) * 2).toFixed(3));
      visual.style.setProperty('--pointer-y', (((event.clientY - rect.top) / rect.height - .5) * 2).toFixed(3));
    });
    if (!visual.dataset.enhanced) visual.addEventListener('pointerleave', () => { visual.style.setProperty('--pointer-x', '0'); visual.style.setProperty('--pointer-y', '0'); });
    if (!visual.dataset.enhanced) visual.querySelectorAll('[data-lens]').forEach((button) => button.addEventListener('click', () => {
      const mode = button.getAttribute('data-lens');
      visual.className = `lab-hero-visual lens-${mode}`;
      visual.querySelectorAll('[data-lens]').forEach((item) => { item.classList.toggle('is-active', item === button); item.setAttribute('aria-selected', String(item === button)); });
      const label = visual.querySelector('.lab-hero-visual-meta span');
      if (label) label.textContent = mode === 'flow' ? 'FLOW VECTOR' : mode === 'sample' ? 'DATA PULSE' : 'LIVE SAMPLE';
    }));
    visual.dataset.enhanced = 'true';
    const workspace = document.querySelector('.lab-workspace');
    if (workspace && !workspace.id) workspace.id = 'lab-workspace';
    if (workspace && !hero.nextElementSibling?.classList.contains('lab-scroll-cue')) {
      const cue = document.createElement('a'); cue.className = 'lab-scroll-cue'; cue.href = '#lab-workspace'; cue.innerHTML = '<span>向下进入分析工作台</span><i aria-hidden="true"></i>'; hero.after(cue);
    }
    const metrics = [...document.querySelectorAll('.lab-metrics article strong')].map((node) => node.textContent?.trim() || '—');
    const metric = (index) => metrics[index] || '—';
    const dataStatus = document.querySelector('.data-strip .mode-tag')?.textContent?.trim() || 'DATA STATUS';
    const metricsNode = document.querySelector('.lab-metrics');
    if (metricsNode && !document.querySelector('.lab-story')) {
      const story = document.createElement('section'); story.className = 'lab-story'; story.setAttribute('aria-label', '看见比赛中的比赛');
      story.innerHTML = `<div class="lab-story-copy"><span class="lab-module-kicker">COURTMATCH / 02</span><h2>看见比赛中的<br><em>比赛。</em></h2><p>直接对位数据把一张赛后表格还原成一连串决定：谁创造了空间，谁限制了下一步，以及这次判断背后有多少真实样本。</p><div class="lab-story-actions"><a href="/courtmatch-analytics/matchups">探索 Matchups <span>→</span></a><a href="/courtmatch-analytics/methodology">阅读方法论 <span>↗</span></a></div></div><div class="lab-story-rail"><div><strong>${metric(1)}</strong><span>NBA 球员目录</span></div><div><strong>${metric(2)}</strong><span>直接对位记录</span></div><div><strong>${dataStatus}</strong><span>manifest 数据状态</span></div></div>`;
      metricsNode.after(story);
    }
    if (!document.querySelector('.lab-entry-grid')) {
      const anchor = document.querySelector('.lab-footer-grid');
      const entries = document.createElement('section'); entries.className = 'lab-entry-grid'; entries.setAttribute('aria-label', '探索 CourtMatch');
      entries.innerHTML = '<div class="lab-section-heading"><div><span>04 / EXPLORE THE LAB</span><h2>从一个问题开始。</h2></div></div><div class="lab-entry-links"><a href="/courtmatch-analytics/players"><span>01</span><strong>球员数据</strong><small>球员画像、趋势与常见对手</small><span>↗</span></a><a href="/courtmatch-analytics/playtypes"><span>02</span><strong>打法类型</strong><small>拆解每个回合的打法语境</small><span>↗</span></a><a href="/courtmatch-analytics/comparison"><span>03</span><strong>球员比较</strong><small>把两名球员放到同一条轴上</small><span>↗</span></a><a href="/courtmatch-analytics/sources"><span>04</span><strong>数据来源</strong><small>覆盖范围、更新时间与质量门禁</small><span>↗</span></a></div>';
      (anchor || document.querySelector('.lab-home')?.lastElementChild)?.before(entries);
    }
    const revealTargets = document.querySelectorAll('.lab-metrics,.lab-story,.lab-workspace,.lab-leaders,.lab-impact-grid,.lab-entry-grid,.lab-footer-grid');
    revealTargets.forEach((node) => node.classList.add('lab-reveal'));
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
      }), { threshold: .14, rootMargin: '0px 0px -8% 0px' });
      revealTargets.forEach((node) => observer.observe(node));
    } else revealTargets.forEach((node) => node.classList.add('is-visible'));
    const header = document.querySelector('.site-header');
    const updateHeader = () => header?.classList.toggle('is-scrolled', window.scrollY > 18);
    updateHeader(); window.addEventListener('scroll', updateHeader, { passive: true });
    return true;
  };
  if (!boot()) new MutationObserver(() => { if (boot()) document.querySelectorAll('body > .lab-enhance-observer').forEach((node) => node.remove()); }).observe(document.body, { childList: true, subtree: true });
})();

