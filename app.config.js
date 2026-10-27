// Extends app.json. EXPO_BASE_URL lets the web build live in a sub-folder,
// e.g. https://<user>.github.io/FairTab/ on GitHub Pages (set by .github/workflows/deploy-web.yml).
module.exports = ({ config }) => {
  const baseUrl = process.env.EXPO_BASE_URL;
  if (!baseUrl) return config;
  return { ...config, experiments: { ...config.experiments, baseUrl } };
};
