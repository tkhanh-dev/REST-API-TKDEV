const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const logger = require('winston');
const ApiError = require('./apiError');
const config = require('./config');

const app = express();

// Logger configuration
logger.configure({
  transports: [
    new logger.transports.Console(),
    new logger.transports.File({ filename: 'app.log' })
  ]
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'web')));

// API Info endpoint
app.get('/api/info', async (req, res, next) => {
  try {
    const apiDir = path.join(__dirname, 'api');
    const categories = await Promise.all(
      (await fs.readdir(apiDir)).map(async category => {
        const categoryPath = path.join(apiDir, category);
        const stat = await fs.stat(categoryPath);
        if (!stat.isDirectory()) return null;

        const items = await Promise.all(
          (await fs.readdir(categoryPath)).map(async method => {
            const methodPath = path.join(categoryPath, method);
            const stat = await fs.stat(methodPath);
            if (!stat.isDirectory()) return null;

            return Promise.all(
              (await fs.readdir(methodPath))
                .filter(file => file.endsWith('.js'))
                .map(async file => {
                  const module = require(path.join(methodPath, file));
                  return {
                    name: module.name || file.replace('.js', ''),
                    desc: module.desc || 'No description available',
                    path: `/api/${category}/${method}/${file.replace('.js', '')}`,
                    method: method.toUpperCase(),
                    author: module.author || 'TKDEV Team'
                  };
                })
            );
          })
        );
        return { name: category, items: items.flat().filter(Boolean) };
      })
    );
    res.json({ categories: categories.filter(Boolean) });
  } catch (error) {
    next(new ApiError(500, 'Failed to load API info', error.message));
  }
});

// Dynamic API route loading
(async () => {
  const apiDir = path.join(__dirname, 'api');
  for (const category of await fs.readdir(apiDir)) {
    const categoryPath = path.join(apiDir, category);
    const stat = await fs.stat(categoryPath);
    if (!stat.isDirectory()) continue;

    for (const method of await fs.readdir(categoryPath)) {
      const methodPath = path.join(categoryPath, method);
      if (!(await fs.stat(methodPath)).isDirectory()) continue;

      for (const file of (await fs.readdir(methodPath)).filter(f => f.endsWith('.js'))) {
        try {
          const module = require(path.join(methodPath, file));
          const route = `/api/${category}/${method}/${file.replace('.js', '')}`;
          app[method.toLowerCase()](route, async (req, res, next) => {
            try {
              if (module.onStart) await module.onStart();
              await module.handler(req, res, next);
            } catch (error) {
              next(new ApiError(500, `Failed to execute ${route}`, error.message));
            }
          });
          logger.info(`Loaded API route: ${method.toUpperCase()} ${route}`);
        } catch (error) {
          logger.error(`Failed to load module ${file}: ${error.message}`);
        }
      }
    }
  }
})();

// Error handling middleware
app.use((req, res, next) => {
  next(new ApiError(404, 'Route not found'));
});

app.use((err, req, res, next) => {
  logger.error(`Server Error: ${err.stack}`);
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      status: false,
      error: err.message,
      detail: err.detail
    });
  } else {
    res.status(500).sendFile(path.join(__dirname, 'web', '500.html'));
  }
});

// Start server
const PORT = config.port || 3000;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
