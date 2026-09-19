module.exports = {
  ci: {
    collect: {
      url: ["http://localhost:3000/"],
      startServerCommand: "npm run start",
      numberOfRuns: 3,
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.9 }],
        "categories:pwa": ["error", { minScore: 1.0 }],
      },
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
};
