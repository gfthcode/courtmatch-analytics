const filters = document.querySelectorAll('.filter');
filters.forEach((filter) => filter.addEventListener('click', () => {
  filters.forEach((item) => item.classList.remove('active'));
  filter.classList.add('active');
}));

document.querySelector('#search-button').addEventListener('click', () => {
  const input = document.querySelector('#player-search');
  const label = input.value.trim() || 'Stephen Curry';
  input.value = label;
  input.setAttribute('aria-label', `正在分析 ${label}`);
  document.querySelector('#matchups .section-head h2').textContent = `${label} 的对位表现。`;
});