export function scrollToId(hash) {
  const target = document.querySelector(hash);
  if (!target) return;
  window.scrollTo({
    top: target.getBoundingClientRect().top + window.pageYOffset - 58,
    behavior: 'smooth'
  });
}
