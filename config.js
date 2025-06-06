module.exports = {
  port: process.env.PORT || 3000,
  logger: {
    level: 'info',
    file: 'app.log'
  },
  api: {
    basePath: '/api'
  }
};
