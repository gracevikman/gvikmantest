(function () {
  const TEMPLATE_DIRECTORIES = [
    '.github/PULL_REQUEST_TEMPLATE',
    'PULL_REQUEST_TEMPLATE',
    'docs/PULL_REQUEST_TEMPLATE',
    '.github/pull_request_template',
    'pull_request_template',
    'docs/pull_request_template',
  ];

  const TEMPLATE_FILE_EXTENSION_PATTERN = /\.(md|txt)$/i;

  function parseCompareUrl(url) {
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (error) {
      return null;
    }

    const match = parsedUrl.pathname.match(/^\/([^/]+)\/([^/]+)\/compare(\/|$)/);
    if (!match) {
      return null;
    }

    return { owner: match[1], repo: match[2] };
  }

  function filterTemplateFiles(contentsApiEntries) {
    return contentsApiEntries
      .filter((entry) => entry.type === 'file')
      .filter((entry) => TEMPLATE_FILE_EXTENSION_PATTERN.test(entry.name))
      .map((entry) => entry.name)
      .sort();
  }

  function buildTemplateUrl(currentUrl, templateName) {
    const url = new URL(currentUrl);

    // expand=1 makes GitHub open the PR form instead of the commit list.
    url.searchParams.set('expand', '1');

    if (templateName) {
      url.searchParams.set('template', templateName);
    } else {
      url.searchParams.delete('template');
    }

    return url.toString();
  }

  function getSelectedTemplate(url) {
    return new URL(url).searchParams.get('template');
  }

  const api = {
    TEMPLATE_DIRECTORIES,
    parseCompareUrl,
    filterTemplateFiles,
    buildTemplateUrl,
    getSelectedTemplate,
  };

  globalThis.PrTemplatePicker = api;

  if (typeof module !== 'undefined') {
    module.exports = api;
  }
})();
