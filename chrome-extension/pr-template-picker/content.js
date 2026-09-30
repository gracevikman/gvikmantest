(function () {
  const {
    TEMPLATE_DIRECTORIES,
    parseCompareUrl,
    filterTemplateFiles,
    buildTemplateUrl,
    getSelectedTemplate,
  } = globalThis.PrTemplatePicker;

  const PICKER_CLASS = 'pr-template-picker';
  const PICKER_SELECTOR = '.' + PICKER_CLASS;
  const OBSERVER_DEBOUNCE_MS = 300;
  const DEFAULT_OPTION_LABEL = 'Default template';
  const NO_TEMPLATES_MESSAGE = 'No PR templates found in this repo';
  const PRIVATE_REPO_MESSAGE =
    'No PR templates found. If this is a private repo, add a GitHub token in the extension options.';
  const API_FAILED_MESSAGE =
    'Could not load PR templates. For private repos or rate limits, add a GitHub token in the extension options.';

  // In-flight or resolved result Promises per "owner/repo", so overlapping init() calls share one fetch.
  const templateResultCache = new Map();

  // Storage can throw (e.g. "Extension context invalidated"); treat that as no token.
  async function readGithubToken() {
    try {
      const stored = await chrome.storage.local.get('githubToken');
      return stored.githubToken || '';
    } catch (error) {
      return '';
    }
  }

  function buildRequestHeaders(token) {
    const headers = { Accept: 'application/vnd.github+json' };
    if (token) {
      headers.Authorization = 'Bearer ' + token;
    }
    return headers;
  }

  async function fetchTemplateNamesFromDirectory(owner, repo, directory, headers) {
    // No "ref" param: the API uses the default branch, which is where GitHub reads templates from.
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${directory}`;
    const response = await fetch(url, { headers });

    if (response.status === 404) {
      return { status: 'missing', names: [] };
    }
    if (!response.ok) {
      return { status: 'error', names: [] };
    }

    const entries = await response.json();
    const names = Array.isArray(entries) ? filterTemplateFiles(entries) : [];
    return { status: 'ok', names };
  }

  async function loadTemplateNames(owner, repo) {
    const token = await readGithubToken();
    const headers = buildRequestHeaders(token);
    let missingCount = 0;

    try {
      for (const directory of TEMPLATE_DIRECTORIES) {
        const directoryResult = await fetchTemplateNamesFromDirectory(owner, repo, directory, headers);

        if (directoryResult.status === 'error') {
          return { names: [], failed: true, maybePrivate: false };
        }
        if (directoryResult.status === 'missing') {
          missingCount += 1;
        }
        if (directoryResult.status === 'ok' && directoryResult.names.length > 0) {
          return { names: directoryResult.names, failed: false, maybePrivate: false };
        }
      }
    } catch (error) {
      return { names: [], failed: true, maybePrivate: false };
    }

    // Private repos answer 404 for every directory when no token is sent.
    const allMissing = missingCount === TEMPLATE_DIRECTORIES.length;
    return { names: [], failed: false, maybePrivate: allMissing && !token };
  }

  function fetchTemplateNames(owner, repo) {
    const cacheKey = `${owner}/${repo}`;
    if (templateResultCache.has(cacheKey)) {
      return templateResultCache.get(cacheKey);
    }

    const pendingResult = loadTemplateNames(owner, repo).then((result) => {
      // Do not keep failures so a later retry can happen.
      if (result.failed) {
        templateResultCache.delete(cacheKey);
      }
      return result;
    });
    templateResultCache.set(cacheKey, pendingResult);
    return pendingResult;
  }

  function createOption(value, label, isSelected) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    option.selected = isSelected;
    return option;
  }

  function createSelect(templateNames) {
    const select = document.createElement('select');
    select.id = 'pr-template-picker-select';

    const selectedTemplate = getSelectedTemplate(window.location.href);
    select.appendChild(createOption('', DEFAULT_OPTION_LABEL, !selectedTemplate));
    templateNames.forEach((name) => {
      select.appendChild(createOption(name, name, name === selectedTemplate));
    });

    select.addEventListener('change', () => {
      window.location.assign(buildTemplateUrl(window.location.href, select.value));
    });
    return select;
  }

  function createLabel() {
    const label = document.createElement('label');
    label.htmlFor = 'pr-template-picker-select';
    label.textContent = 'PR template';
    return label;
  }

  function createMessage(text) {
    const message = document.createElement('span');
    message.className = 'pr-template-picker-message';
    message.textContent = text;
    return message;
  }

  function createPicker(result, repoKey) {
    const container = document.createElement('div');
    container.className = PICKER_CLASS;
    container.dataset.repo = repoKey;
    container.dataset.template = getSelectedTemplate(window.location.href) || '';

    if (result.failed) {
      container.appendChild(createMessage(API_FAILED_MESSAGE));
    } else if (result.maybePrivate) {
      container.appendChild(createMessage(PRIVATE_REPO_MESSAGE));
    } else if (result.names.length === 0) {
      container.appendChild(createMessage(NO_TEMPLATES_MESSAGE));
    } else {
      container.appendChild(createLabel());
      container.appendChild(createSelect(result.names));
    }
    return container;
  }

  function insertBeforeTitle(picker) {
    const titleContainer = document.querySelector('#pull_request_title')?.parentElement;
    const newPullRequestForm = document.querySelector('#new_pull_request');
    if (!titleContainer || !newPullRequestForm || !newPullRequestForm.contains(titleContainer)) {
      return false;
    }

    // The title container is not always a direct child of the form.
    titleContainer.parentNode.insertBefore(picker, titleContainer);
    return true;
  }

  function insertAfterRangeEditor(picker) {
    const rangeEditor = document.querySelector('.range-editor');
    if (!rangeEditor || !rangeEditor.parentNode) {
      return false;
    }

    rangeEditor.parentNode.insertBefore(picker, rangeEditor.nextSibling);
    return true;
  }

  function insertFloating(picker) {
    picker.classList.add('pr-template-picker--floating');
    document.body.appendChild(picker);
  }

  // GitHub markup changes often, so each strategy is best effort and a
  // throwing or failing one falls through to the floating panel, which always works.
  function insertPicker(picker) {
    const strategies = [insertBeforeTitle, insertAfterRangeEditor];
    for (const strategy of strategies) {
      try {
        if (strategy(picker)) {
          return;
        }
      } catch (error) {
        // Try the next strategy.
      }
    }
    insertFloating(picker);
  }

  function getCurrentRepoKey() {
    const compare = parseCompareUrl(window.location.href);
    return compare ? `${compare.owner}/${compare.repo}` : null;
  }

  function pickerMatchesUrl(picker, repoKey) {
    const selectedTemplate = getSelectedTemplate(window.location.href) || '';
    return picker.dataset.repo === repoKey && picker.dataset.template === selectedTemplate;
  }

  function hasUpToDatePicker(repoKey) {
    const existingPicker = document.querySelector(PICKER_SELECTOR);
    return Boolean(existingPicker) && pickerMatchesUrl(existingPicker, repoKey);
  }

  async function init() {
    const repoKey = getCurrentRepoKey();
    if (!repoKey || hasUpToDatePicker(repoKey)) {
      return;
    }

    const [owner, repo] = repoKey.split('/');
    const result = await fetchTemplateNames(owner, repo);

    // Re-check: the URL may have changed, or another init() may have injected, while we awaited.
    if (getCurrentRepoKey() !== repoKey || hasUpToDatePicker(repoKey)) {
      return;
    }
    document.querySelector(PICKER_SELECTOR)?.remove();
    insertPicker(createPicker(result, repoKey));
  }

  async function safeInit() {
    try {
      await init();
    } catch (error) {
      // Never let a failure become a repeating unhandled rejection.
    }
  }

  function debounce(callback, delayMs) {
    let timeoutId = null;
    return () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(callback, delayMs);
    };
  }

  document.addEventListener('turbo:load', safeInit);
  window.addEventListener('popstate', safeInit);
  new MutationObserver(debounce(safeInit, OBSERVER_DEBOUNCE_MS)).observe(document.body, {
    childList: true,
    subtree: true,
  });

  safeInit();
})();
