(()=>{
  const run=()=>{
    if(!/\/salary/.test(location.pathname)&&!/\/salaries/.test(location.pathname)) return;
    const panel=document.querySelector('.unavailable-panel');
    if(!panel||panel.dataset.enhanced) return;
    panel.dataset.enhanced='1';
    panel.innerHTML='<h2>薪资数据暂未发布</h2><p>当前公开数据集中没有可验证的薪资、合同或球队工资总额字段，页面不会填充估算金额。</p><div class="salary-source-list"><a href="https://www.nba.com/stats" target="_blank" rel="noreferrer"><strong>NBA Stats ↗</strong><small>官方统计入口</small></a><a href="https://github.com/suren504/surennba_stats" target="_blank" rel="noreferrer"><strong>参考 GitHub ↗</strong><small>公开抓取脚本与字段说明</small></a><a href="/courtmatch-analytics/methodology"><strong>数据口径 ↗</strong><small>查看质量门禁与接入条件</small></a></div><details><summary>查看字段核验结论</summary><p>参考站与 suren504/surennba_stats 当前未提供 salary、contract 或 payroll 输出。接入前需新增独立数据源并通过来源、赛季、币种和更新时间校验。</p></details>';
  };
  new MutationObserver(run).observe(document.documentElement,{childList:true,subtree:true});
  [200,800,1800,3500].forEach(t=>setTimeout(run,t));
})();
