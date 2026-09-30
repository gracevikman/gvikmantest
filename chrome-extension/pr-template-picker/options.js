const tokenInput = document.getElementById('token');
const saveButton = document.getElementById('save');
const statusText = document.getElementById('status');

async function loadSavedToken() {
  const stored = await chrome.storage.local.get('githubToken');
  tokenInput.value = stored.githubToken || '';
}

async function saveToken() {
  await chrome.storage.local.set({ githubToken: tokenInput.value.trim() });
  statusText.textContent = 'Saved';
  setTimeout(() => {
    statusText.textContent = '';
  }, 2000);
}

saveButton.addEventListener('click', saveToken);
loadSavedToken();
