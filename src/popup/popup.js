document.addEventListener('DOMContentLoaded', async () => {
  const btn = document.getElementById('toggle');
  const hint = document.getElementById('hint');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  // Check current state
  const { active, font } = await chrome.runtime.sendMessage({ type: 'query', tabId: tab.id });
  updateUI(active);
  updateFontUI(font || 'sans');

  btn.addEventListener('click', async () => {
    const { active } = await chrome.runtime.sendMessage({ type: 'toggle', tabId: tab.id });
    updateUI(active);
    if (active) window.close();
  });

  // Font buttons
  for (const fbtn of document.querySelectorAll('.font-btn')) {
    fbtn.addEventListener('click', async () => {
      const font = fbtn.dataset.font;
      updateFontUI(font);
      await chrome.runtime.sendMessage({ type: 'setFont', tabId: tab.id, font });
    });
  }

  function updateUI(active) {
    btn.textContent = active ? 'Disable' : 'Enable';
    btn.classList.toggle('active', active);
    hint.textContent = active
      ? 'Reader mode ON — persists in this tab'
      : 'Reader mode for this tab';
  }

  function updateFontUI(font) {
    for (const fbtn of document.querySelectorAll('.font-btn')) {
      fbtn.classList.toggle('active', fbtn.dataset.font === font);
    }
  }
});
