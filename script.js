const filters = document.querySelectorAll('.filter');
filters.forEach((filter) => filter.addEventListener('click', () => {
  filters.forEach((item) => item.classList.remove('active'));
  filter.classList.add('active');
  filters.forEach((item) => item.setAttribute('aria-pressed', String(item === filter)));
}));

document.querySelector('#search-button').addEventListener('click', () => {
  const input = document.querySelector('#player-search');
  const label = input.value.trim() || 'Stephen Curry';
  input.value = label;
  input.setAttribute('aria-label', `正在分析 ${label}`);
  document.querySelector('#matchups .section-head h2').textContent = `${label} 的对位表现。`;
  document.querySelector('#search-status').textContent = `已切换为 ${label} 的演示对位视图。`;
});

const menuButton = document.querySelector('.menu');
const mainNav = document.querySelector('#main-nav');
menuButton.addEventListener('click', () => {
  const isOpen = mainNav.classList.toggle('is-open');
  menuButton.setAttribute('aria-expanded', String(isOpen));
  menuButton.setAttribute('aria-label', isOpen ? '关闭菜单' : '打开菜单');
});

mainNav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
  mainNav.classList.remove('is-open');
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', '打开菜单');
}));

const themeButton = document.querySelector('.icon-btn');
themeButton.addEventListener('click', () => {
  const isBright = document.body.classList.toggle('bright-mode');
  themeButton.setAttribute('aria-pressed', String(isBright));
  themeButton.textContent = isBright ? '◐' : '☼';
});
