const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const logger = require('winston');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const ApiError = require('./apiError');
const config = require('./config');

const app = express();

// Logger configuration (minimal in production)
logger.configure({
  transports: [
    new logger.transports.File({ filename: 'app.log' })
  ]
});

// Middleware
app.use(cors({ origin: 'https://tkdev.onrender.com' }));
app.use(helmet());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // Limit each IP to 100 requests per windowMs
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'web')));

// Default route to serve portal.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'web', 'portal.html'));
});

// API Info endpoint
app.get('/api/info', async (req, res, next) => {
  try {
    const apiDir = path.join(__dirname, 'api');
    const stat = await fs.stat(apiDir).catch(() => null);
    if (!stat || !stat.isDirectory()) {
      throw new ApiError(500, 'API directory not found');
    }

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

// Login endpoint
app.post('/api/login', (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      throw new ApiError(400, 'Missing username or password');
    }
    if (username === 'test' && password === 'test') {
      res.json({ success: true, message: 'Login successful', user: username });
    } else {
      res.json({ success: false, message: 'Invalid credentials' });
    }
  } catch (error) {
    next(new ApiError(500, 'Login failed', error.message));
  }
});

// Dynamic API route loading
(async () => {
  const apiDir = path.join(__dirname, 'api');
  try {
    const stat = await fs.stat(apiDir).catch(() => null);
    if (!stat || !stat.isDirectory()) {
      logger.error('API directory not found');
      return;
    }

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
          } catch (error) {
            logger.error(`Failed to load module ${file}: ${error.message}`);
          }
        }
      }
    }
  } catch (error) {
    logger.error(`Failed to load API routes: ${error.message}`);
  }
})();

// 404 Error Handling
app.use((req, res, next) => {
  res.status(404).sendFile(path.join(__dirname, 'web', '404.html'));
});

// Error handling middleware
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
const PORT = process.env.PORT || config.port || 3000;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
