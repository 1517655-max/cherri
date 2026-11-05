document.getElementById('launch-form')?.addEventListener('submit', (event) => {
  const input = document.getElementById('destination');
  if (!input.value.trim()) {
    event.preventDefault();
    input.setCustomValidity('Enter a website or search query.');
    input.reportValidity();
  } else if (window.parent !== window && typeof window.parent.nav === 'function') {
    event.preventDefault();
    window.parent.nav(input.value.trim());
  }
});
document.getElementById('destination')?.addEventListener('input', (event) => event.target.setCustomValidity(''));
